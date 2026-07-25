import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BoxGeometry,
  CanvasTexture,
  GridHelper,
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
  type AvatarSelection,
} from "./avatar-kit-canvas.js";
import {
  prepareRepositoryInstances,
  type PreparedInstanceGroup,
  type RenderObjectKind,
  type RepositoryRenderObject,
} from "./index.js";

export const WORLD_ROOM_CANVAS_VERSION = "phase18";

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
};

const AVATARS = [
  { id: "user-avatar", position: [0, 0, 0] as const },
  { id: "mr-fluff-avatar", position: [3, 0, 2] as const },
] as const;

const THIRD_PERSON_CAMERA = {
  id: "third-person-user",
  mode: "third-person",
  position: [0, 7, 12] as const,
  target: [0, 1, 0] as const,
} as const;

const cameraValue = (value: number) => Math.round(value * 1_000) / 1_000;
const ACTIVITY_BUBBLE_ANCHOR = [3, 3.45, 2] as const;
const ACTIVITY_BUBBLE_SCALE = [3.8, 1.2, 1] as const;

const activityVisualLabel = (state: WorldRoomActivity["state"]) =>
  ({
    idle: "idle",
    thinking: "thinking",
    tool: "tool",
    coding: "coding",
    completed: "done",
    failed: "attention",
  })[state];

export function calculateWorldCameraPose({
  userPosition,
  camera,
}: {
  readonly userPosition: Readonly<{ x: number; z: number }>;
  readonly camera: WorldRoomCamera;
}): {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
} {
  const distance = 12;
  const horizontalDistance = Math.cos(camera.pitch) * distance;
  return {
    position: [
      cameraValue(userPosition.x + Math.sin(camera.yaw) * horizontalDistance),
      cameraValue(1.6 + Math.sin(camera.pitch) * distance),
      cameraValue(userPosition.z + Math.cos(camera.yaw) * horizontalDistance),
    ],
    target: [userPosition.x, 1.2, userPosition.z],
  };
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
}: {
  readonly activity: WorldRoomActivity;
  readonly reducedMotion: boolean;
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
      context.fillText(descriptor.visualLabel, 122, 80, 354);
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
    instance.position.set(...descriptor.anchor);
    instance.scale.set(...descriptor.scale);
    instance.renderOrder = 50;
    return instance;
  }, [activity, descriptor.anchor, descriptor.scale, descriptor.visualLabel]);
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
      { ...AVATARS[0], selection: input.userAvatar },
      { ...AVATARS[1], selection: input.agentAvatar },
    ],
  } as const;
}

const repositoryColors: Readonly<Record<RenderObjectKind, string>> = {
  package: "#8b5cf6",
  directory: "#38bdf8",
  file: "#2563eb",
  symbol: "#22d3ee",
};

function InstanceGroup({
  kind,
  group,
}: {
  readonly kind: RenderObjectKind;
  readonly group: PreparedInstanceGroup;
}) {
  const mesh = useMemo(() => {
    const instance = new InstancedMesh(
      new BoxGeometry(),
      new MeshStandardMaterial({
        color: repositoryColors[kind],
        roughness: 0.68,
      }),
      group.count,
    );
    const matrix = new Matrix4();
    for (let index = 0; index < group.count; index += 1) {
      matrix.fromArray(group.matrices, index * 16);
      instance.setMatrixAt(index, matrix);
    }
    instance.instanceMatrix.needsUpdate = true;
    instance.name = `world-room-${kind}-instances`;
    return instance;
  }, [group, kind]);
  return group.count > 0 ? <primitive object={mesh} /> : null;
}

function WorldRoomScene({
  floor,
  objects,
  userPosition,
  camera: cameraLook,
  activity,
  userAvatar,
  agentAvatar,
  reducedMotion,
  avatarReady,
  onAvatarReady,
  onContextLost,
}: {
  readonly floor: WorldRoomFloor;
  readonly objects: readonly RepositoryRenderObject[];
  readonly userPosition: Readonly<{ x: number; z: number }>;
  readonly camera: WorldRoomCamera;
  readonly activity: WorldRoomActivity;
  readonly userAvatar: AvatarSelection;
  readonly agentAvatar: AvatarSelection;
  readonly reducedMotion: boolean;
  readonly avatarReady: Readonly<{ user: boolean; agent: boolean }>;
  readonly onAvatarReady: (role: "user" | "agent") => void;
  readonly onContextLost: () => void;
}) {
  const { camera, gl, invalidate } = useThree();
  const prepared = useMemo(
    () => prepareRepositoryInstances(objects),
    [objects],
  );
  const repositoryTransform = useMemo(() => {
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
    const scale = Math.min(0.4, 10 / span);
    return {
      position: [
        5.2 - ((minimumX + maximumX) / 2) * scale,
        0,
        3 - ((minimumZ + maximumZ) / 2) * scale,
      ] as const,
      scale,
    };
  }, [objects]);
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
      userPosition,
      camera: cameraLook,
    });
    camera.position.set(...pose.position);
    camera.lookAt(new Vector3().fromArray(pose.target));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    gl.domElement.dataset.cameraMode = "third-person";
    gl.domElement.dataset.sceneId = "world-room";
    gl.domElement.dataset.floorState = floor;
    gl.domElement.dataset.userPosition = `${userPosition.x},${userPosition.z}`;
    gl.domElement.dataset.cameraYaw = cameraLook.yaw.toFixed(3);
    gl.domElement.dataset.cameraPitch = cameraLook.pitch.toFixed(3);
    gl.domElement.dataset.agentActivity = activity.state;
    gl.domElement.dataset.userAvatarSpecies = userAvatar.species;
    gl.domElement.dataset.userAvatarShirt = userAvatar.shirt;
    gl.domElement.dataset.agentAvatarSpecies = agentAvatar.species;
    gl.domElement.dataset.agentAvatarShirt = agentAvatar.shirt;
    gl.domElement.dataset.avatarRenderReady =
      avatarReady.user && avatarReady.agent ? "true" : "false";
    invalidate();
  }, [
    agentAvatar,
    activity,
    avatarReady,
    camera,
    cameraLook,
    floor,
    gl,
    invalidate,
    userAvatar,
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
  return (
    <>
      <ambientLight intensity={1.25} />
      <directionalLight position={[6, 10, 5]} intensity={2.1} />
      <primitive object={floorMesh} />
      <primitive object={grid} />
      {floor === "repository" ? (
        <group
          name="world-room-repository-landscape"
          position={repositoryTransform.position}
          scale={repositoryTransform.scale}
        >
          {(Object.keys(prepared.groups) as RenderObjectKind[]).map((kind) => (
            <InstanceGroup
              key={kind}
              kind={kind}
              group={prepared.groups[kind]}
            />
          ))}
        </group>
      ) : null}
      <AvatarKitWorldModel
        asset="/assets/avatar/aiw-avatar-kit.glb"
        role="user"
        selection={userAvatar}
        action="Idle"
        animate={!reducedMotion}
        position={[userPosition.x, 0, userPosition.z]}
        onReady={onAvatarReady}
      />
      <AgentActivityBillboard
        activity={activity}
        reducedMotion={reducedMotion}
      />
      <AvatarKitWorldModel
        asset="/assets/avatar/aiw-avatar-kit.glb"
        role="agent"
        selection={agentAvatar}
        action="Idle"
        animate={!reducedMotion}
        position={AVATARS[1].position}
        onReady={onAvatarReady}
      />
    </>
  );
}

export function WorldRoomCanvas({
  floor,
  objects,
  userPosition,
  camera,
  activity,
  userAvatar,
  agentAvatar,
  reducedMotion,
  onContextLost,
}: {
  readonly floor: WorldRoomFloor;
  readonly objects: readonly RepositoryRenderObject[];
  readonly userPosition: Readonly<{ x: number; z: number }>;
  readonly camera: WorldRoomCamera;
  readonly activity: WorldRoomActivity;
  readonly userAvatar: AvatarSelection;
  readonly agentAvatar: AvatarSelection;
  readonly reducedMotion: boolean;
  readonly onContextLost: () => void;
}) {
  const [avatarReady, setAvatarReady] = useState({
    user: false,
    agent: false,
  });
  const onAvatarReady = useCallback((role: "user" | "agent") => {
    setAvatarReady((current) =>
      current[role] ? current : { ...current, [role]: true },
    );
  }, []);
  return (
    <Canvas
      aria-hidden="true"
      className="world-room__canvas"
      data-testid="world-room-canvas"
      data-scene-id="world-room"
      data-floor-state={floor}
      data-user-avatar-species={userAvatar.species}
      data-user-avatar-shirt={userAvatar.shirt}
      data-agent-avatar-species={agentAvatar.species}
      data-agent-avatar-shirt={agentAvatar.shirt}
      data-camera-yaw={camera.yaw.toFixed(3)}
      data-camera-pitch={camera.pitch.toFixed(3)}
      data-agent-activity={activity.state}
      data-avatar-render-ready={
        avatarReady.user && avatarReady.agent ? "true" : "false"
      }
      camera={{ position: THIRD_PERSON_CAMERA.position, fov: 52 }}
      dpr={reducedMotion ? 1 : [1, 1.5]}
      frameloop={reducedMotion ? "demand" : "always"}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => undefined}
    >
      <WorldRoomScene
        floor={floor}
        objects={objects}
        userPosition={userPosition}
        camera={camera}
        activity={activity}
        userAvatar={userAvatar}
        agentAvatar={agentAvatar}
        reducedMotion={reducedMotion}
        avatarReady={avatarReady}
        onAvatarReady={onAvatarReady}
        onContextLost={onContextLost}
      />
    </Canvas>
  );
}
