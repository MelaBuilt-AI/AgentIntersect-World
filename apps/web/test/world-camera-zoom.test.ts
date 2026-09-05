import { describe, expect, it } from "vitest";
import * as navigation from "../src/world-entry/world-navigation-model.js";

describe("World wheel zoom", () => {
  it("zooms in/out with bounded distance and equivalent pixel/line input", () => {
    expect(navigation.applyWorldCameraZoom).toBeTypeOf("function");
    const zoom = navigation.applyWorldCameraZoom;
    expect(zoom(1, -120)).toBeLessThan(1);
    expect(zoom(1, 120)).toBeGreaterThan(1);
    expect(zoom(1, 0)).toBe(1);
    expect(zoom(1, 3, 1)).toBe(zoom(1, 3 * 16, 0));
    expect(zoom(1, -1_000_000)).toBe(0.2);
    expect(zoom(1, 1_000_000)).toBe(2.5);
    expect(
      navigation.applyWorldCameraLook(
        { yaw: 0, pitch: 0, zoom: 0.5 },
        { movementX: 20, movementY: 10 },
      ).zoom,
    ).toBe(0.5);
  });
});
