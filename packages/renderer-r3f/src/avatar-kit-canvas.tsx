import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type AnimationClip,
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

export const avatarSelectionKey = (selection: AvatarSelection) =>
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

const avatarSelectionFromKey = (key: string): AvatarSelection => {
  const [species, head, hands, feet, fur, tail, markings, bodyColor, shirt] =
    key.split(":");
  return {
    species: species ?? "",
    head: head ?? "",
    hands: hands ?? "",
    feet: feet ?? "",
    fur: fur ?? "",
    tail: tail ?? "",
    markings: markings ?? "",
    bodyColor: bodyColor ?? "",
    shirt: shirt ?? "",
  };
};

const modularPrefixes = [
  "HEAD_",
  "HAND_",
  "FOOT_",
  "FUR_",
  "TAIL_",
  "MARKING_",
  "SHIRT_",
  "LOD2_",
  "COLOR_SWATCH_",
];

export type AvatarLod = "LOD0" | "LOD1" | "LOD2";
export type AvatarLodContext = "builder" | "roster" | "world";
export type AvatarLayerState = {
  readonly base: string;
  readonly upperBody: string | null;
  readonly face: string | null;
  readonly gaze: "operator" | "camera" | "work" | "neutral";
  readonly secondary: "Neutral" | "Listen" | "Talk" | "Celebrate" | "Error";
  readonly crossfadeSeconds: number;
  readonly secondaryMotion: boolean;
};

export function avatarLodForDistance(
  _distance: number,
  _context: AvatarLodContext = "world",
): AvatarLod {
  void _distance;
  void _context;
  // Runtime LOD is intentionally disabled until lower-detail assemblies retain
  // the authored avatar identity and cosmetic layers at normal camera ranges.
  return "LOD0";
}

export function avatarSecondaryVisibility(lod: AvatarLod) {
  return {
    fur: lod === "LOD0",
    markings: lod === "LOD0",
    shirtLabel: lod === "LOD0",
    circuitSeam: lod !== "LOD2",
    armCircuitSeams: lod === "LOD0",
    articulationPanels: lod !== "LOD2",
  } as const;
}

const keepAuthoredMaterial = (name: string) =>
  name === "MAT_CLAW" ||
  name.startsWith("MAT_GRAPHITE") ||
  name.startsWith("MAT_MIDNIGHT") ||
  name.startsWith("MAT_FACE_") ||
  name.startsWith("MAT_SHIRT_") ||
  name.startsWith("MAT_CIRCUIT_") ||
  name.startsWith("MAT_LABEL_");

export function configureAvatarScene(
  source: Group,
  selection: AvatarSelection,
  lod: AvatarLod,
): Group {
  const scene = SkeletonUtils.clone(source);
  const secondary = avatarSecondaryVisibility(lod);
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
    `LOD2_BODY_${selection.species}`,
    `LOD2_SHIRT_${selection.shirt}`,
  ]);
  scene.traverse((object: Object3D) => {
    if (modularPrefixes.some((prefix) => object.name.startsWith(prefix)))
      object.visible = visible.has(object.name);
    if (object.name.startsWith("LOD2_"))
      object.visible = lod === "LOD2" && visible.has(object.name);
    if (
      object.name === "FUR_none" ||
      object.name === "TAIL_none" ||
      object.name === "MARKING_solid" ||
      object.name.startsWith("COLOR_SWATCH_")
    )
      object.visible = false;
    if (object.name.startsWith("FUR_") && !secondary.fur)
      object.visible = false;
    if (object.name.startsWith("MARKING_") && !secondary.markings)
      object.visible = false;
    if (object.name.startsWith("SHIRT_LABEL_") && !secondary.shirtLabel)
      object.visible = false;
    if (object.name === "CIRCUIT_SEAM_CHEST" && !secondary.circuitSeam)
      object.visible = false;
    if (
      object.name.startsWith("CIRCUIT_SEAM_ARM_") &&
      !secondary.armCircuitSeams
    )
      object.visible = false;
    if (
      (object.name.startsWith("PANEL_SHOULDER_") ||
        object.name.startsWith("PANEL_KNEE_")) &&
      !secondary.articulationPanels
    )
      object.visible = false;
    if (
      lod === "LOD2" &&
      (object.name.startsWith("CORE_") ||
        object.name.startsWith("PANEL_") ||
        object.name.startsWith("JOINT_") ||
        object.name.startsWith("CIRCUIT_") ||
        object.name.startsWith("HEAD_") ||
        object.name.startsWith("HAND_") ||
        object.name.startsWith("FOOT_") ||
        object.name.startsWith("FUR_") ||
        object.name.startsWith("TAIL_") ||
        object.name.startsWith("MARKING_") ||
        object.name.startsWith("SHIRT_"))
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
          object.name.startsWith("LOD2_BODY_") ||
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
              keepAuthoredMaterial(candidate.name)
                ? candidate
                : material.clone(),
            )
          : keepAuthoredMaterial(current.name)
            ? current
            : material.clone();
      }
    });
  const prunedMeshes: Object3D[] = [];
  scene.traverse((object: Object3D) => {
    if (object !== scene && !object.visible && "material" in object)
      prunedMeshes.push(object);
  });
  for (const object of prunedMeshes) object.parent?.remove(object);
  scene.userData.prunedMeshCount = prunedMeshes.length;
  return scene;
}

const upperBodyTrack =
  /(?:spine|chest|clavicle|arm|hand|finger|neck|head|jaw|eye|brow|ear|tail)/u;

function maskedUpperBodyClip(clip: AnimationClip): AnimationClip {
  const masked = clip.clone();
  masked.name = `${clip.name}__upper-body`;
  masked.tracks = masked.tracks.filter((track) =>
    upperBodyTrack.test(track.name),
  );
  return masked;
}

function maskedLowerBodyClip(clip: AnimationClip): AnimationClip {
  const masked = clip.clone();
  masked.name = `${clip.name}__lower-body`;
  masked.tracks = masked.tracks.filter(
    (track) => !upperBodyTrack.test(track.name),
  );
  return masked;
}

export function prepareAvatarLayerApplication(layer: AvatarLayerState) {
  const gaze = {
    operator: { yaw: -0.08, pitch: 0.02 },
    camera: { yaw: 0, pitch: 0.02 },
    work: { yaw: 0.1, pitch: -0.12 },
    neutral: { yaw: 0, pitch: 0 },
  }[layer.gaze] ?? { yaw: 0, pitch: 0 };
  const anatomical = {
    Neutral: { earPitch: 0, tailYaw: 0 },
    Listen: { earPitch: -0.2, tailYaw: 0.06 },
    Talk: { earPitch: -0.08, tailYaw: 0.1 },
    Celebrate: { earPitch: -0.3, tailYaw: 0.32 },
    Error: { earPitch: 0.34, tailYaw: -0.2 },
  }[layer.secondary] ?? { earPitch: 0, tailYaw: 0 };
  return { ...gaze, ...anatomical, face: layer.face } as const;
}

export function resolveAvatarLayerRotation(
  neutralRotation: number,
  currentRotation: number,
  layerOffset: number,
  drivenByClip: boolean,
): number {
  return (drivenByClip ? currentRotation : neutralRotation) + layerOffset;
}

type RuntimeMorphMesh = Mesh & {
  morphTargetDictionary?: Record<string, number>;
  morphTargetInfluences?: number[];
};

export type AvatarRuntimeTargets = {
  readonly named: Readonly<Record<string, Object3D | undefined>>;
  readonly neutral: Readonly<
    Record<string, { readonly x: number; readonly y: number } | undefined>
  >;
  readonly morphMeshes: readonly RuntimeMorphMesh[];
};

const RUNTIME_LAYER_TARGET_NAMES = [
  "head",
  "eye.L",
  "eye.R",
  "ear.L.01",
  "ear.R.01",
  "tail.01",
  "tail.02",
  "tail.03",
] as const;

export function collectAvatarRuntimeTargets(
  scene: Group,
): AvatarRuntimeTargets {
  const named: Record<string, Object3D | undefined> = {};
  const neutral: Record<
    string,
    { readonly x: number; readonly y: number } | undefined
  > = {};
  for (const name of RUNTIME_LAYER_TARGET_NAMES) {
    const target = scene.getObjectByName(name);
    named[name] = target;
    neutral[name] = target
      ? { x: target.rotation.x, y: target.rotation.y }
      : undefined;
  }
  const morphMeshes: RuntimeMorphMesh[] = [];
  scene.traverse((object: Object3D) => {
    const mesh = object as RuntimeMorphMesh;
    if (mesh.morphTargetDictionary && mesh.morphTargetInfluences)
      morphMeshes.push(mesh);
  });
  return { named, neutral, morphMeshes };
}

export function applyAvatarRuntimePose(
  targets: AvatarRuntimeTargets,
  pose: ReturnType<typeof prepareAvatarLayerApplication>,
  clipTargets: ReadonlySet<string>,
  secondaryWave: number,
): void {
  for (const name of ["head", "eye.L", "eye.R"]) {
    const target = targets.named[name];
    const neutral = targets.neutral[name];
    if (!target || !neutral) continue;
    const drivenByClip = clipTargets.has(name);
    target.rotation.y = resolveAvatarLayerRotation(
      neutral.y,
      target.rotation.y,
      pose.yaw,
      drivenByClip,
    );
    target.rotation.x = resolveAvatarLayerRotation(
      neutral.x,
      target.rotation.x,
      pose.pitch,
      drivenByClip,
    );
  }
  for (const name of ["ear.L.01", "ear.R.01"]) {
    const target = targets.named[name];
    const neutral = targets.neutral[name];
    if (!target || !neutral) continue;
    target.rotation.x = resolveAvatarLayerRotation(
      neutral.x,
      target.rotation.x,
      pose.earPitch,
      clipTargets.has(name),
    );
  }
  for (const name of ["tail.01", "tail.02", "tail.03"]) {
    const target = targets.named[name];
    const neutral = targets.neutral[name];
    if (!target || !neutral) continue;
    target.rotation.y = resolveAvatarLayerRotation(
      neutral.y,
      target.rotation.y,
      pose.tailYaw + secondaryWave,
      clipTargets.has(name),
    );
  }
}

export function resolveAvatarMixerPlan(
  layer: AvatarLayerState,
  lod: AvatarLod,
): { readonly base: string; readonly upperBody: string | null } {
  if (lod === "LOD2" && layer.upperBody)
    return { base: layer.upperBody, upperBody: null };
  return { base: layer.base, upperBody: layer.upperBody };
}

const legacyLayerState = (
  action: string,
  animate: boolean,
): AvatarLayerState => ({
  base: action,
  upperBody: null,
  face:
    (
      {
        Talk: "SpeechO",
        Listen: "BrowUp",
        Think: "BrowUp",
        Celebrate: "Smile",
        Error: "Frown",
        Offline: "EyeSquint",
      } as const
    )[action as "Talk"] ?? null,
  gaze: "neutral",
  secondary:
    action === "Celebrate"
      ? "Celebrate"
      : action === "Error" || action === "Offline"
        ? "Error"
        : action === "Talk"
          ? "Talk"
          : action === "Listen"
            ? "Listen"
            : "Neutral",
  crossfadeSeconds: 0.22,
  secondaryMotion: animate,
});

function AvatarModel({
  gltf,
  selection,
  action,
  layerState,
  animate,
  position = [0, -0.45, 0],
  rotation = [0, 0, 0],
  scale = 1,
  lodContext = "builder",
  onLodChange,
}: {
  readonly gltf: GLTF;
  readonly selection: AvatarSelection;
  readonly action: string;
  readonly layerState?: AvatarLayerState | undefined;
  readonly animate: boolean;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number;
  readonly lodContext?: AvatarLodContext;
  readonly onLodChange?: ((lod: AvatarLod) => void) | undefined;
}) {
  const lod = avatarLodForDistance(Number.POSITIVE_INFINITY, lodContext);
  const resolvedLayer = useMemo(
    () => layerState ?? legacyLayerState(action, animate),
    [action, animate, layerState],
  );
  const selectionKey = avatarSelectionKey(selection);
  const invalidate = useThree((state) => state.invalidate);
  const scene = useMemo(
    () =>
      configureAvatarScene(
        gltf.scene,
        avatarSelectionFromKey(selectionKey),
        lod,
      ),
    [gltf.scene, lod, selectionKey],
  );
  const runtimeTargets = useMemo(
    () => collectAvatarRuntimeTargets(scene),
    [scene],
  );
  const mixerPlan = useMemo(
    () => resolveAvatarMixerPlan(resolvedLayer, lod),
    [lod, resolvedLayer],
  );
  const layerClipTargets = useMemo(() => {
    const targets = new Set<string>();
    for (const clip of gltf.animations) {
      if (clip.name !== mixerPlan.base && clip.name !== mixerPlan.upperBody)
        continue;
      for (const track of clip.tracks) {
        if (
          clip.name === mixerPlan.base &&
          mixerPlan.upperBody &&
          upperBodyTrack.test(track.name)
        )
          continue;
        if (
          clip.name === mixerPlan.upperBody &&
          !upperBodyTrack.test(track.name)
        )
          continue;
        targets.add(
          track.name.replace(
            /\.(?:position|quaternion|rotation|scale|morphTargetInfluences)(?:\[.*\])?$/u,
            "",
          ),
        );
      }
    }
    return targets;
  }, [gltf.animations, mixerPlan.base, mixerPlan.upperBody]);
  const mixer = useMemo(() => new AnimationMixer(scene), [scene]);
  const currentBase = useRef<AnimationAction | null>(null);
  const currentUpper = useRef<AnimationAction | null>(null);
  const currentMixer = useRef<AnimationMixer | null>(null);
  const staticLayerApplied = useRef(false);
  useEffect(() => {
    staticLayerApplied.current = false;
    if (currentMixer.current !== mixer) {
      currentMixer.current = mixer;
      currentBase.current = null;
      currentUpper.current = null;
    }
    const start = (
      clip: AnimationClip | undefined,
      current: { current: AnimationAction | null },
    ) => {
      current.current?.fadeOut(resolvedLayer.crossfadeSeconds);
      if (!clip) {
        current.current = null;
        return null;
      }
      const next = mixer.clipAction(clip);
      next.reset();
      next.setEffectiveWeight(1);
      next.fadeIn(resolvedLayer.crossfadeSeconds);
      next.play();
      if (!animate) {
        next.paused = true;
        next.time = clip.duration * 0.5;
      }
      current.current = next;
      return next;
    };
    const sourceBaseClip = gltf.animations.find(
      (candidate) => candidate.name === mixerPlan.base,
    );
    const upperClip = mixerPlan.upperBody
      ? gltf.animations.find(
          (candidate) => candidate.name === mixerPlan.upperBody,
        )
      : undefined;
    const baseClip =
      sourceBaseClip && upperClip
        ? maskedLowerBodyClip(sourceBaseClip)
        : sourceBaseClip;
    start(baseClip, currentBase);
    start(upperClip ? maskedUpperBodyClip(upperClip) : undefined, currentUpper);
    mixer.update(0);
    for (const mesh of runtimeTargets.morphMeshes) {
      const dictionary = mesh.morphTargetDictionary;
      const influences = mesh.morphTargetInfluences;
      if (!dictionary || !influences) continue;
      for (const [name, index] of Object.entries(dictionary))
        influences[index] = name === resolvedLayer.face ? 1 : 0;
    }
    invalidate();
  }, [
    animate,
    gltf.animations,
    invalidate,
    mixer,
    mixerPlan,
    resolvedLayer,
    runtimeTargets,
  ]);
  useEffect(
    () => () => {
      mixer.stopAllAction();
      if (currentMixer.current === mixer) {
        currentMixer.current = null;
        currentBase.current = null;
        currentUpper.current = null;
      }
    },
    [mixer],
  );
  useEffect(() => onLodChange?.(lod), [lod, onLodChange]);
  useFrame(({ clock }, delta) => {
    if (animate) mixer.update(Math.min(delta, 0.05));
    const pose = prepareAvatarLayerApplication(resolvedLayer);
    const applyStaticLayer = animate || !staticLayerApplied.current;
    const secondaryWave =
      resolvedLayer.secondaryMotion && animate
        ? Math.sin(clock.elapsedTime * 2.4) * 0.08
        : 0;
    if (applyStaticLayer)
      applyAvatarRuntimePose(
        runtimeTargets,
        pose,
        layerClipTargets,
        secondaryWave,
      );
    if (!animate) staticLayerApplied.current = true;
  });
  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
      userData={{
        semanticAction: action,
        baseAction: resolvedLayer.base,
        upperBodyAction: resolvedLayer.upperBody ?? "none",
        face: resolvedLayer.face ?? "neutral",
        gaze: resolvedLayer.gaze,
        secondary: resolvedLayer.secondary,
        lod,
      }}
    >
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
  layerState,
  animate,
  position,
  rotation = [0, 0, 0],
  scale = 1,
  onReady,
  onLodChange,
}: {
  readonly asset: "/assets/avatar/aiw-avatar-kit.glb";
  readonly role: "user" | "agent";
  readonly selection: AvatarSelection;
  readonly action: string;
  readonly layerState?: AvatarLayerState | undefined;
  readonly animate: boolean;
  readonly position: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number;
  readonly onReady: (role: "user" | "agent") => void;
  readonly onLodChange?:
    ((role: "user" | "agent", lod: AvatarLod) => void) | undefined;
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
        layerState={layerState}
        animate={animate}
        position={[position[0], position[1] + groundOffset, position[2]]}
        rotation={rotation}
        scale={scale}
        lodContext="world"
        onLodChange={(lod) => onLodChange?.(role, lod)}
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
            lodContext="roster"
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
          lodContext="builder"
        />
        <AvatarRenderReady
          selectionKey={selectionKey}
          onReady={setReadySelection}
        />
      </Canvas>
    </div>
  );
}
