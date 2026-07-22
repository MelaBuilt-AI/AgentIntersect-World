import { describe, expect, it } from "vitest";

import {
  ApprovalPending,
  CompleteCorrelatedJourney,
  FailedAndRecoverable,
  MobileReducedMotionForcedColorsNoWebGL,
  PreviewReady,
  TestRunning,
} from "../src/phase14.stories.js";

describe("Phase 14 Storybook truth states", () => {
  it("keeps approval, test, preview, complete, failure, and fallback states renderable", () => {
    for (const story of [
      ApprovalPending,
      TestRunning,
      PreviewReady,
      CompleteCorrelatedJourney,
      FailedAndRecoverable,
      MobileReducedMotionForcedColorsNoWebGL,
    ])
      expect(story.render).toBeTypeOf("function");
  });
});
