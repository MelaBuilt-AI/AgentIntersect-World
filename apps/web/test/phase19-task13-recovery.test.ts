import { describe, expect, it, vi } from "vitest";

import type {
  AvatarProposal,
  ConstellationState,
} from "../src/sessions/session-client.js";
import {
  createWorldEntryClient,
  type HermesConnectionResult,
} from "../src/world-entry/world-entry-client.js";
import * as restoreModule from "../src/world-entry/world-entry-restore.js";

const acceptedResult = (
  sessionId: string,
  adapterId: "hermes" | "openclaw" | "codex" | "claude-code",
  displayName: string,
  continuity: "current" | "previous-recovered" = "current",
): HermesConnectionResult => {
  const proposal: AvatarProposal = {
    schema: "aiw.avatar-proposal/0.12" as const,
    proposalId: `avatar-${adapterId}`,
    sessionId,
    displayName,
    species: "human" as const,
    head: "round" as const,
    hands: "hands" as const,
    feet: "feet" as const,
    fur: "none" as const,
    tail: "none" as const,
    markings: "solid" as const,
    bodyColor: "warm-light",
    shirt: adapterId === "codex" ? ("Codex" as const) : ("World" as const),
    movementStyle: "shared-biped-core" as const,
    avatarSource: {
      kind: "imported" as const,
      version: 2 as const,
      mode: "original" as const,
      modelId: "robot-agent-01",
    },
    sourceDisclosure: "manual-local-input" as const,
    rationale: "Accepted restore fixture",
    createdAt: "2026-08-20T12:00:00.000Z",
  };
  return {
    status: continuity === "current" ? "connected" : "recovered",
    continuity,
    session: {
      schema: "aiw.agent-session/0.12",
      sessionId,
      adapterId,
      adapterSessionRef: `effective-${adapterId}`,
      adapterRootSessionRef: `root-${adapterId}`,
      adapterPreviousSessionRef: null,
      profile: "default",
      workspaceId: "world-entry",
      repositoryRef: "current",
      worktreeRef: null,
      mode: "explore",
      permissionRevision: 0,
      capabilitySnapshotHash: "a".repeat(64),
      avatarProfileRef: null,
      status: "ready",
      continuity,
      currentFocusObjectIds: [],
      currentTaskRef: null,
      activeRunId: null,
      lastEventSequence: 0,
      createdAt: "2026-08-20T12:00:00.000Z",
      updatedAt: "2026-08-20T12:00:00.000Z",
    },
    proposal,
    avatarAccepted: true,
    avatarSetup: "complete",
    history: {
      sessionId,
      continuity,
      messages: [],
      transcriptAuthority: adapterId,
      avatarConsent: {
        state: "accepted",
        current: proposal,
        previous: null,
      },
    },
  };
};

const agents = [
  ["roster-hermes", "hermes", "Mr Fluff", "session-hermes"],
  ["roster-openclaw", "openclaw", "Claw", "session-openclaw"],
  ["roster-codex", "codex", "Codex", "session-codex"],
  ["roster-claude", "claude-code", "Claude", "session-claude"],
] as const;

const projection = {
  schema: "aiw.constellation/0.19",
  mode: "multi-agent",
  worldInstanceId: "world-task13",
  lifecycle: "active",
  revision: 8,
  agents: agents.map(
    ([rosterId, adapterId, displayName, worldSessionId], addedOrder) => ({
      rosterId,
      adapterId,
      sessionOwnership:
        adapterId === "hermes" ? "operator-persistent" : "world-owned",
      worldSessionId,
      nativeRootSessionRef: `root-${adapterId}`,
      worldInstanceId: "world-task13",
      displayName,
      continuity: "current",
      connection: "connected",
      avatar: {
        status: "accepted",
        profileId: `avatar-${adapterId}`,
        sessionId: worldSessionId,
      },
      addedOrder,
    }),
  ),
  entryReady: true,
  truth: "current",
} satisfies ConstellationState["projection"];

describe("Phase 19 Task 13 recovery and migration", () => {
  it("keeps one accepted Phase 18 Hermes session in Single Agent mode without another avatar", () => {
    const result = acceptedResult("session-hermes", "hermes", "Mr Fluff");

    expect(restoreModule.resolveWorldEntryRestore(result)).toBe("world");
  });

  it("resolves one exact four-agent active-World restore plan", () => {
    const resolve = (
      restoreModule as typeof restoreModule & {
        resolveWorldEntryConstellationRestore?: (
          projection: Readonly<Record<string, unknown>>,
          results: Readonly<Record<string, HermesConnectionResult>>,
        ) => Readonly<Record<string, unknown>> | null;
      }
    ).resolveWorldEntryConstellationRestore;
    expect(typeof resolve).toBe("function");
    if (!resolve) return;

    const results = Object.fromEntries(
      agents.map(([rosterId, adapterId, displayName, sessionId]) => [
        rosterId,
        acceptedResult(sessionId, adapterId, displayName),
      ]),
    );
    const plan = resolve(projection, results);

    expect(plan).toMatchObject({
      mode: "multi",
      worldInstanceId: "world-task13",
      primaryRosterId: "roster-hermes",
      agents: agents.map(
        ([rosterId, adapterId, displayName, worldSessionId]) => ({
          rosterId,
          adapterId,
          displayName,
          worldSessionId,
          continuity: "current",
          avatarProfileId: `avatar-${adapterId}`,
        }),
      ),
    });
  });

  it("recovers an accepted previous checksum generation but fails closed on one stale retained member", () => {
    const previousProjection = {
      ...projection,
      truth: "previous-recovered",
      agents: projection.agents.map((agent) => ({
        ...agent,
        continuity: "previous-recovered" as const,
      })),
    } as const;
    const previousResults = Object.fromEntries(
      agents.map(([rosterId, adapterId, displayName, sessionId]) => [
        rosterId,
        acceptedResult(sessionId, adapterId, displayName, "previous-recovered"),
      ]),
    );

    expect(
      restoreModule.resolveWorldEntryConstellationRestore(
        previousProjection,
        previousResults,
      ),
    ).toMatchObject({
      agents: [
        { continuity: "previous-recovered" },
        { continuity: "previous-recovered" },
        { continuity: "previous-recovered" },
        { continuity: "previous-recovered" },
      ],
    });
    expect(
      restoreModule.resolveWorldEntryConstellationRestore(
        {
          ...previousProjection,
          entryReady: false,
          agents: previousProjection.agents.map((agent, index) =>
            index === 2
              ? {
                  ...agent,
                  continuity: "stale" as const,
                  connection: "stale" as const,
                }
              : agent,
          ),
        },
        previousResults,
      ),
    ).toBeNull();
  });

  it("restores each exact active-World member through its owning adapter path", async () => {
    const results = Object.fromEntries(
      agents.map(([rosterId, adapterId, displayName, sessionId]) => [
        rosterId,
        acceptedResult(sessionId, adapterId, displayName),
      ]),
    );
    const restoreHermes = vi.fn().mockResolvedValue(results["roster-hermes"]);
    const restoreConstellationAgent = vi.fn(
      async (
        _sessionId: string,
        adapterId: "openclaw" | "codex" | "claude-code",
      ) =>
        results[
          agents.find(([, candidate]) => candidate === adapterId)?.[0] ?? ""
        ],
    );
    const restore = (
      restoreModule as typeof restoreModule & {
        restoreWorldEntryConstellation?: (
          client: Readonly<Record<string, unknown>>,
          projection: Readonly<Record<string, unknown>>,
        ) => Promise<Readonly<Record<string, unknown>> | null>;
      }
    ).restoreWorldEntryConstellation;

    expect(typeof restore).toBe("function");
    if (!restore) return;
    await expect(
      restore({ restoreHermes, restoreConstellationAgent }, projection),
    ).resolves.toMatchObject({
      mode: "multi",
      primaryRosterId: "roster-hermes",
      agents: [{ rosterId: "roster-hermes" }, {}, {}, {}],
    });
    expect(restoreHermes).toHaveBeenCalledWith("session-hermes");
    expect(restoreConstellationAgent.mock.calls).toEqual([
      ["session-openclaw", "openclaw"],
      ["session-codex", "codex"],
      ["session-claude", "claude-code"],
    ]);
  });

  it("reads an already revalidated World-owned session without creating or attaching another native identity", async () => {
    const sessionId = "22222222-2222-4222-8222-222222222222";
    const accepted = acceptedResult(sessionId, "codex", "Codex");
    if (accepted.status !== "connected" && accepted.status !== "recovered")
      throw new Error("invalid fixture");
    const status = vi.fn().mockResolvedValue(accepted.session);
    const history = vi.fn().mockResolvedValue(accepted.history);
    const avatarProposal = vi.fn().mockResolvedValue(accepted.proposal);
    const attach = vi.fn();
    const createWorldSession = vi.fn();
    const client = createWorldEntryClient({
      sessionClient: {
        status,
        history,
        avatarProposal,
        attach,
        createWorldSession,
      } as never,
    }) as ReturnType<typeof createWorldEntryClient> & {
      restoreConstellationAgent?: (
        sessionId: string,
        adapterId: "openclaw" | "codex" | "claude-code",
      ) => Promise<HermesConnectionResult>;
    };

    expect(typeof client.restoreConstellationAgent).toBe("function");
    if (!client.restoreConstellationAgent) return;
    await expect(
      client.restoreConstellationAgent(sessionId, "codex"),
    ).resolves.toMatchObject({
      status: "connected",
      session: { sessionId, adapterId: "codex" },
      proposal: { proposalId: "avatar-codex", sessionId },
      avatarAccepted: true,
      avatarSetup: "complete",
    });
    expect(status).toHaveBeenCalledWith(sessionId);
    expect(history).toHaveBeenCalledWith(sessionId);
    expect(attach).not.toHaveBeenCalled();
    expect(createWorldSession).not.toHaveBeenCalled();
  });
});
