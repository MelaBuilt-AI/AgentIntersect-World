import {
  useFrame,
  useLoader,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import {
  Suspense,
  useCallback,
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
import { useCodeTexture } from "./code-world-texture.js";
import {
  RepositoryTerminalRain,
  cityRainPulse,
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
  settled: boolean,
): string | null {
  if (selected || !settled) return REPOSITORY_STATUS_PRESENTATION.active.color;
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
  readonly highlight: { current: CityRainHighlight };
}) {
  const [settled, setSettled] = useState(false);
  const definition = REPOSITORY_ASSET_BY_ID.get(instance.assetId)!;
  const status = REPOSITORY_STATUS_PRESENTATION[instance.status];
  const { model, materials, roof } = useMemo(() => {
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
    return {
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
    const tint = repositoryMaterialTint(instance.status, selected, settled);
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
          ready={Boolean(rain)}
          revealReady={revealReady}
          arrivalId={instance.instanceId}
          telemetryPrefix="city"
          reducedMotion={reducedMotion}
          onPrepared={() => onReady(instance.instanceId)}
          onMaterializationStart={() => onArrival(instance.instanceId)}
          onComplete={() => {
            setSettled(true);
            onSettled(instance.instanceId);
          }}
        >
          <primitive object={model} dispose={null} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry
              args={[0.58, selected || instance.pinned ? 0.78 : 0.68, 28]}
            />
            <meshBasicMaterial
              color={
                selected
                  ? REPOSITORY_STATUS_PRESENTATION.active.color
                  : status.color
              }
              transparent
              opacity={selected ? 0.95 : instance.pinned ? 0.72 : 0.42}
            />
          </mesh>
        </AvatarMaterialization>
      </group>
      {settled && rain ? (
        <RepositoryTerminalRain
          texture={rain}
          x={instance.position.x}
          z={instance.position.z}
          roof={roof}
          index={index}
          clock={clock}
          highlight={highlight}
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
  const startDrag = useRepositoryPropDrag(interaction);
  const rain = useCodeTexture("02_terminal_rain");
  const clock = useMemo(() => ({ value: 0 }), []);
  const [seed] = useState(() => Math.random() * 10000);
  const highlight = useRef(cityRainPulse(0, 0, seed, reducedMotion));
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
    if (allReady) onReady();
  }, [allReady, onReady]);
  useFrame((_, delta) => {
    if (!reducedMotion) clock.value += Math.min(delta, 0.1);
    highlight.current = cityRainPulse(
      clock.value,
      instances.length,
      seed,
      reducedMotion,
    );
    gl.domElement.dataset.cityRainTime = clock.value.toFixed(4);
    gl.domElement.dataset.cityRainHighlight = String(highlight.current.index);
  });
  return (
    <ArrivalRainContext.Provider value={rain}>
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
