import { describe, expect, it } from "vitest";

import { loadLocalServerConfig, toSafeConfig } from "../src/node.js";

describe("Phase 9 presentation transport configuration", () => {
  it("defaults to loopback-only presentation state with no command authority", () => {
    const config = loadLocalServerConfig({});
    expect(config.presentationSync).toMatchObject({
      allowedOrigin: "http://127.0.0.1:5173",
      allowedHost: "127.0.0.1:5173",
    });
    expect(config.presentationSync.bearerToken).toBeUndefined();
    expect(toSafeConfig(config)).toMatchObject({
      phase: "Phase 10",
      version: "0.10.0-phase10",
      presentationSync: {
        enabled: true,
        transport: "ws/http",
        encrypted: false,
        unencryptedLanWarning: false,
      },
    });
    expect(JSON.stringify(toSafeConfig(config))).not.toContain("dataDir");
  });

  it("requires exact origin/host and a separate bearer for trusted LAN", () => {
    expect(() => loadLocalServerConfig({ AIW_NETWORK_SCOPE: "lan" })).toThrow(
      /PRESENTATION/,
    );
    expect(() =>
      loadLocalServerConfig({
        AIW_NETWORK_SCOPE: "lan",
        AIW_PRESENTATION_ALLOWED_ORIGIN: "http://192.168.1.20:45173",
        AIW_PRESENTATION_ALLOWED_HOST: "192.168.1.20:43770",
        AIW_PRESENTATION_TOKEN: "same-token",
        AIW_AGENTINTERSECT_ENABLED: "true",
        AIW_AGENTINTERSECT_EXPECTED_WORKSPACE: "/tmp/world",
        AIW_AGENTINTERSECT_DATA_DIR: "/tmp/data",
        AIW_AGENTINTERSECT_COMMANDS_ENABLED: "true",
        AIW_AGENTINTERSECT_COMMAND_TOKEN: "same-token",
        AIW_AGENTINTERSECT_EXPECTED_PHASE_ID: "phase_9",
        AIW_AGENTINTERSECT_EXPECTED_REVISION: "revision_01jz8phase9",
      }),
    ).toThrow(/separate/i);
    const config = loadLocalServerConfig({
      AIW_NETWORK_SCOPE: "lan",
      AIW_HOST: "192.168.1.20",
      AIW_PORT: "43770",
      AIW_PRESENTATION_ALLOWED_ORIGIN: "http://192.168.1.20:45173",
      AIW_PRESENTATION_ALLOWED_HOST: "192.168.1.20:43770",
      AIW_PRESENTATION_TOKEN: "presentation-only-token",
    });
    expect(toSafeConfig(config).presentationSync).toMatchObject({
      enabled: true,
      encrypted: false,
      unencryptedLanWarning: true,
    });
    expect(JSON.stringify(toSafeConfig(config))).not.toContain(
      "presentation-only-token",
    );
  });
});
