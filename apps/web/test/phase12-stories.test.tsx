import { describe, expect, it } from "vitest";

import {
  ConnectedCurrentDesktop,
  MobileReducedMotionNoWebGL,
  OfflineCapabilityDegradation,
  PreviousRecovered,
} from "../src/phase12.stories.js";

describe("Phase 12 Storybook truth states", () => {
  it("keeps current, recovered, offline, and mobile semantic states renderable", () => {
    expect(ConnectedCurrentDesktop.render).toBeTypeOf("function");
    expect(PreviousRecovered.render).toBeTypeOf("function");
    expect(OfflineCapabilityDegradation.render).toBeTypeOf("function");
    expect(MobileReducedMotionNoWebGL.render).toBeTypeOf("function");
  });
});
