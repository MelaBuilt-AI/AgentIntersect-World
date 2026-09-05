import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
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

export type RepositoryMaterializationFrame = {
  readonly y: number;
  readonly opacity: number;
  readonly emissive: number;
  readonly scanOpacity: number;
  readonly particleProgress: number;
  readonly settled: boolean;
};

export function repositoryMaterializationFrame(
  rawProgress: number,
  reducedMotion: boolean,
): RepositoryMaterializationFrame {
  if (reducedMotion)
    return {
      y: 0,
      opacity: 1,
      emissive: 0,
      scanOpacity: 0,
      particleProgress: 1,
      settled: true,
    };
  const progress = Math.max(0, Math.min(1, rawProgress));
  const overshoot =
    progress === 0
      ? 0
      : progress === 1
        ? 1
        : 1 + 2.70158 * (progress - 1) ** 3 + 1.70158 * (progress - 1) ** 2;
  return {
    y: -2.5 + overshoot * 2.5,
    opacity: Math.min(1, 0.2 + progress * 1.35),
    emissive: 1.8 * (1 - progress),
    scanOpacity: progress < 0.72 ? 0.8 * (1 - progress / 0.72) : 0,
    particleProgress: progress,
    settled: progress >= 1,
  };
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
}: {
  readonly instance: RepositoryCityInstance;
  readonly gltf: GLTF;
  readonly reducedMotion: boolean;
  readonly selected: boolean;
  readonly onSelect: (instanceId: string) => void;
  readonly onSettled: (instanceId: string) => void;
}) {
  const group = useRef<Group>(null);
  const particleGroup = useRef<Group>(null);
  const scanMaterial = useRef<MeshBasicMaterial>(null);
  const startedAt = useRef<number | null>(null);
  const reportedSettled = useRef(false);
  const definition = REPOSITORY_ASSET_BY_ID.get(instance.assetId)!;
  const status = REPOSITORY_STATUS_PRESENTATION[instance.status];
  const { model, materials } = useMemo(() => {
    const copy = gltf.scene.clone(true);
    const ownedMaterials: MeshStandardMaterial[] = [];
    copy.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const source = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const cloned = source.map((material) => material.clone());
      object.material = Array.isArray(object.material) ? cloned : cloned[0]!;
      for (const material of cloned) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        material.userData.baseOpacity = material.opacity;
        material.userData.baseEmissive = `#${material.emissive.getHexString()}`;
        material.userData.baseEmissiveIntensity = material.emissiveIntensity;
        material.transparent = true;
        ownedMaterials.push(material);
      }
    });
    return { model: copy, materials: ownedMaterials };
  }, [gltf]);
  useEffect(
    () => () => {
      for (const material of materials) material.dispose();
    },
    [materials],
  );
  useFrame(({ clock }) => {
    if (!group.current) return;
    const start = startedAt.current ?? clock.elapsedTime;
    startedAt.current = start;
    const elapsed = clock.elapsedTime - start;
    const frame = repositoryMaterializationFrame(elapsed / 1.05, reducedMotion);
    const idle = frame.settled && !reducedMotion;
    const hover = idle
      ? Math.sin(clock.elapsedTime * 1.35 + instance.position.x) * 0.07
      : 0;
    group.current.position.y = frame.y + hover;
    if (particleGroup.current)
      particleGroup.current.position.y = frame.particleProgress * 1.2;
    if (scanMaterial.current) scanMaterial.current.opacity = frame.scanOpacity;
    const failureFlicker =
      instance.status === "failure" && idle
        ? Math.sin(clock.elapsedTime * 16) * 0.14
        : 0;
    const tint = repositoryMaterialTint(
      instance.status,
      selected,
      frame.settled,
    );
    for (const material of materials) {
      material.opacity =
        Number(material.userData.baseOpacity ?? 1) * frame.opacity;
      material.emissive.set(
        tint ?? String(material.userData.baseEmissive ?? "#000000"),
      );
      material.emissiveIntensity = tint
        ? Math.max(
            0.2,
            frame.emissive +
              failureFlicker +
              (idle ? Math.sin(clock.elapsedTime * 1.8) * 0.08 : 0),
          )
        : Number(material.userData.baseEmissiveIntensity ?? 0);
    }
    if (frame.settled && !reportedSettled.current) {
      reportedSettled.current = true;
      onSettled(instance.instanceId);
    }
  });
  return (
    <group
      ref={group}
      name={`repository-city-${instance.instanceId}`}
      position={[
        instance.position.x,
        reducedMotion ? 0 : -2.5,
        instance.position.z,
      ]}
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
      {!reducedMotion && instance.lifecycle === "materializing" ? (
        <group name="repository-city-materialization-effects">
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
            <ringGeometry args={[0.9, 1, 36]} />
            <meshBasicMaterial
              ref={scanMaterial}
              color={status.color}
              transparent
              opacity={0.8}
            />
          </mesh>
          <group ref={particleGroup}>
            {[-0.42, -0.2, 0, 0.2, 0.42].map((x, index) => (
              <mesh
                key={x}
                position={[x, 0.25 + index * 0.18, (index % 2) * 0.28 - 0.14]}
              >
                <sphereGeometry args={[0.035, 5, 5]} />
                <meshBasicMaterial color={status.color} />
              </mesh>
            ))}
          </group>
        </group>
      ) : null}
    </group>
  );
}

export function RepositoryCityModels({
  instances,
  reducedMotion,
  selectedInstanceId,
  onSelect,
  onSettled,
  onReady,
}: {
  readonly instances: readonly RepositoryCityInstance[];
  readonly reducedMotion: boolean;
  readonly selectedInstanceId: string | null;
  readonly onSelect: (instanceId: string) => void;
  readonly onSettled: (instanceId: string) => void;
  readonly onReady: () => void;
}) {
  const urls = useMemo(
    () => [
      ...new Set(
        instances.map(
          (instance) => REPOSITORY_ASSET_BY_ID.get(instance.assetId)!.glbUrl,
        ),
      ),
    ],
    [instances],
  );
  const loaded = useLoader(RepositoryCityGLTFLoader, urls);
  const byUrl = new Map(urls.map((url, index) => [url, loaded[index]!]));
  useEffect(onReady, [onReady, urls]);
  return instances.map((instance) => {
    const definition = REPOSITORY_ASSET_BY_ID.get(instance.assetId)!;
    return (
      <RepositoryCityModel
        key={instance.instanceId}
        instance={instance}
        gltf={byUrl.get(definition.glbUrl)!}
        reducedMotion={reducedMotion}
        selected={selectedInstanceId === instance.instanceId}
        onSelect={onSelect}
        onSettled={onSettled}
      />
    );
  });
}
