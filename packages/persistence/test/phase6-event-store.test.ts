import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  normalizeObservation,
  canonicalProjection,
  type NormalizedEventEnvelope,
} from "@agentintersect-world/world-event-protocol";
import { afterEach, describe, expect, it } from "vitest";

import { WorldEventStore } from "../src/index.js";

const roots: string[] = [];
const makeRoot = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-phase6-store-"));
  roots.push(root);
  return root;
};
const event = (coordinate: string, timestamp: string) =>
  normalizeObservation({
    source: "dashboard-feed",
    value: {
      type: "worker.job.running",
      timestamp,
      phaseId: "phase_6",
      jobId: "job-1",
      worker: { id: "agent-1", harness: "codex", status: "running" },
    },
    observedAt: "2026-07-19T12:00:10.000Z",
    sourceCoordinate: coordinate,
  });

const snapshotEvent = (phaseId: string, observedAt: string) =>
  normalizeObservation({
    source: "dashboard-snapshot",
    value: {
      type: "dashboard.snapshot.observed",
      currentPhase: { id: phaseId, status: "running" },
    },
    observedAt,
    sourceCoordinate: "dashboard-snapshot",
  });

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

describe("Phase 6 SQLite dedupe and JSONL replay", () => {
  it("accepts a logical event once and replays byte-identically after restart", () => {
    const root = makeRoot();
    const first = new WorldEventStore(root);
    const earlier = event("earlier", "2026-07-19T12:00:01.000Z");
    const later = event("later", "2026-07-19T12:00:02.000Z");
    expect(first.accept(later)).toMatchObject({ accepted: true });
    expect(first.accept(earlier)).toMatchObject({ accepted: true });
    expect(first.accept(later)).toMatchObject({
      accepted: false,
      duplicate: true,
    });
    const before = canonicalProjection(first.snapshot().projection);
    expect(
      fs
        .readFileSync(path.join(root, "accepted-events.jsonl"), "utf8")
        .trim()
        .split("\n"),
    ).toHaveLength(2);
    first.close();

    const restarted = new WorldEventStore(root);
    expect(canonicalProjection(restarted.snapshot().projection)).toBe(before);
    expect(restarted.snapshot()).toMatchObject({
      acceptedCount: 2,
      replayed: true,
      degraded: false,
    });
    expect(restarted.snapshot().projection.animationIds).toEqual([
      earlier.animationId,
      later.animationId,
    ]);
    restarted.close();
  });

  it("fails closed on a partial corrupt tail while preserving the last verified projection", () => {
    const root = makeRoot();
    const initial = new WorldEventStore(root);
    const accepted = event("verified", "2026-07-19T12:00:01.000Z");
    initial.accept(accepted);
    initial.close();
    fs.appendFileSync(
      path.join(root, "accepted-events.jsonl"),
      '{"schema":"aiw.event/0.6"',
    );

    const recovered = new WorldEventStore(root);
    const snapshot = recovered.snapshot();
    expect(snapshot.degraded).toBe(true);
    expect(snapshot.diagnostic).toContain("corrupt ledger record 2");
    expect(snapshot.projection.timeline.map((item) => item.id)).toEqual([
      accepted.id,
    ]);
    expect(() =>
      recovered.accept(event("blocked", "2026-07-19T12:00:03.000Z")),
    ).toThrow(/fail-closed/);
    recovered.close();
  });

  it("persists latest A→B→A truth while reusing one A timeline/animation identity", () => {
    const root = makeRoot();
    const first = new WorldEventStore(root);
    const phaseA1 = snapshotEvent("phase_A", "2026-07-19T12:00:01.000Z");
    const phaseB = snapshotEvent("phase_B", "2026-07-19T12:00:02.000Z");
    const phaseA2 = snapshotEvent("phase_A", "2026-07-19T12:00:03.000Z");
    expect(phaseA2.id).toBe(phaseA1.id);
    expect(first.accept(phaseA1)).toMatchObject({ accepted: true });
    expect(first.accept(phaseB)).toMatchObject({ accepted: true });
    expect(first.accept(phaseA2)).toMatchObject({
      accepted: false,
      duplicate: true,
    });
    expect(first.snapshot().projection.phaseBoard.current?.id).toBe("phase_A");
    expect(first.snapshot().projection.timeline).toHaveLength(2);
    expect(
      first
        .snapshot()
        .projection.animationIds.filter((id) => id === phaseA1.animationId),
    ).toHaveLength(1);
    first.close();

    const restarted = new WorldEventStore(root);
    expect(restarted.snapshot().acceptedCount).toBe(2);
    expect(restarted.snapshot().projection.phaseBoard.current?.id).toBe(
      "phase_A",
    );
    expect(restarted.snapshot().projection.timeline).toHaveLength(2);
    restarted.close();
  });

  it.each<[string, (value: NormalizedEventEnvelope) => unknown, RegExp]>([
    [
      "tampered event ID",
      (value) => ({ ...value, id: "aiw:event:tampered" }),
      /canonical event ID/,
    ],
    [
      "invalid cursor kind",
      (value) => ({
        ...value,
        cursor: { ...value.cursor, kind: "invalid" },
      }),
      /cursor kind/,
    ],
    [
      "invalid date",
      (value) => ({ ...value, occurredAt: "not-a-date" }),
      /occurredAt/,
    ],
    [
      "invalid compatibility",
      (value) => ({
        ...value,
        compatibility: { contract: "other", supported: true },
      }),
      /compatibility/,
    ],
    [
      "unredacted payload",
      (value) => ({
        ...value,
        payload: { message: "authorization: Basic c2VjcmV0" },
      }),
      /sanitized payload/,
    ],
    [
      "oversized payload",
      (value) => ({ ...value, payload: { message: "x".repeat(2_000) } }),
      /sanitized payload|oversized/,
    ],
  ])("degrades precisely for %s", (_label, mutate, diagnostic) => {
    const root = makeRoot();
    const value = mutate(event("strict", "2026-07-19T12:00:01.000Z"));
    fs.writeFileSync(
      path.join(root, "accepted-events.jsonl"),
      `${JSON.stringify(value)}\n`,
    );
    const store = new WorldEventStore(root);
    expect(store.snapshot().degraded).toBe(true);
    expect(store.snapshot().diagnostic).toMatch(diagnostic);
    store.close();
  });

  it("treats duplicate animation IDs as corrupt replay", () => {
    const root = makeRoot();
    const first = event("first", "2026-07-19T12:00:01.000Z");
    const second = event("second", "2026-07-19T12:00:02.000Z");
    fs.writeFileSync(
      path.join(root, "accepted-events.jsonl"),
      `${JSON.stringify(first)}\n${JSON.stringify({ ...second, animationId: first.animationId })}\n`,
    );
    const store = new WorldEventStore(root);
    expect(store.snapshot()).toMatchObject({
      degraded: true,
      acceptedCount: 1,
    });
    expect(store.snapshot().diagnostic).toMatch(/animation/i);
    store.close();
  });

  it("preserves the validated SQLite checkpoint when the last committed row is truncated", () => {
    const root = makeRoot();
    const initial = new WorldEventStore(root);
    const first = event("first", "2026-07-19T12:00:01.000Z");
    const second = event("second", "2026-07-19T12:00:02.000Z");
    initial.accept(first);
    initial.accept(second);
    initial.close();
    const ledgerPath = path.join(root, "accepted-events.jsonl");
    const content = fs.readFileSync(ledgerPath, "utf8");
    fs.writeFileSync(
      ledgerPath,
      content.slice(0, content.lastIndexOf("\n", content.length - 2) + 20),
    );

    const recovered = new WorldEventStore(root);
    expect(recovered.snapshot()).toMatchObject({
      degraded: true,
      acceptedCount: 2,
      lastEventId: second.id,
    });
    expect(
      recovered.snapshot().projection.timeline.map((item) => item.id),
    ).toEqual([first.id, second.id]);
    recovered.close();
  });

  it("fails closed and restores committed state after an injected post-append failure", () => {
    const root = makeRoot();
    let fail = true;
    const store = new WorldEventStore(root, {
      afterLedgerAppend: () => {
        if (fail) throw new Error("injected post-append failure");
      },
    });
    const attempted = event("fault", "2026-07-19T12:00:01.000Z");
    expect(() => store.accept(attempted)).toThrow(
      /injected post-append failure/,
    );
    expect(store.snapshot()).toMatchObject({
      degraded: true,
      acceptedCount: 0,
    });
    fail = false;
    expect(() => store.accept(attempted)).toThrow(/fail-closed/);
    store.close();

    const restarted = new WorldEventStore(root);
    expect(restarted.snapshot().acceptedCount).toBe(0);
    expect(restarted.snapshot().projection.timeline).toEqual([]);
    restarted.close();
  });

  it("keeps redaction markers out of the JSONL ledger and replay projection", () => {
    const root = makeRoot();
    const store = new WorldEventStore(root);
    const hostile = normalizeObservation({
      source: "dashboard-feed",
      value: {
        type: "telemetry.observed",
        message:
          "'/var/private/key' authorization: Basic c2VjcmV0 cookie=session-secret credential=my-secret",
      },
      observedAt: "2026-07-19T12:00:01.000Z",
      sourceCoordinate: "hostile",
    });
    store.accept(hostile);
    const raw = fs.readFileSync(store.ledgerPath, "utf8");
    const apiJson = JSON.stringify(store.snapshot());
    for (const marker of [
      "/var/private/key",
      "c2VjcmV0",
      "session-secret",
      "my-secret",
    ]) {
      expect(raw).not.toContain(marker);
      expect(apiJson).not.toContain(marker);
    }
    store.close();
  });
});
