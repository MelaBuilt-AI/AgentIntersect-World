import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, BackSide, GridHelper, Group, Object3D } from "three";
import {
  CODE_SKY_LAYERS,
  animateCodeSky,
  configureCodeSky,
  useCodeTexture,
} from "./code-world-texture.js";

export function WorldEnvironment({
  floor,
  size,
  reducedMotion,
  userPosition,
  avatarsReady = true,
  onReady,
}: {
  readonly floor: "blank" | "repository";
  readonly size: number;
  readonly avatarsReady?: boolean;
  readonly onReady?: (() => void) | undefined;
  readonly reducedMotion: boolean;
  readonly userPosition: { readonly x: number; readonly z: number };
}) {
  const { camera, gl, invalidate } = useThree();
  const floorTexture = useCodeTexture(
    "12_repository_map_floor",
    "floor",
    reducedMotion,
  );
  const rainTexture = useCodeTexture("02_terminal_rain");
  const auroraTexture = useCodeTexture("17_aurora_code_sky");
  const nebulaTexture = useCodeTexture("15_code_nebula_sky");
  const skyTextures = {
    rain: rainTexture,
    aurora: auroraTexture,
    nebula: nebulaTexture,
  };
  const sky = useRef<Group>(null);
  const readyFrames = useRef(0);
  const skyTime = useMemo(() => ({ value: 0 }), []);
  const skyShaders = useMemo(
    () =>
      CODE_SKY_LAYERS.map(
        (layer) =>
          (shader: {
            uniforms: Record<string, unknown>;
            fragmentShader: string;
          }) =>
            configureCodeSky(shader, skyTime, layer.kind),
      ),
    [skyTime],
  );
  const lightTarget = useMemo(() => new Object3D(), []);
  const grid = useMemo(() => {
    const object = new GridHelper(size, size / 4, "#277099", "#122c48");
    object.position.y = 0.008;
    return object;
  }, [size]);
  useEffect(() => {
    floorTexture?.repeat.set(size / 12, size / 12);
    for (const texture of [rainTexture, auroraTexture, nebulaTexture])
      texture?.repeat.set(6, 3);
    gl.domElement.dataset.worldFloorSize = String(size);
    gl.domElement.dataset.worldTexturesReady = String(
      Boolean(floorTexture && rainTexture && auroraTexture && nebulaTexture),
    );
    invalidate();
  }, [
    floorTexture,
    gl,
    invalidate,
    size,
    rainTexture,
    auroraTexture,
    nebulaTexture,
  ]);
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
  useFrame((_, delta) => {
    // Reveal only after decoded maps and initialized poses have actually drawn.
    if (
      avatarsReady &&
      floorTexture &&
      rainTexture &&
      auroraTexture &&
      nebulaTexture
    ) {
      if (readyFrames.current < 3) {
        readyFrames.current += 1;
        if (readyFrames.current === 3) onReady?.();
        else invalidate(); // warm up even in reduced-motion demand mode
      }
    } else readyFrames.current = 0;
    if (!sky.current) return;
    sky.current.position.copy(camera.position);
    animateCodeSky(sky.current, skyTime, delta, reducedMotion);
    gl.domElement.dataset.skyRotation = sky.current.rotation.y.toFixed(6);
    gl.domElement.dataset.skyFlowTime = skyTime.value.toFixed(6);
    gl.domElement.dataset.skyLayers = "rain,aurora,nebula";
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
        {CODE_SKY_LAYERS.map((layer, index) => (
          <mesh
            key={layer.kind}
            name={`world-code-sky-${layer.kind}`}
            renderOrder={layer.renderOrder}
          >
            <sphereGeometry args={[layer.radius, 48, 24]} />
            <meshBasicMaterial
              onUpdate={(material) => {
                material.needsUpdate = true;
              }}
              onBeforeCompile={skyShaders[index]!}
              customProgramCacheKey={() => `aiw-streaming-sky-${layer.kind}-1`}
              map={skyTextures[layer.kind]}
              color="#ffffff"
              transparent
              opacity={layer.opacity}
              blending={AdditiveBlending}
              side={BackSide}
              depthWrite={false}
              fog={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
