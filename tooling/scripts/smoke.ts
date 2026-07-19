import { execFile, spawn, type ChildProcess } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import {
  ApiErrorSchema,
  ApiResultSchema,
  DoctorDataSchema,
  HealthResponseSchema,
  OperationRecordSchema,
  ReadyDataSchema,
  RepositoryIndexOperationSchema,
  SafeConfigSchema,
} from "@agentintersect-world/world-schema";

const execFileAsync = promisify(execFile);

async function disposablePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close();
        reject(new Error("failed to allocate a disposable port"));
        return;
      }
      probe.close((error) =>
        error ? reject(error) : resolvePort(address.port),
      );
    });
  });
}

async function waitFor(url: string, timeoutMs = 20_000): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`timed out waiting for ${url}`, { cause: lastError });
}

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await new Promise<void>((resolveExit) => {
    const forceTimeout = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
    }, 5_000);
    const absoluteTimeout = setTimeout(resolveExit, 7_000);
    child.once("exit", () => {
      clearTimeout(forceTimeout);
      clearTimeout(absoluteTimeout);
      resolveExit();
    });
  });
}

const serverPort = await disposablePort();
let webPort = await disposablePort();
while (webPort === serverPort) webPort = await disposablePort();
const children: ChildProcess[] = [];
const fixtureContainer = await mkdtemp(join(tmpdir(), "aiw-phase3-smoke-"));
const nonGitRoot = join(fixtureContainer, "non-git");
const gitRoot = join(fixtureContainer, "git");

try {
  await Promise.all([mkdir(nonGitRoot), mkdir(gitRoot)]);
  const packageSource = JSON.stringify({
    name: "phase3-smoke",
    scripts: { postinstall: "touch SENTINEL_EXECUTED" },
  });
  await writeFile(join(nonGitRoot, "package.json"), packageSource);
  await writeFile(join(nonGitRoot, "index.ts"), "export const smoke = true;\n");
  const fixtureGit = async (...args: string[]) =>
    await execFileAsync("git", [
      "-c",
      "core.hooksPath=/dev/null",
      "-C",
      gitRoot,
      ...args,
    ]);
  await fixtureGit("init", "-b", "phase3-smoke");
  await fixtureGit("config", "user.name", "Phase 3 Smoke");
  await fixtureGit("config", "user.email", "smoke@example.invalid");
  await writeFile(
    join(gitRoot, "tracked.ts"),
    "export const tracked = true;\n",
  );
  await fixtureGit("add", "tracked.ts");
  await fixtureGit("commit", "-m", "fixture");
  await mkdir(join(gitRoot, ".git", "hooks"), { recursive: true });
  await writeFile(
    join(gitRoot, ".git", "hooks", "post-index-change"),
    "#!/bin/sh\ntouch HOOK_EXECUTED\n",
    { mode: 0o755 },
  );
  await writeFile(join(gitRoot, "untracked.py"), "smoke = True\n");

  const server = spawn(
    process.execPath,
    [resolve("apps/local-server/dist/index.js")],
    {
      cwd: resolve("."),
      env: {
        ...process.env,
        AIW_HOST: "127.0.0.1",
        AIW_PORT: String(serverPort),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  children.push(server);

  const web = spawn(
    process.execPath,
    [
      resolve("node_modules/vite/bin/vite.js"),
      "preview",
      "apps/web",
      "--config",
      "apps/web/vite.config.ts",
      "--host",
      "127.0.0.1",
      "--port",
      String(webPort),
      "--strictPort",
    ],
    {
      cwd: resolve("."),
      env: {
        ...process.env,
        AIW_LOCAL_SERVER_URL: `http://127.0.0.1:${serverPort}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  children.push(web);

  const healthResponse = await waitFor(`http://127.0.0.1:${serverPort}/health`);
  const health = HealthResponseSchema.parse(await healthResponse.json());
  const correlationHeader = healthResponse.headers.get("x-correlation-id");
  if (correlationHeader !== health.correlationId)
    throw new Error("health correlation header mismatch");

  const api = `http://127.0.0.1:${serverPort}`;
  const readyResponse = await fetch(`${api}/ready`);
  ApiResultSchema(ReadyDataSchema).parse(await readyResponse.json());
  const configResponse = await fetch(`${api}/config`);
  ApiResultSchema(SafeConfigSchema).parse(await configResponse.json());
  const doctorResponse = await fetch(`${api}/doctor`);
  ApiResultSchema(DoctorDataSchema).parse(await doctorResponse.json());
  const openapiResponse = await fetch(`${api}/openapi.json`);
  const openapi = (await openapiResponse.json()) as { paths?: object };
  if (openapi.paths === undefined)
    throw new Error("OpenAPI paths are missing from generated document");

  const createIndex = async (rootPath: string, key: string) => {
    const response = await fetch(`${api}/repository-indexes`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": key,
      },
      body: JSON.stringify({ rootPath }),
    });
    return ApiResultSchema(RepositoryIndexOperationSchema).parse(
      await response.json(),
    ).data;
  };
  const settleIndex = async (operation: { id: string }) => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const response = await fetch(`${api}/repository-indexes/${operation.id}`);
      const current = ApiResultSchema(RepositoryIndexOperationSchema).parse(
        await response.json(),
      ).data;
      if (current.status !== "running") return current;
      await new Promise((resolveWait) => setTimeout(resolveWait, 10));
    }
    throw new Error("repository index smoke timed out");
  };
  const firstIndex = await settleIndex(
    await createIndex(nonGitRoot, "smoke-index-1"),
  );
  if (firstIndex.status !== "succeeded" || !firstIndex.generation)
    throw new Error("non-Git smoke index failed");
  const rescan = await settleIndex(
    await createIndex(nonGitRoot, "smoke-index-2"),
  );
  if (rescan.generation?.fingerprint !== firstIndex.generation.fingerprint)
    throw new Error("unchanged rescan fingerprint changed");
  const gitIndex = await settleIndex(
    await createIndex(gitRoot, "smoke-index-git"),
  );
  if (
    gitIndex.status !== "succeeded" ||
    !gitIndex.generation?.git.present ||
    gitIndex.generation.git.branch !== "phase3-smoke"
  )
    throw new Error("Git smoke metadata failed");
  if (
    (await readFile(join(nonGitRoot, "package.json"), "utf8")) !== packageSource
  )
    throw new Error("selected repository was mutated");
  for (const sentinel of [
    join(nonGitRoot, "SENTINEL_EXECUTED"),
    join(gitRoot, "HOOK_EXECUTED"),
  ]) {
    try {
      await access(sentinel);
      throw new Error(`sentinel was executed: ${sentinel}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  const createOperation = async (key: string, durationMs: number) =>
    await fetch(`${api}/operations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": key,
      },
      body: JSON.stringify({ kind: "demo-delay", durationMs, label: key }),
    });
  const firstResponse = await createOperation("smoke-cancel", 500);
  const first = ApiResultSchema(OperationRecordSchema).parse(
    await firstResponse.json(),
  ).data;
  const replayResponse = await createOperation("smoke-cancel", 500);
  const replay = ApiResultSchema(OperationRecordSchema).parse(
    await replayResponse.json(),
  ).data;
  if (replay.id !== first.id) throw new Error("idempotent replay changed ID");
  const conflictResponse = await createOperation("smoke-cancel", 400);
  const conflict = ApiErrorSchema.parse(await conflictResponse.json());
  if (conflictResponse.status !== 409 || conflict.error.code !== "conflict")
    throw new Error("operation conflict response is unstable");
  const cancelResponse = await fetch(`${api}/operations/${first.id}/cancel`, {
    method: "POST",
  });
  const cancelled = ApiResultSchema(OperationRecordSchema).parse(
    await cancelResponse.json(),
  ).data;
  if (cancelled.status !== "cancelled")
    throw new Error("smoke operation did not cancel");

  const completingResponse = await createOperation("smoke-complete", 50);
  const completing = ApiResultSchema(OperationRecordSchema).parse(
    await completingResponse.json(),
  ).data;
  await new Promise((resolveWait) => setTimeout(resolveWait, 80));
  const completedResponse = await fetch(`${api}/operations/${completing.id}`);
  const completed = ApiResultSchema(OperationRecordSchema).parse(
    await completedResponse.json(),
  ).data;
  if (completed.status !== "succeeded")
    throw new Error("smoke operation did not complete");

  const webResponse = await waitFor(`http://127.0.0.1:${webPort}/`);
  const html = await webResponse.text();
  if (!html.includes("AgentIntersect World"))
    throw new Error("built web page identity is missing");

  process.stdout.write(
    `Smoke passed: Phase 3 authority, deterministic Git/non-Git repository indexes, no-execution sentinels, demo operations, and built web on disposable ports ${serverPort}/${webPort}.\n`,
  );
} finally {
  await Promise.all(children.reverse().map(stop));
  await rm(fixtureContainer, { recursive: true, force: true });
}
