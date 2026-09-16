import { useCallback, useEffect, useRef } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { REPOSITORY_ASSET_BY_ID } from "./repository-asset-manifest.js";
import {
  worldFloorBounds,
  type RepositoryCityInstance,
} from "./repository-city-state.js";
import { rotateWorldScreen } from "./world-screen-types.js";

export type RepositoryCityInteraction = {
  readonly floorSize: number;
  readonly onTransform: (
    id: string,
    position: { x: number; z: number },
    yaw: number,
  ) => void;
  readonly onDragging: (dragging: boolean) => void;
};

/** Manual decoration only; repository-bound objects retain live layout authority. */
export function useRepositoryPropDrag(interaction?: RepositoryCityInteraction) {
  const { camera, gl, invalidate } = useThree();
  const latest = useRef(interaction);
  latest.current = interaction;
  const drag = useRef<{
    instance: RepositoryCityInstance;
    pointerId: number;
    offset: Vector3;
    position: { x: number; z: number };
    yaw: number;
  } | null>(null);
  const ray = useRef(new Raycaster());
  const ground = useRef(new Plane(new Vector3(0, 1, 0), 0));
  const point = useCallback(
    (x: number, y: number) => {
      const rect = gl.domElement.getBoundingClientRect();
      ray.current.setFromCamera(
        new Vector2(
          ((x - rect.left) / rect.width) * 2 - 1,
          1 - ((y - rect.top) / rect.height) * 2,
        ),
        camera,
      );
      return ray.current.ray.intersectPlane(ground.current, new Vector3());
    },
    [camera, gl],
  );
  useEffect(() => {
    const end = () => {
      if (!drag.current) return;
      drag.current = null;
      latest.current?.onDragging(false);
    };
    const move = (event: PointerEvent) => {
      const held = drag.current;
      if (!held || event.pointerId !== held.pointerId) return;
      if (!(event.buttons & 1)) {
        end();
        return;
      }
      const hit = point(event.clientX, event.clientY);
      const config = latest.current;
      if (!hit || !config) return;
      event.preventDefault();
      const bounds = worldFloorBounds(config.floorSize);
      const [width, depth] = REPOSITORY_ASSET_BY_ID.get(
        held.instance.assetId,
      )!.footprint;
      const radius = Math.hypot(width, depth) / 2;
      held.position = {
        x: Math.max(
          bounds.minX + radius,
          Math.min(bounds.maxX - radius, hit.x + held.offset.x),
        ),
        z: Math.max(
          bounds.minZ + radius,
          Math.min(bounds.maxZ - radius, hit.z + held.offset.z),
        ),
      };
      config.onTransform(held.instance.instanceId, held.position, held.yaw);
      invalidate();
    };
    const wheel = (event: WheelEvent) => {
      const held = drag.current;
      if (!held || event.ctrlKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      held.yaw = rotateWorldScreen(
        { ...held.position, yaw: held.yaw },
        event.deltaY,
        event.deltaMode,
      ).yaw;
      latest.current?.onTransform(
        held.instance.instanceId,
        held.position,
        held.yaw,
      );
      invalidate();
    };
    const release = (event: PointerEvent) => {
      if (event.pointerId === drag.current?.pointerId) end();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && drag.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        end();
      }
    };
    const visibility = () => {
      if (document.hidden) end();
    };
    window.addEventListener("pointermove", move, {
      capture: true,
      passive: false,
    });
    window.addEventListener("wheel", wheel, { capture: true, passive: false });
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    window.addEventListener("blur", end);
    window.addEventListener("keydown", escape, true);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      end();
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("wheel", wheel, true);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
      window.removeEventListener("blur", end);
      window.removeEventListener("keydown", escape, true);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [invalidate, point]);
  return (
    instance: RepositoryCityInstance,
    event: ThreeEvent<PointerEvent>,
  ) => {
    if (
      !latest.current ||
      !instance.manual ||
      event.button !== 0 ||
      drag.current ||
      document.pointerLockElement
    )
      return;
    const hit = point(event.clientX, event.clientY);
    if (!hit) return;
    event.stopPropagation();
    drag.current = {
      instance,
      pointerId: event.pointerId,
      offset: new Vector3(
        instance.position.x - hit.x,
        0,
        instance.position.z - hit.z,
      ),
      position: instance.position,
      yaw: instance.yaw ?? 0,
    };
    latest.current.onDragging(true);
  };
}
