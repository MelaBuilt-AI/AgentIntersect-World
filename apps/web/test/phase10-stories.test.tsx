import { describe, expect, it } from "vitest";

import {
  AggregateAndFocusedDependencyBridge,
  CurrentDegradedCoverage,
  ReducedMotionWebGLFallback,
} from "../src/phase10.stories.js";

describe("Phase 10 Storybook states", () => {
  it("tracks current/degraded and WebGL fallback stories through the production panel", () => {
    expect(CurrentDegradedCoverage.render).toBeTypeOf("function");
    expect(ReducedMotionWebGLFallback.render).toBeTypeOf("function");
    expect(CurrentDegradedCoverage.render).not.toBe(
      ReducedMotionWebGLFallback.render,
    );
    expect(AggregateAndFocusedDependencyBridge.render).toBeTypeOf("function");
  });
});
