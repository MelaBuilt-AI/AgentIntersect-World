import { expect, it, vi } from "vitest";
import { ShaderMaterial, Texture } from "three";
const state = vi.hoisted(() => ({
  frame: (() => {}) as (frame: unknown) => void,
}));
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
}));
vi.mock("@react-three/fiber", async () => ({
  ...(await vi.importActual("@react-three/fiber")),
  useFrame: (callback: typeof state.frame) => {
    state.frame = callback;
  },
}));
import {
  RepositoryTerminalRain,
  cityRainTop,
} from "../src/repository-terminal-rain.js";

it("updates the actual R3F-owned uniforms for motion, sky reach and highlights", () => {
  const clock = { value: 0 };
  const highlight = {
    current: { index: 0, color: 1, progress: 0.5, strength: 1 },
  };
  const element = RepositoryTerminalRain({
    texture: new Texture(),
    x: 3,
    z: 4,
    roof: 2,
    index: 0,
    clock,
    highlight,
  });
  const shader = element.props.children[1];
  const material = new ShaderMaterial();
  // Match the browser R3F 9.6 descriptor-copy boundary. Node ESM/CJS Three
  // constructors differ under Vitest, so applyProps' instanceof is not faithful here.
  material.uniforms = Object.fromEntries(
    Object.entries(
      shader.props.uniforms as Record<string, { value: unknown }>,
    ).map(([name, uniform]) => [name, { ...uniform }]),
  );
  shader.props.ref.current = material;
  expect(material.uniforms.rainTime).not.toBe(shader.props.uniforms.rainTime);
  clock.value = 6;
  const camera = { position: { x: 7, y: 8, z: 18 } };
  state.frame({ camera });
  expect(material.uniforms.rainTime!.value).toBe(6);
  expect(material.uniforms.rainHeight!.value).toBe(
    cityRainTop(3, 4, camera.position) - 2,
  );
  expect(material.uniforms.rainStrength!.value).toBe(1);
  highlight.current = { ...highlight.current, index: -1, strength: 0 };
  state.frame({ camera });
  expect(material.uniforms.rainStrength!.value).toBe(0);
  expect(material.uniforms.rainTime!.value).toBe(6);
  expect(element.props.raycast()).toBeUndefined();
});
