export type IntegrationStatus =
  | "disabled"
  | "connecting"
  | "ready"
  | "stale"
  | "offline"
  | "mismatch"
  | "error";

export interface TimelineEvent {
  id: string;
  animationId: string;
  type: string;
  source: string;
  occurredAt: string;
  fallbackId: boolean;
  mapping: {
    phaseId?: string;
    sessionId?: string;
    jobId?: string;
    runId?: string;
  };
  payload: Record<string, unknown>;
}

export interface IntegrationState {
  schema: "aiw.integration/0.6";
  status: IntegrationStatus;
  observationOnly: true;
  executionEnabled: false;
  diagnostics: string[];
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastGoodAvailable: boolean;
  projection: {
    phaseBoard: {
      current: { id: string; status?: string; title?: string } | null;
      previous: Array<{ id: string; status?: string; title?: string }>;
    };
    roster: Array<{
      id: string;
      harness?: string;
      status?: string;
      jobId?: string;
      runId?: string;
    }>;
    timeline: TimelineEvent[];
    animationIds: string[];
  };
  replay: {
    acceptedCount: number;
    replayed: boolean;
    degraded: boolean;
    diagnostic: string | null;
  };
  reconciliation: {
    attempts: number;
    successes: number;
    reconnects: number;
    gaps: number;
    resets: number;
    overflows: number;
    backpressureDrops: number;
    lastReason: string | null;
  };
}

export interface HarnessReadiness {
  schema: "aiw.harness-readiness/0.6";
  harness: string;
  status: IntegrationStatus;
  observationOnly: true;
  executionEnabled: false;
  diagnostic: string;
}
