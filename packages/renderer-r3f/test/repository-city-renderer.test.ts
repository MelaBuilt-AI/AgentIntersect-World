import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { describe, expect, it, vi } from "vitest";

import {
  RepositoryCityGLTFLoader,
  markCityArrivalBatch,
  markCityStreamCue,
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

  it("uses one collective cue per repo phase without swallowing later individual arrivals", () => {
    const phases = { up: new Set<string>(), in: new Set<string>() };
    const batch = Array.from({ length: 15 }, (_, index) => instance(index));
    const emit = (id: string, phase: "up" | "in", population = batch) =>
      markCityStreamCue(phases[phase], id, population);
    expect(
      batch.map((item) => emit(item.instanceId, "up")).filter(Boolean),
    ).toEqual(["collective"]);
    const event = { ...instance(20), instanceId: "event:file.updated:work-1" };
    const population = [...batch, event];
    expect(emit(event.instanceId, "up", population)).toBe("individual");
    expect(
      batch
        .map((item) => emit(item.instanceId, "in", population))
        .filter(Boolean),
    ).toEqual(["collective"]);
    expect(emit(event.instanceId, "in", population)).toBe("individual");
    expect(emit(event.instanceId, "in", population)).toBeNull();
    expect(
      emit("repository:next-project", "up", [
        instance(21),
        { ...instance(22), instanceId: "repository:next-project" },
      ]),
    ).toBe("collective");
  });

  it("coalesces simultaneous city sounds and plays again for a later arrival", () => {
    const started = new Set<string>();
    const batch = [instance(0), instance(1)];
    expect(markCityArrivalBatch(started, batch[0]!.instanceId, batch)).toBe(
      true,
    );
    expect(markCityArrivalBatch(started, batch[1]!.instanceId, batch)).toBe(
      false,
    );
    const later = [...batch, instance(2)];
    expect(markCityArrivalBatch(started, later[2]!.instanceId, later)).toBe(
      true,
    );
    expect(markCityArrivalBatch(started, later[2]!.instanceId, later)).toBe(
      false,
    );
  });

  it("preserves source materials when idle and bounds status tint to truthful state", () => {
    expect(repositoryMaterialTint("idle", false)).toBeNull();
    expect(repositoryMaterialTint("idle", true)).toBe("#41e9ff");
    expect(repositoryMaterialTint("idle", false)).toBeNull();
    expect(repositoryMaterialTint("pending", false)).toBe("#ffbf47");
    expect(repositoryMaterialTint("failure", false)).toBe("#ff4d63");
    expect(repositoryMaterialTint("special", false)).toBe("#b76cff");
  });
});
