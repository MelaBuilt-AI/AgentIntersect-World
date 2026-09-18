import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  DoubleSide,
  Color,
  type ShaderMaterial,
  type Texture,
} from "three";
import { CODE_SKY_LAYERS } from "./code-world-texture.js";

// Exact gold, red, blue and orange stops from agentintersect_animated.svg.
export const CITY_RAIN_COLORS = [
  "#ffd21a",
  "#ff2d2d",
  "#008bff",
  "#ff8a00",
] as const;
const RAIN_COLOR_VALUES = CITY_RAIN_COLORS.map((color) => new Color(color));
const random = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

/** One gentle traveling highlight city-wide, with randomized quiet gaps. */
export function cityRainPulse(
  time: number,
  count: number,
  seed: number,
  reducedMotion: boolean,
) {
  const cycle = Math.floor(time / 18);
  const start = 2 + random(seed + cycle * 7) * 4;
  const duration = 6;
  const progress = ((time % 18) - start) / duration;
  return {
    index:
      reducedMotion || count === 0 || progress <= 0 || progress >= 1
        ? -1
        : Math.floor(random(seed + cycle * 7 + 1) * count),
    color: Math.floor(random(seed + cycle * 7 + 2) * CITY_RAIN_COLORS.length),
    progress: Math.max(0, Math.min(1, progress)),
    strength: reducedMotion
      ? 0
      : Math.sin(Math.PI * Math.max(0, Math.min(1, progress))) ** 2,
  };
}

/** World-space vertical ray / camera-centered innermost sky intersection. */
export function cityRainTop(
  x: number,
  z: number,
  camera: { x: number; y: number; z: number },
) {
  const radius = CODE_SKY_LAYERS[CODE_SKY_LAYERS.length - 1]!.radius;
  return (
    camera.y +
    Math.sqrt(
      Math.max(0, radius * radius - (x - camera.x) ** 2 - (z - camera.z) ** 2),
    )
  );
}

export type CityRainClock = { value: number };
export type CityRainHighlight = {
  index: number;
  color: number;
  progress: number;
  strength: number;
};
const noRaycast = () => {};

export function RepositoryTerminalRain({
  texture,
  x,
  z,
  roof,
  index,
  clock,
  highlight,
}: {
  readonly texture: Texture;
  readonly x: number;
  readonly z: number;
  readonly roof: number;
  readonly index: number;
  readonly clock: CityRainClock;
  readonly highlight: { current: CityRainHighlight };
}) {
  const uniforms = useMemo(
    () => ({
      rainMap: { value: texture },
      rainTime: clock,
      rainHeight: { value: 440 },
      rainPulse: { value: -1 },
      rainStrength: { value: 0 },
      rainColor: { value: [0, 0, 0] },
    }),
    [texture, clock],
  );
  // Three thin crossed ribbons, one geometry/material/draw call per city object.
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const uvs: number[] = [];
    for (let strand = 0; strand < 3; strand++) {
      const offset = (strand - 1) * 0.48;
      for (let side = 0; side < 2; side++) {
        for (const [u, v] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 0],
          [1, 1],
          [0, 1],
        ]) {
          positions.push(
            offset + (side === 0 ? (u! - 0.5) * 0.24 : 0),
            v!,
            side === 1 ? (u! - 0.5) * 0.24 : 0,
          );
          // Sample one real glyph column, not the whole 4K map squeezed into a line.
          uvs.push((strand * 11 + index * 3 + u!) / 48, v!);
        }
      }
    }
    return {
      positions: new Float32Array(positions),
      uvs: new Float32Array(uvs),
    };
  }, [index]);
  const material = useRef<ShaderMaterial>(null);
  useFrame(({ camera }) => {
    // R3F copies uniform descriptors: update the mounted material, not props.
    const live = material.current?.uniforms;
    if (!live) return;
    live.rainTime!.value = clock.value;
    live.rainHeight!.value = Math.max(
      1,
      cityRainTop(x, z, camera.position) - roof,
    );
    const pulse = highlight.current;
    live.rainPulse!.value = pulse.progress;
    live.rainStrength!.value = pulse.index === index ? pulse.strength : 0;
    live.rainColor!.value = RAIN_COLOR_VALUES[pulse.color]!;
  });
  return (
    <mesh
      name={`repository-terminal-rain:${index}`}
      position={[x, roof, z]}
      frustumCulled={false}
      raycast={noRaycast}
    >
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[geometry.positions, 3]}
        />
        <bufferAttribute attach="attributes-uv" args={[geometry.uvs, 2]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={DoubleSide}
        blending={AdditiveBlending}
        toneMapped={false}
        vertexShader={`
        uniform float rainHeight;
        varying vec2 rainUv;
        void main() {
          rainUv = uv;
          vec3 p = position;
          p.y *= rainHeight;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `}
        fragmentShader={`
        uniform sampler2D rainMap;
        uniform float rainTime;
        uniform float rainHeight;
        uniform float rainPulse;
        uniform float rainStrength;
        uniform vec3 rainColor;
        varying vec2 rainUv;
        void main() {
          // Positive V sample motion makes the visible glyphs travel DOWN.
          vec3 code = texture2D(rainMap, vec2(rainUv.x, rainUv.y * rainHeight / 18.0 + rainTime * 0.055)).rgb;
          float ink = max(code.r, max(code.g, code.b));
          float glyph = smoothstep(0.008, 0.055, ink);
          // Broad packets move at four world units/second, not hundreds of
          // units/second across the entire sky height. Six-second eased envelope.
          float packet = mod(rainUv.y * rainHeight + rainPulse * 24.0, 36.0);
          float pulse = exp(-pow((packet - 18.0) / 5.0, 2.0)) * rainStrength;
          vec3 tint = mix(vec3(0.12, 0.55, 0.76), rainColor, pulse);
          float root = smoothstep(0.0, 0.003, rainUv.y);
          gl_FragColor = vec4(tint * (1.0 + pulse * 0.35), glyph * root * (0.65 + pulse * 0.15));
          #include <colorspace_fragment>
        }
      `}
      />
    </mesh>
  );
}
