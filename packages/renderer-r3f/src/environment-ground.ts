import { Color } from "three";
import type { EnvironmentResources } from "./environment-resources.js";

/** Library masks are linear data; each material has independent world-meter UV scale. */
export function configureEnvironmentGround(
  shader: { uniforms: Record<string, unknown>; fragmentShader: string },
  resources: EnvironmentResources,
  time: { value: number },
) {
  const { ground } = resources.recipe;
  shader.uniforms.environmentTime = time;
  let declarations = "uniform float environmentTime;\n";
  let fragment = "#include <map_fragment>";
  if (ground.blend) {
    const blend = ground.blend;
    Object.assign(shader.uniforms, {
      environmentBlendMap: { value: resources.textures[blend.asset] },
      environmentMaskMap: { value: resources.textures[blend.mask] },
      environmentBlendTint: { value: new Color(blend.tint) },
      environmentBlendScale: { value: ground.tileSize / blend.tileSize },
      environmentMaskScale: { value: ground.tileSize / blend.maskSize },
      environmentBlendAmount: { value: blend.amount },
    });
    declarations += `uniform sampler2D environmentBlendMap;
uniform sampler2D environmentMaskMap;
uniform vec3 environmentBlendTint;
uniform float environmentBlendScale, environmentMaskScale, environmentBlendAmount;\n`;
    fragment = `#ifdef USE_MAP
      vec3 environmentBase = texture2D(map, vMapUv).rgb * diffuseColor.rgb;
      vec3 environmentOverlay = texture2D(environmentBlendMap, vMapUv * environmentBlendScale).rgb * environmentBlendTint;
      float environmentMask = texture2D(environmentMaskMap, vMapUv * environmentMaskScale).r * environmentBlendAmount;
      diffuseColor.rgb = mix(environmentBase, environmentOverlay, environmentMask);
    #endif`;
  }
  shader.fragmentShader =
    declarations +
    shader.fragmentShader.replace(
      "#include <map_fragment>",
      `${fragment}
#ifdef USE_MAP
  float drift = sin(vMapUv.x * 8.0 + environmentTime * 0.22) * sin(vMapUv.y * 7.0 - environmentTime * 0.16);
  diffuseColor.rgb *= 0.985 + 0.015 * drift;
#endif`,
    );
}
