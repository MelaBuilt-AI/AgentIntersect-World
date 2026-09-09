import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";
const servers = Array.isArray(base.webServer)
  ? base.webServer
  : [base.webServer!];

// Keep the operator's existing apps/web/dist and retained evidence untouched.
const output =
  process.env.AIW_WORKBENCH_PROOF_ROOT ?? "/tmp/aiw-repository-workbench-proof";
const webBuild =
  process.env.AIW_WORKBENCH_WEB_BUILD ??
  "/tmp/aiw-repository-workbench-build/web";
export default defineConfig({
  ...base,
  testMatch: "**/world-entry-single-agent.spec.ts",
  grep: /@repository-workbench/,
  outputDir: `${output}/browser`,
  reporter: [
    ["line"],
    ["json", { outputFile: `${output}/browser-results.json` }],
  ],
  projects: [
    {
      name: "repository-workbench",
      use: { browserName: "chromium", headless: true },
    },
  ],
  webServer: [
    {
      ...servers[0],
      command: "node --import tsx apps/local-server/src/index.ts",
      env: {
        ...servers[0]!.env,
        AIW_PRESENTATION_DATA_DIR: `${output}/server/presentation`,
        AIW_AGENT_SESSION_DATA_DIR: `${output}/server/sessions`,
        AIW_PHASE17_STATE_DIR: `${output}/server/phase17`,
      },
    },
    {
      ...servers[1],
      command: `node node_modules/vite/bin/vite.js preview apps/web --config apps/web/vite.config.ts --outDir ${JSON.stringify(webBuild)} --host 127.0.0.1 --port 45173 --strictPort`,
    },
  ],
});
