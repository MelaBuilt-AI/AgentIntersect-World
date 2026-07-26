import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  GridHelper,
  InstancedMesh,
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  MeshBasicMaterial,
  Vector3,
} from "three";

import type {
  PreparedInstanceGroup,
  PreparedRepositoryInstances,
  RepositoryVisualFamily,
  RepositoryCameraMode,
  RepositoryCameraState,
  RepositoryCameraTransitionState,
} from "./index.js";
import {
  advanceRepositoryCameraTransition,
  REPOSITORY_VISUAL_FAMILIES,
  repositoryCameraPose,
  retargetRepositoryCameraTransition,
} from "./index.js";
import {
  createRepositoryGeometry,
  createRepositoryMaterial,
  REPOSITORY_VISUAL_COLORS,
} from "./repository-visual-kit.js";

const evidenceColors = {
  created: "#22d3ee",
  modified: "#f59e0b",
  deleted: "#94a3b8",
  renamed: "#a78bfa",
  binary: "#fb7185",
  reported: "#64748b",
} as const;

export type RepositoryIslandQuality = {
  readonly tier: "semantic-detail" | "aggregate";
  readonly dpr: number | [number, number];
  readonly antialias: boolean;
  readonly pbrMaterials: boolean;
};

export function repositoryIslandQuality(
  total: number,
  reducedMotion: boolean,
): RepositoryIslandQuality {
  if (total >= 1_000)
    return {
      tier: "aggregate",
      dpr: 1,
      antialias: false,
      pbrMaterials: false,
    };
  return {
    tier: "semantic-detail",
    dpr: reducedMotion ? 1 : [1, 1.5],
    antialias: true,
    pbrMaterials: true,
  };
}

export function repositoryPointerMissSelection(): null {
  return null;
}

function InstanceGroup({
  family,
  group,
  onSelect,
  quality,
}: {
  readonly family: RepositoryVisualFamily;
  readonly group: PreparedInstanceGroup;
  readonly onSelect: (ref: string | null) => void;
  readonly quality: RepositoryIslandQuality;
}) {
  const mesh = useMemo(() => {
    const instance = new InstancedMesh(
      createRepositoryGeometry(group.geometry),
      quality.pbrMaterials
        ? createRepositoryMaterial(family)
        : new MeshBasicMaterial({ color: REPOSITORY_VISUAL_COLORS[family] }),
      group.count,
    );
    const matrix = new Matrix4();
    for (let index = 0; index < group.count; index += 1) {
      matrix.fromArray(group.matrices, index * 16);
      instance.setMatrixAt(index, matrix);
    }
    instance.instanceMatrix.needsUpdate = true;
    instance.name = `${family}-instances`;
    return instance;
  }, [family, group, quality.pbrMaterials]);
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
  for (const family of REPOSITORY_VISUAL_FAMILIES) {
    const group = prepared.groups[family];
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
  agentPosition,
  cameraMode,
  cameraState,
  fieldOfView,
  cameraEasing,
  onSelect,
  onContextLost,
  quality,
}: {
  readonly prepared: PreparedRepositoryInstances;
  readonly selectedRef: string | null;
  readonly focusRef: string | null;
  readonly agentPosition: { readonly x: number; readonly z: number } | null;
  readonly cameraMode: RepositoryCameraMode;
  readonly cameraState: RepositoryCameraState;
  readonly fieldOfView: number;
  readonly cameraEasing: number;
  readonly onSelect: (ref: string | null) => void;
  readonly onContextLost: () => void;
  readonly quality: RepositoryIslandQuality;
}) {
  const { camera, gl, invalidate, scene } = useThree();
  const desiredPosition = useRef(camera.position.clone());
  const desiredTarget = useRef(new Vector3());
  const renderedTarget = useRef(new Vector3());
  const desiredFov = useRef(fieldOfView);
  const easingRef = useRef(0);
  const transitionState = useRef<RepositoryCameraTransitionState | null>(null);
  const hasCameraPose = useRef(false);
  const requestRender = useCallback(() => {
    invalidate();
  }, [invalidate]);
  const selected = useMemo(
    () => selectedPosition(prepared, selectedRef),
    [prepared, selectedRef],
  );
  const focused = useMemo(
    () => selectedPosition(prepared, focusRef),
    [focusRef, prepared],
  );
  const grid = useMemo(() => {
    return new GridHelper(
      Math.max(40, prepared.overview.width, prepared.overview.depth),
      20,
    );
  }, [prepared.overview.depth, prepared.overview.width]);
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
    const pose = repositoryCameraPose({
      mode: cameraMode,
      camera: cameraState,
      target: { x: target[0], y: target[1], z: target[2] },
      actorPosition: agentPosition,
    });
    const nextTransition = retargetRepositoryCameraTransition(
      transitionState.current,
      { ...pose, fov: fieldOfView },
    );
    const desiredChanged = nextTransition !== transitionState.current;
    transitionState.current = nextTransition;
    if (desiredChanged) {
      desiredPosition.current.set(...nextTransition.desired.position);
      desiredTarget.current.set(...nextTransition.desired.target);
      desiredFov.current = nextTransition.desired.fov;
    }
    const previousEasing = easingRef.current;
    easingRef.current = Math.max(0, Math.min(1, cameraEasing));
    gl.domElement.dataset.cameraEasing = String(easingRef.current);
    gl.domElement.dataset.agentPosition = agentPosition
      ? `${agentPosition.x},${agentPosition.z}`
      : "none";
    if (!hasCameraPose.current || easingRef.current === 0) {
      camera.position.copy(desiredPosition.current);
      renderedTarget.current.set(
        desiredTarget.current.x,
        desiredTarget.current.y,
        desiredTarget.current.z,
      );
      camera.lookAt(renderedTarget.current);
      if ("fov" in camera && typeof camera.fov === "number")
        camera.fov = desiredFov.current;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      gl.domElement.dataset.cameraTransform = [
        camera.position.x,
        camera.position.y,
        camera.position.z,
        renderedTarget.current.x,
        renderedTarget.current.y,
        renderedTarget.current.z,
      ].join(",");
      gl.domElement.dataset.cameraFov = String(desiredFov.current);
    }
    hasCameraPose.current = true;
    if (desiredChanged || easingRef.current !== previousEasing) requestRender();
  }, [
    agentPosition,
    camera,
    cameraEasing,
    cameraMode,
    cameraState,
    fieldOfView,
    focused,
    gl,
    requestRender,
    prepared.overview.depth,
    prepared.overview.width,
  ]);
  useFrame((_, delta) => {
    if (
      !hasCameraPose.current ||
      easingRef.current === 0 ||
      transitionState.current === null
    )
      return;
    const response = 18 - easingRef.current * 14;
    const alpha = 1 - Math.exp(-response * Math.min(delta, 0.1));
    camera.position.lerp(desiredPosition.current, alpha);
    renderedTarget.current.set(
      renderedTarget.current.x +
        (desiredTarget.current.x - renderedTarget.current.x) * alpha,
      renderedTarget.current.y +
        (desiredTarget.current.y - renderedTarget.current.y) * alpha,
      renderedTarget.current.z +
        (desiredTarget.current.z - renderedTarget.current.z) * alpha,
    );
    if ("fov" in camera && typeof camera.fov === "number")
      camera.fov += (desiredFov.current - camera.fov) * alpha;
    const targetDelta = {
      x: renderedTarget.current.x - desiredTarget.current.x,
      y: renderedTarget.current.y - desiredTarget.current.y,
      z: renderedTarget.current.z - desiredTarget.current.z,
    };
    const settled =
      camera.position.distanceToSquared(desiredPosition.current) < 0.000001 &&
      targetDelta.x * targetDelta.x +
        targetDelta.y * targetDelta.y +
        targetDelta.z * targetDelta.z <
        0.000001 &&
      (!("fov" in camera) ||
        typeof camera.fov !== "number" ||
        Math.abs(camera.fov - desiredFov.current) < 0.001);
    const fovDelta =
      "fov" in camera && typeof camera.fov === "number"
        ? camera.fov - desiredFov.current
        : 0;
    const remainingError =
      camera.position.distanceToSquared(desiredPosition.current) +
      targetDelta.x * targetDelta.x +
      targetDelta.y * targetDelta.y +
      targetDelta.z * targetDelta.z +
      fovDelta * fovDelta;
    const transition = advanceRepositoryCameraTransition(
      transitionState.current,
      remainingError,
      settled,
    );
    transitionState.current = transition.state;
    if (transition.snap) {
      camera.position.copy(desiredPosition.current);
      renderedTarget.current.set(
        desiredTarget.current.x,
        desiredTarget.current.y,
        desiredTarget.current.z,
      );
      if ("fov" in camera && typeof camera.fov === "number")
        camera.fov = desiredFov.current;
    }
    camera.lookAt(renderedTarget.current);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    gl.domElement.dataset.cameraTransform = [
      camera.position.x,
      camera.position.y,
      camera.position.z,
      renderedTarget.current.x,
      renderedTarget.current.y,
      renderedTarget.current.z,
    ].join(",");
    gl.domElement.dataset.cameraFov = String(
      "fov" in camera && typeof camera.fov === "number"
        ? camera.fov
        : desiredFov.current,
    );
    if (transition.continueRendering) requestRender();
  });
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.dataset.phase13RenderReady = "true";
    const measure = (event: globalThis.Event) => {
      const requestId = (event as CustomEvent).detail?.requestId;
      if (!Number.isInteger(requestId)) return;
      const started = performance.now();
      gl.render(scene, camera);
      gl.getContext().finish();
      const durationMs = performance.now() - started;
      canvas.dispatchEvent(
        new CustomEvent("aiw:render-sample", {
          detail: { requestId, durationMs },
        }),
      );
    };
    canvas.addEventListener("aiw:measure-render", measure);
    return () => {
      canvas.removeEventListener("aiw:measure-render", measure);
      delete canvas.dataset.phase13RenderReady;
    };
  }, [camera, gl, scene]);
  useEffect(
    () => requestRender(),
    [agentPosition, prepared, requestRender, selectedRef],
  );
  return (
    <>
      <color attach="background" args={["#050816"]} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[12, 20, 8]} intensity={2.1} />
      <primitive object={grid} />
      {prepared.dependencyBridges.length > 0 && (
        <primitive object={dependencyLines} name="dependency-bridges" />
      )}
      {REPOSITORY_VISUAL_FAMILIES.map((family) => (
        <InstanceGroup
          key={family}
          family={family}
          group={prepared.groups[family]}
          onSelect={onSelect}
          quality={quality}
        />
      ))}
      {cameraMode !== "photo" && selected !== null && (
        <mesh position={selected} name="selected-object-marker">
          <sphereGeometry args={[0.55, 12, 12]} />
          <meshBasicMaterial color="#f8fafc" wireframe />
        </mesh>
      )}
      {cameraMode !== "photo" && agentPosition !== null && (
        <group
          position={[agentPosition.x, 0.8, agentPosition.z]}
          name="agent-world-action-marker"
        >
          <mesh>
            <boxGeometry args={[0.7, 1.3, 0.5]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.8, 0]}>
            <sphereGeometry args={[0.42, 12, 12]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.55} />
          </mesh>
        </group>
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
  agentPosition,
  cameraMode,
  cameraState,
  fieldOfView,
  cameraEasing,
  onSelect,
  onContextLost,
  reducedMotion,
}: {
  readonly prepared: PreparedRepositoryInstances;
  readonly selectedRef: string | null;
  readonly focusRef: string | null;
  readonly agentPosition: { readonly x: number; readonly z: number } | null;
  readonly cameraMode: RepositoryCameraMode;
  readonly cameraState: RepositoryCameraState;
  readonly fieldOfView: number;
  readonly cameraEasing: number;
  readonly onSelect: (ref: string | null) => void;
  readonly onContextLost: () => void;
  readonly reducedMotion: boolean;
}) {
  const quality = repositoryIslandQuality(prepared.total, reducedMotion);
  return (
    <Canvas
      aria-hidden="true"
      camera={{ position: [18, 22, 24], fov: 45, near: 0.1, far: 10_000 }}
      dpr={quality.dpr}
      frameloop="demand"
      gl={{
        antialias: quality.antialias,
        powerPreference: "high-performance",
      }}
      onPointerMissed={() => onSelect(repositoryPointerMissSelection())}
    >
      <SceneBridge
        prepared={prepared}
        selectedRef={selectedRef}
        focusRef={focusRef}
        agentPosition={agentPosition}
        cameraMode={cameraMode}
        cameraState={cameraState}
        fieldOfView={fieldOfView}
        cameraEasing={cameraEasing}
        onSelect={onSelect}
        onContextLost={onContextLost}
        quality={quality}
      />
    </Canvas>
  );
}
