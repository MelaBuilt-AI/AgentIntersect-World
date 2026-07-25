import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  AdapterRegistry,
  AgentSessionGateway,
  AgentSessionStore,
  GatewayError,
  type AgentAdapter,
} from "../src/agent-sessions.js";
import { createLocalServer } from "../src/server.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-phase12-api-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "docs"));
  fs.writeFileSync(
    path.join(root, "docs", "PHASES.md"),
    "# Fixture design\n\n## Validation\nValid preview\n\n## Phase 12\n\n### Acceptance\n",
  );
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
        avatarProposal: true,
        skillsDisclosure: false,
      },
      unavailable: {
        toolStatus: "Text status only.",
        approvals: "Native approvals stay in the fixture.",
        interrupt: "No exact run identity.",
        skillsDisclosure: "Unavailable.",
      },
    }),
    listSessions: async () => [
      { id: "native", source: "discord", title: "Existing" },
    ],
    attach: async () => ({
      id: "native",
      source: "discord",
      title: "Existing",
    }),
    sendText: async (_ref, text) => ({
      finalText: `reply: ${text}`,
      deltas: ["reply: ", text],
    }),
  };
  const registry = new AdapterRegistry([adapter]);
  const gateway = new AgentSessionGateway({
    registry,
    store: new AgentSessionStore(path.join(root, ".state")),
  });
  return { root, registry, gateway };
}

describe("Phase 12 local APIs", () => {
  it("publishes capability/session/send/history/design routes and no Phase 13 actions", async () => {
    const state = fixture();
    const server = createLocalServer({
      agentSessionGateway: state.gateway,
      agentAdapterRegistry: state.registry,
      designRepositoryRoot: state.root,
    });
    const capabilities = await server.inject({
      method: "GET",
      url: "/agent-sessions/capabilities",
    });
    expect(capabilities.statusCode).toBe(200);
    expect(capabilities.json().data[0]).toMatchObject({ adapterId: "fixture" });
    const native = await server.inject({
      method: "GET",
      url: "/agent-sessions/native?adapterId=fixture",
    });
    expect(native.json().data[0]).toMatchObject({
      id: "native",
      source: "discord",
    });
    const attach = await server.inject({
      method: "POST",
      url: "/agent-sessions/attach",
      payload: {
        adapterId: "fixture",
        adapterSessionRef: "native",
        profile: "default",
        workspaceId: "ws_fixture",
        repositoryRef: "aiw://object/88888888888888888888888888888888",
        mode: "explore",
      },
    });
    expect(attach.statusCode).toBe(201);
    const session = attach.json().data;
    const send = await server.inject({
      method: "POST",
      url: `/agent-sessions/${session.sessionId}/messages`,
      payload: { text: "harmless", binding: session },
    });
    expect(send.statusCode).toBe(200);
    expect(send.json().data.finalText).toBe("reply: harmless");
    const history = await server.inject({
      method: "GET",
      url: `/agent-sessions/${session.sessionId}/history`,
    });
    expect(history.json().data.messages).toHaveLength(2);
    expect(JSON.stringify(history.json())).not.toMatch(/adapterSessionRef/);
    const design = await server.inject({
      method: "GET",
      url: "/guided-build/designs",
    });
    expect(design.json().data[0]).toMatchObject({
      relativePath: "docs/PHASES.md",
      validation: "Valid preview",
    });
    const openapi = await server.inject({
      method: "GET",
      url: "/openapi.json",
    });
    const paths = Object.keys(openapi.json().paths);
    expect(paths).toContain("/agent-sessions/{sessionId}/interrupt");
    expect(paths).toContain(
      "/agent-sessions/{sessionId}/approvals/{approvalId}",
    );
    expect(paths).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/world-actions|preview\/start/i),
      ]),
    );
    await server.close();
  });

  it("returns a bounded structured upstream error when an adapter attach identity is invalid", async () => {
    const state = fixture();
    const broken: AgentAdapter = {
      ...state.registry.require("fixture"),
      id: "broken",
      attest: async () => ({
        ...(await state.registry.require("fixture").attest()),
        adapterId: "broken",
      }),
      attach: async () => ({
        id: "invalid/effective/session",
        source: "discord",
        title: "Invalid",
      }),
    };
    const registry = new AdapterRegistry([broken]);
    const server = createLocalServer({
      agentSessionGateway: new AgentSessionGateway({
        registry,
        store: new AgentSessionStore(path.join(state.root, ".broken-state")),
      }),
      agentAdapterRegistry: registry,
    });
    const response = await server.inject({
      method: "POST",
      url: "/agent-sessions/attach",
      payload: {
        adapterId: "broken",
        adapterSessionRef: "selected-root",
        profile: "default",
        workspaceId: "ws_fixture",
        repositoryRef: "aiw://object/88888888888888888888888888888888",
        mode: "explore",
      },
    });
    expect(response.statusCode).toBe(502);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "upstream",
        message: "Adapter returned an invalid effective session identity",
      },
    });
    expect(JSON.stringify(response.json()).length).toBeLessThan(1_024);
    await server.close();
  });

  it("keeps unsupported approvals and Autonomous visibly unavailable at the API boundary", async () => {
    const state = fixture();
    const server = createLocalServer({
      agentSessionGateway: state.gateway,
      agentAdapterRegistry: state.registry,
      designRepositoryRoot: state.root,
    });
    const attach = await server.inject({
      method: "POST",
      url: "/agent-sessions/attach",
      payload: {
        adapterId: "fixture",
        adapterSessionRef: "native",
        profile: "default",
        workspaceId: "ws_fixture",
        repositoryRef: "repo_fixture",
        mode: "autonomous",
      },
    });
    expect(attach.statusCode).toBe(409);
    expect(attach.json().error.message).toMatch(/not attachable/i);
    await server.close();
  });

  it("streams bounded ordered World envelopes before the final response and strips tool details", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-phase12-stream-"));
    roots.push(root);
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
          toolStatus: true,
          approvals: false,
          interrupt: false,
          avatarProposal: false,
          skillsDisclosure: false,
        },
        unavailable: {
          approvals: "fixture",
          interrupt: "fixture",
          avatarProposal: "fixture",
          skillsDisclosure: "fixture",
        },
      }),
      listSessions: async () => [],
      attach: async (id) => ({ id, source: "fixture", title: "Fixture" }),
      sendText: async (_ref, _text, context) => {
        expect(context?.userDisplayName).toBe("Aaron");
        const onEvent = (
          context as never as {
            onEvent: (event: unknown) => Promise<void>;
          }
        ).onEvent;
        await onEvent({
          type: "assistant.delta",
          text: "live ",
          redaction: { applied: false, count: 0 },
        });
        await onEvent({
          type: "tool.started",
          toolName: "terminal",
          redaction: { applied: true, count: 2 },
        });
        await waiting;
        await onEvent({
          type: "assistant.delta",
          text: "reply",
          redaction: { applied: false, count: 0 },
        });
        return { finalText: "live reply", deltas: ["live ", "reply"] };
      },
    };
    const registry = new AdapterRegistry([adapter]);
    const gateway = new AgentSessionGateway({
      registry,
      store: new AgentSessionStore(path.join(root, ".state")),
    });
    const session = await gateway.attach({
      adapterId: "fixture",
      adapterSessionRef: "native",
      profile: "default",
      workspaceId: "ws_fixture",
      repositoryRef: "repo_fixture",
      mode: "explore",
    });
    const server = createLocalServer({
      agentSessionGateway: gateway,
      agentAdapterRegistry: registry,
    });
    await server.listen({ host: "127.0.0.1", port: 0 });
    try {
      const address = server.server.address();
      if (!address || typeof address === "string") throw new Error("address");
      const response = await fetch(
        `http://127.0.0.1:${address.port}/agent-sessions/${session.sessionId}/stream`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text: "hello",
            binding: session,
            context: { userDisplayName: "Aaron" },
          }),
        },
      );
      expect(response.headers.get("content-type")).toMatch(
        /^text\/event-stream/,
      );
      const reader = response.body?.getReader();
      if (!reader) throw new Error("missing stream");
      const decoder = new TextDecoder();
      let streamed = "";
      while (!streamed.includes("tool.started")) {
        const next = await reader.read();
        if (next.done) break;
        streamed += decoder.decode(next.value, { stream: true });
      }
      expect(streamed).toMatch(/message\.assistant-delta[\s\S]*tool\.started/);
      expect(streamed).toContain("live ");
      release();
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        streamed += decoder.decode(next.value, { stream: true });
      }
      streamed += decoder.decode();
      expect(streamed).toMatch(/world\.final[\s\S]*world\.done/);
      expect(streamed).toContain("live reply");
      expect(streamed).not.toMatch(/args|preview|RAW_|authorization|Bearer/i);
    } finally {
      release();
      await server.close();
    }
  });

  it("aborts the upstream turn on browser disconnect and releases exact-session busy state", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-phase12-abort-"));
    roots.push(root);
    let attempt = 0;
    let sawAbort!: () => void;
    const aborted = new Promise<void>((resolve) => (sawAbort = resolve));
    const manifest = {
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
    } as const;
    const adapter: AgentAdapter = {
      id: "fixture",
      attest: async () => manifest,
      listSessions: async () => [],
      attach: async (id) => ({ id, source: "fixture", title: "Fixture" }),
      sendText: async (_ref, _text, context) => {
        attempt += 1;
        if (attempt > 1) return { finalText: "recovered", deltas: [] };
        return new Promise((_resolve, reject) => {
          context?.signal?.addEventListener(
            "abort",
            () => {
              sawAbort();
              reject(new GatewayError("upstream", "cancelled"));
            },
            { once: true },
          );
        });
      },
    };
    const registry = new AdapterRegistry([adapter]);
    const gateway = new AgentSessionGateway({
      registry,
      store: new AgentSessionStore(path.join(root, ".state")),
    });
    const session = await gateway.attach({
      adapterId: "fixture",
      adapterSessionRef: "native",
      profile: "default",
      workspaceId: "ws_fixture",
      repositoryRef: "repo_fixture",
      mode: "explore",
    });
    const server = createLocalServer({
      agentSessionGateway: gateway,
      agentAdapterRegistry: registry,
    });
    await server.listen({ host: "127.0.0.1", port: 0 });
    try {
      const address = server.server.address();
      if (!address || typeof address === "string") throw new Error("address");
      const controller = new AbortController();
      const response = await fetch(
        `http://127.0.0.1:${address.port}/agent-sessions/${session.sessionId}/stream`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: "disconnect", binding: session }),
          signal: controller.signal,
        },
      );
      expect(response.headers.get("content-type")).toMatch(
        /^text\/event-stream/,
      );
      controller.abort();
      await aborted;
      await new Promise<void>((resolve) => setImmediate(resolve));
      await expect(
        gateway.sendText(session.sessionId, {
          text: "after disconnect",
          binding: session,
        }),
      ).resolves.toMatchObject({ finalText: "recovered" });
    } finally {
      await server.close();
    }
  });
});
