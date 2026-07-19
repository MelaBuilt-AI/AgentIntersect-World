import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";

import {
  ApiErrorSchema,
  ApiResultSchema,
  DoctorDataSchema,
  HealthResponseSchema,
  OperationRecordSchema,
  ReadyDataSchema,
  SafeConfigSchema,
} from "@agentintersect-world/world-schema";

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

try {
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
    `Smoke passed: Phase 2 inspection/operation API and built web served on disposable ports ${serverPort}/${webPort}.\n`,
  );
} finally {
  await Promise.all(children.reverse().map(stop));
}
