import {
  Canvas,
  events as createPointerEvents,
  useFrame,
  useThree,
  type RootStore,
} from "@react-three/fiber";
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
  CanvasTexture,
  GridHelper,
  Group,
  InstancedMesh,
  LinearFilter,
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
import {
  REPOSITORY_CITY_FLOOR_SIZE,
  type RepositoryCityInstance,
} from "./repository-city-state.js";

export const WORLD_ROOM_CANVAS_VERSION = "phase18";

export function createWorldPointerEvents(store: RootStore) {
  const events = createPointerEvents(store);
  const connect = events.connect;
  return {
    ...events,
    connect(target: HTMLElement) {
      // Canvas setup is asynchronous. A superseded canvas can finish setup
      // after unmount, when R3F's internal event source has become null.
      if (target) connect?.(target);
    },
  };
}

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
    agentCount > 1 ? 13.2 * Math.max(1, 1.3 / viewportAspect) : 10.1;
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
    instance.name = `agent-activity-${activity.state}`;
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

export function prepareWorldRoomScene(input: {
  readonly floor: WorldRoomFloor;
  readonly objects: readonly RepositoryRenderObject[];
  readonly userAvatar: AvatarSelection;
  readonly agentAvatar: AvatarSelection;
  readonly agentAvatars?: readonly AvatarSelection[];
}) {
  const agents = input.agentAvatars?.slice(0, 4);
  const preparedAgents = agents?.length
    ? agents.map((selection, index) => {
        const position = worldAgentSpawnPosition(index);
        return {
          id: `agent-${index + 1}`,
          role: "agent" as const,
          position: [
            position[0],
            cameraValue(avatarGroundOffset(selection) * AVATARS[1].scale),
            position[2],
          ] as const,
          scale: AVATARS[1].scale,
          selection,
        };
      })
    : [
        {
          ...AVATARS[1],
          position: [
            AVATARS[1].position[0],
            cameraValue(
              avatarGroundOffset(input.agentAvatar) * AVATARS[1].scale,
            ),
            AVATARS[1].position[2],
          ],
          scale: AVATARS[1].scale,
          selection: input.agentAvatar,
        },
      ];
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
      ...preparedAgents,
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

function WorldRoomScene({
  floor,
  objects,
  cityInstances,
  selectedCityInstanceId,
  cityFocusPosition,
  userPosition,
  camera: cameraLook,
  activity,
  agentActivities,
  userAvatar,
  agentAvatar,
  agentAvatars,
  agentStates,
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
  readonly agentActivities?: readonly WorldRoomActivity[];
  readonly userAvatar: AvatarSelection;
  readonly agentAvatar: AvatarSelection;
  readonly agentAvatars?: readonly AvatarSelection[];
  readonly agentStates?: readonly WorldRoomAgentState[];
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
  readonly onContextLost: () => void;
  readonly onCitySelect: (instanceId: string) => void;
  readonly onCitySettled: (instanceId: string) => void;
  readonly onCityReady: () => void;
}) {
  const { camera, gl, invalidate, scene, size } = useThree();
  const controlledAvatarYaw = calculateControlledAvatarYaw(cameraLook.yaw);
  const avatarMotion = selectWorldAvatarMotion(renderQuality, reducedMotion);
  const renderedAgentAvatars = (
    agentAvatars?.length ? agentAvatars : [agentAvatar]
  ).slice(0, 4);
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
      new BoxGeometry(
        REPOSITORY_CITY_FLOOR_SIZE,
        0.2,
        REPOSITORY_CITY_FLOOR_SIZE,
      ),
      new MeshStandardMaterial({
        color: floor === "blank" ? "#111827" : "#071b33",
        roughness: 0.9,
      }),
    );
    mesh.position.set(0, -0.1, 0);
    mesh.name = `world-room-${floor}-floor`;
    return mesh;
  }, [floor]);
  const grid = useMemo(
    () =>
      new GridHelper(
        REPOSITORY_CITY_FLOOR_SIZE,
        REPOSITORY_CITY_FLOOR_SIZE / 2,
        "#249cff",
        "#1f2937",
      ),
    [],
  );
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
    gl.domElement.dataset.userAvatarGroundOffset =
      avatarGroundOffset(userAvatar).toFixed(3);
    gl.domElement.dataset.agentAvatarSpecies = agentAvatar.species;
    gl.domElement.dataset.agentAvatarShirt = agentAvatar.shirt;
    gl.domElement.dataset.agentAvatarGroundOffset =
      avatarGroundOffset(agentAvatar).toFixed(3);
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
      {avatarMotion.lightweight ? (
        <LightweightAvatarMotion phase={0}>
          <AvatarKitWorldModel
            asset="/assets/avatar/aiw-avatar-kit.glb"
            role="user"
            selection={userAvatar}
            action={userAction}
            layerState={userLayerState}
            animate={avatarMotion.skeletal}
            position={[userPosition.x, 0, userPosition.z]}
            rotation={[0, controlledAvatarYaw, 0]}
            scale={AVATARS[0].scale}
            onReady={onAvatarReady}
            onLodChange={onAvatarLodChange}
          />
        </LightweightAvatarMotion>
      ) : (
        <AvatarKitWorldModel
          asset="/assets/avatar/aiw-avatar-kit.glb"
          role="user"
          selection={userAvatar}
          action={userAction}
          layerState={userLayerState}
          animate={avatarMotion.skeletal}
          position={[userPosition.x, 0, userPosition.z]}
          rotation={[0, controlledAvatarYaw, 0]}
          scale={AVATARS[0].scale}
          onReady={onAvatarReady}
          onLodChange={onAvatarLodChange}
        />
      )}
      {renderedAgentAvatars.map((_, index) => {
        const state = agentStates?.[index];
        const position = state
          ? ([state.position.x, 0, state.position.z] as const)
          : worldAgentSpawnPosition(index);
        return (
          <AgentActivityBillboard
            key={`agent-activity-${index + 1}`}
            activity={
              agentActivities?.[index] ??
              (index === 0
                ? activity
                : {
                    state: "idle",
                    icon: "",
                    label: "Agent is idle",
                    detail: "",
                  })
            }
            reducedMotion={reducedMotion}
            position={position}
          />
        );
      })}
      {renderedAgentAvatars.map((selection, index) => {
        const state = agentStates?.[index];
        const position = state
          ? ([state.position.x, 0, state.position.z] as const)
          : worldAgentSpawnPosition(index);
        const model = (
          <AvatarKitWorldModel
            asset="/assets/avatar/aiw-avatar-kit.glb"
            role="agent"
            selection={selection}
            action={state?.action ?? (index === 0 ? agentAction : "Idle")}
            layerState={agentLayerState}
            animate={avatarMotion.skeletal}
            position={position}
            rotation={[0, state?.heading ?? 0, 0]}
            scale={AVATARS[1].scale}
            onReady={onAvatarReady}
            onLodChange={onAvatarLodChange}
          />
        );
        return (
          <group key={`agent-group-${index + 1}`}>
            {state?.workState === "coding" ? (
              <CodingWorkHalo position={position} />
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
  agentActivities,
  userAvatar,
  agentAvatar,
  agentAvatars,
  agentStates,
  userAction,
  agentAction,
  userLayerState,
  agentLayerState,
  reducedMotion,
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
  readonly agentActivities?: readonly WorldRoomActivity[];
  readonly userAvatar: AvatarSelection;
  readonly agentAvatar: AvatarSelection;
  readonly agentAvatars?: readonly AvatarSelection[];
  readonly agentStates?: readonly WorldRoomAgentState[];
  readonly userAction: string;
  readonly agentAction: string;
  readonly userLayerState: AvatarLayerState;
  readonly agentLayerState: AvatarLayerState;
  readonly reducedMotion: boolean;
  readonly onContextLost: () => void;
  readonly onCitySelect: (instanceId: string) => void;
  readonly onCitySettled: (instanceId: string) => void;
  readonly onCityReady: () => void;
}) {
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
      data-user-avatar-ground-offset={avatarGroundOffset(userAvatar).toFixed(3)}
      data-agent-avatar-species={agentAvatar.species}
      data-agent-avatar-shirt={agentAvatar.shirt}
      data-agent-avatar-ground-offset={avatarGroundOffset(agentAvatar).toFixed(
        3,
      )}
      data-controlled-avatar-heading={camera.yaw.toFixed(3)}
      data-agent-avatar-heading="independent"
      data-camera-yaw={camera.yaw.toFixed(3)}
      data-camera-pitch={camera.pitch.toFixed(3)}
      data-agent-activity={activity.state}
      data-agent-activities={
        agentActivities
          ?.map((agentActivity) => agentActivity.state)
          .join(",") ?? activity.state
      }
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
        {...(agentActivities ? { agentActivities } : {})}
        userAvatar={userAvatar}
        agentAvatar={agentAvatar}
        {...(agentAvatars ? { agentAvatars } : {})}
        {...(agentStates ? { agentStates } : {})}
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
        onContextLost={onContextLost}
        onCitySelect={onCitySelect}
        onCitySettled={onCitySettled}
        onCityReady={onCityReady}
      />
    </Canvas>
  );
}
