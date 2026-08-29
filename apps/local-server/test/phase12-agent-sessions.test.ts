import { createServer } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type {
  AgentCapabilityManifest,
  AgentSession,
} from "@agentintersect-world/agent-session-protocol";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AdapterRegistry,
  AgentSessionGateway,
  AgentSessionStore,
  GatewayError,
  HermesSessionAdapter,
  discoverDesignPreviews,
  type AgentAdapter,
  type AdapterTurnEvent,
} from "../src/agent-sessions.js";
import type { RepositoryWorkFocusCoordinator } from "../src/repository-work-focus.js";

const roots: string[] = [];
const servers: ReturnType<typeof createServer>[] = [];
const newRoot = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-phase12-"));
  roots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  );
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});

function focusAdapter(events: readonly AdapterTurnEvent[]): AgentAdapter {
  return {
    id: "fixture",
    attest: async () => ({
      schema: "aiw.agent-capabilities/0.12",
      adapterId: "fixture",
      adapterVersion: "1",
      transport: "loopback-http-sse",
      origin: "local",
      auth: "server-bearer",
      supportedModes: ["explore", "collaborate"],
      ordering: "per-session-strict",
      resume: "session-api",
      shutdownOwner: "external",
      maxInputBytes: 16_384,
      maxEventBytes: 32_768,
      capabilities: {
        attach: true,
        sendText: true,
        streamDeltas: true,
        toolStatus: false,
        approvals: false,
        interrupt: false,
        avatarProposal: false,
        skillsDisclosure: false,
      },
      unavailable: {
        toolStatus: "fixture",
        approvals: "fixture",
        interrupt: "fixture",
        avatarProposal: "fixture",
        skillsDisclosure: "fixture",
      },
    }),
    listSessions: async () => [],
    attach: async (id) => ({
      id,
      rootId: id,
      source: "fixture",
      title: "Fixture",
    }),
    sendText: async (_session, _text, context) => {
      for (const event of events) await context?.onEvent?.(event);
      return { finalText: "done", deltas: [] };
    },
  };
}

it("cancels a superseded movement before an unresolvable replacement", async () => {
  const adapter = focusAdapter([
    {
      type: "tool.started",
      toolName: "edit_file",
      activityId: "activity-a",
      repositoryLocator: { operation: "edit", paths: ["src/a.ts"] },
      redaction: { applied: false, count: 0 },
    },
    {
      type: "tool.started",
      toolName: "edit_file",
      activityId: "activity-b",
      repositoryLocator: { operation: "edit", paths: ["missing.ts"] },
      redaction: { applied: false, count: 0 },
    },
  ]);
  const gateway = new AgentSessionGateway({
    registry: new AdapterRegistry([adapter]),
    store: new AgentSessionStore(newRoot()),
  });
  const stopped: string[] = [];
  gateway.setRepositoryWorkFocusCoordinator({
    start: async ({ session, rosterId, activityId }) =>
      activityId === "activity-a"
        ? {
            schema: "aiw.agent-work-focus/0.19",
            activityId,
            rosterId,
            worldSessionId: session.sessionId,
            repositoryRef: session.repositoryRef,
            objectRef: "aiw://object/file-a",
            objectKind: "file",
            repositoryPath: "src/a.ts",
            layoutGeneration: `layout-${"a".repeat(64)}`,
            movementRequestId: "movement-a",
            source: "structured-tool-event",
            state: "navigating",
          }
        : null,
    stop: async (focus, state) => {
      stopped.push(`${focus.activityId}:${focus.movementRequestId}`);
      return { ...focus, state };
    },
  } as RepositoryWorkFocusCoordinator);
  const session = await gateway.attach({
    adapterId: "fixture",
    adapterSessionRef: "native-root",
    profile: "default",
    workspaceId: "ws_fixture",
    repositoryRef: "repo_fixture",
    mode: "explore",
  });

  await gateway.sendText(session.sessionId, {
    text: "bounded turn",
    binding: session,
  });

  expect(stopped).toEqual(["activity-a:movement-a"]);
  expect(gateway.currentWorkFocus(session.sessionId)).toMatchObject({
    activityId: "activity-a",
    state: "stale",
  });
});

it("keeps a completed structured read moving long enough for visible arrival", async () => {
  const adapter = focusAdapter([
    {
      type: "tool.started",
      toolName: "Read",
      activityId: "activity-read",
      repositoryLocator: { operation: "read", paths: ["src/a.ts"] },
      redaction: { applied: true, count: 1 },
    },
    {
      type: "tool.completed",
      toolName: "Read",
      activityId: "activity-read",
      repositoryLocator: { operation: "read", paths: ["src/a.ts"] },
      redaction: { applied: true, count: 1 },
    },
  ]);
  const gateway = new AgentSessionGateway({
    registry: new AdapterRegistry([adapter]),
    store: new AgentSessionStore(newRoot()),
  });
  const stopped: string[] = [];
  gateway.setRepositoryWorkFocusCoordinator({
    start: async ({ session, rosterId, activityId }) => ({
      schema: "aiw.agent-work-focus/0.19",
      activityId,
      rosterId,
      worldSessionId: session.sessionId,
      repositoryRef: session.repositoryRef,
      objectRef: "aiw://object/file-a",
      objectKind: "file",
      repositoryPath: "src/a.ts",
      layoutGeneration: `layout-${"a".repeat(64)}`,
      movementRequestId: "movement-read",
      source: "structured-tool-event",
      state: "navigating",
    }),
    stop: async (focus, state) => {
      stopped.push(state);
      return { ...focus, state };
    },
  } as RepositoryWorkFocusCoordinator);
  const session = await gateway.attach({
    adapterId: "fixture",
    adapterSessionRef: "native-read",
    profile: "default",
    workspaceId: "ws_fixture",
    repositoryRef: "repo_fixture",
    mode: "explore",
  });

  await gateway.sendText(session.sessionId, {
    text: "read the file",
    binding: session,
  });

  expect(stopped).toEqual([]);
  expect(gateway.currentWorkFocus(session.sessionId)).toMatchObject({
    activityId: "activity-read",
    movementRequestId: "movement-read",
    state: "navigating",
  });
});

it("owns concurrent workstream recovery as one cached movement", async () => {
  const adapter = focusAdapter([]);
  const gateway = new AgentSessionGateway({
    registry: new AdapterRegistry([adapter]),
    store: new AgentSessionStore(newRoot()),
  });
  let recoveries = 0;
  gateway.setRepositoryWorkFocusCoordinator({
    start: async () => null,
    stop: async (focus, state) => ({ ...focus, state }),
    recover: async ({ session, rosterId }) => {
      recoveries += 1;
      await Promise.resolve();
      return {
        schema: "aiw.agent-work-focus/0.19",
        activityId: "workstream-recovery",
        rosterId,
        worldSessionId: session.sessionId,
        repositoryRef: session.repositoryRef,
        objectRef: "aiw://object/file-a",
        objectKind: "file",
        repositoryPath: "src/a.ts",
        layoutGeneration: `layout-${"a".repeat(64)}`,
        movementRequestId: "movement-recovery",
        source: "workstream-binding",
        state: "navigating",
      };
    },
  } as RepositoryWorkFocusCoordinator);
  const attached = await gateway.attach({
    adapterId: "fixture",
    adapterSessionRef: "native-root",
    profile: "default",
    workspaceId: "ws_fixture",
    repositoryRef: "repo_fixture",
    mode: "explore",
  });
  const session = gateway.bindWorkstream(attached.sessionId, {
    worktreeRef: "worktree-a",
    taskRef: "task-a",
  });
  let resolverCalls = 0;
  gateway.setRepositoryWorkFocusRecoveryResolver(async () => {
    resolverCalls += 1;
    return {
      workstreamId: "task-a",
      revision: 1,
      repository: { repositoryId: "repo_fixture", revision: "generation-a" },
      agent: {
        agentId: session.sessionId,
        nativeSessionId: "native-root",
      },
      authority: { repositoryId: "repo_fixture", worktreeId: "worktree-a" },
      worktreeState: "dirty",
      projection: { changedFiles: [{ path: "src/a.ts" }] },
      status: "working",
    };
  });

  const recovered = await Promise.all([
    gateway.recoverWorkFocus(session.sessionId),
    gateway.recoverWorkFocus(session.sessionId),
    gateway.recoverWorkFocus(session.sessionId),
  ]);
  expect(recovered).toEqual([recovered[0], recovered[0], recovered[0]]);
  expect(recoveries).toBe(1);
  expect(resolverCalls).toBe(1);
  expect(await gateway.recoverWorkFocus(session.sessionId)).toBe(recovered[0]);
  expect(recoveries).toBe(1);
});

it("keeps the same Workstream context on later turns after explicit collaborate binding", async () => {
  const contexts: Array<string | undefined> = [];
  const adapter: AgentAdapter = {
    id: "fixture",
    attest: async () => ({
      schema: "aiw.agent-capabilities/0.12",
      adapterId: "fixture",
      adapterVersion: "1",
      transport: "loopback-http-sse",
      origin: "local",
      auth: "server-bearer",
      supportedModes: ["explore", "collaborate"],
      ordering: "per-session-strict",
      resume: "session-api",
      shutdownOwner: "external",
      maxInputBytes: 16384,
      maxEventBytes: 32768,
      capabilities: {
        attach: true,
        sendText: true,
        streamDeltas: true,
        toolStatus: false,
        approvals: false,
        interrupt: false,
        avatarProposal: false,
        skillsDisclosure: false,
      },
      unavailable: {
        toolStatus: "fixture",
        approvals: "fixture",
        interrupt: "fixture",
        avatarProposal: "fixture",
        skillsDisclosure: "fixture",
      },
    }),
    listSessions: async () => [],
    attach: async (id) => ({
      id,
      rootId: id,
      source: "fixture",
      title: "Fixture",
    }),
    sendText: async (_session, _text, context) => {
      contexts.push(context?.systemMessage);
      return { finalText: "done", deltas: [] };
    },
  };
  const gateway = new AgentSessionGateway({
    registry: new AdapterRegistry([adapter]),
    store: new AgentSessionStore(newRoot()),
  });
  const attached = await gateway.attach({
    adapterId: "fixture",
    adapterSessionRef: "native-root",
    profile: "default",
    workspaceId: "ws_fixture",
    repositoryRef: "repo_fixture",
    mode: "explore",
  });
  const bound = gateway.bindWorkstream(attached.sessionId, {
    worktreeRef: "worktree-collision",
    taskRef: "workstream-collision",
  });
  gateway.setWorkstreamContextResolver((session) =>
    session.currentTaskRef === "workstream-collision"
      ? "Workstream collision context in /tmp/owned-worktree"
      : null,
  );

  await gateway.sendText(bound.sessionId, {
    text: "Initial implementation task",
    binding: bound,
  });
  const afterInitial = gateway.status(bound.sessionId);
  await gateway.sendText(afterInitial.sessionId, {
    text: "Please make the bounded adjustment",
    binding: afterInitial,
  });

  expect(contexts).toEqual([
    "Workstream collision context in /tmp/owned-worktree",
    "Workstream collision context in /tmp/owned-worktree",
  ]);
});

type FakeHermesOptions = {
  readonly noDeltas?: boolean;
  readonly malformed?: boolean;
  readonly mismatchedTerminal?: boolean;
  readonly compressionContinuation?: boolean;
  readonly compressionDuringTurn?: boolean;
  readonly oversized?: boolean;
  readonly runTranscriptBytes?: number;
  readonly toolFailed?: boolean;
};

function sseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function fakeHermes(options: FakeHermesOptions = {}) {
  const root = newRoot();
  const pluginCapabilityPath = path.join(root, "capabilities.json");
  fs.writeFileSync(
    pluginCapabilityPath,
    `${JSON.stringify({
      schema: "aiw.hermes-plugin-capabilities/0.12",
      plugin: "agentintersect-world",
      version: "0.12.0",
      sameSessionArbiter: "fcntl-turn-lock-v1",
    })}\n`,
    { mode: 0o600 },
  );
  const calls: Array<{ method: string; url: string; body: string }> = [];
  let safeResumeCalls = 0;
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += String(chunk)));
    request.on("end", () => {
      calls.push({
        method: request.method ?? "",
        url: request.url ?? "",
        body,
      });
      if (request.headers.authorization !== "Bearer fixture-key") {
        response.writeHead(401).end();
        return;
      }
      response.setHeader("content-type", "application/json");
      if (request.url === "/v1/capabilities") {
        response.end(
          JSON.stringify({
            object: "hermes.api_server.capabilities",
            platform: "hermes-agent",
            model: "hermes-agent",
            features: {
              session_resources: true,
              session_chat: true,
              session_chat_streaming: true,
              run_stop: true,
              run_approval: false,
            },
          }),
        );
        return;
      }
      if (request.url === "/api/sessions?limit=100&offset=0") {
        response.end(
          JSON.stringify({
            object: "list",
            data: [
              {
                id: "20260721_011618_330489c8",
                source: "discord",
                title: "Existing Discord lane",
                message_count: 8,
                updated_at: 1_753_075_600,
              },
            ],
          }),
        );
        return;
      }
      if (request.url === "/api/sessions/20260721_011618_330489c8") {
        response.end(
          JSON.stringify({
            object: "hermes.session",
            session: {
              id: "20260721_011618_330489c8",
              source: "discord",
              title: "Existing Discord lane",
              message_count: 8,
            },
          }),
        );
        return;
      }
      if (request.url === "/api/sessions/20260721_011618_330489c8/messages") {
        safeResumeCalls += 1;
        response.end(
          JSON.stringify({
            object: "list",
            session_id:
              options.compressionContinuation ||
              (options.compressionDuringTurn && safeResumeCalls >= 3)
                ? "20260721_011700_compressed"
                : "20260721_011618_330489c8",
            data: [],
          }),
        );
        return;
      }
      if (
        (request.url === "/api/sessions/20260721_011618_330489c8/chat/stream" ||
          request.url ===
            "/api/sessions/20260721_011700_compressed/chat/stream") &&
        request.method === "POST"
      ) {
        response.setHeader("content-type", "text/event-stream");
        const sessionId = options.compressionContinuation
          ? "20260721_011700_compressed"
          : "20260721_011618_330489c8";
        const terminalSessionId = options.mismatchedTerminal
          ? "different-session"
          : options.compressionDuringTurn
            ? "20260721_011700_compressed"
            : sessionId;
        const events = [
          sseEvent("run.started", {
            session_id: sessionId,
            run_id: "run_fixture",
            seq: 1,
          }),
          sseEvent("message.started", {
            session_id: sessionId,
            run_id: "run_fixture",
            seq: 2,
            message: { id: "msg_fixture", role: "assistant" },
          }),
          ...(options.noDeltas
            ? []
            : [
                sseEvent("assistant.delta", {
                  session_id: sessionId,
                  run_id: "run_fixture",
                  message_id: "msg_fixture",
                  seq: 3,
                  delta: options.oversized ? "x".repeat(70_000) : "fixture ",
                }),
                sseEvent("tool.started", {
                  session_id: sessionId,
                  run_id: "run_fixture",
                  message_id: "msg_fixture",
                  seq: 4,
                  tool_name: "terminal",
                  preview: "RAW_PREVIEW_CANARY",
                  args: { secret: "RAW_ARGS_CANARY" },
                }),
                sseEvent(
                  options.toolFailed ? "tool.failed" : "tool.completed",
                  {
                    session_id: sessionId,
                    run_id: "run_fixture",
                    message_id: "msg_fixture",
                    seq: 5,
                    tool_name: "terminal",
                    preview: "RAW_OUTPUT_CANARY",
                    args: { secret: "RAW_ARGS_CANARY" },
                  },
                ),
                sseEvent("assistant.delta", {
                  session_id: sessionId,
                  run_id: "run_fixture",
                  message_id: "msg_fixture",
                  seq: 6,
                  delta: "answer",
                }),
              ]),
          ...(options.malformed
            ? ["event: assistant.completed\ndata: {bad json}\n\n"]
            : []),
          sseEvent("assistant.completed", {
            session_id: terminalSessionId,
            run_id: "run_fixture",
            message_id: "msg_fixture",
            seq: options.noDeltas ? 3 : options.malformed ? 8 : 7,
            content: "fixture answer",
            completed: true,
            partial: false,
            interrupted: false,
          }),
          sseEvent("run.completed", {
            session_id: terminalSessionId,
            run_id: "run_fixture",
            message_id: "msg_fixture",
            seq: options.noDeltas ? 4 : options.malformed ? 9 : 8,
            completed: true,
            messages: options.runTranscriptBytes
              ? [
                  {
                    role: "tool",
                    content: `RAW_RUN_TRANSCRIPT_CANARY_${"x".repeat(
                      options.runTranscriptBytes,
                    )}`,
                  },
                  { role: "assistant", content: "fixture answer" },
                ]
              : [{ role: "assistant", content: "fixture answer" }],
            usage: { input_tokens: 3, output_tokens: 2 },
          }),
          sseEvent("done", {
            session_id: terminalSessionId,
            run_id: "run_fixture",
            seq: options.noDeltas ? 5 : options.malformed ? 10 : 9,
          }),
        ].join("");
        const fragments: string[] = [];
        const sizes = options.runTranscriptBytes
          ? [17, 65_536, 32_768]
          : [1, 2, 5, 3, 11, 7];
        for (let offset = 0, index = 0; offset < events.length; index += 1) {
          const next = offset + (sizes[index % sizes.length] ?? 1);
          fragments.push(events.slice(offset, next));
          offset = next;
        }
        const writeNext = () => {
          const fragment = fragments.shift();
          if (fragment === undefined) {
            response.end();
            return;
          }
          response.write(fragment);
          setImmediate(writeNext);
        };
        writeNext();
        return;
      }
      response.writeHead(404).end();
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("fixture address");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    calls,
    pluginCapabilityPath,
  };
}

function capabilityManifest(
  adapterId: string,
  capabilities: Partial<AgentCapabilityManifest["capabilities"]> = {},
): AgentCapabilityManifest {
  const values = {
    attach: true,
    sendText: true,
    streamDeltas: false,
    toolStatus: false,
    approvals: false,
    interrupt: false,
    avatarProposal: false,
    skillsDisclosure: false,
    worldActions: false,
    ...capabilities,
  };
  return {
    schema: "aiw.agent-capabilities/0.12",
    adapterId,
    adapterVersion: "1",
    transport: "loopback-http-sse",
    origin: "local",
    auth: "server-bearer",
    supportedModes: ["explore"],
    ordering: "per-session-strict",
    resume: "session-api",
    shutdownOwner: "external",
    maxInputBytes: 16_384,
    maxEventBytes: 32_768,
    capabilities: values,
    unavailable: {
      ...(!values.attach ? { attach: "fixture" } : {}),
      ...(!values.sendText ? { sendText: "fixture" } : {}),
      streamDeltas: "fixture",
      toolStatus: "fixture",
      approvals: "fixture",
      interrupt: "fixture",
      avatarProposal: "fixture",
      skillsDisclosure: "fixture",
    },
    worldActions: {
      enabled: false,
      protocol: "aiw.world-action/0.13",
      proposalHelper: "propose_world_action",
      maximumBatchActions: 8,
      maximumEnvelopeBytes: 16_384,
      defaultTtlMs: 30_000,
      maximumTtlMs: 120_000,
      rateActionsPerSecond: 4,
      rateBurstActions: 8,
      maximumQueuedActions: 32,
      unavailableReason: "fixture",
    },
  };
}

describe("Phase 12 Hermes adapter and session gateway", () => {
  it("reports runtime readiness only from matching complete attestations", async () => {
    const adapter = (id: string, manifest: unknown): AgentAdapter => ({
      id,
      attest: async () => manifest as AgentCapabilityManifest,
      listSessions: async () => [],
      attach: async () => ({
        id: "native",
        source: "fixture",
        title: "Fixture",
      }),
      sendText: async () => ({ finalText: "done", deltas: [] }),
    });
    const registry = new AdapterRegistry([
      adapter("ready", capabilityManifest("ready")),
      adapter(
        "attach-only",
        capabilityManifest("attach-only", { sendText: false }),
      ),
      adapter("send-only", capabilityManifest("send-only", { attach: false })),
      adapter("mismatch", capabilityManifest("different")),
      adapter("malformed", { schema: "wrong", secret: "MALFORMED_CANARY" }),
      {
        ...adapter("thrown", capabilityManifest("thrown")),
        attest: async () => {
          throw new Error("THROWN_SECRET_CANARY");
        },
      },
    ]);

    const readiness = await registry.readiness();
    expect(readiness).toEqual([
      { adapterId: "ready", enabled: true, reason: "runtime-attested" },
      {
        adapterId: "attach-only",
        enabled: false,
        reason: "attestation-unavailable",
      },
      {
        adapterId: "send-only",
        enabled: false,
        reason: "attestation-unavailable",
      },
      {
        adapterId: "mismatch",
        enabled: false,
        reason: "attestation-unavailable",
      },
      {
        adapterId: "malformed",
        enabled: false,
        reason: "attestation-unavailable",
      },
      {
        adapterId: "thrown",
        enabled: false,
        reason: "attestation-unavailable",
      },
    ]);
    expect(JSON.stringify(readiness)).not.toMatch(
      /CANARY|secret|wrong|different/i,
    );
  });

  it("attaches the exact session from a direct detail payload plus safe-resume evidence", async () => {
    const sessionRef = "20260721_011618_330489c8";
    const fetch = vi.fn(async (input: string | URL | Request) =>
      Response.json(
        String(input).endsWith("/messages")
          ? { object: "list", session_id: sessionRef, data: [] }
          : {
              id: sessionRef,
              source: "discord",
              title: "Existing Discord lane",
              message_count: 8,
              updated_at: 1_753_075_600,
            },
      ),
    ) as unknown as typeof globalThis.fetch;
    const adapter = new HermesSessionAdapter({
      baseUrl: "http://127.0.0.1:8000",
      apiKey: "fixture-key",
      profile: "default",
      fetch,
    });

    await expect(adapter.attach(sessionRef)).resolves.toEqual({
      id: sessionRef,
      rootId: sessionRef,
      source: "discord",
      title: "Existing Discord lane",
      messageCount: 8,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      `http://127.0.0.1:8000/api/sessions/${sessionRef}`,
    );
  });

  it("exposes only the pinned native session under a separate configured agent identity", async () => {
    const fixture = await fakeHermes();
    const adapter = new HermesSessionAdapter({
      baseUrl: fixture.baseUrl,
      apiKey: "fixture-key",
      profile: "default",
      pluginCapabilityPath: fixture.pluginCapabilityPath,
      pinnedSessionRef: "20260721_011618_330489c8",
      agentDisplayName: "Mr Fluff",
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/sessions?limit=100"))
          return new Response(
            JSON.stringify({ data: [], limit: 100, offset: 0, total: 0 }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        return fetch(input, init);
      },
    } as never);

    await expect(adapter.listSessions()).resolves.toEqual([
      expect.objectContaining({
        id: "20260721_011618_330489c8",
        title: "Existing Discord lane",
        displayName: "Mr Fluff",
      }),
    ]);
    await expect(
      adapter.attach("another-native-session"),
    ).rejects.toMatchObject({
      code: "not_found",
    });
    expect(
      fixture.calls.some((call) =>
        call.url.includes("/api/sessions/another-native-session"),
      ),
    ).toBe(false);
  });

  it("rejects an obsolete persisted root before native Hermes dispatch when the configured pin changes", async () => {
    const oldRootSessionRef = "20260721_011618_330489c8";
    const pluginCapabilityPath = path.join(newRoot(), "capabilities.json");
    fs.writeFileSync(
      pluginCapabilityPath,
      `${JSON.stringify({
        schema: "aiw.hermes-plugin-capabilities/0.12",
        plugin: "agentintersect-world",
        version: "0.12.0",
        sameSessionArbiter: "fcntl-turn-lock-v1",
      })}\n`,
      { mode: 0o600 },
    );
    const fetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith(`/${oldRootSessionRef}/messages`))
          return Response.json({
            object: "list",
            session_id: oldRootSessionRef,
            data: [],
          });
        if (
          url.endsWith(`/${oldRootSessionRef}/chat/stream`) &&
          init?.method === "POST"
        ) {
          const events = [
            sseEvent("run.started", {
              session_id: oldRootSessionRef,
              seq: 1,
            }),
            sseEvent("message.started", {
              session_id: oldRootSessionRef,
              seq: 2,
            }),
            sseEvent("assistant.completed", {
              session_id: oldRootSessionRef,
              seq: 3,
              content: "obsolete root accepted",
            }),
            sseEvent("run.completed", {
              session_id: oldRootSessionRef,
              seq: 4,
              messages: [],
              usage: {},
            }),
            sseEvent("done", {
              session_id: oldRootSessionRef,
              seq: 5,
            }),
          ].join("");
          return new Response(events, {
            headers: { "content-type": "text/event-stream" },
          });
        }
        return new Response(null, { status: 404 });
      },
    ) as unknown as typeof globalThis.fetch;
    const adapter = new HermesSessionAdapter({
      baseUrl: "http://127.0.0.1:8000",
      apiKey: "fixture-key",
      profile: "default",
      pluginCapabilityPath,
      pinnedSessionRef: "20260728_120000_newroot",
      agentDisplayName: "Mr Fluff",
      fetch,
    });

    await expect(
      adapter.sendText(oldRootSessionRef, "stale persisted turn", {
        mode: "explore",
        rootSessionRef: oldRootSessionRef,
      }),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "Hermes session is not allowlisted",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("binds an exact root only to the effective session proven by the Hermes messages resolver", async () => {
    const fixture = await fakeHermes({ compressionContinuation: true });
    const adapter = new HermesSessionAdapter({
      baseUrl: fixture.baseUrl,
      apiKey: "fixture-key",
      profile: "default",
      pluginCapabilityPath: fixture.pluginCapabilityPath,
    });

    await expect(
      adapter.attach("20260721_011618_330489c8"),
    ).resolves.toMatchObject({
      id: "20260721_011700_compressed",
      rootId: "20260721_011618_330489c8",
    });
    await expect(
      adapter.sendText("20260721_011700_compressed", "continued turn", {
        mode: "explore",
        rootSessionRef: "20260721_011618_330489c8",
        userDisplayName: "Aaron",
      }),
    ).resolves.toMatchObject({
      finalText: "fixture answer",
      sessionRef: "20260721_011700_compressed",
    });
    expect(
      fixture.calls.filter((call) =>
        call.url.endsWith("/20260721_011618_330489c8/messages"),
      ),
    ).toHaveLength(3);
    const streamCall = fixture.calls.find((call) =>
      call.url.endsWith("/20260721_011700_compressed/chat/stream"),
    );
    expect(streamCall).toBeDefined();
    const streamBody = JSON.parse(streamCall?.body ?? "{}") as {
      readonly message?: string;
      readonly system_message?: string;
    };
    expect(streamBody.message).toBe("continued turn");
    expect(streamBody.system_message).toContain("read-only");
    expect(streamBody.system_message).toContain('display name is "Aaron"');
    expect(streamBody.system_message).toContain("use that exact display name");
  });

  it("accepts a during-turn compression rotation only when the post-turn root resolver proves it", async () => {
    const fixture = await fakeHermes({ compressionDuringTurn: true });
    const adapter = new HermesSessionAdapter({
      baseUrl: fixture.baseUrl,
      apiKey: "fixture-key",
      profile: "default",
      pluginCapabilityPath: fixture.pluginCapabilityPath,
    });
    const attached = await adapter.attach("20260721_011618_330489c8");
    expect(attached.id).toBe("20260721_011618_330489c8");
    await expect(
      adapter.sendText(attached.id, "compress during this turn", {
        mode: "explore",
        rootSessionRef: attached.rootId,
      } as never),
    ).resolves.toMatchObject({
      finalText: "fixture answer",
      sessionRef: "20260721_011700_compressed",
    });
  });

  it("fails closed when a direct Hermes detail payload has another identity", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        id: "another-discord-session",
        source: "discord",
        title: "Wrong Discord lane",
        message_count: 3,
      }),
    ) as unknown as typeof globalThis.fetch;
    const adapter = new HermesSessionAdapter({
      baseUrl: "http://127.0.0.1:8000",
      apiKey: "fixture-key",
      profile: "default",
      fetch,
    });

    await expect(
      adapter.attach("20260721_011618_330489c8"),
    ).rejects.toMatchObject({
      code: "upstream",
      message: "Hermes returned a different session identity",
    });
  });

  it("attests capabilities, selects only the existing session, and sends two persistent turns", async () => {
    const fixture = await fakeHermes();
    const adapter = new HermesSessionAdapter({
      baseUrl: fixture.baseUrl,
      apiKey: "fixture-key",
      profile: "default",
      pluginCapabilityPath: fixture.pluginCapabilityPath,
    });
    const manifest = await adapter.attest();
    expect(manifest.capabilities.attach).toBe(true);
    expect(manifest.capabilities.sendText).toBe(true);
    expect(manifest.capabilities.streamDeltas).toBe(true);
    expect(manifest.capabilities.toolStatus).toBe(true);
    expect(manifest.capabilities.approvals).toBe(false);
    expect(manifest.unavailable.approvals).toMatch(/session transport/i);
    const sessions = await adapter.listSessions();
    expect(sessions).toEqual([
      expect.objectContaining({
        id: "20260721_011618_330489c8",
        source: "discord",
      }),
    ]);
    await expect(adapter.attach("missing")).rejects.toThrow(/missing/i);
    await adapter.attach("20260721_011618_330489c8");
    expect(
      (await adapter.sendText("20260721_011618_330489c8", "turn one"))
        .finalText,
    ).toBe("fixture answer");
    expect(
      (await adapter.sendText("20260721_011618_330489c8", "turn two"))
        .finalText,
    ).toBe("fixture answer");
    expect(
      fixture.calls.filter((call) => call.url.endsWith("/chat/stream")),
    ).toHaveLength(2);
    expect(
      fixture.calls.some(
        (call) => call.method === "POST" && call.url === "/api/sessions",
      ),
    ).toBe(false);
  });

  it("parses fragmented Hermes events incrementally and exposes only bounded ordered deltas/tool names", async () => {
    const fixture = await fakeHermes();
    const adapter = new HermesSessionAdapter({
      baseUrl: fixture.baseUrl,
      apiKey: "fixture-key",
      profile: "default",
      pluginCapabilityPath: fixture.pluginCapabilityPath,
    });
    const observed: unknown[] = [];
    const result = await adapter.sendText(
      "20260721_011618_330489c8",
      "fragmented turn",
      {
        mode: "explore",
        onEvent: (event: unknown) => observed.push(event),
      } as never,
    );
    expect(result).toMatchObject({
      finalText: "fixture answer",
      deltas: ["fixture ", "answer"],
    });
    expect(observed).toEqual([
      expect.objectContaining({ type: "assistant.delta", text: "fixture " }),
      expect.objectContaining({
        type: "tool.started",
        toolName: "terminal",
        redaction: { applied: true, count: 2 },
      }),
      expect.objectContaining({
        type: "tool.completed",
        toolName: "terminal",
        redaction: { applied: true, count: 2 },
      }),
      expect.objectContaining({ type: "assistant.delta", text: "answer" }),
    ]);
    expect(JSON.stringify(observed)).not.toMatch(
      /RAW_(?:PREVIEW|ARGS|OUTPUT)_CANARY|preview|args/i,
    );
  });

  it("accepts a bounded oversized run transcript without exposing its content", async () => {
    const fixture = await fakeHermes({ runTranscriptBytes: 520_000 });
    const adapter = new HermesSessionAdapter({
      baseUrl: fixture.baseUrl,
      apiKey: ["fixture", "key"].join("-"),
      profile: "default",
      pluginCapabilityPath: fixture.pluginCapabilityPath,
    });
    const observed: unknown[] = [];

    await expect(
      adapter.sendText("20260721_011618_330489c8", "compressed turn", {
        mode: "explore",
        onEvent: (event: unknown) => observed.push(event),
      } as never),
    ).resolves.toMatchObject({ finalText: "fixture answer" });
    expect(JSON.stringify(observed)).not.toContain("RAW_RUN_TRANSCRIPT_CANARY");
  });

  it("rejects a run transcript beyond the total stream bound", async () => {
    const fixture = await fakeHermes({ runTranscriptBytes: 1_100_000 });
    const adapter = new HermesSessionAdapter({
      baseUrl: fixture.baseUrl,
      apiKey: ["fixture", "key"].join("-"),
      profile: "default",
      pluginCapabilityPath: fixture.pluginCapabilityPath,
    });

    await expect(
      adapter.sendText("20260721_011618_330489c8", "excessive transcript"),
    ).rejects.toThrow(/bounded response limit/i);
  });

  it("accepts a real no-delta completion whose only final text is assistant.completed.content", async () => {
    const fixture = await fakeHermes({ noDeltas: true });
    const adapter = new HermesSessionAdapter({
      baseUrl: fixture.baseUrl,
      apiKey: "fixture-key",
      profile: "default",
      pluginCapabilityPath: fixture.pluginCapabilityPath,
    });
    await expect(
      adapter.sendText("20260721_011618_330489c8", "no delta"),
    ).resolves.toMatchObject({ finalText: "fixture answer", deltas: [] });
  });

  it("clears the connect timeout after headers without aborting a long active stream", async () => {
    vi.useFakeTimers();
    const legacyTimeout = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(legacyTimeout.signal);
    try {
      const root = newRoot();
      const pluginCapabilityPath = path.join(root, "capabilities.json");
      fs.writeFileSync(
        pluginCapabilityPath,
        `${JSON.stringify({
          schema: "aiw.hermes-plugin-capabilities/0.12",
          plugin: "agentintersect-world",
          version: "0.12.0",
          sameSessionArbiter: "fcntl-turn-lock-v1",
        })}\n`,
        { mode: 0o600 },
      );
      let streamController!: ReadableStreamDefaultController<Uint8Array>;
      let requestSignal: AbortSignal | undefined;
      const fetchMock = async (
        input: string | URL | Request,
        init?: RequestInit,
      ): Promise<Response> => {
        if (String(input).endsWith("/messages"))
          return Response.json({
            object: "list",
            session_id: "20260721_011618_330489c8",
            data: [],
          });
        requestSignal =
          init?.signal instanceof AbortSignal ? init.signal : undefined;
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              streamController = controller;
            },
          }),
          {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          },
        );
      };
      const adapter = new HermesSessionAdapter({
        baseUrl: "http://127.0.0.1:8642",
        apiKey: "fixture-key",
        profile: "default",
        pluginCapabilityPath,
        fetch: fetchMock,
      });
      const turn = adapter.sendText(
        "20260721_011618_330489c8",
        "long active stream",
      );
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(30_001);
      legacyTimeout.abort();
      expect(requestSignal?.aborted).toBe(false);
      const sessionId = "20260721_011618_330489c8";
      streamController.enqueue(
        new TextEncoder().encode(
          [
            sseEvent("run.started", { session_id: sessionId, seq: 1 }),
            sseEvent("message.started", { session_id: sessionId, seq: 2 }),
            sseEvent("assistant.completed", {
              session_id: sessionId,
              seq: 3,
              content: "delayed fixture answer",
            }),
            sseEvent("run.completed", {
              session_id: sessionId,
              seq: 4,
              messages: [
                { role: "assistant", content: "delayed fixture answer" },
              ],
              usage: { input_tokens: 3, output_tokens: 3 },
            }),
            sseEvent("done", { session_id: sessionId, seq: 5 }),
          ].join(""),
        ),
      );
      streamController.close();
      await expect(turn).resolves.toMatchObject({
        finalText: "delayed fixture answer",
      });
    } finally {
      timeoutSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("normalizes Hermes tool.failed as bounded tool-name-only status", async () => {
    const fixture = await fakeHermes({ toolFailed: true });
    const adapter = new HermesSessionAdapter({
      baseUrl: fixture.baseUrl,
      apiKey: "fixture-key",
      profile: "default",
      pluginCapabilityPath: fixture.pluginCapabilityPath,
    });
    const observed: unknown[] = [];
    await adapter.sendText("20260721_011618_330489c8", "failed tool", {
      mode: "explore",
      onEvent: (event) => observed.push(event),
    });
    expect(observed).toContainEqual(
      expect.objectContaining({
        type: "tool.failed",
        toolName: "terminal",
        redaction: { applied: true, count: 2 },
      }),
    );
  });

  it.each([
    ["malformed", { malformed: true }],
    ["mismatched-session", { mismatchedTerminal: true }],
    ["oversized", { oversized: true }],
  ] as const)(
    "rejects %s Hermes terminal streams truthfully",
    async (_name, options) => {
      const fixture = await fakeHermes(options);
      const adapter = new HermesSessionAdapter({
        baseUrl: fixture.baseUrl,
        apiKey: "fixture-key",
        profile: "default",
        pluginCapabilityPath: fixture.pluginCapabilityPath,
      });
      await expect(
        adapter.sendText("20260721_011618_330489c8", "invalid stream"),
      ).rejects.toMatchObject({ code: "upstream" });
    },
  );

  it("persists bounded metadata with current/previous recovery and excludes canaries", () => {
    const root = newRoot();
    const store = new AgentSessionStore(root);
    const value = {
      schema: "aiw.agent-session/0.12",
      sessionId: "11111111-1111-4111-8111-111111111111",
      adapterId: "hermes",
      adapterSessionRef: "20260721_011618_330489c8",
      profile: "default",
      workspaceId: "ws_fixture",
      repositoryRef: "repo_fixture",
      worktreeRef: null,
      mode: "explore",
      permissionRevision: 0,
      capabilitySnapshotHash: "a".repeat(64),
      avatarProfileRef: null,
      status: "ready",
      continuity: "current",
      currentFocusObjectIds: [],
      currentTaskRef: null,
      activeRunId: null,
      lastEventSequence: 0,
      createdAt: "2026-07-21T05:00:00.000Z",
      updatedAt: "2026-07-21T05:00:00.000Z",
    } satisfies AgentSession;
    store.saveSession(value);
    store.appendMessage(
      value.sessionId,
      "assistant",
      "safe sk-canarysecret /home/private SOUL.md",
    );
    store.saveSession({ ...value, permissionRevision: 1 });
    expect(store.load().current?.permissionRevision).toBe(1);
    const durable = fs.readFileSync(
      path.join(root, "agent-sessions.current.json"),
      "utf8",
    );
    expect(durable).not.toMatch(/canarysecret|\/home\/private|SOUL\.md/);
    fs.writeFileSync(path.join(root, "agent-sessions.current.json"), "corrupt");
    expect(new AgentSessionStore(root).load()).toMatchObject({
      recovery: "previous-recovered",
      current: {
        permissionRevision: 0,
        continuity: "previous-recovered",
      },
    });
  });

  it("resumes the same World binding instead of silently creating a duplicate", async () => {
    const adapter: AgentAdapter = {
      id: "fixture",
      attest: async () => ({
        schema: "aiw.agent-capabilities/0.12",
        adapterId: "fixture",
        adapterVersion: "1",
        transport: "loopback-http-sse",
        origin: "local",
        auth: "server-bearer",
        supportedModes: ["explore"],
        ordering: "per-session-strict",
        resume: "session-api",
        shutdownOwner: "external",
        maxInputBytes: 16384,
        maxEventBytes: 32768,
        capabilities: {
          attach: true,
          sendText: true,
          streamDeltas: true,
          toolStatus: false,
          approvals: false,
          interrupt: false,
          avatarProposal: false,
          skillsDisclosure: false,
        },
        unavailable: {
          toolStatus: "fixture",
          approvals: "fixture",
          interrupt: "fixture",
          avatarProposal: "fixture",
          skillsDisclosure: "fixture",
        },
      }),
      listSessions: async () => [],
      attach: async (id) => ({ id, source: "fixture", title: "Fixture" }),
      sendText: async () => ({ finalText: "done", deltas: [] }),
    };
    const gateway = new AgentSessionGateway({
      registry: new AdapterRegistry([adapter]),
      store: new AgentSessionStore(newRoot()),
    });
    const request = {
      adapterId: "fixture",
      adapterSessionRef: "native",
      profile: "default",
      workspaceId: "ws_fixture",
      repositoryRef: "repo_fixture",
      mode: "explore" as const,
    };
    const first = await gateway.attach(request);
    const resumed = await gateway.attach(request);
    expect(resumed.sessionId).toBe(first.sessionId);
    expect(gateway.store.load().sessions).toHaveLength(1);
  });

  it("keeps the selected root binding stable while persisting a proven effective-session rotation", async () => {
    let turn = 0;
    const adapter: AgentAdapter = {
      id: "fixture",
      attest: async () => ({
        schema: "aiw.agent-capabilities/0.12",
        adapterId: "fixture",
        adapterVersion: "1",
        transport: "loopback-http-sse",
        origin: "local",
        auth: "server-bearer",
        supportedModes: ["explore"],
        ordering: "per-session-strict",
        resume: "session-api",
        shutdownOwner: "external",
        maxInputBytes: 16384,
        maxEventBytes: 32768,
        capabilities: {
          attach: true,
          sendText: true,
          streamDeltas: true,
          toolStatus: false,
          approvals: false,
          interrupt: false,
          avatarProposal: false,
          skillsDisclosure: false,
        },
        unavailable: {
          toolStatus: "fixture",
          approvals: "fixture",
          interrupt: "fixture",
          avatarProposal: "fixture",
          skillsDisclosure: "fixture",
        },
      }),
      listSessions: async () => [],
      attach: async () => ({
        id: "effective-a",
        rootId: "selected-root",
        source: "fixture",
        title: "Fixture",
      }),
      sendText: async (ref, _text, context) => {
        turn += 1;
        expect(ref).toBe(turn === 1 ? "effective-a" : "effective-b");
        expect(context?.userDisplayName).toBe(turn === 1 ? "Aaron" : "Riley");
        return {
          finalText: `done-${turn}`,
          deltas: [],
          sessionRef: "effective-b",
        };
      },
    } as AgentAdapter;
    const gateway = new AgentSessionGateway({
      registry: new AdapterRegistry([adapter]),
      store: new AgentSessionStore(newRoot()),
    });
    const attached = await gateway.attach({
      adapterId: "fixture",
      adapterSessionRef: "selected-root",
      profile: "default",
      workspaceId: "ws_fixture",
      repositoryRef: "aiw://object/88888888888888888888888888888888",
      mode: "explore",
    });
    expect(attached).toMatchObject({
      adapterRootSessionRef: "selected-root",
      adapterSessionRef: "effective-a",
    });

    await gateway.sendText(attached.sessionId, {
      text: "rotate",
      binding: attached,
      context: { userDisplayName: "Aaron" },
    });
    expect(gateway.status(attached.sessionId)).toMatchObject({
      adapterRootSessionRef: "selected-root",
      adapterPreviousSessionRef: "effective-a",
      adapterSessionRef: "effective-b",
    });
    await expect(
      gateway.sendText(attached.sessionId, {
        text: "continue with the original client binding",
        binding: attached,
        context: { userDisplayName: "Riley" },
      }),
    ).resolves.toMatchObject({ finalText: "done-2" });
    expect(gateway.status(attached.sessionId)).toMatchObject({
      adapterRootSessionRef: "selected-root",
      adapterSessionRef: "effective-b",
      adapterPreviousSessionRef: null,
    });
  });

  it("fails Hermes text closed when the plugin arbiter cannot be attested", async () => {
    const fixture = await fakeHermes();
    fs.unlinkSync(fixture.pluginCapabilityPath);
    const adapter = new HermesSessionAdapter({
      baseUrl: fixture.baseUrl,
      apiKey: "fixture-key",
      profile: "default",
      pluginCapabilityPath: fixture.pluginCapabilityPath,
    });
    const manifest = await adapter.attest();
    expect(manifest.capabilities.attach).toBe(true);
    expect(manifest.capabilities.sendText).toBe(false);
    expect(manifest.unavailable.sendText).toMatch(/same-session arbiter/i);
    await expect(
      adapter.sendText("20260721_011618_330489c8", "blocked"),
    ).rejects.toMatchObject({ code: "unsupported" });
  });

  it("serializes one exact session and interrupts only its active run", async () => {
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => (release = resolve));
    const adapter: AgentAdapter = {
      id: "fixture",
      attest: async () => ({
        schema: "aiw.agent-capabilities/0.12",
        adapterId: "fixture",
        adapterVersion: "1",
        transport: "loopback-http-sse",
        origin: "local",
        auth: "server-bearer",
        supportedModes: ["explore", "collaborate"],
        ordering: "per-session-strict",
        resume: "session-api",
        shutdownOwner: "external",
        maxInputBytes: 16384,
        maxEventBytes: 32768,
        capabilities: {
          attach: true,
          sendText: true,
          streamDeltas: true,
          toolStatus: false,
          approvals: false,
          interrupt: true,
          avatarProposal: false,
          skillsDisclosure: false,
        },
        unavailable: {
          toolStatus: "fixture",
          approvals: "fixture",
          avatarProposal: "fixture",
          skillsDisclosure: "fixture",
        },
      }),
      listSessions: async () => [
        { id: "native", source: "fixture", title: "Fixture" },
      ],
      attach: async () => ({
        id: "native",
        source: "fixture",
        title: "Fixture",
      }),
      sendText: async () => {
        await waiting;
        return { finalText: "done", deltas: [], runId: "run-exact" };
      },
      interrupt: async (runId) => {
        expect(runId).toBe("run-exact");
      },
    };
    const registry = new AdapterRegistry([adapter]);
    const gateway = new AgentSessionGateway({
      registry,
      store: new AgentSessionStore(newRoot()),
    });
    const attached = await gateway.attach({
      adapterId: "fixture",
      adapterSessionRef: "native",
      profile: "default",
      workspaceId: "ws_fixture",
      repositoryRef: "repo_fixture",
      mode: "explore",
    });
    const first = gateway.sendText(attached.sessionId, {
      text: "hello",
      binding: attached,
    });
    await expect(
      gateway.sendText(attached.sessionId, {
        text: "second",
        binding: attached,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      gateway.interrupt(attached.sessionId, "wrong-run"),
    ).rejects.toMatchObject({
      code: "conflict",
    });
    release();
    await first;
    await expect(
      gateway.interrupt(attached.sessionId, "run-exact"),
    ).resolves.toBeUndefined();
  });

  it("persists event IDs and refuses duplicate/gap truth across restart", () => {
    const root = newRoot();
    const store = new AgentSessionStore(root);
    const base = {
      schema: "aiw.agent-session/0.12",
      sessionId: "77777777-7777-4777-8777-777777777777",
      adapterId: "hermes",
      adapterSessionRef: "native",
      profile: "default",
      workspaceId: "ws_fixture",
      repositoryRef: "repo_fixture",
      worktreeRef: null,
      mode: "explore",
      permissionRevision: 0,
      capabilitySnapshotHash: "b".repeat(64),
      avatarProfileRef: null,
      status: "ready",
      continuity: "current",
      currentFocusObjectIds: [],
      currentTaskRef: null,
      activeRunId: null,
      lastEventSequence: 0,
      createdAt: "2026-07-21T05:00:00.000Z",
      updatedAt: "2026-07-21T05:00:00.000Z",
    } satisfies AgentSession;
    store.saveSession(base);
    const accepted = {
      schema: "aiw.agent-event/0.12",
      eventId: "88888888-8888-4888-8888-888888888888",
      sessionId: base.sessionId,
      sequence: 1,
      occurredAt: "2026-07-21T05:00:01.000Z",
      correlationId: "99999999-9999-4999-8999-999999999999",
      type: "session.connected",
      payload: { truth: "current" },
      redaction: { applied: false, count: 0 },
    };
    expect(store.appendEvent(accepted)).toBe("accepted");
    expect(store.appendEvent(accepted)).toBe("duplicate");
    expect(() =>
      store.appendEvent({
        ...accepted,
        eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        sequence: 3,
      }),
    ).toThrow(/gap/i);
    expect(store.requireSession(base.sessionId).continuity).toBe(
      "reset-required",
    );
    const restarted = new AgentSessionStore(root);
    expect(restarted.events(base.sessionId)).toHaveLength(1);
    expect(restarted.requireSession(base.sessionId)).toMatchObject({
      lastEventSequence: 1,
      continuity: "reset-required",
    });
  });

  it("persists explicit missing truth when a previously bound native session disappears", async () => {
    let missing = false;
    const adapter: AgentAdapter = {
      id: "fixture",
      attest: async () => ({
        schema: "aiw.agent-capabilities/0.12",
        adapterId: "fixture",
        adapterVersion: "1",
        transport: "loopback-http-sse",
        origin: "local",
        auth: "server-bearer",
        supportedModes: ["explore"],
        ordering: "per-session-strict",
        resume: "session-api",
        shutdownOwner: "external",
        maxInputBytes: 16384,
        maxEventBytes: 32768,
        capabilities: {
          attach: true,
          sendText: true,
          streamDeltas: true,
          toolStatus: false,
          approvals: false,
          interrupt: false,
          avatarProposal: false,
          skillsDisclosure: false,
        },
        unavailable: {
          toolStatus: "fixture",
          approvals: "fixture",
          interrupt: "fixture",
          avatarProposal: "fixture",
          skillsDisclosure: "fixture",
        },
      }),
      listSessions: async () => [],
      attach: async (id) => {
        if (missing) throw new GatewayError("not_found", "missing");
        return { id, source: "fixture", title: "Fixture" };
      },
      sendText: async () => ({ finalText: "done", deltas: [] }),
    };
    const gateway = new AgentSessionGateway({
      registry: new AdapterRegistry([adapter]),
      store: new AgentSessionStore(newRoot()),
    });
    const request = {
      adapterId: "fixture",
      adapterSessionRef: "native",
      profile: "default",
      workspaceId: "ws_fixture",
      repositoryRef: "repo_fixture",
      mode: "explore" as const,
    };
    const attached = await gateway.attach(request);
    missing = true;
    await expect(gateway.attach(request)).rejects.toMatchObject({
      code: "not_found",
    });
    expect(gateway.status(attached.sessionId)).toMatchObject({
      status: "error",
      continuity: "missing",
    });
  });

  it("discovers bounded design previews without following outside roots or mutating files", () => {
    const root = newRoot();
    fs.mkdirSync(path.join(root, "docs"));
    fs.writeFileSync(
      path.join(root, "docs", "DESIGN.md"),
      "# Task Board\n\n## Validation\nReady locally\n\n## Phase 1\n\n### Acceptance Criteria\n- visible\n",
    );
    fs.writeFileSync(path.join(root, "secret.txt"), "do not discover");
    const before = fs.statSync(path.join(root, "docs", "DESIGN.md")).mtimeMs;
    expect(discoverDesignPreviews(root)).toEqual([
      expect.objectContaining({
        relativePath: "docs/DESIGN.md",
        name: "Task Board",
        validation: "Ready locally",
        phaseHeadings: ["Phase 1"],
        acceptanceHeadings: ["Acceptance Criteria"],
      }),
    ]);
    expect(fs.statSync(path.join(root, "docs", "DESIGN.md")).mtimeMs).toBe(
      before,
    );
  });
});
