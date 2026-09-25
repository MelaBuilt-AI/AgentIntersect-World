import { expect, it } from "vitest";
import { ENVIRONMENT_PRESETS } from "@agentintersect-world/world-schema/environment";

it("builds a data-only discovery/proposal contract and maps ambience to the actual recipe", async () => {
  const api = await import("../src/environment-generation.js").catch(
    () => null,
  );
  expect(api).not.toBeNull();
  if (!api) return;
  const recipe = ENVIRONMENT_PRESETS[1]!.recipe!;
  expect(api.environmentPrompt("A snowy frozen moon", recipe)).toContain(
    "fresh_snow",
  );
  expect(
    api.environmentPrompt(
      "Many lightning bolts across the skybox, no nearby ground strikes",
      recipe,
    ),
  ).toContain('skybox lightning: use lightning="distant"');
  expect(api.environmentPrompt("Sky and nearby strikes", recipe)).toContain(
    'lightning="both"',
  );
  expect(api.environmentPrompt("Many sky bolts", recipe)).toContain("3–8");
  expect(() => api.environmentPrompt("x ".repeat(501), recipe)).toThrow(/500/);
  const proposal = api.parseEnvironmentProposal(
    JSON.stringify({
      ...recipe,
      ground: { ...recipe.ground, asset: "fresh_snow" },
    }),
  );
  expect(proposal.recipe.audio.ambience).toBe("wind-loop");
  const expanded = api.parseEnvironmentProposal(
    JSON.stringify({
      ...recipe,
      ground: { ...recipe.ground, asset: "fresh_snow" },
      audio: { ambience: "polar_ice_creaks_loop", gain: 0.25 },
    }),
  );
  expect(expanded.recipe.audio.ambience).toBe("polar_ice_creaks_loop");
  expect(proposal.summary).toContain("fresh snow");
  expect(() =>
    api.parseEnvironmentProposal(
      JSON.stringify({ ...recipe, command: "rm -rf /" }),
    ),
  ).toThrow(/recipe/i);
});
