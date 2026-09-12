import { execFile } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseEnv, promisify } from "node:util";
import { parse as parseYaml } from "yaml";
import type { LocalServerConfig } from "@agentintersect-world/config";
import type {
  AgentRegistration,
  SetupCheck,
} from "@agentintersect-world/world-schema/agent-setup";
import {
  AdapterRegistry,
  HermesSessionAdapter,
  type AgentAdapter,
} from "./agent-sessions.js";
import { CodexSessionAdapter } from "./codex-session-adapter.js";
import { ClaudeCodeSessionAdapter } from "./claude-code-session-adapter.js";
import {
  OpenClawSessionAdapter,
  resolveOpenClawCredential,
} from "./openclaw-session-adapter.js";

const exec = promisify(execFile);
export function createAgentSetupRuntime(options: {
  readonly registry: AdapterRegistry;
  readonly dataDirectory: string;
  readonly legacy?: LocalServerConfig["agentSessions"];
}) {
  const adapters = new Map<string, AgentAdapter>();
  async function adapterFor(
    registration: AgentRegistration,
  ): Promise<AgentAdapter> {
    const cached = adapters.get(registration.id);
    if (cached) return cached;
    const { environment, identity, adapterId, executablePath, homePath } =
      registration;
    const local =
      environment.kind === "windows"
        ? process.platform === "win32"
        : environment.kind === "wsl"
          ? environment.id === "local" ||
            (process.env.WSL_DISTRO_NAME ??
              (await exec("wslpath", ["-w", "/"], { timeout: 3000 })).stdout
                .trim()
                .split("\\")[3]) === environment.distro
          : process.platform ===
            (environment.kind === "macos" ? "darwin" : "linux");
    if (!local)
      throw new Error(
        `This installation is in ${environment.label}. Run the World local server in that environment so its native workspace and credentials are accessible, then Discover Agents again. Cross-environment execution is not yet available.`,
      );
    const nativeSessionRoot = path.join(
      options.dataDirectory,
      "native-connections",
      registration.id,
    );
    await mkdir(nativeSessionRoot, { recursive: true, mode: 0o700 });
    let adapter: AgentAdapter;
    if (adapterId === "codex")
      adapter = new CodexSessionAdapter({
        executablePath,
        nativeSessionRoot,
        nativeProfilePath: identity.profilePath,
        profileName: identity.id,
      });
    else if (adapterId === "claude-code")
      adapter = new ClaudeCodeSessionAdapter({
        executablePath,
        nativeSessionRoot,
        nativeProfilePath: identity.profilePath,
        nativeHomePath: homePath,
        ...(identity.kind === "agent" ? { agentName: identity.id } : {}),
      });
    else if (adapterId === "hermes") {
      const legacy = options.legacy;
      if (legacy?.hermesApiKey && legacy.hermesProfile === identity.id)
        adapter = new HermesSessionAdapter({
          baseUrl: legacy.hermesApiUrl,
          apiKey: legacy.hermesApiKey,
          profile: identity.id,
          worldOwnedDirectory: nativeSessionRoot,
          ...(legacy.pluginCapabilityPath
            ? { pluginCapabilityPath: legacy.pluginCapabilityPath }
            : {}),
        });
      else {
        type ApiSettings = { port?: number; enabled?: boolean; key?: string };
        const config = parseYaml(
          await readFile(
            path.join(identity.profilePath, "config.yaml"),
            "utf8",
          ),
        ) as {
          gateway?: {
            api_server?: ApiSettings;
            platforms?: { api_server?: ApiSettings };
          };
          platforms?: { api_server?: ApiSettings };
        };
        const env = parseEnv(
          await readFile(path.join(identity.profilePath, ".env"), "utf8"),
        );
        const settings =
          config.gateway?.api_server ??
          config.gateway?.platforms?.api_server ??
          config.platforms?.api_server;
        const key = env.API_SERVER_KEY ?? settings?.key;
        if (!key)
          throw new Error(
            "Enable the selected Hermes profile's authenticated API server in Hermes, then Recheck. World will not change or restart that profile automatically.",
          );
        adapter = new HermesSessionAdapter({
          baseUrl: `http://127.0.0.1:${env.API_SERVER_PORT ?? settings?.port ?? 8642}`,
          apiKey: key,
          profile: identity.id,
          worldOwnedDirectory: nativeSessionRoot,
          pluginCapabilityPath: path.join(
            identity.profilePath,
            "agentintersect-world",
            "capabilities.json",
          ),
        });
      }
    } else {
      const config = JSON.parse(
        await readFile(
          path.join(identity.profilePath, "openclaw.json"),
          "utf8",
        ),
      ) as { gateway?: { port?: number; auth?: { token?: string } } };
      const legacy = options.legacy?.openclaw;
      const credential = legacy
        ? () => resolveOpenClawCredential(legacy.credentialRef)
        : () => {
            if (!config.gateway?.auth?.token)
              throw new Error(
                "OpenClaw gateway authentication is not configured. Sign in/configure it in OpenClaw, then Recheck.",
              );
            return config.gateway.auth.token;
          };
      adapter = new OpenClawSessionAdapter({
        gatewayUrl:
          legacy?.gatewayUrl ??
          `http://127.0.0.1:${config.gateway?.port ?? 18789}`,
        credential,
        agentId: identity.id,
        nativeSessionRoot,
      });
    }
    adapters.set(registration.id, adapter);
    return adapter;
  }
  return {
    async restore(registrations: readonly AgentRegistration[]) {
      for (const registration of registrations) {
        try {
          options.registry.registerConnection(
            registration.id,
            await adapterFor(registration),
          );
        } catch {
          /* Keep the saved row; Recheck reports the actionable prerequisite. */
        }
      }
    },
    async check(registration: AgentRegistration): Promise<SetupCheck> {
      try {
        const adapter = await adapterFor(registration);
        const capability = await adapter.attest();
        if (
          !capability.capabilities.attach ||
          !capability.capabilities.sendText
        )
          throw new Error(
            "Required native attach/text capabilities are unavailable. Enable the World integration in the native harness, then Recheck.",
          );
        if (registration.adapterId === "codex") {
          try {
            await exec(registration.executablePath, ["login", "status"], {
              cwd: registration.homePath,
              env: {
                ...process.env,
                CODEX_HOME: registration.identity.profilePath,
              },
              timeout: 10000,
              maxBuffer: 32768,
            });
          } catch {
            throw new Error(
              "Codex authentication is unavailable. Sign in with the selected native Codex profile, then Recheck.",
            );
          }
        }
        options.registry.registerConnection(registration.id, adapter);
        return {
          status: "ready",
          message:
            "Native connection ready. Required capabilities checked; the model is not called until you select this agent for a World.",
        };
      } catch (error) {
        // Native process/config output may contain credentials: never forward it.
        const message =
          error instanceof Error &&
          !("stdout" in error) &&
          !("path" in error) &&
          !(error instanceof SyntaxError)
            ? error.message
            : "Native configuration or executable is unavailable. Open the selected harness, complete its setup/sign-in, then Recheck.";
        return { status: "needs-attention", message };
      }
    },
  };
}
