import { WEB_API_BASE_PATH } from "@agentintersect-world/config";

import type { HarnessReadiness, IntegrationState } from "./types.js";

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid integration response");
  return value as Record<string, unknown>;
}

async function readData(path: string, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher(`${WEB_API_BASE_PATH}${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(3_000),
  });
  const envelope = record(await response.json());
  if (!response.ok || envelope.ok !== true)
    throw new Error("integration API unavailable");
  return envelope.data;
}

export async function loadIntegrationState(
  fetcher: typeof fetch = fetch,
): Promise<IntegrationState> {
  const value = record(await readData("/integration/state", fetcher));
  if (
    value.schema !== "aiw.integration/0.6" ||
    typeof value.status !== "string" ||
    value.observationOnly !== true ||
    value.executionEnabled !== false ||
    !Array.isArray(value.diagnostics)
  ) {
    throw new Error("invalid integration state contract");
  }
  return value as unknown as IntegrationState;
}

export async function loadHarnessReadiness(
  harness: string,
  fetcher: typeof fetch = fetch,
): Promise<HarnessReadiness> {
  const value = record(
    await readData(
      `/integration/harness/${encodeURIComponent(harness)}/readiness`,
      fetcher,
    ),
  );
  if (
    value.schema !== "aiw.harness-readiness/0.6" ||
    value.observationOnly !== true ||
    value.executionEnabled !== false
  ) {
    throw new Error("invalid harness readiness contract");
  }
  return value as unknown as HarnessReadiness;
}
