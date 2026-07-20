import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { AttestationError } from "@agentintersect-world/agentintersect-client";
import { ContractReadError } from "@agentintersect-world/agentintersect-client/read";
import { WorldEventStore } from "@agentintersect-world/persistence";
import { afterEach, describe, expect, it } from "vitest";
import { getEventListeners } from "node:events";
import { vi } from "vitest";

import { ReadIntegrationService } from "../src/agentintersect-integration.js";
import { createLocalServer } from "../src/server.js";

const roots: string[] = [];
const root = () => {
  const value = fs.mkdtempSync(
    path.join(os.tmpdir(), "aiw-phase6-integration-"),
  );
  roots.push(value);
  return value;
};
const observation = {
  health: {
    ok: true as const,
    pid: process.pid,
    processStartTime: "fixture",
    protocol: 1 as const,
    service: "agentintersect-daemon/v1" as const,
    workspaceIdentity: "sha256:fixture",
  },
  state: {
    currentPhase: {
      id: "phase_6",
      status: "running",
      title: "Read integration",
    },
    session: { id: "session-1" },
    workerJobs: [
      {
        id: "job-1",
        runId: "run-1",
        harness: "codex",
        status: "running",
        claimedBy: "agent-1",
      },
    ],
    phases: [],
  },
  snapshot: {
    currentPhase: {
      id: "phase_6",
      status: "running",
      title: "Read integration",
    },
    session: { id: "session-1" },
    phaseTimeline: [{ id: "phase_5", status: "complete", title: "Shell" }],
    workerJobs: [
      {
        id: "job-1",
        runId: "run-1",
        harness: "codex",
        status: "running",
        claimedBy: "agent-1",
      },
    ],
    agents: [],
  },
  feed: {
    ok: true as const,
    events: [
      {
        type: "worker.job.running",
        timestamp: "2026-07-19T12:00:01.000Z",
        phaseId: "phase_6",
        jobId: "job-1",
      },
    ],
  },
  observedAt: "2026-07-19T12:00:02.000Z",
};

afterEach(() => {
  for (const item of roots.splice(0))
    fs.rmSync(item, { recursive: true, force: true });
});

describe("Phase 6 reconciliation and strict read APIs", () => {
  it("projects ready state and exposes only bounded GET observations", async () => {
    const store = new WorldEventStore(root());
    const service = new ReadIntegrationService({
      enabled: true,
      store,
      client: { readInitial: async () => observation },
      now: () => Date.parse("2026-07-19T12:00:03.000Z"),
    });
    await service.reconcile("startup");
    expect(service.snapshot()).toMatchObject({
      status: "ready",
      lastGoodAvailable: true,
      projection: {
        phaseBoard: {
          current: { id: "phase_6" },
          previous: [{ id: "phase_5", status: "complete" }],
        },
        roster: [{ id: "agent-1", jobId: "job-1", runId: "run-1" }],
      },
    });
    expect(service.harnessReadiness("codex")).toMatchObject({
      status: "ready",
      executionEnabled: false,
    });
    expect(service.harnessReadiness("hermes")).toMatchObject({
      status: "mismatch",
      executionEnabled: false,
    });

    const server = createLocalServer({ integrationService: service });
    const endpoints = [
      "/integration/state",
      "/integration/phase-board",
      "/integration/roster",
      "/integration/timeline?limit=10",
      "/integration/replay",
      "/integration/harness/codex/readiness",
    ];
    for (const url of endpoints) {
      const response = await server.inject({ method: "GET", url });
      expect(response.statusCode, url).toBe(200);
      expect(response.json()).toMatchObject({ ok: true });
    }
    expect(
      (await server.inject({ method: "POST", url: "/integration/reconcile" }))
        .statusCode,
    ).toBe(404);
    await server.close();
  });

  it("preserves last-good data through mismatch, offline, and stale states", async () => {
    let mode: "ready" | "mismatch" | "offline" = "ready";
    let currentTime = Date.parse("2026-07-19T12:00:03.000Z");
    const service = new ReadIntegrationService({
      enabled: true,
      store: new WorldEventStore(root()),
      client: {
        readInitial: async () => {
          if (mode === "mismatch")
            throw new AttestationError([
              "workspace",
              "process_identity_mismatch",
            ]);
          if (mode === "offline") throw new Error("connection refused");
          return observation;
        },
      },
      now: () => currentTime,
      staleAfterMs: 1_000,
    });
    await service.reconcile("startup");
    const count = service.snapshot().projection.timeline.length;
    mode = "mismatch";
    await service.reconcile("contract-check");
    expect(service.snapshot()).toMatchObject({
      status: "mismatch",
      lastGoodAvailable: true,
    });
    expect(service.snapshot().projection.timeline).toHaveLength(count);
    mode = "offline";
    await service.reconcile("reconnect");
    expect(service.snapshot().status).toBe("offline");
    mode = "ready";
    await service.reconcile("recovered");
    currentTime += 2_000;
    service.markStaleIfNeeded();
    expect(service.snapshot().status).toBe("stale");
    await service.close();
  });

  it("reconciles duplicate SSE, reconnect, gaps, reset, overflow, and bounded backpressure", async () => {
    let reads = 0;
    const service = new ReadIntegrationService({
      enabled: true,
      store: new WorldEventStore(root()),
      client: {
        readInitial: async () => {
          reads += 1;
          return observation;
        },
      },
      maxQueuedFrames: 3,
      now: () => Date.parse("2026-07-19T12:00:03.000Z"),
    });
    await service.reconcile("startup");
    const before = service.snapshot().replay.acceptedCount;
    await service.ingestSseFrames([
      { sequence: 1, events: observation.feed.events },
      { sequence: 3, events: observation.feed.events },
      { reset: true, events: [] },
      { sequence: 4, events: observation.feed.events },
      { sequence: 5, events: observation.feed.events },
    ]);
    await service.handleSseReconnect();
    const state = service.snapshot();
    expect(state.replay.acceptedCount).toBe(before);
    expect(state.reconciliation).toMatchObject({
      gaps: 1,
      resets: 1,
      overflows: 1,
      backpressureDrops: 2,
      reconnects: 1,
    });
    expect(reads).toBeGreaterThanOrEqual(3);
    expect(state.diagnostics.join(" ")).toMatch(/overflow|reset|gap/i);
    await service.close();
  });

  it("refreshes a stable stream before repeated stale deadlines", async () => {
    vi.useFakeTimers();
    let reads = 0;
    const service = new ReadIntegrationService({
      enabled: true,
      store: new WorldEventStore(root()),
      client: {
        readInitial: async () => {
          reads += 1;
          return observation;
        },
        streamEvents: async (_onFrame, signal) =>
          await new Promise<void>((resolve) =>
            signal.addEventListener("abort", () => resolve(), { once: true }),
          ),
      },
      staleAfterMs: 1_000,
    });
    await service.start();
    await vi.advanceTimersByTimeAsync(3_200);
    expect(service.snapshot().status).toBe("ready");
    expect(reads).toBeGreaterThanOrEqual(4);
    await service.close();
    vi.useRealTimers();
  });

  it("rejects a stale frame after failed recovery and resumes ingestion after recovery", async () => {
    let now = Date.parse("2026-07-19T12:00:03.000Z");
    let mode: "ready" | "offline" = "ready";
    const service = new ReadIntegrationService({
      enabled: true,
      store: new WorldEventStore(root()),
      client: {
        readInitial: async () => {
          if (mode === "offline") throw new Error("offline");
          return observation;
        },
      },
      now: () => now,
      staleAfterMs: 1_000,
    });
    await service.reconcile("startup");
    const before = service.snapshot().replay.acceptedCount;
    now += 2_000;
    mode = "offline";
    await service.ingestSseFrames([
      {
        sequence: 1,
        events: [
          {
            type: "phase.updated",
            timestamp: "2026-07-19T12:00:04.000Z",
            phaseId: "phase_7",
          },
        ],
      },
    ]);
    expect(service.snapshot().status).toBe("offline");
    expect(service.snapshot().replay.acceptedCount).toBe(before);
    expect(service.snapshot().diagnostics.join(" ")).toMatch(
      /rejected.*stale|stale.*rejected/i,
    );
    mode = "ready";
    await service.ingestSseFrames([
      {
        sequence: 2,
        events: [
          {
            type: "worker.job.running",
            timestamp: "2026-07-19T12:00:05.000Z",
            phaseId: "phase_6",
            jobId: "job-2",
          },
        ],
      },
    ]);
    expect(service.snapshot().status).toBe("ready");
    expect(service.snapshot().replay.acceptedCount).toBeGreaterThan(before);
    await service.close();
  });

  it("removes reconnect abort listeners and close joins the stream loop", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    let attempts = 0;
    const service = new ReadIntegrationService({
      enabled: true,
      store: new WorldEventStore(root()),
      client: {
        readInitial: async () => observation,
        streamEvents: async (_onFrame, currentSignal) => {
          signal = currentSignal;
          attempts += 1;
          throw new Error("disconnect");
        },
      },
      staleAfterMs: 60_000,
    });
    await service.start();
    for (let index = 0; index < 12; index += 1)
      await vi.advanceTimersByTimeAsync(1_000);
    expect(attempts).toBeGreaterThan(10);
    expect(getEventListeners(signal!, "abort")).toHaveLength(0);
    await service.close();
    vi.useRealTimers();
  });

  it("preserves explicit stream contract diagnostics through reconnect recovery", async () => {
    const service = new ReadIntegrationService({
      enabled: true,
      store: new WorldEventStore(root()),
      client: {
        readInitial: async () => observation,
        streamEvents: async () => {
          throw new ContractReadError(
            "event stream frame exceeded the byte cap",
            "oversized",
          );
        },
      },
      staleAfterMs: 60_000,
    });
    await service.start();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(service.snapshot().diagnostics.join(" ")).toMatch(
      /SSE oversized: event stream frame exceeded the byte cap/,
    );
    await service.close();
  });
});
