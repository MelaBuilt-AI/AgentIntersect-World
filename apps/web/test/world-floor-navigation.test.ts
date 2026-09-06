import { describe, expect, it } from "vitest";
import { worldFloorSize } from "../../../packages/renderer-r3f/src/repository-city-state.js";
import { moveWorldPosition } from "../src/world-entry/world-navigation-model.js";

describe("World movement follows the rendered floor", () => {
  it.each([68, worldFloorSize(68, 10000, [], [])])(
    "lets the user traverse a %s-unit floor and stops only at its edge",
    (floorSize) => {
      const edge = floorSize / 2 - 0.5;
      for (const [key, axis, sign] of [
        ["d", "x", 1],
        ["a", "x", -1],
        ["s", "z", 1],
        ["w", "z", -1],
      ] as const) {
        const input = {
          position: { x: 0, z: 0 },
          keys: [key],
          yaw: 0,
          elapsedSeconds: 100,
          sprint: true,
          floorSize,
        };
        const moved = moveWorldPosition(input);
        expect(moved[axis]).toBe(sign * edge);
        expect(Math.abs(moved[axis])).toBeGreaterThan(15);
      }
    },
  );
});
