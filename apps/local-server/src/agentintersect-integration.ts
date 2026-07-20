import { AttestationError } from "@agentintersect-world/agentintersect-client";
import {
  ContractReadError,
  type InitialReadObservation,
} from "@agentintersect-world/agentintersect-client/read";
import {
  type EventStoreSnapshot,
  WorldEventStore,
} from "@agentintersect-world/persistence";
import {
  normalizeObservation,
  projectEvents,
  type EventProjection,
} from "@agentintersect-world/world-event-protocol";

export type IntegrationCompatibilityStatus =
  | "disabled"
  | "connecting"
  | "ready"
  | "stale"
  | "offline"
  | "mismatch"
  | "error";

export interface ReadClientLike {
  readInitial(): Promise<InitialReadObservation>;
  streamEvents?(
    onFrame: (frame: SseObservationFrame) => Promise<void> | void,
    signal: AbortSignal,
  ): Promise<void>;
}

export interface ReconciliationMetadata {
  attempts: number;
  successes: number;
  reconnects: number;
  gaps: number;
  resets: number;
  overflows: number;
  backpressureDrops: number;
  lastReason: string | null;
}

export interface IntegrationSnapshot {
  schema: "aiw.integration/0.6";
  status: IntegrationCompatibilityStatus;
  compatibility: "agentintersect/14c62027";
  observationOnly: true;
  executionEnabled: false;
  diagnostics: string[];
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastGoodAvailable: boolean;
  projection: EventProjection;
  replay: EventStoreSnapshot;
  reconciliation: ReconciliationMetadata;
}

export interface ReadIntegrationServiceOptions {
  enabled: boolean;
  client?: ReadClientLike;
  store?: WorldEventStore;
  now?: () => number;
  staleAfterMs?: number;
  maxQueuedFrames?: number;
}

export interface SseObservationFrame {
  sequence?: number;
  reset?: boolean;
  overflow?: boolean;
  events: Record<string, unknown>[];
}

function emptyReplay(): EventStoreSnapshot {
  return {
    schema: "aiw.replay/0.6",
    acceptedCount: 0,
    replayed: false,
    degraded: false,
    diagnostic: null,
    lastEventId: null,
    projection: projectEvents([]),
  };
}

export class ReadIntegrationService {
  private readonly client: ReadClientLike | undefined;
  private readonly store: WorldEventStore | undefined;
  private readonly now: () => number;
  private readonly staleAfterMs: number;
  private readonly maxQueuedFrames: number;
  private status: IntegrationCompatibilityStatus;
  private diagnostics: string[] = [];
  private lastAttemptAt: string | null = null;
  private lastSuccessAt: string | null = null;
  private sequence: number | null = null;
  private closed = false;
  private started = false;
  private streamAbort: AbortController | undefined;
  private streamTask: Promise<void> | undefined;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private reconnectResolve: (() => void) | undefined;
  private reconcileInFlight: Promise<IntegrationSnapshot> | undefined;
  private closeTask: Promise<void> | undefined;
  private readonly reconciliation: ReconciliationMetadata = {
    attempts: 0,
    successes: 0,
    reconnects: 0,
    gaps: 0,
    resets: 0,
    overflows: 0,
    backpressureDrops: 0,
    lastReason: null,
  };

  constructor(private readonly options: ReadIntegrationServiceOptions) {
    this.client = options.client;
    this.store = options.store;
    this.now = options.now ?? Date.now;
    this.staleAfterMs = options.staleAfterMs ?? 15_000;
    this.maxQueuedFrames = options.maxQueuedFrames ?? 32;
    this.status = options.enabled ? "connecting" : "disabled";
    if (this.store?.snapshot().degraded) {
      this.status = "error";
      this.recordDiagnostic(
        this.store.snapshot().diagnostic ?? "replay store is degraded",
      );
    }
  }

  private recordDiagnostic(message: string): void {
    this.diagnostics = [
      ...this.diagnostics.filter((item) => item !== message),
      message,
    ].slice(-20);
  }

  private acceptInitial(observation: InitialReadObservation): void {
    if (!this.store) throw new Error("integration store is unavailable");
    this.store.accept(
      normalizeObservation({
        source: "daemon-state",
        value: { type: "daemon.state.observed", ...observation.state },
        observedAt: observation.observedAt,
        sourceCoordinate: "daemon-state",
      }),
    );
    this.store.accept(
      normalizeObservation({
        source: "dashboard-snapshot",
        value: { type: "dashboard.snapshot.observed", ...observation.snapshot },
        observedAt: observation.observedAt,
        sourceCoordinate: "dashboard-snapshot",
      }),
    );
    for (const event of observation.feed.events) {
      this.store.accept(
        normalizeObservation({
          source: "dashboard-feed",
          value: event,
          observedAt: observation.observedAt,
          sourceCoordinate: "dashboard-feed",
        }),
      );
    }
  }

  async reconcile(reason: string): Promise<IntegrationSnapshot> {
    if (this.reconcileInFlight) return await this.reconcileInFlight;
    const task = this.performReconcile(reason);
    this.reconcileInFlight = task;
    try {
      return await task;
    } finally {
      if (this.reconcileInFlight === task) this.reconcileInFlight = undefined;
    }
  }

  private async performReconcile(reason: string): Promise<IntegrationSnapshot> {
    if (this.closed) throw new Error("integration service is closed");
    if (!this.options.enabled) return this.snapshot();
    if (this.store?.snapshot().degraded) {
      this.status = "error";
      this.recordDiagnostic(
        this.store.snapshot().diagnostic ?? "Replay store is fail-closed.",
      );
      return this.snapshot();
    }
    this.status = "connecting";
    this.reconciliation.attempts += 1;
    this.reconciliation.lastReason = reason.slice(0, 80);
    this.lastAttemptAt = new Date(this.now()).toISOString();
    try {
      if (!this.client || !this.store)
        throw new Error("integration client or store is unavailable");
      const observation = await this.client.readInitial();
      this.acceptInitial(observation);
      this.status = "ready";
      this.lastSuccessAt = new Date(this.now()).toISOString();
      this.reconciliation.successes += 1;
      if (this.reconciliation.successes > 1)
        this.recordDiagnostic(
          `Recovered by ${reason} snapshot/feed reconciliation.`,
        );
    } catch (error) {
      if (error instanceof AttestationError) {
        this.status = "mismatch";
        this.recordDiagnostic(
          `AgentIntersect attestation mismatch: ${error.mismatches.join(", ")}`,
        );
      } else if (error instanceof ContractReadError) {
        this.status =
          error.code === "offline"
            ? "offline"
            : error.code === "unsupported"
              ? "mismatch"
              : "error";
        this.recordDiagnostic(
          `AgentIntersect ${error.code} response (${error.message}); last-good projection preserved.`,
        );
      } else {
        this.status = "offline";
        this.recordDiagnostic(
          "AgentIntersect read service is offline; last-good projection preserved.",
        );
      }
    }
    return this.snapshot();
  }

  markStaleIfNeeded(): IntegrationSnapshot {
    if (
      this.status === "ready" &&
      this.lastSuccessAt &&
      this.now() - Date.parse(this.lastSuccessAt) > this.staleAfterMs
    ) {
      this.status = "stale";
      this.recordDiagnostic(
        "AgentIntersect observations are stale; last-good projection is labeled previous/replayed.",
      );
    }
    return this.snapshot();
  }

  async ingestSseFrames(
    frames: readonly SseObservationFrame[],
  ): Promise<IntegrationSnapshot> {
    this.markStaleIfNeeded();
    if (!this.store) return this.snapshot();
    if (this.status !== "ready") {
      const rejectedStatus = this.status;
      const recovery = await this.reconcile("sse-frame-recovery");
      if (recovery.status !== "ready") {
        this.recordDiagnostic(
          `SSE frame rejected while integration was ${rejectedStatus}; recovery did not restore fresh authority.`,
        );
        return this.snapshot();
      }
      this.recordDiagnostic(
        `Recovered fresh authority before accepting an SSE frame received while ${rejectedStatus}.`,
      );
    }
    const bounded = frames.slice(0, this.maxQueuedFrames);
    let requiresReconciliation = false;
    if (frames.length > bounded.length) {
      const dropped = frames.length - bounded.length;
      this.reconciliation.overflows += 1;
      this.reconciliation.backpressureDrops += dropped;
      this.recordDiagnostic(
        `SSE queue overflow: ${dropped} frame(s) rejected by bounded backpressure.`,
      );
      requiresReconciliation = true;
    }
    for (const frame of bounded) {
      if (frame.reset || frame.overflow) {
        this.reconciliation.resets += 1;
        this.recordDiagnostic(
          "SSE reset/overflow requested snapshot and feed reconciliation.",
        );
        requiresReconciliation = true;
      }
      if (frame.sequence !== undefined) {
        if (this.sequence !== null && frame.sequence > this.sequence + 1) {
          this.reconciliation.gaps += 1;
          this.recordDiagnostic(
            `SSE sequence gap ${this.sequence}→${frame.sequence}; reconciling last-good state.`,
          );
          requiresReconciliation = true;
        }
        this.sequence = Math.max(
          this.sequence ?? frame.sequence,
          frame.sequence,
        );
      }
      for (const event of frame.events.slice(0, 512)) {
        this.store.accept(
          normalizeObservation({
            source: "dashboard-sse",
            logicalSource: "dashboard-feed",
            value: event,
            observedAt: new Date(this.now()).toISOString(),
            sourceCoordinate: "dashboard-feed",
          }),
        );
      }
    }
    if (requiresReconciliation) await this.reconcile("sse-recovery");
    return this.snapshot();
  }

  async handleSseReconnect(): Promise<IntegrationSnapshot> {
    this.reconciliation.reconnects += 1;
    this.recordDiagnostic(
      "SSE reconnected through snapshot and bounded feed reconciliation; source resume was not claimed.",
    );
    return await this.reconcile("sse-reconnect");
  }

  async start(): Promise<IntegrationSnapshot> {
    this.started = true;
    const initial = await this.reconcile("startup");
    this.scheduleRefresh();
    if (this.client?.streamEvents && !this.streamAbort) {
      this.streamAbort = new AbortController();
      this.streamTask = this.streamLoop(this.streamAbort.signal);
    }
    return initial;
  }

  private scheduleRefresh(): void {
    if (!this.started || this.closed || !this.options.enabled) return;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const delay = Math.max(1, Math.floor(this.staleAfterMs * 0.75));
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.reconcile("periodic-health-snapshot-feed").finally(() => {
        this.scheduleRefresh();
      });
    }, delay);
  }

  private settleReconnectDelay(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    const resolve = this.reconnectResolve;
    this.reconnectResolve = undefined;
    resolve?.();
  }

  private async reconnectDelay(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.reconnectResolve = () => {
        this.reconnectTimer = undefined;
        this.reconnectResolve = undefined;
        resolve();
      };
      this.reconnectTimer = setTimeout(
        () => this.settleReconnectDelay(),
        1_000,
      );
    });
  }

  private async streamLoop(signal: AbortSignal): Promise<void> {
    while (!signal.aborted && !this.closed && this.client?.streamEvents) {
      try {
        await this.client.streamEvents(async (frame) => {
          await this.ingestSseFrames([frame]);
        }, signal);
      } catch (error) {
        if (!signal.aborted) {
          this.status =
            error instanceof ContractReadError && error.code !== "offline"
              ? "error"
              : "offline";
          this.recordDiagnostic(
            error instanceof ContractReadError
              ? `SSE ${error.code}: ${error.message}; last-good state preserved while reconnecting.`
              : "SSE disconnected; last-good state preserved while reconnecting.",
          );
        }
      }
      if (signal.aborted || this.closed) break;
      await this.handleSseReconnect();
      await this.reconnectDelay();
    }
  }

  harnessReadiness(harness: string) {
    const status = this.markStaleIfNeeded().status;
    if (status !== "ready") {
      return {
        schema: "aiw.harness-readiness/0.6",
        harness,
        status,
        executionEnabled: false,
        observationOnly: true,
        diagnostic: `Integration is ${status}; no readiness or execution authority is claimed.`,
      } as const;
    }
    const observedHarnesses = new Set(
      this.snapshot()
        .projection.roster.map((item) => item.harness)
        .filter(Boolean),
    );
    if (observedHarnesses.size > 0 && !observedHarnesses.has(harness)) {
      return {
        schema: "aiw.harness-readiness/0.6",
        harness,
        status: "mismatch" as const,
        executionEnabled: false,
        observationOnly: true,
        diagnostic: "Selected harness contradicts the current observed roster.",
      };
    }
    return {
      schema: "aiw.harness-readiness/0.6",
      harness,
      status: "ready" as const,
      executionEnabled: false,
      observationOnly: true,
      diagnostic:
        "Fresh read integration supports this selected harness. The read facade remains observation-only; Phase 7 command authority is separate.",
    };
  }

  snapshot(): IntegrationSnapshot {
    const replay = this.store?.snapshot() ?? emptyReplay();
    return {
      schema: "aiw.integration/0.6",
      status: this.status,
      compatibility: "agentintersect/14c62027",
      observationOnly: true,
      executionEnabled: false,
      diagnostics: [...this.diagnostics],
      lastAttemptAt: this.lastAttemptAt,
      lastSuccessAt: this.lastSuccessAt,
      lastGoodAvailable: replay.acceptedCount > 0,
      projection: replay.projection,
      replay,
      reconciliation: { ...this.reconciliation },
    };
  }

  async close(): Promise<void> {
    if (this.closeTask) return await this.closeTask;
    this.closeTask = (async () => {
      if (this.closed) return;
      this.closed = true;
      this.started = false;
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
      this.streamAbort?.abort();
      this.settleReconnectDelay();
      const tasks: Promise<unknown>[] = [];
      if (this.streamTask) tasks.push(this.streamTask);
      if (this.reconcileInFlight) tasks.push(this.reconcileInFlight);
      await Promise.allSettled(tasks);
      this.store?.close();
    })();
    return await this.closeTask;
  }
}
