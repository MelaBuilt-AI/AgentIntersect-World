import { randomUUID } from "node:crypto";

import {
  CorrelationIdSchema,
  type ApiError,
  type ApiResult,
  type CorrelationId,
} from "@agentintersect-world/world-schema";

export function createCorrelationId(): CorrelationId {
  return CorrelationIdSchema.parse(randomUUID());
}

export function ok<T>(data: T, correlationId: CorrelationId): ApiResult<T> {
  return { ok: true, data, meta: { correlationId, schema: "aiw.api/0.1" } };
}

export function unavailable(
  message: string,
  correlationId: CorrelationId,
): ApiError {
  return {
    ok: false,
    error: { code: "authority_unavailable", message, retryable: true },
    meta: { correlationId, schema: "aiw.api/0.1" },
  };
}
