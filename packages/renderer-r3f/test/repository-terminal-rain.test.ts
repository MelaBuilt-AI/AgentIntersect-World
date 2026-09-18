import { expect, it } from "vitest";
import {
  cityRainPulse,
  cityRainTop,
  CITY_RAIN_COLORS,
} from "../src/repository-terminal-rain.js";
import { CODE_SKY_LAYERS } from "../src/code-world-texture.js";

it("connects straight vertical rays to the moving sky rather than a fixed short ceiling", () => {
  const radius = CODE_SKY_LAYERS.at(-1)!.radius;
  for (const camera of [
    { x: 0, y: 4, z: 0 },
    { x: 50, y: 12, z: -30 },
  ]) {
    const x = 7,
      z = 9;
    const top = cityRainTop(x, z, camera);
    expect(
      (x - camera.x) ** 2 + (top - camera.y) ** 2 + (z - camera.z) ** 2,
    ).toBeCloseTo(radius ** 2, 5);
    expect(top).toBeGreaterThan(400);
  }
});

it("uses sparse six-second eased pulses, randomized objects/colors, and long quiet gaps", () => {
  const targets = new Set<number>();
  const colors = new Set<number>();
  let previous = cityRainPulse(0, 48, 53, false);
  let activeSamples = 0;
  for (let tick = 1; tick <= 18000; tick++) {
    const pulse = cityRainPulse(tick / 60, 48, 53, false);
    expect(Math.abs(pulse.strength - previous.strength)).toBeLessThan(0.01);
    expect(pulse.strength).toBeGreaterThanOrEqual(0);
    expect(pulse.strength).toBeLessThanOrEqual(1);
    if (pulse.index >= 0) {
      targets.add(pulse.index);
      colors.add(pulse.color);
      activeSamples++;
    }
    previous = pulse;
  }
  expect(activeSamples / 18000).toBeLessThan(0.36);
  expect(targets.size).toBeGreaterThan(5);
  expect(colors.size).toBe(CITY_RAIN_COLORS.length);
});

it("disables highlights under Reduced Motion and in empty cities", () => {
  for (let time = 0; time < 100; time += 0.25) {
    expect(cityRainPulse(time, 48, 1, true)).toMatchObject({
      index: -1,
      strength: 0,
    });
    expect(cityRainPulse(time, 0, 1, false).index).toBe(-1);
  }
});
