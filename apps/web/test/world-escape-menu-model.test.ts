import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORLD_DISPLAY_PREFERENCES,
  loadWorldDisplayPreferences,
  saveWorldDisplayPreferences,
  WORLD_DISPLAY_PREFERENCES_KEY,
} from "../src/world-entry/world-escape-menu-model.js";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("normal-World display preferences", () => {
  it("falls back without rewriting missing or malformed browser-local state", () => {
    const storage = new MemoryStorage();
    expect(loadWorldDisplayPreferences(storage)).toEqual(
      DEFAULT_WORLD_DISPLAY_PREFERENCES,
    );
    storage.setItem(WORLD_DISPLAY_PREFERENCES_KEY, '{"showControlHints":"no"}');
    expect(loadWorldDisplayPreferences(storage)).toEqual(
      DEFAULT_WORLD_DISPLAY_PREFERENCES,
    );
    expect(storage.getItem(WORLD_DISPLAY_PREFERENCES_KEY)).toBe(
      '{"showControlHints":"no"}',
    );
  });

  it("round-trips only the two innocuous display controls", () => {
    const storage = new MemoryStorage();
    saveWorldDisplayPreferences(storage, {
      showControlHints: false,
      largeMenuText: true,
    });
    expect(loadWorldDisplayPreferences(storage)).toEqual({
      showControlHints: false,
      largeMenuText: true,
    });
  });
});
