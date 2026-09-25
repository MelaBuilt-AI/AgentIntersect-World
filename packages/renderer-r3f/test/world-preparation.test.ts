import { expect, it, vi } from "vitest";
import { Group, Scene } from "three";
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
