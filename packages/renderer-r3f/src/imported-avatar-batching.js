import { SkinnedMesh } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Combine compatible visible parts, preserving exact skinning and source bytes.
 * World-only: the creator keeps independently pickable parts in its preview.
 */
export function batchImportedAvatarParts(scene, animations = []) {
  const animated = new Set(
    animations.flatMap((clip) =>
      clip.tracks.map((track) => track.name.split(".")[0]),
    ),
  );
  const groups = [];
  scene.traverseVisible((part) => {
    if (
      !part.isSkinnedMesh ||
      Array.isArray(part.material) ||
      part.material.transparent ||
      part.children.length ||
      animated.has(part.name) ||
      Object.keys(part.geometry.morphAttributes).length ||
      part.geometry.groups.length ||
      part.geometry.drawRange.start !== 0 ||
      part.geometry.drawRange.count !== Infinity
    )
      return;
    const group = groups.find(
      ({ source }) =>
        source.parent === part.parent &&
        source.material === part.material &&
        source.bindMode === part.bindMode &&
        source.matrix.equals(part.matrix) &&
        source.bindMatrix.equals(part.bindMatrix) &&
        source.skeleton.bones.length === part.skeleton.bones.length &&
        source.skeleton.bones.every(
          (bone, index) =>
            bone === part.skeleton.bones[index] &&
            source.skeleton.boneInverses[index].equals(
              part.skeleton.boneInverses[index],
            ),
        ),
    );
    if (group) group.parts.push(part);
    else groups.push({ source: part, parts: [part] });
  });
  const batches = [];
  for (const { source, parts } of groups) {
    if (parts.length < 2) continue;
    const first = source.geometry;
    const attributes = Object.keys(first.attributes).sort().join(",");
    if (
      !parts.every(
        ({ geometry }) =>
          Boolean(geometry.index) === Boolean(first.index) &&
          Object.keys(geometry.attributes).sort().join(",") === attributes &&
          Object.entries(first.attributes).every(([name, attribute]) => {
            const other = geometry.attributes[name];
            return (
              !attribute.isInterleavedBufferAttribute &&
              !other.isInterleavedBufferAttribute &&
              attribute.itemSize === other.itemSize &&
              attribute.normalized === other.normalized &&
              attribute.array.constructor === other.array.constructor
            );
          }),
      )
    )
      continue;
    const geometry = mergeGeometries(parts.map((part) => part.geometry));
    if (!geometry) continue;
    const mesh = new SkinnedMesh(geometry, source.material);
    mesh.name = "IMPORTED_AVATAR_BATCH";
    mesh.position.copy(source.position);
    mesh.quaternion.copy(source.quaternion);
    mesh.scale.copy(source.scale);
    mesh.bindMode = source.bindMode;
    mesh.bind(source.skeleton, source.bindMatrix);
    mesh.castShadow = source.castShadow;
    mesh.receiveShadow = source.receiveShadow;
    source.parent.add(mesh);
    for (const part of parts) part.visible = false;
    batches.push({ mesh, parts });
  }
  return {
    count: batches.length,
    dispose() {
      for (const { mesh, parts } of batches) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
        for (const part of parts) part.visible = true;
      }
    },
  };
}
