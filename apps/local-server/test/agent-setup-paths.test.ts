import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { it, expect, vi } from "vitest";
import type { AgentRegistration } from "@agentintersect-world/world-schema/agent-setup";
const execution = vi.hoisted(() => ({
  host: { platform: "linux", distro: "Ubuntu" },
  mapPath: vi.fn((p: string) => `C:/native${p}`),
  verifyWorkspace: vi.fn(async () => {}),
  readNativeFile: vi.fn(async (p: string) =>
    p.endsWith(".env")
      ? "API_SERVER_KEY=fixture"
      : p.endsWith("config.yaml")
        ? "gateway:\n  api_server:\n    port: 8642\n"
        : JSON.stringify({
            gateway: { port: 18789, auth: { token: "fixture" } },
          }),
  ),
}));
vi.mock("../src/agent-environment.js", async () => ({
  ...(await vi.importActual("../src/agent-environment.js")),
  createEnvironmentExecution: async () => execution,
}));
import { createAgentSetupRuntime } from "../src/agent-setup-runtime.js";
import { AdapterRegistry } from "../src/agent-sessions.js";
it.each(["hermes", "openclaw", "codex", "claude-code"] as const)(
  "registers %s with the selected native environment's workspace contract",
  async (adapterId) => {
    const root = await mkdtemp(path.join(tmpdir(), "aiw-registration-path-"));
    try {
      const registration: AgentRegistration = {
        id: randomUUID(),
        installationId: "fixture",
        adapterId,
        displayName: "Native",
        environment: { id: "windows", kind: "windows", label: "Windows" },
        executablePath: `C:\\bin\\${adapterId}.exe`,
        homePath: "C:\\Users\\Native",
        identity: {
          id: "default",
          label: "Default",
          kind: "profile",
          profilePath: "C:\\Users\\Native\\profile",
        },
        connectedAt: new Date().toISOString(),
      };
      const registry = new AdapterRegistry([], [adapterId]);
      const runtime = createAgentSetupRuntime({
        registry,
        dataDirectory: root,
      });
      await runtime.restore([registration]);
      const adapter = registry.require(adapterId, registration.id);
      expect(adapter.workspace?.mapPath("/mnt/c/project")).toBe(
        "C:/native/mnt/c/project",
      );
      await adapter.workspace!.verifyWorkspace("/mnt/c/reports", true);
      expect(execution.verifyWorkspace).toHaveBeenCalledWith(
        "/mnt/c/reports",
        true,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
