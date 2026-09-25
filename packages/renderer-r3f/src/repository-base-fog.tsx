import { useContext, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import type { CityRainClock } from "./repository-terminal-rain.js";
import { RepositoryFogDepthContext } from "./repository-fog-depth.js";
import { fogMaterial } from "./repository-node-materials.js";

/** The same continuous depth-clipped ellipsoid, now compiled to WGSL by TSL. */
export function RepositoryBaseFog({
  x,
  z,
  radius,
  clock,
}: {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly clock: CityRainClock;
}) {
  const depth = useContext(RepositoryFogDepthContext);
  const height = 0.95,
    width = radius * 1.4;
  const resource = useMemo(
    () => fogMaterial(x, z, width, height, clock),
    [x, z, width, clock],
  );
  useEffect(() => () => resource.dispose(), [resource]);
  // Complete the shared capture before the main WebGPU render pass begins.
  useFrame(({ gl, scene, camera }) => {
    if (depth) resource.capture(depth.capture(gl, scene, camera));
  });
  return (
    <mesh
      name="repository-base-fog"
      position={[0, height / 2, 0]}
      raycast={() => {}}
    >
      <boxGeometry args={[width * 2, height, width * 2]} />
      <primitive object={resource.material} attach="material" dispose={null} />
    </mesh>
  );
}
