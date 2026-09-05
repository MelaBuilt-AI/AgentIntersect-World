import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BackSide, GridHelper, Group, Object3D } from "three";
import { useCodeTexture } from "./code-world-texture.js";
import {
  REPOSITORY_CITY_FLOOR_SIZE,
  worldFloorSize,
  type RepositoryCityInstance,
} from "./repository-city-state.js";
import {
  WORLD_SCREEN_SCALE,
  type WorldScreenBinding,
} from "./world-screen-types.js";

export function WorldEnvironment({
  floor,
  objectCount,
  instances,
  screens = [],
  userPosition,
}: {
  readonly floor: "blank" | "repository";
  readonly objectCount: number;
  readonly instances: readonly RepositoryCityInstance[];
  readonly screens?: readonly WorldScreenBinding[] | undefined;
  readonly userPosition: { readonly x: number; readonly z: number };
}) {
  const { camera, gl, invalidate } = useThree();
  const [extent, setExtent] = useState(REPOSITORY_CITY_FLOOR_SIZE);
  const size = worldFloorSize(extent, objectCount, instances, [
    { ...userPosition, radius: 10 },
    ...screens
      .filter((screen) => screen.spatial)
      .map((screen) => ({
        ...screen.pose,
        radius: (screen.width * WORLD_SCREEN_SCALE) / 2,
      })),
  ]);
  if (size > extent) setExtent(size);
  const floorTexture = useCodeTexture("12_repository_map_floor");
  const skyTexture = useCodeTexture("16_constellation_graph_sky");
  const sky = useRef<Group>(null);
  const lightTarget = useMemo(() => new Object3D(), []);
  const grid = useMemo(() => {
    const object = new GridHelper(size, size / 4, "#277099", "#122c48");
    object.position.y = 0.008;
    return object;
  }, [size]);
  useEffect(() => {
    floorTexture?.repeat.set(size / 12, size / 12);
    skyTexture?.repeat.set(6, 3);
    gl.domElement.dataset.worldFloorSize = String(size);
    gl.domElement.dataset.worldTexturesReady = String(
      Boolean(floorTexture && skyTexture),
    );
    invalidate();
  }, [floorTexture, gl, invalidate, size, skyTexture]);
  useEffect(() => {
    lightTarget.position.set(userPosition.x, 0, userPosition.z);
    lightTarget.updateMatrixWorld();
    invalidate();
  }, [invalidate, lightTarget, userPosition.x, userPosition.z]);
  useEffect(
    () => () => {
      grid.geometry.dispose();
      const materials = Array.isArray(grid.material)
        ? grid.material
        : [grid.material];
      for (const material of materials) material.dispose();
    },
    [grid],
  );
  useFrame(() => {
    sky.current?.position.copy(camera.position);
  });
  return (
    <group name="world-code-environment">
      <ambientLight color="#bbd3eb" intensity={0.85} />
      <directionalLight
        color="#e2f5ff"
        intensity={2.1}
        position={[userPosition.x + 12, 18, userPosition.z + 8]}
        target={lightTarget}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={1}
        shadow-camera-far={65}
        shadow-bias={-0.0004}
        shadow-normalBias={0.035}
      />
      <primitive object={lightTarget} />
      <directionalLight
        color="#9284e8"
        intensity={0.55}
        position={[-12, 8, -14]}
      />
      <mesh
        name={`world-room-${floor}-floor`}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[size, size, 1]}
        receiveShadow
      >
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          onUpdate={(material) => {
            material.needsUpdate = true;
          }}
          map={floorTexture}
          emissiveMap={floorTexture}
          color="#9bb4d0"
          emissive="#477ea9"
          emissiveIntensity={0.12}
          roughness={0.82}
          metalness={0.12}
        />
      </mesh>
      <primitive object={grid} />
      <group ref={sky} name="world-code-sky">
        <mesh renderOrder={-10}>
          <sphereGeometry args={[450, 48, 24]} />
          <meshBasicMaterial
            onUpdate={(material) => {
              material.needsUpdate = true;
            }}
            map={skyTexture}
            color="#7892b8"
            side={BackSide}
            depthWrite={false}
            fog={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
