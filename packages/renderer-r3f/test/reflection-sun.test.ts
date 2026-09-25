import { afterEach, expect, it, vi } from "vitest";
import { Scene, PerspectiveCamera } from "three";
import { reflector } from "three/tsl";
import { createWorldSun } from "../src/world-renderer.js";
import { createWetFloor } from "../src/world-postprocessing.js";

afterEach(() => vi.restoreAllMocks());

it("keeps reflected SunLight shadow state separate from the main view", () => {
  const probe = reflector();
  const scene = new Scene();
  const sun = createWorldSun("#e2f5ff", 2.1, [12, 18, 8]);
  scene.add(sun);
  const nestedSuns: (typeof sun)[] = [];
  vi.spyOn(
    Object.getPrototypeOf(probe.reflector),
    "updateBefore",
  ).mockImplementation(() => {
    scene.traverseVisible((object) => {
      if (object.type === "SunLight") nestedSuns.push(object);
    });
  });
  const floor = createWetFloor(68, 0.5);
  let reflection: typeof probe | undefined;
  floor.mesh.material.colorNode.traverse((node: typeof probe) => {
    if (node.isTextureNode && node.reflector) reflection = node;
  });
  expect(reflection).toBeDefined();
  const frame = { scene, camera: new PerspectiveCamera() };
  reflection!.reflector.updateBefore(frame);
  reflection!.reflector.updateBefore(frame);
  expect(nestedSuns).toHaveLength(2);
  expect(nestedSuns[0]).not.toBe(sun);
  expect(nestedSuns[0]).toBe(nestedSuns[1]);
  expect(nestedSuns[0]!.shadow).not.toBe(sun.shadow);
  expect(nestedSuns[0]!.shadow.mapSize.toArray()).toEqual([1024, 1024]);
  expect(nestedSuns[0]!.position.toArray()).toEqual(sun.position.toArray());
  expect(sun.visible).toBe(true);
  expect(nestedSuns[0]!.visible).toBe(false);
  floor.dispose();
  expect(nestedSuns[0]!.parent).toBeNull();
  sun.dispose();
  probe.dispose();
});
