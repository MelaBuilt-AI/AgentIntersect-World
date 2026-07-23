import { describe, expect, it, vi } from "vitest";

import { encodePcm16Wav } from "@agentintersect-world/voice";
import { VoiceClient } from "../src/voice/voice-client.js";

const session = {
  schema: "aiw.agent-session/0.12" as const,
  sessionId: "11111111-1111-4111-8111-111111111111",
  adapterId: "hermes",
  adapterSessionRef: "effective",
  adapterRootSessionRef: "root",
  profile: "default",
  workspaceId: "workspace",
  repositoryRef: "repository",
  mode: "explore" as const,
  permissionRevision: 2,
  capabilitySnapshotHash: "a".repeat(64),
  continuity: "current",
  status: "ready",
};

describe("Phase 15 narrow browser voice client", () => {
  it("sends only WAV plus exact authority binding, never device/path/persona labels", async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            schema: "aiw.voice-transcription-result/0.15",
            utteranceId: "22222222-2222-4222-8222-222222222222",
            finalText: "fixture",
            partialText: null,
            partialCapability: "unavailable",
            elapsedMs: 1,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const client = new VoiceClient(fetcher as typeof fetch);
    const controller = new AbortController();
    await client.transcribe(
      session,
      encodePcm16Wav(new Float32Array(160), 16_000),
      controller.signal,
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      signal: controller.signal,
    });
    const serialized = JSON.stringify(fetcher.mock.calls);
    expect(serialized).toContain(session.capabilitySnapshotHash);
    expect(serialized).toContain("root");
    expect(serialized).not.toMatch(
      /Secret Microphone|persona_canary|\/home\/|\.staging|deviceLabel/,
    );
  });

  it("uses the dedicated accept endpoint carrying the unchanged ordinary session binding", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: { finalText: "reply", deltas: [] },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    await new VoiceClient(fetcher as typeof fetch).sendAccepted(
      session,
      "edited final",
    );
    expect(fetcher).toHaveBeenCalledWith(
      `/api/voice/sessions/${session.sessionId}/send`,
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"text":"edited final"'),
      }),
    );
  });

  it("projects authoritative activity and recovery state through the narrow API", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              schema: "aiw.voice-store/0.15",
              preferences: [],
              operations: [],
              activity: "capture",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const client = new VoiceClient(fetcher as typeof fetch);
    await client.state();
    await client.markActivity(session.sessionId, "capture");
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/voice/state");
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      `/api/voice/sessions/${session.sessionId}/activity`,
    );
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      body: '{"activity":"capture"}',
    });
  });
});
