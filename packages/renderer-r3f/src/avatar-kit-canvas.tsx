import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimationMixer,
  type AnimationAction,
  type Group,
  type Material,
  type Mesh,
  type Object3D,
} from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

export type AvatarSelection = {
  readonly species: string;
  readonly head: string;
  readonly hands: string;
  readonly feet: string;
  readonly fur: string;
  readonly tail: string;
  readonly markings: string;
  readonly bodyColor: string;
  readonly shirt: string;
};

const VISIBLE_GROUND_OFFSETS = {
  feet: 0.855,
  paws: 0.85,
  "clawed-paws": 0.85,
} as const;

export function avatarGroundOffset(selection: AvatarSelection): number {
  return (
    VISIBLE_GROUND_OFFSETS[
      selection.feet as keyof typeof VISIBLE_GROUND_OFFSETS
    ] ?? (selection.species === "human" ? 0.855 : 0.85)
  );
}

const avatarSelectionKey = (selection: AvatarSelection) =>
  [
    selection.species,
    selection.head,
    selection.hands,
    selection.feet,
    selection.fur,
    selection.tail,
    selection.markings,
    selection.bodyColor,
    selection.shirt,
  ].join(":");

const modularPrefixes = [
  "HEAD_",
  "HAND_",
  "FOOT_",
  "FUR_",
  "TAIL_",
  "MARKING_",
  "SHIRT_",
  "COLOR_SWATCH_",
];

function configureScene(source: Group, selection: AvatarSelection): Group {
  const scene = SkeletonUtils.clone(source);
  const visible = new Set([
    `HEAD_${selection.species}_${selection.head}`,
    `HAND_${selection.hands}_L`,
    `HAND_${selection.hands}_R`,
    `FOOT_${selection.feet}_L`,
    `FOOT_${selection.feet}_R`,
    `FUR_${selection.fur}`,
    `TAIL_${selection.tail}`,
    `MARKING_${selection.markings}`,
    `SHIRT_${selection.shirt}`,
    `SHIRT_LABEL_${selection.shirt}`,
  ]);
  scene.traverse((object: Object3D) => {
    if (modularPrefixes.some((prefix) => object.name.startsWith(prefix)))
      object.visible = visible.has(object.name);
    if (
      object.name === "FUR_none" ||
      object.name === "TAIL_none" ||
      object.name === "MARKING_solid" ||
      object.name.startsWith("COLOR_SWATCH_")
    )
      object.visible = false;
  });
  const swatch = scene.getObjectByName(
    `COLOR_SWATCH_${selection.bodyColor}`,
  ) as Mesh | undefined;
  const material = swatch?.material as Material | undefined;
  if (material)
    scene.traverse((object: Object3D) => {
      const mesh = object as Mesh;
      if (
        (object.name.startsWith("CORE_") ||
          object.name.startsWith("HEAD_") ||
          object.name.startsWith("HAND_") ||
          object.name.startsWith("FOOT_") ||
          object.name.startsWith("FUR_") ||
          object.name.startsWith("TAIL_")) &&
        "material" in mesh
      ) {
        const current = mesh.material;
        mesh.material = Array.isArray(current)
          ? current.map((candidate) =>
              candidate.name === "MAT_CLAW" ||
              candidate.name.startsWith("MAT_FACE_")
                ? candidate
                : material,
            )
          : material;
      }
    });
  return scene;
}

function AvatarModel({
  gltf,
  selection,
  action,
  animate,
  position = [0, -0.45, 0],
  rotation = [0, 0, 0],
  scale = 1,
}: {
  readonly gltf: GLTF;
  readonly selection: AvatarSelection;
  readonly action: string;
  readonly animate: boolean;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number;
}) {
  const scene = useMemo(
    () => configureScene(gltf.scene, selection),
    [gltf, selection],
  );
  const mixer = useMemo(() => new AnimationMixer(scene), [scene]);
  const current = useRef<AnimationAction | null>(null);
  useEffect(() => {
    const clip = gltf.animations.find((candidate) => candidate.name === action);
    if (!clip) return;
    current.current?.fadeOut(0.18);
    const next = mixer.clipAction(clip);
    next.reset();
    next.setEffectiveWeight(1);
    next.fadeIn(0.18);
    next.play();
    if (!animate) {
      next.paused = true;
      next.time = 0;
      mixer.update(0);
    }
    current.current = next;
    return () => {
      next.stop();
    };
  }, [action, animate, gltf.animations, mixer]);
  useFrame((_, delta) => {
    if (animate) mixer.update(Math.min(delta, 0.05));
  });
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

function AvatarRenderReady({
  selectionKey,
  onReady,
}: {
  readonly selectionKey: string;
  readonly onReady: (selectionKey: string) => void;
}) {
  const announcedSelection = useRef<string | null>(null);
  useFrame(() => {
    if (announcedSelection.current === selectionKey) return;
    announcedSelection.current = selectionKey;
    onReady(selectionKey);
  });
  return null;
}

export function AvatarKitWorldModel({
  asset,
  role,
  selection,
  action,
  animate,
  position,
  rotation = [0, 0, 0],
  scale = 1,
  onReady,
}: {
  readonly asset: "/assets/avatar/aiw-avatar-kit.glb";
  readonly role: "user" | "agent";
  readonly selection: AvatarSelection;
  readonly action: string;
  readonly animate: boolean;
  readonly position: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number;
  readonly onReady: (role: "user" | "agent") => void;
}) {
  const gltf = useLoader(GLTFLoader, asset);
  const selectionKey = avatarSelectionKey(selection);
  const groundOffset = avatarGroundOffset(selection) * scale;
  return (
    <group name={`${role}-modular-avatar`}>
      <AvatarModel
        gltf={gltf}
        selection={selection}
        action={action}
        animate={animate}
        position={[position[0], position[1] + groundOffset, position[2]]}
        rotation={rotation}
        scale={scale}
      />
      <AvatarRenderReady
        selectionKey={`${role}:${selectionKey}`}
        onReady={() => onReady(role)}
      />
    </group>
  );
}

export function AvatarKitRosterCanvas({
  asset,
  avatars,
}: {
  readonly asset: "/assets/avatar/aiw-avatar-kit.glb";
  readonly avatars: readonly {
    readonly selection: AvatarSelection;
    readonly action: string;
    readonly animate: boolean;
  }[];
}) {
  const gltf = useLoader(GLTFLoader, asset);
  return (
    <div
      className="avatar-kit-roster-canvas"
      data-avatar-count={Math.min(avatars.length, 12)}
    >
      <Canvas
        frameloop={
          avatars.some((avatar) => avatar.animate) ? "always" : "demand"
        }
        camera={{ position: [0, 5.3, 13], fov: 42 }}
        dpr={[1, 1.25]}
      >
        <ambientLight intensity={1.9} />
        <directionalLight position={[4, 8, 7]} intensity={2.5} />
        {avatars.slice(0, 12).map((avatar, index) => (
          <AvatarModel
            key={index}
            gltf={gltf}
            {...avatar}
            position={[
              ((index % 4) - 1.5) * 2.2,
              3.3 - Math.floor(index / 4) * 3.2,
              0,
            ]}
          />
        ))}
      </Canvas>
    </div>
  );
}

export function AvatarKitCanvas({
  asset,
  selection,
  action,
  animate,
}: {
  readonly asset: "/assets/avatar/aiw-avatar-kit.glb";
  readonly selection: AvatarSelection;
  readonly action: string;
  readonly animate: boolean;
}) {
  const gltf = useLoader(GLTFLoader, asset);
  const selectionKey = avatarSelectionKey(selection);
  const [readySelection, setReadySelection] = useState<string | null>(null);
  return (
    <div
      className="avatar-kit-canvas"
      data-avatar-action={action}
      data-avatar-asset={asset}
      data-avatar-species={selection.species}
      data-avatar-shirt={selection.shirt}
      data-avatar-render-ready={
        readySelection === selectionKey ? "true" : "false"
      }
    >
      <Canvas
        frameloop={animate ? "always" : "demand"}
        camera={{ position: [0, 0.2, 6.8], fov: 36 }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[3, 4, 5]} intensity={2.4} />
        <AvatarModel
          gltf={gltf}
          selection={selection}
          action={action}
          animate={animate}
        />
        <AvatarRenderReady
          selectionKey={selectionKey}
          onReady={setReadySelection}
        />
      </Canvas>
    </div>
  );
}
