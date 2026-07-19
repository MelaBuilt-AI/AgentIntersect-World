import { create } from "zustand";

import {
  DEFAULT_HARNESS_INTENT,
  loadHarnessIntent,
  saveHarnessIntent,
  type HarnessId,
  type HarnessIntent,
} from "./harness-intent.js";

type HarnessIntentState = HarnessIntent & {
  readonly setDefaultHarness: (id: HarnessId) => void;
  readonly setCurrentHarness: (id: HarnessId) => void;
};

const initial =
  typeof window === "undefined"
    ? DEFAULT_HARNESS_INTENT
    : loadHarnessIntent(window.localStorage);

function persist(intent: HarnessIntent) {
  if (typeof window !== "undefined")
    saveHarnessIntent(window.localStorage, intent);
}

export const useHarnessIntent = create<HarnessIntentState>((set) => ({
  ...initial,
  setDefaultHarness: (defaultHarness) =>
    set((state) => {
      const next = {
        version: 1 as const,
        defaultHarness,
        currentHarness: state.currentHarness,
      };
      persist(next);
      return next;
    }),
  setCurrentHarness: (currentHarness) =>
    set((state) => {
      const next = {
        version: 1 as const,
        defaultHarness: state.defaultHarness,
        currentHarness,
      };
      persist(next);
      return next;
    }),
}));
