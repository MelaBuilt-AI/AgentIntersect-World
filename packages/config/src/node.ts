import {
  APP_METADATA,
  LOCAL_SERVER_DEFAULTS,
  type LocalServerConfig,
  type NetworkScope,
  type SafeConfig,
} from "./index.js";
import { homedir } from "node:os";
import { join } from "node:path";
const INSTANCE_NAME_MAX_LENGTH = 80;
const DEMO_OPERATION_MIN_MS = 50;
const DEMO_OPERATION_MAX_MS = 60_000;
const HOST_PATTERN = /^(?:[a-z0-9.-]+|\[[0-9a-f:]+\]|[0-9a-f:]+)$/i;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const ABSOLUTE_PATH = /^(?:\/|[a-z]:[\\/]|\\\\)/i;
const VISIBLE_ASCII = /^[\x20-\x7e]+$/;

function readUrl(
  value: string | undefined,
  fallback: string,
  key: string,
): string {
  let url: URL;
  try {
    url = new URL(value ?? fallback);
  } catch {
    throw new ConfigurationError(`${key} must be a valid HTTP URL`);
  }
  if (
    !(["http:", "https:"] as string[]).includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new ConfigurationError(
      `${key} must be an HTTP URL without credentials`,
    );
  }
  return url.href.replace(/\/$/, "");
}

export class ConfigurationError extends Error {
  override readonly name = "ConfigurationError";
}

function integerSetting(
  environment: Readonly<Record<string, string | undefined>>,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = environment[key];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) {
    throw new ConfigurationError(
      `${key} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ConfigurationError(
      `${key} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return value;
}

export function loadLocalServerConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): LocalServerConfig {
  const rawScope = environment.AIW_NETWORK_SCOPE ?? "loopback";
  if (rawScope !== "loopback" && rawScope !== "lan") {
    throw new ConfigurationError(
      "AIW_NETWORK_SCOPE must be either loopback or lan",
    );
  }
  const networkScope: NetworkScope = rawScope;
  const port = integerSetting(environment, "AIW_PORT", 3770, 1, 65_535);
  const host = (
    environment.AIW_HOST ??
    (networkScope === "lan" ? "0.0.0.0" : LOCAL_SERVER_DEFAULTS.host)
  ).trim();
  if (
    host.length === 0 ||
    host.length > 255 ||
    !HOST_PATTERN.test(host) ||
    (networkScope === "loopback" && !LOOPBACK_HOSTS.has(host))
  ) {
    throw new ConfigurationError(
      "AIW_HOST must be a loopback host unless AIW_NETWORK_SCOPE=lan",
    );
  }

  const instanceName = (
    environment.AIW_INSTANCE_NAME ?? LOCAL_SERVER_DEFAULTS.instanceName
  ).trim();
  if (
    instanceName.length === 0 ||
    instanceName.length > INSTANCE_NAME_MAX_LENGTH
  ) {
    throw new ConfigurationError(
      `AIW_INSTANCE_NAME must contain 1..${INSTANCE_NAME_MAX_LENGTH} characters`,
    );
  }

  const enabled = environment.AIW_AGENTINTERSECT_ENABLED === "true";
  if (
    environment.AIW_AGENTINTERSECT_ENABLED !== undefined &&
    !["true", "false"].includes(environment.AIW_AGENTINTERSECT_ENABLED)
  ) {
    throw new ConfigurationError(
      "AIW_AGENTINTERSECT_ENABLED must be true or false",
    );
  }
  const workspace = environment.AIW_AGENTINTERSECT_EXPECTED_WORKSPACE?.trim();
  const dataDir = environment.AIW_AGENTINTERSECT_DATA_DIR?.trim();
  if (enabled && !workspace)
    throw new ConfigurationError(
      "AIW_AGENTINTERSECT_EXPECTED_WORKSPACE is required when read integration is enabled",
    );
  if (enabled && !dataDir)
    throw new ConfigurationError(
      "AIW_AGENTINTERSECT_DATA_DIR is required when read integration is enabled",
    );
  if (
    enabled &&
    (!ABSOLUTE_PATH.test(workspace as string) ||
      !ABSOLUTE_PATH.test(dataDir as string))
  ) {
    throw new ConfigurationError(
      "AIW_AGENTINTERSECT_EXPECTED_WORKSPACE and AIW_AGENTINTERSECT_DATA_DIR must be absolute paths",
    );
  }

  const commandsEnabled =
    environment.AIW_AGENTINTERSECT_COMMANDS_ENABLED === "true";
  if (
    environment.AIW_AGENTINTERSECT_COMMANDS_ENABLED !== undefined &&
    !["true", "false"].includes(environment.AIW_AGENTINTERSECT_COMMANDS_ENABLED)
  ) {
    throw new ConfigurationError(
      "AIW_AGENTINTERSECT_COMMANDS_ENABLED must be true or false",
    );
  }
  const commandToken = environment.AIW_AGENTINTERSECT_COMMAND_TOKEN;
  const expectedPhaseId =
    environment.AIW_AGENTINTERSECT_EXPECTED_PHASE_ID?.trim();
  const expectedRevision =
    environment.AIW_AGENTINTERSECT_EXPECTED_REVISION?.trim();
  if (commandsEnabled && !enabled) {
    throw new ConfigurationError(
      "AgentIntersect commands require read integration to be enabled",
    );
  }
  if (
    commandsEnabled &&
    (!commandToken ||
      commandToken.length > 256 ||
      !VISIBLE_ASCII.test(commandToken))
  ) {
    throw new ConfigurationError(
      "AIW_AGENTINTERSECT_COMMAND_TOKEN must contain 1..256 visible ASCII characters",
    );
  }
  for (const [key, value] of [
    ["AIW_AGENTINTERSECT_EXPECTED_PHASE_ID", expectedPhaseId],
    ["AIW_AGENTINTERSECT_EXPECTED_REVISION", expectedRevision],
  ] as const) {
    if (
      commandsEnabled &&
      (!value || value.length > 128 || !VISIBLE_ASCII.test(value))
    ) {
      throw new ConfigurationError(
        `${key} must contain 1..128 visible ASCII characters`,
      );
    }
  }

  const defaultOrigin = "http://127.0.0.1:5173";
  const allowedOrigin = (
    environment.AIW_PRESENTATION_ALLOWED_ORIGIN ??
    (networkScope === "loopback" ? defaultOrigin : "")
  ).trim();
  const allowedHost = (
    environment.AIW_PRESENTATION_ALLOWED_HOST ??
    (networkScope === "loopback" ? "127.0.0.1:5173" : "")
  ).trim();
  const presentationToken = environment.AIW_PRESENTATION_TOKEN;
  const presentationDataDir = (
    environment.AIW_PRESENTATION_DATA_DIR ??
    join(homedir(), ".local", "state", "agentintersect-world", "presentation")
  ).trim();
  let origin: URL;
  try {
    origin = new URL(allowedOrigin);
  } catch {
    throw new ConfigurationError(
      "AIW_PRESENTATION_ALLOWED_ORIGIN must be one exact HTTP(S) origin",
    );
  }
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    origin.origin !== allowedOrigin
  ) {
    throw new ConfigurationError(
      "AIW_PRESENTATION_ALLOWED_ORIGIN must be one exact HTTP(S) origin",
    );
  }
  if (
    allowedHost.length === 0 ||
    allowedHost.length > 300 ||
    /[\s/@?#]/.test(allowedHost)
  ) {
    throw new ConfigurationError(
      "AIW_PRESENTATION_ALLOWED_HOST must be one exact host and port",
    );
  }
  if (!ABSOLUTE_PATH.test(presentationDataDir)) {
    throw new ConfigurationError(
      "AIW_PRESENTATION_DATA_DIR must be an absolute path",
    );
  }
  if (
    presentationToken !== undefined &&
    (presentationToken.length === 0 ||
      presentationToken.length > 256 ||
      !VISIBLE_ASCII.test(presentationToken))
  ) {
    throw new ConfigurationError(
      "AIW_PRESENTATION_TOKEN must contain 1..256 visible ASCII characters",
    );
  }
  if (
    networkScope === "lan" &&
    (!environment.AIW_PRESENTATION_ALLOWED_ORIGIN ||
      !environment.AIW_PRESENTATION_ALLOWED_HOST ||
      !presentationToken)
  ) {
    throw new ConfigurationError(
      "LAN presentation requires AIW_PRESENTATION_ALLOWED_ORIGIN, AIW_PRESENTATION_ALLOWED_HOST, and AIW_PRESENTATION_TOKEN",
    );
  }
  if (presentationToken && commandToken && presentationToken === commandToken) {
    throw new ConfigurationError(
      "Presentation and command authority require separate bearer tokens",
    );
  }

  const agentSessionsEnabled =
    environment.AIW_AGENT_SESSIONS_ENABLED === "true";
  if (
    environment.AIW_AGENT_SESSIONS_ENABLED !== undefined &&
    !["true", "false"].includes(environment.AIW_AGENT_SESSIONS_ENABLED)
  )
    throw new ConfigurationError(
      "AIW_AGENT_SESSIONS_ENABLED must be true or false",
    );
  const hermesApiKey = environment.AIW_HERMES_API_KEY;
  const hermesProfile = (environment.AIW_HERMES_PROFILE ?? "default").trim();
  const agentSessionDataDir = (
    environment.AIW_AGENT_SESSION_DATA_DIR ??
    join(homedir(), ".local", "state", "agentintersect-world", "agent-sessions")
  ).trim();
  const pluginAvatarProposalPath =
    environment.AIW_HERMES_PLUGIN_AVATAR_PROPOSAL_PATH?.trim();
  const pluginCapabilityPath =
    environment.AIW_HERMES_PLUGIN_CAPABILITY_PATH?.trim();
  const pinnedSessionRef = environment.AIW_HERMES_NATIVE_SESSION_REF?.trim();
  const agentDisplayName =
    environment.AIW_HERMES_AGENT_DISPLAY_NAME?.normalize("NFC").trim();
  const designRepositoryRoot =
    environment.AIW_GUIDED_BUILD_REPOSITORY_ROOT?.trim();
  if (
    agentSessionsEnabled &&
    (!hermesApiKey ||
      hermesApiKey.length > 256 ||
      !VISIBLE_ASCII.test(hermesApiKey))
  )
    throw new ConfigurationError(
      "AIW_HERMES_API_KEY must contain 1..256 visible ASCII characters",
    );
  if (
    agentSessionsEnabled &&
    (hermesProfile.length === 0 ||
      hermesProfile.length > 64 ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(hermesProfile))
  )
    throw new ConfigurationError("AIW_HERMES_PROFILE is invalid");
  if (
    agentSessionsEnabled &&
    ((pinnedSessionRef === undefined) !== (agentDisplayName === undefined) ||
      (pinnedSessionRef !== undefined &&
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(pinnedSessionRef)) ||
      (agentDisplayName !== undefined &&
        (agentDisplayName.length === 0 ||
          agentDisplayName.length > 80 ||
          [...agentDisplayName].some((character) => {
            const code = character.codePointAt(0) ?? 0;
            return code < 32 || code === 127;
          }))))
  )
    throw new ConfigurationError(
      "AIW_HERMES_NATIVE_SESSION_REF and AIW_HERMES_AGENT_DISPLAY_NAME must be valid and configured together",
    );
  for (const [key, value] of [
    ["AIW_AGENT_SESSION_DATA_DIR", agentSessionDataDir],
    ["AIW_HERMES_PLUGIN_CAPABILITY_PATH", pluginCapabilityPath],
    ["AIW_HERMES_PLUGIN_AVATAR_PROPOSAL_PATH", pluginAvatarProposalPath],
    ["AIW_GUIDED_BUILD_REPOSITORY_ROOT", designRepositoryRoot],
  ] as const) {
    if (value && !ABSOLUTE_PATH.test(value))
      throw new ConfigurationError(`${key} must be an absolute path`);
  }
  const hermesApiUrl = readUrl(
    environment.AIW_HERMES_API_URL,
    "http://127.0.0.1:8642",
    "AIW_HERMES_API_URL",
  );
  if (agentSessionsEnabled) {
    const url = new URL(hermesApiUrl);
    if (url.protocol !== "http:" || !LOOPBACK_HOSTS.has(url.hostname))
      throw new ConfigurationError("AIW_HERMES_API_URL must be loopback HTTP");
  }

  return {
    networkScope,
    host,
    port,
    instanceName,
    demoOperationMaxMs: integerSetting(
      environment,
      "AIW_DEMO_OPERATION_MAX_MS",
      LOCAL_SERVER_DEFAULTS.demoOperationMaxMs,
      DEMO_OPERATION_MIN_MS,
      DEMO_OPERATION_MAX_MS,
    ),
    repositoryMaxFiles: integerSetting(
      environment,
      "AIW_REPOSITORY_MAX_FILES",
      LOCAL_SERVER_DEFAULTS.repositoryMaxFiles,
      1,
      10_000,
    ),
    ...(enabled
      ? {
          agentIntersectRead: {
            daemonUrl: readUrl(
              environment.AIW_AGENTINTERSECT_DAEMON_URL,
              "http://127.0.0.1:3761",
              "AIW_AGENTINTERSECT_DAEMON_URL",
            ),
            dashboardUrl: readUrl(
              environment.AIW_AGENTINTERSECT_DASHBOARD_URL,
              "http://127.0.0.1:3762",
              "AIW_AGENTINTERSECT_DASHBOARD_URL",
            ),
            expectedWorkspace: workspace as string,
            dataDir: dataDir as string,
            staleAfterMs: integerSetting(
              environment,
              "AIW_AGENTINTERSECT_STALE_AFTER_MS",
              15_000,
              1_000,
              300_000,
            ),
            maxQueuedFrames: integerSetting(
              environment,
              "AIW_AGENTINTERSECT_MAX_QUEUED_FRAMES",
              32,
              1,
              512,
            ),
          },
        }
      : {}),
    ...(commandsEnabled
      ? {
          agentIntersectCommands: {
            token: commandToken as string,
            expectedPhaseId: expectedPhaseId as string,
            expectedRevision: expectedRevision as string,
          },
        }
      : {}),
    ...(agentSessionsEnabled
      ? {
          agentSessions: {
            hermesApiUrl,
            hermesApiKey: hermesApiKey as string,
            hermesProfile,
            dataDir: agentSessionDataDir,
            ...(pluginCapabilityPath ? { pluginCapabilityPath } : {}),
            ...(pluginAvatarProposalPath ? { pluginAvatarProposalPath } : {}),
            ...(pinnedSessionRef
              ? {
                  pinnedSessionRef,
                  agentDisplayName: agentDisplayName as string,
                }
              : {}),
            ...(designRepositoryRoot ? { designRepositoryRoot } : {}),
          },
        }
      : {}),
    presentationSync: {
      dataDir: presentationDataDir,
      allowedOrigin,
      allowedHost,
      ...(presentationToken ? { bearerToken: presentationToken } : {}),
    },
  };
}

export function toSafeConfig(config: LocalServerConfig): SafeConfig {
  return {
    phase: APP_METADATA.phase,
    version: APP_METADATA.version,
    instanceName: config.instanceName,
    networkScope: config.networkScope,
    host: config.host,
    port: config.port,
    demoOperationMaxMs: config.demoOperationMaxMs,
    repositoryMaxFiles: config.repositoryMaxFiles,
    agentIntersectReadEnabled: config.agentIntersectRead !== undefined,
    agentIntersectCommandsEnabled:
      config.agentIntersectCommands !== undefined &&
      config.agentIntersectRead !== undefined,
    agentSessionsEnabled: config.agentSessions !== undefined,
    presentationSync: {
      enabled: true,
      transport: config.presentationSync.allowedOrigin.startsWith("https:")
        ? "wss/https"
        : "ws/http",
      encrypted: config.presentationSync.allowedOrigin.startsWith("https:"),
      unencryptedLanWarning:
        config.networkScope === "lan" &&
        !config.presentationSync.allowedOrigin.startsWith("https:"),
      allowedOrigin: config.presentationSync.allowedOrigin,
      allowedHost: config.presentationSync.allowedHost,
    },
  };
}
