import { describe, expect, it } from "vitest";

import {
  WORLD_ACTION_LIMITS,
  WorldActionGate,
  WorldActionProposalSchema,
  assignWorldActionEnvelope,
} from "../src/index.js";

const target = {
  repositoryRef: "aiw://object/repository-a",
  objectRef: "aiw://object/package-a",
};

const binding = {
  sessionId: "00000000-0000-4000-8000-000000000001",
  adapterSessionRef: "hermes-session-1",
  repositoryRef: "aiw://object/repository-a",
  worldGeneration: "world-generation-a",
  layoutGeneration: "layout-generation-a",
  graphGeneration: "00000000-0000-4000-8000-000000000002",
  capabilitySnapshotHash: "a".repeat(64),
};

const ids = [
  "00000000-0000-4000-8000-000000000010",
  "00000000-0000-4000-8000-000000000011",
  "00000000-0000-4000-8000-000000000012",
  "00000000-0000-4000-8000-000000000013",
  "00000000-0000-4000-8000-000000000014",
  "00000000-0000-4000-8000-000000000015",
  "00000000-0000-4000-8000-000000000016",
  "00000000-0000-4000-8000-000000000017",
  "00000000-0000-4000-8000-000000000018",
  "00000000-0000-4000-8000-000000000019",
];

describe("aiw.world-action/0.13", () => {
  it("accepts every allowlisted strict intent and rejects authority metadata or unknown kinds", () => {
    const actions = [
      { kind: "navigate", target },
      { kind: "focus", target },
      { kind: "inspect", target },
      { kind: "highlight", target },
      { kind: "trace", target, destination: target },
      { kind: "compare", target, destination: target },
      { kind: "point-at", target },
      { kind: "follow", target },
      {
        kind: "annotate-temporary",
        target,
        text: "Model projection",
        ttlSeconds: 30,
      },
      {
        kind: "present-evidence",
        target,
        relationshipRefs: ["dependency:one"],
      },
      { kind: "clear", scope: "presentation" },
      { kind: "cancel", targetType: "batch", targetId: ids[0] },
      {
        kind: "move-agent",
        schema: "aiw.agent-movement/1",
        actorId: "agent-session-1",
        source: "agent-autonomous",
        speed: 4,
        target: { kind: "relative", direction: "forward", distance: 3 },
      },
    ];
    for (const action of actions) {
      expect(
        WorldActionProposalSchema.safeParse({ actions: [action] }).success,
      ).toBe(true);
    }
    expect(
      WorldActionProposalSchema.safeParse({
        actions: [{ kind: "navigate", target, actionId: ids[0] }],
      }).success,
    ).toBe(false);
    expect(
      WorldActionProposalSchema.safeParse({
        actions: [{ kind: "run-command", target }],
      }).success,
    ).toBe(false);
  });

  it("validates bounded browser-safe agent movement targets and rejects transform authority", () => {
    const validTargets = [
      { kind: "coordinate", x: 2, z: -3, stoppingRadius: 0.5 },
      { kind: "relative", direction: "right", distance: 4 },
      { kind: "follow-user", stoppingRadius: 1.5 },
      {
        kind: "repository-object",
        objectId: "aiw://object/file-1",
        layoutGeneration: "layout-generation-a",
        stoppingRadius: 1,
      },
    ];
    for (const movementTarget of validTargets)
      expect(
        WorldActionProposalSchema.safeParse({
          actions: [
            {
              kind: "move-agent",
              schema: "aiw.agent-movement/1",
              actorId: "agent-session-1",
              source: "user-directed",
              speed: 4,
              target: movementTarget,
            },
          ],
        }).success,
      ).toBe(true);
    for (const invalid of [
      { kind: "coordinate", x: Number.NaN, z: 0 },
      { kind: "relative", direction: "forward", distance: 101 },
      { kind: "follow-user", stoppingRadius: 0 },
      { kind: "repository-object", objectId: "mesh-4", layoutGeneration: "x" },
    ])
      expect(
        WorldActionProposalSchema.safeParse({
          actions: [
            {
              kind: "move-agent",
              schema: "aiw.agent-movement/1",
              actorId: "agent-session-1",
              source: "agent-autonomous",
              speed: 4,
              target: invalid,
              rendererTransform: [1, 2, 3],
            },
          ],
        }).success,
      ).toBe(false);
  });

  it("enforces 1-8 actions, UTF-8 size, and adapter-owned identity/TTL", () => {
    expect(WorldActionProposalSchema.safeParse({ actions: [] }).success).toBe(
      false,
    );
    expect(
      WorldActionProposalSchema.safeParse({
        actions: Array.from({ length: 9 }, () => ({ kind: "focus", target })),
      }).success,
    ).toBe(false);
    expect(
      WorldActionProposalSchema.safeParse({
        actions: [
          {
            kind: "annotate-temporary",
            target,
            text: "x".repeat(17_000),
            ttlSeconds: 30,
          },
        ],
      }).success,
    ).toBe(false);

    let next = 0;
    const envelope = assignWorldActionEnvelope(
      {
        actions: [
          { kind: "navigate", target },
          { kind: "focus", target },
        ],
      },
      binding,
      {
        sequence: 1,
        now: new Date("2026-07-21T12:00:00.000Z"),
        requestId: ids[9],
        id: () => ids[next++]!,
      },
    );
    expect(envelope.schema).toBe("aiw.world-action/0.13");
    expect(envelope.requestId).toBe(ids[9]);
    expect(envelope.batchId).toBe(ids[0]);
    expect(envelope.actions.map((action) => action.actionId)).toEqual([
      ids[1],
      ids[2],
    ]);
    expect(
      Date.parse(envelope.expiresAt) - Date.parse(envelope.createdAt),
    ).toBe(WORLD_ACTION_LIMITS.defaultTtlMs);
  });

  it("fails closed for binding, expiry, sequence, dedupe, queue, and token-bucket bounds", () => {
    const make = (sequence: number, nowMs: number, count = 1) => {
      let cursor = 0;
      return assignWorldActionEnvelope(
        {
          actions: Array.from({ length: count }, () => ({
            kind: "focus" as const,
            target,
          })),
        },
        binding,
        {
          sequence,
          now: new Date(nowMs),
          id: () =>
            `00000000-0000-4000-8000-${String(sequence * 100 + cursor++).padStart(12, "0")}`,
        },
      );
    };
    const start = Date.parse("2026-07-21T12:00:00.000Z");
    const gate = new WorldActionGate(binding, { now: () => start });
    const first = make(1, start, 8);
    expect(gate.accept(first)).toMatchObject({
      accepted: true,
      queuedActions: 8,
    });
    expect(gate.accept(first)).toMatchObject({
      accepted: false,
      reason: "duplicate",
    });
    expect(gate.accept(make(3, start))).toMatchObject({
      accepted: false,
      reason: "sequence-gap",
    });
    expect(
      gate.accept(make(2, start - WORLD_ACTION_LIMITS.maximumTtlMs - 1)),
    ).toMatchObject({
      accepted: false,
      reason: "expired",
    });
    expect(gate.accept(make(2, start))).toMatchObject({
      accepted: false,
      reason: "rate-limited",
    });

    const wrong = {
      ...make(2, start + 1_000),
      adapterSessionRef: "other-session",
    };
    expect(gate.accept(wrong)).toMatchObject({
      accepted: false,
      reason: "binding-mismatch",
    });
  });

  it("supports exact idempotent cancellation and supersedes active/queued work", () => {
    const start = Date.parse("2026-07-21T12:00:00.000Z");
    let cursor = 0;
    const make = (sequence: number, kinds: Array<"navigate" | "focus">) =>
      assignWorldActionEnvelope(
        { actions: kinds.map((kind) => ({ kind, target })) },
        binding,
        {
          sequence,
          now: new Date(start + sequence * 1_000),
          id: () => ids[cursor++]!,
        },
      );
    const gate = new WorldActionGate(binding, { now: () => start + 10_000 });
    const first = make(1, ["navigate", "focus"]);
    expect(gate.accept(first).accepted).toBe(true);
    expect(gate.startNext()?.actionId).toBe(first.actions[0]?.actionId);
    expect(gate.cancel("action", first.actions[0]!.actionId)).toEqual({
      cancelled: true,
      idempotent: false,
    });
    expect(gate.cancel("action", first.actions[0]!.actionId)).toEqual({
      cancelled: true,
      idempotent: true,
    });
    const second = make(2, ["navigate"]);
    expect(gate.accept(second)).toMatchObject({
      accepted: true,
      superseded: expect.any(Array),
    });
  });
});
