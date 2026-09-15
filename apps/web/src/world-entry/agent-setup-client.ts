import {
  SetupStateSchema,
  type AgentRegistration,
  type AgentSetupState,
  type DiscoveryResult,
  type SetupCheck,
  type SetupSelection,
  type SetupConversation,
  type PrerequisitePlan,
} from "@agentintersect-world/world-schema/agent-setup";

async function request<T>(
  url: string,
  body: unknown | undefined,
  fetcher: typeof fetch,
): Promise<T> {
  const response = await fetcher(
    url,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const payload = (await response.json()) as {
    ok?: boolean;
    data?: T;
    error?: { message?: string };
  };
  if (!response.ok || payload.ok !== true || payload.data === undefined)
    throw new Error(
      payload.error?.message ??
        "Agent Setup is unavailable. Check the World local server and try again.",
    );
  return payload.data;
}
export async function loadAgentSetup(
  fetcher: typeof fetch = fetch,
): Promise<AgentSetupState> {
  return SetupStateSchema.parse(
    await request("/api/agent-setup", undefined, fetcher),
  );
}
export function discoverSetupAgents(
  fetcher: typeof fetch = fetch,
  additionalDirectory?: string,
): Promise<DiscoveryResult> {
  return request(
    "/api/agent-setup/discover",
    additionalDirectory ? { additionalDirectory } : {},
    fetcher,
  );
}
export function attachSetupAgent(
  input: SetupSelection,
  fetcher: typeof fetch = fetch,
): Promise<{ registration: AgentRegistration | null; check: SetupCheck }> {
  return request("/api/agent-setup/attach", input, fetcher);
}
export function listSetupConversations(
  input: SetupSelection,
  fetcher: typeof fetch = fetch,
): Promise<readonly SetupConversation[]> {
  return request("/api/agent-setup/conversations", input, fetcher);
}
export function previewSetupPrerequisites(
  input: SetupSelection,
  fetcher: typeof fetch = fetch,
): Promise<PrerequisitePlan> {
  return request("/api/agent-setup/prerequisites/preview", input, fetcher);
}
export function cancelSetupPrerequisites(
  planId: string,
  fetcher: typeof fetch = fetch,
): Promise<{ cancelled: true }> {
  return request("/api/agent-setup/prerequisites/cancel", { planId }, fetcher);
}
export function applySetupPrerequisite(
  planId: string,
  actionId: string,
  fetcher: typeof fetch = fetch,
): Promise<{ applied: true; check: SetupCheck }> {
  return request(
    "/api/agent-setup/prerequisites/apply",
    { planId, actionId, confirmed: true },
    fetcher,
  );
}
export function checkSetupCandidate(
  input: SetupSelection,
  fetcher: typeof fetch = fetch,
): Promise<SetupCheck> {
  return request("/api/agent-setup/check", input, fetcher);
}
export function recheckSetupAgent(
  connectionId: string,
  fetcher: typeof fetch = fetch,
): Promise<SetupCheck> {
  return request(
    `/api/agent-setup/connections/${encodeURIComponent(connectionId)}/recheck`,
    {},
    fetcher,
  );
}
export async function completeAgentSetup(
  fetcher: typeof fetch = fetch,
): Promise<AgentSetupState> {
  return SetupStateSchema.parse(
    await request("/api/agent-setup/complete", {}, fetcher),
  );
}
