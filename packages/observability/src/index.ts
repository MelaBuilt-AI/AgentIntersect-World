import { randomUUID } from "node:crypto";

import {
  CorrelationIdSchema,
  type ApiError,
  type ApiResult,
  type CorrelationId,
} from "@agentintersect-world/world-schema";
import { z } from "zod";

export const OBSERVABILITY_SCHEMA = "aiw.observability/0.17" as const;
export const OBSERVABILITY_EVENT_SCHEMA =
  "aiw.observability-event/0.17" as const;
export const OBSERVABILITY_STORE_SCHEMA =
  "aiw.observability-store/0.17" as const;

export const OBSERVABILITY_CAPABILITIES = [
  "session",
  "tool",
  "world-action",
  "preview",
  "voice",
  "worktree",
  "yjs",
  "sqlite",
] as const;

export const PHASE17_LIMITS = Object.freeze({
  events: 512,
  incidents: 32,
  exports: 3,
  exportBytes: 1024 * 1024,
  summaryBytes: 512,
  operationTimeoutMs: 30_000,
});

const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);
const timestamp = z.iso.datetime({ offset: true });
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const safeRelativeLabel = z
  .string()
  .min(1)
  .max(512)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !/^[A-Za-z]:[\\/]/.test(value) &&
      !value.split(/[\\/]/).includes("..") &&
      !value.includes("\0"),
    "Expected a sanitized relative label",
  );
const summary = z.string().min(1).max(PHASE17_LIMITS.summaryBytes);

export const CapabilitySchema = z.enum(OBSERVABILITY_CAPABILITIES);
export type ObservabilityCapability = z.infer<typeof CapabilitySchema>;
export const ReadinessStatusSchema = z.enum([
  "ready",
  "degraded",
  "unavailable",
  "recovery-needed",
]);
export type ReadinessStatus = z.infer<typeof ReadinessStatusSchema>;

export const CorrelationKeysSchema = z.strictObject({
  repositoryId: identifier,
  sessionId: identifier,
  agentId: z.enum(["mr-fluff", "beans"]),
  taskId: identifier,
  worktreeId: identifier,
  operationId: identifier,
  capability: CapabilitySchema,
  revision: z.number().int().nonnegative(),
});
export type CorrelationKeys = z.infer<typeof CorrelationKeysSchema>;

export const CapabilityReadinessSchema = z.strictObject({
  capability: CapabilitySchema,
  status: ReadinessStatusSchema,
  lastVerifiedAt: timestamp,
  lastVerifiedRevision: z.number().int().nonnegative(),
  evidence: summary,
  permittedAction: z.enum(["inspect", "recover", "retry", "none"]),
});
export type CapabilityReadiness = z.infer<typeof CapabilityReadinessSchema>;

export const OperationRecordSchema = z.strictObject({
  operationId: identifier,
  stage: z.enum(["tool", "edit", "test", "preview"]),
  state: z.enum(["started", "interrupted", "orphaned", "reconciled"]),
  correlation: CorrelationKeysSchema,
  commandSummary: summary,
  startedAt: timestamp,
  lastObservedAt: timestamp,
  childPid: z.number().int().positive().nullable(),
  owned: z.boolean(),
  completionRecorded: z.literal(false),
  reconciliation: z.enum(["pending", "required", "applied"]),
  recoveryRequestRevision: z.number().int().nonnegative().nullable(),
});
export type OperationRecord = z.infer<typeof OperationRecordSchema>;

export const IncidentSchema = z.strictObject({
  incidentId: identifier,
  kind: z.enum([
    "operation-interrupted",
    "operation-orphaned",
    "snapshot-corrupt",
    "derived-state-reconciled",
  ]),
  status: z.enum(["open", "recovered", "preserved"]),
  correlation: CorrelationKeysSchema,
  summary,
  occurredAt: timestamp,
  revision: z.number().int().nonnegative(),
  completionEvidence: z.literal(false),
});
export type ObservabilityIncident = z.infer<typeof IncidentSchema>;

export const DiagnosticPreviewSchema = z.strictObject({
  previewId: identifier,
  repositoryId: identifier,
  sessionId: identifier,
  revision: z.number().int().nonnegative(),
  createdAt: timestamp,
  safe: z.literal(true),
  summary: z.strictObject({
    overallReadiness: ReadinessStatusSchema,
    capabilityCounts: z.record(
      ReadinessStatusSchema,
      z.number().int().nonnegative(),
    ),
    incidentCount: z.number().int().nonnegative(),
    interruptedOperationCount: z.number().int().nonnegative(),
    lossWindow: summary,
  }),
  manifestFields: z.array(
    z.enum([
      "schema",
      "repositoryId",
      "sessionId",
      "revision",
      "truth",
      "readiness",
      "incidents",
      "lossWindow",
    ]),
  ),
  redactionProof: z.strictObject({
    allowlisted: z.literal(true),
    secretCanaryAbsent: z.literal(true),
    personaCanaryAbsent: z.literal(true),
    absolutePathsAbsent: z.literal(true),
  }),
});
export type DiagnosticPreview = z.infer<typeof DiagnosticPreviewSchema>;

export const DiagnosticExportRecordSchema = z.strictObject({
  exportId: identifier,
  previewId: identifier,
  relativePath: safeRelativeLabel,
  exportRequestRevision: z.number().int().nonnegative(),
  deleteRequestRevision: z.number().int().nonnegative().nullable(),
  checksum: digest,
  bytes: z.number().int().positive().max(PHASE17_LIMITS.exportBytes),
  createdAt: timestamp,
  deletedAt: timestamp.nullable(),
});
export type DiagnosticExportRecord = z.infer<
  typeof DiagnosticExportRecordSchema
>;

export const ObservabilityEventSchema = z.strictObject({
  schema: z.literal(OBSERVABILITY_EVENT_SCHEMA),
  sequence: z.number().int().positive(),
  eventId: identifier,
  kind: z.enum([
    "state-initialized",
    "operation-started",
    "operation-interrupted",
    "operation-orphaned",
    "recovery-previewed",
    "recovery-applied",
    "diagnostics-previewed",
    "diagnostics-exported",
    "diagnostics-deleted",
    "retention-pruned",
    "snapshot-corrupt-preserved",
  ]),
  correlation: CorrelationKeysSchema,
  occurredAt: timestamp,
  revision: z.number().int().nonnegative(),
  summary,
});
export type ObservabilityEvent = z.infer<typeof ObservabilityEventSchema>;

export const Phase17SnapshotSchema = z
  .strictObject({
    schema: z.literal(OBSERVABILITY_SCHEMA),
    revision: z.number().int().nonnegative(),
    truth: z.enum([
      "current",
      "previous-recovered",
      "rebuilt-derived",
      "unavailable",
    ]),
    repositoryId: identifier,
    sessionId: identifier,
    generatedAt: timestamp,
    currentState: summary,
    previousVerifiedState: summary,
    lossWindow: summary,
    readiness: z
      .array(CapabilityReadinessSchema)
      .length(OBSERVABILITY_CAPABILITIES.length),
    operations: z.array(OperationRecordSchema).max(64),
    incidents: z.array(IncidentSchema).max(PHASE17_LIMITS.incidents),
    diagnosticPreviews: z.array(DiagnosticPreviewSchema).max(3),
    exports: z.array(DiagnosticExportRecordSchema).max(PHASE17_LIMITS.exports),
  })
  .superRefine((value, context) => {
    const capabilities = value.readiness.map((row) => row.capability);
    if (
      capabilities.some(
        (capability, index) => capability !== OBSERVABILITY_CAPABILITIES[index],
      )
    )
      context.addIssue({
        code: "custom",
        path: ["readiness"],
        message: "Readiness rows must use the canonical capability order",
      });
  });
export type Phase17Snapshot = z.infer<typeof Phase17SnapshotSchema>;

export const Phase17ProjectionSchema = z.strictObject({
  schema: z.literal("aiw.observability-projection/0.17"),
  truth: Phase17SnapshotSchema.shape.truth,
  current: Phase17SnapshotSchema.nullable(),
  previous: Phase17SnapshotSchema.nullable(),
  recoverySource: z.enum(["current", "previous-recovered", "empty"]),
  preservedCorruptCurrent: safeRelativeLabel.nullable(),
});
export type Phase17Projection = z.infer<typeof Phase17ProjectionSchema>;

export type Phase17Seed = {
  readonly repositoryId: string;
  readonly sessionId: string;
  readonly now?: string;
  readonly revision?: number;
};

function initialReadiness(
  now: string,
  revision: number,
): CapabilityReadiness[] {
  return OBSERVABILITY_CAPABILITIES.map((capability) => {
    const unavailable = capability === "voice";
    return CapabilityReadinessSchema.parse({
      capability,
      status: unavailable ? "unavailable" : "ready",
      lastVerifiedAt: now,
      lastVerifiedRevision: revision,
      evidence: unavailable
        ? "Phase 15 local STT provider is staged but unactivated."
        : `${capability} production boundary verified for the local session.`,
      permittedAction: unavailable ? "none" : "inspect",
    });
  });
}

export function createPhase17Snapshot(seed: Phase17Seed): Phase17Snapshot {
  const now = seed.now ?? new Date().toISOString();
  const revision = seed.revision ?? 0;
  return Phase17SnapshotSchema.parse({
    schema: OBSERVABILITY_SCHEMA,
    revision,
    truth: "current",
    repositoryId: seed.repositoryId,
    sessionId: seed.sessionId,
    generatedAt: now,
    currentState: "Healthy exactly-two-agent coordination verified.",
    previousVerifiedState: "No previous Phase 17 snapshot.",
    lossWindow: "None.",
    readiness: initialReadiness(now, revision),
    operations: [],
    incidents: [],
    diagnosticPreviews: [],
    exports: [],
  });
}

export function deriveOverallReadiness(
  rows: readonly CapabilityReadiness[],
): ReadinessStatus {
  const nonVoice = rows.filter((row) => row.capability !== "voice");
  if (nonVoice.some((row) => row.status === "recovery-needed"))
    return "recovery-needed";
  if (nonVoice.some((row) => row.status === "unavailable"))
    return "unavailable";
  if (nonVoice.some((row) => row.status === "degraded")) return "degraded";
  return "ready";
}

const forbiddenField =
  /(?:rawPrompt|transcript|persona|memory|environment|credential|token|secret|rawDiff|sourceContent|absolutePath)/i;
const absolutePath =
  /(?<![:/\\A-Za-z0-9._-])(?:\/(?:[^/\s"'`,;:!?()[\]{}<>]+\/?)+|[A-Za-z]:[\\/](?:[^\\/\s"'`,;:!?()[\]{}<>]+[\\/]?)+|\\\\[^\\/\s"'`,;:!?()[\]{}<>]+\\[^\\/\s"'`,;:!?()[\]{}<>]+(?:\\[^\\/\s"'`,;:!?()[\]{}<>]+)*)/g;
const secretAssignment =
  /\b(?:api[_-]?key|token|secret|password|authorization)\s*[:=]\s*(?:bearer\s+)?[^\s,;]+/gi;
const canary = /\b(?:SECRET|PERSONA|MEMORY)[_-]?CANARY[^\s,;]*/gi;

export function redactDiagnosticSummary(input: string): string {
  const redacted = input
    .replace(absolutePath, "[redacted-path]")
    .replace(secretAssignment, "[redacted-secret]")
    .replace(canary, "[redacted-canary]")
    .replace(/\s+/g, " ")
    .trim();
  return Buffer.from(redacted, "utf8")
    .subarray(0, PHASE17_LIMITS.summaryBytes)
    .toString("utf8");
}

export function assertDiagnosticSafe(value: unknown): void {
  const inspect = (candidate: unknown, path: string): void => {
    if (Array.isArray(candidate)) {
      candidate.forEach((item, index) => inspect(item, `${path}[${index}]`));
      return;
    }
    if (candidate && typeof candidate === "object") {
      for (const [key, item] of Object.entries(candidate)) {
        if (
          forbiddenField.test(key) &&
          ![
            "secretCanaryAbsent",
            "personaCanaryAbsent",
            "absolutePathsAbsent",
          ].includes(key)
        )
          throw new Error(
            `Diagnostic field is not allowlisted: ${path}.${key}`,
          );
        inspect(item, `${path}.${key}`);
      }
      return;
    }
    if (typeof candidate !== "string") return;
    absolutePath.lastIndex = 0;
    secretAssignment.lastIndex = 0;
    canary.lastIndex = 0;
    if (
      absolutePath.test(candidate) ||
      secretAssignment.test(candidate) ||
      canary.test(candidate)
    )
      throw new Error(`Diagnostic value failed privacy validation: ${path}`);
  };
  inspect(value, "$");
}

export function canonicalObservabilityValue(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((item) => canonicalObservabilityValue(item)).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, item]) =>
          `${JSON.stringify(key)}:${canonicalObservabilityValue(item)}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}

export function createCorrelationId(): CorrelationId {
  return CorrelationIdSchema.parse(randomUUID());
}

export function ok<T>(data: T, correlationId: CorrelationId): ApiResult<T> {
  return { ok: true, data, meta: { correlationId, schema: "aiw.api/0.3" } };
}

export function unavailable(
  message: string,
  correlationId: CorrelationId,
): ApiError {
  return {
    ok: false,
    error: { code: "authority_unavailable", message, retryable: true },
    meta: { correlationId, schema: "aiw.api/0.3" },
  };
}
