import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  copyFile,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { promisify } from "node:util";

import { z } from "zod";
import {
  applyUncommittedWork,
  captureUncommittedWork,
} from "./workstream-start-source.js";

import {
  WorktreeAuthority,
  WorktreeAuthorityError,
  type WorktreeReceipt,
} from "./worktree-authority.js";

const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);
const timestamp = z.string().datetime({ offset: true });
const WorkstreamRepositoryReferenceSchema = z.strictObject({
  repositoryId: identifier,
  revision: identifier,
});
const WorkstreamAgentReferenceSchema = z.strictObject({
  agentId: identifier,
  nativeSessionId: identifier,
  rootNativeSessionId: identifier.optional(),
  revision: identifier,
});
const WorkstreamProjectionSchema = z.strictObject({
  currentActivity: z.string().min(1).max(512),
  activeFile: z
    .object({
      path: z.string().min(1).max(512),
      activityId: z.string().min(1).max(512),
    })
    .nullable()
    .optional(),
  changedFiles: z
    .array(
      z.strictObject({
        path: z.string().min(1).max(512),
        change: z.enum(["added", "modified", "deleted", "renamed"]),
        diffSummary: z.string().max(512),
      }),
    )
    .max(256),
  diff: z.strictObject({
    summary: z.string().max(8_192),
    patch: z.string().max(65_536),
    truncated: z.boolean(),
  }),
  validation: z
    .array(
      z.strictObject({
        command: z.string().min(1).max(2_048),
        exitCode: z.number().int().min(-1).max(255),
        summary: z.string().min(1).max(2_048),
      }),
    )
    .max(32),
  evidenceRefs: z.array(z.string().min(1).max(512)).max(128),
});
/** Compact World status; full native replies and command evidence stay intact. */
function workstreamOutcomeSummary(
  projection: z.infer<typeof WorkstreamProjectionSchema>,
): string {
  const files = projection.changedFiles;
  const checks = projection.validation;
  const shortLabel = (value: string) =>
    value.length > 48 ? `${value.slice(0, 47)}…` : value;
  const changed =
    files
      .slice(0, 2)
      .map(({ path }) => `\`${shortLabel(path)}\``)
      .join(", ") || "none";
  const passed = checks.filter(({ exitCode }) => exitCode === 0).length;
  const lines = checks.slice(0, 3).map(({ command, exitCode }) => {
    const label = /(?:^|\s)node\s+(?:-e|--eval)(?:\s|=)/u.test(command)
      ? "Inline Node.js check"
      : command.trim() === "git diff --check"
        ? "Whitespace check"
        : shortLabel(command);
    return `- ${label}: **${exitCode === 0 ? "passed" : "failed"}**`;
  });
  return [
    `**Changed files:** ${changed}${files.length > 2 ? ` (+${files.length - 2} more)` : ""}`,
    `**Checks:**\n${checks.length ? `${passed} passed, ${checks.length - passed} failed.\n${lines.join("\n")}${checks.length > 3 ? `\n- ${checks.length - 3} more checks in Inspector.` : ""}` : "No validation evidence reported."}`,
    "Full details: Workstream Inspector.",
  ].join("\n\n");
}

const WorktreeReceiptSchema = z.strictObject({
  schema: z.literal("aiw.worktree-authority-receipt/1"),
  ownerId: identifier,
  requestId: identifier,
  worktreeId: identifier,
  repositoryId: identifier,
  relativePath: z
    .string()
    .min(1)
    .max(256)
    .refine(
      (value) => !value.startsWith("/") && !value.split(/[\\/]/).includes(".."),
    ),
  branch: z.string().min(1).max(256),
  head: z.string().regex(/^[a-f0-9]{40,64}$/),
  state: z.enum(["current", "dirty", "wrong-branch"]),
  statusSummary: z.string().max(2_048),
  validatedAt: timestamp,
  attestation: z.string().regex(/^[a-f0-9]{64}$/),
});
const WorkstreamStatusSchema = z.enum([
  "planning",
  "working",
  "ready-for-review",
  "completed",
  "blocked",
  "cancelled",
  "cleanup-required",
]);
const WorkstreamEventSchema = z.strictObject({
  eventId: identifier,
  status: WorkstreamStatusSchema,
  summary: z.string().min(1).max(512),
  occurredAt: timestamp,
});
const WorkstreamSchema = z.strictObject({
  origin: z
    .strictObject({
      workstreamId: identifier,
      head: z.string().regex(/^[a-f0-9]{40,64}$/),
      mode: z.enum(["uncommitted", "last-commit"]),
    })
    .optional(),
  schema: z.literal("aiw.workstream/1"),
  workstreamId: identifier,
  revision: z.number().int().nonnegative(),
  title: z.string().trim().min(1).max(160),
  task: z.string().trim().min(1).max(2_000).default("Repository Workstream"),
  prIntent: z.enum(["local", "draft"]).optional(),
  repository: WorkstreamRepositoryReferenceSchema,
  agent: WorkstreamAgentReferenceSchema,
  authority: WorktreeReceiptSchema,
  worktreeState: z.enum([
    "current",
    "dirty",
    "wrong-branch",
    "missing",
    "removed",
  ]),
  evidenceOperationRefs: z.array(identifier).max(64),
  agentEventSequenceStart: z.number().int().nonnegative().default(0),
  projection: WorkstreamProjectionSchema.default({
    currentActivity: "No Workstream activity has been reported.",
    changedFiles: [],
    diff: { summary: "", patch: "", truncated: false },
    validation: [],
    evidenceRefs: [],
  }),
  status: WorkstreamStatusSchema,
  createdAt: timestamp,
  updatedAt: timestamp,
  events: z.array(WorkstreamEventSchema).min(1).max(128),
});
const CommandRecordSchema = z.strictObject({
  kind: z.enum(["create", "iterate", "cancel"]),
  requestId: identifier,
  correlationId: identifier,
  canonical: z.string().min(1).max(8_192),
});
const WorkstreamRecordSchema = z.strictObject({
  workstream: WorkstreamSchema,
  commands: z.array(CommandRecordSchema).max(32),
});
const WorkstreamStoreEnvelopeSchema = z.strictObject({
  schema: z.literal("aiw.workstream-store/1"),
  generation: z.number().int().positive(),
  payload: WorkstreamRecordSchema.nullable(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});
const WorkstreamCreateRequestSchema = z.strictObject({
  sourceWorkstream: z
    .strictObject({
      workstreamId: identifier,
      expectedRevision: z.number().int().nonnegative(),
      expectedHead: z.string().regex(/^[a-f0-9]{40,64}$/),
      mode: z.enum(["uncommitted", "last-commit"]),
    })
    .optional(),
  requestId: identifier,
  correlationId: identifier,
  title: z.string().trim().min(1).max(160),
  task: z.string().trim().min(1).max(2_000).optional(),
  branch: z.string().trim().min(1).max(128).optional(),
  startPoint: z
    .string()
    .regex(/^(HEAD|[a-f0-9]{40,64})$/)
    .optional(),
  prIntent: z.enum(["local", "draft"]).optional(),
  repository: WorkstreamRepositoryReferenceSchema,
  agent: WorkstreamAgentReferenceSchema,
});
const WorkstreamCancelRequestSchema = z.strictObject({
  requestId: identifier,
  correlationId: identifier,
  workstreamId: identifier,
  expectedRevision: z.number().int().nonnegative(),
  repository: WorkstreamRepositoryReferenceSchema,
  agent: WorkstreamAgentReferenceSchema,
});
const WorkstreamIterationRequestSchema = z.strictObject({
  requestId: identifier,
  correlationId: identifier,
  workstreamId: identifier,
  expectedRevision: z.number().int().nonnegative(),
  feedback: z.string().trim().min(1).max(2_000),
  repository: WorkstreamRepositoryReferenceSchema,
  agent: WorkstreamAgentReferenceSchema,
});
const WorkstreamPreviewRequestSchema = z.strictObject({
  workstreamId: identifier,
  expectedWorkstreamRevision: z.number().int().nonnegative(),
  repository: WorkstreamRepositoryReferenceSchema,
  agent: WorkstreamAgentReferenceSchema,
});

export type WorkstreamRepositoryReference = z.infer<
  typeof WorkstreamRepositoryReferenceSchema
>;
export type WorkstreamAgentReference = z.infer<
  typeof WorkstreamAgentReferenceSchema
>;
export type WorkstreamAgentBinding = WorkstreamAgentReference & {
  readonly worktreeRef: string | null;
  readonly currentTaskRef: string | null;
  readonly mode: "explore" | "collaborate";
  readonly eventSequence: number;
};
export type WorkstreamAgentPort = {
  readonly current: (agentId: string) => WorkstreamAgentBinding | null;
  readonly busy: (agentId: string) => boolean;
  readonly bind: (input: {
    readonly agent: WorkstreamAgentReference;
    readonly worktreeRef: string;
    readonly taskRef: string;
  }) => Promise<WorkstreamAgentBinding> | WorkstreamAgentBinding;
  readonly dispatch: (input: {
    readonly agentId: string;
    readonly task: string;
    readonly systemContext: string;
    readonly signal: AbortSignal;
  }) => Promise<void>;
  readonly evidence: (
    agentId: string,
    afterSequence: number,
  ) => readonly {
    readonly ref: string;
    readonly summary: string;
    readonly path?: string;
    readonly activityId?: string;
  }[];
  readonly unbind: (input: {
    readonly agentId: string;
    readonly worktreeRef: string;
    readonly taskRef: string;
  }) => Promise<void> | void;
};
export type WorkstreamCreateRequest = z.infer<
  typeof WorkstreamCreateRequestSchema
>;
export type WorkstreamCancelRequest = z.infer<
  typeof WorkstreamCancelRequestSchema
>;
export type WorkstreamIterationRequest = z.infer<
  typeof WorkstreamIterationRequestSchema
>;
export type WorkstreamPreviewRequest = z.infer<
  typeof WorkstreamPreviewRequestSchema
>;
export type Workstream = z.infer<typeof WorkstreamSchema>;
type WorkstreamRecord = z.infer<typeof WorkstreamRecordSchema>;
type WorkstreamStoreEnvelope = z.infer<typeof WorkstreamStoreEnvelopeSchema>;

export type WorkstreamEvidenceReader = {
  readonly read: (
    operationRefs: readonly string[],
  ) => Promise<readonly string[]> | readonly string[];
};

export type WorkstreamServiceOptions = {
  readonly directory: string;
  readonly worktreeAuthority: WorktreeAuthority;
  readonly worktreeParent?: string;
  readonly currentRepository: () =>
    | Promise<WorkstreamRepositoryReference | null>
    | WorkstreamRepositoryReference
    | null;
  readonly connectedAgent?: (
    agentId: string,
  ) =>
    Promise<WorkstreamAgentReference | null> | WorkstreamAgentReference | null;
  readonly evidenceReader: WorkstreamEvidenceReader;
  readonly agentPort?: WorkstreamAgentPort;
  readonly previewStop?: (workstreamId: string) => Promise<void> | void;
  readonly id?: () => string;
  readonly now?: () => number;
};

export class WorkstreamServiceError extends Error {
  constructor(
    readonly code:
      | "validation"
      | "repository-mismatch"
      | "agent-mismatch"
      | "correlation-conflict"
      | "revision-conflict"
      | "active-workstream"
      | "not-found"
      | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "WorkstreamServiceError";
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function optionalRead(path: string): Promise<string | null> {
  return readFile(path, "utf8").catch((error: unknown) => {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === "ENOENT"
    )
      return null;
    throw error;
  });
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

function envelopeFor(
  record: WorkstreamRecord | null,
  generation: number,
): WorkstreamStoreEnvelope {
  return WorkstreamStoreEnvelopeSchema.parse({
    schema: "aiw.workstream-store/1",
    generation,
    payload: record,
    checksum: sha256(canonical(record)),
  });
}

function parseEnvelope(input: string): WorkstreamStoreEnvelope {
  const raw: unknown = JSON.parse(input);
  if (
    !raw ||
    typeof raw !== "object" ||
    !("checksum" in raw) ||
    !("payload" in raw) ||
    (raw as { checksum: unknown }).checksum !==
      sha256(canonical((raw as { payload: unknown }).payload))
  )
    throw new Error("Workstream generation checksum mismatch");
  return WorkstreamStoreEnvelopeSchema.parse(raw);
}

function referencesEqual(
  left: WorkstreamRepositoryReference | WorkstreamAgentReference,
  right: WorkstreamRepositoryReference | WorkstreamAgentReference,
): boolean {
  return canonical(left) === canonical(right);
}

function isMissing(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: unknown }).code === "ENOENT",
  );
}

const executeFile = promisify(execFile);
const WorkstreamReportSchema = z.strictObject({
  schema: z.literal("aiw.workstream-report/1"),
  workstreamId: identifier,
  activity: z.string().trim().min(1).max(512),
  validation: z
    .array(
      z.strictObject({
        command: z.string().trim().min(1).max(2_048),
        exitCode: z.number().int().min(-1).max(255),
        summary: z.string().trim().min(1).max(2_048),
      }),
    )
    .max(32),
  evidenceRefs: z.array(identifier).max(64),
});

function contained(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

async function git(worktree: string, args: readonly string[]): Promise<string> {
  const { stdout } = await executeFile("git", [...args], {
    cwd: worktree,
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
    env: {
      PATH: process.env.PATH,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      LC_ALL: "C",
    },
  });
  return stdout;
}

async function boundedRead(
  path: string,
  maximumBytes: number,
): Promise<string | null> {
  let handle;
  try {
    handle = await open(path, "r");
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  try {
    const buffer = Buffer.alloc(maximumBytes + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > maximumBytes)
      throw new Error("Workstream report is too large");
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

function changedFiles(status: string): Array<{
  path: string;
  change: "added" | "modified" | "deleted" | "renamed";
  diffSummary: string;
}> {
  const entries = status.split("\0").filter(Boolean);
  const result: Array<{
    path: string;
    change: "added" | "modified" | "deleted" | "renamed";
    diffSummary: string;
  }> = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    const code = entry.slice(0, 2);
    const path = entry.slice(3);
    const renamed = code.includes("R") || code.includes("C");
    if (renamed) index += 1;
    const change =
      code === "??" || code.includes("A")
        ? "added"
        : code.includes("D")
          ? "deleted"
          : renamed
            ? "renamed"
            : "modified";
    result.push({
      path,
      change,
      diffSummary: `${code.trim() || "??"} ${path}`,
    });
  }
  return result.slice(0, 256);
}

export class WorkstreamService {
  readonly #directory: string;
  readonly #reportsDirectory: string;
  readonly #currentPath: string;
  readonly #previousPath: string;
  readonly #worktreeAuthority: WorktreeAuthority;
  readonly #recordDirectories = new Map<string, string>();
  readonly #worktreeParent: string | null;
  readonly #currentRepository: WorkstreamServiceOptions["currentRepository"];
  readonly #connectedAgent: NonNullable<
    WorkstreamServiceOptions["connectedAgent"]
  >;
  readonly #evidenceReader: WorkstreamEvidenceReader;
  readonly #agentPort: WorkstreamAgentPort | null;
  readonly #previewStop: (workstreamId: string) => Promise<void> | void;
  readonly #id: () => string;
  readonly #now: () => number;
  #generation = 0;
  #loadedFromPrevious = false;
  #record: WorkstreamRecord | null = null;
  #loadPromise: Promise<void> | null = null;
  #mutationTail: Promise<void> = Promise.resolve();
  readonly #runs = new Map<
    string,
    { readonly controller: AbortController; readonly turn: Promise<void> }
  >();

  constructor(options: WorkstreamServiceOptions) {
    this.#directory = resolve(options.directory);
    this.#reportsDirectory = join(this.#directory, "reports");
    this.#currentPath = join(this.#directory, "workstream.current.json");
    this.#previousPath = join(this.#directory, "workstream.previous.json");
    this.#worktreeAuthority = options.worktreeAuthority;
    this.#worktreeParent = options.worktreeParent
      ? resolve(options.worktreeParent)
      : null;
    this.#currentRepository = options.currentRepository;
    this.#connectedAgent = options.connectedAgent ?? (() => null);
    this.#evidenceReader = options.evidenceReader;
    this.#agentPort = options.agentPort ?? null;
    this.#previewStop = options.previewStop ?? (() => undefined);
    this.#id = options.id ?? randomUUID;
    this.#now = options.now ?? Date.now;
  }

  pathsForTest(): { readonly current: string; readonly previous: string } {
    return { current: this.#currentPath, previous: this.#previousPath };
  }

  async current(): Promise<Workstream | null> {
    await this.#ensureLoaded();
    return this.#record ? this.#project(this.#record.workstream) : null;
  }

  async read(workstreamId: string): Promise<Workstream> {
    await this.#ensureLoaded();
    const record =
      this.#record?.workstream.workstreamId === workstreamId
        ? this.#record
        : (await this.#historyRecords()).get(workstreamId);
    if (!record)
      throw new WorkstreamServiceError("not-found", "Workstream not found");
    return this.#project(record.workstream);
  }

  /** Source is read from the attested owned tree, never from agent narration. */
  async source(workstreamId: string, path?: string) {
    const work = await this.read(workstreamId);
    const receipt = await this.#worktreeAuthority.restore(work.authority);
    if (
      receipt.state === "wrong-branch" ||
      ["missing", "removed"].includes(work.worktreeState)
    )
      throw new WorkstreamServiceError(
        "unavailable",
        "Saved worktree is unavailable or on a different branch",
      );
    const root = await realpath(this.#worktreePath(work));
    const names = [
      ...new Set(
        (
          await git(root, [
            "ls-files",
            "--cached",
            "--others",
            "--exclude-standard",
            "-z",
          ])
        )
          .split("\0")
          .filter(Boolean),
      ),
    ].sort();
    const files = names
      .slice(0, 256)
      .map((name) => ({ ref: name, path: name }));
    const base = {
      objectRef: path ?? `aiw://object/workstream-${workstreamId}`,
      repositoryRef: work.repository.repositoryId,
      path: path ?? work.title,
      kind: path ? "file" : "workstream",
      files,
    };
    if (!path)
      return {
        ...base,
        content: null,
        message: names.length
          ? `Select a Workstream file · ${names.length} files${names.length > 256 ? " (first 256 shown)" : ""}`
          : "No source files have been written yet.",
      };
    if (
      !names.includes(path) ||
      path.split(/[\\/]/).includes("..") ||
      isAbsolute(path)
    )
      throw new WorkstreamServiceError(
        "not-found",
        "File is not part of this Workstream",
      );
    let handle;
    try {
      const target = await realpath(resolve(root, path));
      if (!contained(root, target))
        throw new Error("Source is outside the owned worktree");
      handle = await open(
        target,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      const stat = await handle.stat();
      const limit = 512 * 1024;
      if (!stat.isFile() || stat.size > limit)
        return {
          ...base,
          content: null,
          message: "Text inspection is limited to regular files up to 512 KiB.",
        };
      const bytes = Buffer.alloc(limit + 1);
      const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
      if (bytesRead > limit || bytes.subarray(0, bytesRead).includes(0))
        return {
          ...base,
          content: null,
          message:
            "This file is binary or exceeds the 512 KiB inspection limit.",
        };
      return {
        ...base,
        content: bytes.toString("utf8", 0, bytesRead),
        message: "Current Workstream file contents · read only",
      };
    } catch {
      throw new WorkstreamServiceError(
        "unavailable",
        "Source file is no longer readable inside this Workstream",
      );
    } finally {
      await handle?.close();
    }
  }

  async history(repositoryId: string): Promise<Workstream[]> {
    await this.#ensureLoaded();
    const records = await this.#historyRecords();
    return Promise.all(
      [...records.values()]
        .map((record) => clone(record.workstream))
        .filter(
          (workstream) => workstream.repository.repositoryId === repositoryId,
        )
        .sort(
          (a, b) =>
            b.updatedAt.localeCompare(a.updatedAt) ||
            a.workstreamId.localeCompare(b.workstreamId),
        )
        .map((workstream) => this.#project(workstream)),
    );
  }

  async #historyRecords(): Promise<Map<string, WorkstreamRecord>> {
    const records = new Map<string, WorkstreamRecord>();
    const archive = join(this.#directory, "archive");
    let names: string[];
    try {
      names = await readdir(archive);
    } catch (error) {
      if (isMissing(error)) names = [];
      else throw error;
    }
    for (const name of names.filter((name) =>
      /^[a-f0-9]{64}\.\d+\.json$/.test(name),
    )) {
      const envelope = parseEnvelope(
        await readFile(join(archive, name), "utf8"),
      );
      const record = envelope.payload;
      if (!record) continue;
      const previous = records.get(record.workstream.workstreamId);
      if (
        !previous ||
        previous.workstream.revision < record.workstream.revision
      )
        records.set(record.workstream.workstreamId, record);
    }
    if (this.#record)
      records.set(this.#record.workstream.workstreamId, this.#record);
    for (const id of records.keys())
      this.#recordDirectories.set(id, this.#directory);
    const selected = await this.#currentRepository();
    if (!selected) return records;
    const stores = new Map<string, Set<string>>();
    for (const location of await this.#worktreeAuthority.savedWorkstreamStores()) {
      const directory = resolve(location.directory);
      if (directory === this.#directory) continue;
      const paths = stores.get(directory) ?? new Set<string>();
      paths.add(resolve(location.worktreePath));
      stores.set(directory, paths);
    }
    for (const [directory, paths] of stores) {
      const external: WorkstreamRecord[] = [];
      const currentText = await optionalRead(
        join(directory, "workstream.current.json"),
      );
      if (currentText) {
        let envelope: WorkstreamStoreEnvelope;
        try {
          envelope = parseEnvelope(currentText);
        } catch {
          envelope = parseEnvelope(
            await readFile(join(directory, "workstream.previous.json"), "utf8"),
          );
        }
        if (envelope.payload) external.push(envelope.payload);
      }
      let names: string[] = [];
      try {
        names = await readdir(join(directory, "archive"));
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
      for (const name of names.filter((name) =>
        /^[a-f0-9]{64}\.\d+\.json$/.test(name),
      )) {
        const payload = parseEnvelope(
          await readFile(join(directory, "archive", name), "utf8"),
        ).payload;
        if (payload) external.push(payload);
      }
      for (const record of external) {
        const work = record.workstream;
        if (
          work.repository.repositoryId !== selected.repositoryId ||
          work.worktreeState === "removed"
        )
          continue;
        // A locator is discovery only: the saved receipt must resolve back to
        // one of this repository's exact registered worktrees before exposure.
        const previous = records.get(work.workstreamId);
        if (previous && previous.workstream.revision >= work.revision) continue;
        await this.#worktreeAuthority.restore(work.authority);
        if (
          !paths.has(resolve(this.#worktreeAuthority.pathFor(work.authority)))
        )
          continue;
        records.set(work.workstreamId, record);
        this.#recordDirectories.set(work.workstreamId, directory);
      }
    }
    return records;
  }

  async #archiveCurrent(): Promise<void> {
    if (!this.#record) return;
    const archive = join(this.#directory, "archive");
    await mkdir(archive, { recursive: true, mode: 0o700 });
    const path = join(
      archive,
      `${sha256(this.#record.workstream.workstreamId)}.${this.#generation}.json`,
    );
    await writeFile(
      path,
      JSON.stringify(envelopeFor(this.#record, this.#generation)),
      { mode: 0o600 },
    );
    await syncFile(path);
    await syncDirectory(archive);
  }

  async continueSaved(
    input: unknown,
  ): Promise<{ workstream: Workstream; replayed: boolean }> {
    const parsed = z
      .strictObject({
        workstreamId: identifier,
        expectedRevision: z.number().int().nonnegative(),
        repository: WorkstreamRepositoryReferenceSchema,
        agent: WorkstreamAgentReferenceSchema,
        confirm: z.literal(true),
      })
      .safeParse(input);
    if (!parsed.success)
      throw new WorkstreamServiceError(
        "validation",
        "Confirm the exact saved Workstream and selected agent before continuing",
      );
    const request = parsed.data;
    return this.#serialize(async () => {
      await this.#ensureLoaded();
      const record = (await this.#historyRecords()).get(request.workstreamId);
      if (!record)
        throw new WorkstreamServiceError(
          "not-found",
          "Saved Workstream not found",
        );
      const workstream = record.workstream;
      if (workstream.revision !== request.expectedRevision)
        throw new WorkstreamServiceError(
          "revision-conflict",
          "Saved work changed. Refresh Workbench before continuing.",
        );
      if (
        workstream.repository.repositoryId !== request.repository.repositoryId
      )
        throw new WorkstreamServiceError(
          "repository-mismatch",
          "Load this Workstream's repository first",
        );
      await this.#assertCurrentReferences(request.repository, request.agent);
      for (const candidate of [workstream, this.#record?.workstream]) {
        if (
          candidate &&
          (this.#runs.has(candidate.workstreamId) ||
            this.#agentPort?.busy(candidate.agent.agentId))
        )
          throw new WorkstreamServiceError(
            "active-workstream",
            "Wait for active work to finish before continuing saved work",
          );
      }
      if (this.#agentPort?.busy(request.agent.agentId))
        throw new WorkstreamServiceError(
          "active-workstream",
          "Selected agent is busy",
        );
      if (
        workstream.status === "cancelled" ||
        ["removed", "missing"].includes(workstream.worktreeState)
      )
        throw new WorkstreamServiceError(
          "unavailable",
          "This saved worktree is unavailable. Start a new Workstream from a commit instead.",
        );
      let receipt: WorktreeReceipt;
      try {
        receipt = await this.#worktreeAuthority.restore(workstream.authority);
      } catch {
        throw new WorkstreamServiceError(
          "unavailable",
          "Saved worktree could not be verified. Its files have not been changed.",
        );
      }
      if (receipt.state === "wrong-branch")
        throw new WorkstreamServiceError(
          "unavailable",
          "Saved worktree branch changed. No files were changed.",
        );
      await this.#archiveCurrent();
      const savedReport = await boundedRead(
        this.#reportPath(workstream.workstreamId),
        64 * 1024,
      );
      this.#recordDirectories.set(workstream.workstreamId, this.#directory);
      if (savedReport !== null) {
        const reportPath = this.#reportPath(workstream.workstreamId);
        await mkdir(dirname(reportPath), { recursive: true, mode: 0o700 });
        await writeFile(reportPath, savedReport, { mode: 0o600 });
      }
      const binding = this.#agentPort
        ? await this.#bindWorktree({
            agent: request.agent,
            worktreeRef: receipt.worktreeId,
            taskRef: workstream.workstreamId,
          })
        : null;
      const agent = binding
        ? {
            agentId: binding.agentId,
            nativeSessionId: binding.nativeSessionId,
            ...(binding.rootNativeSessionId
              ? { rootNativeSessionId: binding.rootNativeSessionId }
              : {}),
            revision: binding.revision,
          }
        : request.agent;
      const sameSession =
        agent.agentId === workstream.agent.agentId &&
        agent.nativeSessionId === workstream.agent.nativeSessionId;
      const now = new Date(this.#now()).toISOString();
      this.#record = WorkstreamRecordSchema.parse({
        ...record,
        workstream: {
          ...workstream,
          revision: workstream.revision + 1,
          repository: request.repository,
          agent,
          authority: receipt,
          worktreeState: receipt.state,
          status: "ready-for-review",
          updatedAt: now,
          agentEventSequenceStart:
            binding?.eventSequence ?? workstream.agentEventSequenceStart,
          events: [
            ...workstream.events,
            {
              eventId: `${workstream.workstreamId}/event/${workstream.revision + 1}`,
              status: "ready-for-review",
              summary: sameSession
                ? "Saved work restored in the same session. No coding turn sent."
                : `Saved work continued with a new session; previous session ${workstream.agent.agentId} retained. No coding turn sent.`,
              occurredAt: now,
            },
          ].slice(-128),
        },
      });
      await this.#persist();
      return {
        workstream: await this.#project(this.#record!.workstream),
        replayed: false,
      };
    });
  }

  async gitDirectory(
    workstreamId: string,
    repositoryId: string,
  ): Promise<string> {
    await this.#ensureLoaded();
    const workstream = (await this.#historyRecords()).get(
      workstreamId,
    )?.workstream;
    if (!workstream || workstream.repository.repositoryId !== repositoryId)
      throw new WorkstreamServiceError(
        "not-found",
        "Workstream does not belong to the loaded repository",
      );
    if (
      this.#runs.has(workstreamId) ||
      this.#agentPort?.busy(workstream.agent.agentId)
    )
      throw new WorkstreamServiceError(
        "active-workstream",
        "Wait for the coding turn before using Git",
      );
    if (
      workstream.status === "cancelled" ||
      ["removed", "missing"].includes(workstream.worktreeState)
    )
      throw new WorkstreamServiceError(
        "unavailable",
        "Worktree is unavailable",
      );
    const receipt = await this.#worktreeAuthority.restore(workstream.authority);
    if (receipt.state === "wrong-branch")
      throw new WorkstreamServiceError(
        "unavailable",
        "Worktree branch changed",
      );
    return this.#worktreePath(workstream);
  }

  async #bindWorktree(
    input: Parameters<WorkstreamAgentPort["bind"]>[0],
  ): Promise<WorkstreamAgentBinding> {
    const port = this.#agentPort!;
    const previous = port.current(input.agent.agentId);
    if (
      previous?.worktreeRef === input.worktreeRef &&
      previous.currentTaskRef === input.taskRef &&
      previous.mode === "collaborate"
    )
      return previous;
    if (
      previous?.worktreeRef &&
      previous.currentTaskRef &&
      previous.currentTaskRef !== input.taskRef
    ) {
      const old = (await this.#historyRecords()).get(
        previous.currentTaskRef,
      )?.workstream;
      if (
        !old ||
        old.agent.agentId !== previous.agentId ||
        old.authority.worktreeId !== previous.worktreeRef ||
        this.#runs.has(old.workstreamId) ||
        port.busy(previous.agentId)
      )
        throw new WorkstreamServiceError(
          "active-workstream",
          "Selected agent has another active or unknown Workstream binding",
        );
      await port.unbind({
        agentId: previous.agentId,
        worktreeRef: previous.worktreeRef,
        taskRef: previous.currentTaskRef,
      });
      const current = port.current(previous.agentId)!;
      const agent = {
        agentId: current.agentId,
        nativeSessionId: current.nativeSessionId,
        ...(current.rootNativeSessionId
          ? { rootNativeSessionId: current.rootNativeSessionId }
          : {}),
        revision: current.revision,
      };
      try {
        return await port.bind({ ...input, agent });
      } catch (error) {
        const restored = port.current(previous.agentId);
        if (restored)
          await port.bind({
            agent: { ...agent, revision: restored.revision },
            worktreeRef: previous.worktreeRef,
            taskRef: previous.currentTaskRef,
          });
        throw error;
      }
    }
    return port.bind(input);
  }

  async previewBinding(input: unknown): Promise<{
    readonly workstreamId: string;
    readonly workstreamRevision: number;
    readonly repository: WorkstreamRepositoryReference;
    readonly agent: WorkstreamAgentReference;
    readonly worktreeId: string;
    readonly worktreeState: "current" | "dirty";
    readonly worktreePath: string;
  }> {
    const parsed = WorkstreamPreviewRequestSchema.safeParse(input);
    if (!parsed.success)
      throw new WorkstreamServiceError(
        "validation",
        parsed.error.issues[0]?.message ?? "Invalid Workstream preview request",
      );
    await this.#ensureLoaded();
    const workstream = this.#record?.workstream;
    if (!workstream || workstream.workstreamId !== parsed.data.workstreamId)
      throw new WorkstreamServiceError("not-found", "Workstream not found");
    if (workstream.revision !== parsed.data.expectedWorkstreamRevision)
      throw new WorkstreamServiceError(
        "revision-conflict",
        `Expected revision ${parsed.data.expectedWorkstreamRevision}; current is ${workstream.revision}`,
      );
    if (!referencesEqual(parsed.data.repository, workstream.repository))
      throw new WorkstreamServiceError(
        "repository-mismatch",
        "Workstream repository reference is stale",
      );
    if (!referencesEqual(parsed.data.agent, workstream.agent))
      throw new WorkstreamServiceError(
        "agent-mismatch",
        "Workstream agent/session reference is stale",
      );
    if (
      workstream.status === "cancelled" ||
      workstream.worktreeState === "removed" ||
      workstream.worktreeState === "missing"
    )
      throw new WorkstreamServiceError(
        "unavailable",
        "Workstream worktree is not available for preview",
      );
    await this.#assertCurrentReferences(
      workstream.repository,
      workstream.agent,
    );
    let receipt: WorktreeReceipt;
    try {
      receipt = await this.#worktreeAuthority.restore(
        workstream.authority as WorktreeReceipt,
      );
    } catch (error) {
      throw new WorkstreamServiceError(
        "unavailable",
        error instanceof Error
          ? `Workstream worktree attestation failed: ${error.message}`
          : "Workstream worktree attestation failed",
      );
    }
    if (receipt.state === "wrong-branch")
      throw new WorkstreamServiceError(
        "unavailable",
        "Workstream worktree is on the wrong branch",
      );
    return {
      workstreamId: workstream.workstreamId,
      workstreamRevision: workstream.revision,
      repository: clone(workstream.repository),
      agent: clone(workstream.agent),
      worktreeId: receipt.worktreeId,
      worktreeState: receipt.state,
      worktreePath: this.#worktreePath(workstream),
    };
  }

  async contextForAgent(input: {
    readonly intent?: "discussion" | "work";
    readonly agentId: string;
    readonly worktreeRef: string | null;
    readonly currentTaskRef: string | null;
  }): Promise<string | null> {
    await this.#ensureLoaded();
    const workstream = this.#record?.workstream;
    if (
      !workstream ||
      workstream.agent.agentId !== input.agentId ||
      workstream.authority.worktreeId !== input.worktreeRef ||
      workstream.workstreamId !== input.currentTaskRef ||
      workstream.status === "cancelled"
    )
      return null;
    if (input.intent === "discussion")
      return [
        "This turn is a conversation, not a coding task. Answer naturally as yourself, the connected agent, using the existing conversation and work context.",
        `The open Workstream is ${JSON.stringify(workstream.task)}; its status is ${workstream.status}.`,
        `The owned worktree is ${JSON.stringify(this.#worktreePath(workstream))}. You may inspect it to answer questions, but do not edit files, run mutating commands, write work reports, or resume implementation in this discussion turn.`,
        "Discuss options and help finalize the next task. The operator uses /work followed by the agreed task to resume coding. Existing reports remain visible; do not replace your conversational reply with a receipt.",
      ].join("\n");
    return this.#systemContext(workstream);
  }

  async directoryForAgent(input: {
    readonly agentId: string;
    readonly worktreeRef: string | null;
    readonly currentTaskRef: string | null;
  }): Promise<{ workingDirectory: string; evidenceDirectory: string } | null> {
    if (!input.worktreeRef && !input.currentTaskRef) return null;
    const context = await this.contextForAgent(input);
    const workstream = this.#record?.workstream;
    if (!context || !workstream)
      throw new WorkstreamServiceError(
        "unavailable",
        "Owned Workstream binding is stale; reconnect before working",
      );
    const receipt = await this.#worktreeAuthority.restore(workstream.authority);
    if (receipt.state === "wrong-branch")
      throw new WorkstreamServiceError(
        "unavailable",
        "Owned worktree branch changed",
      );
    const evidenceDirectory = dirname(
      this.#reportPath(workstream.workstreamId),
    );
    await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
    return {
      workingDirectory: this.#worktreePath(workstream),
      evidenceDirectory,
    };
  }

  async create(input: unknown): Promise<{
    readonly workstream: Workstream;
    readonly replayed: boolean;
  }> {
    const request = this.#parseCreate(input);
    return this.#serialize(async () => {
      await this.#ensureLoaded();
      const canonicalRequest = canonical({ kind: "create", request });
      const replay = this.#commandReplay(
        request.requestId,
        request.correlationId,
        canonicalRequest,
      );
      if (replay)
        return {
          workstream: await this.#project(replay.workstream),
          replayed: true,
        };
      await this.#assertCurrentReferences(request.repository, request.agent);
      const previous = this.#record?.workstream;
      const differentOwner =
        previous &&
        (previous.repository.repositoryId !== request.repository.repositoryId ||
          previous.agent.agentId !== request.agent.agentId ||
          (previous.agent.rootNativeSessionId ??
            previous.agent.nativeSessionId) !==
            (request.agent.rootNativeSessionId ??
              request.agent.nativeSessionId));
      if (
        previous &&
        (this.#runs.has(previous.workstreamId) ||
          this.#agentPort?.busy(previous.agent.agentId) ||
          (!differentOwner &&
            !["completed", "cancelled", "ready-for-review", "blocked"].includes(
              previous.status,
            )))
      )
        throw new WorkstreamServiceError(
          "active-workstream",
          "The existing Workstream is still active. Finish or cancel its work before starting another.",
        );
      if (this.#agentPort?.busy(request.agent.agentId))
        throw new WorkstreamServiceError(
          "agent-mismatch",
          "Wait for the selected World agent turn to finish",
        );
      let sourceHead: string | undefined;
      let changes: Awaited<ReturnType<typeof captureUncommittedWork>> = [];
      if (request.sourceWorkstream) {
        if (!this.#worktreeParent)
          throw new WorkstreamServiceError(
            "unavailable",
            "Worktree storage is unavailable",
          );
        const source = (await this.#historyRecords()).get(
          request.sourceWorkstream.workstreamId,
        )?.workstream;
        if (
          !source ||
          source.repository.repositoryId !== request.repository.repositoryId
        )
          throw new WorkstreamServiceError(
            "repository-mismatch",
            "Select a source Workstream in this project.",
          );
        if (source.revision !== request.sourceWorkstream.expectedRevision)
          throw new WorkstreamServiceError(
            "revision-conflict",
            "Source work changed. Reopen New Workstream.",
          );
        if (
          this.#runs.has(source.workstreamId) ||
          this.#agentPort?.busy(source.agent.agentId)
        )
          throw new WorkstreamServiceError(
            "active-workstream",
            "Wait for the source agent to finish before copying its work.",
          );
        const receipt = await this.#worktreeAuthority.restore(source.authority);
        if (
          receipt.state === "wrong-branch" ||
          receipt.head !== request.sourceWorkstream.expectedHead
        )
          throw new WorkstreamServiceError(
            "revision-conflict",
            "Source branch or commit changed. Reopen New Workstream.",
          );
        sourceHead = receipt.head;
        if (request.sourceWorkstream.mode === "uncommitted")
          changes = await captureUncommittedWork(
            join(this.#worktreeParent, receipt.relativePath),
          );
      }
      if (previous) {
        // Retain the old record and its worktree; never rebind or retry its agent.
        const archive = join(this.#directory, "archive");
        await mkdir(archive, { recursive: true, mode: 0o700 });
        const path = join(
          archive,
          `${sha256(previous.workstreamId)}.${this.#generation}.json`,
        );
        await writeFile(
          path,
          JSON.stringify(envelopeFor(this.#record, this.#generation)),
          { mode: 0o600 },
        );
        await syncFile(path);
        await syncDirectory(archive);
      }
      const workstreamId = identifier.parse(this.#id());
      const task = request.task ?? request.title;
      const createdAt = new Date(this.#now()).toISOString();
      const ownerId = this.#ownerId(workstreamId);
      const authorityResult = await this.#worktreeAuthority.createGenerated({
        ownerId,
        requestId: this.#authorityRequestId(request.requestId),
        worktreeId: `worktree-${sha256(workstreamId).slice(0, 24)}`,
        ...(request.branch ? { branch: request.branch } : {}),
        ...(sourceHead
          ? { startPoint: sourceHead }
          : request.startPoint
            ? { startPoint: request.startPoint }
            : {}),
      });
      if (changes.length && this.#worktreeParent)
        await applyUncommittedWork(
          join(this.#worktreeParent, authorityResult.receipt.relativePath),
          changes,
        );
      let boundAgent = request.agent;
      let agentEventSequenceStart = 0;
      if (this.#agentPort) {
        try {
          const binding = await this.#bindWorktree({
            agent: request.agent,
            worktreeRef: authorityResult.receipt.worktreeId,
            taskRef: workstreamId,
          });
          boundAgent = {
            agentId: binding.agentId,
            nativeSessionId: binding.nativeSessionId,
            ...(binding.rootNativeSessionId
              ? { rootNativeSessionId: binding.rootNativeSessionId }
              : {}),
            revision: binding.revision,
          };
          agentEventSequenceStart = binding.eventSequence;
        } catch (error) {
          try {
            await this.#agentPort.unbind({
              agentId: request.agent.agentId,
              worktreeRef: authorityResult.receipt.worktreeId,
              taskRef: workstreamId,
            });
          } catch {
            // The bind may have failed before it changed the session.
          }
          await this.#worktreeAuthority.cancel({
            ownerId,
            requestId: this.#authorityRequestId(
              `${request.requestId}-rollback`,
            ),
            worktreeId: authorityResult.receipt.worktreeId,
          });
          throw new WorkstreamServiceError(
            "agent-mismatch",
            error instanceof Error
              ? error.message
              : "Unable to bind the selected World agent",
          );
        }
      }
      const workstream = WorkstreamSchema.parse({
        schema: "aiw.workstream/1",
        ...(request.sourceWorkstream && sourceHead
          ? {
              origin: {
                workstreamId: request.sourceWorkstream.workstreamId,
                head: sourceHead,
                mode: request.sourceWorkstream.mode,
              },
            }
          : {}),
        workstreamId,
        revision: 1,
        title: request.title,
        task,
        prIntent: request.prIntent ?? "local",
        repository: request.repository,
        agent: boundAgent,
        authority: authorityResult.receipt,
        worktreeState: authorityResult.receipt.state,
        evidenceOperationRefs: [],
        agentEventSequenceStart,
        projection: {
          currentActivity: "Owned worktree is current and ready.",
          changedFiles: [],
          diff: { summary: "", patch: "", truncated: false },
          validation: [],
          evidenceRefs: [],
        },
        status: "working",
        createdAt,
        updatedAt: createdAt,
        events: [
          {
            eventId: `${workstreamId}/event/1`,
            status: "planning",
            summary: "Workstream authority allocation requested.",
            occurredAt: createdAt,
          },
          {
            eventId: `${workstreamId}/event/2`,
            status: "working",
            summary: `Task: ${request.task}`.slice(0, 512),
            occurredAt: createdAt,
          },
        ],
      });
      this.#record = WorkstreamRecordSchema.parse({
        workstream,
        commands: [
          {
            kind: "create",
            requestId: request.requestId,
            correlationId: request.correlationId,
            canonical: canonicalRequest,
          },
        ],
      });
      await this.#persist();
      if (this.#agentPort) this.#startDispatch(workstream);
      return {
        workstream: await this.#project(workstream),
        replayed: false,
      };
    });
  }

  async iterate(input: unknown): Promise<{
    readonly workstream: Workstream;
    readonly replayed: boolean;
  }> {
    const request = this.#parseIteration(input);
    return this.#serialize(async () => {
      await this.#ensureLoaded();
      if (
        !this.#record ||
        this.#record.workstream.workstreamId !== request.workstreamId
      )
        throw new WorkstreamServiceError("not-found", "Workstream not found");
      const canonicalRequest = canonical({ kind: "iterate", request });
      const replay = this.#commandReplay(
        request.requestId,
        request.correlationId,
        canonicalRequest,
      );
      if (replay)
        return {
          workstream: await this.#project(replay.workstream),
          replayed: true,
        };
      const current = this.#record.workstream;
      if (request.expectedRevision !== current.revision)
        throw new WorkstreamServiceError(
          "revision-conflict",
          `Expected revision ${request.expectedRevision}; current is ${current.revision}`,
        );
      if (!referencesEqual(request.repository, current.repository))
        throw new WorkstreamServiceError(
          "repository-mismatch",
          "Workstream repository reference is stale",
        );
      if (!referencesEqual(request.agent, current.agent))
        throw new WorkstreamServiceError(
          "agent-mismatch",
          "Workstream agent/session reference is stale",
        );
      if (
        current.status === "completed" ||
        current.status === "cancelled" ||
        current.status === "cleanup-required" ||
        current.worktreeState === "missing" ||
        current.worktreeState === "removed"
      )
        throw new WorkstreamServiceError(
          "unavailable",
          "Current Workstream cannot accept another iteration",
        );
      await this.#assertCancellationReferences(
        request.repository,
        request.agent,
      );
      if (this.#agentPort?.busy(request.agent.agentId))
        throw new WorkstreamServiceError(
          "unavailable",
          "Wait for the current Workstream agent turn to finish",
        );
      let receipt: WorktreeReceipt;
      try {
        receipt = await this.#worktreeAuthority.restore(
          current.authority as WorktreeReceipt,
        );
      } catch (error) {
        throw new WorkstreamServiceError(
          "unavailable",
          error instanceof Error
            ? `Workstream worktree attestation failed: ${error.message}`
            : "Workstream worktree attestation failed",
        );
      }
      if (receipt.state === "wrong-branch")
        throw new WorkstreamServiceError(
          "unavailable",
          "Workstream worktree is on the wrong branch",
        );
      const now = new Date(this.#now()).toISOString();
      const summary = `Iteration requested · ${request.feedback}`.slice(0, 512);
      await this.#archiveReport(current);
      const workstream = WorkstreamSchema.parse({
        ...current,
        revision: current.revision + 1,
        authority: receipt,
        worktreeState: receipt.state,
        status: "working",
        updatedAt: now,
        events: [
          ...current.events,
          {
            eventId: `${current.workstreamId}/event/${current.events.length + 1}`,
            status: "working",
            summary,
            occurredAt: now,
          },
        ],
      });
      this.#record = WorkstreamRecordSchema.parse({
        workstream,
        commands: [
          ...this.#record.commands,
          {
            kind: "iterate",
            requestId: request.requestId,
            correlationId: request.correlationId,
            canonical: canonicalRequest,
          },
        ].slice(-32),
      });
      await this.#persist();
      return {
        workstream: await this.#project(workstream),
        replayed: false,
      };
    });
  }

  async cancel(input: unknown): Promise<{
    readonly workstream: Workstream;
    readonly replayed: boolean;
  }> {
    const request = this.#parseCancel(input);
    return this.#serialize(async () => {
      await this.#ensureLoaded();
      if (
        !this.#record ||
        this.#record.workstream.workstreamId !== request.workstreamId
      )
        throw new WorkstreamServiceError("not-found", "Workstream not found");
      const canonicalRequest = canonical({ kind: "cancel", request });
      const replay = this.#commandReplay(
        request.requestId,
        request.correlationId,
        canonicalRequest,
      );
      if (replay)
        return {
          workstream: await this.#project(replay.workstream),
          replayed: true,
        };
      const current = this.#record.workstream;
      if (request.expectedRevision !== current.revision)
        throw new WorkstreamServiceError(
          "revision-conflict",
          `Expected revision ${request.expectedRevision}; current is ${current.revision}`,
        );
      if (!referencesEqual(request.repository, current.repository))
        throw new WorkstreamServiceError(
          "repository-mismatch",
          "Workstream repository reference is stale",
        );
      if (!referencesEqual(request.agent, current.agent))
        throw new WorkstreamServiceError(
          "agent-mismatch",
          "Workstream agent/session reference is stale",
        );
      await this.#assertCancellationReferences(
        request.repository,
        request.agent,
      );
      try {
        await this.#previewStop(current.workstreamId);
      } catch (error) {
        throw new WorkstreamServiceError(
          "unavailable",
          error instanceof Error
            ? `Owned preview did not stop: ${error.message}`
            : "Owned preview did not stop",
        );
      }
      await this.#stopDispatch(current.workstreamId);
      if (this.#agentPort)
        try {
          await this.#agentPort.unbind({
            agentId: current.agent.agentId,
            worktreeRef: current.authority.worktreeId,
            taskRef: current.workstreamId,
          });
        } catch (error) {
          throw new WorkstreamServiceError(
            "agent-mismatch",
            error instanceof Error
              ? error.message
              : "Unable to unbind the selected World agent",
          );
        }
      const result = await this.#worktreeAuthority.cancel({
        ownerId: this.#ownerId(current.workstreamId),
        requestId: this.#authorityRequestId(request.requestId),
        worktreeId: current.authority.worktreeId,
      });
      const now = new Date(this.#now()).toISOString();
      const status =
        result.state === "cancelled" ? "cancelled" : "cleanup-required";
      const workstream = WorkstreamSchema.parse({
        ...current,
        revision: current.revision + 1,
        authority: result.receipt,
        worktreeState: result.removed ? "removed" : result.receipt.state,
        status,
        updatedAt: now,
        events: [
          ...current.events,
          {
            eventId: `${current.workstreamId}/event/${current.events.length + 1}`,
            status,
            summary: result.removed
              ? "Owned clean worktree removed."
              : "Dirty worktree retained for operator cleanup.",
            occurredAt: now,
          },
        ],
      });
      this.#record = WorkstreamRecordSchema.parse({
        workstream,
        commands: [
          ...this.#record.commands,
          {
            kind: "cancel",
            requestId: request.requestId,
            correlationId: request.correlationId,
            canonical: canonicalRequest,
          },
        ],
      });
      await this.#persist();
      return {
        workstream: await this.#project(workstream),
        replayed: false,
      };
    });
  }

  async dispose(): Promise<void> {
    for (const run of this.#runs.values()) run.controller.abort();
    await Promise.allSettled([...this.#runs.values()].map((run) => run.turn));
    await this.#mutationTail;
  }

  #parseCreate(input: unknown): WorkstreamCreateRequest {
    const parsed = WorkstreamCreateRequestSchema.safeParse(input);
    if (!parsed.success)
      throw new WorkstreamServiceError(
        "validation",
        parsed.error.issues[0]?.message ?? "Invalid Workstream create request",
      );
    return parsed.data;
  }

  #parseCancel(input: unknown): WorkstreamCancelRequest {
    const parsed = WorkstreamCancelRequestSchema.safeParse(input);
    if (!parsed.success)
      throw new WorkstreamServiceError(
        "validation",
        parsed.error.issues[0]?.message ?? "Invalid Workstream cancel request",
      );
    return parsed.data;
  }

  #parseIteration(input: unknown): WorkstreamIterationRequest {
    const parsed = WorkstreamIterationRequestSchema.safeParse(input);
    if (!parsed.success)
      throw new WorkstreamServiceError(
        "validation",
        parsed.error.issues[0]?.message ??
          "Invalid Workstream iteration request",
      );
    return parsed.data;
  }

  #serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#mutationTail.then(operation, operation);
    this.#mutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  #commandReplay(
    requestId: string,
    correlationId: string,
    canonicalRequest: string,
  ): WorkstreamRecord | null {
    if (!this.#record) return null;
    const byRequest = this.#record.commands.find(
      (command) => command.requestId === requestId,
    );
    const byCorrelation = this.#record.commands.find(
      (command) => command.correlationId === correlationId,
    );
    if (!byRequest && !byCorrelation) return null;
    if (
      !byRequest ||
      !byCorrelation ||
      byRequest !== byCorrelation ||
      byRequest.canonical !== canonicalRequest
    )
      throw new WorkstreamServiceError(
        "correlation-conflict",
        "Request or correlation ID was reused with different input",
      );
    return this.#record;
  }

  async #assertCurrentReferences(
    repository: WorkstreamRepositoryReference,
    agent: WorkstreamAgentReference,
  ): Promise<void> {
    const currentRepository = await this.#currentRepository();
    if (!currentRepository || !referencesEqual(repository, currentRepository))
      throw new WorkstreamServiceError(
        "repository-mismatch",
        "Approved current repository reference does not match",
      );
    const connectedAgent = this.#agentPort
      ? this.#agentPort.current(agent.agentId)
      : await this.#connectedAgent(agent.agentId);
    const connectedReference = connectedAgent
      ? {
          agentId: connectedAgent.agentId,
          nativeSessionId: connectedAgent.nativeSessionId,
          ...(connectedAgent.rootNativeSessionId
            ? { rootNativeSessionId: connectedAgent.rootNativeSessionId }
            : {}),
          revision: connectedAgent.revision,
        }
      : null;
    if (!connectedReference || !referencesEqual(agent, connectedReference))
      throw new WorkstreamServiceError(
        "agent-mismatch",
        "Connected agent/native-session reference does not match",
      );
  }

  async #assertCancellationReferences(
    repository: WorkstreamRepositoryReference,
    agent: WorkstreamAgentReference,
  ): Promise<void> {
    const currentRepository = await this.#currentRepository();
    if (!currentRepository || !referencesEqual(repository, currentRepository))
      throw new WorkstreamServiceError(
        "repository-mismatch",
        "Approved current repository reference does not match",
      );
    if (!this.#agentPort) {
      await this.#assertCurrentReferences(repository, agent);
      return;
    }
    const connected = this.#agentPort.current(agent.agentId);
    const expectedRoot = agent.rootNativeSessionId ?? agent.nativeSessionId;
    const connectedRoot =
      connected?.rootNativeSessionId ?? connected?.nativeSessionId;
    if (
      !connected ||
      connected.agentId !== agent.agentId ||
      connectedRoot !== expectedRoot ||
      connected.revision !== agent.revision ||
      connected.worktreeRef !== this.#record?.workstream.authority.worktreeId ||
      connected.currentTaskRef !== this.#record?.workstream.workstreamId ||
      connected.mode !== "collaborate"
    )
      throw new WorkstreamServiceError(
        "agent-mismatch",
        "Connected agent/root-session Workstream binding does not match",
      );
  }

  async #project(workstream: Workstream): Promise<Workstream> {
    const evidenceOperationRefs = await this.#evidenceReader.read(
      workstream.evidenceOperationRefs,
    );
    const ownedReferences = new Set(workstream.evidenceOperationRefs);
    if (
      evidenceOperationRefs.some((reference) => !ownedReferences.has(reference))
    )
      throw new WorkstreamServiceError(
        "unavailable",
        "Evidence reader returned an unowned operation reference",
      );
    const projection = await this.#readProjection(workstream);
    const correlatedAgentRefs = this.#agentPort?.current(
      workstream.agent.agentId,
    )
      ? this.#agentPort
          .evidence(
            workstream.agent.agentId,
            workstream.agentEventSequenceStart,
          )
          .map(({ ref }) => identifier.parse(ref))
      : [];
    return WorkstreamSchema.parse({
      ...clone(workstream),
      evidenceOperationRefs: [
        ...evidenceOperationRefs,
        ...correlatedAgentRefs,
      ].slice(0, 64),
      projection,
    });
  }

  async #readProjection(
    workstream: Workstream,
  ): Promise<z.infer<typeof WorkstreamProjectionSchema>> {
    const agentEvidence = this.#agentPort?.current(workstream.agent.agentId)
      ? this.#agentPort.evidence(
          workstream.agent.agentId,
          workstream.agentEventSequenceStart,
        )
      : [];
    const fallbackActivity =
      agentEvidence.at(-1)?.summary ?? workstream.events.at(-1)!.summary;
    if (!this.#worktreeParent || workstream.worktreeState === "removed")
      return {
        ...workstream.projection,
        currentActivity: fallbackActivity,
        evidenceRefs: agentEvidence.map(({ ref }) => ref),
      };
    if (
      !["missing", "removed"].includes(workstream.worktreeState) &&
      (await this.#currentRepository())?.repositoryId ===
        workstream.repository.repositoryId
    ) {
      try {
        await realpath(this.#worktreePath(workstream));
      } catch (error) {
        if (!isMissing(error)) throw error;
        await this.#worktreeAuthority.restore(workstream.authority);
      }
    }
    const worktree = this.#worktreePath(workstream);
    try {
      const [status, summary, patch, reportText] = await Promise.all([
        git(worktree, [
          "status",
          "--porcelain=v1",
          "-z",
          "--untracked-files=all",
        ]),
        git(worktree, ["diff", "--no-ext-diff", "--stat", "--", "."]),
        git(worktree, ["diff", "--no-ext-diff", "--unified=2", "--", "."]),
        boundedRead(this.#reportPath(workstream.workstreamId), 64 * 1024).then(
          async (report) =>
            report ??
            boundedRead(
              join(this.#reportsDirectory, `${workstream.workstreamId}.json`),
              64 * 1024,
            ),
        ),
      ]);
      const report = reportText
        ? WorkstreamReportSchema.safeParse(JSON.parse(reportText))
        : null;
      const acceptedReport =
        report?.success && report.data.workstreamId === workstream.workstreamId
          ? report.data
          : null;
      const patchBytes = Buffer.byteLength(patch, "utf8");
      const boundedPatch =
        patchBytes <= 65_536
          ? patch
          : Buffer.from(patch, "utf8").subarray(0, 65_536).toString("utf8");
      const activeFile =
        workstream.status === "working"
          ? agentEvidence.findLast((event) => event.path && event.activityId)
          : null;
      return WorkstreamProjectionSchema.parse({
        activeFile: activeFile
          ? { path: activeFile.path, activityId: activeFile.activityId }
          : null,
        currentActivity:
          reportText && !acceptedReport
            ? "Workstream receipt invalid; validation unavailable. Regenerate the receipt with the provided schema and identifier-only evidenceRefs."
            : (acceptedReport?.activity ?? fallbackActivity),
        changedFiles: changedFiles(status),
        diff: {
          summary: summary.trim().slice(0, 8_192),
          patch: boundedPatch,
          truncated: patchBytes > 65_536,
        },
        validation: acceptedReport?.validation ?? [],
        evidenceRefs: [
          ...agentEvidence.map(({ ref }) => ref),
          ...(acceptedReport?.evidenceRefs.map((ref) => `report:${ref}`) ?? []),
        ].slice(0, 128),
      });
    } catch (error) {
      if (isMissing(error)) return workstream.projection;
      throw new WorkstreamServiceError(
        "unavailable",
        error instanceof Error
          ? `Workstream projection failed: ${error.message}`
          : "Workstream projection failed",
      );
    }
  }

  #worktreePath(workstream: Workstream): string {
    if (!this.#worktreeParent)
      throw new WorkstreamServiceError(
        "unavailable",
        "Workstream projection root is unavailable",
      );
    return this.#worktreeAuthority.pathFor(workstream.authority);
  }

  #systemContext(workstream: Workstream): string {
    const worktree = this.#worktreePath(workstream);
    const report = this.#reportPath(workstream.workstreamId);
    return [
      `You are implementing AgentIntersect World Workstream ${workstream.workstreamId}.`,
      `The exact task is ${JSON.stringify(workstream.task)}.`,
      `The absolute owned worktree is ${JSON.stringify(worktree)}; mutate only that owned worktree.`,
      "Use strict TDD: run one focused failing regression, make the smallest direct implementation, then run the focused and impacted green checks.",
      `The only permitted write outside that worktree is the Workstream evidence receipt at ${JSON.stringify(report)}. Write it atomically using schema aiw.workstream-report/1 with this Workstream identity, current activity, validation entries {command, exitCode, summary}, and bounded evidenceRefs.`,
      `Use this exact JSON shape, replacing activity and adding only checks you actually ran: ${JSON.stringify({ schema: "aiw.workstream-report/1", workstreamId: workstream.workstreamId, activity: "Describe the actual outcome", validation: [], evidenceRefs: [] })}. Serialize with JSON.stringify or json.dumps, not hand-escaped JSON. Validation describes final current-state checks; put expected earlier RED failures in activity only. activity must be at most 512 characters. Each entry in evidenceRefs must match ^[A-Za-z0-9][A-Za-z0-9._:/-]*$ and be at most 128 characters (for example index.html or validation-1); leave evidenceRefs empty rather than inserting prose. No schema discovery or example search is needed. If the sandbox refuses the receipt write, report that honestly in your final response; do not search other directories or request broader access.`,
      "Report real commands and results. Stop before staging, committing, pushing, opening a PR, merging, tagging, releasing, publishing, or deploying.",
      "World View is served by the operator-approved World Preview Manager outside your sandbox. Do not start a preview server yourself, use Sites, create external projects, or deploy. For a static homepage write index.html inside the assigned worktree, then report what changed and the real validation results. If no preview exists, direct the operator to Open current work / World View and its explicit recipe approval. If World View is already showing, its approved preview refreshes after successful validation; its Refresh preview button retries it. Do not ask the operator to approve an already displayed preview.",
    ].join("\n");
  }

  #reportPath(workstreamId: string): string {
    return join(
      this.#recordDirectories.has(workstreamId)
        ? join(this.#recordDirectories.get(workstreamId)!, "reports")
        : this.#reportsDirectory,
      identifier.parse(workstreamId),
      `${identifier.parse(workstreamId)}.json`,
    );
  }

  #startDispatch(workstream: Workstream): void {
    if (!this.#agentPort) return;
    const controller = new AbortController();
    const turn = this.#agentPort.dispatch({
      agentId: workstream.agent.agentId,
      task: workstream.task,
      systemContext: this.#systemContext(workstream),
      signal: controller.signal,
    });
    this.#runs.set(workstream.workstreamId, { controller, turn });
    void turn.then(
      () =>
        this.#recordDispatchOutcome(
          workstream.workstreamId,
          "ready-for-review",
        ),
      (error: unknown) =>
        this.#recordDispatchOutcome(
          workstream.workstreamId,
          "blocked",
          error instanceof Error ? error.message : "Agent dispatch failed",
        ),
    );
  }

  async #archiveReport(work: Workstream): Promise<void> {
    for (const path of [
      this.#reportPath(work.workstreamId),
      join(this.#reportsDirectory, `${work.workstreamId}.json`),
    ]) {
      try {
        await rename(path, `${path}.revision-${work.revision}.previous`);
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
    }
  }

  /** Gateway-owned lifecycle: a bound turn cannot bypass work state via chat wording. */
  async recordAgentTurnStart(agentId: string, text: string): Promise<void> {
    await this.#serialize(async () => {
      await this.#ensureLoaded();
      const current = this.#record?.workstream;
      if (
        !current ||
        current.agent.agentId !== agentId ||
        ["working", "cancelled", "cleanup-required", "completed"].includes(
          current.status,
        )
      )
        return;
      await this.#archiveReport(current);
      const now = new Date(this.#now()).toISOString();
      this.#record = WorkstreamRecordSchema.parse({
        ...this.#record,
        workstream: {
          ...current,
          revision: current.revision + 1,
          status: "working",
          updatedAt: now,
          agentEventSequenceStart:
            this.#agentPort?.current(agentId)?.eventSequence ??
            current.agentEventSequenceStart,
          events: [
            ...current.events,
            {
              eventId: `${current.workstreamId}/event/${current.events.length + 1}`,
              status: "working",
              summary: `Starting Workstream turn · ${text}`.slice(0, 512),
              occurredAt: now,
            },
          ],
        },
      });
      await this.#persist();
    });
  }

  async recordAgentTurnOutcome(agentId: string, error?: string): Promise<void> {
    await this.#ensureLoaded();
    const current = this.#record?.workstream;
    if (current?.agent.agentId !== agentId) return;
    await this.#recordDispatchOutcome(
      current.workstreamId,
      error ? "blocked" : "ready-for-review",
      error,
    );
  }

  async #recordDispatchOutcome(
    workstreamId: string,
    status: "blocked" | "ready-for-review",
    detail?: string,
  ): Promise<void> {
    await this.#serialize(async () => {
      this.#runs.delete(workstreamId);
      const current = this.#record?.workstream;
      if (
        !current ||
        current.workstreamId !== workstreamId ||
        current.status === status ||
        current.status === "cancelled" ||
        current.status === "cleanup-required"
      )
        return;
      const now = new Date(this.#now()).toISOString();
      const projection = await this.#readProjection(current);
      const summary =
        status === "blocked"
          ? `Turn failed: ${detail ?? "unknown failure"}. Previous verified preview retained.`
          : workstreamOutcomeSummary(projection);
      this.#record = WorkstreamRecordSchema.parse({
        ...this.#record,
        workstream: {
          ...current,
          revision: current.revision + 1,
          status,
          updatedAt: now,
          events: [
            ...current.events,
            {
              eventId: `${workstreamId}/event/${current.events.length + 1}`,
              status,
              summary: summary.slice(0, 512),
              occurredAt: now,
            },
          ],
        },
      });
      await this.#persist();
    });
  }

  async #stopDispatch(workstreamId: string): Promise<void> {
    const run = this.#runs.get(workstreamId);
    if (!run) return;
    run.controller.abort();
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        run.turn.catch(() => undefined),
        new Promise<void>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Workstream agent turn did not stop")),
            5_000,
          );
        }),
      ]);
    } catch (error) {
      throw new WorkstreamServiceError(
        "unavailable",
        error instanceof Error ? error.message : "Workstream turn did not stop",
      );
    } finally {
      if (timer) clearTimeout(timer);
      this.#runs.delete(workstreamId);
    }
  }

  #ownerId(workstreamId: string): string {
    return `workstream/${sha256(workstreamId).slice(0, 24)}`;
  }

  #authorityRequestId(requestId: string): string {
    return `workstream/${sha256(requestId).slice(0, 24)}`;
  }

  #ensureLoaded(): Promise<void> {
    this.#loadPromise ??= this.#load();
    return this.#loadPromise;
  }

  async #load(): Promise<void> {
    await mkdir(this.#directory, { recursive: true, mode: 0o700 });
    await mkdir(this.#reportsDirectory, { recursive: true, mode: 0o700 });
    const [currentText, previousText] = await Promise.all([
      optionalRead(this.#currentPath),
      optionalRead(this.#previousPath),
    ]);
    if (currentText === null && previousText === null) return;
    let envelope: WorkstreamStoreEnvelope;
    try {
      if (currentText === null) throw new Error("Current generation missing");
      envelope = parseEnvelope(currentText);
    } catch (currentError) {
      try {
        if (previousText === null)
          throw new Error("Previous generation missing", {
            cause: currentError,
          });
        envelope = parseEnvelope(previousText);
        this.#loadedFromPrevious = true;
      } catch {
        throw new WorkstreamServiceError(
          "unavailable",
          "Both Workstream generations failed validation",
        );
      }
    }
    this.#generation = envelope.generation;
    this.#record = envelope.payload;
    if (
      this.#record &&
      ["planning", "working", "cleanup-required"].includes(
        this.#record.workstream.status,
      )
    )
      await this.#recoverWorktree();
  }

  async #recoverWorktree(): Promise<void> {
    if (!this.#record) return;
    const current = this.#record.workstream;
    // Discovery must survive a different loaded repo/session. Continuation is explicit.
    try {
      await this.#assertCurrentReferences(current.repository, current.agent);
    } catch (error) {
      if (
        error instanceof WorkstreamServiceError &&
        ["repository-mismatch", "agent-mismatch"].includes(error.code)
      )
        return;
      throw error;
    }
    try {
      const receipt = await this.#worktreeAuthority.restore(
        current.authority as WorktreeReceipt,
      );
      const status =
        receipt.state === "current" ? "working" : "cleanup-required";
      if (
        status !== current.status ||
        canonical(receipt) !== canonical(current.authority)
      )
        await this.#recordRecovery(
          receipt,
          receipt.state,
          status,
          status === "working"
            ? "Owned worktree restored after restart."
            : "Changed worktree retained after restart.",
        );
    } catch (error) {
      if (isMissing(error)) {
        await this.#recordRecovery(
          current.authority as WorktreeReceipt,
          "missing",
          "blocked",
          "Owned worktree is missing after restart.",
        );
        return;
      }
      if (error instanceof WorktreeAuthorityError)
        throw new WorkstreamServiceError("unavailable", error.message);
      throw error;
    }
  }

  async #recordRecovery(
    receipt: WorktreeReceipt,
    worktreeState: Workstream["worktreeState"],
    status: Workstream["status"],
    summary: string,
  ): Promise<void> {
    if (!this.#record) return;
    const current = this.#record.workstream;
    const now = new Date(this.#now()).toISOString();
    this.#record = WorkstreamRecordSchema.parse({
      ...this.#record,
      workstream: {
        ...current,
        revision: current.revision + 1,
        authority: receipt,
        worktreeState,
        status,
        updatedAt: now,
        events: [
          ...current.events,
          {
            eventId: `${current.workstreamId}/event/${current.events.length + 1}`,
            status,
            summary,
            occurredAt: now,
          },
        ],
      },
    });
    await this.#persist();
  }

  async #persist(): Promise<void> {
    const nextGeneration = this.#generation + 1;
    const temporary = join(
      this.#directory,
      `.workstream.${process.pid}.${nextGeneration}.tmp`,
    );
    const encoded = `${JSON.stringify(
      envelopeFor(this.#record, nextGeneration),
      null,
      2,
    )}\n`;
    if (Buffer.byteLength(encoded) > 256 * 1024)
      throw new WorkstreamServiceError(
        "unavailable",
        "Workstream store exceeds its byte ceiling",
      );
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(encoded, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    const current = await optionalRead(this.#currentPath);
    if (current !== null && !this.#loadedFromPrevious) {
      parseEnvelope(current);
      await copyFile(this.#currentPath, this.#previousPath);
      await syncFile(this.#previousPath);
    }
    await rename(temporary, this.#currentPath);
    await syncDirectory(this.#directory);
    this.#generation = nextGeneration;
    this.#loadedFromPrevious = false;
    if (
      this.#record &&
      !["removed", "missing"].includes(this.#record.workstream.worktreeState)
    )
      await this.#worktreeAuthority.rememberStore(
        this.#record.workstream.authority,
        this.#directory,
      );
  }
}
