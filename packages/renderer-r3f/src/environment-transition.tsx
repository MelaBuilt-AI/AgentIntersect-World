import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { rewriteMaterial } from "./world-node-materials.js";
import { Mesh, type Texture, type Group } from "three";
import { useCodeTexture } from "./code-world-texture.js";

export type EnvironmentTransitionPhase =
  "idle" | "generating" | "loading" | "out" | "in";
export function transitionMaterializationProgress(
  phase: EnvironmentTransitionPhase,
  elapsed: number,
  reduced: boolean,
) {
  if (reduced) return 1.2;
  if (phase === "out") return Math.max(-0.02, 1.2 - (elapsed / 0.35) * 1.22);
  if (phase === "in") return Math.min(1.2, -0.02 + (elapsed / 0.65) * 1.22);
  return 1.2;
}
export function transitionStrength(
  phase: EnvironmentTransitionPhase,
  elapsed: number,
  reduced: boolean,
) {
  if (reduced || phase === "idle") return 0;
  if (phase === "in") return Math.max(0, 1 - elapsed / 0.65) * 0.8;
  if (phase === "out") return Math.min(1, elapsed / 0.35) * 0.8;
  return 0.3 + 0.045 * Math.sin(elapsed * 2.0);
}
export const ENVIRONMENT_TRANSITION_FRAGMENT = `
if (environmentRewriteStrength > 0.001) {
vec3 p = vWorldSurface;
vec3 cell = floor(p*0.9);
float seed=fract(sin(dot(cell,vec3(127.1,311.7,74.7)))*43758.5453);
float wave=0.5+0.5*sin(environmentRewriteTime*3.0 + length(p.xz)*0.32 + p.y*0.12);
float circuit=pow(max(0.0,1.0-abs(sin(p.x*2.8+p.z*1.9+environmentRewriteTime*1.8))),26.0);
float spark=smoothstep(0.975,1.0,seed)*pow(wave,8.0);
float patches=smoothstep(0.35,0.85,seed)*wave;
vec3 rewriteColor=mix(gl_FragColor.rgb*0.35,vec3(0.25,0.85,1.0),max(circuit,spark));
gl_FragColor.rgb=mix(gl_FragColor.rgb,rewriteColor,environmentRewriteStrength*min(0.9,patches*0.55+circuit*0.55+spark));
// Independently staggered small surface patches, never a whole-screen strobe.
vec2 surfaceUv = vEnvironmentRewriteUv * vec2(18.0, 10.0);
vec2 tile = floor(surfaceUv);
float tick = floor(environmentRewriteTime * 11.0);
float burst = fract(sin(dot(tile, vec2(41.7, 113.1)) + tick * 19.19) * 43758.5453);
vec2 edge = smoothstep(vec2(0.0), vec2(0.08), fract(surfaceUv)) *
  (1.0 - smoothstep(vec2(0.92), vec2(1.0), fract(surfaceUv)));
float flash = step(0.76, burst) * edge.x * edge.y * environmentRewriteStrength;
// Complementary cells disappear into black while other cells expose streaming code.
// The disjoint thresholds prevent an erased patch from also flashing cyan.
float erase = (1.0 - step(0.24, burst)) * edge.x * edge.y * min(1.0, environmentRewriteStrength * 1.5);
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.0), erase);
// Stream the supplied terminal-rain artwork through momentarily exposed sections.
vec2 codeUv = vEnvironmentRewriteUv * vec2(3.0, 2.0) + vec2(0.0, environmentRewriteTime * 0.42);
vec3 code = texture2D(environmentRewriteCode, codeUv).rgb;
float glyph = smoothstep(0.025, 0.32, max(code.r, max(code.g, code.b)));
vec3 exposedCode = mix(vec3(0.005, 0.035, 0.06), vec3(0.3, 0.92, 1.0), glyph);
gl_FragColor.rgb = mix(gl_FragColor.rgb, exposedCode, flash * 0.95);
}
`;
export function configureEnvironmentInterference(
  shader: {
    uniforms: Record<string, unknown>;
    vertexShader: string;
    fragmentShader: string;
  },
  uniforms: {
    time: { value: number };
    strength: { value: number };
    code: { value: Texture | null };
  },
) {
  shader.uniforms.environmentRewriteTime = uniforms.time;
  shader.uniforms.environmentRewriteStrength = uniforms.strength;
  shader.uniforms.environmentRewriteCode = uniforms.code;
  shader.vertexShader =
    "varying vec3 vWorldSurface; varying vec2 vEnvironmentRewriteUv;\n" +
    shader.vertexShader.replace(
      /void main\s*\(\s*\)\s*\{/u,
      "void main() { vEnvironmentRewriteUv=uv; vWorldSurface=(modelMatrix*vec4(position,1.0)).xyz;",
    );
  const end = shader.fragmentShader.lastIndexOf("}");
  shader.fragmentShader =
    "varying vec3 vWorldSurface; varying vec2 vEnvironmentRewriteUv;\nuniform sampler2D environmentRewriteCode;\nuniform float environmentRewriteTime, environmentRewriteStrength;\n" +
    shader.fragmentShader.slice(0, end) +
    "\n{\n" +
    ENVIRONMENT_TRANSITION_FRAGMENT +
    "\n}\n" +
    shader.fragmentShader.slice(end);
}

/** Patch only the environment's own materials; avatars and UI never enter a screen cover. */
export function EnvironmentTransition({
  phase,
  reducedMotion,
  generation,
  root,
  originalOnly = false,
  onReady,
  texture,
}: {
  texture?: Texture | null;
  onReady?: () => void;
  root?: RefObject<Group | null>;
  originalOnly?: boolean;
  phase: EnvironmentTransitionPhase;
  size?: number;
  reducedMotion: boolean;
  generation?: unknown;
}) {
  const { scene, gl } = useThree();
  const loaded = useCodeTexture(
    texture === undefined ? "02_terminal_rain" : null,
  );
  const codeTexture = texture === undefined ? loaded : texture;
  const state = useRef({ phase, elapsed: 0 });
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      strength: { value: 0 },
      progress: { value: 1.2 },
      code: { value: null as Texture | null },
    }),
    [],
  );
  const decorate = useCallback(
    (name: string) => {
      uniforms.code.value = codeTexture;
      if (!codeTexture) return;
      const restore: (() => void)[] = [];
      (root?.current ?? scene.getObjectByName(name))?.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const original = object.material;
        const materials = (Array.isArray(original) ? original : [original]).map(
          (material) => {
            const converted = gl.library.fromMaterial(material);
            const node = converted === material ? material : converted.clone();
            const undo = rewriteMaterial(node, uniforms);
            restore.push(() => {
              undo();
              if (node !== material) node.dispose();
            });
            return node;
          },
        );
        const replacement = Array.isArray(original) ? materials : materials[0]!;
        object.material = replacement;
        restore.push(() => {
          // An async texture/model owner may already have attached a newer material.
          if (object.material === replacement) object.material = original;
        });
      });
      return () => {
        for (const undo of restore.reverse()) undo();
      };
    },
    [scene, gl, uniforms, codeTexture, root],
  );
  useEffect(() => decorate("world-code-environment"), [decorate]);
  useEffect(() => {
    if (!root && !originalOnly) return decorate("world-scenic-environment");
  }, [decorate, generation, root, originalOnly]);
  useEffect(() => {
    if (codeTexture) onReady?.();
  }, [codeTexture, onReady]);
  useFrame((_state, delta) => {
    if (state.current.phase !== phase) state.current = { phase, elapsed: 0 };
    state.current.elapsed += Math.min(delta, 0.1);
    uniforms.time.value += reducedMotion ? 0 : Math.min(delta, 0.1);
    uniforms.strength.value = transitionStrength(
      phase,
      state.current.elapsed,
      reducedMotion,
    );
    uniforms.progress.value = transitionMaterializationProgress(
      phase,
      state.current.elapsed,
      reducedMotion,
    );
    if (!root) {
      const grid = scene.getObjectByName("world-floor-grid") as
        Mesh | undefined;
      if (grid)
        for (const material of Array.isArray(grid.material)
          ? grid.material
          : [grid.material]) {
          material.transparent = true;
          material.opacity = Math.max(
            0,
            Math.min(1, uniforms.progress.value / 1.2),
          );
        }
    }
  });
  return null;
}
