import { describe, expect, it } from "vitest";

describe("Phase 6 local-server configuration", () => {
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
      phase: "Phase 6",
      version: "0.6.0-phase6",
      instanceName: "AgentIntersect World Local",
      networkScope: "loopback",
      host: "127.0.0.1",
      port: 3770,
      demoOperationMaxMs: expect.any(Number),
      repositoryMaxFiles: 2_500,
      agentIntersectReadEnabled: false,
    });
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

    expect(loadLocalServerConfig({ AIW_NETWORK_SCOPE: "lan" })).toMatchObject({
      networkScope: "lan",
      host: "0.0.0.0",
    });
    expect(
      loadLocalServerConfig({
        AIW_NETWORK_SCOPE: "lan",
        AIW_HOST: "192.168.1.20",
        AIW_PORT: "4780",
        AIW_INSTANCE_NAME: "  Studio LAN  ",
        AIW_DEMO_OPERATION_MAX_MS: "8000",
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
