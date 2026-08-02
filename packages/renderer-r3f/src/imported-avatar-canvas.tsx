import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimationMixer,
  type AnimationAction,
  type Group,
  type Object3D,
} from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

import {
  advanceImportedAvatarMixer,
  configureImportedAvatarAction,
  crossfadeImportedAvatarAction,
  IMPORTED_AVATAR_CROSSFADE_SECONDS,
  makeImportedAvatarClipInPlace,
  type ImportedAvatarLoopAction,
} from "./imported-avatar-animation.js";

export {
  advanceImportedAvatarMixer,
  configureImportedAvatarAction,
  crossfadeImportedAvatarAction,
  IMPORTED_AVATAR_CROSSFADE_SECONDS,
  makeImportedAvatarClipInPlace,
} from "./imported-avatar-animation.js";

export type ImportedAvatarPart = {
  readonly partId: string;
  readonly nodeName: string;
};

export type ImportedAvatarResolvedClip = {
  readonly clipIndex: number;
  readonly clipName: string;
  readonly locomotion: "Idle" | "Walk" | "Run";
  readonly semantic: string;
  readonly oneShot: boolean;
  readonly durationSeconds: number;
  readonly verification: "semantic-review-pass" | "evidence-refused";
  readonly error: string;
};

export type ImportedAvatarAnimationSample = {
  readonly sourceAssetId: string;
  readonly mixerRootUuid: string;
  readonly clipIndex: number;
  readonly clipName: string;
  readonly mixerTime: number;
  readonly actionTime: number;
  readonly sequence: number;
  readonly boneName: string;
  readonly boneQuaternion: readonly [number, number, number, number];
  readonly semantic: string;
  readonly oneShot: boolean;
  readonly progression: "playing";
};

export type ImportedAvatarRenderSelection = {
  readonly assetId: string;
  readonly assetUrl: string;
  readonly clipIndex: number;
  readonly clipName: string;
  readonly parts?: readonly ImportedAvatarPart[];
  readonly hiddenPartIds?: readonly string[];
};

export type ImportedAvatarWorldSelection = Omit<
  ImportedAvatarRenderSelection,
  "clipIndex" | "clipName"
> & {
  readonly resolvedClip: ImportedAvatarResolvedClip;
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
  readonly groundOffset: number;
};

export function configureImportedAvatarScene(
  source: Group,
  parts: readonly ImportedAvatarPart[] = [],
  hiddenPartIds: readonly string[] = [],
): Group {
  const scene = SkeletonUtils.clone(source);
  const hidden = new Set(hiddenPartIds);
  const visibility = new Map(
    parts.map((part) => [part.nodeName, !hidden.has(part.partId)]),
  );
  scene.traverse((object: Object3D) => {
    const visible = visibility.get(object.name);
    if (visible !== undefined) object.visible = visible;
  });
  scene.userData.importedPartCount = parts.length;
  scene.userData.hiddenImportedPartCount = parts.filter((part) =>
    hidden.has(part.partId),
  ).length;
  return scene;
}

function ImportedAvatarModel({
  gltf,
  selection,
  animate,
  position,
  rotation,
  scale,
  semanticAction,
  onAnimationSample,
  onOneShotComplete,
}: {
  readonly gltf: GLTF;
  readonly selection:
    ImportedAvatarRenderSelection | ImportedAvatarWorldSelection;
  readonly animate: boolean;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
  readonly semanticAction?: string | undefined;
  readonly onAnimationSample?:
    ((sample: ImportedAvatarAnimationSample) => void) | undefined;
  readonly onOneShotComplete?: ((semantic: string) => void) | undefined;
}) {
  const selectionKey = [
    selection.assetId,
    ...(selection.hiddenPartIds ?? []),
  ].join(":");
  const scene = useMemo(
    () =>
      configureImportedAvatarScene(
        gltf.scene,
        selection.parts,
        selection.hiddenPartIds,
      ),
    [gltf.scene, selection.hiddenPartIds, selection.parts, selectionKey],
  );
  const mixer = useMemo(() => new AnimationMixer(scene), [scene]);
  const resolvedWorldClip =
    semanticAction && "resolvedClip" in selection
      ? selection.resolvedClip
      : undefined;
  const resolvedOneShot = resolvedWorldClip?.oneShot ?? false;
  const resolvedSemantic = resolvedWorldClip?.semantic ?? "preview";
  const clipIndex =
    resolvedWorldClip?.clipIndex ??
    ("clipIndex" in selection ? selection.clipIndex : -1);
  const sourceClip = gltf.animations[clipIndex];
  const worldClips = useMemo(
    () => new Map<number, NonNullable<typeof sourceClip>>(),
    [gltf.animations],
  );
  let clip = sourceClip;
  if (sourceClip && resolvedWorldClip) {
    const cached = worldClips.get(clipIndex);
    clip =
      cached ??
      makeImportedAvatarClipInPlace(
        sourceClip,
        0.25,
        !resolvedWorldClip.oneShot,
      );
    if (!cached) worldClips.set(clipIndex, clip);
  }
  const activeAction = useRef<AnimationAction | null>(null);
  const onOneShotCompleteRef = useRef(onOneShotComplete);
  const lastSampleTime = useRef(Number.NEGATIVE_INFINITY);
  const sampleSequence = useRef(0);
  const sampledBone = useMemo(
    () =>
      [
        "L_Thigh",
        "R_Thigh",
        "L_Upperarm",
        "R_Upperarm",
        "Spine02",
        "Spine01",
        "Head",
        "Hip",
      ]
        .map((name) => scene.getObjectByName(name))
        .find((candidate) => candidate !== undefined),
    [scene],
  );
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    onOneShotCompleteRef.current = onOneShotComplete;
  }, [onOneShotComplete]);
  useEffect(() => {
    const previous = activeAction.current;
    if (!clip) {
      previous?.fadeOut(IMPORTED_AVATAR_CROSSFADE_SECONDS);
      activeAction.current = null;
      invalidate();
      return;
    }
    const next = mixer.clipAction(clip);
    configureImportedAvatarAction(
      next as unknown as ImportedAvatarLoopAction,
      resolvedOneShot,
    );
    if (animate) {
      next.paused = false;
      crossfadeImportedAvatarAction(previous, next);
    } else {
      if (previous && previous !== next) previous.stop();
      next.reset().setEffectiveWeight(1).play();
      next.paused = true;
      next.time = clip.duration * 0.5;
    }
    activeAction.current = next;
    mixer.update(0);
    invalidate();
    if (!resolvedOneShot) return;
    const finished = (event: { readonly action: AnimationAction }) => {
      if (event.action === next)
        onOneShotCompleteRef.current?.(resolvedSemantic);
    };
    const eventMixer = mixer as unknown as {
      addEventListener(
        type: "finished",
        listener: (event: { readonly action: AnimationAction }) => void,
      ): void;
      removeEventListener(
        type: "finished",
        listener: (event: { readonly action: AnimationAction }) => void,
      ): void;
    };
    eventMixer.addEventListener("finished", finished);
    return () => eventMixer.removeEventListener("finished", finished);
  }, [animate, clip, invalidate, mixer, resolvedOneShot, resolvedSemantic]);
  useEffect(
    () => () => {
      activeAction.current?.stop();
      activeAction.current = null;
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
    },
    [mixer, scene],
  );
  useFrame((_, delta) => {
    if (!animate) return;
    advanceImportedAvatarMixer(mixer, delta);
    const action = activeAction.current;
    if (
      !onAnimationSample ||
      !resolvedWorldClip ||
      !clip ||
      !action ||
      !sampledBone ||
      mixer.time - lastSampleTime.current < 0.12
    )
      return;
    lastSampleTime.current = mixer.time;
    sampleSequence.current += 1;
    onAnimationSample({
      sourceAssetId: selection.assetId,
      mixerRootUuid: scene.uuid,
      clipIndex,
      clipName: clip.name,
      mixerTime: mixer.time,
      actionTime: action.time,
      sequence: sampleSequence.current,
      boneName: sampledBone.name,
      boneQuaternion: [
        sampledBone.quaternion.x,
        sampledBone.quaternion.y,
        sampledBone.quaternion.z,
        sampledBone.quaternion.w,
      ],
      semantic: resolvedWorldClip.semantic,
      oneShot: resolvedWorldClip.oneShot,
      progression: "playing",
    });
  });
  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
      userData={{
        importedAssetId: selection.assetId,
        importedClipIndex: clipIndex,
        importedClipName: clip?.name ?? "missing",
        semanticAction: semanticAction ?? `preview-clip-${clipIndex}`,
        semanticLocomotion: resolvedWorldClip?.locomotion ?? "preview",
      }}
    >
      <primitive object={scene} />
    </group>
  );
}

function ImportedAvatarRenderReady({
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

export function ImportedAvatarWorldModel({
  role,
  selection,
  action,
  animate,
  position,
  rotation,
  scale,
  onReady,
  onLodChange,
  onAnimationSample,
  onOneShotComplete,
  animationGeneration,
}: {
  readonly role: "user" | "agent";
  readonly selection: ImportedAvatarWorldSelection;
  readonly action: string;
  readonly animate: boolean;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
  readonly onReady: (role: "user" | "agent") => void;
  readonly onLodChange?:
    | ((role: "user" | "agent", lod: "LOD0" | "LOD1" | "LOD2") => void)
    | undefined;
  readonly onAnimationSample?:
    | ((role: "user" | "agent", sample: ImportedAvatarAnimationSample) => void)
    | undefined;
  readonly onOneShotComplete?:
    | ((role: "user" | "agent", semantic: string, generation: number) => void)
    | undefined;
  readonly animationGeneration: number;
}) {
  const gltf = useLoader(GLTFLoader, selection.assetUrl);
  const resolvedRotation: readonly [number, number, number] = [
    selection.rotation[0] + rotation[0],
    selection.rotation[1] + rotation[1],
    selection.rotation[2] + rotation[2],
  ];
  const selectionKey = `${role}:${selection.assetId}`;
  useEffect(() => onLodChange?.(role, "LOD0"), [onLodChange, role]);
  return (
    <group name={`${role}-imported-avatar`}>
      <ImportedAvatarModel
        gltf={gltf}
        selection={selection}
        semanticAction={action}
        animate={animate}
        position={[
          position[0],
          position[1] + selection.groundOffset * scale,
          position[2],
        ]}
        rotation={resolvedRotation}
        scale={selection.scale * scale}
        onAnimationSample={(sample) => onAnimationSample?.(role, sample)}
        onOneShotComplete={(semantic) =>
          onOneShotComplete?.(role, semantic, animationGeneration)
        }
      />
      <ImportedAvatarRenderReady
        selectionKey={selectionKey}
        onReady={() => onReady(role)}
      />
    </group>
  );
}

export function ImportedAvatarCanvas({
  selection,
  animate,
  position,
  rotation,
  scale,
}: {
  readonly selection: ImportedAvatarRenderSelection;
  readonly animate: boolean;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
}) {
  const gltf = useLoader(GLTFLoader, selection.assetUrl);
  const selectionKey = [
    selection.assetId,
    selection.clipIndex,
    ...(selection.hiddenPartIds ?? []),
  ].join(":");
  const [readySelection, setReadySelection] = useState<string | null>(null);
  return (
    <div
      className="avatar-kit-canvas imported-avatar-canvas"
      data-avatar-action={`clip-${selection.clipIndex}`}
      data-avatar-asset={selection.assetUrl}
      data-avatar-imported-id={selection.assetId}
      data-avatar-clip-index={selection.clipIndex}
      data-avatar-clip-name={selection.clipName}
      data-avatar-render-ready={
        readySelection === selectionKey ? "true" : "false"
      }
    >
      <span
        className="avatar-preview__render-status"
        role="status"
        aria-live="polite"
      >
        {readySelection === selectionKey
          ? "3D preview ready"
          : "Rendering 3D preview…"}
      </span>
      <Canvas
        frameloop={animate ? "always" : "demand"}
        camera={{ position: [0, 0.2, 6.8], fov: 36 }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[3, 4, 5]} intensity={2.4} />
        <ImportedAvatarModel
          gltf={gltf}
          selection={selection}
          animate={animate}
          position={position}
          rotation={rotation}
          scale={scale}
        />
        <ImportedAvatarRenderReady
          selectionKey={selectionKey}
          onReady={setReadySelection}
        />
      </Canvas>
    </div>
  );
}
