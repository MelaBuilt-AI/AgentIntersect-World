import { describe, expect, it } from "vitest";

import {
  advanceAgentMovement,
  cancelAgentMovement,
  createAgentMovementState,
  requestAgentMovement,
  type AgentMovementRequest,
} from "../src/world-entry/world-agent-movement-model.js";

const bounds = { minX: -15, maxX: 15, minZ: -15, maxZ: 15 } as const;
const context = {
  bounds,
  userPosition: { x: 4, z: 0 },
  layoutGeneration: "layout-1",
  resolveRepositoryObject: () => null,
} as const;
const request = (
  requestId: string,
  source: "user-directed" | "agent-autonomous",
  target: AgentMovementRequest["target"],
): AgentMovementRequest => ({
  schema: "aiw.agent-movement/1",
  requestId,
  actorId: "agent-session-1",
  source,
  speed: 4,
  target,
});

describe("authoritative World-owned agent movement", () => {
  it("accepts coordinate, relative, and follow targets and integrates bounded elapsed time", () => {
    const state = createAgentMovementState("agent-session-1", { x: 0, z: 0 });
    let result = requestAgentMovement(
      state,
      request("coordinate", "user-directed", {
        kind: "coordinate",
        x: 4,
        z: 0,
        stoppingRadius: 0.25,
      }),
      context,
    );
    expect(result.events.map(({ state }) => state)).toEqual([
      "requested",
      "accepted",
      "moving",
    ]);
    result = advanceAgentMovement(result.state, 10, context);
    expect(result.state.position.x).toBeCloseTo(0.4);
    expect(result.state.velocity.x).toBeCloseTo(4);
    expect(result.state.movementState).toBe("moving");

    result = requestAgentMovement(
      result.state,
      request("relative", "user-directed", {
        kind: "relative",
        direction: "left",
        distance: 2,
      }),
      context,
    );
    expect(result.state.destination?.x).toBeCloseTo(-1.6);

    result = requestAgentMovement(
      result.state,
      request("follow", "user-directed", {
        kind: "follow-user",
        stoppingRadius: 1.5,
      }),
      context,
    );
    expect(result.state.destination).toEqual({ x: 4, z: 0 });
  });

  it("refuses out-of-bounds and stale repository targets without moving", () => {
    const state = createAgentMovementState("agent-session-1", { x: 0, z: 0 });
    const outside = requestAgentMovement(
      state,
      request("outside", "user-directed", {
        kind: "coordinate",
        x: 16,
        z: 0,
      }),
      context,
    );
    expect(outside.state).toBe(state);
    expect(outside.events.at(-1)?.state).toBe("refused");

    const stale = requestAgentMovement(
      state,
      request("object", "agent-autonomous", {
        kind: "repository-object",
        objectId: "aiw://object/file-1",
        layoutGeneration: "layout-0",
        stoppingRadius: 1,
      }),
      context,
    );
    expect(stale.state).toBe(state);
    expect(stale.events.at(-1)?.state).toBe("target-stale");
  });

  it("gives explicit direction priority, cancels latest same-priority work, and resumes autonomy only after release", () => {
    let state = createAgentMovementState("agent-session-1", { x: 0, z: 0 });
    state = requestAgentMovement(
      state,
      request("auto-1", "agent-autonomous", {
        kind: "coordinate",
        x: -4,
        z: 0,
      }),
      context,
    ).state;
    const directed = requestAgentMovement(
      state,
      request("user-1", "user-directed", {
        kind: "coordinate",
        x: 4,
        z: 0,
      }),
      context,
    );
    expect(directed.events.map(({ state }) => state)).toContain("cancelled");
    expect(directed.state.activeRequest?.requestId).toBe("user-1");
    expect(directed.state.suspendedAutonomy?.requestId).toBe("auto-1");

    const latest = requestAgentMovement(
      directed.state,
      request("user-2", "user-directed", {
        kind: "coordinate",
        x: 1,
        z: 0,
        stoppingRadius: 0.25,
      }),
      context,
    );
    expect(latest.events[0]).toMatchObject({
      requestId: "user-1",
      state: "cancelled",
    });
    expect(latest.state.activeRequest?.requestId).toBe("user-2");

    let arrived = advanceAgentMovement(latest.state, 1, context);
    arrived = advanceAgentMovement(arrived.state, 1, context);
    arrived = advanceAgentMovement(arrived.state, 1, context);
    expect(arrived.events.map(({ state }) => state)).toContain("arrived");
    expect(arrived.state.activeRequest?.requestId).toBe("auto-1");
    expect(arrived.state.movementState).toBe("moving");
    expect(arrived.state.animationSemantic).toBe("Walk");
  });

  it("returns to Idle on cancellation and arrival without resuming a cancelled cue", () => {
    let state = createAgentMovementState("agent-session-1", { x: 0, z: 0 });
    state = requestAgentMovement(
      state,
      request("short", "user-directed", {
        kind: "coordinate",
        x: 0.2,
        z: 0,
        stoppingRadius: 0.25,
      }),
      context,
    ).state;
    const arrived = advanceAgentMovement(state, 0.1, context);
    expect(arrived.state.movementState).toBe("idle");
    expect(arrived.state.animationSemantic).toBe("Idle");
    expect(arrived.events.at(-1)?.state).toBe("arrived");

    state = requestAgentMovement(
      arrived.state,
      request("cancel", "agent-autonomous", {
        kind: "relative",
        direction: "forward",
        distance: 2,
      }),
      context,
    ).state;
    const cancelled = cancelAgentMovement(state, "policy-release", context);
    expect(cancelled.state.movementState).toBe("idle");
    expect(cancelled.state.animationSemantic).toBe("Idle");
    expect(cancelled.events.at(-1)?.state).toBe("cancelled");
  });
});
