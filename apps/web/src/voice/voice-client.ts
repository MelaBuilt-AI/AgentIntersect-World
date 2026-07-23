import type {
  VoiceBinding,
  VoicePreference,
  VoiceProviderAttestation,
  VoiceTranscriptionResult,
} from "@agentintersect-world/voice";
import type { WorldAgentSession } from "../sessions/session-client.js";

type ApiEnvelope<T> = { readonly ok: true; readonly data: T };

export type VoiceStateProjection = {
  readonly schema: "aiw.voice-store/0.15";
  readonly preferences: readonly VoicePreference[];
  readonly operations: readonly {
    readonly id: string;
    readonly outcome:
      "completed" | "failed" | "cancelled" | "interrupted" | "ceiling";
    readonly occurredAt: string;
    readonly detail: string;
  }[];
  readonly activity: "capture" | "playback" | null;
};

async function data<T>(response: Response): Promise<T> {
  const body = (await response.json()) as
    ApiEnvelope<T> | { readonly error?: { readonly message?: string } };
  if (!response.ok || !("ok" in body) || body.ok !== true)
    throw new Error(
      "error" in body
        ? (body.error?.message ?? "Voice request failed")
        : "Voice request failed",
    );
  return body.data;
}

function base64(input: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < input.byteLength; offset += 32_768)
    binary += String.fromCharCode(...input.subarray(offset, offset + 32_768));
  return btoa(binary);
}

export function voiceBinding(session: WorldAgentSession): VoiceBinding {
  return {
    schema: "aiw.voice-binding/0.15",
    worldSessionId: session.sessionId,
    adapterId: session.adapterId,
    adapterRootSessionRef:
      typeof session.adapterRootSessionRef === "string"
        ? session.adapterRootSessionRef
        : session.adapterSessionRef,
    adapterEffectiveSessionRef: session.adapterSessionRef,
    mode: session.mode,
    permissionRevision: session.permissionRevision,
    capabilitySnapshotHash: session.capabilitySnapshotHash,
  };
}

export class VoiceClient {
  readonly #fetcher: typeof fetch;

  constructor(fetcher: typeof fetch = globalThis.fetch) {
    this.#fetcher = (input, init) => fetcher(input, init);
  }

  disclosure(): Promise<VoiceProviderAttestation> {
    return this.get("/api/voice/disclosure");
  }

  state(): Promise<VoiceStateProjection> {
    return this.get("/api/voice/state");
  }

  markActivity(
    sessionId: string,
    activity: VoiceStateProjection["activity"],
  ): Promise<VoiceStateProjection> {
    return this.put(`/api/voice/sessions/${sessionId}/activity`, { activity });
  }

  preference(sessionId: string): Promise<VoicePreference | null> {
    return this.get(`/api/voice/sessions/${sessionId}/preference`);
  }

  savePreference(input: VoicePreference): Promise<VoicePreference> {
    return this.put(`/api/voice/sessions/${input.sessionId}/preference`, input);
  }

  revokeVoice(sessionId: string): Promise<VoicePreference> {
    return this.delete(`/api/voice/sessions/${sessionId}/voice-consent`);
  }

  transcribe(
    session: WorldAgentSession,
    wav: Uint8Array,
    signal?: AbortSignal,
  ): Promise<VoiceTranscriptionResult> {
    return this.post(
      `/api/voice/sessions/${session.sessionId}/transcriptions`,
      {
        schema: "aiw.voice-transcription-request/0.15",
        binding: voiceBinding(session),
        language: "en",
        wavBase64: base64(wav),
      },
      signal,
    );
  }

  sendAccepted(
    session: WorldAgentSession,
    text: string,
  ): Promise<{
    readonly finalText: string;
    readonly deltas: readonly string[];
  }> {
    return this.post(`/api/voice/sessions/${session.sessionId}/send`, {
      binding: voiceBinding(session),
      sessionBinding: session,
      text,
    });
  }

  async get<T>(url: string): Promise<T> {
    return data<T>(
      await this.#fetcher(url, { headers: { accept: "application/json" } }),
    );
  }

  async post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return data<T>(
      await this.#fetcher(url, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        ...(signal ? { signal } : {}),
        body: JSON.stringify(body),
      }),
    );
  }

  async put<T>(url: string, body: unknown): Promise<T> {
    return data<T>(
      await this.#fetcher(url, {
        method: "PUT",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
  }

  async delete<T>(url: string): Promise<T> {
    return data<T>(
      await this.#fetcher(url, {
        method: "DELETE",
        headers: { accept: "application/json" },
      }),
    );
  }
}
