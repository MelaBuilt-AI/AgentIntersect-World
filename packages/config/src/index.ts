export const APP_METADATA = {
  name: "AgentIntersect World",
  phase: "Phase 9",
  version: "0.9.0-phase9",
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
  readonly agentIntersectCommands?: {
    readonly token: string;
    readonly expectedPhaseId: string;
    readonly expectedRevision: string;
  };
  readonly presentationSync: {
    readonly dataDir: string;
    readonly allowedOrigin: string;
    readonly allowedHost: string;
    readonly bearerToken?: string;
  };
};

export type SafeConfig = Omit<
  LocalServerConfig,
  "agentIntersectRead" | "agentIntersectCommands" | "presentationSync"
> & {
  readonly phase: typeof APP_METADATA.phase;
  readonly version: typeof APP_METADATA.version;
  readonly agentIntersectReadEnabled: boolean;
  readonly agentIntersectCommandsEnabled: boolean;
  readonly presentationSync: {
    readonly enabled: true;
    readonly transport: "ws/http" | "wss/https";
    readonly encrypted: boolean;
    readonly unencryptedLanWarning: boolean;
    readonly allowedOrigin: string;
    readonly allowedHost: string;
  };
};
