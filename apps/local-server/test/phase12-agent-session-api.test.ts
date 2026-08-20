import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

import {
  AdapterRegistry,
  AgentSessionGateway,
  AgentSessionStore,
  type AgentAdapter,
} from "../src/agent-sessions.js";
import { PHASE19_ADAPTER_IDS } from "@agentintersect-world/agent-session-protocol";
import { createLocalServer } from "../src/server.js";
import { registerAgentSessionRoutes } from "../src/agent-session-routes.js";

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
  it("publishes stable readiness and strict World-owned create/end with truthful transcript authority", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-phase19-api-"));
    roots.push(root);
    let ended = false;
    const adapter: AgentAdapter = {
      id: "codex",
      attest: async () => ({
        ...(await fixture().registry.require("fixture").attest()),
        adapterId: "codex",
        shutdownOwner: "world",
      }),
      listSessions: async () => [],
      createWorldSession: async () => ({
        id: "codex-native",
        rootId: "codex-native",
        source: "codex",
        title: "Codex",
      }),
      attach: async (id, context) => {
        if (context?.worldInstanceId !== "world-one")
          throw new Error("wrong World");
        return { id, rootId: id, source: "codex", title: "Codex" };
      },
      sendText: async (_ref, text) => ({
        finalText: `reply: ${text}`,
        deltas: [],
      }),
      endWorldSession: async () => {
        ended = true;
      },
    };
    const registry = new AdapterRegistry([adapter], PHASE19_ADAPTER_IDS);
    const gateway = new AgentSessionGateway({
      registry,
      store: new AgentSessionStore(path.join(root, "state")),
    });
    const server = Fastify({ logger: false });
    registerAgentSessionRoutes(
      server,
      gateway,
      {},
      {
        success: (_request, data) => ({ ok: true, data }),
        failure: (_request, code, message) => ({
          ok: false,
          error: { code, message },
        }),
      },
    );

    const readiness = await server.inject({
      method: "GET",
      url: "/agent-sessions/readiness",
    });
    expect(readiness.statusCode).toBe(200);
    expect(
      readiness.json().data.map((row: { adapterId: string }) => row.adapterId),
    ).toEqual(PHASE19_ADAPTER_IDS);

    const rejectedExtra = await server.inject({
      method: "POST",
      url: "/agent-sessions/world",
      payload: {
        adapterId: "codex",
        worldInstanceId: "world-one",
        displayName: "Codex",
        profile: "default",
        workspaceId: "world-workspace",
        repositoryRef: "world-repository",
        mode: "explore",
        nativePath: "/SECRET_CANARY",
      },
    });
    expect(rejectedExtra.statusCode).toBe(400);

    const created = await server.inject({
      method: "POST",
      url: "/agent-sessions/world",
      payload: {
        adapterId: "codex",
        worldInstanceId: "world-one",
        displayName: "Codex",
        profile: "default",
        workspaceId: "world-workspace",
        repositoryRef: "world-repository",
        mode: "explore",
      },
    });
    expect(created.statusCode).toBe(201);
    const session = created.json().data;

    const history = await server.inject({
      method: "GET",
      url: `/agent-sessions/${session.sessionId}/history`,
    });
    expect(history.json().data.transcriptAuthority).toBe("world-projection");
    expect(JSON.stringify(history.json())).not.toMatch(
      /adapterSessionRef|nativePath|SECRET_CANARY/,
    );

    const endedResponse = await server.inject({
      method: "POST",
      url: `/agent-sessions/${session.sessionId}/world-end`,
      payload: { worldInstanceId: "world-one" },
    });
    expect(endedResponse.statusCode).toBe(200);
    expect(endedResponse.json().data).toMatchObject({ status: "closed" });
    expect(ended).toBe(true);
    await server.close();
  });

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
    expect(history.json().data.transcriptAuthority).toBe("world-projection");
    expect(JSON.stringify(history.json())).not.toMatch(/adapterSessionRef/);
    const workFocus = await server.inject({
      method: "GET",
      url: `/agent-sessions/${session.sessionId}/work-focus`,
    });
    expect(workFocus.statusCode).toBe(200);
    expect(workFocus.json().data).toEqual({ focus: null });
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
    expect(paths).toContain("/agent-sessions/{sessionId}/work-focus");
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

  it("aborts a disconnected browser turn so the exact session can retry", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-phase12-abort-"));
    roots.push(root);
    let attempt = 0;
    let release!: () => void;
    let firstStarted!: () => void;
    let upstreamAborted = false;
    const started = new Promise<void>((resolve) => (firstStarted = resolve));
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
        firstStarted();
        await new Promise<void>((resolve, reject) => {
          release = resolve;
          context?.signal?.addEventListener(
            "abort",
            () => {
              upstreamAborted = true;
              reject(new Error("cancelled"));
            },
            { once: true },
          );
        });
        const onEvent = (
          context as {
            onEvent?: (event: {
              type: "assistant.delta";
              text: string;
              redaction: { applied: boolean; count: number };
            }) => Promise<void>;
          }
        ).onEvent;
        await onEvent?.({
          type: "assistant.delta",
          text: "canonical ",
          redaction: { applied: false, count: 0 },
        });
        return {
          finalText: "canonical detached reply",
          deltas: ["canonical "],
        };
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
      const origin = `http://127.0.0.1:${address.port}`;
      const controller = new AbortController();
      const response = await fetch(
        `${origin}/agent-sessions/${session.sessionId}/stream`,
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
      await started;
      const bodyDone = response.text().catch(() => "");
      controller.abort();
      await vi.waitFor(() => {
        expect(upstreamAborted).toBe(true);
      });
      await bodyDone;
      await expect(
        gateway.sendText(session.sessionId, {
          text: "after completion",
          binding: session,
        }),
      ).resolves.toMatchObject({ finalText: "recovered" });
      expect(gateway.history(session.sessionId)).toEqual([
        expect.objectContaining({ role: "user", text: "disconnect" }),
        expect.objectContaining({ role: "user", text: "after completion" }),
        expect.objectContaining({ role: "assistant", text: "recovered" }),
      ]);
    } finally {
      release();
      await server.close();
    }
  });
});
