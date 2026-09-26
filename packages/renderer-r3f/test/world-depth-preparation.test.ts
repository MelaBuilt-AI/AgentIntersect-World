import { expect, it, vi } from "vitest";
import type {
  WebGLRenderer,
  WebGLRenderTarget,
  Vector2,
  Object3D,
} from "three";
import {
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  PerspectiveCamera,
  Scene,
} from "three/webgpu";
import { createRepositoryFogDepth } from "../src/repository-fog-depth.js";
import {
  compileWorldEnvironment,
  createWorldPreparation,
  prepareWorldObject,
  registerWorldDepthPreparation,
} from "../src/world-preparation.js";

it("keeps presenting while compilation and submitted warmup work are pending", async () => {
  const scene = new Scene(),
    camera = new PerspectiveCamera(),
    avatar = new Group();
  avatar.visible = false;
  avatar.add(...Array.from({ length: 5 }, () => new Mesh()));
  scene.add(avatar);
  let finishCompile!: () => void, finishGpu!: () => void;
  const compiled = new Promise<void>((resolve) => {
    finishCompile = resolve;
  });
  const gpu = new Promise<void>((resolve) => {
    finishGpu = resolve;
  });
  let target: unknown = null;
  const gl = {
    getRenderTarget: () => target,
    setRenderTarget: (value: unknown) => {
      target = value;
    },
    backend: {
      isWebGPUBackend: true,
      device: { queue: { onSubmittedWorkDone: () => gpu } },
    },
  };
  const samples: { private: boolean; visible: boolean }[] = [];
  const compile = vi.fn(() => {
    expect(avatar.visible).toBe(true);
    return compiled;
  });
  const owner = createWorldPreparation(
    gl,
    () => samples.push({ private: target !== null, visible: avatar.visible }),
    null,
    { compile },
  );
  const ready = vi.fn();
  const task = prepareWorldObject(gl, avatar, camera, scene).then(ready);
  owner.render();
  expect(compile).toHaveBeenCalledOnce();
  expect(compile).toHaveBeenNthCalledWith(1, avatar.children.slice(0, 4));
  expect(samples).toEqual([{ private: false, visible: false }]);
  owner.render();
  expect(compile).toHaveBeenCalledOnce();
  expect(samples.every((sample) => !sample.private && !sample.visible)).toBe(
    true,
  );
  finishCompile();
  await compiled;
  await Promise.resolve();
  owner.render();
  expect(samples.at(-1)).toEqual({ private: true, visible: true });
  owner.render();
  owner.render();
  expect(
    compile,
    "do not enqueue the next batch while the previous GPU work is outstanding",
  ).toHaveBeenCalledOnce();
  expect(ready).not.toHaveBeenCalled();
  finishGpu();
  await gpu;
  await Promise.resolve();
  for (let i = 0; i < 6; i++) {
    owner.render();
    await Promise.resolve();
  }
  await task;
  expect(compile).toHaveBeenCalledTimes(2);
  expect(ready).toHaveBeenCalledOnce();
  expect(avatar.visible).toBe(false);
  owner.dispose();
});

it("releases pending preparation on disposal without a late private draw", async () => {
  const scene = new Scene(),
    camera = new PerspectiveCamera(),
    avatar = new Group();
  avatar.visible = false;
  avatar.add(...Array.from({ length: 5 }, () => new Mesh()));
  scene.add(avatar);
  let finish!: () => void;
  const compiled = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const render = vi.fn();
  const gl = { backend: { isWebGPUBackend: false } };
  const owner = createWorldPreparation(gl, render, null, {
    compile: () => compiled,
  });
  const completion = prepareWorldObject(gl, avatar, camera, scene);
  owner.render();
  owner.dispose();
  await completion;
  expect(avatar.visible).toBe(false);
  finish();
  await compiled;
  await Promise.resolve();
  owner.render();
  expect(render).toHaveBeenCalledOnce();
});

it("does not reuse the preceding pass lighting key during compilation", async () => {
  const scene = new Scene(),
    camera = new PerspectiveCamera();
  const light = Object.assign(new Group(), { isLight: true });
  const avatar = new Mesh(undefined, new MeshBasicNodeMaterial());
  scene.add(light, avatar);
  let target: WebGLRenderTarget | null = null;
  // r186 NodeManager caches scene/light keys by info.calls; the last draw was depth.
  let cachedCall = 10,
    cachedLighting = false;
  const observed: boolean[] = [];
  const gl = {
    info: { calls: 10 },
    autoClear: true,
    shadowMap: { autoUpdate: true },
    _renderContexts: { get: vi.fn() },
    getDrawingBufferSize: (size: Vector2) => size.set(800, 600),
    getRenderTarget: () => target,
    setRenderTarget: (next: WebGLRenderTarget | null) => {
      target = next;
    },
    compileAsync: () => {
      if (cachedCall !== gl.info.calls) {
        cachedCall = gl.info.calls;
        cachedLighting = light.visible;
      }
      observed.push(cachedLighting);
      return Promise.resolve();
    },
  };
  const depth = createRepositoryFogDepth();
  await compileWorldEnvironment(gl, avatar, camera, scene);
  await depth.compile(gl as unknown as WebGLRenderer, scene, camera, [avatar]);
  await compileWorldEnvironment(gl, avatar, camera, scene);
  expect(observed).toEqual([true, false, true]);
  expect(light.visible).toBe(true);
  expect(target).toBeNull();
  depth.dispose();
});

it("compiles the exact depth target without leaking capture state while awaiting readiness", async () => {
  const scene = new Scene(),
    camera = new PerspectiveCamera(),
    light = new Group();
  Object.assign(light, { isLight: true });
  const material = new MeshBasicNodeMaterial();
  const avatar = new Mesh(undefined, material);
  scene.add(light, avatar);
  let target: WebGLRenderTarget | null = null;
  let finish!: () => void;
  const ready = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const gl = {
    info: { calls: 0 },
    autoClear: false,
    shadowMap: { autoUpdate: true },
    getDrawingBufferSize: (size: Vector2) => size.set(800, 600),
    getRenderTarget: () => target,
    setRenderTarget: (next: WebGLRenderTarget | null) => {
      target = next;
    },
    render: vi.fn(),
    compileAsync: vi.fn(
      (
        compiledObject: Object3D,
        view: PerspectiveCamera,
        targetScene: Scene,
      ) => {
        expect(compiledObject).toBe(avatar);
        expect(targetScene).toBe(scene);
        expect(view).not.toBe(camera);
        expect(target?.texture.name).toBe("repository-fog-scene");
        expect(light.visible).toBe(false);
        expect(avatar.material).toBe(material);
        return ready;
      },
    ),
  };
  const depth = createRepositoryFogDepth();
  depth.capture(gl as unknown as WebGLRenderer, scene, camera);
  const compilation = depth.compile(
    gl as unknown as WebGLRenderer,
    scene,
    camera,
    [avatar],
  );
  expect(gl.compileAsync).toHaveBeenCalledOnce();
  expect(gl.render).toHaveBeenCalledOnce();
  expect(target).toBeNull();
  expect(light.visible).toBe(true);
  expect(avatar.material).toBe(material);
  expect(gl.autoClear).toBe(false);
  expect(gl.shadowMap.autoUpdate).toBe(true);
  finish();
  await compilation;
  depth.dispose();
});

it("prepares arrival parts in the real depth pass before their first visible frame", async () => {
  const scene = new Scene(),
    camera = new PerspectiveCamera(),
    avatar = new Group();
  avatar.visible = false;
  scene.add(avatar);
  avatar.add(
    ...Array.from(
      { length: 9 },
      () => new Mesh(undefined, new MeshBasicNodeMaterial()),
    ),
  );
  let target: WebGLRenderTarget | null = null;
  const depthParts = new Set<string>();
  const gl = {
    info: { calls: 0 },
    autoClear: false,
    shadowMap: { autoUpdate: true },
    backend: { isWebGPUBackend: false },
    compileAsync: vi.fn().mockResolvedValue(undefined),
    getDrawingBufferSize: (size: Vector2) => size.set(800, 600),
    getRenderTarget: () => target,
    setRenderTarget: (next: WebGLRenderTarget | null) => {
      target = next;
    },
    render: () => {
      if (target?.texture.name === "repository-fog-scene")
        scene.traverseVisible((object) => {
          if (object instanceof Mesh) depthParts.add(object.uuid);
        });
    },
  };
  const depth = createRepositoryFogDepth();
  const unregister = registerWorldDepthPreparation(gl, {
    compile: (objects: readonly Object3D[]) =>
      depth.compile(gl as unknown as WebGLRenderer, scene, camera, objects),
    render: () => {
      depth.beginFrame();
      depth.capture(gl as unknown as WebGLRenderer, scene, camera);
      depth.beginFrame();
    },
  });
  const owner = createWorldPreparation(gl, () => gl.render());
  const ready = prepareWorldObject(gl, avatar, camera, scene);
  for (let i = 0; i < 30; i++) {
    // The ordinary prepass runs while the arriving actor is still hidden.
    depth.beginFrame();
    depth.capture(gl as unknown as WebGLRenderer, scene, camera);
    owner.render();
    await Promise.resolve();
  }
  await ready;
  expect(
    depthParts.size,
    "hidden warmup must cover the separate fog-depth target",
  ).toBe(9);
  expect(avatar.visible).toBe(false);
  expect(target).toBeNull();
  owner.dispose();
  unregister();
  depth.dispose();
});
