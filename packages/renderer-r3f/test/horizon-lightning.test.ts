import { expect, it } from "vitest";
import * as model from "../src/environment-weather-model.js";

it("places independently staggered brief bolts in a bounded distant band below the accepted upper sky", () => {
  expect(model).toHaveProperty("horizonLightningSample");
  const settings = { density: 1, interval: 3, elevation: 2 };
  expect(model.horizonLightningCount(settings)).toBe(24);
  expect(model.horizonLightningCount({ ...settings, density: 0 })).toBe(0);
  const first = model.horizonLightningSample(0, 0.2, settings);
  expect(first.opacity).toBeGreaterThan(0.5);
  expect(Math.hypot(first.x, first.z)).toBeCloseTo(390);
  expect(first.height).toBeGreaterThanOrEqual(18);
  expect(first.height).toBeLessThanOrEqual(36);
  expect(first.y - first.height / 2).toBeGreaterThan(5);
  expect(first.y + first.height / 2).toBeLessThan(60);
  expect(model.horizonLightningSample(0, 0.7, settings).opacity).toBe(0);
  expect(
    model.horizonLightningSample(0, 3.2, settings).opacity,
  ).toBeGreaterThan(0.5);
  const states = Array.from({ length: 24 }, (_, i) =>
    model.horizonLightningSample(i, 0.2, settings),
  );
  expect(states.filter((s) => s.opacity > 0).length).toBeLessThan(5);
  expect(new Set(states.map((s) => s.frame)).size).toBeGreaterThan(1);
});
