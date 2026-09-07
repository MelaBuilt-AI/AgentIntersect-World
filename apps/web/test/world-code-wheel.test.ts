import { describe, expect, it } from "vitest";
import {
  wheelPosition,
  wheelSegment,
} from "../src/world-entry/world-code-wheel-model.js";
import { nearestScreenPlacement } from "../src/world-entry/world-screen-placement.js";

describe("Code Wheel geometry", () => {
  it("keeps the cursor center when both rings fit and contains all four edges", () => {
    expect(wheelPosition(800, 500, 1600, 1000)).toEqual({
      x: 800,
      y: 500,
      scale: 1,
    });
    for (const [width, height] of [
      [1600, 1000],
      [390, 844],
      [1024, 600],
    ]) {
      for (const [x, y] of [
        [0, 0],
        [width!, 0],
        [0, height!],
        [width!, height!],
      ]) {
        const fit = wheelPosition(x!, y!, width!, height!);
        expect(fit.x - 292 * fit.scale).toBeGreaterThanOrEqual(7.99);
        expect(fit.y - 292 * fit.scale).toBeGreaterThanOrEqual(7.99);
        expect(fit.x + 292 * fit.scale).toBeLessThanOrEqual(width! - 7.99);
        expect(fit.y + 292 * fit.scale).toBeLessThanOrEqual(height! - 7.99);
      }
    }
  });
  it("produces distinct closed radial segments with labels inside the ring", () => {
    const segments = Array.from({ length: 10 }, (_, index) =>
      wheelSegment(index, 10, 88, 187),
    );
    expect(new Set(segments.map((segment) => segment.path)).size).toBe(10);
    for (const segment of segments) {
      expect(segment.path).toMatch(/^M.*A187.*A88.*Z$/);
      expect(Math.hypot(segment.x, segment.y)).toBeCloseTo(137.5);
    }
  });
});

describe("nearest unoccupied screen placement", () => {
  it("skips physically empty positions rejected by actual camera/HUD projection", () => {
    const pose = nearestScreenPlacement(
      { x: 0, z: 0, yaw: 0 },
      620,
      { floorSize: 40, obstacles: [] },
      (candidate) => candidate.x < -5,
    );
    expect(pose).not.toBeNull();
    expect(pose!.x).toBeLessThan(-5);
  });
  it("keeps a new screen in the forward viewing area when nearby front space is occupied", () => {
    const pose = nearestScreenPlacement({ x: 0, z: 0, yaw: 0 }, 620, {
      floorSize: 40,
      obstacles: [{ x: 0, z: -4, halfWidth: 4, halfDepth: 2 }],
    });
    expect(pose).not.toBeNull();
    expect(pose!.z).toBeLessThan(0);
  });
  const view = { x: 0, z: 0, yaw: 0 };
  it("chooses the nearest clear grid position, preferring forward ties", () => {
    const pose = nearestScreenPlacement(view, 720, {
      floorSize: 68,
      obstacles: [],
    })!;
    expect(pose).not.toBeNull();
    expect(pose.z).toBeLessThan(0);
    expect(Math.hypot(pose.x, pose.z)).toBeLessThanOrEqual(4);
    expect(pose.yaw).toBeCloseTo(Math.atan2(-pose.x, -pose.z));
  });
  it("avoids repo footprints, avatars and already placed screens", () => {
    const obstacles = [
      { x: 0, z: -4, halfWidth: 4, halfDepth: 3 },
      { x: 4, z: 0, halfWidth: 2, halfDepth: 1 },
      { x: -4, z: 0, halfWidth: 1, halfDepth: 1 },
    ];
    const pose = nearestScreenPlacement(view, 720, {
      floorSize: 68,
      obstacles,
    })!;
    expect(pose).not.toBeNull();
    for (const obstacle of obstacles) {
      const dx = Math.max(
        0,
        Math.abs(pose.x - obstacle.x) - obstacle.halfWidth,
      );
      const dz = Math.max(
        0,
        Math.abs(pose.z - obstacle.z) - obstacle.halfDepth,
      );
      expect(Math.hypot(dx, dz)).toBeGreaterThan(2.66);
    }
  });
  it("stays within the floor and refuses a completely occupied region", () => {
    const pose = nearestScreenPlacement({ x: 32, z: 32, yaw: 0 }, 1100, {
      floorSize: 68,
      obstacles: [],
    })!;
    expect(Math.abs(pose.x) + 3.8).toBeLessThanOrEqual(34);
    expect(Math.abs(pose.z) + 3.8).toBeLessThanOrEqual(34);
    expect(
      nearestScreenPlacement(view, 720, {
        floorSize: 68,
        obstacles: [{ x: 0, z: 0, halfWidth: 34, halfDepth: 34 }],
      }),
    ).toBeNull();
  });
});
