import type { EnvironmentAssetId } from "@agentintersect-world/world-schema/environment";

/** Angular coverage, not enlarged source pixels. Horizon strips repeat around the full circle. */
export function skyMapping(
  layer: "background" | "middle" | "foreground",
  asset: EnvironmentAssetId,
) {
  const stars = layer === "background" && /starfield|space-sky/.test(asset);
  return {
    repeatX:
      layer === "middle" && asset !== "space-planets"
        ? asset.startsWith("horizon_")
          ? 1
          : 3
        : layer === "foreground"
          ? 3
          : 1,
    repeatY: 1,
    feather: layer !== "background",
    stars,
  };
}

/** Feather the source borders as well as the geometry horizon. Never repeat opaque image rows vertically. */
export function configureSkyEdges(shader: {
  uniforms: Record<string, unknown>;
  fragmentShader: string;
}) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <map_fragment>",
    `#include <map_fragment>
#ifdef USE_MAP
  diffuseColor.a *= smoothstep(0.0, 0.12, vMapUv.y) * (1.0 - smoothstep(0.88, 1.0, vMapUv.y));
#endif`,
  );
}

/** Analytic pinpoints stay sharp at any viewport size; nebula artwork remains a separate layer. */
export const STARFIELD_FRAGMENT = `
varying vec3 vSkyDirection;
uniform float density;
float starHash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
void main() {
  vec3 d = normalize(vSkyDirection);
  vec3 p = d * 370.0;
  vec3 cell = floor(p);
  float h = starHash(cell);
  vec3 center = cell + vec3(0.2) + 0.6*vec3(starHash(cell+1.0),starHash(cell+2.0),starHash(cell+3.0));
  float distanceToStar = length(p-center);
  float radius = mix(0.035,0.10,starHash(cell+4.0));
  float aa = max(length(fwidth(p))*0.5,0.025);
  float light = step(1.0-density,h)*(1.0-smoothstep(radius, radius+aa,distanceToStar));
  gl_FragColor = vec4(vec3(0.002,0.004,0.012) + vec3(0.82,0.90,1.0)*light,1.0);
}`;
