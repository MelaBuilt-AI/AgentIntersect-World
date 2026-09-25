import { expect, it } from "vitest";
import { ENVIRONMENT_FX } from "@agentintersect-world/world-schema/environment";

it("bounds weather particles and schedules distinct distant/local strikes with slow atlas playback", async () => {
  const api = await import("../src/environment-weather-model.js").catch(
    () => null,
  );
  expect(api).not.toBeNull();
  if (!api) return;
  const weather = {
    particles: "heavy-rain" as const,
    intensity: 1,
    wind: 1,
    lightning: "both" as const,
    lightningInterval: 8,
    flashes: true,
  };
  const points = api.weatherPositions(weather);
  expect(points.length).toBe(1152 * 3);
  expect(api.weatherPositions({ ...weather, intensity: 0 })).toHaveLength(0);
  const distant = api.lightningStrike(0, weather, 68, { x: 0, z: 0 });
  const local = api.lightningStrike(1, weather, 68, { x: 33, z: 33 });
  expect(distant.local).toBe(false);
  expect(local.local).toBe(true);
  expect(Math.abs(local.x)).toBeLessThanOrEqual(31);
  expect(Math.abs(local.z)).toBeLessThanOrEqual(31);
  expect(api.atlasFrame("fx_lightning_strike", 0.5)).toBeGreaterThan(0);
  expect(api.atlasFrame("fx_lightning_strike", 1.5)).toBeLessThan(16);
  expect(api.atlasFrame("fx_lightning_strike", 2)).toBeNull();
  for (const id of Object.keys(
    ENVIRONMENT_FX,
  ) as (keyof typeof ENVIRONMENT_FX)[])
    expect(api.atlasFrame(id, 5)).toBeNull();
});
