import { describe, expect, it } from "vitest";
import {
  canOccupyRepositoryCity,
  type RepositoryCityInstance,
} from "@agentintersect-world/renderer-r3f";

import {
  advanceAgentMovement,
  cancelAgentMovement,
  createAgentMovementState,
  interruptAgentMovement,
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
const repositoryCity: readonly RepositoryCityInstance[] = [
  {
    instanceId: "repository:test-beacon",
    assetId: "06-test-beacon",
    position: { x: 1.2, z: 0 },
    status: "idle",
    lifecycle: "idle",
    pinned: false,
    manual: false,
    linkedRepoData: { ref: "aiw://object/test-beacon" },
    sourceEvent: "test.completed",
  },
];
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
  it("keeps multiple followers in separate user-relative slots", () => {
    const positions = [-1, 1].map((side) => {
      const followContext = {
        ...context,
        userPosition: { x: 0, z: -10 },
        followDirection: { x: side, z: 0 },
      };
      let result = requestAgentMovement(
        createAgentMovementState("agent-session-1", { x: side * 4, z: 0 }),
        request("formation", "user-directed", {
          kind: "follow-user",
          stoppingRadius: 1.5,
        }),
        followContext,
      );
      for (let i = 0; i < 100; i++)
        result = advanceAgentMovement(result.state, 0.1, followContext);
      expect(result.state.activeRequest?.requestId).toBe("formation");
      expect(result.state.animationSemantic).toBe("Idle");
      return result.state.position;
    });
    expect(
      Math.hypot(
        positions[1]!.x - positions[0]!.x,
        positions[1]!.z - positions[0]!.z,
      ),
    ).toBeGreaterThan(2);
  });

  it("keeps following after catching up, faces the user, and resumes without a new command", () => {
    let result = requestAgentMovement(
      createAgentMovementState("agent-session-1", { x: 0, z: 0 }),
      request("persistent-follow", "user-directed", {
        kind: "follow-user",
        stoppingRadius: 1.5,
      }),
      context,
    );
    const events = [...result.events];
    for (let frame = 0; frame < 40; frame += 1) {
      result = advanceAgentMovement(result.state, 0.1, context);
      events.push(...result.events);
    }
    expect(result.state.animationSemantic).toBe("Idle");
    expect(result.state.activeRequest?.requestId).toBe("persistent-follow");
    expect(events.some(({ state }) => state === "arrived")).toBe(false);
    const restingPosition = result.state.position;
    result = advanceAgentMovement(result.state, 0.1, {
      ...context,
      userPosition: { x: restingPosition.x, z: 1 },
    });
    expect(result.state.position).toEqual(restingPosition);
    expect(result.state.heading).toBeCloseTo(0);
    result = advanceAgentMovement(result.state, 0.1, {
      ...context,
      userPosition: { x: 8, z: 2 },
    });
    expect(result.state.position.x).toBeGreaterThan(restingPosition.x);
    expect(result.state.movementState).toBe("moving");
    result = cancelAgentMovement(result.state, "user-directed-stop", context);
    const stopped = result.state;
    result = advanceAgentMovement(stopped, 0.1, context);
    expect(result.state).toEqual(stopped);
  });
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

  it("faces the rendered model along its actual displacement vector", () => {
    let result = requestAgentMovement(
      createAgentMovementState("agent-session-1", { x: 0, z: 0 }),
      request("forward-facing", "user-directed", {
        kind: "relative",
        direction: "forward",
        distance: 4,
      }),
      context,
    );
    result = advanceAgentMovement(result.state, 0.1, context);
    const speed = Math.hypot(result.state.velocity.x, result.state.velocity.z);

    expect(Math.sin(result.state.heading)).toBeCloseTo(
      result.state.velocity.x / speed,
    );
    expect(Math.cos(result.state.heading)).toBeCloseTo(
      result.state.velocity.z / speed,
    );
  });

  it("uses Run for a far traversal, Walk for a short traversal, then Idle on arrival", () => {
    const initial = createAgentMovementState("agent-session-1", {
      x: 0,
      z: 0,
    });
    const far = requestAgentMovement(
      initial,
      request("far-follow", "user-directed", {
        kind: "follow-user",
        stoppingRadius: 1.5,
      }),
      { ...context, userPosition: { x: 10, z: 0 } },
    );
    expect(far.state.animationSemantic).toBe("Run");

    const nearContext = { ...context, userPosition: { x: 3, z: 0 } };
    let short = requestAgentMovement(
      initial,
      request("short-follow", "user-directed", {
        kind: "follow-user",
        stoppingRadius: 1.5,
      }),
      nearContext,
    );
    expect(short.state.animationSemantic).toBe("Walk");
    for (let index = 0; index < 10 && short.state.activeRequest; index += 1)
      short = advanceAgentMovement(short.state, 0.1, nearContext);
    expect(short.state.animationSemantic).toBe("Idle");
    expect(short.state.activeRequest?.target.kind).toBe("follow-user");
    expect(short.events).toEqual([]);
  });

  it("speeds up actual follow displacement with Run, slows to Walk, and rests without overshoot", () => {
    const follow = request("speed-follow", "user-directed", {
      kind: "follow-user",
      stoppingRadius: 1.5,
    });
    const initial = createAgentMovementState("agent-session-1", { x: 0, z: 0 });
    const farContext = { ...context, userPosition: { x: 12, z: 0 } };
    let result = requestAgentMovement(initial, follow, farContext);
    result = advanceAgentMovement(result.state, 0.1, farContext);
    expect(result.state.animationSemantic).toBe("Run");
    expect(result.state.position.x).toBeCloseTo(0.8);
    expect(result.state.velocity.x).toBeCloseTo(8);
    const nearContext = { ...context, userPosition: { x: 4, z: 0 } };
    result = advanceAgentMovement(result.state, 0.1, nearContext);
    expect(result.state.animationSemantic).toBe("Walk");
    expect(result.state.position.x).toBeCloseTo(1.2);
    expect(result.state.velocity.x).toBeCloseTo(4);
    for (let i = 0; i < 10; i++)
      result = advanceAgentMovement(result.state, 0.1, nearContext);
    expect(result.state.position.x).toBeCloseTo(2.5);
    expect(result.state.animationSemantic).toBe("Idle");
    expect(result.state.activeRequest?.requestId).toBe("speed-follow");
    // Explicit speed on non-follow targets remains authoritative.
    const directed = requestAgentMovement(
      initial,
      request("exact-speed", "user-directed", {
        kind: "coordinate",
        x: 12,
        z: 0,
      }),
      context,
    );
    expect(
      advanceAgentMovement(directed.state, 0.1, context).state.position.x,
    ).toBeCloseTo(0.4);
  });

  it("emits arrival on the step that reaches the quantized stopping boundary", () => {
    let result = requestAgentMovement(
      createAgentMovementState("agent-session-1", { x: 0, z: 0 }),
      request("quantized-arrival", "agent-autonomous", {
        kind: "coordinate",
        x: 0.9004,
        z: 0,
        stoppingRadius: 0.5,
      }),
      context,
    );

    result = advanceAgentMovement(result.state, 0.125, context);

    expect(result.state.position.x).toBe(0.4);
    expect(result.state.movementState).toBe("idle");
    expect(result.events.map(({ state }) => state)).toEqual(["arrived"]);
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

  it("re-resolves a repository approach point while moving and stops stale when the target disappears", () => {
    let approach: {
      readonly objectId: string;
      readonly layoutGeneration: string;
      readonly position: { readonly x: number; readonly z: number };
      readonly hidden: boolean;
      readonly reachable: boolean;
    } | null = {
      objectId: "aiw://object/file-1",
      layoutGeneration: "layout-1",
      position: { x: 4, z: 0 },
      hidden: false,
      reachable: true,
    };
    const liveContext = {
      ...context,
      resolveRepositoryObject: () => approach,
    };
    let result = requestAgentMovement(
      createAgentMovementState("agent-session-1", { x: 0, z: 0 }),
      request("live-object", "agent-autonomous", {
        kind: "repository-object",
        objectId: "aiw://object/file-1",
        layoutGeneration: "layout-1",
        stoppingRadius: 0.5,
      }),
      liveContext,
    );
    result = advanceAgentMovement(result.state, 0.1, liveContext);
    expect(result.state.position.x).toBeGreaterThan(0);

    approach = { ...approach!, position: { x: -4, z: 0 } };
    const beforeRedirect = result.state.position.x;
    result = advanceAgentMovement(result.state, 0.1, liveContext);
    expect(result.state.position.x).toBeLessThan(beforeRedirect);
    expect(result.state.destination).toEqual({ x: -4, z: 0 });

    approach = null;
    result = advanceAgentMovement(result.state, 0.1, liveContext);
    expect(result.state.movementState).toBe("idle");
    expect(result.state.animationSemantic).toBe("Idle");
    expect(result.events.at(-1)).toMatchObject({
      requestId: "live-object",
      state: "target-stale",
      reason: "repository-object-missing-or-stale",
    });
  });

  it("makes explicit direction terminally supersede autonomy and refuses autonomy while user direction is active", () => {
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
    expect(directed.state.suspendedAutonomy).toBeNull();

    const held = requestAgentMovement(
      directed.state,
      request("auto-held", "agent-autonomous", {
        kind: "coordinate",
        x: -2,
        z: 0,
      }),
      context,
    );
    expect(held.state).toBe(directed.state);
    expect(held.events.at(-1)).toMatchObject({
      requestId: "auto-held",
      state: "refused",
      reason: "user-directed-active",
    });

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
    expect(arrived.events.map(({ state }) => state)).toContain("arrived");
    expect(arrived.state.activeRequest).toBeNull();
    expect(arrived.state.movementState).toBe("idle");
    expect(arrived.state.animationSemantic).toBe("Idle");

    const replay = requestAgentMovement(
      arrived.state,
      request("auto-1", "agent-autonomous", {
        kind: "coordinate",
        x: -4,
        z: 0,
      }),
      context,
    );
    expect(replay.state).toBe(arrived.state);
    expect(replay.events.at(-1)).toMatchObject({
      requestId: "auto-1",
      state: "refused",
      reason: "request-terminal",
    });
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

  it("applies an authoritative interruption only to its active actor request", () => {
    const moving = requestAgentMovement(
      createAgentMovementState("agent-session-1", { x: 0, z: 0 }),
      request("auto-interrupt", "agent-autonomous", {
        kind: "coordinate",
        x: 5,
        z: 0,
      }),
      context,
    ).state;
    const wrongRequest = interruptAgentMovement(
      moving,
      "different-request",
      "operator-movement",
    );
    expect(wrongRequest.state).toBe(moving);
    expect(wrongRequest.events).toEqual([]);

    const interrupted = interruptAgentMovement(
      moving,
      "auto-interrupt",
      "operator-movement",
    );
    expect(interrupted.state.movementState).toBe("idle");
    expect(interrupted.state.animationSemantic).toBe("Idle");
    expect(interrupted.events).toEqual([
      expect.objectContaining({
        actorId: "agent-session-1",
        requestId: "auto-interrupt",
        state: "interrupted",
        reason: "operator-movement",
      }),
    ]);
    expect(
      requestAgentMovement(
        interrupted.state,
        request("auto-interrupt", "agent-autonomous", {
          kind: "coordinate",
          x: 1,
          z: 0,
        }),
        context,
      ).events.at(-1),
    ).toMatchObject({ state: "refused", reason: "request-terminal" });
  });

  it("moves an autonomous coordinate request through repository-city occupancy", () => {
    let result = requestAgentMovement(
      createAgentMovementState("agent-session-1", { x: 0, z: 0 }),
      request("coordinate-through-city", "agent-autonomous", {
        kind: "coordinate",
        x: 3,
        z: 0,
      }),
      context,
    );
    let enteredRepositoryOccupancy = false;
    for (let index = 0; index < 20 && result.state.activeRequest; index += 1) {
      result = advanceAgentMovement(result.state, 0.1, context);
      enteredRepositoryOccupancy ||= !canOccupyRepositoryCity(
        repositoryCity,
        result.state.position,
        null,
      );
    }

    expect(canOccupyRepositoryCity(repositoryCity, { x: 0, z: 0 }, null)).toBe(
      true,
    );
    expect(enteredRepositoryOccupancy).toBe(true);
    expect(result.events.at(-1)).toMatchObject({
      requestId: "coordinate-through-city",
      state: "arrived",
    });
  });

  it("follows the user through repository-city occupancy", () => {
    let result = requestAgentMovement(
      createAgentMovementState("agent-session-1", { x: 0, z: 0 }),
      request("follow-through-city", "agent-autonomous", {
        kind: "follow-user",
        stoppingRadius: 1.5,
      }),
      context,
    );
    let enteredRepositoryOccupancy = false;
    for (let index = 0; index < 20 && result.state.activeRequest; index += 1) {
      result = advanceAgentMovement(result.state, 0.1, context);
      enteredRepositoryOccupancy ||= !canOccupyRepositoryCity(
        repositoryCity,
        result.state.position,
        null,
      );
    }

    expect(enteredRepositoryOccupancy).toBe(true);
    expect(result.state.activeRequest?.requestId).toBe("follow-through-city");
    expect(result.state.animationSemantic).toBe("Idle");
  });

  it("cancels an active request when the World boundary changes", () => {
    const narrowedContext = {
      ...context,
      bounds: { ...bounds, maxX: 0.2 },
    };
    let result = requestAgentMovement(
      createAgentMovementState("agent-session-1", { x: 0.3, z: 0 }),
      request("cross-changed-world-boundary", "agent-autonomous", {
        kind: "coordinate",
        x: 0,
        z: 0,
      }),
      context,
    );

    result = advanceAgentMovement(result.state, 0.1, narrowedContext);

    expect(result.state.position).toEqual({ x: 0.3, z: 0 });
    expect(result.events.at(-1)).toMatchObject({
      requestId: "cross-changed-world-boundary",
      state: "cancelled",
      reason: "world-bounds",
    });
  });
});
