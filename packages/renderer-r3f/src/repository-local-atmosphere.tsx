import { useContext, useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { type InstancedMesh } from "three";
import { shaftMaterial, sparkMaterial } from "./repository-node-materials.js";
import { WorldGraphicsContext } from "./world-graphics-context.js";
import { RepositoryBaseFog } from "./repository-base-fog.js";
import type { CityRainClock } from "./repository-terminal-rain.js";

const noRaycast = () => {};

/** Low volume mist and the accepted crossed shafts / arrival sparks. */
export function RepositoryLocalAtmosphere({
  active = true,
  x,
  z,
  radius,
  roof,
  clock,
  settledAt,
  reducedMotion,
}: {
  readonly active?: boolean;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly roof: number;
  readonly clock: CityRainClock;
  readonly settledAt: number;
  readonly reducedMotion: boolean;
}) {
  const graphics = useContext(WorldGraphicsContext);

  const sparkMesh = useRef<InstancedMesh>(null);
  const skipSparks = useRef(reducedMotion);
  const sparkUniforms = useMemo(() => ({ age: { value: 0 } }), []);
  const shapes = useMemo(() => {
    const shaftPos: number[] = [],
      shaftUv: number[] = [];
    const quad = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    for (let side = 0; side < 2; side++)
      for (const [u, v] of quad) {
        const width = radius * (1.0 - v! * 0.8);
        shaftPos.push(
          side === 0 ? (u! - 0.5) * width : 0,
          v! * (roof + 10),
          side === 1 ? (u! - 0.5) * width : 0,
        );
        shaftUv.push(u!, v!);
      }
    const points = Array.from({ length: 36 }, (_, i) => [
      Math.sin(i * 13.3) * radius * 0.55,
      0.2 + (i % 7) * 0.12,
      Math.cos(i * 17.1) * radius * 0.55,
    ]).flat();
    return {
      shaftPos: new Float32Array(shaftPos),
      shaftUv: new Float32Array(shaftUv),
      points: new Float32Array(points),
    };
  }, [radius, roof]);
  const shaft = useMemo(() => shaftMaterial(), []);
  const sparks = useMemo(
    () => sparkMaterial(shapes.points, sparkUniforms.age),
    [shapes, sparkUniforms],
  );
  useEffect(
    () => () => {
      shaft.dispose();
      sparks.dispose();
    },
    [shaft, sparks],
  );
  useFrame(() => {
    if (!active) return;
    if (reducedMotion) skipSparks.current = true;
    const age = Math.max(0, clock.value - settledAt);
    sparkUniforms.age.value = age;
    if (sparkMesh.current)
      sparkMesh.current.visible = !skipSparks.current && age < 3.5;
  });
  return (
    <group name="repository-local-atmosphere" position={[x, 0, z]}>
      {graphics.baseFog ? (
        <RepositoryBaseFog x={x} z={z} radius={radius} clock={clock} />
      ) : null}
      {graphics.lightShafts ? (
        <mesh name="repository-local-shafts" raycast={noRaycast}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[shapes.shaftPos, 3]}
            />
            <bufferAttribute
              attach="attributes-uv"
              args={[shapes.shaftUv, 2]}
            />
          </bufferGeometry>
          <primitive object={shaft} attach="material" dispose={null} />
        </mesh>
      ) : null}
      {graphics.arrivalSparks && !reducedMotion ? (
        <instancedMesh
          ref={sparkMesh}
          args={[undefined, sparks, 36]}
          name="repository-arrival-sparks"
          raycast={noRaycast}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1]} />
        </instancedMesh>
      ) : null}
    </group>
  );
}
