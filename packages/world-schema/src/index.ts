import { z } from "zod";

export const CorrelationIdSchema = z.uuid();

export const RuntimeInfoSchema = z
  .object({
    name: z.literal("node"),
    version: z.string().regex(/^v24(?:\.|$)/),
  })
  .strict();

export const HealthResponseSchema = z
  .object({
    service: z.literal("agentintersect-world-local-server"),
    status: z.literal("ok"),
    version: z.string().min(1),
    runtime: RuntimeInfoSchema,
    correlationId: CorrelationIdSchema,
  })
  .strict();

export const ApiErrorCodeSchema = z.enum([
  "validation",
  "unauthorized",
  "forbidden",
  "conflict",
  "not_found",
  "authority_unavailable",
  "upstream",
  "rate_limited",
  "internal",
]);

export const ApiMetaSchema = z
  .object({
    correlationId: CorrelationIdSchema,
    schema: z.literal("aiw.api/0.1"),
    revision: z.number().int().nonnegative().optional(),
  })
  .strict();

export const ApiErrorSchema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: ApiErrorCodeSchema,
        message: z.string().min(1),
        retryable: z.boolean(),
        details: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
    meta: ApiMetaSchema,
  })
  .strict();

export const ApiResultSchema = <T extends z.ZodType>(dataSchema: T) =>
  z
    .object({
      ok: z.literal(true),
      data: dataSchema,
      meta: ApiMetaSchema,
    })
    .strict();

export type CorrelationId = z.infer<typeof CorrelationIdSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ApiResult<T> = {
  ok: true;
  data: T;
  meta: z.infer<typeof ApiMetaSchema>;
};
