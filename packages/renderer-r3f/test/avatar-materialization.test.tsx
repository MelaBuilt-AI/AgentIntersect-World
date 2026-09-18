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
  initTexture: vi.fn(),
  compileAsync: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useContext: () => undefined,
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
    gl: {
      domElement: { dataset: state.dataset },
      initTexture: state.initTexture,
      compileAsync: state.compileAsync,
    },
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
  state.compileAsync.mockReset().mockResolvedValue(undefined);
  state.initTexture.mockClear();
});

it("prepares actor and rain GPU resources before starting the visible arrival delay", async () => {
  let finish!: () => void;
  const compiled = new Promise<void>((resolve) => {
    finish = resolve;
  });
  state.compileAsync.mockReturnValue(compiled);
  const onPrepared = vi.fn();
  const element = AvatarMaterialization({
    ready: true,
    reducedMotion: false,
    children: null,
    onPrepared,
  });
  const actors = new Group();
  const material = new MeshStandardMaterial({ map: new Texture() });
  actors.add(new Mesh(new BoxGeometry(1, 2, 1), material));
  element.props.ref.current = actors;
  state.frame({}, 0.1);
  expect(state.initTexture).toHaveBeenCalledWith(material.map);
  expect(state.compileAsync).toHaveBeenCalled();
  for (let i = 0; i < 20; i++) state.frame({}, 0.1);
  expect(actors.visible).toBe(false);
  expect(onPrepared).not.toHaveBeenCalled();
  finish();
  await vi.waitFor(() => expect(onPrepared).toHaveBeenCalledOnce());
  for (let i = 0; i < 9; i++) state.frame({}, 0.1);
  expect(actors.visible).toBe(false);
  state.frame({}, 0.1);
  state.frame({}, 0.1);
  expect(state.dataset.avatarArrival).toBe("materializing");
});

it("does not reveal an unmounted World when GPU preparation completes late", async () => {
  let finish!: () => void;
  state.compileAsync.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const onPrepared = vi.fn();
  const element = AvatarMaterialization({
    ready: true,
    reducedMotion: false,
    children: null,
    onPrepared,
  });
  const actors = new Group();
  const original = new MeshStandardMaterial();
  const mesh = new Mesh(new BoxGeometry(1, 2, 1), original);
  actors.add(mesh);
  element.props.ref.current = actors;
  state.frame({}, 0);
  expect(mesh.material).not.toBe(original);
  state.cleanups.splice(0).forEach((cleanup) => cleanup());
  expect(mesh.material).toBe(original);
  finish();
  await Promise.resolve();
  await Promise.resolve();
  expect(onPrepared).not.toHaveBeenCalled();
});

for (const reducedMotion of [false, true]) {
  it(`waits one second, assembles without remount, and releases materials/timers (reduce=${reducedMotion})`, async () => {
    vi.useFakeTimers();
    state.dataset = {};
    const onMaterializationStart = vi.fn();
    const onComplete = vi.fn();
    const element = AvatarMaterialization({
      onComplete,
      onMaterializationStart,
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
    state.frame({}, 0);
    await Promise.resolve();
    await Promise.resolve();
    for (let i = 0; i < 9; i++) state.frame({}, 0.1);
    expect(actors.visible).toBe(false);
    expect(state.dataset.avatarArrival).toBe("waiting");
    expect(onMaterializationStart).not.toHaveBeenCalled();
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
    expect(onMaterializationStart).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
    expect(mesh.material).toBe(original);
    expect(sprite.material).toBe(spriteMaterial);
    expect(mesh.castShadow).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(actors.children[0]).toBe(mesh);
  });
}
it("prepares city objects behind the loading barrier, then reports completion once without overwriting avatar telemetry", async () => {
  state.dataset = { avatarArrival: "complete" };
  const onPrepared = vi.fn();
  const onComplete = vi.fn();
  const onMaterializationStart = vi.fn();
  const props = {
    ready: true,
    revealReady: false,
    telemetryPrefix: "city" as const,
    onPrepared,
    onComplete,
    onMaterializationStart,
    reducedMotion: false,
    children: null,
  };
  const element = AvatarMaterialization(props);
  const objects = new Group();
  objects.add(new Mesh(new BoxGeometry(1, 2, 1), new MeshStandardMaterial()));
  element.props.ref.current = objects;
  state.frame({}, 0);
  await Promise.resolve();
  await Promise.resolve();
  for (let i = 0; i < 60; i++) state.frame({}, 0.1);
  expect(onPrepared).toHaveBeenCalledOnce();
  expect(onMaterializationStart).not.toHaveBeenCalled();
  expect(onComplete).not.toHaveBeenCalled();
  expect(objects.visible).toBe(false);
  expect(state.dataset.avatarArrival).toBe("complete");
});

it("leaves initial actors to the shared entrance when individual arrival is disabled", () => {
  state.initTexture.mockClear();
  const element = AvatarMaterialization({
    ready: true,
    enabled: false,
    reducedMotion: false,
    children: null,
  });
  const actors = new Group();
  actors.visible = element.props.visible;
  element.props.ref.current = actors;
  for (let i = 0; i < 60; i++) state.frame({}, 0.1);
  expect(actors.visible).toBe(true);
  expect(state.initTexture).not.toHaveBeenCalled();
});

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
