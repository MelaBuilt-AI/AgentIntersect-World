import * as avatarKitModule from "../src/avatar-kit-canvas.js";
import * as rendererModule from "../src/world-room-canvas.js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type AvatarSelection = {
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

type RendererApi = {
  readonly prepareWorldActivityBubble: (input: {
    readonly activity: {
      readonly state:
        "idle" | "thinking" | "tool" | "coding" | "completed" | "failed";
      readonly icon: string;
      readonly label: string;
    };
    readonly reducedMotion: boolean;
  }) => {
    readonly anchor: readonly [number, number, number];
    readonly icon: string;
    readonly label: string;
    readonly visualLabel: string;
    readonly scale: readonly [number, number, number];
    readonly visible: boolean;
    readonly animated: boolean;
  };
  readonly calculateWorldCameraPose: (input: {
    readonly userPosition: { readonly x: number; readonly z: number };
    readonly camera: { readonly yaw: number; readonly pitch: number };
  }) => {
    readonly position: readonly [number, number, number];
    readonly target: readonly [number, number, number];
  };
  readonly calculateControlledAvatarYaw: (cameraYaw: number) => number;
  readonly prepareWorldRoomScene: (input: {
    readonly floor: "blank" | "repository";
    readonly userAvatar: AvatarSelection;
    readonly agentAvatar: AvatarSelection;
    readonly objects: readonly {
      readonly ref: string;
      readonly kind: "package" | "directory" | "file" | "symbol";
      readonly name: string;
      readonly position: {
        readonly x: number;
        readonly y: number;
        readonly z: number;
      };
      readonly bounds: {
        readonly x: number;
        readonly z: number;
        readonly width: number;
        readonly depth: number;
      };
    }[];
  }) => Readonly<Record<string, unknown>>;
  readonly WorldRoomCanvas: unknown;
};

const api = rendererModule as unknown as Partial<RendererApi>;
const avatarApi = avatarKitModule as unknown as {
  readonly AvatarKitWorldModel?: unknown;
  readonly avatarGroundOffset?: (selection: AvatarSelection) => number;
};
const userAvatar: AvatarSelection = {
  species: "human",
  head: "round",
  hands: "hands",
  feet: "feet",
  fur: "none",
  tail: "none",
  markings: "solid",
  bodyColor: "warm-light",
  shirt: "Codex",
};
const agentAvatar: AvatarSelection = {
  species: "cat",
  head: "shorthair",
  hands: "paws",
  feet: "paws",
  fur: "short",
  tail: "cat-straight",
  markings: "socks",
  bodyColor: "fur-charcoal",
  shirt: "Hermes",
};
const dogAvatar: AvatarSelection = {
  ...agentAvatar,
  species: "dog",
  head: "labrador",
  tail: "dog-straight",
};

describe("Phase 18 shared World room canvas", () => {
  it("grounds human, cat, and dog selections from canonical visible foot and paw bounds", () => {
    expect(typeof avatarApi.avatarGroundOffset).toBe("function");
    if (!avatarApi.avatarGroundOffset || !api.prepareWorldRoomScene) return;
    expect(avatarApi.avatarGroundOffset(userAvatar)).toBe(0.855);
    expect(avatarApi.avatarGroundOffset(agentAvatar)).toBe(0.85);
    expect(avatarApi.avatarGroundOffset(dogAvatar)).toBe(0.85);

    for (const floor of ["blank", "repository"] as const) {
      const scene = api.prepareWorldRoomScene({
        floor,
        objects: [],
        userAvatar,
        agentAvatar,
      });
      expect(scene).toMatchObject({
        floor: { kind: floor },
        avatars: [
          { id: "user-avatar", position: [0, 0.855, 0] },
          { id: "mr-fluff-avatar", position: [3, 0.85, 2] },
        ],
      });
    }
  });

  it("derives a visibly following third-person camera from live yaw and pitch", () => {
    expect(typeof api.calculateWorldCameraPose).toBe("function");
    if (!api.calculateWorldCameraPose) return;
    expect(
      api.calculateWorldCameraPose({
        userPosition: { x: 4, z: -2 },
        camera: { yaw: Math.PI / 2, pitch: 0 },
      }),
    ).toEqual({
      position: [-8, 1.6, -2],
      target: [4, 1.2, -2],
    });
  });

  it("continuously aligns only the controlled avatar with camera heading", () => {
    expect(typeof api.calculateControlledAvatarYaw).toBe("function");
    if (!api.calculateControlledAvatarYaw) return;
    expect(api.calculateControlledAvatarYaw(0)).toBeCloseTo(Math.PI);
    expect(api.calculateControlledAvatarYaw(Math.PI / 2)).toBeCloseTo(
      Math.PI / 2,
    );
    const source = readFileSync(
      new URL("../src/world-room-canvas.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(
      /role="user"[\s\S]*rotation=\{\[0, controlledAvatarYaw, 0\]\}/u,
    );
    expect(source).not.toMatch(
      /role="agent"[\s\S]*rotation=\{\[0, controlledAvatarYaw, 0\]\}/u,
    );
  });

  it("anchors canonical activity truth above Mr Fluff with reduced-motion parity", () => {
    expect(typeof api.prepareWorldActivityBubble).toBe("function");
    if (!api.prepareWorldActivityBubble) return;
    expect(
      api.prepareWorldActivityBubble({
        activity: {
          state: "coding",
          icon: "</>",
          label: "Mr Fluff is coding",
        },
        reducedMotion: false,
      }),
    ).toEqual({
      anchor: [3, 3.45, 2],
      icon: "</>",
      label: "Mr Fluff is coding",
      visualLabel: "coding",
      scale: [3.8, 1.2, 1],
      visible: true,
      animated: true,
    });
    expect(
      api.prepareWorldActivityBubble({
        activity: {
          state: "completed",
          icon: "✓",
          label: "Mr Fluff completed the request",
        },
        reducedMotion: false,
      }),
    ).toMatchObject({ visualLabel: "done", scale: [3.8, 1.2, 1] });
    expect(
      api.prepareWorldActivityBubble({
        activity: {
          state: "thinking",
          icon: "…",
          label: "Mr Fluff is thinking",
        },
        reducedMotion: true,
      }).animated,
    ).toBe(false);
  });

  it("provides one scene host and a reusable modular in-scene avatar primitive", () => {
    expect(typeof api.prepareWorldRoomScene).toBe("function");
    expect(typeof api.WorldRoomCanvas).toBe("function");
    expect(typeof avatarApi.AvatarKitWorldModel).toBe("function");
    const source = readFileSync(
      new URL("../src/world-room-canvas.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("<AvatarKitWorldModel");
    expect(source).not.toContain("new BoxGeometry(0.9");
  });

  it("preserves scene, third-person camera, and avatars across an in-place floor transition", () => {
    if (!api.prepareWorldRoomScene) return;
    const blank = api.prepareWorldRoomScene({
      floor: "blank",
      objects: [],
      userAvatar,
      agentAvatar,
    });
    const repository = api.prepareWorldRoomScene({
      floor: "repository",
      userAvatar,
      agentAvatar,
      objects: [
        {
          ref: "aiw://object/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          kind: "file",
          name: "world-entry.ts",
          position: { x: 2, y: 0, z: 3 },
          bounds: { x: 1, z: 2, width: 2, depth: 2 },
        },
      ],
    });
    expect(blank).toMatchObject({
      sceneId: "world-room",
      canvasHosts: 1,
      portal: false,
      floor: { kind: "blank", repositoryObjectCount: 0 },
      camera: {
        id: "third-person-user",
        mode: "third-person",
        position: [0, 7, 12],
        target: [0, 1, 0],
      },
      avatars: [
        {
          id: "user-avatar",
          position: [0, 0.855, 0],
          selection: userAvatar,
        },
        {
          id: "mr-fluff-avatar",
          position: [3, 0.85, 2],
          selection: agentAvatar,
        },
      ],
    });
    expect(repository).toMatchObject({
      sceneId: blank.sceneId,
      canvasHosts: 1,
      portal: false,
      floor: { kind: "repository", repositoryObjectCount: 1 },
      camera: blank.camera,
      avatars: blank.avatars,
    });
  });
});
