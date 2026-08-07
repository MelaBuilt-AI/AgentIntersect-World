import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { describe, expect, it, vi } from "vitest";

import {
  RepositoryCityGLTFLoader,
  repositoryMaterializationFrame,
  repositoryMaterialTint,
  selectRepositoryCityRenderPlan,
} from "../src/repository-city-canvas.js";
import type { RepositoryCityInstance } from "../src/repository-city-state.js";

const instance = (index: number): RepositoryCityInstance => ({
  instanceId: `repository:${index}`,
  assetId: "01-code-slab",
  position: { x: index, z: index },
  status: "active",
  lifecycle: "materializing",
  pinned: false,
  manual: false,
  linkedRepoData: { ref: `src/${index}.ts` },
  sourceEvent: "file.updated",
});

describe("repository city renderer policy", () => {
  it("loads repository GLBs one at a time and releases the queue after errors", async () => {
    const started: string[] = [];
    const pending = new Map<
      string,
      { readonly succeed: () => void; readonly fail: () => void }
    >();
    let active = 0;
    let maximumActive = 0;
    vi.spyOn(GLTFLoader.prototype, "load").mockImplementation(
      (url, onLoad, _onProgress, onError) => {
        started.push(url);
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        pending.set(url, {
          succeed: () => {
            active -= 1;
            onLoad({} as GLTF);
          },
          fail: () => {
            active -= 1;
            onError?.(new Error(`failed ${url}`));
          },
        });
      },
    );

    const loader = new RepositoryCityGLTFLoader();
    loader.load(
      "first.glb",
      () => undefined,
      undefined,
      () => undefined,
    );
    loader.load(
      "second.glb",
      () => undefined,
      undefined,
      () => undefined,
    );
    loader.load(
      "third.glb",
      () => undefined,
      undefined,
      () => undefined,
    );

    await vi.waitFor(() => expect(started).toEqual(["first.glb"]));
    pending.get("first.glb")!.succeed();
    await vi.waitFor(() =>
      expect(started).toEqual(["first.glb", "second.glb"]),
    );
    pending.get("second.glb")!.fail();
    await vi.waitFor(() =>
      expect(started).toEqual(["first.glb", "second.glb", "third.glb"]),
    );
    pending.get("third.glb")!.succeed();
    await vi.waitFor(() => expect(active).toBe(0));
    expect(maximumActive).toBe(1);
  });

  it("bounds full GLBs and leaves an explicit aggregate fallback", () => {
    const plan = selectRepositoryCityRenderPlan(
      Array.from({ length: 90 }, (_, index) => instance(index)),
    );
    expect(plan.semantic).toHaveLength(48);
    expect(plan.aggregateCount).toBe(42);
  });

  it("keeps live and pinned Director assets visible when the semantic cap is full", () => {
    const automatic = Array.from({ length: 60 }, (_, index) => instance(index));
    const live = {
      ...instance(60),
      instanceId: "event:test.failed:run-60",
      assetId: "07-failing-build-alarm" as const,
    };
    const manual = {
      ...instance(61),
      instanceId: "manual:61",
      assetId: "26-deployment-portal" as const,
      pinned: true,
      manual: true,
      linkedRepoData: null,
      sourceEvent: null,
    };
    const plan = selectRepositoryCityRenderPlan([...automatic, live, manual]);
    expect(plan.semantic).toHaveLength(48);
    expect(plan.semantic).toContainEqual(live);
    expect(plan.semantic).toContainEqual(manual);
    expect(plan.aggregateCount).toBe(14);
  });

  it("provides animated and reduced-motion semantic frames", () => {
    expect(repositoryMaterializationFrame(0, false)).toMatchObject({
      y: -2.5,
      scanOpacity: 0.8,
      settled: false,
    });
    expect(repositoryMaterializationFrame(1, false)).toMatchObject({
      y: 0,
      emissive: 0,
      scanOpacity: 0,
      settled: true,
    });
    expect(repositoryMaterializationFrame(0, true)).toEqual({
      y: 0,
      opacity: 1,
      emissive: 0,
      scanOpacity: 0,
      particleProgress: 1,
      settled: true,
    });
  });

  it("preserves source materials when idle and bounds status tint to truthful state", () => {
    expect(repositoryMaterialTint("idle", false, true)).toBeNull();
    expect(repositoryMaterialTint("idle", true, true)).toBe("#41e9ff");
    expect(repositoryMaterialTint("idle", false, false)).toBe("#41e9ff");
    expect(repositoryMaterialTint("pending", false, true)).toBe("#ffbf47");
    expect(repositoryMaterialTint("failure", false, true)).toBe("#ff4d63");
    expect(repositoryMaterialTint("special", false, true)).toBe("#b76cff");
  });
});
