import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  readdir,
  rename,
  unlink,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  DiagnosticExportRecordSchema,
  DiagnosticPreviewSchema,
  OBSERVABILITY_EVENT_SCHEMA,
  OBSERVABILITY_SCHEMA,
  OBSERVABILITY_STORE_SCHEMA,
  ObservabilityEventSchema,
  PHASE17_LIMITS,
  Phase17ProjectionSchema,
  Phase17SnapshotSchema,
  assertDiagnosticSafe,
  canonicalObservabilityValue,
  createPhase17Snapshot,
  deriveOverallReadiness,
  redactDiagnosticSummary,
  type CorrelationKeys,
  type DiagnosticExportRecord,
  type DiagnosticPreview,
  type ObservabilityEvent,
  type Phase17Projection,
  type Phase17Snapshot,
} from "@agentintersect-world/observability";
import { z } from "zod";

const StoreEnvelopeSchema = z.strictObject({
  schema: z.literal(OBSERVABILITY_STORE_SCHEMA),
  generation: z.number().int().positive(),
  payload: Phase17SnapshotSchema,
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});
type StoreEnvelope = z.infer<typeof StoreEnvelopeSchema>;
const PreviewEnvelopeSchema = z.strictObject({
  schema: z.literal("aiw.diagnostic-preview-store/0.17"),
  preview: DiagnosticPreviewSchema,
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});

const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);
const exactIdentity = z.strictObject({
  repositoryId: identifier,
  sessionId: identifier,
});
const initializeInput = exactIdentity.extend({
  bindings: z
    .array(
      z.strictObject({
        agentId: z.enum(["mr-fluff", "beans"]),
        taskId: identifier,
        worktreeId: identifier,
        worktreeLabel: z
          .string()
          .min(1)
          .max(512)
          .refine(
            (value) =>
              !isAbsolute(value) &&
              !value.split(/[\\/]/).includes("..") &&
              !value.includes("\0"),
            "Worktree labels must be sanitized repository-relative values",
          ),
      }),
    )
    .length(2)
    .refine(
      (bindings) =>
        new Set(bindings.map((binding) => binding.agentId)).size === 2 &&
        new Set(bindings.map((binding) => binding.taskId)).size === 2 &&
        new Set(bindings.map((binding) => binding.worktreeId)).size === 2,
      "Exactly two distinct agent/task/worktree bindings are required",
    ),
});
const operationInput = exactIdentity.extend({
  expectedRevision: z.number().int().nonnegative(),
  operationId: identifier,
  agentId: z.enum(["mr-fluff", "beans"]),
  taskId: identifier,
  worktreeId: identifier,
  capability: z.enum([
    "tool",
    "world-action",
    "preview",
    "session",
    "worktree",
    "yjs",
    "sqlite",
  ]),
  stage: z.enum(["tool", "edit", "test", "preview"]),
  commandSummary: z.string().min(1).max(2_048),
  operatorApproval: z.literal("approved"),
});
const exactOperation = exactIdentity.extend({
  expectedRevision: z.number().int().nonnegative(),
  operationId: identifier,
});
const applyInput = exactOperation.extend({
  operatorApproval: z.literal("approved"),
});
const terminateInput = exactOperation.extend({
  operatorApproval: z.literal("approved"),
});
const diagnosticInput = exactIdentity.extend({
  expectedRevision: z.number().int().nonnegative(),
});
const exportInput = diagnosticInput.extend({
  previewId: identifier,
  operatorApproval: z.literal("approved"),
});
const deleteInput = diagnosticInput.extend({
  exportId: identifier,
  operatorApproval: z.literal("approved"),
});

export type Phase17ServiceOptions = {
  readonly directory: string;
  readonly now?: () => string;
};

export type RecoveryPlan = {
  readonly schema: "aiw.recovery-plan/0.17";
  readonly repositoryId: string;
  readonly sessionId: string;
  readonly operationId: string;
  readonly basedOnRevision: number;
  readonly mutation: "none";
  readonly safeApplyActions: readonly [
    "mark-interrupted-orphaned",
    "reconcile-world-owned-process-record",
    "rebuild-derived-readiness",
  ];
  readonly forbiddenActions: readonly [
    "git-merge",
    "git-reset",
    "git-clean",
    "git-checkout",
    "delete-worktree",
    "fabricate-completion",
    "kill-unowned-process",
  ];
  readonly lossWindow: string;
  readonly digest: string;
};

export type ApplyRecoveryResult = {
  readonly snapshot: Phase17Snapshot;
  readonly replayed: boolean;
  readonly mutatedGit: false;
  readonly deletedWorktrees: false;
  readonly fabricatedCompletion: false;
};

export type ExportDiagnosticsResult = {
  readonly record: DiagnosticExportRecord;
  readonly replayed: boolean;
  readonly removedExportIds: readonly string[];
};

export type DeleteExportResult = {
  readonly exportId: string;
  readonly deleted: boolean;
  readonly absentAfterDelete: boolean;
  readonly replayed: boolean;
};

export class Phase17ServiceError extends Error {
  constructor(
    readonly code:
      | "validation"
      | "authority"
      | "not-found"
      | "conflict"
      | "unavailable"
      | "unsafe-path"
      | "privacy"
      | "resource-limit",
    message: string,
  ) {
    super(message);
    this.name = "Phase17ServiceError";
  }
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function envelopeFor(
  snapshot: Phase17Snapshot,
  generation: number,
): StoreEnvelope {
  return StoreEnvelopeSchema.parse({
    schema: OBSERVABILITY_STORE_SCHEMA,
    generation,
    payload: snapshot,
    checksum: sha256(canonicalObservabilityValue(snapshot)),
  });
}

function parseEnvelope(input: string): StoreEnvelope {
  const envelope = StoreEnvelopeSchema.parse(JSON.parse(input));
  if (
    envelope.checksum !== sha256(canonicalObservabilityValue(envelope.payload))
  )
    throw new Error("Phase 17 snapshot checksum mismatch");
  return envelope;
}

async function optionalRead(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === "ENOENT"
    )
      return null;
    throw error;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === "ENOENT"
    )
      return false;
    throw error;
  }
}

async function syncPath(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncDirectory(path: string): Promise<void> {
  try {
    await syncPath(path);
  } catch {
    // Directory fsync is not portable; same-directory rename remains atomic.
  }
}

function contained(parent: string, child: string): boolean {
  const result = relative(parent, child);
  return result === "" || (result !== ".." && !result.startsWith(`..${sep}`));
}

function eventCorrelation(
  snapshot: Phase17Snapshot,
  operationId = "phase17-state",
): CorrelationKeys {
  return {
    repositoryId: snapshot.repositoryId,
    sessionId: snapshot.sessionId,
    agentId: "mr-fluff",
    taskId: "phase17-recovery",
    worktreeId: "worktree-fluff",
    operationId,
    capability: "session",
    revision: snapshot.revision,
  };
}

export class Phase17Service {
  readonly #directory: string;
  readonly #currentPath: string;
  readonly #previousPath: string;
  readonly #ledgerPath: string;
  readonly #exportDirectory: string;
  readonly #corruptDirectory: string;
  readonly #previewPath: string;
  readonly #now: () => string;
  readonly #children = new Map<string, ChildProcess>();
  readonly #previews = new Map<string, DiagnosticPreview>();
  #loaded = false;
  #closed = false;
  #generation = 0;
  #current: Phase17Snapshot | null = null;
  #previous: Phase17Snapshot | null = null;
  #recoverySource: Phase17Projection["recoverySource"] = "empty";
  #preservedCorruptCurrent: string | null = null;
  #currentStoreValid = true;
  #events: ObservabilityEvent[] = [];
  #mutationTail: Promise<void> = Promise.resolve();

  constructor(options: Phase17ServiceOptions) {
    this.#directory = resolve(options.directory);
    this.#currentPath = join(this.#directory, "observability.current.json");
    this.#previousPath = join(this.#directory, "observability.previous.json");
    this.#ledgerPath = join(this.#directory, "events.jsonl");
    this.#exportDirectory = join(this.#directory, "exports");
    this.#corruptDirectory = join(this.#directory, "corrupt");
    this.#previewPath = join(
      this.#directory,
      "diagnostic-preview.current.json",
    );
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  pathsForTest(): {
    readonly root: string;
    readonly current: string;
    readonly previous: string;
    readonly ledger: string;
    readonly preview: string;
    readonly exports: string;
    readonly corrupt: string;
  } {
    return {
      root: this.#directory,
      current: this.#currentPath,
      previous: this.#previousPath,
      ledger: this.#ledgerPath,
      preview: this.#previewPath,
      exports: this.#exportDirectory,
      corrupt: this.#corruptDirectory,
    };
  }

  ownedProcessCount(): number {
    return this.#children.size;
  }

  async initialize(input: unknown): Promise<Phase17Snapshot> {
    const parsed = initializeInput.safeParse(input);
    if (!parsed.success)
      throw new Phase17ServiceError(
        "validation",
        parsed.error.issues[0]?.message ?? "Invalid Phase 17 initialization",
      );
    return this.#serialize(async () => {
      await this.#load();
      if (this.#current) {
        this.#assertIdentity(parsed.data, this.#current);
        return this.#current;
      }
      const snapshot = createPhase17Snapshot({
        repositoryId: parsed.data.repositoryId,
        sessionId: parsed.data.sessionId,
        now: this.#now(),
      });
      await this.#persist(snapshot);
      this.#current = snapshot;
      this.#recoverySource = "current";
      await this.#appendEvent(
        snapshot,
        "state-initialized",
        eventCorrelation(snapshot),
        "Healthy exactly-two-agent Phase 16 coordination fixture verified.",
      );
      return snapshot;
    });
  }

  async startOperation(input: unknown): Promise<Phase17Snapshot> {
    if (
      !input ||
      typeof input !== "object" ||
      (input as { operatorApproval?: unknown }).operatorApproval !== "approved"
    )
      throw new Phase17ServiceError(
        "authority",
        "Explicit operator approval is required to start a World-owned operation",
      );
    const parsed = operationInput.safeParse(input);
    if (!parsed.success)
      throw new Phase17ServiceError(
        "validation",
        parsed.error.issues[0]?.message ?? "Invalid bounded operation",
      );
    return this.#serialize(async () => {
      await this.#load();
      const current = this.#requireCurrent();
      this.#assertIdentity(parsed.data, current);
      this.#assertRevision(parsed.data.expectedRevision, current);
      if (
        current.operations.some(
          (item) => item.operationId === parsed.data.operationId,
        )
      )
        throw new Phase17ServiceError(
          "conflict",
          "Operation identity already exists",
        );
      const binding =
        parsed.data.agentId === "mr-fluff"
          ? { taskId: "task-fluff-doc", worktreeId: "worktree-fluff" }
          : { taskId: "task-beans-doc", worktreeId: "worktree-beans" };
      if (
        parsed.data.taskId !== binding.taskId ||
        parsed.data.worktreeId !== binding.worktreeId
      )
        throw new Phase17ServiceError(
          "conflict",
          "Operation agent/task/worktree correlation does not match the healthy fixture",
        );
      const child = spawn(
        process.execPath,
        ["-e", "setInterval(() => undefined, 1000);"],
        {
          shell: false,
          stdio: "ignore",
          env: { PATH: process.env.PATH },
        },
      );
      await new Promise<void>((resolveSpawn, reject) => {
        child.once("spawn", resolveSpawn);
        child.once("error", reject);
      });
      this.#children.set(parsed.data.operationId, child);
      const now = this.#now();
      const revision = current.revision + 1;
      const correlation: CorrelationKeys = {
        repositoryId: current.repositoryId,
        sessionId: current.sessionId,
        agentId: parsed.data.agentId,
        taskId: parsed.data.taskId,
        worktreeId: parsed.data.worktreeId,
        operationId: parsed.data.operationId,
        capability: parsed.data.capability,
        revision,
      };
      const next = Phase17SnapshotSchema.parse({
        ...current,
        revision,
        generatedAt: now,
        previousVerifiedState: current.currentState,
        currentState: "World-owned bounded operation started.",
        lossWindow: "Open from operation-started until a completion record.",
        operations: [
          ...current.operations,
          {
            operationId: parsed.data.operationId,
            stage: parsed.data.stage,
            state: "started",
            correlation,
            commandSummary: redactDiagnosticSummary(parsed.data.commandSummary),
            startedAt: now,
            lastObservedAt: now,
            childPid: child.pid ?? null,
            owned: true,
            completionRecorded: false,
            reconciliation: "pending",
            recoveryRequestRevision: null,
          },
        ],
        readiness: current.readiness.map((row) =>
          row.capability === parsed.data.capability
            ? {
                ...row,
                lastVerifiedAt: now,
                lastVerifiedRevision: revision,
                evidence: "World-owned operation is in progress.",
              }
            : row,
        ),
      });
      try {
        await this.#persist(next);
        this.#current = next;
        await this.#appendEvent(
          next,
          "operation-started",
          correlation,
          `Bounded ${parsed.data.stage} operation started; no completion recorded.`,
        );
      } catch (error) {
        if (child.exitCode === null) {
          const closed = new Promise<void>((resolveClose) =>
            child.once("close", () => resolveClose()),
          );
          child.kill("SIGTERM");
          await closed;
        }
        this.#children.delete(parsed.data.operationId);
        throw error;
      }
      return next;
    });
  }

  async terminateOwnedOperation(
    input: unknown,
  ): Promise<{ readonly killed: boolean; readonly replayed: boolean }> {
    if (
      !input ||
      typeof input !== "object" ||
      (input as { operatorApproval?: unknown }).operatorApproval !== "approved"
    )
      throw new Phase17ServiceError(
        "authority",
        "Explicit operator approval is required to terminate a World-owned operation",
      );
    const parsed = terminateInput.safeParse(input);
    if (!parsed.success)
      throw new Phase17ServiceError(
        "validation",
        "Invalid operation termination request",
      );
    return this.#serialize(async () => {
      await this.#load();
      const current = this.#requireCurrent();
      this.#assertIdentity(parsed.data, current);
      this.#assertRevision(parsed.data.expectedRevision, current);
      const operation = current.operations.find(
        (item) => item.operationId === parsed.data.operationId,
      );
      if (!operation)
        throw new Phase17ServiceError("not-found", "Operation was not found");
      if (!operation.owned)
        throw new Phase17ServiceError(
          "authority",
          "Only a World-owned operation may be terminated",
        );
      const child = this.#children.get(operation.operationId);
      if (!child) return { killed: false, replayed: true };
      if (child.pid !== operation.childPid)
        throw new Phase17ServiceError(
          "conflict",
          "Owned child identity does not match the authoritative operation record",
        );
      const closed = new Promise<void>((resolveClose) =>
        child.once("close", () => resolveClose()),
      );
      const killed = child.kill("SIGTERM");
      if (!killed)
        throw new Phase17ServiceError(
          "conflict",
          "World-owned child could not be terminated",
        );
      await closed;
      this.#children.delete(operation.operationId);
      return { killed: true, replayed: false };
    });
  }

  async inspect(input?: unknown): Promise<Phase17Projection> {
    await this.#load();
    if (input !== undefined && Object.keys(input as object).length > 0) {
      const parsed = exactIdentity.safeParse(input);
      if (!parsed.success)
        throw new Phase17ServiceError(
          "validation",
          "Invalid inspection identity",
        );
      if (this.#current) this.#assertIdentity(parsed.data, this.#current);
    }
    return this.#project();
  }

  async previewRecovery(input: unknown): Promise<RecoveryPlan> {
    const parsed = exactOperation.safeParse(input);
    if (!parsed.success)
      throw new Phase17ServiceError("validation", "Invalid recovery preview");
    await this.#load();
    const projected = this.#project().current;
    if (!projected)
      throw new Phase17ServiceError(
        "unavailable",
        "Phase 17 state is unavailable",
      );
    this.#assertIdentity(parsed.data, projected);
    this.#assertRevision(parsed.data.expectedRevision, projected);
    const operation = projected.operations.find(
      (item) => item.operationId === parsed.data.operationId,
    );
    if (!operation)
      throw new Phase17ServiceError("not-found", "Operation was not found");
    const planWithoutDigest = {
      schema: "aiw.recovery-plan/0.17" as const,
      repositoryId: projected.repositoryId,
      sessionId: projected.sessionId,
      operationId: operation.operationId,
      basedOnRevision: projected.revision,
      mutation: "none" as const,
      safeApplyActions: [
        "mark-interrupted-orphaned",
        "reconcile-world-owned-process-record",
        "rebuild-derived-readiness",
      ] as const,
      forbiddenActions: [
        "git-merge",
        "git-reset",
        "git-clean",
        "git-checkout",
        "delete-worktree",
        "fabricate-completion",
        "kill-unowned-process",
      ] as const,
      lossWindow: projected.lossWindow,
    };
    return {
      ...planWithoutDigest,
      digest: sha256(canonicalObservabilityValue(planWithoutDigest)),
    };
  }

  async applyRecovery(input: unknown): Promise<ApplyRecoveryResult> {
    if (
      !input ||
      typeof input !== "object" ||
      (input as { operatorApproval?: unknown }).operatorApproval !== "approved"
    )
      throw new Phase17ServiceError(
        "authority",
        "Explicit operator approval is required for safe recovery",
      );
    const parsed = applyInput.safeParse(input);
    if (!parsed.success)
      throw new Phase17ServiceError("validation", "Invalid recovery apply");
    return this.#serialize(async () => {
      await this.#load();
      const current = this.#requireCurrent();
      this.#assertIdentity(parsed.data, current);
      const existing = current.operations.find(
        (item) => item.operationId === parsed.data.operationId,
      );
      if (!existing)
        throw new Phase17ServiceError("not-found", "Operation was not found");
      if (existing.state === "reconciled") {
        if (existing.recoveryRequestRevision !== parsed.data.expectedRevision)
          throw new Phase17ServiceError(
            "conflict",
            "Recovery replay does not match the original request revision",
          );
        return {
          snapshot: current,
          replayed: true,
          mutatedGit: false,
          deletedWorktrees: false,
          fabricatedCompletion: false,
        };
      }
      this.#assertRevision(parsed.data.expectedRevision, current);
      if (this.#children.has(existing.operationId))
        throw new Phase17ServiceError(
          "conflict",
          "Owned operation is still running; recovery cannot classify it as orphaned",
        );
      const now = this.#now();
      const revision = current.revision + 1;
      const correlation = { ...existing.correlation, revision };
      const lossWindow =
        "Non-derivable work may be lost after operation-started and before termination; no completion evidence exists.";
      const incidentId = `incident-${existing.operationId}`;
      const next = Phase17SnapshotSchema.parse({
        ...current,
        revision,
        truth:
          this.#recoverySource === "previous-recovered"
            ? "rebuilt-derived"
            : "current",
        generatedAt: now,
        previousVerifiedState: current.currentState,
        currentState:
          "Recovered: derived process state reconciled; Git content and worktrees untouched.",
        lossWindow,
        operations: current.operations.map((operation) =>
          operation.operationId === existing.operationId
            ? {
                ...operation,
                state: "reconciled",
                correlation,
                childPid: null,
                lastObservedAt: now,
                completionRecorded: false,
                reconciliation: "applied",
                recoveryRequestRevision: parsed.data.expectedRevision,
              }
            : operation,
        ),
        incidents: [
          ...current.incidents.filter(
            (incident) => incident.incidentId !== incidentId,
          ),
          {
            incidentId,
            kind: "operation-orphaned",
            status: "recovered",
            correlation,
            summary:
              "Interrupted World-owned operation reconciled without completion or Git mutation.",
            occurredAt: now,
            revision,
            completionEvidence: false,
          },
        ].slice(-PHASE17_LIMITS.incidents),
        readiness: current.readiness.map((row) =>
          row.capability === existing.correlation.capability
            ? {
                ...row,
                status: "degraded",
                lastVerifiedAt: now,
                lastVerifiedRevision: revision,
                evidence:
                  "Recovered derived process state; non-derivable operation loss window remains.",
                permittedAction: "inspect",
              }
            : {
                ...row,
                lastVerifiedAt: now,
                lastVerifiedRevision: revision,
              },
        ),
      });
      await this.#persist(next);
      this.#current = next;
      await this.#appendEvent(
        next,
        "operation-orphaned",
        correlation,
        "World-owned operation classified orphaned; completion evidence remains absent.",
      );
      await this.#appendEvent(
        next,
        "recovery-applied",
        correlation,
        "Safe derived-state reconciliation applied; Git and worktrees unchanged.",
      );
      return {
        snapshot: next,
        replayed: false,
        mutatedGit: false,
        deletedWorktrees: false,
        fabricatedCompletion: false,
      };
    });
  }

  async previewDiagnostics(input: unknown): Promise<DiagnosticPreview> {
    const parsed = diagnosticInput.safeParse(input);
    if (!parsed.success)
      throw new Phase17ServiceError("validation", "Invalid diagnostic preview");
    await this.#load();
    const projected = this.#project().current;
    if (!projected)
      throw new Phase17ServiceError(
        "unavailable",
        "Phase 17 state is unavailable",
      );
    this.#assertIdentity(parsed.data, projected);
    this.#assertRevision(parsed.data.expectedRevision, projected);
    const statuses = [
      "ready",
      "degraded",
      "unavailable",
      "recovery-needed",
    ] as const;
    const capabilityCounts = Object.fromEntries(
      statuses.map((status) => [
        status,
        projected.readiness.filter((row) => row.status === status).length,
      ]),
    );
    const previewId = `preview-r${projected.revision}-${sha256(
      `${projected.repositoryId}:${projected.sessionId}:${projected.revision}`,
    ).slice(0, 12)}`;
    const preview = DiagnosticPreviewSchema.parse({
      previewId,
      repositoryId: projected.repositoryId,
      sessionId: projected.sessionId,
      revision: projected.revision,
      createdAt: this.#now(),
      safe: true,
      summary: {
        overallReadiness: deriveOverallReadiness(projected.readiness),
        capabilityCounts,
        incidentCount: projected.incidents.length,
        interruptedOperationCount: projected.operations.filter(
          (operation) =>
            operation.state === "interrupted" ||
            operation.state === "orphaned" ||
            operation.state === "reconciled",
        ).length,
        lossWindow: redactDiagnosticSummary(projected.lossWindow),
      },
      manifestFields: [
        "schema",
        "repositoryId",
        "sessionId",
        "revision",
        "truth",
        "readiness",
        "incidents",
        "lossWindow",
      ],
      redactionProof: {
        allowlisted: true,
        secretCanaryAbsent: true,
        personaCanaryAbsent: true,
        absolutePathsAbsent: true,
      },
    });
    assertDiagnosticSafe(preview);
    const previewEnvelope = {
      schema: "aiw.diagnostic-preview-store/0.17" as const,
      preview,
      checksum: sha256(canonicalObservabilityValue(preview)),
    };
    await this.#atomicWrite(
      this.#previewPath,
      `${JSON.stringify(PreviewEnvelopeSchema.parse(previewEnvelope), null, 2)}\n`,
    );
    this.#previews.set(preview.previewId, preview);
    return preview;
  }

  async exportDiagnostics(input: unknown): Promise<ExportDiagnosticsResult> {
    if (
      !input ||
      typeof input !== "object" ||
      (input as { operatorApproval?: unknown }).operatorApproval !== "approved"
    )
      throw new Phase17ServiceError(
        "authority",
        "Explicit operator approval is required for local diagnostic export",
      );
    const parsed = exportInput.safeParse(input);
    if (!parsed.success)
      throw new Phase17ServiceError("validation", "Invalid diagnostic export");
    return this.#serialize(async () => {
      await this.#load();
      const current = this.#requireCurrent();
      this.#assertIdentity(parsed.data, current);
      const exportId = `export-${parsed.data.previewId}`;
      const prior = current.exports.find(
        (record) => record.exportId === exportId,
      );
      if (prior && prior.deletedAt === null) {
        if (
          prior.previewId !== parsed.data.previewId ||
          prior.exportRequestRevision !== parsed.data.expectedRevision
        )
          throw new Phase17ServiceError(
            "conflict",
            "Export replay does not match the original preview revision receipt",
          );
        await this.#verifyExportIntegrity(prior);
        return {
          record: prior,
          replayed: true,
          removedExportIds: [],
        };
      }
      this.#assertRevision(parsed.data.expectedRevision, current);
      const preview =
        this.#previews.get(parsed.data.previewId) ??
        (await this.#readPersistedPreview(parsed.data.previewId));
      if (
        !preview ||
        preview.repositoryId !== current.repositoryId ||
        preview.sessionId !== current.sessionId ||
        preview.revision !== current.revision
      )
        throw new Phase17ServiceError(
          "privacy",
          "A matching successful diagnostic preview is required before export",
        );
      const projected = this.#project().current;
      if (!projected)
        throw new Phase17ServiceError(
          "unavailable",
          "Phase 17 state is unavailable",
        );
      const payload = {
        schema: OBSERVABILITY_SCHEMA,
        repositoryId: projected.repositoryId,
        sessionId: projected.sessionId,
        revision: projected.revision,
        truth: projected.truth,
        readiness: projected.readiness.map((row) => ({
          capability: row.capability,
          status: row.status,
          lastVerifiedAt: row.lastVerifiedAt,
          lastVerifiedRevision: row.lastVerifiedRevision,
          evidence: redactDiagnosticSummary(row.evidence),
          permittedAction: row.permittedAction,
        })),
        incidents: projected.incidents.map((incident) => ({
          incidentId: incident.incidentId,
          kind: incident.kind,
          status: incident.status,
          correlation: incident.correlation,
          summary: redactDiagnosticSummary(incident.summary),
          occurredAt: incident.occurredAt,
          revision: incident.revision,
          completionEvidence: false,
        })),
        lossWindow: redactDiagnosticSummary(projected.lossWindow),
      };
      assertDiagnosticSafe(payload);
      const json = `${JSON.stringify(payload, null, 2)}\n`;
      const markdown = this.#diagnosticMarkdown(payload);
      const bytes = Buffer.byteLength(json) + Buffer.byteLength(markdown);
      if (bytes > PHASE17_LIMITS.exportBytes)
        throw new Phase17ServiceError(
          "resource-limit",
          "Diagnostic bundle exceeds the 1 MiB ceiling",
        );
      await this.#ensureManagedDirectories();
      const relativePath = `${exportId}.json`;
      const jsonPath = await this.#managedExportPath(relativePath);
      const markdownPath = await this.#managedExportPath(`${exportId}.md`);
      await this.#atomicWrite(jsonPath, json);
      await this.#atomicWrite(markdownPath, markdown);
      const now = this.#now();
      const record = DiagnosticExportRecordSchema.parse({
        exportId,
        previewId: preview.previewId,
        relativePath,
        exportRequestRevision: parsed.data.expectedRevision,
        deleteRequestRevision: null,
        checksum: sha256(`${json}${markdown}`),
        bytes,
        createdAt: now,
        deletedAt: null,
      });
      const retained = [
        ...current.exports.filter((item) => item.exportId !== exportId),
        record,
      ].sort((left, right) =>
        left.createdAt === right.createdAt
          ? left.exportId.localeCompare(right.exportId)
          : left.createdAt.localeCompare(right.createdAt),
      );
      const removed = retained.splice(
        0,
        Math.max(0, retained.length - PHASE17_LIMITS.exports),
      );
      for (const removedRecord of removed)
        await this.#removeExportFiles(removedRecord.exportId);
      const revision = current.revision + 1;
      const next = Phase17SnapshotSchema.parse({
        ...current,
        revision,
        generatedAt: now,
        previousVerifiedState: current.currentState,
        currentState: "Privacy-safe diagnostic bundle exported locally.",
        exports: retained,
        readiness: current.readiness.map((row) => ({
          ...row,
          lastVerifiedAt: now,
          lastVerifiedRevision: revision,
        })),
      });
      await this.#persist(next);
      this.#current = next;
      await this.#appendEvent(
        next,
        "diagnostics-exported",
        eventCorrelation(next, exportId),
        `Local diagnostic export created; ${removed.length} older exports pruned.`,
      );
      return {
        record,
        replayed: false,
        removedExportIds: removed.map((item) => item.exportId),
      };
    });
  }

  async deleteExport(input: unknown): Promise<DeleteExportResult> {
    if (
      !input ||
      typeof input !== "object" ||
      (input as { operatorApproval?: unknown }).operatorApproval !== "approved"
    )
      throw new Phase17ServiceError(
        "authority",
        "Explicit operator approval is required to delete a local export",
      );
    const parsed = deleteInput.safeParse(input);
    if (!parsed.success)
      throw new Phase17ServiceError("validation", "Invalid export deletion");
    return this.#serialize(async () => {
      await this.#load();
      const current = this.#requireCurrent();
      this.#assertIdentity(parsed.data, current);
      const record = current.exports.find(
        (item) => item.exportId === parsed.data.exportId,
      );
      if (!record) {
        this.#assertRevision(parsed.data.expectedRevision, current);
        const removed = await this.#removeExportFiles(parsed.data.exportId);
        const absentAfterDelete = await this.#exportFilesAbsent(
          parsed.data.exportId,
        );
        if (!absentAfterDelete)
          throw new Phase17ServiceError(
            "conflict",
            "Deletion could not prove both managed export files absent",
          );
        return {
          exportId: parsed.data.exportId,
          deleted: removed,
          absentAfterDelete,
          replayed: !removed,
        };
      }
      const wasDeleted = record.deletedAt !== null;
      if (wasDeleted) {
        if (record.deleteRequestRevision !== parsed.data.expectedRevision)
          throw new Phase17ServiceError(
            "conflict",
            "Export deletion replay does not match the original request revision",
          );
        const removed = await this.#removeExportFiles(
          record.exportId,
          record.relativePath,
        );
        const absentAfterDelete = await this.#exportFilesAbsent(
          record.exportId,
          record.relativePath,
        );
        if (!absentAfterDelete)
          throw new Phase17ServiceError(
            "conflict",
            "Deletion replay could not prove both managed export files absent",
          );
        return {
          exportId: record.exportId,
          deleted: removed,
          absentAfterDelete,
          replayed: true,
        };
      }
      this.#assertRevision(parsed.data.expectedRevision, current);
      const removed = await this.#removeExportFiles(
        record.exportId,
        record.relativePath,
      );
      const absentAfterDelete = await this.#exportFilesAbsent(
        record.exportId,
        record.relativePath,
      );
      if (!absentAfterDelete)
        throw new Phase17ServiceError(
          "conflict",
          "Deletion could not prove both managed export files absent",
        );
      const now = this.#now();
      const revision = current.revision + 1;
      const next = Phase17SnapshotSchema.parse({
        ...current,
        revision,
        generatedAt: now,
        previousVerifiedState: current.currentState,
        currentState: "Managed local diagnostic export deleted with proof.",
        exports: current.exports.map((item) =>
          item.exportId === record.exportId
            ? {
                ...item,
                deletedAt: now,
                deleteRequestRevision: parsed.data.expectedRevision,
              }
            : item,
        ),
        readiness: current.readiness.map((row) => ({
          ...row,
          lastVerifiedAt: now,
          lastVerifiedRevision: revision,
        })),
      });
      await this.#persist(next);
      this.#current = next;
      await this.#appendEvent(
        next,
        "diagnostics-deleted",
        eventCorrelation(next, record.exportId),
        "Managed local diagnostic export deleted; absence verified.",
      );
      return {
        exportId: record.exportId,
        deleted: removed,
        absentAfterDelete,
        replayed: false,
      };
    });
  }

  eventCountForTest(): number {
    return this.#events.length;
  }

  async residueForTest(): Promise<{
    readonly ownedProcesses: number;
    readonly temporaryFiles: readonly string[];
  }> {
    await this.#ensureRoot();
    const names = await readdir(this.#directory);
    return {
      ownedProcesses: this.#children.size,
      temporaryFiles: names.filter((name) => name.endsWith(".tmp")),
    };
  }

  async #load(): Promise<void> {
    if (this.#loaded) return;
    await this.#ensureManagedDirectories();
    const currentPath = await this.#managedStatePath(
      "observability.current.json",
    );
    const previousPath = await this.#managedStatePath(
      "observability.previous.json",
    );
    await this.#managedStatePath("events.jsonl");
    await this.#managedStatePath("diagnostic-preview.current.json");
    this.#loaded = true;
    this.#events = await this.#loadEvents();
    const [currentText, previousText] = await Promise.all([
      optionalRead(currentPath),
      optionalRead(previousPath),
    ]);
    let previousEnvelope: StoreEnvelope | null = null;
    if (previousText)
      try {
        previousEnvelope = parseEnvelope(previousText);
        this.#previous = previousEnvelope.payload;
      } catch {
        previousEnvelope = null;
      }
    if (!currentText) {
      if (previousEnvelope) {
        this.#current = {
          ...previousEnvelope.payload,
          truth: "previous-recovered",
        };
        this.#generation = previousEnvelope.generation;
        this.#recoverySource = "previous-recovered";
        this.#currentStoreValid = false;
      }
      return;
    }
    try {
      const currentEnvelope = parseEnvelope(currentText);
      this.#current = currentEnvelope.payload;
      this.#generation = currentEnvelope.generation;
      this.#recoverySource = "current";
      return;
    } catch {
      this.#currentStoreValid = false;
      const digest = sha256(currentText).slice(0, 16);
      const relativePath = `corrupt/corrupt-current-${digest}.json`;
      const preserved = await this.#managedStatePath(relativePath);
      if (!(await exists(preserved))) await copyFile(currentPath, preserved);
      this.#preservedCorruptCurrent = relativePath;
      if (previousEnvelope) {
        this.#current = {
          ...previousEnvelope.payload,
          truth: "previous-recovered",
          currentState:
            "Previous verified state recovered; corrupt current preserved.",
          lossWindow:
            "Current snapshot is non-derivable; truth comes from previous verified state.",
        };
        this.#generation = previousEnvelope.generation;
        this.#recoverySource = "previous-recovered";
      }
    }
  }

  #project(): Phase17Projection {
    let current = this.#current;
    if (current) {
      const orphaned = current.operations.filter(
        (operation) =>
          operation.state === "started" &&
          !this.#children.has(operation.operationId),
      );
      if (orphaned.length > 0) {
        const operationIds = new Set(
          orphaned.map((operation) => operation.operationId),
        );
        const now = current.generatedAt;
        const incidents = [
          ...current.incidents.filter(
            (incident) => !operationIds.has(incident.correlation.operationId),
          ),
          ...orphaned.map((operation) => ({
            incidentId: `incident-${operation.operationId}`,
            kind: "operation-orphaned" as const,
            status: "open" as const,
            correlation: operation.correlation,
            summary:
              "World-owned operation has no living owner and no completion evidence.",
            occurredAt: operation.lastObservedAt,
            revision: current?.revision ?? 0,
            completionEvidence: false as const,
          })),
        ].slice(-PHASE17_LIMITS.incidents);
        current = Phase17SnapshotSchema.parse({
          ...current,
          currentState:
            "Degraded: World-owned operation interrupted/orphaned; no completion fabricated.",
          previousVerifiedState:
            this.#previous?.currentState ??
            "Healthy exactly-two-agent coordination verified.",
          lossWindow:
            "Non-derivable work may be lost after operation-started and before termination.",
          operations: current.operations.map((operation) =>
            operationIds.has(operation.operationId)
              ? {
                  ...operation,
                  state: "orphaned",
                  childPid: null,
                  completionRecorded: false,
                  reconciliation: "required",
                }
              : operation,
          ),
          incidents,
          readiness: current.readiness.map((row) =>
            orphaned.some(
              (operation) =>
                operation.correlation.capability === row.capability,
            )
              ? {
                  ...row,
                  status: "recovery-needed",
                  lastVerifiedAt: now,
                  evidence:
                    "Interrupted operation has no completion record; explicit safe recovery is required.",
                  permittedAction: "recover",
                }
              : row,
          ),
        });
      }
    }
    return Phase17ProjectionSchema.parse({
      schema: "aiw.observability-projection/0.17",
      truth: current?.truth ?? "unavailable",
      current,
      previous: this.#previous,
      recoverySource: this.#recoverySource,
      preservedCorruptCurrent: this.#preservedCorruptCurrent,
    });
  }

  #requireCurrent(): Phase17Snapshot {
    if (!this.#current)
      throw new Phase17ServiceError(
        "unavailable",
        "Phase 17 state is not initialized",
      );
    return this.#current;
  }

  #assertIdentity(
    input: { readonly repositoryId: string; readonly sessionId: string },
    snapshot: Phase17Snapshot,
  ): void {
    if (
      input.repositoryId !== snapshot.repositoryId ||
      input.sessionId !== snapshot.sessionId
    )
      throw new Phase17ServiceError(
        "conflict",
        "Repository/session identity does not match authoritative Phase 17 state",
      );
  }

  #assertRevision(expected: number, snapshot: Phase17Snapshot): void {
    if (expected !== snapshot.revision)
      throw new Phase17ServiceError(
        "conflict",
        `Expected revision ${expected}; current is ${snapshot.revision}`,
      );
  }

  #serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#mutationTail.then(operation, operation);
    this.#mutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async #persist(snapshot: Phase17Snapshot): Promise<void> {
    const currentPath = await this.#managedStatePath(
      "observability.current.json",
    );
    const previousPath = await this.#managedStatePath(
      "observability.previous.json",
    );
    const nextGeneration = this.#generation + 1;
    const encoded = `${JSON.stringify(
      envelopeFor(snapshot, nextGeneration),
      null,
      2,
    )}\n`;
    const temporary = await this.#managedStatePath(
      `.observability.${process.pid}.${nextGeneration}.tmp`,
    );
    await this.#atomicWrite(temporary, encoded, true);
    if (this.#currentStoreValid && (await exists(currentPath))) {
      const currentText = await readFile(currentPath, "utf8");
      parseEnvelope(currentText);
      await this.#atomicWrite(previousPath, currentText);
      await syncPath(previousPath);
      this.#previous = parseEnvelope(currentText).payload;
    }
    await rename(temporary, currentPath);
    await syncDirectory(this.#directory);
    this.#generation = nextGeneration;
    this.#currentStoreValid = true;
    this.#recoverySource = "current";
  }

  async #appendEvent(
    snapshot: Phase17Snapshot,
    kind: ObservabilityEvent["kind"],
    correlation: CorrelationKeys,
    summary: string,
  ): Promise<void> {
    const nextSequence = (this.#events.at(-1)?.sequence ?? 0) + 1;
    const event = ObservabilityEventSchema.parse({
      schema: OBSERVABILITY_EVENT_SCHEMA,
      sequence: nextSequence,
      eventId: `event-${String(nextSequence).padStart(6, "0")}`,
      kind,
      correlation: { ...correlation, revision: snapshot.revision },
      occurredAt: this.#now(),
      revision: snapshot.revision,
      summary: redactDiagnosticSummary(summary),
    });
    const candidates = [...this.#events, event];
    const removedCount =
      candidates.length <= PHASE17_LIMITS.events
        ? 0
        : candidates.length - (PHASE17_LIMITS.events - 1);
    const retained =
      removedCount === 0
        ? candidates
        : [
            ...candidates.slice(-(PHASE17_LIMITS.events - 1)),
            ObservabilityEventSchema.parse({
              schema: OBSERVABILITY_EVENT_SCHEMA,
              sequence: nextSequence + 1,
              eventId: `event-${String(nextSequence + 1).padStart(6, "0")}`,
              kind: "retention-pruned",
              correlation: { ...correlation, revision: snapshot.revision },
              occurredAt: this.#now(),
              revision: snapshot.revision,
              summary: `Removed ${removedCount} oldest bounded event ledger record${
                removedCount === 1 ? "" : "s"
              }.`,
            }),
          ];
    const encoded = retained.map((item) => JSON.stringify(item)).join("\n");
    const ledgerPath = await this.#managedStatePath("events.jsonl");
    await this.#atomicWrite(ledgerPath, `${encoded}\n`);
    this.#events = retained;
  }

  async #loadEvents(): Promise<ObservabilityEvent[]> {
    const ledgerPath = await this.#managedStatePath("events.jsonl");
    const text = await optionalRead(ledgerPath);
    if (!text) return [];
    try {
      return text
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => ObservabilityEventSchema.parse(JSON.parse(line)))
        .slice(-PHASE17_LIMITS.events);
    } catch {
      throw new Phase17ServiceError(
        "unavailable",
        "Phase 17 event ledger failed validation",
      );
    }
  }

  async #readPersistedPreview(
    expectedPreviewId: string,
  ): Promise<DiagnosticPreview | null> {
    const previewPath = await this.#managedStatePath(
      "diagnostic-preview.current.json",
    );
    const text = await optionalRead(previewPath);
    if (!text) return null;
    try {
      const envelope = PreviewEnvelopeSchema.parse(JSON.parse(text));
      if (
        envelope.checksum !==
        sha256(canonicalObservabilityValue(envelope.preview))
      )
        return null;
      assertDiagnosticSafe(envelope.preview);
      if (envelope.preview.previewId !== expectedPreviewId) return null;
      this.#previews.set(envelope.preview.previewId, envelope.preview);
      return envelope.preview;
    } catch {
      return null;
    }
  }

  async #ensureRoot(): Promise<void> {
    await mkdir(this.#directory, { recursive: true, mode: 0o700 });
    const information = await lstat(this.#directory);
    if (information.isSymbolicLink() || !information.isDirectory())
      throw new Phase17ServiceError(
        "unsafe-path",
        "Phase 17 state root must be a real directory",
      );
  }

  async #ensureManagedDirectories(): Promise<void> {
    await this.#ensureRoot();
    for (const directory of [this.#exportDirectory, this.#corruptDirectory]) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const information = await lstat(directory);
      if (information.isSymbolicLink() || !information.isDirectory())
        throw new Phase17ServiceError(
          "unsafe-path",
          "Managed Phase 17 directory cannot be a symlink",
        );
    }
  }

  async #managedStatePath(relativePath: string): Promise<string> {
    if (
      isAbsolute(relativePath) ||
      relativePath.split(/[\\/]/).includes("..") ||
      relativePath.includes("\0")
    )
      throw new Phase17ServiceError(
        "unsafe-path",
        "Managed Phase 17 path is unsafe",
      );
    await this.#ensureManagedDirectories();
    const target = resolve(this.#directory, relativePath);
    const root = await realpath(this.#directory);
    const parent = await realpath(dirname(target));
    if (!contained(root, target) || !contained(root, parent))
      throw new Phase17ServiceError(
        "unsafe-path",
        "Managed Phase 17 path escaped its state root",
      );
    if (await exists(target)) {
      const information = await lstat(target);
      if (information.isSymbolicLink())
        throw new Phase17ServiceError(
          "unsafe-path",
          "Managed Phase 17 target cannot be a symlink",
        );
    }
    return target;
  }

  async #managedExportPath(relativePath: string): Promise<string> {
    if (relativePath.includes("/") || relativePath.includes("\\"))
      throw new Phase17ServiceError(
        "unsafe-path",
        "Diagnostic export names cannot contain path separators",
      );
    return this.#managedStatePath(`exports/${relativePath}`);
  }

  async #atomicWrite(
    target: string,
    content: string,
    targetIsTemporary = false,
  ): Promise<void> {
    const relativeTarget = relative(this.#directory, resolve(target));
    const validatedTarget = await this.#managedStatePath(relativeTarget);
    if (validatedTarget !== resolve(target))
      throw new Phase17ServiceError(
        "unsafe-path",
        "Atomic persistence target escaped the Phase 17 state root",
      );
    const temporary = targetIsTemporary
      ? validatedTarget
      : await this.#managedStatePath(
          relative(
            this.#directory,
            join(
              dirname(validatedTarget),
              `.${process.pid}.${sha256(validatedTarget).slice(0, 8)}.tmp`,
            ),
          ),
        );
    const handle = await open(temporary, "w", 0o600);
    try {
      await handle.writeFile(content, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (!targetIsTemporary) {
      await rename(temporary, validatedTarget);
      await syncDirectory(dirname(validatedTarget));
    }
  }

  #diagnosticMarkdown(payload: {
    readonly schema: string;
    readonly repositoryId: string;
    readonly sessionId: string;
    readonly revision: number;
    readonly truth: string;
    readonly readiness: readonly {
      readonly capability: string;
      readonly status: string;
      readonly evidence: string;
    }[];
    readonly incidents: readonly {
      readonly incidentId: string;
      readonly kind: string;
      readonly status: string;
      readonly summary: string;
    }[];
    readonly lossWindow: string;
  }): string {
    const readiness = payload.readiness
      .map(
        (row) =>
          `- ${row.capability}: ${row.status} — ${redactDiagnosticSummary(
            row.evidence,
          )}`,
      )
      .join("\n");
    const incidents =
      payload.incidents.length === 0
        ? "- None."
        : payload.incidents
            .map(
              (incident) =>
                `- ${incident.incidentId}: ${incident.kind}/${incident.status} — ${redactDiagnosticSummary(
                  incident.summary,
                )}`,
            )
            .join("\n");
    return `# AgentIntersect World diagnostic\n\nSchema: ${payload.schema}\n\nRepository: ${payload.repositoryId}\nSession: ${payload.sessionId}\nRevision: ${payload.revision}\nTruth: ${payload.truth}\n\n## Readiness\n\n${readiness}\n\n## Incidents\n\n${incidents}\n\n## Loss window\n\n${redactDiagnosticSummary(payload.lossWindow)}\n`;
  }

  async #exportPairPaths(
    exportId: string,
    relativePath = `${exportId}.json`,
  ): Promise<{
    readonly jsonPath: string;
    readonly markdownPath: string;
  }> {
    if (!/^export-[A-Za-z0-9._:-]+$/.test(exportId))
      throw new Phase17ServiceError("unsafe-path", "Export identity is unsafe");
    if (relativePath !== `${exportId}.json`)
      throw new Phase17ServiceError(
        "conflict",
        "Export record does not name its exact managed JSON pair",
      );
    return {
      jsonPath: await this.#managedExportPath(relativePath),
      markdownPath: await this.#managedExportPath(`${exportId}.md`),
    };
  }

  async #verifyExportIntegrity(record: DiagnosticExportRecord): Promise<void> {
    const { jsonPath, markdownPath } = await this.#exportPairPaths(
      record.exportId,
      record.relativePath,
    );
    const [json, markdown] = await Promise.all([
      optionalRead(jsonPath),
      optionalRead(markdownPath),
    ]);
    if (json === null || markdown === null)
      throw new Phase17ServiceError(
        "conflict",
        "Managed diagnostic export integrity failed: both files are required",
      );
    const bytes = Buffer.byteLength(json) + Buffer.byteLength(markdown);
    if (
      bytes !== record.bytes ||
      sha256(`${json}${markdown}`) !== record.checksum
    )
      throw new Phase17ServiceError(
        "conflict",
        "Managed diagnostic export integrity failed: bytes or checksum changed",
      );
    try {
      assertDiagnosticSafe(JSON.parse(json));
      assertDiagnosticSafe(markdown);
    } catch {
      throw new Phase17ServiceError(
        "conflict",
        "Managed diagnostic export integrity failed privacy validation",
      );
    }
  }

  async #exportFilesAbsent(
    exportId: string,
    relativePath = `${exportId}.json`,
  ): Promise<boolean> {
    const { jsonPath, markdownPath } = await this.#exportPairPaths(
      exportId,
      relativePath,
    );
    return !(await exists(jsonPath)) && !(await exists(markdownPath));
  }

  async #removeExportFiles(
    exportId: string,
    relativePath = `${exportId}.json`,
  ): Promise<boolean> {
    const { jsonPath, markdownPath } = await this.#exportPairPaths(
      exportId,
      relativePath,
    );
    let removed = false;
    for (const path of [jsonPath, markdownPath]) {
      try {
        await unlink(path);
        removed = true;
      } catch (error) {
        if (
          !error ||
          typeof error !== "object" ||
          !("code" in error) ||
          (error as { code: unknown }).code !== "ENOENT"
        )
          throw error;
      }
    }
    return removed;
  }

  async dispose(): Promise<void> {
    this.#closed = true;
    const closes: Promise<void>[] = [];
    for (const child of this.#children.values()) {
      closes.push(
        new Promise((resolveClose) => {
          if (child.exitCode !== null) return resolveClose();
          child.once("close", () => resolveClose());
          child.kill("SIGTERM");
        }),
      );
    }
    await Promise.all(closes);
    this.#children.clear();
    await this.#mutationTail;
    if (this.#closed) return;
  }
}
