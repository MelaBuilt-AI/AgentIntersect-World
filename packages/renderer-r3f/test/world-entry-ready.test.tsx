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
