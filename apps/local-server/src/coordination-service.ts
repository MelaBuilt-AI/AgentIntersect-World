import { createHash } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

import {
  COORDINATION_LIMITS,
  CoordinationActionSchema,
  CoordinationProtocolError,
  CoordinationProjectionSchema,
  CoordinationSnapshotSchema,
  canonicalCoordinationValue,
  createEmptyCoordinationSnapshot,
  applyCoordinationAction,
  withServiceResult,
  type CoordinationAction,
  type CoordinationCleanupPlan,
  type CoordinationConflict,
  type CoordinationMergeCandidate,
  type CoordinationProjection,
  type CoordinationSnapshot,
  type CoordinationWorktree,
} from "@agentintersect-world/multi-agent-coordination";
import { z } from "zod";

const StoreEnvelopeSchema = z.strictObject({
  schema: z.literal("aiw.coordination-store/0.16"),
  generation: z.number().int().positive(),
  payload: CoordinationSnapshotSchema,
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});

const ReconciliationEnvelopeSchema = z.strictObject({
  coordinationSessionId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/),
  actor: z.literal("operator"),
  operatorApproval: z.literal("approved"),
});

type StoreEnvelope = z.infer<typeof StoreEnvelopeSchema>;
type GitResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

export type CoordinationServiceOptions = {
  readonly directory: string;
  readonly allowedWorktreeParent?: string;
};

export class CoordinationServiceError extends Error {
  constructor(
    readonly code:
      | "validation"
      | "invalid"
      | "authority"
      | "unavailable"
      | "conflict"
      | "revision_conflict"
      | "correlation_conflict"
      | "not-found"
      | "resource-limit"
      | "binding_mismatch"
      | "cancelled"
      | "git-refused"
      | "git-failed",
    message: string,
  ) {
    super(message);
    this.name = "CoordinationServiceError";
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function envelopeFor(
  snapshot: CoordinationSnapshot,
  generation: number,
): StoreEnvelope {
  return StoreEnvelopeSchema.parse({
    schema: "aiw.coordination-store/0.16",
    generation,
    payload: snapshot,
    checksum: sha256(canonicalCoordinationValue(snapshot)),
  });
}

function parseEnvelope(input: string): StoreEnvelope {
  const parsed = StoreEnvelopeSchema.parse(JSON.parse(input));
  if (parsed.checksum !== sha256(canonicalCoordinationValue(parsed.payload)))
    throw new Error("Coordination generation checksum mismatch");
  return parsed;
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

async function syncFile(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncDirectory(path: string): Promise<void> {
  try {
    await syncFile(path);
  } catch {
    // Directory fsync is not portable. Atomic same-directory rename remains.
  }
}

function contained(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== "..");
}

function displayGitFailure(result: GitResult): string {
  return (result.stderr || result.stdout || "Git operation failed")
    .trim()
    .slice(0, 512);
}

function normalizeGitOutput(value: string, maxBytes: number): string {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length <= maxBytes) return value;
  return bytes.subarray(0, maxBytes).toString("utf8");
}

function persistedRequest(request: CoordinationAction): CoordinationAction {
  const action = request.action;
  if (
    action.kind !== "worktree.create" &&
    action.kind !== "worktree.attach" &&
    action.kind !== "worktree.validate"
  )
    return request;
  return {
    ...request,
    action: {
      ...action,
      repositoryRoot: `local-path-sha256-${sha256(action.repositoryRoot)}`,
      worktreePath: `local-path-sha256-${sha256(action.worktreePath)}`,
    },
  };
}

function protocolErrorCode(
  code: CoordinationProtocolError["code"],
): CoordinationServiceError["code"] {
  switch (code) {
    case "revision_conflict":
      return "revision_conflict";
    case "correlation_conflict":
      return "correlation_conflict";
    case "resource_limit":
      return "resource-limit";
    case "binding_mismatch":
      return "binding_mismatch";
    case "not_found":
      return "not-found";
    case "cancelled":
      return "cancelled";
    case "invalid":
      return "invalid";
  }
}

export class CoordinationService {
  readonly #directory: string;
  readonly #allowedWorktreeParent: string | null;
  readonly #currentPath: string;
  readonly #previousPath: string;
  #loaded = false;
  #projection: CoordinationProjection = CoordinationProjectionSchema.parse({
    schema: "aiw.coordination-projection/0.16",
    truth: "current",
    snapshot: null,
    unavailableReason: null,
  });
  #generation = 0;
  #gitTail: Promise<void> = Promise.resolve();
  #activeChild: ChildProcess | null = null;
  #commonRepositoryId: string | null = null;
  #closed = false;

  constructor(options: CoordinationServiceOptions) {
    this.#directory = resolve(options.directory);
    this.#currentPath = join(this.#directory, "coordination.current.json");
    this.#previousPath = join(this.#directory, "coordination.previous.json");
    this.#allowedWorktreeParent = options.allowedWorktreeParent
      ? resolve(options.allowedWorktreeParent)
      : null;
  }

  pathsForTest(): { readonly current: string; readonly previous: string } {
    return { current: this.#currentPath, previous: this.#previousPath };
  }

  ownedProcessCount(): number {
    return this.#activeChild ? 1 : 0;
  }

  async snapshot(): Promise<CoordinationProjection> {
    await this.#load();
    return this.#projection;
  }

  async action(input: unknown): Promise<{
    readonly snapshot: CoordinationSnapshot;
    readonly replayed: boolean;
  }> {
    if (
      !input ||
      typeof input !== "object" ||
      (input as { operatorApproval?: unknown }).operatorApproval !== "approved"
    )
      throw new CoordinationServiceError(
        "authority",
        "Explicit operator approval is required",
      );
    const parsed = CoordinationActionSchema.safeParse(input);
    if (!parsed.success)
      throw new CoordinationServiceError(
        "validation",
        parsed.error.issues[0]?.message ?? "Invalid coordination action",
      );
    const request = parsed.data;
    await this.#load();
    if (this.#projection.truth === "unavailable")
      throw new CoordinationServiceError(
        "unavailable",
        "Coordination generations are unavailable; refusing mutation",
      );
    const current =
      this.#projection.snapshot ?? createEmptyCoordinationSnapshot();
    const existing = current.correlations.find(
      (record) => record.correlationId === request.correlationId,
    );
    if (existing) {
      if (
        existing.requestCanonical !==
        canonicalCoordinationValue(persistedRequest(request))
      )
        throw new CoordinationServiceError(
          "correlation_conflict",
          "Correlation ID was reused with different input",
        );
      return { snapshot: current, replayed: true };
    }
    try {
      this.#assertRequestState(current, request);
      const next = await this.#apply(current, request);
      await this.#persist(next);
      this.#projection = CoordinationProjectionSchema.parse({
        schema: "aiw.coordination-projection/0.16",
        truth: "current",
        snapshot: next,
        unavailableReason: null,
      });
      return { snapshot: next, replayed: false };
    } catch (error) {
      if (error instanceof CoordinationServiceError) throw error;
      if (error instanceof CoordinationProtocolError)
        throw new CoordinationServiceError(
          protocolErrorCode(error.code),
          error.message,
        );
      const code =
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: unknown }).code === "resource_limit"
          ? "resource-limit"
          : "conflict";
      throw new CoordinationServiceError(
        code,
        error instanceof Error ? error.message : "Coordination action failed",
      );
    }
  }

  async reconcile(input: unknown): Promise<CoordinationProjection> {
    if (
      !input ||
      typeof input !== "object" ||
      (input as { operatorApproval?: unknown }).operatorApproval !== "approved"
    )
      throw new CoordinationServiceError(
        "authority",
        "Explicit operator approval is required",
      );
    const parsed = ReconciliationEnvelopeSchema.safeParse(input);
    if (!parsed.success)
      throw new CoordinationServiceError(
        "validation",
        parsed.error.issues[0]?.message ?? "Invalid reconciliation request",
      );
    await this.#load();
    if (
      this.#projection.truth === "unavailable" ||
      !this.#projection.snapshot ||
      !this.#projection.snapshot.coordinationSessionId
    )
      throw new CoordinationServiceError(
        "unavailable",
        "Current coordination truth is unavailable for reconciliation",
      );
    if (
      parsed.data.coordinationSessionId !==
      this.#projection.snapshot.coordinationSessionId
    )
      throw new CoordinationServiceError(
        "git-refused",
        "Coordination session mismatch",
      );
    let snapshot = this.#projection.snapshot;
    const worktrees: CoordinationWorktree[] = [];
    for (const worktree of snapshot.worktrees) {
      try {
        const internal = this.#worktreePaths.get(worktree.worktreeId);
        if (!internal) {
          worktrees.push({ ...worktree, state: "stale" });
          continue;
        }
        worktrees.push(
          await this.#measureWorktree(
            worktree,
            internal.repositoryRoot,
            internal.worktreePath,
          ),
        );
      } catch (error) {
        const state =
          error instanceof CoordinationServiceError &&
          error.message.includes("different repository")
            ? "wrong-repository"
            : error &&
                typeof error === "object" &&
                "code" in error &&
                (error as { code: unknown }).code === "ENOENT"
              ? "deleted"
              : "unavailable";
        worktrees.push({ ...worktree, state });
      }
    }
    snapshot = CoordinationSnapshotSchema.parse({
      ...snapshot,
      worktrees,
    });
    this.#projection = CoordinationProjectionSchema.parse({
      ...this.#projection,
      snapshot,
    });
    return this.#projection;
  }

  readonly #worktreePaths = new Map<
    string,
    { readonly repositoryRoot: string; readonly worktreePath: string }
  >();

  async #load(): Promise<void> {
    if (this.#loaded) return;
    this.#loaded = true;
    await mkdir(this.#directory, { recursive: true, mode: 0o700 });
    const [currentText, previousText] = await Promise.all([
      optionalRead(this.#currentPath),
      optionalRead(this.#previousPath),
    ]);
    if (currentText === null && previousText === null) return;
    try {
      if (currentText === null) throw new Error("Current generation missing");
      const current = parseEnvelope(currentText);
      this.#generation = current.generation;
      this.#projection = CoordinationProjectionSchema.parse({
        schema: "aiw.coordination-projection/0.16",
        truth: "current",
        snapshot: current.payload,
        unavailableReason: null,
      });
      return;
    } catch (currentError) {
      try {
        if (previousText === null)
          throw new Error("Previous generation missing", {
            cause: currentError,
          });
        const previous = parseEnvelope(previousText);
        this.#generation = previous.generation;
        this.#projection = CoordinationProjectionSchema.parse({
          schema: "aiw.coordination-projection/0.16",
          truth: "previous-recovered",
          snapshot: previous.payload,
          unavailableReason: null,
        });
      } catch {
        this.#projection = CoordinationProjectionSchema.parse({
          schema: "aiw.coordination-projection/0.16",
          truth: "unavailable",
          snapshot: null,
          unavailableReason: `Both coordination generations failed validation: ${
            currentError instanceof Error
              ? currentError.message.slice(0, 240)
              : "unknown current error"
          }`,
        });
      }
    }
  }

  async #persist(snapshot: CoordinationSnapshot): Promise<void> {
    const nextGeneration = this.#generation + 1;
    const temporary = join(
      this.#directory,
      `.coordination.${process.pid}.${nextGeneration}.tmp`,
    );
    const encoded = `${JSON.stringify(
      envelopeFor(snapshot, nextGeneration),
      null,
      2,
    )}\n`;
    if (Buffer.byteLength(encoded) > COORDINATION_LIMITS.snapshotBytes)
      throw new CoordinationServiceError(
        "resource-limit",
        "Coordination store envelope exceeds its byte ceiling",
      );
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(encoded, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    const current = await optionalRead(this.#currentPath);
    if (current !== null && this.#projection.truth !== "previous-recovered") {
      parseEnvelope(current);
      await copyFile(this.#currentPath, this.#previousPath);
      await syncFile(this.#previousPath);
    }
    await rename(temporary, this.#currentPath);
    await syncDirectory(this.#directory);
    this.#generation = nextGeneration;
  }

  async #apply(
    snapshot: CoordinationSnapshot,
    request: CoordinationAction,
  ): Promise<CoordinationSnapshot> {
    const action = request.action;
    if (
      action.kind !== "worktree.create" &&
      action.kind !== "worktree.attach" &&
      action.kind !== "worktree.validate" &&
      action.kind !== "merge-candidate.prepare" &&
      action.kind !== "cleanup.preview"
    ) {
      if (action.kind === "coordination.cancel")
        this.#activeChild?.kill("SIGTERM");
      return applyCoordinationAction(snapshot, request);
    }
    if (action.kind === "worktree.create") {
      this.#preflightWorktreeBinding(snapshot, action, "create");
      await this.#validateCreatePaths(
        action.repositoryRoot,
        action.worktreePath,
      );
      this.#assertRepositoryBinding(
        snapshot,
        await this.#commonRepositoryIdentity(action.repositoryRoot),
      );
      const result = await this.#git([
        "-C",
        action.repositoryRoot,
        "worktree",
        "add",
        "-b",
        action.branch,
        action.worktreePath,
        action.startPoint,
      ]);
      if (result.exitCode !== 0)
        throw new CoordinationServiceError(
          "git-failed",
          displayGitFailure(result),
        );
      const measured = await this.#newWorktree(
        snapshot,
        action,
        action.repositoryRoot,
        action.worktreePath,
      );
      this.#worktreePaths.set(action.worktreeId, {
        repositoryRoot: await realpath(action.repositoryRoot),
        worktreePath: await realpath(action.worktreePath),
      });
      this.#commonRepositoryId = measured.commonRepositoryId;
      return this.#bindWorktree(
        snapshot,
        request,
        measured,
        "worktree-created",
      );
    }
    if (action.kind === "worktree.attach") {
      this.#preflightWorktreeBinding(snapshot, action, "attach");
      const measured = await this.#newWorktree(
        snapshot,
        action,
        action.repositoryRoot,
        action.worktreePath,
      );
      this.#worktreePaths.set(action.worktreeId, {
        repositoryRoot: await realpath(action.repositoryRoot),
        worktreePath: await realpath(action.worktreePath),
      });
      this.#commonRepositoryId = measured.commonRepositoryId;
      return this.#bindWorktree(
        snapshot,
        request,
        measured,
        "worktree-attached",
      );
    }
    if (action.kind === "worktree.validate") {
      const current = snapshot.worktrees.find(
        (value) => value.worktreeId === action.worktreeId,
      );
      if (!current)
        throw new CoordinationServiceError(
          "not-found",
          "Worktree is not registered",
        );
      this.#assertBinding(
        snapshot,
        action.agentId,
        action.nativeSessionId,
        current.taskId,
      );
      const internal = this.#worktreePaths.get(action.worktreeId);
      if (!internal)
        throw new CoordinationServiceError(
          "git-refused",
          "Worktree path is not attached; explicit worktree.attach is required",
        );
      const requestedRepository = await this.#validatedDirectory(
        action.repositoryRoot,
      );
      const requestedWorktree = await this.#validatedDirectory(
        action.worktreePath,
      );
      if (
        requestedRepository !== internal.repositoryRoot ||
        requestedWorktree !== internal.worktreePath
      )
        throw new CoordinationServiceError(
          "git-refused",
          "Validation cannot change an attached worktree path",
        );
      const measured = await this.#measureWorktree(
        current,
        internal.repositoryRoot,
        internal.worktreePath,
      );
      return withServiceResult(
        snapshot,
        persistedRequest(request),
        {
          worktrees: snapshot.worktrees.map((value) =>
            value.worktreeId === measured.worktreeId ? measured : value,
          ),
        },
        "worktree-validated",
        `${measured.worktreeId} ${measured.state}`,
      );
    }
    if (action.kind === "merge-candidate.prepare")
      return this.#prepareCandidate(snapshot, { ...request, action });
    const worktree = snapshot.worktrees.find(
      (value) => value.worktreeId === action.worktreeId,
    );
    if (!worktree || worktree.agentId !== action.agentId)
      throw new CoordinationServiceError(
        "not-found",
        "Worktree cleanup binding is unavailable",
      );
    const plan: CoordinationCleanupPlan = {
      cleanupPlanId: `cleanup-${action.worktreeId}`,
      agentId: action.agentId,
      worktreeId: action.worktreeId,
      displayPath: worktree.displayPath,
      branch: worktree.branch,
      recommendation:
        worktree.state === "dirty"
          ? "refused-dirty"
          : worktree.state === "stale" ||
              worktree.state === "missing" ||
              worktree.state === "deleted"
            ? "refused-stale"
            : "allowed",
      reasons:
        worktree.state === "current"
          ? ["Clean registered worktree; operator may remove it outside World."]
          : [
              `Worktree state is ${worktree.state}; automatic removal forbidden.`,
            ],
      previewOnly: true,
      createdAt: new Date().toISOString(),
    };
    return withServiceResult(
      snapshot,
      request,
      {
        cleanupPlans: [
          ...snapshot.cleanupPlans.filter(
            (value) => value.worktreeId !== plan.worktreeId,
          ),
          plan,
        ],
      },
      "cleanup-previewed",
      `${worktree.worktreeId} cleanup preview only`,
    );
  }

  #assertBinding(
    snapshot: CoordinationSnapshot,
    agent: "mr-fluff" | "beans",
    nativeSessionId: string,
    taskId: string,
  ): void {
    const binding = snapshot.agents.find((value) => value.agentId === agent);
    if (
      !binding ||
      binding.nativeSessionId !== nativeSessionId ||
      binding.assignedTaskId !== taskId
    )
      throw new CoordinationServiceError(
        "git-refused",
        "Agent, native-session, and task binding mismatch",
      );
  }

  #assertRequestState(
    snapshot: CoordinationSnapshot,
    request: CoordinationAction,
  ): void {
    if (request.expectedRevision !== snapshot.revision)
      throw new CoordinationServiceError(
        "revision_conflict",
        `Expected revision ${request.expectedRevision}; current is ${snapshot.revision}`,
      );
    if (
      snapshot.coordinationSessionId &&
      request.coordinationSessionId !== snapshot.coordinationSessionId
    )
      throw new CoordinationServiceError(
        "binding_mismatch",
        "Coordination session mismatch",
      );
    if (snapshot.cancelled && request.action.kind !== "cleanup.preview")
      throw new CoordinationServiceError(
        "cancelled",
        "Coordination is cancelled",
      );
  }

  #preflightWorktreeBinding(
    snapshot: CoordinationSnapshot,
    action: Extract<
      CoordinationAction["action"],
      { kind: "worktree.create" | "worktree.attach" }
    >,
    operation: "create" | "attach",
  ): void {
    this.#assertBinding(
      snapshot,
      action.agentId,
      action.nativeSessionId,
      action.taskId,
    );
    const existing = snapshot.worktrees.find(
      (value) => value.worktreeId === action.worktreeId,
    );
    if (operation === "create" && existing)
      throw new CoordinationServiceError(
        "git-refused",
        "Worktree identity is already registered",
      );
    if (snapshot.worktrees.length >= COORDINATION_LIMITS.worktrees && !existing)
      throw new CoordinationServiceError(
        "resource-limit",
        "Two-worktree ceiling reached",
      );
    if (
      snapshot.worktrees.some(
        (value) =>
          value.agentId === action.agentId &&
          value.worktreeId !== action.worktreeId,
      )
    )
      throw new CoordinationServiceError(
        "git-refused",
        "Agent already owns another worktree",
      );
    const binding = snapshot.agents.find(
      (value) => value.agentId === action.agentId,
    );
    if (
      (binding?.worktreeId && binding.worktreeId !== action.worktreeId) ||
      (existing &&
        (existing.agentId !== action.agentId ||
          existing.nativeSessionId !== action.nativeSessionId ||
          existing.taskId !== action.taskId ||
          existing.branch !== action.branch ||
          existing.displayPath !== action.displayPath))
    )
      throw new CoordinationServiceError(
        "git-refused",
        "Existing worktree ownership cannot be rebound",
      );
  }

  async #newWorktree(
    snapshot: CoordinationSnapshot,
    action: Extract<
      CoordinationAction["action"],
      { kind: "worktree.create" | "worktree.attach" }
    >,
    repositoryRoot: string,
    worktreePath: string,
  ): Promise<CoordinationWorktree> {
    const base: CoordinationWorktree = {
      worktreeId: action.worktreeId,
      agentId: action.agentId,
      nativeSessionId: action.nativeSessionId,
      taskId: action.taskId,
      repositoryId: snapshot.repositoryId ?? "unavailable",
      displayPath: action.displayPath,
      branch: action.branch,
      head: "unavailable",
      commonRepositoryId: "unavailable",
      state: "unavailable",
      statusSummary: "Not measured",
      validatedAt: new Date().toISOString(),
    };
    const measured = await this.#measureWorktree(
      base,
      repositoryRoot,
      worktreePath,
    );
    this.#assertRepositoryBinding(snapshot, measured.commonRepositoryId);
    return measured;
  }

  async #validateCreatePaths(
    repositoryRoot: string,
    worktreePath: string,
  ): Promise<void> {
    const repository = await this.#validatedDirectory(repositoryRoot);
    if (!isAbsolute(worktreePath))
      throw new CoordinationServiceError(
        "git-refused",
        "Worktree path must be absolute",
      );
    const parent = await this.#validatedDirectory(dirname(worktreePath));
    const allowed = this.#allowedWorktreeParent
      ? await this.#validatedDirectory(this.#allowedWorktreeParent)
      : dirname(repository);
    if (!contained(allowed, parent))
      throw new CoordinationServiceError(
        "git-refused",
        "Worktree path is outside the allowed parent",
      );
    try {
      await lstat(worktreePath);
      throw new CoordinationServiceError(
        "git-refused",
        "New worktree path already exists",
      );
    } catch (error) {
      if (error instanceof CoordinationServiceError) throw error;
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        (error as { code: unknown }).code !== "ENOENT"
      )
        throw error;
    }
  }

  async #validatedDirectory(path: string): Promise<string> {
    if (!isAbsolute(path))
      throw new CoordinationServiceError(
        "git-refused",
        "Git roots must be absolute",
      );
    const information = await lstat(path);
    if (information.isSymbolicLink() || !information.isDirectory())
      throw new CoordinationServiceError(
        "git-refused",
        "Git root must be a real directory",
      );
    return realpath(path);
  }

  async #commonDirectory(repositoryRoot: string): Promise<string> {
    const result = await this.#git([
      "-C",
      repositoryRoot,
      "rev-parse",
      "--git-common-dir",
    ]);
    if (result.exitCode !== 0)
      throw new CoordinationServiceError(
        "git-refused",
        "Directory is not a valid Git worktree",
      );
    const raw = result.stdout.trim();
    return realpath(isAbsolute(raw) ? raw : resolve(repositoryRoot, raw));
  }

  async #commonRepositoryIdentity(repositoryRoot: string): Promise<string> {
    const validatedRoot = await this.#validatedDirectory(repositoryRoot);
    const commonDirectory = await this.#commonDirectory(validatedRoot);
    return `git-${sha256(commonDirectory).slice(0, 24)}`;
  }

  #assertRepositoryBinding(
    snapshot: CoordinationSnapshot,
    requestedCommonRepositoryId: string,
  ): void {
    const persistedRepositoryIds = new Set(
      snapshot.worktrees.map((worktree) => worktree.commonRepositoryId),
    );
    if (
      (this.#commonRepositoryId &&
        this.#commonRepositoryId !== requestedCommonRepositoryId) ||
      [...persistedRepositoryIds].some(
        (persisted) => persisted !== requestedCommonRepositoryId,
      )
    )
      throw new CoordinationServiceError(
        "git-refused",
        "Coordination session is bound to a different repository",
      );
  }

  async #measureWorktree(
    worktree: CoordinationWorktree,
    repositoryRootInput: string,
    worktreePathInput: string,
  ): Promise<CoordinationWorktree> {
    const repositoryRoot = await this.#validatedDirectory(repositoryRootInput);
    const worktreePath = await this.#validatedDirectory(worktreePathInput);
    if (repositoryRoot === worktreePath)
      throw new CoordinationServiceError(
        "git-refused",
        "Repository root cannot be used as an editing worktree",
      );
    if (
      [...this.#worktreePaths.entries()].some(
        ([worktreeId, paths]) =>
          worktreeId !== worktree.worktreeId &&
          paths.worktreePath === worktreePath,
      )
    )
      throw new CoordinationServiceError(
        "git-refused",
        "Real worktree path is already attached to another identity",
      );
    const allowed = this.#allowedWorktreeParent
      ? await this.#validatedDirectory(this.#allowedWorktreeParent)
      : dirname(repositoryRoot);
    if (!contained(allowed, worktreePath))
      throw new CoordinationServiceError(
        "git-refused",
        "Worktree is outside the allowed parent",
      );
    const [repositoryCommon, worktreeCommon] = await Promise.all([
      this.#commonDirectory(repositoryRoot),
      this.#commonDirectory(worktreePath),
    ]);
    if (repositoryCommon !== worktreeCommon)
      throw new CoordinationServiceError(
        "git-refused",
        "Worktree belongs to a different repository",
      );
    const registered = await this.#git([
      "-C",
      repositoryRoot,
      "worktree",
      "list",
      "--porcelain",
    ]);
    if (
      registered.exitCode !== 0 ||
      !registered.stdout
        .split(/\r?\n/)
        .some((line) => line === `worktree ${worktreePath}`)
    )
      throw new CoordinationServiceError(
        "git-refused",
        "Worktree is not registered in the repository worktree list",
      );
    const branchResult = await this.#git([
      "-C",
      worktreePath,
      "rev-parse",
      "--abbrev-ref",
      "HEAD",
    ]);
    const headResult = await this.#git([
      "-C",
      worktreePath,
      "rev-parse",
      "HEAD",
    ]);
    const statusResult = await this.#git([
      "-C",
      worktreePath,
      "status",
      "--porcelain=v2",
      "--untracked-files=normal",
    ]);
    if (
      branchResult.exitCode !== 0 ||
      headResult.exitCode !== 0 ||
      statusResult.exitCode !== 0
    )
      throw new CoordinationServiceError(
        "git-failed",
        "Could not measure worktree branch, HEAD, and status",
      );
    const branch = branchResult.stdout.trim();
    const dirty = statusResult.stdout.trim().length > 0;
    const wrongBranch = branch !== worktree.branch;
    return {
      ...worktree,
      head: headResult.stdout.trim(),
      commonRepositoryId: `git-${sha256(repositoryCommon).slice(0, 24)}`,
      state: wrongBranch ? "wrong-branch" : dirty ? "dirty" : "current",
      statusSummary: wrongBranch
        ? `Expected ${worktree.branch}; found ${branch}`
        : dirty
          ? normalizeGitOutput(statusResult.stdout.trim(), 2_048)
          : "clean",
      validatedAt: new Date().toISOString(),
    };
  }

  #bindWorktree(
    snapshot: CoordinationSnapshot,
    request: CoordinationAction,
    worktree: CoordinationWorktree,
    kind: "worktree-created" | "worktree-attached",
  ): CoordinationSnapshot {
    const worktrees = [
      ...snapshot.worktrees.filter(
        (value) => value.worktreeId !== worktree.worktreeId,
      ),
      worktree,
    ];
    const agents = snapshot.agents.map((value) =>
      value.agentId === worktree.agentId
        ? { ...value, worktreeId: worktree.worktreeId }
        : value,
    );
    const withWorktree = withServiceResult(
      snapshot,
      persistedRequest(request),
      { worktrees },
      kind,
      `${worktree.agentId} ${worktree.displayPath} ${worktree.state}`,
    );
    return CoordinationSnapshotSchema.parse({
      ...withWorktree,
      agents,
      ownership: [
        ...withWorktree.ownership.filter(
          (value) => value.ownershipId !== `ownership-${worktree.worktreeId}`,
        ),
        {
          ownershipId: `ownership-${worktree.worktreeId}`,
          agentId: worktree.agentId,
          nativeSessionId: worktree.nativeSessionId,
          taskId: worktree.taskId,
          targetKind: "worktree",
          target: worktree.worktreeId,
          state: "active",
        },
      ],
    });
  }

  async #prepareCandidate(
    snapshot: CoordinationSnapshot,
    request: CoordinationAction & {
      readonly action: Extract<
        CoordinationAction["action"],
        { kind: "merge-candidate.prepare" }
      >;
    },
  ): Promise<CoordinationSnapshot> {
    const action = request.action;
    if (
      action.sourceAgentId === action.targetAgentId ||
      action.sourceTaskId === action.targetTaskId ||
      action.sourceWorktreeId === action.targetWorktreeId
    )
      throw new CoordinationServiceError(
        "git-refused",
        "Candidate source and target identities must be distinct",
      );
    const suppliedTestIds = action.testEvidence.map((value) => value.testId);
    if (
      new Set(suppliedTestIds).size !== suppliedTestIds.length ||
      suppliedTestIds.some((testId) =>
        snapshot.testEvidence.some((value) => value.testId === testId),
      )
    )
      throw new CoordinationServiceError(
        "git-refused",
        "Candidate test evidence identities must be new and distinct",
      );
    const source = snapshot.worktrees.find(
      (value) => value.worktreeId === action.sourceWorktreeId,
    );
    const target = snapshot.worktrees.find(
      (value) => value.worktreeId === action.targetWorktreeId,
    );
    const sourcePaths = this.#worktreePaths.get(action.sourceWorktreeId);
    const targetPaths = this.#worktreePaths.get(action.targetWorktreeId);
    if (!source || !target || !sourcePaths || !targetPaths)
      throw new CoordinationServiceError(
        "not-found",
        "Candidate worktree bindings are unavailable",
      );
    if (
      source.agentId !== action.sourceAgentId ||
      target.agentId !== action.targetAgentId ||
      source.taskId !== action.sourceTaskId ||
      target.taskId !== action.targetTaskId ||
      source.commonRepositoryId !== target.commonRepositoryId
    )
      throw new CoordinationServiceError(
        "git-refused",
        "Candidate binding mismatch",
      );
    const measuredSource = await this.#measureWorktree(
      source,
      sourcePaths.repositoryRoot,
      sourcePaths.worktreePath,
    );
    const measuredTarget = await this.#measureWorktree(
      target,
      targetPaths.repositoryRoot,
      targetPaths.worktreePath,
    );
    const exactBindings = [measuredSource, measuredTarget];
    for (const record of action.testEvidence) {
      const exact = exactBindings.some(
        (worktree) =>
          record.agentId === worktree.agentId &&
          record.nativeSessionId === worktree.nativeSessionId &&
          record.taskId === worktree.taskId &&
          record.worktreeId === worktree.worktreeId &&
          record.branch === worktree.branch &&
          record.head === worktree.head,
      );
      if (!exact || record.digest !== sha256(record.summary))
        throw new CoordinationServiceError(
          "git-refused",
          "Candidate test evidence does not match an exact measured binding",
        );
    }
    const diff = await this.#git([
      "-C",
      sourcePaths.worktreePath,
      "diff",
      "--binary",
      "--no-ext-diff",
      `${measuredTarget.head}..${measuredSource.head}`,
    ]);
    const names = await this.#git([
      "-C",
      sourcePaths.worktreePath,
      "diff",
      "--name-only",
      `${measuredTarget.head}..${measuredSource.head}`,
    ]);
    const mergeTree = await this.#git([
      "-C",
      sourcePaths.worktreePath,
      "merge-tree",
      "--write-tree",
      "--name-only",
      "--messages",
      measuredTarget.head,
      measuredSource.head,
    ]);
    if (diff.exitCode !== 0 || names.exitCode !== 0)
      throw new CoordinationServiceError(
        "git-failed",
        "Could not derive exact candidate diff",
      );
    const diffBytes = Buffer.byteLength(diff.stdout);
    if (diffBytes > COORDINATION_LIMITS.candidateDiffBytes)
      throw new CoordinationServiceError(
        "resource-limit",
        "Candidate diff exceeds 128 KiB",
      );
    const changedPaths = names.stdout
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, COORDINATION_LIMITS.gitPaths);
    const conflicting = mergeTree.exitCode === 1;
    if (mergeTree.exitCode !== 0 && mergeTree.exitCode !== 1)
      throw new CoordinationServiceError(
        "git-failed",
        displayGitFailure(mergeTree),
      );
    const conflictPaths = conflicting
      ? changedPaths.filter((path) => mergeTree.stdout.includes(path))
      : [];
    const effectiveConflictPaths =
      conflicting && conflictPaths.length === 0
        ? changedPaths.slice(0, COORDINATION_LIMITS.conflicts)
        : conflictPaths;
    const conflicts: CoordinationConflict[] = effectiveConflictPaths.map(
      (path, index) => ({
        conflictId: `${action.candidateId}-conflict-${index + 1}`,
        candidateId: action.candidateId,
        relativePath: path,
        classification: "git-conflict",
        source: "git-merge-tree",
      }),
    );
    const now = new Date().toISOString();
    const candidate: CoordinationMergeCandidate = {
      candidateId: action.candidateId,
      sourceAgentId: action.sourceAgentId,
      targetAgentId: action.targetAgentId,
      sourceTaskId: action.sourceTaskId,
      targetTaskId: action.targetTaskId,
      repositoryId: snapshot.repositoryId ?? "unavailable",
      sourceWorktreeId: source.worktreeId,
      targetWorktreeId: target.worktreeId,
      sourceBranch: source.branch,
      targetBranch: target.branch,
      sourceHead: measuredSource.head,
      targetHead: measuredTarget.head,
      diff: diff.stdout,
      diffDigest: sha256(diff.stdout),
      changedPaths,
      testEvidenceIds: action.testEvidence.map((value) => value.testId),
      conflictIds: conflicts.map((value) => value.conflictId),
      uncertainties: action.uncertainties,
      cleanupState:
        measuredSource.state === "dirty" || measuredTarget.state === "dirty"
          ? "blocked-dirty"
          : "not-planned",
      state: conflicting ? "conflicting" : "candidate",
      mergeRun: false,
      preparedAt: now,
      approvedAt: null,
    };
    return withServiceResult(
      snapshot,
      request,
      {
        worktrees: snapshot.worktrees.map((value) =>
          value.worktreeId === measuredSource.worktreeId
            ? measuredSource
            : value.worktreeId === measuredTarget.worktreeId
              ? measuredTarget
              : value,
        ),
        mergeCandidates: [
          ...snapshot.mergeCandidates.filter(
            (value) => value.candidateId !== candidate.candidateId,
          ),
          candidate,
        ],
        conflicts: [
          ...snapshot.conflicts.filter(
            (value) => value.candidateId !== candidate.candidateId,
          ),
          ...conflicts,
        ],
        testEvidence: [...snapshot.testEvidence, ...action.testEvidence].slice(
          -COORDINATION_LIMITS.tests,
        ),
      },
      "candidate-prepared",
      `${candidate.candidateId} conflict=${conflicting} merge not run`,
      now,
    );
  }

  async #git(args: readonly string[]): Promise<GitResult> {
    const allowed = new Set([
      "rev-parse",
      "status",
      "worktree",
      "diff",
      "merge-tree",
      "show-ref",
      "for-each-ref",
    ]);
    const command = args.find(
      (value, index) =>
        index > 0 &&
        args[index - 1] !== "-C" &&
        !value.startsWith("-") &&
        allowed.has(value),
    );
    if (!command)
      throw new CoordinationServiceError(
        "git-refused",
        "Git subcommand is not allowlisted",
      );
    let release!: () => void;
    const prior = this.#gitTail;
    this.#gitTail = new Promise<void>((resolveTail) => {
      release = resolveTail;
    });
    await prior;
    try {
      if (this.#closed)
        throw new CoordinationServiceError(
          "unavailable",
          "Coordination service is closed",
        );
      return await new Promise<GitResult>((resolveResult, reject) => {
        const child = spawn("git", [...args], {
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            GIT_CONFIG_NOSYSTEM: "1",
            GIT_TERMINAL_PROMPT: "0",
            LC_ALL: "C",
          },
        });
        this.#activeChild = child;
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let bytes = 0;
        const add = (target: Buffer[], value: Buffer) => {
          bytes += value.length;
          if (bytes > COORDINATION_LIMITS.candidateDiffBytes + 32 * 1024) {
            child.kill("SIGTERM");
            return;
          }
          target.push(value);
        };
        child.stdout.on("data", (value: Buffer) => add(stdout, value));
        child.stderr.on("data", (value: Buffer) => add(stderr, value));
        const timer = setTimeout(
          () => child.kill("SIGTERM"),
          COORDINATION_LIMITS.gitTimeoutMs,
        );
        child.once("error", reject);
        child.once("close", (code) => {
          clearTimeout(timer);
          this.#activeChild = null;
          resolveResult({
            stdout: Buffer.concat(stdout).toString("utf8"),
            stderr: Buffer.concat(stderr).toString("utf8"),
            exitCode: code ?? 1,
          });
        });
      });
    } finally {
      this.#activeChild = null;
      release();
    }
  }

  async dispose(): Promise<void> {
    this.#closed = true;
    this.#activeChild?.kill("SIGTERM");
    await this.#gitTail;
  }
}
