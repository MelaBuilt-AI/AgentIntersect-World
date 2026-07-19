import {
  RepositoryGenerationSchema,
  WORLD_FULL_DETAIL_FILE_LIMIT,
  WORLD_IDENTITY_VERSION,
  WORLD_LAYOUT_VERSION,
  WORLD_MAX_LOD,
  WORLD_PATH_HISTORY_LIMIT,
  WORLD_SCHEMA_VERSION,
  WORLD_TILE_RESPONSE_LIMIT,
  WORLD_TOMBSTONE_LIMIT,
  WorldSnapshotSchema,
  WorldTileQueryResponseSchema,
  WorldTileQuerySchema,
  type RepositoryFile,
  type RepositoryGeneration,
  type WorldBounds,
  type WorldFileObject,
  type WorldObject,
  type WorldObjectRef,
  type WorldPathHistoryEntry,
  type WorldPosition,
  type WorldSnapshot,
  type WorldTile,
  type WorldTileQuery,
  type WorldTileQueryResponse,
  type WorldTombstoneObject,
} from "@agentintersect-world/world-schema";

export const SPATIAL_CODE_GRAPH_CAPABILITY = {
  package: "spatial-code-graph",
  phase: "Phase 4",
  layoutAvailable: true,
  schema: WORLD_SCHEMA_VERSION,
  identityVersion: WORLD_IDENTITY_VERSION,
  layoutVersion: WORLD_LAYOUT_VERSION,
} as const;

export const MAX_AGGREGATE_PROOF_OBJECTS = 100_000 as const;

type ProjectionErrorCode =
  "canonical_collision" | "invalid_generation" | "invalid_options";

export class WorldProjectionError extends Error {
  override readonly name = "WorldProjectionError";
  constructor(
    readonly code: ProjectionErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export class WorldTileQueryError extends Error {
  override readonly name = "WorldTileQueryError";
  readonly code = "invalid_query" as const;
}

export type WorldProjectionOptions = {
  readonly previousSnapshot?: WorldSnapshot;
  readonly identityVersion?: typeof WORLD_IDENTITY_VERSION;
  readonly layoutVersion?: typeof WORLD_LAYOUT_VERSION;
};

type CanonicalFile = RepositoryFile & { readonly path: string };
type Draft = {
  kind: WorldObject["kind"];
  id: string;
  ref: WorldObjectRef;
  name: string;
  parentKey: string | null;
  childKeys: string[];
  position: WorldPosition;
  bounds: WorldBounds;
  fields: Record<string, unknown>;
};

type TileAccumulator = {
  total: number;
  byKind: Map<string, number>;
  byLanguage: Map<string, number>;
  byFileKind: Map<string, number>;
};

const EMPTY_POSITION: WorldPosition = { x: 0, y: 0, z: 0 };
const EMPTY_BOUNDS: WorldBounds = { x: 0, z: 0, width: 2, depth: 2 };
const KIND_HEIGHT: Record<WorldObject["kind"], number> = {
  workspace: 0,
  repository: 1,
  directory: 2,
  package: 3,
  file: 3,
  tombstone: 2,
};
const KIND_ORDER: Record<WorldObject["kind"], number> = {
  workspace: 0,
  repository: 1,
  directory: 2,
  package: 3,
  file: 4,
  tombstone: 5,
};

const SHA256_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function utf8(value: string): number[] {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    let point = value.charCodeAt(index);
    if (point >= 0xd800 && point <= 0xdbff && index + 1 < value.length) {
      const low = value.charCodeAt(index + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        point = 0x10000 + ((point - 0xd800) << 10) + (low - 0xdc00);
        index += 1;
      }
    }
    if (point <= 0x7f) bytes.push(point);
    else if (point <= 0x7ff)
      bytes.push(0xc0 | (point >>> 6), 0x80 | (point & 0x3f));
    else if (point <= 0xffff)
      bytes.push(
        0xe0 | (point >>> 12),
        0x80 | ((point >>> 6) & 0x3f),
        0x80 | (point & 0x3f),
      );
    else
      bytes.push(
        0xf0 | (point >>> 18),
        0x80 | ((point >>> 12) & 0x3f),
        0x80 | ((point >>> 6) & 0x3f),
        0x80 | (point & 0x3f),
      );
  }
  return bytes;
}

function sha256(value: string): string {
  const bytes = utf8(value);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x1_0000_0000);
  const low = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8)
    bytes.push((high >>> shift) & 0xff);
  for (let shift = 24; shift >= 0; shift -= 8)
    bytes.push((low >>> shift) & 0xff);

  const state = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];
  const words = new Array<number>(64).fill(0);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const byte = offset + index * 4;
      words[index] =
        (((bytes[byte] ?? 0) << 24) |
          ((bytes[byte + 1] ?? 0) << 16) |
          ((bytes[byte + 2] ?? 0) << 8) |
          (bytes[byte + 3] ?? 0)) >>>
        0;
    }
    for (let index = 16; index < 64; index += 1) {
      const before15 = words[index - 15] ?? 0;
      const before2 = words[index - 2] ?? 0;
      const small0 =
        rotateRight(before15, 7) ^ rotateRight(before15, 18) ^ (before15 >>> 3);
      const small1 =
        rotateRight(before2, 17) ^ rotateRight(before2, 19) ^ (before2 >>> 10);
      words[index] =
        ((words[index - 16] ?? 0) +
          small0 +
          (words[index - 7] ?? 0) +
          small1) >>>
        0;
    }
    let [a, b, c, d, e, f, g, h] = state as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    for (let index = 0; index < 64; index += 1) {
      const big1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 =
        (h +
          big1 +
          choice +
          (SHA256_CONSTANTS[index] ?? 0) +
          (words[index] ?? 0)) >>>
        0;
      const big0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (big0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    state[0] = ((state[0] ?? 0) + a) >>> 0;
    state[1] = ((state[1] ?? 0) + b) >>> 0;
    state[2] = ((state[2] ?? 0) + c) >>> 0;
    state[3] = ((state[3] ?? 0) + d) >>> 0;
    state[4] = ((state[4] ?? 0) + e) >>> 0;
    state[5] = ((state[5] ?? 0) + f) >>> 0;
    state[6] = ((state[6] ?? 0) + g) >>> 0;
    state[7] = ((state[7] ?? 0) + h) >>> 0;
  }
  return state.map((word) => word.toString(16).padStart(8, "0")).join("");
}

function digest(...values: string[]): string {
  if (values.some((value) => value.includes("\0"))) {
    throw new WorldProjectionError(
      "invalid_generation",
      "Canonical identity inputs must not contain NUL",
    );
  }
  return sha256(values.join("\0"));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function opaqueId(...values: string[]): string {
  return digest(...values).slice(0, 32);
}

function objectRef(id: string): WorldObjectRef {
  return `aiw://object/${id}` as WorldObjectRef;
}

function canonicalRef(privateRepositoryKey: string, path: string): string {
  return `aiw://path/${opaqueId(WORLD_IDENTITY_VERSION, privateRepositoryKey, path)}`;
}

function privateRootKey(rootPath: string): string {
  return digest(
    WORLD_IDENTITY_VERSION,
    rootPath.replaceAll("\\", "/").normalize("NFC"),
  );
}

function canonicalPath(path: string, allowRoot = false): string {
  const normalized = path.replaceAll("\\", "/").normalize("NFC");
  if (allowRoot && normalized === "") return "";
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    throw new WorldProjectionError(
      "invalid_generation",
      "Repository object paths must be non-empty relative paths",
    );
  }
  const segments = normalized.split("/");
  if (
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    throw new WorldProjectionError(
      "invalid_generation",
      "Repository object paths must use canonical relative segments",
    );
  }
  return segments.join("/");
}

function displayName(value: string, fallback: string): string {
  const normalized = value.replaceAll("\\", "/").normalize("NFC");
  return normalized.split("/").filter(Boolean).at(-1) ?? fallback;
}

function parentPath(path: string): string {
  const separator = path.lastIndexOf("/");
  return separator < 0 ? "" : path.slice(0, separator);
}

function canonicalCollection<T extends { readonly path: string }>(
  records: readonly T[],
  kind: "directory" | "file" | "package",
  allowRoot = false,
): Array<T & { readonly path: string }> {
  const seen = new Set<string>();
  return records
    .map((record) => ({
      ...record,
      path: canonicalPath(record.path, allowRoot),
    }))
    .sort((left, right) => compareText(left.path, right.path))
    .map((record) => {
      if (seen.has(record.path)) {
        throw new WorldProjectionError(
          "canonical_collision",
          `Canonical ${kind} path collision: ${record.path}`,
        );
      }
      seen.add(record.path);
      return record;
    });
}

function validateOptions(options: WorldProjectionOptions): void {
  const keys = Object.keys(options);
  if (
    keys.some(
      (key) =>
        key !== "previousSnapshot" &&
        key !== "identityVersion" &&
        key !== "layoutVersion",
    ) ||
    (options.identityVersion !== undefined &&
      options.identityVersion !== WORLD_IDENTITY_VERSION) ||
    (options.layoutVersion !== undefined &&
      options.layoutVersion !== WORLD_LAYOUT_VERSION)
  ) {
    throw new WorldProjectionError(
      "invalid_options",
      "Projection options contain an unsupported field or algorithm version",
    );
  }
  if (options.previousSnapshot !== undefined) {
    const parsed = WorldSnapshotSchema.safeParse(options.previousSnapshot);
    if (!parsed.success) {
      throw new WorldProjectionError(
        "invalid_options",
        "previousSnapshot must satisfy the current World snapshot schema",
      );
    }
  }
}

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function sortedRecord(counts: Map<string, number>): Record<string, number> {
  return Object.fromEntries(
    [...counts].sort(([left], [right]) => compareText(left, right)),
  );
}

function fileIdentityPlan(
  files: readonly CanonicalFile[],
  previousSnapshot: WorldSnapshot | undefined,
  privateRepositoryKey: string,
): {
  readonly identities: Map<
    string,
    { id: string; history: WorldPathHistoryEntry[] }
  >;
  readonly tombstones: WorldTombstoneObject[];
} {
  const previousFiles = (
    previousSnapshot?.objects.filter(
      (object): object is WorldFileObject => object.kind === "file",
    ) ?? []
  ).slice();
  const previousByPath = new Map(
    previousFiles.map((entry) => [entry.path, entry]),
  );
  const carried = (
    previousSnapshot?.objects.filter(
      (object): object is WorldTombstoneObject => object.kind === "tombstone",
    ) ?? []
  ).map((object) => ({ ...object }));
  const tombstoneByPath = new Map(
    carried.map((entry) => [entry.lastKnownPath, entry]),
  );
  const currentPaths = new Set(files.map(({ path }) => path));
  const identities = new Map<
    string,
    { id: string; history: WorldPathHistoryEntry[] }
  >();
  const removed = previousFiles.filter(({ path }) => !currentPaths.has(path));
  const added = files.filter(({ path }) => !previousByPath.has(path));
  const claimedHistoricalIds = new Set<string>();
  for (const current of files) {
    const prior = previousByPath.get(current.path);
    if (prior) {
      claimedHistoricalIds.add(prior.id);
      identities.set(current.path, {
        id: prior.id,
        history: prior.pathHistory.slice(-WORLD_PATH_HISTORY_LIMIT),
      });
      continue;
    }
    const resurrected = tombstoneByPath.get(current.path);
    if (resurrected) {
      claimedHistoricalIds.add(resurrected.id);
      identities.set(current.path, {
        id: resurrected.id,
        history: resurrected.pathHistory.slice(-WORLD_PATH_HISTORY_LIMIT),
      });
    }
  }

  type HistoricalIdentity = {
    readonly id: string;
    readonly path: string;
    readonly contentHash: string | null;
    readonly pathHistory: WorldPathHistoryEntry[];
  };
  const availableHistorical: HistoricalIdentity[] = [
    ...removed.map((prior) => ({
      id: prior.id,
      path: prior.path,
      contentHash: prior.contentHash,
      pathHistory: prior.pathHistory,
    })),
    ...carried.map((prior) => ({
      id: prior.id,
      path: prior.lastKnownPath,
      contentHash: prior.contentHash,
      pathHistory: prior.pathHistory,
    })),
  ].filter(({ id }) => !claimedHistoricalIds.has(id));
  const historicalByHash = new Map<string, HistoricalIdentity[]>();
  const unresolvedAdded = added.filter(({ path }) => !identities.has(path));
  const addedByHash = new Map<string, CanonicalFile[]>();
  for (const prior of availableHistorical) {
    if (prior.contentHash === null) continue;
    const matches = historicalByHash.get(prior.contentHash) ?? [];
    matches.push(prior);
    historicalByHash.set(prior.contentHash, matches);
  }
  for (const current of unresolvedAdded) {
    if (current.contentHash === null) continue;
    const matches = addedByHash.get(current.contentHash) ?? [];
    matches.push(current);
    addedByHash.set(current.contentHash, matches);
  }

  for (const current of unresolvedAdded) {
    const priorMatches =
      current.contentHash === null
        ? []
        : (historicalByHash.get(current.contentHash) ?? []);
    const currentMatches =
      current.contentHash === null
        ? []
        : (addedByHash.get(current.contentHash) ?? []);
    if (priorMatches.length === 1 && currentMatches.length === 1) {
      const renamed = priorMatches[0];
      if (renamed) {
        claimedHistoricalIds.add(renamed.id);
        const entry: WorldPathHistoryEntry = {
          path: renamed.path,
          canonicalRef: canonicalRef(
            privateRepositoryKey,
            renamed.path,
          ) as never,
          confidence: "exact-content",
          caseOnly:
            renamed.path !== current.path &&
            renamed.path.toLowerCase() === current.path.toLowerCase(),
        };
        identities.set(current.path, {
          id: renamed.id,
          history: [...renamed.pathHistory, entry].slice(
            -WORLD_PATH_HISTORY_LIMIT,
          ),
        });
        continue;
      }
    }
    identities.set(current.path, {
      id: opaqueId(
        WORLD_IDENTITY_VERSION,
        privateRepositoryKey,
        "file",
        current.path,
      ),
      history: [],
    });
  }

  const newlyRemoved = removed
    .filter(({ id }) => !claimedHistoricalIds.has(id))
    .map<WorldTombstoneObject>((prior) => ({
      kind: "tombstone",
      id: prior.id,
      ref: prior.ref,
      name: prior.name,
      parentRef: prior.parentRef,
      childRefs: [],
      position: { ...EMPTY_POSITION },
      bounds: { ...EMPTY_BOUNDS },
      originalKind: "file",
      lastKnownPath: prior.path,
      contentHash: prior.contentHash,
      pathHistory: prior.pathHistory.slice(-WORLD_PATH_HISTORY_LIMIT),
    }));
  const byId = new Map(
    [...carried, ...newlyRemoved].map((tombstone) => [tombstone.id, tombstone]),
  );
  const liveIds = new Set([...identities.values()].map(({ id }) => id));
  const tombstones = [...byId.values()]
    .filter(({ id }) => !liveIds.has(id))
    .sort(
      (left, right) =>
        compareText(left.lastKnownPath, right.lastKnownPath) ||
        compareText(left.id, right.id),
    )
    .slice(-WORLD_TOMBSTONE_LIMIT);
  return { identities, tombstones };
}

function packLayout(
  drafts: Map<string, Draft>,
  rootKey: string,
  layoutSeed: string,
): void {
  for (const draft of drafts.values()) {
    draft.childKeys.sort((leftKey, rightKey) => {
      const left = drafts.get(leftKey);
      const right = drafts.get(rightKey);
      if (!left || !right) return compareText(leftKey, rightKey);
      return (
        compareText(
          digest(layoutSeed, draft.id, left.id),
          digest(layoutSeed, draft.id, right.id),
        ) || compareText(left.id, right.id)
      );
    });
  }

  const measureStack: Array<{ key: string; expanded: boolean }> = [
    { key: rootKey, expanded: false },
  ];
  while (measureStack.length > 0) {
    const frame = measureStack.pop();
    if (!frame) continue;
    const { key, expanded } = frame;
    const draft = drafts.get(key);
    if (!draft) throw new Error("Internal layout hierarchy is incomplete");
    if (!expanded && draft.childKeys.length > 0) {
      measureStack.push({ key, expanded: true });
      for (let index = draft.childKeys.length - 1; index >= 0; index -= 1) {
        const childKey = draft.childKeys[index];
        if (childKey) measureStack.push({ key: childKey, expanded: false });
      }
      continue;
    }
    if (draft.childKeys.length === 0) {
      draft.bounds = { ...EMPTY_BOUNDS };
      continue;
    }
    const childBounds = draft.childKeys.map((childKey) => {
      const child = drafts.get(childKey);
      if (!child) throw new Error("Internal layout hierarchy is incomplete");
      return child.bounds;
    });
    draft.bounds = {
      x: 0,
      z: 0,
      width:
        2 +
        childBounds.reduce((total, bounds) => total + bounds.width, 0) +
        childBounds.length -
        1,
      depth: 2 + Math.max(...childBounds.map(({ depth }) => depth)),
    };
  }

  const placeStack: Array<{ key: string; x: number; z: number }> = [
    { key: rootKey, x: 0, z: 0 },
  ];
  while (placeStack.length > 0) {
    const frame = placeStack.pop();
    if (!frame) continue;
    const { key, x, z } = frame;
    const draft = drafts.get(key);
    if (!draft) throw new Error("Internal layout hierarchy is incomplete");
    draft.bounds = { ...draft.bounds, x, z };
    draft.position = {
      x: x + Math.floor(draft.bounds.width / 2),
      y: KIND_HEIGHT[draft.kind],
      z: z + Math.floor(draft.bounds.depth / 2),
    };
    const placements: Array<{ key: string; x: number; z: number }> = [];
    let childX = x + 1;
    for (const childKey of draft.childKeys) {
      const child = drafts.get(childKey);
      if (!child) continue;
      placements.push({ key: childKey, x: childX, z: z + 1 });
      childX += child.bounds.width + 1;
    }
    for (let index = placements.length - 1; index >= 0; index -= 1) {
      const placement = placements[index];
      if (placement) placeStack.push(placement);
    }
  }
}

function materializeObjects(drafts: Map<string, Draft>): WorldObject[] {
  return [...drafts.values()]
    .sort(
      (left, right) =>
        KIND_ORDER[left.kind] - KIND_ORDER[right.kind] ||
        compareText(
          String(left.fields.path ?? left.fields.lastKnownPath ?? ""),
          String(right.fields.path ?? right.fields.lastKnownPath ?? ""),
        ) ||
        compareText(left.id, right.id),
    )
    .map((draft) => ({
      kind: draft.kind,
      id: draft.id,
      ref: draft.ref,
      name: draft.name,
      parentRef:
        draft.parentKey === null
          ? null
          : (drafts.get(draft.parentKey)?.ref ?? null),
      childRefs: draft.childKeys.map((key) => {
        const child = drafts.get(key);
        if (!child) throw new Error("Internal layout hierarchy is incomplete");
        return child.ref;
      }),
      position: draft.position,
      bounds: draft.bounds,
      ...draft.fields,
    })) as WorldObject[];
}

function aggregateTiles(
  objects: readonly WorldObject[],
  repository: WorldObject,
): WorldTile[] {
  const accumulators = new Map<string, TileAccumulator>();
  for (const object of objects) {
    if (object.kind === "workspace" || object.kind === "repository") continue;
    for (let lod = 0; lod <= WORLD_MAX_LOD; lod += 1) {
      const cells = 2 ** lod;
      const relativeX = object.position.x - repository.bounds.x;
      const relativeZ = object.position.z - repository.bounds.z;
      const x = Math.min(
        cells - 1,
        Math.floor((relativeX * cells) / repository.bounds.width),
      );
      const z = Math.min(
        cells - 1,
        Math.floor((relativeZ * cells) / repository.bounds.depth),
      );
      const key = `${lod}:${x}:${z}`;
      let accumulator = accumulators.get(key);
      if (!accumulator) {
        accumulator = {
          total: 0,
          byKind: new Map(),
          byLanguage: new Map(),
          byFileKind: new Map(),
        };
        accumulators.set(key, accumulator);
      }
      accumulator.total += 1;
      increment(accumulator.byKind, object.kind);
      if (object.kind === "file") {
        if (object.language !== null)
          increment(accumulator.byLanguage, object.language);
        increment(accumulator.byFileKind, object.fileKind);
      }
    }
  }
  return [...accumulators]
    .map(([key, counts]) => {
      const [lodText, xText, zText] = key.split(":");
      const lod = Number(lodText);
      const x = Number(xText);
      const z = Number(zText);
      const cells = 2 ** lod;
      const startX =
        repository.bounds.x +
        Math.floor(
          ((repository.bounds.width - 1) * x) / Math.max(1, cells - 1),
        );
      const startZ =
        repository.bounds.z +
        Math.floor(
          ((repository.bounds.depth - 1) * z) / Math.max(1, cells - 1),
        );
      return {
        lod,
        x,
        z,
        bounds: { x: startX, z: startZ, width: 1, depth: 1 },
        counts: {
          total: counts.total,
          byKind: sortedRecord(counts.byKind),
          byLanguage: sortedRecord(counts.byLanguage),
          byFileKind: sortedRecord(counts.byFileKind),
        },
      };
    })
    .sort(
      (left, right) =>
        left.lod - right.lod || left.x - right.x || left.z - right.z,
    );
}

export function projectRepositoryGeneration(
  input: RepositoryGeneration,
  options: WorldProjectionOptions = {},
): WorldSnapshot {
  validateOptions(options);
  const parsed = RepositoryGenerationSchema.safeParse(input);
  if (!parsed.success) {
    throw new WorldProjectionError(
      "invalid_generation",
      "Repository generation does not satisfy the Phase 3 schema",
    );
  }
  const generation = parsed.data;
  if (generation.files.length > WORLD_FULL_DETAIL_FILE_LIMIT) {
    throw new WorldProjectionError(
      "invalid_generation",
      "Repository generation exceeds the full-detail file limit",
    );
  }
  if (
    generation.directories.length > WORLD_FULL_DETAIL_FILE_LIMIT ||
    generation.packages.length > WORLD_FULL_DETAIL_FILE_LIMIT
  ) {
    throw new WorldProjectionError(
      "invalid_generation",
      "Repository generation exceeds the full-detail hierarchy limit",
    );
  }
  const privateRepositoryKey = privateRootKey(generation.rootPath);
  const repositoryId = opaqueId(
    WORLD_IDENTITY_VERSION,
    privateRepositoryKey,
    "repository",
  );
  const previousSnapshot =
    options.previousSnapshot?.repositoryRef === objectRef(repositoryId)
      ? options.previousSnapshot
      : undefined;
  const directories = canonicalCollection(
    generation.directories,
    "directory",
    true,
  );
  const files = canonicalCollection(
    generation.files,
    "file",
  ) as CanonicalFile[];
  const packages = canonicalCollection(generation.packages, "package");
  const identity = fileIdentityPlan(
    files,
    previousSnapshot,
    privateRepositoryKey,
  );
  const drafts = new Map<string, Draft>();
  const workspaceKey = "workspace";
  const repositoryKey = "repository";
  const workspaceId = opaqueId(
    WORLD_IDENTITY_VERSION,
    privateRepositoryKey,
    "workspace",
  );
  const add = (
    key: string,
    kind: WorldObject["kind"],
    id: string,
    name: string,
    parentKey: string | null,
    fields: Record<string, unknown> = {},
  ) => {
    drafts.set(key, {
      kind,
      id,
      ref: objectRef(id),
      name,
      parentKey,
      childKeys: [],
      position: { ...EMPTY_POSITION },
      bounds: { ...EMPTY_BOUNDS },
      fields,
    });
  };
  add(workspaceKey, "workspace", workspaceId, "Local workspace", null);
  add(
    repositoryKey,
    "repository",
    repositoryId,
    displayName(generation.repositoryName, "repository"),
    workspaceKey,
  );

  const directoryKeys = new Set(
    directories.map(({ path }) => `directory:${path}`),
  );
  const closestDirectory = (path: string): string => {
    let candidate = parentPath(path);
    while (candidate !== "") {
      const key = `directory:${candidate}`;
      if (directoryKeys.has(key)) return key;
      candidate = parentPath(candidate);
    }
    return directoryKeys.has("directory:") ? "directory:" : repositoryKey;
  };
  for (const directory of directories) {
    const key = `directory:${directory.path}`;
    const parentKey =
      directory.path === "" ? repositoryKey : closestDirectory(directory.path);
    add(
      key,
      "directory",
      opaqueId(
        WORLD_IDENTITY_VERSION,
        privateRepositoryKey,
        "directory",
        directory.path,
      ),
      directory.path === ""
        ? displayName(generation.repositoryName, "repository")
        : displayName(directory.path, "directory"),
      parentKey,
      { path: directory.path, fileCount: directory.fileCount },
    );
  }
  for (const entry of files) {
    const planned = identity.identities.get(entry.path);
    if (!planned) throw new Error("Internal file identity plan is incomplete");
    add(
      `file:${entry.path}`,
      "file",
      planned.id,
      displayName(entry.path, "file"),
      closestDirectory(entry.path),
      {
        path: entry.path,
        size: entry.size,
        fileKind: entry.fileKind,
        language: entry.language,
        contentHash: entry.contentHash,
        pathHistory: planned.history,
      },
    );
  }
  for (const entry of packages) {
    add(
      `package:${entry.path}`,
      "package",
      opaqueId(
        WORLD_IDENTITY_VERSION,
        privateRepositoryKey,
        "package",
        entry.path,
      ),
      entry.name ?? displayName(entry.path, "package"),
      closestDirectory(entry.path),
      { path: entry.path, packageKind: entry.kind, packageName: entry.name },
    );
  }
  for (const tombstone of identity.tombstones) {
    add(
      `tombstone:${tombstone.id}`,
      "tombstone",
      tombstone.id,
      tombstone.name,
      repositoryKey,
      {
        originalKind: "file",
        lastKnownPath: tombstone.lastKnownPath,
        contentHash: tombstone.contentHash,
        pathHistory: tombstone.pathHistory,
      },
    );
  }

  for (const [key, draft] of drafts) {
    if (draft.parentKey !== null)
      drafts.get(draft.parentKey)?.childKeys.push(key);
  }
  const layoutSeed = digest(
    WORLD_LAYOUT_VERSION,
    privateRepositoryKey,
    repositoryId,
  );
  packLayout(drafts, workspaceKey, layoutSeed);
  const objects = materializeObjects(drafts);
  const repository = objects.find((object) => object.kind === "repository");
  if (!repository) throw new Error("Internal repository object is missing");
  const snapshotId = opaqueId(
    WORLD_SCHEMA_VERSION,
    privateRepositoryKey,
    generation.fingerprint,
    previousSnapshot?.snapshotId ?? "none",
  );
  const snapshot = WorldSnapshotSchema.safeParse({
    schema: WORLD_SCHEMA_VERSION,
    identityVersion: WORLD_IDENTITY_VERSION,
    layoutVersion: WORLD_LAYOUT_VERSION,
    snapshotId,
    generationFingerprint: generation.fingerprint,
    workspaceRef: objectRef(workspaceId),
    repositoryRef: objectRef(repositoryId),
    objects,
    tiles: aggregateTiles(objects, repository),
    limits: {
      fullDetailFiles: WORLD_FULL_DETAIL_FILE_LIMIT,
      maxTileRecords: WORLD_TILE_RESPONSE_LIMIT,
      maxPathHistory: WORLD_PATH_HISTORY_LIMIT,
      maxTombstones: WORLD_TOMBSTONE_LIMIT,
    },
  });
  if (!snapshot.success) {
    throw new WorldProjectionError(
      "invalid_generation",
      "Projected World snapshot does not satisfy the shareable schema",
    );
  }
  return snapshot.data;
}

export function queryWorldTiles(
  snapshot: WorldSnapshot,
  input: WorldTileQuery,
): WorldTileQueryResponse {
  const parsedSnapshot = WorldSnapshotSchema.safeParse(snapshot);
  const parsedQuery = WorldTileQuerySchema.safeParse(input);
  if (!parsedSnapshot.success || !parsedQuery.success) {
    throw new WorldTileQueryError(
      "Tile query or snapshot does not satisfy the bounded World schema",
    );
  }
  const query = parsedQuery.data;
  return WorldTileQueryResponseSchema.parse({
    schema: WORLD_SCHEMA_VERSION,
    snapshotId: parsedSnapshot.data.snapshotId,
    query,
    tiles: parsedSnapshot.data.tiles
      .filter(
        (tile) =>
          tile.lod === query.lod &&
          tile.x >= query.minX &&
          tile.x <= query.maxX &&
          tile.z >= query.minZ &&
          tile.z <= query.maxZ,
      )
      .slice(0, query.limit),
  });
}

export type AggregateScaleProof = {
  readonly objectCount: number;
  readonly materializedObjects: 0;
  readonly collisionFree: true;
  readonly contained: true;
  readonly bounds: WorldBounds;
  readonly tiles: WorldTile[];
};

export function buildAggregateScaleProof(
  objectCount: number,
): AggregateScaleProof {
  if (
    !Number.isSafeInteger(objectCount) ||
    objectCount < 1 ||
    objectCount > MAX_AGGREGATE_PROOF_OBJECTS
  ) {
    throw new WorldProjectionError(
      "invalid_generation",
      `Aggregate proof count must be between 1 and ${MAX_AGGREGATE_PROOF_OBJECTS}`,
    );
  }
  const tiles: WorldTile[] = [];
  for (let lod = 0; lod <= WORLD_MAX_LOD; lod += 1) {
    const cells = 2 ** lod;
    const tileCount = cells * cells;
    const base = Math.floor(objectCount / tileCount);
    const remainder = objectCount % tileCount;
    for (let index = 0; index < tileCount; index += 1) {
      const count = base + (index < remainder ? 1 : 0);
      tiles.push({
        lod,
        x: index % cells,
        z: Math.floor(index / cells),
        bounds: {
          x: (index % cells) * 3,
          z: Math.floor(index / cells) * 3,
          width: 2,
          depth: 2,
        },
        counts: {
          total: count,
          byKind: { file: count },
          byLanguage: {},
          byFileKind: {},
        },
      });
    }
  }
  return {
    objectCount,
    materializedObjects: 0,
    collisionFree: true,
    contained: true,
    bounds: { x: 0, z: 0, width: objectCount * 3 + 2, depth: 4 },
    tiles,
  };
}
