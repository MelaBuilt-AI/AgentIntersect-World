import { describe, expect, it } from "vitest";

import {
  ContractReadError,
  parseDashboardFeed,
  parseDashboardSnapshot,
  parseDaemonState,
} from "@agentintersect-world/agentintersect-client/read";

const state = {
  currentPhase: { id: "phase_6", status: "running", title: "Read integration" },
  session: { id: "session-1" },
  workerJobs: [
    { id: "job-1", runId: "run-1", harness: "codex", status: "running" },
  ],
};

describe("Phase 6 read-only compatibility parsing", () => {
  it("accepts the pinned state, snapshot, and feed shapes", () => {
    expect(parseDaemonState(state).currentPhase?.id).toBe("phase_6");
    expect(
      parseDashboardSnapshot({
        currentPhase: state.currentPhase,
        phaseTimeline: [state.currentPhase],
        workerJobs: state.workerJobs,
        session: state.session,
      }).phaseTimeline,
    ).toHaveLength(1);
    expect(
      parseDashboardFeed({
        ok: true,
        events: [
          {
            id: "source-1",
            type: "worker.job.running",
            timestamp: "2026-07-19T12:00:00.000Z",
            jobId: "job-1",
          },
        ],
      }).events,
    ).toHaveLength(1);
  });

  it.each([
    ["state", () => parseDaemonState({ workerJobs: "not-an-array" })],
    ["snapshot", () => parseDashboardSnapshot({ phaseTimeline: "bad" })],
    ["feed", () => parseDashboardFeed({ ok: false, events: [] })],
    [
      "oversized feed",
      () => parseDashboardFeed({ ok: true, events: Array(513).fill({}) }),
    ],
  ])("fails closed for malformed %s input", (_label, parse) => {
    expect(parse).toThrow(ContractReadError);
  });

  it.each([
    ["current phase ID", () => parseDaemonState({ currentPhase: { id: [] } })],
    [
      "phase status",
      () => parseDaemonState({ currentPhase: { id: "phase_6", status: {} } }),
    ],
    ["empty worker", () => parseDaemonState({ workerJobs: [{}] })],
    ["empty phase", () => parseDashboardSnapshot({ phaseTimeline: [{}] })],
    ["empty feed event", () => parseDashboardFeed({ ok: true, events: [{}] })],
  ])("rejects malformed nested %s", (_label, parse) => {
    expect(parse).toThrow(ContractReadError);
  });
});
