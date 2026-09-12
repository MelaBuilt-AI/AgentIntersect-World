import {
  type AnimationClip,
  type AnimationMixer,
  type KeyframeTrack,
} from "three";

const LOOP_ONCE = 2200;
const LOOP_REPEAT = 2201;

export const IMPORTED_AVATAR_CROSSFADE_SECONDS = 0.22;

export type ImportedAvatarCrossfadeAction = {
  fadeOut(seconds: number): unknown;
  reset(): unknown;
  setEffectiveWeight(weight: number): unknown;
  fadeIn(seconds: number): unknown;
  play(): unknown;
};

export type ImportedAvatarLoopAction = {
  clampWhenFinished: boolean;
  setLoop(mode: number, repetitions: number): unknown;
};

export function configureImportedAvatarAction<
  Action extends ImportedAvatarLoopAction,
>(action: Action, oneShot: boolean): Action {
  action.clampWhenFinished = oneShot;
  action.setLoop(oneShot ? LOOP_ONCE : LOOP_REPEAT, oneShot ? 1 : Infinity);
  return action;
}

export function advanceImportedAvatarMixer(
  mixer: AnimationMixer,
  deltaSeconds: number,
): number {
  const boundedDelta = Number.isFinite(deltaSeconds)
    ? Math.min(Math.max(deltaSeconds, 0), 0.05)
    : 0;
  mixer.update(boundedDelta);
  return boundedDelta;
}

export function crossfadeImportedAvatarAction<
  Action extends ImportedAvatarCrossfadeAction,
>(
  previous: Pick<ImportedAvatarCrossfadeAction, "fadeOut"> | null,
  next: Action,
): Action {
  if (previous && previous !== next)
    previous.fadeOut(IMPORTED_AVATAR_CROSSFADE_SECONDS);
  next.reset();
  next.setEffectiveWeight(1);
  // No previous pose exists on first load: never blend from the bind pose.
  if (previous && previous !== next)
    next.fadeIn(IMPORTED_AVATAR_CROSSFADE_SECONDS);
  next.play();
  return next;
}

type VectorPositionTrack = KeyframeTrack & {
  readonly times: ArrayLike<number>;
  readonly values: {
    readonly length: number;
    [index: number]: number;
  };
  readonly getValueSize: () => number;
};

const isWorldTravelPositionTrack = (track: KeyframeTrack): boolean => {
  const name = track.name.toLocaleLowerCase();
  return (
    (/(^|[^a-z])(root|hip|pelvis)([^a-z]|$)/u.test(name) ||
      /(?:root|hip|pelvis)(?:\]|\})?\.position$/u.test(name)) &&
    /(?:\.|\]|\/|:|\|)position$/u.test(name)
  );
};

const vectorPositionTrack = (
  track: KeyframeTrack,
): VectorPositionTrack | undefined => {
  const candidate = track as Partial<VectorPositionTrack>;
  if (
    !isWorldTravelPositionTrack(track) ||
    typeof candidate.getValueSize !== "function" ||
    candidate.getValueSize() !== 3 ||
    !candidate.times ||
    !candidate.values ||
    candidate.times.length < 2 ||
    candidate.values.length < candidate.times.length * 3
  )
    return undefined;
  return candidate as VectorPositionTrack;
};

export function makeImportedAvatarClipInPlace(
  source: AnimationClip,
  travelThreshold = 0.25,
  normalizeVerticalTravel = false,
): AnimationClip {
  const clip = source.clone();
  for (const track of clip.tracks
    .map(vectorPositionTrack)
    .filter((candidate) => candidate !== undefined)) {
    const lastFrame = track.times.length - 1;
    const firstTime = Number(track.times[0]);
    const lastTime = Number(track.times[lastFrame]);
    if (
      !Number.isFinite(firstTime) ||
      !Number.isFinite(lastTime) ||
      lastTime <= firstTime
    )
      continue;
    const axes: readonly (0 | 1 | 2)[] = normalizeVerticalTravel
      ? [0, 1, 2]
      : [0, 2];
    for (const axis of axes) {
      const firstValue = Number(track.values[axis]);
      const displacement =
        Number(track.values[lastFrame * 3 + axis]) - firstValue;
      const removeTravel =
        Number.isFinite(displacement) &&
        Math.abs(displacement) > Math.max(0, travelThreshold);
      const restBaselineVertical = normalizeVerticalTravel && axis === 1;
      if (!Number.isFinite(firstValue) || !Number.isFinite(displacement))
        return source.clone();
      if (!removeTravel && !restBaselineVertical) continue;
      for (let frame = 0; frame < track.times.length; frame += 1) {
        const time = Number(track.times[frame]);
        const valueIndex = frame * 3 + axis;
        const currentValue = track.values[valueIndex];
        if (
          !Number.isFinite(time) ||
          typeof currentValue !== "number" ||
          !Number.isFinite(currentValue)
        )
          return source.clone();
        const progress = (time - firstTime) / (lastTime - firstTime);
        track.values[valueIndex] =
          currentValue -
          (removeTravel ? displacement * progress : 0) -
          (restBaselineVertical ? firstValue : 0);
      }
    }
  }
  return clip;
}
