import { Mesh, Texture } from "three";

// useLoader retains CPU model data across canvases. Keep that reusable data,
// but release GPU-backed resources once no mounted model uses the source.
const modelUsers = new WeakMap();

export function retainModelResources(scene) {
  let owner = modelUsers.get(scene);
  if (!owner) {
    owner = { users: 0, release: undefined };
    modelUsers.set(scene, owner);
  }
  globalThis.clearTimeout(owner.release);
  owner.users++;
  return () => {
    owner.users--;
    if (owner.users !== 0) return;
    // Let Strict Mode cleanup/setup and same-commit model replacements retain
    // the asset before releasing it. No images are closed or cache entries lost.
    owner.release = globalThis.setTimeout(() => {
      const resources = new Set();
      scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        resources.add(object.geometry);
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const material of materials) {
          resources.add(material);
          for (const value of Object.values(material)) {
            if (value instanceof Texture) resources.add(value);
          }
        }
      });
      disposeAvatarSkeletons(scene);
      for (const resource of resources) resource.dispose();
      modelUsers.delete(scene);
    }, 0);
  };
}

// SkeletonUtils clones skeletons, but shares source geometry/material/texture.
// Only the clone's bone texture belongs to this avatar instance.
export function disposeAvatarSkeletons(scene) {
  const skeletons = new Set();
  scene.traverse((object) => {
    if (object.isSkinnedMesh) skeletons.add(object.skeleton);
  });
  for (const skeleton of skeletons) skeleton.dispose();
}
