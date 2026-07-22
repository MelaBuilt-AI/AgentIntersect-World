import { performance } from "node:perf_hooks";

import { describe, expect, it, vi } from "vitest";

import {
  NAVIGATION_CONTRACT_VERSION,
  TargetResolver,
  buildNavigationMesh,
  isInsideInteractionZone,
  planNavigationPath,
  replayCanonicalPath,
} from "../src/index.js";

const repositoryRef = "aiw://object/repository-a";
const sourceRef = "aiw://object/package-spatial-code-graph";
const destinationRef = "aiw://object/package-renderer-r3f";

const meshInput = {
  worldGeneration: "world-a",
  layoutGeneration: "layout-a",
  navigationBounds: { x: 0, z: 0, width: 12, depth: 8 },
  avatarRadius: 0.35,
  clearance: 0.15,
  obstacles: [
    { ref: "obstacle-b", bounds: { x: 5, z: 1, width: 1, depth: 6 } },
    { ref: "obstacle-a", bounds: { x: 8, z: 0, width: 0.5, depth: 1 } },
  ],
};

describe("deterministic navigation", () => {
  it("builds byte-stable canonical meshes and paths independent of input ordering", () => {
    const left = buildNavigationMesh(meshInput);
    const right = buildNavigationMesh({
      ...meshInput,
      obstacles: [...meshInput.obstacles].reverse(),
    });
    expect(NAVIGATION_CONTRACT_VERSION).toBe("aiw.navigation/navmesh/0.13");
    expect(left.version).toBe("aiw.navigation/navmesh/0.13");
    expect(left.polygons.length).toBeGreaterThan(0);
    expect(left.portals.length).toBeGreaterThan(0);
    expect(left.polygons.every((polygon) => polygon.vertices.length >= 3)).toBe(
      true,
    );
    expect(
      left.portals.every(
        (portal) =>
          portal.fromPolygon !== portal.toPolygon &&
          portal.vertices.length === 2,
      ),
    ).toBe(true);
    expect(left).not.toHaveProperty("cellSize");
    expect(left).not.toHaveProperty("columns");
    expect(left).not.toHaveProperty("rows");
    expect(left).not.toHaveProperty("blockedCells");
    expect(JSON.stringify(left)).toBe(JSON.stringify(right));

    const first = planNavigationPath(
      left,
      { x: 1, z: 4 },
      { x: 11, z: 4 },
      0.55,
    );
    const second = planNavigationPath(
      right,
      { x: 1, z: 4 },
      { x: 11, z: 4 },
      0.55,
    );
    expect(first).toEqual(second);
    expect(first.status).toBe("planned");
    expect(first.corners.length).toBeGreaterThan(2);
    expect(first.corners.some(({ z }) => z >= 7.5)).toBe(true);
    expect(replayCanonicalPath(first, 0.25)).toEqual(
      replayCanonicalPath(second, 0.25),
    );
    expect(
      isInsideInteractionZone(first.corners.at(-1)!, { x: 11, z: 4 }, 0.55),
    ).toBe(true);
  });

  it("accepts canonical World object refs as obstacle identities", () => {
    const objectRef = "aiw://object/5945c0cb781084ed7fe18a85b9e6db43";
    const mesh = buildNavigationMesh({
      ...meshInput,
      obstacles: [
        { ref: objectRef, bounds: { x: 5, z: 1, width: 1, depth: 6 } },
      ],
    });
    expect(mesh.obstacles).toEqual([
      { ref: objectRef, bounds: { x: 5, z: 1, width: 1, depth: 6 } },
    ]);
    expect(() =>
      buildNavigationMesh({
        ...meshInput,
        obstacles: [
          {
            ref: `${objectRef}?unbounded=query`,
            bounds: { x: 5, z: 1, width: 1, depth: 6 },
          },
        ],
      }),
    ).toThrow("Invalid obstacle ref");
  });

  it("reports blocked without claiming arrival and binds paths to exact revisions", () => {
    const mesh = buildNavigationMesh({
      ...meshInput,
      obstacles: [{ ref: "wall", bounds: { x: 5, z: 0, width: 2, depth: 8 } }],
    });
    const result = planNavigationPath(
      mesh,
      { x: 1, z: 4 },
      { x: 11, z: 4 },
      0.5,
    );
    expect(result).toMatchObject({
      status: "blocked",
      arrived: false,
      worldGeneration: "world-a",
      layoutGeneration: "layout-a",
      navigationVersion: NAVIGATION_CONTRACT_VERSION,
    });
    expect(result.corners).toEqual([]);
  });

  it("keeps ready path queries bounded for an aggregate fixture", () => {
    const mesh = buildNavigationMesh({
      ...meshInput,
      navigationBounds: { x: 0, z: 0, width: 250, depth: 250 },
      obstacles: Array.from({ length: 100 }, (_, index) => ({
        ref: `obstacle-${String(index).padStart(3, "0")}`,
        bounds: { x: 2 + index * 2, z: 100, width: 0.5, depth: 4 },
      })),
    });
    const started = performance.now();
    const result = planNavigationPath(
      mesh,
      { x: 1, z: 1 },
      { x: 245, z: 245 },
      1,
    );
    expect(result.status).toBe("planned");
    expect(performance.now() - started).toBeLessThan(150);
  });
});

describe("continuity-aware target resolution", () => {
  const revision = {
    repositoryRef,
    worldGeneration: "world-a",
    layoutGeneration: "layout-a",
    graphGeneration: "00000000-0000-4000-8000-000000000002",
  };

  it("prevalidates current refs and authoritative renames atomically with requested/current truth", async () => {
    const resolver = new TargetResolver(revision, [
      {
        objectRef: sourceRef,
        repositoryRef,
        state: "current",
        path: "packages/spatial-code-graph",
      },
      {
        objectRef: destinationRef,
        repositoryRef,
        state: "current",
        path: "packages/renderer-r3f",
        previousPaths: ["packages/renderer-three"],
        continuity: "authoritative",
      },
    ]);
    const result = await resolver.prevalidate([
      { kind: "focus", target: { repositoryRef, objectRef: sourceRef } },
      {
        kind: "navigate",
        target: {
          repositoryRef,
          objectRef: destinationRef,
          requestedPath: "packages/renderer-three",
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.targets[1]).toMatchObject({
        requestedPath: "packages/renderer-three",
        currentPath: "packages/renderer-r3f",
        continuity: "renamed-authoritative",
      });
    }
  });

  it("rejects a whole batch for cross-repository, ambiguous, deleted, or invalid tombstone use", async () => {
    const resolver = new TargetResolver(revision, [
      {
        objectRef: sourceRef,
        repositoryRef,
        state: "current",
        path: "packages/spatial-code-graph",
      },
      {
        objectRef: destinationRef,
        repositoryRef,
        state: "tombstone",
        path: "packages/renderer-r3f",
      },
    ]);
    await expect(
      resolver.prevalidate([
        { kind: "focus", target: { repositoryRef, objectRef: sourceRef } },
        {
          kind: "navigate",
          target: { repositoryRef, objectRef: destinationRef },
        },
      ]),
    ).resolves.toMatchObject({
      ok: false,
      reason: "tombstone-not-navigable",
      acceptedCount: 0,
    });
    await expect(
      resolver.prevalidate([
        {
          kind: "focus",
          target: { repositoryRef: "aiw://object/other", objectRef: sourceRef },
        },
      ]),
    ).resolves.toMatchObject({
      ok: false,
      reason: "cross-repository",
      acceptedCount: 0,
    });
  });

  it("performs one bounded authoritative lookup and fails closed on mid-run revision invalidation", async () => {
    const lookup = vi.fn(async (objectRef: string) =>
      objectRef === destinationRef
        ? {
            objectRef,
            repositoryRef,
            state: "current" as const,
            path: "packages/renderer-r3f",
          }
        : null,
    );
    const resolver = new TargetResolver(revision, [], { lookup });
    const result = await resolver.prevalidate([
      { kind: "focus", target: { repositoryRef, objectRef: destinationRef } },
      { kind: "inspect", target: { repositoryRef, objectRef: destinationRef } },
    ]);
    expect(result.ok).toBe(true);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(resolver.validateDuringRun(destinationRef, revision)).toEqual({
      valid: true,
    });
    expect(
      resolver.validateDuringRun(destinationRef, {
        ...revision,
        graphGeneration: "00000000-0000-4000-8000-000000000099",
      }),
    ).toEqual({
      valid: false,
      reason: "revision-changed",
      cancelRemainder: true,
    });
  });
});
