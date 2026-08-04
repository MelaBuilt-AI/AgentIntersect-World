import { createHash, randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import {
  createServer as createHttpServer,
  type Server as HttpServer,
} from "node:http";
import { createServer, type Server } from "node:net";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
const children: ChildProcessWithoutNullStreams[] = [];
const servers: Array<Server | HttpServer> = [];

const pluginCapability = {
  schema: "aiw.hermes-plugin-capabilities/0.13",
  plugin: "agentintersect-world",
  version: "0.13.0",
  sameSessionArbiter: "fcntl-turn-lock-v1",
  worldActions: {
    enabled: true,
    protocol: "aiw.world-action/0.13",
    proposalHelper: "propose_world_action",
    maximumBatchActions: 8,
    maximumEnvelopeBytes: 16_384,
    defaultTtlMs: 30_000,
    maximumTtlMs: 120_000,
    rateActionsPerSecond: 4,
    rateBurstActions: 8,
    maximumQueuedActions: 32,
  },
};

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

async function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-blank-actions-"));
  roots.push(root);
  const pluginRoot = path.join(root, "plugin", "agentintersect-world");
  const proposalRoot = path.join(pluginRoot, "world-action-proposals");
  const repositoryRoot = path.join(root, "repository");
  fs.mkdirSync(proposalRoot, { recursive: true });
  fs.mkdirSync(repositoryRoot);
  fs.writeFileSync(
    path.join(repositoryRoot, "package.json"),
    JSON.stringify({ name: "production-control", version: "1.0.0" }),
  );
  fs.writeFileSync(
    path.join(repositoryRoot, "index.ts"),
    "export const ok = true;\n",
  );
  const capabilityPath = path.join(pluginRoot, "capabilities.json");
  fs.writeFileSync(capabilityPath, JSON.stringify(pluginCapability), {
    mode: 0o600,
  });

  const turnBodies: Array<Record<string, unknown>> = [];

  const hermes = createHttpServer((request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/v1/capabilities") {
      response.end(
        JSON.stringify({
          features: {
            session_resources: true,
            session_chat_streaming: true,
          },
        }),
      );
      return;
    }
    const messages = request.url?.match(/^\/api\/sessions\/([^/]+)\/messages$/);
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
    const session = request.url?.match(/^\/api\/sessions\/([^/?]+)$/);
    if (session) {
      const id = decodeURIComponent(session[1]!);
      response.end(
        JSON.stringify({ session: { id, source: "fixture", title: id } }),
      );
      return;
    }
    const chat = request.url?.match(/^\/api\/sessions\/([^/]+)\/chat\/stream$/);
    if (chat && request.method === "POST") {
      let body = "";
      request.on("data", (chunk) => (body += String(chunk)));
      request.on("end", () => {
        turnBodies.push(JSON.parse(body) as Record<string, unknown>);
        const nativeSessionId = decodeURIComponent(chat[1]!);
        response.setHeader("content-type", "text/event-stream");
        response.end(
          [
            ["run.started", { session_id: nativeSessionId, seq: 1 }],
            ["message.started", { session_id: nativeSessionId, seq: 2 }],
            [
              "assistant.completed",
              {
                session_id: nativeSessionId,
                seq: 3,
                content: "Movement proposed.",
              },
            ],
            [
              "run.completed",
              { session_id: nativeSessionId, seq: 4, messages: [], usage: {} },
            ],
            ["done", { session_id: nativeSessionId, seq: 5 }],
          ]
            .map(
              ([event, data]) =>
                `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            )
            .join(""),
        );
      });
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not found" }));
  });
  const hermesPort = await listen(hermes);

  const reservation = createServer();
  const serverPort = await listen(reservation);
  await close(reservation);
  const child = spawn(
    process.execPath,
    ["--import", "tsx", path.resolve("apps/local-server/src/index.ts")],
    {
      cwd: path.resolve("."),
      env: {
        ...process.env,
        AIW_NETWORK_SCOPE: "loopback",
        AIW_HOST: "127.0.0.1",
        AIW_PORT: String(serverPort),
        AIW_AGENTINTERSECT_ENABLED: "false",
        AIW_AGENTINTERSECT_COMMANDS_ENABLED: "false",
        AIW_AGENT_SESSIONS_ENABLED: "true",
        AIW_AGENT_SESSION_DATA_DIR: path.join(root, "agent-sessions"),
        AIW_HERMES_API_URL: `http://127.0.0.1:${hermesPort}`,
        AIW_HERMES_API_KEY: "fixture-key",
        AIW_HERMES_PROFILE: "fixture",
        AIW_HERMES_PLUGIN_CAPABILITY_PATH: capabilityPath,
        AIW_PRESENTATION_DATA_DIR: path.join(root, "presentation"),
        AIW_PHASE17_STATE_DIR: path.join(root, "phase17"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  children.push(child);
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk;
  });
  await waitFor(
    () => stdout.includes("local server ready") || child.exitCode !== null,
    "production local server",
  );
  if (child.exitCode !== null)
    throw new Error(`production server exited: ${stderr}`);

  const baseUrl = `http://127.0.0.1:${serverPort}`;
  const attach = async (nativeRef: string, repositoryRef: string) => {
    const response = await fetch(`${baseUrl}/agent-sessions/attach`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        adapterId: "hermes",
        adapterSessionRef: nativeRef,
        profile: "fixture",
        workspaceId: "workspace_fixture",
        repositoryRef,
        mode: "explore",
      }),
    });
    expect(response.status).toBe(201);
    return (await response.json()).data as {
      sessionId: string;
      [key: string]: unknown;
    };
  };
  return { attach, baseUrl, proposalRoot, repositoryRoot, turnBodies };
}

async function indexRepository(baseUrl: string, rootPath: string) {
  const response = await fetch(`${baseUrl}/repository-indexes`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
    },
    body: JSON.stringify({ rootPath }),
  });
  expect(response.status).toBe(202);
  const operationId = (await response.json()).data.id as string;
  await waitFor(async () => {
    const operation = await fetch(
      `${baseUrl}/repository-indexes/${operationId}`,
    );
    const body = await operation.json();
    return body.data.status !== "running";
  }, "repository index");
  const world = await fetch(`${baseUrl}/world/current`);
  expect(world.status).toBe(200);
  return (await world.json()).data.snapshot as { repositoryRef: string };
}

afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
  }
  await Promise.all(servers.splice(0).map(close));
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});

describe("production blank-World movement authority", () => {
  it("constructs an exact-session Hermes turn with bounded move and follow authority", async () => {
    const state = await fixture();
    const session = await state.attach("native-chat-movement", "current");
    const response = await fetch(
      `${state.baseUrl}/agent-sessions/${session.sessionId}/messages`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: "Please follow me",
          binding: session,
          context: { userDisplayName: "Aaron" },
        }),
      },
    );
    expect(response.status).toBe(200);
    expect(state.turnBodies).toHaveLength(1);
    expect(state.turnBodies[0]?.message).toBe("Please follow me");
    expect(state.turnBodies[0]?.system_message).toContain(
      `actorId ${session.sessionId}`,
    );
    expect(state.turnBodies[0]?.system_message).toContain("move-agent");
    expect(state.turnBodies[0]?.system_message).toContain("follow-user");
    expect(state.turnBodies[0]?.system_message).toContain(
      "Ordinary non-movement conversation must remain ordinary chat",
    );
  });

  it("accepts attached-session movement and imports Hermes proposals before a repository is selected", async () => {
    const state = await fixture();
    const nativeRef = "native-blank";
    const session = await state.attach(nativeRef, "current");

    const initial = await fetch(
      `${state.baseUrl}/world-actions/${session.sessionId}`,
    );
    expect(initial.status).toBe(200);
    expect(await initial.json()).toMatchObject({
      capability: { enabled: true },
    });

    const proposalId = randomUUID();
    fs.writeFileSync(
      path.join(state.proposalRoot, `${proposalId}.json`),
      JSON.stringify({
        schema: "aiw.hermes-world-action-proposal/0.13",
        proposalId,
        nativeSessionHash: createHash("sha256").update(nativeRef).digest("hex"),
        sequence: 1,
        createdAt: new Date().toISOString(),
        ttlMs: 30_000,
        actions: [
          {
            kind: "move-agent",
            schema: "aiw.agent-movement/1",
            actorId: session.sessionId,
            source: "agent-autonomous",
            speed: 4,
            target: { kind: "coordinate", x: 2, z: 3 },
          },
        ],
      }),
      { mode: 0o600 },
    );
    const imported = await fetch(
      `${state.baseUrl}/world-actions/${session.sessionId}`,
    );
    expect(imported.status).toBe(200);
    expect((await imported.json()).executions).toEqual(
      expect.arrayContaining([expect.objectContaining({ accepted: true })]),
    );

    for (const direction of ["left", "right", "forward", "backward"] as const) {
      const response = await fetch(
        `${state.baseUrl}/world-actions/${session.sessionId}/proposals`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            actions: [
              {
                kind: "move-agent",
                schema: "aiw.agent-movement/1",
                actorId: session.sessionId,
                source: "user-directed",
                speed: 4,
                target: { kind: "relative", direction, distance: 2 },
              },
            ],
          }),
        },
      );
      expect(response.status).toBe(202);
    }

    const coordinate = await fetch(
      `${state.baseUrl}/world-actions/${session.sessionId}/proposals`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actions: [
            {
              kind: "move-agent",
              schema: "aiw.agent-movement/1",
              actorId: session.sessionId,
              source: "user-directed",
              speed: 4,
              target: { kind: "coordinate", x: -4, z: 5 },
            },
          ],
        }),
      },
    );
    expect(coordinate.status).toBe(202);
  });

  it("preserves repository-selected authority and rejects a repository mismatch", async () => {
    const state = await fixture();
    const snapshot = await indexRepository(state.baseUrl, state.repositoryRoot);
    const matching = await state.attach(
      "native-repository",
      snapshot.repositoryRef,
    );
    const available = await fetch(
      `${state.baseUrl}/world-actions/${matching.sessionId}`,
    );
    expect(available.status).toBe(200);

    const mismatched = await state.attach(
      "native-mismatch",
      "aiw://object/different-repository",
    );
    const unavailable = await fetch(
      `${state.baseUrl}/world-actions/${mismatched.sessionId}`,
    );
    expect(unavailable.status).toBe(404);
  });
});
