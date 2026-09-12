import {
  SetupStateSchema,
  type AgentRegistration,
  type AgentSetupState,
  type DiscoveryResult,
  type SetupCheck,
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
  input: { installationId: string; identityId: string; displayName: string },
  fetcher: typeof fetch = fetch,
): Promise<{ registration: AgentRegistration | null; check: SetupCheck }> {
  return request("/api/agent-setup/attach", input, fetcher);
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
