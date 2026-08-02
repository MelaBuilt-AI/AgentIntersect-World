import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["line"]],
  outputDir:
    process.env.AIW_PLAYWRIGHT_OUTPUT_DIR ??
    "artifacts/avatar-replacement-evidence/world-animation-completion-v1/browser/test-results",
  use: {
    baseURL: "http://aiw.local",
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
  },
});
