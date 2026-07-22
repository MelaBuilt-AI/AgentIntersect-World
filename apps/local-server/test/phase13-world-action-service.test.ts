import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildNavigationMesh } from "@agentintersect-world/navigation";

import { WorldActionService } from "../src/world-actions.js";

const roots: string[] = [];
const temporary = () => {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-phase13-actions-"));
  roots.push(value);
  return value;
};
afterEach(() => {
  for (const value of roots.splice(0)) fs.rmSync(value, { recursive: true });
});

const sessionId = "00000000-0000-4000-8000-000000000001";
const repositoryRef = "aiw://object/repository-a";
const sourceRef = "aiw://object/package-spatial-code-graph";
const destinationRef = "aiw://object/package-renderer-r3f";
const context = {
  binding: {
    sessionId,
    adapterSessionRef: "native-session-a",
    repositoryRef,
    worldGeneration: "world-a",
    layoutGeneration: "layout-a",
    graphGeneration: "00000000-0000-4000-8000-000000000099",
    capabilitySnapshotHash: "a".repeat(64),
  },
  worldActionsEnabled: true,
  targets: [
    {
      objectRef: sourceRef,
      repositoryRef,
      state: "current" as const,
      path: "packages/spatial-code-graph",
    },
    {
      objectRef: destinationRef,
      repositoryRef,
      state: "current" as const,
      path: "packages/renderer-r3f",
    },
  ],
  navigationMesh: buildNavigationMesh({
    worldGeneration: "world-a",
    layoutGeneration: "layout-a",
    navigationBounds: { x: 0, z: 0, width: 20, depth: 10 },
    avatarRadius: 0.35,
    clearance: 0.15,
    obstacles: [],
  }),
  positions: new Map([
    [sourceRef, { x: 2, z: 5, interactionRadius: 0.75 }],
    [destinationRef, { x: 18, z: 5, interactionRadius: 0.75 }],
  ]),
  relationships: [
    {
      ref: "relationship-spatial-renderer",
      sourceRef,
      targetRef: destinationRef,
      confidence: "exact_workspace_package",
      evidenceRef: "graph-edge-spatial-renderer",
    },
    {
      ref: "relationship-candidate",
      sourceRef,
      targetRef: destinationRef,
      confidence: "ambiguous",
      evidenceRef: "graph-edge-candidate",
    },
  ],
};

describe("durable World Action service", () => {
  const importedProposal = {
    ttlMs: 30_000,
    actions: [
      {
        kind: "focus" as const,
        target: { repositoryRef, objectRef: sourceRef },
      },
    ],
  };

  it("keeps helper ordering private while assigning World-owned envelope authority", async () => {
    const service = new WorldActionService(temporary(), {
      now: () => Date.parse("2026-07-21T12:00:20.000Z"),
    });
    const accepted = await service.propose(
      sessionId,
      importedProposal,
      context,
      {
        requestId: "10000000-0000-4000-8000-000000000001",
        sequence: 1,
        createdAt: "2026-07-21T12:00:00.000Z",
      },
    );

    expect(accepted.accepted).toBe(true);
    if (!accepted.accepted) return;
    expect(accepted.envelope).toMatchObject({
      sequence: 1,
      createdAt: "2026-07-21T12:00:20.000Z",
      expiresAt: "2026-07-21T12:00:50.000Z",
    });
    expect(accepted.envelope.requestId).not.toBe(
      "10000000-0000-4000-8000-000000000001",
    );

    const ordinary = await service.propose(
      sessionId,
      importedProposal,
      context,
    );
    expect(ordinary.accepted).toBe(true);
    if (!ordinary.accepted) return;
    expect(ordinary.envelope).toMatchObject({
      sequence: 2,
      createdAt: "2026-07-21T12:00:20.000Z",
      expiresAt: "2026-07-21T12:00:50.000Z",
    });
    expect(ordinary.envelope.requestId).not.toBe(accepted.envelope.requestId);
  });

  it("accepts at most one concurrent import with the same helper request identity", async () => {
    const service = new WorldActionService(temporary(), {
      now: () => Date.parse("2026-07-21T12:00:10.000Z"),
    });
    const source = {
      requestId: "10000000-0000-4000-8000-000000000002",
      sequence: 1,
      createdAt: "2026-07-21T12:00:00.000Z",
    };
    const results = await Promise.all([
      service.propose(sessionId, importedProposal, context, source),
      service.propose(sessionId, importedProposal, context, source),
    ]);

    expect(results.filter(({ accepted }) => accepted)).toHaveLength(1);
    expect(results).toContainEqual({ accepted: false, reason: "duplicate" });
    expect(service.timeline(sessionId)).toHaveLength(1);
  });

  it("rejects replayed helper identity from persistence after restart", async () => {
    const directory = temporary();
    const source = {
      requestId: "10000000-0000-4000-8000-000000000003",
      sequence: 1,
      createdAt: "2026-07-21T12:00:00.000Z",
    };
    const options = { now: () => Date.parse("2026-07-21T12:00:10.000Z") };
    const service = new WorldActionService(directory, options);
    await expect(
      service.propose(sessionId, importedProposal, context, source),
    ).resolves.toMatchObject({ accepted: true });

    const recovered = new WorldActionService(directory, options);
    await expect(
      recovered.propose(sessionId, importedProposal, context, source),
    ).resolves.toEqual({ accepted: false, reason: "duplicate" });
    expect(recovered.timeline(sessionId)).toHaveLength(1);
  });

  it("recovers the persisted next sequence and rejects a helper gap", async () => {
    const directory = temporary();
    const options = { now: () => Date.parse("2026-07-21T12:00:10.000Z") };
    const service = new WorldActionService(directory, options);
    await service.propose(sessionId, importedProposal, context, {
      requestId: "10000000-0000-4000-8000-000000000004",
      sequence: 1,
      createdAt: "2026-07-21T12:00:00.000Z",
    });

    const recovered = new WorldActionService(directory, options);
    await expect(
      recovered.propose(sessionId, importedProposal, context, {
        requestId: "10000000-0000-4000-8000-000000000005",
        sequence: 3,
        createdAt: "2026-07-21T12:00:01.000Z",
      }),
    ).resolves.toEqual({ accepted: false, reason: "sequence-gap" });
  });

  it("retains independent source cursors beyond proposal dedupe expiry and restart", async () => {
    const directory = temporary();
    let now = Date.parse("2026-07-21T12:00:00.000Z");
    const options = { now: () => now };
    const sourceA = "d".repeat(64);
    const sourceB = "e".repeat(64);
    let service = new WorldActionService(directory, options);

    await expect(
      service.propose(sessionId, importedProposal, context, {
        requestId: "11000000-0000-4000-8000-000000000001",
        sourceStreamId: sourceA,
        sequence: 1,
        createdAt: new Date(now).toISOString(),
      }),
    ).resolves.toMatchObject({ accepted: true });

    now += 10 * 60_000 + 1;
    service = new WorldActionService(directory, options);
    await expect(
      service.propose(sessionId, importedProposal, context, {
        requestId: "11000000-0000-4000-8000-000000000002",
        sourceStreamId: sourceA,
        sequence: 2,
        createdAt: new Date(now).toISOString(),
      }),
    ).resolves.toMatchObject({ accepted: true });

    const recovered = new WorldActionService(directory, options);
    await expect(
      recovered.propose(sessionId, importedProposal, context, {
        requestId: "11000000-0000-4000-8000-000000000003",
        sourceStreamId: sourceA,
        sequence: 4,
        createdAt: new Date(now).toISOString(),
      }),
    ).resolves.toEqual({ accepted: false, reason: "sequence-gap" });
    await expect(
      recovered.propose(sessionId, importedProposal, context, {
        requestId: "11000000-0000-4000-8000-000000000002",
        sourceStreamId: sourceA,
        sequence: 2,
        createdAt: new Date(now).toISOString(),
      }),
    ).resolves.toEqual({ accepted: false, reason: "duplicate" });
    await expect(
      recovered.propose(sessionId, importedProposal, context, {
        requestId: "11000000-0000-4000-8000-000000000004",
        sourceStreamId: sourceB,
        sequence: 1,
        createdAt: new Date(now).toISOString(),
      }),
    ).resolves.toMatchObject({ accepted: true });
  });

  it("atomically accepts the real two-package tour and exposes independent state truth", async () => {
    const service = new WorldActionService(temporary(), {
      now: () => Date.parse("2026-07-21T12:00:00.000Z"),
    });
    const accepted = await service.propose(
      sessionId,
      {
        actions: [
          { kind: "focus", target: { repositoryRef, objectRef: sourceRef } },
          {
            kind: "present-evidence",
            target: { repositoryRef, objectRef: sourceRef },
            relationshipRefs: ["exact-workspace-package:spatial-to-renderer"],
          },
          {
            kind: "navigate",
            target: { repositoryRef, objectRef: destinationRef },
          },
          {
            kind: "inspect",
            target: { repositoryRef, objectRef: destinationRef },
          },
        ],
      },
      context,
    );
    expect(accepted.accepted).toBe(true);
    if (!accepted.accepted) return;
    expect(accepted.envelope.actions).toHaveLength(4);
    expect(accepted.outcomes.map(({ state }) => state)).toEqual([
      "attention",
      "attention",
      "path-planned",
      "attention",
    ]);
    expect(accepted.outcomes[2]).toMatchObject({
      arrived: false,
      requestedTarget: destinationRef,
    });
    expect(service.timeline(sessionId)).toHaveLength(4);
    const traced = await service.propose(
      sessionId,
      {
        actions: [
          {
            kind: "trace",
            target: { repositoryRef, objectRef: sourceRef },
            destination: { repositoryRef, objectRef: destinationRef },
          },
        ],
      },
      context,
    );
    expect(traced.accepted).toBe(true);
    if (traced.accepted)
      expect(traced.outcomes[0]).toMatchObject({
        trace: {
          graphGeneration: context.binding.graphGeneration,
          edges: [
            expect.objectContaining({ status: "confirmed" }),
            expect.objectContaining({ status: "candidate" }),
          ],
        },
      });
  });

  it("rejects the entire batch before movement and degrades truthfully without capability", async () => {
    const service = new WorldActionService(temporary());
    const invalid = await service.propose(
      sessionId,
      {
        actions: [
          { kind: "focus", target: { repositoryRef, objectRef: sourceRef } },
          {
            kind: "navigate",
            target: { repositoryRef, objectRef: "aiw://object/missing" },
          },
        ],
      },
      context,
    );
    expect(invalid).toMatchObject({ accepted: false, reason: "unresolved" });
    expect(service.timeline(sessionId)).toEqual([]);
    await expect(
      service.propose(
        sessionId,
        {
          actions: [
            { kind: "focus", target: { repositoryRef, objectRef: sourceRef } },
          ],
        },
        { ...context, worldActionsEnabled: false },
      ),
    ).resolves.toMatchObject({
      accepted: false,
      reason: "capability-unavailable",
    });
  });

  it("interrupts immediately, recovers active work as previous, and requires revalidated replay", async () => {
    const directory = temporary();
    let id = 1;
    const service = new WorldActionService(directory, {
      now: () => Date.parse("2026-07-21T12:00:00.000Z"),
      id: () => `00000000-0000-4000-8000-${String(id++).padStart(12, "0")}`,
    });
    const accepted = await service.propose(
      sessionId,
      {
        actions: [
          {
            kind: "navigate",
            target: { repositoryRef, objectRef: destinationRef },
          },
        ],
      },
      context,
    );
    if (!accepted.accepted) throw new Error("fixture proposal rejected");
    const actionId = accepted.envelope.actions[0]!.actionId;
    service.transition(sessionId, actionId, "moving", context);
    service.interrupt(sessionId, "operator-movement");
    expect(service.timeline(sessionId)[0]).toMatchObject({
      state: "interrupted",
      arrived: false,
    });

    const second = await service.propose(
      sessionId,
      {
        actions: [
          {
            kind: "navigate",
            target: { repositoryRef, objectRef: destinationRef },
          },
        ],
      },
      context,
    );
    if (!second.accepted) throw new Error("fixture proposal rejected");
    service.transition(
      sessionId,
      second.envelope.actions[0]!.actionId,
      "moving",
      context,
    );
    const recovered = new WorldActionService(directory, {
      now: () => Date.parse("2026-07-21T12:01:00.000Z"),
      id: () => `10000000-0000-4000-8000-${String(id++).padStart(12, "0")}`,
    });
    expect(recovered.timeline(sessionId)[0]).toMatchObject({
      state: "interrupted",
      continuity: "previous-recovered",
      reason: "restart-recovery",
    });
    const replayed = await recovered.replay(
      sessionId,
      second.envelope.actions[0]!.actionId,
      context,
    );
    expect(replayed.accepted).toBe(true);
    if (replayed.accepted)
      expect(replayed.envelope.actions[0]!.actionId).not.toBe(
        second.envelope.actions[0]!.actionId,
      );
  });

  it("rejects stale arrival after cancellation or supersession", async () => {
    const service = new WorldActionService(temporary());
    const first = await service.propose(
      sessionId,
      {
        actions: [
          {
            kind: "navigate",
            target: { repositoryRef, objectRef: destinationRef },
          },
        ],
      },
      context,
    );
    if (!first.accepted) throw new Error("fixture proposal rejected");
    const firstActionId = first.envelope.actions[0]!.actionId;
    service.transition(sessionId, firstActionId, "moving", context);
    expect(service.cancel(sessionId, firstActionId)).toMatchObject({
      cancelled: true,
    });
    expect(() =>
      service.transition(sessionId, firstActionId, "arrived", {
        ...context,
        actorPosition: { x: 18, z: 5 },
      }),
    ).toThrow("Arrival requires active movement");
    expect(service.timeline(sessionId)[0]).toMatchObject({
      state: "cancelled",
      arrived: false,
    });

    const second = await service.propose(
      sessionId,
      {
        actions: [
          {
            kind: "navigate",
            target: { repositoryRef, objectRef: destinationRef },
          },
        ],
      },
      context,
    );
    if (!second.accepted) throw new Error("fixture proposal rejected");
    const secondActionId = second.envelope.actions[0]!.actionId;
    service.transition(sessionId, secondActionId, "moving", context);
    const third = await service.propose(
      sessionId,
      {
        actions: [
          { kind: "focus", target: { repositoryRef, objectRef: sourceRef } },
        ],
      },
      context,
    );
    expect(third.accepted).toBe(true);
    expect(() =>
      service.transition(sessionId, secondActionId, "arrived", {
        ...context,
        actorPosition: { x: 18, z: 5 },
      }),
    ).toThrow("Arrival requires active movement");
    expect(
      service
        .timeline(sessionId)
        .find(({ actionId }) => actionId === secondActionId),
    ).toMatchObject({ state: "superseded", arrived: false });
  });

  it("does not mutate repository content while presenting actions", async () => {
    const repository = temporary();
    const sentinel = path.join(repository, "sentinel.txt");
    fs.writeFileSync(sentinel, "unchanged\n");
    const before = fs.statSync(sentinel);
    const service = new WorldActionService(path.join(temporary(), "state"));
    await service.propose(
      sessionId,
      {
        actions: [
          {
            kind: "highlight",
            target: { repositoryRef, objectRef: sourceRef },
          },
        ],
      },
      context,
    );
    expect(fs.readFileSync(sentinel, "utf8")).toBe("unchanged\n");
    expect(fs.statSync(sentinel).mtimeMs).toBe(before.mtimeMs);
  });

  it("applies a structured cancel intent to the exact action instead of promoting prose", async () => {
    const service = new WorldActionService(temporary());
    const active = await service.propose(
      sessionId,
      {
        actions: [
          {
            kind: "navigate",
            target: { repositoryRef, objectRef: destinationRef },
          },
          { kind: "focus", target: { repositoryRef, objectRef: sourceRef } },
        ],
      },
      context,
    );
    if (!active.accepted) throw new Error("fixture proposal rejected");
    const cancelledId = active.envelope.actions[0]!.actionId;
    const retainedId = active.envelope.actions[1]!.actionId;
    const cancellation = await service.propose(
      sessionId,
      {
        actions: [
          { kind: "cancel", targetType: "action", targetId: cancelledId },
        ],
      },
      context,
    );
    expect(cancellation.accepted).toBe(true);
    expect(service.timeline(sessionId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionId: cancelledId, state: "cancelled" }),
        expect.objectContaining({ actionId: retainedId, state: "superseded" }),
      ]),
    );
    const cleared = await service.propose(
      sessionId,
      { actions: [{ kind: "clear", scope: "timeline-unpinned" }] },
      context,
    );
    expect(cleared.accepted).toBe(true);
    expect(service.timeline(sessionId)).toHaveLength(1);
    expect(service.timeline(sessionId)[0]).toMatchObject({
      kind: "clear",
      state: "attention",
    });
  });

  it("keeps rename truth aligned after targetless actions and cancels a batch when its target invalidates", async () => {
    const service = new WorldActionService(temporary(), {
      now: () => Date.parse("2026-07-21T12:00:00.000Z"),
    });
    const renamedContext = {
      ...context,
      targets: context.targets.map((record) =>
        record.objectRef === destinationRef
          ? {
              ...record,
              previousPaths: ["packages/renderer-three"],
              continuity: "authoritative" as const,
            }
          : record,
      ),
    };
    const accepted = await service.propose(
      sessionId,
      {
        actions: [
          { kind: "clear", scope: "presentation" },
          {
            kind: "navigate",
            target: {
              repositoryRef,
              objectRef: destinationRef,
              requestedPath: "packages/renderer-three",
            },
          },
        ],
      },
      renamedContext,
    );
    expect(accepted.accepted).toBe(true);
    if (!accepted.accepted) return;
    expect(accepted.outcomes[1]).toMatchObject({
      requestedPath: "packages/renderer-three",
      currentPath: "packages/renderer-r3f",
    });
    service.transition(
      sessionId,
      accepted.envelope.actions[1]!.actionId,
      "moving",
      { ...renamedContext, targets: [] },
    );
    expect(service.timeline(sessionId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: accepted.envelope.actions[1]!.actionId,
          state: "interrupted",
          reason: "invalid-target",
        }),
      ]),
    );
  });

  it("maps independent helper streams onto one durable World envelope sequence across authoritative rollovers", async () => {
    const directory = temporary();
    const options = { now: () => Date.parse("2026-07-21T12:00:10.000Z") };
    const service = new WorldActionService(directory, options);
    const sourceA = "a".repeat(64);
    const sourceB = "b".repeat(64);

    const first = await service.propose(sessionId, importedProposal, context, {
      requestId: "20000000-0000-4000-8000-000000000001",
      sourceStreamId: sourceA,
      sequence: 1,
      createdAt: "2026-07-21T12:00:00.000Z",
    });
    expect(first).toMatchObject({ accepted: true, envelope: { sequence: 1 } });

    const compressedContext = {
      ...context,
      binding: { ...context.binding, adapterSessionRef: "native-session-b" },
    };
    const second = await service.propose(
      sessionId,
      importedProposal,
      compressedContext,
      {
        requestId: "20000000-0000-4000-8000-000000000002",
        sourceStreamId: sourceB,
        sequence: 1,
        createdAt: "2026-07-21T12:00:01.000Z",
      },
    );
    expect(second).toMatchObject({ accepted: true, envelope: { sequence: 2 } });

    const generatedContext = {
      ...compressedContext,
      binding: {
        ...compressedContext.binding,
        worldGeneration: "world-b",
        layoutGeneration: "layout-b",
        graphGeneration: "00000000-0000-4000-8000-000000000100",
      },
    };
    const third = await service.propose(
      sessionId,
      importedProposal,
      generatedContext,
      {
        requestId: "20000000-0000-4000-8000-000000000003",
        sourceStreamId: sourceB,
        sequence: 2,
        createdAt: "2026-07-21T12:00:02.000Z",
      },
    );
    expect(third).toMatchObject({ accepted: true, envelope: { sequence: 3 } });

    const recovered = new WorldActionService(directory, options);
    await expect(
      recovered.propose(sessionId, importedProposal, generatedContext, {
        requestId: "20000000-0000-4000-8000-000000000004",
        sourceStreamId: sourceB,
        sequence: 4,
        createdAt: "2026-07-21T12:00:03.000Z",
      }),
    ).resolves.toEqual({ accepted: false, reason: "sequence-gap" });
    await expect(
      recovered.propose(sessionId, importedProposal, generatedContext, {
        requestId: "20000000-0000-4000-8000-000000000003",
        sourceStreamId: sourceB,
        sequence: 2,
        createdAt: "2026-07-21T12:00:02.000Z",
      }),
    ).resolves.toEqual({ accepted: false, reason: "duplicate" });
  });

  it("serializes concurrent distinct helper proposals without sharing a World envelope sequence", async () => {
    const service = new WorldActionService(temporary(), {
      now: () => Date.parse("2026-07-21T12:00:10.000Z"),
    });
    const sourceStreamId = "c".repeat(64);
    const [first, second] = await Promise.all([
      service.propose(sessionId, importedProposal, context, {
        requestId: "30000000-0000-4000-8000-000000000001",
        sourceStreamId,
        sequence: 1,
        createdAt: "2026-07-21T12:00:00.000Z",
      }),
      service.propose(sessionId, importedProposal, context, {
        requestId: "30000000-0000-4000-8000-000000000002",
        sourceStreamId,
        sequence: 2,
        createdAt: "2026-07-21T12:00:01.000Z",
      }),
    ]);

    expect(first).toMatchObject({ accepted: true, envelope: { sequence: 1 } });
    expect(second).toMatchObject({ accepted: true, envelope: { sequence: 2 } });
    expect(service.timeline(sessionId)).toHaveLength(2);
  });

  it("interrupts abandoned durable movement when its bounded server lease expires", async () => {
    let now = Date.parse("2026-07-21T12:00:00.000Z");
    const service = new WorldActionService(temporary(), { now: () => now });
    const accepted = await service.propose(
      sessionId,
      {
        actions: [
          {
            kind: "navigate",
            target: { repositoryRef, objectRef: destinationRef },
          },
        ],
      },
      context,
    );
    if (!accepted.accepted) throw new Error("fixture proposal rejected");
    service.transition(
      sessionId,
      accepted.envelope.actions[0]!.actionId,
      "moving",
      context,
    );

    now += 30_001;

    expect(service.timeline(sessionId)[0]).toMatchObject({
      state: "interrupted",
      arrived: false,
      reason: "movement-lease-expired",
    });
  });
});
