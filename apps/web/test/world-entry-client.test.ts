import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import * as clientModule from "../src/world-entry/world-entry-client.js";
import { resolveWorldEntryRestore } from "../src/world-entry/world-entry-restore.js";
import { createModularImportedAvatarSource } from "@agentintersect-world/avatar-system/imported-avatar";
import {
  AdapterRegistry,
  AgentSessionGateway,
  AgentSessionStore,
  readPluginAvatarProposal,
  type AgentAdapter,
} from "../../local-server/src/agent-sessions.js";
import { createLocalServer } from "../../local-server/src/server.js";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

type ClientApi = {
  readonly prepareWorldUserContext: (displayName: string) => {
    readonly userDisplayName: string;
  };
  readonly resolveHermesDisplayName: (
    enteredName: string,
    sessions: readonly {
      readonly id: string;
      readonly title: string;
      readonly source: string;
      readonly displayName?: string;
    }[],
  ) =>
    | { readonly status: "matched"; readonly nativeSessionId: string }
    | { readonly status: "not_found"; readonly message: "agent not found_" };
  readonly createWorldEntryClient: (
    ports: Readonly<Record<string, unknown>>,
  ) => {
    readonly restoreHermes: (
      sessionId: string,
    ) => Promise<Readonly<Record<string, unknown>>>;
    readonly connectHermes: (
      name: string,
    ) => Promise<Readonly<Record<string, unknown>>>;
    readonly acceptAgentAvatar: (
      session: Readonly<Record<string, unknown>>,
      proposal: Readonly<Record<string, unknown>>,
    ) => Promise<boolean>;
    readonly sendExactSession: (
      session: Readonly<Record<string, unknown>>,
      text: string,
      options?: {
        readonly userDisplayName: string;
      },
    ) => Promise<Readonly<Record<string, unknown>>>;
    readonly loadRepository: (
      rootPath: string,
    ) => Promise<Readonly<Record<string, unknown>>>;
  };
};

const api = clientModule as unknown as Partial<ClientApi>;

const worldSession = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  schema: "aiw.agent-session/0.12",
  sessionId: "11111111-1111-4111-8111-111111111111",
  adapterId: "hermes",
  adapterSessionRef: "native-1",
  profile: "default",
  workspaceId: "world-entry",
  repositoryRef: "current",
  mode: "explore",
  permissionRevision: 0,
  capabilitySnapshotHash: "a".repeat(64),
  continuity: "current",
  status: "ready",
  ...overrides,
});

describe("Phase 18 World entry client composition", () => {
  it("provides the bounded World-owned Hermes and repository composition", () => {
    expect(typeof api.resolveHermesDisplayName).toBe("function");
    expect(typeof api.createWorldEntryClient).toBe("function");
  });

  it("requires exactly one normalized safe display-label match", () => {
    if (!api.resolveHermesDisplayName) return;
    const sessions = [
      { id: "opaque-a", title: "Mr Fluff", source: "cli" },
      { id: "opaque-b", title: "Beans", source: "discord" },
    ];
    expect(api.resolveHermesDisplayName("  mr fluff ", sessions)).toEqual({
      status: "matched",
      nativeSessionId: "opaque-a",
    });
    expect(api.resolveHermesDisplayName("Missing", sessions)).toEqual({
      status: "not_found",
      message: "agent not found_",
    });
    expect(
      api.resolveHermesDisplayName("Mr Fluff", [
        ...sessions,
        { id: "opaque-c", title: "MR FLUFF", source: "discord" },
      ]),
    ).toEqual({
      status: "not_found",
      message: "agent not found_",
    });
  });

  it("resolves a configured agent identity without rewriting the native session title", () => {
    if (!api.resolveHermesDisplayName) return;
    const sessions = [
      {
        id: "exact-current-session",
        title: "AgentIntersect Handoff Status #5",
        source: "discord",
        displayName: "Mr Fluff",
      },
    ];
    expect(api.resolveHermesDisplayName(" mr fluff ", sessions)).toEqual({
      status: "matched",
      nativeSessionId: "exact-current-session",
    });
    expect(sessions[0]?.title).toBe("AgentIntersect Handoff Status #5");
  });

  it("derives bounded agent addressing context from each selected avatar name", () => {
    expect(typeof api.prepareWorldUserContext).toBe("function");
    if (!api.prepareWorldUserContext) return;
    expect(api.prepareWorldUserContext(" Aaron ")).toEqual({
      userDisplayName: "Aaron",
    });
    expect(api.prepareWorldUserContext("Riley")).toEqual({
      userDisplayName: "Riley",
    });
  });

  it("distinguishes unavailable, stale, current, and recovered attachment truth", async () => {
    if (!api.createWorldEntryClient) return;
    const basePort = {
      capabilities: vi.fn().mockResolvedValue([
        {
          adapterId: "hermes",
          capabilities: { attach: true, sendText: true },
          unavailable: {},
        },
      ]),
      nativeSessions: vi
        .fn()
        .mockResolvedValue([
          { id: "native-1", title: "Mr Fluff", source: "cli" },
        ]),
      attach: vi.fn().mockResolvedValue(worldSession()),
      avatarProposal: vi.fn().mockResolvedValue({
        proposalId: "avatar-proposal",
        sessionId: worldSession().sessionId,
        displayName: "Mr Fluff",
      }),
      history: vi.fn().mockResolvedValue({
        avatarConsent: null,
        messages: [],
        continuity: "current",
      }),
      avatarConsent: vi.fn(),
      stream: vi.fn(),
    };
    const connected = await api
      .createWorldEntryClient({ sessionClient: basePort })
      .connectHermes("Mr Fluff");
    expect(connected).toMatchObject({
      status: "connected",
      continuity: "current",
      avatarAccepted: false,
      avatarSetup: "required",
    });
    expect(basePort.attach).toHaveBeenCalledWith({
      adapterId: "hermes",
      adapterSessionRef: "native-1",
      profile: "default",
      workspaceId: "world-entry",
      repositoryRef: "current",
      mode: "explore",
    });

    const recoveredPort = {
      ...basePort,
      attach: vi
        .fn()
        .mockResolvedValue(worldSession({ continuity: "previous-recovered" })),
    };
    await expect(
      api
        .createWorldEntryClient({ sessionClient: recoveredPort })
        .connectHermes("Mr Fluff"),
    ).resolves.toMatchObject({
      status: "recovered",
      continuity: "previous-recovered",
    });

    const stalePort = {
      ...basePort,
      attach: vi.fn().mockResolvedValue(worldSession({ status: "stale" })),
    };
    await expect(
      api
        .createWorldEntryClient({ sessionClient: stalePort })
        .connectHermes("Mr Fluff"),
    ).resolves.toEqual({
      status: "stale",
      message: "agent unavailable_",
    });

    const unavailablePort = {
      ...basePort,
      capabilities: vi.fn().mockRejectedValue(new Error("private detail")),
    };
    await expect(
      api
        .createWorldEntryClient({ sessionClient: unavailablePort })
        .connectHermes("Mr Fluff"),
    ).resolves.toEqual({
      status: "unavailable",
      message: "agent unavailable_",
    });
  });

  it("fails closed when the exact-session avatar proposal is unavailable and history has no accepted consent", async () => {
    if (!api.createWorldEntryClient) return;
    const session = worldSession({
      adapterSessionRef: "retained-child-session",
      adapterRootSessionRef: "retained-root-session",
      avatarProfileRef: null,
    });
    const sessionClient = {
      capabilities: vi.fn().mockResolvedValue([
        {
          adapterId: "hermes",
          capabilities: { attach: true, sendText: true },
          unavailable: {},
        },
      ]),
      nativeSessions: vi.fn().mockResolvedValue([
        {
          id: "retained-root-session",
          title: "Current Hermes lane",
          source: "discord",
          displayName: "Mr Fluff",
        },
      ]),
      attach: vi.fn().mockResolvedValue(session),
      avatarProposal: vi
        .fn()
        .mockRejectedValue(
          new Error("Plugin avatar proposal native session does not match"),
        ),
      history: vi.fn().mockResolvedValue({
        sessionId: session.sessionId,
        continuity: "current",
        messages: [],
        transcriptAuthority: "hermes",
        avatarConsent: null,
      }),
      avatarConsent: vi.fn(),
      stream: vi.fn(),
    };

    await expect(
      api.createWorldEntryClient({ sessionClient }).connectHermes("Mr Fluff"),
    ).resolves.toEqual({
      status: "unavailable",
      message: "agent unavailable_",
    });
    expect(sessionClient.avatarConsent).not.toHaveBeenCalled();
  });

  it("restores an accepted avatar from authoritative history after native-session rotation", async () => {
    if (!api.createWorldEntryClient) return;
    const session = worldSession({
      adapterSessionRef: "rotated-child-session",
      adapterRootSessionRef: "pinned-root-session",
    });
    const acceptedProposal = {
      schema: "aiw.avatar-proposal/0.12",
      proposalId: "accepted-avatar-proposal",
      sessionId: session.sessionId,
      displayName: "Hermes",
      species: "cat",
      head: "cat",
      hands: "paws",
      feet: "paws",
      fur: "short",
      tail: "cat",
      markings: "solid",
      bodyColor: "charcoal",
      shirt: "Hermes",
      movementStyle: "shared-biped-core",
      sourceDisclosure: "Stored World consent",
      rationale: "Previously accepted by the operator",
      createdAt: "2026-07-28T15:45:02.602Z",
    };
    const sessionClient = {
      capabilities: vi.fn().mockResolvedValue([
        {
          adapterId: "hermes",
          capabilities: { attach: true, sendText: true },
          unavailable: {},
        },
      ]),
      nativeSessions: vi.fn().mockResolvedValue([
        {
          id: "pinned-root-session",
          title: "AgentIntersect Handoff Status #5",
          source: "discord",
          displayName: "Mr Fluff",
        },
      ]),
      attach: vi.fn().mockResolvedValue(session),
      avatarProposal: vi
        .fn()
        .mockRejectedValue(new Error("native session does not match")),
      history: vi.fn().mockResolvedValue({
        sessionId: session.sessionId,
        continuity: "current",
        messages: [],
        transcriptAuthority: "hermes",
        avatarConsent: {
          state: "accepted",
          current: acceptedProposal,
          previous: null,
        },
      }),
      avatarConsent: vi.fn(),
      stream: vi.fn(),
    };

    const history = await sessionClient.history();
    await expect(
      api.createWorldEntryClient({ sessionClient }).connectHermes("Mr Fluff"),
    ).resolves.toMatchObject({
      status: "connected",
      continuity: "current",
      proposal: acceptedProposal,
      avatarAccepted: true,
      avatarSetup: "legacy-migration",
      history,
    });
  });

  it("restores only accepted original agent avatars as complete", async () => {
    if (!api.createWorldEntryClient) return;
    const session = worldSession({
      adapterSessionRef: "rotated-child-session",
      adapterRootSessionRef: "pinned-root-session",
    });
    const acceptedProposal = {
      schema: "aiw.avatar-proposal/0.12",
      proposalId: "accepted-imported-avatar",
      sessionId: session.sessionId,
      displayName: "Mr Fluff",
      species: "cat",
      head: "cat",
      hands: "paws",
      feet: "paws",
      fur: "short",
      tail: "cat",
      markings: "solid",
      bodyColor: "charcoal",
      shirt: "Hermes",
      movementStyle: "shared-biped-core",
      sourceDisclosure: "Stored World consent",
      rationale: "Explicitly selected by the operator",
      createdAt: "2026-07-28T15:45:02.602Z",
      avatarSource: {
        kind: "imported",
        version: 2,
        mode: "original",
        modelId: "robot-agent-01",
      },
    };
    const sessionClient = {
      capabilities: vi.fn().mockResolvedValue([
        {
          adapterId: "hermes",
          capabilities: { attach: true, sendText: true },
          unavailable: {},
        },
      ]),
      nativeSessions: vi.fn().mockResolvedValue([
        {
          id: "pinned-root-session",
          title: "Current Hermes lane",
          source: "cli",
          displayName: "Mr Fluff",
        },
      ]),
      attach: vi.fn().mockResolvedValue(session),
      avatarProposal: vi
        .fn()
        .mockRejectedValue(new Error("native session does not match")),
      history: vi.fn().mockResolvedValue({
        sessionId: session.sessionId,
        continuity: "current",
        messages: [],
        transcriptAuthority: "hermes",
        avatarConsent: {
          state: "accepted",
          current: acceptedProposal,
          previous: null,
        },
      }),
      avatarConsent: vi.fn(),
      stream: vi.fn(),
    };

    await expect(
      api.createWorldEntryClient({ sessionClient }).connectHermes("Mr Fluff"),
    ).resolves.toMatchObject({
      status: "connected",
      proposal: {
        proposalId: "accepted-imported-avatar",
        avatarSource: {
          kind: "imported",
          version: 2,
          mode: "original",
          modelId: "robot-agent-01",
        },
      },
      avatarAccepted: true,
      avatarSetup: "complete",
    });

    const modularProposal = {
      ...acceptedProposal,
      proposalId: "accepted-modular-avatar",
      avatarSource: createModularImportedAvatarSource("robot-agent-01"),
    };
    sessionClient.history.mockResolvedValue({
      sessionId: session.sessionId,
      continuity: "current",
      messages: [],
      transcriptAuthority: "hermes",
      avatarConsent: {
        state: "accepted",
        current: modularProposal,
        previous: null,
      },
    });
    await expect(
      api.createWorldEntryClient({ sessionClient }).connectHermes("Mr Fluff"),
    ).resolves.toMatchObject({
      status: "connected",
      proposal: {
        proposalId: "accepted-modular-avatar",
        avatarSource: modularProposal.avatarSource,
      },
      avatarAccepted: true,
      avatarSetup: "legacy-migration",
    });
  });

  it("restores the explicitly accepted exact-session avatar after World entry when the live proposal remains the base", async () => {
    if (!api.createWorldEntryClient) return;
    const session = worldSession({
      adapterSessionRef: "synthetic-child-session",
      adapterRootSessionRef: "synthetic-root-session",
    });
    const liveProposal = {
      schema: "aiw.avatar-proposal/0.12" as const,
      proposalId: "synthetic-avatar-proposal",
      sessionId: session.sessionId,
      displayName: "Synthetic Agent",
      species: "cat" as const,
      head: "cat" as const,
      hands: "paws" as const,
      feet: "paws" as const,
      fur: "short" as const,
      tail: "cat" as const,
      markings: "solid" as const,
      bodyColor: "charcoal",
      shirt: "Hermes" as const,
      movementStyle: "shared-biped-core" as const,
      sourceDisclosure: "Synthetic live proposal",
      rationale: "Synthetic regression input",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const acceptedProposal = {
      ...liveProposal,
      avatarSource: {
        kind: "imported" as const,
        version: 2 as const,
        mode: "original" as const,
        modelId: "robot-agent-01",
      },
    };
    let acceptedConsent: {
      readonly state: "accepted";
      readonly current: typeof acceptedProposal;
      readonly previous: null;
    } | null = null;
    const sessionClient = {
      status: vi.fn().mockResolvedValue(session),
      nativeSessions: vi.fn().mockResolvedValue([
        {
          id: "synthetic-root-session",
          title: "Synthetic native session",
          source: "fixture",
        },
      ]),
      attach: vi.fn().mockResolvedValue(session),
      avatarProposal: vi.fn().mockResolvedValue(liveProposal),
      history: vi.fn().mockImplementation(async () => ({
        sessionId: session.sessionId,
        continuity: "current",
        messages: [],
        transcriptAuthority: "hermes" as const,
        avatarConsent: acceptedConsent,
      })),
      avatarConsent: vi.fn().mockImplementation(async () => {
        acceptedConsent = {
          state: "accepted",
          current: acceptedProposal,
          previous: null,
        };
        return { state: "accepted" };
      }),
      stream: vi.fn(),
    };
    const client = api.createWorldEntryClient({ sessionClient });

    await expect(
      client.acceptAgentAvatar(session, acceptedProposal),
    ).resolves.toBe(true);
    const restored = await client.restoreHermes(session.sessionId);

    expect(resolveWorldEntryRestore(restored)).toBe("world");
    expect(restored).toMatchObject({
      status: "connected",
      session,
      proposal: acceptedProposal,
      avatarAccepted: true,
      avatarSetup: "complete",
    });
  });

  it("restores the same accepted World session after a persisted Hermes text turn refreshes volatile proposal source fields", async () => {
    if (!api.createWorldEntryClient) return;
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "aiw-post-message-refresh-"),
    );
    const proposalPath = path.join(root, "avatar-proposal.json");
    const rootSessionRef = "synthetic-native-root";
    let effectiveSessionRef = "synthetic-native-effective-before";
    const writeProposalSource = (createdAt: string) => {
      fs.writeFileSync(
        proposalPath,
        `${JSON.stringify(
          {
            schema: "aiw.hermes-avatar-source/0.12",
            native_session_hash: createHash("sha256")
              .update(effectiveSessionRef)
              .digest("hex"),
            displayName: "Synthetic Agent",
            species: "cat",
            head: "cat",
            hands: "paws",
            feet: "paws",
            fur: "short",
            tail: "cat",
            markings: "solid",
            bodyColor: "charcoal",
            shirt: "Hermes",
            movementStyle: "shared-biped-core",
            sourceDisclosure: "Synthetic bounded proposal",
            rationale: "Synthetic regression input",
            createdAt,
          },
          null,
          2,
        )}\n`,
        { mode: 0o600 },
      );
      fs.chmodSync(proposalPath, 0o600);
    };
    writeProposalSource("2026-01-01T00:00:00.000Z");
    const adapter: AgentAdapter = {
      id: "hermes",
      attest: async () => ({
        schema: "aiw.agent-capabilities/0.12",
        adapterId: "hermes",
        adapterVersion: "synthetic",
        transport: "loopback-http-sse",
        origin: "local",
        auth: "server-bearer",
        supportedModes: ["explore"],
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
          avatarProposal: true,
          skillsDisclosure: false,
        },
        unavailable: {
          toolStatus: "Unavailable in synthetic regression.",
          approvals: "Unavailable in synthetic regression.",
          interrupt: "Unavailable in synthetic regression.",
          skillsDisclosure: "Unavailable in synthetic regression.",
        },
      }),
      listSessions: async () => [
        {
          id: rootSessionRef,
          source: "fixture",
          title: "Synthetic native session",
          displayName: "Synthetic Agent",
        },
      ],
      attach: async (sessionRef) => ({
        id: effectiveSessionRef,
        rootId: sessionRef,
        source: "fixture",
        title: "Synthetic native session",
        displayName: "Synthetic Agent",
      }),
      sendText: async () => {
        effectiveSessionRef = "synthetic-native-effective-after";
        writeProposalSource("2026-01-01T00:00:01.000Z");
        return {
          finalText: "Synthetic persisted reply",
          deltas: ["Synthetic persisted reply"],
          sessionRef: effectiveSessionRef,
        };
      },
    };
    const registry = new AdapterRegistry([adapter]);
    const gateway = new AgentSessionGateway({
      registry,
      store: new AgentSessionStore(path.join(root, "session-state")),
    });
    const server = createLocalServer({
      agentSessionGateway: gateway,
      agentAdapterRegistry: registry,
      avatarProposal: (sessionId) =>
        readPluginAvatarProposal(
          proposalPath,
          sessionId,
          gateway.status(sessionId).adapterSessionRef,
        ),
    });
    const request = async (
      method: "GET" | "POST",
      url: string,
      payload?: unknown,
    ) => {
      const response = await server.inject({ method, url, payload });
      expect(response.statusCode).toBeLessThan(400);
      return response.json().data;
    };
    const sessionClient = {
      capabilities: () => request("GET", "/agent-sessions/capabilities"),
      nativeSessions: (adapterId: string) =>
        request(
          "GET",
          `/agent-sessions/native?adapterId=${encodeURIComponent(adapterId)}`,
        ),
      status: (sessionId: string) =>
        request("GET", `/agent-sessions/${sessionId}/status`),
      attach: (input: unknown) =>
        request("POST", "/agent-sessions/attach", input),
      avatarProposal: (sessionId: string) =>
        request("GET", `/agent-sessions/${sessionId}/avatar-proposal`),
      history: (sessionId: string) =>
        request("GET", `/agent-sessions/${sessionId}/history`),
      avatarConsent: (
        sessionId: string,
        decision: "accepted",
        proposal: unknown,
      ) =>
        request("POST", `/agent-sessions/${sessionId}/avatar-consent`, {
          decision,
          proposal,
        }),
      stream: (session: unknown, text: string) =>
        request(
          "POST",
          `/agent-sessions/${(session as { sessionId: string }).sessionId}/messages`,
          { text, binding: session },
        ),
    };

    try {
      const client = api.createWorldEntryClient({ sessionClient });
      const connected = await client.connectHermes("Synthetic Agent");
      expect(connected).toMatchObject({
        status: "connected",
        avatarAccepted: false,
        avatarSetup: "required",
      });
      if (!("session" in connected) || !("proposal" in connected)) return;
      const acceptedProposal = {
        ...connected.proposal,
        avatarSource: {
          kind: "imported" as const,
          version: 2 as const,
          mode: "original" as const,
          modelId: "robot-agent-01",
        },
      };
      await expect(
        client.acceptAgentAvatar(connected.session, acceptedProposal),
      ).resolves.toBe(true);

      const beforeMessage = await client.restoreHermes(
        connected.session.sessionId as string,
      );
      expect(beforeMessage).toMatchObject({
        status: "connected",
        session: { sessionId: connected.session.sessionId },
        proposal: { proposalId: acceptedProposal.proposalId },
        avatarAccepted: true,
        avatarSetup: "complete",
        history: {
          sessionId: connected.session.sessionId,
          continuity: "current",
          transcriptAuthority: "hermes",
          avatarConsent: {
            state: "accepted",
            current: { proposalId: acceptedProposal.proposalId },
          },
        },
      });
      expect(resolveWorldEntryRestore(beforeMessage)).toBe("world");

      await client.sendExactSession(
        (beforeMessage as { session: Readonly<Record<string, unknown>> })
          .session,
        "Synthetic bounded turn",
        { userDisplayName: "Synthetic Operator" },
      );
      const afterMessage = await client.restoreHermes(
        connected.session.sessionId as string,
      );
      expect(resolveWorldEntryRestore(afterMessage)).toBe("world");
      expect(afterMessage).toMatchObject({
        session: { sessionId: connected.session.sessionId },
        proposal: { proposalId: acceptedProposal.proposalId },
        avatarAccepted: true,
        avatarSetup: "complete",
        history: {
          transcriptAuthority: "hermes",
          avatarConsent: {
            state: "accepted",
            current: { proposalId: acceptedProposal.proposalId },
          },
          messages: [
            { role: "user", text: "Synthetic bounded turn" },
            { role: "assistant", text: "Synthetic persisted reply" },
          ],
        },
      });
    } finally {
      await server.close();
      fs.rmSync(root, { recursive: true });
    }
  });

  it("keeps unavailable names truthful and never fabricates or attaches another identity", async () => {
    if (!api.createWorldEntryClient) return;
    const sessionClient = {
      capabilities: vi.fn().mockResolvedValue([
        {
          adapterId: "hermes",
          capabilities: { attach: true, sendText: true },
          unavailable: {},
        },
      ]),
      nativeSessions: vi.fn().mockResolvedValue([
        {
          id: "only-native-session",
          title: "Current Hermes lane",
          source: "cli",
          displayName: "Mr Fluff",
        },
      ]),
      attach: vi.fn(),
      avatarProposal: vi.fn(),
      history: vi.fn(),
      avatarConsent: vi.fn(),
      stream: vi.fn(),
    };

    await expect(
      api.createWorldEntryClient({ sessionClient }).connectHermes("Beans"),
    ).resolves.toEqual({
      status: "not_found",
      message: "agent not found_",
    });
    expect(sessionClient.attach).not.toHaveBeenCalled();
  });

  it("rejects a persisted ready session when the currently exposed native root has changed", async () => {
    if (!api.createWorldEntryClient) return;
    const session = worldSession({
      adapterSessionRef: "old-effective-session",
      adapterRootSessionRef: "old-pinned-root",
    });
    const sessionClient = {
      status: vi.fn().mockResolvedValue(session),
      nativeSessions: vi.fn().mockResolvedValue([
        {
          id: "new-pinned-root",
          title: "Current Hermes lane",
          source: "cli",
          displayName: "Mr Fluff",
        },
      ]),
      attach: vi.fn(),
      avatarProposal: vi.fn().mockResolvedValue(null),
      history: vi.fn().mockResolvedValue({
        sessionId: session.sessionId,
        continuity: "current",
        messages: [],
        transcriptAuthority: "hermes",
        avatarConsent: null,
      }),
    };

    await expect(
      api
        .createWorldEntryClient({ sessionClient })
        .restoreHermes(session.sessionId),
    ).resolves.toEqual({
      status: "stale",
      message: "agent unavailable_",
    });
    expect(sessionClient.nativeSessions).toHaveBeenCalledWith("hermes");
    expect(sessionClient.attach).not.toHaveBeenCalled();
    expect(sessionClient.avatarProposal).not.toHaveBeenCalled();
    expect(sessionClient.history).not.toHaveBeenCalled();
  });

  it("returns authoritative transcript history with a restored ready exact session", async () => {
    if (!api.createWorldEntryClient) return;
    const session = worldSession();
    const acceptedProposal = {
      schema: "aiw.avatar-proposal/0.12",
      proposalId: "accepted-avatar-proposal",
      sessionId: session.sessionId,
      displayName: "Mr Fluff",
      species: "cat",
      head: "cat",
      hands: "paws",
      feet: "paws",
      fur: "short",
      tail: "cat",
      markings: "tuxedo",
      bodyColor: "charcoal",
      shirt: "Hermes",
      movementStyle: "shared-biped-core",
      sourceDisclosure: "Stored World consent",
      rationale: "Previously accepted by the operator",
      createdAt: "2026-07-28T15:45:02.602Z",
    };
    const history = {
      sessionId: session.sessionId,
      continuity: "current",
      messages: [
        { role: "user", text: "Are you live?" },
        { role: "assistant", text: "Yes, in the exact session." },
      ],
      transcriptAuthority: "hermes",
      avatarConsent: {
        state: "accepted",
        current: acceptedProposal,
        previous: null,
      },
    };
    const sessionClient = {
      status: vi.fn().mockResolvedValue(session),
      nativeSessions: vi.fn().mockResolvedValue([
        {
          id: "native-1",
          title: "Mr Fluff",
          source: "cli",
        },
      ]),
      attach: vi.fn().mockResolvedValue(session),
      avatarProposal: vi
        .fn()
        .mockRejectedValue(new Error("409 current proposal unavailable")),
      history: vi.fn().mockResolvedValue(history),
    };

    await expect(
      api
        .createWorldEntryClient({ sessionClient })
        .restoreHermes(session.sessionId),
    ).resolves.toMatchObject({
      status: "connected",
      session,
      proposal: acceptedProposal,
      avatarAccepted: true,
      history,
    });
    expect(sessionClient.avatarProposal).toHaveBeenCalledWith(
      session.sessionId,
    );
    expect(sessionClient.attach).toHaveBeenCalledWith({
      adapterId: "hermes",
      adapterSessionRef: "native-1",
      profile: "default",
      workspaceId: "world-entry",
      repositoryRef: "current",
      mode: "explore",
    });
  });

  it("binds deliberate avatar acceptance and chat to the exact attached session", async () => {
    if (!api.createWorldEntryClient) return;
    const sessionClient = {
      capabilities: vi.fn(),
      nativeSessions: vi.fn(),
      attach: vi.fn(),
      avatarProposal: vi.fn(),
      history: vi.fn(),
      avatarConsent: vi.fn().mockResolvedValue({ state: "accepted" }),
      stream: vi.fn().mockResolvedValue({
        finalText: "Repository request understood.",
        deltas: ["Repository ", "request understood."],
      }),
    };
    const client = api.createWorldEntryClient({ sessionClient });
    const session = worldSession();
    const proposal = {
      proposalId: "avatar-proposal",
      sessionId: session.sessionId,
      displayName: "Mr Fluff",
    };
    await expect(client.acceptAgentAvatar(session, proposal)).resolves.toBe(
      true,
    );
    expect(sessionClient.avatarConsent).toHaveBeenCalledWith(
      session.sessionId,
      "accepted",
      proposal,
    );
    for (const userDisplayName of ["Aaron", "Riley"]) {
      await expect(
        client.sendExactSession(session, "Load this repository", {
          userDisplayName,
        }),
      ).resolves.toMatchObject({
        finalText: "Repository request understood.",
      });
      expect(sessionClient.stream).toHaveBeenLastCalledWith(
        session,
        "Load this repository",
        expect.objectContaining({ userDisplayName }),
      );
    }
  });

  it("preserves blank-floor truth on failed indexing and returns a current projection on success", async () => {
    if (!api.createWorldEntryClient) return;
    const operation = {
      id: "index-operation",
      status: "succeeded",
      generationId: "generation-current",
      generation: { id: "repository-generation-current" },
    };
    const snapshot = {
      schema: "aiw.world-snapshot/0.3",
      repositoryRef: "aiw://object/repository-current",
      generationFingerprint: "generation-current",
      objects: [],
    };
    const client = api.createWorldEntryClient({
      sessionClient: {},
      startRepositoryIndex: vi
        .fn()
        .mockResolvedValue({ status: "ok", data: operation }),
      getRepositoryIndex: vi.fn().mockResolvedValue({
        status: "ok",
        data: operation,
      }),
      getCurrentWorld: vi
        .fn()
        .mockResolvedValue({ status: "ok", data: { snapshot } }),
    });
    await expect(
      client.loadRepository("/tmp/approved-repository"),
    ).resolves.toEqual({
      status: "current",
      generationId: "generation-current",
      snapshot,
      repository: {
        repositoryId: "aiw://object/repository-current",
        revision: "repository-generation-current",
      },
    });

    const failed = api.createWorldEntryClient({
      sessionClient: {},
      startRepositoryIndex: vi.fn().mockResolvedValue({
        status: "error",
        message: "private path detail",
      }),
    });
    await expect(
      failed.loadRepository("/tmp/approved-repository"),
    ).resolves.toEqual({
      status: "failed",
      message: "repository unavailable_",
    });
  });
});
