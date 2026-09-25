import {
  BufferAttribute,
  BufferGeometry,
  IcosahedronGeometry,
  Color,
} from "three";
import type { EnvironmentResources } from "./environment-resources.js";

export function environmentDetailKind(asset: string): "grass" | "rocks" {
  return /grass|moss|meadow/.test(asset) ? "grass" : "rocks";
}
export function createGrassGeometry() {
  const vertices: number[] = [],
    uv: number[] = [];
  // Curved, tapered ribbons, not three opaque triangular wedges.
  for (let blade = 0; blade < 16; blade++) {
    const angle = blade * 2.39996;
    const height = 0.22 + (blade % 5) * 0.045;
    const bx = Math.cos(angle) * 0.09,
      bz = Math.sin(angle) * 0.09;
    const point = (t: number, side: number) => {
      const width = 0.018 * (1 - t);
      return [
        bx +
          Math.cos(angle) * t * t * 0.1 +
          Math.cos(angle + 1.57) * width * side,
        height * t,
        bz +
          Math.sin(angle) * t * t * 0.1 +
          Math.sin(angle + 1.57) * width * side,
      ];
    };
    for (let segment = 0; segment < 4; segment++) {
      const a = segment / 4,
        b = (segment + 1) / 4;
      for (const [t, s] of [
        [a, -1],
        [a, 1],
        [b, 1],
        [a, -1],
        [b, 1],
        [b, -1],
      ]) {
        vertices.push(...point(t!, s!));
        uv.push((s! + 1) / 2, t!);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(vertices), 3),
  );
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
  geometry.computeVertexNormals();
  return geometry;
}
export function createRockGeometry() {
  const geometry = new IcosahedronGeometry(0.27, 3);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    const radius =
      1 + 0.14 * Math.sin(x * 23 + y * 17) * Math.cos(z * 19 - y * 11);
    positions.setXYZ(i, x * radius, y * radius, z * radius);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  // IcosahedronGeometry is non-indexed: average coincident vertices so subdivision
  // adds a natural silhouette instead of visible flat-shaded triangle patches.
  const normals = geometry.getAttribute("normal");
  const shared = new Map<string, number[]>();
  const key = (i: number) =>
    [positions.getX(i), positions.getY(i), positions.getZ(i)]
      .map((v) => v.toFixed(6))
      .join(",");
  for (let i = 0; i < positions.count; i++) {
    const sum = shared.get(key(i)) ?? [0, 0, 0];
    sum[0]! += normals.getX(i);
    sum[1]! += normals.getY(i);
    sum[2]! += normals.getZ(i);
    shared.set(key(i), sum);
  }
  for (let i = 0; i < positions.count; i++) {
    const [x, y, z] = shared.get(key(i))!;
    const length = Math.hypot(x!, y!, z!);
    normals.setXYZ(i, x! / length, y! / length, z! / length);
  }
  normals.needsUpdate = true;
  return geometry;
}

/** Sample the same world-meter base/blend/mask as the floor beneath each instance. */
export function configureDetailMaterial(
  shader: {
    uniforms: Record<string, unknown>;
    vertexShader: string;
    fragmentShader: string;
  },
  resources: EnvironmentResources,
  size: number,
) {
  const { ground } = resources.recipe;
  Object.assign(shader.uniforms, {
    detailBase: { value: resources.textures[ground.asset] },
    detailTint: { value: new Color(ground.tint) },
    detailSize: { value: size },
    detailTile: { value: ground.tileSize },
    detailBlend: {
      value: resources.textures[ground.blend?.asset ?? ground.asset],
    },
    detailMask: {
      value: resources.textures[ground.blend?.mask ?? ground.asset],
    },
    detailBlendTint: { value: new Color(ground.blend?.tint ?? ground.tint) },
    detailBlendTile: { value: ground.blend?.tileSize ?? ground.tileSize },
    detailMaskSize: { value: ground.blend?.maskSize ?? ground.tileSize },
    detailBlendAmount: { value: ground.blend?.amount ?? 0 },
  });
  shader.vertexShader =
    "varying vec3 environmentDetailWorld;\n" +
    shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>
vec4 detailPosition=vec4(transformed,1.0);
#ifdef USE_INSTANCING
 detailPosition=instanceMatrix*detailPosition;
#endif
environmentDetailWorld=(modelMatrix*detailPosition).xyz;`,
    );
  shader.fragmentShader =
    `varying vec3 environmentDetailWorld;
uniform sampler2D detailBase, detailBlend, detailMask;
uniform vec3 detailTint, detailBlendTint;
uniform float detailSize,detailTile,detailBlendTile,detailMaskSize,detailBlendAmount;
` +
    shader.fragmentShader.replace(
      "#include <map_fragment>",
      `
vec2 groundPosition=vec2(environmentDetailWorld.x+detailSize*0.5,detailSize*0.5-environmentDetailWorld.z);
// Height adds surface variation on vertical faces while the base remains ground-aligned.
vec2 surfacePosition=groundPosition + vec2(environmentDetailWorld.y*0.6);
vec3 base=texture2D(detailBase,surfacePosition/detailTile).rgb*detailTint;
vec3 blend=texture2D(detailBlend,surfacePosition/detailBlendTile).rgb*detailBlendTint;
float mask=texture2D(detailMask,groundPosition/detailMaskSize).r*detailBlendAmount;
vec3 grain=texture2D(detailBase,environmentDetailWorld.xz*2.0 + environmentDetailWorld.y*1.7).rgb;
float relief=dot(grain,vec3(0.2126,0.7152,0.0722));
diffuseColor.rgb*=mix(base,blend,mask)*(0.85+0.5*relief);`,
    );
}
