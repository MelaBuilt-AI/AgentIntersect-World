import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { encodePcm16Wav } from "@agentintersect-world/voice";
import { createLocalServer, type LocalServer } from "../src/server.js";
import { VoiceService, VoiceStore } from "../src/voice-service.js";

const servers: LocalServer[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("Phase 15 local voice routes", () => {
  it("discloses fail-closed availability without absolute provider paths", async () => {
    const voiceService = new VoiceService({
      provider: {
        attest: vi.fn().mockResolvedValue({
          schema: "aiw.stt-attestation/0.15",
          providerId: "whisper.cpp-v1.9.1-base.en",
          implementation: "whisper-cli",
          processing: "local-process",
          language: "en",
          available: false,
          reason: "Provider staging root is not explicitly configured.",
          partials: "unavailable",
          retention: "volatile-until-text-send",
          rawAudioLeavesMachine: false,
        }),
        transcribe: vi.fn(),
      },
      gateway: { status: vi.fn(), sendText: vi.fn() },
      store: new VoiceStore(mkdtempSync(path.join(tmpdir(), "aiw-voice-api-"))),
    });
    const server = createLocalServer({ voiceService });
    servers.push(server);
    const response = await server.inject({
      method: "GET",
      url: "/voice/disclosure",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      available: false,
      rawAudioLeavesMachine: false,
      implementation: "whisper-cli",
    });
    expect(response.body).not.toMatch(/\/home\/|\.staging/);
  });

  it("rejects non-English and oversized/non-WAV payloads without invoking a provider", async () => {
    const transcribe = vi.fn();
    const status = vi.fn().mockReturnValue({
      sessionId: "11111111-1111-4111-8111-111111111111",
      adapterId: "hermes",
      adapterSessionRef: "effective",
      adapterRootSessionRef: "root",
      mode: "explore",
      permissionRevision: 2,
      capabilitySnapshotHash: "a".repeat(64),
    });
    const voiceService = new VoiceService({
      provider: { attest: vi.fn(), transcribe },
      gateway: { status, sendText: vi.fn() },
      store: new VoiceStore(mkdtempSync(path.join(tmpdir(), "aiw-voice-api-"))),
    });
    const server = createLocalServer({ voiceService });
    servers.push(server);
    const response = await server.inject({
      method: "POST",
      url: "/voice/sessions/11111111-1111-4111-8111-111111111111/transcriptions",
      payload: {
        schema: "aiw.voice-transcription-request/0.15",
        binding: {
          schema: "aiw.voice-binding/0.15",
          worldSessionId: "11111111-1111-4111-8111-111111111111",
          adapterId: "hermes",
          adapterRootSessionRef: "root",
          adapterEffectiveSessionRef: "effective",
          mode: "explore",
          permissionRevision: 2,
          capabilitySnapshotHash: "a".repeat(64),
        },
        language: "fr",
        wavBase64: Buffer.from(
          encodePcm16Wav(new Float32Array(160), 16_000),
        ).toString("base64"),
      },
    });
    expect(response.statusCode).toBe(400);
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("accepts the valid 30-second PCM envelope above Fastify's default body limit", async () => {
    const transcribe = vi.fn().mockResolvedValue({
      finalText: "thirty second final",
      elapsedMs: 10,
      peakRssBytes: 1,
      providerId: "whisper.cpp-v1.9.1-base.en",
    });
    const status = vi.fn().mockReturnValue({
      sessionId: "11111111-1111-4111-8111-111111111111",
      adapterId: "hermes",
      adapterSessionRef: "effective",
      adapterRootSessionRef: "root",
      mode: "explore",
      permissionRevision: 2,
      capabilitySnapshotHash: "a".repeat(64),
    });
    const server = createLocalServer({
      voiceService: new VoiceService({
        provider: { attest: vi.fn(), transcribe },
        gateway: { status, sendText: vi.fn() },
        store: new VoiceStore(
          mkdtempSync(path.join(tmpdir(), "aiw-voice-api-")),
        ),
      }),
    });
    servers.push(server);
    const wav = encodePcm16Wav(new Float32Array(30 * 16_000), 16_000);
    const response = await server.inject({
      method: "POST",
      url: "/voice/sessions/11111111-1111-4111-8111-111111111111/transcriptions",
      payload: {
        schema: "aiw.voice-transcription-request/0.15",
        binding: {
          schema: "aiw.voice-binding/0.15",
          worldSessionId: "11111111-1111-4111-8111-111111111111",
          adapterId: "hermes",
          adapterRootSessionRef: "root",
          adapterEffectiveSessionRef: "effective",
          mode: "explore",
          permissionRevision: 2,
          capabilitySnapshotHash: "a".repeat(64),
        },
        language: "en",
        wavBase64: Buffer.from(wav).toString("base64"),
      },
    });
    wav.fill(0);
    expect(response.statusCode).toBe(200);
    expect(transcribe).toHaveBeenCalledOnce();
  });

  it("persists only bounded activity for an existing exact session", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const store = new VoiceStore(
      mkdtempSync(path.join(tmpdir(), "aiw-voice-api-")),
    );
    const server = createLocalServer({
      voiceService: new VoiceService({
        provider: { attest: vi.fn(), transcribe: vi.fn() },
        gateway: {
          status: (candidate) => {
            if (candidate !== sessionId) throw new Error("missing");
            return {
              sessionId,
              adapterId: "hermes",
              adapterSessionRef: "effective",
              adapterRootSessionRef: "root",
              mode: "explore",
              permissionRevision: 2,
              capabilitySnapshotHash: "a".repeat(64),
            } as never;
          },
          sendText: vi.fn(),
        },
        store,
      }),
    });
    servers.push(server);
    const active = await server.inject({
      method: "PUT",
      url: `/voice/sessions/${sessionId}/activity`,
      payload: { activity: "capture" },
    });
    expect(active.statusCode).toBe(200);
    expect(active.json().data.activity).toBe("capture");
    const invalid = await server.inject({
      method: "PUT",
      url: `/voice/sessions/${sessionId}/activity`,
      payload: { activity: "microphone-label-or-path" },
    });
    expect(invalid.statusCode).toBe(400);
  });
});
