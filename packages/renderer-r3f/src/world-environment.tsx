import { WorldSun } from "./world-sun.js";
import {
  CodeSkyMaterial,
  CodeFloorMaterial,
} from "./environment-node-materials.js";
import { useContext, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Fog, GridHelper, Group } from "three";
import {
  CODE_SKY_LAYERS,
  animateCodeSky,
  useCodeTexture,
} from "./code-world-texture.js";

import { WorldGraphicsContext } from "./world-graphics-context.js";
import { WorldBloom, WorldWetFloor } from "./world-atmosphere-effects.js";

export function WorldEnvironment({
  floor,
  size,
  reducedMotion,
  onReady,
  active = true,
  postprocessing = true,
  lighting = true,
}: {
  readonly lighting?: boolean;
  readonly active?: boolean;
  readonly postprocessing?: boolean;
  readonly floor: "blank" | "repository";
  readonly size: number;
  readonly onReady?: (() => void) | undefined;
  readonly reducedMotion: boolean;
  readonly userPosition: { readonly x: number; readonly z: number };
}) {
  const graphics = useContext(WorldGraphicsContext);
  const { camera, gl, invalidate, scene } = useThree();
  useEffect(() => {
    if (!active || !lighting) return;
    const previous = scene.fog;
    if (floor === "repository") scene.fog = new Fog("#061321", 24, 130);
    return () => {
      scene.fog = previous;
    };
  }, [active, lighting, floor, scene]);
  const floorTexture = useCodeTexture(
    "12_repository_map_floor",
    "floor",
    reducedMotion || !active,
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

  const grid = useMemo(() => {
    const object = new GridHelper(size, size / 4, "#277099", "#122c48");
    object.name = "world-floor-grid";
    object.position.y = 0.008;
    return object;
  }, [size]);
  useEffect(() => {
    floorTexture?.repeat.set(size / 12, size / 12);
    // Original sky density is owned solely by codeSkyMaterial's sampling UVs.
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
    if (!active) return;
    // Reveal the decoded environment first; avatars assemble separately.
    if (floorTexture && rainTexture && auroraTexture && nebulaTexture) {
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
    <group name="world-code-environment" visible={active}>
      {postprocessing && (graphics.bloom || graphics.antialiasing) ? (
        <WorldBloom
          bloom={graphics.bloom}
          antialiasing={graphics.antialiasing}
        />
      ) : null}
      {floor === "repository" && graphics.wetFloorReflections ? (
        <WorldWetFloor size={size} />
      ) : null}
      {lighting ? <ambientLight color="#bbd3eb" intensity={1.8} /> : null}
      {lighting ? <WorldSun color="#e2f5ff" intensity={2.1} /> : null}
      {lighting ? (
        <directionalLight
          color={floor === "repository" ? "#43bfff" : "#9284e8"}
          intensity={floor === "repository" ? 0.8 : 0.55}
          position={[-12, 8, -14]}
        />
      ) : null}
      <mesh
        name={`world-room-${floor}-floor`}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[size, size, 1]}
        receiveShadow
      >
        <planeGeometry args={[1, 1]} />
        <CodeFloorMaterial map={floorTexture} />
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
            <CodeSkyMaterial
              map={skyTextures[layer.kind]}
              clock={skyTime}
              layer={index}
              opacity={layer.opacity}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
