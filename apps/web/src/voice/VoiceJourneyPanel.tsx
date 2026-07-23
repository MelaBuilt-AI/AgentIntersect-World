import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VoicePreference } from "@agentintersect-world/voice";

import {
  AgentSessionClient,
  type WorldAgentSession,
} from "../sessions/session-client.js";
import {
  BrowserSpeechPlayback,
  VoiceCaptureController,
  exactSessionBinding,
} from "./browser-voice.js";
import { VoiceClient } from "./voice-client.js";
import {
  createInitialVoiceJourneyState,
  type VoiceJourneyState,
} from "./voice-state.js";

export type { VoiceJourneyState } from "./voice-state.js";

export type VoiceJourneyAction =
  | "enable"
  | "start"
  | "stop"
  | "send"
  | "cancel"
  | "speak"
  | "stop-playback"
  | "preview-voice"
  | "accept-voice"
  | "change-voice"
  | "decline-voice"
  | "revoke-voice";

const buttonClass = (enabled: boolean) =>
  enabled
    ? "voice-primary voice-primary--enabled"
    : "voice-primary voice-primary--disabled";

export function VoiceJourneyExperience({
  state,
  onAction,
  onTranscript,
  onVoiceSelection = () => undefined,
}: {
  readonly state: VoiceJourneyState;
  readonly onAction: (action: VoiceJourneyAction) => void;
  readonly onTranscript: (text: string) => void;
  readonly onVoiceSelection?: (voiceId: string) => void;
}) {
  const step = (number: number, title: string, content: React.ReactNode) => (
    <li className="voice-step__item" data-step={number}>
      <h4>
        {number}. {title}
      </h4>
      {content}
    </li>
  );
  const canCapture =
    state.provider.available &&
    state.captureState !== "listening" &&
    !state.busy;
  const listening = state.captureState === "listening";
  const canSend =
    state.captureState === "final" &&
    state.finalTranscript.trim().length > 0 &&
    !state.busy;
  const canSpeak =
    state.ttsAvailable &&
    !!state.canonicalReply &&
    state.playback !== "speaking" &&
    state.voiceConsent !== "revoked";
  return (
    <section className="voice-journey" aria-label="Phase 15 voice journey">
      <header>
        <p>Phase 15 · push-to-talk only · typed text always available</p>
        <h3>Voice, captions, and consentful presence</h3>
        <strong>{state.recovery}</strong>
      </header>
      <ol className="voice-steps">
        {step(
          1,
          "Inspect provider and device disclosure",
          <dl className="voice-disclosure">
            <div>
              <dt>Provider</dt>
              <dd>whisper.cpp v1.9.1 · base.en · whisper-cli</dd>
            </div>
            <div>
              <dt>Processing</dt>
              <dd>Local process · English only · no listener</dd>
            </div>
            <div>
              <dt>Browser device</dt>
              <dd>{state.browserDevice}</dd>
            </div>
            <div>
              <dt>Browser permission</dt>
              <dd>{state.browserPermission}</dd>
            </div>
            <div>
              <dt>Data sent</dt>
              <dd>
                App-owned 16-bit PCM WAV, 16 kHz mono, to the local World server
              </dd>
            </div>
            <div>
              <dt>Retention</dt>
              <dd>
                Raw audio and provider payload are volatile until accepted text
                send
              </dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>
                {state.provider.available
                  ? "Available after exact re-attestation"
                  : `Unavailable: ${state.provider.reason}`}
              </dd>
            </div>
            <div>
              <dt>Machine boundary</dt>
              <dd>Raw audio never leaves this machine</dd>
            </div>
          </dl>,
        )}
        {step(
          2,
          "Enable microphone explicitly",
          <button
            type="button"
            className={buttonClass(canCapture)}
            disabled={!canCapture}
            onClick={() => onAction("enable")}
          >
            Enable microphone for this activation
          </button>,
        )}
        {step(
          3,
          "Push and hold to talk",
          <div>
            <button
              type="button"
              className={buttonClass(canCapture || listening)}
              disabled={!canCapture && !listening}
              aria-keyshortcuts="Space"
              onPointerDown={() => onAction("start")}
              onPointerUp={() => onAction("stop")}
              onPointerCancel={() => onAction("cancel")}
              onKeyDown={(event) => {
                if (event.code === "Space" && !event.repeat) onAction("start");
              }}
              onKeyUp={(event) => {
                if (event.code === "Space") onAction("stop");
              }}
            >
              {listening ? "Listening · release to stop" : "Hold to talk"}
            </button>
            <span>
              Press and hold Space or touch/hold. No background or wake-word
              capture.
            </span>
          </div>,
        )}
        {step(
          4,
          "Stop capture",
          <button
            type="button"
            className={buttonClass(listening)}
            disabled={!listening}
            onClick={() => onAction("stop")}
          >
            Stop capture now
          </button>,
        )}
        {step(
          5,
          "Review volatile captions",
          <div aria-live="polite">
            <strong>Lexical partial captions unavailable</strong>
            <p>
              Capture progress is not transcript text. The real provider returns
              final text only.
            </p>
            <p>Status: {state.captureState}</p>
          </div>,
        )}
        {step(
          6,
          "Edit final transcript",
          <label>
            Final caption (editable)
            <textarea
              value={state.finalTranscript}
              maxLength={16_384}
              disabled={state.captureState !== "final"}
              onChange={(event) => onTranscript(event.target.value)}
            />
          </label>,
        )}
        {step(
          7,
          "Send or cancel",
          <div>
            <button
              type="button"
              className={buttonClass(canSend)}
              disabled={!canSend}
              onClick={() => onAction("send")}
            >
              Send through exact text path
            </button>
            <button
              type="button"
              className={buttonClass(state.captureState !== "idle")}
              disabled={state.captureState === "idle"}
              onClick={() => onAction("cancel")}
            >
              Cancel and discard utterance
            </button>
          </div>,
        )}
        {step(
          8,
          "Receive canonical text and captions",
          <div aria-live="polite">
            <strong>Canonical Hermes reply</strong>
            <p>
              {state.canonicalReply ||
                "No accepted voice turn yet. Typed chat remains available."}
            </p>
          </div>,
        )}
        {step(
          9,
          "Speak reply optionally",
          <div>
            <p>{state.ttsDisclosure}</p>
            <label>
              Select browser/system voice
              <select
                value={state.selectedVoiceId ?? ""}
                disabled={
                  !state.ttsAvailable || state.voiceOptions.length === 0
                }
                onChange={(event) => onVoiceSelection(event.target.value)}
              >
                {state.voiceOptions.length === 0 ? (
                  <option value="">No browser/system voices available</option>
                ) : null}
                {state.voiceOptions.length > 0 &&
                state.selectedVoiceId === null ? (
                  <option value="">No voice selected</option>
                ) : null}
                {state.voiceOptions.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={buttonClass(canSpeak)}
              disabled={!canSpeak}
              onClick={() => onAction("speak")}
            >
              Speak canonical reply
            </button>
            {state.voiceProposal ? (
              <div className="voice-consent">
                <p>{state.voiceProposal.sourceDisclosure}</p>
                <span>{state.voiceProposal.label}</span>
                <button type="button" onClick={() => onAction("preview-voice")}>
                  Preview voice
                </button>
                <button type="button" onClick={() => onAction("accept-voice")}>
                  Accept voice
                </button>
                <button type="button" onClick={() => onAction("change-voice")}>
                  Change voice
                </button>
                <button type="button" onClick={() => onAction("decline-voice")}>
                  Decline voice
                </button>
                <button type="button" onClick={() => onAction("revoke-voice")}>
                  Revoke voice
                </button>
                <span>Consent: {state.voiceConsent}</span>
              </div>
            ) : (
              <p>No explicit bounded voice proposal is available.</p>
            )}
          </div>,
        )}
        {step(
          10,
          "Interrupt or stop playback",
          <button
            type="button"
            className={buttonClass(
              state.playback === "speaking" || state.playback === "requesting",
            )}
            disabled={
              state.playback !== "speaking" && state.playback !== "requesting"
            }
            onClick={() => onAction("stop-playback")}
          >
            Stop playback / barge in
          </button>,
        )}
      </ol>
      <div className="voice-results" role="status" aria-live="polite">
        <span>voice_result_</span>
        <strong>{state.status}</strong>
      </div>
    </section>
  );
}

export function VoiceJourneyPanel({
  session,
  proposal = null,
  onCanonicalTurn,
}: {
  readonly session: WorldAgentSession;
  readonly proposal?: VoiceJourneyState["voiceProposal"];
  readonly onCanonicalTurn: (
    operatorText: string,
    assistantText: string,
  ) => void;
}) {
  const voiceClient = useMemo(() => new VoiceClient(), []);
  const sessionClient = useMemo(() => new AgentSessionClient(), []);
  const playback = useMemo(() => new BrowserSpeechPlayback(), []);
  const [state, setState] = useState(() =>
    createInitialVoiceJourneyState(proposal, playback),
  );
  const transcriptionAbort = useRef<AbortController | null>(null);
  const transcribeWav = useCallback(
    async (
      wav: Uint8Array,
      reason: "operator" | "time-ceiling" | "size-ceiling" = "operator",
    ) => {
      transcriptionAbort.current?.abort();
      const controller = new AbortController();
      transcriptionAbort.current = controller;
      setState((current) => ({
        ...current,
        captureState: "transcribing",
        busy: true,
        status:
          reason === "operator"
            ? "Capture stopped; local final transcription is running."
            : `${reason === "time-ceiling" ? "30-second" : "4 MiB"} capture ceiling reached; local final transcription is running.`,
      }));
      try {
        const result = await voiceClient.transcribe(
          session,
          wav,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setState((current) => ({
          ...current,
          busy: false,
          captureState: "final",
          finalTranscript: result.finalText,
          status: `Final transcript ready in ${Math.round(result.elapsedMs)} ms; edit before send.`,
        }));
      } catch (error) {
        if (controller.signal.aborted) return;
        setState((current) => ({
          ...current,
          busy: false,
          captureState: "failed",
          finalTranscript: "",
          status:
            error instanceof Error ? error.message : "Transcription failed.",
        }));
      } finally {
        if (transcriptionAbort.current === controller)
          transcriptionAbort.current = null;
        wav.fill(0);
        await voiceClient
          .markActivity(session.sessionId, null)
          .catch(() => undefined);
      }
    },
    [session, voiceClient],
  );
  const capture = useMemo(
    () =>
      new VoiceCaptureController({
        stopPlayback: () => playback.stop(),
        onAutomaticStop: (wav, reason) => transcribeWav(wav, reason),
      }),
    [playback, transcribeWav],
  );

  useEffect(() => {
    let active = true;
    void Promise.all([
      voiceClient.disclosure(),
      voiceClient.preference(session.sessionId).catch(() => null),
      voiceClient.state().catch(() => null),
    ])
      .then(([provider, preference, voiceState]) => {
        if (!active) return;
        const interrupted = voiceState?.operations.find(
          (operation) => operation.outcome === "interrupted",
        );
        setState((current) => ({
          ...current,
          provider,
          voiceConsent: preference?.voiceConsent ?? current.voiceConsent,
          selectedVoiceId:
            preference?.approvedVoiceId &&
            current.voiceOptions.some(
              (voice) => voice.id === preference.approvedVoiceId,
            )
              ? preference.approvedVoiceId
              : current.selectedVoiceId,
          recovery: interrupted
            ? `Previous / recovered · ${interrupted.detail}`
            : current.recovery,
          status: provider.available
            ? "Provider re-attested. Explicit microphone enable is available."
            : `Provider unavailable: ${provider.reason}`,
        }));
      })
      .catch(() => {
        if (active)
          setState((current) => ({
            ...current,
            status:
              "Voice disclosure is unavailable; typed text remains available.",
          }));
      });
    return () => {
      active = false;
      capture.cancel();
      transcriptionAbort.current?.abort();
      transcriptionAbort.current = null;
      playback.stop();
      void voiceClient
        .markActivity(session.sessionId, null)
        .catch(() => undefined);
    };
  }, [capture, playback, session.sessionId, voiceClient]);

  const preference = (
    voiceConsent: VoicePreference["voiceConsent"],
    approvedVoiceId: string | null,
  ): VoicePreference => ({
    schema: "aiw.voice-preference/0.15",
    sessionId: session.sessionId,
    providerId: "whisper.cpp-v1.9.1-base.en",
    microphoneEnabled: state.browserPermission === "granted",
    ttsEnabled: state.ttsAvailable,
    approvedVoiceId,
    voiceConsent,
    updatedAt: new Date().toISOString(),
  });

  const act = (action: VoiceJourneyAction) => {
    if (action === "enable") {
      setState((current) => ({
        ...current,
        busy: true,
        status: "Requesting browser microphone permission…",
      }));
      void capture
        .enable()
        .then((snapshot) =>
          setState((current) => ({
            ...current,
            busy: false,
            browserDevice: snapshot.deviceLabel,
            browserPermission: snapshot.permission,
            captureState: "enabled",
            status:
              "Microphone enabled for push-to-talk. No capture is active.",
          })),
        )
        .catch((error: unknown) =>
          setState((current) => ({
            ...current,
            busy: false,
            captureState: "failed",
            browserPermission: capture.snapshot().permission,
            status:
              error instanceof Error
                ? error.message
                : "Microphone enable failed.",
          })),
        );
      return;
    }
    if (action === "start") {
      playback.stop();
      setState((current) => ({
        ...current,
        playback: "stopped",
        status: "Starting explicit push-to-talk capture…",
      }));
      void capture
        .start()
        .then(async () => {
          await voiceClient.markActivity(session.sessionId, "capture");
          setState((current) => ({
            ...current,
            captureState: "listening",
            status: "Listening from an authoritative capture event.",
          }));
        })
        .catch((error: unknown) => {
          capture.cancel();
          setState((current) => ({
            ...current,
            captureState: "failed",
            status: error instanceof Error ? error.message : "Capture failed.",
          }));
        });
      return;
    }
    if (action === "stop") {
      void capture
        .stop()
        .then(transcribeWav)
        .catch((error: unknown) =>
          setState((current) => ({
            ...current,
            busy: false,
            captureState: "failed",
            finalTranscript: "",
            status:
              error instanceof Error ? error.message : "Transcription failed.",
          })),
        );
      return;
    }
    if (action === "cancel") {
      capture.cancel();
      transcriptionAbort.current?.abort();
      transcriptionAbort.current = null;
      void voiceClient
        .markActivity(session.sessionId, null)
        .catch(() => undefined);
      setState((current) => ({
        ...current,
        busy: false,
        captureState: "cancelled",
        finalTranscript: "",
        status:
          "Utterance cancelled and discarded. Typed text remains available.",
      }));
      return;
    }
    if (action === "send") {
      const accepted = state.finalTranscript.trim();
      setState((current) => ({
        ...current,
        busy: true,
        status:
          "Re-attesting exact session, mode, permission, and capabilities…",
      }));
      void sessionClient
        .status(session.sessionId)
        .then(async (current) => {
          if (!exactSessionBinding(session, current))
            throw new Error("Voice binding changed; reconnect before sending.");
          return voiceClient.sendAccepted(current, accepted);
        })
        .then((result) => {
          onCanonicalTurn(accepted, result.finalText);
          setState((current) => ({
            ...current,
            busy: false,
            canonicalReply: result.finalText,
            captureState: "idle",
            finalTranscript: "",
            status:
              "Accepted text and canonical Hermes reply received through AgentSessionGateway.sendText.",
          }));
        })
        .catch((error: unknown) =>
          setState((current) => ({
            ...current,
            busy: false,
            status:
              error instanceof Error
                ? error.message
                : "Voice send failed closed.",
          })),
        );
      return;
    }
    if (action === "speak" || action === "preview-voice") {
      if (action === "speak" && state.voiceConsent === "revoked") return;
      const text =
        action === "preview-voice"
          ? "This is the selected browser system voice preview."
          : state.canonicalReply;
      setState((current) => ({
        ...current,
        playback: "requesting",
        status: "Browser/system speech requested by the operator.",
      }));
      void voiceClient
        .markActivity(session.sessionId, "playback")
        .then(() =>
          playback.speak(text, state.selectedVoiceId, () => {
            void voiceClient
              .markActivity(session.sessionId, null)
              .catch(() => undefined);
            setState((current) => ({
              ...current,
              playback: "stopped",
              status:
                "Speech playback ended; canonical text remains available.",
            }));
          }),
        )
        .then(() =>
          setState((current) => ({
            ...current,
            playback: "speaking",
            status: "Speaking from an authoritative playback event.",
          })),
        )
        .catch((error: unknown) => {
          void voiceClient
            .markActivity(session.sessionId, null)
            .catch(() => undefined);
          setState((current) => ({
            ...current,
            playback: "failed",
            status:
              error instanceof Error
                ? error.message
                : "Playback failed; captions remain.",
          }));
        });
      return;
    }
    if (action === "stop-playback") {
      playback.stop();
      void voiceClient
        .markActivity(session.sessionId, null)
        .catch(() => undefined);
      setState((current) => ({
        ...current,
        playback: "stopped",
        status: "Playback stopped; canonical text and captions are unchanged.",
      }));
      return;
    }
    const consent =
      action === "accept-voice"
        ? "accepted"
        : action === "decline-voice"
          ? "declined"
          : action === "revoke-voice"
            ? "revoked"
            : "pending";
    if (action === "revoke-voice") {
      playback.stop();
      setState((current) => ({
        ...current,
        playback: "stopped",
        voiceConsent: "revoked",
        selectedVoiceId: null,
        status: "Voice consent revoked and use disabled immediately.",
      }));
      void voiceClient
        .markActivity(session.sessionId, null)
        .catch(() => undefined);
      void voiceClient.revokeVoice(session.sessionId).catch(() =>
        setState((current) => ({
          ...current,
          status:
            "Voice revoke persistence failed closed; local use remains disabled.",
        })),
      );
      return;
    }
    if (action === "change-voice") {
      setState((current) => ({
        ...current,
        voiceConsent: "pending",
        status:
          "Choose another browser/system voice; no choice is persisted until acceptance.",
      }));
      return;
    }
    void voiceClient
      .savePreference(
        preference(
          consent,
          consent === "accepted" ? state.selectedVoiceId : null,
        ),
      )
      .then(() =>
        setState((current) => ({
          ...current,
          voiceConsent: consent,
          status:
            consent === "accepted"
              ? "Opaque voice ID accepted."
              : "Voice proposal declined.",
        })),
      )
      .catch(() =>
        setState((current) => ({
          ...current,
          status: "Voice consent update failed closed.",
        })),
      );
  };

  return (
    <VoiceJourneyExperience
      state={state}
      onAction={act}
      onTranscript={(finalTranscript) =>
        setState((current) => ({
          ...current,
          finalTranscript,
          status:
            "Edited final transcript is not sent until explicit acceptance.",
        }))
      }
      onVoiceSelection={(selectedVoiceId) =>
        setState((current) => ({
          ...current,
          selectedVoiceId,
          voiceConsent: "pending",
          status:
            "Browser/system voice changed; preview and explicit acceptance remain required.",
        }))
      }
    />
  );
}
