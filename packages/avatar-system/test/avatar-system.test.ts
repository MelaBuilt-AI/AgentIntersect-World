import { describe, expect, it } from "vitest";

import {
  AVATAR_PROFILE_STORAGE_KEY,
  DEFAULT_AVATAR_PROFILE,
  avatarLayersFor,
  loadAvatarProfile,
  parseAvatarProfile,
  saveAvatarProfile,
} from "../src/index.js";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("avatar appearance profile", () => {
  it("validates, persists, and restores a bounded appearance", () => {
    const storage = new MemoryStorage();
    const profile = {
      ...DEFAULT_AVATAR_PROFILE,
      body: "male" as const,
      accent: "violet" as const,
      showHelmet: false,
    };
    expect(saveAvatarProfile(storage, profile)).toEqual(profile);
    expect(storage.values.has(AVATAR_PROFILE_STORAGE_KEY)).toBe(true);
    expect(loadAvatarProfile(storage)).toEqual(profile);
    expect(
      avatarLayersFor(profile).some((layer) => layer.id === "helmet"),
    ).toBe(false);
  });

  it("rejects extra/private fields and safely falls back for corrupt storage", () => {
    expect(
      parseAvatarProfile({ ...DEFAULT_AVATAR_PROFILE, personality: "secret" }),
    ).toBeNull();
    const storage = new MemoryStorage();
    storage.setItem(AVATAR_PROFILE_STORAGE_KEY, "{broken");
    expect(loadAvatarProfile(storage)).toEqual(DEFAULT_AVATAR_PROFILE);
  });
});
