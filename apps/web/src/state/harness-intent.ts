export const HARNESS_INTENT_STORAGE_KEY = "aiw.harness-intent.v1";

export const HARNESS_OPTIONS = [
  { id: "openclaw", label: "OpenClaw", claim: "selection-only" },
  { id: "hermes", label: "Hermes", claim: "selection-only" },
  { id: "claude-code", label: "Claude Code", claim: "selection-only" },
  { id: "codex", label: "Codex", claim: "selection-only" },
] as const;

export type HarnessId = (typeof HARNESS_OPTIONS)[number]["id"];
export type HarnessIntent = {
  readonly version: 1;
  readonly defaultHarness: HarnessId;
  readonly currentHarness: HarnessId;
};
export type HarnessStorage = Pick<Storage, "getItem" | "setItem">;

export const DEFAULT_HARNESS_INTENT: HarnessIntent = Object.freeze({
  version: 1,
  defaultHarness: "codex",
  currentHarness: "codex",
});

const harnessIds = new Set<HarnessId>(
  HARNESS_OPTIONS.map((option) => option.id),
);

export function parseHarnessIntent(value: unknown): HarnessIntent | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== 3 ||
    !Object.hasOwn(record, "version") ||
    !Object.hasOwn(record, "defaultHarness") ||
    !Object.hasOwn(record, "currentHarness") ||
    record.version !== 1 ||
    !harnessIds.has(record.defaultHarness as HarnessId) ||
    !harnessIds.has(record.currentHarness as HarnessId)
  ) {
    return null;
  }
  return {
    version: 1,
    defaultHarness: record.defaultHarness as HarnessId,
    currentHarness: record.currentHarness as HarnessId,
  };
}

export function loadHarnessIntent(storage: HarnessStorage): HarnessIntent {
  try {
    const raw = storage.getItem(HARNESS_INTENT_STORAGE_KEY);
    return raw === null
      ? DEFAULT_HARNESS_INTENT
      : (parseHarnessIntent(JSON.parse(raw)) ?? DEFAULT_HARNESS_INTENT);
  } catch {
    return DEFAULT_HARNESS_INTENT;
  }
}

export function saveHarnessIntent(
  storage: HarnessStorage,
  value: unknown,
): HarnessIntent {
  const intent = parseHarnessIntent(value);
  if (intent === null) throw new TypeError("Invalid harness selection intent");
  storage.setItem(HARNESS_INTENT_STORAGE_KEY, JSON.stringify(intent));
  return intent;
}
