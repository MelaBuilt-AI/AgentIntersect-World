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

import {
  createEnvironmentExecution,
  currentEnvironment,
  mapEnvironmentPath,
  assertNativeWorkspacePath,
} from "./agent-environment.js";

const exec = promisify(execFile);
export function createAgentSetupRuntime(options: {
  readonly registry: AdapterRegistry;
  readonly dataDirectory: string;
  readonly legacy?: LocalServerConfig["agentSessions"];
}) {
  const adapters = new Map<string, AgentAdapter>();
  async function adapterFor(
    registration: AgentRegistration,
    cache = true,
  ): Promise<AgentAdapter> {
    const cached = cache ? adapters.get(registration.id) : undefined;
    if (cached) return cached;
    const { environment, identity, adapterId, executablePath, homePath } =
      registration;
    const execution = await createEnvironmentExecution(registration);
    const nativePath = environment.kind === "windows" ? path.win32 : path.posix;
    const readNative = (filename: string) =>
      execution
        ? execution.readNativeFile(filename)
        : readFile(filename, "utf8");
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
        ...(execution ? { environmentExecution: execution } : {}),
        nativeSessionRoot,
        nativeProfilePath: identity.profilePath,
        profileName: identity.id,
      });
    else if (adapterId === "claude-code")
      adapter = new ClaudeCodeSessionAdapter({
        executablePath,
        ...(execution ? { environmentExecution: execution } : {}),
        nativeSessionRoot,
        nativeProfilePath: identity.profilePath,
        nativeHomePath: homePath,
        ...(identity.kind === "agent" ? { agentName: identity.id } : {}),
      });
    else if (adapterId === "hermes") {
      const legacy = options.legacy;
      if (
        !execution &&
        legacy?.hermesApiKey &&
        legacy.hermesProfile === identity.id
      )
        adapter = new HermesSessionAdapter({
          baseUrl: legacy.hermesApiUrl,
          apiKey: legacy.hermesApiKey,
          profile: identity.id,
          ...(registration.conversationRef
            ? {
                pinnedSessionRef: registration.conversationRef,
                agentDisplayName: registration.displayName,
              }
            : {}),
          worldOwnedDirectory: nativeSessionRoot,
          ...(legacy.pluginCapabilityPath
            ? { pluginCapabilityPath: legacy.pluginCapabilityPath }
            : {}),
        });
      else {
        type ApiSettings = { port?: number; enabled?: boolean; key?: string };
        const config = parseYaml(
          await readNative(
            nativePath.join(identity.profilePath, "config.yaml"),
          ),
        ) as {
          gateway?: {
            api_server?: ApiSettings;
            platforms?: { api_server?: ApiSettings };
          };
          platforms?: { api_server?: ApiSettings };
        };
        const env = parseEnv(
          await readNative(nativePath.join(identity.profilePath, ".env")),
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
          ...(registration.conversationRef
            ? {
                pinnedSessionRef: registration.conversationRef,
                agentDisplayName: registration.displayName,
              }
            : {}),
          worldOwnedDirectory: nativeSessionRoot,
          ...(execution
            ? {
                pluginCapabilityReader: async () =>
                  JSON.parse(
                    await execution.pythonCommand(
                      "import os,sys,json,stat; p=sys.argv[1]; s=os.lstat(p); assert s.st_size<=4096; print(json.dumps(dict(content=open(p).read(),mode=s.st_mode,size=s.st_size,isFile=stat.S_ISREG(s.st_mode),isSymbolicLink=stat.S_ISLNK(s.st_mode))))",
                      [
                        nativePath.join(
                          identity.profilePath,
                          "agentintersect-world",
                          "capabilities.json",
                        ),
                      ],
                    ),
                  ),
              }
            : {
                pluginCapabilityPath: path.join(
                  identity.profilePath,
                  "agentintersect-world",
                  "capabilities.json",
                ),
              }),
        });
      }
    } else {
      const config = JSON.parse(
        await readNative(
          nativePath.join(identity.profilePath, "openclaw.json"),
        ),
      ) as { gateway?: { port?: number; auth?: { token?: string } } };
      const legacy = execution ? undefined : options.legacy?.openclaw;
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
    const host = execution?.host ?? (await currentEnvironment());
    // Every registered harness (HTTP or CLI) uses the same native path contract.
    Object.assign(adapter, {
      workspace: execution ?? {
        mapPath: (value: string) =>
          mapEnvironmentPath(value, environment, host),
        verifyWorkspace: async (directory: string) => {
          assertNativeWorkspacePath(
            registration,
            mapEnvironmentPath(directory, environment, host),
          );
        },
      },
    });
    if (cache) adapters.set(registration.id, adapter);
    return adapter;
  }
  return {
    async listConversations(registration: AgentRegistration) {
      const { conversationRef: _selection, ...identity } = registration;
      void _selection;
      const adapter = await adapterFor(identity, false);
      return adapter.listSessions();
    },
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
            const execution = await createEnvironmentExecution(registration);
            if (execution) {
              const output = await execution.pythonCommand(
                "import subprocess,os,sys; e=os.environ.copy(); e['CODEX_HOME']=sys.argv[2]; p=subprocess.run([sys.argv[1],'login','status'],env=e,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=8); sys.exit(p.returncode)",
                [
                  registration.executablePath,
                  registration.identity.profilePath,
                ],
              );
              void output;
            } else
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
