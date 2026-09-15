import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Box3, Group, Mesh, Sprite, Texture, type Material } from "three";
import { useCodeTexture } from "./code-world-texture.js";

const ArrivalRainContext = createContext<Texture | null>(null);

/** One entrance per mounted group; later agents own independent groups. */
export function AvatarMaterialization({
  ready,
  enabled = true,
  arrivalId,
  onPrepared,
  onMaterializationStart,
  reducedMotion,
  children,
}: {
  readonly ready: boolean;
  readonly enabled?: boolean;
  readonly arrivalId?: string;
  readonly onPrepared?: (() => void) | undefined;
  readonly onMaterializationStart?: (() => void) | undefined;
  readonly reducedMotion: boolean;
  readonly children: ReactNode;
}) {
  const group = useRef<Group>(null);
  const elapsed = useRef(0);
  const finished = useRef(false);
  const started = useRef(false);
  const preparation = useRef<"pending" | "compiling" | "ready">("pending");
  const disposed = useRef(false);
  const wakeTimer = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const restore = useRef<(() => void) | null>(null);
  const { gl, camera, scene, invalidate } = useThree();
  const sharedRain = useContext(ArrivalRainContext);
  const ownedRain = useCodeTexture(
    enabled && !sharedRain ? "02_terminal_rain" : null,
  );
  const rain = sharedRain ?? ownedRain;
  const uniforms = useMemo(
    () => ({
      aiwArrivalProgress: { value: 0 },
      aiwArrivalTime: { value: 0 },
      aiwArrivalFloor: { value: 0 },
      aiwArrivalHeight: { value: 2 },
      aiwArrivalRain: { value: rain },
    }),
    [rain],
  );

  useEffect(() => {
    // Demand-rendered Reduced Motion still needs the real readiness/delay gate.
    if (!enabled || !ready || finished.current) return;
    wakeTimer.current = setInterval(invalidate, 50);
    return () => clearInterval(wakeTimer.current);
  }, [enabled, invalidate, ready]);
  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      restore.current?.();
    };
  }, []);

  useFrame((_, delta) => {
    const actors = group.current;
    if (!enabled || !actors || finished.current) return;
    const dataset = gl.domElement.dataset;
    if (arrivalId) dataset.avatarArrivalId = arrivalId;
    if (!ready || !rain) {
      actors.visible = false;
      dataset.avatarArrival = "loading";
      return;
    }
    if (preparation.current === "pending") {
      preparation.current = "compiling";
      actors.visible = false;
      dataset.avatarArrival = "preparing";
      const textures = new Set<Texture>([rain]);
      actors.traverse((object) => {
        if (!(object instanceof Mesh) && !(object instanceof Sprite)) return;
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          for (const value of Object.values(material))
            if (value instanceof Texture) textures.add(value);
        }
      });
      for (const texture of textures) gl.initTexture(texture);
      const originalsReady = gl.compileAsync(actors, camera, scene);
      if (!reducedMotion) {
        actors.updateMatrixWorld(true);
        const bounds = new Box3().setFromObject(actors);
        uniforms.aiwArrivalFloor.value = bounds.min.y;
        uniforms.aiwArrivalHeight.value = Math.max(
          0.1,
          bounds.max.y - bounds.min.y,
        );
        const originals: {
          mesh: Mesh | Sprite;
          material: Material | Material[];
          shadow: boolean;
          clones: Material[];
        }[] = [];
        actors.traverse((object) => {
          if (!(object instanceof Mesh) && !(object instanceof Sprite)) return;
          const original = object.material;
          const clones = (Array.isArray(original) ? original : [original]).map(
            (material) => {
              const clone = material.clone();
              clone.onBeforeCompile = (shader) => {
                Object.assign(shader.uniforms, uniforms);
                shader.vertexShader =
                  "varying vec3 aiwArrivalPosition;\n" +
                  (object instanceof Sprite
                    ? shader.vertexShader.replace(
                        "#include <fog_vertex>",
                        "#include <fog_vertex>\naiwArrivalPosition = (modelMatrix * vec4(position, 1.0)).xyz;",
                      )
                    : shader.vertexShader.replace(
                        "#include <project_vertex>",
                        "#include <project_vertex>\naiwArrivalPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;",
                      ));
                shader.fragmentShader =
                  `varying vec3 aiwArrivalPosition;
uniform float aiwArrivalProgress;
uniform float aiwArrivalTime;
uniform float aiwArrivalFloor;
uniform float aiwArrivalHeight;
uniform sampler2D aiwArrivalRain;
` +
                  shader.fragmentShader.replace(
                    "#include <opaque_fragment>",
                    `
  // Small spatial cells assemble upward with staggered, stable thresholds.
  vec3 cell = floor(aiwArrivalPosition * 18.0);
  float noise = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  float height = clamp((aiwArrivalPosition.y - aiwArrivalFloor) / aiwArrivalHeight, 0.0, 1.0);
  float threshold = height * 0.72 + noise * 0.28;
  if (threshold > aiwArrivalProgress) discard;
  float edge = 1.0 - smoothstep(0.0, 0.2, aiwArrivalProgress - threshold);
  vec2 rainUv = vec2(aiwArrivalPosition.x * 0.55 + aiwArrivalPosition.z * 0.3, aiwArrivalPosition.y * 0.55 + aiwArrivalTime * 0.24);
  vec3 code = texture2D(aiwArrivalRain, rainUv).rgb;
  outgoingLight = mix(outgoingLight, code * 3.5 + vec3(0.03, 0.32, 0.46), edge);
  #include <opaque_fragment>
`,
                  );
              };
              clone.customProgramCacheKey = () => "aiw-code-materialization-1";
              return clone;
            },
          );
          originals.push({
            mesh: object,
            material: original,
            shadow: object.castShadow,
            clones,
          });
          object.material = Array.isArray(original) ? clones : clones[0]!;
          // Do not expose full-body shadows before the bodies exist.
          object.castShadow = false;
        });
        restore.current = () => {
          for (const { mesh, material, shadow, clones } of originals) {
            mesh.material = material;
            mesh.castShadow = shadow;
            for (const clone of clones) clone.dispose();
          }
          restore.current = null;
        };
      }
      void Promise.all([
        originalsReady,
        gl.compileAsync(actors, camera, scene),
      ]).then(() => {
        if (disposed.current) return;
        preparation.current = "ready";
        onPrepared?.();
        invalidate();
      });
      return;
    }
    if (preparation.current !== "ready") return;
    elapsed.current += Math.min(delta, 0.1);
    const progress = reducedMotion
      ? elapsed.current >= 1
        ? 1
        : 0
      : Math.min(1, Math.max(0, (elapsed.current - 1) / 2.4));
    dataset.avatarArrival =
      progress === 0
        ? "waiting"
        : progress === 1
          ? "complete"
          : "materializing";
    dataset.avatarArrivalProgress = progress.toFixed(4);
    actors.visible = progress > 0;
    if (progress === 0) return;
    if (!started.current) {
      started.current = true;
      onMaterializationStart?.();
    }
    uniforms.aiwArrivalProgress.value = progress;
    uniforms.aiwArrivalTime.value = elapsed.current;
    if (progress === 1) {
      restore.current?.();
      finished.current = true;
      clearInterval(wakeTimer.current);
    }
    invalidate();
  });
  return (
    <group
      ref={group}
      name={
        arrivalId
          ? `agent-materialization:${arrivalId}`
          : "world-avatar-materialization"
      }
      visible={!enabled}
    >
      <ArrivalRainContext.Provider value={rain}>
        {children}
      </ArrivalRainContext.Provider>
    </group>
  );
}
