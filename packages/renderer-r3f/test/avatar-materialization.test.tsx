import { afterEach, expect, it, vi } from "vitest";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Texture,
  Sprite,
  SpriteMaterial,
} from "three";
const state = vi.hoisted(() => ({
  frame: (() => {}) as (state: unknown, delta: number) => void,
  dataset: {} as Record<string, string>,
  cleanups: [] as (() => void)[],
}));
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => unknown) => {
    const cleanup = effect();
    if (typeof cleanup === "function")
      state.cleanups.push(cleanup as () => void);
  },
}));
vi.mock("@react-three/fiber", () => ({
  useThree: () => ({
    gl: { domElement: { dataset: state.dataset } },
    invalidate: vi.fn(),
  }),
  useFrame: (callback: typeof state.frame) => {
    state.frame = callback;
  },
}));
vi.mock("../src/code-world-texture.js", () => ({
  useCodeTexture: () => new Texture(),
}));
import { AvatarMaterialization } from "../src/avatar-materialization.js";
afterEach(() => {
  state.cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.useRealTimers();
});

for (const reducedMotion of [false, true]) {
  it(`waits one second, assembles without remount, and releases materials/timers (reduce=${reducedMotion})`, () => {
    vi.useFakeTimers();
    state.dataset = {};
    const element = AvatarMaterialization({
      ready: true,
      reducedMotion,
      children: null,
    });
    const actors = new Group();
    const original = new MeshStandardMaterial();
    const mesh = new Mesh(new BoxGeometry(1, 2, 1), original);
    mesh.castShadow = true;
    const spriteMaterial = new SpriteMaterial();
    const sprite = new Sprite(spriteMaterial);
    actors.add(mesh, sprite);
    element.props.ref.current = actors;
    for (let i = 0; i < 9; i++) state.frame({}, 0.1);
    expect(actors.visible).toBe(false);
    expect(state.dataset.avatarArrival).toBe("waiting");
    state.frame({}, 0.1);
    state.frame({}, 0.1);
    expect(actors.visible).toBe(true);
    if (!reducedMotion) {
      expect(mesh.material).not.toBe(original);
      expect(sprite.material).not.toBe(spriteMaterial);
      expect(mesh.castShadow).toBe(false);
      expect(state.dataset.avatarArrival).toBe("materializing");
    }
    for (let i = 0; i < 30; i++) state.frame({}, 0.1);
    expect(state.dataset.avatarArrival).toBe("complete");
    expect(mesh.material).toBe(original);
    expect(sprite.material).toBe(spriteMaterial);
    expect(mesh.castShadow).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(actors.children[0]).toBe(mesh);
  });
}
it("keeps bodies hidden while the environment or any avatar is not ready", () => {
  const element = AvatarMaterialization({
    ready: false,
    reducedMotion: false,
    children: null,
  });
  const actors = new Group();
  element.props.ref.current = actors;
  for (let i = 0; i < 80; i++) state.frame({}, 0.1);
  expect(actors.visible).toBe(false);
  expect(state.dataset.avatarArrival).toBe("loading");
});
