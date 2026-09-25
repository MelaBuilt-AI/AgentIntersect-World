import { expect, it } from "vitest";
import { lightningStrike } from "../src/environment-weather-model.js";
import * as model from "../src/environment-weather-model.js";

it("spreads a distant lightning burst around the sky, with more bolts at higher intensity", () => {
  expect(model).toHaveProperty("skyLightningLayout");
  const weather = {
    particles: "none" as const,
    intensity: 1,
    wind: 0,
    lightning: "distant" as const,
    lightningInterval: 8,
    flashes: true,
  };
  const strike = lightningStrike(0, weather, 172, { x: 50, z: 60 });
  const layout = model.skyLightningLayout(strike, 1);
  expect(layout).toHaveLength(8);
  expect(model.skyLightningLayout(strike, 0.2).length).toBeLessThan(
    layout.length,
  );
  const angles = layout.map((p) => Math.atan2(p.x, p.z)).sort((a, b) => a - b);
  for (let i = 0; i < angles.length; i++) {
    const next =
      angles[(i + 1) % angles.length]! +
      (i === angles.length - 1 ? Math.PI * 2 : 0);
    expect(next - angles[i]!).toBeLessThan(Math.PI / 3);
  }
  for (const p of layout) {
    expect(p.y).toBeGreaterThan(45);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThan(170);
  }
  expect(model.skyLightningLayout({ ...strike, local: true }, 1)).toEqual([]);
});
