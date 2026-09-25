import { expect, it } from "vitest";
import { ENVIRONMENT_PRESETS } from "@agentintersect-world/world-schema/environment";
import * as renderer from "../src/world-renderer.js";

it("updates environment lighting and fog without replacing shader-bound identities", () => {
  expect(renderer.createWorldLighting).toBeTypeOf("function");
  const rig = renderer.createWorldLighting();
  const lights = [...rig.group.children];
  const fog = rig.fog;
  const sun = lights.find(
    (light: { type: string }) => light.type === "SunLight",
  );
  for (const index of [1, 2, 0, 1, 0]) {
    const recipe = ENVIRONMENT_PRESETS[index]!.recipe;
    rig.update(recipe, "repository");
    expect(rig.group.children).toEqual(lights);
    expect(rig.fog).toBe(fog);
    expect(lights.every((light: { visible: boolean }) => light.visible)).toBe(
      true,
    );
    expect(sun.intensity).toBe(recipe?.lighting.intensity ?? 2.1);
    expect(sun.position.toArray()).toEqual(
      recipe ? [24, 32, -30] : [12, 18, 8],
    );
    expect(fog.near).toBe(recipe ? 35 : 24);
    expect(fog.far).toBe(recipe?.lighting.fogFar ?? 130);
  }
  rig.update(null, "blank");
  expect(fog.near).toBeGreaterThan(1000);
  rig.dispose();
});
