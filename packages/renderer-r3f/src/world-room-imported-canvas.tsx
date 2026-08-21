import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  GridHelper,
  Group,
  InstancedMesh,
  LinearFilter,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";

import {
  AvatarKitWorldModel,
  avatarGroundOffset,
  type AvatarLayerState,
  type AvatarLod,
  type AvatarSelection,
} from "./avatar-kit-canvas.js";
import {
  ImportedAvatarWorldModel,
  type ImportedAvatarAnimationSample,
  type ImportedAvatarWorldSelection,
} from "./imported-avatar-canvas.js";
import {
  prepareRepositoryInstances,
  type PreparedInstanceGroup,
  REPOSITORY_VISUAL_FAMILIES,
  type RepositoryRenderObject,
  type RepositoryVisualFamily,
} from "./index.js";
import {
  createRepositoryGeometry,
  createRepositoryMaterial,
} from "./repository-visual-kit.js";
import {
  RepositoryCityModels,
  selectRepositoryCityRenderPlan,
} from "./repository-city-canvas.js";
import type { RepositoryCityInstance } from "./repository-city-state.js";
import { createWorldPointerEvents } from "./world-room-canvas.js";

export const WORLD_ROOM_CANVAS_VERSION = "phase18";
const WORLD_AGENT_SPAWN_POSITIONS = [
  [-4.2, 0, 0.8],
  [4.2, 0, 0.8],
  [-3.2, 0, -4],
  [3.2, 0, -4],
] as const;

export function worldAgentSpawnPosition(
  index: number,
): readonly [number, number, number] {
  return WORLD_AGENT_SPAWN_POSITIONS[index] ?? WORLD_AGENT_SPAWN_POSITIONS[0];
}

export type WorldRoomFloor = "blank" | "repository";
export type WorldRoomCamera = {
  readonly yaw: number;
  readonly pitch: number;
};
export type WorldRoomActivity = {
  readonly state:
    "idle" | "thinking" | "tool" | "coding" | "completed" | "failed";
  readonly icon: string;
  readonly label: string;
  readonly detail: "" | "terminal" | "reading" | "tool";
};

export type WorldRoomAgentState = {
  readonly rosterId: string;
  readonly name: string;
  readonly position: Readonly<{ x: number; z: number }>;
  readonly heading: number;
  readonly action: string;
  readonly workState: "idle" | "navigating" | "coding" | "stale";
  readonly objectRef: string | null;
};

export type WorldRenderQuality = {
  readonly cosmeticQuality: "full" | "constrained";
  readonly dpr: 1 | 0.25;
  readonly antialias: boolean;
};

export type WorldRenderLoop = {
  readonly frameloop: "always" | "demand";
  readonly mode:
    "continuous-native" | "continuous-constrained" | "demand-reduced-motion";
  readonly recurringIntervalMs: 42 | null;
};

const CONSTRAINED_WORLD_INVALIDATION_INTERVAL_MS = 42 as const;

const SOFTWARE_RENDERER_PATTERN =
  /swiftshader|llvmpipe|lavapipe|softpipe|software raster|microsoft basic render driver|software emulation/iu;

export function selectWorldRenderQuality(
  hardwareConcurrency: number | null | undefined,
  renderer?: string | null | undefined,
): WorldRenderQuality {
  const constrained =
    SOFTWARE_RENDERER_PATTERN.test(renderer ?? "") ||
    (typeof hardwareConcurrency === "number" &&
      Number.isFinite(hardwareConcurrency) &&
      Number.isInteger(hardwareConcurrency) &&
      hardwareConcurrency > 0 &&
      hardwareConcurrency <= 2);
  return constrained
    ? { cosmeticQuality: "constrained", dpr: 0.25, antialias: false }
    : { cosmeticQuality: "full", dpr: 1, antialias: true };
}

export function selectWorldRenderLoop(
  renderQuality: WorldRenderQuality,
  reducedMotion: boolean,
): WorldRenderLoop {
  if (reducedMotion)
    return {
      frameloop: "demand",
      mode: "demand-reduced-motion",
      recurringIntervalMs: null,
    };
  return renderQuality.cosmeticQuality === "constrained"
    ? {
        frameloop: "demand",
        mode: "continuous-constrained",
        recurringIntervalMs: CONSTRAINED_WORLD_INVALIDATION_INTERVAL_MS,
      }
    : {
        frameloop: "always",
        mode: "continuous-native",
        recurringIntervalMs: null,
      };
}

export type WorldAvatarMotion = {
  readonly skeletal: boolean;
  readonly lightweight: boolean;
};

export function selectWorldAvatarMotion(
  renderQuality: WorldRenderQuality,
  reducedMotion: boolean,
): WorldAvatarMotion {
  if (reducedMotion) return { skeletal: false, lightweight: false };
  return renderQuality.cosmeticQuality === "constrained"
    ? { skeletal: false, lightweight: true }
    : { skeletal: true, lightweight: false };
}

export function selectWorldImportedAvatarMotion(
  reducedMotion: boolean,
  resolvedClipIndex: number | undefined,
  defaultSkeletalMotion: boolean,
): boolean {
  if (reducedMotion) return false;
  return defaultSkeletalMotion || (resolvedClipIndex ?? -1) >= 0;
}

export function calculateLightweightAvatarOffset(
  elapsedSeconds: number,
  phase: number,
  enabled: boolean,
): number {
  return enabled ? Math.sin(elapsedSeconds * 2.4 + phase) * 0.015 : 0;
}

export function startCooperativeWorldInvalidation({
  invalidate,
  scheduleTimeout = (callback, delayMs) =>
    globalThis.setTimeout(callback, delayMs),
  cancelTimeout = (handle) =>
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
}: {
  readonly invalidate: () => void;
  readonly scheduleTimeout?: (callback: () => void, delayMs: number) => unknown;
  readonly cancelTimeout?: (handle: unknown) => void;
}): () => void {
  let active = true;
  let activeHandle: unknown;
  const schedule = () => {
    activeHandle = scheduleTimeout(
      tick,
      CONSTRAINED_WORLD_INVALIDATION_INTERVAL_MS,
    );
  };
  const tick = () => {
    if (!active) return;
    activeHandle = undefined;
    invalidate();
    if (active) schedule();
  };
  schedule();
  return () => {
    if (!active) return;
    active = false;
    if (activeHandle !== undefined) {
      cancelTimeout(activeHandle);
      activeHandle = undefined;
    }
  };
}

function detectWorldRenderer(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const probe = document.createElement("canvas");
  const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
  if (!gl) return undefined;
  try {
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = gl.getParameter(
      debugInfo?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER,
    ) as unknown;
    return typeof renderer === "string" ? renderer : undefined;
  } finally {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

const AVATARS = [
  { id: "user-avatar", position: [0, 0, 0] as const, scale: 0.82 },
  { id: "mr-fluff-avatar", position: [2.6, 0, 0] as const, scale: 0.82 },
] as const;
const IMPORTED_WORLD_AVATAR_SCALE = 1;

const THIRD_PERSON_CAMERA = {
  id: "third-person-user",
  mode: "third-person",
  position: [0, 5, 9.5] as const,
  target: [1, 0.7, 0] as const,
} as const;

const cameraValue = (value: number) => Math.round(value * 1_000) / 1_000;
const ACTIVITY_BUBBLE_ANCHOR = [2.6, 3.25, 0] as const;
const ACTIVITY_BUBBLE_SCALE = [1.65, 0.5, 1] as const;
const REPOSITORY_CENTER = [1.1, 0, -2.4] as const;

const activityVisualLabel = (state: WorldRoomActivity["state"]) =>
  ({
    idle: "idle",
    thinking: "thinking",
    tool: "working",
    coding: "working",
    completed: "done",
    failed: "attention",
  })[state];

export function calculateControlledAvatarYaw(cameraYaw: number): number {
  const modelYaw = Math.PI - cameraYaw;
  return Math.atan2(Math.sin(modelYaw), Math.cos(modelYaw));
}

export function calculateWorldCameraPose({
  userPosition,
  camera,
  agentCount = 1,
  viewportAspect = 16 / 9,
}: {
  readonly userPosition: Readonly<{ x: number; z: number }>;
  readonly camera: WorldRoomCamera;
  readonly agentCount?: number;
  readonly viewportAspect?: number;
}): {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
} {
  const constellationDistance =
    agentCount > 1 ? 11.5 * Math.max(1, 1.3 / viewportAspect) : 5.2;
  const horizontalDistance = Math.cos(camera.pitch) * constellationDistance;
  return {
    position: [
      cameraValue(userPosition.x - Math.sin(camera.yaw) * horizontalDistance),
      cameraValue(1.54 + Math.sin(camera.pitch) * constellationDistance),
      cameraValue(userPosition.z + Math.cos(camera.yaw) * horizontalDistance),
    ],
    target: [userPosition.x + (agentCount > 1 ? 0 : 1), 0.7, userPosition.z],
  };
}

export function projectWorldPointToViewport({
  point,
  camera,
  viewport,
  fovDegrees,
}: {
  readonly point: readonly [number, number, number];
  readonly camera: {
    readonly position: readonly [number, number, number];
    readonly target: readonly [number, number, number];
  };
  readonly viewport: { readonly width: number; readonly height: number };
  readonly fovDegrees: number;
}): { readonly x: number; readonly y: number; readonly depth: number } {
  const subtract = (
    left: readonly [number, number, number],
    right: readonly [number, number, number],
  ) => [left[0] - right[0], left[1] - right[1], left[2] - right[2]] as const;
  const normalize = (value: readonly [number, number, number]) => {
    const length = Math.hypot(...value) || 1;
    return value.map((component) => component / length) as [
      number,
      number,
      number,
    ];
  };
  const cross = (
    left: readonly [number, number, number],
    right: readonly [number, number, number],
  ) =>
    [
      left[1] * right[2] - left[2] * right[1],
      left[2] * right[0] - left[0] * right[2],
      left[0] * right[1] - left[1] * right[0],
    ] as const;
  const dot = (
    left: readonly [number, number, number],
    right: readonly [number, number, number],
  ) => left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
  const forward = normalize(subtract(camera.target, camera.position));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const relative = subtract(point, camera.position);
  const depth = dot(relative, forward);
  const tangent = Math.tan((fovDegrees * Math.PI) / 360);
  const normalizedX =
    (dot(relative, right) / (depth * tangent)) *
    (viewport.height / viewport.width);
  const normalizedY = dot(relative, up) / (depth * tangent);
  return {
    x: cameraValue(((normalizedX + 1) * viewport.width) / 2),
    y: cameraValue(((1 - normalizedY) * viewport.height) / 2),
    depth: cameraValue(depth),
  };
}

export function calculateRepositoryTransform(
  objects: readonly {
    readonly bounds: {
      readonly x: number;
      readonly z: number;
      readonly width: number;
      readonly depth: number;
    };
  }[],
) {
  if (objects.length === 0) return { position: [0, 0, 0] as const, scale: 1 };
  const minimumX = Math.min(...objects.map((object) => object.bounds.x));
  const maximumX = Math.max(
    ...objects.map((object) => object.bounds.x + object.bounds.width),
  );
  const minimumZ = Math.min(...objects.map((object) => object.bounds.z));
  const maximumZ = Math.max(
    ...objects.map((object) => object.bounds.z + object.bounds.depth),
  );
  const span = Math.max(maximumX - minimumX, maximumZ - minimumZ, 1);
  const scale = Math.min(0.24, 6 / span);
  return {
    position: [
      cameraValue(REPOSITORY_CENTER[0] - ((minimumX + maximumX) / 2) * scale),
      0,
      cameraValue(REPOSITORY_CENTER[2] - ((minimumZ + maximumZ) / 2) * scale),
    ] as const,
    scale,
  };
}

export function applyWorldCanvasObservability(
  dataset: DOMStringMap,
  input: {
    readonly userLod: AvatarLod;
    readonly agentLod: AvatarLod;
    readonly reducedMotion: boolean;
    readonly renderQuality: WorldRenderQuality;
  },
): void {
  dataset.userAvatarLod = input.userLod;
  dataset.agentAvatarLod = input.agentLod;
  const renderLoop = selectWorldRenderLoop(
    input.renderQuality,
    input.reducedMotion,
  );
  dataset.renderLoop =
    renderLoop.mode === "demand-reduced-motion" ? "demand" : "continuous";
  dataset.renderLoopMode = renderLoop.mode;
  dataset.cosmeticQuality = input.renderQuality.cosmeticQuality;
  dataset.renderDpr = String(input.renderQuality.dpr);
}

export function prepareWorldActivityBubble({
  activity,
  reducedMotion,
}: {
  readonly activity: WorldRoomActivity;
  readonly reducedMotion: boolean;
}) {
  return {
    anchor: ACTIVITY_BUBBLE_ANCHOR,
    scale: ACTIVITY_BUBBLE_SCALE,
    icon: activity.icon,
    label: activity.label,
    visualLabel: activityVisualLabel(activity.state),
    detailLabel: activity.detail,
    visible: activity.state !== "idle",
    animated:
      !reducedMotion &&
      (activity.state === "thinking" ||
        activity.state === "tool" ||
        activity.state === "coding"),
  } as const;
}

function AgentActivityBillboard({
  activity,
  reducedMotion,
  position,
}: {
  readonly activity: WorldRoomActivity;
  readonly reducedMotion: boolean;
  readonly position: readonly [number, number, number];
}) {
  const descriptor = prepareWorldActivityBubble({ activity, reducedMotion });
  const spriteRef = useRef<Sprite>(null);
  const sprite = useMemo(() => {
    const surface = document.createElement("canvas");
    surface.width = 512;
    surface.height = 160;
    const context = surface.getContext("2d");
    if (context) {
      context.fillStyle = "rgba(3, 9, 20, 0.92)";
      context.strokeStyle = activity.state === "failed" ? "#fb7185" : "#38bdf8";
      context.lineWidth = 8;
      context.beginPath();
      context.roundRect(6, 6, 500, 148, 32);
      context.fill();
      context.stroke();
      context.fillStyle = "#f8fafc";
      context.textBaseline = "middle";
      context.font = "700 52px Consolas, monospace";
      context.fillText(activity.icon || "○", 28, 80);
      context.font = "32px Consolas, monospace";
      context.fillText(
        `${descriptor.visualLabel}${
          descriptor.detailLabel ? ` · ${descriptor.detailLabel}` : ""
        }`,
        122,
        80,
        354,
      );
    }
    const texture = new CanvasTexture(surface);
    texture.minFilter = LinearFilter;
    const instance = new Sprite(
      new SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      }),
    );
    instance.name = `mr-fluff-activity-${activity.state}`;
    instance.position.set(position[0], descriptor.anchor[1], position[2]);
    instance.scale.set(...descriptor.scale);
    instance.renderOrder = 50;
    return instance;
  }, [
    activity,
    descriptor.anchor,
    descriptor.detailLabel,
    descriptor.scale,
    descriptor.visualLabel,
    position,
  ]);
  useEffect(
    () => () => {
      sprite.material.map?.dispose();
      sprite.material.dispose();
    },
    [sprite],
  );
  useFrame(({ clock }) => {
    if (!descriptor.animated || !spriteRef.current) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 4) * 0.035;
    spriteRef.current.scale.set(
      descriptor.scale[0] * pulse,
      descriptor.scale[1] * pulse,
      descriptor.scale[2],
    );
  });
  return descriptor.visible ? (
    <primitive ref={spriteRef} object={sprite} />
  ) : null;
}

function ImportedAvatarGroundingMarker({
  role,
  position,
}: {
  readonly role: "user" | "agent";
  readonly position: readonly [number, number, number];
}) {
  const marker = useMemo(() => {
    const points: Vector3[] = [];
    const segments = 64;
    const radius = 0.34;
    for (let index = 0; index < segments; index += 1) {
      const start = (index / segments) * Math.PI * 2;
      const end = ((index + 1) / segments) * Math.PI * 2;
      const startPoint = new Vector3();
      const endPoint = new Vector3();
      startPoint.set(Math.cos(start) * radius, 0, Math.sin(start) * radius);
      endPoint.set(Math.cos(end) * radius, 0, Math.sin(end) * radius);
      points.push(startPoint, endPoint);
    }
    const marker = new LineSegments(
      new BufferGeometry().setFromPoints(points),
      new LineBasicMaterial({
        color: role === "user" ? "#38bdf8" : "#f59e0b",
      }),
    );
    marker.name = `${role}-imported-avatar-grounding`;
    marker.position.set(position[0], 0.0125, position[2]);
    return marker;
  }, [position, role]);
  return <primitive object={marker} />;
}

export function prepareWorldRoomScene(input: {
  readonly floor: WorldRoomFloor;
  readonly objects: readonly RepositoryRenderObject[];
  readonly userAvatar: AvatarSelection;
  readonly agentAvatar: AvatarSelection;
}) {
  return {
    sceneId: "world-room",
    canvasHosts: 1,
    portal: false,
    floor: {
      kind: input.floor,
      repositoryObjectCount:
        input.floor === "repository" ? input.objects.length : 0,
    },
    camera: THIRD_PERSON_CAMERA,
    avatars: [
      {
        ...AVATARS[0],
        position: [
          AVATARS[0].position[0],
          cameraValue(avatarGroundOffset(input.userAvatar) * AVATARS[0].scale),
          AVATARS[0].position[2],
        ],
        scale: AVATARS[0].scale,
        selection: input.userAvatar,
      },
      {
        ...AVATARS[1],
        position: [
          AVATARS[1].position[0],
          cameraValue(avatarGroundOffset(input.agentAvatar) * AVATARS[1].scale),
          AVATARS[1].position[2],
        ],
        scale: AVATARS[1].scale,
        selection: input.agentAvatar,
      },
    ],
  } as const;
}

function InstanceGroup({
  family,
  group,
}: {
  readonly family: RepositoryVisualFamily;
  readonly group: PreparedInstanceGroup;
}) {
  const mesh = useMemo(() => {
    const instance = new InstancedMesh(
      createRepositoryGeometry(group.geometry),
      createRepositoryMaterial(family),
      group.count,
    );
    const matrix = new Matrix4();
    for (let index = 0; index < group.count; index += 1) {
      matrix.fromArray(group.matrices, index * 16);
      instance.setMatrixAt(index, matrix);
    }
    instance.instanceMatrix.needsUpdate = true;
    instance.name = `world-room-${family}-instances`;
    return instance;
  }, [family, group]);
  return group.count > 0 ? <primitive object={mesh} /> : null;
}

function CooperativeWorldInvalidation() {
  const { invalidate } = useThree();
  useEffect(
    () => startCooperativeWorldInvalidation({ invalidate }),
    [invalidate],
  );
  return null;
}

function LightweightAvatarMotion({
  phase,
  children,
}: {
  readonly phase: number;
  readonly children: ReactNode;
}) {
  const groupRef = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = calculateLightweightAvatarOffset(
      clock.elapsedTime,
      phase,
      true,
    );
  });
  return <group ref={groupRef}>{children}</group>;
}

function CodingWorkHalo({
  position,
}: {
  readonly position: readonly [number, number, number];
}) {
  return (
    <mesh
      name="agent-coding-work-halo"
      position={[position[0], 0.035, position[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[0.62, 0.82, 40]} />
      <meshBasicMaterial color="#22d3ee" transparent opacity={0.78} />
    </mesh>
  );
}

function WorldAvatarModel({
  role,
  selection,
  imported,
  action,
  layerState,
  animate,
  position,
  rotation = [0, 0, 0],
  scale,
  onReady,
  onLodChange,
  onAnimationSample,
  onOneShotComplete,
  animationGeneration,
}: {
  readonly role: "user" | "agent";
  readonly selection: AvatarSelection;
  readonly imported?: ImportedAvatarWorldSelection | undefined;
  readonly action: string;
  readonly layerState: AvatarLayerState;
  readonly animate: boolean;
  readonly position: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number] | undefined;
  readonly scale: number;
  readonly onReady: (role: "user" | "agent") => void;
  readonly onLodChange: (role: "user" | "agent", lod: AvatarLod) => void;
  readonly onAnimationSample: (
    role: "user" | "agent",
    sample: ImportedAvatarAnimationSample,
  ) => void;
  readonly onOneShotComplete: (
    role: "user" | "agent",
    generation: number,
  ) => void;
  readonly animationGeneration: number;
}) {
  return imported ? (
    <ImportedAvatarWorldModel
      role={role}
      selection={imported}
      action={action}
      animate={animate}
      position={position}
      rotation={rotation}
      scale={scale}
      onReady={onReady}
      onLodChange={onLodChange}
      onAnimationSample={onAnimationSample}
      animationGeneration={animationGeneration}
      onOneShotComplete={(completedRole, _semantic, generation) =>
        onOneShotComplete(completedRole, generation)
      }
    />
  ) : (
    <AvatarKitWorldModel
      asset="/assets/avatar/aiw-avatar-kit.glb"
      role={role}
      selection={selection}
      action={action}
      layerState={layerState}
      animate={animate}
      position={position}
      rotation={rotation}
      scale={scale}
      onReady={onReady}
      onLodChange={onLodChange}
    />
  );
}

function WorldRoomScene({
  floor,
  objects,
  cityInstances,
  selectedCityInstanceId,
  cityFocusPosition,
  userPosition,
  camera: cameraLook,
  activity,
  userAvatar,
  agentAvatar,
  agentAvatars,
  agentStates,
  userImportedAvatar,
  agentImportedAvatar,
  agentImportedAvatars,
  userAction,
  agentAction,
  userLayerState,
  agentLayerState,
  reducedMotion,
  avatarReady,
  avatarLod,
  renderQuality,
  onAvatarReady,
  onAvatarLodChange,
  onImportedAnimationSample,
  onImportedOneShotComplete,
  userAnimationGeneration,
  agentAnimationGeneration,
  agentPosition,
  agentHeading,
  onContextLost,
  onCitySelect,
  onCitySettled,
  onCityReady,
}: {
  readonly floor: WorldRoomFloor;
  readonly objects: readonly RepositoryRenderObject[];
  readonly cityInstances: readonly RepositoryCityInstance[];
  readonly selectedCityInstanceId: string | null;
  readonly cityFocusPosition: Readonly<{ x: number; z: number }> | null;
  readonly userPosition: Readonly<{ x: number; z: number }>;
  readonly camera: WorldRoomCamera;
  readonly activity: WorldRoomActivity;
  readonly userAvatar: AvatarSelection;
  readonly agentAvatar: AvatarSelection;
  readonly agentAvatars?: readonly AvatarSelection[];
  readonly agentStates?: readonly WorldRoomAgentState[];
  readonly userImportedAvatar?: ImportedAvatarWorldSelection | undefined;
  readonly agentImportedAvatar?: ImportedAvatarWorldSelection | undefined;
  readonly agentImportedAvatars?: readonly (
    ImportedAvatarWorldSelection | null | undefined
  )[];
  readonly userAction: string;
  readonly agentAction: string;
  readonly userLayerState: AvatarLayerState;
  readonly agentLayerState: AvatarLayerState;
  readonly reducedMotion: boolean;
  readonly avatarReady: Readonly<{ user: boolean; agent: boolean }>;
  readonly avatarLod: Readonly<{ user: AvatarLod; agent: AvatarLod }>;
  readonly renderQuality: WorldRenderQuality;
  readonly onAvatarReady: (role: "user" | "agent") => void;
  readonly onAvatarLodChange: (role: "user" | "agent", lod: AvatarLod) => void;
  readonly onImportedAnimationSample: (
    role: "user" | "agent",
    sample: ImportedAvatarAnimationSample,
  ) => void;
  readonly onImportedOneShotComplete: (
    role: "user" | "agent",
    generation: number,
  ) => void;
  readonly userAnimationGeneration: number;
  readonly agentAnimationGeneration: number;
  readonly agentPosition: Readonly<{ x: number; z: number }>;
  readonly agentHeading: number;
  readonly onContextLost: () => void;
  readonly onCitySelect: (instanceId: string) => void;
  readonly onCitySettled: (instanceId: string) => void;
  readonly onCityReady: () => void;
}) {
  const { camera, gl, invalidate, scene, size } = useThree();
  const controlledAvatarYaw = calculateControlledAvatarYaw(cameraLook.yaw);
  const avatarMotion = selectWorldAvatarMotion(renderQuality, reducedMotion);
  const userImportedClip = userImportedAvatar?.resolvedClip;
  const agentImportedClip = agentImportedAvatar?.resolvedClip;
  const agentWorldPosition = useMemo(
    () => [agentPosition.x, 0, agentPosition.z] as const,
    [agentPosition.x, agentPosition.z],
  );
  const renderedAgentAvatars = (
    agentAvatars?.length ? agentAvatars : [agentAvatar]
  ).slice(0, 4);
  const renderedAgentImports = agentImportedAvatars?.length
    ? agentImportedAvatars.slice(0, 4)
    : [agentImportedAvatar];
  const userAnimationEnabled = selectWorldImportedAvatarMotion(
    reducedMotion,
    userImportedClip?.clipIndex,
    avatarMotion.skeletal,
  );
  const agentAnimationEnabled = selectWorldImportedAvatarMotion(
    reducedMotion,
    agentImportedClip?.clipIndex,
    avatarMotion.skeletal,
  );
  const cityPlan = useMemo(
    () => selectRepositoryCityRenderPlan(cityInstances),
    [cityInstances],
  );
  const fallbackObjects = useMemo(() => {
    const fallbackRefs = new Set(
      cityPlan.aggregate.flatMap((instance) => {
        const ref = instance.linkedRepoData?.ref;
        return typeof ref === "string" ? [ref] : [];
      }),
    );
    return objects.filter(({ ref }) => fallbackRefs.has(ref));
  }, [cityPlan.aggregate, objects]);
  const prepared = useMemo(
    () => prepareRepositoryInstances(fallbackObjects),
    [fallbackObjects],
  );
  const repositoryTransform = useMemo(
    () => calculateRepositoryTransform(objects),
    [objects],
  );
  const floorMesh = useMemo(() => {
    const mesh = new Mesh(
      new BoxGeometry(34, 0.2, 34),
      new MeshStandardMaterial({
        color: floor === "blank" ? "#111827" : "#071b33",
        roughness: 0.9,
      }),
    );
    mesh.position.set(0, -0.1, 0);
    mesh.name = `world-room-${floor}-floor`;
    return mesh;
  }, [floor]);
  const grid = useMemo(() => new GridHelper(34, 17, "#249cff", "#1f2937"), []);
  useEffect(() => {
    const pose = calculateWorldCameraPose({
      userPosition: cityFocusPosition ?? userPosition,
      camera: cameraLook,
      agentCount: renderedAgentAvatars.length,
      viewportAspect: size.width / Math.max(size.height, 1),
    });
    camera.position.set(...pose.position);
    camera.lookAt(new Vector3().fromArray(pose.target));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    gl.domElement.dataset.cameraMode = "third-person";
    gl.domElement.dataset.cameraFocus = cityFocusPosition
      ? "repository-city"
      : "user";
    gl.domElement.dataset.sceneId = "world-room";
    gl.domElement.dataset.floorState = floor;
    gl.domElement.dataset.userPosition = `${userPosition.x},${userPosition.z}`;
    gl.domElement.dataset.cameraYaw = cameraLook.yaw.toFixed(3);
    gl.domElement.dataset.cameraPitch = cameraLook.pitch.toFixed(3);
    gl.domElement.dataset.controlledAvatarHeading = cameraLook.yaw.toFixed(3);
    gl.domElement.dataset.agentAvatarHeading = "independent";
    gl.domElement.dataset.agentActivity = activity.state;
    gl.domElement.dataset.userAvatarAction = userAction;
    gl.domElement.dataset.agentAvatarAction = agentAction;
    gl.domElement.dataset.agentAvatarUpperBody =
      agentLayerState.upperBody ?? "none";
    gl.domElement.dataset.agentAvatarFace = agentLayerState.face ?? "neutral";
    gl.domElement.dataset.agentAvatarGaze = agentLayerState.gaze;
    gl.domElement.dataset.agentAvatarSecondary = agentLayerState.secondary;
    gl.domElement.dataset.userAvatarSpecies = userAvatar.species;
    gl.domElement.dataset.userAvatarShirt = userAvatar.shirt;
    gl.domElement.dataset.userAvatarSource = userImportedAvatar
      ? "imported"
      : "custom";
    gl.domElement.dataset.userAvatarImportedId =
      userImportedAvatar?.assetId ?? "";
    gl.domElement.dataset.userAvatarRenderedClip =
      userImportedClip?.clipName ?? userAction;
    gl.domElement.dataset.userAvatarRenderedClipIndex =
      userImportedClip?.clipIndex.toString() ?? "";
    gl.domElement.dataset.userAvatarLocomotion =
      userImportedClip?.locomotion ?? "";
    gl.domElement.dataset.userAvatarPartInventoryCount = String(
      userImportedAvatar?.parts?.length ?? 0,
    );
    gl.domElement.dataset.userAvatarHiddenPartCount = String(
      userImportedAvatar?.hiddenPartIds?.length ?? 0,
    );
    gl.domElement.dataset.userAvatarGroundOffset = (
      userImportedAvatar?.groundOffset ?? avatarGroundOffset(userAvatar)
    ).toFixed(3);
    gl.domElement.dataset.agentAvatarSpecies = agentAvatar.species;
    gl.domElement.dataset.agentAvatarShirt = agentAvatar.shirt;
    gl.domElement.dataset.agentAvatarSource = agentImportedAvatar
      ? "imported"
      : "custom";
    gl.domElement.dataset.agentAvatarImportedId =
      agentImportedAvatar?.assetId ?? "";
    gl.domElement.dataset.agentAvatarRenderedClip =
      agentImportedClip?.clipName ?? agentAction;
    gl.domElement.dataset.agentAvatarRenderedClipIndex =
      agentImportedClip?.clipIndex.toString() ?? "";
    gl.domElement.dataset.agentAvatarLocomotion =
      agentImportedClip?.locomotion ?? "";
    gl.domElement.dataset.agentAvatarPartInventoryCount = String(
      agentImportedAvatar?.parts?.length ?? 0,
    );
    gl.domElement.dataset.agentAvatarHiddenPartCount = String(
      agentImportedAvatar?.hiddenPartIds?.length ?? 0,
    );
    gl.domElement.dataset.agentAvatarGroundOffset = (
      agentImportedAvatar?.groundOffset ?? avatarGroundOffset(agentAvatar)
    ).toFixed(3);
    gl.domElement.dataset.avatarRenderReady =
      avatarReady.user && avatarReady.agent ? "true" : "false";
    applyWorldCanvasObservability(gl.domElement.dataset, {
      userLod: avatarLod.user,
      agentLod: avatarLod.agent,
      reducedMotion,
      renderQuality,
    });
    invalidate();
  }, [
    agentAvatar,
    agentImportedAvatar,
    agentImportedClip,
    agentAction,
    agentLayerState,
    activity,
    avatarReady,
    avatarLod,
    camera,
    cameraLook,
    cityFocusPosition,
    floor,
    gl,
    invalidate,
    reducedMotion,
    renderQuality,
    renderedAgentAvatars.length,
    size.height,
    size.width,
    userAvatar,
    userImportedAvatar,
    userImportedClip,
    userAction,
    userPosition,
  ]);
  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    gl.domElement.addEventListener("webglcontextlost", handler);
    return () => gl.domElement.removeEventListener("webglcontextlost", handler);
  }, [gl, onContextLost]);
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.dataset.phase18_5RenderReady = "true";
    const measure = (event: Event) => {
      const requestId = (event as CustomEvent).detail?.requestId;
      if (!Number.isInteger(requestId)) return;
      const started = performance.now();
      gl.render(scene, camera);
      gl.getContext().finish();
      canvas.dispatchEvent(
        new CustomEvent("aiw:render-sample", {
          detail: {
            requestId,
            durationMs: performance.now() - started,
          },
        }),
      );
    };
    canvas.addEventListener("aiw:measure-render", measure);
    return () => {
      canvas.removeEventListener("aiw:measure-render", measure);
      delete canvas.dataset.phase18_5RenderReady;
    };
  }, [camera, gl, scene]);
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[6, 10, 5]} intensity={1.6} />
      <primitive object={floorMesh} />
      <primitive object={grid} />
      {floor === "repository" ? (
        <>
          <group name="world-room-repository-city">
            <RepositoryCityModels
              instances={cityPlan.semantic}
              reducedMotion={reducedMotion}
              selectedInstanceId={selectedCityInstanceId}
              onSelect={onCitySelect}
              onSettled={onCitySettled}
              onReady={onCityReady}
            />
          </group>
          {cityPlan.aggregateCount > 0 ? (
            <group
              name="world-room-repository-aggregate-fallback"
              position={repositoryTransform.position}
              scale={repositoryTransform.scale}
            >
              {REPOSITORY_VISUAL_FAMILIES.map((family) => (
                <InstanceGroup
                  key={family}
                  family={family}
                  group={prepared.groups[family]}
                />
              ))}
            </group>
          ) : null}
        </>
      ) : null}
      {userImportedAvatar ? (
        <ImportedAvatarGroundingMarker
          role="user"
          position={[userPosition.x, 0, userPosition.z]}
        />
      ) : null}
      {avatarMotion.lightweight ? (
        <LightweightAvatarMotion phase={0}>
          <WorldAvatarModel
            role="user"
            selection={userAvatar}
            imported={userImportedAvatar}
            action={userAction}
            layerState={userLayerState}
            animate={userAnimationEnabled}
            position={[userPosition.x, 0, userPosition.z]}
            rotation={[0, controlledAvatarYaw, 0]}
            scale={
              userImportedAvatar
                ? IMPORTED_WORLD_AVATAR_SCALE
                : AVATARS[0].scale
            }
            onReady={onAvatarReady}
            onLodChange={onAvatarLodChange}
            onAnimationSample={onImportedAnimationSample}
            onOneShotComplete={onImportedOneShotComplete}
            animationGeneration={userAnimationGeneration}
          />
        </LightweightAvatarMotion>
      ) : (
        <WorldAvatarModel
          role="user"
          selection={userAvatar}
          imported={userImportedAvatar}
          action={userAction}
          layerState={userLayerState}
          animate={userAnimationEnabled}
          position={[userPosition.x, 0, userPosition.z]}
          rotation={[0, controlledAvatarYaw, 0]}
          scale={
            userImportedAvatar ? IMPORTED_WORLD_AVATAR_SCALE : AVATARS[0].scale
          }
          onReady={onAvatarReady}
          onLodChange={onAvatarLodChange}
          onAnimationSample={onImportedAnimationSample}
          onOneShotComplete={onImportedOneShotComplete}
          animationGeneration={userAnimationGeneration}
        />
      )}
      <AgentActivityBillboard
        activity={activity}
        reducedMotion={reducedMotion}
        position={agentWorldPosition}
      />
      {renderedAgentAvatars.map((selection, index) => {
        const state = agentStates?.[index];
        const imported = renderedAgentImports[index];
        const position = state
          ? ([state.position.x, 0, state.position.z] as const)
          : renderedAgentAvatars.length > 1
            ? worldAgentSpawnPosition(index)
            : agentWorldPosition;
        const model = (
          <WorldAvatarModel
            key={`agent-${index + 1}`}
            role="agent"
            selection={selection}
            imported={imported ?? undefined}
            action={
              state?.workState === "coding"
                ? "Idle"
                : (state?.action ?? (index === 0 ? agentAction : "Idle"))
            }
            layerState={agentLayerState}
            animate={index === 0 ? agentAnimationEnabled : false}
            position={position}
            rotation={[
              0,
              state?.heading ?? (index === 0 ? agentHeading : 0),
              0,
            ]}
            scale={imported ? IMPORTED_WORLD_AVATAR_SCALE : AVATARS[1].scale}
            onReady={onAvatarReady}
            onLodChange={onAvatarLodChange}
            onAnimationSample={onImportedAnimationSample}
            onOneShotComplete={onImportedOneShotComplete}
            animationGeneration={index === 0 ? agentAnimationGeneration : 0}
          />
        );
        return (
          <group key={`agent-group-${index + 1}`}>
            {state?.workState === "coding" ? (
              <CodingWorkHalo position={position} />
            ) : null}
            {imported ? (
              <ImportedAvatarGroundingMarker role="agent" position={position} />
            ) : null}
            {avatarMotion.lightweight ? (
              <LightweightAvatarMotion phase={Math.PI + index}>
                {model}
              </LightweightAvatarMotion>
            ) : (
              model
            )}
          </group>
        );
      })}
    </>
  );
}

export function WorldRoomCanvas({
  floor,
  objects,
  cityInstances,
  selectedCityInstanceId,
  cityFocusPosition,
  userPosition,
  camera,
  activity,
  userAvatar,
  agentAvatar,
  agentAvatars,
  agentStates,
  userImportedAvatar,
  agentImportedAvatar,
  agentImportedAvatars,
  userAction,
  agentAction,
  userLayerState,
  agentLayerState,
  reducedMotion,
  onImportedOneShotComplete,
  userAnimationGeneration,
  agentAnimationGeneration,
  agentPosition,
  agentHeading,
  onContextLost,
  onCitySelect,
  onCitySettled,
  onCityReady,
}: {
  readonly floor: WorldRoomFloor;
  readonly objects: readonly RepositoryRenderObject[];
  readonly cityInstances: readonly RepositoryCityInstance[];
  readonly selectedCityInstanceId: string | null;
  readonly cityFocusPosition: Readonly<{ x: number; z: number }> | null;
  readonly userPosition: Readonly<{ x: number; z: number }>;
  readonly camera: WorldRoomCamera;
  readonly activity: WorldRoomActivity;
  readonly userAvatar: AvatarSelection;
  readonly agentAvatar: AvatarSelection;
  readonly agentAvatars?: readonly AvatarSelection[];
  readonly agentStates?: readonly WorldRoomAgentState[];
  readonly userImportedAvatar?: ImportedAvatarWorldSelection | undefined;
  readonly agentImportedAvatar?: ImportedAvatarWorldSelection | undefined;
  readonly agentImportedAvatars?: readonly (
    ImportedAvatarWorldSelection | null | undefined
  )[];
  readonly userAction: string;
  readonly agentAction: string;
  readonly userLayerState: AvatarLayerState;
  readonly agentLayerState: AvatarLayerState;
  readonly reducedMotion: boolean;
  readonly onImportedOneShotComplete: (
    role: "user" | "agent",
    generation: number,
  ) => void;
  readonly userAnimationGeneration: number;
  readonly agentAnimationGeneration: number;
  readonly agentPosition: Readonly<{ x: number; z: number }>;
  readonly agentHeading: number;
  readonly onContextLost: () => void;
  readonly onCitySelect: (instanceId: string) => void;
  readonly onCitySettled: (instanceId: string) => void;
  readonly onCityReady: () => void;
}) {
  const userImportedClip = userImportedAvatar?.resolvedClip;
  const agentImportedClip = agentImportedAvatar?.resolvedClip;
  const [renderQuality] = useState(() =>
    selectWorldRenderQuality(
      typeof navigator === "undefined"
        ? undefined
        : navigator.hardwareConcurrency,
      detectWorldRenderer(),
    ),
  );
  const renderLoop = selectWorldRenderLoop(renderQuality, reducedMotion);
  const [avatarReady, setAvatarReady] = useState({
    user: false,
    agent: false,
  });
  const [avatarLod, setAvatarLod] = useState<{
    user: AvatarLod;
    agent: AvatarLod;
  }>({ user: "LOD0", agent: "LOD0" });
  const [animationSamples, setAnimationSamples] = useState<
    Readonly<Partial<Record<"user" | "agent", ImportedAvatarAnimationSample>>>
  >({});
  const onAvatarReady = useCallback((role: "user" | "agent") => {
    setAvatarReady((current) =>
      current[role] ? current : { ...current, [role]: true },
    );
  }, []);
  const onAvatarLodChange = useCallback(
    (role: "user" | "agent", lod: AvatarLod) => {
      setAvatarLod((current) =>
        current[role] === lod ? current : { ...current, [role]: lod },
      );
    },
    [],
  );
  const onImportedAnimationSample = useCallback(
    (role: "user" | "agent", sample: ImportedAvatarAnimationSample) => {
      setAnimationSamples((current) =>
        current[role]?.mixerRootUuid === sample.mixerRootUuid &&
        current[role]?.sequence === sample.sequence
          ? current
          : { ...current, [role]: sample },
      );
    },
    [],
  );
  const userAnimationSample = animationSamples.user;
  const agentAnimationSample = animationSamples.agent;
  return (
    <Canvas
      events={createWorldPointerEvents}
      aria-hidden="true"
      className="world-room__canvas"
      data-testid="world-room-canvas"
      data-scene-id="world-room"
      data-floor-state={floor}
      data-user-avatar-species={userAvatar.species}
      data-user-avatar-shirt={userAvatar.shirt}
      data-user-avatar-source={userImportedAvatar ? "imported" : "custom"}
      data-user-avatar-imported-id={userImportedAvatar?.assetId ?? ""}
      data-user-avatar-rendered-clip={userImportedClip?.clipName ?? userAction}
      data-user-avatar-rendered-clip-index={userImportedClip?.clipIndex ?? ""}
      data-user-avatar-locomotion={userImportedClip?.locomotion ?? ""}
      data-user-avatar-semantic={userImportedClip?.semantic ?? userAction}
      data-user-avatar-animation-verification={
        userImportedClip?.verification ?? "custom"
      }
      data-user-avatar-animation-error={userImportedClip?.error ?? ""}
      data-user-avatar-part-inventory-count={
        userImportedAvatar?.parts?.length ?? 0
      }
      data-user-avatar-hidden-part-count={
        userImportedAvatar?.hiddenPartIds?.length ?? 0
      }
      data-user-avatar-ground-offset={(
        userImportedAvatar?.groundOffset ?? avatarGroundOffset(userAvatar)
      ).toFixed(3)}
      data-agent-avatar-species={agentAvatar.species}
      data-agent-avatar-shirt={agentAvatar.shirt}
      data-agent-avatar-source={agentImportedAvatar ? "imported" : "custom"}
      data-agent-avatar-imported-id={agentImportedAvatar?.assetId ?? ""}
      data-agent-avatar-rendered-clip={
        agentImportedClip?.clipName ?? agentAction
      }
      data-agent-avatar-rendered-clip-index={agentImportedClip?.clipIndex ?? ""}
      data-agent-avatar-locomotion={agentImportedClip?.locomotion ?? ""}
      data-agent-avatar-semantic={agentImportedClip?.semantic ?? agentAction}
      data-agent-avatar-animation-verification={
        agentImportedClip?.verification ?? "custom"
      }
      data-agent-avatar-animation-error={agentImportedClip?.error ?? ""}
      data-user-avatar-animation-source-id={
        userAnimationSample?.sourceAssetId ?? ""
      }
      data-user-avatar-mixer-root={userAnimationSample?.mixerRootUuid ?? ""}
      data-user-avatar-mixer-time={userAnimationSample?.mixerTime ?? ""}
      data-user-avatar-action-time={userAnimationSample?.actionTime ?? ""}
      data-user-avatar-animation-sequence={userAnimationSample?.sequence ?? ""}
      data-user-avatar-animation-progression={
        userAnimationSample?.progression ?? "pending"
      }
      data-user-avatar-bone-name={userAnimationSample?.boneName ?? ""}
      data-user-avatar-bone-quaternion={
        userAnimationSample?.boneQuaternion.join(",") ?? ""
      }
      data-agent-avatar-animation-source-id={
        agentAnimationSample?.sourceAssetId ?? ""
      }
      data-agent-avatar-mixer-root={agentAnimationSample?.mixerRootUuid ?? ""}
      data-agent-avatar-mixer-time={agentAnimationSample?.mixerTime ?? ""}
      data-agent-avatar-action-time={agentAnimationSample?.actionTime ?? ""}
      data-agent-avatar-animation-sequence={
        agentAnimationSample?.sequence ?? ""
      }
      data-agent-avatar-animation-progression={
        agentAnimationSample?.progression ?? "pending"
      }
      data-agent-avatar-bone-name={agentAnimationSample?.boneName ?? ""}
      data-agent-avatar-bone-quaternion={
        agentAnimationSample?.boneQuaternion.join(",") ?? ""
      }
      data-agent-avatar-part-inventory-count={
        agentImportedAvatar?.parts?.length ?? 0
      }
      data-agent-avatar-hidden-part-count={
        agentImportedAvatar?.hiddenPartIds?.length ?? 0
      }
      data-agent-avatar-ground-offset={(
        agentImportedAvatar?.groundOffset ?? avatarGroundOffset(agentAvatar)
      ).toFixed(3)}
      data-controlled-avatar-heading={camera.yaw.toFixed(3)}
      data-agent-avatar-heading="independent"
      data-camera-yaw={camera.yaw.toFixed(3)}
      data-camera-pitch={camera.pitch.toFixed(3)}
      data-agent-activity={activity.state}
      data-user-avatar-action={userAction}
      data-agent-avatar-action={agentAction}
      data-agent-state-count={agentStates?.length ?? 0}
      data-agent-work-states={
        agentStates
          ?.map(
            ({ rosterId, workState, objectRef }) =>
              `${rosterId}:${workState}:${objectRef ?? ""}`,
          )
          .join("|") ?? ""
      }
      data-agent-avatar-upper-body={agentLayerState.upperBody ?? "none"}
      data-agent-avatar-face={agentLayerState.face ?? "neutral"}
      data-agent-avatar-gaze={agentLayerState.gaze}
      data-agent-avatar-secondary={agentLayerState.secondary}
      data-user-avatar-lod={avatarLod.user}
      data-agent-avatar-lod={avatarLod.agent}
      data-render-loop={
        renderLoop.mode === "demand-reduced-motion" ? "demand" : "continuous"
      }
      data-render-loop-mode={renderLoop.mode}
      data-cosmetic-quality={renderQuality.cosmeticQuality}
      data-render-dpr={renderQuality.dpr}
      data-avatar-render-ready={
        avatarReady.user && avatarReady.agent ? "true" : "false"
      }
      camera={{ position: THIRD_PERSON_CAMERA.position, fov: 46 }}
      dpr={renderQuality.dpr}
      frameloop={renderLoop.frameloop}
      gl={{
        antialias: renderQuality.antialias,
        powerPreference: "high-performance",
      }}
      onPointerMissed={() => undefined}
    >
      {renderLoop.mode === "continuous-constrained" ? (
        <CooperativeWorldInvalidation />
      ) : null}
      <WorldRoomScene
        floor={floor}
        objects={objects}
        cityInstances={cityInstances}
        selectedCityInstanceId={selectedCityInstanceId}
        cityFocusPosition={cityFocusPosition}
        userPosition={userPosition}
        camera={camera}
        activity={activity}
        userAvatar={userAvatar}
        agentAvatar={agentAvatar}
        {...(agentAvatars ? { agentAvatars } : {})}
        {...(agentStates ? { agentStates } : {})}
        userImportedAvatar={userImportedAvatar}
        agentImportedAvatar={agentImportedAvatar}
        {...(agentImportedAvatars ? { agentImportedAvatars } : {})}
        userAction={userAction}
        agentAction={agentAction}
        userLayerState={userLayerState}
        agentLayerState={agentLayerState}
        reducedMotion={reducedMotion}
        avatarReady={avatarReady}
        avatarLod={avatarLod}
        renderQuality={renderQuality}
        onAvatarReady={onAvatarReady}
        onAvatarLodChange={onAvatarLodChange}
        onImportedAnimationSample={onImportedAnimationSample}
        onImportedOneShotComplete={onImportedOneShotComplete}
        userAnimationGeneration={userAnimationGeneration}
        agentAnimationGeneration={agentAnimationGeneration}
        agentPosition={agentPosition}
        agentHeading={agentHeading}
        onContextLost={onContextLost}
        onCitySelect={onCitySelect}
        onCitySettled={onCitySettled}
        onCityReady={onCityReady}
      />
    </Canvas>
  );
}
