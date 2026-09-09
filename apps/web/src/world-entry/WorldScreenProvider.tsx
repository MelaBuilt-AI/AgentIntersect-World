import { audioCue, heldAudioState } from "../audio/world-audio.js";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  WorldScreenBinding,
  WorldScreenId,
  WorldScreenPose,
} from "@agentintersect-world/renderer-r3f";
import {
  WorldScreenContext,
  SCREEN_KEYS,
  SCREEN_DIMENSIONS,
} from "./world-screen-context.js";
import {
  nearestScreenPlacement,
  type ScreenPlacementScene,
} from "./world-screen-placement.js";

export function WorldScreenProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [enabled, setEnabled] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [modes, setModes] = useState<Partial<Record<WorldScreenId, boolean>>>(
    {},
  );
  const [poses, setPoses] = useState<
    Partial<Record<WorldScreenId, WorldScreenPose>>
  >({});
  const [screens, setScreens] = useState<readonly WorldScreenBinding[]>([]);
  const anchor = useRef({ x: 0, z: 0, yaw: 0 });
  const placementScene = useRef<ScreenPlacementScene>({
    floorSize: 68,
    obstacles: [],
  });
  const [placementMessage, setPlacementMessage] = useState<string | null>(null);
  const updatePlacementScene = useCallback((scene: ScreenPlacementScene) => {
    placementScene.current = scene;
  }, []);
  const updateAnchor = useCallback((pose: WorldScreenPose) => {
    anchor.current = pose;
  }, []);
  const register = useCallback((binding: WorldScreenBinding) => {
    setScreens((current) => [
      ...current.filter(({ id }) => id !== binding.id),
      binding,
    ]);
    return () =>
      setScreens((current) => current.filter((item) => item !== binding));
  }, []);
  const move = useCallback((id: WorldScreenId, pose: WorldScreenPose) => {
    setPoses((current) => ({ ...current, [id]: pose }));
  }, []);
  const toggle = useCallback(
    (id: WorldScreenId) => {
      if (!enabled || dragging) return;
      setPlacementMessage(null);
      if (!modes[id] && !poses[id]) {
        const obstacles = [
          ...placementScene.current.obstacles,
          ...screens
            .filter((screen) => screen.spatial && screen.id !== id)
            .map((screen) => ({
              x: screen.pose.x,
              z: screen.pose.z,
              halfWidth:
                Math.abs(Math.cos(screen.pose.yaw)) * screen.width * 0.003 +
                0.5,
              halfDepth:
                Math.abs(Math.sin(screen.pose.yaw)) * screen.width * 0.003 +
                0.5,
            })),
        ];
        // Every binding uses the same renderer camera. A new binding may not
        // have its callback yet; use any ready one with explicit dimensions.
        const projectedBounds = screens.find(
          (screen) => screen.projectPlacement,
        )?.projectPlacement;
        if (!projectedBounds) {
          setPlacementMessage(
            "Screen projection is getting ready. Try again in a moment.",
          );
          return;
        }
        const occupiedBounds = screens
          .filter((screen) => screen.id !== id)
          .flatMap((screen) => {
            if (screen.spatial) {
              // Project the current pose even before the next CSS3D paint.
              const bounds = projectedBounds(
                screen.pose,
                screen.width,
                screen.height,
              );
              return bounds ? [bounds] : [];
            }
            // HUD wrappers use display:contents; measure their mounted children.
            return Array.from(screen.element.children ?? []).map((child) =>
              child.getBoundingClientRect(),
            );
          })
          .concat(
            Array.from(
              document.querySelectorAll(".world-room__controls"),
              (element) => element.getBoundingClientRect(),
            ),
          )
          .filter(
            (bounds) =>
              bounds.right > bounds.left && bounds.bottom > bounds.top,
          );
        const pose = nearestScreenPlacement(
          anchor.current,
          SCREEN_DIMENSIONS[id][0],
          { ...placementScene.current, obstacles },
          (candidate) => {
            const bounds = projectedBounds(candidate, ...SCREEN_DIMENSIONS[id]);
            return Boolean(
              bounds &&
              bounds.left >= 8 &&
              bounds.top >= 8 &&
              bounds.right <= window.innerWidth - 8 &&
              bounds.bottom <= window.innerHeight - 8 &&
              occupiedBounds.every(
                (occupied) =>
                  bounds.right < occupied.left ||
                  bounds.left > occupied.right ||
                  bounds.bottom < occupied.top ||
                  bounds.top > occupied.bottom,
              ),
            );
          },
        );
        if (!pose) {
          setPlacementMessage(
            "No clear screen space nearby. Move to an open part of the floor and try again.",
          );
          return;
        }
        setPoses((current) => ({ ...current, [id]: pose }));
      }
      audioCue(modes[id] ? "projection-off" : "projection-on");
      setModes((current) => ({ ...current, [id]: !current[id] }));
      if (document.pointerLockElement) document.exitPointerLock();
    },
    [dragging, enabled, modes, poses, screens],
  );
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        (event.target instanceof Element &&
          Boolean(
            event.target.closest(
              'input, textarea, select, [contenteditable="true"], [contenteditable=""]',
            ),
          ))
      )
        return;
      const id = (Object.keys(SCREEN_KEYS) as WorldScreenId[]).find(
        (candidate) => event.code === `Digit${SCREEN_KEYS[candidate]}`,
      );
      if (!id || id === "code" || !screens.some((screen) => screen.id === id))
        return;
      event.preventDefault();
      toggle(id);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [screens, toggle]);
  useEffect(() => {
    heldAudioState(dragging);
  }, [dragging]);
  useEffect(() => () => heldAudioState(false), []);
  const value = useMemo(
    () => ({
      enabled,
      placementMessage,
      updatePlacementScene,
      dragging,
      modes,
      poses,
      screens,
      toggle,
      register,
      move,
      setDragging,
      setEnabled,
      updateAnchor,
    }),
    [
      enabled,
      placementMessage,
      updatePlacementScene,
      dragging,
      modes,
      poses,
      screens,
      toggle,
      register,
      move,
      updateAnchor,
    ],
  );
  return (
    <WorldScreenContext.Provider value={value}>
      {children}
    </WorldScreenContext.Provider>
  );
}
