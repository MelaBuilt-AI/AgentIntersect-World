import { describe, expect, it } from "vitest";

import {
  canonicalProjection,
  normalizeObservation,
  projectEvents,
  stableEventOrder,
} from "../src/index.js";

const observedAt = "2026-07-19T12:00:02.000Z";
const event = {
  type: "worker.job.running",
  timestamp: "2026-07-19T12:00:01.000Z",
  phaseId: "phase_6",
  session_id: "session-1",
  jobId: "job-1",
  run_id: "run-1",
  worker: { id: "agent-1", harness: "codex", status: "running" },
};

describe("Phase 6 normalized event protocol", () => {
  it("reuses deterministic fallback event and animation IDs", () => {
    const first = normalizeObservation({
      source: "dashboard-feed",
      value: event,
      observedAt,
      sourceCoordinate: "feed:0",
    });
    const duplicate = normalizeObservation({
      source: "dashboard-sse",
      value: event,
      observedAt,
      sourceCoordinate: "feed:0",
      logicalSource: "dashboard-feed",
    });

    expect(duplicate.id).toBe(first.id);
    expect(duplicate.animationId).toBe(first.animationId);
    expect(duplicate).toEqual(first);
    expect(first.cursor.kind).toBe("canonical-fallback");
    expect(first.mapping).toEqual({
      phaseId: "phase_6",
      sessionId: "session-1",
      jobId: "job-1",
      runId: "run-1",
    });
  });

  it("canonicalizes feed/SSE arrival permutations byte-identically", () => {
    const feed = normalizeObservation({
      source: "dashboard-feed",
      value: event,
      observedAt: "2026-07-19T12:00:02.000Z",
      sourceCoordinate: "dashboard-feed",
    });
    const sse = normalizeObservation({
      source: "dashboard-sse",
      logicalSource: "dashboard-feed",
      value: event,
      observedAt: "2026-07-19T12:00:09.000Z",
      sourceCoordinate: "dashboard-feed",
    });

    expect(canonicalProjection(projectEvents([feed, sse]))).toBe(
      canonicalProjection(projectEvents([sse, feed])),
    );
  });

  it("keeps authoritative snapshot current against historical and future feed evidence", () => {
    const snapshot = normalizeObservation({
      source: "dashboard-snapshot",
      value: {
        type: "dashboard.snapshot.observed",
        currentPhase: { id: "phase_6", status: "running" },
      },
      observedAt,
      sourceCoordinate: "dashboard-snapshot",
    });
    const historical = normalizeObservation({
      source: "dashboard-feed",
      value: {
        type: "phase.updated",
        timestamp: "2020-01-01T00:00:00.000Z",
        phaseId: "phase_5",
      },
      observedAt,
      sourceCoordinate: "dashboard-feed",
    });
    const future = normalizeObservation({
      source: "dashboard-feed",
      value: {
        type: "phase.updated",
        timestamp: "2030-01-01T00:00:00.000Z",
        phaseId: "phase_7",
      },
      observedAt,
      sourceCoordinate: "dashboard-feed",
    });

    const projection = projectEvents([snapshot, historical, future], 200, [
      snapshot,
    ]);
    expect(projection.phaseBoard.current?.id).toBe("phase_6");
  });

  it("hashes complete overlong source IDs without collisions", () => {
    const prefix = "x".repeat(128);
    const first = normalizeObservation({
      source: "dashboard-feed",
      value: { ...event, id: `${prefix}a` },
      observedAt,
      sourceCoordinate: "dashboard-feed",
    });
    const second = normalizeObservation({
      source: "dashboard-feed",
      value: { ...event, id: `${prefix}b` },
      observedAt,
      sourceCoordinate: "dashboard-feed",
    });
    expect(first.cursor.value.length).toBeLessThanOrEqual(128);
    expect(second.cursor.value.length).toBeLessThanOrEqual(128);
    expect(second.id).not.toBe(first.id);
    expect(second.animationId).not.toBe(first.animationId);
  });

  it("orders cross-source observations independently of arrival order", () => {
    const later = normalizeObservation({
      source: "daemon-state",
      value: { type: "phase.updated", timestamp: "2026-07-19T12:00:03.000Z" },
      observedAt,
      sourceCoordinate: "state",
    });
    const earlier = normalizeObservation({
      source: "dashboard-snapshot",
      value: { type: "phase.updated", timestamp: "2026-07-19T12:00:00.000Z" },
      observedAt,
      sourceCoordinate: "snapshot",
    });
    expect(
      [later, earlier].sort(stableEventOrder).map((item) => item.id),
    ).toEqual([earlier.id, later.id]);
  });

  it("keeps timestamp-less snapshot IDs stable across observation time and restart", () => {
    const value = {
      type: "dashboard.snapshot.observed",
      currentPhase: { id: "phase_6", status: "running" },
    };
    const first = normalizeObservation({
      source: "dashboard-snapshot",
      value,
      observedAt: "2026-07-19T12:00:00.000Z",
      sourceCoordinate: "dashboard-snapshot",
    });
    const restarted = normalizeObservation({
      source: "dashboard-snapshot",
      value,
      observedAt: "2026-07-19T13:00:00.000Z",
      sourceCoordinate: "dashboard-snapshot",
    });
    expect(restarted.id).toBe(first.id);
    expect(restarted.animationId).toBe(first.animationId);
  });

  it("redacts secrets and absolute path forms and truncates hostile values", () => {
    const normalized = normalizeObservation({
      source: "dashboard-feed",
      value: {
        ...event,
        token: "secret-value",
        posix: "/home/operator/private.txt",
        windows: "C:\\Users\\operator\\private.txt",
        unc: "\\\\server\\share\\private.txt",
        uri: "file:///home/operator/private.txt",
        telemetry: "x".repeat(2_000),
        embedded:
          "failed at /home/operator/private.txt with Authorization: Bearer abc123",
        deep: { a: { b: { c: { d: { e: { f: { secret: "hidden" } } } } } } },
      },
      observedAt,
      sourceCoordinate: "hostile",
    });
    const text = JSON.stringify(normalized.payload);
    expect(text).not.toContain("secret-value");
    expect(text).not.toContain("/home/operator");
    expect(text).not.toContain("C:\\\\Users");
    expect(text).not.toContain("server\\\\share");
    expect(text).not.toContain("abc123");
    expect(text).toContain("[REDACTED]");
    expect(text.length).toBeLessThan(5_000);
  });

  it.each([
    ["posix", "failed at '/var/private/key'", "/var/private/key"],
    ["drive", "C:\\Users\\operator\\secret.txt", "operator\\\\secret.txt"],
    ["rooted", "\\Users\\operator\\secret.txt", "operator\\\\secret.txt"],
    ["unc", "\\\\server\\share name\\secret.txt", "server\\\\share name"],
    [
      "namespace",
      "\\\\?\\C:\\Users\\operator\\secret.txt",
      "operator\\\\secret.txt",
    ],
    [
      "device",
      "\\\\.\\C:\\Users\\operator\\secret.txt",
      "operator\\\\secret.txt",
    ],
    ["uri", "open file:///var/private/key file", "/var/private/key"],
    [
      "uri whitespace",
      "open file:///var/private/key%20name file",
      "key%20name",
    ],
    ["bearer", "authorization: Bearer bearer-secret", "bearer-secret"],
    ["basic", "authorization: Basic c2VjcmV0", "c2VjcmV0"],
    ["cookie", "cookie=session-secret", "session-secret"],
    ["credential", "credential=my-secret", "my-secret"],
    ["token", "token=my-token", "my-token"],
    ["password", "password=my-password", "my-password"],
    ["api key", "api_key=my-api-key", "my-api-key"],
  ])("redacts embedded %s markers", (_label, value, rawMarker) => {
    const normalized = normalizeObservation({
      source: "dashboard-feed",
      value: { ...event, message: value },
      observedAt,
      sourceCoordinate: "redaction-matrix",
    });
    expect(JSON.stringify(normalized)).not.toContain(rawMarker);
  });

  it("maps a bounded phase board, roster, and timeline projection", () => {
    const normalized = normalizeObservation({
      source: "dashboard-feed",
      value: event,
      observedAt,
      sourceCoordinate: "projection",
    });
    const projection = projectEvents([normalized, normalized]);
    expect(projection.timeline).toHaveLength(1);
    expect(projection.animationIds).toEqual([normalized.animationId]);
    expect(projection.phaseBoard.current?.id).toBe("phase_6");
    expect(projection.roster[0]).toMatchObject({
      id: "agent-1",
      harness: "codex",
    });
  });
});
