import type { AnimationClip, AnimationMixer, KeyframeTrack } from "three";

export const IMPORTED_AVATAR_CROSSFADE_SECONDS = 0.22;

export type ImportedAvatarCrossfadeAction = {
  fadeOut(seconds: number): unknown;
  reset(): unknown;
  setEffectiveWeight(weight: number): unknown;
  fadeIn(seconds: number): unknown;
  play(): unknown;
};

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

const isHipPositionTrack = (track: KeyframeTrack): boolean => {
  const name = track.name.toLocaleLowerCase();
  return (
    (/(^|[^a-z])hip([^a-z]|$)/u.test(name) ||
      /hip(?:\]|\})?\.position$/u.test(name)) &&
    /(?:\.|\]|\/|:|\|)position$/u.test(name)
  );
};

const vectorPositionTrack = (
  track: KeyframeTrack,
): VectorPositionTrack | undefined => {
  const candidate = track as Partial<VectorPositionTrack>;
  if (
    !isHipPositionTrack(track) ||
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
): AnimationClip {
  const clip = source.clone();
  const track = clip.tracks
    .map(vectorPositionTrack)
    .find((candidate) => candidate !== undefined);
  if (!track) return clip;

  const lastFrame = track.times.length - 1;
  const firstTime = Number(track.times[0]);
  const lastTime = Number(track.times[lastFrame]);
  if (
    !Number.isFinite(firstTime) ||
    !Number.isFinite(lastTime) ||
    lastTime <= firstTime
  )
    return clip;

  const deltas = [0, 1, 2].map(
    (axis) =>
      Number(track.values[lastFrame * 3 + axis]) - Number(track.values[axis]),
  );
  if (deltas.some((delta) => !Number.isFinite(delta))) return clip;
  const dominantAxis = deltas.reduce(
    (best, _, axis) =>
      Math.abs(deltas[axis] ?? 0) > Math.abs(deltas[best] ?? 0) ? axis : best,
    0,
  );
  const displacement = deltas[dominantAxis] ?? 0;
  if (Math.abs(displacement) <= Math.max(0, travelThreshold)) return clip;

  for (let frame = 0; frame < track.times.length; frame += 1) {
    const time = Number(track.times[frame]);
    const valueIndex = frame * 3 + dominantAxis;
    const currentValue = track.values[valueIndex];
    if (
      !Number.isFinite(time) ||
      typeof currentValue !== "number" ||
      !Number.isFinite(currentValue)
    )
      return source.clone();
    const progress = (time - firstTime) / (lastTime - firstTime);
    track.values[valueIndex] = currentValue - displacement * progress;
  }
  return clip;
}
