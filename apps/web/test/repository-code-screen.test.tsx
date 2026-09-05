import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorldScreen } from "../src/world-entry/WorldScreen.js";

describe("object-anchored code screen", () => {
  it("supports a fixed object pose and spatial mode without a movable base", () => {
    const html = renderToStaticMarkup(
      createElement(WorldScreen, {
        id: "director",
        spatial: true,
        pose: { x: 12, z: 8, yaw: 0 },
        movable: false,
        children: createElement("pre", null, "export const answer = 42;"),
      }),
    );
    expect(html).toContain('data-screen-mode="spatial"');
    expect(html).toContain('data-screen-x="12"');
    expect(html).toContain("export const answer = 42;");
    expect(html).not.toContain("hold base to move");
  });
});
