import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  BoxGeometry,
  GridHelper,
  InstancedMesh,
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  MeshStandardMaterial,
  Vector3,
} from "three";

import type {
  PreparedInstanceGroup,
  PreparedRepositoryInstances,
  RenderObjectKind,
} from "./index.js";
import { RENDER_OBJECT_KINDS } from "./index.js";

const colors: Readonly<Record<RenderObjectKind, string>> = {
  package: "#8b5cf6",
  directory: "#38bdf8",
  file: "#2563eb",
  symbol: "#22d3ee",
};

const evidenceColors = {
  created: "#22d3ee",
  modified: "#f59e0b",
  deleted: "#94a3b8",
  renamed: "#a78bfa",
  binary: "#fb7185",
  reported: "#64748b",
} as const;

function InstanceGroup({
  kind,
  group,
  onSelect,
}: {
  readonly kind: RenderObjectKind;
  readonly group: PreparedInstanceGroup;
  readonly onSelect: (ref: string) => void;
}) {
  const mesh = useMemo(() => {
    const instance = new InstancedMesh(
      new BoxGeometry(),
      new MeshStandardMaterial({ color: colors[kind], roughness: 0.72 }),
      group.count,
    );
    const matrix = new Matrix4();
    for (let index = 0; index < group.count; index += 1) {
      matrix.fromArray(group.matrices, index * 16);
      instance.setMatrixAt(index, matrix);
    }
    instance.instanceMatrix.needsUpdate = true;
    instance.name = `${kind}-instances`;
    return instance;
  }, [group, kind]);
  const handlePointer = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const instanceId = (
      event as ThreeEvent<PointerEvent> & { instanceId?: number }
    ).instanceId;
    if (instanceId === undefined) return;
    const ref = group.refs[instanceId];
    if (ref !== undefined) onSelect(ref);
  };
  if (group.count === 0) return null;
  return <primitive object={mesh} onClick={handlePointer} />;
}

function selectedPosition(
  prepared: PreparedRepositoryInstances,
  ref: string | null,
): readonly [number, number, number] | null {
  if (ref === null) return null;
  for (const kind of RENDER_OBJECT_KINDS) {
    const group = prepared.groups[kind];
    const index = group.refs.indexOf(ref);
    if (index >= 0) {
      const offset = index * 16;
      return [
        group.matrices[offset + 12] ?? 0,
        (group.matrices[offset + 13] ?? 0) + 1.2,
        group.matrices[offset + 14] ?? 0,
      ];
    }
  }
  return null;
}

function SceneBridge({
  prepared,
  selectedRef,
  focusRef,
  onSelect,
  onContextLost,
}: {
  readonly prepared: PreparedRepositoryInstances;
  readonly selectedRef: string | null;
  readonly focusRef: string | null;
  readonly onSelect: (ref: string) => void;
  readonly onContextLost: () => void;
}) {
  const { camera, gl, invalidate } = useThree();
  const selected = useMemo(
    () => selectedPosition(prepared, selectedRef),
    [prepared, selectedRef],
  );
  const focused = useMemo(
    () => selectedPosition(prepared, focusRef),
    [focusRef, prepared],
  );
  const grid = useMemo(
    () =>
      new GridHelper(
        Math.max(40, prepared.overview.width, prepared.overview.depth),
        20,
      ),
    [prepared.overview.depth, prepared.overview.width],
  );
  const dependencyLines = useMemo(() => {
    const points = prepared.dependencyBridges.flatMap((bridge) => [
      bridge.start,
      bridge.end,
    ]);
    const geometry = new BufferGeometry().setFromPoints(
      points.map(([x, y, z]) => new Vector3().set(x, y, z)),
    );
    return new LineSegments(
      geometry,
      new LineBasicMaterial({
        color: "#22d3ee",
        transparent: true,
        opacity: 0.72,
      }),
    );
  }, [prepared.dependencyBridges]);
  useEffect(() => {
    const handler = (event: globalThis.Event) => {
      event.preventDefault();
      onContextLost();
    };
    gl.domElement.addEventListener("webglcontextlost", handler);
    return () => gl.domElement.removeEventListener("webglcontextlost", handler);
  }, [gl, onContextLost]);
  useEffect(() => {
    const target = focused ?? [
      prepared.overview.width / 2,
      0,
      prepared.overview.depth / 2,
    ];
    const distance =
      focused === null
        ? Math.max(
            18,
            Math.min(
              120,
              Math.max(prepared.overview.width, prepared.overview.depth) * 0.8,
            ),
          )
        : 12;
    camera.position.set(
      target[0] + distance * 0.65,
      distance,
      target[2] + distance,
    );
    camera.lookAt(target[0], 0, target[2]);
    camera.updateProjectionMatrix();
    invalidate();
  }, [
    camera,
    focused,
    invalidate,
    prepared.overview.depth,
    prepared.overview.width,
  ]);
  useEffect(() => invalidate(), [invalidate, prepared, selectedRef]);
  return (
    <>
      <color attach="background" args={["#050816"]} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[12, 20, 8]} intensity={2.1} />
      <primitive object={grid} />
      {prepared.dependencyBridges.length > 0 && (
        <primitive object={dependencyLines} name="dependency-bridges" />
      )}
      {RENDER_OBJECT_KINDS.map((kind) => (
        <InstanceGroup
          key={kind}
          kind={kind}
          group={prepared.groups[kind]}
          onSelect={onSelect}
        />
      ))}
      {selected !== null && (
        <mesh position={selected} name="selected-object-marker">
          <sphereGeometry args={[0.55, 12, 12]} />
          <meshBasicMaterial color="#f8fafc" wireframe />
        </mesh>
      )}
      {prepared.evidenceMarkers.map((marker) => (
        <mesh
          key={`${marker.ref}:${marker.outcome}`}
          position={marker.position}
          name={`evidence-${marker.outcome}`}
        >
          <boxGeometry args={[1.15, 1.15, 1.15]} />
          <meshBasicMaterial color={evidenceColors[marker.outcome]} wireframe />
        </mesh>
      ))}
    </>
  );
}

export function RepositoryIslandCanvas({
  prepared,
  selectedRef,
  focusRef,
  onSelect,
  onContextLost,
  reducedMotion,
}: {
  readonly prepared: PreparedRepositoryInstances;
  readonly selectedRef: string | null;
  readonly focusRef: string | null;
  readonly onSelect: (ref: string) => void;
  readonly onContextLost: () => void;
  readonly reducedMotion: boolean;
}) {
  return (
    <Canvas
      aria-hidden="true"
      camera={{ position: [18, 22, 24], fov: 45, near: 0.1, far: 10_000 }}
      dpr={reducedMotion ? 1 : [1, 1.5]}
      frameloop="demand"
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => undefined}
    >
      <SceneBridge
        prepared={prepared}
        selectedRef={selectedRef}
        focusRef={focusRef}
        onSelect={onSelect}
        onContextLost={onContextLost}
      />
    </Canvas>
  );
}
