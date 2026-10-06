import { afterEach, expect, it, vi } from "vitest";
import {
  Bone,
  BoxGeometry,
  Group,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Texture,
} from "three";
import { configureImportedAvatarScene } from "../src/imported-avatar-canvas.js";
import * as lifecycle from "../src/model-resource-lifecycle.js";

// Tests exercise real Three disposal events, not physical GPU reclamation.
const owners = lifecycle as unknown as {
  retainModelResources: (scene: Group) => () => void;
  disposeAvatarSkeletons: (scene: Group) => void;
};
afterEach(() => vi.useRealTimers());
function model() {
  const scene = new Group();
  const texture = new Texture();
  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial({ map: texture });
  const bone = new Bone();
  const mesh = new SkinnedMesh(geometry, material);
  mesh.add(bone);
  mesh.bind(new Skeleton([bone]));
  scene.add(mesh);
  return { scene, texture, geometry, material, mesh };
}

it("releases a model only after its final user leaves, and can reuse cached source data", async () => {
  expect(owners.retainModelResources).toBeTypeOf("function");
  vi.useFakeTimers();
  const asset = model();
  const texture = vi.spyOn(asset.texture, "dispose");
  const geometry = vi.spyOn(asset.geometry, "dispose");
  const material = vi.spyOn(asset.material, "dispose");
  const leaveFirst = owners.retainModelResources(asset.scene);
  const leaveSecond = owners.retainModelResources(asset.scene);
  leaveFirst();
  await vi.runAllTimersAsync();
  expect(texture).not.toHaveBeenCalled();
  leaveSecond();
  // Strict Mode cleanup/setup replay must cancel the pending release.
  const leaveReplay = owners.retainModelResources(asset.scene);
  await vi.runAllTimersAsync();
  expect(texture).not.toHaveBeenCalled();
  leaveReplay();
  await vi.runAllTimersAsync();
  expect(texture).toHaveBeenCalledOnce();
  expect(geometry).toHaveBeenCalledOnce();
  expect(material).toHaveBeenCalledOnce();
  expect(asset.mesh.geometry).toBe(asset.geometry);
  expect(asset.material.map).toBe(asset.texture);
  const leaveReused = owners.retainModelResources(asset.scene);
  leaveReused();
  await vi.runAllTimersAsync();
  expect(texture).toHaveBeenCalledTimes(2);
});

it("disposes clone-owned skeleton textures without touching another avatar or shared model resources", () => {
  expect(owners.disposeAvatarSkeletons).toBeTypeOf("function");
  const asset = model();
  const first = configureImportedAvatarScene(asset.scene);
  const second = configureImportedAvatarScene(asset.scene);
  const a = first.children[0] as SkinnedMesh;
  const b = second.children[0] as SkinnedMesh;
  a.skeleton.computeBoneTexture();
  b.skeleton.computeBoneTexture();
  const aTexture = vi.spyOn(a.skeleton.boneTexture!, "dispose");
  const bTexture = vi.spyOn(b.skeleton.boneTexture!, "dispose");
  const geometry = vi.spyOn(asset.geometry, "dispose");
  const material = vi.spyOn(asset.material, "dispose");
  const sourceTexture = vi.spyOn(asset.texture, "dispose");
  owners.disposeAvatarSkeletons(first);
  expect(aTexture).toHaveBeenCalledOnce();
  expect(a.skeleton.boneTexture).toBeNull();
  expect(bTexture).not.toHaveBeenCalled();
  expect(geometry).not.toHaveBeenCalled();
  expect(material).not.toHaveBeenCalled();
  expect(sourceTexture).not.toHaveBeenCalled();
  owners.disposeAvatarSkeletons(second);
});
