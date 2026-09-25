import { useMemo, useEffect, useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { EnvironmentRecipe } from "@agentintersect-world/world-schema/environment";
import { createWorldSun, createWorldLighting } from "./world-renderer.js";

export function WorldLighting({
  recipe,
  floor,
}: {
  recipe: EnvironmentRecipe | null;
  floor: "blank" | "repository";
}) {
  const { scene, invalidate } = useThree();
  const rig = useMemo(() => createWorldLighting(), []);
  useLayoutEffect(() => {
    const previous = scene.fog;
    scene.fog = rig.fog;
    return () => {
      scene.fog = previous;
    };
  }, [scene, rig]);
  useLayoutEffect(() => {
    rig.update(recipe, floor);
    invalidate();
  }, [rig, recipe, floor, invalidate]);
  useEffect(() => () => rig.dispose(), [rig]);
  return <primitive object={rig.group} dispose={null} />;
}

export function WorldSun({
  color,
  intensity,
  scenic = false,
}: {
  color: string;
  intensity: number;
  scenic?: boolean;
}) {
  const sun = useMemo(
    () =>
      createWorldSun(color, intensity, scenic ? [24, 32, -30] : [12, 18, 8]),
    [color, intensity, scenic],
  );
  useEffect(() => () => sun.dispose(), [sun]);
  return <primitive object={sun} dispose={null} />;
}
