import { expect, it, vi } from "vitest";
import { Texture } from "three";
import { cityLaunchFrame } from "../src/city-arrival-timing.js";
const state = vi.hoisted(() => ({
  frame: (() => {}) as (frame: unknown) => void,
  uniforms: {} as Record<string, { value: unknown }>,
}));
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useContext: (context: { _currentValue: unknown }) => context._currentValue,
  useMemo: (factory: () => unknown) => factory(),
  useEffect: () => {},
  useRef: (current: unknown) => ({ current }),
}));
vi.mock("@react-three/fiber", async () => ({
  ...(await vi.importActual("@react-three/fiber")),
  useFrame: (callback: typeof state.frame) => {
    state.frame = callback;
  },
}));
vi.mock("../src/world-node-materials.js", async () => {
  const actual = await vi.importActual<
    typeof import("../src/world-node-materials.js")
  >("../src/world-node-materials.js");
  return {
    ...actual,
    terminalRainMaterial: (
      uniforms: Record<string, { value: unknown }>,
      props: object,
    ) => {
      state.uniforms = uniforms;
      return actual.terminalRainMaterial(uniforms, props);
    },
  };
});
import {
  RepositoryTerminalRain,
  cityRainTop,
} from "../src/repository-terminal-rain.js";

it("updates the node-bound uniforms for motion, sky reach and highlights", () => {
  const clock = { value: 0 };
  const highlight = {
    current: [{ index: 0, color: 1, progress: 0.5, strength: 1 }],
  };
  let completed = 0;
  const phases: string[] = [];
  const element = RepositoryTerminalRain({
    onStreamPhase: (phase) => phases.push(phase),
    onLaunchComplete: () => {
      completed += 1;
    },
    texture: new Texture(),
    x: 3,
    z: 4,
    roof: 2,
    index: 0,
    clock,
    highlight,
  });
  const material = { uniforms: state.uniforms };
  expect(element.props.children[1].props.object.isNodeMaterial).toBe(true);
  const camera = { position: { x: 7, y: 8, z: 18 } };
  state.frame({ camera });
  expect(phases).toEqual([]);
  clock.value = 0.1;
  state.frame({ camera });
  state.frame({ camera });
  expect(phases).toEqual(["up"]);
  clock.value = 3;
  state.frame({ camera });
  expect(phases).toEqual(["up"]); // Still moving upward during deceleration.
  clock.value = 4;
  state.frame({ camera });
  state.frame({ camera });
  expect(phases).toEqual(["up", "in"]);
  clock.value = 6;
  state.frame({ camera });
  expect(material.uniforms.rainTime!.value).toBe(
    cityLaunchFrame(6, false).offset,
  );
  expect(material.uniforms.rainHeight!.value).toBe(
    cityRainTop(3, 4, camera.position) - 2,
  );
  expect(material.uniforms.rainStrength!.value).toBe(1);
  highlight.current = [];
  state.frame({ camera });
  expect(material.uniforms.rainStrength!.value).toBe(0);
  expect(completed).toBe(1);
  expect(material.uniforms.rainTime!.value).toBe(
    cityLaunchFrame(6, false).offset,
  );
  expect(element.props.raycast()).toBeUndefined();
});

it("prepares hidden rain without consuming launch timing or playing premature cues", () => {
  const cue = vi.fn();
  const done = vi.fn();
  const clock = { value: 10 };
  RepositoryTerminalRain({
    active: false,
    texture: new Texture(),
    x: 0,
    z: 0,
    roof: 2,
    index: 0,
    clock,
    highlight: { current: [] },
    onStreamPhase: cue,
    onLaunchComplete: done,
  });
  const initial = state.uniforms.rainTime!.value;
  for (let i = 0; i < 5; i++) {
    clock.value++;
    state.frame({ camera: { position: { x: 0, y: 3, z: 10 } } });
  }
  expect(cue).not.toHaveBeenCalled();
  expect(done).not.toHaveBeenCalled();
  expect(state.uniforms.rainTime!.value).toBe(initial);
});

it("does not announce a launch skipped by Reduced Motion", () => {
  const phases: string[] = [];
  const clock = { value: 0 };
  const element = RepositoryTerminalRain({
    texture: new Texture(),
    x: 0,
    z: 0,
    roof: 2,
    index: 0,
    clock,
    highlight: { current: [] },
    reducedMotion: true,
    onStreamPhase: (phase) => phases.push(phase),
  });
  expect(element.props.children[1].props.object.isNodeMaterial).toBe(true);
  state.frame({ camera: { position: { x: 0, y: 3, z: 10 } } });
  clock.value = 5;
  state.frame({ camera: { position: { x: 0, y: 3, z: 10 } } });
  expect(phases).toEqual([]);
});
