import * as clientModule from "../src/world-entry/world-entry-client.js";
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
    }[],
  ) =>
    | { readonly status: "matched"; readonly nativeSessionId: string }
    | { readonly status: "not_found"; readonly message: "agent not found_" };
  readonly createWorldEntryClient: (
    ports: Readonly<Record<string, unknown>>,
  ) => {
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
    };
    const snapshot = {
      schema: "aiw.world-snapshot/0.3",
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
