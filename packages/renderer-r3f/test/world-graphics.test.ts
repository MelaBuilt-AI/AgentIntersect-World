import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORLD_GRAPHICS,
  loadWorldGraphics,
} from "../src/world-graphics.js";

describe("World anti-aliasing preference", () => {
  it("starts enabled for fresh and existing settings and preserves an explicit off", () => {
    expect(DEFAULT_WORLD_GRAPHICS).toHaveProperty("antialiasing", true);
    expect(loadWorldGraphics({ bloom: false })).toMatchObject({
      bloom: false,
      antialiasing: true,
    });
    expect(loadWorldGraphics({ antialiasing: false })).toHaveProperty(
      "antialiasing",
      false,
    );
  });
});
