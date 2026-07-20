import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  EVIDENCE_MAX_CHANGED_PATHS,
  EVIDENCE_MAX_FILE_DIFF_BYTES,
  EVIDENCE_MAX_TOTAL_DIFF_BYTES,
  EVIDENCE_RETENTION_LIMIT,
  EvidenceBaselineSchema,
  EvidenceLookupQuerySchema,
  EvidenceRecordSchema,
  TestEvidenceArtifactSchema,
  type EvidenceBaseline,
  type EvidenceChange,
  type EvidenceFileFingerprint,
  type EvidenceLookupQuery,
  type EvidenceRecord,
  type EvidenceTestTruth,
  type RepositoryGeneration,
  type WorldSnapshot,
} from "@agentintersect-world/world-schema";
import { isKnownBinaryExtension } from "@agentintersect-world/repo-indexer";

const STORE_SCHEMA = "aiw.evidence-store/0.8" as const;
const STORE_FILENAME = "phase8-evidence.json";
const MAX_BASELINE_FILES = 10_000;
const MAX_TEST_ARTIFACT_BYTES = 64 * 1024;
const REDACTION_MARKER = "[REDACTED: secret-like content]";
const TRUNCATION_MARKER = "\n[TRUNCATED: evidence bound reached]\n";
const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "vendor",
  "dist",
  "build",
  "coverage",
  ".cache",
  ".turbo",
  "playwright-report",
  "test-results",
  ".playwright",
]);
const SECRET_LINE =
  /(?:(?:api[_-]?key|token|password|secret|authorization|private[_-]?key)["']?\s*[:=]|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;

type SelectedRepository = {
  generation: RepositoryGeneration;
  snapshot: WorldSnapshot;
};

type StoreEnvelope = {
  schema: typeof STORE_SCHEMA;
  pending: PendingCapture[];
  records: EvidenceRecord[];
  checksum: string;
};

type PendingCapture = {
  baseline: EvidenceBaseline;
  rootPath: string;
};

export type EvidenceTerminalObservation = {
  intentId: string;
  jobId: string;
  runId: string;
  lifecycle: "complete" | "failed";
  reportedPaths?: readonly string[];
  testEvidence?: {
    path: string;
    hash: string;
    state: "passed" | "failed" | "not-run";
  };
};

type EvidenceServiceOptions = {
  root: string;
  selectedRepository: () => SelectedRepository | null;
  now?: () => number;
};

export class EvidenceServiceError extends Error {
  override readonly name = "EvidenceServiceError";

  constructor(
    readonly code: "validation" | "not_found" | "unavailable" | "store_corrupt",
    message: string,
  ) {
    super(message);
  }
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
    .join(",")}}`;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashFile(filename: string): string {
  const hash = createHash("sha256");
  const handle = fs.openSync(filename, "r");
  const chunk = Buffer.allocUnsafe(64 * 1024);
  try {
    while (true) {
      const bytes = fs.readSync(handle, chunk, 0, chunk.byteLength, null);
      if (bytes === 0) break;
      hash.update(chunk.subarray(0, bytes));
    }
  } finally {
    fs.closeSync(handle);
  }
  return hash.digest("hex");
}

function boundedUtf8(
  value: string,
  limit: number,
): { value: string; truncated: boolean } {
  const bytes = Buffer.from(value);
  if (bytes.byteLength <= limit) return { value, truncated: false };
  if (limit <= 0) return { value: "", truncated: true };
  const marker = Buffer.from(TRUNCATION_MARKER);
  if (limit <= marker.byteLength)
    return {
      value: marker.subarray(0, limit).toString("utf8"),
      truncated: true,
    };
  return {
    value: Buffer.concat([
      bytes.subarray(0, Math.max(0, limit - marker.byteLength)),
      marker,
    ]).toString("utf8"),
    truncated: true,
  };
}

function sanitizeText(value: string): { value: string; redactions: number } {
  let redactions = 0;
  const sanitized = value
    .split(/(?<=\n)/)
    .map((line) => {
      if (!SECRET_LINE.test(line)) return line;
      redactions += 1;
      return `${REDACTION_MARKER}${line.endsWith("\n") ? "\n" : ""}`;
    })
    .join("");
  return { value: sanitized, redactions };
}

function normalizedRelative(value: string): string {
  const normalized = value.replaceAll("\\", "/").normalize("NFC");
  if (
    normalized.length < 1 ||
    normalized.length > 4096 ||
    normalized.includes("\0") ||
    path.posix.isAbsolute(normalized) ||
    normalized
      .split("/")
      .some((segment) => segment === ".." || segment.length > 512)
  )
    throw new EvidenceServiceError(
      "validation",
      "Repository evidence path is invalid",
    );
  return normalized.replace(/^\.\//, "");
}

function git(root: string, args: readonly string[]): Buffer {
  try {
    return execFileSync(
      "git",
      [
        "--no-optional-locks",
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "core.fsmonitor=false",
        ...args,
      ],
      {
        cwd: root,
        encoding: "buffer",
        maxBuffer: 8 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          PATH: process.env.PATH,
          LANG: "C",
          LC_ALL: "C",
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_CONFIG_GLOBAL: "/dev/null",
          GIT_ATTR_NOSYSTEM: "1",
          GIT_TERMINAL_PROMPT: "0",
        },
      },
    );
  } catch (error) {
    throw new EvidenceServiceError(
      "unavailable",
      `Read-only Git metadata capture failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

function gitStatus(root: string): Map<string, string> {
  const fields = git(root, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
    "--ignored=no",
  ])
    .toString("utf8")
    .split("\0");
  const statuses = new Map<string, string>();
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (!field || field.length < 4) continue;
    const status = field.slice(0, 2);
    const relative = normalizedRelative(field.slice(3));
    statuses.set(relative, status);
    if (status.includes("R") || status.includes("C")) index += 1;
  }
  return statuses;
}

function discoverNonGit(root: string): string[] {
  const paths: string[] = [];
  const visit = (relativeDirectory: string): void => {
    const entries = fs.readdirSync(path.join(root, relativeDirectory), {
      withFileTypes: true,
    });
    entries.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const relative = normalizedRelative(
        path.posix.join(relativeDirectory.replaceAll("\\", "/"), entry.name),
      );
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) visit(relative);
      } else if (entry.isFile()) paths.push(relative);
      if (paths.length > MAX_BASELINE_FILES)
        throw new EvidenceServiceError(
          "unavailable",
          `Repository evidence exceeds the ${MAX_BASELINE_FILES}-file baseline bound`,
        );
    }
  };
  visit(".");
  return paths;
}

function discoverPaths(root: string, gitPresent: boolean): string[] {
  if (!gitPresent) return discoverNonGit(root);
  const fields = git(root, [
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
  ])
    .toString("utf8")
    .split("\0");
  const paths = fields.filter(Boolean).map(normalizedRelative);
  if (paths.length > MAX_BASELINE_FILES)
    throw new EvidenceServiceError(
      "unavailable",
      `Repository evidence exceeds the ${MAX_BASELINE_FILES}-file baseline bound`,
    );
  return [...new Set(paths)].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}

function fingerprintFile(
  root: string,
  relative: string,
  gitStatusValue: string | null,
  objectRef: string | null,
): EvidenceFileFingerprint | null {
  const filename = path.join(root, ...relative.split("/"));
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(filename);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) return null;
  const sampleLength = Math.min(stat.size, 8 * 1024);
  const sample = Buffer.alloc(sampleLength);
  const handle = fs.openSync(filename, "r");
  try {
    if (sampleLength > 0) fs.readSync(handle, sample, 0, sampleLength, 0);
  } finally {
    fs.closeSync(handle);
  }
  const binary =
    isKnownBinaryExtension(path.posix.extname(relative)) || sample.includes(0);
  const oversized = stat.size > EVIDENCE_MAX_FILE_DIFF_BYTES;
  let sanitizedText: string | undefined;
  let redactions = 0;
  if (!binary && !oversized) {
    const sanitized = sanitizeText(fs.readFileSync(filename, "utf8"));
    sanitizedText = sanitized.value;
    redactions = sanitized.redactions;
  }
  return EvidenceBaselineSchema.shape.files.element.parse({
    path: relative,
    size: stat.size,
    contentHash: hashFile(filename),
    binary,
    oversized,
    ...(sanitizedText === undefined ? {} : { sanitizedText }),
    redactions,
    gitStatus: gitStatusValue,
    objectRef,
  });
}

function readEnvelope(filename: string): StoreEnvelope {
  const raw = JSON.parse(fs.readFileSync(filename, "utf8")) as unknown;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("evidence store root is invalid");
  const value = raw as Record<string, unknown>;
  if (
    value.schema !== STORE_SCHEMA ||
    !Array.isArray(value.pending) ||
    !Array.isArray(value.records) ||
    typeof value.checksum !== "string"
  )
    throw new Error("evidence store envelope is invalid");
  const pending = value.pending.map((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item))
      throw new Error("pending evidence capture is invalid");
    const capture = item as Record<string, unknown>;
    if (
      typeof capture.rootPath !== "string" ||
      !path.isAbsolute(capture.rootPath)
    )
      throw new Error("pending evidence root is invalid");
    return {
      baseline: EvidenceBaselineSchema.parse(capture.baseline),
      rootPath: capture.rootPath,
    };
  });
  const records = value.records.map((item) => EvidenceRecordSchema.parse(item));
  if (pending.length > 1 || records.length > EVIDENCE_RETENTION_LIMIT)
    throw new Error("evidence store retention bounds are invalid");
  if (new Set(records.map((item) => item.intentId)).size !== records.length)
    throw new Error("evidence store contains duplicate completed identities");
  const checksum = sha256(canonical({ pending, records }));
  if (checksum !== value.checksum)
    throw new Error("evidence store checksum is invalid");
  return { schema: STORE_SCHEMA, pending, records, checksum };
}

function contentMetadata(value: EvidenceFileFingerprint | undefined) {
  return value ? { size: value.size, contentHash: value.contentHash } : null;
}

function createDiff(
  pathValue: string,
  before: EvidenceFileFingerprint | undefined,
  after: EvidenceFileFingerprint | undefined,
): {
  diff?: string;
  redactions: number;
  truncated: boolean;
  diagnostics: string[];
} {
  const redactions = (before?.redactions ?? 0) + (after?.redactions ?? 0);
  if (!before && !after)
    return {
      redactions,
      truncated: false,
      diagnostics: [
        "Reported path was not independently confirmed by repository evidence.",
      ],
    };
  if (before?.binary || after?.binary)
    return {
      redactions,
      truncated: false,
      diagnostics: [
        "Binary content is unavailable; bounded metadata and content hash only.",
      ],
    };
  if (before?.oversized || after?.oversized)
    return {
      redactions,
      truncated: true,
      diagnostics: [
        "Text content is unavailable because it exceeds the per-file evidence bound.",
      ],
    };
  const body = [
    `--- ${before ? `a/${before.path}` : "/dev/null"}`,
    `+++ ${after ? `b/${after.path}` : "/dev/null"}`,
    ...(before?.sanitizedText ?? "")
      .split("\n")
      .filter((line, index, all) => line.length > 0 || index < all.length - 1)
      .map((line) => `-${line}`),
    ...(after?.sanitizedText ?? "")
      .split("\n")
      .filter((line, index, all) => line.length > 0 || index < all.length - 1)
      .map((line) => `+${line}`),
    "",
  ].join("\n");
  const bounded = boundedUtf8(body, EVIDENCE_MAX_FILE_DIFF_BYTES);
  return {
    diff: bounded.value,
    redactions,
    truncated: bounded.truncated,
    diagnostics: bounded.truncated
      ? [`Sanitized text diff for ${pathValue} was truncated at 128 KiB.`]
      : [],
  };
}

export class EvidenceService {
  private readonly filename: string;
  private readonly previousFilename: string;
  private readonly now: () => number;
  private pendingCaptures: PendingCapture[] = [];
  private records: EvidenceRecord[] = [];

  constructor(private readonly options: EvidenceServiceOptions) {
    this.now = options.now ?? Date.now;
    fs.mkdirSync(options.root, { recursive: true, mode: 0o700 });
    this.filename = path.join(options.root, STORE_FILENAME);
    this.previousFilename = `${this.filename}.previous`;
    if (!fs.existsSync(this.filename) && !fs.existsSync(this.previousFilename))
      return;
    try {
      const envelope = readEnvelope(this.filename);
      this.pendingCaptures = envelope.pending;
      this.records = envelope.records;
    } catch (currentError) {
      try {
        const envelope = readEnvelope(this.previousFilename);
        this.pendingCaptures = envelope.pending;
        this.records = envelope.records;
      } catch {
        throw new EvidenceServiceError(
          "store_corrupt",
          `Evidence storage is corrupt and fail-closed: ${currentError instanceof Error ? currentError.message : "unknown error"}`,
        );
      }
    }
  }

  pending(intentId: string): EvidenceBaseline | null {
    const capture = this.pendingCaptures.find(
      (item) => item.baseline.intentId === intentId,
    );
    return capture ? structuredClone(capture.baseline) : null;
  }

  latest(): {
    current: EvidenceRecord | null;
    previous: EvidenceRecord | null;
  } {
    const ordered = [...this.records].reverse();
    return {
      current: ordered[0] ? structuredClone(ordered[0]) : null,
      previous: ordered[1] ? structuredClone(ordered[1]) : null,
    };
  }

  lookup(query: EvidenceLookupQuery): {
    current: EvidenceRecord;
    previous: EvidenceRecord | null;
  } {
    const parsed = EvidenceLookupQuerySchema.parse(query);
    const index = this.records.findIndex(
      (record) =>
        record.intentId === parsed.intentId ||
        record.jobId === parsed.jobId ||
        record.runId === parsed.runId,
    );
    if (index < 0)
      throw new EvidenceServiceError("not_found", "Evidence record not found");
    return {
      current: structuredClone(this.records[index] as EvidenceRecord),
      previous:
        index > 0
          ? structuredClone(this.records[index - 1] as EvidenceRecord)
          : null,
    };
  }

  prepare(intentId: string): EvidenceBaseline {
    const completed = this.records.find(
      (record) => record.intentId === intentId,
    );
    if (completed)
      throw new EvidenceServiceError(
        "validation",
        "Intent evidence is already complete",
      );
    const existing = this.pendingCaptures.find(
      (item) => item.baseline.intentId === intentId,
    );
    if (existing) return structuredClone(existing.baseline);
    if (this.pendingCaptures.length > 0)
      throw new EvidenceServiceError(
        "unavailable",
        "Another evidence observation window is active",
      );
    const selected = this.options.selectedRepository();
    if (!selected)
      throw new EvidenceServiceError(
        "unavailable",
        "No successful selected repository generation is available for baseline sealing",
      );
    const baseline = this.captureBaseline(intentId, selected);
    this.pendingCaptures = [
      { baseline, rootPath: fs.realpathSync(selected.generation.rootPath) },
    ];
    this.persist();
    return structuredClone(baseline);
  }

  abort(intentId: string): void {
    if (
      !this.pendingCaptures.some((item) => item.baseline.intentId === intentId)
    )
      return;
    this.pendingCaptures = this.pendingCaptures.filter(
      (item) => item.baseline.intentId !== intentId,
    );
    this.persist();
  }

  finalize(observation: EvidenceTerminalObservation): EvidenceRecord {
    const completed = this.records.find(
      (record) => record.intentId === observation.intentId,
    );
    if (completed) return structuredClone(completed);
    const capture = this.pendingCaptures.find(
      (item) => item.baseline.intentId === observation.intentId,
    );
    if (!capture)
      throw new EvidenceServiceError(
        "not_found",
        "Pending evidence baseline not found",
      );
    const selected = this.options.selectedRepository();
    const record = this.reconcile(
      capture.baseline,
      capture.rootPath,
      selected?.snapshot ?? null,
      observation,
    );
    this.pendingCaptures = [];
    this.records = [...this.records, record].slice(-EVIDENCE_RETENTION_LIMIT);
    this.persist();
    return structuredClone(record);
  }

  private captureBaseline(
    intentId: string,
    selected: SelectedRepository,
  ): EvidenceBaseline {
    const root = fs.realpathSync(selected.generation.rootPath);
    const storeRoot = fs.realpathSync(this.options.root);
    if (storeRoot === root || storeRoot.startsWith(`${root}${path.sep}`))
      throw new EvidenceServiceError(
        "unavailable",
        "Evidence storage must be outside the selected repository",
      );
    const byPath = new Map(
      selected.snapshot.objects.flatMap((object) =>
        object.kind === "file" ? [[object.path, object.ref] as const] : [],
      ),
    );
    const statuses = selected.generation.git.present
      ? gitStatus(root)
      : new Map();
    const paths = discoverPaths(root, selected.generation.git.present);
    const files = paths.flatMap((relative) => {
      const value = fingerprintFile(
        root,
        relative,
        statuses.get(relative) ?? null,
        byPath.get(relative) ?? null,
      );
      return value ? [value] : [];
    });
    const head = selected.generation.git.present
      ? git(root, ["rev-parse", "--verify", "HEAD"]).toString("utf8").trim()
      : null;
    return EvidenceBaselineSchema.parse({
      schema: "aiw.evidence-baseline/0.8",
      intentId,
      generationId: selected.generation.id,
      generationFingerprint: selected.generation.fingerprint,
      repositoryRef: selected.snapshot.repositoryRef,
      git: {
        present: selected.generation.git.present,
        head,
        dirty: statuses.size > 0,
      },
      sealedAt: new Date(this.now()).toISOString(),
      files,
    });
  }

  private reconcile(
    baseline: EvidenceBaseline,
    retainedRoot: string,
    currentSnapshot: WorldSnapshot | null,
    observation: EvidenceTerminalObservation,
  ): EvidenceRecord {
    const root = fs.realpathSync(retainedRoot);
    const currentRefs = new Map(
      (currentSnapshot?.objects ?? []).flatMap((object) =>
        object.kind === "file" ? [[object.path, object.ref] as const] : [],
      ),
    );
    const statuses = baseline.git.present
      ? gitStatus(root)
      : new Map<string, string>();
    const paths = discoverPaths(root, baseline.git.present);
    const current = new Map<string, EvidenceFileFingerprint>();
    for (const relative of paths) {
      const value = fingerprintFile(
        root,
        relative,
        statuses.get(relative) ?? null,
        currentRefs.get(relative) ?? null,
      );
      if (value) current.set(relative, value);
    }
    const before = new Map(baseline.files.map((file) => [file.path, file]));
    const deleted = [...before.values()].filter(
      (file) => !current.has(file.path),
    );
    const created = [...current.values()].filter(
      (file) => !before.has(file.path),
    );
    const renamedDeleted = new Set<string>();
    const renamedCreated = new Set<string>();
    const renameByCreated = new Map<string, EvidenceFileFingerprint>();
    const deletedByHash = new Map<string, EvidenceFileFingerprint[]>();
    const createdByHash = new Map<string, EvidenceFileFingerprint[]>();
    for (const file of deleted) {
      if (!file.contentHash || file.oversized) continue;
      deletedByHash.set(file.contentHash, [
        ...(deletedByHash.get(file.contentHash) ?? []),
        file,
      ]);
    }
    for (const file of created) {
      if (!file.contentHash || file.oversized) continue;
      createdByHash.set(file.contentHash, [
        ...(createdByHash.get(file.contentHash) ?? []),
        file,
      ]);
    }
    for (const [hash, oldFiles] of deletedByHash) {
      const newFiles = createdByHash.get(hash) ?? [];
      if (oldFiles.length !== 1 || newFiles.length !== 1) continue;
      const oldFile = oldFiles[0] as EvidenceFileFingerprint;
      const newFile = newFiles[0] as EvidenceFileFingerprint;
      renamedDeleted.add(oldFile.path);
      renamedCreated.add(newFile.path);
      renameByCreated.set(newFile.path, oldFile);
    }
    const reported = new Set(
      (observation.reportedPaths ?? []).map(normalizedRelative),
    );
    const candidates: Array<{
      path: string;
      previousPath?: string;
      outcome: EvidenceChange["outcome"];
      before?: EvidenceFileFingerprint;
      after?: EvidenceFileFingerprint;
    }> = [];
    for (const file of baseline.files) {
      const after = current.get(file.path);
      if (!after) {
        if (!renamedDeleted.has(file.path))
          candidates.push({
            path: file.path,
            outcome: "deleted",
            before: file,
          });
        continue;
      }
      if (
        file.contentHash !== after.contentHash ||
        file.size !== after.size ||
        file.binary !== after.binary
      )
        candidates.push({
          path: file.path,
          outcome: file.binary || after.binary ? "binary" : "modified",
          before: file,
          after,
        });
    }
    for (const file of created) {
      const oldFile = renameByCreated.get(file.path);
      if (oldFile)
        candidates.push({
          path: file.path,
          previousPath: oldFile.path,
          outcome: "renamed",
          before: oldFile,
          after: file,
        });
      else if (!renamedCreated.has(file.path))
        candidates.push({
          path: file.path,
          outcome: file.binary ? "binary" : "created",
          after: file,
        });
    }
    const confirmedReported = new Set<string>();
    for (const candidate of candidates) {
      if (reported.has(candidate.path)) confirmedReported.add(candidate.path);
      if (candidate.previousPath && reported.has(candidate.previousPath))
        confirmedReported.add(candidate.previousPath);
    }
    for (const reportedPath of reported) {
      if (!confirmedReported.has(reportedPath))
        candidates.push({ path: reportedPath, outcome: "reported" });
    }
    candidates.sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    );
    const observedCount = candidates.length;
    const boundedCandidates = candidates.slice(0, EVIDENCE_MAX_CHANGED_PATHS);
    let remainingDiffBytes = EVIDENCE_MAX_TOTAL_DIFF_BYTES;
    let recordDiffTruncated = false;
    const changes: EvidenceChange[] = boundedCandidates.map((candidate) => {
      const isReported =
        reported.has(candidate.path) ||
        (candidate.previousPath ? reported.has(candidate.previousPath) : false);
      const attribution =
        candidate.outcome === "reported"
          ? "reported-unverified"
          : baseline.git.dirty || !isReported
            ? "ambiguous"
            : "reported-and-confirmed";
      const diffResult = createDiff(
        candidate.path,
        candidate.before,
        candidate.after,
      );
      let diff = diffResult.diff;
      let truncated = diffResult.truncated;
      const diagnostics = [...diffResult.diagnostics];
      if (diff) {
        const bounded = boundedUtf8(diff, remainingDiffBytes);
        diff = bounded.value;
        if (bounded.truncated) {
          truncated = true;
          recordDiffTruncated = true;
          diagnostics.push(
            "Record-wide sanitized text diff bound was reached.",
          );
        }
        remainingDiffBytes -= Buffer.byteLength(diff);
      }
      const objectRef =
        candidate.after?.objectRef ?? candidate.before?.objectRef ?? null;
      const objectState =
        objectRef === null
          ? "unavailable"
          : candidate.outcome === "deleted"
            ? "tombstone"
            : candidate.after?.objectRef
              ? "live"
              : "baseline";
      return {
        path: candidate.path,
        ...(candidate.previousPath
          ? { previousPath: candidate.previousPath }
          : {}),
        outcome: candidate.outcome,
        observationLabel: "observed-in-window",
        attribution,
        reported: isReported,
        binary: Boolean(candidate.before?.binary || candidate.after?.binary),
        before: contentMetadata(candidate.before),
        after: contentMetadata(candidate.after),
        ...(diff ? { diff } : {}),
        diffBytes: diff ? Buffer.byteLength(diff) : 0,
        truncated,
        redactions: diffResult.redactions,
        objectRef,
        objectState,
        diagnostics,
      } satisfies EvidenceChange;
    });
    const test = this.resolveTestTruth(root, current, candidates, observation);
    const totalDiffBytes = changes.reduce(
      (sum, change) => sum + change.diffBytes,
      0,
    );
    const diagnostics: string[] = [];
    if (observedCount > EVIDENCE_MAX_CHANGED_PATHS)
      diagnostics.push(
        `${observedCount - EVIDENCE_MAX_CHANGED_PATHS} changed paths exceed the 256-path evidence bound.`,
      );
    if (baseline.git.dirty)
      diagnostics.push(
        "The observation baseline was already dirty; attribution remains ambiguous.",
      );
    return EvidenceRecordSchema.parse({
      schema: "aiw.evidence/0.8",
      intentId: observation.intentId,
      jobId: observation.jobId,
      runId: observation.runId,
      lifecycle: observation.lifecycle,
      generationId: baseline.generationId,
      generationFingerprint: baseline.generationFingerprint,
      repositoryRef: baseline.repositoryRef,
      observationWindow: {
        openedAt: baseline.sealedAt,
        closedAt: new Date(this.now()).toISOString(),
      },
      attributionLabel: "observed-in-window",
      changes,
      bounds: {
        maxChangedPaths: EVIDENCE_MAX_CHANGED_PATHS,
        maxTotalDiffBytes: EVIDENCE_MAX_TOTAL_DIFF_BYTES,
        maxFileDiffBytes: EVIDENCE_MAX_FILE_DIFF_BYTES,
        changedPathsObserved: observedCount,
        changedPathsReturned: changes.length,
        totalDiffBytes,
        pathsTruncated: observedCount > EVIDENCE_MAX_CHANGED_PATHS,
        diffTruncated:
          recordDiffTruncated || changes.some((change) => change.truncated),
        redactions: changes.reduce((sum, change) => sum + change.redactions, 0),
      },
      test,
      diagnostics,
      completedAt: new Date(this.now()).toISOString(),
    });
  }

  private resolveTestTruth(
    root: string,
    current: ReadonlyMap<string, EvidenceFileFingerprint>,
    candidates: readonly { path: string; outcome: EvidenceChange["outcome"] }[],
    observation: EvidenceTerminalObservation,
  ): EvidenceTestTruth {
    const report = observation.testEvidence;
    if (!report)
      return {
        state: "unavailable",
        verification: "none",
        diagnostic:
          "No exact correlated structured on-disk test evidence was reported.",
      };
    const artifactPath = normalizedRelative(report.path);
    const fingerprint = current.get(artifactPath);
    const changed = candidates.some(
      (candidate) =>
        candidate.path === artifactPath && candidate.outcome !== "reported",
    );
    if (!fingerprint || !changed || fingerprint.contentHash !== report.hash)
      return {
        state: "unverified",
        verification: "reported",
        artifactPath,
        artifactHash: report.hash,
        reportedState: report.state,
        diagnostic:
          "Reported test evidence was not independently hash-consistent in the observation window.",
      };
    if (fingerprint.size > MAX_TEST_ARTIFACT_BYTES || fingerprint.binary)
      return {
        state: "unverified",
        verification: "unverified",
        artifactPath,
        artifactHash: report.hash,
        reportedState: report.state,
        diagnostic:
          "Structured test evidence is binary or exceeds the 64 KiB artifact bound.",
      };
    try {
      const value = TestEvidenceArtifactSchema.parse(
        JSON.parse(
          fs.readFileSync(path.join(root, ...artifactPath.split("/")), "utf8"),
        ),
      );
      if (
        value.intentId !== observation.intentId ||
        value.jobId !== observation.jobId ||
        value.runId !== observation.runId ||
        value.state !== report.state
      )
        throw new Error("correlation mismatch");
      return {
        state: value.state,
        verification: "verified",
        artifactPath,
        artifactHash: report.hash,
        reportedState: report.state,
        diagnostic:
          "Exact correlated structured test evidence was independently confirmed.",
      };
    } catch {
      return {
        state: "unverified",
        verification: "unverified",
        artifactPath,
        artifactHash: report.hash,
        reportedState: report.state,
        diagnostic:
          "Structured test evidence is malformed, conflicting, or correlation-invalid.",
      };
    }
  }

  private persist(): void {
    const pending = this.pendingCaptures.map((item) => ({
      baseline: EvidenceBaselineSchema.parse(item.baseline),
      rootPath: item.rootPath,
    }));
    const records = this.records.map((item) =>
      EvidenceRecordSchema.parse(item),
    );
    const envelope: StoreEnvelope = {
      schema: STORE_SCHEMA,
      pending,
      records,
      checksum: sha256(canonical({ pending, records })),
    };
    if (fs.existsSync(this.filename)) {
      try {
        readEnvelope(this.filename);
        fs.copyFileSync(this.filename, this.previousFilename);
      } catch {
        // Preserve the last verified previous/last-good generation.
      }
    }
    const temporary = `${this.filename}.${process.pid}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(envelope)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    fs.renameSync(temporary, this.filename);
  }
}
