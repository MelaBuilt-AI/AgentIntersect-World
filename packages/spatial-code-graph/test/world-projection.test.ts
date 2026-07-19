import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";
import type {
  RepositoryFile,
  RepositoryGeneration,
  WorldFileObject,
  WorldObject,
  WorldTombstoneObject,
} from "@agentintersect-world/world-schema";
import { RepositoryGenerationSchema } from "@agentintersect-world/world-schema";

import {
  MAX_AGGREGATE_PROOF_OBJECTS,
  WorldProjectionError,
  WorldTileQueryError,
  buildAggregateScaleProof,
  projectRepositoryGeneration,
  queryWorldTiles,
} from "../src/index.js";

const ROOT = "/private/operator/workspaces/fixture";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function file(
  path: string,
  contentHash: string | null = HASH_A,
): RepositoryFile {
  return {
    path,
    size: 12,
    fileKind: "source",
    language: "TypeScript",
    binary: false,
    oversized: false,
    contentHash,
    gitStatus: null,
  };
}

function generation(
  files: RepositoryFile[],
  fingerprint = "1".repeat(64),
): RepositoryGeneration {
  return {
    id: "88c22eef-64c8-493e-ad67-87ed41f64666",
    fingerprint,
    rootPath: ROOT,
    repositoryName: "fixture",
    startedAt: "2026-07-19T12:00:00.000Z",
    completedAt: "2026-07-19T12:00:01.000Z",
    durationMs: 1_000,
    git: { present: false, branch: null, head: null, dirty: false },
    directories: [
      { path: "", fileCount: files.length },
      { path: "src", fileCount: files.length },
    ],
    files,
    packages: [],
    coverage: {
      discoveredFiles: files.length,
      indexedFiles: files.length,
      prunedEntries: 0,
      skippedSymlinks: 0,
      directories: 2,
      packages: 0,
      binaryFiles: 0,
      oversizedFiles: 0,
      bytesHashed: files.length * 12,
    },
  };
}

const objects = <K extends WorldObject["kind"]>(
  snapshot: ReturnType<typeof projectRepositoryGeneration>,
  kind: K,
) => snapshot.objects.filter((object) => object.kind === kind);

function overlaps(a: WorldObject, b: WorldObject): boolean {
  return !(
    a.bounds.x + a.bounds.width <= b.bounds.x ||
    b.bounds.x + b.bounds.width <= a.bounds.x ||
    a.bounds.z + a.bounds.depth <= b.bounds.z ||
    b.bounds.z + b.bounds.depth <= a.bounds.z
  );
}

function expectContainedAndNonOverlapping(
  snapshot: ReturnType<typeof projectRepositoryGeneration>,
) {
  const byRef = new Map(snapshot.objects.map((object) => [object.ref, object]));
  for (const parent of snapshot.objects) {
    const children = parent.childRefs.map((ref) => byRef.get(ref));
    expect(children.every(Boolean)).toBe(true);
    for (const child of children) {
      if (!child) continue;
      expect(Number.isFinite(child.position.x)).toBe(true);
      expect(child.bounds.x).toBeGreaterThanOrEqual(parent.bounds.x);
      expect(child.bounds.z).toBeGreaterThanOrEqual(parent.bounds.z);
      expect(child.bounds.x + child.bounds.width).toBeLessThanOrEqual(
        parent.bounds.x + parent.bounds.width,
      );
      expect(child.bounds.z + child.bounds.depth).toBeLessThanOrEqual(
        parent.bounds.z + parent.bounds.depth,
      );
    }
    const spatialOrder = children
      .filter((child): child is WorldObject => child !== undefined)
      .sort((left, right) => left.bounds.x - right.bounds.x);
    for (let index = 1; index < spatialOrder.length; index += 1) {
      const left = spatialOrder[index - 1];
      const right = spatialOrder[index];
      if (left && right) expect(overlaps(left, right)).toBe(false);
    }
  }
}

function expectUniqueReciprocalHierarchy(
  snapshot: ReturnType<typeof projectRepositoryGeneration>,
) {
  expect(new Set(snapshot.objects.map(({ id }) => id)).size).toBe(
    snapshot.objects.length,
  );
  expect(new Set(snapshot.objects.map(({ ref }) => ref)).size).toBe(
    snapshot.objects.length,
  );
  const byRef = new Map(snapshot.objects.map((object) => [object.ref, object]));
  for (const object of snapshot.objects) {
    if (object.parentRef !== null) {
      const parent = byRef.get(object.parentRef);
      expect(parent?.childRefs).toContain(object.ref);
    }
    for (const childRef of object.childRefs) {
      expect(byRef.get(childRef)?.parentRef).toBe(object.ref);
    }
  }
}

function nodeDigest(...values: string[]): string {
  return createHash("sha256").update(values.join("\0"), "utf8").digest("hex");
}

describe("Phase 4 deterministic World projection", () => {
  it("normalizes separators and NFC while retaining case-sensitive paths", () => {
    const decomposed = projectRepositoryGeneration(
      generation([file("src\\cafe\u0301.ts")]),
    );
    const composed = projectRepositoryGeneration(
      generation([file("src/café.ts")]),
    );
    expect(JSON.stringify(decomposed)).toBe(JSON.stringify(composed));
    expect(objects(composed, "file")[0]?.path).toBe("src/café.ts");

    const differentlyCased = projectRepositoryGeneration(
      generation([file("src/Café.ts")]),
    );
    expect(objects(differentlyCased, "file")[0]?.id).not.toBe(
      objects(composed, "file")[0]?.id,
    );
  });

  it("rejects separator and Unicode canonical collisions with a typed error", () => {
    for (const paths of [
      ["src/a.ts", "src\\a.ts"],
      ["src/café.ts", "src/cafe\u0301.ts"],
    ]) {
      const collision = generation(paths.map((path) => file(path)));
      expect(() => projectRepositoryGeneration(collision)).toThrow(
        WorldProjectionError,
      );
      try {
        projectRepositoryGeneration(collision);
      } catch (error) {
        expect(error).toMatchObject({ code: "canonical_collision" });
        expect(JSON.stringify(error)).not.toContain(ROOT);
      }
    }
  });

  it("retains same-path and unique exact-content rename identity with bounded history", () => {
    const previous = projectRepositoryGeneration(
      generation([file("src/old.ts", HASH_A), file("src/stable.ts", HASH_B)]),
    );
    const current = projectRepositoryGeneration(
      generation([file("src/new.ts", HASH_A), file("src/stable.ts", HASH_B)]),
      { previousSnapshot: previous },
    );
    const priorFiles = objects(previous, "file") as WorldFileObject[];
    const files = objects(current, "file") as WorldFileObject[];
    expect(files.find(({ path }) => path === "src/stable.ts")?.id).toBe(
      priorFiles.find(({ path }) => path === "src/stable.ts")?.id,
    );
    const renamed = files.find(({ path }) => path === "src/new.ts");
    expect(renamed?.id).toBe(
      priorFiles.find(({ path }) => path === "src/old.ts")?.id,
    );
    expect(renamed?.pathHistory).toEqual([
      expect.objectContaining({
        path: "src/old.ts",
        confidence: "exact-content",
        caseOnly: false,
      }),
    ]);
  });

  it("marks a unique case-only rename explicitly", () => {
    const previous = projectRepositoryGeneration(
      generation([file("src/Case.ts", HASH_A)]),
    );
    const current = projectRepositoryGeneration(
      generation([file("src/case.ts", HASH_A)]),
      { previousSnapshot: previous },
    );
    const prior = objects(previous, "file")[0] as WorldFileObject;
    const renamed = objects(current, "file")[0] as WorldFileObject;
    expect(renamed.id).toBe(prior.id);
    expect(renamed.pathHistory.at(-1)).toMatchObject({ caseOnly: true });
  });

  it("does not reuse history from a different private repository identity", () => {
    const previous = projectRepositoryGeneration(
      generation([file("src/a.ts")]),
    );
    const otherRoot = {
      ...generation([file("src/a.ts")]),
      rootPath: "/private/operator/workspaces/other-fixture",
    };
    const current = projectRepositoryGeneration(otherRoot, {
      previousSnapshot: previous,
    });
    expect(objects(current, "file")[0]?.id).not.toBe(
      objects(previous, "file")[0]?.id,
    );
  });

  it("never guesses ambiguous exact-content renames and emits bounded tombstones", () => {
    const previous = projectRepositoryGeneration(
      generation([file("src/a.ts"), file("src/b.ts")]),
    );
    const current = projectRepositoryGeneration(
      generation([file("src/c.ts"), file("src/d.ts")]),
      { previousSnapshot: previous },
    );
    const oldIds = new Set(objects(previous, "file").map(({ id }) => id));
    expect(objects(current, "file").every(({ id }) => !oldIds.has(id))).toBe(
      true,
    );
    const tombstones = objects(current, "tombstone") as WorldTombstoneObject[];
    expect(tombstones.map(({ id }) => id).sort()).toEqual([...oldIds].sort());
    expect(tombstones.length).toBeLessThanOrEqual(256);
  });

  it("reconciles same-path resurrection and unique tombstone-backed reintroduction", () => {
    const original = projectRepositoryGeneration(
      generation([file("src/a.ts", HASH_A)]),
    );
    const removed = projectRepositoryGeneration(generation([]), {
      previousSnapshot: original,
    });
    const restored = projectRepositoryGeneration(
      generation([file("src/a.ts", HASH_B)]),
      { previousSnapshot: removed },
    );
    const restoredAgain = projectRepositoryGeneration(
      generation([file("src/a.ts", HASH_B)]),
      { previousSnapshot: removed },
    );
    expect((objects(restored, "file")[0] as WorldFileObject).id).toBe(
      (objects(original, "file")[0] as WorldFileObject).id,
    );
    expect(objects(restored, "tombstone")).toEqual([]);
    expect(JSON.stringify(restoredAgain)).toBe(JSON.stringify(restored));
    expectUniqueReciprocalHierarchy(restored);

    const reintroduced = projectRepositoryGeneration(
      generation([file("src/reintroduced.ts", HASH_A)]),
      { previousSnapshot: removed },
    );
    const live = objects(reintroduced, "file")[0] as WorldFileObject;
    expect(live.id).toBe((objects(original, "file")[0] as WorldFileObject).id);
    expect(live.pathHistory.at(-1)).toMatchObject({
      path: "src/a.ts",
      confidence: "exact-content",
      caseOnly: false,
    });
    expect(objects(reintroduced, "tombstone")).toEqual([]);
    expectUniqueReciprocalHierarchy(reintroduced);
  });

  it("matches independent delimiter-only SHA-256 identity vectors", () => {
    const ascii = projectRepositoryGeneration(
      generation([file("src/a.ts", HASH_A)]),
    );
    const asciiPrivateKey = nodeDigest("aiw.identity/1", ROOT);
    const expectedRepositoryId = nodeDigest(
      "aiw.identity/1",
      asciiPrivateKey,
      "repository",
    ).slice(0, 32);
    const expectedFileId = nodeDigest(
      "aiw.identity/1",
      asciiPrivateKey,
      "file",
      "src/a.ts",
    ).slice(0, 32);
    expect(ascii.repositoryRef).toBe(
      "aiw://object/ee0c463b51663994a938e656bad37981",
    );
    expect(ascii.repositoryRef).toBe(`aiw://object/${expectedRepositoryId}`);
    expect((objects(ascii, "file")[0] as WorldFileObject).id).toBe(
      expectedFileId,
    );

    const unicodeRoot = "/private/operator/🪐";
    const unicodePath = "src/🧪.ts";
    const unicode = projectRepositoryGeneration({
      ...generation([file(unicodePath, HASH_A)]),
      rootPath: unicodeRoot,
    });
    const unicodePrivateKey = nodeDigest("aiw.identity/1", unicodeRoot);
    expect(unicode.repositoryRef).toBe(
      `aiw://object/${nodeDigest("aiw.identity/1", unicodePrivateKey, "repository").slice(0, 32)}`,
    );
    expect((objects(unicode, "file")[0] as WorldFileObject).id).toBe(
      nodeDigest(
        "aiw.identity/1",
        unicodePrivateKey,
        "file",
        unicodePath,
      ).slice(0, 32),
    );

    expect(() =>
      projectRepositoryGeneration(generation([file("src/a\0b.ts")])),
    ).toThrow(WorldProjectionError);
  });

  it("enforces Phase 3 path/name boundaries and lays out maximum valid depth stack-safely", () => {
    const maximumName = `${"n".repeat(509)}.ts`;
    const maximumPath = `${"a/".repeat(1792)}${"b".repeat(512)}`;
    const atBoundary = generation([
      file(`src/${maximumName}`, HASH_A),
      file(maximumPath, HASH_B),
    ]);
    expect(RepositoryGenerationSchema.safeParse(atBoundary).success).toBe(true);
    const boundarySnapshot = projectRepositoryGeneration(atBoundary);
    expect(objects(boundarySnapshot, "file")).toHaveLength(2);

    for (const overLimit of [
      generation([file(`src/${"n".repeat(510)}.ts`)]),
      generation([file(`${"a/".repeat(1792)}${"b".repeat(513)}`)]),
    ]) {
      expect(RepositoryGenerationSchema.safeParse(overLimit).success).toBe(
        false,
      );
      expect(() => projectRepositoryGeneration(overLimit)).toThrow(
        WorldProjectionError,
      );
      try {
        projectRepositoryGeneration(overLimit);
      } catch (error) {
        expect(JSON.stringify(error)).not.toContain(ROOT);
      }
    }

    const deepestDirectories = Array.from({ length: 2_048 }, (_, index) => ({
      path: "d/".repeat(index) + "d",
      fileCount: 0,
    }));
    const deep = {
      ...generation([]),
      directories: deepestDirectories,
      coverage: { ...generation([]).coverage, directories: 2_048 },
    };
    expect(RepositoryGenerationSchema.safeParse(deep).success).toBe(true);
    const first = projectRepositoryGeneration(deep);
    const second = projectRepositoryGeneration(deep);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(objects(first, "directory")).toHaveLength(2_048);
    expectContainedAndNonOverlapping(first);
  });

  it("bounds retained path history and tombstones at their documented constants", () => {
    let snapshot = projectRepositoryGeneration(
      generation([file("src/file-00.ts")]),
    );
    for (let index = 1; index <= 12; index += 1) {
      snapshot = projectRepositoryGeneration(
        generation([file(`src/file-${index.toString().padStart(2, "0")}.ts`)]),
        { previousSnapshot: snapshot },
      );
    }
    expect(
      (objects(snapshot, "file")[0] as WorldFileObject).pathHistory,
    ).toHaveLength(8);

    const removed = Array.from({ length: 300 }, (_, index) =>
      file(`src/removed-${index.toString().padStart(3, "0")}.ts`),
    );
    const prior = projectRepositoryGeneration(generation(removed));
    const tombstoned = projectRepositoryGeneration(generation([]), {
      previousSnapshot: prior,
    });
    expect(objects(tombstoned, "tombstone")).toHaveLength(256);
  });

  it("projects package objects into the deterministic hierarchy", () => {
    const input = generation([file("src/a.ts")]);
    const snapshot = projectRepositoryGeneration({
      ...input,
      packages: [{ path: "package.json", kind: "npm", name: "fixture" }],
      coverage: { ...input.coverage, packages: 1 },
    });
    expect(objects(snapshot, "package")).toEqual([
      expect.objectContaining({
        kind: "package",
        path: "package.json",
        packageKind: "npm",
        packageName: "fixture",
      }),
    ]);
    expectContainedAndNonOverlapping(snapshot);
  });

  it("produces deterministic private, contained, non-overlapping layout and bounded tiles", () => {
    const input = generation([
      file("src/a.ts", HASH_A),
      file("src/b.test.ts", HASH_B),
    ]);
    const first = projectRepositoryGeneration(input);
    const second = projectRepositoryGeneration(input);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(first)).not.toContain(ROOT);
    expectContainedAndNonOverlapping(first);
    expect(first.tiles.length).toBeLessThanOrEqual(341);
    const response = queryWorldTiles(first, {
      lod: 4,
      minX: 0,
      maxX: 15,
      minZ: 0,
      maxZ: 15,
      limit: 2,
    });
    expect(response.tiles.length).toBeLessThanOrEqual(2);
    expect(JSON.stringify(response)).not.toContain(ROOT);
    expect(() =>
      queryWorldTiles(first, {
        lod: 5,
        minX: 0,
        maxX: 15,
        minZ: 0,
        maxZ: 15,
        limit: 1,
      }),
    ).toThrow(WorldTileQueryError);
    expect(() =>
      projectRepositoryGeneration(input, {
        unexpected: true,
      } as never),
    ).toThrow(WorldProjectionError);
  });

  it("serializes byte-identically in separate fresh processes", () => {
    const command = [
      "--import",
      "tsx",
      "packages/spatial-code-graph/test/fresh-process.ts",
    ];
    const first = execFileSync(process.execPath, command, { encoding: "utf8" });
    const second = execFileSync(process.execPath, command, {
      encoding: "utf8",
    });
    expect(first).toBe(second);
    expect(first).not.toContain(ROOT);
  });

  it("lays out the 10,000-file full-detail cap and proves 100,000 aggregate objects bounded", () => {
    const files = Array.from({ length: 10_000 }, (_, index) =>
      file(`src/file-${index.toString().padStart(5, "0")}.ts`, null),
    );
    const snapshot = projectRepositoryGeneration(generation(files));
    expect(objects(snapshot, "file")).toHaveLength(10_000);
    expect(snapshot.tiles.length).toBeLessThanOrEqual(341);
    expectContainedAndNonOverlapping(snapshot);

    const proof = buildAggregateScaleProof(MAX_AGGREGATE_PROOF_OBJECTS);
    expect(proof).toMatchObject({
      objectCount: 100_000,
      materializedObjects: 0,
      collisionFree: true,
      contained: true,
    });
    expect(proof.tiles.length).toBeLessThanOrEqual(341);
  }, 20_000);
});
