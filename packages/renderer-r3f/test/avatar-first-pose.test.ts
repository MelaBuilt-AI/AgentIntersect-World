import { expect, it } from "vitest";
import {
  AnimationClip,
  AnimationMixer,
  Group,
  NumberKeyframeTrack,
} from "three";
import { crossfadeImportedAvatarAction } from "../src/imported-avatar-animation.js";

it("samples the first Idle at full weight instead of fading up from bind pose", () => {
  const root = new Group();
  const bone = new Group();
  bone.name = "Arm";
  root.add(bone);
  const mixer = new AnimationMixer(root);
  const clip = new AnimationClip("Idle", 1, [
    new NumberKeyframeTrack("Arm.rotation[x]", [0, 1], [1, 1]),
  ]);
  const action = mixer.clipAction(clip);
  crossfadeImportedAvatarAction(null, action);
  mixer.update(0);
  expect(action.getEffectiveWeight()).toBe(1);
  expect(bone.rotation.x).toBeCloseTo(1);
});
