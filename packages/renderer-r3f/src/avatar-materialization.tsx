import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Box3, Group, Mesh, Sprite, Texture, type Material } from "three";
import { arrivalMaterial } from "./world-node-materials.js";
import { prepareWorldObject } from "./world-preparation.js";
import { cityAssemblyFrame } from "./city-arrival-timing.js";
import { useCodeTexture } from "./code-world-texture.js";

export const ArrivalRainContext = createContext<Texture | null | undefined>(
  undefined,
);

type AppearanceArrivalProps = {
  readonly appearanceKey: string;
  readonly initialArrival: boolean;
  readonly arrivalId: string;
  readonly reducedMotion: boolean;
  readonly onMaterializationStart?: (() => void) | undefined;
  readonly children: (onReady: () => void) => ReactNode;
};

/** Keep the actor slot mounted; replace only its appearance/arrival generation. */
export function AvatarAppearanceArrival(props: AppearanceArrivalProps) {
  const [generation, setGeneration] = useState({
    key: props.appearanceKey,
    initial: props.initialArrival,
  });
  if (generation.key !== props.appearanceKey)
    setGeneration({ key: props.appearanceKey, initial: false });
  return (
    <AppearanceArrivalGeneration
      key={props.appearanceKey}
      {...props}
      enabled={!generation.initial}
    />
  );
}

function AppearanceArrivalGeneration({
  children,
  ...props
}: AppearanceArrivalProps & { readonly enabled: boolean }) {
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  return (
    <AvatarMaterialization {...props} ready={ready}>
      {children(markReady)}
    </AvatarMaterialization>
  );
}

/** One entrance per mounted group; later agents own independent groups. */
export function AvatarMaterialization({
  ready,
  revealReady = true,
  telemetryPrefix = "avatar",
  cityAssembly = false,
  onComplete,
  enabled = true,
  arrivalId,
  onPrepared,
  onMaterializationStart,
  reducedMotion,
  children,
}: {
  readonly ready: boolean;
  readonly revealReady?: boolean;
  readonly cityAssembly?: boolean;
  readonly telemetryPrefix?: "avatar" | "city";
  readonly onComplete?: (() => void) | undefined;
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
  const [complete, setComplete] = useState(false);
  const started = useRef(false);
  const preparation = useRef<"pending" | "compiling" | "ready">("pending");
  const disposed = useRef(false);
  const wakeTimer = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const restore = useRef<(() => void) | null>(null);
  const compiling = useRef<Promise<unknown> | null>(null);
  const { gl, camera, scene, invalidate } = useThree();
  const sharedRain = useContext(ArrivalRainContext);
  const ownedRain = useCodeTexture(
    enabled && sharedRain === undefined ? "02_terminal_rain" : null,
  );
  const rain = sharedRain === undefined ? ownedRain : sharedRain;
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
    if (arrivalId) dataset[`${telemetryPrefix}ArrivalId`] = arrivalId;
    if (!ready || !rain) {
      actors.visible = false;
      dataset[`${telemetryPrefix}Arrival`] = "loading";
      return;
    }
    if (preparation.current === "pending") {
      preparation.current = "compiling";
      actors.visible = false;
      dataset[`${telemetryPrefix}Arrival`] = "preparing";
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
      // r186 projects only visible objects, unlike the old WebGL compiler.
      // Submission is synchronous on our initialized renderer; hide again before
      // yielding so no incomplete body can escape into a presented frame.
      const compile = () => {
        if (gl.isWebGPURenderer)
          return prepareWorldObject(gl, actors, camera, scene);
        const visible = actors.visible;
        actors.visible = true;
        try {
          return gl.compileAsync(actors, camera, scene);
        } finally {
          actors.visible = visible;
        }
      };
      const prepareOriginals = gl.isWebGPURenderer ? compile() : null;
      if (!prepareOriginals) gl.compile(actors, camera, scene);
      const installArrival = () => {
        if (!reducedMotion && !disposed.current) {
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
            if (!(object instanceof Mesh) && !(object instanceof Sprite))
              return;
            const original = object.material;
            const clones = (
              Array.isArray(original) ? original : [original]
            ).map((material) => {
              if (gl.isWebGPURenderer)
                return arrivalMaterial(material, uniforms, gl);
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
            });
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
              // Three's compileAsync polls these materials' programs. A rapid
              // replacement must not dispose them out from under that poll.
              const dispose = () => clones.forEach((clone) => clone.dispose());
              if (compiling.current)
                void compiling.current.then(dispose, dispose);
              else dispose();
            }
            restore.current = null;
          };
        }
      };
      // Keep originals attached until their offscreen shadow pass is prepared.
      const prepareClones = (): Promise<unknown> =>
        reducedMotion || disposed.current ? Promise.resolve() : compile();
      compiling.current = prepareOriginals
        ? prepareOriginals.then(() => {
            installArrival();
            return prepareClones();
          })
        : (installArrival(), prepareClones());
      void compiling.current.then(() => {
        compiling.current = null;
        if (disposed.current) return;
        preparation.current = "ready";
        onPrepared?.();
        invalidate();
      });
      return;
    }
    if (preparation.current !== "ready" || !revealReady) return;
    elapsed.current += Math.min(delta, 0.1);
    const cityFrame = cityAssemblyFrame(elapsed.current, reducedMotion);
    const progress = cityAssembly
      ? cityFrame.complete
        ? 1
        : cityFrame.progress
      : reducedMotion
        ? elapsed.current >= 1
          ? 1
          : 0
        : Math.min(1, Math.max(0, (elapsed.current - 1) / 2.4));
    dataset[`${telemetryPrefix}Arrival`] =
      progress === 0
        ? "waiting"
        : progress === 1
          ? "complete"
          : "materializing";
    dataset[`${telemetryPrefix}ArrivalProgress`] = progress.toFixed(4);
    actors.visible = progress > 0;
    if (progress === 0) return;
    if (!started.current) {
      started.current = true;
      onMaterializationStart?.();
    }
    uniforms.aiwArrivalProgress.value = cityAssembly
      ? cityFrame.shaderProgress
      : progress;
    uniforms.aiwArrivalTime.value = elapsed.current;
    if (progress === 1) {
      restore.current?.();
      finished.current = true;
      setComplete(true);
      onComplete?.();
      clearInterval(wakeTimer.current);
    }
    invalidate();
  });
  return (
    <group
      ref={group}
      name={
        arrivalId
          ? `${telemetryPrefix === "avatar" ? "agent" : "city"}-materialization:${arrivalId}`
          : "world-avatar-materialization"
      }
      // R3F restores this declarative value after Suspense hides the tree.
      // Keep completed bodies visible, not only their imperative frame state.
      visible={!enabled || complete}
    >
      <ArrivalRainContext.Provider value={rain}>
        {children}
      </ArrivalRainContext.Provider>
    </group>
  );
}
