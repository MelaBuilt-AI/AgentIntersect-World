import { describe, expect, it } from "vitest";

import type { RepositoryRenderObject } from "../src/index.js";
import { REPOSITORY_ASSET_BY_ID } from "../src/repository-asset-manifest.js";
import {
  createRepositoryCityState,
  parseRepositoryCityEvent,
  projectRepositoryObjects,
  reduceRepositoryCity,
} from "../src/repository-city-state.js";

describe("repository city state", () => {
  it("moves and rotates manual props without moving live repository objects", () => {
    const state = reduceRepositoryCity(createRepositoryCityState(), {
      type: "manual.add",
      instanceId: "manual:1",
      assetId: "01-code-slab",
      position: { x: 5, z: 5 },
    });
    const moved = reduceRepositoryCity(state, {
      type: "manual.transform",
      instanceId: "manual:1",
      position: { x: 3.25, z: 4.5 },
      yaw: 1.2,
    });
    expect(moved.instances[0]).toMatchObject({
      position: { x: 3.25, z: 4.5 },
      yaw: 1.2,
      manual: true,
      pinned: true,
    });
    const live = { instances: [{ ...state.instances[0]!, manual: false }] };
    expect(
      reduceRepositoryCity(live, {
        type: "manual.transform",
        instanceId: "manual:1",
        position: { x: 0, z: 0 },
        yaw: 2,
      }).instances[0],
    ).toEqual(live.instances[0]);
  });
  it("keeps a dense repository and separately loaded relay inside the rendered floor", () => {
    const objects: RepositoryRenderObject[] = Array.from(
      { length: 1_125 },
      (_, index) => ({
        ref: `aiw://object/city-${String(index).padStart(2, "0")}`,
        kind: index === 0 ? "package" : index % 4 === 0 ? "directory" : "file",
        fileKind: index % 5 === 0 ? "documentation" : "source",
        name: `city-${index}`,
        position: { x: 0, y: 0, z: 0 },
        bounds: { x: 0, z: 0, width: 2, depth: 2 },
      }),
    );
    const initial = projectRepositoryObjects(objects);
    const withRelay = reduceRepositoryCity(
      { instances: initial },
      {
        type: "event",
        event: { id: "world-chat", type: "conversation.activity" },
      },
    ).instances;

    expect(projectRepositoryObjects(objects)).toEqual(initial);
    expect(initial).toHaveLength(48);
    expect(withRelay).toHaveLength(49);
    for (const instance of withRelay) {
      const [width, depth] = REPOSITORY_ASSET_BY_ID.get(
        instance.assetId,
      )!.footprint;
      expect(
        Math.abs(instance.position.x) + width / 2 + 0.5,
      ).toBeLessThanOrEqual(17);
      expect(
        Math.abs(instance.position.z) + depth / 2 + 0.5,
      ).toBeLessThanOrEqual(17);
    }
    for (let left = 0; left < withRelay.length; left += 1) {
      for (let right = left + 1; right < withRelay.length; right += 1) {
        const a = withRelay[left]!;
        const b = withRelay[right]!;
        const [aWidth, aDepth] = REPOSITORY_ASSET_BY_ID.get(
          a.assetId,
        )!.footprint;
        const [bWidth, bDepth] = REPOSITORY_ASSET_BY_ID.get(
          b.assetId,
        )!.footprint;
        expect(
          Math.abs(a.position.x - b.position.x) >=
            (aWidth + bWidth) / 2 + 0.5 ||
            Math.abs(a.position.z - b.position.z) >=
              (aDepth + bDepth) / 2 + 0.5,
        ).toBe(true);
      }
    }
    const relay = withRelay.at(-1)!;
    const gates = withRelay.filter(
      ({ assetId }) => assetId === "05-directory-archive-gate",
    );
    expect(relay.assetId).toBe("20-live-collaboration-relay");
    expect(
      gates.every(
        ({ position }) =>
          position.x !== relay.position.x || position.z !== relay.position.z,
      ),
    ).toBe(true);
  });

  it("separates a real directory gate and live relay hash collision by both footprints", () => {
    const gate = projectRepositoryObjects([
      {
        ref: "aiw://object/collision-49",
        kind: "directory",
        name: "src",
        position: { x: 0, y: 0, z: 0 },
        bounds: { x: 0, z: 0, width: 2, depth: 2 },
      },
    ])[0]!;
    const state = reduceRepositoryCity(
      { instances: [gate] },
      {
        type: "event",
        event: { id: "world-chat", type: "conversation.activity" },
      },
    );
    const relay = state.instances[1]!;
    const gateFootprint = REPOSITORY_ASSET_BY_ID.get(gate.assetId)!.footprint;
    const relayFootprint = REPOSITORY_ASSET_BY_ID.get(relay.assetId)!.footprint;

    expect(gate.position).not.toEqual(relay.position);
    expect(
      Math.abs(gate.position.x - relay.position.x) >=
        (gateFootprint[0] + relayFootprint[0]) / 2 + 0.5 ||
        Math.abs(gate.position.z - relay.position.z) >=
          (gateFootprint[1] + relayFootprint[1]) / 2 + 0.5,
    ).toBe(true);
    expect(gateFootprint).not.toEqual(relayFootprint);
  });

  it("projects initial repository structure deterministically around the collaboration zone", () => {
    const objects: RepositoryRenderObject[] = [
      {
        ref: "repo",
        kind: "package",
        name: "World",
        position: { x: 0, y: 0, z: 0 },
        bounds: { x: 0, z: 0, width: 2, depth: 2 },
      },
      {
        ref: "src",
        kind: "directory",
        name: "src",
        position: { x: 2, y: 0, z: 0 },
        bounds: { x: 2, z: 0, width: 2, depth: 2 },
      },
      {
        ref: "src/app.ts",
        kind: "file",
        fileKind: "source",
        name: "app.ts",
        position: { x: 4, y: 0, z: 0 },
        bounds: { x: 4, z: 0, width: 2, depth: 2 },
      },
      {
        ref: "README.md",
        kind: "file",
        fileKind: "documentation",
        name: "README.md",
        position: { x: 6, y: 0, z: 0 },
        bounds: { x: 6, z: 0, width: 2, depth: 2 },
      },
    ];
    const first = projectRepositoryObjects(objects);
    expect(projectRepositoryObjects(objects)).toEqual(first);
    expect(first.map(({ assetId }) => assetId)).toEqual([
      "04-repository-root-hub",
      "05-directory-archive-gate",
      "01-code-slab",
      "08-documentation-codex",
    ]);
    expect(first.every(({ status }) => status === "idle")).toBe(true);
    expect(
      first.every(({ position }) => Math.hypot(position.x, position.z) >= 6),
    ).toBe(true);
  });

  it("materializes and updates real events without duplicating their instance", () => {
    const event = parseRepositoryCityEvent({
      id: "tests-42",
      type: "test.failed",
      status: "failure",
      linkedRepoData: { ref: "src/app.test.ts", label: "app tests" },
    });
    let state = reduceRepositoryCity(createRepositoryCityState(), {
      type: "event",
      event,
    });
    expect(state.instances).toHaveLength(1);
    expect(state.instances[0]).toMatchObject({
      instanceId: "event:test.failed:tests-42",
      assetId: "07-failing-build-alarm",
      status: "failure",
      lifecycle: "materializing",
      pinned: false,
      manual: false,
    });
    state = reduceRepositoryCity(state, {
      type: "settled",
      instanceId: state.instances[0]!.instanceId,
    });
    expect(state.instances[0]?.lifecycle).toBe("idle");
    state = reduceRepositoryCity(state, {
      type: "event",
      event: { ...event, status: "active" },
    });
    expect(state.instances).toHaveLength(1);
    expect(state.instances[0]).toMatchObject({
      status: "active",
      lifecycle: "materializing",
    });
  });

  it("adds pinned director instances and removes only manual instances", () => {
    const existing = projectRepositoryObjects([
      {
        ref: "director-existing",
        kind: "directory",
        name: "existing",
        position: { x: 0, y: 0, z: 0 },
        bounds: { x: 0, z: 0, width: 2, depth: 2 },
      },
    ])[0]!;
    const initial = {
      instances: [{ ...existing, position: { x: 8, z: -4 } }],
    };
    let state = reduceRepositoryCity(initial, {
      type: "manual.add",
      instanceId: "manual-1",
      assetId: "26-deployment-portal",
      position: { x: 8, z: -4 },
    });
    expect(state.instances[1]).toMatchObject({
      pinned: true,
      manual: true,
    });
    expect(state.instances[1]!.position).not.toEqual({ x: 8, z: -4 });
    state = reduceRepositoryCity(state, {
      type: "remove",
      instanceId: "manual-1",
    });
    expect(state.instances).toEqual([initial.instances[0]]);
  });

  it("rejects malformed external events and ignores unobserved event types", () => {
    expect(() =>
      parseRepositoryCityEvent({ id: "x", type: "made.up" }),
    ).toThrow("Unsupported repository city event");
    expect(() => parseRepositoryCityEvent({ type: "test.failed" })).toThrow(
      "Invalid repository city event",
    );
  });
});
