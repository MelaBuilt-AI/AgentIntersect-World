import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it, expect } from "vitest";
import { AdapterRegistry } from "../src/agent-sessions.js";
import { createAgentSetupRuntime } from "../src/agent-setup-runtime.js";
import type { AgentRegistration } from "@agentintersect-world/world-schema/agent-setup";

it("rechecks Hermes with freshly saved credentials instead of a cached rejected key", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-hermes-recheck-"));
  const seen: string[] = [];
  const server = createServer((request, response) => {
    seen.push(request.headers.authorization ?? "");
    response.writeHead(401).end();
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const port = (server.address() as { port: number }).port;
    await writeFile(path.join(root, "config.yaml"), "{}\n");
    const saveKey = (key: string) =>
      writeFile(
        path.join(root, ".env"),
        `API_SERVER_KEY=${key}\nAPI_SERVER_PORT=${port}\n`,
      );
    await saveKey("old-test-key");
    const registration: AgentRegistration = {
      id: "one",
      adapterId: "hermes",
      installationId: "local",
      displayName: "Test",
      environment: { id: "local", kind: "linux", label: "Local" },
      executablePath: "/fixture/hermes",
      homePath: root,
      identity: {
        id: "default",
        kind: "profile",
        label: "Default",
        profilePath: root,
      },
      connectedAt: new Date().toISOString(),
    };
    const runtime = createAgentSetupRuntime({
      registry: new AdapterRegistry([], ["hermes"]),
      dataDirectory: path.join(root, "world"),
    });
    await runtime.check(registration);
    await saveKey("new-test-key");
    await runtime.check(registration);
    expect(seen).toEqual(["Bearer old-test-key", "Bearer new-test-key"]);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
