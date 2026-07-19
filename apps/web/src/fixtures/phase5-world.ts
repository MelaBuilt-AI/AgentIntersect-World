import type { WorldSnapshot } from "@agentintersect-world/world-schema";

const refs = {
  workspace: "aiw://object/00000000000000000000000000000001",
  repository: "aiw://object/00000000000000000000000000000002",
  package: "aiw://object/00000000000000000000000000000003",
  directory: "aiw://object/00000000000000000000000000000004",
  fileA: "aiw://object/00000000000000000000000000000005",
  fileB: "aiw://object/00000000000000000000000000000006",
  fileC: "aiw://object/00000000000000000000000000000007",
} as const;

export const PHASE5_WORLD_FIXTURE: WorldSnapshot = {
  schema: "aiw.world/0.4",
  identityVersion: "aiw.identity/1",
  layoutVersion: "aiw.layout/grid/1",
  snapshotId: "50000000000000000000000000000005",
  generationFingerprint:
    "5555555555555555555555555555555555555555555555555555555555555555",
  workspaceRef: refs.workspace,
  repositoryRef: refs.repository,
  objects: [
    {
      id: "00000000000000000000000000000001",
      ref: refs.workspace,
      kind: "workspace",
      name: "AgentIntersect World",
      parentRef: null,
      childRefs: [refs.repository],
      position: { x: 0, y: 0, z: 0 },
      bounds: { x: 0, z: 0, width: 24, depth: 18 },
    },
    {
      id: "00000000000000000000000000000002",
      ref: refs.repository,
      kind: "repository",
      name: "phase5-fixture",
      parentRef: refs.workspace,
      childRefs: [refs.package, refs.directory],
      position: { x: 1, y: 1, z: 1 },
      bounds: { x: 1, z: 1, width: 22, depth: 16 },
    },
    {
      id: "00000000000000000000000000000003",
      ref: refs.package,
      kind: "package",
      name: "@agentintersect-world/fixture",
      parentRef: refs.repository,
      childRefs: [],
      position: { x: 3, y: 3, z: 3 },
      bounds: { x: 2, z: 2, width: 5, depth: 4 },
      path: "package.json",
      packageKind: "npm",
      packageName: "@agentintersect-world/fixture",
    },
    {
      id: "00000000000000000000000000000004",
      ref: refs.directory,
      kind: "directory",
      name: "src",
      parentRef: refs.repository,
      childRefs: [refs.fileA, refs.fileB, refs.fileC],
      position: { x: 10, y: 2, z: 6 },
      bounds: { x: 8, z: 4, width: 12, depth: 9 },
      path: "src",
      fileCount: 3,
    },
    {
      id: "00000000000000000000000000000005",
      ref: refs.fileA,
      kind: "file",
      name: "main.ts",
      parentRef: refs.directory,
      childRefs: [],
      position: { x: 10, y: 3, z: 7 },
      bounds: { x: 9, z: 6, width: 2, depth: 2 },
      path: "src/main.ts",
      size: 480,
      fileKind: "source",
      language: "TypeScript",
      contentHash:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      pathHistory: [],
    },
    {
      id: "00000000000000000000000000000006",
      ref: refs.fileB,
      kind: "file",
      name: "island.css",
      parentRef: refs.directory,
      childRefs: [],
      position: { x: 14, y: 3, z: 7 },
      bounds: { x: 13, z: 6, width: 2, depth: 2 },
      path: "src/island.css",
      size: 760,
      fileKind: "source",
      language: "CSS",
      contentHash:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      pathHistory: [],
    },
    {
      id: "00000000000000000000000000000007",
      ref: refs.fileC,
      kind: "file",
      name: "signals.xyzzy",
      parentRef: refs.directory,
      childRefs: [],
      position: { x: 18, y: 3, z: 7 },
      bounds: { x: 17, z: 6, width: 2, depth: 2 },
      path: "src/signals.xyzzy",
      size: 120,
      fileKind: "other",
      language: null,
      contentHash: null,
      pathHistory: [],
    },
  ],
  tiles: [
    {
      lod: 0,
      x: 0,
      z: 0,
      bounds: { x: 0, z: 0, width: 24, depth: 18 },
      counts: {
        total: 7,
        byKind: {
          workspace: 1,
          repository: 1,
          package: 1,
          directory: 1,
          file: 3,
        },
        byLanguage: { TypeScript: 1, CSS: 1, unknown: 1 },
        byFileKind: { source: 2, other: 1 },
      },
    },
  ],
  limits: {
    fullDetailFiles: 10_000,
    maxTileRecords: 128,
    maxPathHistory: 8,
    maxTombstones: 256,
  },
};

export const PHASE5_ABSOLUTE_PATH_FIXTURE: WorldSnapshot = {
  ...PHASE5_WORLD_FIXTURE,
  objects: PHASE5_WORLD_FIXTURE.objects.map((object) =>
    object.kind === "file" && object.name === "signals.xyzzy"
      ? {
          ...object,
          path: "\\\\server\\share\\private\\repo\\signals.xyzzy",
        }
      : object,
  ),
};

export function createPhase5TenThousandFixture(): WorldSnapshot {
  const directoryRef = "aiw://object/90000000000000000000000000000003";
  const fileRefs = Array.from(
    { length: 10_000 },
    (_, index) =>
      `aiw://object/${(index + 100).toString(16).padStart(32, "0")}`,
  );
  return {
    schema: "aiw.world/0.4",
    identityVersion: "aiw.identity/1",
    layoutVersion: "aiw.layout/grid/1",
    snapshotId: "59999999999999999999999999999995",
    generationFingerprint:
      "9999999999999999999999999999999999999999999999999999999999999999",
    workspaceRef: "aiw://object/90000000000000000000000000000001",
    repositoryRef: "aiw://object/90000000000000000000000000000002",
    objects: [
      {
        id: "90000000000000000000000000000001",
        ref: "aiw://object/90000000000000000000000000000001",
        kind: "workspace",
        name: "10k fixture workspace",
        parentRef: null,
        childRefs: ["aiw://object/90000000000000000000000000000002"],
        position: { x: 0, y: 0, z: 0 },
        bounds: { x: 0, z: 0, width: 104, depth: 104 },
      },
      {
        id: "90000000000000000000000000000002",
        ref: "aiw://object/90000000000000000000000000000002",
        kind: "repository",
        name: "phase5-10k-fixture",
        parentRef: "aiw://object/90000000000000000000000000000001",
        childRefs: [directoryRef],
        position: { x: 1, y: 1, z: 1 },
        bounds: { x: 1, z: 1, width: 102, depth: 102 },
      },
      {
        id: "90000000000000000000000000000003",
        ref: directoryRef,
        kind: "directory",
        name: "generated",
        parentRef: "aiw://object/90000000000000000000000000000002",
        childRefs: fileRefs,
        position: { x: 2, y: 2, z: 2 },
        bounds: { x: 2, z: 2, width: 100, depth: 100 },
        path: "generated",
        fileCount: 10_000,
      },
      ...fileRefs.map((ref, index) => ({
        id: ref.slice("aiw://object/".length),
        ref,
        kind: "file" as const,
        name: `fixture-${String(index).padStart(5, "0")}.unknown`,
        parentRef: directoryRef,
        childRefs: [],
        position: {
          x: 2 + (index % 100),
          y: 3,
          z: 2 + Math.floor(index / 100),
        },
        bounds: {
          x: 2 + (index % 100),
          z: 2 + Math.floor(index / 100),
          width: 1,
          depth: 1,
        },
        path: `generated/fixture-${String(index).padStart(5, "0")}.unknown`,
        size: index,
        fileKind: "other" as const,
        language: null,
        contentHash: null,
        pathHistory: [],
      })),
    ],
    tiles: [
      {
        lod: 0,
        x: 0,
        z: 0,
        bounds: { x: 0, z: 0, width: 104, depth: 104 },
        counts: {
          total: 10_003,
          byKind: { workspace: 1, repository: 1, directory: 1, file: 10_000 },
          byLanguage: { unknown: 10_000 },
          byFileKind: { other: 10_000 },
        },
      },
    ],
    limits: {
      fullDetailFiles: 10_000,
      maxTileRecords: 128,
      maxPathHistory: 8,
      maxTombstones: 256,
    },
  };
}
