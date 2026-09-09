import { useEffect, useRef } from "react";
import {
  REPOSITORY_CITY_FLOOR_SIZE,
  worldFloorBounds,
} from "./repository-city-state.js";
import { useCodeTexture } from "./code-world-texture.js";
import { useFrame, useThree } from "@react-three/fiber";
import {
  NoBlending,
  DoubleSide,
  AdditiveBlending,
  Group,
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
  WORLD_SCREEN_SHELL_PADDING,
  WORLD_SCREEN_SHELL_DEPTH,
  WORLD_SCREEN_SHELL_Z,
  rotateWorldScreen,
  worldScreenReveal,
  type WorldScreenBinding,
  type WorldScreenId,
  type WorldScreenPose,
} from "./world-screen-types.js";

export type WorldScreensProps = {
  readonly floorSize?: number | undefined;
  readonly reducedMotion?: boolean | undefined;
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
  floorSize = REPOSITORY_CITY_FLOOR_SIZE,
  reducedMotion = false,
  onScreenMove,
  onScreenDrag,
}: WorldScreensProps) {
  const { camera, gl, size, invalidate } = useThree();
  const screenTexture = useCodeTexture(
    "02_terminal_rain",
    "screen",
    reducedMotion,
  );
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
    const bounds = worldFloorBounds(floorSize);
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
      // Use the actual active renderer camera, never an approximate second camera.
      screen.projectPlacement = (
        pose,
        width = screen.width,
        height = screen.height,
      ) => {
        const bounds = gl.domElement.getBoundingClientRect();
        const points = [-1, 1].flatMap((horizontal) =>
          [-1, 1].map((vertical) => {
            const halfWidth = (width * WORLD_SCREEN_SCALE) / 2;
            return new Vector3(
              pose.x + horizontal * halfWidth * Math.cos(pose.yaw),
              (pose.y ?? WORLD_SCREEN_CENTER_Y) +
                (vertical * height * WORLD_SCREEN_SCALE) / 2,
              pose.z - horizontal * halfWidth * Math.sin(pose.yaw),
            )
              .applyMatrix4(camera.matrixWorldInverse)
              .applyMatrix4(camera.projectionMatrix);
          }),
        );
        if (points.some((point) => point.z < -1 || point.z > 1)) return null;
        return {
          left:
            bounds.left +
            ((1 + Math.min(...points.map((point) => point.x))) * bounds.width) /
              2,
          right:
            bounds.left +
            ((1 + Math.max(...points.map((point) => point.x))) * bounds.width) /
              2,
          top:
            bounds.top +
            ((1 - Math.max(...points.map((point) => point.y))) *
              bounds.height) /
              2,
          bottom:
            bounds.top +
            ((1 - Math.min(...points.map((point) => point.y))) *
              bounds.height) /
              2,
        };
      };
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
      active.pose = {
        ...active.pose,
        x: Math.max(
          bounds.minX,
          Math.min(bounds.maxX, hit.x + active.offset.x),
        ),
        z: Math.max(
          bounds.minZ,
          Math.min(bounds.maxZ, hit.z + active.offset.z),
        ),
      };
      onScreenMove?.(active.id, active.pose);
      invalidate();
    };
    const wheel = (event: WheelEvent) => {
      const active = drag.current;
      if (!active || event.ctrlKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      active.pose = rotateWorldScreen(
        active.pose,
        event.deltaY,
        event.deltaMode,
      );
      onScreenMove?.(active.id, active.pose);
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
    window.addEventListener("wheel", wheel, { capture: true, passive: false });
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    window.addEventListener("blur", end);
    window.addEventListener("keydown", escape, true);
    document.addEventListener("visibilitychange", visibility);
    invalidate();
    return () => {
      for (const screen of screens) {
        delete screen.startDrag;
        delete screen.projectPlacement;
      }
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("wheel", wheel, true);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
      window.removeEventListener("blur", end);
      window.removeEventListener("keydown", escape, true);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [camera, floorSize, gl, invalidate, onScreenDrag, onScreenMove, screens]);
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
        focusedScreen.pose.y ?? WORLD_SCREEN_CENTER_Y,
        focusedScreen.pose.z + Math.cos(focusedScreen.pose.yaw) * distance,
      );
      camera.lookAt(
        focusedScreen.pose.x,
        focusedScreen.pose.y ?? WORLD_SCREEN_CENTER_Y,
        focusedScreen.pose.z,
      );
      camera.updateMatrixWorld();
    }
    const tools = scratch.current;
    const perspective =
      (camera.projectionMatrix.elements[5]! * size.height) / 2;
    const cameraTransform = `translateZ(${perspective}px) ${screenCameraCss(camera.matrixWorldInverse)} translate(${size.width / 2}px,${size.height / 2}px)`;
    // Stable, distinct ranks: reciprocal-distance rounding made far panels
    // share z-index, allowing DOM order to show them through nearer code.
    const depthOrder = screens
      .filter((screen) => screen.spatial)
      .map((screen) => ({
        screen,
        depth: new Vector3(
          screen.pose.x,
          screen.pose.y ?? WORLD_SCREEN_CENTER_Y,
          screen.pose.z,
        ).applyMatrix4(camera.matrixWorldInverse).z,
      }))
      .sort((a, b) => a.depth - b.depth);
    const ranks = new Map(
      depthOrder.map(({ screen }, index) => [screen.id, index + 1]),
    );
    for (const screen of screens) {
      if (!screen.spatial) {
        screen.viewport.style.cssText = "";
        screen.cameraElement.style.cssText = "";
        screen.element.style.transform = "";
        screen.element.style.visibility = "";
        screen.element.style.clipPath = "";
        screen.element.inert = false;
        continue;
      }
      screen.viewport.style.perspective = `${perspective}px`;
      screen.cameraElement.style.transform = cameraTransform;
      screen.cameraElement.style.width = `${size.width}px`;
      screen.cameraElement.style.height = `${size.height}px`;
      tools.position.set(
        screen.pose.x,
        screen.pose.y ?? WORLD_SCREEN_CENTER_Y,
        screen.pose.z,
      );
      tools.rotation.setFromAxisAngle(new Vector3(0, 1, 0), screen.pose.yaw);
      tools.matrix.compose(tools.position, tools.rotation, tools.scale);
      screen.element.style.transform = screenObjectCss(tools.matrix);
      const reveal =
        screen.revealStartedAt === undefined
          ? 1
          : worldScreenReveal(
              (performance.now() - screen.revealStartedAt) / 1000,
              screen.reducedMotion ?? false,
            );
      screen.element.style.clipPath =
        reveal < 1 ? `inset(${(1 - reveal) * 100}% 0 0)` : "";
      screen.viewport.dataset.screenReveal = reveal.toFixed(3);
      if (reveal < 1) invalidate();
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
        screen.focused ? 15 : ranks.get(screen.id),
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
  }, -1); // Focus camera before sky/scene callbacks sample it; retain automatic rendering.

  return (
    <group name="world-spatial-screens">
      {screens
        .filter((screen) => screen.spatial)
        .map((screen) => (
          <ProjectedScreen
            key={screen.id}
            screen={screen}
            texture={screenTexture}
          />
        ))}
    </group>
  );
}

function ProjectedScreen({
  screen,
  texture,
}: {
  readonly screen: WorldScreenBinding;
  readonly texture: import("three").Texture | null;
}) {
  const face = useRef<Group>(null);
  const { invalidate } = useThree();
  const width = screen.width * WORLD_SCREEN_SCALE;
  const height = screen.height * WORLD_SCREEN_SCALE;
  const bottom = (screen.pose.y ?? WORLD_SCREEN_CENTER_Y) - height / 2;
  const originY = screen.id === "code" ? 1.15 : 0;
  const beamHeight = bottom - originY;
  useFrame(() => {
    if (!face.current) return;
    const reveal =
      screen.revealStartedAt === undefined
        ? 1
        : worldScreenReveal(
            (performance.now() - screen.revealStartedAt) / 1000,
            screen.reducedMotion ?? false,
          );
    face.current.scale.y = Math.max(0.001, reveal);
    face.current.position.y = bottom + (height * reveal) / 2;
    if (reveal < 1) invalidate();
  });
  return (
    <group
      name={`world-screen-${screen.id}`}
      position={[screen.pose.x, 0, screen.pose.z]}
      rotation={[0, screen.pose.yaw, 0]}
    >
      <group ref={face} position={[0, bottom + height / 2, 0]}>
        <mesh
          name={`world-screen-mask-${screen.id}`}
          position={[0, 0, 0.01]}
          renderOrder={-1}
        >
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial
            color="#000000"
            blending={NoBlending}
            opacity={0}
          />
        </mesh>
        <mesh
          name={`world-screen-code-shell-${screen.id}`}
          position={[0, 0, WORLD_SCREEN_SHELL_Z]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[
              width + 2 * WORLD_SCREEN_SHELL_PADDING,
              height + 2 * WORLD_SCREEN_SHELL_PADDING,
              WORLD_SCREEN_SHELL_DEPTH,
            ]}
          />
          <meshStandardMaterial
            onUpdate={(material) => {
              material.needsUpdate = true;
            }}
            map={texture}
            emissiveMap={texture}
            color="#b5e8fa"
            emissive="#5bd9ff"
            emissiveIntensity={0.55}
            metalness={0.25}
            roughness={0.55}
          />
        </mesh>
      </group>
      {/* Light only: no stand, physical base, raycast handler or drag authority. */}
      <group name={`world-screen-projection-${screen.id}`}>
        <mesh
          position={[0, originY + beamHeight / 2, -0.1]}
          scale={[width / 2, beamHeight, 0.34]}
        >
          <cylinderGeometry args={[1, 0.06, 1, 4, 1, true]} />
          <meshBasicMaterial
            color="#36dfff"
            transparent
            opacity={0.1}
            blending={AdditiveBlending}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh
          position={[0, originY + 0.015, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[1, 0.36, 1]}
        >
          <ringGeometry args={[0.18, 0.8, 48]} />
          <meshBasicMaterial
            color="#43e5ff"
            transparent
            opacity={0.32}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}
