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
import { WorldScreenContext, SCREEN_KEYS } from "./world-screen-context.js";

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
      const view = anchor.current;
      const side = { director: -4.7, workbench: 0, preview: 5.6, code: 0 }[id];
      setPoses((current) =>
        current[id]
          ? current
          : {
              ...current,
              [id]: {
                x: view.x + Math.sin(view.yaw) * 6 + Math.cos(view.yaw) * side,
                z: view.z - Math.cos(view.yaw) * 6 + Math.sin(view.yaw) * side,
                yaw: -view.yaw,
              },
            },
      );
      setModes((current) => ({ ...current, [id]: !current[id] }));
      if (document.pointerLockElement) document.exitPointerLock();
    },
    [dragging, enabled],
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
  const value = useMemo(
    () => ({
      enabled,
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
