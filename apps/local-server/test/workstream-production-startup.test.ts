import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import {
  createServer as createHttpServer,
  type Server as HttpServer,
} from "node:http";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const executeFile = promisify(execFile);
const nodeExecutable = process.execPath;
const roots: string[] = [];
const children: ReturnType<typeof startProductionServer>[] = [];
const servers: Array<Server | HttpServer> = [];

async function listen(server: Server | HttpServer): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing port");
  return address.port;
}

async function close(server: Server | HttpServer): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function waitFor(
  condition: () => boolean | Promise<boolean>,
  description: string,
): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`timed out waiting for ${description}`);
}

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const { stdout } = await executeFile("git", [...args], {
    cwd,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      GIT_AUTHOR_NAME: "Production Workstream Test",
      GIT_AUTHOR_EMAIL: "production-workstream@example.invalid",
      GIT_COMMITTER_NAME: "Production Workstream Test",
      GIT_COMMITTER_EMAIL: "production-workstream@example.invalid",
      LC_ALL: "C",
    },
  });
  return stdout;
}

function startProductionServer(environment: Record<string, string>) {
  const env = { ...process.env };
  for (const key of [
    "AIW_PHASE16_REPOSITORY_ROOT",
    "AIW_PHASE16_WORKTREE_PARENT",
    "AIW_AGENT_SESSIONS_ENABLED",
    "AIW_AGENT_SESSION_DATA_DIR",
    "AIW_HERMES_API_URL",
    "AIW_HERMES_API_KEY",
    "AIW_HERMES_PROFILE",
  ])
    delete env[key];
  Object.assign(env, environment);
  const child = execFile(
    process.execPath,
    ["--import", "tsx", path.resolve("apps/local-server/src/index.ts")],
    {
      cwd: path.resolve("."),
      env,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk: string) => (stdout += chunk));
  child.stderr?.on("data", (chunk: string) => (stderr += chunk));
  const spawned = { child, stdout: () => stdout, stderr: () => stderr };
  children.push(spawned);
  return spawned;
}

async function stopProductionServer(
  process: ReturnType<typeof startProductionServer>,
): Promise<void> {
  if (process.child.exitCode !== null || process.child.signalCode !== null)
    return;
  const exited = new Promise<void>((resolve) =>
    process.child.once("exit", () => resolve()),
  );
  process.child.kill("SIGTERM");
  await exited;
}

async function productionFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-workstream-production-"));
  roots.push(root);
  const repositoryRoot = path.join(root, "repository");
  const worktreeParent = path.join(root, "worktrees");
  await mkdir(repositoryRoot);
  await mkdir(worktreeParent);
  await git(root, ["init", "--initial-branch=main", repositoryRoot]);
  await git(repositoryRoot, [
    "config",
    "user.name",
    "Production Workstream Test",
  ]);
  await git(repositoryRoot, [
    "config",
    "user.email",
    "production-workstream@example.invalid",
  ]);
  await writeFile(
    path.join(repositoryRoot, "package.json"),
    JSON.stringify({ name: "workstream-production-fixture", version: "1.0.0" }),
  );
  await writeFile(
    path.join(repositoryRoot, "index.ts"),
    "export const ready = true;\n",
  );
  await writeFile(
    path.join(repositoryRoot, "preview.mjs"),
    `import http from "node:http";
const server = http.createServer((request, response) => {
  response.statusCode = 200;
  response.setHeader("content-type", request.url === "/health" ? "application/json" : "text/html");
  response.end(request.url === "/health" ? JSON.stringify({ ok: true }) : "<!doctype html><title>Production preview</title><main>exact Workstream preview</main>");
});
server.listen(Number(process.env.PORT), process.env.HOST);
`,
  );
  await git(repositoryRoot, ["add", "."]);
  await git(repositoryRoot, ["commit", "-m", "fixture: initial"]);

  const hermes = createHttpServer((request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/v1/capabilities") {
      response.end(
        JSON.stringify({
          features: { session_resources: true, session_chat_streaming: true },
        }),
      );
      return;
    }
    const messages = request.url?.match(
      /^\/api\/sessions\/([^/]+)\/messages$/u,
    );
    if (messages) {
      response.end(
        JSON.stringify({
          object: "list",
          data: [],
          session_id: decodeURIComponent(messages[1]!),
        }),
      );
      return;
    }
    const chat = request.url?.match(
      /^\/api\/sessions\/([^/]+)\/chat\/stream$/u,
    );
    if (chat && request.method === "POST") {
      const id = decodeURIComponent(chat[1]!);
      response.setHeader("content-type", "text/event-stream");
      response.end(
        [
          `event: run.started\ndata: ${JSON.stringify({ session_id: id, run_id: "run-workstream", seq: 1 })}\n\n`,
          `event: message.started\ndata: ${JSON.stringify({ session_id: id, run_id: "run-workstream", message: { id: "message-workstream", role: "assistant" }, seq: 2 })}\n\n`,
          `event: assistant.completed\ndata: ${JSON.stringify({ session_id: id, run_id: "run-workstream", message_id: "message-workstream", content: "Workstream task accepted.", seq: 3 })}\n\n`,
          `event: run.completed\ndata: ${JSON.stringify({ session_id: id, run_id: "run-workstream", seq: 4 })}\n\n`,
          `event: done\ndata: ${JSON.stringify({ session_id: id, run_id: "run-workstream", seq: 5 })}\n\n`,
        ].join(""),
      );
      return;
    }
    const session = request.url?.match(/^\/api\/sessions\/([^/?]+)$/u);
    if (session) {
      const id = decodeURIComponent(session[1]!);
      response.end(
        JSON.stringify({ session: { id, source: "fixture", title: id } }),
      );
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not found" }));
  });
  const hermesPort = await listen(hermes);
  return { root, repositoryRoot, worktreeParent, hermesPort };
}

async function startAtAvailablePort(environment: Record<string, string>) {
  const presentationDataDir = environment.AIW_PRESENTATION_DATA_DIR;
  if (!presentationDataDir)
    throw new Error("production fixture requires a presentation data root");
  const reservation = createServer();
  const port = await listen(reservation);
  await close(reservation);
  const process = startProductionServer({
    AIW_NETWORK_SCOPE: "loopback",
    AIW_HOST: "127.0.0.1",
    AIW_PORT: String(port),
    AIW_AGENTINTERSECT_ENABLED: "false",
    AIW_AGENTINTERSECT_COMMANDS_ENABLED: "false",
    AIW_PHASE17_STATE_DIR: path.join(presentationDataDir, "phase17"),
    ...environment,
  });
  await waitFor(
    () =>
      process.stdout().includes("local server ready") ||
      process.child.exitCode !== null,
    "production local server",
  );
  if (process.child.exitCode !== null)
    throw new Error(`production server exited: ${process.stderr()}`);
  return { baseUrl: `http://127.0.0.1:${port}`, process };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false,
  );
}

afterEach(async () => {
  await Promise.all(children.splice(0).map(stopProductionServer));
  await Promise.all(servers.splice(0).map(close));
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("production Workstream startup composition", () => {
  it("provides normal Workbench storage with agent sessions even without legacy Phase 16 Git configuration", async () => {
    const fixture = await productionFixture();
    const configurations = [
      {
        AIW_AGENT_SESSIONS_ENABLED: "true",
        AIW_AGENT_SESSION_DATA_DIR: path.join(fixture.root, "sessions-only"),
        AIW_HERMES_API_URL: `http://127.0.0.1:${fixture.hermesPort}`,
        AIW_HERMES_API_KEY: "fixture-key",
        AIW_HERMES_PROFILE: "fixture",
        AIW_PRESENTATION_DATA_DIR: path.join(
          fixture.root,
          "presentation-sessions-only",
        ),
      },
      {
        AIW_AGENT_SESSIONS_ENABLED: "false",
        AIW_PHASE16_REPOSITORY_ROOT: fixture.repositoryRoot,
        AIW_PHASE16_WORKTREE_PARENT: fixture.worktreeParent,
        AIW_PRESENTATION_DATA_DIR: path.join(
          fixture.root,
          "presentation-git-only",
        ),
      },
    ];

    for (const configuration of configurations) {
      const { baseUrl, process } = await startAtAvailablePort(configuration);
      const response = await fetch(`${baseUrl}/workstreams/current`);
      expect(response.status).toBe(404);
      expect(
        (await json<{ error: { message: string } }>(response)).error.message,
      ).toBe("No current Workstream");
      if (configuration.AIW_AGENT_SESSIONS_ENABLED === "true") {
        const history = await fetch(
          `${baseUrl}/workstreams/history?repositoryId=not-loaded`,
        );
        expect(history.status).toBe(200);
        expect((await history.json()).data.workstreams).toEqual([]);
      }
      await stopProductionServer(process);
    }
  });

  it("registers the real lifecycle only with exact current repository and World session bindings", async () => {
    const fixture = await productionFixture();
    const environment = {
      AIW_AGENT_SESSIONS_ENABLED: "true",
      AIW_AGENT_SESSION_DATA_DIR: path.join(fixture.root, "agent-sessions"),
      AIW_HERMES_API_URL: `http://127.0.0.1:${fixture.hermesPort}`,
      AIW_HERMES_API_KEY: "fixture-key",
      AIW_HERMES_PROFILE: "fixture",
      AIW_PRESENTATION_DATA_DIR: path.join(fixture.root, "presentation"),
      AIW_PHASE16_REPOSITORY_ROOT: fixture.repositoryRoot,
      AIW_PHASE16_WORKTREE_PARENT: fixture.worktreeParent,
    };
    let { baseUrl, process } = await startAtAvailablePort(environment);

    const constellation = await fetch(`${baseUrl}/constellation/current`);
    expect(constellation.status).toBe(200);
    expect(
      (
        await json<{
          data: { projection: { revision: number; agents: unknown[] } };
        }>(constellation)
      ).data.projection,
    ).toMatchObject({ revision: 0, agents: [] });

    const absent = await fetch(`${baseUrl}/workstreams/current`);
    expect(absent.status).toBe(404);
    expect(
      (await json<{ error: { message: string } }>(absent)).error.message,
    ).toBe("No current Workstream");

    const beforeRepository = await fetch(`${baseUrl}/workstreams`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestId: "create-before-repository",
        correlationId: "correlation-before-repository",
        title: "Must remain closed",
        repository: {
          repositoryId: "repo-missing",
          revision: "generation-missing",
        },
        agent: {
          agentId: "session-missing",
          nativeSessionId: "native-missing",
          revision: "0",
        },
      }),
    });
    expect(beforeRepository.status).not.toBe(201);
    expect(await readdir(fixture.worktreeParent)).toEqual([]);

    const started = await fetch(`${baseUrl}/repository-indexes`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": randomUUID(),
      },
      body: JSON.stringify({ rootPath: fixture.repositoryRoot }),
    });
    expect(started.status).toBe(202);
    const operationId = (await json<{ data: { id: string } }>(started)).data.id;
    let operation: {
      readonly status: string;
      readonly generation: { readonly id: string };
    } | null = null;
    await waitFor(async () => {
      const response = await fetch(
        `${baseUrl}/repository-indexes/${operationId}`,
      );
      operation = (
        await json<{
          data: {
            status: string;
            generation: { id: string };
          };
        }>(response)
      ).data;
      return operation?.status !== "running";
    }, "repository index");
    expect(operation?.status).toBe("succeeded");
    const world = await fetch(`${baseUrl}/world/current`);
    expect(world.status).toBe(200);
    const snapshot = (
      await json<{ data: { snapshot: { repositoryRef: string } } }>(world)
    ).data.snapshot;
    const repository = {
      repositoryId: snapshot.repositoryRef,
      revision: operation?.generation.id as string,
    };

    const beforeSession = await fetch(`${baseUrl}/workstreams`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestId: "create-before-session",
        correlationId: "correlation-before-session",
        title: "Still closed without a session",
        repository,
        agent: {
          agentId: "session-missing",
          nativeSessionId: "native-missing",
          revision: "0",
        },
      }),
    });
    expect(beforeSession.status).not.toBe(201);
    expect(await readdir(fixture.worktreeParent)).toEqual([]);

    const attached = await fetch(`${baseUrl}/agent-sessions/attach`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        adapterId: "hermes",
        adapterSessionRef: "hermes-production-session",
        profile: "fixture",
        workspaceId: "workspace_fixture",
        repositoryRef: snapshot.repositoryRef,
        mode: "explore",
      }),
    });
    const attachedBody = await json<{
      data: {
        sessionId: string;
        adapterSessionRef: string;
        adapterRootSessionRef?: string;
        permissionRevision: number;
      };
    }>(attached);
    expect(attached.status, JSON.stringify(attachedBody)).toBe(201);
    const session = attachedBody.data;
    const agent = {
      agentId: session.sessionId,
      nativeSessionId: session.adapterSessionRef,
      rootNativeSessionId:
        session.adapterRootSessionRef ?? session.adapterSessionRef,
      revision: String(session.permissionRevision),
    };

    const createResponse = await fetch(`${baseUrl}/workstreams`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestId: "create-production-workstream",
        correlationId: "correlation-production-workstream",
        title: "Production-bound Workstream",
        task: "Implement the production-bound Workstream fixture.",
        repository,
        agent,
      }),
    });
    const createBody = await json<{
      data: {
        workstream: {
          workstreamId: string;
          revision: number;
          repository: typeof repository;
          agent: typeof agent;
          evidenceOperationRefs: string[];
          authority: { relativePath: string; worktreeId: string };
        };
      };
    }>(createResponse);
    expect(createResponse.status, JSON.stringify(createBody)).toBe(201);
    const created = createBody.data.workstream;
    expect(created).toMatchObject({
      repository,
      agent: { ...agent, revision: "1" },
    });
    const boundSession = await fetch(
      `${baseUrl}/agent-sessions/${session.sessionId}/status`,
    );
    expect((await json<{ data: unknown }>(boundSession)).data).toMatchObject({
      mode: "collaborate",
      worktreeRef: created.authority.worktreeId,
      currentTaskRef: created.workstreamId,
    });
    const worktreePath = path.join(
      fixture.worktreeParent,
      created.authority.relativePath,
    );
    expect(await exists(worktreePath)).toBe(true);

    const current = await fetch(`${baseUrl}/workstreams/current`);
    expect(current.status).toBe(200);
    const currentWorkstream = (
      await json<{
        data: {
          workstreamId: string;
          revision: number;
          agent: typeof created.agent;
        };
      }>(current)
    ).data;
    expect(currentWorkstream.workstreamId).toBe(created.workstreamId);
    await waitFor(async () => {
      const response = await fetch(`${baseUrl}/workstreams/current`);
      if (!response.ok) return false;
      const body = await json<{
        data: {
          status: string;
          currentActivity?: string;
          evidenceOperationRefs: string[];
        };
      }>(response);
      // This startup fixture intentionally has no attested Hermes arbiter.
      // Allocation/preview/cleanup must remain usable after that explicit failure.
      return (
        body.data.status === "blocked" &&
        body.data.evidenceOperationRefs.some((reference) =>
          /^agent-event:/u.test(reference),
        )
      );
    }, "correlated Workstream agent evidence");
    const read = await fetch(`${baseUrl}/workstreams/${created.workstreamId}`);
    expect(read.status).toBe(200);
    let latestRevision = (await json<{ data: { revision: number } }>(read)).data
      .revision;

    const approvedRecipe = await fetch(`${baseUrl}/preview-recipes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestId: "approve-production-preview",
        correlationId: "correlation-approve-production-preview",
        recipeId: "production-web",
        expectedRevision: null,
        repositoryId: repository.repositoryId,
        label: "Production Workstream preview",
        executable: nodeExecutable,
        args: ["preview.mjs"],
        readinessPath: "/health",
        browserPath: "/",
      }),
    });
    expect(approvedRecipe.status, await approvedRecipe.clone().text()).toBe(
      201,
    );
    const startedPreview = await fetch(
      `${baseUrl}/workstreams/${created.workstreamId}/previews`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: "start-production-preview",
          correlationId: "correlation-start-production-preview",
          expectedWorkstreamRevision: latestRevision,
          repository,
          agent: currentWorkstream.agent,
          recipeId: "production-web",
          expectedRecipeRevision: 1,
        }),
      },
    );
    const startedPreviewBody = await json<{
      data: {
        preview: { revision: number; state: string; url: string };
      };
    }>(startedPreview);
    expect(startedPreview.status, JSON.stringify(startedPreviewBody)).toBe(201);
    const preview = startedPreviewBody.data.preview;
    expect(preview.state).toBe("ready");
    expect(await (await fetch(preview.url)).text()).toContain(
      "exact Workstream preview",
    );

    // Real production HTTP/Git/preview path; only the external Hermes transport is a fixture.
    const opened = await fetch(`${baseUrl}/repository-intake/open`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rootPath: fixture.repositoryRoot,
        name: "Saved website",
      }),
    });
    const project = (await opened.json()).data.project;
    expect(opened.status).toBe(201);
    const selection = await fetch(
      `${baseUrl}/repository-intake/selected?repositoryId=${encodeURIComponent(repository.repositoryId)}`,
    );
    expect((await selection.json()).data.project.id).toBe(project.id);
    await writeFile(
      path.join(worktreePath, "saved.txt"),
      "saved website checkpoint\n",
    );
    const gitUrl = `${baseUrl}/repository-intake/projects/${project.id}/git`;
    const gitStatus = (
      await (
        await fetch(`${gitUrl}?workstreamId=${created.workstreamId}`)
      ).json()
    ).data;
    const committed = await fetch(gitUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "commit",
        confirm: true,
        expectedHead: gitStatus.head,
        expectedBranch: gitStatus.branch,
        workstreamId: created.workstreamId,
        files: ["saved.txt"],
        message: "test: saved website checkpoint",
      }),
    });
    const commitBody = await committed.json();
    expect(committed.status, JSON.stringify(commitBody)).toBe(200);
    expect(await git(worktreePath, ["show", "HEAD:saved.txt"])).toBe(
      "saved website checkpoint\n",
    );
    const history = await fetch(
      `${baseUrl}/workstreams/history?repositoryId=${encodeURIComponent(repository.repositoryId)}`,
    );
    expect((await history.json()).data.workstreams[0].workstreamId).toBe(
      created.workstreamId,
    );
    const savedBefore = (
      await (await fetch(`${baseUrl}/workstreams/current`)).json()
    ).data;
    const sessionBefore = (
      await (
        await fetch(`${baseUrl}/agent-sessions/${session.sessionId}/status`)
      ).json()
    ).data;
    await writeFile(
      path.join(worktreePath, "untracked.txt"),
      "unsaved work stays here\n",
    );
    await writeFile(
      path.join(worktreePath, "index.ts"),
      "export const ready = 'edited';\n",
    );
    const dirtyBefore = await git(worktreePath, ["status", "--porcelain=v1"]);
    const resumed = await fetch(
      `${baseUrl}/workstreams/${created.workstreamId}/continue`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          expectedRevision: latestRevision,
          repository,
          agent: currentWorkstream.agent,
        }),
      },
    );
    const resumeBody = await resumed.json();
    expect(
      resumed.status,
      JSON.stringify(resumeBody) + process.stderr() + process.stdout(),
    ).toBe(200);
    expect(resumeBody.data.workstream.authority.head).toBe(
      commitBody.data.status.head,
    );
    expect(resumeBody.data.workstream.authority.worktreeId).toBe(
      created.authority.worktreeId,
    );
    currentWorkstream.agent = resumeBody.data.workstream.agent;
    expect(resumeBody.data.workstream.task).toBe(savedBefore.task);
    expect(resumeBody.data.workstream.authority.branch).toBe(
      commitBody.data.status.branch,
    );
    expect(resumeBody.data.workstream.authority.relativePath).toBe(
      created.authority.relativePath,
    );
    expect(
      await readFile(path.join(worktreePath, "untracked.txt"), "utf8"),
    ).toBe("unsaved work stays here\n");
    expect(await readFile(path.join(worktreePath, "index.ts"), "utf8")).toBe(
      "export const ready = 'edited';\n",
    );
    expect(await git(worktreePath, ["status", "--porcelain=v1"])).toBe(
      dirtyBefore,
    );
    const sessionAfter = (
      await (
        await fetch(`${baseUrl}/agent-sessions/${session.sessionId}/status`)
      ).json()
    ).data;
    expect(sessionAfter).toEqual(sessionBefore);
    expect(resumeBody.data.workstream.events.slice(0, -1)).toEqual(
      savedBefore.events,
    );
    expect(resumeBody.data.workstream.events.at(-1).summary).toContain(
      "No coding turn sent.",
    );
    expect(
      (
        await (
          await fetch(
            `${baseUrl}/workstreams/${created.workstreamId}/previews/current`,
          )
        ).json()
      ).data.display.preview.url,
    ).toBe(preview.url);
    expect(await (await fetch(preview.url)).text()).toContain(
      "exact Workstream preview",
    );

    // A new application process must recover the same work, not just Continue
    // while the original preview is still alive. External Hermes stays a fixture.
    const historyBeforeRestart = (
      await (
        await fetch(`${baseUrl}/agent-sessions/${session.sessionId}/history`)
      ).json()
    ).data;
    const originalPid = process.child.pid;
    await stopProductionServer(process);
    expect(process.child.exitCode).toBe(0);
    await expect(fetch(preview.url)).rejects.toThrow();
    ({ baseUrl, process } = await startAtAvailablePort(environment));
    expect(process.child.pid).not.toBe(originalPid);
    const interruptedPreview = (
      await (
        await fetch(
          `${baseUrl}/workstreams/${created.workstreamId}/previews/current`,
        )
      ).json()
    ).data;
    expect(interruptedPreview.active).toBeNull();
    expect(interruptedPreview.display).toBeNull();
    expect(interruptedPreview.previousVerified.state).toBe("stopped");

    const reindex = await fetch(`${baseUrl}/repository-indexes`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": randomUUID(),
      },
      body: JSON.stringify({ rootPath: fixture.repositoryRoot }),
    });
    expect(reindex.status).toBe(202);
    const reindexId = (await reindex.json()).data.id;
    await waitFor(async () => {
      const value = (
        await (await fetch(`${baseUrl}/repository-indexes/${reindexId}`)).json()
      ).data;
      if (value.status === "running") return false;
      expect(value.status).toBe("succeeded");
      repository.revision = value.generation.id;
      return true;
    }, "restarted repository index");
    expect(
      (await (await fetch(`${baseUrl}/world/current`)).json()).data.snapshot
        .repositoryRef,
    ).toBe(repository.repositoryId);
    const reattached = await fetch(`${baseUrl}/agent-sessions/attach`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        adapterId: "hermes",
        adapterSessionRef:
          sessionBefore.adapterRootSessionRef ??
          sessionBefore.adapterSessionRef,
        profile: "fixture",
        workspaceId: "workspace_fixture",
        repositoryRef: repository.repositoryId,
        mode: "collaborate",
        modeConfirmed: true,
      }),
    });
    const reattachedSession = (await reattached.json()).data;
    expect(reattached.status).toBe(201);
    expect(reattachedSession.sessionId).toBe(session.sessionId);
    expect(reattachedSession.adapterSessionRef).toBe(
      sessionBefore.adapterSessionRef,
    );
    const recovered = (
      await (await fetch(`${baseUrl}/workstreams/current`)).json()
    ).data;
    const restartContinue = await fetch(
      `${baseUrl}/workstreams/${created.workstreamId}/continue`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          expectedRevision: recovered.revision,
          repository,
          agent: {
            ...currentWorkstream.agent,
            revision: String(reattachedSession.permissionRevision),
          },
        }),
      },
    );
    const restartResult = (await restartContinue.json()).data;
    expect(restartContinue.status, JSON.stringify(restartResult)).toBe(200);
    expect(restartResult.previewResume).toBe("ready");
    expect(restartResult.workstream).toMatchObject({
      workstreamId: created.workstreamId,
      task: savedBefore.task,
      authority: {
        worktreeId: created.authority.worktreeId,
        relativePath: created.authority.relativePath,
        branch: commitBody.data.status.branch,
        head: commitBody.data.status.head,
      },
    });
    expect(await git(worktreePath, ["status", "--porcelain=v1"])).toBe(
      dirtyBefore,
    );
    expect(
      await readFile(path.join(worktreePath, "untracked.txt"), "utf8"),
    ).toBe("unsaved work stays here\n");
    expect(await readFile(path.join(worktreePath, "index.ts"), "utf8")).toBe(
      "export const ready = 'edited';\n",
    );
    expect(
      (
        await (
          await fetch(`${baseUrl}/agent-sessions/${session.sessionId}/history`)
        ).json()
      ).data.messages,
    ).toEqual(historyBeforeRestart.messages);
    const restartedPreview = (
      await (
        await fetch(
          `${baseUrl}/workstreams/${created.workstreamId}/previews/current`,
        )
      ).json()
    ).data.display;
    expect(restartedPreview.truth).toBe("current");
    expect(restartedPreview.preview.state).toBe("ready");
    expect(await (await fetch(restartedPreview.preview.url)).text()).toContain(
      "exact Workstream preview",
    );
    latestRevision = restartResult.workstream.revision;
    currentWorkstream.agent = restartResult.workstream.agent;
    preview.url = restartedPreview.preview.url;

    // Commit only fixture-owned changes so the existing clean-cancel proof
    // remains distinct from restoration's dirty-file preservation assertions.
    await git(worktreePath, ["add", "index.ts", "untracked.txt"]);
    await git(worktreePath, [
      "commit",
      "-m",
      "fixture: retain restored changes",
    ]);
    const cancelled = await fetch(
      `${baseUrl}/workstreams/${created.workstreamId}/cancel`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: "cancel-production-workstream",
          correlationId: "correlation-cancel-production",
          expectedRevision: latestRevision,
          repository,
          agent: currentWorkstream.agent,
        }),
      },
    );
    expect(cancelled.status, await cancelled.clone().text()).toBe(200);
    await expect(fetch(preview.url)).rejects.toThrow();
    expect(
      (
        await json<{
          data: {
            workstream: { status: string; worktreeState: string };
          };
        }>(cancelled)
      ).data.workstream,
    ).toMatchObject({ status: "cancelled", worktreeState: "removed" });
    const unboundSession = await fetch(
      `${baseUrl}/agent-sessions/${session.sessionId}/status`,
    );
    expect((await json<{ data: unknown }>(unboundSession)).data).toMatchObject({
      mode: "explore",
      worktreeRef: null,
      currentTaskRef: null,
    });
    expect(await exists(worktreePath)).toBe(false);
    expect(await readdir(fixture.worktreeParent)).toEqual([]);
    expect(
      (
        await git(fixture.repositoryRoot, ["worktree", "list", "--porcelain"])
      ).match(/^worktree /gmu),
    ).toHaveLength(1);

    await stopProductionServer(process);
    expect(process.child.exitCode).toBe(0);
    await expect(fetch(`${baseUrl}/health`)).rejects.toThrow();
  });
});
