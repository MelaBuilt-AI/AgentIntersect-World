import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HermesSessionAdapter,
  readPluginWorldActionProposal,
} from "../src/agent-sessions.js";

const roots: string[] = [];
const root = () => {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-phase13-adapter-"));
  roots.push(value);
  return value;
};

afterEach(() => {
  for (const value of roots.splice(0)) fs.rmSync(value, { recursive: true });
});

const capability = {
  schema: "aiw.hermes-plugin-capabilities/0.13",
  plugin: "agentintersect-world",
  version: "0.13.0",
  sameSessionArbiter: "fcntl-turn-lock-v1",
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
};

describe("Hermes World Action helper seam", () => {
  it("passes helper authority metadata through the World-owned importer and retains transient proposals", async () => {
    const module = await import("../src/world-actions.js");
    expect(module.importWorldActionProposal).toBeTypeOf("function");
    const importer = module.importWorldActionProposal as unknown as (
      service: { propose: ReturnType<typeof vi.fn> },
      sessionId: string,
      imported: {
        proposalId: string;
        sourceStreamId: string;
        sequence: number;
        createdAt: string;
        proposal: { actions: unknown[] };
      },
      context: unknown,
    ) => Promise<{ consume: boolean; result: unknown }>;
    const result = { accepted: false, reason: "sequence-gap" };
    const service = { propose: vi.fn().mockResolvedValue(result) };
    const imported = {
      proposalId: "00000000-0000-4000-8000-000000000009",
      sourceStreamId: "a".repeat(64),
      sequence: 7,
      createdAt: "2026-07-21T12:00:00.000Z",
      proposal: { actions: [] },
    };
    const context = {};

    await expect(
      importer(service, "session-a", imported, context),
    ).resolves.toEqual({ consume: false, result });
    expect(service.propose).toHaveBeenCalledWith(
      "session-a",
      imported.proposal,
      context,
      {
        requestId: imported.proposalId,
        sourceStreamId: imported.sourceStreamId,
        sequence: imported.sequence,
        createdAt: imported.createdAt,
      },
    );

    for (const reason of ["rate-limited", "capability-unavailable"]) {
      service.propose.mockResolvedValueOnce({ accepted: false, reason });
      await expect(
        importer(service, "session-a", imported, context),
      ).resolves.toMatchObject({ consume: false });
    }
    for (const reason of ["expired", "duplicate"]) {
      service.propose.mockResolvedValueOnce({ accepted: false, reason });
      await expect(
        importer(service, "session-a", imported, context),
      ).resolves.toMatchObject({ consume: true });
    }
    service.propose.mockResolvedValueOnce({ accepted: true });
    await expect(
      importer(service, "session-a", imported, context),
    ).resolves.toMatchObject({ consume: true });
  });

  it("advertises exact protocol bounds only when the secure plugin declaration attests", async () => {
    const directory = root();
    const capabilityPath = path.join(directory, "capabilities.json");
    fs.writeFileSync(capabilityPath, JSON.stringify(capability), {
      mode: 0o600,
    });
    const adapter = new HermesSessionAdapter({
      baseUrl: "http://127.0.0.1:8642",
      apiKey: "fixture",
      profile: "default",
      pluginCapabilityPath: capabilityPath,
      fetch: async () =>
        new Response(
          JSON.stringify({
            features: { session_resources: true, session_chat_streaming: true },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    });
    const manifest = await adapter.attest();
    expect(manifest.capabilities.worldActions).toBe(true);
    expect(manifest.worldActions).toEqual(capability.worldActions);

    fs.writeFileSync(
      capabilityPath,
      JSON.stringify({
        ...capability,
        worldActions: { ...capability.worldActions, maximumBatchActions: 9 },
      }),
      { mode: 0o600 },
    );
    const degraded = await adapter.attest();
    expect(degraded.capabilities.worldActions).toBe(false);
    expect(degraded.worldActions.unavailableReason).toMatch(
      /manual navigation/i,
    );
  });

  it("reads one exact-session structured proposal without prose parsing or authority metadata", () => {
    const directory = root();
    const sessionRef = "native-session-a";
    const proposalPath = path.join(directory, "proposal.json");
    fs.writeFileSync(
      proposalPath,
      JSON.stringify({
        schema: "aiw.hermes-world-action-proposal/0.13",
        proposalId: "00000000-0000-4000-8000-000000000001",
        nativeSessionHash: createHash("sha256")
          .update(sessionRef)
          .digest("hex"),
        sequence: 1,
        createdAt: "2026-07-21T12:00:00.000Z",
        ttlMs: 30_000,
        actions: [
          {
            kind: "navigate",
            target: {
              repositoryRef: "aiw://object/repository-a",
              objectRef: "aiw://object/package-a",
            },
          },
        ],
      }),
      { mode: 0o600 },
    );
    expect(readPluginWorldActionProposal(proposalPath, sessionRef)).toEqual({
      proposalId: "00000000-0000-4000-8000-000000000001",
      sourceStreamId: createHash("sha256").update(sessionRef).digest("hex"),
      sequence: 1,
      createdAt: "2026-07-21T12:00:00.000Z",
      proposal: {
        ttlMs: 30_000,
        actions: [
          {
            kind: "navigate",
            target: {
              repositoryRef: "aiw://object/repository-a",
              objectRef: "aiw://object/package-a",
            },
          },
        ],
      },
    });
    fs.writeFileSync(
      proposalPath,
      JSON.stringify({ text: '{"kind":"navigate"}' }),
      { mode: 0o600 },
    );
    expect(readPluginWorldActionProposal(proposalPath, sessionRef)).toBeNull();
  });

  it("consumes a proposal owned by the immediately previous proven effective session after compression", () => {
    const directory = root();
    const previous = "effective-before-compression";
    const current = "effective-after-compression";
    const proposalPath = path.join(directory, "proposal.json");
    fs.writeFileSync(
      proposalPath,
      JSON.stringify({
        schema: "aiw.hermes-world-action-proposal/0.13",
        proposalId: "00000000-0000-4000-8000-000000000002",
        nativeSessionHash: createHash("sha256").update(previous).digest("hex"),
        sequence: 2,
        createdAt: "2026-07-21T12:00:01.000Z",
        ttlMs: 30_000,
        actions: [
          {
            kind: "focus",
            target: {
              repositoryRef: "aiw://object/repository-a",
              objectRef: "aiw://object/package-renderer-r3f",
            },
          },
        ],
      }),
      { mode: 0o600 },
    );

    expect(readPluginWorldActionProposal(proposalPath, current)).toBeNull();
    expect(
      readPluginWorldActionProposal(proposalPath, [current, previous]),
    ).toMatchObject({
      proposalId: "00000000-0000-4000-8000-000000000002",
      sequence: 2,
    });
  });
});
