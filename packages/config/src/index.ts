export const APP_METADATA = {
  name: "AgentIntersect World",
  phase: "Phase 1",
  version: "0.1.0-phase1",
} as const;

export const LOCAL_SERVER_DEFAULTS = {
  host: "127.0.0.1",
  port: 3770,
  healthPath: "/health",
} as const;

export const WEB_HEALTH_PATH = "/api/health";
