import { expect, it } from "vitest";
import {
  ENVIRONMENT_PRESETS,
  EnvironmentRecipeSchema,
  environmentAssetIds,
} from "../src/environment.js";

it("saves independently controlled horizon lightning without replacing upper/local lightning", () => {
  const recipe = {
    ...ENVIRONMENT_PRESETS[1]!.recipe!,
    weather: {
      particles: "none",
      intensity: 0.6,
      wind: 0,
      lightning: "both",
      lightningInterval: 14,
      flashes: true,
      horizonLightning: { density: 0.8, interval: 3, elevation: 14 },
    },
  };
  const parsed = EnvironmentRecipeSchema.safeParse(recipe);
  expect(parsed.success).toBe(true);
  if (!parsed.success) return;
  expect(
    EnvironmentRecipeSchema.parse(JSON.parse(JSON.stringify(parsed.data))),
  ).toEqual(parsed.data);
  expect(parsed.data.weather!.lightning).toBe("both");
  const onlyHorizon = EnvironmentRecipeSchema.parse({
    ...recipe,
    weather: { ...recipe.weather, lightning: "off" },
  });
  expect(environmentAssetIds(onlyHorizon)).toContain("fx_lightning_strike");
  expect(environmentAssetIds(onlyHorizon)).not.toContain("fx_impact_scorch");
  expect(
    EnvironmentRecipeSchema.safeParse({
      ...recipe,
      weather: {
        ...recipe.weather,
        horizonLightning: { density: 1, interval: 0.1, elevation: 14 },
      },
    }).success,
  ).toBe(false);
  expect(
    EnvironmentRecipeSchema.parse(ENVIRONMENT_PRESETS[1]!.recipe).weather,
  ).toBeUndefined();
});
