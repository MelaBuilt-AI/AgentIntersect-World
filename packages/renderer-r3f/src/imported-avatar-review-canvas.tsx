import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimationMixer, type AnimationAction, type Group } from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

import { advanceImportedAvatarMixer } from "./imported-avatar-animation.js";

export type ImportedAvatarReviewPlaybackCommand =
  | { readonly sequence: number; readonly kind: "play" | "replay" | "pause" }
  | {
      readonly sequence: number;
      readonly kind: "scrub";
      readonly sample: number;
    };
export type ImportedAvatarReviewPlaybackState = {
  readonly status: "paused" | "playing" | "ended";
  readonly currentTimeSeconds: number;
};
type ReviewAnimationAction = AnimationAction & {
  clampWhenFinished: boolean;
  setLoop(mode: number, repetitions: number): AnimationAction;
};
const LOOP_ONCE = 2200;
export type ImportedAvatarReviewSelection = {
  readonly assetId: string;
  readonly assetUrl: string;
  readonly clip: {
    readonly index: number;
    readonly name: string;
    readonly durationSeconds: number;
  };
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
};

export const initialImportedAvatarReviewPlayback =
  (): ImportedAvatarReviewPlaybackState => ({
    status: "paused",
    currentTimeSeconds: 0,
  });

export function reduceImportedAvatarReviewPlayback(
  state: ImportedAvatarReviewPlaybackState,
  command: ImportedAvatarReviewPlaybackCommand,
  durationSeconds: number,
): ImportedAvatarReviewPlaybackState {
  const duration = Number.isFinite(durationSeconds)
    ? Math.max(0, durationSeconds)
    : 0;
  if (command.kind === "replay")
    return { status: "playing", currentTimeSeconds: 0 };
  if (command.kind === "play")
    return {
      status: "playing",
      currentTimeSeconds:
        state.currentTimeSeconds >= duration ? 0 : state.currentTimeSeconds,
    };
  if (command.kind === "pause")
    return {
      status: "paused",
      currentTimeSeconds: Math.min(state.currentTimeSeconds, duration),
    };
  if (command.kind !== "scrub") return state;
  return {
    status: "paused",
    currentTimeSeconds:
      Math.min(
        1,
        Math.max(0, Number.isFinite(command.sample) ? command.sample : 0),
      ) * duration,
  };
}

function ReviewModel({
  gltf,
  selection,
  command,
  onReady,
  onRefused,
  onPlaybackStateChange,
}: {
  readonly gltf: GLTF;
  readonly selection: ImportedAvatarReviewSelection;
  readonly command: ImportedAvatarReviewPlaybackCommand;
  readonly onReady: () => void;
  readonly onRefused: (message: string) => void;
  readonly onPlaybackStateChange: (
    state: ImportedAvatarReviewPlaybackState,
  ) => void;
}) {
  const scene = useMemo(
    () => SkeletonUtils.clone(gltf.scene) as Group,
    [gltf.scene],
  );
  const mixer = useMemo(() => new AnimationMixer(scene), [scene]);
  const clip = gltf.animations[selection.clip.index];
  const clipValid =
    clip?.name === selection.clip.name &&
    Math.abs((clip?.duration ?? 0) - selection.clip.durationSeconds) <= 0.001;
  const action = useMemo(
    () => (clipValid && clip ? mixer.clipAction(clip) : null),
    [clip, clipValid, mixer],
  );
  const state = useRef(initialImportedAvatarReviewPlayback());
  const lastReported = useRef(-1);
  const invalidate = useThree((current) => current.invalidate);

  useEffect(() => {
    if (!action || !clip) {
      onRefused("Model-local clip name or duration differs from the manifest.");
      return;
    }
    const reviewAction = action as ReviewAnimationAction;
    reviewAction.reset().setLoop(LOOP_ONCE, 1).play();
    reviewAction.clampWhenFinished = true;
    action.paused = true;
    action.time = 0;
    mixer.update(0);
    state.current = initialImportedAvatarReviewPlayback();
    onPlaybackStateChange(state.current);
    onReady();
    invalidate();
    const finished = (event: { readonly action: AnimationAction }) => {
      if (event.action !== action) return;
      state.current = {
        status: "ended",
        currentTimeSeconds: clip.duration,
      };
      onPlaybackStateChange(state.current);
    };
    const eventMixer = mixer as unknown as {
      addEventListener(type: "finished", listener: typeof finished): void;
      removeEventListener(type: "finished", listener: typeof finished): void;
    };
    eventMixer.addEventListener("finished", finished);
    return () => {
      eventMixer.removeEventListener("finished", finished);
      action.stop();
    };
  }, [
    action,
    clip,
    invalidate,
    mixer,
    onPlaybackStateChange,
    onReady,
    onRefused,
  ]);

  useEffect(() => {
    if (!action || !clip) return;
    const next = reduceImportedAvatarReviewPlayback(
      state.current,
      command,
      clip.duration,
    );
    if (command.kind === "replay" || next.currentTimeSeconds === 0)
      action.reset();
    action.time = next.currentTimeSeconds;
    action.paused = next.status !== "playing";
    if (next.status === "playing") action.play();
    mixer.update(0);
    state.current = next;
    onPlaybackStateChange(next);
    invalidate();
  }, [action, clip, command, invalidate, mixer, onPlaybackStateChange]);

  useEffect(
    () => () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
    },
    [mixer, scene],
  );

  useFrame((_, delta) => {
    if (!action || state.current.status !== "playing") return;
    advanceImportedAvatarMixer(mixer, delta);
    invalidate();
    if (Math.abs(action.time - lastReported.current) < 0.08) return;
    lastReported.current = action.time;
    state.current = { status: "playing", currentTimeSeconds: action.time };
    onPlaybackStateChange(state.current);
  });

  return (
    <group
      position={selection.position}
      rotation={selection.rotation}
      scale={selection.scale}
      userData={{
        reviewAssetId: selection.assetId,
        reviewClipIndex: selection.clip.index,
        reviewClipName: selection.clip.name,
        reviewPlayback: "raw-model-local",
      }}
    >
      <primitive object={scene} />
    </group>
  );
}

export function ImportedAvatarReviewCanvas({
  selection,
  command,
  onPlaybackStateChange,
}: {
  readonly selection: ImportedAvatarReviewSelection;
  readonly command: ImportedAvatarReviewPlaybackCommand;
  readonly onPlaybackStateChange: (
    state: ImportedAvatarReviewPlaybackState,
  ) => void;
}) {
  const gltf = useLoader(GLTFLoader, selection.assetUrl);
  const [renderState, setRenderState] = useState<
    "loading" | "ready" | "refused"
  >("loading");
  const [refusal, setRefusal] = useState("");
  const markReady = useCallback(() => setRenderState("ready"), []);
  const refuse = useCallback((message: string) => {
    setRefusal(message);
    setRenderState("refused");
  }, []);
  useEffect(() => {
    setRenderState("loading");
    setRefusal("");
  }, [selection.assetId, selection.clip.index]);
  return (
    <div
      className="avatar-review-canvas"
      data-testid="review-canvas"
      data-review-render-state={renderState}
      data-review-asset-id={selection.assetId}
      data-review-clip-index={selection.clip.index}
    >
      <span
        role="status"
        aria-live="polite"
        className="avatar-review-canvas__status"
      >
        {renderState === "ready"
          ? "Raw model-local clip ready"
          : renderState === "refused"
            ? `Playback refused: ${refusal}`
            : "Loading repository-owned model…"}
      </span>
      <Canvas
        frameloop="demand"
        camera={{ position: [0, 0.2, 3.8], fov: 36 }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[3, 4, 5]} intensity={2.4} />
        <ReviewModel
          key={`${selection.assetId}:${selection.clip.index}`}
          gltf={gltf}
          selection={selection}
          command={command}
          onReady={markReady}
          onRefused={refuse}
          onPlaybackStateChange={onPlaybackStateChange}
        />
      </Canvas>
    </div>
  );
}
