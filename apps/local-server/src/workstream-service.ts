import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, open, readFile, rename } from "node:fs/promises";
import { join, resolve } from "node:path";

import { z } from "zod";

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
  revision: identifier,
});
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
  schema: z.literal("aiw.workstream/1"),
  workstreamId: identifier,
  revision: z.number().int().nonnegative(),
  title: z.string().trim().min(1).max(160),
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
  status: WorkstreamStatusSchema,
  createdAt: timestamp,
  updatedAt: timestamp,
  events: z.array(WorkstreamEventSchema).min(1).max(128),
});
const CommandRecordSchema = z.strictObject({
  kind: z.enum(["create", "cancel"]),
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
  requestId: identifier,
  correlationId: identifier,
  title: z.string().trim().min(1).max(160),
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

export type WorkstreamRepositoryReference = z.infer<
  typeof WorkstreamRepositoryReferenceSchema
>;
export type WorkstreamAgentReference = z.infer<
  typeof WorkstreamAgentReferenceSchema
>;
export type WorkstreamCreateRequest = z.infer<
  typeof WorkstreamCreateRequestSchema
>;
export type WorkstreamCancelRequest = z.infer<
  typeof WorkstreamCancelRequestSchema
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
  readonly currentRepository: () =>
    | Promise<WorkstreamRepositoryReference | null>
    | WorkstreamRepositoryReference
    | null;
  readonly connectedAgent: (
    agentId: string,
  ) =>
    Promise<WorkstreamAgentReference | null> | WorkstreamAgentReference | null;
  readonly evidenceReader: WorkstreamEvidenceReader;
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
  const envelope = WorkstreamStoreEnvelopeSchema.parse(JSON.parse(input));
  if (envelope.checksum !== sha256(canonical(envelope.payload)))
    throw new Error("Workstream generation checksum mismatch");
  return envelope;
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

export class WorkstreamService {
  readonly #directory: string;
  readonly #currentPath: string;
  readonly #previousPath: string;
  readonly #worktreeAuthority: WorktreeAuthority;
  readonly #currentRepository: WorkstreamServiceOptions["currentRepository"];
  readonly #connectedAgent: WorkstreamServiceOptions["connectedAgent"];
  readonly #evidenceReader: WorkstreamEvidenceReader;
  readonly #id: () => string;
  readonly #now: () => number;
  #generation = 0;
  #loadedFromPrevious = false;
  #record: WorkstreamRecord | null = null;
  #loadPromise: Promise<void> | null = null;
  #mutationTail: Promise<void> = Promise.resolve();

  constructor(options: WorkstreamServiceOptions) {
    this.#directory = resolve(options.directory);
    this.#currentPath = join(this.#directory, "workstream.current.json");
    this.#previousPath = join(this.#directory, "workstream.previous.json");
    this.#worktreeAuthority = options.worktreeAuthority;
    this.#currentRepository = options.currentRepository;
    this.#connectedAgent = options.connectedAgent;
    this.#evidenceReader = options.evidenceReader;
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
    if (!this.#record || this.#record.workstream.workstreamId !== workstreamId)
      throw new WorkstreamServiceError("not-found", "Workstream not found");
    return this.#project(this.#record.workstream);
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
      if (
        this.#record &&
        ["planning", "working", "blocked", "cleanup-required"].includes(
          this.#record.workstream.status,
        )
      )
        throw new WorkstreamServiceError(
          "active-workstream",
          "Only one active Workstream is supported",
        );
      await this.#assertCurrentReferences(request.repository, request.agent);
      const workstreamId = identifier.parse(this.#id());
      const createdAt = new Date(this.#now()).toISOString();
      const ownerId = this.#ownerId(workstreamId);
      const authorityResult = await this.#worktreeAuthority.createGenerated({
        ownerId,
        requestId: this.#authorityRequestId(request.requestId),
        worktreeId: `worktree-${sha256(workstreamId).slice(0, 24)}`,
      });
      const workstream = WorkstreamSchema.parse({
        schema: "aiw.workstream/1",
        workstreamId,
        revision: 1,
        title: request.title,
        repository: request.repository,
        agent: request.agent,
        authority: authorityResult.receipt,
        worktreeState: authorityResult.receipt.state,
        evidenceOperationRefs: [],
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
            summary: "Owned worktree is current and ready.",
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
      await this.#assertCurrentReferences(request.repository, request.agent);
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
    const connectedAgent = await this.#connectedAgent(agent.agentId);
    if (!connectedAgent || !referencesEqual(agent, connectedAgent))
      throw new WorkstreamServiceError(
        "agent-mismatch",
        "Connected agent/native-session reference does not match",
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
    return WorkstreamSchema.parse({
      ...clone(workstream),
      evidenceOperationRefs,
    });
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
    await this.#assertCurrentReferences(current.repository, current.agent);
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
  }
}
