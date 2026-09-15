import { it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import type { AgentRegistration } from "@agentintersect-world/world-schema/agent-setup";

it("previews without writes and applies only the exact current one-use consent", async () => {
  const api = await import("../src/agent-prerequisites.js").catch(() => null);
  expect(api, "prerequisite plan implementation").not.toBeNull();
  if (!api) return;
  const root = await mkdtemp(path.join(tmpdir(), "aiw-prerequisites-"));
  try {
    const profile = path.join(root, "profile");
    await mkdir(path.join(profile, "plugins", "agentintersect-world"), {
      recursive: true,
    });
    await writeFile(
      path.join(profile, "config.yaml"),
      "plugins:\n  enabled: []\nmodel: preserved\n",
    );
    await writeFile(
      path.join(profile, "plugins", "agentintersect-world", "__init__.py"),
      "# installed plugin\n",
    );
    const registration: AgentRegistration = {
      id: "one",
      adapterId: "hermes",
      installationId: "local-hermes",
      displayName: "Test",
      environment: {
        id: "local",
        kind: "linux",
        label: "Local",
        status: "scanned",
      },
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
    const calls: unknown[] = [];
    const manager = new api.AgentPrerequisites(async (r, args) => {
      calls.push([r.identity.profilePath, args]);
      await writeFile(
        path.join(profile, "config.yaml"),
        "plugins:\n  enabled: [agentintersect-world]\nmodel: preserved\n",
      );
    });
    const plan = await manager.preview(registration);
    expect(calls).toEqual([]);
    expect(plan.actions[0]?.kind).toBe("enable-hermes-world-plugin");
    await expect(
      manager.apply(plan.id, plan.actions[0]!.id, false),
    ).rejects.toThrow(/confirm/i);
    expect(calls).toEqual([]);
    await writeFile(
      path.join(profile, "config.yaml"),
      "plugins:\n  enabled: []\nmodel: changed-by-owner\n",
    );
    await expect(
      manager.apply(plan.id, plan.actions[0]!.id, true),
    ).rejects.toThrow(/changed|preview/i);
    expect(calls).toEqual([]);
    const next = await manager.preview(registration);
    await manager.apply(next.id, next.actions[0]!.id, true);
    await expect(
      manager.apply(next.id, next.actions[0]!.id, true),
    ).rejects.toThrow(/used|preview/i);
    expect(calls).toEqual([
      [
        profile,
        [
          "plugins",
          "enable",
          "agentintersect-world",
          "--no-allow-tool-override",
        ],
      ],
    ]);
    expect(await readFile(path.join(profile, "config.yaml"), "utf8")).toContain(
      "agentintersect-world",
    );
    expect((await manager.preview(registration)).actions).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
