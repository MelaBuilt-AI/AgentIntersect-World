import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { AgentSession } from "@agentintersect-world/agent-session-protocol";
import {
  MAX_ENCODED_AUDIO_BYTES,
  VoiceBindingSchema,
  VoiceOperationProjection,
  VoicePreferenceSchema,
  VoiceTranscriptionRequestSchema,
  VoiceTranscriptionResultSchema,
  sameVoiceBinding,
  type VoiceBinding,
  type VoiceOperationSummary,
  type VoicePreference,
  type VoiceProviderAttestation,
} from "@agentintersect-world/voice";

type Provider = {
  attest(): Promise<VoiceProviderAttestation>;
  transcribe(
    wav: Uint8Array,
    options?: { readonly language?: string; readonly signal?: AbortSignal },
  ): Promise<{
    readonly finalText: string;
    readonly elapsedMs: number;
    readonly peakRssBytes: number | null;
    readonly providerId: string;
  }>;
};

type Gateway = {
  status(sessionId: string): AgentSession;
  sendText(
    sessionId: string,
    request: { readonly text: string; readonly binding: AgentSession },
  ): Promise<unknown>;
};

export type VoiceStorePayload = {
  readonly schema: "aiw.voice-store/0.15";
  readonly preferences: readonly VoicePreference[];
  readonly operations: readonly VoiceOperationSummary[];
  readonly activity: "capture" | "playback" | null;
};

const EMPTY: VoiceStorePayload = {
  schema: "aiw.voice-store/0.15",
  preferences: [],
  operations: [],
  activity: null,
};

export class VoiceServiceError extends Error {
  constructor(
    readonly code:
      | "validation"
      | "not-found"
      | "stale-binding"
      | "unavailable"
      | "provider-failed",
    message: string,
  ) {
    super(message);
    this.name = "VoiceServiceError";
  }
}

function bindingFor(session: AgentSession): VoiceBinding {
  return VoiceBindingSchema.parse({
    schema: "aiw.voice-binding/0.15",
    worldSessionId: session.sessionId,
    adapterId: session.adapterId,
    adapterRootSessionRef:
      session.adapterRootSessionRef ?? session.adapterSessionRef,
    adapterEffectiveSessionRef: session.adapterSessionRef,
    mode: session.mode,
    permissionRevision: session.permissionRevision,
    capabilitySnapshotHash: session.capabilitySnapshotHash,
  });
}

function parseBase64(input: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input) || input.length % 4 !== 0)
    throw new VoiceServiceError(
      "validation",
      "Voice audio encoding is invalid.",
    );
  const buffer = Buffer.from(input, "base64");
  if (
    buffer.byteLength > MAX_ENCODED_AUDIO_BYTES ||
    buffer.toString("base64") !== input
  )
    throw new VoiceServiceError(
      "validation",
      "Voice audio exceeds its encoded ceiling.",
    );
  return new Uint8Array(buffer);
}

export class VoiceStore {
  readonly #directory: string;
  readonly #file: string;
  readonly #projection = new VoiceOperationProjection();
  #preferences: VoicePreference[] = [];
  #activity: VoiceStorePayload["activity"] = null;

  constructor(directory: string) {
    this.#directory = directory;
    this.#file = path.join(directory, "voice-state.json");
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    fs.chmodSync(directory, 0o700);
    let loaded: VoiceStorePayload = EMPTY;
    try {
      const raw = JSON.parse(
        fs.readFileSync(this.#file, "utf8"),
      ) as VoiceStorePayload;
      if (
        raw.schema !== "aiw.voice-store/0.15" ||
        !Array.isArray(raw.preferences)
      )
        throw new Error("invalid voice store");
      loaded = {
        schema: "aiw.voice-store/0.15",
        preferences: raw.preferences
          .map((item) => VoicePreferenceSchema.parse(item))
          .slice(-64),
        operations: Array.isArray(raw.operations) ? raw.operations : [],
        activity:
          raw.activity === "capture" || raw.activity === "playback"
            ? raw.activity
            : null,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        const recovered = `${this.#file}.invalid-${Date.now()}`;
        try {
          fs.renameSync(this.#file, recovered);
        } catch {
          // Leave malformed state untouched if it cannot be quarantined.
        }
      }
    }
    this.#preferences = [...loaded.preferences];
    this.#projection.restore(loaded.operations);
    this.#activity = loaded.activity;
    if (this.#activity) {
      this.#projection.record({
        id: randomUUID(),
        outcome: "interrupted",
        occurredAt: new Date().toISOString(),
        detail: `${this.#activity} interrupted by restart; never auto-resumed`,
      });
      this.#activity = null;
    }
    this.#write();
  }

  preference(sessionId: string): VoicePreference | null {
    return (
      this.#preferences.find((item) => item.sessionId === sessionId) ?? null
    );
  }

  savePreference(input: unknown): VoicePreference {
    const preference = VoicePreferenceSchema.parse(input);
    this.#preferences = [
      ...this.#preferences.filter(
        (item) => item.sessionId !== preference.sessionId,
      ),
      preference,
    ].slice(-64);
    this.#write();
    return preference;
  }

  revokeVoice(sessionId: string): VoicePreference {
    const current = this.preference(sessionId);
    if (!current)
      throw new VoiceServiceError(
        "not-found",
        "No voice preference exists for this session.",
      );
    return this.savePreference({
      ...current,
      approvedVoiceId: null,
      voiceConsent: "revoked",
      updatedAt: new Date().toISOString(),
    });
  }

  markActivity(activity: VoiceStorePayload["activity"]): void {
    this.#activity = activity;
    this.#write();
  }

  record(input: VoiceOperationSummary): void {
    this.#projection.record(input);
    this.#write();
  }

  snapshot(): VoiceStorePayload {
    return {
      schema: "aiw.voice-store/0.15",
      preferences: this.#preferences,
      operations: this.#projection.snapshot().operations,
      activity: this.#activity,
    };
  }

  #write(): void {
    const payload = JSON.stringify(this.snapshot());
    if (Buffer.byteLength(payload) > 256 * 1024)
      throw new VoiceServiceError(
        "validation",
        "Voice settings projection exceeds 256 KiB.",
      );
    const temporary = path.join(
      this.#directory,
      `.voice-state-${process.pid}.tmp`,
    );
    fs.writeFileSync(temporary, payload, { mode: 0o600 });
    fs.renameSync(temporary, this.#file);
  }
}

export class VoiceService {
  readonly #provider: Provider;
  readonly #gateway: Gateway;
  readonly store: VoiceStore;

  constructor(options: {
    readonly provider: Provider;
    readonly gateway: Gateway;
    readonly store: VoiceStore;
  }) {
    this.#provider = options.provider;
    this.#gateway = options.gateway;
    this.store = options.store;
  }

  async disclosure(): Promise<VoiceProviderAttestation> {
    return this.#provider.attest();
  }

  history(): VoiceStorePayload {
    return this.store.snapshot();
  }

  markActivity(
    sessionId: string,
    activity: VoiceStorePayload["activity"],
  ): VoiceStorePayload {
    try {
      this.#gateway.status(sessionId);
    } catch {
      throw new VoiceServiceError(
        "not-found",
        "The exact World session is unavailable.",
      );
    }
    this.store.markActivity(activity);
    return this.store.snapshot();
  }

  preference(sessionId: string): VoicePreference | null {
    return this.store.preference(sessionId);
  }

  savePreference(input: unknown): VoicePreference {
    return this.store.savePreference(input);
  }

  revokeVoice(sessionId: string): VoicePreference {
    return this.store.revokeVoice(sessionId);
  }

  async transcribe(sessionId: string, input: unknown, signal?: AbortSignal) {
    const parsed = VoiceTranscriptionRequestSchema.safeParse(input);
    if (!parsed.success)
      throw new VoiceServiceError(
        "validation",
        "Voice transcription request is invalid.",
      );
    this.#assertBinding(sessionId, parsed.data.binding);
    const wav = parseBase64(parsed.data.wavBase64);
    try {
      const result = await this.#provider.transcribe(wav, {
        language: parsed.data.language,
        ...(signal ? { signal } : {}),
      });
      const response = VoiceTranscriptionResultSchema.parse({
        schema: "aiw.voice-transcription-result/0.15",
        utteranceId: randomUUID(),
        finalText: result.finalText,
        partialText: null,
        partialCapability: "unavailable",
        elapsedMs: result.elapsedMs,
      });
      this.store.record({
        id: response.utteranceId,
        outcome: "completed",
        occurredAt: new Date().toISOString(),
        detail: `local transcription completed in ${Math.round(result.elapsedMs)}ms`,
      });
      return response;
    } catch (error) {
      this.store.record({
        id: randomUUID(),
        outcome: signal?.aborted ? "cancelled" : "failed",
        occurredAt: new Date().toISOString(),
        detail: error instanceof Error ? error.message : "provider failed",
      });
      throw error;
    } finally {
      wav.fill(0);
    }
  }

  async sendAccepted(
    sessionId: string,
    input: {
      readonly binding: VoiceBinding;
      readonly sessionBinding: AgentSession;
      readonly text: string;
    },
  ): Promise<unknown> {
    const binding = VoiceBindingSchema.safeParse(input.binding);
    if (!binding.success || typeof input.text !== "string")
      throw new VoiceServiceError(
        "validation",
        "Accepted voice transcript is invalid.",
      );
    const text = input.text.trim();
    if (!text || Buffer.byteLength(text, "utf8") > 16_384)
      throw new VoiceServiceError(
        "validation",
        "Accepted voice transcript is invalid.",
      );
    this.#assertBinding(sessionId, binding.data);
    return this.#gateway.sendText(sessionId, {
      text,
      binding: input.sessionBinding,
    });
  }

  #assertBinding(sessionId: string, supplied: VoiceBinding): void {
    let current: AgentSession;
    try {
      current = this.#gateway.status(sessionId);
    } catch {
      throw new VoiceServiceError(
        "not-found",
        "The exact World session is unavailable.",
      );
    }
    if (
      sessionId !== supplied.worldSessionId ||
      !sameVoiceBinding(bindingFor(current), supplied)
    )
      throw new VoiceServiceError(
        "stale-binding",
        "Voice authority binding changed; reconnect before continuing.",
      );
  }
}
