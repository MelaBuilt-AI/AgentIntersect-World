import {
  APP_METADATA,
  LOCAL_SERVER_DEFAULTS,
  type LocalServerConfig,
  type NetworkScope,
  type SafeConfig,
} from "./index.js";

const INSTANCE_NAME_MAX_LENGTH = 80;
const DEMO_OPERATION_MIN_MS = 50;
const DEMO_OPERATION_MAX_MS = 60_000;
const HOST_PATTERN = /^(?:[a-z0-9.-]+|\[[0-9a-f:]+\]|[0-9a-f:]+)$/i;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

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

  return {
    networkScope,
    host,
    port: integerSetting(environment, "AIW_PORT", 3770, 1, 65_535),
    instanceName,
    demoOperationMaxMs: integerSetting(
      environment,
      "AIW_DEMO_OPERATION_MAX_MS",
      LOCAL_SERVER_DEFAULTS.demoOperationMaxMs,
      DEMO_OPERATION_MIN_MS,
      DEMO_OPERATION_MAX_MS,
    ),
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
  };
}
