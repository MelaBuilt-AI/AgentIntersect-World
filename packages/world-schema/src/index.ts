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
    phase: z.literal("Phase 7"),
    version: z.literal("0.7.0-phase7"),
    instanceName: z.string().min(1).max(80),
    networkScope: z.enum(["loopback", "lan"]),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65_535),
    demoOperationMaxMs: z.number().int().positive(),
    repositoryMaxFiles: z.number().int().min(1).max(10_000),
    agentIntersectReadEnabled: z.boolean(),
    agentIntersectCommandsEnabled: z.boolean(),
  })
  .strict();

export const ReadyDataSchema = z
  .object({
    service: z.literal("agentintersect-world-local-server"),
    status: z.literal("ready"),
    version: z.literal("0.7.0-phase7"),
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
  .object({
    rootPath: z
      .string()
      .trim()
      .min(1)
      .max(4096)
      .refine((value) => !value.includes("\0"), {
        message: "rootPath must not contain NUL",
      }),
  })
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

export const WORLD_MAX_PATH_LENGTH = 4096 as const;
export const WORLD_MAX_NAME_LENGTH = 512 as const;

const repositoryPathSchema = (allowEmpty: boolean) =>
  z
    .string()
    .min(allowEmpty ? 0 : 1)
    .max(WORLD_MAX_PATH_LENGTH)
    .superRefine((value, context) => {
      const normalized = value.replaceAll("\\", "/").normalize("NFC");
      if (normalized.includes("\0")) {
        context.addIssue({
          code: "custom",
          message: "Repository paths must not contain NUL",
        });
      }
      if (
        normalized
          .split("/")
          .some((segment) => segment.length > WORLD_MAX_NAME_LENGTH)
      ) {
        context.addIssue({
          code: "custom",
          message: `Repository path segments must not exceed ${WORLD_MAX_NAME_LENGTH} characters`,
        });
      }
    });

export const RepositoryDirectorySchema = z
  .object({
    path: repositoryPathSchema(true),
    fileCount: z.number().int().nonnegative(),
  })
  .strict();

export const RepositoryFileSchema = z
  .object({
    path: repositoryPathSchema(false),
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
    path: repositoryPathSchema(false),
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
    rootPath: z
      .string()
      .min(1)
      .max(WORLD_MAX_PATH_LENGTH)
      .refine((value) => !value.includes("\0"), {
        message: "rootPath must not contain NUL",
      }),
    repositoryName: z.string().min(1).max(WORLD_MAX_NAME_LENGTH),
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
    rootPath: z.string().min(1).max(WORLD_MAX_PATH_LENGTH),
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

export const WORLD_SCHEMA_VERSION = "aiw.world/0.4" as const;
export const WORLD_IDENTITY_VERSION = "aiw.identity/1" as const;
export const WORLD_LAYOUT_VERSION = "aiw.layout/grid/1" as const;
export const WORLD_FULL_DETAIL_FILE_LIMIT = 10_000 as const;
export const WORLD_TILE_RESPONSE_LIMIT = 128 as const;
export const WORLD_PATH_HISTORY_LIMIT = 8 as const;
export const WORLD_TOMBSTONE_LIMIT = 256 as const;
export const WORLD_MAX_LOD = 4 as const;
export const WORLD_MAX_TILE_COORDINATE = 15 as const;

export const WorldSchemaVersionSchema = z.literal(WORLD_SCHEMA_VERSION);
export const WorldIdentityVersionSchema = z.literal(WORLD_IDENTITY_VERSION);
export const WorldLayoutVersionSchema = z.literal(WORLD_LAYOUT_VERSION);

export const WorldObjectIdSchema = z.string().regex(/^[0-9a-f]{32}$/);
export const WorldObjectRefSchema = z
  .string()
  .regex(/^aiw:\/\/object\/[0-9a-f]{32}$/);
export const WorldCanonicalRefSchema = z
  .string()
  .regex(/^aiw:\/\/path\/[0-9a-f]{32}$/);

const FiniteCoordinateSchema = z.number().finite().int().nonnegative();

export const WorldPositionSchema = z
  .object({
    x: FiniteCoordinateSchema,
    y: FiniteCoordinateSchema,
    z: FiniteCoordinateSchema,
  })
  .strict();

export const WorldBoundsSchema = z
  .object({
    x: FiniteCoordinateSchema,
    z: FiniteCoordinateSchema,
    width: FiniteCoordinateSchema.positive(),
    depth: FiniteCoordinateSchema.positive(),
  })
  .strict();

export const WorldPathHistoryEntrySchema = z
  .object({
    path: z.string().min(1).max(WORLD_MAX_PATH_LENGTH),
    canonicalRef: WorldCanonicalRefSchema,
    confidence: z.literal("exact-content"),
    caseOnly: z.boolean(),
  })
  .strict();

const WorldObjectBaseShape = {
  id: WorldObjectIdSchema,
  ref: WorldObjectRefSchema,
  name: z.string().min(1).max(WORLD_MAX_NAME_LENGTH),
  parentRef: WorldObjectRefSchema.nullable(),
  childRefs: z.array(WorldObjectRefSchema).max(40_512),
  position: WorldPositionSchema,
  bounds: WorldBoundsSchema,
} as const;

export const WorldWorkspaceObjectSchema = z
  .object({ kind: z.literal("workspace"), ...WorldObjectBaseShape })
  .strict();

export const WorldRepositoryObjectSchema = z
  .object({ kind: z.literal("repository"), ...WorldObjectBaseShape })
  .strict();

export const WorldDirectoryObjectSchema = z
  .object({
    kind: z.literal("directory"),
    ...WorldObjectBaseShape,
    path: z.string().max(WORLD_MAX_PATH_LENGTH),
    fileCount: z.number().int().nonnegative(),
  })
  .strict();

export const WorldFileObjectSchema = z
  .object({
    kind: z.literal("file"),
    ...WorldObjectBaseShape,
    path: z.string().min(1).max(WORLD_MAX_PATH_LENGTH),
    size: z.number().int().nonnegative(),
    fileKind: RepositoryFileSchema.shape.fileKind,
    language: z.string().min(1).nullable(),
    contentHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    pathHistory: z
      .array(WorldPathHistoryEntrySchema)
      .max(WORLD_PATH_HISTORY_LIMIT),
  })
  .strict();

export const WorldPackageObjectSchema = z
  .object({
    kind: z.literal("package"),
    ...WorldObjectBaseShape,
    path: z.string().min(1).max(WORLD_MAX_PATH_LENGTH),
    packageKind: RepositoryPackageSchema.shape.kind,
    packageName: z.string().min(1).max(240).nullable(),
  })
  .strict();

export const WorldTombstoneObjectSchema = z
  .object({
    kind: z.literal("tombstone"),
    ...WorldObjectBaseShape,
    originalKind: z.literal("file"),
    lastKnownPath: z.string().min(1).max(WORLD_MAX_PATH_LENGTH),
    contentHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    pathHistory: z
      .array(WorldPathHistoryEntrySchema)
      .max(WORLD_PATH_HISTORY_LIMIT),
  })
  .strict();

export const WorldObjectSchema = z.discriminatedUnion("kind", [
  WorldWorkspaceObjectSchema,
  WorldRepositoryObjectSchema,
  WorldDirectoryObjectSchema,
  WorldFileObjectSchema,
  WorldPackageObjectSchema,
  WorldTombstoneObjectSchema,
]);

export const WorldTileCountsSchema = z
  .object({
    total: z.number().int().nonnegative(),
    byKind: z.record(z.string(), z.number().int().nonnegative()),
    byLanguage: z.record(z.string(), z.number().int().nonnegative()),
    byFileKind: z.record(z.string(), z.number().int().nonnegative()),
  })
  .strict();

export const WorldTileSchema = z
  .object({
    lod: z.number().int().min(0).max(WORLD_MAX_LOD),
    x: z.number().int().min(0).max(WORLD_MAX_TILE_COORDINATE),
    z: z.number().int().min(0).max(WORLD_MAX_TILE_COORDINATE),
    bounds: WorldBoundsSchema,
    counts: WorldTileCountsSchema,
  })
  .strict();

export const WorldSnapshotSchema = z
  .object({
    schema: WorldSchemaVersionSchema,
    identityVersion: WorldIdentityVersionSchema,
    layoutVersion: WorldLayoutVersionSchema,
    snapshotId: WorldObjectIdSchema,
    generationFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    workspaceRef: WorldObjectRefSchema,
    repositoryRef: WorldObjectRefSchema,
    objects: z.array(WorldObjectSchema).max(40_512),
    tiles: z.array(WorldTileSchema).max(341),
    limits: z
      .object({
        fullDetailFiles: z.literal(WORLD_FULL_DETAIL_FILE_LIMIT),
        maxTileRecords: z.literal(WORLD_TILE_RESPONSE_LIMIT),
        maxPathHistory: z.literal(WORLD_PATH_HISTORY_LIMIT),
        maxTombstones: z.literal(WORLD_TOMBSTONE_LIMIT),
      })
      .strict(),
  })
  .strict();

export const WorldTileQuerySchema = z
  .object({
    lod: z.number().int().min(0).max(WORLD_MAX_LOD),
    minX: z.number().int().min(0).max(WORLD_MAX_TILE_COORDINATE),
    maxX: z.number().int().min(0).max(WORLD_MAX_TILE_COORDINATE),
    minZ: z.number().int().min(0).max(WORLD_MAX_TILE_COORDINATE),
    maxZ: z.number().int().min(0).max(WORLD_MAX_TILE_COORDINATE),
    limit: z.number().int().min(1).max(WORLD_TILE_RESPONSE_LIMIT),
  })
  .strict()
  .refine((query) => query.minX <= query.maxX, {
    message: "minX must be less than or equal to maxX",
  })
  .refine((query) => query.minZ <= query.maxZ, {
    message: "minZ must be less than or equal to maxZ",
  });

export const WorldTileQueryResponseSchema = z
  .object({
    schema: WorldSchemaVersionSchema,
    snapshotId: WorldObjectIdSchema,
    query: WorldTileQuerySchema,
    tiles: z.array(WorldTileSchema).max(WORLD_TILE_RESPONSE_LIMIT),
  })
  .strict();

export const CurrentWorldSnapshotDataSchema = z
  .object({ snapshot: WorldSnapshotSchema })
  .strict();

export type WorldObjectId = z.infer<typeof WorldObjectIdSchema>;
export type WorldSchemaVersion = z.infer<typeof WorldSchemaVersionSchema>;
export type WorldIdentityVersion = z.infer<typeof WorldIdentityVersionSchema>;
export type WorldLayoutVersion = z.infer<typeof WorldLayoutVersionSchema>;
export type WorldObjectRef = z.infer<typeof WorldObjectRefSchema>;
export type WorldCanonicalRef = z.infer<typeof WorldCanonicalRefSchema>;
export type WorldPosition = z.infer<typeof WorldPositionSchema>;
export type WorldBounds = z.infer<typeof WorldBoundsSchema>;
export type WorldPathHistoryEntry = z.infer<typeof WorldPathHistoryEntrySchema>;
export type WorldWorkspaceObject = z.infer<typeof WorldWorkspaceObjectSchema>;
export type WorldRepositoryObject = z.infer<typeof WorldRepositoryObjectSchema>;
export type WorldDirectoryObject = z.infer<typeof WorldDirectoryObjectSchema>;
export type WorldFileObject = z.infer<typeof WorldFileObjectSchema>;
export type WorldPackageObject = z.infer<typeof WorldPackageObjectSchema>;
export type WorldTombstoneObject = z.infer<typeof WorldTombstoneObjectSchema>;
export type WorldObject = z.infer<typeof WorldObjectSchema>;
export type WorldTile = z.infer<typeof WorldTileSchema>;
export type WorldSnapshot = z.infer<typeof WorldSnapshotSchema>;
export type WorldTileQuery = z.infer<typeof WorldTileQuerySchema>;
export type WorldTileQueryResponse = z.infer<
  typeof WorldTileQueryResponseSchema
>;

const VisibleAscii128Schema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[\x20-\x7e]+$/);

export const CommandIntentRequestSchema = z
  .object({
    schema: z.literal("aiw.command-intent.request/0.7"),
    kind: z.literal("worker.enqueue-phase"),
    phaseId: VisibleAscii128Schema,
    harness: z.enum(["openclaw", "hermes", "claude-code", "codex"]),
    expectedRevision: VisibleAscii128Schema,
    fixture: z.literal("phase7-disposable-artifact-v1"),
  })
  .strict();

export const CommandIntentStateSchema = z.enum([
  "pending",
  "confirmed",
  "ambiguous",
  "rejected",
  "failed",
]);

export const WorkerLifecycleSchema = z.enum([
  "queued",
  "claimed",
  "running",
  "complete",
  "failed",
]);

export const FixtureArtifactResultSchema = z
  .object({
    path: z.literal("phase7-result.json"),
    before: z.null(),
    after: z
      .object({
        message: z.literal("AgentIntersect World Phase 7 fixture complete"),
        verified: z.literal(true),
      })
      .strict(),
    verification: z.enum(["pending", "passed", "failed", "unavailable"]),
  })
  .strict();

export const CommandIntentRecordSchema = z
  .object({
    schema: z.literal("aiw.command-intent/0.7"),
    id: z.uuid(),
    idempotencyKey: VisibleAscii128Schema,
    requestFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    request: CommandIntentRequestSchema,
    state: CommandIntentStateSchema,
    correlationId: VisibleAscii128Schema,
    phaseId: VisibleAscii128Schema,
    sessionId: VisibleAscii128Schema.optional(),
    jobId: VisibleAscii128Schema.optional(),
    runId: VisibleAscii128Schema.optional(),
    lifecycle: WorkerLifecycleSchema.optional(),
    diagnostics: z.array(z.string().max(512)).max(20),
    result: z.unknown().optional(),
    artifact: FixtureArtifactResultSchema.optional(),
    rawLogRef: z
      .string()
      .min(1)
      .max(256)
      .regex(/^(?![\\/])(?!.*\.\.)[\x20-\x7e]+$/)
      .optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const CommandIntentListDataSchema = z
  .object({ intents: z.array(CommandIntentRecordSchema).max(100) })
  .strict();

export type CommandIntentRequest = z.infer<typeof CommandIntentRequestSchema>;
export type CommandIntentState = z.infer<typeof CommandIntentStateSchema>;
export type WorkerLifecycle = z.infer<typeof WorkerLifecycleSchema>;
export type FixtureArtifactResult = z.infer<typeof FixtureArtifactResultSchema>;
export type CommandIntentRecord = z.infer<typeof CommandIntentRecordSchema>;
