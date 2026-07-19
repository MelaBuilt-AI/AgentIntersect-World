import { describe, expect, it } from "vitest";

describe("Phase 2 local-server configuration", () => {
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
      phase: "Phase 2",
      version: "0.2.0-phase2",
      instanceName: "AgentIntersect World Local",
      networkScope: "loopback",
      host: "127.0.0.1",
      port: 3770,
      demoOperationMaxMs: expect.any(Number),
    });
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
  ])("rejects invalid configuration %o", async (environment, field) => {
    const { loadLocalServerConfig } = await import("../src/node.js");
    expect(() => loadLocalServerConfig(environment)).toThrow(field);
  });
});
