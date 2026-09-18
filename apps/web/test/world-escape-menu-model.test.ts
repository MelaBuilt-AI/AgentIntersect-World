import { DEFAULT_WORLD_GRAPHICS } from "@agentintersect-world/renderer-r3f";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORLD_DISPLAY_PREFERENCES,
  loadWorldDisplayPreferences,
  saveWorldDisplayPreferences,
  WORLD_DISPLAY_PREFERENCES_KEY,
  worldEscapeMenuOwner,
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
  it("gives Escape to setup even while an inert World is still mounted", () => {
    expect(worldEscapeMenuOwner(true, true)).toBe("entry");
    expect(worldEscapeMenuOwner(true, false)).toBe("entry");
    expect(worldEscapeMenuOwner(false, false)).toBe("entry");
    expect(worldEscapeMenuOwner(false, true)).toBe("world");
  });
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

  it("migrates old display controls without resetting them", () => {
    const storage = new MemoryStorage();
    saveWorldDisplayPreferences(storage, {
      showControlHints: false,
      largeMenuText: true,
    });
    expect(loadWorldDisplayPreferences(storage)).toEqual({
      graphics: DEFAULT_WORLD_GRAPHICS,
      showControlHints: false,
      largeMenuText: true,
    });
  });
});

it("defaults every graphics effect on and persists independent off flags", () => {
  const storage = new MemoryStorage();
  expect(Object.values(loadWorldDisplayPreferences(storage).graphics!)).toEqual(
    Array(7).fill(true),
  );
  saveWorldDisplayPreferences(storage, {
    showControlHints: false,
    largeMenuText: true,
    graphics: { ...DEFAULT_WORLD_GRAPHICS, bloom: false, baseFog: false },
  });
  expect(loadWorldDisplayPreferences(storage)).toEqual({
    showControlHints: false,
    largeMenuText: true,
    graphics: { ...DEFAULT_WORLD_GRAPHICS, bloom: false, baseFog: false },
  });
  storage.setItem(
    WORLD_DISPLAY_PREFERENCES_KEY,
    JSON.stringify({
      showControlHints: false,
      largeMenuText: true,
      graphics: { bloom: false, baseFog: "invalid" },
    }),
  );
  expect(loadWorldDisplayPreferences(storage).graphics).toEqual({
    ...DEFAULT_WORLD_GRAPHICS,
    bloom: false,
  });
});
