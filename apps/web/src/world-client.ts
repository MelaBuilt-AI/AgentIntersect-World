import { WEB_API_BASE_PATH } from "@agentintersect-world/config";
import {
  CurrentWorldSnapshotDataSchema,
  WorldTileQueryResponseSchema,
  type WorldSnapshot,
  type WorldTileQuery,
  type WorldTileQueryResponse,
} from "@agentintersect-world/world-schema";

import { apiRequest, type LocalApiResult } from "./health-client.js";

export const DEFAULT_TILE_QUERY: WorldTileQuery = {
  lod: 0,
  minX: 0,
  maxX: 15,
  minZ: 0,
  maxZ: 15,
  limit: 128,
};

export async function getCurrentWorld(
  fetcher: typeof fetch = fetch,
): Promise<LocalApiResult<{ snapshot: WorldSnapshot }>> {
  return await apiRequest(
    "/world/current",
    CurrentWorldSnapshotDataSchema,
    {},
    fetcher,
  );
}

export async function getWorldTiles(
  query: WorldTileQuery = DEFAULT_TILE_QUERY,
  fetcher: typeof fetch = fetch,
): Promise<LocalApiResult<WorldTileQueryResponse>> {
  const parameters = new URLSearchParams(
    Object.entries(query).map(([key, value]) => [key, String(value)]),
  );
  return await apiRequest(
    `/world/tiles?${parameters.toString()}`,
    WorldTileQueryResponseSchema,
    {},
    fetcher,
  );
}

export function worldApiUrl(path: string): string {
  return `${WEB_API_BASE_PATH}${path}`;
}
