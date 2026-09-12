import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AmbientLight,
  AnimationMixer,
  type AnimationAction,
  Box3,
  Color,
  DirectionalLight,
  type Group,
  type Object3D,
  PerspectiveCamera,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector3,
  type WebGLRenderer,
  WebGLRenderTarget,
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

export class ImportedAvatarGLTFLoader extends GLTFLoader {
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

export type ImportedAvatarWorldRepresentation =
  "live-model" | "runtime-impostor";

export function selectImportedAvatarWorldRepresentation(
  cosmeticQuality: "full" | "constrained",
): ImportedAvatarWorldRepresentation {
  return cosmeticQuality === "constrained" ? "runtime-impostor" : "live-model";
}

export function importedAvatarImpostorPoseTime(
  durationSeconds: number,
): number {
  return Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds * 0.5
    : 0;
}

export type ImportedAvatarImpostorSnapshot = {
  readonly sprite: Sprite;
  readonly target: WebGLRenderTarget;
  readonly material: SpriteMaterial;
};

export function createImportedAvatarImpostorSnapshot(
  avatarScene: Group,
  renderer: WebGLRenderer,
): ImportedAvatarImpostorSnapshot {
  avatarScene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(avatarScene);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const textureAspect = 0.5;
  const frameHeight = Math.max(size.y, size.x / textureAspect, 0.01) * 1.12;
  const frameWidth = frameHeight * textureAspect;
  const verticalFov = 30;
  const distance = frameHeight / (2 * Math.tan((verticalFov * Math.PI) / 360));
  const camera = new PerspectiveCamera(verticalFov, textureAspect, 0.01, 100);
  camera.position.set(center.x, center.y, center.z + distance);
  camera.lookAt(center);
  const previewScene = new Scene();
  const originalParent = avatarScene.parent;
  const ambient = new AmbientLight("#ffffff", 1.7);
  const key = new DirectionalLight("#ffffff", 2.4);
  key.position.set(center.x + 2, center.y + 3, center.z + 4);
  const target = new WebGLRenderTarget(384, 768);
  target.texture.generateMipmaps = false;
  const previousTarget = renderer.getRenderTarget();
  const previousColor = renderer.getClearColor(new Color());
  const previousAlpha = renderer.getClearAlpha();
  let material: SpriteMaterial | undefined;

  try {
    previewScene.add(avatarScene, ambient, key);
    previewScene.updateMatrixWorld(true);
    renderer.setRenderTarget(target);
    renderer.setClearColor("#000000", 0);
    renderer.clear();
    renderer.render(previewScene, camera);
    material = new SpriteMaterial({
      map: target.texture,
      transparent: true,
      depthTest: true,
    });
    const sprite = new Sprite(material);
    sprite.name = "IMPORTED_AVATAR_RUNTIME_IMPOSTOR";
    sprite.position.copy(center);
    sprite.scale.set(frameWidth, frameHeight, 1);
    sprite.userData = {
      avatarSource: "imported",
      avatarRepresentation: "runtime-impostor",
    };
    return { sprite, target, material };
  } catch (error) {
    material?.dispose();
    target.dispose();
    throw error;
  } finally {
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(previousColor, previousAlpha);
    if (avatarScene.parent !== originalParent) {
      avatarScene.parent?.remove(avatarScene);
      originalParent?.add(avatarScene);
    }
  }
}

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
    object.castShadow = true;
    object.receiveShadow = true;
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
  representation = "live-model",
  onRepresentationReady,
  onAnimationSample,
  onOneShotComplete,
  oneShotGeneration = 0,
}: {
  readonly gltf: GLTF;
  readonly selection:
    ImportedAvatarRenderSelection | ImportedAvatarWorldSelection;
  readonly animate: boolean;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
  readonly semanticAction?: string | undefined;
  readonly representation?: ImportedAvatarWorldRepresentation | undefined;
  readonly onRepresentationReady?: (() => void) | undefined;
  readonly onAnimationSample?:
    ((sample: ImportedAvatarAnimationSample) => void) | undefined;
  readonly onOneShotComplete?:
    ((semantic: string, generation: number) => void) | undefined;
  readonly oneShotGeneration?: number | undefined;
}) {
  const selectionKey = [
    selection.assetId,
    ...(selection.hiddenPartIds ?? []),
  ].join(":");
  const renderer = useThree((state) => state.gl) as unknown as WebGLRenderer;
  const invalidate = useThree((state) => state.invalidate);
  const [impostor, setImpostor] =
    useState<ImportedAvatarImpostorSnapshot | null>(null);
  const onRepresentationReadyRef = useRef(onRepresentationReady);
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
  useEffect(() => {
    onOneShotCompleteRef.current = onOneShotComplete;
  }, [onOneShotComplete]);
  useEffect(() => {
    onRepresentationReadyRef.current = onRepresentationReady;
  }, [onRepresentationReady]);
  useLayoutEffect(() => {
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
    if (!resolvedOneShot || !animate || representation !== "live-model") return;
    const completedGeneration = oneShotGeneration;
    const finished = (event: { readonly action: AnimationAction }) => {
      if (event.action === next)
        onOneShotCompleteRef.current?.(resolvedSemantic, completedGeneration);
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
  }, [
    animate,
    clip,
    invalidate,
    mixer,
    oneShotGeneration,
    representation,
    resolvedOneShot,
    resolvedSemantic,
  ]);
  useEffect(() => {
    if (representation === "live-model") {
      setImpostor(null);
      onRepresentationReadyRef.current?.();
      return;
    }
    const previousMixerTime = mixer.time;
    if (activeAction.current && clip)
      mixer.setTime(importedAvatarImpostorPoseTime(clip.duration));
    let snapshot: ImportedAvatarImpostorSnapshot;
    try {
      snapshot = createImportedAvatarImpostorSnapshot(scene, renderer);
    } finally {
      mixer.setTime(previousMixerTime);
    }
    setImpostor(snapshot);
    onRepresentationReadyRef.current?.();
    invalidate();
    return () => {
      snapshot.material.dispose();
      snapshot.target.dispose();
    };
  }, [
    clip,
    clipIndex,
    invalidate,
    mixer,
    renderer,
    representation,
    scene,
    semanticAction,
  ]);
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
      {representation === "live-model" ? <primitive object={scene} /> : null}
      {representation === "runtime-impostor" && impostor ? (
        <primitive object={impostor.sprite} />
      ) : null}
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
  const warmedSelection = useRef<string | null>(null);
  const invalidate = useThree((state) => state.invalidate);
  useFrame(() => {
    if (announcedSelection.current === selectionKey) return;
    if (warmedSelection.current !== selectionKey) {
      warmedSelection.current = selectionKey;
      invalidate();
      return;
    }
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
  representation = "live-model",
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
  readonly representation?: ImportedAvatarWorldRepresentation | undefined;
}) {
  const gltf = useLoader(ImportedAvatarGLTFLoader, selection.assetUrl);
  const resolvedRotation: readonly [number, number, number] = [
    selection.rotation[0] + rotation[0],
    selection.rotation[1] + rotation[1],
    selection.rotation[2] + rotation[2],
  ];
  const selectionKey = `${role}:${selection.assetId}`;
  const representationReady = useCallback(() => onReady(role), [onReady, role]);
  useEffect(() => onLodChange?.(role, "LOD0"), [onLodChange, role]);
  return (
    <group name={`${role}-imported-avatar`}>
      <ImportedAvatarModel
        gltf={gltf}
        selection={selection}
        semanticAction={action}
        animate={animate}
        representation={representation}
        onRepresentationReady={representationReady}
        position={[
          position[0],
          position[1] + selection.groundOffset * scale,
          position[2],
        ]}
        rotation={resolvedRotation}
        scale={selection.scale * scale}
        onAnimationSample={(sample) => onAnimationSample?.(role, sample)}
        oneShotGeneration={animationGeneration}
        onOneShotComplete={(semantic, completedGeneration) =>
          onOneShotComplete?.(role, semantic, completedGeneration)
        }
      />
      {representation === "live-model" ? (
        <ImportedAvatarRenderReady
          selectionKey={selectionKey}
          onReady={() => onReady(role)}
        />
      ) : null}
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
  const gltf = useLoader(ImportedAvatarGLTFLoader, selection.assetUrl);
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
        style={{
          visibility: readySelection === selectionKey ? "visible" : "hidden",
        }}
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
