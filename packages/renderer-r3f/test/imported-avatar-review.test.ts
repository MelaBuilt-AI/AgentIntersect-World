import { describe, expect, it } from "vitest";

import {
  initialImportedAvatarReviewPlayback,
  reduceImportedAvatarReviewPlayback,
} from "../src/imported-avatar-review-canvas.js";

describe("raw imported avatar review playback", () => {
  it("starts paused and supports play, replay, pause, and bounded scrub", () => {
    const initial = initialImportedAvatarReviewPlayback();
    expect(initial).toEqual({ status: "paused", currentTimeSeconds: 0 });
    const playing = reduceImportedAvatarReviewPlayback(
      initial,
      { sequence: 1, kind: "play" },
      8,
    );
    expect(playing).toEqual({ status: "playing", currentTimeSeconds: 0 });
    const paused = reduceImportedAvatarReviewPlayback(
      { status: "playing", currentTimeSeconds: 3.25 },
      { sequence: 2, kind: "pause" },
      8,
    );
    expect(paused).toEqual({ status: "paused", currentTimeSeconds: 3.25 });
    expect(
      reduceImportedAvatarReviewPlayback(
        paused,
        { sequence: 3, kind: "scrub", sample: 2 },
        8,
      ),
    ).toEqual({ status: "paused", currentTimeSeconds: 8 });
    expect(
      reduceImportedAvatarReviewPlayback(
        paused,
        { sequence: 4, kind: "scrub", sample: -1 },
        8,
      ),
    ).toEqual({ status: "paused", currentTimeSeconds: 0 });
    expect(
      reduceImportedAvatarReviewPlayback(
        { status: "ended", currentTimeSeconds: 8 },
        { sequence: 5, kind: "replay" },
        8,
      ),
    ).toEqual({ status: "playing", currentTimeSeconds: 0 });
  });
});
