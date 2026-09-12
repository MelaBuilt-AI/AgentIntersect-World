export const WORLD_DISPLAY_PREFERENCES_KEY = "aiw.world.display-preferences.1";

export type WorldDisplayPreferences = {
  readonly showControlHints: boolean;
  readonly largeMenuText: boolean;
};

export const DEFAULT_WORLD_DISPLAY_PREFERENCES: WorldDisplayPreferences =
  Object.freeze({
    showControlHints: true,
    largeMenuText: false,
  });

export function worldEscapeMenuOwner(
  setupOpen: boolean,
  worldMenuPresent: boolean,
): "entry" | "world" {
  return setupOpen || !worldMenuPresent ? "entry" : "world";
}

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

export function loadWorldDisplayPreferences(
  storage: PreferenceStorage,
): WorldDisplayPreferences {
  try {
    const parsed = JSON.parse(
      storage.getItem(WORLD_DISPLAY_PREFERENCES_KEY) ?? "null",
    ) as unknown;
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      typeof (parsed as Record<string, unknown>).showControlHints ===
        "boolean" &&
      typeof (parsed as Record<string, unknown>).largeMenuText === "boolean"
    ) {
      const preferences = parsed as {
        readonly showControlHints: boolean;
        readonly largeMenuText: boolean;
      };
      return {
        showControlHints: preferences.showControlHints,
        largeMenuText: preferences.largeMenuText,
      };
    }
  } catch {
    // Invalid browser-local display preferences fall back without mutation.
  }
  return DEFAULT_WORLD_DISPLAY_PREFERENCES;
}

export function saveWorldDisplayPreferences(
  storage: PreferenceStorage,
  preferences: WorldDisplayPreferences,
): void {
  storage.setItem(WORLD_DISPLAY_PREFERENCES_KEY, JSON.stringify(preferences));
}
