import { describe, expect, it } from "vitest";

import {
  MAX_ENCODED_AUDIO_BYTES,
  MAX_UTTERANCE_MS,
  DeterministicFakeSttProvider,
  VoiceBindingSchema,
  VoiceOperationProjection,
  encodePcm16Wav,
  inspectPcm16Wav,
  sameVoiceBinding,
} from "../src/index.js";

const binding = {
  schema: "aiw.voice-binding/0.15" as const,
  worldSessionId: "11111111-1111-4111-8111-111111111111",
  adapterId: "hermes",
  adapterRootSessionRef: "root-session",
  adapterEffectiveSessionRef: "effective-session",
  mode: "explore" as const,
  permissionRevision: 3,
  capabilitySnapshotHash: "a".repeat(64),
};

describe("Phase 15 browser-safe voice contracts", () => {
  it("pins exact binding, capture, and PCM WAV limits", () => {
    expect(VoiceBindingSchema.parse(binding)).toEqual(binding);
    expect(MAX_UTTERANCE_MS).toBe(30_000);
    expect(MAX_ENCODED_AUDIO_BYTES).toBe(4 * 1024 * 1024);

    const wav = encodePcm16Wav(new Float32Array([0, 1, -1, 0.25]), 16_000);
    expect(inspectPcm16Wav(wav)).toMatchObject({
      channels: 1,
      sampleRate: 16_000,
      bitsPerSample: 16,
      format: "pcm",
    });
    expect(() =>
      encodePcm16Wav(new Float32Array(30 * 16_000 + 1), 16_000),
    ).toThrow(/30-second ceiling/i);
    expect(() => inspectPcm16Wav(new Uint8Array(4 * 1024 * 1024 + 1))).toThrow(
      /byte length/i,
    );
  });

  it("rejects stale exact-session authority bindings", () => {
    expect(sameVoiceBinding(binding, { ...binding })).toBe(true);
    expect(
      sameVoiceBinding(binding, { ...binding, permissionRevision: 4 }),
    ).toBe(false);
    expect(
      sameVoiceBinding(binding, {
        ...binding,
        adapterEffectiveSessionRef: "changed",
      }),
    ).toBe(false);
  });

  it("retains only redacted newest-20 operation summaries for seven days", () => {
    const now = Date.parse("2026-07-22T20:00:00.000Z");
    const projection = new VoiceOperationProjection(() => now);
    for (let index = 0; index < 25; index += 1)
      projection.record({
        id: `op-${index}`,
        outcome: "completed",
        occurredAt: new Date(now - index * 1_000).toISOString(),
        detail:
          "/home/private/model.bin device=Secret Microphone persona=CANARY",
      });
    projection.record({
      id: "expired",
      outcome: "failed",
      occurredAt: new Date(now - 8 * 24 * 60 * 60 * 1_000).toISOString(),
      detail: "old",
    });
    const snapshot = projection.snapshot();
    expect(snapshot.operations).toHaveLength(20);
    expect(JSON.stringify(snapshot)).not.toMatch(
      /\/home\/private|Secret Microphone|CANARY|model\.bin/,
    );
    expect(Buffer.byteLength(JSON.stringify(snapshot))).toBeLessThanOrEqual(
      256 * 1024,
    );
  });

  it("provides deterministic volatile partial/final/cancel fixtures", async () => {
    const provider = new DeterministicFakeSttProvider({
      partials: ["review", "review this"],
      finalText: "review this final",
    });
    const partials: string[] = [];
    await expect(
      provider.transcribe(encodePcm16Wav(new Float32Array(160), 16_000), {
        onPartial: (text) => partials.push(text),
      }),
    ).resolves.toMatchObject({ finalText: "review this final" });
    expect(partials).toEqual(["review", "review this"]);
    const controller = new AbortController();
    controller.abort();
    await expect(
      provider.transcribe(encodePcm16Wav(new Float32Array(160), 16_000), {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "cancelled" });
  });
});
