import {
  CodeGraphAggregateDataSchema,
  CodeGraphCurrentDataSchema,
  FocusedFileGraphSchema,
  type CodeGraphAggregateData,
  type CodeGraphCurrentData,
  type FocusedFileGraph,
} from "@agentintersect-world/world-schema";

import { apiRequest, type LocalApiResult } from "./health-client.js";

export async function getCurrentCodeGraph(
  fetcher: typeof fetch = fetch,
): Promise<LocalApiResult<CodeGraphCurrentData>> {
  return await apiRequest(
    "/code-graph/current",
    CodeGraphCurrentDataSchema,
    {},
    fetcher,
  );
}

export async function getCodeGraphAggregates(
  lod: 0 | 1 | 2,
  limit = 1_024,
  fetcher: typeof fetch = fetch,
): Promise<LocalApiResult<CodeGraphAggregateData>> {
  return await apiRequest(
    `/code-graph/aggregates?lod=${lod}&limit=${limit}`,
    CodeGraphAggregateDataSchema,
    {},
    fetcher,
  );
}

export async function getFocusedFileGraph(
  fileRef: string,
  lod: 3 | 4,
  fetcher: typeof fetch = fetch,
): Promise<LocalApiResult<FocusedFileGraph>> {
  const id = fileRef.match(/^aiw:\/\/object\/([0-9a-f]{32})$/u)?.[1];
  if (!id)
    return { status: "error", message: "Invalid focused file reference" };
  return await apiRequest(
    `/code-graph/files/${id}?lod=${lod}`,
    FocusedFileGraphSchema,
    {},
    fetcher,
  );
}
