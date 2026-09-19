import { expect, it, vi } from "vitest";
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  type WebGLRenderer,
} from "three";

const frames = vi.hoisted(() => [] as (() => void)[]);
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useContext: (context: { _currentValue: unknown }) => context._currentValue,
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
}));
vi.mock("@react-three/fiber", () => ({
  useFrame: (callback: () => void) => frames.push(callback),
}));
import { RepositoryLocalAtmosphere } from "../src/repository-local-atmosphere.js";
import { createRepositoryFogDepth } from "../src/repository-fog-depth.js";

it("uses a continuous depth-clipped volume rather than intersecting horizontal fog sheets", () => {
  const clock = { value: 0 };
  const element = RepositoryLocalAtmosphere({
    x: 0,
    z: 0,
    radius: 2,
    roof: 4,
    clock,
    settledAt: 0,
    reducedMotion: true,
  });

  const fog = element.props.children[0];
  const volume = typeof fog.type === "function" ? fog.type(fog.props) : fog;
  expect(volume.props.children[0].type).toBe("boxGeometry");
  const shader = volume.props.children[1].props;
  expect(shader.fragmentShader).toContain("sceneDepth");
  expect(shader.fragmentShader).toContain("exp(-opticalDepth)");
  expect(shader.depthWrite).toBe(false);
  expect(volume.props.raycast()).toBeUndefined();
  // Exercise the same descriptor-copy boundary as mounted R3F uniforms.
  const live = { uniforms: { time: { value: 0 } } };
  shader.ref.current = live;
  clock.value = 7;
  frames.at(-1)!();
  expect(live.uniforms.time.value).toBe(7);
  frames.at(-1)!();
  expect(live.uniforms.time.value).toBe(7);
});

it("shares one lazy capture per render, preserves scene state and releases the target", () => {
  const scene = new Scene();
  const atmosphere = new Group();
  atmosphere.name = "repository-local-atmosphere";
  const floor = new Mesh(undefined, new MeshStandardMaterial());
  const reflection = new Group();
  reflection.name = "world-wet-floor-reflection";
  const originalFloor = floor.material;
  const mask = new Mesh(undefined, new MeshStandardMaterial());
  (mask.material as MeshStandardMaterial).opacity = 0;
  const originalMask = mask.material;
  mask.name = "mask";
  const initiallyHidden = new Group();
  initiallyHidden.visible = false;
  scene.add(atmosphere, floor, reflection, mask, initiallyHidden);
  let bound: unknown = null;
  const renderer = {
    autoClear: false,
    shadowMap: { autoUpdate: true },
    info: { render: { frame: 1 } },
    getDrawingBufferSize: (size: { set: (w: number, h: number) => unknown }) =>
      size.set(800, 600),
    getRenderTarget: () => bound,
    setRenderTarget: (target: unknown) => {
      bound = target;
    },
    render: vi.fn(() => {
      expect(atmosphere.visible).toBe(false);
      expect(reflection.visible).toBe(false);
      expect(floor.visible).toBe(true);
      expect(floor.material).not.toBe(originalFloor);
      expect(mask.material).toBe(originalMask);
      expect(mask.visible).toBe(true);
      renderer.info.render.frame++;
    }),
  };
  const depth = createRepositoryFogDepth();
  expect(renderer.render).not.toHaveBeenCalled();
  const target = depth.capture(
    renderer as unknown as WebGLRenderer,
    scene,
    new PerspectiveCamera(),
  );
  expect(target.width).toBe(800);
  expect(target.height).toBe(600);
  expect(target.depthTexture).not.toBeNull();
  expect(
    depth.capture(
      renderer as unknown as WebGLRenderer,
      scene,
      new PerspectiveCamera(),
    ),
  ).toBe(target);
  expect(renderer.render).toHaveBeenCalledTimes(1);
  // A planar reflection advances Three's render counter inside this same
  // presentation frame. It must not make the next mist volume recapture.
  renderer.info.render.frame++;
  depth.capture(
    renderer as unknown as WebGLRenderer,
    scene,
    new PerspectiveCamera(),
  );
  expect(renderer.render).toHaveBeenCalledTimes(1);
  depth.beginFrame();
  depth.capture(
    renderer as unknown as WebGLRenderer,
    scene,
    new PerspectiveCamera(),
  );
  expect(renderer.render).toHaveBeenCalledTimes(2);
  expect(atmosphere.visible).toBe(true);
  expect(floor.material).toBe(originalFloor);
  expect(mask.material).toBe(originalMask);
  expect(reflection.visible).toBe(true);
  expect(initiallyHidden.visible).toBe(false);
  expect(bound).toBeNull();
  expect(renderer.autoClear).toBe(false);
  expect(renderer.shadowMap.autoUpdate).toBe(true);
  const dispose = vi.spyOn(target, "dispose");
  depth.dispose();
  expect(dispose).toHaveBeenCalledOnce();
});
