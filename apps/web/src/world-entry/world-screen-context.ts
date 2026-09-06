import { createContext, useContext } from "react";
import type {
  WorldScreenBinding,
  WorldScreenId,
  WorldScreenPose,
} from "@agentintersect-world/renderer-r3f";

export const SCREEN_LABELS = {
  director: "Live / Director",
  workbench: "Workbench",
  preview: "World View",
  code: "Repository code",
} as const;
export const SCREEN_KEYS = {
  director: "1",
  workbench: "2",
  preview: "3",
  code: "4",
} as const;
export const SCREEN_DIMENSIONS = {
  director: [620, 680],
  workbench: [720, 680],
  preview: [1100, 720],
  code: [880, 480],
} as const;
export const DEFAULT_SCREEN_POSE: WorldScreenPose = { x: 0, z: -6, yaw: 0 };

export type ScreenController = {
  readonly enabled: boolean;
  readonly dragging: boolean;
  readonly modes: Partial<Record<WorldScreenId, boolean>>;
  readonly poses: Partial<Record<WorldScreenId, WorldScreenPose>>;
  readonly screens: readonly WorldScreenBinding[];
  readonly toggle: (id: WorldScreenId) => void;
  readonly register: (binding: WorldScreenBinding) => () => void;
  readonly move: (id: WorldScreenId, pose: WorldScreenPose) => void;
  readonly setDragging: (dragging: boolean) => void;
  readonly setEnabled: (enabled: boolean) => void;
  readonly updateAnchor: (pose: WorldScreenPose) => void;
};
export const WorldScreenContext = createContext<ScreenController | null>(null);
export const useWorldScreens = () => useContext(WorldScreenContext);
export function useSpatialScreen(id: WorldScreenId): boolean {
  const screens = useWorldScreens();
  return Boolean(screens?.enabled && screens.modes[id]);
}
