import { describe, expect, it } from "vitest";

import {
  DEFAULT_HARNESS_INTENT,
  HARNESS_INTENT_STORAGE_KEY,
  HARNESS_OPTIONS,
  loadHarnessIntent,
  parseHarnessIntent,
  saveHarnessIntent,
} from "../src/state/harness-intent.js";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("local harness selection intent", () => {
  it("offers exactly the frozen selection-only harnesses", () => {
    expect(HARNESS_OPTIONS.map((option) => option.id)).toEqual([
      "openclaw",
      "hermes",
      "claude-code",
      "codex",
    ]);
    expect(
      HARNESS_OPTIONS.every((option) => option.claim === "selection-only"),
    ).toBe(true);
  });

  it("persists default/current intent and rejects invented readiness", () => {
    const storage = new MemoryStorage();
    const intent = {
      version: 1 as const,
      defaultHarness: "codex" as const,
      currentHarness: "hermes" as const,
    };
    expect(saveHarnessIntent(storage, intent)).toEqual(intent);
    expect(storage.values.has(HARNESS_INTENT_STORAGE_KEY)).toBe(true);
    expect(loadHarnessIntent(storage)).toEqual(intent);
    expect(parseHarnessIntent({ ...intent, ready: true })).toBeNull();
    storage.setItem(HARNESS_INTENT_STORAGE_KEY, "null");
    expect(loadHarnessIntent(storage)).toEqual(DEFAULT_HARNESS_INTENT);
  });
});
