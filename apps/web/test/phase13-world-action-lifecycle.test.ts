import { describe, expect, it, vi } from "vitest";

import { stopWorldActionLifecycle } from "../src/world-actions/world-action-lifecycle.js";
import { DEFAULT_NAVIGATION_STATE } from "../src/world-actions/world-action-model.js";

const activeNavigation = {
  ...DEFAULT_NAVIGATION_STATE,
  cameraMode: "first-person" as const,
  pointerLocked: true,
  follow: true,
  agentMotion: "moving" as const,
};

describe("World Action lifecycle ownership", () => {
  it.each([
    ["capability loss", "capability-loss" as const],
    ["repository generation change", "invalid-target" as const],
    ["WebGL loss", "capability-loss" as const],
  ])(
    "stops RAF/follow/pointer lock and posts an authoritative interrupt on %s",
    (_label, reason) => {
      const cancelFrame = vi.fn();
      const exitPointerLock = vi.fn();
      const postInterrupt = vi.fn();

      const next = stopWorldActionLifecycle({
        navigation: activeNavigation,
        reason,
        animationFrame: 17,
        cancelFrame,
        exitPointerLock,
        postInterrupt,
      });

      expect(cancelFrame).toHaveBeenCalledWith(17);
      expect(exitPointerLock).toHaveBeenCalledOnce();
      expect(postInterrupt).toHaveBeenCalledWith(reason);
      expect(next).toMatchObject({
        pointerLocked: false,
        follow: false,
        agentMotion: "interrupted",
        interruptionReason: reason,
      });
    },
  );

  it.each(["pagehide", "component teardown"])(
    "cannot leave durable movement active during %s",
    () => {
      const cancelFrame = vi.fn();
      const postInterrupt = vi.fn();
      const next = stopWorldActionLifecycle({
        navigation: activeNavigation,
        reason: "cancel",
        animationFrame: 23,
        cancelFrame,
        exitPointerLock: vi.fn(),
        postInterrupt,
      });

      expect(cancelFrame).toHaveBeenCalledWith(23);
      expect(postInterrupt).toHaveBeenCalledWith("cancel");
      expect(next).toMatchObject({
        follow: false,
        pointerLocked: false,
        agentMotion: "interrupted",
        interruptionReason: "cancel",
      });
    },
  );
});
