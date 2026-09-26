import { useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  ImageBitmapLoader,
  Texture,
} from "three";

export function animateCodeTexture(
  texture: Texture,
  kind: "floor" | "screen",
  delta: number,
  reducedMotion: boolean,
) {
  if (reducedMotion) return;
  const step = Math.min(delta, 0.15);
  texture.offset.x =
    (texture.offset.x + step * (kind === "floor" ? 0.008 : 0)) % 1;
  texture.offset.y =
    (texture.offset.y + step * (kind === "floor" ? 0.025 : 0.07)) % 1;
}

export const CODE_SKY_LAYERS = [
  {
    kind: "rain",
    texture: "02_terminal_rain",
    opacity: 0.25,
    radius: 450,
    renderOrder: -12,
  },
  {
    kind: "aurora",
    texture: "17_aurora_code_sky",
    opacity: 0.8,
    radius: 448,
    renderOrder: -11,
  },
  {
    kind: "nebula",
    texture: "15_code_nebula_sky",
    opacity: 0.55,
    radius: 446,
    renderOrder: -10,
  },
] as const;
export type CodeSkyLayer = (typeof CODE_SKY_LAYERS)[number]["kind"];

export function animateCodeSky(
  sky: { rotation: { y: number } },
  time: { value: number },
  delta: number,
  reducedMotion: boolean,
) {
  if (reducedMotion) return;
  const step = Math.min(delta, 0.15);
  time.value += step;
  // Streaming belongs to each texture layer, never the camera reference frame.
  sky.rotation.y = 0;
}

/** Transparent streaming color maps, all driven by the same pauseable clock. */
export function configureCodeSky(
  shader: { uniforms: Record<string, unknown>; fragmentShader: string },
  time: { value: number },
  layer: CodeSkyLayer,
) {
  shader.uniforms.aiwSkyTime = time;
  shader.uniforms.aiwSkyLayer = {
    value: CODE_SKY_LAYERS.findIndex((item) => item.kind === layer),
  };
  shader.fragmentShader =
    `uniform float aiwSkyTime;
uniform float aiwSkyLayer;
vec2 aiwStreamingUv(vec2 uv) {
  float t = aiwSkyTime;
  if (aiwSkyLayer < 0.5) {
    // Sphere V increases toward the zenith: positive sampling offset falls down.
    return uv + vec2(0.0, t * 0.055);
  }
  if (aiwSkyLayer < 1.5) {
    // Rising, folding aurora curtains: streaming plus smooth lateral ripples.
    vec2 flow = uv + vec2(t * 0.006, -t * 0.022);
    flow.x += 0.045 * sin(uv.y * 6.283185 + t * 0.32)
      + 0.018 * sin(uv.y * 12.56637 - t * 0.21);
    flow.y += 0.035 * sin(uv.x * 6.283185 + t * 0.24);
    return flow;
  }
  // Foreground clouds cross the curtains on an independent, slower current.
  vec2 flow = uv + vec2(-t * 0.009, t * 0.008);
  flow.x += 0.03 * sin(uv.y * 6.283185 - t * 0.17);
  flow.y += 0.025 * sin(uv.x * 12.56637 + t * 0.19);
  return flow;
}
` +
    shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#ifdef USE_MAP
  vec4 skyArt = texture2D(map, aiwStreamingUv(vMapUv));
  float light = max(skyArt.r, max(skyArt.g, skyArt.b));
  // Supplied maps are RGB. Remove dark backing, not the luminous code artwork.
  diffuseColor.a *= skyArt.a * smoothstep(0.003, 0.028, light);
  float curtain = 0.88 + 0.12 * sin(vMapUv.x * 6.283185 - aiwSkyTime * 0.35);
  float glow = aiwSkyLayer < 0.5 ? 1.0 : (aiwSkyLayer < 1.5 ? 1.5 * curtain : 1.35);
  diffuseColor.rgb *= skyArt.rgb * glow;
#endif`,
    );
}

/** Non-suspending textures: loading artwork never hides the working World. */
export function useCodeTexture(
  name: string | null,
  motion?: "floor" | "screen",
  reducedMotion = false,
) {
  const { gl, invalidate } = useThree();
  const [texture, setTexture] = useState<Texture | null>(null);
  useEffect(() => {
    if (!name) return;
    let active = true;
    const publish = (map: Texture) => {
      if (!active) return;
      map.colorSpace = SRGBColorSpace;
      map.wrapS = map.wrapT = RepeatWrapping;
      map.anisotropy = Math.min(
        8,
        gl.isWebGPURenderer
          ? gl.getMaxAnisotropy()
          : gl.capabilities.getMaxAnisotropy(),
      );
      map.needsUpdate = true;
      setTexture(map);
      invalidate();
    };
    const url = `/assets/code-world/${name}.webp`;
    let loaded: Texture;
    if (
      gl.backend?.isWebGPUBackend &&
      typeof createImageBitmap === "function"
    ) {
      // Blob-backed ImageBitmapLoader decodes off the render turn. Passing an
      // HTML image to copyExternalImageToTexture stalls first-use 4K uploads.
      loaded = new Texture();
      new ImageBitmapLoader()
        .setOptions({ premultiplyAlpha: "none", colorSpaceConversion: "none" })
        .load(url, (bitmap) => {
          if (!active) {
            bitmap.close();
            return;
          }
          loaded.image = bitmap;
          loaded.addEventListener("dispose", () => bitmap.close());
          publish(loaded);
        });
    } else {
      loaded = new TextureLoader().load(url, publish);
    }
    return () => {
      active = false;
      loaded.dispose();
    };
  }, [gl, invalidate, name]);
  useFrame((_, delta) => {
    if (!texture || !motion) return;
    animateCodeTexture(texture, motion, delta, reducedMotion);
    gl.domElement.dataset[
      motion === "floor" ? "floorTextureOffset" : "screenTextureOffset"
    ] = texture.offset
      .toArray()
      .map((value) => value.toFixed(6))
      .join(",");
  });
  return texture;
}
