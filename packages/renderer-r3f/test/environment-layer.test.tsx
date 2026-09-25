import { expect, it, vi } from "vitest";
import { Children, isValidElement } from "react";
import { Texture } from "three";
import { ENVIRONMENT_PRESETS } from "@agentintersect-world/world-schema/environment";
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useContext: (context: { _currentValue: unknown }) => context._currentValue,
  useEffect: () => {},
  useState: () => [null, () => {}],
}));
vi.mock("@react-three/fiber", () => ({
  useThree: () => ({ gl: { initTexture: vi.fn() } }),
}));
vi.mock("../src/code-world-texture.js", () => ({ useCodeTexture: () => null }));

it("retains Original and one compositor at stable positions while scenic environments switch", async () => {
  const api = await import("../src/environment-layer.js").catch(() => null);
  expect(api, "persistent environment layer").not.toBeNull();
  if (!api) return;
  const props = {
    floor: "blank" as const,
    size: 68,
    reducedMotion: false,
    userPosition: { x: 0, z: 0 },
  };
  const recipe = ENVIRONMENT_PRESETS[1]!.recipe!;
  const bundle = {
    recipe,
    textures: { [recipe.ground.asset]: new Texture() },
    dispose() {},
  };
  const initial = api.EnvironmentLayer({ ...props, resources: null });
  const custom = api.EnvironmentLayer({ ...props, resources: bundle });
  const a = Children.toArray(initial.props.children).filter(isValidElement);
  const b = Children.toArray(custom.props.children).filter(isValidElement);
  expect(a[0]!.type).toBe(b[0]!.type);
  expect(a[0]!.key).toBe(b[0]!.key);
  expect(a[1]!.type).toBe(b[1]!.type);
  expect(a[1]!.key).toBe(b[1]!.key);
  expect(a[1]!.props).toMatchObject({ active: true, postprocessing: false });
  expect(b[1]!.props).toMatchObject({ active: false, postprocessing: false });
  expect(b[2]!.props).toMatchObject({ active: true, resources: bundle });
  expect(a[1]!.props).toMatchObject({ lighting: false });
  expect(b[1]!.props).toMatchObject({ lighting: false });
  expect(a.at(-1)!.type).toBe(b.at(-1)!.type);
  expect(a.at(-1)!.props).toMatchObject({ recipe: null });
  expect(b.at(-1)!.props).toMatchObject({ recipe });
});
