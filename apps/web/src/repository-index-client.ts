import { WEB_API_BASE_PATH } from "@agentintersect-world/config";
import {
  ApiErrorSchema,
  ApiResultSchema,
  CurrentRepositoryGenerationDataSchema,
  RepositoryIndexListDataSchema,
  RepositoryIndexOperationSchema,
  type RepositoryGeneration,
  type RepositoryIndexOperation,
  type Schema,
} from "@agentintersect-world/world-schema";

export type RepositoryApiResult<T> =
  | { status: "ok"; data: T }
  | { status: "error"; message: string }
  | { status: "unavailable"; message: "Local server unavailable" };

async function request<T>(
  path: string,
  schema: Schema<T>,
  init: RequestInit,
  fetcher: typeof fetch,
): Promise<RepositoryApiResult<T>> {
  let response: Response;
  try {
    response = await fetcher(`${WEB_API_BASE_PATH}${path}`, {
      ...init,
      headers: { accept: "application/json", ...init.headers },
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    return { status: "unavailable", message: "Local server unavailable" };
  }
  try {
    const payload: unknown = await response.json();
    if (!response.ok) {
      const apiError = ApiErrorSchema.parse(payload);
      return { status: "error", message: apiError.error.message };
    }
    return { status: "ok", data: ApiResultSchema(schema).parse(payload).data };
  } catch {
    return { status: "error", message: "Invalid local server response" };
  }
}

export async function startRepositoryIndex(
  rootPath: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<RepositoryApiResult<RepositoryIndexOperation>> {
  return await request(
    "/repository-indexes",
    RepositoryIndexOperationSchema,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ rootPath }),
    },
    fetcher,
  );
}

export async function getRepositoryIndex(
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<RepositoryApiResult<RepositoryIndexOperation>> {
  return await request(
    `/repository-indexes/${encodeURIComponent(id)}`,
    RepositoryIndexOperationSchema,
    {},
    fetcher,
  );
}

export async function cancelRepositoryIndex(
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<RepositoryApiResult<RepositoryIndexOperation>> {
  return await request(
    `/repository-indexes/${encodeURIComponent(id)}/cancel`,
    RepositoryIndexOperationSchema,
    { method: "POST" },
    fetcher,
  );
}

export async function listRepositoryIndexes(
  fetcher: typeof fetch = fetch,
): Promise<RepositoryApiResult<{ operations: RepositoryIndexOperation[] }>> {
  return await request(
    "/repository-indexes",
    RepositoryIndexListDataSchema,
    {},
    fetcher,
  );
}

export async function getCurrentRepositoryIndex(
  fetcher: typeof fetch = fetch,
): Promise<RepositoryApiResult<{ generation: RepositoryGeneration | null }>> {
  return await request(
    "/repository-indexes/current",
    CurrentRepositoryGenerationDataSchema,
    {},
    fetcher,
  );
}
