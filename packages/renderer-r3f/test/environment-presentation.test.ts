import { expect, it } from "vitest";
import { Texture } from "three";
import { ENVIRONMENT_PRESETS } from "@agentintersect-world/world-schema/environment";

it("keeps atmosphere edges transparent without vertical wrapping and increases distant angular detail", async () => {
  const api = await import("../src/environment-presentation.js").catch(
    () => null,
  );
  expect(api).not.toBeNull();
  if (!api) return;
  expect(api.skyMapping("foreground", "day-clouds")).toMatchObject({
    repeatY: 1,
    feather: true,
  });
  expect(api.skyMapping("middle", "mountain-horizon").repeatX).toBeGreaterThan(
    1,
  );
  expect(api.skyMapping("background", "space-sky").stars).toBe(true);
  const shader = { uniforms: {}, fragmentShader: "#include <map_fragment>" };
  api.configureSkyEdges(shader);
  expect(shader.fragmentShader).toContain("smoothstep");
  expect(shader.fragmentShader).toContain("diffuseColor.a *=");
});
it("uses slender curved textured blades and detailed irregular rocks with terrain-bound material sampling", async () => {
  const api = await import("../src/environment-detail-geometry.js").catch(
    () => null,
  );
  expect(api).not.toBeNull();
  if (!api) return;
  const grass = api.createGrassGeometry();
  const rock = api.createRockGeometry();
  expect(grass.getAttribute("position").count).toBeGreaterThan(100);
  expect(rock.getAttribute("position").count).toBeGreaterThan(100);
  const positions = rock.getAttribute("position"),
    normals = rock.getAttribute("normal");
  const seen = new Map<string, number[]>();
  for (let i = 0; i < positions.count; i++) {
    const key = [positions.getX(i), positions.getY(i), positions.getZ(i)].join(
      ",",
    );
    const normal = [normals.getX(i), normals.getY(i), normals.getZ(i)];
    if (seen.has(key)) expect(normal).toEqual(seen.get(key));
    else seen.set(key, normal);
  }
  expect(grass.getAttribute("uv").count).toBe(
    grass.getAttribute("position").count,
  );
  expect(api.environmentDetailKind("meadow_grass")).toBe("grass");
  expect(api.environmentDetailKind("blue_ice")).toBe("rocks");
  const shader = {
    uniforms: {},
    vertexShader: "#include <common>\n#include <worldpos_vertex>",
    fragmentShader: "#include <common>\n#include <map_fragment>",
  };
  api.configureDetailMaterial(
    shader,
    {
      recipe: ENVIRONMENT_PRESETS[1]!.recipe!,
      textures: { "meadow-ground": new Texture() },
      dispose() {},
    },
    68,
  );
  expect(shader.fragmentShader).toContain("environmentDetailWorld.x");
  expect(shader.fragmentShader).not.toContain("#743f2c");
  grass.dispose();
  rock.dispose();
});
it("places transition interference on world surfaces, with no avatar or screen-space replacement", async () => {
  const api = await import("../src/environment-transition.js").catch(
    () => null,
  );
  expect(api).not.toBeNull();
  if (!api) return;
  expect(api.transitionStrength("idle", 1, false)).toBe(0);
  expect(api.transitionStrength("generating", 1, true)).toBe(0);
  expect(api.transitionStrength("out", 0.3, false)).toBeGreaterThan(0);
  expect(api.transitionStrength("in", 0.65, false)).toBe(0);
  expect(api.ENVIRONMENT_TRANSITION_FRAGMENT).toContain("vWorldSurface");
  expect(api.ENVIRONMENT_TRANSITION_FRAGMENT).not.toContain("gl_FragCoord");
  expect(api.ENVIRONMENT_TRANSITION_FRAGMENT).toContain(
    "float erase = (1.0 - step(0.24, burst))",
  );
  expect(api.ENVIRONMENT_TRANSITION_FRAGMENT).toContain(
    "mix(gl_FragColor.rgb, vec3(0.0), erase)",
  );
  expect(api.ENVIRONMENT_TRANSITION_FRAGMENT).toContain(
    "texture2D(environmentRewriteCode",
  );
  expect(api.ENVIRONMENT_TRANSITION_FRAGMENT).toContain(
    "floor(environmentRewriteTime * 11.0)",
  );
  expect(api.transitionStrength("generating", 1, false)).toBeGreaterThan(0.25);
  const uniforms = {
    time: { value: 1 },
    strength: { value: 0.5 },
    code: { value: new Texture() },
  };
  const shader = {
    uniforms: {} as Record<string, unknown>,
    vertexShader: "void main() {}",
    fragmentShader: "void main() { gl_FragColor=vec4(1.0); }",
  };
  api.configureEnvironmentInterference(shader, uniforms);
  expect(shader.uniforms.environmentRewriteCode).toBe(uniforms.code);
});
