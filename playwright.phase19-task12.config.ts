import { defineConfig } from "@playwright/test";
import { realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";

const evidenceDirectory = process.env.AIW_PHASE19_TASK12_EVIDENCE_DIR;
if (!evidenceDirectory)
  throw new Error("AIW_PHASE19_TASK12_EVIDENCE_DIR is required.");

const serverPort = 43_770;
const webPort = 45_173;
const approvedRepositoryRoot = realpathSync(process.cwd());
const approvedWorktreeParent = realpathSync(dirname(approvedRepositoryRoot));
const playwrightDataRoot = resolve(evidenceDirectory, "server-state");

export default defineConfig({
  testDir: "./apps/web/e2e",
  testMatch: "**/phase19-task12-two-agent-coding.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  outputDir: resolve(evidenceDirectory, "playwright-output"),
  reporter: [
    ["line"],
    [
      "json",
      { outputFile: resolve(evidenceDirectory, "playwright-results.json") },
    ],
  ],
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "retain-on-failure",
    video: "on",
  },
  projects: [
    {
      name: "phase19-task12-headed-chromium",
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
        AIW_PRESENTATION_DATA_DIR: resolve(
          evidenceDirectory,
          "presentation-state",
        ),
        AIW_PHASE17_STATE_DIR: resolve(playwrightDataRoot, "phase17"),
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
