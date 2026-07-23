import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { encodePcm16Wav } from "@agentintersect-world/voice";
import { VoiceService, VoiceStore } from "../src/voice-service.js";

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
  activeRunId: null,
  lastEventSequence: 0,
  adapterPreviousSessionRef: null,
  createdAt: "2026-07-22T20:00:00.000Z",
  updatedAt: "2026-07-22T20:00:00.000Z",
};

const binding = {
  schema: "aiw.voice-binding/0.15" as const,
  worldSessionId: session.sessionId,
  adapterId: session.adapterId,
  adapterRootSessionRef: session.adapterRootSessionRef,
  adapterEffectiveSessionRef: session.adapterSessionRef,
  mode: session.mode,
  permissionRevision: session.permissionRevision,
  capabilitySnapshotHash: session.capabilitySnapshotHash,
};

const newStore = () =>
  new VoiceStore(mkdtempSync(path.join(tmpdir(), "aiw-voice-store-test-")));

describe("Phase 15 voice service authority and persistence", () => {
  it("keeps audio volatile and returns truthfully non-partial final text", async () => {
    const transcribe = vi.fn().mockResolvedValue({
      finalText: "review this transcript",
      elapsedMs: 22,
      peakRssBytes: 2048,
      providerId: "whisper.cpp-v1.9.1-base.en",
    });
    const service = new VoiceService({
      provider: {
        attest: vi.fn().mockResolvedValue({
          schema: "aiw.stt-attestation/0.15",
          providerId: "whisper.cpp-v1.9.1-base.en",
          implementation: "whisper-cli",
          processing: "local-process",
          language: "en",
          available: true,
          reason: null,
          partials: "unavailable",
          retention: "volatile-until-text-send",
          rawAudioLeavesMachine: false,
        }),
        transcribe,
      },
      gateway: { status: () => session, sendText: vi.fn() },
      store: newStore(),
    });
    const wav = encodePcm16Wav(new Float32Array(160), 16_000);
    const response = await service.transcribe(session.sessionId, {
      schema: "aiw.voice-transcription-request/0.15",
      binding,
      language: "en",
      wavBase64: Buffer.from(wav).toString("base64"),
    });
    expect(response).toMatchObject({
      finalText: "review this transcript",
      partialText: null,
      partialCapability: "unavailable",
    });
    expect(JSON.stringify(service.history())).not.toContain(
      Buffer.from(wav).toString("base64"),
    );
  });

  it("rejects every stale authority dimension before ordinary send", async () => {
    const sendText = vi.fn();
    const service = new VoiceService({
      provider: { attest: vi.fn(), transcribe: vi.fn() },
      gateway: { status: () => session, sendText },
      store: newStore(),
    });
    for (const stale of [
      { ...binding, worldSessionId: "22222222-2222-4222-8222-222222222222" },
      { ...binding, adapterRootSessionRef: "other-root" },
      { ...binding, adapterEffectiveSessionRef: "other-effective" },
      { ...binding, mode: "collaborate" as const },
      { ...binding, permissionRevision: 3 },
      { ...binding, capabilitySnapshotHash: "b".repeat(64) },
    ])
      await expect(
        service.sendAccepted(session.sessionId, {
          binding: stale,
          sessionBinding: session,
          text: "edited final",
        }),
      ).rejects.toMatchObject({ code: "stale-binding" });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("sends accepted voice text through the exact ordinary gateway method", async () => {
    const sendText = vi.fn().mockResolvedValue({
      finalText: "canonical reply",
      deltas: ["canonical ", "reply"],
    });
    const service = new VoiceService({
      provider: { attest: vi.fn(), transcribe: vi.fn() },
      gateway: { status: () => session, sendText },
      store: newStore(),
    });
    await expect(
      service.sendAccepted(session.sessionId, {
        binding,
        sessionBinding: session,
        text: "edited final",
      }),
    ).resolves.toMatchObject({ finalText: "canonical reply" });
    expect(sendText).toHaveBeenCalledExactlyOnceWith(session.sessionId, {
      text: "edited final",
      binding: session,
    });
  });

  it("persists only opaque consent/preferences and marks restart activity interrupted", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "aiw-voice-store-test-"));
    const store = new VoiceStore(directory);
    store.savePreference({
      schema: "aiw.voice-preference/0.15",
      sessionId: session.sessionId,
      providerId: "whisper.cpp-v1.9.1-base.en",
      microphoneEnabled: true,
      ttsEnabled: true,
      approvedVoiceId: "system.voice.en-US-1",
      voiceConsent: "accepted",
      updatedAt: "2026-07-22T20:00:00.000Z",
    });
    store.markActivity("capture");
    const recovered = new VoiceStore(directory);
    expect(recovered.preference(session.sessionId)).toMatchObject({
      approvedVoiceId: "system.voice.en-US-1",
      voiceConsent: "accepted",
    });
    expect(recovered.snapshot().activity).toBe(null);
    expect(recovered.snapshot().operations.at(0)).toMatchObject({
      outcome: "interrupted",
    });
    recovered.revokeVoice(session.sessionId);
    expect(recovered.preference(session.sessionId)).toMatchObject({
      approvedVoiceId: null,
      voiceConsent: "revoked",
    });
    expect(JSON.stringify(recovered.snapshot())).not.toMatch(
      /device label|raw audio|persona|\/home\//i,
    );
  });

  it("wires authoritative capture/playback activity through the session service", () => {
    const store = newStore();
    const service = new VoiceService({
      provider: { attest: vi.fn(), transcribe: vi.fn() },
      gateway: {
        status: (sessionId) => {
          if (sessionId !== session.sessionId) throw new Error("missing");
          return session as never;
        },
        sendText: vi.fn(),
      },
      store,
    });
    service.markActivity(session.sessionId, "capture");
    expect(service.history().activity).toBe("capture");
    service.markActivity(session.sessionId, null);
    expect(service.history().activity).toBe(null);
    expect(() =>
      service.markActivity("22222222-2222-4222-8222-222222222222", "playback"),
    ).toThrowError(/exact World session/i);
  });
});
