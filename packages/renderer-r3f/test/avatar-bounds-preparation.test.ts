import { expect, it, vi } from "vitest";
import {
  Bone,
  Sphere,
  Float32BufferAttribute,
  BufferGeometry,
  Skeleton,
  SkinnedMesh,
  Vector3,
} from "three";
import * as preparation from "../src/world-preparation.js";

function fixture() {
  const count = 40000,
    positions = new Float32Array(count * 3),
    weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = Math.sin(i);
    positions[i * 3 + 1] = (i % 101) / 100;
    positions[i * 3 + 2] = Math.cos(i);
    weights[i * 4] = 1;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute(
    "skinIndex",
    new Float32BufferAttribute(new Float32Array(count * 4), 4),
  );
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
  const mesh = new SkinnedMesh(geometry);
  const bone = new Bone();
  mesh.add(bone);
  mesh.bind(new Skeleton([bone]));
  bone.position.y = 2;
  bone.rotation.z = 0.4;
  mesh.updateMatrixWorld(true);
  mesh.computeBoundingBox();
  const expected = mesh.boundingBox!.clone();
  mesh.boundingBox = null;
  mesh.boundingSphere = null;
  return { mesh, bone, expected };
}

it("yields during a large mesh while retaining exact bounds of its starting pose", async () => {
  expect(preparation).toHaveProperty("prepareAvatarBounds");
  const { mesh, bone, expected } = fixture();
  let ticks = 0,
    yields = 0;
  const frame = async () => {
    yields++;
    expect(mesh.boundingBox).toBeNull();
    bone.rotation.z = 1.2;
    mesh.updateMatrixWorld(true);
  };
  const result = await preparation.prepareAvatarBounds(
    mesh,
    () => true,
    frame,
    () => ticks++,
  );
  expect(result).toBe(true);
  expect(yields).toBeGreaterThan(1);
  expect(mesh.boundingBox!.min.distanceTo(expected.min)).toBeLessThan(1e-6);
  expect(mesh.boundingBox!.max.distanceTo(expected.max)).toBeLessThan(1e-6);
  const center = expected.getCenter(new Vector3());
  expect(mesh.boundingSphere!.center.distanceTo(center)).toBeLessThan(1e-6);
  expect(mesh.boundingSphere!.radius).toBeCloseTo(
    expected.getSize(new Vector3()).length() / 2,
  );
});

it("cancels a superseded mesh before publishing partial bounds", async () => {
  expect(preparation).toHaveProperty("prepareAvatarBounds");
  const { mesh } = fixture();
  let active = true,
    ticks = 0;
  const result = await preparation.prepareAvatarBounds(
    mesh,
    () => active,
    async () => {
      active = false;
    },
    () => ticks++,
  );
  expect(result).toBe(false);
  expect(mesh.boundingBox).toBeNull();
  expect(mesh.boundingSphere).toBeNull();
});

it("retains already prepared bounds without reskinning or yielding", async () => {
  expect(preparation).toHaveProperty("prepareAvatarBounds");
  const { mesh, expected } = fixture();
  mesh.boundingBox = expected;
  mesh.boundingSphere = expected.getBoundingSphere(new Sphere());
  const frame = vi.fn().mockResolvedValue(undefined);
  const box = mesh.boundingBox;
  await preparation.prepareAvatarBounds(mesh, () => true, frame);
  expect(frame).not.toHaveBeenCalled();
  expect(mesh.boundingBox).toBe(box);
});
