import { RenderTarget, Sphere, Box3, Vector3 } from "three/webgpu";

/** Keep large skinned bounds scans off a single preview/replacement frame. */
export async function prepareAvatarBounds(
  root,
  current = () => true,
  frame = () =>
    new Promise((resolve) => globalThis.requestAnimationFrame(resolve)),
  now = () => globalThis.performance.now(),
) {
  root.updateMatrixWorld(true);
  const parts = [];
  root.traverseVisible((mesh) => {
    if (!mesh.isSkinnedMesh || mesh.boundingBox !== null) return;
    // Snapshot the selected pose: an action/camera update during a yield must
    // not combine vertices from different skeletal poses into one bounds box.
    const snapshot = mesh.clone(false);
    snapshot.skeleton = mesh.skeleton.clone();
    snapshot.skeleton.bones = mesh.skeleton.bones.map((bone) => {
      const copy = bone.clone(false);
      copy.matrixWorld.copy(bone.matrixWorld);
      return copy;
    });
    parts.push({ mesh, snapshot });
  });
  let started = now();
  const point = new Vector3();
  for (const { mesh, snapshot } of parts) {
    const box = new Box3();
    for (
      let index = 0;
      index < mesh.geometry.attributes.position.count;
      index++
    ) {
      if ((index & 1023) === 0 && now() - started >= 4) {
        await frame();
        if (!current()) return false;
        started = now();
      }
      snapshot.getVertexPosition(index, point);
      box.expandByPoint(point);
    }
    if (!current()) return false;
    mesh.boundingBox = box;
    mesh.boundingSphere ??= box.getBoundingSphere(new Sphere());
  }
  return current();
}

const preparationByRenderer = new WeakMap();
const worldPassByRenderer = new WeakMap();
const depthPreparationByRenderer = new WeakMap();

/** The city owns the depth resources; the compositor owns private preparation. */
export function registerWorldDepthPreparation(renderer, preparation) {
  depthPreparationByRenderer.set(renderer, preparation);
  return () => {
    if (depthPreparationByRenderer.get(renderer) === preparation)
      depthPreparationByRenderer.delete(renderer);
  };
}

/** r186 compileAsync does not advance the scene/light cache epoch. Without a
 * fresh call, a main-pass compile can reuse the preceding unlit depth-pass key
 * and its otherwise identical skeletal shaders are rebuilt on first draw. */
export function compileWorldPass(renderer, object, camera, scene) {
  renderer.info.calls++;
  return renderer.compileAsync(object, camera, scene);
}

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
    compiled = compileWorldPass(renderer, object, camera, scene);
  } finally {
    contexts.get = get;
    object.visible = visible;
    renderer.setRenderTarget(previous);
  }
  await compiled;
}

/** Warm through the actual compositor nesting. r186 compileAsync alone uses
 * call-depth zero; node programs for a nested scene/reflection have other keys.
 * @param {*} renderer
 * @param {() => void} render
 * @param {*} [passTarget]
 * @param {{compile?: ((objects: import("three").Object3D[]) => Promise<unknown>) | null}} [options]
 */
export function createWorldPreparation(
  renderer,
  render,
  passTarget = null,
  { compile = null } = {},
) {
  const pending = [];
  let target = null;
  let presentNext = false;
  let active = null;
  let disposed = false;
  const prepare = (object, exclude = []) =>
    new Promise((resolve) => pending.push({ object, resolve, exclude }));
  preparationByRenderer.set(renderer, prepare);
  if (passTarget) worldPassByRenderer.set(renderer, passTarget);

  // Both asynchronous compilation submission and private draws see the same
  // parts. Restore visibility synchronously, before any promise can yield.
  const withParts = (batch, action) => {
    const concealed = new Set();
    for (const { exclude } of batch)
      for (const object of exclude) {
        if (object.visible) {
          concealed.add(object);
          object.visible = false;
        }
      }
    const hidden = new Set();
    for (const { object } of batch)
      for (let parent = object; parent; parent = parent.parent) {
        if (!parent.visible) {
          hidden.add(parent);
          parent.visible = true;
        }
      }
    try {
      return action();
    } finally {
      for (const object of hidden) object.visible = false;
      for (const object of concealed) object.visible = true;
    }
  };
  return {
    render() {
      if (disposed) return;
      if (
        presentNext ||
        (active && (!active.compiled || active.submitted)) ||
        (!active && !pending.length)
      ) {
        presentNext = false;
        render();
        return;
      }
      if (!active) {
        const jobs = pending.splice(0, 4);
        for (const { object } of jobs) {
          if (object.isSkinnedMesh) {
            if (object.boundingBox === null) object.computeBoundingBox();
            if (object.boundingSphere === null)
              object.boundingSphere = object.boundingBox.getBoundingSphere(
                new Sphere(),
              );
          }
        }
        const depth = depthPreparationByRenderer.get(renderer);
        active = { jobs, compiled: !compile && !depth, submitted: false };
        if (compile || depth) {
          const batch = active;
          const objects = jobs.map(({ object }) => object);
          const compilation = withParts(jobs, () =>
            Promise.all([compile?.(objects), depth?.compile(objects)]),
          );
          void compilation.then(() => {
            batch.compiled = true;
          });
          render();
          return;
        }
      }
      const batch = active;
      const previous = renderer.getRenderTarget();
      target ??= new RenderTarget(1, 1);
      withParts(batch.jobs, () => {
        try {
          renderer.setRenderTarget(target);
          depthPreparationByRenderer.get(renderer)?.render();
          render();
        } finally {
          renderer.setRenderTarget(previous);
        }
      });
      // Never present a private warmup. Keep normal frames flowing while its
      // GPU work completes, and do not submit another cold batch meanwhile.
      presentNext = true;
      batch.submitted = true;
      const finish = () => {
        if (active === batch) active = null;
        for (const { resolve } of batch.jobs) resolve();
      };
      if (renderer.backend.isWebGPUBackend)
        void renderer.backend.device.queue.onSubmittedWorkDone().then(finish);
      else finish();
    },
    dispose() {
      disposed = true;
      if (worldPassByRenderer.get(renderer) === passTarget)
        worldPassByRenderer.delete(renderer);
      if (preparationByRenderer.get(renderer) === prepare)
        preparationByRenderer.delete(renderer);
      for (const { resolve } of [...pending.splice(0), ...(active?.jobs ?? [])])
        resolve();
      active = null;
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
  if (prepare) {
    // A replacement scenery excludes the old environment and is already
    // asynchronously compiled. Keep that draw atomic: alternating its lights
    // with the live World per mesh would rebuild unrelated scene programs.
    if (exclude.length) return prepare(object, exclude);
    const parts = [];
    const visible = object.visible;
    try {
      object.visible = true;
      object.traverseVisible((child) => {
        if (child.isMesh || child.isSprite || child.isLine || child.isPoints)
          parts.push(child);
      });
    } finally {
      object.visible = visible;
    }
    if (!parts.length) return prepare(object, exclude);
    // Reveal only each batch's actual draw owners, not a many-mesh avatar/root.
    // The compositor restores every sibling and ancestor before presentation.
    const concealed = [...exclude, ...parts];
    await Promise.all(parts.map((part) => prepare(part, concealed)));
    return;
  }
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
