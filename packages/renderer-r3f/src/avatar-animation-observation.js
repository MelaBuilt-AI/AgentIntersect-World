/** Keep animation evidence current without reconciling the full city per sample. */
export function writeAvatarAnimationSample(dataset, role, sample) {
  const prefix = `${role}Avatar`;
  dataset[`${prefix}AnimationSourceId`] = sample.sourceAssetId;
  dataset[`${prefix}MixerRoot`] = sample.mixerRootUuid;
  dataset[`${prefix}MixerTime`] = String(sample.mixerTime);
  dataset[`${prefix}SampledClip`] = sample.clipName;
  dataset[`${prefix}ActionTime`] = String(sample.actionTime);
  dataset[`${prefix}AnimationSequence`] = String(sample.sequence);
  dataset[`${prefix}AnimationProgression`] = sample.progression;
  dataset[`${prefix}BoneName`] = sample.boneName;
  dataset[`${prefix}BoneQuaternion`] = sample.boneQuaternion.join(",");
}
