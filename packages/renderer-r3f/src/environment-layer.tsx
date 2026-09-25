import { useContext, useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import type { Group, Texture } from "three";
import { useCodeTexture } from "./code-world-texture.js";
import type { WeatherStrikeHandler } from "./environment-weather-model.js";
import { WorldLighting } from "./world-sun.js";
import { WorldEnvironment } from "./world-environment.js";
import { ScenicEnvironment } from "./scenic-environment.js";
import {
  EnvironmentTransition,
  type EnvironmentTransitionPhase,
} from "./environment-transition.js";
import {
  compileWorldEnvironment,
  prepareWorldObject,
} from "./world-preparation.js";
import { WorldBloom } from "./world-atmosphere-effects.js";
import { WorldGraphicsContext } from "./world-graphics-context.js";
import {
  prepareEnvironmentTextures,
  type EnvironmentPreparer,
  type EnvironmentResources,
} from "./environment-resources.js";

type Preparation = {
  resources: EnvironmentResources;
  current: () => boolean;
  resolve: () => void;
  reject: (error: unknown) => void;
};
type SceneryProps = {
  texture: Texture | null;
  resources: EnvironmentResources;
  active: boolean;
  phase: EnvironmentTransitionPhase;
  preparation?: Preparation | undefined;
  size: number;
  reducedMotion: boolean;
  userPosition: { readonly x: number; readonly z: number };
  onStrike?: WeatherStrikeHandler | undefined;
};

function PreparedScenery({
  preparation,
  active,
  phase,
  texture,
  ...props
}: SceneryProps) {
  const root = useRef<Group>(null);
  const [decorated, setDecorated] = useState(false);
  const { gl, camera, scene } = useThree();
  useEffect(() => {
    if (!preparation || !decorated || !root.current) return;
    let cancelled = false;
    const object = root.current;
    void (async () => {
      try {
        if (preparation.current())
          await compileWorldEnvironment(gl, object, camera, scene);
        if (!cancelled && preparation.current())
          await prepareWorldObject(
            gl,
            object,
            camera,
            scene,
            scene.children.filter(
              (child) =>
                child !== object &&
                (child.name === "world-code-environment" ||
                  child.name === "prepared-scenery"),
            ),
          );
        preparation.resolve();
      } catch (error) {
        preparation.reject(error);
      }
    })();
    return () => {
      cancelled = true;
      preparation.resolve();
    };
  }, [preparation, decorated, gl, camera, scene]);
  return (
    <group ref={root} visible={active} name="prepared-scenery">
      <ScenicEnvironment
        {...props}
        lighting={false}
        postprocessing={false}
        onStrike={active ? props.onStrike : undefined}
      />
      <EnvironmentTransition
        texture={texture}
        root={root}
        phase={phase}
        reducedMotion={props.reducedMotion}
        onReady={() => setDecorated(true)}
      />
    </group>
  );
}

/** Stage one replacement without hiding the current scene or rebuilding the city. */
export function EnvironmentLayer({
  resources,
  floor,
  size,
  reducedMotion,
  userPosition,
  onReady,
  onPrepare,
  onStrike,
  phase = "idle",
}: {
  readonly phase?: EnvironmentTransitionPhase;
  readonly onStrike?: WeatherStrikeHandler | undefined;
  readonly resources: EnvironmentResources | null;
  readonly floor: "blank" | "repository";
  readonly size: number;
  readonly reducedMotion: boolean;
  readonly userPosition: { readonly x: number; readonly z: number };
  readonly onReady?: (() => void) | undefined;
  readonly onPrepare?:
    ((prepare: EnvironmentPreparer | null) => void) | undefined;
}) {
  const graphics = useContext(WorldGraphicsContext);
  const texture = useCodeTexture("02_terminal_rain");
  const { gl } = useThree();
  const [pending, setPending] = useState<Preparation | null>(null);
  useEffect(() => {
    onPrepare?.(async (candidate, current) => {
      await prepareEnvironmentTextures(gl, candidate, current);
      if (!candidate || !current()) return;
      await new Promise<void>((resolve, reject) => {
        const ticket: Preparation = {
          resources: candidate,
          current,
          resolve,
          reject(error) {
            setPending((value) => (value === ticket ? null : value));
            reject(error);
          },
        };
        setPending(ticket);
      });
    });
    return () => onPrepare?.(null);
  }, [gl, onPrepare]);
  const candidates = [
    resources,
    pending?.current() ? pending.resources : null,
  ].filter(
    (item, index, items): item is EnvironmentResources =>
      !!item && items.indexOf(item) === index,
  );
  return (
    <>
      {graphics.bloom || graphics.antialiasing ? (
        <WorldBloom
          bloom={graphics.bloom}
          antialiasing={graphics.antialiasing}
        />
      ) : null}
      <WorldEnvironment
        active={!resources}
        lighting={false}
        postprocessing={false}
        onReady={onReady}
        floor={floor}
        size={size}
        reducedMotion={reducedMotion}
        userPosition={userPosition}
      />
      {candidates.map((candidate) => (
        <PreparedScenery
          texture={texture}
          key={
            candidate.textures[candidate.recipe.ground.asset]?.uuid ??
            candidate.recipe.name
          }
          resources={candidate}
          preparation={pending?.resources === candidate ? pending : undefined}
          active={candidate === resources}
          phase={phase}
          onStrike={onStrike}
          size={size}
          reducedMotion={reducedMotion}
          userPosition={userPosition}
        />
      ))}
      <EnvironmentTransition
        originalOnly
        texture={texture}
        phase={phase}
        reducedMotion={reducedMotion}
      />
      <WorldLighting recipe={resources?.recipe ?? null} floor={floor} />
    </>
  );
}
