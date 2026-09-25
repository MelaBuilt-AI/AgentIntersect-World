import { afterEach, expect, it, vi } from "vitest";
import { Texture } from "three";
const state = vi.hoisted(() => ({
  slots: [] as { deps: unknown[]; value: unknown }[],
  index: 0,
  cleanups: [] as (() => void)[],
}));
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useMemo: (fn: () => unknown, deps: unknown[]) => {
    const index = state.index++;
    const old = state.slots[index];
    if (!old || deps.some((dep, i) => dep !== old.deps[i]))
      state.slots[index] = { deps, value: fn() };
    return state.slots[index]!.value;
  },
  useLayoutEffect: (fn: () => void) => fn(),
  useEffect: (fn: () => () => void) => {
    state.cleanups.push(fn());
  },
}));
import {
  CodeFloorMaterial,
  CodeSkyMaterial,
} from "../src/environment-node-materials.js";
import { rewriteMaterial } from "../src/world-node-materials.js";
afterEach(() => {
  state.cleanups.splice(0).forEach((fn) => fn());
  state.slots = [];
  state.index = 0;
});

it("keeps the drawn floor and React material identical when the transition wins the texture load race", () => {
  const material = CodeFloorMaterial({ map: null }).props.object;
  const undo = rewriteMaterial(material, {
    time: { value: 0 },
    strength: { value: 0 },
    code: { value: new Texture() },
  });
  const texture = new Texture();
  state.index = 0;
  const loaded = CodeFloorMaterial({ map: texture }).props.object;
  expect(loaded).toBe(material);
  expect(material.map).toBe(texture);
  expect(material.emissiveMap).toBe(texture);
  expect(material.outputNode).not.toBeNull();
  undo();
  expect(material.map).toBe(texture);
});

it("retains the loaded sky node and owner through transition cleanup after a delayed sky texture", () => {
  const clock = { value: 0 };
  const props = { map: null, clock, layer: 1, opacity: 0.8 };
  const material = CodeSkyMaterial(props).props.object;
  const undo = rewriteMaterial(material, {
    time: { value: 0 },
    strength: { value: 0 },
    code: { value: new Texture() },
  });
  state.index = 0;
  const loaded = CodeSkyMaterial({ ...props, map: new Texture() }).props.object;
  expect(loaded).toBe(material);
  expect(material.colorNode).not.toBeNull();
  const color = material.colorNode;
  undo();
  expect(material.colorNode).toBe(color);
});
