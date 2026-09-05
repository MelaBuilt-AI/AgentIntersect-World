export type WorldScreenId = "director" | "workbench" | "preview" | "code";
export type WorldScreenPose = {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly y?: number;
};

type ScreenElement = {
  readonly style: Record<
    | "cssText"
    | "transform"
    | "perspective"
    | "visibility"
    | "width"
    | "height"
    | "zIndex"
    | "clipPath",
    string
  >;
  readonly dataset: Record<string, string | undefined>;
  inert: boolean;
};

/** DOM stays mounted in the app; the renderer owns only its camera transform. */
export type WorldScreenBinding = {
  startDrag?: (clientX: number, clientY: number, pointerId: number) => void;
  readonly id: WorldScreenId;
  readonly spatial: boolean;
  readonly focused?: boolean;
  readonly movable?: boolean;
  readonly revealStartedAt?: number;
  readonly reducedMotion?: boolean;
  readonly pose: WorldScreenPose;
  readonly width: number;
  readonly height: number;
  readonly viewport: ScreenElement;
  readonly cameraElement: ScreenElement;
  readonly element: ScreenElement;
};

export const WORLD_SCREEN_SCALE = 0.006;
export const WORLD_SCREEN_CENTER_Y = 2.6;

export function rotateWorldScreen(
  pose: WorldScreenPose,
  delta: number,
  mode: number,
): WorldScreenPose {
  const radians = delta * (mode === 1 ? 40 : mode === 2 ? 800 : 1) * 0.0025;
  const yaw = pose.yaw + radians;
  return { ...pose, yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)) };
}

export function worldScreenReveal(
  elapsedSeconds: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return 1;
  const t = Math.max(0, Math.min(1, elapsedSeconds / 0.65));
  return t * t * (3 - 2 * t);
}
