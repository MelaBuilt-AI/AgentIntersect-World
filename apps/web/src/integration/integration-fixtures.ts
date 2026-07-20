import type { IntegrationState } from "./types.js";

type FixtureName = "ready" | "offline" | "mismatch" | "replayed" | "hostile";

const event = {
  id: "aiw:event:fixture",
  animationId: "aiw:animation:fixture",
  type: "worker.job.running",
  source: "dashboard-feed",
  occurredAt: "2026-07-19T12:00:01.000Z",
  fallbackId: true,
  mapping: {
    phaseId: "phase_6",
    sessionId: "session-1",
    jobId: "job-1",
    runId: "run-1",
  },
  payload: {
    message: "bounded telemetry",
    path: "[REDACTED_PATH]",
    token: "[REDACTED]",
  },
};

export function integrationFixture(name: FixtureName): IntegrationState {
  const ready = name === "ready" || name === "replayed" || name === "hostile";
  const status = ready ? "ready" : name;
  const hasData = ready || name === "mismatch";
  return {
    schema: "aiw.integration/0.6",
    status,
    observationOnly: true,
    executionEnabled: false,
    diagnostics:
      name === "offline"
        ? [
            "AgentIntersect read service is offline; last-good projection preserved.",
          ]
        : name === "mismatch"
          ? ["AgentIntersect attestation mismatch: workspace"]
          : name === "replayed"
            ? ["Recovered from the verified accepted-event ledger."]
            : name === "hostile"
              ? ["Hostile telemetry was redacted and truncated before display."]
              : [
                  "Fresh health, workspace, snapshot, feed, and SSE observations.",
                ],
    lastAttemptAt: "2026-07-19T12:00:02.000Z",
    lastSuccessAt: hasData ? "2026-07-19T12:00:01.000Z" : null,
    lastGoodAvailable: hasData,
    projection: {
      phaseBoard: hasData
        ? {
            current: {
              id: "phase_6",
              status: "running",
              title: "Read integration",
            },
            previous: [
              { id: "phase_5", status: "complete", title: "World shell" },
            ],
          }
        : { current: null, previous: [] },
      roster: hasData
        ? [
            {
              id: "agent-1",
              harness: "codex",
              status: "running",
              jobId: "job-1",
              runId: "run-1",
            },
          ]
        : [],
      timeline: hasData ? [event] : [],
      animationIds: hasData ? [event.animationId] : [],
    },
    replay: {
      acceptedCount: hasData ? 1 : 0,
      replayed: name === "replayed" || name === "mismatch",
      degraded: false,
      diagnostic: null,
    },
    reconciliation: {
      attempts: 2,
      successes: hasData ? 1 : 0,
      reconnects: name === "replayed" ? 1 : 0,
      gaps: 0,
      resets: 0,
      overflows: 0,
      backpressureDrops: 0,
      lastReason: "fixture",
    },
  };
}

export function fixtureFromQuery(value: string | null): FixtureName | null {
  if (!value?.startsWith("phase6-")) return null;
  const name = value.slice("phase6-".length) as FixtureName;
  return ["ready", "offline", "mismatch", "replayed", "hostile"].includes(name)
    ? name
    : null;
}
