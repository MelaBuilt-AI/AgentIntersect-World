import { useContext, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  DoubleSide,
  Color,
  type ShaderMaterial,
  type Texture,
} from "three";
import { WorldGraphicsContext } from "./world-graphics-context.js";
import { cityLaunchFrame } from "./city-arrival-timing.js";
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

/** Slow six-second envelopes with independently staggered city lanes. */
export function cityRainPulse(
  time: number,
  count: number,
  seed: number,
  reducedMotion: boolean,
) {
  const cycle = Math.floor(time / 10);
  const start = 1 + random(seed + cycle * 7) * 2;
  const duration = 6;
  const progress = ((time % 10) - start) / duration;
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

export function cityRainPulses(
  time: number,
  count: number,
  seed: number,
  reducedMotion: boolean,
): readonly CityRainHighlight[] {
  const lanes = Math.min(12, Math.ceil(count / 4));
  return Array.from({ length: lanes }, (_, lane) => {
    const pulse = cityRainPulse(
      time + lane * 1.37,
      Math.ceil((count - lane) / lanes),
      seed + lane * 29,
      reducedMotion,
    );
    return {
      ...pulse,
      index: pulse.index < 0 ? -1 : lane + pulse.index * lanes,
    };
  });
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
  settledAt = 0,
  reducedMotion = false,
  onLaunchComplete,
}: {
  readonly texture: Texture;
  readonly x: number;
  readonly z: number;
  readonly roof: number;
  readonly index: number;
  readonly clock: CityRainClock;
  readonly highlight: { current: readonly CityRainHighlight[] };
  readonly settledAt?: number;
  readonly reducedMotion?: boolean;
  readonly onLaunchComplete?: (() => void) | undefined;
}) {
  const graphics = useContext(WorldGraphicsContext);
  const skipLaunch = useRef(reducedMotion);
  const completedLaunch = useRef(false);
  const uniforms = useMemo(
    () => ({
      rainMap: { value: texture },
      rainTime: clock,
      rainHeight: { value: 440 },
      rainReach: { value: 0 },
      rainSpark: { value: 0 },
      rainDown: { value: 0 },
      rainVisible: { value: 1 },
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
    if (reducedMotion) skipLaunch.current = true;
    const age = Math.max(0, clock.value - settledAt);
    const launch = cityLaunchFrame(
      age,
      skipLaunch.current || !graphics.arrivalSparks,
    );
    if (launch.down === 1 && !completedLaunch.current) {
      completedLaunch.current = true;
      onLaunchComplete?.();
    }
    live.rainTime!.value =
      skipLaunch.current || !graphics.arrivalSparks
        ? clock.value * 0.055
        : launch.offset;
    live.rainReach!.value = launch.reach;
    live.rainSpark!.value = launch.spark;
    live.rainDown!.value = launch.down;
    live.rainVisible!.value = graphics.terminalRain ? 1 : 1 - launch.down;
    live.rainHeight!.value = Math.max(
      1,
      cityRainTop(x, z, camera.position) - roof,
    );
    const pulse = highlight.current.find((pulse) => pulse.index === index);
    live.rainPulse!.value = pulse?.progress ?? 0;
    live.rainStrength!.value =
      graphics.huePulses && !reducedMotion
        ? (pulse?.strength ?? 0) * launch.down
        : 0;
    live.rainColor!.value = RAIN_COLOR_VALUES[pulse?.color ?? 0]!;
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
        uniform float rainReach;
        uniform float rainSpark;
        uniform float rainDown;
        uniform float rainVisible;
        uniform float rainPulse;
        uniform float rainStrength;
        uniform vec3 rainColor;
        varying vec2 rainUv;
        void main() {
          if (rainUv.y > rainReach || rainVisible < 0.001) discard;
          // Positive V sample motion makes the visible glyphs travel DOWN.
          vec3 code = texture2D(rainMap, vec2(rainUv.x, rainUv.y * rainHeight / 18.0 + rainTime)).rgb;
          float ink = max(code.r, max(code.g, code.b));
          float glyph = smoothstep(0.008, 0.055, ink);
          // Broad packets move at four world units/second, not hundreds of
          // units/second across the entire sky height. Six-second eased envelope.
          float pulse = 0.0;
          if (rainStrength > 0.0) {
            float packet = mod(rainUv.y * rainHeight + rainPulse * 24.0, 36.0);
            pulse = exp(-pow((packet - 18.0) / 5.0, 2.0)) * rainStrength;
          }
          vec3 tint = mix(vec3(0.12, 0.55, 0.76), rainColor, pulse);
          float root = smoothstep(0.0, 0.003, rainUv.y);
          float spark = exp(-pow((rainUv.y - rainReach) * rainHeight / 3.0, 2.0)) * rainSpark;
          gl_FragColor = vec4(tint * (1.0 + pulse * 0.35) + vec3(0.35, 0.7, 1.0) * spark,
            max(glyph * root * (0.65 + pulse * 0.15), spark * 0.6) * rainVisible);
          #include <colorspace_fragment>
        }
      `}
      />
    </mesh>
  );
}
