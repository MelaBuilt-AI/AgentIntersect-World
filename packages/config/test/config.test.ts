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
      phase: "Phase 9",
      version: "0.9.0-phase9",
      instanceName: "AgentIntersect World Local",
      networkScope: "loopback",
      host: "127.0.0.1",
      port: 3770,
      demoOperationMaxMs: expect.any(Number),
      repositoryMaxFiles: 2_500,
      agentIntersectReadEnabled: false,
      agentIntersectCommandsEnabled: false,
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
