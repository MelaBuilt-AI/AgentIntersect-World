import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadLocalServerConfig } from "@agentintersect-world/config/node";
import { afterEach, expect, it } from "vitest";
import { createLocalServer } from "../src/server.js";
import { AgentSetupService } from "../src/agent-setup-service.js";
import { discoverLocalAgents } from "../src/agent-discovery.js";
const cleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
it("exposes first-run setup without any enabled harness or API key", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-setup-api-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const server = createLocalServer({
    config: loadLocalServerConfig({
      NODE_ENV: "test",
      AIW_PRESENTATION_DATA_DIR: path.join(root, "presentation"),
    }),
  });
  cleanups.push(() => server.close());
  const response = await server.inject({ method: "GET", url: "/agent-setup" });
  expect(response.statusCode).toBe(200);
  expect(response.json().data).toMatchObject({
    completed: false,
    registrations: [],
  });
});
it("runs discovery only after an explicit action and retains server-owned installation identities", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-setup-scan-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  let scans = 0;
  const service = new AgentSetupService({
    dataDirectory: root,
    discover: async () => {
      scans += 1;
      return {
        installations: await discoverLocalAgents({
          home: root,
          searchPath: root,
          environment: { id: "test", kind: "linux", label: "Test" },
        }),
        environments: [{ id: "test", label: "Test", status: "scanned" }],
      };
    },
  });
  const server = createLocalServer({
    config: loadLocalServerConfig({
      NODE_ENV: "test",
      AIW_PRESENTATION_DATA_DIR: path.join(root, "presentation"),
    }),
    agentSetupService: service,
  });
  cleanups.push(() => server.close());
  await server.inject({ method: "GET", url: "/agent-setup" });
  expect(scans).toBe(0);
  const response = await server.inject({
    method: "POST",
    url: "/agent-setup/discover",
    payload: {},
  });
  expect(response.statusCode).toBe(200);
  expect(scans).toBe(1);
  expect(response.json().data.environments).toEqual([
    { id: "test", label: "Test", status: "scanned" },
  ]);
  expect(service.lastDiscovery).toEqual(response.json().data);
  expect((await service.state()).completed).toBe(false);
});
