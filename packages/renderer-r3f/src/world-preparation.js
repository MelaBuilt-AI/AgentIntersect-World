import { RenderTarget } from "three/webgpu";

const preparationByRenderer = new WeakMap();
const worldPassByRenderer = new WeakMap();

/** r186 compileAsync omits render call depth when selecting its context.
 * Match the actual nested scene pass, restoring the shim synchronously before
 * compilation yields. Otherwise warmup builds unused depth-zero programs. */
export async function compileWorldEnvironment(renderer, object, camera, scene) {
  const target = worldPassByRenderer.get(renderer);
  const previous = renderer.getRenderTarget();
  const visible = object.visible;
  const contexts = renderer._renderContexts;
  const get = contexts.get;
  let compiled;
  try {
    object.visible = true;
    if (target) {
      renderer.setRenderTarget(target);
      contexts.get = function (renderTarget, mrt, depth = 1) {
        return get.call(this, renderTarget, mrt, depth);
      };
    }
    compiled = renderer.compileAsync(object, camera, scene);
  } finally {
    contexts.get = get;
    object.visible = visible;
    renderer.setRenderTarget(previous);
  }
  await compiled;
}

/** Warm through the actual compositor nesting. r186 compileAsync alone uses
 * call-depth zero; node programs for a nested scene/reflection have other keys. */
export function createWorldPreparation(renderer, render, passTarget = null) {
  const pending = [];
  let target = null;
  const prepare = (object, exclude = []) =>
    new Promise((resolve) => pending.push({ object, resolve, exclude }));
  preparationByRenderer.set(renderer, prepare);
  if (passTarget) worldPassByRenderer.set(renderer, passTarget);
  return {
    render() {
      if (!pending.length) {
        render();
        return;
      }
      const batch = pending.splice(0);
      const concealed = new Set();
      for (const { exclude } of batch)
        for (const object of exclude) {
          if (object.visible) {
            concealed.add(object);
            object.visible = false;
          }
        }
      const hidden = new Set();
      for (const { object } of batch) {
        for (let parent = object; parent; parent = parent.parent) {
          if (!parent.visible) {
            hidden.add(parent);
            parent.visible = true;
          }
        }
      }
      const previous = renderer.getRenderTarget();
      target ??= new RenderTarget(1, 1);
      try {
        renderer.setRenderTarget(target);
        render();
      } finally {
        for (const object of hidden) object.visible = false;
        for (const object of concealed) object.visible = true;
        renderer.setRenderTarget(previous);
      }
      // Do not present this frame: PassNodes cache within a renderer frame.
      // The next normal frame redraws hidden bodies before exposing any pixels.
      const completed = renderer.backend.isWebGPUBackend
        ? renderer.backend.device.queue.onSubmittedWorkDone()
        : Promise.resolve();
      void completed.then(() => {
        for (const { resolve } of batch) resolve();
      });
    },
    dispose() {
      if (worldPassByRenderer.get(renderer) === passTarget)
        worldPassByRenderer.delete(renderer);
      if (preparationByRenderer.get(renderer) === prepare)
        preparationByRenderer.delete(renderer);
      for (const { resolve } of pending.splice(0)) resolve();
      target?.dispose();
    },
  };
}

export async function prepareWorldObject(
  renderer,
  object,
  camera,
  scene,
  exclude = [],
) {
  const prepare = preparationByRenderer.get(renderer);
  if (prepare) return prepare(object, exclude);
  const visible = object.visible;
  let compiled;
  try {
    object.visible = true;
    compiled = renderer.compileAsync(object, camera, scene);
  } finally {
    object.visible = visible;
  }
  await compiled;
  // With the compositor disabled, ordinary render and compile share depth zero.
  // Prime the remaining real shadow passes without writing to the screen.
  const target = new RenderTarget(1, 1);
  const previous = renderer.getRenderTarget();
  try {
    object.visible = true;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  } finally {
    object.visible = visible;
    renderer.setRenderTarget(previous);
    target.dispose();
  }
}
