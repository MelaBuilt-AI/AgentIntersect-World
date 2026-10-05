import { expect, it, vi } from "vitest";
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
} from "three";
import type { Vector2, WebGLRenderer, WebGLRenderTarget } from "three";
import { createRepositoryFogDepth } from "../src/repository-fog-depth.js";

it("reuses the fog visitor without allocating singleton material lists per object", () => {
  const scene = new Scene(),
    camera = new PerspectiveCamera();
  const material = new MeshStandardMaterial();
  const mesh = new Mesh(undefined, material);
  const light = Object.assign(new Group(), { isLight: true });
  scene.add(mesh, light);
  const depth = createRepositoryFogDepth();
  const traverse = vi.spyOn(scene, "traverse");
  const every = Array.prototype.every;
  let wrappers = 0;
  const spy = vi.spyOn(Array.prototype, "every").mockImplementation(function (
    this: unknown[],
    callback,
    thisArg,
  ) {
    if (this.length === 1 && this[0] === material) wrappers++;
    return every.call(this, callback, thisArg);
  });
  let target: WebGLRenderTarget | null = null;
  const gl = {
    autoClear: false,
    shadowMap: { autoUpdate: true },
    getDrawingBufferSize: (size: Vector2) => size.set(800, 600),
    getRenderTarget: () => target,
    setRenderTarget: (next: WebGLRenderTarget | null) => {
      target = next;
    },
    render: vi.fn(() => {
      expect(mesh.material).not.toBe(material);
      expect(light.visible).toBe(false);
    }),
  };
  try {
    for (let i = 0; i < 3; i++) {
      depth.beginFrame();
      depth.capture(gl as unknown as WebGLRenderer, scene, camera);
      expect(mesh.material).toBe(material);
      expect(light.visible).toBe(true);
      expect(target).toBeNull();
    }
    expect(
      wrappers,
      "single materials must not be wrapped in per-node arrays",
    ).toBe(0);
    expect(new Set(traverse.mock.calls.map(([visitor]) => visitor)).size).toBe(
      1,
    );
  } finally {
    spy.mockRestore();
    traverse.mockRestore();
    depth.dispose();
    material.dispose();
    mesh.geometry.dispose();
  }
});
