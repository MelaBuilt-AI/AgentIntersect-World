import { expect, it, vi } from "vitest";
import { Group, Mesh, Texture } from "three";
import {
  ENVIRONMENT_FX,
  ENVIRONMENT_PRESETS,
} from "@agentintersect-world/world-schema/environment";
const runtime = vi.hoisted(() => ({
  frames: [] as ((state: unknown, delta: number) => void)[],
}));
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useMemo: (f: () => unknown) => f(),
  useRef: (current: unknown) => ({ current }),
  useEffect: () => {},
}));
vi.mock("@react-three/fiber", () => ({
  useFrame: (f: (state: unknown, delta: number) => void) =>
    runtime.frames.push(f),
}));
import { EnvironmentWeatherEffects } from "../src/environment-weather.js";

it("advances the actual atlas sampling matrix even when the local strike mesh is hidden", () => {
  runtime.frames.length = 0;
  const textures = Object.fromEntries(
    Object.keys(ENVIRONMENT_FX).map((id) => [id, new Texture()]),
  );
  const props = {
    resources: {
      recipe: {
        ...ENVIRONMENT_PRESETS[1]!.recipe!,
        weather: {
          particles: "none" as const,
          intensity: 1,
          wind: 0,
          lightning: "distant" as const,
          lightningInterval: 8,
          horizonLightning: { density: 1, interval: 2, elevation: 2 },
          flashes: true,
        },
      },
      textures,
      dispose: vi.fn(),
    },
    size: 68,
    userPosition: { x: 0, z: 0 },
    reducedMotion: false,
  };
  const outer = EnvironmentWeatherEffects(props)!;
  const element = (outer.type as (props: unknown) => unknown)(outer.props);
  const named = new Map<string, Group>();
  const mount = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(mount);
      return;
    }
    if (!node || typeof node !== "object" || !("props" in node)) return;
    const el = node as {
      type: string;
      props: {
        name?: string;
        ref?: ((v: unknown) => void) | { current: unknown };
        children?: unknown;
      };
    };
    const object = el.type === "mesh" ? new Mesh() : new Group();
    if (el.props.name === "sky-fx_lightning_strike") {
      const material = (
        el.props.children as { props: { object?: { colorNode?: unknown } } }[]
      )[1]!;
      expect(
        material.props.object?.colorNode,
        "stationary atlas must own a live node update, not texture-version-only refresh",
      ).toBeTruthy();
    }
    if (el.props.name) named.set(el.props.name, object);
    if (typeof el.props.ref === "function") el.props.ref(object);
    else if (el.props.ref) el.props.ref.current = object;
    mount(el.props.children);
  };
  mount(element);
  const state = {
    camera: new Group(),
    size: { height: 900 },
    gl: { getPixelRatio: () => 1 },
  };
  for (let i = 0; i < 37; i++) runtime.frames.forEach((f) => f(state, 0.1));
  expect(named.get("weather-strike")!.visible).toBe(false);
  expect(named.get("weather-sky-lightning")!.visible).toBe(true);
  const texture = textures.fx_lightning_strike!;
  expect(texture.matrix.elements[6]).toBeCloseTo(texture.offset.x);
  expect(texture.matrix.elements[7]).toBeCloseTo(texture.offset.y);
  expect(texture.matrix.elements[0]).toBeCloseTo(texture.repeat.x);
  expect(
    EnvironmentWeatherEffects({ ...props, reducedMotion: true }),
  ).toBeNull();
});
