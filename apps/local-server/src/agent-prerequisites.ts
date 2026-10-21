import { createHash, randomUUID, randomBytes } from "node:crypto";
import { copyFile, readFile, stat, mkdir, chmod } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify, parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { constants } from "node:fs";
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
  async snapshot(registration: AgentRegistration) {
    const profile = registration.identity.profilePath;
    const optional = (filename: string) =>
      readFile(filename, "utf8").catch((error) => {
        if (error.code === "ENOENT") return "";
        throw error;
      });
    const config = await readFile(path.join(profile, "config.yaml"), "utf8");
    const directory = path.join(profile, "plugins", "agentintersect-world");
    const plugin = await optional(path.join(directory, "__init__.py"));
    const manifest = await optional(path.join(directory, "plugin.yaml"));
    const envText = await optional(path.join(profile, ".env"));
    const env = parseEnv(envText);
    const enabled =
      (
        parse(config) as { plugins?: { enabled?: string[] } }
      )?.plugins?.enabled?.includes("agentintersect-world") ?? false;
    const directoryExists = await stat(directory)
      .then(() => true)
      .catch((error) => {
        if (error.code === "ENOENT") return false;
        throw error;
      });
    return {
      fingerprint: createHash("sha256")
        .update(
          JSON.stringify([config, plugin, manifest, envText, directoryExists]),
        )
        .digest("hex"),
      enabled,
      installed: !!plugin && !!manifest,
      directoryExists,
      apiConfigured:
        env.API_SERVER_ENABLED === "true" &&
        (env.API_SERVER_KEY?.length ?? 0) >= 32 &&
        env.API_SERVER_HOST === "127.0.0.1",
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
        if (snapshot && !snapshot.directoryExists)
          plan.actions.push({
            id: randomUUID(),
            kind: "install-hermes-world-plugin",
            title: "Install the bundled World plugin",
            reason:
              "This profile does not have the World integration installed.",
            effect:
              "Copies the plugin shipped with this application into the selected profile. Does not overwrite an existing plugin, enable it, or restart Hermes. Preview again afterward to enable it.",
            paths: [
              nativePath.join(
                registration.identity.profilePath,
                "plugins",
                "agentintersect-world",
              ),
            ],
          });
        else if (!snapshot?.installed)
          plan.guidance.push(
            "The profile is unreadable or its existing World plugin is incomplete. Inspect it in the native environment; World will not overwrite existing plugin files.",
          );
        if (snapshot && !snapshot.apiConfigured)
          plan.actions.push({
            id: randomUUID(),
            kind: "configure-hermes-api",
            title: "Set up authenticated local API (replace API key)",
            reason:
              "Configure or repair the API used by World. This is optional if your native API settings already work.",
            effect:
              "Backs up config.yaml and any .env, replaces the API key with a new random secret, enables the API on 127.0.0.1, and preserves the port. Existing API clients need the new key. No provider change or gateway restart. The secret is never shown in World.",
            paths: [
              nativePath.join(registration.identity.profilePath, "config.yaml"),
              nativePath.join(registration.identity.profilePath, ".env"),
            ],
          });
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
    const profile = entry.registration.identity.profilePath;
    if (action.kind === "install-hermes-world-plugin") {
      const source = fileURLToPath(
        new URL(
          "../../../integrations/hermes/agentintersect-world/",
          import.meta.url,
        ),
      );
      const files = ["__init__.py", "plugin.yaml"];
      for (const name of files) await readFile(path.join(source, name));
      const parent = path.join(profile, "plugins");
      const destination = path.join(parent, "agentintersect-world");
      await mkdir(parent, { recursive: true });
      await mkdir(destination); // Exclusive: never overwrite even a partial installation.
      for (const name of files) {
        await copyFile(
          path.join(source, name),
          path.join(destination, name),
          constants.COPYFILE_EXCL,
        );
        if (
          !(await readFile(path.join(source, name))).equals(
            await readFile(path.join(destination, name)),
          )
        )
          throw new Error(
            "Installed plugin verification failed. Inspect the profile before retrying.",
          );
      }
      return entry.registration;
    }
    const filename = path.join(profile, "config.yaml");
    const backup = `${filename}.aiw-${id}.bak`;
    await copyFile(filename, backup, constants.COPYFILE_EXCL);
    await chmod(backup, 0o600);
    if (action.kind === "configure-hermes-api") {
      const envFile = path.join(profile, ".env");
      const envBackup = `${envFile}.aiw-${id}.bak`;
      try {
        await copyFile(envFile, envBackup, constants.COPYFILE_EXCL);
        await chmod(envBackup, 0o600);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const key = randomBytes(32).toString("hex");
      try {
        for (const [setting, value] of [
          ["API_SERVER_KEY", key],
          ["API_SERVER_HOST", "127.0.0.1"],
          ["API_SERVER_ENABLED", "true"],
        ])
          await this.run(entry.registration, [
            "config",
            "set",
            setting!,
            value!,
          ]);
        const saved = parseEnv(await readFile(envFile, "utf8"));
        if (
          saved.API_SERVER_KEY !== key ||
          saved.API_SERVER_HOST !== "127.0.0.1" ||
          saved.API_SERVER_ENABLED !== "true"
        )
          throw new Error("API settings readback failed");
        await chmod(envFile, 0o600);
      } catch {
        throw new Error(
          `API setup did not verify. Inspect this profile and its .aiw-${id}.bak backups before retrying. No gateway was restarted; no ready registration was saved.`,
        );
      }
      return entry.registration;
    }
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
