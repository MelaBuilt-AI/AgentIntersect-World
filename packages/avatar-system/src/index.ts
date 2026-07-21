export const AVATAR_SCHEMA = "aiw.avatar/0.11" as const;
export const AVATAR_PROFILE_STORAGE_KEY = "aiw.avatar.profile.0.11";
export const LEGACY_AVATAR_PROFILE_STORAGE_KEY = "aiw.avatar-appearance.v1";
export const AVATAR_RUNTIME_ASSET = "/assets/avatar/aiw-avatar-kit.glb";
export const AVATAR_CONTACT_SHEET =
  "/assets/avatar/aiw-avatar-contact-sheet.png";

export const AVATAR_SPECIES = ["human", "dog", "cat"] as const;
export const AVATAR_HEADS = {
  human: ["round", "angular", "soft", "square"],
  dog: ["labrador", "shepherd", "husky", "beagle"],
  cat: ["shorthair", "siamese", "maine-coon", "bengal"],
} as const;
export const AVATAR_HANDS = ["hands", "paws", "clawed-paws"] as const;
export const AVATAR_FEET = ["feet", "paws", "clawed-paws"] as const;
export const AVATAR_FUR = ["none", "short", "long"] as const;
export const AVATAR_TAILS = [
  "none",
  "cat-straight",
  "cat-curled",
  "dog-straight",
  "dog-curled",
] as const;
export const AVATAR_MARKINGS = ["solid", "muzzle", "mask", "socks"] as const;
export const AVATAR_BODY_COLORS = [
  "porcelain",
  "warm-light",
  "golden",
  "bronze",
  "umber",
  "deep",
  "fur-cream",
  "fur-gold",
  "fur-brown",
  "fur-charcoal",
  "fantasy-blue",
  "fantasy-violet",
] as const;
export const AVATAR_COLOR_HEX: Readonly<Record<AvatarBodyColor, string>> = {
  porcelain: "#F2D6CB",
  "warm-light": "#D9A07B",
  golden: "#B97845",
  bronze: "#8C5639",
  umber: "#5B3528",
  deep: "#321E1A",
  "fur-cream": "#E8DCC4",
  "fur-gold": "#C78B3B",
  "fur-brown": "#70452F",
  "fur-charcoal": "#30343B",
  "fantasy-blue": "#3977A8",
  "fantasy-violet": "#7257A8",
};
export const AVATAR_SHIRTS = ["Codex", "Claude", "Hermes", "OpenClaw"] as const;
export const AVATAR_SHIRT_COLORS: Readonly<Record<AvatarShirt, string>> = {
  Codex: "#2563EB",
  Claude: "#EA580C",
  Hermes: "#FACC15",
  OpenClaw: "#DC2626",
};
export const AVATAR_ACTIONS = [
  "Idle",
  "Walk",
  "Run",
  "Work",
  "Celebrate",
  "Error",
  "Offline",
] as const;
export const AVATAR_ATTACHMENTS = [
  "ATTACH_HEAD",
  "ATTACH_HAND_L",
  "ATTACH_HAND_R",
  "ATTACH_FOOT_L",
  "ATTACH_FOOT_R",
  "ATTACH_TAIL",
  "ATTACH_SHIRT",
  "ATTACH_NAMEPLATE",
] as const;

export type AvatarSpecies = (typeof AVATAR_SPECIES)[number];
export type AvatarHead = (typeof AVATAR_HEADS)[AvatarSpecies][number];
export type AvatarHands = (typeof AVATAR_HANDS)[number];
export type AvatarFeet = (typeof AVATAR_FEET)[number];
export type AvatarFur = (typeof AVATAR_FUR)[number];
export type AvatarTail = (typeof AVATAR_TAILS)[number];
export type AvatarMarkings = (typeof AVATAR_MARKINGS)[number];
export type AvatarBodyColor = (typeof AVATAR_BODY_COLORS)[number];
export type AvatarShirt = (typeof AVATAR_SHIRTS)[number];
export type AvatarAction = (typeof AVATAR_ACTIONS)[number];
export type AvatarSourceDisclosure =
  "manual-local-input" | "phase6-roster-opt-in";

export interface AvatarDraft {
  readonly agentName: string;
  readonly species: AvatarSpecies;
  readonly head: AvatarHead;
  readonly hands: AvatarHands;
  readonly feet: AvatarFeet;
  readonly fur: AvatarFur;
  readonly tail: AvatarTail;
  readonly markings: AvatarMarkings;
  readonly bodyColor: AvatarBodyColor;
  readonly shirt: AvatarShirt;
  readonly mappingConsent: boolean;
  readonly agentRef: string | null;
  readonly sourceDisclosure: AvatarSourceDisclosure;
}

export interface AvatarProfile extends AvatarDraft {
  readonly schema: typeof AVATAR_SCHEMA;
  readonly profileId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AvatarStorage {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
  readonly removeItem?: (key: string) => void;
}

export const DEFAULT_AVATAR_DRAFT: AvatarDraft = Object.freeze({
  agentName: "",
  species: "human",
  head: "round",
  hands: "hands",
  feet: "feet",
  fur: "none",
  tail: "none",
  markings: "solid",
  bodyColor: "warm-light",
  shirt: "Codex",
  mappingConsent: false,
  agentRef: null,
  sourceDisclosure: "manual-local-input",
});

const profileKeys = [
  "schema",
  "profileId",
  "agentRef",
  "agentName",
  "species",
  "head",
  "hands",
  "feet",
  "fur",
  "tail",
  "markings",
  "bodyColor",
  "shirt",
  "mappingConsent",
  "sourceDisclosure",
  "createdAt",
  "updatedAt",
] as const;
const draftKeys = [
  "agentRef",
  "agentName",
  "species",
  "head",
  "hands",
  "feet",
  "fur",
  "tail",
  "markings",
  "bodyColor",
  "shirt",
  "mappingConsent",
  "sourceDisclosure",
] as const;
const opaqueId = /^(?:avatar|agent)_[a-f0-9]{32,64}$/;
const controlCharacters = /[\p{Cc}\p{Cf}]/u;

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function includes<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function validIso(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

export function validateAgentName(
  value: unknown,
):
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly reason: string } {
  if (typeof value !== "string")
    return { ok: false, reason: "Agent name is required." };
  const normalized = value.normalize("NFC").trim();
  const count = [
    ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
      normalized,
    ),
  ].length;
  if (count === 0) return { ok: false, reason: "Agent name is required." };
  if (count > 32)
    return {
      ok: false,
      reason: "Agent name must be 32 visible characters or fewer.",
    };
  if (controlCharacters.test(normalized))
    return {
      ok: false,
      reason: "Agent name cannot contain control characters.",
    };
  return { ok: true, value: normalized };
}

function compatible(
  species: AvatarSpecies,
  head: AvatarHead,
  tail: AvatarTail,
): boolean {
  if (!(AVATAR_HEADS[species] as readonly string[]).includes(head))
    return false;
  if (species === "human") return tail === "none";
  if (species === "cat") return tail === "none" || tail.startsWith("cat-");
  return tail === "none" || tail.startsWith("dog-");
}

export function parseAvatarDraft(value: unknown): AvatarDraft | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const record = value as Record<string, unknown>;
  if (!hasExactKeys(record, draftKeys)) return null;
  const name = validateAgentName(record.agentName);
  if (!name.ok || !includes(AVATAR_SPECIES, record.species)) return null;
  const species = record.species;
  if (
    !includes(Object.values(AVATAR_HEADS).flat(), record.head) ||
    !includes(AVATAR_HANDS, record.hands) ||
    !includes(AVATAR_FEET, record.feet) ||
    !includes(AVATAR_FUR, record.fur) ||
    !includes(AVATAR_TAILS, record.tail) ||
    !includes(AVATAR_MARKINGS, record.markings) ||
    !includes(AVATAR_BODY_COLORS, record.bodyColor) ||
    !includes(AVATAR_SHIRTS, record.shirt)
  )
    return null;
  if (!compatible(species, record.head, record.tail)) return null;
  if (typeof record.mappingConsent !== "boolean") return null;
  if (
    record.sourceDisclosure !==
    (record.mappingConsent ? "phase6-roster-opt-in" : "manual-local-input")
  )
    return null;
  if (
    record.mappingConsent
      ? typeof record.agentRef !== "string" || !opaqueId.test(record.agentRef)
      : record.agentRef !== null
  )
    return null;
  return {
    agentRef: record.agentRef as string | null,
    agentName: name.value,
    species,
    head: record.head,
    hands: record.hands,
    feet: record.feet,
    fur: record.fur,
    tail: record.tail,
    markings: record.markings,
    bodyColor: record.bodyColor,
    shirt: record.shirt,
    mappingConsent: record.mappingConsent,
    sourceDisclosure: record.sourceDisclosure as AvatarSourceDisclosure,
  };
}

export function parseAvatarProfile(value: unknown): AvatarProfile | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const record = value as Record<string, unknown>;
  if (
    !hasExactKeys(record, profileKeys) ||
    record.schema !== AVATAR_SCHEMA ||
    typeof record.profileId !== "string" ||
    !opaqueId.test(record.profileId) ||
    !validIso(record.createdAt) ||
    !validIso(record.updatedAt)
  )
    return null;
  const draft = parseAvatarDraft(
    Object.fromEntries(draftKeys.map((key) => [key, record[key]])),
  );
  return draft
    ? {
        schema: AVATAR_SCHEMA,
        profileId: record.profileId,
        ...draft,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }
    : null;
}

export function avatarDraftFrom(
  value: AvatarDraft | AvatarProfile,
): AvatarDraft {
  const profile = parseAvatarProfile(value);
  if (profile)
    return Object.fromEntries(
      draftKeys.map((key) => [key, profile[key]]),
    ) as unknown as AvatarDraft;
  const draft = parseAvatarDraft(value);
  if (draft) return draft;
  if (
    typeof value === "object" &&
    value !== null &&
    hasExactKeys(value as unknown as Record<string, unknown>, draftKeys) &&
    value.agentName === ""
  ) {
    const unconfigured = parseAvatarDraft({ ...value, agentName: "Draft" });
    if (unconfigured) return { ...unconfigured, agentName: "" };
  }
  throw new TypeError("Invalid aiw.avatar/0.11 draft");
}

export function createAvatarProfile(
  draftValue: unknown,
  previous?: AvatarProfile | null,
  now = new Date().toISOString(),
  profileId?: string,
): AvatarProfile {
  const suppliedProfile = parseAvatarProfile(draftValue);
  const draft = parseAvatarDraft(
    suppliedProfile
      ? Object.fromEntries(draftKeys.map((key) => [key, suppliedProfile[key]]))
      : draftValue,
  );
  if (!draft) throw new TypeError("Invalid aiw.avatar/0.11 draft");
  const id =
    previous?.profileId ??
    profileId ??
    `avatar_${globalThis.crypto.randomUUID().replaceAll("-", "")}`;
  const candidate = {
    schema: AVATAR_SCHEMA,
    profileId: id,
    ...draft,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  const parsed = parseAvatarProfile(candidate);
  if (!parsed) throw new TypeError("Invalid aiw.avatar/0.11 profile");
  return parsed;
}

type ProfileEnvelope = {
  readonly schema: "aiw.avatar-store/0.11";
  readonly current: AvatarProfile;
  readonly previous: AvatarProfile | null;
};
export type AvatarLoadResult = {
  readonly status:
    | "saved"
    | "recovered-previous"
    | "unconfigured"
    | "migrated-unconfigured"
    | "corrupt-unconfigured";
  readonly current: AvatarProfile | null;
  readonly previous: AvatarProfile | null;
  readonly draft: AvatarDraft;
};

function parseEnvelope(value: unknown): ProfileEnvelope | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const record = value as Record<string, unknown>;
  if (
    !hasExactKeys(record, ["schema", "current", "previous"]) ||
    record.schema !== "aiw.avatar-store/0.11"
  )
    return null;
  const current = parseAvatarProfile(record.current);
  const previous =
    record.previous === null ? null : parseAvatarProfile(record.previous);
  return current
    ? { schema: "aiw.avatar-store/0.11", current, previous }
    : null;
}

export function migrateLegacyAvatarProfile(value: unknown): AvatarDraft | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const r = value as Record<string, unknown>;
  const keys = [
    "version",
    "body",
    "accent",
    "showHalo",
    "showHelmet",
    "showFace",
    "showEyes",
    "showGlow",
  ];
  if (
    !hasExactKeys(r, keys) ||
    r.version !== 1 ||
    !["female", "male"].includes(String(r.body)) ||
    !["cyan", "violet", "amber"].includes(String(r.accent)) ||
    keys.slice(3).some((key) => typeof r[key] !== "boolean")
  )
    return null;
  return {
    ...DEFAULT_AVATAR_DRAFT,
    bodyColor:
      r.accent === "violet"
        ? "fantasy-violet"
        : r.accent === "cyan"
          ? "fantasy-blue"
          : "golden",
  };
}

export function loadAvatarProfiles(storage: AvatarStorage): AvatarLoadResult {
  const raw = storage.getItem(AVATAR_PROFILE_STORAGE_KEY);
  if (raw !== null) {
    try {
      const value = JSON.parse(raw) as Record<string, unknown>;
      const envelope = parseEnvelope(value);
      if (envelope)
        return {
          status: "saved",
          current: envelope.current,
          previous: envelope.previous,
          draft: envelope.current,
        };
      const previous =
        value && typeof value === "object"
          ? parseAvatarProfile(value.previous)
          : null;
      if (previous)
        return {
          status: "recovered-previous",
          current: previous,
          previous: null,
          draft: previous,
        };
    } catch {
      /* preserve corrupt source */
    }
    return {
      status: "corrupt-unconfigured",
      current: null,
      previous: null,
      draft: DEFAULT_AVATAR_DRAFT,
    };
  }
  const legacy = storage.getItem(LEGACY_AVATAR_PROFILE_STORAGE_KEY);
  if (legacy !== null) {
    try {
      const migrated = migrateLegacyAvatarProfile(JSON.parse(legacy));
      if (migrated)
        return {
          status: "migrated-unconfigured",
          current: null,
          previous: null,
          draft: migrated,
        };
    } catch {
      /* preserve corrupt source */
    }
    return {
      status: "corrupt-unconfigured",
      current: null,
      previous: null,
      draft: DEFAULT_AVATAR_DRAFT,
    };
  }
  return {
    status: "unconfigured",
    current: null,
    previous: null,
    draft: DEFAULT_AVATAR_DRAFT,
  };
}

export function saveAvatarProfile(
  storage: AvatarStorage,
  value: unknown,
): AvatarProfile {
  const profile = parseAvatarProfile(value);
  if (!profile) throw new TypeError("Invalid aiw.avatar/0.11 profile");
  const loaded = loadAvatarProfiles(storage);
  const envelope: ProfileEnvelope = {
    schema: "aiw.avatar-store/0.11",
    current: profile,
    previous: loaded.current,
  };
  storage.setItem(AVATAR_PROFILE_STORAGE_KEY, JSON.stringify(envelope));
  return profile;
}

export function deleteAvatarProfiles(storage: AvatarStorage): void {
  storage.removeItem?.(AVATAR_PROFILE_STORAGE_KEY);
  storage.removeItem?.(LEGACY_AVATAR_PROFILE_STORAGE_KEY);
}

export function mapRosterProfileInput(
  value: unknown,
  consent: boolean,
): Pick<
  AvatarDraft,
  "agentRef" | "agentName" | "mappingConsent" | "sourceDisclosure"
> | null {
  if (
    !consent ||
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  )
    return null;
  const r = value as Record<string, unknown>;
  if (
    !hasExactKeys(r, ["agentRef", "displayLabel"]) ||
    typeof r.agentRef !== "string" ||
    !opaqueId.test(r.agentRef)
  )
    return null;
  const name = validateAgentName(r.displayLabel);
  return name.ok
    ? {
        agentRef: r.agentRef,
        agentName: name.value,
        mappingConsent: true,
        sourceDisclosure: "phase6-roster-opt-in",
      }
    : null;
}

export async function opaqueRosterAgentRef(sourceId: string): Promise<string> {
  const bytes = new Uint8Array(
    await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`aiw.avatar/0.11\0owned-agent\0${sourceId}`),
    ),
  );
  return `agent_${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function revokeAvatarMapping(profile: AvatarProfile): AvatarProfile {
  return {
    ...profile,
    agentRef: null,
    mappingConsent: false,
    sourceDisclosure: "manual-local-input",
    updatedAt: new Date().toISOString(),
  };
}

export function exportAvatarProfile(profileValue: unknown): string {
  const profile = parseAvatarProfile(profileValue);
  if (!profile) throw new TypeError("Invalid aiw.avatar/0.11 profile");
  return JSON.stringify(profile, null, 2);
}

export function avatarProfileSummary(value: AvatarDraft): string {
  const label = (text: string) =>
    text.replaceAll("-", " ").replace(/^./, (c) => c.toUpperCase());
  return `${label(value.species)} · ${label(value.head)} head · ${label(value.hands)} / ${label(value.feet)} · ${label(value.fur)} fur · ${label(value.tail)} tail · ${label(value.markings)} markings · ${label(value.bodyColor)} · ${value.shirt} tee`;
}

export type AvatarLifecycle =
  | "queued"
  | "idle"
  | "unknown"
  | "claimed"
  | "running"
  | "complete"
  | "succeeded"
  | "failed"
  | "error"
  | "disabled"
  | "mismatch"
  | "stale"
  | "offline"
  | string;
export function projectAvatarAnimation(input: {
  readonly lifecycle: AvatarLifecycle | null | undefined;
  readonly integrationStatus: string;
  readonly accepted: boolean;
  readonly reducedMotion: boolean;
  readonly elapsedMs?: number;
}): {
  readonly action: AvatarAction;
  readonly animate: boolean;
  readonly qualifier: string;
} {
  const lifecycle = (input.lifecycle ?? "unknown").toLowerCase();
  if (
    ["stale", "offline", "disabled", "mismatch", "error"].includes(
      input.integrationStatus,
    ) ||
    ["stale", "offline", "disabled", "mismatch"].includes(lifecycle)
  )
    return { action: "Offline", animate: false, qualifier: lifecycle };
  let action: AvatarAction = "Idle";
  if (input.accepted) {
    if (lifecycle === "claimed") action = "Walk";
    else if (lifecycle === "running") action = "Work";
    else if (["complete", "succeeded"].includes(lifecycle))
      action = (input.elapsedMs ?? 0) <= 2200 ? "Celebrate" : "Idle";
    else if (["failed", "error"].includes(lifecycle))
      action = (input.elapsedMs ?? 0) <= 2200 ? "Error" : "Idle";
  }
  return { action, animate: !input.reducedMotion, qualifier: lifecycle };
}

export const AVATAR_SYSTEM_CAPABILITY = {
  package: "avatar-system",
  phase: "avatar-3d",
  schema: AVATAR_SCHEMA,
  avatarsAvailable: true,
} as const;
