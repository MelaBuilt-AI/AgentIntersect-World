import { expect, it, vi } from "vitest";
import { Group, Scene, Mesh, Box3, Vector3, Sphere } from "three";
import {
  createWorldPreparation,
  prepareWorldObject,
} from "../src/world-preparation.js";

it("batches hidden objects through the real compositor offscreen and restores visibility before presentation", async () => {
  const scene = new Scene();
  const a = new Group(),
    b = new Group();
  a.visible = b.visible = false;
  scene.add(a, b);
  let target: unknown = null;
  const renderer = {
    backend: { isWebGPUBackend: false },
    compileAsync: vi.fn().mockResolvedValue(undefined),
    getRenderTarget: () => target,
    setRenderTarget: (next: unknown) => {
      target = next;
    },
  };
  const samples: { offscreen: boolean; a: boolean; b: boolean }[] = [];
  const owner = createWorldPreparation(renderer, () =>
    samples.push({ offscreen: target !== null, a: a.visible, b: b.visible }),
  );
  const pa = prepareWorldObject(renderer, a, null, scene);
  const pb = prepareWorldObject(renderer, b, null, scene);
  await Promise.resolve();
  expect(a.visible).toBe(false);
  expect(b.visible).toBe(false);
  expect(
    renderer.compileAsync,
    "the depth-zero compiler would build unused programs before the real nested pass",
  ).not.toHaveBeenCalled();
  owner.render();
  await Promise.all([pa, pb]);
  expect(samples).toEqual([{ offscreen: true, a: true, b: true }]);
  expect(target).toBeNull();
  expect(a.visible).toBe(false);
  expect(b.visible).toBe(false);
  owner.render();
  expect(samples[1]).toEqual({ offscreen: false, a: false, b: false });
  owner.dispose();
});

it("holds readiness until the submitted WebGPU warmup work completes", async () => {
  let finish!: () => void;
  const gpu = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let target: unknown = null;
  const renderer = {
    backend: {
      isWebGPUBackend: true,
      device: { queue: { onSubmittedWorkDone: () => gpu } },
    },
    getRenderTarget: () => target,
    setRenderTarget: (next: unknown) => {
      target = next;
    },
  };
  const owner = createWorldPreparation(renderer, () => {});
  const ready = vi.fn();
  const completion = prepareWorldObject(
    renderer,
    new Group(),
    null,
    new Scene(),
  ).then(ready);
  owner.render();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(ready).not.toHaveBeenCalled();
  finish();
  await completion;
  expect(ready).toHaveBeenCalledOnce();
  owner.dispose();
});

it("restores the screen target and hidden groups even if a preparation draw throws", async () => {
  const object = new Group();
  object.visible = false;
  let target: unknown = null;
  const renderer = {
    backend: { isWebGPUBackend: false },
    compileAsync: vi.fn().mockResolvedValue(undefined),
    getRenderTarget: () => target,
    setRenderTarget: (value: unknown) => {
      target = value;
    },
  };
  const owner = createWorldPreparation(renderer, () => {
    throw Error("draw failed");
  });
  void prepareWorldObject(renderer, object, null, new Scene());
  await Promise.resolve();
  expect(() => owner.render()).toThrow("draw failed");
  expect(target).toBeNull();
  expect(object.visible).toBe(false);
  owner.dispose();
});

it("bounds cold preparation batches and presents the live scene between them", async () => {
  const scene = new Scene();
  const objects = Array.from({ length: 9 }, () => new Group());
  objects.forEach((object) => {
    object.visible = false;
    scene.add(object);
  });
  let target: unknown = null;
  const renderer = {
    backend: { isWebGPUBackend: false },
    getRenderTarget: () => target,
    setRenderTarget: (next: unknown) => {
      target = next;
    },
  };
  const samples: { offscreen: boolean; visible: number }[] = [];
  const owner = createWorldPreparation(renderer, () =>
    samples.push({
      offscreen: target !== null,
      visible: objects.filter((object) => object.visible).length,
    }),
  );
  const pending = objects.map((object) =>
    prepareWorldObject(renderer, object, null, scene),
  );
  owner.render();
  expect(samples).toEqual([{ offscreen: true, visible: 4 }]);
  owner.render();
  expect(samples[1]).toEqual({ offscreen: false, visible: 0 });
  for (let i = 0; i < 4; i++) owner.render();
  await Promise.all(pending);
  expect(samples.map((sample) => sample.visible)).toEqual([4, 0, 4, 0, 1, 0]);
  expect(objects.every((object) => !object.visible)).toBe(true);
  owner.dispose();
});

it("paces individual meshes inside one detailed avatar instead of treating its root as one cheap job", async () => {
  const scene = new Scene(),
    avatar = new Group();
  avatar.visible = false;
  scene.add(avatar);
  const meshes = Array.from({ length: 9 }, () => new Mesh());
  avatar.add(...meshes);
  let target: unknown = null;
  const renderer = {
    backend: { isWebGPUBackend: false },
    getRenderTarget: () => target,
    setRenderTarget: (next: unknown) => {
      target = next;
    },
  };
  const samples: number[] = [];
  const owner = createWorldPreparation(renderer, () => {
    let count = 0;
    scene.traverseVisible((object) => {
      if (object instanceof Mesh) count++;
    });
    samples.push(count);
  });
  const ready = prepareWorldObject(renderer, avatar, null, scene);
  owner.render();
  expect(samples).toEqual([4]);
  expect(avatar.visible).toBe(false);
  expect(meshes.every((mesh) => mesh.visible)).toBe(true);
  for (let i = 0; i < 5; i++) owner.render();
  await ready;
  expect(samples).toEqual([4, 0, 4, 0, 1, 0]);
  owner.dispose();
});

it("prepares skeletal bounds within the mesh budget before the later whole-avatar bounds query", async () => {
  const scene = new Scene(),
    avatar = new Group();
  avatar.visible = false;
  scene.add(avatar);
  const meshes = Array.from({ length: 5 }, () =>
    Object.assign(new Mesh(), {
      isSkinnedMesh: true,
      boundingBox: null as Box3 | null,
      boundingSphere: null as Sphere | null,
      computeBoundingBox: vi.fn(function (this: { boundingBox: Box3 | null }) {
        this.boundingBox = new Box3(
          new Vector3(-1, -2, -3),
          new Vector3(1, 2, 3),
        );
      }),
    }),
  );
  avatar.add(...meshes);
  let target: unknown = null;
  const renderer = {
    backend: { isWebGPUBackend: false },
    getRenderTarget: () => target,
    setRenderTarget: (next: unknown) => {
      target = next;
    },
  };
  const owner = createWorldPreparation(renderer, () => {});
  const ready = prepareWorldObject(renderer, avatar, null, scene);
  expect(
    meshes.every((mesh) => mesh.computeBoundingBox.mock.calls.length === 0),
  ).toBe(true);
  owner.render();
  expect(
    meshes.map((mesh) => mesh.computeBoundingBox.mock.calls.length),
  ).toEqual([1, 1, 1, 1, 0]);
  owner.render();
  owner.render();
  await ready;
  expect(
    meshes.map((mesh) => mesh.computeBoundingBox.mock.calls.length),
  ).toEqual([1, 1, 1, 1, 1]);
  for (const mesh of meshes) {
    expect(mesh.boundingSphere).toBeInstanceOf(Sphere);
    expect(mesh.boundingSphere!.containsPoint(mesh.boundingBox!.min)).toBe(
      true,
    );
    expect(mesh.boundingSphere!.containsPoint(mesh.boundingBox!.max)).toBe(
      true,
    );
  }
  owner.dispose();
});

it("keeps replacement environments atomic so their light set does not churn across private batches", async () => {
  const scene = new Scene(),
    old = new Group(),
    candidate = new Group();
  scene.add(old, candidate);
  candidate.visible = false;
  candidate.add(...Array.from({ length: 9 }, () => new Mesh()));
  let target: unknown = null;
  const renderer = {
    backend: { isWebGPUBackend: false },
    getRenderTarget: () => target,
    setRenderTarget: (next: unknown) => {
      target = next;
    },
  };
  const samples: { old: boolean; meshes: number }[] = [];
  const owner = createWorldPreparation(renderer, () => {
    let meshes = 0;
    candidate.traverseVisible((object) => {
      if (object instanceof Mesh) meshes++;
    });
    samples.push({ old: old.visible, meshes });
  });
  const ready = prepareWorldObject(renderer, candidate, null, scene, [old]);
  owner.render();
  expect(samples).toEqual([{ old: false, meshes: 9 }]);
  await ready;
  expect(old.visible).toBe(true);
  expect(candidate.visible).toBe(false);
  owner.dispose();
});
