export const AVATAR_PROFILE_STORAGE_KEY = "aiw.avatar-appearance.v1";

export const AVATAR_BODIES = ["female", "male"] as const;
export const AVATAR_ACCENTS = ["cyan", "violet", "amber"] as const;

export type AvatarBody = (typeof AVATAR_BODIES)[number];
export type AvatarAccent = (typeof AVATAR_ACCENTS)[number];

export type AvatarProfile = {
  readonly version: 1;
  readonly body: AvatarBody;
  readonly accent: AvatarAccent;
  readonly showHalo: boolean;
  readonly showHelmet: boolean;
  readonly showFace: boolean;
  readonly showEyes: boolean;
  readonly showGlow: boolean;
};

export type AvatarLayer = {
  readonly id: "halo" | "torso" | "head" | "helmet" | "face" | "eyes" | "glow";
  readonly src: string;
  readonly decorative: boolean;
};

export type AvatarStorage = {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
};

export const DEFAULT_AVATAR_PROFILE: AvatarProfile = Object.freeze({
  version: 1,
  body: "female",
  accent: "cyan",
  showHalo: true,
  showHelmet: true,
  showFace: true,
  showEyes: true,
  showGlow: true,
});

const profileKeys = [
  "version",
  "body",
  "accent",
  "showHalo",
  "showHelmet",
  "showFace",
  "showEyes",
  "showGlow",
] as const;

export function parseAvatarProfile(value: unknown): AvatarProfile | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== profileKeys.length ||
    profileKeys.some((key) => !Object.hasOwn(record, key)) ||
    record.version !== 1 ||
    !AVATAR_BODIES.includes(record.body as AvatarBody) ||
    !AVATAR_ACCENTS.includes(record.accent as AvatarAccent) ||
    ["showHalo", "showHelmet", "showFace", "showEyes", "showGlow"].some(
      (key) => typeof record[key] !== "boolean",
    )
  ) {
    return null;
  }
  return {
    version: 1,
    body: record.body as AvatarBody,
    accent: record.accent as AvatarAccent,
    showHalo: record.showHalo as boolean,
    showHelmet: record.showHelmet as boolean,
    showFace: record.showFace as boolean,
    showEyes: record.showEyes as boolean,
    showGlow: record.showGlow as boolean,
  };
}

export function loadAvatarProfile(storage: AvatarStorage): AvatarProfile {
  try {
    const raw = storage.getItem(AVATAR_PROFILE_STORAGE_KEY);
    if (raw === null) return DEFAULT_AVATAR_PROFILE;
    return parseAvatarProfile(JSON.parse(raw)) ?? DEFAULT_AVATAR_PROFILE;
  } catch {
    return DEFAULT_AVATAR_PROFILE;
  }
}

export function hasSavedAvatarProfile(storage: AvatarStorage): boolean {
  try {
    const raw = storage.getItem(AVATAR_PROFILE_STORAGE_KEY);
    return raw !== null && parseAvatarProfile(JSON.parse(raw)) !== null;
  } catch {
    return false;
  }
}

export function saveAvatarProfile(
  storage: AvatarStorage,
  value: unknown,
): AvatarProfile {
  const profile = parseAvatarProfile(value);
  if (profile === null)
    throw new TypeError("Invalid avatar appearance profile");
  storage.setItem(AVATAR_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

export function avatarLayersFor(
  profile: AvatarProfile,
): readonly AvatarLayer[] {
  const base = `/assets/dashboard/avatar-puppet-${profile.body}`;
  return [
    profile.showHalo && {
      id: "halo" as const,
      src: `${base}-background-halo-rings.png`,
      decorative: true,
    },
    {
      id: "torso" as const,
      src: `${base}-shoulders-torso.png`,
      decorative: false,
    },
    {
      id: "head" as const,
      src: `${base}-head.png`,
      decorative: false,
    },
    profile.showHelmet && {
      id: "helmet" as const,
      src: `${base}-hair-helmet.png`,
      decorative: false,
    },
    profile.showFace && {
      id: "face" as const,
      src: `${base}-face.png`,
      decorative: false,
    },
    profile.showEyes && {
      id: "eyes" as const,
      src: `${base}-eyes.png`,
      decorative: false,
    },
    profile.showGlow && {
      id: "glow" as const,
      src: `${base}-foreground-glow.png`,
      decorative: true,
    },
  ].filter((layer): layer is AvatarLayer => layer !== false);
}

export function avatarFallbackSheet(profile: AvatarProfile): string {
  return `/assets/dashboard/avatar-sheet-${profile.body}-front.png`;
}

export const AVATAR_SYSTEM_CAPABILITY = {
  package: "avatar-system",
  phase: "appearance-2d",
  avatarsAvailable: true,
} as const;
