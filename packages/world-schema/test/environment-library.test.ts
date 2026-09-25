import { expect, it } from "vitest";
import {
  ENVIRONMENT_ASSETS,
  ENVIRONMENT_PRESETS,
  EnvironmentRecipeSchema,
  environmentAssetIds,
} from "../src/environment.js";

it("accepts independent library ground/mask layers and bounded celestial sprites without changing Original", () => {
  const recipe = {
    ...ENVIRONMENT_PRESETS[1]!.recipe!,
    ground: {
      asset: "pale_sand",
      tint: "#ffffff",
      tileSize: 8,
      roughness: 0.9,
      blend: {
        asset: "meadow_grass",
        mask: "winding_paths",
        tileSize: 6,
        maskSize: 32,
        tint: "#ffffff",
        amount: 1,
      },
    },
    sky: {
      background: {
        asset: "clear_day",
        tint: "#ffffff",
        opacity: 1,
        speed: 0.0002,
      },
      middle: {
        asset: "alpine_mountains",
        tint: "#ffffff",
        opacity: 1,
        speed: 0,
      },
      foreground: {
        asset: "puffy_clouds",
        tint: "#ffffff",
        opacity: 0.6,
        speed: 0.003,
      },
    },
    celestial: [
      {
        asset: "warm_sun",
        tint: "#ffffff",
        opacity: 1,
        azimuth: 35,
        elevation: 40,
        size: 35,
      },
    ],
  };
  const parsed = EnvironmentRecipeSchema.safeParse(recipe);
  expect(parsed.success).toBe(true);
  if (!parsed.success) return;
  expect(environmentAssetIds(parsed.data)).toEqual(
    expect.arrayContaining([
      "pale_sand",
      "meadow_grass",
      "winding_paths",
      "warm_sun",
    ]),
  );
  expect(
    EnvironmentRecipeSchema.safeParse({
      ...recipe,
      celestial: Array(4).fill(recipe.celestial[0]),
    }).success,
  ).toBe(false);
  expect(
    EnvironmentRecipeSchema.safeParse({
      ...recipe,
      ground: {
        ...recipe.ground,
        blend: { ...recipe.ground.blend, mask: "clear_day" },
      },
    }).success,
  ).toBe(false);
  expect(Object.keys(ENVIRONMENT_ASSETS)).toHaveLength(88);
  expect(ENVIRONMENT_PRESETS[0]!.recipe).toBeNull();
});
