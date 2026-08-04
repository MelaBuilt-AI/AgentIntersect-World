import {
  validateImportedAvatarManifest,
  type ImportedAvatarManifestAsset,
} from "./imported-avatar-manifest.js";

export const AVATAR_REVIEW_SEMANTICS = [
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
export type AvatarReviewSemantic = (typeof AVATAR_REVIEW_SEMANTICS)[number];
export type AvatarReviewVerdictDraft = {
  readonly verdict: "unresolved" | "selected" | "ambiguous" | "unsupported";
  readonly clipIndex: number | null;
};
export type AvatarReviewVerdicts = Readonly<
  Record<AvatarReviewSemantic, AvatarReviewVerdictDraft>
>;

export type ImportedAvatarReviewClip = {
  readonly index: number;
  readonly name: string;
  readonly durationSeconds: number;
  readonly inputTimingSha256: string;
  readonly motionChannelSha256: string;
  readonly outputPoseSha256: string;
};

export type ImportedAvatarReviewAsset = {
  readonly id: string;
  readonly label: string;
  readonly allowedRoles: readonly ("user" | "agent")[];
  readonly assetUrl: string;
  readonly sourceGlbSha256: string;
  readonly clips: readonly ImportedAvatarReviewClip[];
  readonly preview: {
    readonly position: readonly [number, number, number];
    readonly rotation: readonly [number, number, number];
    readonly scale: number;
  };
};

export type ImportedAvatarReviewManifest = {
  readonly schema: "aiw.replacement-avatar-assets/3";
  readonly authority: "repository-owned-replacement-avatar-registry";
  readonly manifestSha256: string;
  readonly defaultAgentAsset: ImportedAvatarReviewAsset;
  readonly agentAssets: readonly ImportedAvatarReviewAsset[];
  readonly userAssets: readonly ImportedAvatarReviewAsset[];
  readonly assets: readonly ImportedAvatarReviewAsset[];
  readonly selectAsset: (
    modelId: string,
    role: "user" | "agent",
  ) => ImportedAvatarReviewAsset;
};

export type AvatarReviewReceipt = {
  readonly schema: "aiw.avatar-animation-review/1";
  readonly version: 1;
  readonly authority: "operator-semantic-review-only";
  readonly modelId: string;
  readonly role: "user" | "agent";
  readonly manifestSha256: string;
  readonly sourceGlbSha256: string;
  readonly clips: readonly ImportedAvatarReviewClip[];
  readonly verdicts: readonly {
    readonly semantic: AvatarReviewSemantic;
    readonly verdict: "selected" | "ambiguous" | "unsupported";
    readonly clipIndex: number | null;
  }[];
};

const HASH = /^[a-f0-9]{64}$/u;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
const reviewError = (message: string): never => {
  throw new TypeError(`Avatar animation review refused: ${message}`);
};

export function unresolvedAvatarReviewVerdicts(): AvatarReviewVerdicts {
  return Object.fromEntries(
    AVATAR_REVIEW_SEMANTICS.map((semantic) => [
      semantic,
      { verdict: "unresolved", clipIndex: null },
    ]),
  ) as unknown as AvatarReviewVerdicts;
}

const reviewAsset = (
  source: Record<string, unknown>,
  validated: ImportedAvatarManifestAsset,
): ImportedAvatarReviewAsset => {
  if (
    !Array.isArray(source.clips) ||
    source.clips.length !== validated.registry.clipCount
  )
    return reviewError(`${validated.id} clip inventory is incomplete`);
  const clips = source.clips.map((candidate, index) => {
    if (
      !isRecord(candidate) ||
      candidate.index !== index ||
      candidate.name !== validated.registry.clips[index] ||
      typeof candidate.durationSeconds !== "number" ||
      !Number.isFinite(candidate.durationSeconds) ||
      candidate.durationSeconds <= 0 ||
      !HASH.test(String(candidate.inputTimingSha256)) ||
      !HASH.test(String(candidate.motionChannelSha256)) ||
      !HASH.test(String(candidate.outputPoseSha256))
    )
      return reviewError(`${validated.id} clip ${index} metadata is invalid`);
    return {
      index,
      name: candidate.name as string,
      durationSeconds: candidate.durationSeconds,
      inputTimingSha256: candidate.inputTimingSha256 as string,
      motionChannelSha256: candidate.motionChannelSha256 as string,
      outputPoseSha256: candidate.outputPoseSha256 as string,
    };
  });
  return {
    id: validated.id,
    label: validated.registry.label,
    allowedRoles: validated.registry.allowedRoles,
    assetUrl: validated.registry.assetUrl,
    sourceGlbSha256: validated.sha256,
    clips,
    preview: validated.registry.preview,
  };
};

export function validateImportedAvatarReviewManifest(
  value: unknown,
  manifestSha256: string,
): ImportedAvatarReviewManifest {
  if (!HASH.test(manifestSha256))
    return reviewError("manifest hash is invalid");
  const validated = validateImportedAvatarManifest(value);
  if (!isRecord(value) || !Array.isArray(value.assets))
    return reviewError("manifest assets are unavailable");
  const rawAssets = value.assets;
  const assets = validated.assets.map((asset) => {
    const source = rawAssets.find(
      (candidate) => isRecord(candidate) && candidate.id === asset.id,
    );
    if (!isRecord(source)) return reviewError(`${asset.id} is unavailable`);
    return reviewAsset(source, asset);
  });
  const agentAssets = assets.filter((asset) =>
    asset.allowedRoles.includes("agent"),
  );
  const defaultAgentAsset =
    agentAssets.find((asset) => asset.id === "cat-agent-01") ?? agentAssets[0];
  if (!defaultAgentAsset)
    return reviewError("accepted cat-agent-01 binding is unavailable");
  const userAssets = assets.filter((asset) =>
    asset.allowedRoles.includes("user"),
  );
  const selectAsset = (modelId: string, role: "user" | "agent") => {
    const selected = (role === "user" ? userAssets : agentAssets).find(
      (asset) => asset.id === modelId,
    );
    if (!selected)
      return reviewError(`model is not an exact role-valid ${role} model`);
    return selected;
  };
  return {
    schema: validated.schema,
    authority: validated.authority,
    manifestSha256,
    defaultAgentAsset,
    agentAssets,
    userAssets,
    assets,
    selectAsset,
  };
}

export async function sha256Text(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function loadImportedAvatarReviewManifest(): Promise<ImportedAvatarReviewManifest> {
  const response = await fetch("/assets/imported-avatars/manifest.json");
  if (!response.ok)
    return reviewError(`manifest unavailable (${response.status})`);
  const text = await response.text();
  return validateImportedAvatarReviewManifest(
    JSON.parse(text) as unknown,
    await sha256Text(text),
  );
}

export function createAvatarReviewReceipt(
  manifest: ImportedAvatarReviewManifest,
  modelId: string,
  role: "user" | "agent",
  verdicts: AvatarReviewVerdicts,
): AvatarReviewReceipt {
  const asset = manifest.selectAsset(modelId, role);
  const rows = AVATAR_REVIEW_SEMANTICS.map((semantic) => {
    const decision = verdicts[semantic];
    if (!decision || decision.verdict === "unresolved")
      return reviewError("all nine semantic verdicts are required");
    if (decision.verdict === "selected") {
      if (!asset.clips.some((clip) => clip.index === decision.clipIndex))
        return reviewError(`${semantic} selected clip is not model-local`);
    } else if (decision.clipIndex !== null) {
      return reviewError(`${semantic} non-selected verdict has a clip claim`);
    }
    return {
      semantic,
      verdict: decision.verdict,
      clipIndex: decision.clipIndex,
    };
  });
  return {
    schema: "aiw.avatar-animation-review/1",
    version: 1,
    authority: "operator-semantic-review-only",
    modelId: asset.id,
    role,
    manifestSha256: manifest.manifestSha256,
    sourceGlbSha256: asset.sourceGlbSha256,
    clips: asset.clips,
    verdicts: rows,
  };
}

export function serializeAvatarReviewReceipt(
  receipt: AvatarReviewReceipt,
): string {
  return `${JSON.stringify(receipt, null, 2)}\n`;
}

export function validateAvatarReviewReceipt(
  value: unknown,
  manifest: ImportedAvatarReviewManifest,
  expectedModelId: string,
  expectedRole: "user" | "agent",
): AvatarReviewReceipt {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "schema",
      "version",
      "authority",
      "modelId",
      "role",
      "manifestSha256",
      "sourceGlbSha256",
      "clips",
      "verdicts",
    ]) ||
    value.schema !== "aiw.avatar-animation-review/1" ||
    value.version !== 1 ||
    value.authority !== "operator-semantic-review-only"
  )
    return reviewError("receipt schema or keys are invalid");
  if (value.modelId !== expectedModelId)
    return reviewError("receipt model does not match the selected model");
  const asset = manifest.selectAsset(expectedModelId, expectedRole);
  if (value.role !== expectedRole)
    return reviewError("receipt model role is invalid");
  if (value.manifestSha256 !== manifest.manifestSha256)
    return reviewError("receipt manifest hash is stale or tampered");
  if (value.sourceGlbSha256 !== asset.sourceGlbSha256)
    return reviewError("receipt source GLB hash is stale or tampered");
  if (JSON.stringify(value.clips) !== JSON.stringify(asset.clips))
    return reviewError("receipt clip inventory is stale or tampered");
  if (!Array.isArray(value.verdicts) || value.verdicts.length !== 9)
    return reviewError("receipt semantic vocabulary is incomplete");
  const decisions = Object.fromEntries(
    value.verdicts.map((candidate, index) => {
      if (
        !isRecord(candidate) ||
        !exactKeys(candidate, ["semantic", "verdict", "clipIndex"]) ||
        candidate.semantic !== AVATAR_REVIEW_SEMANTICS[index] ||
        !["selected", "ambiguous", "unsupported"].includes(
          String(candidate.verdict),
        )
      )
        return reviewError("receipt semantic vocabulary is invalid");
      if (
        candidate.verdict === "selected"
          ? !asset.clips.some((clip) => clip.index === candidate.clipIndex)
          : candidate.clipIndex !== null
      )
        return reviewError("receipt semantic clip claim is invalid");
      return [
        candidate.semantic,
        { verdict: candidate.verdict, clipIndex: candidate.clipIndex },
      ];
    }),
  ) as unknown as AvatarReviewVerdicts;
  return createAvatarReviewReceipt(
    manifest,
    expectedModelId,
    expectedRole,
    decisions,
  );
}

export function reviewClipReuse(verdicts: AvatarReviewVerdicts): readonly {
  readonly clipIndex: number;
  readonly semantics: readonly AvatarReviewSemantic[];
}[] {
  const claims = new Map<number, AvatarReviewSemantic[]>();
  for (const semantic of AVATAR_REVIEW_SEMANTICS) {
    const decision = verdicts[semantic];
    if (decision.verdict !== "selected" || decision.clipIndex === null)
      continue;
    const semantics = claims.get(decision.clipIndex) ?? [];
    semantics.push(semantic);
    claims.set(decision.clipIndex, semantics);
  }
  return [...claims.entries()]
    .filter(([, semantics]) => semantics.length > 1)
    .map(([clipIndex, semantics]) => ({ clipIndex, semantics }));
}
