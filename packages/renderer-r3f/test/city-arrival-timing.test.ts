import { expect, it } from "vitest";
import {
  cityAssemblyFrame,
  cityLaunchFrame,
} from "../src/city-arrival-timing.js";

it("keeps the final city material through a longer smooth glow tail", () => {
  expect(cityAssemblyFrame(3.4, false).complete).toBe(false);
  const samples = Array.from({ length: 361 }, (_, i) =>
    cityAssemblyFrame(i / 60, false),
  );
  expect(samples[252]!.shaderProgress).toBeCloseTo(1);
  expect(samples[300]!.complete).toBe(false);
  expect(samples[348]!).toMatchObject({ complete: true, shaderProgress: 1.22 });
  for (let i = 1; i < samples.length; i++) {
    expect(samples[i]!.shaderProgress).toBeGreaterThanOrEqual(
      samples[i - 1]!.shaderProgress,
    );
    expect(
      samples[i]!.shaderProgress - samples[i - 1]!.shaderProgress,
    ).toBeLessThan(0.012);
  }
});
it("launches upward first then eases into downward flow without a phase jump", () => {
  expect(cityLaunchFrame(0, false)).toMatchObject({ reach: 0, down: 0 });
  expect(cityLaunchFrame(1, false).reach).toBeGreaterThan(0);
  expect(cityLaunchFrame(2.8, false)).toMatchObject({ reach: 1, down: 0 });
  expect(cityLaunchFrame(4.5, false)).toMatchObject({ reach: 1, down: 1 });
  expect(cityLaunchFrame(0, true)).toMatchObject({
    reach: 1,
    down: 1,
    spark: 0,
  });
  expect(cityAssemblyFrame(1, true).complete).toBe(true);
});
