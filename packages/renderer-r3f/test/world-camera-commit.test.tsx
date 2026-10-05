import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { Group, PerspectiveCamera, Vector3 } from "three";
import type { AvatarLayerState } from "../src/avatar-kit-canvas.js";

const hooks = vi.hoisted(() => ({
  layout: [] as (() => unknown)[],
  passive: [] as (() => unknown)[],
  frames: [] as { callback: () => void; priority: number }[],
  three: {} as Record<string, unknown>,
}));
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => [
    typeof initial === "function" ? initial() : initial,
    () => undefined,
  ],
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => unknown) => hooks.passive.push(effect),
  useLayoutEffect: (effect: () => unknown) => hooks.layout.push(effect),
}));
vi.mock("@react-three/fiber", () => ({
  Canvas: () => null,
  useThree: () => hooks.three,
  useFrame: (callback: () => void, priority = 0) =>
    hooks.frames.push({ callback, priority }),
  events: () => ({}),
}));
import * as standard from "../src/world-room-canvas.js";
import * as imported from "../src/world-room-imported-canvas.js";

const avatar = {
  species: "human",
  head: "round",
  hands: "hands",
  feet: "feet",
  fur: "none",
  tail: "none",
  markings: "none",
  bodyColor: "#abcdef",
  shirt: "Codex",
};
const layer: AvatarLayerState = {
  base: "Walk",
  upperBody: null,
  face: "neutral",
  gaze: "neutral",
  secondary: "Neutral",
  crossfadeSeconds: 0.2,
  secondaryMotion: true,
};
const noop = () => undefined;
const props: Parameters<typeof imported.WorldRoomCanvas>[0] = {
  floor: "blank",
  floorSize: 68,
  objects: [],
  cityInstances: [],
  selectedCityInstanceId: null,
  cityFocusPosition: null,
  userPosition: { x: 0, z: 0 },
  camera: { yaw: 0, pitch: 0.35, zoom: 1 },
  activity: { state: "idle", icon: "", label: "idle", detail: "" },
  userAvatar: avatar,
  agentAvatar: avatar,
  userAction: "Walk",
  agentAction: "Idle",
  userLayerState: layer,
  agentLayerState: layer,
  reducedMotion: false,
  userAnimationGeneration: 0,
  agentAnimationGeneration: 0,
  agentPosition: { x: 3, z: 0 },
  agentHeading: 0,
  onContextLost: noop,
  onCitySelect: noop,
  onCitySettled: noop,
  onCityReady: noop,
  onImportedOneShotComplete: noop,
};
function sceneElement(
  node: ReactNode,
): ReactElement<Record<string, unknown>> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = sceneElement(child);
      if (found) return found;
    }
  } else if (isValidElement<{ children?: ReactNode }>(node)) {
    if (typeof node.type === "function" && node.type.name === "WorldRoomScene")
      return node as ReactElement<Record<string, unknown>>;
    return sceneElement(node.props.children);
  }
  return undefined;
}

beforeEach(() => {
  hooks.layout = [];
  hooks.passive = [];
  hooks.frames = [];
  hooks.three = {
    camera: new PerspectiveCamera(46, 16 / 9, 0.1, 1000),
    size: { width: 1920, height: 1080 },
    gl: {
      domElement: {
        dataset: {},
        addEventListener: noop,
        removeEventListener: noop,
      },
    },
    invalidate: noop,
    scene: {},
  };
});

for (const [name, api] of [
  ["imported", imported],
  ["standard", standard],
] as const) {
  describe(`${name} follow-camera commit`, () => {
    it("draws each live walking position even while React commits are deferred", () => {
      const liveUserPosition = { current: { x: 0, z: 0 } };
      const next = { ...props, liveUserPosition };
      const element = sceneElement(api.WorldRoomCanvas(next))!;
      const tree = (element.type as (p: Record<string, unknown>) => ReactNode)(
        element.props,
      );
      let motion: Group | undefined;
      const mount = (node: ReactNode) => {
        if (Array.isArray(node)) return node.forEach(mount);
        if (
          !isValidElement<{
            name?: string;
            ref?: { current: Group | null };
            children?: ReactNode;
          }>(node)
        )
          return;
        if (node.props.name === "world-user-motion") {
          motion = new Group();
          node.props.ref!.current = motion;
        }
        mount(node.props.children);
      };
      mount(tree);
      hooks.layout.forEach((effect) => effect());
      // The held-input clock advances while the already-mounted R3F scene
      // still has its previous React props: no render/commit between draws.
      for (const x of [0.05, 0.1, 0.15, 0.2, 0.15, 0.1, 0.05, 0]) {
        liveUserPosition.current = { x, z: 0 };
        hooks.frames
          .toSorted((a, b) => a.priority - b.priority)
          .forEach(({ callback }) => callback());
        const camera = hooks.three.camera as PerspectiveCamera;
        const expected = api.calculateWorldCameraPose({
          userPosition: liveUserPosition.current,
          camera: props.camera,
          viewportAspect: 16 / 9,
        });
        expect(camera.position.toArray()).toEqual(expected.position);
        expect(motion?.position.toArray()).toEqual([x, 0, 0]);
        expect(hooks.frames.some(({ priority }) => priority < 0)).toBe(true);
      }
      // A delayed commit catches up partway; it must neither double movement
      // nor snap the live avatar/camera back to the committed snapshot.
      hooks.layout = [];
      hooks.frames = [];
      liveUserPosition.current = { x: 0.3, z: 0.4 };
      const caughtUp = sceneElement(
        api.WorldRoomCanvas({
          ...next,
          userPosition: { x: 0.1, z: 0.2 },
        }),
      )!;
      mount(
        (caughtUp.type as (p: Record<string, unknown>) => ReactNode)(
          caughtUp.props,
        ),
      );
      hooks.layout.forEach((effect) => effect());
      hooks.frames.forEach(({ callback }) => callback());
      expect(motion!.position.x).toBeCloseTo(0.2, 10);
      expect(motion!.position.z).toBeCloseTo(0.2, 10);
      const expected = api.calculateWorldCameraPose({
        userPosition: liveUserPosition.current,
        camera: props.camera,
        viewportAspect: 16 / 9,
      });
      (hooks.three.camera as PerspectiveCamera).position
        .toArray()
        .forEach((value: number, index: number) =>
          expect(value).toBeCloseTo(expected.position[index]!, 10),
        );
      // Spatial-screen focus owns priority -1 and must override follow pose.
      hooks.frames.unshift({
        priority: -1,
        callback: () =>
          (hooks.three.camera as PerspectiveCamera).position.set(20, 30, 40),
      });
      hooks.frames
        .toSorted((a, b) => a.priority - b.priority)
        .forEach(({ callback }) => callback());
      expect(
        (hooks.three.camera as PerspectiveCamera).position.toArray(),
      ).toEqual([20, 30, 40]);
    });

    it("keeps the committed avatar centered before deferred passive effects, including lateral reversal", () => {
      const commit = (position: { x: number; z: number }) => {
        hooks.layout = [];
        hooks.passive = [];
        // Traverse the real canvas element to exercise its actual scene hook,
        // without a WebGPU context. R3F commits host positions synchronously;
        // passive React effects may run after the next rendered frame.
        const canvas = api.WorldRoomCanvas({
          ...props,
          userPosition: position,
        });
        const element = sceneElement(canvas)!;
        expect(element).toBeDefined();
        (element.type as (p: Record<string, unknown>) => ReactNode)(
          element.props,
        );
        hooks.layout.forEach((effect) => effect());
        return new Vector3(position.x, 0.7, position.z).project(
          hooks.three.camera as PerspectiveCamera,
        );
      };
      commit({ x: 0, z: 0 });
      hooks.passive.forEach((effect) => effect());
      for (const x of [0.2, 0.4, 0.6, 0.4, 0.2, 0, -0.2]) {
        const projected = commit({ x, z: 0 });
        expect(Math.abs(projected.x) * 960).toBeLessThan(0.1);
        expect(Math.abs(projected.y) * 540).toBeLessThan(0.1);
        hooks.passive.forEach((effect) => effect());
      }
    });

    it("commits look, zoom, resize and repository focus without changing camera framing", () => {
      const liveUserPosition = { current: { x: 4, z: -3 } };
      const next = {
        ...props,
        liveUserPosition,
        userPosition: { x: 4, z: -3 },
        cityFocusPosition: { x: 12, z: -8 },
        camera: { yaw: 1.2, pitch: 0.6, zoom: 0.7 },
        reducedMotion: true,
      };
      hooks.three.size = { width: 800, height: 1200 };
      const element = sceneElement(api.WorldRoomCanvas(next))!;
      (element.type as (p: Record<string, unknown>) => ReactNode)(
        element.props,
      );
      hooks.layout.forEach((effect) => effect());
      liveUserPosition.current = { x: 8, z: -7 };
      hooks.frames.forEach(({ callback }) => callback());
      const expected = api.calculateWorldCameraPose({
        userPosition: next.cityFocusPosition,
        camera: next.camera,
        viewportAspect: 800 / 1200,
      });
      const camera = hooks.three.camera as PerspectiveCamera;
      expect(camera.position.toArray()).toEqual(expected.position);
      const target = new Vector3(...expected.target).project(camera);
      expect(Math.abs(target.x)).toBeLessThan(1e-10);
      expect(Math.abs(target.y)).toBeLessThan(1e-10);
    });
  });
}
