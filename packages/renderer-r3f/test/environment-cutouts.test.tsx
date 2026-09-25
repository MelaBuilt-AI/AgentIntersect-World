import { expect, it, vi } from "vitest";
import { Texture, DoubleSide } from "three";
import { ENVIRONMENT_PRESETS } from "@agentintersect-world/world-schema/environment";
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useMemo: (f: () => unknown) => f(),
  useRef: (value: unknown) => ({ current: value }),
  useEffect: () => {},
}));
vi.mock("@react-three/fiber", () => ({ useFrame: vi.fn() }));

it("casts alpha-silhouette shadows from both light-facing sides of generated cutouts", async () => {
  const { EnvironmentCutouts } = await import("../src/environment-cutouts.js");
  const map = new Texture();
  const element = EnvironmentCutouts({
    size: 68,
    resources: {
      recipe: {
        ...ENVIRONMENT_PRESETS[1]!.recipe!,
        props: [{ asset: "prop_basalt_boulder", count: 1, size: 3 }],
      },
      textures: { prop_basalt_boulder: map },
      dispose: vi.fn(),
    },
  });
  expect(element.props.children[1]?.[0]?.props.name).toBe(
    "environment-prop-contact-0",
  );
  const mesh = element.props.children[0][0];
  expect(element.props.children[1][0].props.position[1]).toBeCloseTo(0.018);
  expect(mesh.props.castShadow).toBe(true);
  const material = mesh.props.children[1];
  expect(material.props.map).toBe(map);
  expect(material.props.alphaTest).toBe(0.1);
  expect(material.props.shadowSide).toBe(DoubleSide);
  // The rock's opaque bottom, not the square artwork edge, meets the floor.
  expect(mesh.props.position[1]).toBeCloseTo(3 * (950 / 1024 - 0.5 - 0.02));
});
