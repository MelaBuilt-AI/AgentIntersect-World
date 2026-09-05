export type WorldScreenId = "director" | "workbench" | "preview" | "code";
export type WorldScreenPose = {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
};

type ScreenElement = {
  readonly style: Record<
    | "cssText"
    | "transform"
    | "perspective"
    | "visibility"
    | "width"
    | "height"
    | "zIndex",
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
  readonly pose: WorldScreenPose;
  readonly width: number;
  readonly height: number;
  readonly viewport: ScreenElement;
  readonly cameraElement: ScreenElement;
  readonly element: ScreenElement;
};

export const WORLD_SCREEN_SCALE = 0.006;
export const WORLD_SCREEN_CENTER_Y = 2.6;
