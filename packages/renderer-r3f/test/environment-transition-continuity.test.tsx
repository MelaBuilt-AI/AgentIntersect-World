import { expect, it, vi } from "vitest";
import { Scene, Group, Mesh, Texture, GridHelper } from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
const hooks = vi.hoisted(() => ({
  index: 0,
  slots: [] as { deps: unknown[]; value: unknown; cleanup?: () => void }[],
}));
vi.mock("react", async () => {
  const memo = (factory: () => unknown, deps: unknown[]) => {
    const index = hooks.index++,
      old = hooks.slots[index];
    if (!old || deps.some((dep, i) => dep !== old.deps[i]))
      hooks.slots[index] = { deps, value: factory() };
    return hooks.slots[index]!.value;
  };
  return {
    ...(await vi.importActual("react")),
    useMemo: memo,
    useCallback: (fn: unknown, deps: unknown[]) => memo(() => fn, deps),
    useRef: (value: unknown) => memo(() => ({ current: value }), []),
    useEffect: (fn: () => (() => void) | undefined, deps: unknown[]) => {
      const index = hooks.index++,
        old = hooks.slots[index];
      if (!old || deps.some((dep, i) => dep !== old.deps[i])) {
        old?.cleanup?.();
        hooks.slots[index] = { deps, value: null, cleanup: fn() };
      }
    },
  };
});
const runtime = vi.hoisted(() => ({
  state: {} as unknown,
  texture: null as unknown,
  frame: (() => {}) as (state: unknown, delta: number) => void,
}));
vi.mock("@react-three/fiber", () => ({
  useThree: () => runtime.state,
  useFrame: (fn: typeof runtime.frame) => {
    runtime.frame = fn;
  },
}));
vi.mock("../src/code-world-texture.js", () => ({
  useCodeTexture: () => runtime.texture,
}));
import { EnvironmentTransition } from "../src/environment-transition.js";
it("does not rebuild Original interference nodes when a scenic generation changes", () => {
  const scene = new Scene(),
    original = new Group();
  original.name = "world-code-environment";
  const material = new MeshBasicNodeMaterial();
  original.add(new Mesh(undefined, material));
  scene.add(original);
  const grid = new GridHelper(68, 17);
  grid.name = "world-floor-grid";
  scene.add(grid);
  runtime.state = {
    scene,
    gl: { library: { fromMaterial: (m: unknown) => m } },
  };
  runtime.texture = new Texture();
  EnvironmentTransition({
    phase: "idle",
    reducedMotion: false,
    generation: null,
  });
  const output = material.outputNode;
  expect(output).not.toBeNull();
  hooks.index = 0;
  EnvironmentTransition({ phase: "in", reducedMotion: false, generation: {} });
  expect(material.outputNode).toBe(output);
  hooks.index = 0;
  EnvironmentTransition({
    phase: "out",
    reducedMotion: false,
    generation: null,
  });
  for (let i = 0; i < 4; i++) runtime.frame({}, 0.1);
  for (const line of Array.isArray(grid.material)
    ? grid.material
    : [grid.material])
    expect(line.opacity).toBe(0);
  hooks.slots.forEach((slot) => slot.cleanup?.());
  material.dispose();
});
