export const NAVIGATION_CONTRACT_VERSION =
  "aiw.navigation/navmesh/0.13" as const;
export const NAVIGATION_QUANTUM = 0.001;

export type NavigationPoint = { readonly x: number; readonly z: number };
export type NavigationBounds = NavigationPoint & {
  readonly width: number;
  readonly depth: number;
};
export type NavigationObstacle = {
  readonly ref: string;
  readonly bounds: NavigationBounds;
};
export type NavigationPolygon = {
  readonly id: string;
  readonly vertices: readonly [
    NavigationPoint,
    NavigationPoint,
    NavigationPoint,
    NavigationPoint,
  ];
  readonly centroid: NavigationPoint;
};
export type NavigationPortal = {
  readonly id: string;
  readonly fromPolygon: string;
  readonly toPolygon: string;
  readonly vertices: readonly [NavigationPoint, NavigationPoint];
};
export type NavigationMesh = {
  readonly version: typeof NAVIGATION_CONTRACT_VERSION;
  readonly meshId: string;
  readonly worldGeneration: string;
  readonly layoutGeneration: string;
  readonly bounds: NavigationBounds;
  readonly avatarRadius: number;
  readonly clearance: number;
  readonly obstacles: readonly NavigationObstacle[];
  readonly polygons: readonly NavigationPolygon[];
  readonly portals: readonly NavigationPortal[];
};

export type NavigationPath = {
  readonly status: "planned" | "blocked";
  readonly arrived: false;
  readonly worldGeneration: string;
  readonly layoutGeneration: string;
  readonly navigationVersion: typeof NAVIGATION_CONTRACT_VERSION;
  readonly meshId: string;
  readonly interactionRadius: number;
  readonly corners: readonly NavigationPoint[];
};

const finite = (value: number, label: string) => {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
};
const positive = (value: number, label: string) => {
  finite(value, label);
  if (value <= 0) throw new Error(`${label} must be positive`);
  return value;
};
const quantize = (value: number) =>
  Math.round(value / NAVIGATION_QUANTUM) * NAVIGATION_QUANTUM;
const point = (value: NavigationPoint): NavigationPoint => ({
  x: quantize(value.x),
  z: quantize(value.z),
});
const bounds = (value: NavigationBounds): NavigationBounds => ({
  x: quantize(finite(value.x, "bounds.x")),
  z: quantize(finite(value.z, "bounds.z")),
  width: quantize(positive(value.width, "bounds.width")),
  depth: quantize(positive(value.depth, "bounds.depth")),
});

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `nav-${hash.toString(16).padStart(8, "0")}`;
}

export function buildNavigationMesh(input: {
  readonly worldGeneration: string;
  readonly layoutGeneration: string;
  readonly navigationBounds: NavigationBounds;
  readonly avatarRadius: number;
  readonly clearance: number;
  readonly obstacles: readonly NavigationObstacle[];
}): NavigationMesh {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.worldGeneration))
    throw new Error("Invalid World generation");
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.layoutGeneration))
    throw new Error("Invalid layout generation");
  const navigationBounds = bounds(input.navigationBounds);
  const avatarRadius = quantize(positive(input.avatarRadius, "avatarRadius"));
  const clearance = quantize(finite(input.clearance, "clearance"));
  if (clearance < 0) throw new Error("clearance must not be negative");
  const obstacles = input.obstacles
    .map((obstacle) => {
      if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(obstacle.ref))
        throw new Error("Invalid obstacle ref");
      return { ref: obstacle.ref, bounds: bounds(obstacle.bounds) };
    })
    .sort(
      (left, right) =>
        left.ref.localeCompare(right.ref) ||
        left.bounds.x - right.bounds.x ||
        left.bounds.z - right.bounds.z ||
        left.bounds.width - right.bounds.width ||
        left.bounds.depth - right.bounds.depth,
    );
  const inset = avatarRadius + clearance;
  type Rectangle = {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  const worldMaxX = quantize(navigationBounds.x + navigationBounds.width);
  const worldMaxZ = quantize(navigationBounds.z + navigationBounds.depth);
  const expanded: Rectangle[] = obstacles.flatMap(({ bounds: obstacle }) => {
    const rectangle = {
      minX: quantize(Math.max(navigationBounds.x, obstacle.x - inset)),
      maxX: quantize(Math.min(worldMaxX, obstacle.x + obstacle.width + inset)),
      minZ: quantize(Math.max(navigationBounds.z, obstacle.z - inset)),
      maxZ: quantize(Math.min(worldMaxZ, obstacle.z + obstacle.depth + inset)),
    };
    return rectangle.maxX - rectangle.minX > NAVIGATION_QUANTUM / 2 &&
      rectangle.maxZ - rectangle.minZ > NAVIGATION_QUANTUM / 2
      ? [rectangle]
      : [];
  });
  const uniqueCoordinates = (values: readonly number[]) =>
    [...new Set(values.map(quantize))].sort((left, right) => left - right);
  const xCoordinates = uniqueCoordinates([
    navigationBounds.x,
    worldMaxX,
    ...expanded.flatMap(({ minX, maxX }) => [minX, maxX]),
  ]);
  const zCoordinates = uniqueCoordinates([
    navigationBounds.z,
    worldMaxZ,
    ...expanded.flatMap(({ minZ, maxZ }) => [minZ, maxZ]),
  ]);
  const completed: Rectangle[] = [];
  let active = new Map<string, Rectangle>();
  for (let zIndex = 0; zIndex < zCoordinates.length - 1; zIndex += 1) {
    const minZ = zCoordinates[zIndex]!;
    const maxZ = zCoordinates[zIndex + 1]!;
    const centerZ = (minZ + maxZ) / 2;
    const runs: Rectangle[] = [];
    let current: Rectangle | null = null;
    for (let xIndex = 0; xIndex < xCoordinates.length - 1; xIndex += 1) {
      const minX = xCoordinates[xIndex]!;
      const maxX = xCoordinates[xIndex + 1]!;
      const centerX = (minX + maxX) / 2;
      const walkable = !expanded.some(
        (obstacle) =>
          centerX > obstacle.minX &&
          centerX < obstacle.maxX &&
          centerZ > obstacle.minZ &&
          centerZ < obstacle.maxZ,
      );
      if (walkable) {
        if (current && Math.abs(current.maxX - minX) <= NAVIGATION_QUANTUM)
          current.maxX = maxX;
        else {
          current = { minX, maxX, minZ, maxZ };
          runs.push(current);
        }
      } else current = null;
    }
    const next = new Map<string, Rectangle>();
    for (const run of runs) {
      const key = `${run.minX}:${run.maxX}`;
      const previous = active.get(key);
      if (
        previous &&
        Math.abs(previous.maxZ - run.minZ) <= NAVIGATION_QUANTUM
      ) {
        previous.maxZ = run.maxZ;
        next.set(key, previous);
      } else next.set(key, run);
    }
    for (const [key, rectangle] of active)
      if (!next.has(key)) completed.push(rectangle);
    active = next;
  }
  completed.push(...active.values());
  completed.sort(
    (left, right) =>
      left.minZ - right.minZ ||
      left.minX - right.minX ||
      left.maxZ - right.maxZ ||
      left.maxX - right.maxX,
  );
  const polygons: NavigationPolygon[] = completed.map((rectangle, index) => ({
    id: `polygon-${String(index).padStart(4, "0")}`,
    vertices: [
      point({ x: rectangle.minX, z: rectangle.minZ }),
      point({ x: rectangle.maxX, z: rectangle.minZ }),
      point({ x: rectangle.maxX, z: rectangle.maxZ }),
      point({ x: rectangle.minX, z: rectangle.maxZ }),
    ],
    centroid: point({
      x: (rectangle.minX + rectangle.maxX) / 2,
      z: (rectangle.minZ + rectangle.maxZ) / 2,
    }),
  }));
  const portals: NavigationPortal[] = [];
  for (let leftIndex = 0; leftIndex < completed.length; leftIndex += 1) {
    const left = completed[leftIndex]!;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < completed.length;
      rightIndex += 1
    ) {
      const right = completed[rightIndex]!;
      let vertices: [NavigationPoint, NavigationPoint] | null = null;
      if (
        Math.abs(left.maxX - right.minX) <= NAVIGATION_QUANTUM ||
        Math.abs(right.maxX - left.minX) <= NAVIGATION_QUANTUM
      ) {
        const z1 = Math.max(left.minZ, right.minZ);
        const z2 = Math.min(left.maxZ, right.maxZ);
        if (z2 - z1 > NAVIGATION_QUANTUM / 2) {
          const x =
            Math.abs(left.maxX - right.minX) <= NAVIGATION_QUANTUM
              ? left.maxX
              : left.minX;
          vertices = [point({ x, z: z1 }), point({ x, z: z2 })];
        }
      } else if (
        Math.abs(left.maxZ - right.minZ) <= NAVIGATION_QUANTUM ||
        Math.abs(right.maxZ - left.minZ) <= NAVIGATION_QUANTUM
      ) {
        const x1 = Math.max(left.minX, right.minX);
        const x2 = Math.min(left.maxX, right.maxX);
        if (x2 - x1 > NAVIGATION_QUANTUM / 2) {
          const z =
            Math.abs(left.maxZ - right.minZ) <= NAVIGATION_QUANTUM
              ? left.maxZ
              : left.minZ;
          vertices = [point({ x: x1, z }), point({ x: x2, z })];
        }
      }
      if (vertices)
        portals.push({
          id: `portal-${String(portals.length).padStart(4, "0")}`,
          fromPolygon: polygons[leftIndex]!.id,
          toPolygon: polygons[rightIndex]!.id,
          vertices,
        });
    }
  }
  const canonical = {
    version: NAVIGATION_CONTRACT_VERSION,
    worldGeneration: input.worldGeneration,
    layoutGeneration: input.layoutGeneration,
    bounds: navigationBounds,
    avatarRadius,
    clearance,
    obstacles,
    polygons,
    portals,
  };
  return { ...canonical, meshId: stableHash(JSON.stringify(canonical)) };
}

const polygonRectangle = (polygon: NavigationPolygon) => ({
  minX: polygon.vertices[0].x,
  maxX: polygon.vertices[2].x,
  minZ: polygon.vertices[0].z,
  maxZ: polygon.vertices[2].z,
});

const locatePolygon = (mesh: NavigationMesh, value: NavigationPoint) =>
  mesh.polygons
    .map((polygon) => {
      const rectangle = polygonRectangle(polygon);
      const projected = point({
        x: Math.max(rectangle.minX, Math.min(rectangle.maxX, value.x)),
        z: Math.max(rectangle.minZ, Math.min(rectangle.maxZ, value.z)),
      });
      return {
        polygon,
        projected,
        distance: Math.hypot(projected.x - value.x, projected.z - value.z),
      };
    })
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        left.polygon.id.localeCompare(right.polygon.id),
    )[0] ?? null;

function simplify(points: readonly NavigationPoint[]): NavigationPoint[] {
  if (points.length < 3) return [...points];
  const output: NavigationPoint[] = [points[0]!];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = output.at(-1)!;
    const current = points[index]!;
    const next = points[index + 1]!;
    const cross =
      (current.x - previous.x) * (next.z - current.z) -
      (current.z - previous.z) * (next.x - current.x);
    if (Math.abs(cross) > NAVIGATION_QUANTUM / 2) output.push(current);
  }
  output.push(points.at(-1)!);
  return output;
}

export function planNavigationPath(
  mesh: NavigationMesh,
  startInput: NavigationPoint,
  targetInput: NavigationPoint,
  interactionRadius: number,
): NavigationPath {
  const start = point(startInput);
  const target = point(targetInput);
  positive(interactionRadius, "interactionRadius");
  const startLocation = locatePolygon(mesh, start);
  const targetLocation = locatePolygon(mesh, target);
  const base = {
    arrived: false as const,
    worldGeneration: mesh.worldGeneration,
    layoutGeneration: mesh.layoutGeneration,
    navigationVersion: NAVIGATION_CONTRACT_VERSION,
    meshId: mesh.meshId,
    interactionRadius: quantize(interactionRadius),
  };
  if (startLocation === null || targetLocation === null)
    return { ...base, status: "blocked", corners: [] };

  const startPolygon = startLocation.polygon.id;
  const targetPolygon = targetLocation.polygon.id;
  const polygonById = new Map(
    mesh.polygons.map((polygon) => [polygon.id, polygon]),
  );
  const adjacency = new Map<
    string,
    Array<{ polygon: string; portal: NavigationPortal }>
  >();
  for (const portal of mesh.portals) {
    const from = adjacency.get(portal.fromPolygon) ?? [];
    from.push({ polygon: portal.toPolygon, portal });
    adjacency.set(portal.fromPolygon, from);
    const to = adjacency.get(portal.toPolygon) ?? [];
    to.push({ polygon: portal.fromPolygon, portal });
    adjacency.set(portal.toPolygon, to);
  }
  for (const neighbours of adjacency.values())
    neighbours.sort((left, right) => left.polygon.localeCompare(right.polygon));
  const open: string[] = [startPolygon];
  const openSet = new Set(open);
  const cameFrom = new Map<
    string,
    { polygon: string; portal: NavigationPortal }
  >();
  const score = new Map<string, number>([[startPolygon, 0]]);
  const targetCentroid = targetLocation.polygon.centroid;
  const heuristic = (polygonId: string) => {
    const centroid = polygonById.get(polygonId)!.centroid;
    return Math.hypot(
      centroid.x - targetCentroid.x,
      centroid.z - targetCentroid.z,
    );
  };
  let found = false;
  while (open.length > 0) {
    open.sort(
      (left, right) =>
        score.get(left)! +
          heuristic(left) -
          (score.get(right)! + heuristic(right)) ||
        heuristic(left) - heuristic(right) ||
        left.localeCompare(right),
    );
    const current = open.shift()!;
    openSet.delete(current);
    if (current === targetPolygon) {
      found = true;
      break;
    }
    const currentCentroid = polygonById.get(current)!.centroid;
    for (const neighbour of adjacency.get(current) ?? []) {
      const neighbourCentroid = polygonById.get(neighbour.polygon)!.centroid;
      const tentative =
        score.get(current)! +
        Math.hypot(
          currentCentroid.x - neighbourCentroid.x,
          currentCentroid.z - neighbourCentroid.z,
        );
      if (
        tentative >= (score.get(neighbour.polygon) ?? Number.POSITIVE_INFINITY)
      )
        continue;
      cameFrom.set(neighbour.polygon, {
        polygon: current,
        portal: neighbour.portal,
      });
      score.set(neighbour.polygon, tentative);
      if (!openSet.has(neighbour.polygon)) {
        open.push(neighbour.polygon);
        openSet.add(neighbour.polygon);
      }
    }
  }
  if (!found) return { ...base, status: "blocked", corners: [] };
  const portals: NavigationPortal[] = [];
  let cursor = targetPolygon;
  while (cursor !== startPolygon) {
    const previous = cameFrom.get(cursor)!;
    portals.unshift(previous.portal);
    cursor = previous.polygon;
  }
  const canonical = simplify([
    startLocation.projected,
    ...portals.map(({ vertices }) =>
      point({
        x: (vertices[0].x + vertices[1].x) / 2,
        z: (vertices[0].z + vertices[1].z) / 2,
      }),
    ),
    targetLocation.projected,
  ]);
  return { ...base, status: "planned", corners: canonical };
}

export function isInsideInteractionZone(
  position: NavigationPoint,
  target: NavigationPoint,
  radius: number,
): boolean {
  return (
    Math.hypot(position.x - target.x, position.z - target.z) <=
    radius + NAVIGATION_QUANTUM
  );
}

export function replayCanonicalPath(
  path: NavigationPath,
  fixedStep: number,
): readonly NavigationPoint[] {
  positive(fixedStep, "fixedStep");
  if (path.status === "blocked") return [];
  const samples: NavigationPoint[] = [path.corners[0]!];
  for (let index = 1; index < path.corners.length; index += 1) {
    const from = path.corners[index - 1]!;
    const to = path.corners[index]!;
    const distance = Math.hypot(to.x - from.x, to.z - from.z);
    const steps = Math.max(1, Math.ceil(distance / fixedStep));
    for (let step = 1; step <= steps; step += 1) {
      samples.push(
        point({
          x: from.x + ((to.x - from.x) * step) / steps,
          z: from.z + ((to.z - from.z) * step) / steps,
        }),
      );
    }
  }
  return samples;
}

export type TargetRecord = {
  readonly objectRef: string;
  readonly repositoryRef: string;
  readonly state:
    "current" | "tombstone" | "ambiguous" | "deleted" | "unsupported";
  readonly path?: string;
  readonly previousPaths?: readonly string[];
  readonly continuity?: "authoritative" | "unavailable";
};
export type TargetRevision = {
  readonly repositoryRef: string;
  readonly worldGeneration: string;
  readonly layoutGeneration: string;
  readonly graphGeneration: string | null;
};
type ResolvableAction = {
  readonly kind: string;
  readonly target?: {
    readonly repositoryRef: string;
    readonly objectRef: string;
    readonly requestedPath?: string | undefined;
  };
  readonly destination?: {
    readonly repositoryRef: string;
    readonly objectRef: string;
    readonly requestedPath?: string | undefined;
  };
};
export type ResolvedTarget = Omit<TargetRecord, "continuity"> & {
  readonly requestedPath?: string;
  readonly currentPath?: string;
  readonly continuity: "exact" | "renamed-authoritative" | "tombstone";
};
export type TargetResolutionFailure =
  | "cross-repository"
  | "unresolved"
  | "ambiguous"
  | "deleted"
  | "unsupported"
  | "stale-path"
  | "tombstone-not-navigable";

export class TargetResolver {
  readonly #revision: TargetRevision;
  readonly #records = new Map<string, TargetRecord>();
  readonly #lookup:
    ((objectRef: string) => Promise<TargetRecord | null>) | undefined;
  readonly #lookupCache = new Map<string, Promise<TargetRecord | null>>();

  constructor(
    revision: TargetRevision,
    records: readonly TargetRecord[],
    options: {
      readonly lookup?: (objectRef: string) => Promise<TargetRecord | null>;
    } = {},
  ) {
    this.#revision = { ...revision };
    for (const record of records) this.#records.set(record.objectRef, record);
    this.#lookup = options.lookup;
  }

  async prevalidate(actions: readonly ResolvableAction[]): Promise<
    | { readonly ok: true; readonly targets: readonly ResolvedTarget[] }
    | {
        readonly ok: false;
        readonly reason: TargetResolutionFailure;
        readonly acceptedCount: 0;
      }
  > {
    const targets: ResolvedTarget[] = [];
    for (const action of actions) {
      for (const requested of [action.target, action.destination]) {
        if (!requested) continue;
        const resolved = await this.#resolve(action.kind, requested);
        if ("reason" in resolved)
          return { ok: false, reason: resolved.reason, acceptedCount: 0 };
        targets.push(resolved);
      }
    }
    return { ok: true, targets };
  }

  validateDuringRun(
    objectRef: string,
    revision: TargetRevision,
  ):
    | { readonly valid: true }
    | {
        readonly valid: false;
        readonly reason: "revision-changed" | "target-invalid";
        readonly cancelRemainder: true;
      } {
    if (
      revision.repositoryRef !== this.#revision.repositoryRef ||
      revision.worldGeneration !== this.#revision.worldGeneration ||
      revision.layoutGeneration !== this.#revision.layoutGeneration ||
      revision.graphGeneration !== this.#revision.graphGeneration
    )
      return {
        valid: false,
        reason: "revision-changed",
        cancelRemainder: true,
      };
    const target = this.#records.get(objectRef);
    return target &&
      (target.state === "current" || target.state === "tombstone")
      ? { valid: true }
      : { valid: false, reason: "target-invalid", cancelRemainder: true };
  }

  async #resolve(
    actionKind: string,
    requested: {
      readonly repositoryRef: string;
      readonly objectRef: string;
      readonly requestedPath?: string | undefined;
    },
  ): Promise<ResolvedTarget | { readonly reason: TargetResolutionFailure }> {
    if (requested.repositoryRef !== this.#revision.repositoryRef)
      return { reason: "cross-repository" };
    let record = this.#records.get(requested.objectRef);
    if (!record && this.#lookup) {
      let pending = this.#lookupCache.get(requested.objectRef);
      if (!pending) {
        pending = this.#lookup(requested.objectRef);
        this.#lookupCache.set(requested.objectRef, pending);
      }
      record = (await pending) ?? undefined;
      if (record) this.#records.set(record.objectRef, record);
    }
    if (!record) return { reason: "unresolved" };
    if (record.repositoryRef !== this.#revision.repositoryRef)
      return { reason: "cross-repository" };
    if (record.state === "ambiguous") return { reason: "ambiguous" };
    if (record.state === "deleted") return { reason: "deleted" };
    if (record.state === "unsupported") return { reason: "unsupported" };
    if (record.state === "tombstone") {
      if (actionKind !== "focus") return { reason: "tombstone-not-navigable" };
      return {
        ...record,
        ...(requested.requestedPath
          ? { requestedPath: requested.requestedPath }
          : {}),
        ...(record.path ? { currentPath: record.path } : {}),
        continuity: "tombstone",
      };
    }
    if (!requested.requestedPath || requested.requestedPath === record.path) {
      return {
        ...record,
        ...(requested.requestedPath
          ? { requestedPath: requested.requestedPath }
          : {}),
        ...(record.path ? { currentPath: record.path } : {}),
        continuity: "exact",
      };
    }
    if (
      record.continuity === "authoritative" &&
      record.previousPaths?.includes(requested.requestedPath)
    ) {
      return {
        ...record,
        requestedPath: requested.requestedPath,
        ...(record.path ? { currentPath: record.path } : {}),
        continuity: "renamed-authoritative",
      };
    }
    return { reason: "stale-path" };
  }
}
