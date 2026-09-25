import { expect, it } from "vitest";
import { ENVIRONMENT_PRESETS } from "@agentintersect-world/world-schema/environment";
import { Color, Texture } from "three";

it("blends independently scaled ground through a linear mask, not opacity over the whole floor", async () => {
  const api = await import("../src/environment-ground.js").catch(() => null);
  expect(api).not.toBeNull();
  if (!api) return;
  const blend = {
    asset: "meadow_grass" as const,
    mask: "winding_paths" as const,
    tint: "#ffffff",
    tileSize: 8,
    maskSize: 32,
    amount: 0.7,
  };
  const base = ENVIRONMENT_PRESETS[1]!.recipe!;
  const resources = {
    recipe: { ...base, ground: { ...base.ground, blend } },
    textures: { meadow_grass: new Texture(), winding_paths: new Texture() },
    dispose() {},
  };
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    fragmentShader: "#include <map_fragment>",
  };
  api.configureEnvironmentGround(shader, resources, { value: 0 });
  expect(shader.uniforms.environmentBlendMap!.value).toBe(
    resources.textures.meadow_grass,
  );
  expect(shader.uniforms.environmentMaskMap!.value).toBe(
    resources.textures.winding_paths,
  );
  expect(shader.uniforms.environmentBlendTint!.value).toBeInstanceOf(Color);
  expect(shader.fragmentShader).toContain(
    "mix(environmentBase, environmentOverlay",
  );
  expect(shader.fragmentShader).toContain("environmentMaskScale");
});
