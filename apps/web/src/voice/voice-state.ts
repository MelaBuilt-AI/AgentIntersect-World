import type { VoiceProviderAttestation } from "@agentintersect-world/voice";

import type {
  BrowserSpeechPlayback,
  BrowserVoiceOption,
} from "./browser-voice.js";

export type VoiceJourneyState = {
  readonly provider: VoiceProviderAttestation;
  readonly browserDevice: string;
  readonly browserPermission: "unknown" | "granted" | "denied";
  readonly captureState:
    | "idle"
    | "enabled"
    | "listening"
    | "transcribing"
    | "final"
    | "cancelled"
    | "failed";
  readonly finalTranscript: string;
  readonly canonicalReply: string;
  readonly playback: "idle" | "requesting" | "speaking" | "stopped" | "failed";
  readonly ttsAvailable: boolean;
  readonly ttsDisclosure: string;
  readonly voiceOptions: readonly BrowserVoiceOption[];
  readonly selectedVoiceId: string | null;
  readonly voiceProposal: null | {
    readonly voiceId: string;
    readonly label: string;
    readonly sourceDisclosure: string;
  };
  readonly voiceConsent: "pending" | "accepted" | "declined" | "revoked";
  readonly recovery: string;
  readonly status: string;
  readonly busy: boolean;
};

const unavailableProvider: VoiceProviderAttestation = {
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
};

export function createInitialVoiceJourneyState(
  proposal: VoiceJourneyState["voiceProposal"],
  playback: Pick<BrowserSpeechPlayback, "availability" | "voiceOptions">,
): VoiceJourneyState {
  const tts = playback.availability();
  const voiceOptions = playback.voiceOptions();
  return {
    provider: unavailableProvider,
    browserDevice:
      "Browser default microphone (label unavailable until permission)",
    browserPermission: "unknown",
    captureState: "idle",
    finalTranscript: "",
    canonicalReply: "",
    playback: "idle",
    ttsAvailable: tts.available,
    ttsDisclosure: tts.disclosure,
    voiceOptions,
    selectedVoiceId: voiceOptions[0]?.id ?? null,
    voiceProposal: proposal,
    voiceConsent: "pending",
    recovery: "Current · microphone and playback never auto-resume",
    status: "Inspect disclosure before enabling the microphone.",
    busy: false,
  };
}
