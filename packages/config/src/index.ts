export const APP_METADATA = {
  name: "AgentIntersect World",
  phase: "Phase 6",
  version: "0.6.0-phase6",
} as const;

export const LOCAL_SERVER_DEFAULTS = {
  networkScope: "loopback",
  host: "127.0.0.1",
  port: 3770,
  instanceName: "AgentIntersect World Local",
  demoOperationMaxMs: 5_000,
  repositoryMaxFiles: 2_500,
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
  readonly repositoryMaxFiles: number;
  readonly agentIntersectRead?: {
    readonly daemonUrl: string;
    readonly dashboardUrl: string;
    readonly expectedWorkspace: string;
    readonly dataDir: string;
    readonly staleAfterMs: number;
    readonly maxQueuedFrames: number;
  };
};

export type SafeConfig = LocalServerConfig & {
  readonly phase: typeof APP_METADATA.phase;
  readonly version: typeof APP_METADATA.version;
  readonly agentIntersectReadEnabled: boolean;
};
