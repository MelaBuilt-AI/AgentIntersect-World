import {
  useFrame,
  useLoader,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import {
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Box3, Mesh, MeshStandardMaterial, type Texture } from "three";
import {
  AvatarMaterialization,
  ArrivalRainContext,
} from "./avatar-materialization.js";
import { WorldGraphicsContext } from "./world-graphics-context.js";
import { RepositoryLocalAtmosphere } from "./repository-local-atmosphere.js";
import {
  createRepositoryFogDepth,
  RepositoryFogDepthContext,
} from "./repository-fog-depth.js";
import { useCodeTexture } from "./code-world-texture.js";
import {
  RepositoryTerminalRain,
  cityRainPulses,
  type CityRainClock,
  type CityRainHighlight,
} from "./repository-terminal-rain.js";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  REPOSITORY_ASSET_BY_ID,
  REPOSITORY_STATUS_PRESENTATION,
} from "./repository-asset-manifest.js";
import {
  MAX_REPOSITORY_CITY_INSTANCES,
  type RepositoryCityInstance,
} from "./repository-city-state.js";

import {
  useRepositoryPropDrag,
  type RepositoryCityInteraction,
} from "./repository-prop-drag.js";

export { MAX_REPOSITORY_CITY_INSTANCES as MAX_SEMANTIC_REPOSITORY_GLBS } from "./repository-city-state.js";

export class RepositoryCityGLTFLoader extends GLTFLoader {
  private pending: Promise<void> = Promise.resolve();

  override load(
    url: string,
    onLoad: (gltf: GLTF) => void,
    onProgress?: ((event: ProgressEvent) => void) | undefined,
    onError?: ((error: unknown) => void) | undefined,
  ): void {
    const start = () =>
      new Promise<void>((release) => {
        try {
          super.load(
            url,
            (gltf) => {
              try {
                onLoad(gltf);
              } finally {
                release();
              }
            },
            onProgress,
            (error) => {
              try {
                onError?.(error);
              } finally {
                release();
              }
            },
          );
        } catch (error) {
          try {
            onError?.(error);
          } finally {
            release();
          }
        }
      });
    this.pending = this.pending.then(start, start);
  }
}

export function selectRepositoryCityRenderPlan(
  instances: readonly RepositoryCityInstance[],
) {
  const prioritized = instances.filter(
    (instance) =>
      instance.manual ||
      instance.pinned ||
      instance.instanceId.startsWith("event:"),
  );
  const priorityIds = new Set(prioritized.map(({ instanceId }) => instanceId));
  const semantic = [
    ...prioritized,
    ...instances.filter(({ instanceId }) => !priorityIds.has(instanceId)),
  ].slice(0, MAX_REPOSITORY_CITY_INSTANCES);
  const semanticIds = new Set(semantic.map(({ instanceId }) => instanceId));
  return {
    semantic,
    aggregate: instances.filter(
      ({ instanceId }) => !semanticIds.has(instanceId),
    ),
    aggregateCount: instances.length - semantic.length,
  } as const;
}

export function repositoryMaterialTint(
  status: RepositoryCityInstance["status"],
  selected: boolean,
): string | null {
  if (selected) return REPOSITORY_STATUS_PRESENTATION.active.color;
  return status === "idle"
    ? null
    : REPOSITORY_STATUS_PRESENTATION[status].color;
}

function RepositoryCityModel({
  instance,
  gltf,
  reducedMotion,
  selected,
  onSelect,
  onSettled,
  onDragStart,
  onReady,
  revealReady,
  onArrival,
  rain,
  index,
  clock,
  highlight,
}: {
  readonly instance: RepositoryCityInstance;
  readonly gltf: GLTF;
  readonly onDragStart: (
    instance: RepositoryCityInstance,
    event: ThreeEvent<PointerEvent>,
  ) => void;
  readonly reducedMotion: boolean;
  readonly selected: boolean;
  readonly onSelect: (instanceId: string) => void;
  readonly onSettled: (instanceId: string) => void;
  readonly onReady: (instanceId: string) => void;
  readonly revealReady: boolean;
  readonly onArrival: (instanceId: string) => void;
  readonly rain: Texture | null;
  readonly index: number;
  readonly clock: CityRainClock;
  readonly highlight: { current: readonly CityRainHighlight[] };
}) {
  const [launchComplete, setLaunchComplete] = useState(reducedMotion);
  const [settledAt, setSettledAt] = useState<number | null>(null);
  const settled = settledAt !== null;
  const graphics = useContext(WorldGraphicsContext);
  const definition = REPOSITORY_ASSET_BY_ID.get(instance.assetId)!;
  const { model, materials, roof, radius } = useMemo(() => {
    const copy = gltf.scene.clone(true);
    const ownedMaterials: MeshStandardMaterial[] = [];
    copy.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const source = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const cloned = source.map((material) => material.clone());
      object.material = Array.isArray(object.material) ? cloned : cloned[0]!;
      for (const material of cloned) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        material.userData.baseEmissive = `#${material.emissive.getHexString()}`;
        material.userData.baseEmissiveIntensity = material.emissiveIntensity;
        ownedMaterials.push(material);
      }
    });
    const bounds = new Box3().setFromObject(copy);
    return {
      radius: Math.max(
        0.6,
        Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) *
          definition.defaultScale *
          0.6,
      ),
      model: copy,
      materials: ownedMaterials,
      roof: new Box3().setFromObject(copy).max.y * definition.defaultScale,
    };
  }, [gltf, definition.defaultScale]);
  useEffect(
    () => () => {
      for (const material of materials) material.dispose();
    },
    [materials],
  );
  useFrame(() => {
    const tint = repositoryMaterialTint(instance.status, selected);
    for (const material of materials) {
      material.emissive.set(
        tint ?? String(material.userData.baseEmissive ?? "#000000"),
      );
      material.emissiveIntensity = tint
        ? 0.25
        : Number(material.userData.baseEmissiveIntensity ?? 0);
    }
  });
  return (
    <>
      <group
        name={`repository-city-${instance.instanceId}`}
        position={[instance.position.x, 0, instance.position.z]}
        rotation={[0, instance.yaw ?? 0, 0]}
        onPointerDown={(event: ThreeEvent<PointerEvent>) =>
          onDragStart(instance, event)
        }
        scale={definition.defaultScale}
        onClick={(event: {
          button: number;
          delta: number;
          stopPropagation: () => void;
        }) => {
          if (event.button !== 0 || event.delta > 5) return;
          event.stopPropagation();
          onSelect(instance.instanceId);
        }}
      >
        <AvatarMaterialization
          cityAssembly
          ready={Boolean(rain)}
          revealReady={revealReady}
          arrivalId={instance.instanceId}
          telemetryPrefix="city"
          reducedMotion={reducedMotion}
          onPrepared={() => onReady(instance.instanceId)}
          onMaterializationStart={() => onArrival(instance.instanceId)}
          onComplete={() => {
            setSettledAt(clock.value);
            onSettled(instance.instanceId);
          }}
        >
          <primitive object={model} dispose={null} />
        </AvatarMaterialization>
      </group>
      {selected && settled ? (
        <mesh
          name="repository-selection-ring"
          rotation={[-Math.PI / 2, 0, 0]}
          position={[instance.position.x, 0.03, instance.position.z]}
          raycast={() => {}}
        >
          <ringGeometry args={[radius * 0.95, radius * 1.06, 48]} />
          <meshBasicMaterial
            color={REPOSITORY_STATUS_PRESENTATION.active.color}
            transparent
            opacity={0.85}
            depthWrite={false}
          />
        </mesh>
      ) : null}
      {settled &&
      (graphics.baseFog || graphics.lightShafts || graphics.arrivalSparks) ? (
        <RepositoryLocalAtmosphere
          x={instance.position.x}
          z={instance.position.z}
          radius={radius}
          roof={roof}
          clock={clock}
          settledAt={settledAt ?? 0}
          reducedMotion={reducedMotion}
        />
      ) : null}
      {settled &&
      rain &&
      (graphics.terminalRain || (graphics.arrivalSparks && !launchComplete)) ? (
        <RepositoryTerminalRain
          texture={rain}
          x={instance.position.x}
          z={instance.position.z}
          roof={roof}
          index={index}
          clock={clock}
          highlight={highlight}
          onLaunchComplete={() => setLaunchComplete(true)}
          settledAt={settledAt ?? 0}
          reducedMotion={reducedMotion}
        />
      ) : null}
    </>
  );
}

/** One sound for simultaneous objects; later batches retain their own cue. */
export function markCityArrivalBatch(
  started: Set<string>,
  id: string,
  instances: readonly RepositoryCityInstance[],
) {
  if (started.has(id)) return false;
  for (const instance of instances) started.add(instance.instanceId);
  return true;
}

export function RepositoryCityModels({
  instances,
  reducedMotion,
  selectedInstanceId,
  onSelect,
  onSettled,
  onReady,
  onMaterializationStart,
  interaction,
}: {
  readonly instances: readonly RepositoryCityInstance[];
  readonly interaction?: RepositoryCityInteraction | undefined;
  readonly reducedMotion: boolean;
  readonly selectedInstanceId: string | null;
  readonly onSelect: (instanceId: string) => void;
  readonly onSettled: (instanceId: string) => void;
  readonly onReady: () => void;
  readonly onMaterializationStart?: (() => void) | undefined;
}) {
  const { gl } = useThree();
  const graphics = useContext(WorldGraphicsContext);
  const fogDepth = useMemo(
    () => (graphics.baseFog ? createRepositoryFogDepth() : null),
    [graphics.baseFog],
  );
  useEffect(() => () => fogDepth?.dispose(), [fogDepth]);
  const startDrag = useRepositoryPropDrag(interaction);
  const rain = useCodeTexture("02_terminal_rain");
  const clock = useMemo(() => ({ value: 0 }), []);
  const [seed] = useState(() => Math.random() * 10000);
  const highlight = useRef(cityRainPulses(0, 0, seed, reducedMotion));
  const started = useRef(new Set<string>());
  const [readyIds, setReadyIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const ready = useCallback((id: string) => {
    setReadyIds((current) =>
      current.has(id) ? current : new Set([...current, id]),
    );
  }, []);
  const allReady = instances.every(({ instanceId }) =>
    readyIds.has(instanceId),
  );
  useEffect(() => {
    // A second load can reuse every prepared model while its parent returns
    // to loading. Acknowledge the reconciled population, not only false→true.
    if (allReady) onReady();
  }, [allReady, instances, onReady]);
  useFrame((_, delta) => {
    if (!reducedMotion) clock.value += Math.min(delta, 0.1);
    highlight.current = graphics.huePulses
      ? cityRainPulses(clock.value, instances.length, seed, reducedMotion)
      : [];
    gl.domElement.dataset.cityRainTime = clock.value.toFixed(4);
    gl.domElement.dataset.cityRainHighlight =
      highlight.current
        .filter((pulse) => pulse.index >= 0)
        .map((pulse) => pulse.index)
        .join(",") || "-1";
  });
  return (
    <ArrivalRainContext.Provider value={rain}>
      <RepositoryFogDepthContext.Provider value={fogDepth}>
        {instances.map((instance, index) => (
          <Suspense key={instance.instanceId} fallback={null}>
            <LoadedRepositoryCityModel
              instance={instance}
              reducedMotion={reducedMotion}
              selected={selectedInstanceId === instance.instanceId}
              onDragStart={startDrag}
              onSelect={onSelect}
              onSettled={onSettled}
              onReady={ready}
              revealReady={allReady}
              onArrival={(id) => {
                if (markCityArrivalBatch(started.current, id, instances))
                  onMaterializationStart?.();
              }}
              rain={rain}
              index={index}
              clock={clock}
              highlight={highlight}
            />
          </Suspense>
        ))}
      </RepositoryFogDepthContext.Provider>
    </ArrivalRainContext.Provider>
  );
}

// New assets wait locally; established objects, actors and camera stay mounted.
function LoadedRepositoryCityModel(
  props: Omit<Parameters<typeof RepositoryCityModel>[0], "gltf">,
) {
  const gltf = useLoader(
    RepositoryCityGLTFLoader,
    REPOSITORY_ASSET_BY_ID.get(props.instance.assetId)!.glbUrl,
  );
  return <RepositoryCityModel {...props} gltf={gltf} />;
}
