import { defineConfig } from "@playwright/test";
import { realpathSync } from "node:fs";
import { dirname } from "node:path";

const serverPort = 43_770;
const webPort = 45_173;
const approvedRepositoryRoot = realpathSync(process.cwd());
const approvedWorktreeParent = realpathSync(dirname(approvedRepositoryRoot));
const configuredPlaywrightDataRoot = process.env.AIW_PLAYWRIGHT_DATA_ROOT;
const playwrightDataRoot =
  configuredPlaywrightDataRoot ?? `/tmp/aiw-phase17-playwright-${process.pid}`;
if (!configuredPlaywrightDataRoot)
  process.env.AIW_PHASE17_PLAYWRIGHT_CLEANUP_ROOT = playwrightDataRoot;

export default defineConfig({
  testDir: "./apps/web/e2e",
  globalTeardown: "./tooling/scripts/playwright-global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["line"],
    ["json", { outputFile: "test-results/playwright-results.json" }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      grepInvert: /@pointer-lock/,
      use: { browserName: "chromium", headless: true },
    },
    {
      name: "headed-pointer-lock",
      testMatch: "**/phase13-world-action-journey.spec.ts",
      grep: /@pointer-lock/,
      use: { browserName: "chromium", headless: false },
    },
  ],
  webServer: [
    {
      command: "node apps/local-server/dist/index.js",
      env: {
        AIW_HOST: "127.0.0.1",
        AIW_PORT: String(serverPort),
        AIW_PRESENTATION_ALLOWED_ORIGIN: `http://127.0.0.1:${webPort}`,
        AIW_PRESENTATION_ALLOWED_HOST: `127.0.0.1:${webPort}`,
        AIW_PRESENTATION_DATA_DIR: "/tmp/aiw-phase9-playwright-presentation",
        AIW_PHASE17_STATE_DIR: `${playwrightDataRoot}/phase17`,
        AIW_PHASE16_REPOSITORY_ROOT: approvedRepositoryRoot,
        AIW_PHASE16_WORKTREE_PARENT: approvedWorktreeParent,
      },
      port: serverPort,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `vite preview apps/web --config apps/web/vite.config.ts --host 127.0.0.1 --port ${webPort} --strictPort`,
      env: {
        AIW_LOCAL_SERVER_URL: `http://127.0.0.1:${serverPort}`,
        AIW_PRESENTATION_PROXY_ORIGIN: `http://127.0.0.1:${webPort}`,
        AIW_PRESENTATION_PROXY_HOST: `127.0.0.1:${webPort}`,
      },
      port: webPort,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
