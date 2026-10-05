import { expect, it, vi } from "vitest";
import { Box3 } from "three";

const hooks = vi.hoisted(() => ({
  memo: undefined as { deps: unknown[]; value: unknown } | undefined,
  cleanups: [] as (() => void)[],
  invalidate: vi.fn(),
  gl: { domElement: { dataset: {} }, getPixelRatio: () => 1 },
}));
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useMemo: (factory: () => unknown, deps: unknown[]) => {
    if (!hooks.memo || deps.some((v, i) => v !== hooks.memo!.deps[i]))
      hooks.memo = { deps, value: factory() };
    return hooks.memo.value;
  },
  useEffect: (effect: () => (() => void) | void) => {
    const cleanup = effect();
    if (cleanup) hooks.cleanups.push(cleanup);
  },
  useLayoutEffect: (effect: () => void) => effect(),
}));
vi.mock("@react-three/fiber", () => ({
  useThree: () => ({
    gl: hooks.gl,
    size: { width: 1912, height: 948 },
    invalidate: hooks.invalidate,
  }),
  useFrame: vi.fn(),
}));
import { WorldWetFloor } from "../src/world-atmosphere-effects.js";

it("grows the walking floor without replacing warmed reflection resources", () => {
  const initial = WorldWetFloor({ size: 256 }).props.object;
  const geometry = initial.geometry;
  const material = initial.material;
  try {
    // The recorded walking run repeatedly expanded the floor at this boundary.
    for (const size of [260, 272, 276, 280, 284, 288, 292, 296, 300, 332]) {
      const mesh = WorldWetFloor({ size }).props.object;
      expect(mesh).toBe(initial);
      expect(mesh.geometry).toBe(geometry);
      expect(mesh.material).toBe(material);
      mesh.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(mesh);
      expect(bounds.max.x - bounds.min.x).toBeCloseTo(size);
      expect(bounds.max.z - bounds.min.z).toBeCloseTo(size);
      expect(mesh.position.y).toBe(0.012);
    }
  } finally {
    for (const cleanup of new Set(hooks.cleanups)) cleanup();
  }
});
