import type {
  AvatarProposal,
  ConstellationState,
  Phase19AdapterId,
  SessionHistory,
  WorldAgentSession,
} from "../sessions/session-client.js";
import type { HermesConnectionResult } from "./world-entry-client.js";

export type WorldEntryRestoreDisposition =
  "clear" | "world" | "avatar-create" | "avatar-migrate";

export type WorldEntryConstellationRestoreAgent = {
  readonly rosterId: string;
  readonly adapterId: Phase19AdapterId;
  readonly displayName: string;
  readonly worldSessionId: string;
  readonly continuity: "current" | "previous-recovered";
  readonly avatarProfileId: string;
  readonly session: WorldAgentSession;
  readonly proposal: AvatarProposal;
  readonly history: SessionHistory;
};

export type WorldEntryConstellationRestorePlan = {
  readonly mode: "multi";
  readonly worldInstanceId: string;
  readonly primaryRosterId: string;
  readonly agents: readonly WorldEntryConstellationRestoreAgent[];
};

type ConstellationAgent = ConstellationState["projection"]["agents"][number];

function resolveConstellationAgent(
  projection: ConstellationState["projection"],
  agent: ConstellationAgent,
  result: HermesConnectionResult | undefined,
): WorldEntryConstellationRestoreAgent | null {
  if (
    !result ||
    agent.worldInstanceId !== projection.worldInstanceId ||
    (result.status !== "connected" && result.status !== "recovered") ||
    result.continuity !== agent.continuity ||
    result.session.sessionId !== agent.worldSessionId ||
    result.session.adapterId !== agent.adapterId ||
    result.history.sessionId !== agent.worldSessionId ||
    result.history.continuity !== result.continuity ||
    result.history.transcriptAuthority !== agent.adapterId ||
    !result.proposal ||
    result.proposal.sessionId !== agent.worldSessionId ||
    !result.avatarAccepted ||
    result.avatarSetup !== "complete" ||
    result.history.avatarConsent?.state !== "accepted" ||
    result.history.avatarConsent.current?.proposalId !==
      result.proposal.proposalId ||
    agent.connection !== "connected" ||
    agent.avatar.status !== "accepted" ||
    agent.avatar.sessionId !== agent.worldSessionId ||
    agent.avatar.profileId !== result.proposal.proposalId
  )
    return null;
  return {
    rosterId: agent.rosterId,
    adapterId: agent.adapterId,
    displayName: agent.displayName,
    worldSessionId: agent.worldSessionId,
    continuity: result.continuity,
    avatarProfileId: result.proposal.proposalId,
    session: result.session,
    proposal: result.proposal,
    history: result.history,
  };
}

export function resolveWorldEntryRestore(
  result: HermesConnectionResult,
): WorldEntryRestoreDisposition {
  if (
    (result.status !== "connected" && result.status !== "recovered") ||
    !result.proposal ||
    result.proposal.sessionId !== result.session.sessionId ||
    result.history.sessionId !== result.session.sessionId ||
    result.history.continuity !== result.continuity ||
    result.history.transcriptAuthority !== "hermes"
  )
    return "clear";
  if (!result.avatarAccepted)
    return result.history.avatarConsent === null ? "avatar-create" : "clear";
  if (
    result.history.avatarConsent?.state !== "accepted" ||
    result.history.avatarConsent.current?.sessionId !==
      result.session.sessionId ||
    result.history.avatarConsent.current.proposalId !==
      result.proposal.proposalId
  )
    return "clear";
  return result.avatarSetup === "complete" ? "world" : "avatar-migrate";
}

export function resolveWorldEntryConstellationRestore(
  projection: ConstellationState["projection"],
  results: Readonly<Record<string, HermesConnectionResult>>,
): WorldEntryConstellationRestorePlan | null {
  if (
    projection.mode !== "multi-agent" ||
    projection.lifecycle !== "active" ||
    (projection.truth !== "current" &&
      projection.truth !== "previous-recovered") ||
    !projection.entryReady ||
    projection.agents.length < 2 ||
    projection.agents.length > 4
  )
    return null;

  const rosterIds = new Set(projection.agents.map((agent) => agent.rosterId));
  const sessionIds = new Set(
    projection.agents.map((agent) => agent.worldSessionId),
  );
  if (
    rosterIds.size !== projection.agents.length ||
    sessionIds.size !== projection.agents.length ||
    projection.agents.some(
      (agent) => agent.worldInstanceId !== projection.worldInstanceId,
    )
  )
    return null;

  const agents: WorldEntryConstellationRestoreAgent[] = [];
  for (const agent of [...projection.agents].sort(
    (left, right) => left.addedOrder - right.addedOrder,
  )) {
    const restored = resolveConstellationAgent(
      projection,
      agent,
      results[agent.rosterId],
    );
    if (!restored) return null;
    agents.push(restored);
  }

  const primary =
    agents.find((agent) => agent.adapterId === "hermes") ?? agents[0];
  return primary
    ? {
        mode: "multi",
        worldInstanceId: projection.worldInstanceId,
        primaryRosterId: primary.rosterId,
        agents,
      }
    : null;
}

export async function restoreAvailableWorldEntryConstellationAgents(
  client: {
    readonly restoreHermes: (
      sessionId: string,
    ) => Promise<HermesConnectionResult>;
    readonly restoreConstellationAgent: (
      sessionId: string,
      adapterId: Exclude<Phase19AdapterId, "hermes">,
    ) => Promise<HermesConnectionResult>;
  },
  projection: ConstellationState["projection"],
): Promise<readonly WorldEntryConstellationRestoreAgent[]> {
  const restored = await Promise.all(
    [...projection.agents]
      .sort((left, right) => left.addedOrder - right.addedOrder)
      .filter(
        (agent) =>
          agent.connection === "connected" &&
          (agent.continuity === "current" ||
            agent.continuity === "previous-recovered"),
      )
      .map(async (agent) => {
        try {
          const result =
            agent.adapterId === "hermes"
              ? await client.restoreHermes(agent.worldSessionId)
              : await client.restoreConstellationAgent(
                  agent.worldSessionId,
                  agent.adapterId,
                );
          return resolveConstellationAgent(projection, agent, result);
        } catch {
          return null;
        }
      }),
  );
  return restored.filter(
    (agent): agent is WorldEntryConstellationRestoreAgent => agent !== null,
  );
}

export async function restoreWorldEntryConstellation(
  client: {
    readonly restoreHermes: (
      sessionId: string,
    ) => Promise<HermesConnectionResult>;
    readonly restoreConstellationAgent: (
      sessionId: string,
      adapterId: Exclude<Phase19AdapterId, "hermes">,
    ) => Promise<HermesConnectionResult>;
  },
  projection: ConstellationState["projection"],
): Promise<WorldEntryConstellationRestorePlan | null> {
  if (
    projection.mode !== "multi-agent" ||
    projection.lifecycle !== "active" ||
    (projection.truth !== "current" &&
      projection.truth !== "previous-recovered") ||
    !projection.entryReady ||
    projection.agents.length < 2 ||
    projection.agents.length > 4
  )
    return null;
  const entries = await Promise.all(
    projection.agents.map(
      async (agent) =>
        [
          agent.rosterId,
          agent.adapterId === "hermes"
            ? await client.restoreHermes(agent.worldSessionId)
            : await client.restoreConstellationAgent(
                agent.worldSessionId,
                agent.adapterId,
              ),
        ] as const,
    ),
  );
  return resolveWorldEntryConstellationRestore(
    projection,
    Object.fromEntries(entries),
  );
}
