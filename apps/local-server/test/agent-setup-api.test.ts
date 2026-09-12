import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
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
it("keeps prerequisite preview/cancel and conversation listing separate from attachment", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-setup-plans-api-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "plugins", "agentintersect-world"), {
    recursive: true,
  });
  await writeFile(path.join(root, "config.yaml"), "plugins:\n  enabled: []\n");
  await writeFile(
    path.join(root, "plugins", "agentintersect-world", "__init__.py"),
    "# fixture\n",
  );
  const service = new AgentSetupService({
    dataDirectory: path.join(root, "world"),
    listConversations: async () => [
      { id: "native-one", title: "Native one", source: "cli" },
    ],
  });
  service.lastDiscovery = {
    environments: [],
    installations: [
      {
        id: "fixture",
        adapterId: "hermes",
        environment: { id: "local", kind: "linux", label: "Local" },
        executablePath: "/fixture/hermes",
        homePath: root,
        identities: [
          {
            id: "selected",
            kind: "profile",
            label: "Selected",
            profilePath: root,
          },
        ],
        status: "found",
      },
    ],
  };
  const server = createLocalServer({
    config: loadLocalServerConfig({
      NODE_ENV: "test",
      AIW_PRESENTATION_DATA_DIR: path.join(root, "presentation"),
    }),
    agentSetupService: service,
  });
  cleanups.push(() => server.close());
  const payload = {
    installationId: "fixture",
    identityId: "selected",
    displayName: "World label",
  };
  const listed = await server.inject({
    method: "POST",
    url: "/agent-setup/conversations",
    payload,
  });
  expect(listed.statusCode).toBe(200);
  expect(listed.json().data).toEqual([
    { id: "native-one", title: "Native one", source: "cli" },
  ]);
  const preview = await server.inject({
    method: "POST",
    url: "/agent-setup/prerequisites/preview",
    payload,
  });
  expect(preview.statusCode).toBe(200);
  const plan = preview.json().data;
  const action = plan.actions[0];
  expect(action.kind).toBe("enable-hermes-world-plugin");
  const denied = await server.inject({
    method: "POST",
    url: "/agent-setup/prerequisites/apply",
    payload: { planId: plan.id, actionId: action.id, confirmed: false },
  });
  expect(denied.statusCode).toBe(400);
  expect(
    (
      await server.inject({
        method: "POST",
        url: "/agent-setup/prerequisites/cancel",
        payload: { planId: plan.id },
      })
    ).statusCode,
  ).toBe(200);
  const cancelled = await server.inject({
    method: "POST",
    url: "/agent-setup/prerequisites/apply",
    payload: { planId: plan.id, actionId: action.id, confirmed: true },
  });
  expect(cancelled.statusCode).toBe(400);
  expect((await service.state()).registrations).toEqual([]);
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
  let additionalDirectory: string | undefined;
  const service = new AgentSetupService({
    dataDirectory: root,
    discover: async (directory) => {
      additionalDirectory = directory;
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
  const located = await server.inject({
    method: "POST",
    url: "/agent-setup/discover",
    payload: { additionalDirectory: root },
  });
  expect(located.statusCode).toBe(200);
  expect(additionalDirectory).toBe(root);
  const invalid = await server.inject({
    method: "POST",
    url: "/agent-setup/discover",
    payload: { additionalDirectory: "relative-directory" },
  });
  expect(invalid.statusCode).toBe(400);
  expect(scans).toBe(2);
  const attach = await server.inject({
    method: "POST",
    url: "/agent-setup/attach",
    payload: {
      installationId: "not-found",
      identityId: "default",
      displayName: "Missing Agent",
    },
  });
  expect(attach.statusCode).toBe(400);
  expect(attach.json().error.message).toMatch(/Discover/i);
  const complete = await server.inject({
    method: "POST",
    url: "/agent-setup/complete",
    payload: {},
  });
  expect(complete.statusCode).toBe(400);
  expect(complete.json().error.message).toMatch(/Attach/i);
});
