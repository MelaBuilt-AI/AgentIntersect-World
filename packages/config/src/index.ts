export const APP_METADATA = {
  name: "AgentIntersect World",
  phase: "Phase 2",
  version: "0.2.0-phase2",
} as const;

export const LOCAL_SERVER_DEFAULTS = {
  networkScope: "loopback",
  host: "127.0.0.1",
  port: 3770,
  instanceName: "AgentIntersect World Local",
  demoOperationMaxMs: 5_000,
  healthPath: "/health",
} as const;

export const WEB_HEALTH_PATH = "/api/health";
export const WEB_API_BASE_PATH = "/api";

export type NetworkScope = "loopback" | "lan";

export type LocalServerConfig = {
  readonly networkScope: NetworkScope;
  readonly host: string;
  readonly port: number;
  readonly instanceName: string;
  readonly demoOperationMaxMs: number;
};

export type SafeConfig = LocalServerConfig & {
  readonly phase: typeof APP_METADATA.phase;
  readonly version: typeof APP_METADATA.version;
};
