import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  assertNormalizedEventEnvelope,
  projectEvents,
  type EventProjection,
  type EventSourceKind,
  type NormalizedEventEnvelope,
} from "@agentintersect-world/world-event-protocol";

export const PERSISTENCE_CAPABILITY = {
  package: "persistence",
  phase: "phase6-normalized-replay",
  durableStorageAvailable: true,
  sqlite: true,
  jsonlLedger: true,
} as const;

const MAX_LEDGER_ROW_BYTES = 262_144;
const AUTHORITATIVE_SOURCES = new Set<EventSourceKind>([
  "daemon-state",
  "dashboard-snapshot",
]);

export interface EventStoreSnapshot {
  schema: "aiw.replay/0.6";
  acceptedCount: number;
  replayed: boolean;
  degraded: boolean;
  diagnostic: string | null;
  lastEventId: string | null;
  projection: EventProjection;
}

export interface WorldEventStoreOptions {
  afterLedgerAppend?: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseLedgerEvent(value: unknown): NormalizedEventEnvelope {
  assertNormalizedEventEnvelope(value);
  return value;
}

function sameLogicalEvent(
  left: NormalizedEventEnvelope,
  right: NormalizedEventEnvelope,
): boolean {
  const withoutObservationTime = (event: NormalizedEventEnvelope) => ({
    ...event,
    observedAt: undefined,
    occurredAt: undefined,
  });
  return (
    JSON.stringify(withoutObservationTime(left)) ===
    JSON.stringify(withoutObservationTime(right))
  );
}

function verifiedLedger(ledgerPath: string): {
  events: NormalizedEventEnvelope[];
  diagnostic: string | null;
} {
  if (!fs.existsSync(ledgerPath)) return { events: [], diagnostic: null };
  const content = fs.readFileSync(ledgerPath, "utf8");
  if (content.length === 0) return { events: [], diagnostic: null };
  const complete = content.endsWith("\n");
  const lines = content.split("\n");
  const completeLines = complete ? lines.slice(0, -1) : lines.slice(0, -1);
  const events: NormalizedEventEnvelope[] = [];
  const ids = new Map<string, string>();
  const animations = new Map<string, string>();
  for (let index = 0; index < completeLines.length; index += 1) {
    const line = completeLines[index] ?? "";
    try {
      if (Buffer.byteLength(line) > MAX_LEDGER_ROW_BYTES)
        throw new Error(
          `oversized ledger row exceeds ${MAX_LEDGER_ROW_BYTES} bytes`,
        );
      const event = parseLedgerEvent(JSON.parse(line));
      const serialized = JSON.stringify(event);
      const existingId = ids.get(event.id);
      if (existingId !== undefined)
        throw new Error(
          existingId === serialized
            ? `duplicate event ID ${event.id}`
            : `conflicting event ID ${event.id}`,
        );
      const existingAnimation = animations.get(event.animationId);
      if (existingAnimation !== undefined && existingAnimation !== event.id)
        throw new Error(`animation ID collision ${event.animationId}`);
      ids.set(event.id, serialized);
      animations.set(event.animationId, event.id);
      events.push(event);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "invalid JSON";
      return {
        events,
        diagnostic: `corrupt ledger record ${index + 1}: ${reason}`,
      };
    }
  }
  if (!complete) {
    return {
      events,
      diagnostic: `corrupt ledger record ${completeLines.length + 1}: partial final record`,
    };
  }
  return { events, diagnostic: null };
}

function parseProjection(value: unknown): EventProjection {
  if (!isRecord(value) || value.schema !== "aiw.integration-projection/0.6")
    throw new Error("checkpoint projection schema is invalid");
  if (!isRecord(value.phaseBoard))
    throw new Error("checkpoint phase board is invalid");
  if (!Array.isArray(value.roster) || value.roster.length > 128)
    throw new Error("checkpoint roster is invalid");
  if (!Array.isArray(value.timeline) || value.timeline.length > 500)
    throw new Error("checkpoint timeline is invalid");
  if (
    !Array.isArray(value.animationIds) ||
    value.animationIds.length !== value.timeline.length
  )
    throw new Error("checkpoint animation IDs are invalid");
  const timeline = value.timeline.map(parseLedgerEvent);
  const animationIds = value.animationIds as unknown[];
  if (
    timeline.some((event, index) => event.animationId !== animationIds[index])
  )
    throw new Error("checkpoint animation relationship is invalid");
  return value as unknown as EventProjection;
}

function readCheckpoint(database: DatabaseSync): EventStoreSnapshot | null {
  const row = database
    .prepare(
      "SELECT accepted_count, last_event_id, projection_json FROM checkpoints WHERE checkpoint_id = 1",
    )
    .get() as
    | {
        accepted_count: number;
        last_event_id: string | null;
        projection_json: string;
      }
    | undefined;
  if (!row) return null;
  if (!Number.isSafeInteger(row.accepted_count) || row.accepted_count < 0)
    throw new Error("checkpoint accepted count is invalid");
  if (
    row.last_event_id !== null &&
    !/^aiw:event:[a-f0-9]{64}$/.test(row.last_event_id)
  )
    throw new Error("checkpoint last event ID is invalid");
  if (Buffer.byteLength(row.projection_json) > 2_000_000)
    throw new Error("checkpoint projection is oversized");
  const projection = parseProjection(JSON.parse(row.projection_json));
  if (row.accepted_count < projection.timeline.length)
    throw new Error("checkpoint accepted count precedes its projection");
  return {
    schema: "aiw.replay/0.6",
    acceptedCount: row.accepted_count,
    replayed: row.accepted_count > 0,
    degraded: false,
    diagnostic: null,
    lastEventId: row.last_event_id,
    projection,
  };
}

export class WorldEventStore {
  readonly root: string;
  readonly databasePath: string;
  readonly ledgerPath: string;
  private readonly database: DatabaseSync;
  private readonly options: WorldEventStoreOptions;
  private events: NormalizedEventEnvelope[];
  private latestObservations = new Map<
    EventSourceKind,
    NormalizedEventEnvelope
  >();
  private state: EventStoreSnapshot;
  private closed = false;

  constructor(root: string, options: WorldEventStoreOptions = {}) {
    this.options = options;
    this.root = path.resolve(root);
    fs.mkdirSync(this.root, { recursive: true, mode: 0o700 });
    this.databasePath = path.join(this.root, "integration.sqlite");
    this.ledgerPath = path.join(this.root, "accepted-events.jsonl");
    this.database = new DatabaseSync(this.databasePath);
    this.database.exec(
      "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;",
    );
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS accepted_events (
        event_id TEXT PRIMARY KEY,
        animation_id TEXT NOT NULL UNIQUE,
        occurred_at TEXT NOT NULL,
        source_kind TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS checkpoints (
        checkpoint_id INTEGER PRIMARY KEY CHECK (checkpoint_id = 1),
        accepted_count INTEGER NOT NULL,
        last_event_id TEXT,
        projection_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS source_state (
        source_kind TEXT PRIMARY KEY,
        cursor_kind TEXT NOT NULL,
        cursor_value TEXT NOT NULL,
        observed_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS source_observations (
        source_kind TEXT PRIMARY KEY,
        envelope_json TEXT NOT NULL
      ) STRICT;
    `);
    const version = Number(
      (
        this.database.prepare("PRAGMA user_version").get() as {
          user_version?: number;
        }
      ).user_version ?? 0,
    );
    let diagnostic: string | null = null;
    if (version === 0) this.database.exec("PRAGMA user_version=6");
    else if (version !== 6)
      diagnostic = `incompatible SQLite migration ${version}; expected 6`;

    let checkpoint: EventStoreSnapshot | null = null;
    if (!diagnostic) {
      try {
        checkpoint = readCheckpoint(this.database);
        const rows = this.database
          .prepare("SELECT source_kind, envelope_json FROM source_observations")
          .all() as Array<{ source_kind: string; envelope_json: string }>;
        for (const row of rows) {
          const event = parseLedgerEvent(JSON.parse(row.envelope_json));
          if (
            !AUTHORITATIVE_SOURCES.has(event.source) ||
            event.source !== row.source_kind
          )
            throw new Error(
              `invalid persisted source observation ${row.source_kind}`,
            );
          this.latestObservations.set(event.source, event);
        }
      } catch (error) {
        diagnostic = `invalid SQLite checkpoint: ${error instanceof Error ? error.message : "unknown error"}`;
      }
    }

    const replay = verifiedLedger(this.ledgerPath);
    this.events = replay.events;
    diagnostic ??= replay.diagnostic;
    if (replay.diagnostic && checkpoint) {
      this.state = {
        ...checkpoint,
        degraded: true,
        diagnostic: `${replay.diagnostic}; validated SQLite checkpoint preserved`,
      };
      return;
    }

    if (!diagnostic) {
      try {
        this.reconcileAcceptedRows();
      } catch (error) {
        diagnostic = `SQLite replay mismatch: ${error instanceof Error ? error.message : "unknown error"}`;
      }
    }
    this.state = {
      schema: "aiw.replay/0.6",
      acceptedCount: this.events.length,
      replayed: this.events.length > 0,
      degraded: diagnostic !== null,
      diagnostic,
      lastEventId: this.events.at(-1)?.id ?? null,
      projection: projectEvents(this.events, 200, [
        ...this.latestObservations.values(),
      ]),
    };
    if (!diagnostic) this.writeCheckpoint(this.state);
  }

  private reconcileAcceptedRows(): void {
    const rows = this.database
      .prepare(
        "SELECT event_id, animation_id FROM accepted_events ORDER BY rowid",
      )
      .all() as Array<{ event_id: string; animation_id: string }>;
    if (rows.length === 0 && this.events.length > 0) {
      this.database.exec("BEGIN IMMEDIATE");
      try {
        const insert = this.database.prepare(
          "INSERT INTO accepted_events(event_id, animation_id, occurred_at, source_kind) VALUES (?, ?, ?, ?)",
        );
        for (const event of this.events)
          insert.run(
            event.id,
            event.animationId,
            event.occurredAt,
            event.source,
          );
        this.database.exec("COMMIT");
      } catch (error) {
        this.database.exec("ROLLBACK");
        throw error;
      }
      return;
    }
    if (
      rows.length !== this.events.length ||
      rows.some(
        (row, index) =>
          row.event_id !== this.events[index]?.id ||
          row.animation_id !== this.events[index]?.animationId,
      )
    )
      throw new Error("accepted event rows do not match the verified ledger");
  }

  private writeCheckpoint(state: EventStoreSnapshot): void {
    this.database
      .prepare(
        `INSERT INTO checkpoints(checkpoint_id, accepted_count, last_event_id, projection_json)
         VALUES (1, ?, ?, ?)
         ON CONFLICT(checkpoint_id) DO UPDATE SET
           accepted_count=excluded.accepted_count,
           last_event_id=excluded.last_event_id,
           projection_json=excluded.projection_json`,
      )
      .run(
        state.acceptedCount,
        state.lastEventId,
        JSON.stringify(state.projection),
      );
  }

  private persistSourceObservation(event: NormalizedEventEnvelope): void {
    this.database
      .prepare(
        `INSERT INTO source_observations(source_kind, envelope_json)
         VALUES (?, ?)
         ON CONFLICT(source_kind) DO UPDATE SET envelope_json=excluded.envelope_json`,
      )
      .run(event.source, JSON.stringify(event));
    this.database
      .prepare(
        `INSERT INTO source_state(source_kind, cursor_kind, cursor_value, observed_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(source_kind) DO UPDATE SET
           cursor_kind=excluded.cursor_kind,
           cursor_value=excluded.cursor_value,
           observed_at=excluded.observed_at`,
      )
      .run(
        event.source,
        event.cursor.kind,
        event.cursor.value,
        event.observedAt,
      );
  }

  private failClosed(previous: EventStoreSnapshot, error: unknown): never {
    const message =
      error instanceof Error ? error.message : "unknown persistence failure";
    this.state = {
      ...previous,
      degraded: true,
      diagnostic: `post-append persistence failure: ${message}`,
    };
    throw error;
  }

  accept(event: NormalizedEventEnvelope): {
    accepted: boolean;
    duplicate: boolean;
    event: NormalizedEventEnvelope;
  } {
    if (this.closed) throw new Error("event store is closed");
    if (this.state.degraded)
      throw new Error(`event store is fail-closed: ${this.state.diagnostic}`);
    parseLedgerEvent(event);
    const previous = this.state;
    const previousLedgerSize = fs.existsSync(this.ledgerPath)
      ? fs.statSync(this.ledgerPath).size
      : 0;
    let appended = false;
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const byId = this.events.find((item) => item.id === event.id);
      const byAnimation = this.events.find(
        (item) =>
          item.animationId === event.animationId && item.id !== event.id,
      );
      if (byAnimation)
        throw new Error(`animation ID collision ${event.animationId}`);
      if (byId && !sameLogicalEvent(byId, event))
        throw new Error(`conflicting event ID ${event.id}`);

      const nextLatest = new Map(this.latestObservations);
      if (AUTHORITATIVE_SOURCES.has(event.source))
        nextLatest.set(event.source, event);
      if (byId) {
        if (AUTHORITATIVE_SOURCES.has(event.source)) {
          this.persistSourceObservation(event);
          const nextState: EventStoreSnapshot = {
            ...previous,
            projection: projectEvents(this.events, 200, [
              ...nextLatest.values(),
            ]),
          };
          this.writeCheckpoint(nextState);
          this.database.exec("COMMIT");
          this.latestObservations = nextLatest;
          this.state = nextState;
        } else {
          this.database.exec("ROLLBACK");
        }
        return { accepted: false, duplicate: true, event: byId };
      }

      this.database
        .prepare(
          "INSERT INTO accepted_events(event_id, animation_id, occurred_at, source_kind) VALUES (?, ?, ?, ?)",
        )
        .run(event.id, event.animationId, event.occurredAt, event.source);
      const handle = fs.openSync(this.ledgerPath, "a", 0o600);
      try {
        fs.writeSync(handle, `${JSON.stringify(event)}\n`, undefined, "utf8");
        fs.fsyncSync(handle);
      } finally {
        fs.closeSync(handle);
      }
      appended = true;
      this.options.afterLedgerAppend?.();
      if (AUTHORITATIVE_SOURCES.has(event.source))
        this.persistSourceObservation(event);
      const nextEvents = [...this.events, event];
      const nextState: EventStoreSnapshot = {
        ...previous,
        acceptedCount: nextEvents.length,
        replayed: previous.replayed,
        lastEventId: event.id,
        projection: projectEvents(nextEvents, 200, [...nextLatest.values()]),
      };
      this.writeCheckpoint(nextState);
      this.database.exec("COMMIT");
      this.events = nextEvents;
      this.latestObservations = nextLatest;
      this.state = nextState;
      return { accepted: true, duplicate: false, event };
    } catch (error) {
      try {
        this.database.exec("ROLLBACK");
      } catch {
        /* transaction already settled */
      }
      if (appended) {
        try {
          fs.truncateSync(this.ledgerPath, previousLedgerSize);
        } catch {
          /* restart will validate the committed checkpoint and fail closed */
        }
      }
      return this.failClosed(previous, error);
    }
  }

  snapshot(): EventStoreSnapshot {
    return structuredClone(this.state);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.database.close();
  }
}
