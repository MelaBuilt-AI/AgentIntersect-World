import { describe, expect, it } from "vitest";

import { AgentCapabilityManifestSchema } from "../src/index.js";

const base = {
  schema: "aiw.agent-capabilities/0.12",
  adapterId: "hermes",
  adapterVersion: "0.18.2-f7c9feb3",
  transport: "loopback-http-sse",
  origin: "local",
  auth: "server-bearer",
  supportedModes: ["explore", "collaborate"],
  ordering: "per-session-strict",
  resume: "session-api",
  shutdownOwner: "hermes",
  maxInputBytes: 16_384,
  maxEventBytes: 32_768,
  capabilities: {
    attach: true,
    sendText: true,
    streamDeltas: true,
    toolStatus: true,
    approvals: false,
    interrupt: false,
    avatarProposal: true,
    skillsDisclosure: true,
    worldActions: true,
  },
  unavailable: {
    approvals: "Approvals remain in Hermes.",
    interrupt: "No exact run stop is exposed.",
  },
  worldActions: {
    enabled: true,
    protocol: "aiw.world-action/0.13",
    proposalHelper: "propose_world_action",
    maximumBatchActions: 8,
    maximumEnvelopeBytes: 16_384,
    defaultTtlMs: 30_000,
    maximumTtlMs: 120_000,
    rateActionsPerSecond: 4,
    rateBurstActions: 8,
    maximumQueuedActions: 32,
  },
} as const;

describe("Phase 13 capability declaration", () => {
  it("requires exact World Action protocol and bounds when advertised", () => {
    expect(AgentCapabilityManifestSchema.parse(base).worldActions.enabled).toBe(
      true,
    );
    expect(
      AgentCapabilityManifestSchema.safeParse({
        ...base,
        worldActions: { ...base.worldActions, maximumBatchActions: 9 },
      }).success,
    ).toBe(false);
    expect(
      AgentCapabilityManifestSchema.safeParse({
        ...base,
        capabilities: { ...base.capabilities, worldActions: false },
        unavailable: {
          ...base.unavailable,
          worldActions:
            "Structured helper unavailable; use chat and manual navigation.",
        },
        worldActions: {
          ...base.worldActions,
          enabled: false,
          unavailableReason:
            "Structured helper unavailable; use chat and manual navigation.",
        },
      }).success,
    ).toBe(true);
  });

  it("normalizes legacy declarations to explicit degradation and rejects contradictions", () => {
    const { worldActions: removed, ...missing } = base;
    void removed;
    const legacy = {
      ...missing,
      capabilities: Object.fromEntries(
        Object.entries(missing.capabilities).filter(
          ([key]) => key !== "worldActions",
        ),
      ),
    };
    expect(
      AgentCapabilityManifestSchema.parse(legacy).worldActions.enabled,
    ).toBe(false);
    expect(
      AgentCapabilityManifestSchema.safeParse({
        ...base,
        capabilities: { ...base.capabilities, worldActions: false },
      }).success,
    ).toBe(false);
  });
});
