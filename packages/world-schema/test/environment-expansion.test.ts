import { expect, it } from "vitest";
import {
  ENVIRONMENT_ASSETS,
  ENVIRONMENT_PRESETS,
  EnvironmentRecipeSchema,
  environmentAssetIds,
} from "../src/environment.js";

it("accepts the supplied v2 scenery, honest cutout props, and weather as a saved data-only recipe", () => {
  const base = ENVIRONMENT_PRESETS[1]!.recipe!;
  const input = {
    ...base,
    ground: { ...base.ground, asset: "ground_wet_marsh_soil" },
    sky: {
      ...base.sky,
      middle: { ...base.sky.middle, asset: "horizon_boreal_forest" },
    },
    props: [{ asset: "prop_reed_clump", count: 8, size: 2 }],
    weather: {
      particles: "heavy-rain",
      intensity: 0.6,
      wind: 0.4,
      lightning: "both",
      lightningInterval: 12,
      flashes: true,
    },
    audio: { ambience: "marsh_evening_loop", gain: 0.25 },
  };
  const parsed = EnvironmentRecipeSchema.safeParse(input);
  expect(parsed.success).toBe(true);
  if (!parsed.success) return;
  expect(environmentAssetIds(parsed.data)).toEqual(
    expect.arrayContaining([
      "prop_reed_clump",
      "fx_lightning_strike",
      "fx_impact_scorch",
    ]),
  );
  expect(
    EnvironmentRecipeSchema.parse(JSON.parse(JSON.stringify(parsed.data))),
  ).toEqual(parsed.data);
  expect(
    EnvironmentRecipeSchema.safeParse({
      ...input,
      weather: { ...input.weather, lightningInterval: 0.1 },
    }).success,
  ).toBe(false);
  expect(
    EnvironmentRecipeSchema.safeParse({
      ...input,
      props: [{ asset: "https://remote.test/model.glb", count: 1, size: 2 }],
    }).success,
  ).toBe(false);
  expect(
    Object.values(ENVIRONMENT_ASSETS).filter((a) =>
      a.src.includes("expansion-v2"),
    ),
  ).toHaveLength(32);
  expect(ENVIRONMENT_PRESETS[0]!.recipe).toBeNull();
});
