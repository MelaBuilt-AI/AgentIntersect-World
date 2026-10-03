import { afterEach, expect, it, vi } from "vitest";
import {
  Scene,
  PerspectiveCamera,
  Mesh,
  BoxGeometry,
  MeshBasicMaterial,
} from "three";
import { reflector } from "three/tsl";
import { createWorldSun } from "../src/world-renderer.js";
import {
  createWetFloor,
  compileWorldReflections,
} from "../src/world-postprocessing.js";

afterEach(() => vi.restoreAllMocks());

it("precompiles replacement reflection variants with the real mirror target and lights before returning readiness", async () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const sun = createWorldSun("#ffffff", 2, [12, 18, 8]);
  const floor = createWetFloor(68, 0.5);
  const part = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  part.visible = false;
  scene.add(sun, floor.mesh, part);
  let target: unknown = null;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const get = vi.fn();
  const gl = {
    info: { calls: 0 },
    _renderContexts: { get },
    getRenderTarget: () => target,
    setRenderTarget: (next: unknown) => {
      target = next;
    },
    compileAsync: vi.fn((object, view, root) => {
      expect(object).toBe(part);
      expect(view).not.toBe(camera);
      expect(root).toBe(scene);
      expect(part.visible).toBe(true);
      expect(sun.visible).toBe(false);
      expect(
        scene.children.find((x) => x.name === "world-reflection-sunlight")
          ?.visible,
      ).toBe(true);
      expect(target).toMatchObject({ samples: 0 });
      gl._renderContexts.get(target, null);
      return pending;
    }),
  };
  let ready = false;
  const compilation = compileWorldReflections(gl, scene, camera, [part]).then(
    () => {
      ready = true;
    },
  );
  expect(gl.compileAsync).toHaveBeenCalledOnce();
  expect(get.mock.calls[0]?.[2]).toBe(2);
  expect(gl._renderContexts.get).toBe(get);
  expect(target).toBeNull();
  expect(part.visible).toBe(false);
  expect(sun.visible).toBe(true);
  expect(
    scene.children.find((x) => x.name === "world-reflection-sunlight")?.visible,
  ).toBe(false);
  await Promise.resolve();
  expect(ready).toBe(false);
  finish();
  await compilation;
  expect(ready).toBe(true);
  floor.mesh.visible = false;
  gl.compileAsync.mockClear();
  await compileWorldReflections(gl, scene, camera, [part]);
  expect(gl.compileAsync).not.toHaveBeenCalled();
  floor.dispose();
  sun.dispose();
  part.geometry.dispose();
  part.material.dispose();
});

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
