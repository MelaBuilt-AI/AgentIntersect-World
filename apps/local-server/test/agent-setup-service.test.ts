import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { AgentSetupService } from "../src/agent-setup-service.js";
import type { AgentInstallation } from "../src/agent-discovery.js";
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
it("preserves explicitly configured legacy entry until a saved connection is added", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-setup-legacy-"));
  roots.push(root);
  const service = new AgentSetupService({
    dataDirectory: root,
    legacyConfigured: true,
  });
  expect(await service.state()).toMatchObject({
    completed: true,
    registrations: [],
  });
});
const installation: AgentInstallation = {
  id: "fixture-installation",
  adapterId: "codex",
  executablePath: "/fixture/bin/codex",
  homePath: "/fixture/home",
  environment: { id: "fixture", kind: "linux", label: "Fixture" },
  identities: [
    {
      id: "work",
      label: "Work",
      kind: "profile",
      profilePath: "/fixture/home/.codex",
    },
  ],
  status: "found",
};
it("saves an explicit Hermes conversation only from the selected profile list", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-selected-session-"));
  roots.push(root);
  const service = new AgentSetupService({
    dataDirectory: root,
    checkConnection: async () => ({ status: "ready", message: "ready" }),
    listConversations: async () => [
      { id: "native-one", title: "Same name", source: "discord" },
    ],
  });
  service.lastDiscovery = {
    installations: [{ ...installation, adapterId: "hermes" }],
    environments: [],
  };
  const input = {
    installationId: installation.id,
    identityId: "work",
    displayName: "Fluff",
    conversationRef: "native-one",
  };
  const attached = await service.attach(input);
  expect(attached.registration?.conversationRef).toBe("native-one");
  expect(
    (await new AgentSetupService({ dataDirectory: root }).state())
      .registrations[0]?.conversationRef,
  ).toBe("native-one");
  await expect(
    service.attach({ ...input, conversationRef: "foreign-session" }),
  ).rejects.toThrow(/conversation/i);
  service.lastDiscovery = { installations: [installation], environments: [] };
  await expect(service.attach(input)).rejects.toThrow(/Hermes/i);
});

it("persists only an explicitly checked registration and keeps setup completion separate from attachment", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-agent-setup-"));
  roots.push(root);
  const service = new AgentSetupService({
    dataDirectory: root,
    checkConnection: async () => ({
      status: "ready",
      message: "Fixture connection check passed",
    }),
  });
  service.lastDiscovery = { installations: [installation], environments: [] };
  expect(service.attach).toBeTypeOf("function");
  const result = await service.attach({
    installationId: installation.id,
    identityId: "work",
    displayName: "Work Codex",
  });
  expect(result.check.status).toBe("ready");
  expect(result.registration).toMatchObject({
    displayName: "Work Codex",
    executablePath: installation.executablePath,
    identity: installation.identities[0],
  });
  const restarted = new AgentSetupService({ dataDirectory: root });
  expect(await restarted.state()).toMatchObject({
    completed: false,
    registrations: [result.registration],
  });
  await service.complete();
  expect((await restarted.state()).completed).toBe(true);
  expect(await readFile(service.filename, "utf8")).not.toContain("apiKey");
});
it("does not save an unavailable connection or trust browser-supplied installation identities", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-agent-setup-missing-"));
  roots.push(root);
  const service = new AgentSetupService({
    dataDirectory: root,
    checkConnection: async () => ({
      status: "needs-attention",
      message: "Sign in using the native harness, then Recheck.",
    }),
  });
  service.lastDiscovery = { installations: [installation], environments: [] };
  expect(service.attach).toBeTypeOf("function");
  const result = await service.attach({
    installationId: installation.id,
    identityId: "work",
    displayName: "Work Codex",
  });
  expect(result.registration).toBeNull();
  expect((await service.state()).registrations).toEqual([]);
  await expect(
    service.attach({
      installationId: "not-discovered",
      identityId: "work",
      displayName: "Work Codex",
    }),
  ).rejects.toThrow(/Discover/i);
  await expect(service.complete()).rejects.toThrow(/attach/i);
});
