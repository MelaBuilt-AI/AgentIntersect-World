import {
  MAX_ENCODED_AUDIO_BYTES,
  MAX_UTTERANCE_MS,
  encodePcm16Wav,
} from "@agentintersect-world/voice";
import type { WorldAgentSession } from "../sessions/session-client.js";

type CaptureCode =
  | "empty-recording"
  | "permission-denied"
  | "no-device"
  | "lost-device"
  | "unsupported-format"
  | "time-ceiling"
  | "size-ceiling"
  | "cancelled"
  | "capture-failed";

export class BrowserVoiceError extends Error {
  constructor(
    readonly code:
      CaptureCode | "tts-unavailable" | "tts-failed" | "tts-timeout",
    message: string,
  ) {
    super(message);
    this.name = "BrowserVoiceError";
  }
}

type MinimalTrack = {
  readonly label?: string;
  readonly readyState?: string;
  stop(): void;
  addEventListener?(
    type: "ended",
    listener: () => void,
    options?: { readonly once?: boolean },
  ): void;
  removeEventListener?(type: "ended", listener: () => void): void;
};

type MinimalStream = {
  getTracks(): readonly MinimalTrack[];
  getAudioTracks?(): readonly MinimalTrack[];
};

type AudioNodeLike = {
  connect(destination: unknown): unknown;
  disconnect(): void;
};

type ProcessorLike = AudioNodeLike & {
  onaudioprocess:
    | ((event: {
        inputBuffer: { getChannelData(channel: number): Float32Array };
      }) => void)
    | null;
};

type AudioContextLike = {
  readonly sampleRate: number;
  readonly destination: unknown;
  createMediaStreamSource(stream: MinimalStream): AudioNodeLike;
  createScriptProcessor(
    size: number,
    inputs: number,
    outputs: number,
  ): ProcessorLike;
  close(): Promise<void>;
};

type CaptureOptions = {
  readonly getUserMedia?: (
    constraints: MediaStreamConstraints,
  ) => Promise<MinimalStream>;
  readonly audioContext?: (() => AudioContextLike) | null;
  readonly stopPlayback?: () => void;
  readonly fixtureSamples?: Float32Array;
  readonly onAutomaticStop?: (
    wav: Uint8Array,
    reason: "time-ceiling" | "size-ceiling",
  ) => Promise<void> | void;
  readonly onTerminated?: (reason: "lost-device") => void;
  readonly setTimer?: (
    callback: () => void,
    milliseconds: number,
  ) => ReturnType<typeof setTimeout>;
  readonly clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
};

export type VoiceCaptureSnapshot = {
  readonly state:
    | "unavailable"
    | "idle"
    | "enabled"
    | "listening"
    | "stopped"
    | "cancelled"
    | "failed";
  readonly sampleCount: number;
  readonly inputLevel: number;
  readonly deviceLabel: string;
  readonly permission: "unknown" | "granted" | "denied";
  readonly stopReason: CaptureCode | "operator" | null;
};

function captureError(error: unknown): BrowserVoiceError {
  if (error instanceof BrowserVoiceError) return error;
  if (error instanceof DOMException && error.name === "NotAllowedError")
    return new BrowserVoiceError(
      "permission-denied",
      "Browser microphone permission was denied. Typed text remains available.",
    );
  if (error instanceof DOMException && error.name === "NotFoundError")
    return new BrowserVoiceError(
      "no-device",
      "No browser microphone device is available. Typed text remains available.",
    );
  return new BrowserVoiceError(
    "capture-failed",
    `Microphone capture failed${error instanceof Error ? `: ${error.message.slice(0, 120)}` : ""}. Typed text remains available.`,
  );
}

function defaultAudioContext(): AudioContextLike {
  const constructor = globalThis.AudioContext;
  if (!constructor)
    throw new BrowserVoiceError(
      "unsupported-format",
      "This browser cannot produce app-owned 16 kHz PCM WAV audio.",
    );
  return new constructor() as unknown as AudioContextLike;
}

function resampleMono(input: Float32Array, sourceRate: number): Float32Array {
  if (sourceRate === 16_000) return input.slice();
  const length = Math.floor((input.length * 16_000) / sourceRate);
  const output = new Float32Array(length);
  const ratio = sourceRate / 16_000;
  for (let index = 0; index < length; index += 1) {
    const offset = index * ratio;
    const left = Math.floor(offset);
    const right = Math.min(input.length - 1, left + 1);
    const fraction = offset - left;
    output[index] =
      (input[left] ?? 0) * (1 - fraction) + (input[right] ?? 0) * fraction;
  }
  return output;
}

export class VoiceCaptureController {
  readonly #getUserMedia?: CaptureOptions["getUserMedia"];
  readonly #audioContext: CaptureOptions["audioContext"];
  readonly #stopPlayback: () => void;
  readonly #fixtureSamples: Float32Array | undefined;
  readonly #onAutomaticStop: CaptureOptions["onAutomaticStop"];
  readonly #onTerminated: CaptureOptions["onTerminated"];
  readonly #setTimer: NonNullable<CaptureOptions["setTimer"]>;
  readonly #clearTimer: NonNullable<CaptureOptions["clearTimer"]>;
  #state: VoiceCaptureSnapshot["state"] = "idle";
  #permission: VoiceCaptureSnapshot["permission"] = "unknown";
  #deviceLabel =
    "Browser default microphone (label unavailable until permission)";
  #stopReason: VoiceCaptureSnapshot["stopReason"] = null;
  #stream: MinimalStream | null = null;
  #track: MinimalTrack | null = null;
  #context: AudioContextLike | null = null;
  #source: AudioNodeLike | null = null;
  #processor: ProcessorLike | null = null;
  #chunks: Float32Array[] = [];
  #sampleCount = 0;
  #inputLevel = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: CaptureOptions = {}) {
    this.#getUserMedia =
      options.getUserMedia ??
      (globalThis.navigator?.mediaDevices?.getUserMedia
        ? (constraints) =>
            globalThis.navigator.mediaDevices.getUserMedia(
              constraints,
            ) as Promise<MinimalStream>
        : undefined);
    this.#audioContext =
      options.audioContext === undefined
        ? defaultAudioContext
        : options.audioContext;
    this.#stopPlayback = options.stopPlayback ?? (() => undefined);
    this.#fixtureSamples = options.fixtureSamples;
    this.#onAutomaticStop = options.onAutomaticStop;
    this.#onTerminated = options.onTerminated;
    this.#setTimer =
      options.setTimer ??
      ((callback, milliseconds) =>
        globalThis.setTimeout(callback, milliseconds));
    this.#clearTimer =
      options.clearTimer ?? ((timer) => globalThis.clearTimeout(timer));
    if (!this.#fixtureSamples && (!this.#getUserMedia || !this.#audioContext))
      this.#state = "unavailable";
  }

  availability(): {
    readonly available: boolean;
    readonly reason: CaptureCode | null;
  } {
    return this.#state === "unavailable"
      ? { available: false, reason: "unsupported-format" }
      : { available: true, reason: null };
  }

  snapshot(): VoiceCaptureSnapshot {
    return {
      state: this.#state,
      sampleCount: this.#sampleCount,
      inputLevel: this.#inputLevel,
      deviceLabel: this.#deviceLabel,
      permission: this.#permission,
      stopReason: this.#stopReason,
    };
  }

  async enable(): Promise<VoiceCaptureSnapshot> {
    if (this.#fixtureSamples) {
      this.#permission = "granted";
      this.#deviceLabel = "Deterministic fixture microphone";
      this.#state = "enabled";
      return this.snapshot();
    }
    if (!this.#getUserMedia || !this.#audioContext) {
      this.#state = "unavailable";
      throw new BrowserVoiceError(
        "unsupported-format",
        "This browser cannot produce app-owned 16 kHz PCM WAV audio.",
      );
    }
    try {
      const stream = await this.#getUserMedia({
        audio: { channelCount: 1, echoCancellation: true },
        video: false,
      });
      const track = stream.getAudioTracks?.()[0] ?? stream.getTracks()[0];
      if (!track)
        throw new BrowserVoiceError(
          "no-device",
          "No microphone device was returned.",
        );
      this.#deviceLabel = track.label?.trim() || "Browser default microphone";
      stream.getTracks().forEach((item) => item.stop());
      this.#permission = "granted";
      this.#state = "enabled";
      return this.snapshot();
    } catch (error) {
      const mapped = captureError(error);
      this.#permission =
        mapped.code === "permission-denied" ? "denied" : "unknown";
      this.#state = "failed";
      this.#release();
      throw mapped;
    }
  }

  async start(): Promise<VoiceCaptureSnapshot> {
    if (this.#state === "listening")
      throw new BrowserVoiceError(
        "capture-failed",
        "One microphone capture is already active.",
      );
    if (
      this.#state !== "enabled" &&
      this.#state !== "stopped" &&
      this.#state !== "cancelled"
    )
      throw new BrowserVoiceError(
        "capture-failed",
        "Enable the microphone before push-to-talk.",
      );
    this.#stopPlayback();
    this.#chunks = [];
    this.#sampleCount = 0;
    this.#stopReason = null;
    try {
      if (this.#fixtureSamples) {
        this.#chunks.push(this.#fixtureSamples.slice());
        this.#sampleCount = this.#fixtureSamples.length;
      } else {
        this.#stream = await this.#getUserMedia!({
          audio: { channelCount: 1, echoCancellation: true },
          video: false,
        });
        const track =
          this.#stream.getAudioTracks?.()[0] ?? this.#stream.getTracks()[0];
        if (!track)
          throw new BrowserVoiceError(
            "lost-device",
            "The microphone device was lost.",
          );
        this.#track = track;
        track.addEventListener?.("ended", this.#deviceEnded, { once: true });
        this.#context = this.#audioContext!();
        this.#source = this.#context.createMediaStreamSource(this.#stream);
        this.#processor = this.#context.createScriptProcessor(4096, 1, 1);
        this.#processor.onaudioprocess = (event) => {
          if (this.#state !== "listening") return;
          const chunk = event.inputBuffer.getChannelData(0).slice();
          let energy = 0;
          for (const sample of chunk) energy += sample * sample;
          this.#inputLevel = chunk.length
            ? Math.min(1, Math.sqrt(energy / chunk.length))
            : 0;
          this.#chunks.push(chunk);
          this.#sampleCount += chunk.length;
          const estimated =
            44 +
            Math.ceil(
              (this.#sampleCount * 16_000) / this.#context!.sampleRate,
            ) *
              2;
          if (estimated > MAX_ENCODED_AUDIO_BYTES)
            this.#stopAutomatically("size-ceiling");
        };
        this.#source.connect(this.#processor);
        this.#processor.connect(this.#context.destination);
      }
      this.#state = "listening";
      this.#timer = this.#setTimer(
        () => this.#stopAutomatically("time-ceiling"),
        MAX_UTTERANCE_MS,
      );
      return this.snapshot();
    } catch (error) {
      this.#state = "failed";
      this.#release();
      throw captureError(error);
    }
  }

  async stop(
    reason: "operator" | "time-ceiling" | "size-ceiling" = "operator",
  ): Promise<Uint8Array> {
    if (this.#state !== "listening")
      throw new BrowserVoiceError(
        "capture-failed",
        "No microphone capture is active.",
      );
    const sourceRate = this.#context?.sampleRate ?? 16_000;
    const samples = new Float32Array(this.#sampleCount);
    let offset = 0;
    for (const chunk of this.#chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }
    this.#stopReason = reason;
    this.#state = "stopped";
    this.#release();
    const resampled = resampleMono(samples, sourceRate);
    const maxSamples = Math.min(
      Math.floor((MAX_ENCODED_AUDIO_BYTES - 44) / 2),
      Math.floor((MAX_UTTERANCE_MS * 16_000) / 1_000),
    );
    if (resampled.length < 1_600) {
      samples.fill(0);
      resampled.fill(0);
      this.#chunks = [];
      this.#sampleCount = 0;
      throw new BrowserVoiceError(
        "empty-recording",
        "Nothing recorded. Left click and hold while talking.",
      );
    }
    const wav = encodePcm16Wav(resampled.subarray(0, maxSamples), 16_000);
    samples.fill(0);
    resampled.fill(0);
    this.#chunks = [];
    this.#sampleCount = 0;
    return wav;
  }

  cancel(): void {
    this.#stopReason = "cancelled";
    this.#state = "cancelled";
    for (const chunk of this.#chunks) chunk.fill(0);
    this.#chunks = [];
    this.#sampleCount = 0;
    this.#release();
  }

  #stopAutomatically(reason: "time-ceiling" | "size-ceiling"): void {
    if (this.#state !== "listening") return;
    void this.stop(reason)
      .then(async (wav) => {
        try {
          await this.#onAutomaticStop?.(wav, reason);
        } finally {
          wav.fill(0);
        }
      })
      .catch(() => undefined);
  }

  readonly #deviceEnded = (): void => {
    if (this.#state !== "listening") return;
    this.cancel();
    this.#stopReason = "lost-device";
    this.#state = "failed";
    this.#onTerminated?.("lost-device");
  };

  #release(): void {
    this.#inputLevel = 0;
    if (this.#timer) this.#clearTimer(this.#timer);
    this.#timer = null;
    if (this.#processor) this.#processor.onaudioprocess = null;
    this.#processor?.disconnect();
    this.#source?.disconnect();
    this.#stream?.getTracks().forEach((track) => track.stop());
    this.#track?.removeEventListener?.("ended", this.#deviceEnded);
    void this.#context?.close().catch(() => undefined);
    this.#processor = null;
    this.#source = null;
    this.#stream = null;
    this.#track = null;
    this.#context = null;
  }
}

type SpeechSynthesisLike = {
  readonly speaking: boolean;
  speak(utterance: SpeechSynthesisUtterance): void;
  cancel(): void;
  getVoices?(): readonly SpeechSynthesisVoice[];
};

export type BrowserVoiceOption = {
  readonly id: string;
  readonly label: string;
};

const DEFAULT_VOICE_ID = "system.voice.default";

function opaqueVoiceId(voice: SpeechSynthesisVoice): string {
  const input = `${voice.voiceURI}\u0000${voice.name}\u0000${voice.lang}\u0000${String(voice.localService)}`;
  let hash = 2_166_136_261;
  for (const character of input) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return `system.voice.${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export class BrowserSpeechPlayback {
  readonly #synthesis: SpeechSynthesisLike | null;
  readonly #utterance: (text: string) => SpeechSynthesisUtterance;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #active = false;
  #onEnd: (() => void) | null = null;

  constructor(
    options: {
      readonly synthesis?: SpeechSynthesisLike | null;
      readonly utterance?: (text: string) => SpeechSynthesisUtterance;
    } = {},
  ) {
    this.#synthesis =
      options.synthesis === undefined
        ? ((globalThis.speechSynthesis as SpeechSynthesisLike | undefined) ??
          null)
        : options.synthesis;
    this.#utterance =
      options.utterance ?? ((text) => new SpeechSynthesisUtterance(text));
  }

  availability(): { readonly available: boolean; readonly disclosure: string } {
    return this.#synthesis
      ? {
          available: true,
          disclosure:
            "Browser/system speech synthesis; local processing is not claimed.",
        }
      : {
          available: false,
          disclosure: "Browser/system speech synthesis unavailable.",
        };
  }

  voiceOptions(): readonly BrowserVoiceOption[] {
    if (!this.#synthesis) return [];
    return [
      { id: DEFAULT_VOICE_ID, label: "Browser/system default voice" },
      ...(this.#synthesis.getVoices?.() ?? []).map((voice) => ({
        id: opaqueVoiceId(voice),
        label: `${voice.name} · ${voice.lang || "language unspecified"}${
          voice.localService
            ? " · system-local"
            : " · processing location unverified"
        }`,
      })),
    ];
  }

  speak(
    text: string,
    voiceId?: string | null,
    onEnd?: () => void,
  ): Promise<void> {
    const synthesis = this.#synthesis;
    if (!synthesis)
      return Promise.reject(
        new BrowserVoiceError(
          "tts-unavailable",
          "Browser/system speech synthesis is unavailable.",
        ),
      );
    this.stop();
    return new Promise((resolve, reject) => {
      const utterance = this.#utterance(text.slice(0, 16_384));
      const voice =
        voiceId && voiceId !== DEFAULT_VOICE_ID
          ? (synthesis.getVoices?.() ?? []).find(
              (candidate) => opaqueVoiceId(candidate) === voiceId,
            )
          : undefined;
      if (voiceId && voiceId !== DEFAULT_VOICE_ID && !voice) {
        reject(
          new BrowserVoiceError(
            "tts-unavailable",
            "The selected browser/system voice is no longer available.",
          ),
        );
        return;
      }
      if (voice) utterance.voice = voice;
      this.#active = true;
      this.#onEnd = onEnd ?? null;
      const finish = () => {
        if (!this.#active) return;
        this.#active = false;
        const callback = this.#onEnd;
        this.#onEnd = null;
        callback?.();
      };
      utterance.onstart = () => {
        if (this.#timer) clearTimeout(this.#timer);
        this.#timer = null;
        resolve();
      };
      utterance.onend = finish;
      utterance.onerror = () => {
        if (this.#timer) clearTimeout(this.#timer);
        this.#timer = null;
        finish();
        reject(
          new BrowserVoiceError(
            "tts-failed",
            "Speech playback failed; text remains canonical.",
          ),
        );
      };
      this.#timer = setTimeout(() => {
        synthesis.cancel();
        finish();
        reject(
          new BrowserVoiceError(
            "tts-timeout",
            "Speech playback did not start within 5 seconds.",
          ),
        );
      }, 5_000);
      synthesis.speak(utterance);
    });
  }

  stop(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    this.#synthesis?.cancel();
    if (this.#active) {
      this.#active = false;
      const callback = this.#onEnd;
      this.#onEnd = null;
      callback?.();
    }
  }
}

export function exactSessionBinding(
  expected: WorldAgentSession,
  current: WorldAgentSession,
): boolean {
  return (
    expected.sessionId === current.sessionId &&
    expected.adapterId === current.adapterId &&
    (expected.adapterRootSessionRef ?? expected.adapterSessionRef) ===
      (current.adapterRootSessionRef ?? current.adapterSessionRef) &&
    expected.adapterSessionRef === current.adapterSessionRef &&
    expected.mode === current.mode &&
    expected.permissionRevision === current.permissionRevision &&
    expected.capabilitySnapshotHash === current.capabilitySnapshotHash
  );
}
