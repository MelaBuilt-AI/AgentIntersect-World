import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorldScreen } from "../src/world-entry/WorldScreen.js";
import * as screens from "../../../packages/renderer-r3f/src/world-screen-types.js";

describe("code-world spatial controls", () => {
  it("labels only the bottom strip as the pointer move handle", () => {
    const html = renderToStaticMarkup(
      createElement(WorldScreen, {
        id: "preview",
        spatial: true,
        children: createElement("input"),
      }),
    );
    expect(html).toContain("Hold here to move");
    expect(html).toContain("scroll to rotate");
    expect(html).not.toContain("hold base");
    expect(html).toContain('aria-label="Move World View screen"');
  });
  it("rotates a held pose without changing translation, in pixels or lines", () => {
    expect(screens.rotateWorldScreen).toBeTypeOf("function");
    const pose = { x: 4, z: 9, yaw: 0.4 };
    const rotated = screens.rotateWorldScreen(pose, 120, 0);
    expect(rotated.x).toBe(4);
    expect(rotated.z).toBe(9);
    expect(rotated.yaw).toBeGreaterThan(pose.yaw);
    expect(screens.rotateWorldScreen(pose, 3, 1)).toEqual(rotated);
    expect(screens.rotateWorldScreen(rotated, -120, 0).yaw).toBeCloseTo(
      pose.yaw,
    );
  });
  it("reveals code upward from its object with immediate reduced-motion equivalence", () => {
    expect(screens.worldScreenReveal).toBeTypeOf("function");
    const initial = screens.worldScreenReveal(0, false);
    const midway = screens.worldScreenReveal(0.3, false);
    const complete = screens.worldScreenReveal(1, false);
    expect(initial).toBe(0);
    expect(midway).toBeGreaterThan(initial);
    expect(midway).toBeLessThan(complete);
    expect(complete).toBe(1);
    expect(screens.worldScreenReveal(0, true)).toBe(1);
  });
});
