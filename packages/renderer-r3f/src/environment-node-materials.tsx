import { useEffect, useLayoutEffect, useMemo } from "react";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { BackSide, AdditiveBlending, DoubleSide, type Texture } from "three";
import type { EnvironmentResources } from "./environment-resources.js";
import {
  codeSkyMaterial,
  scenicSkyMaterial,
  scenicGroundMaterial,
  detailMaterial,
} from "./world-node-materials.js";

export function CodeSkyMaterial({
  map,
  clock,
  layer,
  opacity,
}: {
  map: Texture | null;
  clock: { value: number };
  layer: number;
  opacity: number;
}) {
  // Keep the React-owned material stable while asynchronous maps arrive. The
  // transition decorates this same node material, never a detached snapshot.
  const material = useMemo(
    () =>
      codeSkyMaterial(null, clock, layer, {
        transparent: true,
        opacity,
        side: BackSide,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [clock, layer, opacity],
  );
  useLayoutEffect(() => {
    const textured = codeSkyMaterial(map, clock, layer, { opacity });
    material.colorNode = textured.colorNode;
    material.opacityNode = textured.opacityNode;
    material.needsUpdate = true;
    textured.dispose();
  }, [material, map, clock, layer, opacity]);
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material" dispose={null} />;
}

export function CodeFloorMaterial({ map }: { map: Texture | null }) {
  const material = useMemo(
    () =>
      new MeshStandardNodeMaterial({
        color: "#9bb4d0",
        emissive: "#477ea9",
        emissiveIntensity: 0.12,
        roughness: 0.82,
        metalness: 0.12,
      }),
    [],
  );
  useLayoutEffect(() => {
    material.map = map;
    material.emissiveMap = map;
    material.needsUpdate = true;
  }, [material, map]);
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material" dispose={null} />;
}
export function ScenicGroundMaterial({
  resources,
  clock,
}: {
  resources: EnvironmentResources;
  clock: { value: number };
}) {
  const material = useMemo(
    () => scenicGroundMaterial(resources, clock),
    [resources, clock],
  );
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material" dispose={null} />;
}
export function ScenicSkyMaterial({
  map,
  tint,
  opacity,
  feather,
  density = 0,
}: {
  map: Texture | null;
  tint: string;
  opacity: number;
  feather: boolean;
  density?: number;
}) {
  const material = useMemo(
    () =>
      scenicSkyMaterial(
        map,
        {
          map,
          color: tint,
          opacity,
          transparent: feather,
          side: BackSide,
          depthWrite: false,
          fog: false,
          toneMapped: false,
        },
        feather,
        density,
      ),
    [map, tint, opacity, feather, density],
  );
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material" dispose={null} />;
}
export function DetailMaterial({
  resources,
  size,
}: {
  resources: EnvironmentResources;
  size: number;
}) {
  const material = useMemo(
    () => detailMaterial(resources, size, DoubleSide),
    [resources, size],
  );
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material" dispose={null} />;
}
