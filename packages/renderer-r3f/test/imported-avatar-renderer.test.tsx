import { readFileSync } from "node:fs";
import {
  AnimationClip,
  AnimationMixer,
  Group,
  NumberKeyframeTrack,
  VectorKeyframeTrack,
} from "three";
import { describe, expect, it, vi } from "vitest";

import * as avatarKitModule from "../src/imported-avatar-canvas.js";
import * as worldRoomModule from "../src/world-room-imported-canvas.js";

const avatarApi = avatarKitModule as typeof avatarKitModule & {
  readonly ImportedAvatarCanvas?: unknown;
  readonly ImportedAvatarWorldModel?: unknown;
  readonly configureImportedAvatarScene?: unknown;
  readonly makeImportedAvatarClipInPlace?: (
    clip: AnimationClip,
    travelThreshold?: number,
    normalizeVerticalTravel?: boolean,
  ) => AnimationClip;
  readonly IMPORTED_AVATAR_CROSSFADE_SECONDS?: number;
  readonly advanceImportedAvatarMixer?: (
    mixer: AnimationMixer,
    deltaSeconds: number,
  ) => number;
  readonly crossfadeImportedAvatarAction?: (
    previous: {
      fadeOut(seconds: number): unknown;
    } | null,
    next: {
      reset(): unknown;
      setEffectiveWeight(weight: number): unknown;
      fadeIn(seconds: number): unknown;
      play(): unknown;
    },
  ) => unknown;
  readonly configureImportedAvatarAction?: <Action>(
    action: Action,
    oneShot: boolean,
  ) => Action;
};
const importedWorldApi = worldRoomModule as typeof worldRoomModule & {
  readonly calculateWorldCameraPose?: (input: {
    readonly userPosition: { readonly x: number; readonly z: number };
    readonly camera: { readonly yaw: number; readonly pitch: number };
  }) => {
    readonly position: readonly [number, number, number];
    readonly target: readonly [number, number, number];
  };
  readonly projectWorldPointToViewport?: (input: {
    readonly point: readonly [number, number, number];
    readonly camera: {
      readonly position: readonly [number, number, number];
      readonly target: readonly [number, number, number];
    };
    readonly viewport: { readonly width: number; readonly height: number };
    readonly fovDegrees: number;
  }) => { readonly x: number; readonly y: number; readonly depth: number };
  readonly selectWorldImportedAvatarMotion?: (
    reducedMotion: boolean,
    resolvedClipIndex: number | undefined,
    defaultSkeletalMotion: boolean,
  ) => boolean;
};

describe("experimental imported avatar renderer routing", () => {
  it("exports skeleton-safe creator and World imported-model primitives", () => {
    expect(typeof avatarApi.ImportedAvatarCanvas).toBe("function");
    expect(typeof avatarApi.ImportedAvatarWorldModel).toBe("function");
    expect(typeof avatarApi.configureImportedAvatarScene).toBe("function");
    expect(typeof avatarApi.makeImportedAvatarClipInPlace).toBe("function");
    expect(avatarApi.IMPORTED_AVATAR_CROSSFADE_SECONDS).toBe(0.22);
  });

  it("routes each World role independently while retaining the custom kit branch", () => {
    expect(typeof worldRoomModule.WorldRoomCanvas).toBe("function");
    const source = readFileSync(
      new URL("../src/world-room-imported-canvas.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("<WorldAvatarModel");
    expect(source).toContain("<ImportedAvatarWorldModel");
    expect(source).toContain("action={action}");
    expect(source).toContain("<AvatarKitWorldModel");
    expect(source).toContain('role="user"');
    expect(source).toContain('role="agent"');
  });

  it("frames a normalized 1.75-meter imported avatar at a useful World size", () => {
    expect(typeof importedWorldApi.calculateWorldCameraPose).toBe("function");
    expect(typeof importedWorldApi.projectWorldPointToViewport).toBe(
      "function",
    );
    if (
      !importedWorldApi.calculateWorldCameraPose ||
      !importedWorldApi.projectWorldPointToViewport
    )
      return;
    const camera = importedWorldApi.calculateWorldCameraPose({
      userPosition: { x: 0, z: 0 },
      camera: { yaw: 0, pitch: 0.35 },
    });
    const project = (point: readonly [number, number, number]) =>
      importedWorldApi.projectWorldPointToViewport!({
        point,
        camera,
        viewport: { width: 1600, height: 1000 },
        fovDegrees: 46,
      });
    const feet = project([0, 0, 0]);
    const head = project([0, 1.75, 0]);
    expect(Math.abs(feet.y - head.y)).toBeGreaterThan(325);
    expect(head.x).toBeGreaterThan(160);
    expect(head.x).toBeLessThan(1440);
    expect(head.depth).toBeGreaterThan(0);
  });

  it("keeps imported grounding and static-refusal presentation explicit", () => {
    const source = readFileSync(
      new URL("../src/world-room-imported-canvas.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("IMPORTED_WORLD_AVATAR_SCALE = 1");
    expect(source).toContain("ImportedAvatarGroundingMarker");
    expect(source).toContain("`${role}-imported-avatar-grounding`");
    expect(source).toContain("clipName ?? userAction");
    expect(source).toContain("clipName ?? agentAction");
  });

  it("keeps verified model-local clips active on constrained WebGL while honoring reduced motion and refusal", () => {
    expect(typeof importedWorldApi.selectWorldImportedAvatarMotion).toBe(
      "function",
    );
    if (!importedWorldApi.selectWorldImportedAvatarMotion) return;
    expect(
      importedWorldApi.selectWorldImportedAvatarMotion(false, 5, false),
    ).toBe(true);
    expect(
      importedWorldApi.selectWorldImportedAvatarMotion(true, 5, true),
    ).toBe(false);
    expect(
      importedWorldApi.selectWorldImportedAvatarMotion(false, -1, false),
    ).toBe(false);
    expect(
      importedWorldApi.selectWorldImportedAvatarMotion(false, undefined, true),
    ).toBe(true);
  });

  it("removes only cumulative dominant Hip travel from a cloned World clip", () => {
    expect(typeof avatarApi.makeImportedAvatarClipInPlace).toBe("function");
    if (!avatarApi.makeImportedAvatarClipInPlace) return;
    const sourceValues = [0, 1, 0, 0.05, 1.1, 0.9, 0.1, 1.05, 1.5];
    const source = new AnimationClip("walk", 1, [
      new VectorKeyframeTrack(
        "Armature|Hip.position",
        [0, 0.5, 1],
        sourceValues,
      ),
    ]);
    const sourceBefore = Array.from(source.tracks[0]!.values);

    const normalized = avatarApi.makeImportedAvatarClipInPlace(source);
    const sourceTrack = source.tracks[0] as VectorKeyframeTrack;
    const normalizedTrack = normalized.tracks[0] as VectorKeyframeTrack;
    expect(normalized).not.toBe(source);
    expect(Array.from(sourceTrack.values)).toEqual(sourceBefore);
    expect(
      [0, 1, 3, 4, 6, 7].map((index) => normalizedTrack.values[index]),
    ).toEqual([
      0,
      1,
      sourceBefore[3],
      sourceBefore[4],
      sourceBefore[6],
      sourceBefore[7],
    ]);
    expect(normalizedTrack.values[2]).toBeCloseTo(normalizedTrack.values[8]!);
    expect(normalizedTrack.values[5]).toBeCloseTo(0.15);

    const idle = new AnimationClip("idle", 1, [
      new VectorKeyframeTrack(
        "Rig/Hip.position",
        [0, 0.5, 1],
        [0, 1, 0, 0.02, 1.03, 0.1, 0.04, 1, 0.2],
      ),
    ]);
    expect(
      Array.from(
        avatarApi.makeImportedAvatarClipInPlace(idle).tracks[0]!.values,
      ),
    ).toEqual(Array.from(idle.tracks[0]!.values));
    expect(idle.name).toBe("idle");
    expect(idle.duration).toBe(1);
  });

  it("normalizes cumulative horizontal Root Hip and Pelvis travel while preserving vertical motion and sources", () => {
    expect(typeof avatarApi.makeImportedAvatarClipInPlace).toBe("function");
    if (!avatarApi.makeImportedAvatarClipInPlace) return;
    const source = new AnimationClip("travel", 1, [
      new VectorKeyframeTrack(
        "Root.position",
        [0, 0.5, 1],
        [0, 0, 0, 1, 0.5, 2, 2, 0, 4],
      ),
      new VectorKeyframeTrack(
        "Armature|Hip.position",
        [0, 0.5, 1],
        [5, 1, 2, 6, 1.5, 3, 7, 1, 4],
      ),
      new VectorKeyframeTrack(
        "Rig/Pelvis.position",
        [0, 0.5, 1],
        [2, 2, 8, 3, 2.5, 9, 4, 2, 10],
      ),
    ]);
    const before = source.tracks.map((track) => Array.from(track.values));
    const normalized = avatarApi.makeImportedAvatarClipInPlace(source, 0.25);
    expect(source.tracks.map((track) => Array.from(track.values))).toEqual(
      before,
    );
    for (const track of normalized.tracks) {
      expect(track.values[0]).toBeCloseTo(track.values[6]!);
      expect(track.values[2]).toBeCloseTo(track.values[8]!);
    }
    expect(normalized.tracks[0]!.values[4]).toBe(0.5);
    expect(normalized.tracks[1]!.values[4]).toBe(1.5);
    expect(normalized.tracks[2]!.values[4]).toBe(2.5);
  });

  it("normalizes cumulative vertical locomotion travel without mutating the source or flattening one-shots by default", () => {
    expect(typeof avatarApi.makeImportedAvatarClipInPlace).toBe("function");
    if (!avatarApi.makeImportedAvatarClipInPlace) return;
    const source = new AnimationClip("run", 1, [
      new VectorKeyframeTrack(
        "Armature|Hip.position",
        [0, 0.5, 1],
        [0, -0.5, 0, 0.05, -2, 0.1, 0.1, -3.5, 0.2],
      ),
    ]);
    const before = Array.from(source.tracks[0]!.values);
    const oneShot = avatarApi.makeImportedAvatarClipInPlace(source, 0.25);
    expect(oneShot.tracks[0]!.values[1]).toBe(-0.5);
    expect(oneShot.tracks[0]!.values[7]).toBe(-3.5);

    const locomotion = avatarApi.makeImportedAvatarClipInPlace(
      source,
      0.25,
      true,
    );
    expect(locomotion.tracks[0]!.values[1]).toBeCloseTo(0);
    expect(locomotion.tracks[0]!.values[7]).toBeCloseTo(0);
    expect(locomotion.tracks[0]!.values[4]).toBeCloseTo(0);
    expect(Array.from(source.tracks[0]!.values)).toEqual(before);
  });

  it("configures one-shots to play once and locomotion to repeat", () => {
    expect(typeof avatarApi.configureImportedAvatarAction).toBe("function");
    const configure = avatarApi.configureImportedAvatarAction!;
    const action = {
      clampWhenFinished: false,
      setLoop: vi.fn().mockReturnThis(),
    };
    expect(configure(action, true)).toBe(action);
    expect(action.setLoop).toHaveBeenCalledWith(expect.any(Number), 1);
    expect(action.clampWhenFinished).toBe(true);
    configure(action, false);
    expect(action.setLoop).toHaveBeenLastCalledWith(
      expect.any(Number),
      Infinity,
    );
    expect(action.clampWhenFinished).toBe(false);
  });

  it("uses the shared 0.22-second crossfade for semantic clip transitions", () => {
    const source = readFileSync(
      new URL("../src/imported-avatar-animation.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("IMPORTED_AVATAR_CROSSFADE_SECONDS");
    expect(source).toMatch(
      /previous\.fadeOut\(IMPORTED_AVATAR_CROSSFADE_SECONDS\)/u,
    );
    expect(source).toMatch(
      /next\.fadeIn\(IMPORTED_AVATAR_CROSSFADE_SECONDS\)/u,
    );
    expect(source).toContain("next.play()");
  });

  it("advances the model-local mixer/action with bounded frame deltas", () => {
    expect(typeof avatarApi.advanceImportedAvatarMixer).toBe("function");
    if (!avatarApi.advanceImportedAvatarMixer) return;
    const root = new Group();
    const animated = new Group();
    animated.name = "Spine";
    root.add(animated);
    const ownClip = new AnimationClip("own-idle", 1, [
      new NumberKeyframeTrack("Spine.rotation[x]", [0, 0.5, 1], [0, 0.2, 0]),
    ]);
    const mixer = new AnimationMixer(root);
    const action = mixer.clipAction(ownClip).play();

    expect(avatarApi.advanceImportedAvatarMixer(mixer, 0.2)).toBe(0.05);
    expect(mixer.time).toBeCloseTo(0.05);
    expect(action.time).toBeCloseTo(0.05);
    expect(animated.rotation.x).not.toBe(0);
    expect(avatarApi.advanceImportedAvatarMixer(mixer, -1)).toBe(0);
    expect(action.getClip()).toBe(ownClip);
  });

  it("crossfades only between actions owned by the current model mixer", () => {
    expect(typeof avatarApi.crossfadeImportedAvatarAction).toBe("function");
    if (!avatarApi.crossfadeImportedAvatarAction) return;
    const previous = { fadeOut: vi.fn() };
    const next = {
      reset: vi.fn(),
      setEffectiveWeight: vi.fn(),
      fadeIn: vi.fn(),
      play: vi.fn(),
    };
    next.reset.mockReturnValue(next);
    next.setEffectiveWeight.mockReturnValue(next);
    next.fadeIn.mockReturnValue(next);
    next.play.mockReturnValue(next);

    expect(avatarApi.crossfadeImportedAvatarAction(previous, next)).toBe(next);
    expect(previous.fadeOut).toHaveBeenCalledWith(0.22);
    expect(next.reset).toHaveBeenCalledOnce();
    expect(next.setEffectiveWeight).toHaveBeenCalledWith(1);
    expect(next.fadeIn).toHaveBeenCalledWith(0.22);
    expect(next.play).toHaveBeenCalledOnce();
  });

  it("publishes temporal samples from each selected model's own mixer, action, and bone", () => {
    const modelSource = readFileSync(
      new URL("../src/imported-avatar-canvas.tsx", import.meta.url),
      "utf8",
    );
    const worldSource = readFileSync(
      new URL("../src/world-room-imported-canvas.tsx", import.meta.url),
      "utf8",
    );
    expect(modelSource).toContain("ImportedAvatarAnimationSample");
    expect(modelSource).toContain("onAnimationSample");
    expect(modelSource).toContain("mixerTime");
    expect(modelSource).toContain("actionTime");
    expect(modelSource).toContain("boneQuaternion");
    expect(modelSource).toContain("sourceAssetId: selection.assetId");
    expect(modelSource).toContain('"L_Thigh"');
    expect(modelSource.indexOf('"L_Thigh"')).toBeLessThan(
      modelSource.indexOf('"Head"'),
    );
    expect(modelSource).toContain(
      "const sourceClip = gltf.animations[clipIndex]",
    );
    expect(worldSource).toContain("data-user-avatar-mixer-time");
    expect(worldSource).toContain("data-agent-avatar-mixer-time");
    expect(worldSource).toContain("data-user-avatar-bone-quaternion");
    expect(worldSource).toContain("data-agent-avatar-bone-quaternion");
  });

  it("reports the generation captured by each one-shot listener", () => {
    const modelSource = readFileSync(
      new URL("../src/imported-avatar-canvas.tsx", import.meta.url),
      "utf8",
    );
    expect(modelSource).toContain(
      "const onOneShotCompleteRef = useRef(onOneShotComplete)",
    );
    expect(modelSource).toContain(
      "onOneShotCompleteRef.current = onOneShotComplete",
    );
    expect(modelSource).toContain(
      "const completedGeneration = oneShotGeneration",
    );
    expect(modelSource).toContain("if (!resolvedOneShot || !animate) return");
    expect(modelSource).toContain(
      "onOneShotCompleteRef.current?.(resolvedSemantic, completedGeneration)",
    );
    expect(modelSource).toMatch(
      /\[\s*animate,\s*clip,\s*invalidate,\s*mixer,\s*oneShotGeneration,/u,
    );
  });

  it("clones intact by default, hides only allowlisted part IDs, and restores all", () => {
    expect(typeof avatarApi.configureImportedAvatarScene).toBe("function");
    if (typeof avatarApi.configureImportedAvatarScene !== "function") return;
    const configure = avatarApi.configureImportedAvatarScene as (
      source: Group,
      parts: readonly { readonly partId: string; readonly nodeName: string }[],
      hidden: readonly string[],
    ) => Group;
    const source = new Group();
    const head = new Group();
    head.name = "tripo_part_0";
    const torso = new Group();
    torso.name = "tripo_part_1";
    source.add(head, torso);
    const parts = [
      { partId: "cat-agent:part:00", nodeName: "tripo_part_0" },
      { partId: "cat-agent:part:01", nodeName: "tripo_part_1" },
    ] as const;

    const intact = configure(source, parts, []);
    expect(intact).not.toBe(source);
    expect(intact.getObjectByName("tripo_part_0")?.visible).toBe(true);
    expect(intact.getObjectByName("tripo_part_1")?.visible).toBe(true);
    expect(source.getObjectByName("tripo_part_0")?.visible).toBe(true);

    const isolated = configure(source, parts, ["cat-agent:part:01"]);
    expect(isolated.getObjectByName("tripo_part_0")?.visible).toBe(true);
    expect(isolated.getObjectByName("tripo_part_1")?.visible).toBe(false);
    const injectionIgnored = configure(source, parts, ["tripo_part_0"]);
    expect(injectionIgnored.getObjectByName("tripo_part_0")?.visible).toBe(
      true,
    );
    const restored = configure(source, parts, []);
    expect(restored.getObjectByName("tripo_part_1")?.visible).toBe(true);
  });
});
