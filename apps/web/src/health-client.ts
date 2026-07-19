import {
  WEB_API_BASE_PATH,
  WEB_HEALTH_PATH,
} from "@agentintersect-world/config";
import {
  ApiErrorSchema,
  ApiResultSchema,
  HealthResponseSchema,
  OperationListDataSchema,
  OperationRecordSchema,
  ReadyDataSchema,
  type HealthResponse,
  type OperationRecord,
  type ReadyData,
  type Schema,
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

export type AuthorityLoadResult =
  | { status: "ready"; ready: ReadyData }
  | { status: "error"; message: string }
  | { status: "unavailable"; message: "Local server unavailable" };

export type LocalApiResult<T> =
  | { status: "ok"; data: T }
  | { status: "error"; message: string }
  | { status: "unavailable"; message: "Local server unavailable" };

async function apiRequest<T>(
  path: string,
  schema: Schema<T>,
  init: RequestInit,
  fetcher: typeof fetch,
): Promise<LocalApiResult<T>> {
  let response: Response;
  try {
    response = await fetcher(`${WEB_API_BASE_PATH}${path}`, {
      ...init,
      headers: { accept: "application/json", ...init.headers },
      signal: AbortSignal.timeout(3_000),
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
    const result = ApiResultSchema(schema).parse(payload);
    return { status: "ok", data: result.data };
  } catch {
    return { status: "error", message: "Invalid local server response" };
  }
}

export async function loadAuthority(
  fetcher: typeof fetch = fetch,
): Promise<AuthorityLoadResult> {
  const result = await apiRequest("/ready", ReadyDataSchema, {}, fetcher);
  if (result.status !== "ok") return result;
  return { status: "ready", ready: result.data };
}

export async function startDemoOperation(
  durationMs: number,
  label: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<LocalApiResult<OperationRecord>> {
  return await apiRequest(
    "/operations",
    OperationRecordSchema,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ kind: "demo-delay", durationMs, label }),
    },
    fetcher,
  );
}

export async function getOperation(
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<LocalApiResult<OperationRecord>> {
  return await apiRequest(
    `/operations/${encodeURIComponent(id)}`,
    OperationRecordSchema,
    {},
    fetcher,
  );
}

export async function cancelOperation(
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<LocalApiResult<OperationRecord>> {
  return await apiRequest(
    `/operations/${encodeURIComponent(id)}/cancel`,
    OperationRecordSchema,
    { method: "POST" },
    fetcher,
  );
}

export async function listOperations(
  fetcher: typeof fetch = fetch,
): Promise<LocalApiResult<{ operations: OperationRecord[] }>> {
  return await apiRequest("/operations", OperationListDataSchema, {}, fetcher);
}
