import { expect, it } from "vitest";
import * as transition from "../src/environment-transition.js";

it("fully dematerializes the old environment before the replacement materializes at the existing pace", () => {
  expect(transition.transitionMaterializationProgress).toBeTypeOf("function");
  const progress = transition.transitionMaterializationProgress;
  expect(progress("idle", 0, false)).toBe(1.2);
  expect(progress("loading", 10, false)).toBe(1.2);
  expect(progress("out", 0, false)).toBe(1.2);
  expect(progress("out", 0.175, false)).toBeCloseTo(0.59);
  expect(progress("out", 0.35, false)).toBeLessThan(0);
  expect(progress("in", 0, false)).toBeLessThan(0);
  expect(progress("in", 0.325, false)).toBeCloseTo(0.59);
  expect(progress("in", 0.65, false)).toBeCloseTo(1.2);
  for (const phase of ["idle", "loading", "out", "in"] as const)
    expect(progress(phase, 0.2, true)).toBe(1.2);
});
