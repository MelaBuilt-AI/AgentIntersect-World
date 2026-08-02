import {
  AVATAR_PROFILE_STORAGE_KEY,
  DEFAULT_AVATAR_DRAFT,
  avatarProfileSummary,
  createAvatarProfile,
  loadAvatarProfiles,
  parseAvatarDraft,
  parseAvatarProfile,
  type AvatarAction,
  type AvatarDraft,
  type AvatarLoadResult,
  type AvatarProfile,
  type AvatarStorage,
} from "./index.js";
import { GENERATED_IMPORTED_AVATAR_REGISTRY } from "./imported-avatar-registry.generated.js";

export const IMPORTED_AVATAR_MANIFEST =
  "/assets/imported-avatars/manifest.json";

export type ImportedAvatarAssetId =
  (typeof GENERATED_IMPORTED_AVATAR_REGISTRY)[number]["id"];
export const IMPORTED_AVATAR_ASSET_IDS = Object.freeze(
  GENERATED_IMPORTED_AVATAR_REGISTRY.map((asset) => asset.id),
) as readonly ImportedAvatarAssetId[];

export const IMPORTED_AVATAR_SEMANTICS = [
  "Idle",
  "Walk",
  "Run",
  "Jump",
  "Dance",
  "Clap",
  "Cheer",
  "Wave",
  "Bow",
  "Agree",
  "Angry",
  "Laugh",
] as const;
export type ImportedAvatarSemantic = (typeof IMPORTED_AVATAR_SEMANTICS)[number];
export type ImportedAvatarLocomotion = "Idle" | "Walk" | "Run";
export type ImportedAvatarSemanticReviewVerdict =
  "pass" | "wrong_clip" | "ambiguous" | "unsupported";
export type ImportedAvatarSemanticReviewDecision = {
  readonly verdict: ImportedAvatarSemanticReviewVerdict;
  readonly reviewedClipIndex: number;
  readonly expectedClipIndex: number | null;
  readonly rationale: string;
  readonly evidenceRefs: readonly string[];
};
export type AvatarBuilderRole = "user" | "agent";
export const IMPORTED_AVATAR_SLOT_IDS = [
  "head",
  "torso",
  "left-arm",
  "right-arm",
  "left-leg",
  "right-leg",
  "auxiliary",
] as const;
export type ImportedAvatarSlotId = (typeof IMPORTED_AVATAR_SLOT_IDS)[number];
export const IMPORTED_AVATAR_REGION_IDS = [
  "head-weighted",
  "torso-weighted",
  "left-arm-weighted",
  "right-arm-weighted",
  "left-leg-weighted",
  "right-leg-weighted",
  "mixed-or-auxiliary",
] as const;
export type ImportedAvatarRegionId =
  (typeof IMPORTED_AVATAR_REGION_IDS)[number];
export type ImportedAvatarCoreSlotId = Exclude<
  ImportedAvatarSlotId,
  "auxiliary"
>;
export type ImportedAvatarSlotSelection = {
  readonly donorModelId: ImportedAvatarAssetId;
  readonly regionId: ImportedAvatarRegionId;
};
export type ImportedAvatarOriginalSource = {
  readonly kind: "imported";
  readonly version: 2;
  readonly mode: "original";
  readonly modelId: ImportedAvatarAssetId;
};
export type ImportedAvatarModularSource = {
  readonly kind: "imported";
  readonly version: 2;
  readonly mode: "modular";
  readonly baseModelId: ImportedAvatarAssetId;
  readonly slots: Readonly<
    Record<ImportedAvatarCoreSlotId, ImportedAvatarSlotSelection> &
      Partial<Record<"auxiliary", ImportedAvatarSlotSelection>>
  >;
};
export type AvatarSourceSelection =
  | { readonly kind: "custom" }
  | ImportedAvatarOriginalSource
  | ImportedAvatarModularSource
  | {
      readonly kind: "reselection-required";
      readonly version: 2;
      readonly reason: "removed-or-unknown-model";
    };
export type ImportedAvatarRegion = {
  readonly regionId: ImportedAvatarRegionId;
  readonly supported: boolean;
  readonly partCount: number;
};
export type ImportedAvatarAsset = {
  readonly id: ImportedAvatarAssetId;
  readonly label: string;
  readonly family:
    "cat-agent" | "dog-agent" | "robot-agent" | "user-male" | "user-female";
  readonly number: number;
  readonly originalRole: AvatarBuilderRole;
  readonly allowedRoles: readonly AvatarBuilderRole[];
  readonly assetUrl: string;
  readonly thumbnailUrl: string;
  readonly clipCount: number;
  readonly clips: readonly string[];
  readonly semanticClips: Readonly<
    Record<
      ImportedAvatarSemantic,
      {
        readonly clipIndex: number;
        readonly clipName: string;
        readonly durationSeconds: number;
        readonly verification: "structural-temporal-evidence";
      }
    >
  >;
  readonly semanticReview: Readonly<
    Record<ImportedAvatarSemantic, ImportedAvatarSemanticReviewDecision>
  >;
  readonly segments: {
    readonly partCount: number;
    readonly regions: Readonly<
      Record<ImportedAvatarSlotId, ImportedAvatarRegion>
    >;
  };
  readonly preview: {
    readonly position: readonly [number, number, number];
    readonly rotation: readonly [number, number, number];
    readonly scale: number;
  };
  readonly world: {
    readonly rotation: readonly [number, number, number];
    readonly scale: number;
    readonly groundOffset: number;
  };
};
export type ResolvedImportedAvatarWorldClip = {
  readonly assetId: ImportedAvatarAssetId;
  readonly clipIndex: number;
  readonly clipName: string;
  readonly semantic: ImportedAvatarSemantic;
  readonly locomotion: ImportedAvatarLocomotion;
  readonly oneShot: boolean;
  readonly durationSeconds: number;
  readonly verification: "semantic-review-pass";
};

declare module "./index.js" {
  interface AvatarDraft {
    readonly avatarSource?: AvatarSourceSelection;
  }
}

const SLOT_REGIONS: Readonly<
  Record<ImportedAvatarSlotId, ImportedAvatarRegionId>
> = {
  head: "head-weighted",
  torso: "torso-weighted",
  "left-arm": "left-arm-weighted",
  "right-arm": "right-arm-weighted",
  "left-leg": "left-leg-weighted",
  "right-leg": "right-leg-weighted",
  auxiliary: "mixed-or-auxiliary",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const exactKeys = (
  record: Record<string, unknown>,
  keys: readonly string[],
): boolean =>
  Object.keys(record).length === keys.length &&
  keys.every((key) => Object.hasOwn(record, key));
const registryError = (message: string): never => {
  throw new TypeError(`Invalid imported avatar registry: ${message}`);
};

export function validateImportedAvatarRegistry(
  value: unknown,
): readonly ImportedAvatarAsset[] {
  if (!Array.isArray(value) || value.length !== 23)
    return registryError("exactly 23 replacement models are required");
  const ids = new Set<string>();
  const normalized: ImportedAvatarAsset[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.id !== "string")
      return registryError("each model requires a stable id");
    const id = candidate.id;
    if (ids.has(id)) return registryError(`duplicate model id ${id}`);
    ids.add(id);
    if (!IMPORTED_AVATAR_ASSET_IDS.includes(id as ImportedAvatarAssetId))
      return registryError(`model id ${id} is not allowlisted`);
    if (
      !Array.isArray(candidate.allowedRoles) ||
      candidate.allowedRoles.length !== 1 ||
      (candidate.allowedRoles[0] !== "user" &&
        candidate.allowedRoles[0] !== "agent") ||
      candidate.originalRole !== candidate.allowedRoles[0]
    )
      return registryError(`${id} allowedRoles are invalid or ambiguous`);
    for (const key of ["assetUrl", "thumbnailUrl"] as const)
      if (
        typeof candidate[key] !== "string" ||
        !(candidate[key] as string).startsWith("/assets/imported-avatars/") ||
        /cat-agent\.(?:glb|png)|futuristic-robot|user-male\.(?:glb|png)/u.test(
          candidate[key] as string,
        )
      )
        return registryError(`${id} asset URLs must be replacement-owned`);
    if (
      !Number.isInteger(candidate.clipCount) ||
      ((candidate.clipCount as number) !== 21 &&
        (candidate.clipCount as number) !== 22)
    )
      return registryError(`${id} clip inventory and evidence are required`);
    const semanticDurations = Array.isArray(candidate.semanticDurations)
      ? candidate.semanticDurations
      : undefined;
    const semanticEvidence = isRecord(candidate.semanticEvidence)
      ? candidate.semanticEvidence
      : undefined;
    const compactSemanticEvidence =
      semanticDurations?.length === IMPORTED_AVATAR_SEMANTICS.length;
    const manifestSemanticEvidence =
      semanticEvidence !== undefined &&
      exactKeys(semanticEvidence, IMPORTED_AVATAR_SEMANTICS);
    const semanticReview = isRecord(candidate.semanticReview)
      ? candidate.semanticReview
      : undefined;
    const semanticReviewVerdicts = Array.isArray(
      candidate.semanticReviewVerdicts,
    )
      ? candidate.semanticReviewVerdicts
      : undefined;
    const semanticReviewExpectedClipIndices = Array.isArray(
      candidate.semanticReviewExpectedClipIndices,
    )
      ? candidate.semanticReviewExpectedClipIndices
      : undefined;
    const compactSemanticReview =
      semanticReviewVerdicts?.length === IMPORTED_AVATAR_SEMANTICS.length &&
      semanticReviewExpectedClipIndices?.length ===
        IMPORTED_AVATAR_SEMANTICS.length;
    const manifestSemanticReview =
      semanticReview !== undefined &&
      exactKeys(semanticReview, IMPORTED_AVATAR_SEMANTICS);
    if (
      !isRecord(candidate.semanticClips) ||
      !exactKeys(candidate.semanticClips, IMPORTED_AVATAR_SEMANTICS) ||
      (!compactSemanticReview && !manifestSemanticReview) ||
      (!compactSemanticEvidence && !manifestSemanticEvidence)
    )
      return registryError(`${id} semantic evidence table is incomplete`);
    const mappedIndices = new Set<number>();
    const semanticClips = {} as Record<
      ImportedAvatarSemantic,
      ImportedAvatarAsset["semanticClips"][ImportedAvatarSemantic]
    >;
    const normalizedSemanticReview = {} as Record<
      ImportedAvatarSemantic,
      ImportedAvatarSemanticReviewDecision
    >;
    for (const [
      semanticIndex,
      semantic,
    ] of IMPORTED_AVATAR_SEMANTICS.entries()) {
      const clipIndex = candidate.semanticClips[semantic];
      const evidence = manifestSemanticEvidence
        ? semanticEvidence[semantic]
        : undefined;
      const durationSeconds = compactSemanticEvidence
        ? semanticDurations?.[semanticIndex]
        : isRecord(evidence)
          ? evidence.durationSeconds
          : undefined;
      const detailedReview = manifestSemanticReview
        ? semanticReview[semantic]
        : undefined;
      const encodedVerdict = compactSemanticReview
        ? semanticReviewVerdicts?.[semanticIndex]
        : undefined;
      const verdict = manifestSemanticReview
        ? isRecord(detailedReview)
          ? detailedReview.verdict
          : undefined
        : (
            {
              p: "pass",
              w: "wrong_clip",
              a: "ambiguous",
              u: "unsupported",
            } as const
          )[encodedVerdict as "p" | "w" | "a" | "u"];
      const expectedClipIndex = manifestSemanticReview
        ? isRecord(detailedReview)
          ? detailedReview.expectedClipIndex
          : undefined
        : semanticReviewExpectedClipIndices?.[semanticIndex];
      if (
        !Number.isInteger(clipIndex) ||
        (clipIndex as number) < 0 ||
        (clipIndex as number) >= (candidate.clipCount as number) ||
        !Number.isFinite(durationSeconds) ||
        (durationSeconds as number) <= 0 ||
        (manifestSemanticEvidence &&
          (!isRecord(evidence) ||
            evidence.clipIndex !== clipIndex ||
            typeof evidence.clipName !== "string" ||
            !Number.isInteger(evidence.channelCount) ||
            (evidence.channelCount as number) <= 0 ||
            !Number.isInteger(evidence.targetCount) ||
            (evidence.targetCount as number) <= 0 ||
            evidence.verification !== "structural-temporal-evidence")) ||
        !["pass", "wrong_clip", "ambiguous", "unsupported"].includes(
          verdict as string,
        ) ||
        (manifestSemanticReview &&
          (!isRecord(detailedReview) ||
            detailedReview.reviewedClipIndex !== clipIndex ||
            typeof detailedReview.rationale !== "string" ||
            detailedReview.rationale.length <= 20 ||
            !Array.isArray(detailedReview.evidenceRefs) ||
            detailedReview.evidenceRefs.length === 0 ||
            detailedReview.evidenceRefs.some(
              (reference) =>
                typeof reference !== "string" || reference.length === 0,
            ))) ||
        (verdict === "pass"
          ? expectedClipIndex !== clipIndex
          : expectedClipIndex !== null)
      )
        return registryError(`${id} ${semantic} semantic evidence is invalid`);
      if (mappedIndices.has(clipIndex as number))
        return registryError(`${id} semantic mappings are ambiguous`);
      mappedIndices.add(clipIndex as number);
      semanticClips[semantic] = {
        clipIndex: clipIndex as number,
        clipName: isRecord(evidence)
          ? (evidence.clipName as string)
          : clipIndex === 0
            ? "NlaTrack"
            : `NlaTrack.${String(clipIndex).padStart(3, "0")}`,
        durationSeconds: durationSeconds as number,
        verification: "structural-temporal-evidence",
      };
      normalizedSemanticReview[semantic] = {
        verdict: verdict as ImportedAvatarSemanticReviewVerdict,
        reviewedClipIndex: clipIndex as number,
        expectedClipIndex: expectedClipIndex as number | null,
        rationale: manifestSemanticReview
          ? ((detailedReview as Record<string, unknown>).rationale as string)
          : "See the deterministic model-wide semantic review artifact for the reviewed rationale.",
        evidenceRefs: manifestSemanticReview
          ? ((detailedReview as Record<string, unknown>)
              .evidenceRefs as readonly string[])
          : [
              "artifacts/avatar-replacement-evidence/world-animation-semantic-review-v2/semantic-review.json",
            ],
      };
    }
    if (
      !Number.isInteger(candidate.partCount) ||
      (candidate.partCount as number) <= 0 ||
      !Array.isArray(candidate.supportedSlots) ||
      candidate.supportedSlots.some(
        (slot) =>
          typeof slot !== "string" ||
          !IMPORTED_AVATAR_SLOT_IDS.includes(slot as ImportedAvatarSlotId),
      )
    )
      return registryError(`${id} segment inventory is required`);
    const supportedSlots = new Set(candidate.supportedSlots as string[]);
    const regions = Object.fromEntries(
      IMPORTED_AVATAR_SLOT_IDS.map((slot) => [
        slot,
        {
          regionId: SLOT_REGIONS[slot],
          supported: supportedSlots.has(slot),
          partCount: supportedSlots.has(slot) ? 1 : 0,
        },
      ]),
    ) as Record<ImportedAvatarSlotId, ImportedAvatarRegion>;
    normalized.push({
      ...(candidate as unknown as Omit<
        ImportedAvatarAsset,
        "clips" | "semanticClips"
      >),
      clips: Array.from(
        { length: candidate.clipCount as number },
        (_, index) =>
          index === 0
            ? "NlaTrack"
            : `NlaTrack.${String(index).padStart(3, "0")}`,
      ),
      semanticClips,
      semanticReview: normalizedSemanticReview,
      segments: {
        partCount: candidate.partCount as number,
        regions,
      },
    });
  }
  return Object.freeze(normalized);
}

export const IMPORTED_AVATAR_ASSETS = validateImportedAvatarRegistry(
  GENERATED_IMPORTED_AVATAR_REGISTRY,
);

export function importedAvatarAsset(
  assetId: unknown,
): ImportedAvatarAsset | undefined {
  return typeof assetId === "string"
    ? IMPORTED_AVATAR_ASSETS.find((asset) => asset.id === assetId)
    : undefined;
}

export function importedAvatarAssetsForRole(
  role: AvatarBuilderRole,
): readonly ImportedAvatarAsset[] {
  return IMPORTED_AVATAR_ASSETS.filter((asset) =>
    asset.allowedRoles.includes(role),
  );
}

const CORE_SLOTS = IMPORTED_AVATAR_SLOT_IDS.filter(
  (slot): slot is ImportedAvatarCoreSlotId => slot !== "auxiliary",
);

export const CUSTOM_AVATAR_SOURCE: AvatarSourceSelection = Object.freeze({
  kind: "custom",
});
export const AVATAR_RESELECTION_REQUIRED: AvatarSourceSelection = Object.freeze(
  {
    kind: "reselection-required",
    version: 2,
    reason: "removed-or-unknown-model",
  },
);

export function createOriginalImportedAvatarSource(
  modelId: unknown,
): ImportedAvatarOriginalSource {
  const asset = importedAvatarAsset(modelId);
  if (!asset)
    throw new TypeError(`Unknown replacement avatar ${String(modelId)}`);
  return { kind: "imported", version: 2, mode: "original", modelId: asset.id };
}

function supportedDonor(
  slot: ImportedAvatarSlotId,
  preferred?: ImportedAvatarAsset,
): ImportedAvatarAsset {
  if (preferred?.segments.regions[slot].supported) return preferred;
  const donor = IMPORTED_AVATAR_ASSETS.find(
    (asset) => asset.segments.regions[slot].supported,
  );
  if (!donor)
    throw new TypeError(`No evidence-backed donor is available for ${slot}`);
  return donor;
}

export function createModularImportedAvatarSource(
  baseModelId: unknown,
): ImportedAvatarModularSource {
  const base = importedAvatarAsset(baseModelId);
  if (!base)
    throw new TypeError(`Unknown replacement avatar ${String(baseModelId)}`);
  const slots = Object.fromEntries(
    CORE_SLOTS.map((slot) => {
      const donor = supportedDonor(slot, base);
      return [slot, { donorModelId: donor.id, regionId: SLOT_REGIONS[slot] }];
    }),
  ) as Record<ImportedAvatarCoreSlotId, ImportedAvatarSlotSelection>;
  return {
    kind: "imported",
    version: 2,
    mode: "modular",
    baseModelId: base.id,
    slots,
  };
}

function parseSlotSelection(
  value: unknown,
  slot: ImportedAvatarSlotId,
): ImportedAvatarSlotSelection | null {
  if (!isRecord(value) || !exactKeys(value, ["donorModelId", "regionId"]))
    return null;
  const donor = importedAvatarAsset(value.donorModelId);
  const region = donor?.segments.regions[slot];
  return donor && value.regionId === SLOT_REGIONS[slot] && region?.supported
    ? { donorModelId: donor.id, regionId: SLOT_REGIONS[slot] }
    : null;
}

export function parseImportedAvatarSource(
  value: unknown,
): AvatarSourceSelection | null {
  if (!isRecord(value)) return null;
  if (exactKeys(value, ["kind"]) && value.kind === "custom")
    return CUSTOM_AVATAR_SOURCE;
  if (
    exactKeys(value, ["kind", "version", "reason"]) &&
    value.kind === "reselection-required" &&
    value.version === 2 &&
    value.reason === "removed-or-unknown-model"
  )
    return AVATAR_RESELECTION_REQUIRED;
  if (
    value.kind !== "imported" ||
    value.version !== 2 ||
    (value.mode !== "original" && value.mode !== "modular")
  )
    return null;
  if (
    value.mode === "original" &&
    exactKeys(value, ["kind", "version", "mode", "modelId"])
  ) {
    const asset = importedAvatarAsset(value.modelId);
    return asset ? createOriginalImportedAvatarSource(asset.id) : null;
  }
  if (
    value.mode !== "modular" ||
    !exactKeys(value, ["kind", "version", "mode", "baseModelId", "slots"]) ||
    !isRecord(value.slots)
  )
    return null;
  const base = importedAvatarAsset(value.baseModelId);
  const slotsRecord = value.slots;
  const allowedSlotKeys = [
    ...CORE_SLOTS,
    ...(Object.hasOwn(value.slots, "auxiliary") ? ["auxiliary" as const] : []),
  ];
  if (
    !base ||
    !exactKeys(slotsRecord, allowedSlotKeys) ||
    !CORE_SLOTS.every((slot) => Object.hasOwn(slotsRecord, slot))
  )
    return null;
  const slots: Partial<
    Record<ImportedAvatarSlotId, ImportedAvatarSlotSelection>
  > = {};
  for (const slot of allowedSlotKeys) {
    const parsed = parseSlotSelection(slotsRecord[slot], slot);
    if (!parsed) return null;
    slots[slot] = parsed;
  }
  return {
    kind: "imported",
    version: 2,
    mode: "modular",
    baseModelId: base.id,
    slots: slots as ImportedAvatarModularSource["slots"],
  };
}

export function selectImportedAvatarSlot(
  sourceValue: AvatarSourceSelection,
  slotValue: string,
  donorModelId: unknown,
): ImportedAvatarModularSource {
  const source = parseImportedAvatarSource(sourceValue);
  if (source?.kind !== "imported" || source.mode !== "modular")
    throw new TypeError("A modular avatar source is required");
  if (!IMPORTED_AVATAR_SLOT_IDS.includes(slotValue as ImportedAvatarSlotId))
    throw new TypeError(`Unknown modular avatar slot ${slotValue}`);
  const slot = slotValue as ImportedAvatarSlotId;
  const donor = importedAvatarAsset(donorModelId);
  if (!donor)
    throw new TypeError(`Unknown replacement avatar ${String(donorModelId)}`);
  const region = donor.segments.regions[slot];
  if (!region.supported)
    throw new TypeError(
      `Refused: ${donor.label} ${slot} has overlapping core geometry or insufficient isolated coverage; inspect the manifest evidence.`,
    );
  return {
    ...source,
    slots: {
      ...source.slots,
      [slot]: { donorModelId: donor.id, regionId: SLOT_REGIONS[slot] },
    },
  };
}

export function importedAvatarDonorIds(
  sourceValue: AvatarSourceSelection,
): readonly ImportedAvatarAssetId[] {
  const source = parseImportedAvatarSource(sourceValue);
  if (!source || source.kind !== "imported") return [];
  if (source.mode === "original") return [source.modelId];
  return [
    ...new Set(Object.values(source.slots).map((slot) => slot.donorModelId)),
  ].sort() as ImportedAvatarAssetId[];
}

export function importedAvatarPartCompatibility(
  sourceAssetId: unknown,
  targetAssetId: unknown,
): {
  readonly compatible: boolean;
  readonly mode: "same-model" | "layered-skeleton-required";
  readonly reason: string;
} {
  const source = importedAvatarAsset(sourceAssetId);
  const target = importedAvatarAsset(targetAssetId);
  if (!source || !target)
    throw new TypeError("Imported avatar compatibility requires known models");
  return source.id === target.id
    ? {
        compatible: true,
        mode: "same-model",
        reason:
          "Source meshes, skeleton, rest pose, and bind matrices remain local.",
      }
    : {
        compatible: true,
        mode: "layered-skeleton-required",
        reason:
          "Cross-model regions require separate SkeletonUtils-cloned donor roots; foreign-skeleton rebinding is prohibited.",
      };
}

export function createDefaultImportedAvatarDraft(
  role: AvatarBuilderRole,
  agentName = "",
): AvatarDraft {
  const asset = importedAvatarAssetsForRole(role)[0];
  if (!asset)
    throw new TypeError(`No replacement avatar is available for ${role}`);
  return {
    ...DEFAULT_AVATAR_DRAFT,
    agentName,
    avatarSource: createOriginalImportedAvatarSource(asset.id),
  };
}

export const DEFAULT_IMPORTED_AVATAR_DRAFT: AvatarDraft = Object.freeze({
  ...createDefaultImportedAvatarDraft("user"),
});

function splitBase(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const base = { ...value };
  delete base.avatarSource;
  return base;
}

function sourceAndBase(value: unknown): {
  readonly source: AvatarSourceSelection;
  readonly base: Record<string, unknown>;
} | null {
  const base = splitBase(value);
  if (!base || !isRecord(value)) return null;
  const source = Object.hasOwn(value, "avatarSource")
    ? parseImportedAvatarSource(value.avatarSource)
    : CUSTOM_AVATAR_SOURCE;
  return source ? { source, base } : null;
}

function parseBuilderBase(value: Record<string, unknown>): AvatarDraft | null {
  const parsed = parseAvatarDraft(value);
  if (parsed) return parsed;
  if (value.agentName !== "") return null;
  const named = parseAvatarDraft({ ...value, agentName: "Avatar" });
  return named ? { ...named, agentName: "" } : null;
}

export function parseImportedAvatarDraft(value: unknown): AvatarDraft | null {
  const split = sourceAndBase(value);
  if (!split || split.source.kind === "reselection-required") return null;
  const draft = parseAvatarDraft(split.base);
  return draft ? { ...draft, avatarSource: split.source } : null;
}

export function parseImportedAvatarDraftForRole(
  value: unknown,
  role: AvatarBuilderRole,
): AvatarDraft | null {
  const draft = parseImportedAvatarDraft(value);
  const source = draft?.avatarSource;
  if (!draft || source?.kind !== "imported") return draft;
  const originalId =
    source.mode === "original" ? source.modelId : source.baseModelId;
  return importedAvatarAssetsForRole(role).some(
    (asset) => asset.id === originalId,
  )
    ? draft
    : null;
}

export function parseImportedAvatarProfile(
  value: unknown,
): AvatarProfile | null {
  const split = sourceAndBase(value);
  if (!split || split.source.kind === "reselection-required") return null;
  const profile = parseAvatarProfile(split.base);
  return profile ? { ...profile, avatarSource: split.source } : null;
}

export function importedAvatarDraftFrom(
  value: AvatarDraft | AvatarProfile,
): AvatarDraft {
  const profile = parseImportedAvatarProfile(value);
  if (profile) {
    const draft = { ...profile } as Record<string, unknown>;
    delete draft.schema;
    delete draft.profileId;
    delete draft.createdAt;
    delete draft.updatedAt;
    return draft as unknown as AvatarDraft;
  }
  const draft = parseImportedAvatarDraft(value);
  if (draft) return draft;
  const split = sourceAndBase(value);
  const builderBase = split ? parseBuilderBase(split.base) : null;
  if (split && builderBase && split.source.kind !== "reselection-required")
    return { ...builderBase, avatarSource: split.source };
  throw new TypeError("Invalid replacement avatar draft");
}

export function prepareAvatarBuilderDraft(
  value: AvatarDraft | AvatarProfile,
  role: AvatarBuilderRole,
  preserveLegacy = false,
): {
  readonly draft: AvatarDraft;
  readonly state:
    "new-imported" | "imported" | "preserved-legacy" | "reselection-required";
} {
  if (
    isRecord(value) &&
    parseImportedAvatarSource(value.avatarSource)?.kind ===
      "reselection-required"
  ) {
    const base = splitBase(value);
    const parsed = base ? parseAvatarDraft(base) : null;
    if (!parsed) throw new TypeError("Invalid re-selection draft");
    return {
      draft: { ...parsed, avatarSource: AVATAR_RESELECTION_REQUIRED },
      state: "reselection-required",
    };
  }
  const draft = importedAvatarDraftFrom(value);
  const source = draft.avatarSource;
  if (source?.kind === "imported") {
    const baseId =
      source.mode === "original" ? source.modelId : source.baseModelId;
    if (importedAvatarAssetsForRole(role).some((asset) => asset.id === baseId))
      return { draft, state: "imported" };
  }
  if (source?.kind === "custom" && preserveLegacy)
    return { draft, state: "preserved-legacy" };
  const defaultAsset = importedAvatarAssetsForRole(role)[0];
  if (!defaultAsset)
    throw new TypeError(`No replacement avatar is available for ${role}`);
  return {
    draft: {
      ...draft,
      avatarSource: createOriginalImportedAvatarSource(defaultAsset.id),
    },
    state: "new-imported",
  };
}

export function selectImportedAvatarModel(
  value: AvatarDraft | AvatarProfile,
  role: AvatarBuilderRole,
  assetId: unknown,
): AvatarDraft {
  const asset = importedAvatarAssetsForRole(role).find(
    (candidate) => candidate.id === assetId,
  );
  if (!asset)
    throw new TypeError(
      `Replacement avatar ${String(assetId)} is not selectable for ${role}`,
    );
  const base = splitBase(value);
  const draft = base ? parseBuilderBase(base) : null;
  if (!draft) throw new TypeError("Invalid replacement avatar draft");
  return {
    ...draft,
    avatarSource: createOriginalImportedAvatarSource(asset.id),
  };
}

export function selectImportedAvatarMode(
  value: AvatarDraft | AvatarProfile,
  mode: "original" | "modular",
): AvatarDraft {
  const draft = importedAvatarDraftFrom(value);
  const source = draft.avatarSource;
  if (source?.kind !== "imported")
    throw new TypeError("Select a replacement avatar before choosing its mode");
  const baseId =
    source.mode === "original" ? source.modelId : source.baseModelId;
  return {
    ...draft,
    avatarSource:
      mode === "original"
        ? createOriginalImportedAvatarSource(baseId)
        : createModularImportedAvatarSource(baseId),
  };
}

export function createImportedAvatarProfile(
  value: unknown,
  previous?: AvatarProfile | null,
  now = new Date().toISOString(),
  profileId?: string,
): AvatarProfile {
  const draft = parseImportedAvatarDraft(value);
  if (!draft) throw new TypeError("Invalid replacement avatar draft");
  const { avatarSource, ...baseDraft } = draft;
  const basePrevious = previous
    ? parseAvatarProfile(
        Object.fromEntries(
          Object.entries(previous).filter(([key]) => key !== "avatarSource"),
        ),
      )
    : null;
  const profile = createAvatarProfile(baseDraft, basePrevious, now, profileId);
  const parsed = parseImportedAvatarProfile({ ...profile, avatarSource });
  if (!parsed) throw new TypeError("Invalid replacement avatar profile");
  return parsed;
}

export type ImportedAvatarLoadResult = Omit<
  AvatarLoadResult,
  "status" | "current" | "previous" | "draft"
> & {
  readonly status:
    | AvatarLoadResult["status"]
    | "avatar-migration-required"
    | "avatar-reselection-required";
  readonly current: AvatarProfile | null;
  readonly previous: AvatarProfile | null;
  readonly draft: AvatarDraft;
};

function normalizeBaseLoad(loaded: AvatarLoadResult): ImportedAvatarLoadResult {
  const normalize = (profile: AvatarProfile | null) =>
    profile ? { ...profile, avatarSource: CUSTOM_AVATAR_SOURCE } : null;
  return {
    ...loaded,
    current: normalize(loaded.current),
    previous: normalize(loaded.previous),
    draft:
      loaded.status === "unconfigured"
        ? DEFAULT_IMPORTED_AVATAR_DRAFT
        : { ...loaded.draft, avatarSource: CUSTOM_AVATAR_SOURCE },
  };
}

function baseProfileFromUnknown(value: unknown): AvatarProfile | null {
  const base = splitBase(value);
  return base ? parseAvatarProfile(base) : null;
}

function draftFromProfileWithSource(
  profile: AvatarProfile,
  source: AvatarSourceSelection,
): AvatarDraft {
  const draft = { ...profile } as Record<string, unknown>;
  delete draft.schema;
  delete draft.profileId;
  delete draft.createdAt;
  delete draft.updatedAt;
  return { ...(draft as unknown as AvatarDraft), avatarSource: source };
}

export function loadImportedAvatarProfiles(
  storage: AvatarStorage,
): ImportedAvatarLoadResult {
  const raw = storage.getItem(AVATAR_PROFILE_STORAGE_KEY);
  if (raw === null) return normalizeBaseLoad(loadAvatarProfiles(storage));
  try {
    const value = JSON.parse(raw) as unknown;
    if (
      isRecord(value) &&
      exactKeys(value, ["schema", "current", "previous"]) &&
      value.schema === "aiw.avatar-store/0.18.5"
    ) {
      const current = parseImportedAvatarProfile(value.current);
      const previous =
        value.previous === null
          ? null
          : parseImportedAvatarProfile(value.previous);
      if (current && (value.previous === null || previous)) {
        const source = current.avatarSource;
        if (source?.kind === "imported") {
          const modelId =
            source.mode === "original" ? source.modelId : source.baseModelId;
          const roleValid = importedAvatarAssetsForRole("user").some(
            (asset) => asset.id === modelId,
          );
          if (!roleValid)
            return {
              status: "avatar-reselection-required",
              current: null,
              previous,
              draft: draftFromProfileWithSource(
                current,
                AVATAR_RESELECTION_REQUIRED,
              ),
            };
          if (source.mode === "modular")
            return {
              status: "avatar-migration-required",
              current: null,
              previous,
              draft: draftFromProfileWithSource(current, source),
            };
        }
        return {
          status: "saved",
          current,
          previous,
          draft: current,
        };
      }
      const staleBase = baseProfileFromUnknown(value.current);
      if (
        staleBase &&
        isRecord(value.current) &&
        Object.hasOwn(value.current, "avatarSource")
      )
        return {
          status: "avatar-reselection-required",
          current: null,
          previous,
          draft: draftFromProfileWithSource(
            staleBase,
            AVATAR_RESELECTION_REQUIRED,
          ),
        };
      if (previous)
        return {
          status: "recovered-previous",
          current: previous,
          previous: null,
          draft: previous,
        };
    }
  } catch {
    // Preserve the raw envelope for the existing recovery/delete boundary.
  }
  return {
    status: "corrupt-unconfigured",
    current: null,
    previous: null,
    draft: DEFAULT_IMPORTED_AVATAR_DRAFT,
  };
}

export function saveImportedAvatarProfile(
  storage: AvatarStorage,
  value: unknown,
): AvatarProfile {
  const profile = parseImportedAvatarProfile(value);
  if (!profile) throw new TypeError("Invalid replacement avatar profile");
  const loaded = loadImportedAvatarProfiles(storage);
  storage.setItem(
    AVATAR_PROFILE_STORAGE_KEY,
    JSON.stringify({
      schema: "aiw.avatar-store/0.18.5",
      current: profile,
      previous: loaded.current,
    }),
  );
  return profile;
}

export function exportImportedAvatarProfile(value: unknown): string {
  const profile = parseImportedAvatarProfile(value);
  if (!profile) throw new TypeError("Invalid replacement avatar profile");
  return JSON.stringify(profile, null, 2);
}

export function resolveImportedAvatarWorldClip(
  assetId: ImportedAvatarAssetId,
  action: AvatarAction | string,
): ResolvedImportedAvatarWorldClip {
  const locomotion: ImportedAvatarLocomotion | undefined =
    action === "StopWalk"
      ? "Idle"
      : action === "StartWalk"
        ? "Walk"
        : action === "Idle" || action === "Walk" || action === "Run"
          ? action
          : undefined;
  const semantic = IMPORTED_AVATAR_SEMANTICS.includes(
    action as ImportedAvatarSemantic,
  )
    ? (action as ImportedAvatarSemantic)
    : locomotion;
  const asset = importedAvatarAsset(assetId);
  const mapping = semantic ? asset?.semanticClips[semantic] : undefined;
  const review = semantic ? asset?.semanticReview[semantic] : undefined;
  if (!asset || !semantic || !mapping || !review)
    throw new TypeError("Semantic review refused: missing mapping");
  if (
    review.verdict !== "pass" ||
    review.expectedClipIndex !== mapping.clipIndex
  )
    throw new TypeError(`Semantic review refused: ${review.verdict}`);
  const oneShot =
    semantic !== "Idle" && semantic !== "Walk" && semantic !== "Run";
  return {
    assetId,
    clipIndex: mapping.clipIndex,
    clipName: mapping.clipName,
    semantic,
    locomotion: locomotion ?? "Idle",
    oneShot,
    durationSeconds: mapping.durationSeconds,
    verification: "semantic-review-pass",
  };
}

export function importedAvatarSemanticReview(
  assetId: ImportedAvatarAssetId | string,
  semantic: ImportedAvatarSemantic,
): ImportedAvatarSemanticReviewDecision {
  const asset = importedAvatarAsset(assetId);
  const decision = asset?.semanticReview[semantic];
  if (!decision)
    throw new TypeError("Semantic review refused: missing decision");
  return decision;
}

export function importedAvatarProfileSummary(value: AvatarDraft): string {
  const source = value.avatarSource;
  if (source?.kind === "reselection-required")
    return "Avatar re-selection required";
  if (source?.kind === "imported") {
    if (source.mode === "original")
      return `Complete ${importedAvatarAsset(source.modelId)?.label ?? source.modelId}`;
    return `Modular ${importedAvatarAsset(source.baseModelId)?.label ?? source.baseModelId} · ${importedAvatarDonorIds(source).length} donor root(s)`;
  }
  return avatarProfileSummary(value);
}
