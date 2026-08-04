import { describe, expect, it, vi } from "vitest";

import {
  createUserDirectedMovementProposal,
  parseAgentMovementAuthoritySnapshot,
  postUserDirectedMovement,
  postUserDirectedStop,
} from "../src/world-entry/world-agent-direction.js";

const sessionId = "11111111-1111-4111-8111-111111111111";

describe("normal World user-directed movement transport", () => {
  it("accepts movement only from a validated accepted World Action envelope", () => {
    const actionId = "66666666-6666-4666-8666-666666666666";
    const envelope = {
      schema: "aiw.world-action/0.13",
      requestId: "22222222-2222-4222-8222-222222222222",
      batchId: "33333333-3333-4333-8333-333333333333",
      sessionId,
      adapterSessionRef: "native-mr-fluff",
      repositoryRef: "aiw://object/repository-a",
      worldGeneration: "world-a",
      layoutGeneration: "layout-a",
      graphGeneration: null,
      capabilitySnapshotHash: "a".repeat(64),
      sequence: 1,
      createdAt: "2026-08-03T20:00:00.000Z",
      expiresAt: "2026-08-03T20:00:30.000Z",
      actions: [
        {
          kind: "move-agent",
          schema: "aiw.agent-movement/1",
          actionId,
          actorId: sessionId,
          source: "agent-autonomous",
          speed: 4,
          target: { kind: "coordinate", x: -4, z: 1 },
        },
      ],
    };
    expect(
      parseAgentMovementAuthoritySnapshot(
        {
          capability: { enabled: true },
          actions: [
            {
              actionId,
              kind: "move-agent",
              state: "path-planned",
              reason: "agent-autonomous",
            },
          ],
          executions: [{ accepted: true, envelope }],
        },
        sessionId,
      ),
    ).toEqual({
      capabilityRefusal: null,
      requests: [
        {
          schema: "aiw.agent-movement/1",
          requestId: actionId,
          actorId: sessionId,
          source: "agent-autonomous",
          speed: 4,
          target: { kind: "coordinate", x: -4, z: 1 },
        },
      ],
      outcomes: [
        {
          requestId: actionId,
          state: "intent",
          reason: "agent-autonomous",
        },
      ],
    });
    expect(
      parseAgentMovementAuthoritySnapshot(
        {
          executions: [{ accepted: false, envelope }],
          actions: [{ ...envelope.actions[0], state: "moving" }],
        },
        sessionId,
      ).requests,
    ).toEqual([]);
    expect(
      parseAgentMovementAuthoritySnapshot(
        {
          executions: [
            {
              accepted: true,
              envelope: { actions: envelope.actions },
            },
          ],
        },
        sessionId,
      ).requests,
    ).toEqual([]);
  });

  it("builds and posts the validated 0.13 user-directed movement proposal for the exact selected actor", async () => {
    const proposal = createUserDirectedMovementProposal(sessionId, {
      kind: "relative",
      direction: "right",
      distance: 4,
    });
    expect(proposal).toEqual({
      actions: [
        {
          kind: "move-agent",
          schema: "aiw.agent-movement/1",
          actorId: sessionId,
          source: "user-directed",
          speed: 4,
          target: { kind: "relative", direction: "right", distance: 4 },
        },
      ],
      ttlMs: 30_000,
    });

    const fetcher = vi.fn(async () => new Response(null, { status: 202 }));
    await postUserDirectedMovement(fetcher, sessionId, {
      kind: "coordinate",
      x: 6,
      z: -2,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(
      `/api/world-actions/${sessionId}/proposals`,
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actions: [
            {
              kind: "move-agent",
              schema: "aiw.agent-movement/1",
              actorId: sessionId,
              source: "user-directed",
              speed: 4,
              target: { kind: "coordinate", x: 6, z: -2 },
            },
          ],
          ttlMs: 30_000,
        }),
      }),
    );
  });

  it("uses the bounded interrupt route for stop and surfaces HTTP refusal", async () => {
    const accepted = vi.fn(async () => new Response(null, { status: 200 }));
    await postUserDirectedStop(accepted, sessionId);
    expect(accepted).toHaveBeenCalledWith(
      `/api/world-actions/${sessionId}/interrupt`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "cancel" }),
      }),
    );

    const refused = vi.fn(async () => new Response(null, { status: 409 }));
    await expect(
      postUserDirectedMovement(refused, sessionId, {
        kind: "follow-user",
        stoppingRadius: 1.5,
      }),
    ).rejects.toThrow("movement proposal refused (409)");
  });
});
