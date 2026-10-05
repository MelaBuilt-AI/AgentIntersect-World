import { expect, it, vi } from "vitest";
import {
  Bone,
  BoxGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
} from "three";
import { AnimationMixer } from "three";
import { readFile, readdir } from "node:fs/promises";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { batchImportedAvatarParts } from "../src/imported-avatar-batching.js";

function fixture() {
  const scene = new Group();
  const bone = new Bone();
  scene.add(bone);
  const skeleton = new Skeleton([bone], [new Matrix4()]);
  const material = new MeshStandardMaterial();
  const parts = [0, 1, 2].map((index) => {
    const geometry = new BoxGeometry(0.2, 0.2, 0.2);
    geometry.clearGroups();
    geometry.translate(index, 0, 0);
    const count = geometry.attributes.position!.count;
    geometry.setAttribute(
      "skinIndex",
      new Uint16BufferAttribute(new Uint16Array(count * 4), 4),
    );
    const weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) weights[i * 4] = 1;
    geometry.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
    const mesh = new SkinnedMesh(geometry, material);
    mesh.name = `part_${index}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    mesh.bind(skeleton, new Matrix4());
    return mesh;
  });
  scene.updateMatrixWorld(true);
  return { scene, parts, bone, material };
}

it("batches exact visible geometry and shares the original cloned rig across every render pass", () => {
  const { scene, parts, bone, material } = fixture();
  parts[2]!.visible = false;
  const geometry = parts[0]!.geometry;
  const positions = geometry.attributes.position!.array.slice();
  const batch = batchImportedAvatarParts(scene);
  expect(batch.count).toBe(1);
  const mesh = scene.getObjectByName("IMPORTED_AVATAR_BATCH") as SkinnedMesh;
  expect(mesh.material).toBe(material);
  expect(mesh.skeleton).toBe(parts[0]!.skeleton);
  expect(mesh.castShadow && mesh.receiveShadow).toBe(true);
  expect(mesh.geometry.attributes.position!.count).toBe(
    geometry.attributes.position!.count * 2,
  );
  bone.position.set(0.2, 0.4, 0.6);
  scene.updateMatrixWorld(true);
  for (let i = 0; i < 2; i++) {
    const offset = i * geometry.attributes.position!.count;
    const original = new Vector3().fromBufferAttribute(
      parts[i]!.geometry.attributes.position!,
      0,
    );
    const merged = new Vector3().fromBufferAttribute(
      mesh.geometry.attributes.position!,
      offset,
    );
    parts[i]!.applyBoneTransform(0, original);
    mesh.applyBoneTransform(offset, merged);
    expect(merged.toArray()).toEqual(original.toArray());
  }
  expect(geometry.attributes.position!.array).toEqual(positions);
  const disposed = vi.spyOn(mesh.geometry, "dispose");
  batch.dispose();
  expect(disposed).toHaveBeenCalledOnce();
  expect(parts.map((p) => p.visible)).toEqual([true, true, false]);
  expect(scene.getObjectByName("IMPORTED_AVATAR_BATCH")).toBeUndefined();
});

it("leaves animated mesh transforms, transparent parts and different bindings unbatched", () => {
  const { scene, parts } = fixture();
  parts[1]!.bindMatrix.makeTranslation(1, 0, 0);
  expect(
    batchImportedAvatarParts(scene, [{ tracks: [{ name: "part_0.position" }] }])
      .count,
  ).toBe(0);
  (parts[0]!.material as MeshStandardMaterial).transparent = true;
  expect(batchImportedAvatarParts(scene).count).toBe(0);
});

it("preserves sampled skinning through every shipped avatar's real animation clips", async () => {
  const directory = new URL(
    "../../../apps/web/public/assets/imported-avatars/",
    import.meta.url,
  );
  const files = (await readdir(directory)).filter((name) =>
    name.endsWith(".glb"),
  );
  expect(files).toHaveLength(23);
  for (const file of files) {
    const bytes = await readFile(new URL(file, directory));
    const jsonLength = bytes.readUInt32LE(12);
    const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
    // Node-only geometry/rig proof: skip image decoding, keep exact binary
    // geometry, joint indices/weights, bind matrices and animation tracks.
    delete json.images;
    delete json.textures;
    json.materials = json.materials.map(() => ({ doubleSided: true }));
    const text = Buffer.from(JSON.stringify(json));
    const padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32);
    text.copy(padded);
    const binary = bytes.subarray(20 + jsonLength);
    const header = Buffer.alloc(20);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(20 + padded.length + binary.length, 8);
    header.writeUInt32LE(padded.length, 12);
    header.writeUInt32LE(0x4e4f534a, 16);
    const glb = Buffer.concat([header, padded, binary]);
    const asset = await new GLTFLoader().parseAsync(
      glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength),
      "",
    );
    const scene = asset.scene;
    const parts: SkinnedMesh[] = [];
    scene.traverseVisible((object) => {
      if (object instanceof SkinnedMesh) parts.push(object);
    });
    scene.updateMatrixWorld(true);
    const batch = batchImportedAvatarParts(scene, asset.animations);
    expect(batch.count, file).toBe(1);
    const merged = scene.getObjectByName(
      "IMPORTED_AVATAR_BATCH",
    ) as SkinnedMesh;
    const mixer = new AnimationMixer(scene);
    for (const clip of asset.animations) {
      mixer.stopAllAction();
      mixer.clipAction(clip).play();
      mixer.setTime(clip.duration * 0.37);
      scene.updateMatrixWorld(true);
      let offset = 0;
      for (const part of parts) {
        for (const vertex of [
          0,
          Math.floor(part.geometry.attributes.position!.count / 2),
          part.geometry.attributes.position!.count - 1,
        ]) {
          const source = new Vector3().fromBufferAttribute(
            part.geometry.attributes.position!,
            vertex,
          );
          const result = new Vector3().fromBufferAttribute(
            merged.geometry.attributes.position!,
            offset + vertex,
          );
          part.applyBoneTransform(vertex, source);
          merged.applyBoneTransform(offset + vertex, result);
          expect(
            result.distanceTo(source),
            `${file}:${clip.name}:${part.name}`,
          ).toBeLessThan(1e-7);
        }
        offset += part.geometry.attributes.position!.count;
      }
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(scene);
    batch.dispose();
    const again = batchImportedAvatarParts(scene, asset.animations);
    expect(again.count, `${file}:effect remount`).toBe(1);
    again.dispose();
    for (const part of parts) part.geometry.dispose();
  }
}, 30000);
