import { describe, expect, it } from "vitest";

import {
  CodeExplanationSchema,
  FixtureManifestSchema,
  TOOL_EVENT_LIMITS,
  ToolEventReplay,
  ToolEventSchema,
  boundedDisplayArguments,
  type ToolEvent,
} from "../src/index.js";
import fixtureManifest from "../../../examples/phase14-magic-slice/fixture.manifest.json";

const ids = {
  operationId: "11111111-1111-4111-8111-111111111111",
  eventId: "22222222-2222-4222-8222-222222222222",
  correlationId: "33333333-3333-4333-8333-333333333333",
  parentId: "44444444-4444-4444-8444-444444444444",
};

function event(overrides: Partial<ToolEvent> = {}): ToolEvent {
  return {
    schema: "aiw.tool-event/0.14",
    ...ids,
    sequence: 1,
    operation: "read",
    state: "requested",
    occurredAt: "2026-07-22T12:00:00.000Z",
    expiresAt: "2026-07-22T12:15:00.000Z",
    worldSessionId: "55555555-5555-4555-8555-555555555555",
    adapterSessionRef: "fixture-session-phase14",
    rootSessionRef: "fixture-root-phase14",
    repository: {
      repositoryId: "aiw://object/repository-phase14-fixture",
      rootAttestation: "sha256:" + "a".repeat(64),
      fixtureRevision: "phase14-magic-slice/1",
    },
    provenance: {
      adapterId: "phase14-fixture",
      source: "world-owned",
      observedAt: "2026-07-22T12:00:00.000Z",
    },
    target: {
      path: "src/greeting.mjs",
      symbol: "greeting",
    },
    displayArguments: "greeting",
    evidence: { currentRef: null, previousRef: null },
    redaction: { applied: false, count: 0, truncated: false },
    digest: "b".repeat(64),
    ...overrides,
  };
}

describe("aiw.tool-event/0.14", () => {
  it("accepts the exact strict event and rejects unknown fields", () => {
    expect(ToolEventSchema.parse(event()).schema).toBe("aiw.tool-event/0.14");
    expect(() =>
      ToolEventSchema.parse({ ...event(), command: "rm -rf ." }),
    ).toThrow();
  });

  it("enforces UUIDs, lifecycle, expiry, event bytes, and displayed argument bytes", () => {
    expect(() =>
      ToolEventSchema.parse(event({ eventId: "not-a-uuid" })),
    ).toThrow();
    expect(() =>
      ToolEventSchema.parse(event({ expiresAt: "2026-07-22T12:15:00.001Z" })),
    ).toThrow(/15 minutes/i);
    expect(() =>
      ToolEventSchema.parse(event({ displayArguments: "x".repeat(4097) })),
    ).toThrow();
    expect(TOOL_EVENT_LIMITS.maximumEventBytes).toBe(32 * 1024);
  });

  it("bounds and redacts displayed arguments without creating command authority", () => {
    const result = boundedDisplayArguments(
      `token-secret-123456 /home/operator/private ${"x".repeat(5000)}`,
    );
    expect(result.text).not.toContain("secret-123456");
    expect(result.text).not.toContain("/home/operator/private");
    expect(
      new TextEncoder().encode(result.text).byteLength,
    ).toBeLessThanOrEqual(TOOL_EVENT_LIMITS.maximumDisplayArgumentBytes);
    expect(result.redaction).toEqual({
      applied: true,
      count: 2,
      truncated: true,
    });
  });

  it("orders replay deterministically and treats same-id/same-digest as idempotent", () => {
    const replay = new ToolEventReplay();
    expect(
      replay.accept(
        event({ sequence: 2, state: "running" }),
        Date.parse("2026-07-22T12:01:00Z"),
      ),
    ).toEqual({
      kind: "accepted",
    });
    expect(
      replay.accept(
        event({ sequence: 2, state: "running" }),
        Date.parse("2026-07-22T12:01:00Z"),
      ),
    ).toEqual({
      kind: "duplicate",
    });
    expect(
      replay.accept(
        event({ sequence: 1, eventId: "66666666-6666-4666-8666-666666666666" }),
        Date.parse("2026-07-22T12:01:00Z"),
      ),
    ).toEqual({
      kind: "accepted",
    });
    expect(replay.events().map(({ sequence }) => sequence)).toEqual([1, 2]);
  });

  it("reports a conflicting duplicate, expiry, and the 100-event replay ceiling", () => {
    const replay = new ToolEventReplay();
    expect(replay.accept(event(), Date.parse("2026-07-22T12:16:00Z"))).toEqual({
      kind: "expired",
    });
    expect(replay.accept(event(), Date.parse("2026-07-22T12:01:00Z"))).toEqual({
      kind: "accepted",
    });
    expect(
      replay.accept(
        event({ digest: "c".repeat(64) }),
        Date.parse("2026-07-22T12:01:00Z"),
      ),
    ).toEqual({ kind: "conflict", statusCode: 409 });

    const ceiling = new ToolEventReplay();
    for (let index = 0; index < 101; index += 1) {
      const hex = index.toString(16).padStart(12, "0");
      ceiling.accept(
        event({
          eventId: `77777777-7777-4777-8777-${hex}`,
          sequence: index,
          digest: index.toString(16).padStart(64, "0"),
        }),
        Date.parse("2026-07-22T12:01:00Z"),
      );
    }
    expect(ceiling.events()).toHaveLength(100);
    expect(ceiling.events()[0]?.sequence).toBe(1);
  });
});

describe("aiw.code-explanation/0.14", () => {
  const explanation = {
    schema: "aiw.code-explanation/0.14",
    explanationId: "88888888-8888-4888-8888-888888888888",
    operationId: ids.operationId,
    repositoryId: "aiw://object/repository-phase14-fixture",
    fixtureRevision: "phase14-magic-slice/1",
    fileEvidenceRef: "aiw://evidence/phase14-source-current",
    path: "src/greeting.mjs",
    symbol: "greeting",
    lineRange: { start: 1, end: 1 },
    sourceHash: "d".repeat(64),
    originatingEventId: ids.eventId,
    continuity: { state: "current", reason: null },
    claims: {
      sourceFacts: [{ label: "source-fact", text: "Exports greeting." }],
      runtimeObservations: [],
      testResults: [],
      interpretations: [
        { label: "interpretation", text: "The value is user-visible." },
      ],
    },
  } as const;

  it("binds exact source revision, evidence, symbol, line range, hash, and event", () => {
    expect(CodeExplanationSchema.parse(explanation).symbol).toBe("greeting");
    expect(() =>
      CodeExplanationSchema.parse({ ...explanation, symbol: "other" }),
    ).toThrow();
    expect(() =>
      CodeExplanationSchema.parse({ ...explanation, hiddenReasoning: [] }),
    ).toThrow();
  });

  it("caps each claim at 1 KiB and the serialized explanation at 16 KiB", () => {
    expect(() =>
      CodeExplanationSchema.parse({
        ...explanation,
        claims: {
          ...explanation.claims,
          sourceFacts: [{ label: "source-fact", text: "x".repeat(1025) }],
        },
      }),
    ).toThrow();
    expect(TOOL_EVENT_LIMITS.maximumExplanationBytes).toBe(16 * 1024);
  });
});

describe("aiw.phase14-fixture/1", () => {
  it("pins the exact strict World-owned fixture manifest", () => {
    expect(FixtureManifestSchema.parse(fixtureManifest).target.symbol).toBe(
      "greeting",
    );
    expect(() =>
      FixtureManifestSchema.parse({
        ...fixtureManifest,
        command: "node anything",
      }),
    ).toThrow();
  });
});
