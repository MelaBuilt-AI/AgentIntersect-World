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
  readonly applyWorldCanvasObservability: (
    dataset: DOMStringMap,
    input: {
      readonly userLod: "LOD0" | "LOD1" | "LOD2";
      readonly agentLod: "LOD0" | "LOD1" | "LOD2";
      readonly reducedMotion: boolean;
    },
  ) => void;
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
  readonly projectWorldPointToViewport: (input: {
    readonly point: readonly [number, number, number];
    readonly camera: {
      readonly position: readonly [number, number, number];
      readonly target: readonly [number, number, number];
    };
    readonly viewport: { readonly width: number; readonly height: number };
    readonly fovDegrees: number;
  }) => { readonly x: number; readonly y: number; readonly depth: number };
  readonly calculateRepositoryTransform: (
    objects: readonly {
      readonly bounds: {
        readonly x: number;
        readonly z: number;
        readonly width: number;
        readonly depth: number;
      };
    }[],
  ) => {
    readonly position: readonly [number, number, number];
    readonly scale: number;
  };
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
  readonly avatarLodForDistance?: (
    distance: number,
    context: "builder" | "roster" | "world",
  ) => "LOD0" | "LOD1" | "LOD2";
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
          { id: "user-avatar", position: [0, 0.701, 0], scale: 0.82 },
          { id: "mr-fluff-avatar", position: [2.6, 0.697, 0], scale: 0.82 },
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
      position: [-6.1, 1.54, -2],
      target: [5, 0.7, -2],
    });
  });

  it("fits the repository kit beside both avatars instead of the viewport edge", () => {
    expect(typeof api.calculateRepositoryTransform).toBe("function");
    if (!api.calculateRepositoryTransform) return;
    expect(
      api.calculateRepositoryTransform([
        { bounds: { x: 0, z: 0, width: 16, depth: 16 } },
      ]),
    ).toEqual({
      position: [-0.82, 0, -4.32],
      scale: 0.24,
    });
  });

  it("projects equal-depth avatars and the repository center inside the 1600x1000 safe composition", () => {
    expect(typeof api.projectWorldPointToViewport).toBe("function");
    if (!api.projectWorldPointToViewport || !api.calculateWorldCameraPose)
      return;
    const camera = api.calculateWorldCameraPose({
      userPosition: { x: 0, z: 0 },
      camera: { yaw: 0, pitch: 0.35 },
    });
    const project = (point: readonly [number, number, number]) =>
      api.projectWorldPointToViewport!({
        point,
        camera,
        viewport: { width: 1600, height: 1000 },
        fovDegrees: 46,
      });
    const userFeet = project([0, 0, 0]);
    const agentFeet = project([2.6, 0, 0]);
    const userHead = project([0, 2.9, 0]);
    const agentHead = project([2.6, 3.1, 0]);
    const repositoryCenter = project([1.1, 0.5, -2.4]);
    expect(Math.abs(userFeet.y - agentFeet.y)).toBeLessThan(20);
    expect(Math.max(userFeet.y, agentFeet.y)).toBeLessThan(600);
    for (const point of [userHead, agentHead, repositoryCenter]) {
      expect(point.x).toBeGreaterThan(160);
      expect(point.x).toBeLessThan(1440);
      expect(point.y).toBeGreaterThan(140);
      expect(point.y).toBeLessThan(590);
      expect(point.depth).toBeGreaterThan(0);
    }
    expect(typeof avatarApi.avatarLodForDistance).toBe("function");
    const distanceFromCamera = (point: readonly [number, number, number]) =>
      Math.hypot(
        camera.position[0] - point[0],
        camera.position[1] - point[1],
        camera.position[2] - point[2],
      );
    expect(
      avatarApi.avatarLodForDistance?.(
        distanceFromCamera([0, 0.701, 0]),
        "world",
      ),
    ).toBe("LOD2");
    expect(
      avatarApi.avatarLodForDistance?.(
        distanceFromCamera([2.6, 0.697, 0]),
        "world",
      ),
    ).toBe("LOD2");
  });

  it("keeps both World avatars on LOD2 after the bounded 260ms forward journey", () => {
    expect(typeof api.calculateWorldCameraPose).toBe("function");
    expect(typeof avatarApi.avatarLodForDistance).toBe("function");
    if (!api.calculateWorldCameraPose || !avatarApi.avatarLodForDistance)
      return;
    const boundedForwardDistance = 0.26 * 6;
    const userPosition = { x: 0, z: -boundedForwardDistance };
    const camera = api.calculateWorldCameraPose({
      userPosition,
      camera: { yaw: 0, pitch: 0.35 },
    });
    const distanceFromCamera = (point: readonly [number, number, number]) =>
      Math.hypot(
        camera.position[0] - point[0],
        camera.position[1] - point[1],
        camera.position[2] - point[2],
      );
    expect(
      avatarApi.avatarLodForDistance(
        distanceFromCamera([userPosition.x, 0.701, userPosition.z]),
        "world",
      ),
    ).toBe("LOD2");
    expect(
      avatarApi.avatarLodForDistance(
        distanceFromCamera([2.6, 0.697, 0]),
        "world",
      ),
    ).toBe("LOD2");
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
      anchor: [2.6, 3.25, 0],
      icon: "</>",
      label: "Mr Fluff is coding",
      visualLabel: "coding",
      scale: [1.65, 0.5, 1],
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
    ).toMatchObject({ visualLabel: "done", scale: [1.65, 0.5, 1] });
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
    expect(source).toContain("dpr={1}");
    expect(source).toContain("data-agent-avatar-action");
    expect(source).toContain("data-user-avatar-lod");
    expect(source).toContain("layerState={agentLayerState}");
    expect(source).not.toContain("new BoxGeometry(0.9");
  });

  it("writes LOD and render-loop observability directly to the WebGL canvas dataset", () => {
    expect(typeof api.applyWorldCanvasObservability).toBe("function");
    if (!api.applyWorldCanvasObservability) return;
    const dataset = {} as DOMStringMap;
    api.applyWorldCanvasObservability(dataset, {
      userLod: "LOD2",
      agentLod: "LOD2",
      reducedMotion: false,
    });
    expect({ ...dataset }).toMatchObject({
      userAvatarLod: "LOD2",
      agentAvatarLod: "LOD2",
      renderLoop: "continuous",
    });
    const source = readFileSync(
      new URL("../src/world-room-canvas.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain(
      "applyWorldCanvasObservability(gl.domElement.dataset",
    );
  });

  it("keeps normal cadence independent from sparse explicit render samples", () => {
    const source = readFileSync(
      new URL(
        "../../../apps/web/e2e/world-entry-single-agent.spec.ts",
        import.meta.url,
      ),
      "utf8",
    );
    expect(source).toContain('reducedMotion: "no-preference"');
    expect(source).toContain("warmupFrames");
    expect(source).toContain("cadenceSampleCount");
    expect(source).toContain("renderSampleCount");
    expect(source).toContain("cadenceDiagnostics");
    expect(source).toContain("longTaskDiagnostics");
    expect(source).toContain("samplesOverThreshold");
    expect(source).not.toMatch(
      /const frame = async[\s\S]*renderWorkMs\.push\(await render\(\)\)/u,
    );
  });

  it("does not run a second perpetual movement rAF loop while the user is idle", () => {
    const source = readFileSync(
      new URL(
        "../../../apps/web/src/world-entry/WorldRoom.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(source).toContain(
      'if (movementPhase !== "starting" && movementPhase !== "moving") return;',
    );
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
        position: [0, 5, 9.5],
        target: [1, 0.7, 0],
      },
      avatars: [
        {
          id: "user-avatar",
          position: [0, 0.701, 0],
          scale: 0.82,
          selection: userAvatar,
        },
        {
          id: "mr-fluff-avatar",
          position: [2.6, 0.697, 0],
          scale: 0.82,
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
