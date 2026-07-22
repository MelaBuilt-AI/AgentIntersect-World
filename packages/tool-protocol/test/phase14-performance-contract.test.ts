import { describe, expect, it } from "vitest";

import {
  projectToolEvents,
  renderUnifiedDiffProjection,
  truncateProcessOutput,
  type ToolEvent,
} from "../src/index.js";

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
    evidence: {
      currentRef: `aiw://evidence/phase14-event-${sequence}`,
      previousRef: null,
    },
    redaction: { applied: false, count: 0, truncated: false },
    digest: sequence.toString(16).padStart(64, "0"),
  };
}

describe("Phase 14 deterministic performance projections", () => {
  it("projects at most 100 events in deterministic replay order", () => {
    const projection = projectToolEvents(
      Array.from({ length: 100 }, (_, index) => event(99 - index)),
    );
    expect(projection).toHaveLength(100);
    expect(projection[0]?.sequence).toBe(0);
    expect(projection.at(-1)?.sequence).toBe(99);
    expect(projection[0]).toEqual({
      eventId: "22222222-2222-4222-8222-000000000000",
      sequence: 0,
      operation: "read",
      state: "succeeded",
      evidenceRef: "aiw://evidence/phase14-event-0",
    });
  });

  it("renders a bounded semantic projection of the maximum 8 KiB diff", () => {
    const projection = renderUnifiedDiffProjection(
      `--- previous/src/greeting.mjs\n+++ current/src/greeting.mjs\n${"+x\n".repeat(2_000)}`,
    );
    expect(projection.byteLength).toBeLessThanOrEqual(8 * 1024);
    expect(projection.lines[0]).toEqual({
      kind: "header",
      text: "--- previous/src/greeting.mjs",
    });
    expect(projection.lines.at(-1)?.kind).toBe("addition");
  });

  it("truncates 128 KiB output to 64 KiB with visible truth", () => {
    const projection = truncateProcessOutput("x".repeat(128 * 1024));
    expect(projection.truncated).toBe(true);
    expect(projection.originalBytes).toBe(128 * 1024);
    expect(projection.retainedBytes).toBeLessThanOrEqual(64 * 1024);
    expect(projection.text).toContain("[output truncated]");
  });
});
