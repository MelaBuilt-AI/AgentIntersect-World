import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  PHASE19_ADAPTER_IDS,
  type AgentCapabilityManifest,
  type Phase19AdapterId,
} from "@agentintersect-world/agent-session-protocol";
import { afterEach, describe, expect, it } from "vitest";

import {
  AdapterRegistry,
  AgentSessionGateway,
  AgentSessionStore,
  GatewayError,
  type AdapterSessionSummary,
  type AgentAdapter,
  type AdapterTurnContext,
  type WorldOwnedSessionContext,
} from "../src/agent-sessions.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});

function manifest(
  adapterId: Phase19AdapterId,
  shutdownOwner: "hermes" | "world",
): AgentCapabilityManifest {
  return {
    schema: "aiw.agent-capabilities/0.12",
    adapterId,
    adapterVersion: `0.19.0-${adapterId}`,
    transport: "loopback-http-sse",
    origin: "local",
    auth: "server-bearer",
    supportedModes: ["explore", "collaborate"],
    ordering: "per-session-strict",
    resume: "session-api",
    shutdownOwner,
    maxInputBytes: 16_384,
    maxEventBytes: 32_768,
    capabilities: {
      attach: true,
      sendText: true,
      streamDeltas: true,
      toolStatus: true,
      approvals: false,
      interrupt: false,
      avatarProposal: false,
      skillsDisclosure: false,
      worldActions: false,
    },
    unavailable: {
      approvals: "Native approval surface only.",
      interrupt: "No completed run remains interruptible.",
      avatarProposal: "No adapter avatar proposal.",
      skillsDisclosure: "No skills disclosure.",
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
      unavailableReason: "World Actions are unavailable in the fixture.",
    },
  };
}

class ConformanceAdapter implements AgentAdapter {
  readonly bindings = new Map<
    string,
    { readonly worldInstanceId: string; ended: boolean }
  >();
  readonly sentSessionRefs: string[] = [];
  readonly endedSessionRefs: string[] = [];
  createCount = 0;

  constructor(
    readonly id: Phase19AdapterId,
    readonly ownership: "hermes" | "world",
  ) {}

  async attest(): Promise<AgentCapabilityManifest> {
    return manifest(this.id, this.ownership);
  }

  async listSessions(): Promise<readonly AdapterSessionSummary[]> {
    if (this.ownership === "hermes")
      return [
        {
          id: "hermes-native-root",
          rootId: "hermes-native-root",
          source: "hermes",
          title: "Mr Fluff",
        },
      ];
    return [...this.bindings]
      .filter(([, binding]) => !binding.ended)
      .map(([id]) => ({ id, rootId: id, source: this.id, title: this.id }));
  }

  async createWorldSession(
    worldInstanceId: string,
  ): Promise<AdapterSessionSummary> {
    if (this.ownership !== "world")
      throw new GatewayError("unsupported", "Operator identity is persistent");
    this.createCount += 1;
    const id = `${this.id}-native-${this.createCount}`;
    this.bindings.set(id, { worldInstanceId, ended: false });
    return { id, rootId: id, source: this.id, title: this.id };
  }

  async attach(
    sessionRef: string,
    context?: WorldOwnedSessionContext,
  ): Promise<AdapterSessionSummary> {
    if (this.ownership === "hermes") {
      if (sessionRef !== "hermes-native-root")
        throw new GatewayError("not_found", "Hermes session unavailable");
      return {
        id: sessionRef,
        rootId: sessionRef,
        source: "hermes",
        title: "Mr Fluff",
      };
    }
    const binding = this.bindings.get(sessionRef);
    if (
      !binding ||
      binding.ended ||
      binding.worldInstanceId !== context?.worldInstanceId
    )
      throw new GatewayError(
        "conflict",
        "World session does not own this native identity",
      );
    return {
      id: sessionRef,
      rootId: sessionRef,
      source: this.id,
      title: this.id,
    };
  }

  async sendText(
    sessionRef: string,
    text: string,
    context?: AdapterTurnContext,
  ) {
    this.sentSessionRefs.push(sessionRef);
    await context?.onEvent?.({
      type: "assistant.delta",
      text: "bounded ",
      redaction: { applied: false, count: 0 },
    });
    await context?.onEvent?.({
      type: "assistant.delta",
      text: "reply",
      redaction: { applied: false, count: 0 },
    });
    return {
      finalText: `reply:${text}`,
      deltas: ["bounded ", "reply"],
      sessionRef,
    };
  }

  async endWorldSession(
    worldInstanceId: string,
    rootSessionRef: string,
  ): Promise<void> {
    if (this.ownership !== "world")
      throw new GatewayError("unsupported", "Operator identity is persistent");
    const binding = this.bindings.get(rootSessionRef);
    if (!binding || binding.worldInstanceId !== worldInstanceId)
      throw new GatewayError("conflict", "World ownership does not match");
    if (binding.ended) return;
    binding.ended = true;
    this.endedSessionRefs.push(rootSessionRef);
  }
}

function gateway(adapters: readonly AgentAdapter[]) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "aiw-phase19-conformance-"),
  );
  roots.push(root);
  const registry = new AdapterRegistry(adapters, PHASE19_ADAPTER_IDS);
  return {
    registry,
    gateway: new AgentSessionGateway({
      registry,
      store: new AgentSessionStore(path.join(root, "state")),
    }),
  };
}

const worldProfiles = ["openclaw", "codex", "claude-code"] as const;

describe("Phase 19 four-adapter conformance", () => {
  it("ends only the newly created native identity when connection cancellation arrives late", async () => {
    const adapter = new ConformanceAdapter("codex", "world");
    const state = gateway([adapter]);
    const request = {
      adapterId: "codex" as const,
      worldInstanceId: "world-one",
      displayName: "Codex",
      profile: "default",
      workspaceId: "world-workspace",
      repositoryRef: "world-repository",
      mode: "explore" as const,
    };
    const existing = await state.gateway.createWorldSession(request);
    const controller = new AbortController();
    const create = adapter.createWorldSession.bind(adapter);
    const port: AgentAdapter = adapter;
    port.createWorldSession = async (worldInstanceId, _name, signal) => {
      expect(signal).toBe(controller.signal);
      const created = await create(worldInstanceId);
      controller.abort();
      return created;
    };
    await expect(
      state.gateway.createWorldSession(request, controller.signal),
    ).rejects.toMatchObject({ code: "upstream" });
    expect(adapter.endedSessionRefs).toEqual(["codex-native-2"]);
    expect(adapter.bindings.get("codex-native-1")?.ended).toBe(false);
    expect(state.gateway.status(existing.sessionId).status).toBe("ready");
  });

  it("keeps four sanitized stable slots while an absent, offline, or mismatched adapter cannot suppress healthy peers", async () => {
    const hermes = new ConformanceAdapter("hermes", "hermes");
    const offline = new ConformanceAdapter("openclaw", "world");
    offline.attest = async () => {
      throw new Error("SECRET_CANARY /native/private/path");
    };
    const mismatched = new ConformanceAdapter("codex", "world");
    mismatched.attest = async () => manifest("claude-code", "world");
    const state = gateway([hermes, offline, mismatched]);

    await expect(state.registry.capabilities()).resolves.toEqual([
      expect.objectContaining({ adapterId: "hermes" }),
    ]);
    const readiness = await state.registry.readiness();
    expect(readiness.map((row) => row.adapterId)).toEqual(PHASE19_ADAPTER_IDS);
    expect(readiness).toEqual([
      { adapterId: "hermes", enabled: true, reason: "runtime-attested" },
      {
        adapterId: "openclaw",
        enabled: false,
        reason: "attestation-unavailable",
      },
      {
        adapterId: "codex",
        enabled: false,
        reason: "attestation-unavailable",
      },
      {
        adapterId: "claude-code",
        enabled: false,
        reason: "attestation-unavailable",
      },
    ]);
    expect(JSON.stringify(readiness)).not.toMatch(
      /SECRET_CANARY|native\/private/,
    );
  });

  it("keeps Hermes operator-persistent and rejects World create/end", async () => {
    const hermes = new ConformanceAdapter("hermes", "hermes");
    const state = gateway([hermes]);
    const session = await state.gateway.attach({
      adapterId: "hermes",
      adapterSessionRef: "hermes-native-root",
      profile: "default",
      workspaceId: "world-workspace",
      repositoryRef: "world-repository",
      mode: "explore",
    });

    await expect(
      state.gateway.createWorldSession({
        adapterId: "hermes",
        worldInstanceId: "world-one",
        displayName: "Mr Fluff",
        profile: "default",
        workspaceId: "world-workspace",
        repositoryRef: "world-repository",
        mode: "explore",
      }),
    ).rejects.toMatchObject({ code: "unsupported" });
    await expect(
      state.gateway.endWorldSession(session.sessionId, "world-one"),
    ).rejects.toMatchObject({ code: "unsupported" });
  });

  it.each(worldProfiles)(
    "%s creates and attaches atomically, preserves one native identity through a turn/reconnect, and ends only its exact owner",
    async (adapterId) => {
      const adapter = new ConformanceAdapter(adapterId, "world");
      const state = gateway([adapter]);
      const created = await state.gateway.createWorldSession({
        adapterId,
        worldInstanceId: "world-one",
        displayName: `World ${adapterId}`,
        profile: "default",
        workspaceId: "world-workspace",
        repositoryRef: "world-repository",
        mode: "explore",
      });
      expect(state.gateway.status(created.sessionId)).toMatchObject({
        status: "ready",
        continuity: "current",
        adapterId,
      });

      const streamed: string[] = [];
      await expect(
        state.gateway.sendText(
          created.sessionId,
          { text: "hello", binding: created },
          {
            onEvent: (event) => {
              if (event.type === "message.assistant-delta")
                streamed.push(String(event.payload.text));
            },
          },
        ),
      ).resolves.toMatchObject({
        finalText: "reply:hello",
        deltas: ["bounded ", "reply"],
      });
      expect(streamed).toEqual(["bounded ", "reply"]);
      expect(adapter.sentSessionRefs).toEqual([created.adapterSessionRef]);

      const reconnected = await state.gateway.attach({
        adapterId,
        adapterSessionRef:
          created.adapterRootSessionRef ?? created.adapterSessionRef,
        profile: "default",
        workspaceId: "world-workspace",
        repositoryRef: "world-repository",
        mode: "explore",
        worldInstanceId: "world-one",
      });
      expect(reconnected.sessionId).toBe(created.sessionId);
      expect(reconnected.adapterSessionRef).toBe(created.adapterSessionRef);

      await expect(
        state.gateway.endWorldSession(created.sessionId, "wrong-world"),
      ).rejects.toMatchObject({ code: "conflict" });
      await expect(
        state.gateway.endWorldSession(created.sessionId, "world-one"),
      ).resolves.toMatchObject({ status: "closed" });
      await expect(
        state.gateway.endWorldSession(created.sessionId, "world-one"),
      ).resolves.toMatchObject({ status: "closed" });
      expect(adapter.endedSessionRefs).toEqual([created.adapterSessionRef]);

      const later = await state.gateway.createWorldSession({
        adapterId,
        worldInstanceId: "world-two",
        displayName: `Later ${adapterId}`,
        profile: "default",
        workspaceId: "world-workspace",
        repositoryRef: "world-repository",
        mode: "explore",
      });
      expect(later.adapterSessionRef).not.toBe(created.adapterSessionRef);
    },
  );

  it("cleans up only the exact newly created native identity when atomic attach fails", async () => {
    const adapter = new ConformanceAdapter("codex", "world");
    adapter.attach = async () => {
      throw new GatewayError("upstream", "SECRET_CANARY attach detail");
    };
    const state = gateway([adapter]);

    await expect(
      state.gateway.createWorldSession({
        adapterId: "codex",
        worldInstanceId: "world-one",
        displayName: "Codex",
        profile: "default",
        workspaceId: "world-workspace",
        repositoryRef: "world-repository",
        mode: "explore",
      }),
    ).rejects.toMatchObject({
      code: "upstream",
      message: "World session creation failed",
    });
    expect(adapter.endedSessionRefs).toEqual(["codex-native-1"]);
    expect(state.gateway.store.load().sessions).toEqual([]);
  });
});
