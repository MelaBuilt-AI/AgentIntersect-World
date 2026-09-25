import { expect, it } from "vitest";
import { ENVIRONMENT_PRESETS } from "@agentintersect-world/world-schema/environment";
it("bounds cosmetic scatter regardless of floor size and keeps the spawn area clear", async () => {
  const module = await import("../src/environment-scatter.js").catch(
    () => null,
  );
  expect(module, "Sparse terrain detail placement must exist").not.toBeNull();
  const grass = module!.environmentScatter(
    200,
    24,
    "grass",
    new Uint8Array(32 * 32).fill(1),
  );
  const rocks = module!.environmentScatter(68, 18, "rocks");
  expect(grass).toHaveLength(24);
  expect(rocks).toHaveLength(18);
  expect(
    module!.environmentScatter(68, 24, "grass", new Uint8Array(32 * 32)),
  ).toHaveLength(0);
  for (const point of [...grass, ...rocks]) {
    expect(Math.hypot(point.x, point.z)).toBeGreaterThan(3);
    expect(Math.abs(point.x)).toBeLessThan(33);
    expect(Math.abs(point.z)).toBeLessThan(33);
  }
  expect(module!.environmentScatter(68, 18, "rocks")).toEqual(rocks);
});
it("moves background layers subtly and foreground layers more visibly", () => {
  for (const preset of ENVIRONMENT_PRESETS.slice(1)) {
    const sky = preset.recipe!.sky;
    expect(Math.abs(sky.background.speed)).toBeGreaterThan(0);
    expect(Math.abs(sky.foreground.speed)).toBeGreaterThan(
      Math.abs(sky.background.speed) * 5,
    );
  }
});
