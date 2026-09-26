import { expect, it } from "vitest";
import {
  ENVIRONMENT_PRESETS,
  EnvironmentRecipeSchema,
} from "@agentintersect-world/world-schema/environment";
import { customSlotPresets } from "../src/world-entry/environment-library-client.js";

it("keeps original prompts out of strict render recipes and leaves old slots unknown", () => {
  const recipe = ENVIRONMENT_PRESETS[1]!.recipe!;
  const originalDescription = "  Storm cliffs\nwith small horizon bolts ⚡  ";
  const presets = customSlotPresets([
    null,
    { ...recipe, originalDescription },
    recipe,
  ]);
  expect(presets.map((p) => p.id)).toEqual(["slot-2", "slot-3"]);
  expect(presets[0]!.originalDescription).toBe(originalDescription);
  expect(EnvironmentRecipeSchema.parse(presets[0]!.recipe)).toEqual(recipe);
  expect(presets[1]!.originalDescription).toBeUndefined();
});
