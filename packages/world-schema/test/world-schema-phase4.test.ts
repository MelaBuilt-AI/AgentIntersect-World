import { describe, expect, it } from "vitest";

import {
  CurrentWorldSnapshotDataSchema,
  RepositoryGenerationSchema,
  WORLD_LAYOUT_VERSION,
  WORLD_SCHEMA_VERSION,
  WorldIdentityVersionSchema,
  WorldLayoutVersionSchema,
  WorldSchemaVersionSchema,
  WorldSnapshotSchema,
  WorldTileQuerySchema,
  WorldTileQueryResponseSchema,
} from "../src/index.js";

const ref = (value: string) => `aiw://object/${value.padStart(32, "0")}`;

const minimalSnapshot = {
  schema: WORLD_SCHEMA_VERSION,
  identityVersion: "aiw.identity/1",
  layoutVersion: WORLD_LAYOUT_VERSION,
  snapshotId: "1".repeat(32),
  generationFingerprint: "a".repeat(64),
  workspaceRef: ref("1"),
  repositoryRef: ref("2"),
  objects: [
    {
      kind: "workspace",
      id: "1".repeat(32),
      ref: ref("1"),
      name: "Local workspace",
      parentRef: null,
      childRefs: [ref("2")],
      position: { x: 2, y: 0, z: 2 },
      bounds: { x: 0, z: 0, width: 4, depth: 4 },
    },
    {
      kind: "repository",
      id: "2".repeat(32),
      ref: ref("2"),
      name: "fixture",
      parentRef: ref("1"),
      childRefs: [],
      position: { x: 2, y: 1, z: 2 },
      bounds: { x: 1, z: 1, width: 2, depth: 2 },
    },
  ],
  tiles: [],
  limits: {
    fullDetailFiles: 10_000,
    maxTileRecords: 128,
    maxPathHistory: 8,
    maxTombstones: 256,
  },
};

describe("Phase 4 World schemas", () => {
  it("exports strict schema, identity, and layout version literals", () => {
    expect(WorldSchemaVersionSchema.parse("aiw.world/0.4")).toBe(
      WORLD_SCHEMA_VERSION,
    );
    expect(WorldIdentityVersionSchema.parse("aiw.identity/1")).toBe(
      "aiw.identity/1",
    );
    expect(WorldLayoutVersionSchema.parse("aiw.layout/grid/1")).toBe(
      WORLD_LAYOUT_VERSION,
    );
    expect(() => WorldLayoutVersionSchema.parse("aiw.layout/grid/2")).toThrow();
  });

  it("accepts a strict aiw.world/0.4 snapshot and current API payload", () => {
    expect(WorldSnapshotSchema.parse(minimalSnapshot)).toEqual(minimalSnapshot);
    expect(
      CurrentWorldSnapshotDataSchema.parse({ snapshot: minimalSnapshot }),
    ).toEqual({ snapshot: minimalSnapshot });
    expect(() =>
      WorldSnapshotSchema.parse({
        ...minimalSnapshot,
        rootPath: "/private/root",
      }),
    ).toThrow();
  });

  it("rejects unknown object fields and non-finite layout numbers", () => {
    const repository = minimalSnapshot.objects[1];
    expect(() =>
      WorldSnapshotSchema.parse({
        ...minimalSnapshot,
        objects: [{ ...repository, rootPath: "/private/root" }],
      }),
    ).toThrow();
    expect(() =>
      WorldSnapshotSchema.parse({
        ...minimalSnapshot,
        objects: [
          {
            ...repository,
            bounds: { ...repository?.bounds, width: Number.POSITIVE_INFINITY },
          },
        ],
      }),
    ).toThrow();
  });

  it("bounds strict tile queries and responses", () => {
    const query = {
      lod: 2,
      minX: 0,
      maxX: 3,
      minZ: 0,
      maxZ: 3,
      limit: 64,
    };
    expect(WorldTileQuerySchema.parse(query)).toEqual(query);
    expect(
      WorldTileQueryResponseSchema.parse({
        schema: WORLD_SCHEMA_VERSION,
        snapshotId: minimalSnapshot.snapshotId,
        query,
        tiles: [],
      }),
    ).toMatchObject({ query, tiles: [] });
    expect(() => WorldTileQuerySchema.parse({ ...query, lod: 5 })).toThrow();
    expect(() =>
      WorldTileQuerySchema.parse({ ...query, limit: 129 }),
    ).toThrow();
    expect(() =>
      WorldTileQuerySchema.parse({ ...query, minX: 3, maxX: 2 }),
    ).toThrow();
    expect(() =>
      WorldTileQuerySchema.parse({ ...query, unexpected: true }),
    ).toThrow();
  });

  it("bounds Phase 3 paths and display-name segments at the World contract", () => {
    const base = {
      id: "88c22eef-64c8-493e-ad67-87ed41f64666",
      fingerprint: "1".repeat(64),
      rootPath: "/private/operator/workspaces/fixture",
      repositoryName: "fixture",
      startedAt: "2026-07-19T12:00:00.000Z",
      completedAt: "2026-07-19T12:00:01.000Z",
      durationMs: 1_000,
      git: { present: false, branch: null, head: null, dirty: false },
      directories: [],
      files: [],
      packages: [],
      coverage: {
        discoveredFiles: 0,
        indexedFiles: 0,
        prunedEntries: 0,
        skippedSymlinks: 0,
        directories: 0,
        packages: 0,
        binaryFiles: 0,
        oversizedFiles: 0,
        bytesHashed: 0,
      },
    };
    const repositoryFile = (path: string) => ({
      path,
      size: 0,
      fileKind: "source" as const,
      language: null,
      binary: false,
      oversized: false,
      contentHash: null,
      gitStatus: null,
    });
    expect(
      RepositoryGenerationSchema.safeParse({
        ...base,
        repositoryName: "r".repeat(512),
        files: [repositoryFile(`${"a/".repeat(1792)}${"b".repeat(512)}`)],
      }).success,
    ).toBe(true);
    expect(
      RepositoryGenerationSchema.safeParse({
        ...base,
        repositoryName: "r".repeat(513),
      }).success,
    ).toBe(false);
    expect(
      RepositoryGenerationSchema.safeParse({
        ...base,
        files: [repositoryFile(`src/${"n".repeat(513)}`)],
      }).success,
    ).toBe(false);
    expect(
      RepositoryGenerationSchema.safeParse({
        ...base,
        files: [repositoryFile(`${"a/".repeat(1792)}${"b".repeat(513)}`)],
      }).success,
    ).toBe(false);
  });
});
