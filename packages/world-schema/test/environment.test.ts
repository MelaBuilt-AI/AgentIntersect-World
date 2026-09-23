import { expect, it } from "vitest";

it("exposes data-only preset recipes and rejects code, paths and unbounded controls", async () => {
  const module = await import("../src/environment.js").catch(() => null);
  expect(module, "Environment recipe contract must exist").not.toBeNull();
  const { EnvironmentRecipeSchema, ENVIRONMENT_PRESETS, environmentWordCount } =
    module!;
  expect(ENVIRONMENT_PRESETS.map((p) => p.id)).toEqual([
    "original",
    "sunlit",
    "mars",
  ]);
  expect(ENVIRONMENT_PRESETS[0]!.recipe).toBeNull();
  const recipe = ENVIRONMENT_PRESETS[1]!.recipe!;
  expect(EnvironmentRecipeSchema.parse(recipe)).toEqual(recipe);
  expect(
    EnvironmentRecipeSchema.safeParse({ ...recipe, script: "alert(1)" })
      .success,
  ).toBe(false);
  expect(
    EnvironmentRecipeSchema.safeParse({
      ...recipe,
      ground: { ...recipe.ground, asset: "../../private.png" },
    }).success,
  ).toBe(false);
  expect(
    EnvironmentRecipeSchema.safeParse({
      ...recipe,
      lighting: { ...recipe.lighting, intensity: 1000 },
    }).success,
  ).toBe(false);
  expect(environmentWordCount("  a world\nwith clouds  ")).toBe(4);
});
