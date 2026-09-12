import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { AdapterRegistry } from "../src/agent-sessions.js";
import type { AgentRegistration } from "@agentintersect-world/world-schema/agent-setup";
it("registers the selected native Codex connection in an otherwise unconfigured server", async () => {
  const module = await import("../src/agent-setup-runtime.js").catch(
    () => null,
  );
  expect(module?.createAgentSetupRuntime).toBeTypeOf("function");
  if (!module) return;
  const root = await mkdtemp(path.join(tmpdir(), "aiw-setup-runtime-"));
  try {
    const executablePath = path.join(root, "codex");
    await mkdir(path.join(root, ".codex"));
    await writeFile(
      executablePath,
      `#!${process.execPath}\nconst arg = process.argv.slice(2).join(' ');\nconst responses = {'--version':'codex-cli 9.0.0', 'exec --help':'Usage: codex exec --model --sandbox --json resume', 'exec resume --help':'Usage: codex exec resume [SESSION_ID] --json', 'login status':'Logged in'};\nif (!(arg in responses)) process.exit(1);\nif (arg === 'login status') { console.log(responses[arg]); process.exit(0); }\nprocess.stdin.resume(); process.stdin.on('end', () => console.log(responses[arg]));\n`,
      { mode: 0o700 },
    );
    const registration: AgentRegistration = {
      id: "6b160d9e-299f-42d5-90a6-5468451e485c",
      installationId: "fixture",
      adapterId: "codex",
      displayName: "Native Work",
      environment: { id: "linux", kind: "linux", label: "Linux" },
      executablePath,
      homePath: root,
      identity: {
        id: "work",
        label: "Work",
        kind: "profile",
        profilePath: path.join(root, ".codex"),
      },
      connectedAt: new Date().toISOString(),
    };
    const registry = new AdapterRegistry([], ["codex"]);
    const runtime = module.createAgentSetupRuntime({
      registry,
      dataDirectory: path.join(root, "world"),
    });
    const check = await runtime.check(registration);
    expect(check.status, check.message).toBe("ready");
    expect(registry.require("codex", registration.id).id).toBe("codex");
    expect(await runtime.check(registration)).toMatchObject({
      status: "ready",
    });
    const other = {
      ...registration,
      id: "880b9eeb-5c0e-4f90-ab5e-893249d407c5",
      environment: {
        id: "windows",
        kind: "windows" as const,
        label: "Windows",
      },
    };
    expect(await runtime.check(other)).toMatchObject({
      status: "needs-attention",
    });
    expect(() => registry.require("codex", other.id)).toThrow(/unavailable/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
