import { it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { parseEnv } from "node:util";
import { parse, stringify } from "yaml";
import type { AgentRegistration } from "@agentintersect-world/world-schema/agent-setup";
import { AgentPrerequisites } from "../src/agent-prerequisites.js";

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-first-run-"));
  const profile = path.join(root, "profile");
  await mkdir(profile);
  await writeFile(
    path.join(profile, "config.yaml"),
    "plugins:\n  enabled: []\nmodel: preserved\n",
  );
  const registration: AgentRegistration = {
    id: "one",
    adapterId: "hermes",
    installationId: "local-hermes",
    displayName: "Test",
    environment: { id: "local", kind: "linux", label: "Local" },
    executablePath: "/fixture/hermes",
    homePath: root,
    identity: {
      id: "selected",
      kind: "profile",
      label: "Selected",
      profilePath: profile,
    },
    connectedAt: new Date().toISOString(),
  };
  return { root, profile, registration };
}

it("installs the bundled plugin only after approval without overwriting native files", async () => {
  const { root, profile, registration } = await fixture();
  try {
    const calls: readonly string[][] = [];
    const manager = new AgentPrerequisites(async () => {
      throw new Error("install must not run Hermes");
    });
    const plan = await manager.preview(registration);
    const action = plan.actions.find(
      (a) => a.kind === "install-hermes-world-plugin",
    );
    expect(
      action,
      "fresh installation has a real install action",
    ).toBeDefined();
    if (!action) return;
    await expect(manager.apply(plan.id, action.id, false)).rejects.toThrow(
      /confirm/i,
    );
    await manager.apply(plan.id, action.id, true);
    const destination = path.join(profile, "plugins/agentintersect-world");
    expect(
      await readFile(path.join(destination, "plugin.yaml"), "utf8"),
    ).toContain("agentintersect-world");
    expect(
      await readFile(path.join(destination, "__init__.py"), "utf8"),
    ).toContain("def register");
    expect(calls).toEqual([]);
    const next = await manager.preview(registration);
    expect(
      next.actions.some((a) => a.kind === "install-hermes-world-plugin"),
    ).toBe(false);
    expect(
      next.actions.some((a) => a.kind === "enable-hermes-world-plugin"),
    ).toBe(true);
    await expect(manager.apply(plan.id, action.id, true)).rejects.toThrow(
      /used|expired/i,
    );
    expect(await readFile(path.join(profile, "config.yaml"), "utf8")).toContain(
      "model: preserved",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it.each(["env", "split"])(
  "configures an authenticated loopback API with %s storage and no restart",
  async (storage) => {
    const { root, profile, registration } = await fixture();
    try {
      const envFile = path.join(profile, ".env");
      await writeFile(
        envFile,
        "UNRELATED=preserved\nAPI_SERVER_KEY=placeholder\n",
      );
      const calls: string[][] = [];
      const manager = new AgentPrerequisites(async (selected, args) => {
        expect(selected.identity.profilePath).toBe(profile);
        calls.push([...args]);
        expect(args.slice(0, 2)).toEqual(["config", "set"]);
        if (storage === "env" || args[2] === "API_SERVER_KEY") {
          const values = parseEnv(await readFile(envFile, "utf8"));
          values[args[2]!] = args[3]!;
          await writeFile(
            envFile,
            Object.entries(values)
              .map(([k, v]) => `${k}=${v}\n`)
              .join(""),
          );
        } else {
          await writeFile(
            path.join(profile, "config.yaml"),
            stringify({
              ...parse(
                await readFile(path.join(profile, "config.yaml"), "utf8"),
              ),
              [args[2]!]:
                args[2] === "API_SERVER_ENABLED" ? args[3] === "true" : args[3],
            }),
          );
        }
      });
      const plan = await manager.preview(registration);
      const action = plan.actions.find(
        (a) => a.kind === "configure-hermes-api",
      );
      expect(
        action,
        "fresh installation has an authenticated API setup action",
      ).toBeDefined();
      if (!action) return;
      expect(action.effect).toMatch(/replace|rotat/i);
      expect(JSON.stringify(plan)).not.toContain("placeholder");
      await manager.apply(plan.id, action.id, true);
      const saved = parseEnv(await readFile(envFile, "utf8"));
      expect(saved.API_SERVER_KEY).toMatch(/^[a-f0-9]{64}$/);
      const config = parse(
        await readFile(path.join(profile, "config.yaml"), "utf8"),
      );
      expect(saved.API_SERVER_HOST ?? config.API_SERVER_HOST).toBe("127.0.0.1");
      expect(
        String(saved.API_SERVER_ENABLED ?? config.API_SERVER_ENABLED),
      ).toBe("true");
      expect(config.model).toBe("preserved");
      if (storage === "split") expect(saved.API_SERVER_ENABLED).toBeUndefined();
      expect(saved.UNRELATED).toBe("preserved");
      expect(calls.some((c) => c.includes("restart"))).toBe(false);
      expect(await readFile(`${envFile}.aiw-${plan.id}.bak`, "utf8")).toContain(
        "placeholder",
      );
      expect(
        (await manager.preview(registration)).actions.some(
          (a) => a.kind === "configure-hermes-api",
        ),
      ).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
