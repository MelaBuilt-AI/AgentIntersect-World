import {
  AGENT_MOVEMENT_PROTOCOL,
  AgentMovementTargetSchema,
  WORLD_ACTION_LIMITS,
  WorldActionProposalSchema,
  type AgentMovementTarget,
  type WorldActionProposal,
} from "@agentintersect-world/world-action-protocol";

export type WorldDirectionFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export function createUserDirectedMovementProposal(
  actorId: string,
  target: AgentMovementTarget,
): WorldActionProposal {
  return WorldActionProposalSchema.parse({
    actions: [
      {
        kind: "move-agent",
        schema: AGENT_MOVEMENT_PROTOCOL,
        actorId,
        source: "user-directed",
        speed: 4,
        target: AgentMovementTargetSchema.parse(target),
      },
    ],
    ttlMs: WORLD_ACTION_LIMITS.defaultTtlMs,
  });
}

export async function postUserDirectedMovement(
  fetcher: WorldDirectionFetcher,
  sessionId: string,
  target: AgentMovementTarget,
): Promise<void> {
  const response = await fetcher(`/world-actions/${sessionId}/proposals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(createUserDirectedMovementProposal(sessionId, target)),
  });
  if (!response.ok)
    throw new Error(`movement proposal refused (${response.status})`);
}

export async function postUserDirectedStop(
  fetcher: WorldDirectionFetcher,
  sessionId: string,
): Promise<void> {
  const response = await fetcher(`/world-actions/${sessionId}/interrupt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason: "cancel" }),
  });
  if (!response.ok)
    throw new Error(`movement stop refused (${response.status})`);
}
