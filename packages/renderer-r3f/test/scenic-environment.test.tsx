import { expect, it, vi } from "vitest";
import { ENVIRONMENT_PRESETS } from "@agentintersect-world/world-schema/environment";
import { Texture } from "three";
const runtime = vi.hoisted(() => ({
  frames: [] as ((state: unknown, delta: number) => void)[],
}));
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useContext: (context: { _currentValue: unknown }) => context._currentValue,
  useMemo: (f: () => unknown) => f(),
  useRef: (value: unknown) => ({ current: value }),
  useEffect: (f: () => unknown) => {
    f();
  },
}));
vi.mock("@react-three/fiber", () => ({
  useThree: () => ({
    scene: { fog: null },
    invalidate: vi.fn(),
    gl: { domElement: { dataset: {} } },
  }),
  useFrame: (f: (state: unknown, delta: number) => void) =>
    runtime.frames.push(f),
}));
it("renders separate floor, background, middle and foreground with a sunlit lighting rig", async () => {
  const module = await import("../src/scenic-environment.js").catch(() => null);
  expect(module, "Scenic environment must exist").not.toBeNull();
  const recipe = ENVIRONMENT_PRESETS[1]!.recipe!;
  const textures = Object.fromEntries(
    [recipe.ground.asset, ...Object.values(recipe.sky).map((l) => l.asset)].map(
      (id) => [id, new Texture()],
    ),
  );
  const element = module!.ScenicEnvironment({
    resources: { recipe, textures, dispose: vi.fn() },
    size: 68,
    reducedMotion: false,
    userPosition: { x: 0, z: 0 },
  });
  const nodes: { type: unknown; props: Record<string, unknown> }[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if ("props" in node) {
      const el = node as (typeof nodes)[number];
      nodes.push(el);
      visit(el.props.children);
    }
  };
  visit(element);
  for (const name of [
    "environment-ground",
    "environment-background",
    "environment-middle",
    "environment-foreground",
    "environment-sun",
  ])
    expect(nodes.some((n) => n.props.name === name)).toBe(true);
  expect(nodes.some((n) => n.type === "hemisphereLight")).toBe(true);
  expect(nodes.find((n) => n.type === "hemisphereLight")!.props.args).toEqual([
    recipe.lighting.sky,
    recipe.lighting.ground,
    recipe.lighting.ambient * 1.5,
  ]);
  expect(textures[recipe.ground.asset]!.repeat.x).toBeCloseTo(68 / 24);
});
