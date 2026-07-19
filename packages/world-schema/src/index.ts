import { z } from "zod";

export type Schema<T> = z.ZodType<T>;

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
    schema: z.literal("aiw.api/0.2"),
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

export const SafeConfigSchema = z
  .object({
    phase: z.literal("Phase 2"),
    version: z.literal("0.2.0-phase2"),
    instanceName: z.string().min(1).max(80),
    networkScope: z.enum(["loopback", "lan"]),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65_535),
    demoOperationMaxMs: z.number().int().positive(),
  })
  .strict();

export const ReadyDataSchema = z
  .object({
    service: z.literal("agentintersect-world-local-server"),
    status: z.literal("ready"),
    version: z.literal("0.2.0-phase2"),
    runtime: RuntimeInfoSchema,
    config: SafeConfigSchema,
  })
  .strict();

export const DoctorCheckSchema = z
  .object({
    name: z.enum(["runtime", "configuration", "operation-service"]),
    status: z.literal("pass"),
    message: z.string().min(1),
  })
  .strict();

export const DoctorDataSchema = z
  .object({
    status: z.literal("ready"),
    checks: z.array(DoctorCheckSchema).length(3),
  })
  .strict();

export const OperationRequestSchema = z
  .object({
    kind: z.literal("demo-delay"),
    durationMs: z.number().int().positive(),
    label: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const OperationStatusSchema = z.enum([
  "running",
  "succeeded",
  "cancelled",
]);

export const OperationRecordSchema = z
  .object({
    id: z.uuid(),
    kind: z.literal("demo-delay"),
    durationMs: z.number().int().positive(),
    label: z.string().min(1).max(80).optional(),
    status: OperationStatusSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    result: z.string().min(1).max(160),
  })
  .strict();

export const OperationListDataSchema = z
  .object({ operations: z.array(OperationRecordSchema).max(100) })
  .strict();

export type SafeConfig = z.infer<typeof SafeConfigSchema>;
export type ReadyData = z.infer<typeof ReadyDataSchema>;
export type DoctorData = z.infer<typeof DoctorDataSchema>;
export type OperationRequest = z.infer<typeof OperationRequestSchema>;
export type OperationRecord = z.infer<typeof OperationRecordSchema>;
export type OperationStatus = z.infer<typeof OperationStatusSchema>;
