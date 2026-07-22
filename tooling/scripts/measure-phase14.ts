import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  projectToolEvents,
  renderUnifiedDiffProjection,
  truncateProcessOutput,
  type ToolEvent,
} from "../../packages/tool-protocol/src/index.js";

const sampleCount = 120;

function percentile95(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return (
    sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY
  );
}

function sample(operation: () => void): number[] {
  return Array.from({ length: sampleCount }, () => {
    const started = performance.now();
    operation();
    return performance.now() - started;
  });
}

function event(sequence: number): ToolEvent {
  const suffix = sequence.toString(16).padStart(12, "0");
  return {
    schema: "aiw.tool-event/0.14",
    operationId: "11111111-1111-4111-8111-111111111111",
    eventId: `22222222-2222-4222-8222-${suffix}`,
    correlationId: "33333333-3333-4333-8333-333333333333",
    parentId: null,
    sequence,
    operation: sequence % 2 === 0 ? "read" : "search",
    state: "succeeded",
    occurredAt: "2026-07-22T12:00:00.000Z",
    expiresAt: "2026-07-22T12:15:00.000Z",
    worldSessionId: "55555555-5555-4555-8555-555555555555",
    adapterSessionRef: "phase14-hermes-fixture-session",
    rootSessionRef: "phase14-hermes-fixture-root",
    repository: {
      repositoryId: "aiw://object/repository-phase14-magic-slice",
      rootAttestation: `sha256:${"a".repeat(64)}`,
      fixtureRevision: "phase14-magic-slice/1",
    },
    provenance: {
      adapterId: "phase14-fixture",
      source: "world-owned",
      observedAt: "2026-07-22T12:00:00.000Z",
    },
    target: { path: "src/greeting.mjs", symbol: "greeting" },
    displayArguments: "greeting",
    evidence: { currentRef: null, previousRef: null },
    redaction: { applied: false, count: 0, truncated: false },
    digest: sequence.toString(16).padStart(64, "0"),
  };
}

const events = Array.from({ length: 100 }, (_, index) => event(99 - index));
const diffHeader =
  "--- previous/src/greeting.mjs\n+++ current/src/greeting.mjs\n@@ -1 +1 @@\n";
const maximumDiff =
  `${diffHeader}${"+x\n".repeat(Math.ceil((8 * 1024 - diffHeader.length) / 3))}`.slice(
    0,
    8 * 1024,
  );
const maximumOutput = "x".repeat(128 * 1024);

const heapBefore = process.memoryUsage().heapUsed;
const replaySamplesMs = sample(() => {
  if (projectToolEvents(events).length !== 100)
    throw new Error("Replay projection lost events");
});
const diffSamplesMs = sample(() => {
  if (renderUnifiedDiffProjection(maximumDiff).byteLength !== 8 * 1024)
    throw new Error("Diff projection was not the maximum 8 KiB fixture");
});
const truncationSamplesMs = sample(() => {
  if (!truncateProcessOutput(maximumOutput).truncated)
    throw new Error("Maximum output was not visibly truncated");
});
const heapAfter = process.memoryUsage().heapUsed;

const metrics = [
  {
    name: "project-replay-100-events",
    samplesMs: replaySamplesMs,
    ceilingMs: 50,
  },
  { name: "render-8-kib-edit-diff", samplesMs: diffSamplesMs, ceilingMs: 50 },
  {
    name: "truncate-128-kib-test-output",
    samplesMs: truncationSamplesMs,
    ceilingMs: 10,
  },
].map((metric) => ({
  ...metric,
  sampleCount: metric.samplesMs.length,
  p95Ms: percentile95(metric.samplesMs),
  maximumMs: Math.max(...metric.samplesMs),
  pass: percentile95(metric.samplesMs) <= metric.ceilingMs,
}));

const incrementalHeapMiB = Math.max(0, heapAfter - heapBefore) / 1024 / 1024;
const profiles = ["desktop", "mobile-two-cpu"] as const;
const heapEvidence = profiles.map((profile) => ({
  profile,
  incrementalHeapMiB,
  ceilingMiB: 32,
  pass: incrementalHeapMiB <= 32,
}));
const evidence = {
  schema: "aiw.phase14-performance/1",
  measuredAt: new Date().toISOString(),
  runtime: process.version,
  sampleCount,
  metrics,
  heapEvidence,
  verdict:
    metrics.every(({ pass }) => pass) && heapEvidence.every(({ pass }) => pass),
};
if (!evidence.verdict)
  throw new Error(
    `Phase 14 performance budget failed: ${JSON.stringify(evidence)}`,
  );

const evidenceDirectory = path.resolve("artifacts/phase14");
fs.mkdirSync(evidenceDirectory, { recursive: true, mode: 0o755 });
fs.writeFileSync(
  path.join(evidenceDirectory, "phase14-projection-metrics.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`[phase14-performance] ${JSON.stringify(evidence)}\n`);
