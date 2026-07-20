import { describe, expect, it, vi } from "vitest";

import { listCommandIntents } from "../src/commands/command-client.js";

const intent = {
  schema: "aiw.command-intent/0.7",
  id: "670774c6-d71f-48b7-8936-8bd54a6cc520",
  idempotencyKey: "restored-live-intent",
  requestFingerprint: "0".repeat(64),
  request: {
    schema: "aiw.command-intent.request/0.7",
    kind: "worker.enqueue-phase",
    phaseId: "phase_7",
    harness: "codex",
    expectedRevision: "design-revision-7",
    fixture: "phase7-disposable-artifact-v1",
  },
  state: "confirmed",
  correlationId: "7dc2d8ec-7710-49aa-a3ee-517d68dc5ff1",
  phaseId: "phase_7",
  sessionId: "session-7",
  jobId: "job-7",
  lifecycle: "complete",
  diagnostics: [],
  artifact: {
    path: "phase7-result.json",
    before: null,
    after: {
      message: "AgentIntersect World Phase 7 fixture complete",
      verified: true,
    },
    verification: "passed",
  },
  createdAt: "2026-07-20T11:00:00.000Z",
  updatedAt: "2026-07-20T11:01:00.000Z",
};

describe("Phase 7 command client", () => {
  it("loads validated durable intents for restart/result restoration", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { intents: [intent] },
          meta: {
            correlationId: "7dc2d8ec-7710-49aa-a3ee-517d68dc5ff1",
            schema: "aiw.api/0.3",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(listCommandIntents(fetcher)).resolves.toEqual({
      status: "ok",
      data: { intents: [intent] },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/commands/intents",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
