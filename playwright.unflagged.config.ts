import { defineConfig } from "@playwright/test";

import flaggedConfig from "./playwright.config.js";

export default defineConfig({
  ...flaggedConfig,
  testIgnore: [],
  testMatch: "**/world-entry-internal-fail-closed.spec.ts",
  projects: [
    {
      name: "unflagged-fail-closed",
      use: { browserName: "chromium", headless: true },
    },
  ],
});
