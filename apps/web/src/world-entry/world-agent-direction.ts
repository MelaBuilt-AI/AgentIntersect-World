import {
  AGENT_MOVEMENT_PROTOCOL,
  AgentMovementTargetSchema,
  WORLD_ACTION_LIMITS,
  WorldActionEnvelopeSchema,
  WorldActionProposalSchema,
  type AgentMovementTarget,
  type WorldActionProposal,
} from "@agentintersect-world/world-action-protocol";
import type { AgentMovementRequest } from "./world-agent-movement-model.js";
import { parseAgentDirectionCommand } from "./world-chat-model.js";

export type WorldDirectionFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type AgentMovementAuthorityOutcome = {
  readonly requestId: string;
  readonly state:
    "intent" | "moving" | "arrived" | "refused" | "cancelled" | "interrupted";
  readonly reason?: string;
};

const executionState = (
  state: unknown,
): AgentMovementAuthorityOutcome["state"] | null => {
  if (state === "requested" || state === "path-planned") return "intent";
  if (state === "moving" || state === "arrived" || state === "cancelled")
    return state;
  if (state === "blocked") return "refused";
  if (state === "interrupted" || state === "superseded") return "interrupted";
  return null;
};

const actionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function parseAgentMovementAuthoritySnapshot(
  input: unknown,
  actorId: string,
): {
  readonly capabilityRefusal: string | null;
  readonly requests: readonly AgentMovementRequest[];
  readonly outcomes: readonly AgentMovementAuthorityOutcome[];
} {
  if (!input || typeof input !== "object")
    return { capabilityRefusal: null, requests: [], outcomes: [] };
  const body = input as Record<string, unknown>;
  const capability =
    body.capability && typeof body.capability === "object"
      ? (body.capability as Record<string, unknown>)
      : null;
  const capabilityRefusal =
    capability?.enabled === false && typeof capability.reason === "string"
      ? capability.reason.slice(0, 240)
      : null;
  const requests: AgentMovementRequest[] = [];
  const seen = new Set<string>();
  if (Array.isArray(body.executions))
    for (const execution of body.executions) {
      if (
        !execution ||
        typeof execution !== "object" ||
        (execution as Record<string, unknown>).accepted !== true
      )
        continue;
      const parsed = WorldActionEnvelopeSchema.safeParse(
        (execution as Record<string, unknown>).envelope,
      );
      if (!parsed.success || parsed.data.sessionId !== actorId) continue;
      for (const action of parsed.data.actions) {
        if (
          action.kind !== "move-agent" ||
          action.actorId !== actorId ||
          seen.has(action.actionId)
        )
          continue;
        seen.add(action.actionId);
        requests.push({
          schema: action.schema,
          requestId: action.actionId,
          actorId: action.actorId,
          source: action.source,
          speed: action.speed,
          target: action.target,
        });
      }
    }
  const outcomes: AgentMovementAuthorityOutcome[] = [];
  if (Array.isArray(body.actions))
    for (const action of body.actions) {
      if (!action || typeof action !== "object") continue;
      const candidate = action as Record<string, unknown>;
      const state = executionState(candidate.state);
      if (
        candidate.kind !== "move-agent" ||
        typeof candidate.actionId !== "string" ||
        !actionIdPattern.test(candidate.actionId) ||
        !state
      )
        continue;
      outcomes.push({
        requestId: candidate.actionId,
        state,
        ...(typeof candidate.reason === "string"
          ? { reason: candidate.reason.slice(0, 240) }
          : {}),
      });
    }
  return { capabilityRefusal, requests, outcomes };
}

export function resolveDirectedMovementRecipients(
  input: string,
  agents: readonly {
    readonly rosterId: string;
    readonly worldSessionId: string;
    readonly displayName: string;
    readonly connection: string;
  }[],
  selectedRosterId: string | null,
): { readonly text: string; readonly sessionIds: readonly string[] } {
  const text = input.trim();
  const connected = agents.filter((agent) => agent.connection === "connected");
  if (text.startsWith("@")) {
    const normalize = (value: string) =>
      value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
    const matches = connected.flatMap((agent) => {
      for (let end = 2; end <= Math.min(text.length, 82); end += 1) {
        if (
          (end === text.length || /\s/u.test(text[end]!)) &&
          normalize(text.slice(1, end)) === normalize(agent.displayName)
        )
          return [{ agent, end }];
      }
      return [];
    });
    if (matches.length !== 1) {
      // Keep an unresolved explicit direction local so it cannot fall through
      // to ordinary chat (or silently use the selected/broadcast recipient).
      for (let end = 2; end <= Math.min(text.length, 82); end += 1) {
        if (!/\s/u.test(text[end]!)) continue;
        const command = text.slice(end).trim();
        if (parseAgentDirectionCommand(command).kind !== "not-agent-command")
          return { text: command, sessionIds: [] };
      }
      return { text, sessionIds: [] };
    }
    return {
      text: text.slice(matches[0]!.end).trim(),
      sessionIds: [matches[0]!.agent.worldSessionId],
    };
  }
  if (selectedRosterId)
    return {
      text,
      sessionIds: connected
        .filter((agent) => agent.rosterId === selectedRosterId)
        .map((agent) => agent.worldSessionId),
    };
  return { text, sessionIds: connected.map((agent) => agent.worldSessionId) };
}

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
  const response = await fetcher(`/api/world-actions/${sessionId}/proposals`, {
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
  const response = await fetcher(`/api/world-actions/${sessionId}/interrupt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason: "cancel" }),
  });
  if (!response.ok)
    throw new Error(`movement stop refused (${response.status})`);
}
