import { createHash } from "node:crypto";

export const WORLD_EVENT_PROTOCOL = {
  schema: "aiw.event/0.6",
  version: 1,
  phase: "normalized-read-replay",
} as const;

export type EventSourceKind =
  "daemon-state" | "dashboard-snapshot" | "dashboard-feed" | "dashboard-sse";

export interface EventMapping {
  phaseId: string | undefined;
  sessionId: string | undefined;
  jobId: string | undefined;
  runId: string | undefined;
}

export interface NormalizedEventEnvelope {
  schema: typeof WORLD_EVENT_PROTOCOL.schema;
  version: typeof WORLD_EVENT_PROTOCOL.version;
  id: string;
  animationId: string;
  type: string;
  source: EventSourceKind;
  cursor: { kind: "source" | "canonical-fallback"; value: string };
  fallbackId: boolean;
  observedAt: string;
  occurredAt: string;
  correlationId: string | undefined;
  mapping: EventMapping;
  payload: Readonly<Record<string, unknown>>;
  compatibility: { contract: "agentintersect/14c62027"; supported: true };
}

export type WorldEventContract = NormalizedEventEnvelope;

const MAX_DEPTH = 6;
const MAX_KEYS = 64;
const MAX_ARRAY = 128;
const MAX_STRING = 512;
const MAX_IDENTIFIER = 128;
const MAX_IDENTITY_INPUT = 4_096;
const SECRET_KEY =
  /(?:token|secret|password|authorization|cookie|api[_-]?key|credential)/i;
const ABSOLUTE_PATH = /^(?:file:\/\/|\/|[a-z]:[\\/]|\\)/i;

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
    .join(",")}}`;
}

function digest(...values: string[]): string {
  const hash = createHash("sha256");
  for (const value of values) hash.update(value).update("\0");
  return hash.digest("hex");
}

function cleanString(value: string): string {
  const normalized = [...value]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? " " : character;
    })
    .join("")
    .normalize("NFC");
  if (ABSOLUTE_PATH.test(normalized.trim())) return "[REDACTED_PATH]";
  const redacted = normalized
    .replace(/file:\/\/[^\r\n"'<>]+/gi, "[REDACTED_PATH]")
    .replace(/\\\\[?.]\\[^\r\n"'<>]+/g, "[REDACTED_PATH]")
    .replace(/\\\\[^\r\n"'<>]+/g, "[REDACTED_PATH]")
    .replace(/[a-z]:[\\/][^\r\n"'<>]+/gi, "[REDACTED_PATH]")
    .replace(/(^|[\s("'=])\\(?![?.]\\)[^\r\n"'<>]+/g, "$1[REDACTED_PATH]")
    .replace(/(^|[\s("'=])\/[^\s"'<>]+/g, "$1[REDACTED_PATH]")
    .replace(
      /(?:authorization\s*[:=]\s*)?(?:bearer|basic)\s+[^\s,;]+/gi,
      "[REDACTED]",
    )
    .replace(
      /\b(?:cookie|credential|token|secret|password|api[_-]?key|access[_-]?key|client[_-]?secret)\s*[:=]\s*[^\s,;]+/gi,
      "[REDACTED]",
    );
  return redacted.length > MAX_STRING
    ? `${redacted.slice(0, MAX_STRING - 14)}…[TRUNCATED]`
    : redacted;
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEPTH) return "[TRUNCATED_DEPTH]";
  if (typeof value === "string") return cleanString(value);
  if (typeof value === "number")
    return Number.isFinite(value) ? value : "[INVALID_NUMBER]";
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY)
      .map((item) => sanitize(item, depth + 1));
    if (value.length > MAX_ARRAY)
      items.push(`[TRUNCATED_${value.length - MAX_ARRAY}_ITEMS]`);
    return items;
  }
  if (typeof value !== "object") return `[UNSUPPORTED_${typeof value}]`;
  const output: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, MAX_KEYS);
  for (const [key, child] of entries) {
    const safeKey = cleanString(key).slice(0, MAX_IDENTIFIER);
    output[safeKey] = SECRET_KEY.test(key)
      ? "[REDACTED]"
      : sanitize(child, depth + 1);
  }
  if (Object.keys(value as object).length > MAX_KEYS)
    output.__truncatedKeys = true;
  return output;
}

function asIdentifier(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const result = cleanString(String(value)).slice(0, MAX_IDENTIFIER);
  return result.length > 0 && !result.startsWith("[REDACTED")
    ? result
    : undefined;
}

function identityCursor(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const raw = [...String(value)]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? " " : character;
    })
    .join("")
    .normalize("NFC");
  if (raw.length === 0) return undefined;
  if (raw.length > MAX_IDENTITY_INPUT)
    throw new TypeError(
      `source identifier exceeds ${MAX_IDENTITY_INPUT} characters`,
    );
  const exposed = cleanString(raw);
  if (
    raw.length > MAX_IDENTIFIER ||
    exposed !== raw ||
    exposed.startsWith("[REDACTED")
  ) {
    return `sha256:${digest(raw)}`;
  }
  return raw;
}

function first(
  record: Record<string, unknown>,
  names: string[],
): string | undefined {
  for (const name of names) {
    const value = asIdentifier(record[name]);
    if (value) return value;
  }
  return undefined;
}

function mappingFrom(record: Record<string, unknown>): EventMapping {
  const currentPhase =
    record.currentPhase && typeof record.currentPhase === "object"
      ? (record.currentPhase as Record<string, unknown>)
      : undefined;
  const session =
    record.session && typeof record.session === "object"
      ? (record.session as Record<string, unknown>)
      : undefined;
  return {
    phaseId:
      first(record, ["phaseId", "phase_id"]) ??
      (currentPhase ? first(currentPhase, ["id", "phaseId"]) : undefined),
    sessionId:
      first(record, ["sessionId", "session_id"]) ??
      (session ? first(session, ["id", "sessionId"]) : undefined),
    jobId: first(record, ["jobId", "job_id"]),
    runId: first(record, ["runId", "run_id"]),
  };
}

function iso(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const millis = Date.parse(value);
    if (Number.isFinite(millis)) return new Date(millis).toISOString();
  }
  const fallbackMillis = Date.parse(fallback);
  if (!Number.isFinite(fallbackMillis))
    throw new TypeError("observedAt must be an ISO timestamp");
  return new Date(fallbackMillis).toISOString();
}

export interface NormalizeObservationInput {
  source: EventSourceKind;
  logicalSource?: EventSourceKind;
  value: unknown;
  observedAt: string;
  sourceCoordinate: string;
  sourceCursor?: string;
}

export function normalizeObservation(
  input: NormalizeObservationInput,
): NormalizedEventEnvelope {
  const raw =
    input.value !== null &&
    typeof input.value === "object" &&
    !Array.isArray(input.value)
      ? (input.value as Record<string, unknown>)
      : { value: input.value };
  const payload = sanitize(raw) as Record<string, unknown>;
  const physicalObservedAt = iso(input.observedAt, input.observedAt);
  const rawOccurredAt =
    raw.occurredAt ?? raw.timestamp ?? raw.createdAt ?? raw.updatedAt;
  const occurredAt = iso(rawOccurredAt, physicalObservedAt);
  const type = asIdentifier(raw.type) ?? `${input.source}.observed`;
  const logicalSource = input.logicalSource ?? input.source;
  const suppliedCursor = identityCursor(
    input.sourceCursor ?? raw.id ?? raw.eventId,
  );
  const coordinate = String(input.sourceCoordinate).normalize("NFC");
  if (coordinate.length > MAX_IDENTITY_INPUT)
    throw new TypeError(
      `source coordinate exceeds ${MAX_IDENTITY_INPUT} characters`,
    );
  const canonicalId = suppliedCursor
    ? digest("source", logicalSource, suppliedCursor)
    : digest("fallback", logicalSource, coordinate, type, canonical(payload));
  const id = `aiw:event:${canonicalId}`;
  const observedAt =
    logicalSource === "dashboard-feed"
      ? typeof rawOccurredAt === "string" &&
        Number.isFinite(Date.parse(rawOccurredAt))
        ? occurredAt
        : "1970-01-01T00:00:00.000Z"
      : physicalObservedAt;
  return {
    schema: WORLD_EVENT_PROTOCOL.schema,
    version: WORLD_EVENT_PROTOCOL.version,
    id,
    animationId: `aiw:animation:${digest(id).slice(0, 32)}`,
    type,
    source: logicalSource,
    cursor: suppliedCursor
      ? { kind: "source", value: suppliedCursor }
      : {
          kind: "canonical-fallback",
          value: `canonical:${canonicalId}`,
        },
    fallbackId: !suppliedCursor,
    observedAt,
    occurredAt,
    correlationId: first(raw, ["correlationId", "correlation_id"]),
    mapping: mappingFrom(raw),
    payload,
    compatibility: { contract: "agentintersect/14c62027", supported: true },
  };
}

const EVENT_KEYS = new Set([
  "schema",
  "version",
  "id",
  "animationId",
  "type",
  "source",
  "cursor",
  "fallbackId",
  "observedAt",
  "occurredAt",
  "correlationId",
  "mapping",
  "payload",
  "compatibility",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactIso(value: unknown, label: string): asserts value is string {
  if (
    typeof value !== "string" ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(Date.parse(value)).toISOString() !== value
  ) {
    throw new Error(`${label} must be a canonical ISO timestamp`);
  }
}

function boundedIdentifier(
  value: unknown,
  label: string,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_IDENTIFIER ||
    cleanString(value) !== value
  ) {
    throw new Error(`${label} must be a bounded sanitized identifier`);
  }
}

export function assertNormalizedEventEnvelope(
  value: unknown,
): asserts value is NormalizedEventEnvelope {
  if (!isRecord(value))
    throw new Error("normalized envelope must be an object");
  if (Object.keys(value).some((key) => !EVENT_KEYS.has(key)))
    throw new Error("normalized envelope contains unsupported fields");
  if (
    value.schema !== WORLD_EVENT_PROTOCOL.schema ||
    value.version !== WORLD_EVENT_PROTOCOL.version
  )
    throw new Error("incompatible normalized envelope");
  if (
    ![
      "daemon-state",
      "dashboard-snapshot",
      "dashboard-feed",
      "dashboard-sse",
    ].includes(String(value.source))
  )
    throw new Error("unsupported event source");
  boundedIdentifier(value.type, "event type");
  exactIso(value.observedAt, "observedAt");
  exactIso(value.occurredAt, "occurredAt");
  if (!isRecord(value.cursor)) throw new Error("cursor must be an object");
  if (Object.keys(value.cursor).some((key) => !["kind", "value"].includes(key)))
    throw new Error("cursor contains unsupported fields");
  if (!isRecord(value.mapping)) throw new Error("mapping must be an object");
  if (
    Object.keys(value.mapping).some(
      (key) => !["phaseId", "sessionId", "jobId", "runId"].includes(key),
    )
  )
    throw new Error("mapping contains unsupported fields");
  for (const [key, child] of Object.entries(value.mapping)) {
    if (child !== undefined) boundedIdentifier(child, `mapping.${key}`);
  }
  if (value.correlationId !== undefined)
    boundedIdentifier(value.correlationId, "correlationId");
  if (!isRecord(value.payload)) throw new Error("payload must be an object");
  if (canonical(sanitize(value.payload)) !== canonical(value.payload))
    throw new Error("payload violates sanitized payload invariants");
  if (!isRecord(value.compatibility))
    throw new Error("compatibility must be an object");
  if (
    Object.keys(value.compatibility).length !== 2 ||
    value.compatibility.contract !== "agentintersect/14c62027" ||
    value.compatibility.supported !== true
  )
    throw new Error("invalid compatibility metadata");
  if (
    value.cursor.kind !== "source" &&
    value.cursor.kind !== "canonical-fallback"
  )
    throw new Error("invalid cursor kind");
  boundedIdentifier(value.cursor.value, "cursor value");
  if (value.fallbackId !== (value.cursor.kind === "canonical-fallback"))
    throw new Error("cursor/fallback relationship is invalid");
  const source = value.source as EventSourceKind;
  const expectedDigest =
    value.cursor.kind === "source"
      ? digest("source", source, value.cursor.value)
      : /^canonical:([a-f0-9]{64})$/.exec(value.cursor.value)?.[1];
  if (!expectedDigest || value.id !== `aiw:event:${expectedDigest}`)
    throw new Error("canonical event ID relationship is invalid");
  const expectedAnimation = `aiw:animation:${digest(value.id).slice(0, 32)}`;
  if (value.animationId !== expectedAnimation)
    throw new Error("canonical animation ID relationship is invalid");
}

const SOURCE_ORDER: Record<EventSourceKind, number> = {
  "daemon-state": 0,
  "dashboard-snapshot": 1,
  "dashboard-feed": 2,
  "dashboard-sse": 3,
};

export function stableEventOrder(
  left: NormalizedEventEnvelope,
  right: NormalizedEventEnvelope,
): number {
  return (
    left.occurredAt.localeCompare(right.occurredAt) ||
    SOURCE_ORDER[left.source] - SOURCE_ORDER[right.source] ||
    left.id.localeCompare(right.id)
  );
}

export interface EventProjection {
  schema: "aiw.integration-projection/0.6";
  phaseBoard: {
    current: {
      id: string;
      status: string | undefined;
      title: string | undefined;
    } | null;
    previous: Array<{
      id: string;
      status: string | undefined;
      title: string | undefined;
    }>;
  };
  roster: Array<{
    id: string;
    harness: string | undefined;
    status: string | undefined;
    jobId: string | undefined;
    runId: string | undefined;
  }>;
  timeline: NormalizedEventEnvelope[];
  animationIds: string[];
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

export function projectEvents(
  events: readonly NormalizedEventEnvelope[],
  timelineLimit = 200,
  authoritativeObservations: readonly NormalizedEventEnvelope[] = [],
): EventProjection {
  const byId = new Map<string, NormalizedEventEnvelope>();
  for (const event of events) {
    const existing = byId.get(event.id);
    if (!existing || canonical(event) < canonical(existing))
      byId.set(event.id, event);
  }
  const unique = [...byId.values()].sort(stableEventOrder);
  const authoritative = [...authoritativeObservations]
    .filter(
      (event) =>
        event.source === "daemon-state" ||
        event.source === "dashboard-snapshot",
    )
    .sort(
      (left, right) =>
        left.observedAt.localeCompare(right.observedAt) ||
        SOURCE_ORDER[left.source] - SOURCE_ORDER[right.source],
    );
  const phases = new Map<
    string,
    { id: string; status: string | undefined; title: string | undefined }
  >();
  const roster = new Map<
    string,
    {
      id: string;
      harness: string | undefined;
      status: string | undefined;
      jobId: string | undefined;
      runId: string | undefined;
    }
  >();
  const projectable =
    authoritative.length > 0 ? [...unique, ...authoritative] : unique;
  for (const event of projectable) {
    const payload = event.payload as Record<string, unknown>;
    const phasePayload =
      payload.currentPhase && typeof payload.currentPhase === "object"
        ? (payload.currentPhase as Record<string, unknown>)
        : payload;
    const observedPhases = [
      ...recordArray(payload.phases),
      ...recordArray(payload.phaseTimeline),
      phasePayload,
    ];
    for (const phase of observedPhases) {
      const phaseId =
        phase === phasePayload
          ? (event.mapping.phaseId ??
            first(phase, ["id", "phaseId", "phase_id"]))
          : first(phase, ["id", "phaseId", "phase_id"]);
      if (!phaseId) continue;
      phases.set(phaseId, {
        id: phaseId,
        status: first(phase, ["status"]),
        title: first(phase, ["title", "name"]),
      });
    }
    const addRoster = (
      worker: Record<string, unknown>,
      fromWorkerJob: boolean,
    ) => {
      const claimedId = first(worker, [
        "claimedBy",
        "workerId",
        "worker_id",
        "agentId",
        "agent_id",
      ]);
      const id = claimedId ?? first(worker, ["id"]);
      if (!id) return;
      roster.set(id, {
        id,
        harness: first(worker, ["harness"]),
        status: first(worker, ["status"]),
        jobId:
          first(worker, ["jobId", "job_id"]) ??
          (fromWorkerJob && claimedId ? first(worker, ["id"]) : undefined) ??
          event.mapping.jobId,
        runId: first(worker, ["runId", "run_id"]) ?? event.mapping.runId,
      });
    };
    if (authoritative.length === 0 || authoritative.includes(event)) {
      for (const worker of recordArray(payload.workerJobs)) {
        addRoster(worker, true);
      }
      for (const worker of recordArray(payload.agents)) {
        addRoster(worker, false);
      }
      if (payload.worker && typeof payload.worker === "object") {
        addRoster(payload.worker as Record<string, unknown>, false);
      }
    }
  }
  const phaseList = [...phases.values()];
  const currentId = [...(authoritative.length > 0 ? authoritative : unique)]
    .reverse()
    .find((event) => event.mapping.phaseId)?.mapping.phaseId;
  const current = currentId
    ? (phases.get(currentId) ?? {
        id: currentId,
        status: undefined,
        title: undefined,
      })
    : (phaseList.at(-1) ?? null);
  return {
    schema: "aiw.integration-projection/0.6",
    phaseBoard: {
      current,
      previous: phaseList
        .filter((phase) => phase.id !== current?.id)
        .slice(-20),
    },
    roster: [...roster.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, 128),
    timeline: unique.slice(-Math.max(1, Math.min(timelineLimit, 500))),
    animationIds: unique
      .slice(-Math.max(1, Math.min(timelineLimit, 500)))
      .map((event) => event.animationId),
  };
}

export function canonicalProjection(projection: EventProjection): string {
  return canonical(JSON.parse(JSON.stringify(projection)) as unknown);
}
