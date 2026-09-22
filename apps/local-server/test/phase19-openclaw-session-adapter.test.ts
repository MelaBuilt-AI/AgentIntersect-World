import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import WebSocket, { WebSocketServer } from "ws";

import {
  OPENCLAW_GATEWAY_PROTOCOL_VERSION,
  OPENCLAW_SERVER_VERSION,
  OpenClawSessionAdapter,
} from "../src/openclaw-session-adapter.js";

type FixtureOptions = {
  readonly protocol?: number;
  readonly serverVersion?: string;
  readonly role?: string;
  readonly methods?: readonly string[];
  readonly malformedFrame?: boolean;
  readonly oversizedFrame?: boolean;
  readonly oversizedOutput?: boolean;
  readonly eventFlood?: boolean;
  readonly noisyStream?: boolean;
  readonly lateNoise?: boolean;
  readonly toolFlood?: boolean;
  readonly toolFloodEnds?: boolean;
  readonly disconnectOnSend?: boolean;
  readonly delayTerminal?: boolean;
  readonly errorCanary?: string;
  readonly ignoreMethod?: string;
  readonly abortConfirmed?: boolean;
  readonly abortEventFirst?: boolean;
};

const servers: Array<{ close(): Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function fixtureGateway(options: FixtureOptions = {}) {
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  const sessions = new Map<string, string>();
  const labels = new Set<string>();
  const pendingTerminals: Array<() => void> = [];
  let created = 0;
  const http = createServer();
  const sockets = new Set<WebSocket>();
  const websocket = new WebSocketServer({ server: http });
  const methods = options.methods ?? [
    "sessions.create",
    "sessions.describe",
    "sessions.send",
    "sessions.abort",
    "sessions.delete",
  ];

  websocket.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    socket.send(
      JSON.stringify({
        type: "event",
        event: "connect.challenge",
        payload: { nonce: "fixture-nonce" },
      }),
    );
    socket.on("message", (raw) => {
      const request = JSON.parse(String(raw)) as {
        id: string;
        method: string;
        params: Record<string, unknown>;
      };
      calls.push({ method: request.method, params: request.params });
      const respond = (payload: unknown) =>
        socket.send(
          JSON.stringify({ type: "res", id: request.id, ok: true, payload }),
        );
      if (request.method === "connect") {
        respond({
          type: "hello-ok",
          protocol: options.protocol ?? OPENCLAW_GATEWAY_PROTOCOL_VERSION,
          server: {
            version: options.serverVersion ?? OPENCLAW_SERVER_VERSION,
            connId: "fixture-connection",
          },
          features: { methods, events: ["agent", "chat"] },
          snapshot: {
            presence: [],
            health: { ok: true },
            stateVersion: { presence: 1, health: 1 },
            uptimeMs: 1,
          },
          auth: {
            role: options.role ?? "operator",
            scopes: ["operator.admin"],
          },
          policy: {
            maxPayload: 1_048_576,
            maxBufferedBytes: 1_048_576,
            tickIntervalMs: 30_000,
          },
        });
        return;
      }
      if (request.method === options.ignoreMethod) return;
      if (request.method === "sessions.create") {
        const label = String(request.params.label);
        if (labels.has(label)) {
          socket.send(
            JSON.stringify({
              type: "res",
              id: request.id,
              ok: false,
              error: {
                code: "INVALID_REQUEST",
                message: "label already in use",
              },
            }),
          );
          return;
        }
        labels.add(label);
        created += 1;
        const key = `agent:main:dashboard:world-owned-${created}`;
        const sessionId = `native-session-${created}`;
        sessions.set(key, sessionId);
        respond({ ok: true, key, sessionId, entry: { sessionId } });
        return;
      }
      if (request.method === "sessions.describe") {
        const key = String(request.params.key);
        const sessionId = sessions.get(key);
        respond({ session: sessionId ? { key, sessionId } : null });
        return;
      }
      if (request.method === "sessions.send") {
        if (options.errorCanary) {
          socket.send(
            JSON.stringify({
              type: "res",
              id: request.id,
              ok: false,
              error: {
                code: "UPSTREAM",
                message: options.errorCanary,
                details: { transcript: options.errorCanary },
              },
            }),
          );
          return;
        }
        if (options.disconnectOnSend) {
          socket.close();
          return;
        }
        const runId = String(request.params.idempotencyKey);
        const key = String(request.params.key);
        respond({ runId, status: "started" });
        if (options.malformedFrame) {
          socket.send("{not-json");
          return;
        }
        if (options.oversizedFrame) {
          socket.send("x".repeat(1_048_577));
          return;
        }
        const finish = () => {
          const event = (name: string, payload: unknown) =>
            socket.send(
              JSON.stringify({ type: "event", event: name, payload }),
            );
          if (options.eventFlood) {
            for (let index = 0; index < 18; index += 1)
              event("tick", { text: "x".repeat(1_000_000) });
            return;
          }
          if (options.noisyStream) {
            for (let index = 0; index < 1_500; index += 1) {
              event("tick", { index });
              event("chat", {
                runId: "other-run",
                sessionKey: "other-session",
                state: "delta",
                deltaText: "NOT_OUR_TEXT",
              });
              event("agent", {
                runId,
                sessionKey: key,
                stream: "reasoning",
                data: { text: "PRIVATE_REASONING_CANARY" },
              });
              event("chat", {
                runId,
                sessionKey: key,
                state: "delta",
                deltaText: "x",
              });
            }
          }
          if (options.toolFlood) {
            for (let index = 0; index < 1_025; index += 1)
              event("agent", {
                runId,
                sessionKey: key,
                stream: "tool",
                data: {
                  phase: "start",
                  name: "read_file",
                  toolCallId: `call-${index}`,
                },
              });
            if (options.toolFloodEnds)
              event("chat", {
                runId,
                sessionKey: key,
                state: "final",
                message: {
                  role: "assistant",
                  content: [{ type: "text", text: "late completion" }],
                },
              });
            return;
          }
          if (options.oversizedOutput) {
            for (let index = 0; index < 3; index += 1)
              event("chat", {
                state: "delta",
                deltaText: "x".repeat(30_000),
                runId,
                sessionKey: key,
                seq: index + 1,
              });
            return;
          }
          event("chat", {
            state: "delta",
            deltaText: "fixture ",
            runId,
            sessionKey: key,
            seq: 1,
          });
          event("agent", {
            runId,
            sessionKey: key,
            seq: 2,
            stream: "tool",
            ts: Date.now(),
            data: {
              phase: "start",
              name: "read_file",
              args: { secret: "RAW_ARGS_CANARY" },
            },
          });
          event("agent", {
            runId,
            sessionKey: key,
            seq: 3,
            stream: "tool",
            ts: Date.now(),
            data: {
              phase: "result",
              name: "read_file",
              result: "RAW_RESULT_CANARY",
              isError: false,
            },
          });
          event("chat", {
            state: "final",
            runId,
            sessionKey: key,
            seq: 4,
            message: {
              role: "assistant",
              content: [{ type: "text", text: "fixture complete" }],
            },
          });
          if (options.lateNoise) {
            for (let index = 0; index < 1_100; index += 1)
              event("tick", { index });
            socket.close();
          }
        };
        if (options.delayTerminal) pendingTerminals.push(finish);
        else queueMicrotask(finish);
        return;
      }
      if (request.method === "sessions.abort") {
        if (options.abortEventFirst)
          socket.send(
            JSON.stringify({
              type: "event",
              event: "chat",
              payload: {
                state: "aborted",
                sessionKey: request.params.key,
                runId: request.params.runId,
              },
            }),
          );
        respond(
          options.abortConfirmed === false
            ? { ok: false }
            : { ok: true, abortedRunId: request.params.runId },
        );
        return;
      }
      if (request.method === "sessions.delete") {
        const key = String(request.params.key);
        sessions.delete(key);
        respond({ ok: true, key, deleted: true, archived: [] });
        return;
      }
      socket.send(
        JSON.stringify({
          type: "res",
          id: request.id,
          ok: false,
          error: { code: "INVALID_REQUEST", message: "unexpected method" },
        }),
      );
    });
  });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const address = http.address();
  if (!address || typeof address === "string") throw new Error("no address");
  const fixture = {
    url: `http://127.0.0.1:${address.port}`,
    calls,
    release: () => pendingTerminals.splice(0).forEach((finish) => finish()),
    close: async () => {
      for (const socket of sockets) socket.terminate();
      websocket.close();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
  servers.push(fixture);
  return fixture;
}

function adapter(url: string, overrides: Record<string, unknown> = {}) {
  return new OpenClawSessionAdapter({
    gatewayUrl: url,
    credential: "FIXTURE_TOKEN_CANARY",
    connectTimeoutMs: 250,
    turnTimeoutMs: 250,
    ...overrides,
  });
}

async function waitForCall(
  calls: readonly { method: string }[],
  method: string,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (calls.some((call) => call.method === method)) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 2));
  }
  throw new Error(`fixture did not receive ${method}`);
}

async function waitForCallCount(
  calls: readonly { method: string }[],
  method: string,
  count: number,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (calls.filter((call) => call.method === method).length >= count) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 2));
  }
  throw new Error(`fixture did not receive ${count} ${method} calls`);
}

describe("OpenClawSessionAdapter", () => {
  it("bounds raw stream bytes even for ignored telemetry", async () => {
    const gateway = await fixtureGateway({ eventFlood: true });
    const native = adapter(gateway.url, { turnTimeoutMs: 5000 });
    const session = await native.createWorldSession("raw-limit-proof");
    await expect(
      native.sendText(session.id, "bounded raw stream", {
        mode: "explore",
        rootSessionRef: session.rootId,
      }),
    ).rejects.toThrow("OpenClaw gateway response exceeded a bound");
  });
  it.each([false, true])(
    "aborts excessive relevant tool activity once and requires confirmation (late final: %s)",
    async (toolFloodEnds) => {
      const gateway = await fixtureGateway({ toolFlood: true, toolFloodEnds });
      const native = adapter(gateway.url);
      const session = await native.createWorldSession("tool-limit-proof");
      await expect(
        native.sendText(session.id, "bounded tools", {
          mode: "explore",
          rootSessionRef: session.rootId,
        }),
      ).rejects.toThrow("OpenClaw turn exceeded the tool event bound");
      await waitForCall(gateway.calls, "sessions.abort");
      expect(
        gateway.calls.filter((c) => c.method === "sessions.abort"),
      ).toHaveLength(1);
      await expect(
        native.attach(session.rootId!, { worldInstanceId: "tool-limit-proof" }),
      ).resolves.toMatchObject({ id: session.id });
    },
  );
  it.each([{ noisyStream: true }, { lateNoise: true }])(
    "accepts bounded fragmented completion without counting gateway noise: %s",
    async (options) => {
      const gateway = await fixtureGateway(options);
      const native = adapter(gateway.url);
      const session = await native.createWorldSession("stream-proof");
      const events: unknown[] = [];
      const result = await native.sendText(session.id, "bounded turn", {
        mode: "explore",
        rootSessionRef: session.rootId,
        onEvent: async (event) => {
          if (options.lateNoise)
            await new Promise((resolve) => setTimeout(resolve, 5));
          events.push(event);
        },
      });
      expect(result.finalText).toBe("fixture complete");
      expect(JSON.stringify(events)).not.toContain("NOT_OUR_TEXT");
      expect(JSON.stringify(events)).not.toContain("PRIVATE_REASONING_CANARY");
      await expect(
        native.sendText(session.id, "next turn", {
          mode: "explore",
          rootSessionRef: session.rootId,
        }),
      ).resolves.toMatchObject({ finalText: "fixture complete" });
    },
  );

  it("keeps the timeout reason when native aborted arrives before the abort receipt", async () => {
    const gateway = await fixtureGateway({
      delayTerminal: true,
      abortEventFirst: true,
    });
    const native = adapter(gateway.url, { turnTimeoutMs: 30 });
    const created = await native.createWorldSession("deadline-reason");
    await expect(
      native.sendText(created.id, "slow task", {
        mode: "explore",
        rootSessionRef: created.rootId,
      }),
    ).rejects.toThrow("OpenClaw session turn timed out");
    expect(
      gateway.calls.filter((call) => call.method === "sessions.abort"),
    ).toHaveLength(1);
  });
  it("carries owned Workstream context to the same native session with a coding deadline", async () => {
    const gateway = await fixtureGateway();
    const native = new OpenClawSessionAdapter({
      gatewayUrl: gateway.url,
      credential: "fixture-token",
    });
    const created = await native.createWorldSession("workstream-context");
    await native.sendText(created.id, "Build the home page", {
      mode: "explore",
      rootSessionRef: created.rootId,
      workingDirectory: "/tmp/owned beans worktree",
      nativeWorkingDirectory: "C:/Owned Beans/worktree",
      systemMessage:
        "Write only in the owned worktree. Save the exact Workstream receipt.",
    });
    const sent = gateway.calls.find(
      (call) => call.method === "sessions.send",
    )!.params;
    expect(sent.key).toBe(created.rootId);
    expect(sent.message).toContain("C:/Owned Beans/worktree");
    expect(sent.message).not.toContain("/tmp/owned beans worktree");
    expect(sent.message).toContain("Save the exact Workstream receipt.");
    expect(sent.message).toContain("Build the home page");
    expect(sent.timeoutMs).toBe(600_000);
    // The installed gateway only accepts context in message, not invented cwd fields.
    expect(sent).not.toHaveProperty("cwd");
    expect(
      gateway.calls.filter((call) => call.method === "sessions.create"),
    ).toHaveLength(1);
  });

  it("restores exact native ownership across adapter recreation without replacement", async () => {
    const fixture = await fixtureGateway();
    const directory = await mkdtemp(path.join(tmpdir(), "aiw-claw-resume-"));
    try {
      const options = {
        gatewayUrl: fixture.url,
        credential: "FIXTURE_TOKEN_CANARY",
        nativeSessionRoot: directory,
      };
      const initial = await new OpenClawSessionAdapter(
        options,
      ).createWorldSession("world-owned", "Agent");
      const restored = new OpenClawSessionAdapter(options);
      expect(
        await restored.attach(initial.rootId!, {
          worldInstanceId: "world-owned",
        }),
      ).toEqual(initial);
      await expect(
        restored.attach(initial.rootId!, { worldInstanceId: "other-world" }),
      ).rejects.toThrow();
      expect(
        fixture.calls.filter((request) => request.method === "sessions.create"),
      ).toHaveLength(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("creates conversations under the selected native OpenClaw agent", async () => {
    const gateway = await fixtureGateway();
    const selected = new OpenClawSessionAdapter({
      gatewayUrl: gateway.url,
      credential: "fixture-token",
      agentId: "work",
    });
    await selected.createWorldSession("selected-agent-world");
    expect(
      gateway.calls.find((call) => call.method === "sessions.create")?.params
        .key,
    ).toMatch(/^agent:work:aiw:/);
  });
  it("creates distinct native conversations for the same agent display name across Worlds", async () => {
    const gateway = await fixtureGateway();
    const first = adapter(gateway.url);
    const second = adapter(gateway.url);
    const a = await first.createWorldSession("world-a", "Beans");
    const b = await second.createWorldSession("world-b", "Beans");
    expect(a.rootId).not.toBe(b.rootId);
    expect(a.title).toBe("Beans");
    expect(b.title).toBe("Beans");
    const calls = gateway.calls.filter((c) => c.method === "sessions.create");
    expect(calls[0]!.params.label).not.toBe(calls[1]!.params.label);
    expect(String(calls[1]!.params.label).length).toBeLessThanOrEqual(80);
  });
  it("bounds an unanswered sessions.create request with a sanitized adapter deadline", async () => {
    const gateway = await fixtureGateway({ ignoreMethod: "sessions.create" });
    const startedAt = Date.now();
    const error = await adapter(gateway.url, { connectTimeoutMs: 30 })
      .createWorldSession("world-timeout")
      .catch((reason: unknown) => reason as Error);

    expect(Date.now() - startedAt).toBeLessThan(500);
    expect(error.message).toBe("OpenClaw gateway request timed out");
    expect(error.message.length).toBeLessThan(100);
    expect(
      gateway.calls.filter(({ method }) => method === "sessions.create"),
    ).toHaveLength(1);
  });

  it("attests only the exact installed handshake, identity, and capability set", async () => {
    const gateway = await fixtureGateway();
    const manifest = await adapter(gateway.url).attest();

    expect(manifest.adapterId).toBe("openclaw");
    expect(manifest.capabilities).toMatchObject({
      attach: true,
      sendText: true,
      streamDeltas: true,
      toolStatus: true,
      interrupt: false,
    });
    expect(gateway.calls[0]).toMatchObject({
      method: "connect",
      params: {
        minProtocol: 4,
        maxProtocol: 4,
        client: { id: "gateway-client", mode: "backend" },
        caps: ["tool-events"],
        role: "operator",
        scopes: ["operator.admin"],
        auth: { token: "FIXTURE_TOKEN_CANARY" },
      },
    });
  });

  it.each(["2026.6.0", "2099.1.1-next.1"])(
    "accepts compatible OpenClaw version %s without a release allowlist",
    async (serverVersion) => {
      const gateway = await fixtureGateway({ serverVersion });
      await expect(adapter(gateway.url).attest()).resolves.toMatchObject({
        adapterVersion: `0.19.0-openclaw-${serverVersion}`,
      });
    },
  );

  it.each([
    [{ protocol: 3 }, "protocol"],
    [{ serverVersion: "bad version metadata" }, "identity"],
    [{ role: "node" }, "identity"],
    [{ methods: ["sessions.create"] }, "capability"],
  ] as const)("fails closed on gateway %s mismatch", async (options, label) => {
    const gateway = await fixtureGateway(options);
    await expect(adapter(gateway.url).attest()).rejects.toThrow(label);
  });

  it("creates a fresh World-owned root, reconnects only in the same World, and maps explicit events", async () => {
    const gateway = await fixtureGateway();
    const openclaw = adapter(gateway.url);
    const created = await openclaw.createWorldSession("world-one", "Claw One");
    const createCall = gateway.calls.find(
      ({ method }) => method === "sessions.create",
    );
    expect(createCall?.params.label).toBe(
      `Claw One [World ${String(createCall?.params.key).split(":").at(-1)}]`,
    );
    expect(createCall?.params.key).toMatch(
      /^agent:main:aiw:[0-9a-f]{8}-[0-9a-f-]{27,}$/iu,
    );
    const attached = await openclaw.attach(created.rootId as string, {
      worldInstanceId: "world-one",
    });
    const events: unknown[] = [];
    const first = await openclaw.sendText(attached.id, "hello", {
      mode: "explore",
      rootSessionRef: created.rootId,
      onEvent: (event) => events.push(event),
    });
    const secondAttach = await openclaw.attach(created.rootId as string, {
      worldInstanceId: "world-one",
    });
    const second = await openclaw.sendText(secondAttach.id, "again", {
      mode: "explore",
      rootSessionRef: created.rootId,
    });

    expect(first).toMatchObject({
      finalText: "fixture complete",
      deltas: ["fixture "],
      sessionRef: "native-session-1",
    });
    expect(second.finalText).toBe("fixture complete");
    expect(events).toEqual([
      {
        type: "assistant.delta",
        text: "fixture ",
        redaction: { applied: false, count: 0 },
      },
      {
        type: "tool.started",
        toolName: "read_file",
        redaction: { applied: true, count: 1 },
      },
      {
        type: "tool.completed",
        toolName: "read_file",
        redaction: { applied: true, count: 1 },
      },
    ]);
    expect(JSON.stringify(events)).not.toContain("RAW_");
    await expect(
      openclaw.attach(created.rootId as string, {
        worldInstanceId: "wrong-world",
      }),
    ).rejects.toThrow(/World/i);
  });

  it("rejects overlapping turns on the exact native session", async () => {
    const gateway = await fixtureGateway({ delayTerminal: true });
    const openclaw = adapter(gateway.url);
    const created = await openclaw.createWorldSession("world-one");
    const first = openclaw.sendText(created.id, "one", {
      mode: "explore",
      rootSessionRef: created.rootId,
    });
    await waitForCall(gateway.calls, "sessions.send");
    await expect(
      openclaw.sendText(created.id, "two", {
        mode: "explore",
        rootSessionRef: created.rootId,
      }),
    ).rejects.toThrow(/active/i);
    gateway.release();
    await first;
  });

  it("bounds malformed/oversize frames, timeout, disconnect, cancellation, and input", async () => {
    for (const options of [
      { malformedFrame: true },
      { oversizedFrame: true },
      { oversizedOutput: true },
      { eventFlood: true },
      { disconnectOnSend: true },
      { delayTerminal: true },
    ]) {
      const gateway = await fixtureGateway(options);
      const openclaw = adapter(gateway.url, { turnTimeoutMs: 30 });
      const created = await openclaw.createWorldSession("world-one");
      await expect(
        openclaw.sendText(created.id, "bounded", {
          mode: "explore",
          rootSessionRef: created.rootId,
        }),
      ).rejects.toThrow(/OpenClaw/);
    }
    const gateway = await fixtureGateway({ delayTerminal: true });
    const openclaw = adapter(gateway.url);
    const created = await openclaw.createWorldSession("world-cancel");
    const controller = new AbortController();
    const turn = openclaw.sendText(created.id, "cancel", {
      mode: "explore",
      rootSessionRef: created.rootId,
      signal: controller.signal,
    });
    await waitForCall(gateway.calls, "sessions.send");
    controller.abort();
    await expect(turn).rejects.toThrow(/cancel/i);
    expect(gateway.calls.map(({ method }) => method)).toContain(
      "sessions.abort",
    );
    await expect(
      openclaw.sendText(created.id, "x".repeat(16_385), {
        mode: "explore",
        rootSessionRef: created.rootId,
      }),
    ).rejects.toThrow(/input/i);
  });

  it.each([
    { malformedFrame: true },
    { oversizedFrame: true },
    { disconnectOnSend: true },
  ])(
    "quarantines an ambiguously admitted run after gateway failure: %s",
    async (options) => {
      const gateway = await fixtureGateway(options);
      const openclaw = adapter(gateway.url);
      const created = await openclaw.createWorldSession("world-quarantine");

      await expect(
        openclaw.sendText(created.id, "ambiguous", {
          mode: "explore",
          rootSessionRef: created.rootId,
        }),
      ).rejects.toThrow(/OpenClaw/);
      expect(await openclaw.listSessions()).toHaveLength(1);

      await expect(
        openclaw.sendText(created.id, "must not overlap", {
          mode: "explore",
          rootSessionRef: created.rootId,
        }),
      ).rejects.toThrow(/stale|quarantined/i);
      await expect(
        openclaw.attach(created.rootId as string, {
          worldInstanceId: "world-quarantine",
        }),
      ).rejects.toThrow(/stale|quarantined/i);
      expect(
        gateway.calls.filter(({ method }) => method === "sessions.send"),
      ).toHaveLength(1);
      expect(
        gateway.calls.filter(({ method }) => method === "sessions.create"),
      ).toHaveLength(1);
      expect(
        gateway.calls.filter(({ method }) => method === "sessions.describe"),
      ).toHaveLength(0);

      await expect(
        openclaw.endWorldSession("wrong-world", created.rootId as string),
      ).rejects.toThrow(/World/i);
      expect(
        gateway.calls.filter(({ method }) => method === "sessions.delete"),
      ).toHaveLength(0);
      await openclaw.endWorldSession(
        "world-quarantine",
        created.rootId as string,
      );
      expect(
        gateway.calls.filter(({ method }) => method === "sessions.delete"),
      ).toHaveLength(1);
      expect(await openclaw.listSessions()).toHaveLength(0);
    },
  );

  it("releases a cancelled run without quarantine only after confirmed abort", async () => {
    const gateway = await fixtureGateway({ delayTerminal: true });
    const openclaw = adapter(gateway.url);
    const created = await openclaw.createWorldSession("world-abort");
    const controller = new AbortController();
    const first = openclaw.sendText(created.id, "cancel", {
      mode: "explore",
      rootSessionRef: created.rootId,
      signal: controller.signal,
    });
    await waitForCall(gateway.calls, "sessions.send");
    controller.abort();
    await expect(first).rejects.toThrow(/cancel/i);

    const second = openclaw.sendText(created.id, "retry", {
      mode: "explore",
      rootSessionRef: created.rootId,
    });
    await waitForCallCount(gateway.calls, "sessions.send", 2);
    gateway.release();
    await expect(second).resolves.toMatchObject({
      finalText: "fixture complete",
    });
  });

  it("quarantines a cancelled run when abort is not explicitly confirmed", async () => {
    const gateway = await fixtureGateway({
      delayTerminal: true,
      abortConfirmed: false,
    });
    const openclaw = adapter(gateway.url);
    const created = await openclaw.createWorldSession("world-abort-ambiguous");
    const controller = new AbortController();
    const turn = openclaw.sendText(created.id, "cancel", {
      mode: "explore",
      rootSessionRef: created.rootId,
      signal: controller.signal,
    });
    await waitForCall(gateway.calls, "sessions.send");
    controller.abort();
    await expect(turn).rejects.toThrow(/not confirmed/i);
    await expect(
      openclaw.sendText(created.id, "must not retry", {
        mode: "explore",
        rootSessionRef: created.rootId,
      }),
    ).rejects.toThrow(/stale|quarantined/i);
    expect(
      gateway.calls.filter(({ method }) => method === "sessions.send"),
    ).toHaveLength(1);
  });

  it("sanitizes protocol failures and tears down only its exact resource", async () => {
    const canary =
      "TOKEN_CANARY ws://user:password@127.0.0.1 RAW_PROMPT /home/private/openclaw.json";
    const failing = await fixtureGateway({ errorCanary: canary });
    const openclaw = adapter(failing.url);
    const created = await openclaw.createWorldSession("world-one");
    const error = await openclaw
      .sendText(created.id, "RAW_PROMPT", {
        mode: "explore",
        rootSessionRef: created.rootId,
      })
      .catch((reason: unknown) => reason as Error);
    expect(error.message).toBe("OpenClaw gateway request failed");
    expect(error.message).not.toContain(canary);

    const gateway = await fixtureGateway();
    const lifecycle = adapter(gateway.url);
    const first = await lifecycle.createWorldSession("world-one");
    await lifecycle.endWorldSession("world-one", first.rootId as string);
    await expect(
      lifecycle.attach(first.rootId as string, {
        worldInstanceId: "world-one",
      }),
    ).rejects.toThrow(/ended|owned/i);
    const second = await lifecycle.createWorldSession("world-two");
    expect(second.rootId).not.toBe(first.rootId);
    expect(
      gateway.calls.find(({ method }) => method === "sessions.delete"),
    ).toMatchObject({
      params: {
        key: first.rootId,
        expectedSessionId: first.id,
        deleteTranscript: true,
      },
    });
    const forbidden = [
      "config.set",
      "config.patch",
      "config.apply",
      "update.run",
      "send",
      "message.send",
      "gateway.restart",
    ];
    expect(gateway.calls.map(({ method }) => method)).not.toEqual(
      expect.arrayContaining(forbidden),
    );
  });
});
