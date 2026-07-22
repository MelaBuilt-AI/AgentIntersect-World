import { describe, expect, it } from "vitest";

import {
  DEFAULT_REPOSITORY_CAMERA,
  applyRepositoryCameraLook,
  applyRepositoryCameraZoom,
  advanceRepositoryCameraTransition,
  MAX_REPOSITORY_CAMERA_STALLED_FRAMES,
  MAX_REPOSITORY_CAMERA_TRANSITION_FRAMES,
  repositoryCameraPose,
  retargetRepositoryCameraTransition,
} from "../../../packages/renderer-r3f/src/index.js";
import { moveOperatorPosition } from "../src/world-actions/operator-navigation.js";
import { PHASE5_WORLD_FIXTURE } from "../src/fixtures/phase5-world.js";

describe("Phase 13 manual camera adapters", () => {
  it("applies bounded orbit/look pitch and zoom to a real camera pose", () => {
    const looked = applyRepositoryCameraLook(DEFAULT_REPOSITORY_CAMERA, {
      movementX: 240,
      movementY: -2_000,
      sensitivity: 1,
      invertedY: false,
    });
    const zoomed = applyRepositoryCameraZoom(looked, -10_000);
    const pose = repositoryCameraPose({
      mode: "third-person",
      camera: zoomed,
      target: { x: 4, y: 1, z: 8 },
      actorPosition: null,
    });

    expect(looked.yaw).not.toBe(DEFAULT_REPOSITORY_CAMERA.yaw);
    expect(looked.pitch).toBeLessThanOrEqual(Math.PI / 2 - 0.1);
    expect(zoomed.distance).toBe(4);
    expect(pose.position).not.toEqual([18, 22, 24]);
  });

  it("translates first-person forward movement along camera yaw", () => {
    const moved = moveOperatorPosition({
      snapshot: PHASE5_WORLD_FIXTURE,
      selectedRef: PHASE5_WORLD_FIXTURE.objects[0]!.ref,
      currentPosition: { x: 0, z: 0 },
      direction: "forward",
      noWebGL: false,
      yawRadians: Math.PI / 2,
    });

    expect(moved.position?.x).toBeGreaterThan(0);
    expect(moved.position?.z).toBeCloseTo(0, 3);
  });

  it("does not restart an active generation for an equal desired pose", () => {
    const desired = {
      position: [1, 2, 3] as const,
      target: [4, 5, 6] as const,
      fov: 75,
    };
    let transition = retargetRepositoryCameraTransition(null, desired);
    transition = advanceRepositoryCameraTransition(transition, 10, false).state;

    const repeated = retargetRepositoryCameraTransition(transition, {
      position: [...desired.position],
      target: [...desired.target],
      fov: desired.fov,
    });

    expect(repeated).toBe(transition);
    expect(repeated.generation).toBe(1);
    expect(repeated.frame).toBe(1);
  });

  it("snaps a measured non-progressing transition promptly", () => {
    let transition = retargetRepositoryCameraTransition(null, {
      position: [1, 2, 3],
      target: [4, 5, 6],
      fov: 75,
    });
    let decision = advanceRepositoryCameraTransition(transition, 10, false);

    for (let index = 0; decision.continueRendering && index < 20; index += 1) {
      transition = decision.state;
      decision = advanceRepositoryCameraTransition(transition, 10, false);
    }

    expect(decision.snap).toBe(true);
    expect(decision.continueRendering).toBe(false);
    expect(decision.state.stalledFrames).toBe(
      MAX_REPOSITORY_CAMERA_STALLED_FRAMES,
    );
    expect(decision.state.frame).toBeLessThan(
      MAX_REPOSITORY_CAMERA_TRANSITION_FRAMES,
    );
  });

  it("continues a genuinely progressing transition and settles normally", () => {
    let transition = retargetRepositoryCameraTransition(null, {
      position: [1, 2, 3],
      target: [4, 5, 6],
      fov: 75,
    });

    for (const remainingError of [10, 8, 4, 1, 0.1]) {
      const decision = advanceRepositoryCameraTransition(
        transition,
        remainingError,
        false,
      );
      expect(decision.continueRendering).toBe(true);
      expect(decision.snap).toBe(false);
      expect(decision.state.stalledFrames).toBe(0);
      transition = decision.state;
    }

    const settled = advanceRepositoryCameraTransition(transition, 0, true);
    expect(settled.continueRendering).toBe(false);
    expect(settled.snap).toBe(true);
    expect(settled.state.frame).toBe(6);
  });
});
