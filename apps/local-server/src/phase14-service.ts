import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import {
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import net from "node:net";
import path, { dirname, resolve } from "node:path";

import {
  CodeExplanationSchema,
  FixtureManifestSchema,
  TOOL_EVENT_LIMITS,
  ToolEventReplay,
  ToolEventSchema,
  type CodeExplanation,
  type FixtureManifest,
  type ToolEvent,
  type ToolLifecycle,
  type ToolOperation,
} from "@agentintersect-world/tool-protocol";

export const PHASE14_DISPOSABLE_ROOT =
  "/tmp/agentintersect-world-phase14" as const;
const PHASE14_WORLD_SESSION_ID = "55555555-5555-4555-8555-555555555555";
const PHASE14_ADAPTER_SESSION_REF = "phase14-hermes-fixture-session";
const PHASE14_ROOT_SESSION_REF = "phase14-hermes-fixture-root";
const MAX_STORE_BYTES = 1024 * 1024;
const MAX_OPERATIONS = 20;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const TEST_TIMEOUT_MS = 30_000;
const PREVIEW_READY_TARGET_MS = 5_000;
const PREVIEW_TIMEOUT_MS = 10_000;
const PREVIEW_MAX_LIFETIME_MS = 5 * 60 * 1000;

type Phase14ErrorCode =
  | "fixture-invalid"
  | "operation-not-found"
  | "operation-order"
  | "target-path"
  | "target-stale"
  | "target-dirty"
  | "target-symlink"
  | "target-binary"
  | "target-nul"
  | "target-size"
  | "approval-mismatch"
  | "approval-revoked"
  | "approval-expired"
  | "approval-used"
  | "cancelled"
  | "test-failed"
  | "preview-failed"
  | "conflict";

export class Phase14ServiceError extends Error {
  constructor(
    readonly code: Phase14ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "Phase14ServiceError";
  }
}

type EvidenceRefs = {
  readonly currentRef: string | null;
  readonly previousRef: string | null;
};

type ApprovalRecord = {
  approvalId: string;
  worldSessionId: string;
  repositoryId: string;
  fixtureRevision: string;
  target: "src/greeting.mjs";
  patchDigest: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  revoked: boolean;
  singleUse: true;
};

export type Phase14TestRecord = {
  state: "requested" | "running" | "succeeded" | "failed" | "cancelled";
  argv: readonly [string, "--test", "test/greeting.test.mjs"];
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  recovered?: boolean;
  startedAt: string;
  finishedAt: string | null;
  evidenceRef: string | null;
};

export type Phase14PreviewRecord = {
  state:
    | "requested"
    | "starting"
    | "ready"
    | "unhealthy"
    | "stopped"
    | "failed"
    | "cancelled";
  url: string | null;
  port: number | null;
  health: { ok: true; schema: "aiw.phase14-preview/1" } | null;
  logs: string;
  logsTruncated: boolean;
  startedAt: string;
  readyAt: string | null;
  stoppedAt: string | null;
  portClosed: boolean | null;
  recovered?: boolean;
  evidenceRef: string | null;
  step: 9 | 10;
  correlatedEvidence?: readonly string[];
};

type EditRecord = {
  outcome:
    | "not-applied"
    | "applied"
    | "cancelled"
    | "failed"
    | "applied-evidence-failed";
  diff: string;
  patchDigest: string;
  previousHash: string;
  currentHash: string | null;
  previousEvidenceRef: string;
  currentEvidenceRef: string | null;
  operationId: string;
  error: string | null;
};

type SearchRecord = {
  query: "greeting";
  matches: readonly { line: number; column: number }[];
  evidenceRef: string;
};

export type Phase14Journey = {
  schema: "aiw.phase14-operation/1";
  operationId: string;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
  status: "active" | "cancelled" | "completed" | "failed";
  step: number;
  session: {
    worldSessionId: string;
    adapterId: "phase14-fixture";
    adapterSessionRef: string;
    rootSessionRef: string;
    continuity: "fixture-existing";
  };
  disposable: {
    copyName: string;
    repositoryId: string;
    rootAttestation: string;
    fixtureRevision: string;
    target: "src/greeting.mjs";
    symbol: "greeting";
    initialHash: string;
    patchDigest: string;
  };
  operationIds: Partial<Record<ToolOperation, string>>;
  events: ToolEvent[];
  search: SearchRecord | null;
  explanation: CodeExplanation | null;
  edit: EditRecord | null;
  approval: ApprovalRecord | null;
  test: Phase14TestRecord | null;
  preview: Phase14PreviewRecord | null;
  evidenceRefs: string[];
  recovered: boolean;
};

type ReadyRecord = {
  schema: "aiw.phase14-preview-ready/1";
  host: "127.0.0.1";
  port: number;
  pid: number;
};

type ActiveProcess = {
  child: ChildProcess;
  kind: "test" | "preview";
  cancelled: boolean;
  intentionalStop: boolean;
  timeout: ReturnType<typeof setTimeout> | null;
  logs: BoundedText;
};

type Phase14ServiceOptions = {
  readonly fixtureRoot?: string;
  readonly storePath?: string;
  readonly disposableRoot?: string;
  readonly now?: () => number;
  readonly id?: () => string;
  readonly fetch?: typeof fetch;
  readonly testTimeoutMs?: number;
  readonly previewReadyTargetMs?: number;
  readonly previewTimeoutMs?: number;
  readonly previewMaximumLifetimeMs?: number;
  readonly evidenceWriter?: (journey: Phase14Journey) => void;
  readonly testingTestMode?: "fail" | "hang" | "output";
  readonly testingPreviewMode?: "hang-startup";
};

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function timestamp(milliseconds: number): string {
  return new Date(milliseconds).toISOString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function evidenceRef(operationId: string, label: string): string {
  return `aiw://evidence/phase14-${operationId}-${label}`;
}

function exactDiff(previous: string, current: string): string {
  const previousLines = previous.endsWith("\n")
    ? previous.slice(0, -1).split("\n")
    : previous.split("\n");
  const currentLines = current.endsWith("\n")
    ? current.slice(0, -1).split("\n")
    : current.split("\n");
  const body = [
    "--- previous/src/greeting.mjs",
    "+++ current/src/greeting.mjs",
    `@@ -1,${previousLines.length} +1,${currentLines.length} @@`,
    ...previousLines.map((line) => `-${line}`),
    ...currentLines.map((line) => `+${line}`),
    "",
  ].join("\n");
  if (Buffer.byteLength(body) > TOOL_EVENT_LIMITS.maximumDiffBytes)
    throw new Phase14ServiceError("target-size", "Unified diff exceeds 16 KiB");
  return body;
}

class BoundedText {
  #buffer = Buffer.alloc(0);
  truncated = false;

  constructor(readonly maximumBytes: number) {}

  push(chunk: Uint8Array | string): void {
    const input = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const remaining = this.maximumBytes - this.#buffer.byteLength;
    if (remaining <= 0) {
      this.truncated = true;
      return;
    }
    this.#buffer = Buffer.concat([this.#buffer, input.subarray(0, remaining)]);
    if (input.byteLength > remaining) this.truncated = true;
  }

  text(): string {
    return this.#buffer.toString("utf8");
  }
}

type StoreEnvelope = {
  schema: "aiw.phase14-store-envelope/1";
  checksum: string;
  payload: {
    schema: "aiw.phase14-store/1";
    writtenAt: string;
    operations: Phase14Journey[];
  };
};

class Phase14Store {
  readonly #lastGoodPath: string;

  constructor(readonly filePath: string) {
    this.#lastGoodPath = `${filePath}.last-good`;
  }

  async read(
    now: number,
  ): Promise<{ operations: Phase14Journey[]; recovered: boolean }> {
    const current = await this.#readOne(this.filePath);
    if (current)
      return { operations: this.#recover(current, now), recovered: false };
    const lastGood = await this.#readOne(this.#lastGoodPath);
    return {
      operations: lastGood ? this.#recover(lastGood, now) : [],
      recovered: Boolean(lastGood),
    };
  }

  async #readOne(filePath: string): Promise<Phase14Journey[] | null> {
    try {
      const raw: unknown = JSON.parse(await readFile(filePath, "utf8"));
      if (!raw || typeof raw !== "object") return null;
      const envelope = raw as Partial<StoreEnvelope>;
      if (
        envelope.schema !== "aiw.phase14-store-envelope/1" ||
        typeof envelope.checksum !== "string" ||
        !envelope.payload ||
        envelope.payload.schema !== "aiw.phase14-store/1" ||
        !Array.isArray(envelope.payload.operations)
      )
        return null;
      if (sha256(canonical(envelope.payload)) !== envelope.checksum)
        return null;
      return envelope.payload.operations as Phase14Journey[];
    } catch {
      return null;
    }
  }

  #recover(operations: Phase14Journey[], now: number): Phase14Journey[] {
    return operations
      .filter(({ createdAt }) => now - Date.parse(createdAt) <= RETENTION_MS)
      .map((operation) => {
        const recovered = clone(operation);
        if (
          recovered.test &&
          ["requested", "running"].includes(recovered.test.state)
        ) {
          recovered.test.state = "failed";
          recovered.test.finishedAt = timestamp(now);
          recovered.test.recovered = true;
          recovered.status = "failed";
        }
        if (
          recovered.preview &&
          ["requested", "starting", "ready"].includes(recovered.preview.state)
        ) {
          recovered.preview.state = "failed";
          recovered.preview.stoppedAt = timestamp(now);
          recovered.preview.portClosed = null;
          recovered.preview.recovered = true;
          recovered.status = "failed";
        }
        recovered.recovered = true;
        return recovered;
      });
  }

  async write(input: readonly Phase14Journey[], now: number): Promise<void> {
    const threshold = now - RETENTION_MS;
    const operations = [...input]
      .filter(({ createdAt }) => Date.parse(createdAt) >= threshold)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .slice(-MAX_OPERATIONS)
      .map(clone);
    let envelope = this.#envelope(operations, now);
    while (Buffer.byteLength(JSON.stringify(envelope)) > MAX_STORE_BYTES) {
      if (operations.length <= 1)
        throw new Phase14ServiceError(
          "conflict",
          "Phase 14 store exceeds 1 MiB",
        );
      operations.shift();
      envelope = this.#envelope(operations, now);
    }
    await mkdir(dirname(this.filePath), { recursive: true });
    await this.#atomicWrite(this.filePath, `${JSON.stringify(envelope)}\n`);
    await this.#atomicWrite(
      this.#lastGoodPath,
      `${JSON.stringify(envelope)}\n`,
    );
  }

  #envelope(operations: Phase14Journey[], now: number): StoreEnvelope {
    const payload = {
      schema: "aiw.phase14-store/1" as const,
      writtenAt: timestamp(now),
      operations,
    };
    return {
      schema: "aiw.phase14-store-envelope/1",
      checksum: sha256(canonical(payload)),
      payload,
    };
  }

  async #atomicWrite(filePath: string, content: string): Promise<void> {
    const temporary = `${filePath}.${randomUUID()}.tmp`;
    await writeFile(temporary, content, { flag: "wx", mode: 0o600 });
    await rename(temporary, filePath);
  }
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise<void>((resolveWait) =>
    setTimeout(resolveWait, milliseconds),
  );
}

async function portIsClosed(port: number): Promise<boolean> {
  return await new Promise<boolean>((resolveClosed) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(150);
    socket.once("connect", () => {
      socket.destroy();
      resolveClosed(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolveClosed(true);
    });
    socket.once("error", () => resolveClosed(true));
  });
}

export class Phase14Service {
  readonly #fixtureRoot: string;
  readonly #disposableRoot: string;
  readonly #now: () => number;
  readonly #id: () => string;
  readonly #fetch: typeof fetch;
  readonly #testTimeoutMs: number;
  readonly #previewReadyTargetMs: number;
  readonly #previewTimeoutMs: number;
  readonly #previewMaximumLifetimeMs: number;
  readonly #evidenceWriter: ((journey: Phase14Journey) => void) | undefined;
  readonly #testingTestMode: "fail" | "hang" | "output" | undefined;
  readonly #testingPreviewMode: "hang-startup" | undefined;
  readonly #store: Phase14Store;
  readonly #journeys = new Map<string, Phase14Journey>();
  readonly #active = new Map<string, ActiveProcess>();
  readonly #eventReplay = new ToolEventReplay();
  readonly #ownedCopies = new Set<string>();
  #manifest: FixtureManifest | null = null;
  #loaded: Promise<void> | null = null;

  constructor(options: Phase14ServiceOptions = {}) {
    this.#fixtureRoot = resolve(
      options.fixtureRoot ?? "examples/phase14-magic-slice",
    );
    this.#disposableRoot = resolve(
      options.disposableRoot ?? PHASE14_DISPOSABLE_ROOT,
    );
    if (this.#disposableRoot !== PHASE14_DISPOSABLE_ROOT)
      throw new Phase14ServiceError(
        "fixture-invalid",
        "Phase 14 disposable root must be the canonical /tmp root",
      );
    this.#now = options.now ?? Date.now;
    this.#id = options.id ?? randomUUID;
    this.#fetch = options.fetch ?? fetch;
    this.#testTimeoutMs = options.testTimeoutMs ?? TEST_TIMEOUT_MS;
    this.#previewReadyTargetMs =
      options.previewReadyTargetMs ?? PREVIEW_READY_TARGET_MS;
    this.#previewTimeoutMs = options.previewTimeoutMs ?? PREVIEW_TIMEOUT_MS;
    this.#previewMaximumLifetimeMs =
      options.previewMaximumLifetimeMs ?? PREVIEW_MAX_LIFETIME_MS;
    this.#evidenceWriter = options.evidenceWriter;
    this.#testingTestMode = options.testingTestMode;
    this.#testingPreviewMode = options.testingPreviewMode;
    this.#store = new Phase14Store(
      options.storePath ??
        resolve(PHASE14_DISPOSABLE_ROOT, "state", "operations.json"),
    );
  }

  async #ensureLoaded(): Promise<void> {
    this.#loaded ??= (async () => {
      await mkdir(this.#disposableRoot, { recursive: true, mode: 0o700 });
      if ((await realpath(this.#disposableRoot)) !== PHASE14_DISPOSABLE_ROOT)
        throw new Phase14ServiceError(
          "fixture-invalid",
          "Canonical disposable root realpath mismatch",
        );
      this.#manifest = FixtureManifestSchema.parse(
        JSON.parse(
          await readFile(
            resolve(this.#fixtureRoot, "fixture.manifest.json"),
            "utf8",
          ),
        ),
      );
      await this.#verifyTrackedFixture();
      const stored = await this.#store.read(this.#now());
      for (const operation of stored.operations)
        this.#journeys.set(operation.operationId, operation);
      if (stored.recovered) await this.#persist();
    })();
    return this.#loaded;
  }

  get manifest(): FixtureManifest {
    if (!this.#manifest)
      throw new Phase14ServiceError("fixture-invalid", "Fixture is not loaded");
    return this.#manifest;
  }

  async #verifyTrackedFixture(): Promise<void> {
    for (const file of this.manifest.files) {
      const bytes = await readFile(resolve(this.#fixtureRoot, file.path));
      if (sha256(bytes) !== file.sha256)
        throw new Phase14ServiceError(
          "fixture-invalid",
          `Tracked fixture hash mismatch for ${file.path}`,
        );
    }
    if (
      sha256(this.manifest.target.initialSource) !==
      this.manifest.target.initialSha256
    )
      throw new Phase14ServiceError(
        "fixture-invalid",
        "Initial source hash mismatch",
      );
    if (
      sha256(this.manifest.target.replacementSource) !==
      this.manifest.target.replacementSha256
    )
      throw new Phase14ServiceError(
        "fixture-invalid",
        "Replacement hash mismatch",
      );
    if (
      sha256(
        `${this.manifest.target.initialSource}\0${this.manifest.target.replacementSource}`,
      ) !== this.manifest.target.patchDigest
    )
      throw new Phase14ServiceError("fixture-invalid", "Patch digest mismatch");
  }

  async createJourney(): Promise<Phase14Journey> {
    await this.#ensureLoaded();
    const operationId = this.#id();
    const copyName = operationId;
    const copyRoot = resolve(this.#disposableRoot, copyName);
    if (dirname(copyRoot) !== this.#disposableRoot)
      throw new Phase14ServiceError(
        "target-path",
        "Disposable copy escaped root",
      );
    await mkdir(copyRoot, { recursive: false, mode: 0o700 });
    this.#ownedCopies.add(copyRoot);
    for (const file of this.manifest.files) {
      const destination = resolve(copyRoot, file.path);
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
      await copyFile(resolve(this.#fixtureRoot, file.path), destination);
    }
    await copyFile(
      resolve(this.#fixtureRoot, "fixture.manifest.json"),
      resolve(copyRoot, "fixture.manifest.json"),
    );
    const root = await realpath(copyRoot);
    const rootAttestation = `sha256:${sha256(
      `${root}\0${this.manifest.repositoryId}\0${this.manifest.revision}`,
    )}`;
    const now = timestamp(this.#now());
    const journey: Phase14Journey = {
      schema: "aiw.phase14-operation/1",
      operationId,
      correlationId: this.#id(),
      createdAt: now,
      updatedAt: now,
      status: "active",
      step: 1,
      session: {
        worldSessionId: PHASE14_WORLD_SESSION_ID,
        adapterId: "phase14-fixture",
        adapterSessionRef: PHASE14_ADAPTER_SESSION_REF,
        rootSessionRef: PHASE14_ROOT_SESSION_REF,
        continuity: "fixture-existing",
      },
      disposable: {
        copyName,
        repositoryId: this.manifest.repositoryId,
        rootAttestation,
        fixtureRevision: this.manifest.revision,
        target: this.manifest.target.path,
        symbol: this.manifest.target.symbol,
        initialHash: this.manifest.target.initialSha256,
        patchDigest: this.manifest.target.patchDigest,
      },
      operationIds: {},
      events: [],
      search: null,
      explanation: null,
      edit: null,
      approval: null,
      test: null,
      preview: null,
      evidenceRefs: [],
      recovered: false,
    };
    this.#journeys.set(operationId, journey);
    await this.#persist();
    return clone(journey);
  }

  async inspect(operationId: string): Promise<{
    step: 3;
    source: string;
    search: SearchRecord;
    explanation: CodeExplanation;
  }> {
    await this.#ensureLoaded();
    const journey = this.#require(operationId);
    this.#assertActive(journey);
    const source = await this.#attestTarget(journey, true);
    const currentRef = evidenceRef(operationId, "source-current");
    const readOperationId = this.#operationId(journey, "read");
    this.#emit(journey, "read", "requested", {
      currentRef: null,
      previousRef: null,
    });
    this.#emit(journey, "read", "accepted", {
      currentRef: null,
      previousRef: null,
    });
    this.#emit(journey, "read", "running", {
      currentRef: null,
      previousRef: null,
    });
    this.#emit(journey, "read", "succeeded", {
      currentRef,
      previousRef: null,
    });
    const matches: { line: number; column: number }[] = [];
    for (const [index, line] of source.split("\n").entries()) {
      const column = line.indexOf("greeting");
      if (column >= 0) matches.push({ line: index + 1, column: column + 1 });
    }
    const searchRef = evidenceRef(operationId, "search-current");
    this.#emit(journey, "search", "requested", {
      currentRef,
      previousRef: null,
    });
    this.#emit(journey, "search", "accepted", {
      currentRef,
      previousRef: null,
    });
    this.#emit(journey, "search", "running", { currentRef, previousRef: null });
    const searchEvent = this.#emit(journey, "search", "succeeded", {
      currentRef: searchRef,
      previousRef: null,
    });
    const search: SearchRecord = {
      query: "greeting",
      matches,
      evidenceRef: searchRef,
    };
    const explanation = CodeExplanationSchema.parse({
      schema: "aiw.code-explanation/0.14",
      explanationId: this.#id(),
      operationId: readOperationId,
      repositoryId: journey.disposable.repositoryId,
      fixtureRevision: journey.disposable.fixtureRevision,
      fileEvidenceRef: currentRef,
      path: "src/greeting.mjs",
      symbol: "greeting",
      lineRange: { start: 1, end: 1 },
      sourceHash: sha256(source),
      originatingEventId: searchEvent.eventId,
      continuity: { state: "current", reason: null },
      claims: {
        sourceFacts: [
          {
            label: "source-fact",
            text: "The module exports exactly the greeting binding from line 1.",
          },
        ],
        runtimeObservations: [
          {
            label: "runtime-observation",
            text: "World read the source and found one exact greeting occurrence.",
          },
        ],
        testResults: [],
        interpretations: [
          {
            label: "interpretation",
            text: "Changing this literal changes the fixture preview greeting.",
          },
        ],
      },
    });
    journey.search = search;
    journey.explanation = explanation;
    journey.evidenceRefs.push(
      currentRef,
      searchRef,
      explanation.fileEvidenceRef,
    );
    journey.step = 3;
    this.#touch(journey);
    await this.#persist();
    return {
      step: 3,
      source,
      search: clone(search),
      explanation: clone(explanation),
    };
  }

  async prepareEdit(operationId: string): Promise<EditRecord & { step: 4 }> {
    await this.#ensureLoaded();
    const journey = this.#require(operationId);
    this.#assertActive(journey);
    if (!journey.explanation || journey.step < 3)
      throw new Phase14ServiceError(
        "operation-order",
        "Read/search must complete first",
      );
    const source = await this.#attestTarget(journey, true);
    const diff = exactDiff(source, this.manifest.target.replacementSource);
    const previousEvidenceRef = evidenceRef(operationId, "diff-previous");
    const edit: EditRecord = {
      outcome: "not-applied",
      diff,
      patchDigest: this.manifest.target.patchDigest,
      previousHash: sha256(source),
      currentHash: null,
      previousEvidenceRef,
      currentEvidenceRef: null,
      operationId: this.#operationId(journey, "edit"),
      error: null,
    };
    journey.edit = edit;
    journey.evidenceRefs.push(previousEvidenceRef);
    this.#emit(journey, "edit", "requested", {
      currentRef: null,
      previousRef: previousEvidenceRef,
    });
    journey.step = 4;
    this.#touch(journey);
    await this.#persist();
    return { ...clone(edit), step: 4 };
  }

  async approve(
    operationId: string,
    input: { readonly patchDigest: string },
  ): Promise<ApprovalRecord & { step: 5 }> {
    await this.#ensureLoaded();
    const journey = this.#require(operationId);
    this.#assertActive(journey);
    if (!journey.edit || journey.edit.outcome !== "not-applied")
      throw new Phase14ServiceError(
        "operation-order",
        "Edit preview is required",
      );
    if (input.patchDigest !== journey.edit.patchDigest)
      throw new Phase14ServiceError(
        "approval-mismatch",
        "Patch digest mismatch",
      );
    const now = this.#now();
    const approval: ApprovalRecord = {
      approvalId: this.#id(),
      worldSessionId: journey.session.worldSessionId,
      repositoryId: journey.disposable.repositoryId,
      fixtureRevision: journey.disposable.fixtureRevision,
      target: "src/greeting.mjs",
      patchDigest: input.patchDigest,
      createdAt: timestamp(now),
      expiresAt: timestamp(now + TOOL_EVENT_LIMITS.approvalTtlMs),
      used: false,
      revoked: false,
      singleUse: true,
    };
    journey.approval = approval;
    this.#emit(journey, "edit", "accepted", {
      currentRef: null,
      previousRef: journey.edit.previousEvidenceRef,
    });
    journey.step = 5;
    this.#touch(journey);
    await this.#persist();
    return { ...clone(approval), step: 5 };
  }

  async revokeApproval(
    operationId: string,
    approvalId: string,
  ): Promise<ApprovalRecord> {
    await this.#ensureLoaded();
    const journey = this.#require(operationId);
    const approval = this.#approval(journey, approvalId);
    if (approval.used)
      throw new Phase14ServiceError(
        "approval-used",
        "Approval is already used",
      );
    approval.revoked = true;
    this.#touch(journey);
    await this.#persist();
    return clone(approval);
  }

  async apply(
    operationId: string,
    input: { readonly approvalId: string },
  ): Promise<EditRecord & { step: 7 }> {
    await this.#ensureLoaded();
    const journey = this.#require(operationId);
    this.#assertActive(journey);
    if (!journey.edit)
      throw new Phase14ServiceError(
        "operation-order",
        "Edit preview is required",
      );
    const approval = this.#approval(journey, input.approvalId);
    if (approval.used)
      throw new Phase14ServiceError("approval-used", "Approval is single-use");
    if (approval.revoked)
      throw new Phase14ServiceError("approval-revoked", "Approval was revoked");
    if (this.#now() > Date.parse(approval.expiresAt))
      throw new Phase14ServiceError(
        "approval-expired",
        "Approval expired after five minutes",
      );
    if (
      approval.worldSessionId !== journey.session.worldSessionId ||
      approval.repositoryId !== journey.disposable.repositoryId ||
      approval.fixtureRevision !== journey.disposable.fixtureRevision ||
      approval.target !== journey.disposable.target ||
      approval.patchDigest !== journey.edit.patchDigest
    )
      throw new Phase14ServiceError(
        "approval-mismatch",
        "Approval binding mismatch",
      );
    approval.used = true;
    this.#emit(journey, "edit", "running", {
      currentRef: null,
      previousRef: journey.edit.previousEvidenceRef,
    });
    const started = Date.now();
    try {
      await this.#attestAll(journey);
      if (Date.now() - started > 5_000)
        throw new Phase14ServiceError(
          "conflict",
          "Edit operation exceeded five seconds",
        );
      const target = resolve(
        this.#copyRoot(journey),
        journey.disposable.target,
      );
      const temporary = resolve(dirname(target), `.greeting.${this.#id()}.tmp`);
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(this.manifest.target.replacementSource, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      if (Date.now() - started > 5_000) {
        await unlink(temporary).catch(() => undefined);
        throw new Phase14ServiceError(
          "conflict",
          "Edit operation exceeded five seconds",
        );
      }
      await rename(temporary, target);
      const directory = await open(dirname(target), "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
      const currentHash = sha256(await readFile(target));
      if (currentHash !== this.manifest.target.replacementSha256)
        throw new Phase14ServiceError(
          "target-stale",
          "Applied file hash mismatch",
        );
      const currentEvidenceRef = evidenceRef(operationId, "diff-current");
      journey.edit.outcome = "applied";
      journey.edit.currentHash = currentHash;
      journey.edit.currentEvidenceRef = currentEvidenceRef;
      journey.evidenceRefs.push(currentEvidenceRef);
      try {
        this.#evidenceWriter?.(journey);
      } catch (error) {
        journey.edit.outcome = "applied-evidence-failed";
        journey.edit.error =
          error instanceof Error ? error.message : "Evidence write failed";
      }
      this.#emit(journey, "edit", "succeeded", {
        currentRef: currentEvidenceRef,
        previousRef: journey.edit.previousEvidenceRef,
      });
      journey.step = 7;
      this.#touch(journey);
      await this.#persist();
      return { ...clone(journey.edit), step: 7 };
    } catch (error) {
      journey.edit.outcome = "failed";
      journey.edit.error =
        error instanceof Error ? error.message : "Atomic edit failed";
      if (journey.explanation) {
        journey.explanation = CodeExplanationSchema.parse({
          ...journey.explanation,
          continuity: {
            state: "stale",
            reason: journey.edit.error.slice(0, 1024),
          },
        });
      }
      this.#emit(journey, "edit", "failed", {
        currentRef: null,
        previousRef: journey.edit.previousEvidenceRef,
      });
      journey.status = "failed";
      this.#touch(journey);
      await this.#persist();
      throw error;
    }
  }

  async runTest(operationId: string): Promise<Phase14TestRecord & { step: 8 }> {
    await this.#ensureLoaded();
    const journey = this.#require(operationId);
    this.#assertActive(journey);
    if (
      !journey.edit ||
      !["applied", "applied-evidence-failed"].includes(journey.edit.outcome)
    )
      throw new Phase14ServiceError(
        "operation-order",
        "Approved edit must be applied first",
      );
    await this.#attestApplied(journey);
    const argv = [
      process.execPath,
      "--test",
      "test/greeting.test.mjs",
    ] as const;
    const record: Phase14TestRecord = {
      state: "requested",
      argv,
      stdout: "",
      stderr: "",
      stdoutTruncated: false,
      stderrTruncated: false,
      exitCode: null,
      signal: null,
      timedOut: false,
      startedAt: timestamp(this.#now()),
      finishedAt: null,
      evidenceRef: null,
    };
    journey.test = record;
    this.#operationId(journey, "test");
    this.#emit(journey, "test", "requested", {
      currentRef: null,
      previousRef: null,
    });
    this.#emit(journey, "test", "accepted", {
      currentRef: null,
      previousRef: null,
    });
    record.state = "running";
    this.#emit(journey, "test", "running", {
      currentRef: null,
      previousRef: null,
    });
    this.#touch(journey);
    await this.#persist();

    const stdout = new BoundedText(TOOL_EVENT_LIMITS.maximumTestStreamBytes);
    const stderr = new BoundedText(TOOL_EVENT_LIMITS.maximumTestStreamBytes);
    const child = spawn(
      process.execPath,
      ["--test", "test/greeting.test.mjs"],
      {
        cwd: this.#copyRoot(journey),
        shell: false,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          PATH: dirname(process.execPath),
          LANG: "C.UTF-8",
          NODE_NO_WARNINGS: "1",
          ...(this.#testingTestMode
            ? { AIW_PHASE14_TEST_MODE: this.#testingTestMode }
            : {}),
        },
      },
    );
    const active: ActiveProcess = {
      child,
      kind: "test",
      cancelled: false,
      intentionalStop: false,
      timeout: null,
      logs: new BoundedText(0),
    };
    this.#active.set(operationId, active);
    child.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
    active.timeout = setTimeout(() => {
      record.timedOut = true;
      void this.#terminate(active);
    }, this.#testTimeoutMs);
    active.timeout.unref?.();
    const [exitCode, signal] = (await once(child, "exit")) as [
      number | null,
      NodeJS.Signals | null,
    ];
    if (active.timeout) clearTimeout(active.timeout);
    this.#active.delete(operationId);
    record.stdout = stdout.text();
    record.stderr = stderr.text();
    record.stdoutTruncated = stdout.truncated;
    record.stderrTruncated = stderr.truncated;
    record.exitCode = exitCode;
    record.signal = signal;
    record.finishedAt = timestamp(this.#now());
    const testEvidenceRef = evidenceRef(operationId, "test-result");
    record.evidenceRef = testEvidenceRef;
    journey.evidenceRefs.push(testEvidenceRef);
    if (active.cancelled) record.state = "cancelled";
    else if (record.timedOut || exitCode !== 0) record.state = "failed";
    else record.state = "succeeded";
    this.#emit(
      journey,
      "test",
      record.state === "succeeded" ? "succeeded" : record.state,
      {
        currentRef: testEvidenceRef,
        previousRef: null,
      },
    );
    journey.step = 8;
    if (record.state === "failed") journey.status = "failed";
    if (record.state === "cancelled") journey.status = "cancelled";
    this.#touch(journey);
    await this.#persist();
    return { ...clone(record), step: 8 };
  }

  async startPreview(
    operationId: string,
  ): Promise<Phase14PreviewRecord & { step: 9 }> {
    await this.#ensureLoaded();
    const journey = this.#require(operationId);
    this.#assertActive(journey);
    if (journey.test?.state !== "succeeded")
      throw new Phase14ServiceError(
        "operation-order",
        "Focused test must succeed first",
      );
    await this.#attestApplied(journey);
    const record: Phase14PreviewRecord = {
      state: "requested",
      url: null,
      port: null,
      health: null,
      logs: "",
      logsTruncated: false,
      startedAt: timestamp(this.#now()),
      readyAt: null,
      stoppedAt: null,
      portClosed: null,
      evidenceRef: null,
      step: 9,
    };
    journey.preview = record;
    this.#operationId(journey, "preview");
    this.#emit(journey, "preview", "requested", {
      currentRef: null,
      previousRef: null,
    });
    this.#emit(journey, "preview", "accepted", {
      currentRef: null,
      previousRef: null,
    });
    record.state = "starting";
    this.#emit(journey, "preview", "running", {
      currentRef: null,
      previousRef: null,
    });
    this.#touch(journey);
    await this.#persist();
    // Cancellation can finish while persistence yields, before a child exists.
    // Do not spawn in the disposable directory that cancel has already removed.
    if (journey.status === "cancelled") {
      record.state = "cancelled";
      record.stoppedAt = timestamp(this.#now());
      record.portClosed = true;
      this.#emit(journey, "preview", "cancelled", {
        currentRef: null,
        previousRef: null,
      });
      await this.#persist();
      return { ...clone(record), step: 9 };
    }
    const logs = new BoundedText(TOOL_EVENT_LIMITS.maximumPreviewLogBytes);
    const child = spawn(
      process.execPath,
      ["preview.mjs", "--host", "127.0.0.1", "--port", "0"],
      {
        cwd: this.#copyRoot(journey),
        shell: false,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          PATH: dirname(process.execPath),
          LANG: "C.UTF-8",
          NODE_NO_WARNINGS: "1",
          ...(this.#testingPreviewMode
            ? { AIW_PHASE14_PREVIEW_MODE: this.#testingPreviewMode }
            : {}),
        },
      },
    );
    const active: ActiveProcess = {
      child,
      kind: "preview",
      cancelled: false,
      intentionalStop: false,
      timeout: null,
      logs,
    };
    this.#active.set(operationId, active);
    const readiness: { value: ReadyRecord | null } = { value: null };
    let stdout = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      logs.push(chunk);
      stdout += chunk.toString("utf8");
      for (const line of stdout.split("\n")) {
        try {
          const parsed = JSON.parse(line) as Partial<ReadyRecord>;
          if (
            parsed.schema === "aiw.phase14-preview-ready/1" &&
            parsed.host === "127.0.0.1" &&
            Number.isInteger(parsed.port) &&
            parsed.port &&
            parsed.port > 0 &&
            parsed.pid === child.pid
          )
            readiness.value = parsed as ReadyRecord;
        } catch {
          // Non-record output remains bounded logs, never authority.
        }
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => logs.push(chunk));
    const started = Date.now();
    let unhealthy = false;
    while (Date.now() - started <= this.#previewTimeoutMs) {
      if (active.cancelled) break;
      if (child.exitCode !== null || child.signalCode !== null) break;
      const ready = readiness.value;
      if (ready) {
        const health = await this.#health(ready.port);
        if (health) {
          record.state = "ready";
          record.port = ready.port;
          record.url = `http://127.0.0.1:${ready.port}/`;
          record.health = health;
          record.readyAt = timestamp(this.#now());
          record.logs = logs.text();
          record.logsTruncated = logs.truncated;
          const previewEvidenceRef = evidenceRef(operationId, "preview-health");
          record.evidenceRef = previewEvidenceRef;
          journey.evidenceRefs.push(previewEvidenceRef);
          this.#emit(journey, "preview", "succeeded", {
            currentRef: previewEvidenceRef,
            previousRef: null,
          });
          journey.step = 9;
          this.#touch(journey);
          active.timeout = setTimeout(() => {
            void this.cancel(operationId);
          }, this.#previewMaximumLifetimeMs);
          active.timeout.unref?.();
          await this.#persist();
          return { ...clone(record), step: 9 };
        }
        if (Date.now() - started >= this.#previewReadyTargetMs) {
          unhealthy = true;
          break;
        }
      }
      await wait(25);
    }
    await this.#terminate(active);
    this.#active.delete(operationId);
    record.logs = logs.text();
    record.logsTruncated = logs.truncated;
    record.state = active.cancelled
      ? "cancelled"
      : unhealthy
        ? "unhealthy"
        : "failed";
    record.stoppedAt = timestamp(this.#now());
    const finalReady = readiness.value;
    record.port = finalReady?.port ?? null;
    record.portClosed = finalReady ? await portIsClosed(finalReady.port) : true;
    this.#emit(journey, "preview", active.cancelled ? "cancelled" : "failed", {
      currentRef: null,
      previousRef: null,
    });
    journey.status = active.cancelled ? "cancelled" : "failed";
    this.#touch(journey);
    await this.#persist();
    return { ...clone(record), step: 9 };
  }

  async stopPreview(
    operationId: string,
  ): Promise<
    Phase14PreviewRecord & { step: 10; correlatedEvidence: readonly string[] }
  > {
    await this.#ensureLoaded();
    const journey = this.#require(operationId);
    const record = journey.preview;
    if (!record || record.state !== "ready" || record.port === null)
      throw new Phase14ServiceError(
        "operation-order",
        "Ready preview is required",
      );
    const active = this.#active.get(operationId);
    if (!active || active.kind !== "preview")
      throw new Phase14ServiceError(
        "preview-failed",
        "Owned preview process is unavailable",
      );
    active.intentionalStop = true;
    if (active.timeout) clearTimeout(active.timeout);
    await this.#terminate(active);
    this.#active.delete(operationId);
    record.state = "stopped";
    record.stoppedAt = timestamp(this.#now());
    record.portClosed = await this.#proveClosed(record.port);
    record.logs = active.logs.text();
    record.logsTruncated = active.logs.truncated;
    record.step = 10;
    record.correlatedEvidence = [...new Set(journey.evidenceRefs)];
    journey.status = "completed";
    journey.step = 10;
    this.#touch(journey);
    await this.#cleanupCopy(journey);
    await this.#persist();
    return {
      ...clone(record),
      step: 10,
      correlatedEvidence: [...new Set(journey.evidenceRefs)],
    };
  }

  async cancel(operationId: string): Promise<{
    state: "cancelled";
    outcome?: "cancelled";
    portClosed?: boolean;
  }> {
    await this.#ensureLoaded();
    const journey = this.#require(operationId);
    const active = this.#active.get(operationId);
    let portClosed: boolean | undefined;
    if (active) {
      active.cancelled = true;
      if (active.timeout) clearTimeout(active.timeout);
      await this.#terminate(active);
      this.#active.delete(operationId);
      if (journey.preview?.port) {
        portClosed = await this.#proveClosed(journey.preview.port);
        journey.preview.state = "cancelled";
        journey.preview.stoppedAt = timestamp(this.#now());
        journey.preview.portClosed = portClosed;
        journey.preview.logs = active.logs.text();
        journey.preview.logsTruncated = active.logs.truncated;
      }
    }
    let outcome: "cancelled" | undefined;
    if (journey.edit?.outcome === "not-applied") {
      journey.edit.outcome = "cancelled";
      outcome = "cancelled";
      this.#emit(journey, "edit", "cancelled", {
        currentRef: null,
        previousRef: journey.edit.previousEvidenceRef,
      });
    } else if (journey.test?.state === "running") {
      journey.test.state = "cancelled";
    }
    journey.status = "cancelled";
    this.#touch(journey);
    await this.#cleanupCopy(journey);
    await this.#persist();
    return {
      state: "cancelled",
      ...(outcome ? { outcome } : {}),
      ...(portClosed === undefined ? {} : { portClosed }),
    };
  }

  snapshot(operationId: string): Phase14Journey {
    return clone(this.#require(operationId));
  }

  list(): readonly Phase14Journey[] {
    return [...this.#journeys.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(clone);
  }

  events(operationId: string): readonly ToolEvent[] {
    return [...this.#require(operationId).events]
      .sort((left, right) => left.sequence - right.sequence)
      .map(clone);
  }

  acceptEvent(
    input: unknown,
  ):
    | { readonly kind: "accepted" }
    | { readonly kind: "duplicate" }
    | { readonly kind: "conflict"; readonly statusCode: 409 }
    | { readonly kind: "expired" } {
    return this.#eventReplay.accept(input, this.#now());
  }

  latest(): Phase14Journey | null {
    return this.list()[0] ?? null;
  }

  async recover(): Promise<readonly Phase14Journey[]> {
    await this.#ensureLoaded();
    return this.list();
  }

  async validateTargetPath(target: string): Promise<"src/greeting.mjs"> {
    if (
      target !== "src/greeting.mjs" ||
      path.isAbsolute(target) ||
      target.split(/[\\/]/).includes("..")
    )
      throw new Phase14ServiceError(
        "target-path",
        "Only src/greeting.mjs is allowed",
      );
    return target;
  }

  testingCopyRoot(operationId: string): string {
    return this.#copyRoot(this.#require(operationId));
  }

  testingOverrideFixtureRevision(operationId: string, revision: string): void {
    this.#require(operationId).disposable.fixtureRevision = revision;
  }

  async testingReplaceTargetWithSymlink(operationId: string): Promise<void> {
    const journey = this.#require(operationId);
    const target = resolve(this.#copyRoot(journey), journey.disposable.target);
    await unlink(target);
    await symlink("../preview.mjs", target);
  }

  async dispose(): Promise<void> {
    for (const active of this.#active.values()) {
      active.cancelled = true;
      if (active.timeout) clearTimeout(active.timeout);
      await this.#terminate(active);
    }
    this.#active.clear();
    for (const copyRoot of this.#ownedCopies)
      await this.#removeOwnedCopy(copyRoot);
    this.#ownedCopies.clear();
  }

  #require(operationId: string): Phase14Journey {
    const journey = this.#journeys.get(operationId);
    if (!journey)
      throw new Phase14ServiceError(
        "operation-not-found",
        "Phase 14 operation not found",
      );
    return journey;
  }

  #assertActive(journey: Phase14Journey): void {
    if (journey.status !== "active")
      throw new Phase14ServiceError(
        "cancelled",
        "Phase 14 operation is not active",
      );
  }

  #approval(journey: Phase14Journey, approvalId: string): ApprovalRecord {
    if (!journey.approval || journey.approval.approvalId !== approvalId)
      throw new Phase14ServiceError(
        "approval-mismatch",
        "Approval identity mismatch",
      );
    return journey.approval;
  }

  #copyRoot(journey: Phase14Journey): string {
    const root = resolve(this.#disposableRoot, journey.disposable.copyName);
    if (dirname(root) !== this.#disposableRoot)
      throw new Phase14ServiceError(
        "target-path",
        "Disposable copy escaped root",
      );
    return root;
  }

  #operationId(journey: Phase14Journey, operation: ToolOperation): string {
    const existing = journey.operationIds[operation];
    if (existing) return existing;
    const created = this.#id();
    journey.operationIds[operation] = created;
    return created;
  }

  #emit(
    journey: Phase14Journey,
    operation: ToolOperation,
    state: ToolLifecycle,
    evidence: EvidenceRefs,
  ): ToolEvent {
    const operationId = this.#operationId(journey, operation);
    const occurredMilliseconds = this.#now();
    const occurredAt = timestamp(occurredMilliseconds);
    const eventWithoutDigest = {
      schema: "aiw.tool-event/0.14" as const,
      operationId,
      eventId: this.#id(),
      correlationId: journey.correlationId,
      parentId:
        operation === "read" ? null : (journey.operationIds.read ?? null),
      sequence: journey.events.length + 1,
      operation,
      state,
      occurredAt,
      expiresAt: timestamp(
        occurredMilliseconds + TOOL_EVENT_LIMITS.requestTtlMs,
      ),
      worldSessionId: journey.session.worldSessionId,
      adapterSessionRef: journey.session.adapterSessionRef,
      rootSessionRef: journey.session.rootSessionRef,
      repository: {
        repositoryId: journey.disposable.repositoryId,
        rootAttestation: journey.disposable.rootAttestation,
        fixtureRevision: journey.disposable.fixtureRevision,
      },
      provenance: {
        adapterId: journey.session.adapterId,
        source: "world-owned" as const,
        observedAt: occurredAt,
      },
      target:
        operation === "preview"
          ? null
          : { path: "src/greeting.mjs" as const, symbol: "greeting" as const },
      displayArguments:
        operation === "test"
          ? "node --test test/greeting.test.mjs"
          : operation === "preview"
            ? "node preview.mjs --host 127.0.0.1 --port 0"
            : operation === "edit"
              ? "exact replacement: src/greeting.mjs#greeting"
              : `${operation}: greeting`,
      evidence,
      redaction: { applied: false, count: 0, truncated: false },
    };
    const event = ToolEventSchema.parse({
      ...eventWithoutDigest,
      digest: sha256(canonical(eventWithoutDigest)),
    });
    this.#eventReplay.accept(event, occurredMilliseconds);
    journey.events.push(event);
    return event;
  }

  async #attestTarget(
    journey: Phase14Journey,
    expectInitial: boolean,
  ): Promise<string> {
    await this.validateTargetPath(journey.disposable.target);
    if (journey.disposable.fixtureRevision !== this.manifest.revision)
      throw new Phase14ServiceError(
        "target-stale",
        "Fixture revision is stale",
      );
    const root = this.#copyRoot(journey);
    const canonicalRoot = await realpath(root);
    if (canonicalRoot !== root)
      throw new Phase14ServiceError(
        "target-path",
        "Disposable root realpath mismatch",
      );
    const expectedAttestation = `sha256:${sha256(
      `${canonicalRoot}\0${journey.disposable.repositoryId}\0${journey.disposable.fixtureRevision}`,
    )}`;
    if (expectedAttestation !== journey.disposable.rootAttestation)
      throw new Phase14ServiceError(
        "target-stale",
        "Root attestation is stale",
      );
    const target = resolve(root, journey.disposable.target);
    if (dirname(target) !== resolve(root, "src"))
      throw new Phase14ServiceError("target-path", "Target escaped allowlist");
    const stat = await lstat(target);
    if (stat.isSymbolicLink())
      throw new Phase14ServiceError(
        "target-symlink",
        "Target symlink is rejected",
      );
    if (!stat.isFile())
      throw new Phase14ServiceError(
        "target-path",
        "Target is not a regular file",
      );
    if (stat.size > TOOL_EVENT_LIMITS.maximumSourceBytes)
      throw new Phase14ServiceError("target-size", "Target exceeds 64 KiB");
    const bytes = await readFile(target);
    let source: string;
    try {
      source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Phase14ServiceError(
        "target-binary",
        "Binary target is rejected",
      );
    }
    if (source.includes("\0"))
      throw new Phase14ServiceError("target-nul", "NUL target is rejected");
    const expectedHash = expectInitial
      ? this.manifest.target.initialSha256
      : this.manifest.target.replacementSha256;
    if (sha256(bytes) !== expectedHash)
      throw new Phase14ServiceError(
        expectInitial ? "target-dirty" : "target-stale",
        expectInitial
          ? "Unexpected pre-existing target change"
          : "Applied target revision is stale",
      );
    return source;
  }

  async #attestAll(journey: Phase14Journey): Promise<void> {
    await this.#attestTarget(journey, true);
    const root = this.#copyRoot(journey);
    for (const file of this.manifest.files) {
      if (file.path === journey.disposable.target) continue;
      const target = resolve(root, file.path);
      const stat = await lstat(target);
      if (stat.isSymbolicLink() || !stat.isFile())
        throw new Phase14ServiceError(
          "target-dirty",
          "Fixture contains an unexpected file type",
        );
      if (sha256(await readFile(target)) !== file.sha256)
        throw new Phase14ServiceError(
          "target-dirty",
          "Unexpected fixture change is preserved",
        );
    }
  }

  async #attestApplied(journey: Phase14Journey): Promise<void> {
    await this.#attestTarget(journey, false);
    const root = this.#copyRoot(journey);
    for (const file of this.manifest.files) {
      if (file.path === journey.disposable.target) continue;
      if (sha256(await readFile(resolve(root, file.path))) !== file.sha256)
        throw new Phase14ServiceError(
          "target-dirty",
          "Unexpected fixture change is preserved",
        );
    }
  }

  async #health(
    port: number,
  ): Promise<{ ok: true; schema: "aiw.phase14-preview/1" } | null> {
    try {
      const response = await this.#fetch(`http://127.0.0.1:${port}/health`, {
        redirect: "error",
        signal: AbortSignal.timeout(500),
      });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("application/json")
      )
        return null;
      const body: unknown = await response.json();
      if (
        body &&
        typeof body === "object" &&
        Object.keys(body).length === 2 &&
        (body as { ok?: unknown }).ok === true &&
        (body as { schema?: unknown }).schema === "aiw.phase14-preview/1"
      )
        return { ok: true, schema: "aiw.phase14-preview/1" };
      return null;
    } catch {
      return null;
    }
  }

  async #terminate(active: ActiveProcess): Promise<void> {
    const child = active.child;
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exit = once(child, "exit").catch(() => []);
    try {
      if (process.platform === "win32") child.kill("SIGTERM");
      else if (child.pid) process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
    const completed = await Promise.race([
      exit.then(() => true),
      wait(750).then(() => false),
    ]);
    if (completed || child.exitCode !== null || child.signalCode !== null)
      return;
    try {
      if (process.platform === "win32") child.kill("SIGKILL");
      else if (child.pid) process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
    await exit;
  }

  async #proveClosed(port: number): Promise<boolean> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (await portIsClosed(port)) return true;
      await wait(25);
    }
    return false;
  }

  #touch(journey: Phase14Journey): void {
    journey.updatedAt = timestamp(this.#now());
  }

  async #persist(): Promise<void> {
    const threshold = this.#now() - RETENTION_MS;
    const retained = [...this.#journeys.values()]
      .filter(({ createdAt }) => Date.parse(createdAt) >= threshold)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .slice(-MAX_OPERATIONS);
    const retainedIds = new Set(retained.map(({ operationId }) => operationId));
    for (const operationId of this.#journeys.keys()) {
      if (!retainedIds.has(operationId)) this.#journeys.delete(operationId);
    }
    await this.#store.write([...this.#journeys.values()], this.#now());
  }

  async #cleanupCopy(journey: Phase14Journey): Promise<void> {
    const root = this.#copyRoot(journey);
    await this.#removeOwnedCopy(root);
    this.#ownedCopies.delete(root);
  }

  async #removeOwnedCopy(root: string): Promise<void> {
    if (
      dirname(root) !== PHASE14_DISPOSABLE_ROOT ||
      root === PHASE14_DISPOSABLE_ROOT
    )
      throw new Phase14ServiceError(
        "target-path",
        "Refused broad cleanup target",
      );
    await rm(root, { recursive: true, force: true });
  }
}
