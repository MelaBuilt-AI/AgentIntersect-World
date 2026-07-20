import { defineConfig } from "@playwright/test";

const serverPort = 43_770;
const webPort = 45_173;

export default defineConfig({
  testDir: "./apps/web/e2e",
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
  webServer: [
    {
      command: "node apps/local-server/dist/index.js",
      env: {
        AIW_HOST: "127.0.0.1",
        AIW_PORT: String(serverPort),
        AIW_PRESENTATION_ALLOWED_ORIGIN: `http://127.0.0.1:${webPort}`,
        AIW_PRESENTATION_ALLOWED_HOST: `127.0.0.1:${webPort}`,
        AIW_PRESENTATION_DATA_DIR: "/tmp/aiw-phase9-playwright-presentation",
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
