import { expect, it, vi } from "vitest";
import { Texture } from "three";
const state = vi.hoisted(() => ({
  frames: [] as ((state: unknown, delta: number) => void)[],
  textures: [] as (Texture | null)[],
  index: 0,
  invalidate: vi.fn(),
}));
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useContext: (context: { _currentValue: unknown }) => context._currentValue,
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => unknown) => {
    effect();
  },
}));
vi.mock("@react-three/fiber", () => ({
  useThree: () => ({
    gl: { domElement: { dataset: {} } },
    scene: { fog: null },
    invalidate: state.invalidate,
  }),
  useFrame: (callback: (state: unknown, delta: number) => void) =>
    state.frames.push(callback),
}));
vi.mock("../src/code-world-texture.js", async () => ({
  ...(await vi.importActual("../src/code-world-texture.js")),
  useCodeTexture: () => state.textures[state.index++],
}));
import { WorldEnvironment } from "../src/world-environment.js";
import { WorldWetFloor } from "../src/world-atmosphere-effects.js";

it("retains the inactive Original reflector behind its hidden environment", () => {
  state.index = 0;
  state.textures = [null, null, null, null];
  const world = WorldEnvironment({
    floor: "repository",
    size: 68,
    reducedMotion: false,
    userPosition: { x: 0, z: 0 },
    active: false,
  });
  expect(world.props.visible).toBe(false);
  expect(
    world.props.children.some(
      (node: { type?: unknown }) => node?.type === WorldWetFloor,
    ),
  ).toBe(true);
});

it("keeps imported dark materials readable with the preview-strength indirect fill", () => {
  state.index = 0;
  state.textures = [null, null, null, null];
  const world = WorldEnvironment({
    floor: "repository",
    size: 68,
    reducedMotion: false,
    userPosition: { x: 0, z: 0 },
  });
  const ambient = world.props.children.find(
    (node: { type?: string }) => node?.type === "ambientLight",
  );
  expect(ambient.props.intensity).toBe(1.8);
});

it("reveals the environment after all textures and rendered warmup frames", () => {
  const ready = vi.fn();
  const draw = (loaded: boolean) => {
    state.frames = [];
    state.index = 0;
    state.textures = [
      new Texture(),
      new Texture(),
      new Texture(),
      loaded ? new Texture() : null,
    ];
    WorldEnvironment({
      floor: "blank",
      size: 68,
      reducedMotion: true,
      userPosition: { x: 0, z: 0 },
      onReady: ready,
    });
    return () => state.frames.forEach((callback) => callback({}, 1 / 60));
  };
  let frame = draw(false);
  for (let i = 0; i < 5; i++) frame();
  expect(ready).not.toHaveBeenCalled();
  frame = draw(true);
  frame();
  frame();
  expect(ready).not.toHaveBeenCalled();
  frame();
  frame();
  expect(ready).toHaveBeenCalledTimes(1);
});
