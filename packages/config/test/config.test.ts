import { describe, expect, it } from "vitest";

describe("Phase 7 local-server configuration", () => {
  it("loads loopback defaults and exposes only the safe configuration view", async () => {
    const { loadLocalServerConfig, toSafeConfig } =
      await import("../src/node.js");
    const config = loadLocalServerConfig({});

    expect(config).toMatchObject({
      networkScope: "loopback",
      host: "127.0.0.1",
      port: 3770,
      instanceName: "AgentIntersect World Local",
    });
    expect(toSafeConfig(config)).toEqual({
      phase: "Phase 14",
      version: "0.14.0-phase14",
      instanceName: "AgentIntersect World Local",
      networkScope: "loopback",
      host: "127.0.0.1",
      port: 3770,
      demoOperationMaxMs: expect.any(Number),
      repositoryMaxFiles: 2_500,
      agentIntersectReadEnabled: false,
      agentIntersectCommandsEnabled: false,
      agentSessionsEnabled: false,
      agentAdapters: {
        hermes: { configured: false, reason: "not-configured" },
        openclaw: { configured: false, reason: "not-configured" },
        codex: { configured: false, reason: "not-configured" },
        "claude-code": { configured: false, reason: "not-configured" },
      },
      presentationSync: {
        enabled: true,
        transport: "ws/http",
        encrypted: false,
        unencryptedLanWarning: false,
        allowedOrigin: "http://127.0.0.1:5173",
        allowedHost: "127.0.0.1:5173",
      },
    });
  });

  it("accepts complete adapter configuration without changing Hermes fields", async () => {
    const { loadLocalServerConfig, toSafeConfig } =
      await import("../src/node.js");
    const config = loadLocalServerConfig({
      AIW_AGENT_SESSIONS_ENABLED: "true",
      AIW_HERMES_API_KEY: "hermes-canary-secret",
      AIW_AGENT_SESSION_DATA_DIR: "/tmp/shared-agent-sessions",
      AIW_OPENCLAW_ENABLED: "true",
      AIW_OPENCLAW_GATEWAY_URL: "https://localhost:18789/v1/gateway",
      AIW_OPENCLAW_CREDENTIAL_REF: "env:OPENCLAW_CANARY_CREDENTIAL",
      AIW_CODEX_ENABLED: "true",
      AIW_CODEX_EXECUTABLE_PATH: "/opt/codex-canary/bin/codex",
      AIW_CODEX_NATIVE_SESSION_ROOT: "/tmp/codex-canary-sessions",
      AIW_CLAUDE_CODE_ENABLED: "true",
      AIW_CLAUDE_CODE_EXECUTABLE_PATH: "/opt/claude-canary/bin/claude",
      AIW_CLAUDE_CODE_NATIVE_SESSION_ROOT: "/tmp/claude-canary-sessions",
    });

    expect(config.agentSessions).toMatchObject({
      hermesApiUrl: "http://127.0.0.1:8642",
      hermesApiKey: "hermes-canary-secret",
      hermesProfile: "default",
      dataDir: "/tmp/shared-agent-sessions",
      openclaw: {
        gatewayUrl: "https://localhost:18789/v1/gateway",
        credentialRef: "env:OPENCLAW_CANARY_CREDENTIAL",
      },
      codex: {
        executablePath: "/opt/codex-canary/bin/codex",
        nativeSessionRoot: "/tmp/codex-canary-sessions",
      },
      claudeCode: {
        executablePath: "/opt/claude-canary/bin/claude",
        nativeSessionRoot: "/tmp/claude-canary-sessions",
      },
    });
    const safe = toSafeConfig(config);
    expect(safe.agentSessionsEnabled).toBe(true);
    expect(safe.agentAdapters).toEqual({
      hermes: { configured: true, reason: "configured" },
      openclaw: { configured: true, reason: "configured" },
      codex: { configured: true, reason: "configured" },
      "claude-code": { configured: true, reason: "configured" },
    });
    expect(JSON.stringify(safe)).not.toMatch(
      /canary|localhost|18789|\/opt\/|\/tmp\/|credential|nativeSession/i,
    );
  });

  it.each([
    [
      {
        AIW_OPENCLAW_ENABLED: "true",
        AIW_OPENCLAW_GATEWAY_URL: "http://127.0.0.1:18789/gateway",
      },
      "AIW_OPENCLAW_CREDENTIAL_REF",
    ],
    [
      {
        AIW_CODEX_ENABLED: "true",
        AIW_CODEX_EXECUTABLE_PATH: "/usr/bin/codex",
      },
      "AIW_CODEX_NATIVE_SESSION_ROOT",
    ],
    [
      {
        AIW_CLAUDE_CODE_ENABLED: "true",
        AIW_CLAUDE_CODE_NATIVE_SESSION_ROOT: "/tmp/claude-sessions",
      },
      "AIW_CLAUDE_CODE_EXECUTABLE_PATH",
    ],
    [
      { AIW_OPENCLAW_GATEWAY_URL: "http://127.0.0.1:18789/gateway" },
      "AIW_OPENCLAW_ENABLED",
    ],
    [{ AIW_CODEX_EXECUTABLE_PATH: "/usr/bin/codex" }, "AIW_CODEX_ENABLED"],
    [
      { AIW_CLAUDE_CODE_NATIVE_SESSION_ROOT: "/tmp/claude-sessions" },
      "AIW_CLAUDE_CODE_ENABLED",
    ],
    [{ AIW_OPENCLAW_ENABLED: "yes" }, "AIW_OPENCLAW_ENABLED"],
    [{ AIW_CODEX_ENABLED: "1" }, "AIW_CODEX_ENABLED"],
    [{ AIW_CLAUDE_CODE_ENABLED: "TRUE" }, "AIW_CLAUDE_CODE_ENABLED"],
  ])(
    "rejects incomplete or ambiguous adapter configuration %o",
    async (adapter, field) => {
      const { loadLocalServerConfig } = await import("../src/node.js");
      expect(() =>
        loadLocalServerConfig({
          AIW_AGENT_SESSIONS_ENABLED: "true",
          AIW_HERMES_API_KEY: "fixture-secret",
          ...adapter,
        }),
      ).toThrow(field);
    },
  );

  it.each([
    [
      {
        AIW_OPENCLAW_ENABLED: "true",
        AIW_OPENCLAW_GATEWAY_URL: "http://user:secret@127.0.0.1:18789/gateway",
        AIW_OPENCLAW_CREDENTIAL_REF: "env:OPENCLAW_TOKEN",
      },
      /without credentials/i,
    ],
    [
      {
        AIW_OPENCLAW_ENABLED: "true",
        AIW_OPENCLAW_GATEWAY_URL: "https://gateway.example.com/v1",
        AIW_OPENCLAW_CREDENTIAL_REF: "env:OPENCLAW_TOKEN",
      },
      /loopback/i,
    ],
    [
      {
        AIW_CODEX_ENABLED: "true",
        AIW_CODEX_EXECUTABLE_PATH: "bin/codex",
        AIW_CODEX_NATIVE_SESSION_ROOT: "/tmp/codex-sessions",
      },
      /absolute paths/i,
    ],
    [
      {
        AIW_CLAUDE_CODE_ENABLED: "true",
        AIW_CLAUDE_CODE_EXECUTABLE_PATH: "/usr/bin/claude",
        AIW_CLAUDE_CODE_NATIVE_SESSION_ROOT: "claude-sessions",
      },
      /absolute paths/i,
    ],
  ])("rejects unsafe adapter configuration %o", async (adapter, reason) => {
    const { loadLocalServerConfig } = await import("../src/node.js");
    expect(() =>
      loadLocalServerConfig({
        AIW_AGENT_SESSIONS_ENABLED: "true",
        AIW_HERMES_API_KEY: "fixture-secret",
        ...adapter,
      }),
    ).toThrow(reason);
  });

  it.each([
    ["AIW_CLAUDE_CODE_EXECUTABLE_PATH", "/usr/bin/shared"],
    ["AIW_CLAUDE_CODE_NATIVE_SESSION_ROOT", "/tmp/shared-sessions"],
  ])("rejects duplicate CLI adapter value for %s", async (field, value) => {
    const { loadLocalServerConfig } = await import("../src/node.js");
    expect(() =>
      loadLocalServerConfig({
        AIW_AGENT_SESSIONS_ENABLED: "true",
        AIW_HERMES_API_KEY: "fixture-secret",
        AIW_CODEX_ENABLED: "true",
        AIW_CODEX_EXECUTABLE_PATH: "/usr/bin/shared",
        AIW_CODEX_NATIVE_SESSION_ROOT: "/tmp/shared-sessions",
        AIW_CLAUDE_CODE_ENABLED: "true",
        AIW_CLAUDE_CODE_EXECUTABLE_PATH: "/usr/bin/claude",
        AIW_CLAUDE_CODE_NATIVE_SESSION_ROOT: "/tmp/claude-sessions",
        [field]: value,
      }),
    ).toThrow(/distinct/i);
  });

  it("keeps the Hermes bearer server-only and requires loopback API configuration", async () => {
    const { loadLocalServerConfig, toSafeConfig } =
      await import("../src/node.js");
    expect(() =>
      loadLocalServerConfig({ AIW_AGENT_SESSIONS_ENABLED: "true" }),
    ).toThrow("AIW_HERMES_API_KEY");
    expect(() =>
      loadLocalServerConfig({
        AIW_AGENT_SESSIONS_ENABLED: "true",
        AIW_HERMES_API_KEY: "fixture-secret",
        AIW_HERMES_API_URL: "http://192.168.1.2:8642",
      }),
    ).toThrow(/loopback/i);
    expect(() =>
      loadLocalServerConfig({
        AIW_AGENT_SESSIONS_ENABLED: "true",
        AIW_HERMES_API_KEY: "fixture-secret",
        AIW_HERMES_NATIVE_SESSION_REF: "exact-session",
      }),
    ).toThrow(/configured together/i);
    const config = loadLocalServerConfig({
      AIW_AGENT_SESSIONS_ENABLED: "true",
      AIW_HERMES_API_KEY: "fixture-secret",
      AIW_AGENT_SESSION_DATA_DIR: "/tmp/aiw-agent-sessions",
      AIW_HERMES_NATIVE_SESSION_REF: "exact-session",
      AIW_HERMES_AGENT_DISPLAY_NAME: "Mr Fluff",
    });
    expect(config.agentSessions).toMatchObject({
      hermesApiUrl: "http://127.0.0.1:8642",
      hermesProfile: "default",
      pinnedSessionRef: "exact-session",
      agentDisplayName: "Mr Fluff",
    });
    expect(toSafeConfig(config).agentSessionsEnabled).toBe(true);
    expect(JSON.stringify(toSafeConfig(config))).not.toMatch(
      /fixture-secret|8642/,
    );
  });

  it("keeps command authority disabled by default and never exposes its secret", async () => {
    const { loadLocalServerConfig, toSafeConfig } =
      await import("../src/node.js");
    const base = {
      AIW_AGENTINTERSECT_ENABLED: "true",
      AIW_AGENTINTERSECT_EXPECTED_WORKSPACE: "/tmp/aiw-workspace",
      AIW_AGENTINTERSECT_DATA_DIR: "/tmp/aiw-data",
      AIW_AGENTINTERSECT_COMMANDS_ENABLED: "true",
      AIW_AGENTINTERSECT_EXPECTED_PHASE_ID: "phase_7",
      AIW_AGENTINTERSECT_EXPECTED_REVISION:
        "ce8495fcd0963165a9c68b98414a203c4dc25ace",
    };
    expect(() => loadLocalServerConfig(base)).toThrow("COMMAND_TOKEN");
    expect(() =>
      loadLocalServerConfig({
        ...base,
        AIW_AGENTINTERSECT_ENABLED: "false",
        AIW_AGENTINTERSECT_COMMAND_TOKEN: "dedicated-token",
      }),
    ).toThrow("require read integration");
    const config = loadLocalServerConfig({
      ...base,
      AIW_AGENTINTERSECT_COMMAND_TOKEN: "dedicated-token",
    });
    expect(config.agentIntersectCommands).toMatchObject({
      token: "dedicated-token",
      expectedPhaseId: "phase_7",
    });
    const safe = toSafeConfig(config);
    expect(safe.agentIntersectCommandsEnabled).toBe(true);
    expect(JSON.stringify(safe)).not.toContain("dedicated-token");
    expect(JSON.stringify(safe)).not.toContain("ce8495");
  });

  it("requires explicit paths and exposes only a boolean for read integration", async () => {
    const { loadLocalServerConfig, toSafeConfig } =
      await import("../src/node.js");
    expect(() =>
      loadLocalServerConfig({ AIW_AGENTINTERSECT_ENABLED: "true" }),
    ).toThrow("EXPECTED_WORKSPACE");
    const config = loadLocalServerConfig({
      AIW_AGENTINTERSECT_ENABLED: "true",
      AIW_AGENTINTERSECT_EXPECTED_WORKSPACE: "/tmp/aiw-workspace",
      AIW_AGENTINTERSECT_DATA_DIR: "/tmp/aiw-data",
    });
    expect(config.agentIntersectRead).toMatchObject({
      daemonUrl: "http://127.0.0.1:3761",
      dashboardUrl: "http://127.0.0.1:3762",
      maxQueuedFrames: 32,
    });
    expect(toSafeConfig(config)).toMatchObject({
      agentIntersectReadEnabled: true,
    });
    expect(JSON.stringify(toSafeConfig(config))).not.toContain("aiw-workspace");
  });

  it("uses the LAN default host only after explicit LAN selection", async () => {
    const { loadLocalServerConfig } = await import("../src/node.js");

    const presentationLan = {
      AIW_PRESENTATION_ALLOWED_ORIGIN: "http://192.168.1.20:45173",
      AIW_PRESENTATION_ALLOWED_HOST: "192.168.1.20:4780",
      AIW_PRESENTATION_TOKEN: "presentation-only",
    };
    expect(
      loadLocalServerConfig({ AIW_NETWORK_SCOPE: "lan", ...presentationLan }),
    ).toMatchObject({ networkScope: "lan", host: "0.0.0.0" });
    expect(
      loadLocalServerConfig({
        AIW_NETWORK_SCOPE: "lan",
        AIW_HOST: "192.168.1.20",
        AIW_PORT: "4780",
        AIW_INSTANCE_NAME: "  Studio LAN  ",
        AIW_DEMO_OPERATION_MAX_MS: "8000",
        ...presentationLan,
      }),
    ).toMatchObject({
      host: "192.168.1.20",
      port: 4780,
      instanceName: "Studio LAN",
      demoOperationMaxMs: 8000,
    });
  });

  it.each([
    [{ AIW_NETWORK_SCOPE: "public" }, "AIW_NETWORK_SCOPE"],
    [{ AIW_NETWORK_SCOPE: "loopback", AIW_HOST: "0.0.0.0" }, "AIW_HOST"],
    [{ AIW_PORT: "0" }, "AIW_PORT"],
    [{ AIW_INSTANCE_NAME: "   " }, "AIW_INSTANCE_NAME"],
    [{ AIW_DEMO_OPERATION_MAX_MS: "999999" }, "AIW_DEMO_OPERATION_MAX_MS"],
    [{ AIW_REPOSITORY_MAX_FILES: "10001" }, "AIW_REPOSITORY_MAX_FILES"],
  ])("rejects invalid configuration %o", async (environment, field) => {
    const { loadLocalServerConfig } = await import("../src/node.js");
    expect(() => loadLocalServerConfig(environment)).toThrow(field);
  });
});
