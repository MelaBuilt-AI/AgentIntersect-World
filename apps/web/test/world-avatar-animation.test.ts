import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  resolveImportedAvatarWorldClip,
  type ImportedAvatarSemantic,
} from "@agentintersect-world/avatar-system/imported-avatar";
import * as chatModule from "../src/world-entry/world-chat-model.js";
import * as navigationModule from "../src/world-entry/world-navigation-model.js";

type OneShotSemantic = Exclude<ImportedAvatarSemantic, "Idle" | "Walk" | "Run">;

type AnimationApi = {
  readonly parseAgentDirectionCommand?: (text: string) =>
    | { readonly kind: "not-agent-command" }
    | {
        readonly kind: "movement";
        readonly target:
          | {
              readonly kind: "coordinate";
              readonly x: number;
              readonly z: number;
            }
          | {
              readonly kind: "relative";
              readonly direction: "forward" | "backward" | "left" | "right";
              readonly distance: number;
            }
          | {
              readonly kind: "follow-user";
              readonly stoppingRadius: number;
            };
      }
    | { readonly kind: "stop" }
    | { readonly kind: "refused"; readonly message: string };
  readonly resolveLocalAvatarCommand?: (text: string) => OneShotSemantic | null;
  readonly projectAgentAnimationCue?: (
    input:
      | { readonly type: "visible-text"; readonly text: string }
      | {
          readonly type: "application-event";
          readonly event: "completed" | "failed";
        },
  ) => {
    readonly semantic: OneShotSemantic;
    readonly source: "visible-text" | "application-event";
  } | null;
  readonly createAvatarAnimationState?: (
    locomotion?: "Idle" | "Walk" | "Run",
  ) => {
    readonly locomotion: "Idle" | "Walk" | "Run";
    readonly semantic: ImportedAvatarSemantic;
    readonly oneShot: OneShotSemantic | null;
    readonly cueSource: string;
    readonly progression: string;
    readonly generation: number;
  };
  readonly triggerAvatarOneShot?: (
    state: ReturnType<NonNullable<AnimationApi["createAvatarAnimationState"]>>,
    semantic: OneShotSemantic,
    source: string,
    reducedMotion: boolean,
  ) => ReturnType<NonNullable<AnimationApi["createAvatarAnimationState"]>>;
  readonly completeAvatarOneShot?: (
    state: ReturnType<NonNullable<AnimationApi["createAvatarAnimationState"]>>,
    generation: number,
  ) => ReturnType<NonNullable<AnimationApi["createAvatarAnimationState"]>>;
  readonly setAvatarLocomotion?: (
    state: ReturnType<NonNullable<AnimationApi["createAvatarAnimationState"]>>,
    locomotion: "Idle" | "Walk" | "Run",
  ) => ReturnType<NonNullable<AnimationApi["createAvatarAnimationState"]>>;
  readonly classifyWorldMessage?: (
    text: string,
  ) =>
    | { readonly kind: "local-animation"; readonly semantic: OneShotSemantic }
    | { readonly kind: "local-agent-movement"; readonly target: object }
    | { readonly kind: "local-agent-stop" }
    | { readonly kind: "local-refusal"; readonly message: string }
    | { readonly kind: "remote-chat"; readonly text: string };
};

const animation = chatModule as typeof chatModule & AnimationApi;
const navigation = navigationModule as typeof navigationModule & {
  readonly shouldConsumeWorldJump?: (input: {
    readonly key: string;
    readonly repeat: boolean;
    readonly target: unknown;
    readonly worldActive: boolean;
    readonly dialogOpen: boolean;
    readonly escapeMenuOpen: boolean;
    readonly oneShotActive: boolean;
  }) => boolean;
};

describe("complete-avatar World animation controls", () => {
  it("routes Space and every local slash action through the accepted model-local clips", () => {
    const accepted = {
      "user-male-01": [6, 20, 13, 17, 7, 4, 11, 19, 5],
      "cat-agent-01": [5, 11, 18, 7, 2, 3, 17, 12, 9],
    } as const;
    const semantics = [
      "Jump",
      "Dance",
      "Clap",
      "Cheer",
      "Wave",
      "Bow",
      "Agree",
      "Angry",
      "Laugh",
    ] as const;

    for (const [modelId, clips] of Object.entries(accepted)) {
      expect(
        semantics.map(
          (semantic) =>
            resolveImportedAvatarWorldClip(modelId, semantic).clipIndex,
        ),
      ).toEqual(clips);
    }
    for (const semantic of semantics.slice(1)) {
      const classified = animation.classifyWorldMessage!(
        `/${semantic.toLocaleLowerCase()}`,
      );
      expect(classified).toEqual({ kind: "local-animation", semantic });
    }
  });

  it("parses only the exact bounded local agent direction grammar", () => {
    expect(typeof animation.parseAgentDirectionCommand).toBe("function");
    const parse = animation.parseAgentDirectionCommand!;
    expect(parse("  /AgEnT MoVe -4.5 12  ")).toEqual({
      kind: "movement",
      target: { kind: "coordinate", x: -4.5, z: 12 },
    });
    expect(parse("/agent move FORWARD 7.25")).toEqual({
      kind: "movement",
      target: { kind: "relative", direction: "forward", distance: 7.25 },
    });
    expect(parse("/agent move left 3")).toEqual({
      kind: "movement",
      target: { kind: "relative", direction: "left", distance: 3 },
    });
    expect(parse("/agent follow")).toEqual({
      kind: "movement",
      target: { kind: "follow-user", stoppingRadius: 1.5 },
    });
    expect(parse("/agent follow 2.25")).toEqual({
      kind: "movement",
      target: { kind: "follow-user", stoppingRadius: 2.25 },
    });
    expect(parse("/agent stop")).toEqual({ kind: "stop" });
  });

  it("keeps malformed agent commands local while unknown slash and ordinary text remain chat", () => {
    expect(typeof animation.parseAgentDirectionCommand).toBe("function");
    expect(typeof animation.classifyWorldMessage).toBe("function");
    const parse = animation.parseAgentDirectionCommand!;
    const classify = animation.classifyWorldMessage!;
    for (const text of [
      "/agent",
      "/agent move",
      "/agent move 16 0",
      "/agent move forward 31",
      "/agent follow 0",
      "/agent stop now",
      "/agent move NaN 0",
    ]) {
      expect(parse(text)).toMatchObject({ kind: "refused" });
      expect(classify(text)).toMatchObject({ kind: "local-refusal" });
    }
    expect(classify("/unknown hello")).toEqual({
      kind: "remote-chat",
      text: "/unknown hello",
    });
    expect(classify("ordinary chat")).toEqual({
      kind: "remote-chat",
      text: "ordinary chat",
    });
  });

  it("classifies recognized gestures as transport-excluded and unknown slash text as chat", () => {
    expect(typeof animation.classifyWorldMessage).toBe("function");
    const classify = animation.classifyWorldMessage!;
    expect(classify("  /WAVE  ")).toEqual({
      kind: "local-animation",
      semantic: "Wave",
    });
    expect(classify("  /unknown hello  ")).toEqual({
      kind: "remote-chat",
      text: "/unknown hello",
    });
  });

  it("recognizes only the exact trimmed case-insensitive local gesture commands", () => {
    expect(typeof animation.resolveLocalAvatarCommand).toBe("function");
    const resolve = animation.resolveLocalAvatarCommand!;
    expect(
      ["dance", "clap", "cheer", "wave", "bow", "agree", "angry", "laugh"].map(
        (command) => resolve(`  /${command.toLocaleUpperCase()}  `),
      ),
    ).toEqual([
      "Dance",
      "Clap",
      "Cheer",
      "Wave",
      "Bow",
      "Agree",
      "Angry",
      "Laugh",
    ]);
    expect(resolve("/dance now")).toBeNull();
    expect(resolve("/unknown")).toBeNull();
    expect(resolve("ordinary chat")).toBeNull();
  });

  it("refuses prose-derived agent gestures and accepts validated application events", () => {
    expect(typeof animation.projectAgentAnimationCue).toBe("function");
    const project = animation.projectAgentAnimationCue!;
    expect(
      project({
        type: "visible-text",
        text: "Hello, yes: complete—haha; sorry; congratulations; dance; angry.",
      }),
    ).toBeNull();
    expect(
      [
        "hello there",
        "yes, correct",
        "task complete",
        "haha",
        "sorry about that",
        "an error occurred",
        "congratulations and applause",
        "let us dance",
      ].map((text) => project({ type: "visible-text", text })?.semantic),
    ).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(project({ type: "visible-text", text: "high fidelity" })).toBeNull();
    expect(project({ type: "application-event", event: "completed" })).toEqual({
      semantic: "Cheer",
      source: "application-event",
    });
    expect(project({ type: "application-event", event: "failed" })).toEqual({
      semantic: "Angry",
      source: "application-event",
    });
  });

  it("consumes Space only while the active unobstructed World owns input", () => {
    expect(typeof navigation.shouldConsumeWorldJump).toBe("function");
    const consume = navigation.shouldConsumeWorldJump!;
    const active = {
      key: " ",
      repeat: false,
      target: { tagName: "CANVAS" },
      worldActive: true,
      dialogOpen: false,
      escapeMenuOpen: false,
      oneShotActive: false,
    } as const;
    expect(consume(active)).toBe(true);
    expect(consume({ ...active, repeat: true })).toBe(false);
    expect(consume({ ...active, oneShotActive: true })).toBe(false);
    expect(consume({ ...active, worldActive: false })).toBe(false);
    expect(consume({ ...active, dialogOpen: true })).toBe(false);
    expect(consume({ ...active, escapeMenuOpen: true })).toBe(false);
    for (const target of [
      { tagName: "INPUT" },
      { tagName: "TEXTAREA" },
      { tagName: "SELECT" },
      { tagName: "BUTTON" },
      { tagName: "A" },
      { tagName: "DIV", isContentEditable: true },
    ])
      expect(consume({ ...active, target })).toBe(false);
  });

  it("uses actor-local generations so latest one-shot wins and stale completion is a no-op", () => {
    expect(typeof animation.createAvatarAnimationState).toBe("function");
    expect(typeof animation.triggerAvatarOneShot).toBe("function");
    expect(typeof animation.completeAvatarOneShot).toBe("function");
    const create = animation.createAvatarAnimationState!;
    const trigger = animation.triggerAvatarOneShot!;
    const complete = animation.completeAvatarOneShot!;
    const walking = create("Walk");
    const jumping = trigger(walking, "Jump", "space", false);
    expect(jumping).toMatchObject({
      locomotion: "Walk",
      semantic: "Jump",
      oneShot: "Jump",
      cueSource: "space",
      progression: "playing-once",
      generation: 1,
    });
    const dancing = trigger(jumping, "Dance", "local-command", false);
    expect(dancing).toMatchObject({
      locomotion: "Walk",
      semantic: "Dance",
      oneShot: "Dance",
      cueSource: "local-command",
      progression: "playing-once",
      generation: 2,
    });
    expect(complete(dancing, jumping.generation)).toBe(dancing);
    expect(complete(dancing, dancing.generation)).toMatchObject({
      locomotion: "Walk",
      semantic: "Walk",
      oneShot: null,
      progression: "returned",
      generation: 2,
    });
    expect(trigger(walking, "Wave", "local-command", true)).toMatchObject({
      locomotion: "Walk",
      semantic: "Walk",
      oneShot: null,
      cueSource: "local-command",
      progression: "reduced-motion-completed",
      generation: 1,
    });
  });

  it("makes locomotion cancel a one-shot and never resumes the cancelled action after stop", () => {
    expect(typeof animation.setAvatarLocomotion).toBe("function");
    const create = animation.createAvatarAnimationState!;
    const trigger = animation.triggerAvatarOneShot!;
    const move = animation.setAvatarLocomotion!;
    const complete = animation.completeAvatarOneShot!;
    const waving = trigger(create("Idle"), "Wave", "visible-text", false);
    const walking = move(waving, "Walk");
    expect(walking).toMatchObject({
      locomotion: "Walk",
      semantic: "Walk",
      oneShot: null,
      progression: "locomotion",
      generation: 2,
    });
    expect(complete(walking, waving.generation)).toBe(walking);
    expect(move(walking, "Idle")).toMatchObject({
      locomotion: "Idle",
      semantic: "Idle",
      oneShot: null,
      progression: "locomotion",
    });
  });

  it("projects validated application events without deriving semantics from assistant prose", () => {
    let state = chatModule.createWorldChatState();
    state = chatModule.reduceWorldChat(state, {
      type: "SEND_COMPLETED",
      text: "Hello—yes, the task is complete.",
    });
    expect(state.animationCue).toMatchObject({
      sequence: 1,
      semantic: "Cheer",
      source: "application-event",
    });
    state = chatModule.reduceWorldChat(state, {
      type: "SEND_FAILED",
      message: "chat unavailable_",
    });
    expect(state.animationCue).toMatchObject({
      sequence: 2,
      semantic: "Angry",
      source: "application-event",
    });
  });

  it("keeps imported-avatar loading and renderer failures explicit", () => {
    const source = readFileSync(
      new URL("../src/world-entry/WorldRoom.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("WorldCanvasErrorBoundary");
    expect(source).toContain("3D avatar loading or rendering failed");
  });
});
