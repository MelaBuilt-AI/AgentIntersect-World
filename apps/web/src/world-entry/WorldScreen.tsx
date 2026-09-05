import { useLayoutEffect, useRef, type ReactNode } from "react";
import type {
  WorldScreenBinding,
  WorldScreenId,
  WorldScreenPose,
} from "@agentintersect-world/renderer-r3f";
import {
  DEFAULT_SCREEN_POSE,
  SCREEN_DIMENSIONS,
  SCREEN_KEYS,
  SCREEN_LABELS,
  useSpatialScreen,
  useWorldScreens,
} from "./world-screen-context.js";

export function WorldScreenToggle({ id }: { readonly id: WorldScreenId }) {
  const controller = useWorldScreens();
  const spatial = useSpatialScreen(id);
  return (
    <button
      type="button"
      className="world-screen__toggle world-action--enabled"
      disabled={!controller?.enabled || controller.dragging}
      aria-keyshortcuts={`Alt+${SCREEN_KEYS[id]}`}
      title={
        controller?.enabled
          ? `Alt+${SCREEN_KEYS[id]} · toggle 2D / 3D`
          : "3D screens require the World renderer"
      }
      onClick={() => controller?.toggle(id)}
    >
      {spatial
        ? `Return ${SCREEN_LABELS[id]} to HUD`
        : `Place ${SCREEN_LABELS[id]} in World`}
      <small>Alt+{SCREEN_KEYS[id]}</small>
    </button>
  );
}

export function WorldScreen({
  id,
  children,
  spatial: controlledSpatial,
  pose: controlledPose,
  focused = false,
  movable = true,
  revealStartedAt,
  reducedMotion = false,
}: {
  readonly spatial?: boolean;
  readonly pose?: WorldScreenPose;
  readonly focused?: boolean;
  readonly movable?: boolean;
  readonly revealStartedAt?: number;
  readonly reducedMotion?: boolean;
  readonly id: WorldScreenId;
  readonly children: ReactNode;
}) {
  const controller = useWorldScreens();
  const defaultSpatial = useSpatialScreen(id);
  const spatial = controlledSpatial ?? defaultSpatial;
  const pose = controlledPose ?? controller?.poses[id] ?? DEFAULT_SCREEN_POSE;
  const [width, height] = SCREEN_DIMENSIONS[id];
  const viewport = useRef<HTMLDivElement>(null);
  const cameraElement = useRef<HTMLDivElement>(null);
  const element = useRef<HTMLDivElement>(null);
  const binding = useRef<WorldScreenBinding | null>(null);
  const register = controller?.register;
  useLayoutEffect(() => {
    if (
      !register ||
      !viewport.current ||
      !cameraElement.current ||
      !element.current
    )
      return;
    const screen: WorldScreenBinding = {
      id,
      spatial,
      focused,
      movable,
      ...(revealStartedAt === undefined ? {} : { revealStartedAt }),
      reducedMotion,
      pose,
      width,
      height,
      viewport: viewport.current,
      cameraElement: cameraElement.current,
      element: element.current,
    };
    binding.current = screen;
    const unregister = register(screen);
    return () => {
      binding.current = null;
      unregister();
    };
  }, [
    focused,
    height,
    id,
    movable,
    pose,
    reducedMotion,
    register,
    revealStartedAt,
    spatial,
    width,
  ]);
  return (
    <div
      ref={viewport}
      className={`world-screen world-screen--${spatial ? "spatial" : "hud"}`}
      data-world-screen={id}
      data-screen-mode={spatial ? "spatial" : "hud"}
      data-screen-x={pose.x}
      data-screen-z={pose.z}
      data-screen-yaw={pose.yaw}
      data-screen-dragging={Boolean(controller?.dragging)}
    >
      <div ref={cameraElement} className="world-screen__camera">
        <div
          ref={element}
          className="world-screen__object"
          style={spatial ? { width, height } : undefined}
        >
          {children}
          {movable ? (
            <button
              type="button"
              className="world-screen__base"
              hidden={!spatial}
              aria-label={`Move ${SCREEN_LABELS[id]} screen`}
              title="Left click and hold here to move · while holding, scroll to rotate · arrow keys to nudge"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                binding.current?.startDrag?.(
                  event.clientX,
                  event.clientY,
                  event.pointerId,
                );
              }}
              onKeyDown={(event) => {
                const delta = {
                  ArrowLeft: [-0.25, 0],
                  ArrowRight: [0.25, 0],
                  ArrowUp: [0, -0.25],
                  ArrowDown: [0, 0.25],
                }[event.key];
                if (!delta) return;
                event.preventDefault();
                event.stopPropagation();
                controller?.move(id, {
                  ...pose,
                  x: pose.x + delta[0]!,
                  z: pose.z + delta[1]!,
                });
              }}
            >
              ⠿ {SCREEN_LABELS[id]} · Hold here to move
              <small>Hold + scroll to rotate</small>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
