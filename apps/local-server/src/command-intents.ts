import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { InitialReadObservation } from "@agentintersect-world/agentintersect-client/read";
import { sanitizeBoundedValue } from "@agentintersect-world/world-event-protocol";
import type { EventProjection } from "@agentintersect-world/world-event-protocol";
import {
  CommandIntentRecordSchema,
  CommandIntentRequestSchema,
  type CommandIntentRecord,
  type CommandIntentRequest,
  type FixtureArtifactResult,
  type WorkerLifecycle,
} from "@agentintersect-world/world-schema";

const MAX_RESPONSE_BYTES = 262_144;
const CREATE_RESPONSE_TIMEOUT_MS = 10_000;
const TRUNCATION_MARKER = "\n[TRUNCATED]\n";

async function readBoundedResponseText(
  response: Response,
): Promise<{ text: string; exceeded: boolean }> {
  if (!response.body) return { text: "", exceeded: false };
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  let exceeded = false;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    const chunk = Buffer.from(item.value);
    const remaining = MAX_RESPONSE_BYTES - total;
    if (chunk.byteLength > remaining) {
      if (remaining > 0) chunks.push(chunk.subarray(0, remaining));
      exceeded = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(chunk);
    total += chunk.byteLength;
  }
  const bytes = Buffer.concat(chunks);
  if (!exceeded) return { text: bytes.toString("utf8"), exceeded: false };
  const marker = Buffer.from(TRUNCATION_MARKER);
  const prefix = bytes.subarray(0, MAX_RESPONSE_BYTES - marker.byteLength);
  return {
    text: Buffer.concat([prefix, marker]).toString("utf8"),
    exceeded: true,
  };
}

export const PHASE7_REAL_JOB_FIXTURE = {
  id: "phase7-disposable-artifact-v1",
  repository: "disposable-temporary-repository",
  prompt:
    "In the supplied disposable repository only, create phase7-result.json with exactly the expected JSON object, then run the tiny offline Node verification. Do not install dependencies, access the network, or modify any other repository.",
  hardTimeoutMs: 600_000,
  maxDispatchAttempts: 1,
  requestedModelTokenLimit: 80_000,
  requestedCostLimitUsd: 1,
  usageLimitEnforcement: "unsupported-by-pinned-create-contract",
  dependencyInstall: "forbidden",
  networkAccess: "forbidden",
  verification:
    "node -e \"const value=require('./phase7-result.json');if(value.message!=='AgentIntersect World Phase 7 fixture complete'||value.verified!==true)process.exit(1)\"",
  expectedArtifact: {
    path: "phase7-result.json",
    before: null,
    after: {
      message: "AgentIntersect World Phase 7 fixture complete",
      verified: true,
    },
  },
} as const;

export class CommandIntentError extends Error {
  override readonly name = "CommandIntentError";

  constructor(
    readonly code:
      | "validation"
      | "conflict"
      | "not_found"
      | "authority_unavailable"
      | "upstream"
      | "store_corrupt",
    message: string,
  ) {
    super(message);
  }
}

class DispatchError extends Error {
  constructor(
    readonly outcome: "rejected" | "failed" | "ambiguous",
    message: string,
    readonly rawLogRef?: string,
  ) {
    super(message);
  }
}

interface StoreEnvelope {
  schema: "aiw.command-intent-store/0.7";
  records: CommandIntentRecord[];
  checksum: string;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
    .join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function fingerprint(request: CommandIntentRequest): string {
  return sha256(canonical(request));
}

function readEnvelope(filename: string): StoreEnvelope {
  const value = JSON.parse(fs.readFileSync(filename, "utf8")) as unknown;
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("intent store root is invalid");
  const record = value as Record<string, unknown>;
  if (
    record.schema !== "aiw.command-intent-store/0.7" ||
    !Array.isArray(record.records) ||
    typeof record.checksum !== "string"
  ) {
    throw new Error("intent store envelope is invalid");
  }
  const records = record.records.map((item) =>
    CommandIntentRecordSchema.parse(item),
  );
  if (sha256(canonical(records)) !== record.checksum)
    throw new Error("intent store checksum is invalid");
  const keys = new Set(records.map((item) => item.idempotencyKey));
  const ids = new Set(records.map((item) => item.id));
  if (keys.size !== records.length || ids.size !== records.length)
    throw new Error("intent store contains duplicate identities");
  return {
    schema: "aiw.command-intent-store/0.7",
    records,
    checksum: record.checksum,
  };
}

export class CommandIntentStore {
  private readonly filename: string;
  private readonly previousFilename: string;
  private records: CommandIntentRecord[] = [];

  constructor(readonly root: string) {
    fs.mkdirSync(root, { recursive: true, mode: 0o700 });
    this.filename = path.join(root, "phase7-command-intents.json");
    this.previousFilename = `${this.filename}.previous`;
    if (!fs.existsSync(this.filename) && !fs.existsSync(this.previousFilename))
      return;
    try {
      this.records = readEnvelope(this.filename).records;
    } catch (currentError) {
      try {
        this.records = readEnvelope(this.previousFilename).records;
      } catch {
        throw new CommandIntentError(
          "store_corrupt",
          `Command intent storage is corrupt and fail-closed: ${currentError instanceof Error ? currentError.message : "unknown error"}`,
        );
      }
    }
  }

  list(): CommandIntentRecord[] {
    return structuredClone(this.records).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  findByKey(idempotencyKey: string): CommandIntentRecord | undefined {
    const found = this.records.find(
      (item) => item.idempotencyKey === idempotencyKey,
    );
    return found ? structuredClone(found) : undefined;
  }

  require(id: string): CommandIntentRecord {
    const found = this.records.find((item) => item.id === id);
    if (!found)
      throw new CommandIntentError("not_found", "Command intent not found");
    return structuredClone(found);
  }

  createPending(
    idempotencyKey: string,
    request: CommandIntentRequest,
    requestFingerprint: string,
    correlationId: string,
    now: string,
  ): CommandIntentRecord {
    const intent = CommandIntentRecordSchema.parse({
      schema: "aiw.command-intent/0.7",
      id: randomUUID(),
      idempotencyKey,
      requestFingerprint,
      request,
      state: "pending",
      correlationId,
      phaseId: request.phaseId,
      diagnostics: [
        "One dispatch attempt is permitted; the pinned create contract has no proven idempotency support.",
      ],
      createdAt: now,
      updatedAt: now,
    });
    this.records.push(intent);
    this.persist();
    return structuredClone(intent);
  }

  update(id: string, patch: Partial<CommandIntentRecord>): CommandIntentRecord {
    const index = this.records.findIndex((item) => item.id === id);
    if (index < 0)
      throw new CommandIntentError("not_found", "Command intent not found");
    const existing = this.records[index] as CommandIntentRecord;
    const semanticChange = Object.entries(patch).some(
      ([key, value]) =>
        key !== "updatedAt" &&
        canonical(existing[key as keyof CommandIntentRecord]) !==
          canonical(value),
    );
    if (!semanticChange) return structuredClone(existing);
    const next = CommandIntentRecordSchema.parse({
      ...existing,
      ...patch,
      id,
      idempotencyKey: existing.idempotencyKey,
      requestFingerprint: existing.requestFingerprint,
      request: existing.request,
      createdAt: existing.createdAt,
    });
    this.records[index] = next;
    this.persist();
    return structuredClone(next);
  }

  private persist(): void {
    const envelope: StoreEnvelope = {
      schema: "aiw.command-intent-store/0.7",
      records: this.records,
      checksum: sha256(canonical(this.records)),
    };
    if (fs.existsSync(this.filename)) {
      try {
        readEnvelope(this.filename);
        fs.copyFileSync(this.filename, this.previousFilename);
      } catch {
        // Preserve the last verified previous generation.
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

interface ReadClientLike {
  readInitial(): Promise<InitialReadObservation>;
}

interface CommandClientOptions {
  daemonUrl: string;
  readClient: ReadClientLike;
  fetcher?: typeof fetch;
  rawLogDirectory: string;
  responseTimeoutMs?: number;
}

interface CreatedJob {
  id: string;
  sessionId: string;
  runId?: string;
  lifecycle: WorkerLifecycle;
  result?: unknown;
  rawLogRef: string;
}

function identifier(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 128 ||
    /[^\x20-\x7e]/.test(value)
  ) {
    throw new DispatchError("failed", `${label} is malformed`);
  }
  return value;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new DispatchError("failed", `${label} is malformed`);
  return value as Record<string, unknown>;
}

function firstIdentifier(
  record: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

export class AgentIntersectCommandClient {
  private readonly daemonUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly responseTimeoutMs: number;

  constructor(private readonly options: CommandClientOptions) {
    const url = new URL(options.daemonUrl);
    if (
      !(["http:", "https:"] as string[]).includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new CommandIntentError("validation", "daemonUrl is unsupported");
    this.daemonUrl = url.href.replace(/\/$/, "");
    this.fetcher = options.fetcher ?? fetch;
    this.responseTimeoutMs =
      options.responseTimeoutMs ?? CREATE_RESPONSE_TIMEOUT_MS;
    fs.mkdirSync(options.rawLogDirectory, { recursive: true, mode: 0o700 });
  }

  private rawRef(intentId: string, filename: string): string {
    return `${path.basename(this.options.rawLogDirectory)}/${intentId}/${filename}`;
  }

  private writeRaw(intentId: string, filename: string, value: string): string {
    const directory = path.join(this.options.rawLogDirectory, intentId);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const bytes = Buffer.from(value);
    const marker = Buffer.from(TRUNCATION_MARKER);
    const bounded =
      bytes.byteLength <= MAX_RESPONSE_BYTES
        ? bytes
        : Buffer.concat([
            bytes.subarray(0, MAX_RESPONSE_BYTES - marker.byteLength),
            marker,
          ]);
    fs.writeFileSync(path.join(directory, filename), bounded, { mode: 0o600 });
    return this.rawRef(intentId, filename);
  }

  async create(
    request: CommandIntentRequest,
    intentId: string,
  ): Promise<CreatedJob> {
    let observation: InitialReadObservation;
    try {
      observation = await this.options.readClient.readInitial();
    } catch (error) {
      throw new DispatchError(
        "rejected",
        `Fresh AgentIntersect readiness attestation failed: ${error instanceof Error ? error.message : "unavailable"}`,
      );
    }
    const statePhase = observation.state.currentPhase;
    const snapshotPhase = observation.snapshot.currentPhase;
    const statePhaseId = firstIdentifier(statePhase, [
      "id",
      "phaseId",
      "phase_id",
    ]);
    const snapshotPhaseId = firstIdentifier(snapshotPhase, [
      "id",
      "phaseId",
      "phase_id",
    ]);
    if (
      statePhaseId !== request.phaseId ||
      snapshotPhaseId !== request.phaseId ||
      firstIdentifier(statePhase, ["status"]) !== "running" ||
      firstIdentifier(snapshotPhase, ["status"]) !== "running"
    ) {
      throw new DispatchError(
        "rejected",
        "Fresh AgentIntersect phase readiness does not match the requested running phase.",
      );
    }
    const stateRevision =
      firstIdentifier(statePhase, ["revision", "expectedRevision"]) ??
      firstIdentifier(observation.state, ["revision", "expectedRevision"]);
    const snapshotRevision =
      firstIdentifier(snapshotPhase, ["revision", "expectedRevision"]) ??
      firstIdentifier(observation.snapshot, ["revision", "expectedRevision"]);
    if (
      stateRevision !== request.expectedRevision ||
      snapshotRevision !== request.expectedRevision
    ) {
      throw new DispatchError(
        "rejected",
        "Fresh AgentIntersect revision evidence does not match the expected revision.",
      );
    }
    const stateSessionId = firstIdentifier(observation.state.session, [
      "id",
      "sessionId",
      "session_id",
    ]);
    const snapshotSessionId = firstIdentifier(observation.snapshot.session, [
      "id",
      "sessionId",
      "session_id",
    ]);
    if (!stateSessionId || stateSessionId !== snapshotSessionId) {
      throw new DispatchError(
        "rejected",
        "Fresh AgentIntersect session/workspace evidence is unavailable or mismatched.",
      );
    }
    const observedHarnesses = new Set(
      [...observation.state.workerJobs, ...observation.snapshot.agents]
        .map((item) => item.harness)
        .filter((item): item is string => typeof item === "string"),
    );
    if (observedHarnesses.size > 0 && !observedHarnesses.has(request.harness)) {
      throw new DispatchError(
        "rejected",
        "Selected harness contradicts the fresh AgentIntersect roster.",
      );
    }

    const body = {
      type: "phase_run",
      harness: request.harness,
      phase_id: request.phaseId,
      payload: {
        worldIntentId: intentId,
        fixture: PHASE7_REAL_JOB_FIXTURE.id,
        prompt: PHASE7_REAL_JOB_FIXTURE.prompt,
        repository: PHASE7_REAL_JOB_FIXTURE.repository,
        expectedArtifact: PHASE7_REAL_JOB_FIXTURE.expectedArtifact,
        verification: PHASE7_REAL_JOB_FIXTURE.verification,
        hardTimeoutMs: PHASE7_REAL_JOB_FIXTURE.hardTimeoutMs,
        maxDispatchAttempts: PHASE7_REAL_JOB_FIXTURE.maxDispatchAttempts,
        requestedModelTokenLimit:
          PHASE7_REAL_JOB_FIXTURE.requestedModelTokenLimit,
        requestedCostLimitUsd: PHASE7_REAL_JOB_FIXTURE.requestedCostLimitUsd,
        usageLimitEnforcement: PHASE7_REAL_JOB_FIXTURE.usageLimitEnforcement,
        dependencyInstall: PHASE7_REAL_JOB_FIXTURE.dependencyInstall,
        networkAccess: PHASE7_REAL_JOB_FIXTURE.networkAccess,
      },
    };
    let response: Response;
    try {
      response = await this.fetcher(`${this.daemonUrl}/v1/worker/jobs`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.responseTimeoutMs),
      });
    } catch (error) {
      const rawLogRef = this.writeRaw(
        intentId,
        "create-transport-error.log",
        error instanceof Error
          ? `${error.name}: ${error.message}\n`
          : "transport error\n",
      );
      throw new DispatchError(
        "ambiguous",
        "AgentIntersect create response was lost after dispatch; the pinned contract is not idempotent, so World will not resend.",
        rawLogRef,
      );
    }
    const { text, exceeded } = await readBoundedResponseText(response);
    const rawLogRef = this.writeRaw(intentId, "create-response.json", text);
    if (exceeded)
      throw new DispatchError(
        "failed",
        "AgentIntersect create response exceeded the pinned bounded contract.",
        rawLogRef,
      );
    if (
      response.headers
        .get("content-type")
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase() !== "application/json"
    ) {
      throw new DispatchError(
        "failed",
        "AgentIntersect create response content type is unsupported.",
        rawLogRef,
      );
    }
    if (!response.ok)
      throw new DispatchError(
        "rejected",
        `AgentIntersect definitely rejected the create request with HTTP ${response.status}.`,
        rawLogRef,
      );
    let payload: unknown;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new DispatchError(
        "failed",
        "AgentIntersect create response was malformed JSON.",
        rawLogRef,
      );
    }
    const root = object(payload, "create response");
    const job = object(root.job, "create response job");
    const id = identifier(job.id, "job id");
    if (job.type !== "phase_run" || job.harness !== request.harness)
      throw new DispatchError(
        "failed",
        "create response job contract is unsupported",
        rawLogRef,
      );
    const phaseId = firstIdentifier(job, ["phaseId", "phase_id"]);
    if (phaseId !== request.phaseId)
      throw new DispatchError(
        "failed",
        "create response phase mapping is unsupported",
        rawLogRef,
      );
    const status = identifier(job.status, "job status");
    if (!["queued", "running", "complete", "failed"].includes(status))
      throw new DispatchError(
        "failed",
        "create response job status is unsupported",
        rawLogRef,
      );
    if (
      !Number.isSafeInteger(job.attempts) ||
      Number(job.attempts) < 0 ||
      Number(job.attempts) > 1
    ) {
      throw new DispatchError(
        "failed",
        "create response attempts are unsupported",
        rawLogRef,
      );
    }
    const lifecycle: WorkerLifecycle =
      status === "running" && firstIdentifier(job, ["claimedBy"])
        ? "claimed"
        : (status as WorkerLifecycle);
    const runId = firstIdentifier(job, ["runId", "run_id"]);
    return {
      id,
      sessionId: stateSessionId,
      ...(runId ? { runId } : {}),
      lifecycle,
      ...(job.result === undefined
        ? {}
        : { result: sanitizeBoundedValue(job.result) }),
      rawLogRef,
    };
  }

  captureFinalJob(intentId: string, value: unknown): string {
    return this.writeRaw(
      intentId,
      "final-job.json",
      `${JSON.stringify(value)}\n`,
    );
  }
}

interface CommandIntentServiceOptions {
  store: CommandIntentStore;
  client: AgentIntersectCommandClient;
  expectedPhaseId: string;
  expectedRevision: string;
  now?: () => number;
}

export interface CommandSubmission {
  replay: boolean;
  intent: CommandIntentRecord;
}

export class CommandIntentService {
  private readonly now: () => number;
  private readonly inFlight = new Map<string, Promise<CommandSubmission>>();

  constructor(private readonly options: CommandIntentServiceOptions) {
    this.now = options.now ?? Date.now;
  }

  list(): CommandIntentRecord[] {
    return this.options.store.list();
  }

  require(id: string): CommandIntentRecord {
    return this.options.store.require(id);
  }

  async submit(
    idempotencyKey: string,
    input: unknown,
    correlationId: string,
  ): Promise<CommandSubmission> {
    const parsedKey = /^[\x20-\x7e]{1,128}$/.test(idempotencyKey)
      ? idempotencyKey
      : null;
    if (!parsedKey)
      throw new CommandIntentError(
        "validation",
        "idempotency-key must contain 1..128 visible ASCII characters",
      );
    const parsed = CommandIntentRequestSchema.safeParse(input);
    if (!parsed.success)
      throw new CommandIntentError("validation", "Command intent is invalid");
    const requestFingerprint = fingerprint(parsed.data);
    const existing = this.options.store.findByKey(parsedKey);
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint)
        throw new CommandIntentError(
          "conflict",
          "idempotency-key is already bound to a different request fingerprint",
        );
      return { replay: true, intent: existing };
    }
    const current = this.inFlight.get(parsedKey);
    if (current) return await current;
    const active = this.options.store
      .list()
      .find(
        (item) =>
          item.state === "pending" ||
          item.state === "ambiguous" ||
          (item.state === "confirmed" &&
            item.lifecycle !== "complete" &&
            item.lifecycle !== "failed"),
      );
    if (active)
      throw new CommandIntentError(
        "conflict",
        `Command intent ${active.id} is still active; Phase 7 supports one fixture job at a time`,
      );
    const task = this.dispatch(
      parsedKey,
      parsed.data,
      requestFingerprint,
      correlationId,
    );
    this.inFlight.set(parsedKey, task);
    try {
      return await task;
    } finally {
      if (this.inFlight.get(parsedKey) === task)
        this.inFlight.delete(parsedKey);
    }
  }

  private async dispatch(
    idempotencyKey: string,
    request: CommandIntentRequest,
    requestFingerprint: string,
    correlationId: string,
  ): Promise<CommandSubmission> {
    const now = new Date(this.now()).toISOString();
    const pending = this.options.store.createPending(
      idempotencyKey,
      request,
      requestFingerprint,
      correlationId,
      now,
    );
    if (
      request.phaseId !== this.options.expectedPhaseId ||
      request.expectedRevision !== this.options.expectedRevision
    ) {
      return {
        replay: false,
        intent: this.options.store.update(pending.id, {
          state: "rejected",
          diagnostics: [
            "Requested phase or revision does not match configured command authority.",
          ],
          updatedAt: new Date(this.now()).toISOString(),
        }),
      };
    }
    try {
      const job = await this.options.client.create(request, pending.id);
      const artifact: FixtureArtifactResult = {
        ...PHASE7_REAL_JOB_FIXTURE.expectedArtifact,
        verification: job.lifecycle === "complete" ? "passed" : "pending",
      };
      return {
        replay: false,
        intent: this.options.store.update(pending.id, {
          state: "confirmed",
          sessionId: job.sessionId,
          jobId: job.id,
          ...(job.runId ? { runId: job.runId } : {}),
          lifecycle: job.lifecycle,
          ...(job.result === undefined ? {} : { result: job.result }),
          artifact,
          rawLogRef: job.rawLogRef,
          diagnostics: [
            "AgentIntersect confirmed exactly one create response.",
            "The pinned create contract cannot enforce the requested 80k model-token or $1.00 ceiling; no enforcement is claimed.",
          ],
          updatedAt: new Date(this.now()).toISOString(),
        }),
      };
    } catch (error) {
      const dispatchError =
        error instanceof DispatchError
          ? error
          : new DispatchError("failed", "Unexpected command dispatch failure.");
      const sanitized = sanitizeBoundedValue({
        message: dispatchError.message,
      }).message;
      return {
        replay: false,
        intent: this.options.store.update(pending.id, {
          state: dispatchError.outcome,
          diagnostics: [String(sanitized).slice(0, 512)],
          ...(dispatchError.rawLogRef
            ? { rawLogRef: dispatchError.rawLogRef }
            : {}),
          updatedAt: new Date(this.now()).toISOString(),
        }),
      };
    }
  }

  reconcile(
    projection: Pick<EventProjection, "timeline" | "roster">,
  ): CommandIntentRecord[] {
    const timeline = projection.timeline ?? [];
    const roster = projection.roster ?? [];
    for (const intent of this.options.store.list()) {
      const event = [...timeline]
        .reverse()
        .find(
          (item) =>
            item.mapping?.jobId === intent.jobId ||
            item.payload?.worldIntentId === intent.id,
        );
      const jobId = intent.jobId ?? event?.mapping?.jobId;
      const worker = roster.find((item) => item.jobId === jobId);
      if (!jobId || (!event && !worker)) continue;
      const eventType = event?.type ?? "";
      const inferredStatus = (
        ["queued", "claimed", "running", "complete", "failed"] as const
      ).find((item) => eventType.toLowerCase().includes(item));
      const status = String(
        worker?.status ?? event?.payload?.status ?? inferredStatus ?? "",
      );
      const lifecycle = (
        ["queued", "claimed", "running", "complete", "failed"] as const
      ).find((item) => item === status);
      const result = event?.payload?.result;
      const final = lifecycle === "complete" || lifecycle === "failed";
      this.options.store.update(intent.id, {
        state: intent.state === "ambiguous" ? "confirmed" : intent.state,
        jobId,
        ...((worker?.runId ?? event?.mapping?.runId)
          ? { runId: worker?.runId ?? event?.mapping?.runId }
          : {}),
        ...(lifecycle ? { lifecycle } : {}),
        ...(result === undefined
          ? {}
          : { result: sanitizeBoundedValue(result) }),
        ...(final
          ? {
              rawLogRef: intent.rawLogRef?.endsWith("/final-job.json")
                ? intent.rawLogRef
                : this.options.client.captureFinalJob(intent.id, {
                    jobId,
                    lifecycle,
                    evidence: event?.payload,
                    result,
                  }),
              artifact: {
                ...PHASE7_REAL_JOB_FIXTURE.expectedArtifact,
                verification: lifecycle === "complete" ? "passed" : "failed",
              },
            }
          : {}),
        updatedAt: new Date(this.now()).toISOString(),
      });
    }
    return this.options.store.list();
  }
}
