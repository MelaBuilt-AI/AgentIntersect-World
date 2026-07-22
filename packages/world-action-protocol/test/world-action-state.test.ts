import { describe, expect, it } from "vitest";

import {
  BoundedActionTimeline,
  WorldActionStateMachine,
  toWorldActionPresentationProjection,
  validateTraceEvidence,
} from "../src/index.js";

const requestedTarget = {
  repositoryRef: "aiw://object/repository-a",
  objectRef: "aiw://object/package-a",
  requestedPath: "packages/old-name",
};

describe("World Action state truth", () => {
  it("keeps attention, planning, movement, arrival, interruption, and supersession distinct", () => {
    const state = new WorldActionStateMachine(
      "00000000-0000-4000-8000-000000000001",
      requestedTarget,
    );
    expect(state.snapshot).toMatchObject({
      state: "requested",
      arrived: false,
      attention: false,
    });
    state.attend();
    expect(state.snapshot).toMatchObject({
      state: "attention",
      arrived: false,
      attention: true,
    });
    state.pathPlanned("nav-fixture");
    state.moving();
    expect(state.snapshot).toMatchObject({ state: "moving", arrived: false });
    expect(() => state.arrive(false)).toThrow(/interaction zone/i);
    state.arrive(true);
    expect(state.snapshot).toMatchObject({ state: "arrived", arrived: true });

    const interrupted = new WorldActionStateMachine(
      "00000000-0000-4000-8000-000000000002",
      requestedTarget,
    );
    interrupted.attend();
    interrupted.interrupt("operator-movement");
    expect(interrupted.snapshot).toMatchObject({
      state: "interrupted",
      arrived: false,
    });
    expect(() => interrupted.moving()).toThrow(/terminal/i);

    const superseded = new WorldActionStateMachine(
      "00000000-0000-4000-8000-000000000003",
      requestedTarget,
    );
    superseded.supersede();
    expect(superseded.snapshot.state).toBe("superseded");
  });

  it("marks blocked and recovered work truthfully without automatic restart resume", () => {
    const state = new WorldActionStateMachine(
      "00000000-0000-4000-8000-000000000004",
      requestedTarget,
    );
    state.attend();
    state.block("static-collision");
    expect(state.snapshot).toMatchObject({ state: "blocked", arrived: false });
    const recovered = WorldActionStateMachine.recover({
      ...state.snapshot,
      state: "moving",
      continuity: "current",
    });
    expect(recovered.snapshot).toMatchObject({
      state: "interrupted",
      continuity: "previous-recovered",
      reason: "restart-recovery",
      arrived: false,
    });
  });
});

describe("bounded trace and timeline projections", () => {
  it("caps evidence and never promotes candidate relationships to confirmed", () => {
    const evidence = validateTraceEvidence({
      graphGeneration: "00000000-0000-4000-8000-000000000099",
      objects: Array.from(
        { length: 300 },
        (_, index) => `aiw://object/${index}`,
      ),
      edges: Array.from({ length: 520 }, (_, index) => ({
        ref: `edge-${index}`,
        sourceRef: "aiw://object/source",
        targetRef: `aiw://object/${index}`,
        confidence:
          index === 0
            ? "ambiguous"
            : index === 1
              ? "unavailable"
              : "exact_file",
        evidenceRef: `evidence-${index}`,
      })),
      confirmedPath: Array.from({ length: 30 }, (_, index) => `edge-${index}`),
      totalObjects: 400,
      totalEdges: 900,
    });
    expect(evidence.objects).toHaveLength(256);
    expect(evidence.edges).toHaveLength(512);
    expect(evidence.confirmedPath).toHaveLength(24);
    expect(evidence.edges[0]).toMatchObject({ status: "candidate" });
    expect(evidence.edges[1]).toMatchObject({
      sourceRef: "aiw://object/source",
      targetRef: "aiw://object/1",
      status: "unavailable",
    });
    expect(evidence.truncation).toEqual({
      shownObjects: 256,
      totalObjects: 400,
      shownEdges: 512,
      totalEdges: 900,
      reason: "phase13-rich-graph-limit",
    });
  });

  it("retains 200/7 days, renders 50, caps 32 pins, and emits only allowlisted Yjs projection", () => {
    const now = Date.parse("2026-07-21T12:00:00.000Z");
    const timeline = new BoundedActionTimeline({ now: () => now });
    for (let index = 0; index < 205; index += 1) {
      timeline.append({
        actionId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        batchId: "00000000-0000-4000-8000-000000009999",
        kind: "focus",
        objectRef: `aiw://object/${index}`,
        state: "arrived",
        continuity: "current",
        createdAt: new Date(now - index * 1_000).toISOString(),
        updatedAt: new Date(now - index * 1_000).toISOString(),
        pinned: index < 32,
      });
    }
    expect(timeline.all).toHaveLength(200);
    expect(timeline.visible).toHaveLength(50);
    expect(() =>
      timeline.pin(timeline.all.find((entry) => !entry.pinned)!.actionId),
    ).toThrow(/32/);
    const projection = toWorldActionPresentationProjection(timeline.all[0]!);
    expect(projection).toEqual({
      actionId: timeline.all[0]!.actionId,
      kind: "focus",
      objectRef: timeline.all[0]!.objectRef,
      state: "arrived",
      pinned: timeline.all[0]!.pinned,
    });
    expect(JSON.stringify(projection)).not.toMatch(
      /batchId|createdAt|path|envelope|session/i,
    );
  });
});
