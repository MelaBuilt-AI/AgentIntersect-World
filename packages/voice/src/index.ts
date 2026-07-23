import { z } from "zod";

export const MAX_UTTERANCE_MS = 30_000;
export const MAX_ENCODED_AUDIO_BYTES = 4 * 1024 * 1024;
export const MAX_PROVIDER_OUTPUT_BYTES = 1024 * 1024;
export const MAX_STT_MS = 10_000;
export const MAX_VOICE_PROJECTION_BYTES = 256 * 1024;
export const MAX_VOICE_OPERATIONS = 20;
export const MAX_VOICE_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;

const SessionModeSchema = z.enum([
  "explore",
  "collaborate",
  "autonomous",
  "guided-build",
]);

export const VoiceBindingSchema = z
  .object({
    schema: z.literal("aiw.voice-binding/0.15"),
    worldSessionId: z.uuid(),
    adapterId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    adapterRootSessionRef: z.string().min(1).max(256),
    adapterEffectiveSessionRef: z.string().min(1).max(256),
    mode: SessionModeSchema,
    permissionRevision: z.number().int().nonnegative(),
    capabilitySnapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type VoiceBinding = z.infer<typeof VoiceBindingSchema>;

export const VoiceProviderAttestationSchema = z
  .object({
    schema: z.literal("aiw.stt-attestation/0.15"),
    providerId: z.literal("whisper.cpp-v1.9.1-base.en"),
    implementation: z.literal("whisper-cli"),
    processing: z.literal("local-process"),
    language: z.literal("en"),
    available: z.boolean(),
    reason: z.string().max(240).nullable(),
    partials: z.literal("unavailable"),
    retention: z.literal("volatile-until-text-send"),
    rawAudioLeavesMachine: z.literal(false),
  })
  .strict();
export type VoiceProviderAttestation = z.infer<
  typeof VoiceProviderAttestationSchema
>;

export const VoiceTranscriptionRequestSchema = z
  .object({
    schema: z.literal("aiw.voice-transcription-request/0.15"),
    binding: VoiceBindingSchema,
    language: z.literal("en"),
    wavBase64: z
      .string()
      .min(60)
      .max(Math.ceil((MAX_ENCODED_AUDIO_BYTES * 4) / 3) + 8),
  })
  .strict();

export const VoiceTranscriptionResultSchema = z
  .object({
    schema: z.literal("aiw.voice-transcription-result/0.15"),
    utteranceId: z.uuid(),
    finalText: z.string().min(1).max(16_384),
    partialText: z.null(),
    partialCapability: z.literal("unavailable"),
    elapsedMs: z.number().nonnegative(),
  })
  .strict();
export type VoiceTranscriptionResult = z.infer<
  typeof VoiceTranscriptionResultSchema
>;

export const VoicePreferenceSchema = z
  .object({
    schema: z.literal("aiw.voice-preference/0.15"),
    sessionId: z.uuid(),
    providerId: z.literal("whisper.cpp-v1.9.1-base.en"),
    microphoneEnabled: z.boolean(),
    ttsEnabled: z.boolean(),
    approvedVoiceId: z
      .string()
      .regex(/^[a-zA-Z0-9._-]{1,128}$/)
      .nullable(),
    voiceConsent: z.enum(["pending", "accepted", "declined", "revoked"]),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type VoicePreference = z.infer<typeof VoicePreferenceSchema>;

export type VoiceOperationSummary = {
  readonly id: string;
  readonly outcome:
    "completed" | "failed" | "cancelled" | "interrupted" | "ceiling";
  readonly occurredAt: string;
  readonly detail: string;
};

const PRIVATE_DETAIL =
  /(?:[A-Za-z]:\\|\/home\/|\/Users\/|device\s*=|persona\s*=|model\.bin|\.staging)[^\s,;]*/gi;

export function redactVoiceSummary(input: string): string {
  return input
    .replace(PRIVATE_DETAIL, "[redacted]")
    .replace(/CANARY/gi, "[redacted]")
    .slice(0, 160);
}

export class VoiceOperationProjection {
  readonly #now: () => number;
  #operations: VoiceOperationSummary[] = [];

  constructor(now: () => number = Date.now) {
    this.#now = now;
  }

  record(input: VoiceOperationSummary): void {
    const occurredAt = Date.parse(input.occurredAt);
    if (!Number.isFinite(occurredAt)) return;
    this.#operations.push({
      ...input,
      detail: redactVoiceSummary(input.detail),
    });
    this.#prune();
  }

  restore(inputs: readonly VoiceOperationSummary[]): void {
    this.#operations = [];
    for (const input of inputs) this.record(input);
  }

  snapshot(): {
    readonly schema: "aiw.voice-operations/0.15";
    readonly operations: readonly VoiceOperationSummary[];
  } {
    this.#prune();
    return {
      schema: "aiw.voice-operations/0.15",
      operations: this.#operations,
    };
  }

  #prune(): void {
    const cutoff = this.#now() - MAX_VOICE_RETENTION_MS;
    this.#operations = this.#operations
      .filter((item) => Date.parse(item.occurredAt) >= cutoff)
      .sort(
        (left, right) =>
          Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
      )
      .slice(0, MAX_VOICE_OPERATIONS);
    while (
      this.#operations.length > 0 &&
      new TextEncoder().encode(JSON.stringify(this.#snapshotUnsafe()))
        .byteLength > MAX_VOICE_PROJECTION_BYTES
    )
      this.#operations.pop();
  }

  #snapshotUnsafe() {
    return {
      schema: "aiw.voice-operations/0.15",
      operations: this.#operations,
    };
  }
}

export function sameVoiceBinding(
  leftInput: VoiceBinding,
  rightInput: VoiceBinding,
): boolean {
  const left = VoiceBindingSchema.parse(leftInput);
  const right = VoiceBindingSchema.parse(rightInput);
  return (
    left.worldSessionId === right.worldSessionId &&
    left.adapterId === right.adapterId &&
    left.adapterRootSessionRef === right.adapterRootSessionRef &&
    left.adapterEffectiveSessionRef === right.adapterEffectiveSessionRef &&
    left.mode === right.mode &&
    left.permissionRevision === right.permissionRevision &&
    left.capabilitySnapshotHash === right.capabilitySnapshotHash
  );
}

export function encodePcm16Wav(
  samples: Float32Array,
  sampleRate: 16_000,
): Uint8Array {
  if (sampleRate !== 16_000) throw new Error("Voice audio must be 16 kHz.");
  if (samples.length > 30 * 16_000)
    throw new Error("Voice audio exceeds the 30-second ceiling.");
  const dataBytes = samples.length * 2;
  const output = new Uint8Array(44 + dataBytes);
  if (output.byteLength > MAX_ENCODED_AUDIO_BYTES)
    throw new Error("Voice audio exceeds the 4 MiB encoded ceiling.");
  const view = new DataView(output.buffer);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1)
      view.setUint8(offset + index, value.charCodeAt(index));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16_000, true);
  view.setUint32(28, 32_000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, dataBytes, true);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(
      44 + index * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    );
  }
  return output;
}

export function inspectPcm16Wav(input: Uint8Array): {
  readonly format: "pcm";
  readonly channels: 1;
  readonly sampleRate: 16_000;
  readonly bitsPerSample: 16;
  readonly durationMs: number;
} {
  if (input.byteLength < 44 || input.byteLength > MAX_ENCODED_AUDIO_BYTES)
    throw new Error("Voice WAV byte length is invalid.");
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const text = (offset: number, length: number) =>
    String.fromCharCode(...input.subarray(offset, offset + length));
  const dataBytes = view.getUint32(40, true);
  if (
    text(0, 4) !== "RIFF" ||
    text(8, 4) !== "WAVE" ||
    text(12, 4) !== "fmt " ||
    view.getUint32(16, true) !== 16 ||
    view.getUint16(20, true) !== 1 ||
    view.getUint16(22, true) !== 1 ||
    view.getUint32(24, true) !== 16_000 ||
    view.getUint16(34, true) !== 16 ||
    text(36, 4) !== "data" ||
    dataBytes !== input.byteLength - 44 ||
    dataBytes % 2 !== 0
  )
    throw new Error(
      "Voice input must be app-owned 16-bit PCM WAV, 16 kHz mono.",
    );
  const durationMs = (dataBytes / 2 / 16_000) * 1_000;
  if (durationMs > MAX_UTTERANCE_MS)
    throw new Error("Voice input exceeds the 30-second ceiling.");
  return {
    format: "pcm",
    channels: 1,
    sampleRate: 16_000,
    bitsPerSample: 16,
    durationMs,
  };
}

export class DeterministicFakeSttProvider {
  readonly #partials: readonly string[];
  readonly #finalText: string;

  constructor(input: {
    readonly partials?: readonly string[];
    readonly finalText: string;
  }) {
    this.#partials = (input.partials ?? []).map((text) =>
      text.slice(0, 16_384),
    );
    this.#finalText = input.finalText.trim().slice(0, 16_384);
    if (!this.#finalText) throw new Error("Fake STT final text is required.");
  }

  async transcribe(
    wav: Uint8Array,
    options: {
      readonly signal?: AbortSignal;
      readonly onPartial?: (text: string) => Promise<void> | void;
    } = {},
  ): Promise<{
    readonly providerId: "deterministic-fake";
    readonly finalText: string;
    readonly elapsedMs: 0;
    readonly peakRssBytes: null;
    readonly outputBytes: 0;
  }> {
    inspectPcm16Wav(wav);
    const cancelled = () => {
      const error = new Error("Fake transcription cancelled.") as Error & {
        code: "cancelled";
      };
      error.code = "cancelled";
      return error;
    };
    if (options.signal?.aborted) throw cancelled();
    for (const partial of this.#partials) {
      if (options.signal?.aborted) throw cancelled();
      await options.onPartial?.(partial);
    }
    if (options.signal?.aborted) throw cancelled();
    return {
      providerId: "deterministic-fake",
      finalText: this.#finalText,
      elapsedMs: 0,
      peakRssBytes: null,
      outputBytes: 0,
    };
  }
}
