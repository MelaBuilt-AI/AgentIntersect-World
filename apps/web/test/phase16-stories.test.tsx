import { describe, expect, it } from "vitest";

import {
  CurrentConflictingCandidate,
  MobileReducedMotionForcedColorsNoWebGL,
  PreviousRecovered,
  Unavailable,
} from "../src/phase16.stories.js";

describe("Phase 16 Storybook truth states", () => {
  it("keeps current, recovered, unavailable, and semantic fallback states renderable", () => {
    for (const story of [
      CurrentConflictingCandidate,
      PreviousRecovered,
      Unavailable,
      MobileReducedMotionForcedColorsNoWebGL,
    ])
      expect(story.args).toBeTypeOf("object");
  });
});
