import {
  EvidenceCurrentDataSchema,
  EvidenceLookupDataSchema,
  EvidenceLookupQuerySchema,
  type EvidenceLookupQuery,
  type EvidenceRecord,
} from "@agentintersect-world/world-schema";

import { apiRequest, type LocalApiResult } from "../health-client.js";

export type EvidencePair = {
  current: EvidenceRecord | null;
  previous: EvidenceRecord | null;
};

export async function getCurrentEvidence(
  fetcher: typeof fetch = fetch,
): Promise<LocalApiResult<EvidencePair>> {
  return await apiRequest(
    "/evidence/current",
    EvidenceCurrentDataSchema,
    {},
    fetcher,
  );
}

export async function lookupEvidence(
  query: EvidenceLookupQuery,
  fetcher: typeof fetch = fetch,
): Promise<LocalApiResult<{ current: EvidenceRecord; previous: EvidenceRecord | null }>> {
  const parsed = EvidenceLookupQuerySchema.parse(query);
  const parameters = new URLSearchParams();
  if (parsed.intentId) parameters.set("intentId", parsed.intentId);
  if (parsed.jobId) parameters.set("jobId", parsed.jobId);
  if (parsed.runId) parameters.set("runId", parsed.runId);
  return await apiRequest(
    `/evidence?${parameters.toString()}`,
    EvidenceLookupDataSchema,
    {},
    fetcher,
  );
}
