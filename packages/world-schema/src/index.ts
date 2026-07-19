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
    schema: z.literal("aiw.api/0.3"),
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
    phase: z.literal("Phase 3"),
    version: z.literal("0.3.0-phase3"),
    instanceName: z.string().min(1).max(80),
    networkScope: z.enum(["loopback", "lan"]),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65_535),
    demoOperationMaxMs: z.number().int().positive(),
    repositoryMaxFiles: z.number().int().min(1).max(10_000),
  })
  .strict();

export const ReadyDataSchema = z
  .object({
    service: z.literal("agentintersect-world-local-server"),
    status: z.literal("ready"),
    version: z.literal("0.3.0-phase3"),
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

export const RepositoryIndexRequestSchema = z
  .object({ rootPath: z.string().trim().min(1).max(4096) })
  .strict();

export const RepositoryIndexStatusSchema = z.enum([
  "running",
  "succeeded",
  "cancelled",
  "failed",
]);

export const RepositoryIndexProgressSchema = z
  .object({
    phase: z.enum([
      "validating",
      "discovering",
      "classifying",
      "git-metadata",
      "finalizing",
      "complete",
    ]),
    discoveredFiles: z.number().int().nonnegative(),
    indexedFiles: z.number().int().nonnegative(),
    bytesHashed: z.number().int().nonnegative(),
  })
  .strict();

export const RepositoryDirectorySchema = z
  .object({ path: z.string(), fileCount: z.number().int().nonnegative() })
  .strict();

export const RepositoryFileSchema = z
  .object({
    path: z.string().min(1),
    size: z.number().int().nonnegative(),
    fileKind: z.enum([
      "source",
      "test",
      "documentation",
      "configuration",
      "manifest",
      "data",
      "asset",
      "binary",
      "other",
    ]),
    language: z.string().min(1).nullable(),
    binary: z.boolean(),
    oversized: z.boolean(),
    contentHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    gitStatus: z.string().min(1).max(4).nullable(),
  })
  .strict();

export const RepositoryPackageSchema = z
  .object({
    path: z.string().min(1),
    kind: z.enum(["npm", "python", "cargo", "go", "maven"]),
    name: z.string().min(1).max(240).nullable(),
  })
  .strict();

export const RepositoryGitMetadataSchema = z
  .object({
    present: z.boolean(),
    branch: z.string().min(1).nullable(),
    head: z
      .string()
      .regex(/^[0-9a-f]{40,64}$/)
      .nullable(),
    dirty: z.boolean(),
  })
  .strict();

export const RepositoryIndexCoverageSchema = z
  .object({
    discoveredFiles: z.number().int().nonnegative(),
    indexedFiles: z.number().int().nonnegative(),
    prunedEntries: z.number().int().nonnegative(),
    skippedSymlinks: z.number().int().nonnegative(),
    directories: z.number().int().nonnegative(),
    packages: z.number().int().nonnegative(),
    binaryFiles: z.number().int().nonnegative(),
    oversizedFiles: z.number().int().nonnegative(),
    bytesHashed: z.number().int().nonnegative(),
  })
  .strict();

export const RepositoryGenerationSchema = z
  .object({
    id: z.uuid(),
    fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    rootPath: z.string().min(1),
    repositoryName: z.string().min(1),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime(),
    durationMs: z.number().int().nonnegative(),
    git: RepositoryGitMetadataSchema,
    directories: z.array(RepositoryDirectorySchema),
    files: z.array(RepositoryFileSchema).max(10_000),
    packages: z.array(RepositoryPackageSchema),
    coverage: RepositoryIndexCoverageSchema,
  })
  .strict();

export const RepositoryIndexOperationSchema = z
  .object({
    id: z.uuid(),
    rootPath: z.string().min(1),
    status: RepositoryIndexStatusSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    progress: RepositoryIndexProgressSchema,
    generation: RepositoryGenerationSchema.optional(),
    error: z.string().min(1).max(500).optional(),
  })
  .strict();

export const RepositoryIndexListDataSchema = z
  .object({ operations: z.array(RepositoryIndexOperationSchema).max(20) })
  .strict();

export const CurrentRepositoryGenerationDataSchema = z
  .object({ generation: RepositoryGenerationSchema.nullable() })
  .strict();

export type RepositoryIndexRequest = z.infer<
  typeof RepositoryIndexRequestSchema
>;
export type RepositoryIndexStatus = z.infer<typeof RepositoryIndexStatusSchema>;
export type RepositoryIndexProgress = z.infer<
  typeof RepositoryIndexProgressSchema
>;
export type RepositoryDirectory = z.infer<typeof RepositoryDirectorySchema>;
export type RepositoryFile = z.infer<typeof RepositoryFileSchema>;
export type RepositoryPackage = z.infer<typeof RepositoryPackageSchema>;
export type RepositoryGitMetadata = z.infer<typeof RepositoryGitMetadataSchema>;
export type RepositoryIndexCoverage = z.infer<
  typeof RepositoryIndexCoverageSchema
>;
export type RepositoryGeneration = z.infer<typeof RepositoryGenerationSchema>;
export type RepositoryIndexOperation = z.infer<
  typeof RepositoryIndexOperationSchema
>;
