import { describe, expect, it, vi } from "vitest";

import {
  createUserDirectedMovementProposal,
  postUserDirectedMovement,
  postUserDirectedStop,
} from "../src/world-entry/world-agent-direction.js";

const sessionId = "11111111-1111-4111-8111-111111111111";

describe("normal World user-directed movement transport", () => {
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
      `/world-actions/${sessionId}/proposals`,
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
      `/world-actions/${sessionId}/interrupt`,
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
