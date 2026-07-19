import { WEB_HEALTH_PATH } from "@agentintersect-world/config";
import {
  HealthResponseSchema,
  type HealthResponse,
} from "@agentintersect-world/world-schema";

export type HealthLoadResult =
  | { status: "healthy"; health: HealthResponse }
  | { status: "unavailable"; message: "Local server unavailable" };

export async function loadHealth(
  fetcher: typeof fetch = fetch,
): Promise<HealthLoadResult> {
  try {
    const response = await fetcher(WEB_HEALTH_PATH, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      throw new Error(`health request failed with ${response.status}`);
    }

    return {
      status: "healthy",
      health: HealthResponseSchema.parse(await response.json()),
    };
  } catch {
    return { status: "unavailable", message: "Local server unavailable" };
  }
}
