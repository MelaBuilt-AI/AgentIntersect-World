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
    phase: z.literal("Phase 14"),
    version: z.literal("0.14.0-phase14"),
    instanceName: z.string().min(1).max(80),
    networkScope: z.enum(["loopback", "lan"]),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65_535),
    demoOperationMaxMs: z.number().int().positive(),
    repositoryMaxFiles: z.number().int().min(1).max(10_000),
    agentIntersectReadEnabled: z.boolean(),
    agentIntersectCommandsEnabled: z.boolean(),
    agentSessionsEnabled: z.boolean(),
    presentationSync: z
      .object({
        enabled: z.literal(true),
        transport: z.enum(["ws/http", "wss/https"]),
        encrypted: z.boolean(),
        unencryptedLanWarning: z.boolean(),
        allowedOrigin: z.string().url(),
        allowedHost: z.string().min(1).max(300),
      })
      .strict(),
  })
  .strict();

export const ReadyDataSchema = z
  .object({
    service: z.literal("agentintersect-world-local-server"),
    status: z.literal("ready"),
    version: z.literal("0.14.0-phase14"),
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

export const RepositoryNpmResolutionEntrySchema = z
  .object({
    specifier: z.string().min(1).max(512),
    target: repositoryPathSchema(false).refine(
      (value) => value.startsWith("./") && !value.split("/").includes(".."),
      {
        message:
          "npm resolution targets must be bounded package-relative paths",
      },
    ),
  })
  .strict();

export const RepositoryNpmResolutionSchema = z
  .object({
    exports: z.array(RepositoryNpmResolutionEntrySchema).max(128),
    imports: z.array(RepositoryNpmResolutionEntrySchema).max(128),
    main: RepositoryNpmResolutionEntrySchema.shape.target.nullable(),
    module: RepositoryNpmResolutionEntrySchema.shape.target.nullable(),
    types: RepositoryNpmResolutionEntrySchema.shape.target.nullable(),
  })
  .strict();

export const RepositoryPackageSchema = z
  .object({
    path: repositoryPathSchema(false),
    kind: z.enum(["npm", "python", "cargo", "go", "maven"]),
    name: z.string().min(1).max(240).nullable(),
    npmResolution: RepositoryNpmResolutionSchema.nullable().optional(),
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
export type RepositoryNpmResolution = z.infer<
  typeof RepositoryNpmResolutionSchema
>;
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

export const EVIDENCE_MAX_CHANGED_PATHS = 256 as const;
export const EVIDENCE_MAX_TOTAL_DIFF_BYTES = 1024 * 1024;
export const EVIDENCE_MAX_FILE_DIFF_BYTES = 128 * 1024;
export const EVIDENCE_RETENTION_LIMIT = 20 as const;

const EvidenceHashSchema = z.string().regex(/^[0-9a-f]{64}$/);
const EvidenceGitHeadSchema = z.string().regex(/^[0-9a-f]{40,64}$/);

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes +=
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4;
  }
  return bytes;
}

export const EvidenceFileFingerprintSchema = z
  .object({
    path: repositoryPathSchema(false),
    size: z.number().int().nonnegative(),
    contentHash: EvidenceHashSchema.nullable(),
    binary: z.boolean(),
    oversized: z.boolean(),
    sanitizedText: z.string().max(EVIDENCE_MAX_FILE_DIFF_BYTES).optional(),
    redactions: z.number().int().nonnegative(),
    gitStatus: z.string().min(1).max(4).nullable(),
    objectRef: WorldObjectRefSchema.nullable(),
  })
  .strict()
  .superRefine((file, context) => {
    if (
      file.sanitizedText !== undefined &&
      utf8ByteLength(file.sanitizedText) > EVIDENCE_MAX_FILE_DIFF_BYTES
    )
      context.addIssue({
        code: "custom",
        message: "Sanitized baseline text exceeds the per-file byte bound",
      });
  });

export const EvidenceBaselineSchema = z
  .object({
    schema: z.literal("aiw.evidence-baseline/0.8"),
    intentId: z.uuid(),
    generationId: z.uuid(),
    generationFingerprint: EvidenceHashSchema,
    repositoryRef: WorldObjectRefSchema,
    git: z
      .object({
        present: z.boolean(),
        head: EvidenceGitHeadSchema.nullable(),
        dirty: z.boolean(),
      })
      .strict(),
    sealedAt: z.iso.datetime(),
    files: z.array(EvidenceFileFingerprintSchema).max(10_000),
  })
  .strict();

export const EvidenceContentMetadataSchema = z
  .object({
    size: z.number().int().nonnegative(),
    contentHash: EvidenceHashSchema.nullable(),
  })
  .strict();

export const EvidenceChangeSchema = z
  .object({
    path: repositoryPathSchema(false),
    previousPath: repositoryPathSchema(false).optional(),
    outcome: z.enum([
      "created",
      "modified",
      "deleted",
      "renamed",
      "binary",
      "reported",
    ]),
    observationLabel: z.literal("observed-in-window"),
    attribution: z.enum([
      "reported-and-confirmed",
      "ambiguous",
      "reported-unverified",
    ]),
    reported: z.boolean(),
    binary: z.boolean(),
    before: EvidenceContentMetadataSchema.nullable(),
    after: EvidenceContentMetadataSchema.nullable(),
    diff: z.string().max(EVIDENCE_MAX_FILE_DIFF_BYTES).optional(),
    diffBytes: z.number().int().min(0).max(EVIDENCE_MAX_FILE_DIFF_BYTES),
    truncated: z.boolean(),
    redactions: z.number().int().nonnegative(),
    objectRef: WorldObjectRefSchema.nullable(),
    objectState: z.enum(["live", "baseline", "tombstone", "unavailable"]),
    diagnostics: z.array(z.string().min(1).max(512)).max(10),
  })
  .strict();

export const EvidenceTestTruthSchema = z
  .object({
    state: z.enum(["passed", "failed", "not-run", "unavailable", "unverified"]),
    verification: z.enum(["verified", "reported", "unverified", "none"]),
    artifactPath: repositoryPathSchema(false).optional(),
    artifactHash: EvidenceHashSchema.optional(),
    reportedState: z.enum(["passed", "failed", "not-run"]).optional(),
    diagnostic: z.string().min(1).max(512),
  })
  .strict();

export const TestEvidenceArtifactSchema = z
  .object({
    schema: z.literal("aiw.test-evidence/0.8"),
    intentId: z.uuid(),
    jobId: VisibleAscii128Schema,
    runId: VisibleAscii128Schema,
    state: z.enum(["passed", "failed", "not-run"]),
  })
  .strict();

export const EvidenceRecordSchema = z
  .object({
    schema: z.literal("aiw.evidence/0.8"),
    intentId: z.uuid(),
    jobId: VisibleAscii128Schema,
    runId: VisibleAscii128Schema,
    lifecycle: z.enum(["complete", "failed"]),
    generationId: z.uuid(),
    generationFingerprint: EvidenceHashSchema,
    repositoryRef: WorldObjectRefSchema,
    observationWindow: z
      .object({
        openedAt: z.iso.datetime(),
        closedAt: z.iso.datetime(),
      })
      .strict(),
    attributionLabel: z.literal("observed-in-window"),
    changes: z.array(EvidenceChangeSchema).max(EVIDENCE_MAX_CHANGED_PATHS),
    bounds: z
      .object({
        maxChangedPaths: z.literal(EVIDENCE_MAX_CHANGED_PATHS),
        maxTotalDiffBytes: z.literal(EVIDENCE_MAX_TOTAL_DIFF_BYTES),
        maxFileDiffBytes: z.literal(EVIDENCE_MAX_FILE_DIFF_BYTES),
        changedPathsObserved: z.number().int().nonnegative(),
        changedPathsReturned: z
          .number()
          .int()
          .min(0)
          .max(EVIDENCE_MAX_CHANGED_PATHS),
        totalDiffBytes: z
          .number()
          .int()
          .min(0)
          .max(EVIDENCE_MAX_TOTAL_DIFF_BYTES),
        pathsTruncated: z.boolean(),
        diffTruncated: z.boolean(),
        redactions: z.number().int().nonnegative(),
      })
      .strict(),
    test: EvidenceTestTruthSchema,
    diagnostics: z.array(z.string().min(1).max(512)).max(20),
    completedAt: z.iso.datetime(),
  })
  .strict()
  .superRefine((record, context) => {
    const total = record.changes.reduce((bytes, change) => {
      const actual = utf8ByteLength(change.diff ?? "");
      if (actual !== change.diffBytes || actual > EVIDENCE_MAX_FILE_DIFF_BYTES)
        context.addIssue({
          code: "custom",
          path: ["changes", record.changes.indexOf(change), "diffBytes"],
          message:
            "Evidence diff byte count is invalid or exceeds the per-file bound",
        });
      return bytes + actual;
    }, 0);
    if (
      total > EVIDENCE_MAX_TOTAL_DIFF_BYTES ||
      total !== record.bounds.totalDiffBytes
    )
      context.addIssue({
        code: "custom",
        message:
          "Evidence text diff byte total is invalid or exceeds the record bound",
      });
    if (record.bounds.changedPathsReturned !== record.changes.length)
      context.addIssue({
        code: "custom",
        message:
          "Evidence changed-path count does not match the returned records",
      });
  });

export const EvidenceLookupQuerySchema = z
  .object({
    intentId: z.uuid().optional(),
    jobId: VisibleAscii128Schema.optional(),
    runId: VisibleAscii128Schema.optional(),
  })
  .strict()
  .refine(
    (query) =>
      [query.intentId, query.jobId, query.runId].filter(
        (value) => value !== undefined,
      ).length === 1,
    { message: "Exactly one of intentId, jobId, or runId is required" },
  );

export const EvidenceLookupDataSchema = z
  .object({
    current: EvidenceRecordSchema,
    previous: EvidenceRecordSchema.nullable(),
  })
  .strict();

export const EvidenceCurrentDataSchema = z
  .object({
    current: EvidenceRecordSchema.nullable(),
    previous: EvidenceRecordSchema.nullable(),
  })
  .strict();

export type EvidenceFileFingerprint = z.infer<
  typeof EvidenceFileFingerprintSchema
>;
export type EvidenceBaseline = z.infer<typeof EvidenceBaselineSchema>;
export type EvidenceChange = z.infer<typeof EvidenceChangeSchema>;
export type EvidenceTestTruth = z.infer<typeof EvidenceTestTruthSchema>;
export type TestEvidenceArtifact = z.infer<typeof TestEvidenceArtifactSchema>;
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
export type EvidenceLookupQuery = z.infer<typeof EvidenceLookupQuerySchema>;

export const CODE_GRAPH_SCHEMA_VERSION = "aiw.code-graph/0.10" as const;
export const SYMBOL_SCHEMA_VERSION = "aiw.symbol/0.10" as const;
export const DEPENDENCY_SCHEMA_VERSION = "aiw.dependency/0.10" as const;
export const CODE_GRAPH_MAX_SYMBOLS_PER_FILE = 2_000 as const;
export const CODE_GRAPH_MAX_DEPENDENCIES_PER_FILE = 2_000 as const;
export const CODE_GRAPH_MAX_DIAGNOSTICS_PER_FILE = 50 as const;
export const CODE_GRAPH_MAX_AGGREGATE_EDGES = 1_024 as const;
export const CODE_GRAPH_MAX_FOCUSED_SYMBOL_NODES = 512 as const;
export const CODE_GRAPH_MAX_VISIBLE_OBJECTS = 2_000 as const;
export const CODE_GRAPH_MAX_DOM_SYMBOL_ROWS = 200 as const;

export const CodeGraphConfidenceSchema = z.enum([
  "exact_file",
  "exact_workspace_package",
  "external",
  "ambiguous",
  "unresolved",
  "unsupported",
  "unavailable",
]);

const CodeGraphConfidenceListSchema = z
  .array(CodeGraphConfidenceSchema)
  .min(1)
  .max(7)
  .refine((values) => new Set(values).size === values.length, {
    message: "confidence values must be unique",
  });

const CodeGraphSafeTextSchema = z
  .string()
  .min(1)
  .max(WORLD_MAX_PATH_LENGTH)
  .refine(
    (value) =>
      Array.from(value).every((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint >= 32 && codePoint !== 127;
      }) &&
      !value.startsWith("/") &&
      !value.startsWith("\\\\") &&
      !/^[A-Za-z]:[\\/]/u.test(value),
    { message: "value must be safe path-private text" },
  );

export const SymbolIdSchema = z.string().regex(/^[0-9a-f]{32}$/u);
export const SymbolRefSchema = z
  .string()
  .regex(/^aiw:\/\/symbol\/[0-9a-f]{32}$/u);
export const DependencyIdSchema = z.string().regex(/^[0-9a-f]{32}$/u);
export const DependencyRefSchema = z
  .string()
  .regex(/^aiw:\/\/dependency\/[0-9a-f]{32}$/u);

export const SymbolLanguageSchema = z.enum([
  "typescript",
  "tsx",
  "javascript",
  "jsx",
]);

export const SymbolKindSchema = z.enum([
  "class",
  "interface",
  "type",
  "enum",
  "function",
  "method",
  "constructor",
  "variable",
  "namespace",
]);

export const SymbolPositionSchema = z
  .object({
    line: z.number().int().min(1).max(10_000_000),
    column: z.number().int().min(0).max(10_000_000),
  })
  .strict();

export const SymbolRecordSchema = z
  .object({
    schema: z.literal(SYMBOL_SCHEMA_VERSION),
    id: SymbolIdSchema,
    ref: SymbolRefSchema,
    fileRef: WorldObjectRefSchema,
    language: SymbolLanguageSchema,
    kind: SymbolKindSchema,
    name: CodeGraphSafeTextSchema.max(WORLD_MAX_NAME_LENGTH),
    qualifiedName: CodeGraphSafeTextSchema,
    duplicateOrdinal: z
      .number()
      .int()
      .min(0)
      .max(CODE_GRAPH_MAX_SYMBOLS_PER_FILE - 1),
    duplicateGroupKey: SymbolIdSchema,
    exported: z.boolean(),
    range: z
      .object({ start: SymbolPositionSchema, end: SymbolPositionSchema })
      .strict(),
    confidence: CodeGraphConfidenceListSchema,
  })
  .strict();

export const DependencyKindSchema = z.enum([
  "import",
  "export",
  "side_effect_import",
  "dynamic_import",
  "require",
]);

export const DependencyEdgeSchema = z
  .object({
    schema: z.literal(DEPENDENCY_SCHEMA_VERSION),
    id: DependencyIdSchema,
    ref: DependencyRefSchema,
    sourceFileRef: WorldObjectRefSchema,
    kind: DependencyKindSchema,
    specifier: CodeGraphSafeTextSchema.max(512),
    occurrenceOrdinal: z
      .number()
      .int()
      .min(0)
      .max(CODE_GRAPH_MAX_DEPENDENCIES_PER_FILE - 1),
    candidateRefs: z.array(WorldObjectRefSchema).max(128),
    confidence: CodeGraphConfidenceListSchema,
    cycleGroupId: SymbolIdSchema.nullable(),
  })
  .strict();

export const CodeGraphDiagnosticSchema = z
  .object({
    code: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/u),
    count: z.number().int().positive().max(1_000_000),
  })
  .strict();

export const FileGraphCoverageSchema = z
  .object({
    fileRef: WorldObjectRefSchema,
    language: SymbolLanguageSchema.nullable(),
    state: z.enum(["parsed", "fallback"]),
    confidence: CodeGraphConfidenceListSchema,
    fallbackReason: z
      .enum([
        "unsupported_extension",
        "grammar_unavailable",
        "grammar_mismatch",
        "source_unavailable",
        "invalid_utf8",
        "source_too_large",
        "syntax_error",
        "timeout",
        "worker_crash",
        "malformed_worker_response",
        "cancelled",
        "depth_exceeded",
        "symbol_limit_exceeded",
        "dependency_limit_exceeded",
      ])
      .nullable(),
    symbolCount: z.number().int().min(0).max(CODE_GRAPH_MAX_SYMBOLS_PER_FILE),
    dependencyCount: z
      .number()
      .int()
      .min(0)
      .max(CODE_GRAPH_MAX_DEPENDENCIES_PER_FILE),
    diagnostics: z
      .array(CodeGraphDiagnosticSchema)
      .max(CODE_GRAPH_MAX_DIAGNOSTICS_PER_FILE),
  })
  .strict()
  .superRefine((coverage, context) => {
    if (coverage.state === "parsed" && coverage.fallbackReason !== null)
      context.addIssue({
        code: "custom",
        message: "parsed coverage cannot have fallback",
      });
    if (
      coverage.state === "fallback" &&
      (coverage.fallbackReason === null ||
        coverage.symbolCount !== 0 ||
        coverage.dependencyCount !== 0)
    )
      context.addIssue({
        code: "custom",
        message: "fallback coverage must be whole-file and explicit",
      });
  });

export const CodeGraphCountsSchema = z
  .object({
    files: z.number().int().nonnegative().max(10_000),
    parsedFiles: z.number().int().nonnegative().max(10_000),
    symbols: z.number().int().nonnegative().max(20_000_000),
    dependencies: z.number().int().nonnegative().max(20_000_000),
  })
  .strict();

export const CodeGraphLimitsSchema = z
  .object({
    maxSymbolsPerFile: z.literal(CODE_GRAPH_MAX_SYMBOLS_PER_FILE),
    maxDependenciesPerFile: z.literal(CODE_GRAPH_MAX_DEPENDENCIES_PER_FILE),
    maxAggregateEdges: z.literal(CODE_GRAPH_MAX_AGGREGATE_EDGES),
    maxFocusedSymbolNodes: z.literal(CODE_GRAPH_MAX_FOCUSED_SYMBOL_NODES),
  })
  .strict();

export const CodeGraphSnapshotSchema = z
  .object({
    schema: z.literal(CODE_GRAPH_SCHEMA_VERSION),
    repositoryRef: WorldObjectRefSchema,
    generationId: z.uuid(),
    state: z.enum(["current", "previous"]),
    degraded: z.boolean(),
    coverage: z.array(FileGraphCoverageSchema).max(10_000),
    symbols: z.array(SymbolRecordSchema).max(20_000_000),
    dependencies: z.array(DependencyEdgeSchema).max(20_000_000),
    counts: CodeGraphCountsSchema,
    limits: CodeGraphLimitsSchema,
  })
  .strict();

export const FocusedFileGraphSchema = z
  .object({
    schema: z.literal(CODE_GRAPH_SCHEMA_VERSION),
    generationId: z.uuid(),
    state: z.enum(["current", "previous"]),
    fileRef: WorldObjectRefSchema,
    coverage: FileGraphCoverageSchema,
    symbols: z.array(SymbolRecordSchema).max(CODE_GRAPH_MAX_SYMBOLS_PER_FILE),
    dependencies: z
      .array(DependencyEdgeSchema)
      .max(CODE_GRAPH_MAX_DEPENDENCIES_PER_FILE),
    visibleSymbolNodes: z
      .array(SymbolRecordSchema)
      .max(CODE_GRAPH_MAX_FOCUSED_SYMBOL_NODES),
    truncated: z.boolean(),
  })
  .strict();

export const CodeGraphStatusSchema = CodeGraphSnapshotSchema.omit({
  symbols: true,
  dependencies: true,
});

export const CodeGraphCurrentDataSchema = z
  .object({
    current: CodeGraphStatusSchema.nullable(),
    previous: CodeGraphStatusSchema.nullable(),
    buildingGenerationId: z.uuid().nullable(),
    lastError: z
      .enum(["cancelled", "generation_failed", "cache_rebuild_required"])
      .nullable(),
  })
  .strict();

export const CodeGraphAggregateQuerySchema = z
  .object({
    lod: z.number().int().min(0).max(2),
    limit: z.number().int().min(1).max(CODE_GRAPH_MAX_AGGREGATE_EDGES),
  })
  .strict();

export const CodeGraphAggregateEdgeSchema = z
  .object({
    key: SymbolIdSchema,
    sourceRef: WorldObjectRefSchema,
    targetRef: WorldObjectRefSchema.nullable(),
    count: z.number().int().positive().max(20_000_000),
    confidence: CodeGraphConfidenceListSchema,
    cycleGroupId: SymbolIdSchema.nullable(),
  })
  .strict();

export const CodeGraphAggregateDataSchema = z
  .object({
    schema: z.literal(CODE_GRAPH_SCHEMA_VERSION),
    generationId: z.uuid(),
    lod: z.number().int().min(0).max(2),
    edges: z
      .array(CodeGraphAggregateEdgeSchema)
      .max(CODE_GRAPH_MAX_AGGREGATE_EDGES),
    totalEdges: z.number().int().nonnegative().max(20_000_000),
    truncated: z.boolean(),
  })
  .strict();

export const FocusedFileGraphQuerySchema = z
  .object({ lod: z.number().int().min(3).max(4) })
  .strict();

export type CodeGraphConfidence = z.infer<typeof CodeGraphConfidenceSchema>;
export type SymbolLanguage = z.infer<typeof SymbolLanguageSchema>;
export type SymbolKind = z.infer<typeof SymbolKindSchema>;
export type SymbolRecord = z.infer<typeof SymbolRecordSchema>;
export type DependencyKind = z.infer<typeof DependencyKindSchema>;
export type DependencyEdge = z.infer<typeof DependencyEdgeSchema>;
export type FileGraphCoverage = z.infer<typeof FileGraphCoverageSchema>;
export type CodeGraphSnapshot = z.infer<typeof CodeGraphSnapshotSchema>;
export type FocusedFileGraph = z.infer<typeof FocusedFileGraphSchema>;
export type CodeGraphStatus = z.infer<typeof CodeGraphStatusSchema>;
export type CodeGraphCurrentData = z.infer<typeof CodeGraphCurrentDataSchema>;
export type CodeGraphAggregateQuery = z.infer<
  typeof CodeGraphAggregateQuerySchema
>;
export type CodeGraphAggregateData = z.infer<
  typeof CodeGraphAggregateDataSchema
>;
