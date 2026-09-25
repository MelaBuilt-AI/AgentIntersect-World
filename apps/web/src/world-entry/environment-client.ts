import {
  EnvironmentRecipeSchema,
  type EnvironmentRecipe,
} from "@agentintersect-world/world-schema/environment";
export type EnvironmentAgent = { id: string; name: string; sessionId: string };
export type EnvironmentCapability = {
  available: boolean;
  reason: string | null;
  sessionId: string;
};
async function request<T>(sessionId: string, options: RequestInit): Promise<T> {
  const response = await fetch(
    `/api/agent-sessions/${encodeURIComponent(sessionId)}/environment`,
    options,
  );
  const value = (await response.json()) as {
    ok: boolean;
    data?: T;
    error?: { message?: string };
  };
  if (!response.ok || !value.ok || !value.data)
    throw new Error(
      value.error?.message ??
        "Environment connection unavailable. Your World is unchanged.",
    );
  return value.data;
}
export function environmentCapability(sessionId: string, signal: AbortSignal) {
  return request<EnvironmentCapability>(sessionId, { signal });
}
export async function generateEnvironment(
  sessionId: string,
  description: string,
  current: EnvironmentRecipe | null,
  signal: AbortSignal,
) {
  const data = await request<{ recipe: unknown; summary: string }>(sessionId, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ description, current }),
    signal,
  });
  return {
    recipe: EnvironmentRecipeSchema.parse(data.recipe),
    summary: data.summary,
  };
}
