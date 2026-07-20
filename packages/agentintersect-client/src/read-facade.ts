import { attestHealth, type AgentIntersectHealth } from "./index.js";

const MAX_BODY_BYTES = 262_144;
const MAX_EVENTS = 512;
const MAX_COLLECTION = 512;

export class ContractReadError extends Error {
  override readonly name = "ContractReadError";

  constructor(
    message: string,
    readonly code:
      | "offline"
      | "malformed"
      | "unsupported"
      | "oversized" = "malformed",
  ) {
    super(message);
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ContractReadError(`${label} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function bounded(value: unknown, label: string): void {
  let encoded: string;
  try {
    encoded = JSON.stringify(value);
  } catch {
    throw new ContractReadError(`${label} is not JSON-compatible`);
  }
  if (Buffer.byteLength(encoded) > MAX_BODY_BYTES) {
    throw new ContractReadError(`${label} exceeds ${MAX_BODY_BYTES} bytes`, "oversized");
  }
}

function optionalRecords(value: unknown, label: string): Record<string, unknown>[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_COLLECTION) {
    throw new ContractReadError(`${label} must be a bounded array`);
  }
  return value.map((item, index) => record(item, `${label}[${index}]`));
}

function identifier(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 128 ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new ContractReadError(`${label} must be a non-empty bounded string`);
  }
  return value;
}

function optionalIdentifier(value: unknown, label: string): void {
  if (value !== undefined && value !== null) identifier(value, label);
}

function validatePhase(value: unknown, label: string): Record<string, unknown> {
  const phase = record(value, label);
  identifier(phase.id ?? phase.phaseId ?? phase.phase_id, `${label}.id`);
  optionalIdentifier(phase.status, `${label}.status`);
  optionalIdentifier(phase.title ?? phase.name, `${label}.title`);
  return phase;
}

function validateSession(value: unknown, label: string): Record<string, unknown> {
  const session = record(value, label);
  identifier(session.id ?? session.sessionId ?? session.session_id, `${label}.id`);
  return session;
}

function validateWorker(value: unknown, label: string): Record<string, unknown> {
  const worker = record(value, label);
  identifier(
    worker.claimedBy ??
      worker.workerId ??
      worker.worker_id ??
      worker.agentId ??
      worker.agent_id ??
      worker.id,
    `${label}.id`,
  );
  for (const key of ["status", "harness", "runId", "run_id", "jobId", "job_id"])
    optionalIdentifier(worker[key], `${label}.${key}`);
  return worker;
}

function validateEvent(value: unknown, label: string): Record<string, unknown> {
  const event = record(value, label);
  identifier(event.type, `${label}.type`);
  for (const key of [
    "id",
    "eventId",
    "phaseId",
    "phase_id",
    "sessionId",
    "session_id",
    "jobId",
    "job_id",
    "runId",
    "run_id",
  ])
    optionalIdentifier(event[key], `${label}.${key}`);
  for (const key of ["timestamp", "occurredAt", "createdAt", "updatedAt"]) {
    const candidate = event[key];
    if (
      candidate !== undefined &&
      (typeof candidate !== "string" || !Number.isFinite(Date.parse(candidate)))
    )
      throw new ContractReadError(`${label}.${key} must be an ISO timestamp`);
  }
  if (event.worker !== undefined) validateWorker(event.worker, `${label}.worker`);
  return event;
}

export interface ParsedDaemonState extends Record<string, unknown> {
  currentPhase: Record<string, unknown> | undefined;
  session: Record<string, unknown> | undefined;
  workerJobs: Record<string, unknown>[];
  phases: Record<string, unknown>[];
}

export function parseDaemonState(value: unknown): ParsedDaemonState {
  bounded(value, "daemon state");
  const input = record(value, "daemon state");
  return {
    ...input,
    currentPhase:
      input.currentPhase === undefined || input.currentPhase === null
        ? undefined
        : validatePhase(input.currentPhase, "currentPhase"),
    session:
      input.session === undefined || input.session === null
        ? undefined
        : validateSession(input.session, "session"),
    workerJobs: optionalRecords(input.workerJobs, "workerJobs").map((item, index) =>
      validateWorker(item, `workerJobs[${index}]`),
    ),
    phases: optionalRecords(input.phases, "phases").map((item, index) =>
      validatePhase(item, `phases[${index}]`),
    ),
  };
}

export interface ParsedDashboardSnapshot extends Record<string, unknown> {
  currentPhase: Record<string, unknown> | undefined;
  session: Record<string, unknown> | undefined;
  phaseTimeline: Record<string, unknown>[];
  workerJobs: Record<string, unknown>[];
  agents: Record<string, unknown>[];
}

export function parseDashboardSnapshot(value: unknown): ParsedDashboardSnapshot {
  bounded(value, "dashboard snapshot");
  const input = record(value, "dashboard snapshot");
  return {
    ...input,
    currentPhase:
      input.currentPhase === undefined || input.currentPhase === null
        ? undefined
        : validatePhase(input.currentPhase, "currentPhase"),
    session:
      input.session === undefined || input.session === null
        ? undefined
        : validateSession(input.session, "session"),
    phaseTimeline: optionalRecords(input.phaseTimeline, "phaseTimeline").map(
      (item, index) => validatePhase(item, `phaseTimeline[${index}]`),
    ),
    workerJobs: optionalRecords(input.workerJobs, "workerJobs").map((item, index) =>
      validateWorker(item, `workerJobs[${index}]`),
    ),
    agents: optionalRecords(input.agents, "agents").map((item, index) =>
      validateWorker(item, `agents[${index}]`),
    ),
  };
}

export interface ParsedDashboardFeed {
  ok: true;
  events: Record<string, unknown>[];
}

export function parseDashboardFeed(value: unknown): ParsedDashboardFeed {
  bounded(value, "dashboard feed");
  const input = record(value, "dashboard feed");
  if (input.ok !== true) {
    throw new ContractReadError("dashboard feed did not report ok", "unsupported");
  }
  if (!Array.isArray(input.events) || input.events.length > MAX_EVENTS) {
    throw new ContractReadError(`dashboard feed events must contain at most ${MAX_EVENTS} objects`);
  }
  return {
    ok: true,
    events: input.events.map((item, index) => validateEvent(item, `events[${index}]`)),
  };
}

export interface AgentIntersectReadConfig {
  daemonUrl: string;
  dashboardUrl: string;
  expectedWorkspace: string;
  expectedPid?: number;
  protectedPids?: readonly number[];
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

export interface InitialReadObservation {
  health: AgentIntersectHealth;
  state: ParsedDaemonState;
  snapshot: ParsedDashboardSnapshot;
  feed: ParsedDashboardFeed;
  observedAt: string;
}

export interface AgentIntersectSseFrame {
  sequence?: number;
  reset?: boolean;
  overflow?: boolean;
  events: Record<string, unknown>[];
}

function cleanBaseUrl(value: string, label: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ContractReadError(`${label} is not a valid URL`, "unsupported");
  }
  if (!(["http:", "https:"] as string[]).includes(url.protocol) || url.username || url.password) {
    throw new ContractReadError(`${label} must be an HTTP URL without credentials`, "unsupported");
  }
  return url.href.replace(/\/$/, "");
}

async function jsonRequest(base: string, route: string, timeoutMs: number, fetcher: typeof fetch) {
  let response: Response;
  try {
    response = await fetcher(`${base}${route}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ContractReadError(`${route} is offline`, "offline");
  }
  const contentType = response.headers.get("content-type");
  if (!response.ok || contentType?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    throw new ContractReadError(`${route} returned an unsupported response`, "unsupported");
  }
  if (!response.body)
    throw new ContractReadError(`${route} returned an unsupported empty response`, "unsupported");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    bytes += next.value.byteLength;
    if (bytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new ContractReadError(`${route} response is oversized`, "oversized");
    }
    text += decoder.decode(next.value, { stream: true });
  }
  text += decoder.decode();
  try {
    return { response, payload: JSON.parse(text) as unknown, contentType };
  } catch {
    throw new ContractReadError(`${route} returned malformed JSON`);
  }
}

export class AgentIntersectReadClient {
  readonly daemonUrl: string;
  readonly dashboardUrl: string;
  private readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;

  constructor(readonly config: AgentIntersectReadConfig) {
    this.daemonUrl = cleanBaseUrl(config.daemonUrl, "daemonUrl");
    this.dashboardUrl = cleanBaseUrl(config.dashboardUrl, "dashboardUrl");
    this.timeoutMs = config.timeoutMs ?? 3_000;
    this.fetcher = config.fetcher ?? fetch;
  }

  async readInitial(): Promise<InitialReadObservation> {
    const healthResponse = await jsonRequest(this.daemonUrl, "/health", this.timeoutMs, this.fetcher);
    const health = await attestHealth({
      workspace: this.config.expectedWorkspace,
      status: healthResponse.response.status,
      contentType: healthResponse.contentType,
      payload: healthResponse.payload,
      ...(this.config.expectedPid === undefined ? {} : { expectedPid: this.config.expectedPid }),
      ...(this.config.protectedPids === undefined ? {} : { protectedPids: this.config.protectedPids }),
    });
    const state = await jsonRequest(this.daemonUrl, "/v1/state", this.timeoutMs, this.fetcher);
    const snapshot = await jsonRequest(this.dashboardUrl, "/api/snapshot", this.timeoutMs, this.fetcher);
    const feed = await jsonRequest(this.dashboardUrl, "/api/events", this.timeoutMs, this.fetcher);
    return {
      health,
      state: parseDaemonState(state.payload),
      snapshot: parseDashboardSnapshot(snapshot.payload),
      feed: parseDashboardFeed(feed.payload),
      observedAt: new Date().toISOString(),
    };
  }

  async streamEvents(
    onFrame: (frame: AgentIntersectSseFrame) => Promise<void> | void,
    signal: AbortSignal,
  ): Promise<void> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.dashboardUrl}/api/events/stream`, {
        headers: { accept: "text/event-stream" },
        signal,
      });
    } catch (error) {
      if (signal.aborted) return;
      throw new ContractReadError("event stream is offline", "offline");
    }
    if (!response.ok || !response.headers.get("content-type")?.toLowerCase().startsWith("text/event-stream") || !response.body) {
      throw new ContractReadError("event stream contract is unsupported", "unsupported");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    while (!signal.aborted) {
      const next = await reader.read();
      if (next.done) break;
      if (next.value.byteLength > 65_536) {
        await reader.cancel();
        throw new ContractReadError("event stream chunk exceeded 65536 bytes", "oversized");
      }
      buffered += decoder.decode(next.value, { stream: true });
      if (Buffer.byteLength(buffered) > 65_536) {
        await reader.cancel();
        throw new ContractReadError("event stream frame exceeded 65536 bytes", "oversized");
      }
      const frames = buffered.split(/\r?\n\r?\n/);
      buffered = frames.pop() ?? "";
      for (const rawFrame of frames) {
        const lines = rawFrame.split(/\r?\n/);
        const eventName = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
        if (eventName !== "events") continue;
        const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        let decoded: unknown;
        try { decoded = JSON.parse(data); } catch { throw new ContractReadError("event stream data is malformed"); }
        const object = decoded !== null && typeof decoded === "object" && !Array.isArray(decoded)
          ? decoded as Record<string, unknown>
          : null;
        if (
          object &&
          (!Object.hasOwn(object, "events") || !Array.isArray(object.events))
        ) {
          throw new ContractReadError("event stream wrapper events must be an array", "unsupported");
        }
        const events = Array.isArray(decoded) ? decoded : object?.events;
        if (!Array.isArray(events) || events.length > MAX_EVENTS) {
          throw new ContractReadError("event stream data contract is unsupported", "unsupported");
        }
        if (object?.sequence !== undefined && (!Number.isSafeInteger(object.sequence) || Number(object.sequence) < 0))
          throw new ContractReadError("event stream sequence is unsupported", "unsupported");
        if (object?.reset !== undefined && typeof object.reset !== "boolean")
          throw new ContractReadError("event stream reset is unsupported", "unsupported");
        if (object?.overflow !== undefined && typeof object.overflow !== "boolean")
          throw new ContractReadError("event stream overflow is unsupported", "unsupported");
        const validatedEvents = events.map((item, index) =>
          validateEvent(item, `event stream events[${index}]`),
        );
        await onFrame({
          ...(typeof object?.sequence === "number" ? { sequence: object.sequence } : {}),
          ...(object?.reset === true ? { reset: true } : {}),
          ...(object?.overflow === true ? { overflow: true } : {}),
          events: validatedEvents,
        });
      }
    }
  }
}
