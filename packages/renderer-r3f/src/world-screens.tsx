import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  NoBlending,
  Matrix4,
  Plane,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import {
  WORLD_SCREEN_CENTER_Y,
  WORLD_SCREEN_SCALE,
  type WorldScreenBinding,
  type WorldScreenId,
  type WorldScreenPose,
} from "./world-screen-types.js";

export type WorldScreensProps = {
  readonly screenEventSource?: HTMLElement | undefined;
  readonly screens?: readonly WorldScreenBinding[] | undefined;
  readonly onScreenMove?:
    ((id: WorldScreenId, pose: WorldScreenPose) => void) | undefined;
  readonly onScreenDrag?: ((dragging: boolean) => void) | undefined;
};
const EMPTY_SCREENS: readonly WorldScreenBinding[] = [];
const ground = new Plane(new Vector3(0, 1, 0), -0.16);

// Same coordinate conversion as Three's CSS3DRenderer, without reparenting
// live DOM/iframes (which would reload them every time they dock/undock).
export function screenCameraCss(matrix: Matrix4): string {
  const e = matrix.elements;
  return `matrix3d(${e.map((value, index) => ([1, 5, 9, 13].includes(index) ? -value : value)).join(",")})`;
}
export function screenObjectCss(matrix: Matrix4): string {
  const e = matrix.elements;
  return `translate(-50%,-50%) matrix3d(${e.map((value, index) => (index >= 4 && index <= 7 ? -value : value)).join(",")})`;
}

export function WorldScreens({
  screens = EMPTY_SCREENS,
  onScreenMove,
  onScreenDrag,
}: WorldScreensProps) {
  const { camera, gl, size, invalidate } = useThree();
  const drag = useRef<{
    id: WorldScreenId;
    pointerId: number;
    pose: WorldScreenPose;
    offset: Vector3;
  } | null>(null);
  const scratch = useRef({
    ray: new Raycaster(),
    pointer: new Vector2(),
    hit: new Vector3(),
    matrix: new Matrix4(),
    position: new Vector3(),
    rotation: new Quaternion(),
    scale: new Vector3(
      WORLD_SCREEN_SCALE,
      WORLD_SCREEN_SCALE,
      WORLD_SCREEN_SCALE,
    ),
  });

  useEffect(() => {
    const tools = scratch.current;
    const point = (x: number, y: number) => {
      const rect = gl.domElement.getBoundingClientRect();
      tools.pointer.set(
        ((x - rect.left) / rect.width) * 2 - 1,
        (-(y - rect.top) / rect.height) * 2 + 1,
      );
      tools.ray.setFromCamera(tools.pointer, camera);
      return tools.ray.ray.intersectPlane(ground, tools.hit);
    };
    for (const screen of screens) {
      screen.startDrag = (x, y, pointerId) => {
        if (!screen.spatial || screen.movable === false || drag.current) return;
        const hit = point(x, y);
        if (!hit) return;
        drag.current = {
          id: screen.id,
          pointerId,
          pose: screen.pose,
          offset: new Vector3(screen.pose.x - hit.x, 0, screen.pose.z - hit.z),
        };
        onScreenDrag?.(true);
      };
    }
    const move = (event: PointerEvent) => {
      const active = drag.current;
      if (!active || event.pointerId !== active.pointerId) return;
      if (!(event.buttons & 1)) {
        end();
        return;
      }
      event.preventDefault();
      const hit = point(event.clientX, event.clientY);
      if (!hit) return;
      onScreenMove?.(active.id, {
        ...active.pose,
        x: Math.max(-60, Math.min(60, hit.x + active.offset.x)),
        z: Math.max(-60, Math.min(60, hit.z + active.offset.z)),
      });
      invalidate();
    };
    const end = () => {
      if (!drag.current) return;
      drag.current = null;
      onScreenDrag?.(false);
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
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    window.addEventListener("blur", end);
    window.addEventListener("keydown", escape, true);
    document.addEventListener("visibilitychange", visibility);
    invalidate();
    return () => {
      for (const screen of screens) delete screen.startDrag;
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
      window.removeEventListener("blur", end);
      window.removeEventListener("keydown", escape, true);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [camera, gl, invalidate, onScreenDrag, onScreenMove, screens]);
  useEffect(
    () => () => {
      drag.current = null;
      onScreenDrag?.(false);
    },
    [onScreenDrag],
  );

  const focusedScreen = screens.find(
    (screen) => screen.spatial && screen.focused,
  );
  useEffect(() => {
    if (!focusedScreen) return;
    const position = camera.position.clone();
    const rotation = camera.quaternion.clone();
    invalidate();
    return () => {
      camera.position.copy(position);
      camera.quaternion.copy(rotation);
      camera.updateMatrixWorld();
      invalidate();
    };
  }, [camera, focusedScreen, invalidate]);

  useFrame(() => {
    if (focusedScreen) {
      const distance =
        Math.max(
          (focusedScreen.height *
            WORLD_SCREEN_SCALE *
            camera.projectionMatrix.elements[5]!) /
            2,
          (focusedScreen.width *
            WORLD_SCREEN_SCALE *
            camera.projectionMatrix.elements[0]!) /
            2,
        ) * 1.18;
      camera.position.set(
        focusedScreen.pose.x + Math.sin(focusedScreen.pose.yaw) * distance,
        WORLD_SCREEN_CENTER_Y,
        focusedScreen.pose.z + Math.cos(focusedScreen.pose.yaw) * distance,
      );
      camera.lookAt(
        focusedScreen.pose.x,
        WORLD_SCREEN_CENTER_Y,
        focusedScreen.pose.z,
      );
      camera.updateMatrixWorld();
    }
    const tools = scratch.current;
    const perspective =
      (camera.projectionMatrix.elements[5]! * size.height) / 2;
    const cameraTransform = `translateZ(${perspective}px) ${screenCameraCss(camera.matrixWorldInverse)} translate(${size.width / 2}px,${size.height / 2}px)`;
    for (const screen of screens) {
      if (!screen.spatial) {
        screen.viewport.style.cssText = "";
        screen.cameraElement.style.cssText = "";
        screen.element.style.transform = "";
        screen.element.style.visibility = "";
        screen.element.inert = false;
        continue;
      }
      screen.viewport.style.perspective = `${perspective}px`;
      screen.cameraElement.style.transform = cameraTransform;
      screen.cameraElement.style.width = `${size.width}px`;
      screen.cameraElement.style.height = `${size.height}px`;
      tools.position.set(
        screen.pose.x,
        WORLD_SCREEN_CENTER_Y,
        screen.pose.z + 0.01,
      );
      tools.rotation.setFromAxisAngle(new Vector3(0, 1, 0), screen.pose.yaw);
      tools.matrix.compose(tools.position, tools.rotation, tools.scale);
      screen.element.style.transform = screenObjectCss(tools.matrix);
      const front =
        (camera.position.x - screen.pose.x) * Math.sin(screen.pose.yaw) +
          (camera.position.z - screen.pose.z) * Math.cos(screen.pose.yaw) >
        0;
      const depth = tools.position
        .clone()
        .applyMatrix4(camera.matrixWorldInverse).z;
      const visible = front && depth < -0.1;
      screen.element.style.visibility = visible ? "visible" : "hidden";
      screen.element.inert = !visible;
      // Overlapping screens obey camera distance rather than DOM mount order.
      screen.viewport.style.zIndex = String(
        1 + Math.round(8 / Math.max(1, -depth)),
      );
      screen.viewport.dataset.screenProjected = String(visible);
      tools.position
        .set(screen.pose.x, 0.16, screen.pose.z)
        .applyMatrix4(camera.matrixWorldInverse)
        .applyMatrix4(camera.projectionMatrix);
      const bounds = gl.domElement.getBoundingClientRect();
      screen.viewport.dataset.baseClientX = String(
        bounds.left + ((tools.position.x + 1) * size.width) / 2,
      );
      screen.viewport.dataset.baseClientY = String(
        bounds.top + ((1 - tools.position.y) * size.height) / 2,
      );
    }
  });

  return (
    <group name="world-spatial-screens">
      {screens
        .filter((screen) => screen.spatial)
        .map((screen) => {
          const width = screen.width * WORLD_SCREEN_SCALE;
          const height = screen.height * WORLD_SCREEN_SCALE;
          const standHeight = WORLD_SCREEN_CENTER_Y - height / 2 - 0.16;
          return (
            <group
              key={screen.id}
              name={`world-screen-${screen.id}`}
              position={[screen.pose.x, 0, screen.pose.z]}
              rotation={[0, screen.pose.yaw, 0]}
            >
              <mesh
                name={`world-screen-mask-${screen.id}`}
                position={[0, WORLD_SCREEN_CENTER_Y, 0.01]}
                renderOrder={-1}
              >
                <planeGeometry args={[width, height]} />
                <meshBasicMaterial
                  color="#000000"
                  blending={NoBlending}
                  opacity={0}
                />
              </mesh>
              <mesh position={[0, WORLD_SCREEN_CENTER_Y, -0.11]}>
                <boxGeometry args={[width + 0.2, height + 0.2, 0.2]} />
                <meshStandardMaterial
                  color="#0c1728"
                  metalness={0.65}
                  roughness={0.3}
                />
              </mesh>
              <mesh position={[0, 0.16 + standHeight / 2, -0.12]}>
                <boxGeometry args={[0.18, standHeight, 0.18]} />
                <meshStandardMaterial
                  color="#36506b"
                  metalness={0.75}
                  roughness={0.25}
                />
              </mesh>
              <mesh
                name={`world-screen-base-${screen.id}`}
                position={[0, 0.16, 0]}
                onPointerDown={(event: {
                  button: number;
                  clientX: number;
                  clientY: number;
                  pointerId: number;
                  stopPropagation: () => void;
                }) => {
                  if (event.button !== 0) return;
                  event.stopPropagation();
                  screen.startDrag?.(
                    event.clientX,
                    event.clientY,
                    event.pointerId,
                  );
                }}
                onPointerOver={() => {
                  gl.domElement.style.cursor = "grab";
                }}
                onPointerOut={() => {
                  gl.domElement.style.cursor = "";
                }}
              >
                <boxGeometry args={[width * 0.65, 0.32, 1.2]} />
                <meshStandardMaterial
                  color="#1575be"
                  emissive="#073657"
                  metalness={0.55}
                  roughness={0.35}
                />
              </mesh>
            </group>
          );
        })}
    </group>
  );
}
