import { describe, expect, it } from "vitest";

import {
  FinalEditable,
  ListeningNoLexicalPartial,
  MobileReducedMotionForcedColorsNoWebGL,
  PermissionDeniedTypedFallback,
  PlaybackInterruptedAfterRecovery,
  ProviderUnavailable,
} from "../src/phase15.stories.js";

describe("Phase 15 Storybook truth states", () => {
  it("keeps unavailable, denied, listening, final, recovery, and semantic fallback states renderable", () => {
    for (const story of [
      ProviderUnavailable,
      PermissionDeniedTypedFallback,
      ListeningNoLexicalPartial,
      FinalEditable,
      PlaybackInterruptedAfterRecovery,
      MobileReducedMotionForcedColorsNoWebGL,
    ])
      expect(story.render).toBeTypeOf("function");
  });
});
