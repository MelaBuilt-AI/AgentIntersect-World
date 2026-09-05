import type { RepositoryRenderObject } from "./index.js";
import {
  REPOSITORY_ASSET_BY_ID,
  REPOSITORY_ASSET_BY_EVENT,
  type RepositoryAssetId,
  type RepositoryCityStatus,
} from "./repository-asset-manifest.js";

export type RepositoryCityPosition = { readonly x: number; readonly z: number };
export type RepositoryCityLinkedData = Readonly<
  Record<string, string | number | boolean | null>
>;

export type RepositoryCityEvent = {
  readonly id: string;
  readonly type: string;
  readonly status?: RepositoryCityStatus;
  readonly position?: RepositoryCityPosition;
  readonly linkedRepoData?: RepositoryCityLinkedData;
};

export type RepositoryCityInstance = {
  readonly instanceId: string;
  readonly assetId: RepositoryAssetId;
  readonly position: RepositoryCityPosition;
  readonly status: RepositoryCityStatus;
  readonly lifecycle: "materializing" | "idle";
  readonly pinned: boolean;
  readonly manual: boolean;
  readonly linkedRepoData: RepositoryCityLinkedData | null;
  readonly sourceEvent: string | null;
};

export type RepositoryCityState = {
  readonly instances: readonly RepositoryCityInstance[];
};

export type RepositoryCityAction =
  | {
      readonly type: "initial";
      readonly instances: readonly RepositoryCityInstance[];
    }
  | { readonly type: "event"; readonly event: RepositoryCityEvent }
  | { readonly type: "settled"; readonly instanceId: string }
  | {
      readonly type: "manual.add";
      readonly instanceId: string;
      readonly assetId: RepositoryAssetId;
      readonly position: RepositoryCityPosition;
    }
  | {
      readonly type: "pin";
      readonly instanceId: string;
      readonly pinned: boolean;
    }
  | { readonly type: "remove"; readonly instanceId: string };

export const createRepositoryCityState = (): RepositoryCityState => ({
  instances: [],
});

export function canOccupyRepositoryCity(
  instances: readonly RepositoryCityInstance[],
  position: RepositoryCityPosition,
  targetObjectId: string | null,
): boolean {
  return instances.every((instance) => {
    if (instance.linkedRepoData?.ref === targetObjectId) return true;
    const footprint = REPOSITORY_ASSET_BY_ID.get(instance.assetId)!.footprint;
    return (
      Math.abs(position.x - instance.position.x) >= footprint[0] / 2 + 0.45 ||
      Math.abs(position.z - instance.position.z) >= footprint[1] / 2 + 0.45
    );
  });
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function parseRepositoryCityEvent(input: unknown): RepositoryCityEvent {
  if (
    !isObject(input) ||
    typeof input.id !== "string" ||
    input.id.length === 0 ||
    typeof input.type !== "string"
  )
    throw new Error("Invalid repository city event");
  if (!REPOSITORY_ASSET_BY_EVENT.has(input.type))
    throw new Error(`Unsupported repository city event: ${input.type}`);
  if (
    input.status !== undefined &&
    input.status !== "idle" &&
    input.status !== "active" &&
    input.status !== "pending" &&
    input.status !== "failure" &&
    input.status !== "special"
  )
    throw new Error("Invalid repository city event status");
  if (
    input.position !== undefined &&
    (!isObject(input.position) ||
      typeof input.position.x !== "number" ||
      !Number.isFinite(input.position.x) ||
      typeof input.position.z !== "number" ||
      !Number.isFinite(input.position.z))
  )
    throw new Error("Invalid repository city event position");
  if (input.linkedRepoData !== undefined && !isObject(input.linkedRepoData))
    throw new Error("Invalid repository city linked data");
  return input as RepositoryCityEvent;
}

const hashText = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const REPOSITORY_CITY_FLOOR_SIZE = 68;

/** Monotonic session extent, including real footprints and room for the operator. */
export function worldFloorSize(
  previous: number,
  repositoryObjectCount: number,
  instances: readonly RepositoryCityInstance[],
  occupants: readonly { x: number; z: number; radius: number }[],
): number {
  let half =
    Math.max(
      previous,
      REPOSITORY_CITY_FLOOR_SIZE,
      Math.sqrt(repositoryObjectCount) * 3 + 16,
    ) / 2;
  for (const instance of instances) {
    const [width, depth] = REPOSITORY_ASSET_BY_ID.get(
      instance.assetId,
    )!.footprint;
    half = Math.max(
      half,
      Math.abs(instance.position.x) + width / 2 + 4,
      Math.abs(instance.position.z) + depth / 2 + 4,
    );
  }
  for (const { x, z, radius } of occupants)
    half = Math.max(half, Math.abs(x) + radius + 4, Math.abs(z) + radius + 4);
  return Math.ceil((half * 2) / 4) * 4;
}
export const REPOSITORY_CITY_PLACEMENT_CLEARANCE = 0.5;
export const MAX_REPOSITORY_CITY_INSTANCES = 48;
const PLACEMENT_STEP = 3;
const PLACEMENT_COLUMNS = 10;
const PLACEMENT_SLOTS = PLACEMENT_COLUMNS ** 2;

const placementCandidate = (
  key: string,
  attempt: number,
): RepositoryCityPosition => {
  const index = (hashText(key) + attempt) % PLACEMENT_SLOTS;
  return {
    x: (index % PLACEMENT_COLUMNS) * PLACEMENT_STEP - 13.5,
    z: Math.floor(index / PLACEMENT_COLUMNS) * PLACEMENT_STEP - 13.5,
  };
};

const gridPosition = (key: string): RepositoryCityPosition =>
  placementCandidate(key, 0);

const withinFloor = (
  assetId: RepositoryAssetId,
  position: RepositoryCityPosition,
): boolean => {
  const [width, depth] = REPOSITORY_ASSET_BY_ID.get(assetId)!.footprint;
  const halfFloor = Math.max(REPOSITORY_CITY_FLOOR_SIZE / 2, 64);
  return (
    Math.abs(position.x) + width / 2 + REPOSITORY_CITY_PLACEMENT_CLEARANCE <=
      halfFloor &&
    Math.abs(position.z) + depth / 2 + REPOSITORY_CITY_PLACEMENT_CLEARANCE <=
      halfFloor
  );
};

const overlapsInstance = (
  instances: readonly RepositoryCityInstance[],
  assetId: RepositoryAssetId,
  position: RepositoryCityPosition,
): boolean => {
  const candidate = REPOSITORY_ASSET_BY_ID.get(assetId)!.footprint;
  return instances.some((instance) => {
    const existing = REPOSITORY_ASSET_BY_ID.get(instance.assetId)!.footprint;
    return (
      Math.abs(position.x - instance.position.x) <
        (candidate[0] + existing[0]) / 2 +
          REPOSITORY_CITY_PLACEMENT_CLEARANCE &&
      Math.abs(position.z - instance.position.z) <
        (candidate[1] + existing[1]) / 2 + REPOSITORY_CITY_PLACEMENT_CLEARANCE
    );
  });
};

const nonOverlappingPosition = (
  instances: readonly RepositoryCityInstance[],
  assetId: RepositoryAssetId,
  preferred: RepositoryCityPosition,
  key: string,
): RepositoryCityPosition => {
  if (
    Math.hypot(preferred.x, preferred.z) >= 6 &&
    withinFloor(assetId, preferred) &&
    !overlapsInstance(instances, assetId, preferred)
  )
    return preferred;
  for (let attempt = 0; attempt < PLACEMENT_SLOTS; attempt += 1) {
    const candidate = placementCandidate(key, attempt);
    if (
      Math.hypot(candidate.x, candidate.z) >= 6 &&
      withinFloor(assetId, candidate) &&
      !overlapsInstance(instances, assetId, candidate)
    )
      return candidate;
  }
  throw new Error("Repository city placement capacity is exhausted");
};

const defaultStatus = (type: string): RepositoryCityStatus => {
  if (/failed|error|conflict|issue/u.test(type)) return "failure";
  if (/merged|release|deployment/u.test(type)) return "special";
  if (/running|started|opened|selected|scan/u.test(type)) return "pending";
  return "active";
};

const eventInstance = (
  event: RepositoryCityEvent,
  instances: readonly RepositoryCityInstance[],
): RepositoryCityInstance => {
  const asset = REPOSITORY_ASSET_BY_EVENT.get(event.type);
  if (!asset)
    throw new Error(`Unsupported repository city event: ${event.type}`);
  const instanceId = `event:${event.type}:${event.id}`;
  return {
    instanceId,
    assetId: asset.id,
    position: nonOverlappingPosition(
      instances,
      asset.id,
      event.position ?? gridPosition(`${event.type}:${event.id}`),
      instanceId,
    ),
    status: event.status ?? defaultStatus(event.type),
    lifecycle: "materializing",
    pinned: false,
    manual: false,
    linkedRepoData: event.linkedRepoData ?? null,
    sourceEvent: event.type,
  };
};

const initialAsset = (object: RepositoryRenderObject): RepositoryAssetId => {
  if (object.kind === "package") return "04-repository-root-hub";
  if (object.kind === "directory") return "05-directory-archive-gate";
  if (object.kind === "symbol") return "12-function-node";
  if (object.fileKind === "test") return "06-test-beacon";
  if (object.fileKind === "documentation") return "08-documentation-codex";
  if (object.fileKind === "configuration" || object.fileKind === "manifest")
    return "09-configuration-console";
  if (object.fileKind === "data") return "10-data-storage-vault";
  if (object.fileKind === "asset" || object.fileKind === "binary")
    return "11-binary-artifact-crate";
  return "01-code-slab";
};

export function projectRepositoryObjects(
  objects: readonly RepositoryRenderObject[],
): readonly RepositoryCityInstance[] {
  const placed: Array<{
    readonly inputIndex: number;
    readonly instance: RepositoryCityInstance;
  }> = [];
  const ordered = objects
    .map((object, inputIndex) => ({ object, inputIndex }))
    .sort(
      (left, right) =>
        left.object.ref.localeCompare(right.object.ref) ||
        left.inputIndex - right.inputIndex,
    )
    .slice(0, MAX_REPOSITORY_CITY_INSTANCES);
  for (const { object, inputIndex } of ordered) {
    const assetId = initialAsset(object);
    const instanceId = `repository:${object.ref}`;
    const instance: RepositoryCityInstance = {
      instanceId,
      assetId,
      position: nonOverlappingPosition(
        placed.map(({ instance: candidate }) => candidate),
        assetId,
        gridPosition(object.ref),
        instanceId,
      ),
      status: "idle",
      lifecycle: "materializing",
      pinned: false,
      manual: false,
      linkedRepoData: {
        ref: object.ref,
        label: object.name,
        kind: object.kind,
        ...(object.repositoryRef
          ? { repositoryRef: object.repositoryRef }
          : {}),
        ...(object.path !== undefined ? { path: object.path } : {}),
        ...(object.parentRef !== undefined
          ? { parentRef: object.parentRef }
          : {}),
        ...(object.parentLabel ? { parentLabel: object.parentLabel } : {}),
        ...(object.parentPath ? { parentPath: object.parentPath } : {}),
        ...(object.childCount !== undefined
          ? { childCount: object.childCount }
          : {}),
        ...(object.directChildren
          ? { directChildren: object.directChildren }
          : {}),
        ...(object.fileCount !== undefined
          ? { fileCount: object.fileCount }
          : {}),
        ...(object.packageKind ? { packageKind: object.packageKind } : {}),
        ...(object.packageName !== undefined
          ? { packageName: object.packageName }
          : {}),
        ...(object.fileKind ? { fileKind: object.fileKind } : {}),
        ...(object.language !== undefined ? { language: object.language } : {}),
        ...(object.size !== undefined ? { size: object.size } : {}),
      },
      sourceEvent:
        object.kind === "package"
          ? "repository.loaded"
          : object.kind === "directory"
            ? "directory.discovered"
            : "file.updated",
    };
    placed.push({ inputIndex, instance });
  }
  return placed
    .sort((left, right) => left.inputIndex - right.inputIndex)
    .map(({ instance }) => instance);
}

export function reduceRepositoryCity(
  state: RepositoryCityState,
  action: RepositoryCityAction,
): RepositoryCityState {
  if (action.type === "initial") return { instances: action.instances };
  if (action.type === "event") {
    const instanceId = `event:${action.event.type}:${action.event.id}`;
    const existing = state.instances.findIndex(
      (instance) => instance.instanceId === instanceId,
    );
    const next = eventInstance(
      action.event,
      existing < 0
        ? state.instances
        : state.instances.filter((_, index) => index !== existing),
    );
    if (existing < 0) return { instances: [...state.instances, next] };
    return {
      instances: state.instances.map((instance, index) =>
        index === existing
          ? { ...next, pinned: instance.pinned, position: instance.position }
          : instance,
      ),
    };
  }
  if (action.type === "manual.add") {
    const manual: RepositoryCityInstance = {
      instanceId: action.instanceId,
      assetId: action.assetId,
      position: nonOverlappingPosition(
        state.instances,
        action.assetId,
        {
          x: Math.round(action.position.x),
          z: Math.round(action.position.z),
        },
        action.instanceId,
      ),
      status: "active",
      lifecycle: "materializing",
      pinned: true,
      manual: true,
      linkedRepoData: null,
      sourceEvent: null,
    };
    return { instances: [...state.instances, manual] };
  }
  if (action.type === "remove")
    return {
      instances: state.instances.filter(
        (instance) =>
          instance.instanceId !== action.instanceId || !instance.manual,
      ),
    };
  return {
    instances: state.instances.map((instance) =>
      instance.instanceId !== action.instanceId
        ? instance
        : action.type === "settled"
          ? { ...instance, lifecycle: "idle" }
          : { ...instance, pinned: action.pinned },
    ),
  };
}
