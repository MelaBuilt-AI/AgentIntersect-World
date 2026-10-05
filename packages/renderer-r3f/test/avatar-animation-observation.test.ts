import { expect, it } from "vitest";
import { writeAvatarAnimationSample } from "../src/avatar-animation-observation.js";

it("updates exact role-scoped animation evidence without a React state update", () => {
  const data: Record<string, string> = { agentAvatarMixerTime: "12" };
  const sample = {
    sourceAssetId: "user-male-01",
    mixerRootUuid: "rig-a",
    mixerTime: 4.5,
    clipName: "Idle",
    actionTime: 1.2,
    sequence: 9,
    progression: "playing",
    boneName: "L_Thigh",
    boneQuaternion: [0.1, 0.2, 0.3, 0.9],
  };
  writeAvatarAnimationSample(data, "user", sample);
  expect(data).toMatchObject({
    userAvatarAnimationSourceId: "user-male-01",
    userAvatarMixerRoot: "rig-a",
    userAvatarMixerTime: "4.5",
    userAvatarSampledClip: "Idle",
    userAvatarActionTime: "1.2",
    userAvatarAnimationSequence: "9",
    userAvatarAnimationProgression: "playing",
    userAvatarBoneName: "L_Thigh",
    userAvatarBoneQuaternion: "0.1,0.2,0.3,0.9",
    agentAvatarMixerTime: "12",
  });
  writeAvatarAnimationSample(data, "user", {
    ...sample,
    mixerRootUuid: "rig-b",
    sequence: 1,
  });
  expect(data.userAvatarMixerRoot).toBe("rig-b");
  expect(data.userAvatarAnimationSequence).toBe("1");
});
