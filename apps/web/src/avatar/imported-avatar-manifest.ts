import {
  IMPORTED_AVATAR_ASSETS,
  IMPORTED_AVATAR_MANIFEST,
  validateImportedAvatarRegistry,
  type ImportedAvatarAsset,
  type ImportedAvatarAssetId,
} from "@agentintersect-world/avatar-system/imported-avatar";
import type { ImportedAvatarPart } from "@agentintersect-world/renderer-r3f/imported-avatar";

export const IMPORTED_AVATAR_PART_REGIONS = [
  "head-weighted",
  "torso-weighted",
  "left-arm-weighted",
  "right-arm-weighted",
  "left-leg-weighted",
  "right-leg-weighted",
  "mixed-or-auxiliary",
] as const;
export type ImportedAvatarPartRegion =
  (typeof IMPORTED_AVATAR_PART_REGIONS)[number];

export type ImportedAvatarManifestPart = ImportedAvatarPart & {
  readonly classification: {
    readonly method: "aggregated-skin-weight-region-isolation";
    readonly region: ImportedAvatarPartRegion;
    readonly dominantJoint: string;
    readonly dominantWeight: number;
  };
};

export type ImportedAvatarManifestAsset = {
  readonly id: ImportedAvatarAssetId;
  readonly sha256: string;
  readonly thumbnailSha256: string;
  readonly byteSize: number;
  readonly thumbnailByteSize: number;
  readonly inverseBindMatricesSha256: readonly string[];
  readonly registry: ImportedAvatarAsset;
  readonly parts: readonly ImportedAvatarManifestPart[];
};

export type ImportedAvatarManifest = {
  readonly schema: "aiw.replacement-avatar-assets/3";
  readonly authority: "repository-owned-replacement-avatar-registry";
  readonly assets: readonly ImportedAvatarManifestAsset[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const manifestError = (message: string): never => {
  throw new TypeError(`Invalid imported avatar manifest: ${message}`);
};

const hash = /^[a-f0-9]{64}$/u;

export function validateImportedAvatarManifest(
  value: unknown,
): ImportedAvatarManifest {
  if (
    !isRecord(value) ||
    value.schema !== "aiw.replacement-avatar-assets/3" ||
    value.authority !== "repository-owned-replacement-avatar-registry" ||
    !Array.isArray(value.assets)
  )
    return manifestError("schema, authority, and assets are required");
  const manifestIds = new Set<string>();
  for (const source of value.assets) {
    if (!isRecord(source) || typeof source.id !== "string")
      return manifestError("every asset requires a stable id");
    if (manifestIds.has(source.id))
      return manifestError(`duplicate manifest asset ${source.id}`);
    manifestIds.add(source.id);
  }
  if (value.assets.length !== IMPORTED_AVATAR_ASSETS.length)
    return manifestError("manifest and runtime registry asset counts differ");
  const registry = validateImportedAvatarRegistry(
    value.assets.map((source) =>
      isRecord(source) ? source.registry : undefined,
    ),
  );
  const assets: ImportedAvatarManifestAsset[] = [];
  for (const runtimeAsset of IMPORTED_AVATAR_ASSETS) {
    const assetId = runtimeAsset.id;
    const source = value.assets.find(
      (candidate) => isRecord(candidate) && candidate.id === assetId,
    );
    if (
      !isRecord(source) ||
      !hash.test(String(source.sha256)) ||
      !hash.test(String(source.thumbnailSha256)) ||
      !Number.isInteger(source.byteSize) ||
      (source.byteSize as number) <= 0 ||
      !Number.isInteger(source.thumbnailByteSize) ||
      (source.thumbnailByteSize as number) <= 0
    )
      return manifestError(
        `${assetId} GLB and thumbnail hashes and byte sizes are required`,
      );
    const registryAsset = registry.find((entry) => entry.id === assetId);
    if (!registryAsset)
      return manifestError(`${assetId} registry metadata is required`);
    if (
      registryAsset.assetUrl !== runtimeAsset.assetUrl ||
      registryAsset.thumbnailUrl !== runtimeAsset.thumbnailUrl
    )
      return manifestError(
        `${assetId} manifest registry metadata differs from runtime authority`,
      );
    if (
      !Array.isArray(source.inverseBindMatricesSha256) ||
      source.inverseBindMatricesSha256.length !== 1 ||
      source.inverseBindMatricesSha256[0] !==
        (
          registryAsset as unknown as {
            skeleton: { inverseBindSha256: string };
          }
        ).skeleton.inverseBindSha256
    )
      return manifestError(
        `${assetId} inverse-bind fingerprint differs from registry`,
      );
    if (
      !Array.isArray(source.parts) ||
      source.parts.length !== runtimeAsset.segments.partCount
    )
      return manifestError(`${assetId} stable part inventory is incomplete`);
    const parts: ImportedAvatarManifestPart[] = [];
    for (let index = 0; index < source.parts.length; index += 1) {
      const part = source.parts[index];
      const expectedPartId = `${assetId}:part:${String(index).padStart(2, "0")}`;
      if (
        typeof expectedPartId !== "string" ||
        !isRecord(part) ||
        part.partId !== expectedPartId ||
        typeof part.nodeName !== "string" ||
        !/^tripo_(?:part_\d+|node_[a-f0-9-]+)$/u.test(part.nodeName) ||
        !isRecord(part.classification) ||
        part.classification.method !==
          "aggregated-skin-weight-region-isolation" ||
        !IMPORTED_AVATAR_PART_REGIONS.includes(
          part.classification.region as ImportedAvatarPartRegion,
        ) ||
        typeof part.classification.dominantJoint !== "string" ||
        typeof part.classification.dominantWeight !== "number" ||
        part.classification.dominantWeight < 0 ||
        part.classification.dominantWeight > 1
      )
        return manifestError(
          `${assetId} part ${index} has invalid or ambiguous metadata`,
        );
      parts.push({
        partId: expectedPartId,
        nodeName: part.nodeName,
        classification: {
          method: "aggregated-skin-weight-region-isolation",
          region: part.classification.region as ImportedAvatarPartRegion,
          dominantJoint: part.classification.dominantJoint,
          dominantWeight: part.classification.dominantWeight,
        },
      });
    }
    assets.push({
      id: assetId,
      sha256: source.sha256 as string,
      thumbnailSha256: source.thumbnailSha256 as string,
      byteSize: source.byteSize as number,
      thumbnailByteSize: source.thumbnailByteSize as number,
      inverseBindMatricesSha256: source.inverseBindMatricesSha256 as string[],
      registry: registryAsset,
      parts,
    });
  }
  return {
    schema: "aiw.replacement-avatar-assets/3",
    authority: "repository-owned-replacement-avatar-registry",
    assets,
  };
}

export function parseImportedAvatarManifest(
  value: unknown,
): ImportedAvatarManifest | null {
  try {
    return validateImportedAvatarManifest(value);
  } catch {
    return null;
  }
}

let manifestPromise: Promise<ImportedAvatarManifest> | undefined;

export function loadImportedAvatarManifest(): Promise<ImportedAvatarManifest> {
  manifestPromise ??= fetch(IMPORTED_AVATAR_MANIFEST)
    .then(async (response) => {
      if (!response.ok)
        throw new Error(`Imported manifest unavailable (${response.status}).`);
      return validateImportedAvatarManifest(await response.json());
    })
    .catch((error) => {
      manifestPromise = undefined;
      throw error;
    });
  return manifestPromise;
}

export type ImportedAvatarPartGroup = {
  readonly region: ImportedAvatarPartRegion;
  readonly label: string;
  readonly parts: readonly ImportedAvatarManifestPart[];
};

const REGION_LABELS: Readonly<Record<ImportedAvatarPartRegion, string>> = {
  "head-weighted": "Head weighted",
  "torso-weighted": "Torso weighted",
  "left-arm-weighted": "Left arm weighted",
  "right-arm-weighted": "Right arm weighted",
  "left-leg-weighted": "Left leg weighted",
  "right-leg-weighted": "Right leg weighted",
  "mixed-or-auxiliary": "Mixed / auxiliary",
};

export function importedAvatarPartGroups(
  asset: ImportedAvatarManifestAsset,
): readonly ImportedAvatarPartGroup[] {
  return IMPORTED_AVATAR_PART_REGIONS.map((region) => ({
    region,
    label: REGION_LABELS[region],
    parts: asset.parts.filter((part) => part.classification.region === region),
  })).filter((group) => group.parts.length > 0);
}

export function isolateImportedAvatarGroup(
  asset: ImportedAvatarManifestAsset,
  region: ImportedAvatarPartRegion,
): readonly string[] {
  return asset.parts
    .filter((part) => part.classification.region !== region)
    .map((part) => part.partId);
}

export function toggleImportedAvatarGroup(
  hiddenPartIds: readonly string[],
  group: ImportedAvatarPartGroup,
): readonly string[] {
  const hidden = new Set(hiddenPartIds);
  const allVisible = group.parts.every((part) => !hidden.has(part.partId));
  for (const part of group.parts) {
    if (allVisible) hidden.add(part.partId);
    else hidden.delete(part.partId);
  }
  return [...hidden].sort();
}
