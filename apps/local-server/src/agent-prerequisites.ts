import { createHash, randomUUID } from "node:crypto";
import { copyFile, readFile, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { parse } from "yaml";
import type {
  AgentRegistration,
  PrerequisitePlan,
} from "@agentintersect-world/world-schema/agent-setup";
import { currentEnvironment, isLocalEnvironment } from "./agent-environment.js";

const exec = promisify(execFile);
type Pending = {
  registration: AgentRegistration;
  plan: PrerequisitePlan;
  fingerprint: string;
};
// Plans are ephemeral, server-owned and single-use. The browser never supplies argv or paths.
export class AgentPrerequisites {
  readonly pending = new Map<string, Pending>();
  constructor(
    readonly run = async (
      registration: AgentRegistration,
      args: readonly string[],
    ) => {
      await exec(registration.executablePath, [...args], {
        cwd: registration.homePath,
        env: {
          ...process.env,
          HERMES_HOME: registration.identity.profilePath,
          HERMES_PROFILE: registration.identity.id,
        },
        timeout: 15000,
        maxBuffer: 32768,
      });
    },
  ) {}
  async snapshot(
    registration: AgentRegistration,
  ): Promise<{ fingerprint: string; enabled: boolean; installed: boolean }> {
    const profile = registration.identity.profilePath;
    const config = await readFile(path.join(profile, "config.yaml"), "utf8");
    const plugin = await readFile(
      path.join(profile, "plugins", "agentintersect-world", "__init__.py"),
      "utf8",
    ).catch((error) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    const enabled =
      (
        parse(config) as { plugins?: { enabled?: string[] } }
      ).plugins?.enabled?.includes("agentintersect-world") ?? false;
    return {
      fingerprint: createHash("sha256")
        .update(config)
        .update(plugin)
        .digest("hex"),
      enabled,
      installed: !!plugin,
    };
  }
  async preview(registration: AgentRegistration): Promise<PrerequisitePlan> {
    for (const [id, entry] of this.pending)
      if (Date.parse(entry.plan.expiresAt) < Date.now())
        this.pending.delete(id);
    if (this.pending.size >= 50)
      throw new Error(
        "Too many pending previews. Cancel an old plan or wait for expiry.",
      );
    const plan: PrerequisitePlan = {
      id: randomUUID(),
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      target: `${registration.environment.label} · ${registration.identity.label} · ${registration.identity.profilePath}`,
      actions: [],
      guidance: [],
    };
    const nativePath =
      registration.environment.kind === "windows" ? path.win32 : path.posix;
    let fingerprint = "";
    if (registration.adapterId === "hermes") {
      if (
        isLocalEnvironment(registration.environment, await currentEnvironment())
      ) {
        const snapshot = await this.snapshot(registration).catch(() => null);
        fingerprint = snapshot?.fingerprint ?? "";
        if (snapshot?.installed && !snapshot.enabled)
          plan.actions.push({
            id: randomUUID(),
            kind: "enable-hermes-world-plugin",
            title: "Enable the installed World plugin",
            reason:
              "The selected profile must enable its World integration before capability attestation.",
            effect:
              "Runs the native Hermes plugins enable command for this profile only. Preserves a config backup; does not restart the gateway or grant built-in tool override.",
            paths: [
              nativePath.join(registration.identity.profilePath, "config.yaml"),
            ],
          });
        if (!snapshot?.installed)
          plan.guidance.push(
            `Install this checkout's integrations/hermes/agentintersect-world plugin into ${nativePath.join(registration.identity.profilePath, "plugins", "agentintersect-world")} using the documented native integration procedure, then Preview again. This is a manual installation, not an automatic installer.`,
          );
      } else
        plan.guidance.push(
          "Configure the selected profile in its native Windows/WSL environment. Automated plugin enablement is available only when World runs in that same environment.",
        );
      plan.guidance.push(
        "Use the selected profile's native Hermes setup to enable an authenticated API server. Keep its API key in native credential storage. If a gateway restart is needed, inspect the profile/service identity and restart it separately in a native terminal; World will not restart your live assistant.",
      );
    } else if (registration.adapterId === "openclaw")
      plan.guidance.push(
        "Use OpenClaw's native setup for the selected agent and authenticated loopback gateway. Start/restart its identity-checked service separately in a native terminal, then Recheck. World does not change OpenClaw provider settings or restart its service.",
      );
    else
      plan.guidance.push(
        `Open ${registration.adapterId === "codex" ? "Codex" : "Claude Code"} in the selected native environment and complete its native login/setup. Preserve the selected profile. For Windows Codex, complete native sandbox setup; World never bypasses it.`,
      );
    plan.guidance.push(
      "Across Windows/WSL, use a shared drive for the repository and World data directory; install Python 3 natively in the target environment for process supervision. Start a stopped WSL distribution explicitly in a native terminal, then Discover again. No automatic distro start, login, credential copy or sandbox relaxation occurs.",
    );
    this.pending.set(plan.id, { registration, plan, fingerprint });
    return plan;
  }
  cancel(id: string): void {
    this.pending.delete(id);
  }
  async apply(
    id: string,
    actionId: string,
    confirmed: boolean,
  ): Promise<AgentRegistration> {
    if (!confirmed)
      throw new Error("Confirm this specific action before applying it.");
    const entry = this.pending.get(id);
    if (!entry || Date.parse(entry.plan.expiresAt) < Date.now())
      throw new Error("Plan expired or already used. Preview again.");
    const action = entry.plan.actions.find((action) => action.id === actionId);
    if (!action) throw new Error("Action is not part of this preview.");
    this.pending.delete(id); // Consume before any await: retries/double-clicks cannot duplicate writes.
    const snapshot = await this.snapshot(entry.registration);
    if (snapshot.fingerprint !== entry.fingerprint)
      throw new Error(
        "Native configuration or plugin changed. Preview again before approving.",
      );
    const filename = path.join(
      entry.registration.identity.profilePath,
      "config.yaml",
    );
    const backup = `${filename}.aiw-${id}.bak`;
    await copyFile(filename, backup);
    await stat(backup);
    try {
      await this.run(entry.registration, [
        "plugins",
        "enable",
        "agentintersect-world",
        "--no-allow-tool-override",
      ]);
      if (!(await this.snapshot(entry.registration)).enabled)
        throw new Error("Native command did not enable the plugin");
    } catch {
      throw new Error(
        `Plugin enablement did not verify. No ready registration was saved. Inspect native Hermes output and restore ${backup} if required, then Preview again. The gateway was not restarted.`,
      );
    }
    return entry.registration;
  }
}
