import type { VoiceJourneyState } from "./voice-state.js";

export const PHASE15_VOICE_FIXTURE: VoiceJourneyState = {
  provider: {
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
  },
  browserDevice: "Browser-selected microphone",
  browserPermission: "granted",
  captureState: "final",
  finalTranscript: "Review this editable final transcript before sending.",
  canonicalReply:
    "Canonical Hermes text remains available with or without speech.",
  playback: "idle",
  ttsAvailable: true,
  ttsDisclosure:
    "Browser/system speech synthesis; local processing is not claimed.",
  voiceOptions: [
    { id: "system.voice.default", label: "Browser/system default voice" },
  ],
  selectedVoiceId: "system.voice.default",
  voiceProposal: {
    voiceId: "system.voice.en-US-neutral-1",
    label: "System neutral voice",
    sourceDisclosure:
      "Explicit agent self-description proposal; no transcript or private profile inference.",
  },
  voiceConsent: "pending",
  recovery: "Current · no capture or playback recovered",
  status: "Final transcript is editable. Raw audio has been released.",
  busy: false,
};
