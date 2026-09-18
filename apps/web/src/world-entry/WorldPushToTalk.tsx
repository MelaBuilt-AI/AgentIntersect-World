import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { VoiceProviderAttestation } from "@agentintersect-world/voice";

import type { WorldAgentSession } from "../sessions/session-client.js";
import {
  BrowserVoiceError,
  VoiceCaptureController,
} from "../voice/browser-voice.js";
import { LocalVoiceSetup } from "./LocalVoiceSetup.js";
import { VoiceClient } from "../voice/voice-client.js";

type VoicePhase =
  | "idle"
  | "disclosing"
  | "enabling"
  | "enabled"
  | "listening"
  | "transcribing"
  | "final"
  | "cancelled"
  | "failed"
  | "unavailable";

type WorldVoiceClient = Pick<
  VoiceClient,
  "disclosure" | "markActivity" | "transcribe"
>;

export function WorldPushToTalk({
  available,
  session,
  onAcceptedText,
  voiceClient: providedVoiceClient,
  captureController: providedCapture,
}: {
  readonly available: boolean;
  readonly session: WorldAgentSession | null;
  readonly onAcceptedText: (text: string) => void;
  readonly voiceClient?: WorldVoiceClient;
  readonly captureController?: VoiceCaptureController;
}) {
  const voiceClient = useMemo(
    () => providedVoiceClient ?? new VoiceClient(),
    [providedVoiceClient],
  );
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [provider, setProvider] = useState<VoiceProviderAttestation | null>(
    null,
  );
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [caption, setCaption] = useState("");
  const [inputLevel, setInputLevel] = useState(0);
  const [voiceStatus, setVoiceStatus] = useState(
    "Microphone is off. First use shows local voice disclosure.",
  );
  const phaseRef = useRef<VoicePhase>(phase);
  const holding = useRef(false);
  const [handsFree, setHandsFree] = useState(false);
  const handsFreeRef = useRef(false);
  const sendAfterTranscription = useRef(false);
  const acceptedText = useRef(onAcceptedText);
  useEffect(() => {
    acceptedText.current = onAcceptedText;
  }, [onAcceptedText]);
  const stopping = useRef(false);
  const utteranceGeneration = useRef(0);
  const activeUtterance = useRef<number | null>(null);
  const transcriptionAbort = useRef<AbortController | null>(null);
  const activityOwned = useRef(false);

  const updatePhase = useCallback((next: VoicePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const clearActivity = useCallback(async () => {
    if (!session || !activityOwned.current) return;
    activityOwned.current = false;
    await voiceClient
      .markActivity(session.sessionId, null)
      .catch(() => undefined);
  }, [session, voiceClient]);

  const transcribeWav = useCallback(
    async (
      wav: Uint8Array,
      reason: "operator" | "time-ceiling" | "size-ceiling" = "operator",
      generation = utteranceGeneration.current,
    ) => {
      if (!session || generation !== utteranceGeneration.current) {
        wav.fill(0);
        return;
      }
      transcriptionAbort.current?.abort();
      const controller = new AbortController();
      transcriptionAbort.current = controller;
      updatePhase("transcribing");
      setCaption("");
      setVoiceStatus(
        reason === "operator"
          ? "Transcribing locally; no partial transcript is shown."
          : `${reason === "time-ceiling" ? "30-second" : "4 MiB"} capture ceiling reached; transcribing one local final caption.`,
      );
      try {
        const result = await voiceClient.transcribe(
          session,
          wav,
          controller.signal,
        );
        if (
          controller.signal.aborted ||
          generation !== utteranceGeneration.current
        )
          return;
        if (sendAfterTranscription.current) {
          sendAfterTranscription.current = false;
          handsFreeRef.current = false;
          setHandsFree(false);
          setCaption("");
          updatePhase("enabled");
          setVoiceStatus("Voice text sent. Microphone is not capturing.");
          acceptedText.current(result.finalText);
        } else {
          setCaption(result.finalText);
          updatePhase("final");
          setVoiceStatus("Final caption ready. Edit it before Send or Cancel.");
        }
      } catch (error) {
        if (
          controller.signal.aborted ||
          generation !== utteranceGeneration.current
        )
          return;
        sendAfterTranscription.current = false;
        handsFreeRef.current = false;
        setHandsFree(false);
        updatePhase("failed");
        setVoiceStatus(
          error instanceof Error
            ? error.message
            : "Local transcription failed. Typed text remains ready.",
        );
      } finally {
        wav.fill(0);
        if (transcriptionAbort.current === controller)
          transcriptionAbort.current = null;
        await clearActivity();
      }
    },
    [clearActivity, session, updatePhase, voiceClient],
  );

  const [capture, setCapture] = useState<VoiceCaptureController | null>(
    providedCapture ?? null,
  );

  useEffect(() => {
    const next =
      providedCapture ??
      new VoiceCaptureController({
        onAutomaticStop: (wav, reason) => {
          holding.current = false;
          const generation = activeUtterance.current;
          activeUtterance.current = null;
          if (
            generation === null ||
            generation !== utteranceGeneration.current
          ) {
            wav.fill(0);
            return;
          }
          return transcribeWav(wav, reason, generation);
        },
        onTerminated: (reason) => {
          holding.current = false;
          utteranceGeneration.current += 1;
          activeUtterance.current = null;
          setMicrophoneEnabled(false);
          handsFreeRef.current = false;
          sendAfterTranscription.current = false;
          setHandsFree(false);
          setDisclosureOpen(true);
          transcriptionAbort.current?.abort();
          transcriptionAbort.current = null;
          setCaption("");
          updatePhase("failed");
          setVoiceStatus(
            reason === "lost-device"
              ? "Microphone device was lost; capture was discarded. Typed text remains ready."
              : "Voice capture ended; typed text remains ready.",
          );
          void clearActivity();
        },
      });
    setCapture(next);
    return () => {
      holding.current = false;
      utteranceGeneration.current += 1;
      activeUtterance.current = null;
      next.cancel();
      transcriptionAbort.current?.abort();
      transcriptionAbort.current = null;
      void clearActivity();
    };
  }, [clearActivity, providedCapture, transcribeWav, updatePhase]);

  useEffect(() => {
    if (phase !== "listening" || !capture) return;
    const timer = window.setInterval(() => {
      setInputLevel(Math.min(1, capture.snapshot().inputLevel * 4));
    }, 100);
    return () => window.clearInterval(timer);
  }, [capture, phase]);

  const recordingMeter =
    phase === "listening" ? (
      <div className="world-voice-recording">
        <div
          className="world-voice-meter"
          role="meter"
          aria-label="Microphone input level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(inputLevel * 100)}
        >
          {[0.35, 0.55, 0.75, 0.9, 1, 0.9, 0.75, 0.55, 0.35].map(
            (scale, index) => (
              <span
                key={index}
                aria-hidden="true"
                style={{ height: `${3 + inputLevel * scale * 25}px` }}
              />
            ),
          )}
        </div>
        <span>
          Recording ·{" "}
          {inputLevel > 0.04 ? "Audio detected" : "Waiting for audio"}
        </span>
      </div>
    ) : null;

  const browserAvailable = capture?.availability().available === true;
  const canUseVoice = available && Boolean(session) && browserAvailable;
  const canHold =
    canUseVoice &&
    Boolean(capture) &&
    provider?.available === true &&
    microphoneEnabled &&
    (phase === "enabled" || phase === "final" || phase === "failed");

  const revealDisclosure = useCallback(() => {
    if (!canUseVoice || disclosureOpen || phaseRef.current === "disclosing")
      return;
    setDisclosureOpen(true);
    if (provider) {
      updatePhase(provider.available ? "idle" : "unavailable");
      setVoiceStatus(
        provider.available
          ? "Local provider ready. Explicitly enable browser microphone access."
          : `Local voice provider unavailable: ${provider.reason}`,
      );
      return;
    }
    updatePhase("disclosing");
    setVoiceStatus("Checking the local Whisper provider; microphone is off.");
    void voiceClient
      .disclosure()
      .then((next) => {
        setProvider(next);
        updatePhase(next.available ? "idle" : "unavailable");
        setVoiceStatus(
          next.available
            ? "Local provider ready. Explicitly enable browser microphone access."
            : `Local voice provider unavailable: ${next.reason}`,
        );
      })
      .catch(() => {
        updatePhase("unavailable");
        setVoiceStatus(
          "Local voice disclosure is unavailable. Typed text remains ready.",
        );
      });
  }, [canUseVoice, disclosureOpen, provider, updatePhase, voiceClient]);

  const enableMicrophone = () => {
    if (!capture || !provider?.available || phaseRef.current === "enabling")
      return;
    updatePhase("enabling");
    setVoiceStatus("Requesting browser microphone permission…");
    void capture
      .enable()
      .then(() => {
        setDisclosureOpen(false);
        setMicrophoneEnabled(true);
        updatePhase("enabled");
        setVoiceStatus("Microphone enabled. Hold Push to talk to capture.");
      })
      .catch((error: unknown) => {
        updatePhase(
          error instanceof BrowserVoiceError &&
            error.code === "permission-denied"
            ? "unavailable"
            : "failed",
        );
        setVoiceStatus(
          error instanceof Error
            ? error.message
            : "Microphone enable failed. Typed text remains ready.",
        );
      });
  };

  const stopCapture = useCallback(() => {
    if (
      !capture ||
      stopping.current ||
      capture.snapshot().state !== "listening"
    )
      return;
    const generation = activeUtterance.current;
    activeUtterance.current = null;
    stopping.current = true;
    updatePhase("transcribing");
    void capture
      .stop()
      .then((wav) => {
        if (generation === null || generation !== utteranceGeneration.current) {
          wav.fill(0);
          return;
        }
        return transcribeWav(wav, "operator", generation);
      })
      .catch((error: unknown) => {
        if (generation !== utteranceGeneration.current) return;
        sendAfterTranscription.current = false;
        handsFreeRef.current = false;
        setHandsFree(false);
        updatePhase("failed");
        setVoiceStatus(
          error instanceof Error
            ? error.message
            : "Voice capture failed. Typed text remains ready.",
        );
      })
      .finally(() => {
        stopping.current = false;
      });
  }, [capture, transcribeWav, updatePhase]);

  const startCapture = useCallback(
    (continuous = false) => {
      if (!capture || !canHold || holding.current) return;
      handsFreeRef.current = continuous;
      setHandsFree(continuous);
      sendAfterTranscription.current = false;
      const generation = ++utteranceGeneration.current;
      activeUtterance.current = generation;
      holding.current = true;
      transcriptionAbort.current?.abort();
      transcriptionAbort.current = null;
      setCaption("");
      setInputLevel(0);
      setVoiceStatus("Starting push-to-talk capture…");
      void capture
        .start()
        .then(async () => {
          if (generation !== utteranceGeneration.current) {
            capture.cancel();
            return;
          }
          if (!session) return;
          activityOwned.current = true;
          await voiceClient.markActivity(session.sessionId, "capture");
          if (generation !== utteranceGeneration.current) {
            capture.cancel();
            return;
          }
          if (capture.snapshot().state !== "listening") return;
          if (!holding.current) {
            stopCapture();
            return;
          }
          updatePhase("listening");
          setVoiceStatus(
            handsFreeRef.current
              ? "Hands-free recording. Transcribe to review before sending, Send to send now, or Cancel to discard. Maximum 30 seconds."
              : "Listening while held. Release to transcribe.",
          );
        })
        .catch((error: unknown) => {
          if (generation !== utteranceGeneration.current) return;
          holding.current = false;
          activeUtterance.current = null;
          capture.cancel();
          void clearActivity();
          updatePhase("failed");
          setVoiceStatus(
            error instanceof Error
              ? error.message
              : "Voice capture failed. Typed text remains ready.",
          );
        });
    },
    [
      canHold,
      capture,
      clearActivity,
      session,
      stopCapture,
      updatePhase,
      voiceClient,
    ],
  );

  const releaseCapture = () => {
    if (!holding.current || handsFreeRef.current) return;
    holding.current = false;
    stopCapture();
  };

  const cancel = () => {
    handsFreeRef.current = false;
    sendAfterTranscription.current = false;
    setHandsFree(false);
    holding.current = false;
    utteranceGeneration.current += 1;
    activeUtterance.current = null;
    if (microphoneEnabled) capture?.cancel();
    transcriptionAbort.current?.abort();
    transcriptionAbort.current = null;
    setCaption("");
    setDisclosureOpen(false);
    updatePhase(microphoneEnabled ? "enabled" : "cancelled");
    setVoiceStatus(
      "Voice input cancelled and discarded. Typed text remains ready.",
    );
    void clearActivity();
  };

  const unavailableReason =
    !available || !session
      ? "Voice provider unavailable. Text chat remains ready."
      : !browserAvailable
        ? "Browser microphone capture unavailable. Text chat remains ready."
        : null;

  return (
    <div className="world-voice-input">
      <button
        type="button"
        className={
          canUseVoice
            ? "world-ptt world-action--enabled"
            : "world-ptt world-action--unavailable"
        }
        disabled={
          !canUseVoice || phase === "transcribing" || phase === "enabling"
        }
        aria-disabled={
          !canUseVoice || phase === "transcribing" || phase === "enabling"
        }
        aria-pressed={phase === "listening"}
        aria-describedby={
          unavailableReason ? "world-ptt-unavailable" : undefined
        }
        onClick={() => {
          if (!microphoneEnabled) revealDisclosure();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          if (!microphoneEnabled) revealDisclosure();
          else startCapture(true);
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          if (!microphoneEnabled) {
            revealDisclosure();
            return;
          }
          if (!canHold) return;
          event.preventDefault();
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Synthetic and assistive pointer events may not own browser capture.
          }
          startCapture();
        }}
        onPointerUp={(event) => {
          if (event.button !== 0) return;
          try {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          } catch {
            // Release still ends the utterance when pointer capture is absent.
          }
          releaseCapture();
        }}
        onPointerCancel={cancel}
        onKeyDown={(event) => {
          if (event.key !== " " || event.repeat) return;
          event.preventDefault();
          if (!microphoneEnabled) revealDisclosure();
          else startCapture();
        }}
        onKeyUp={(event) => {
          if (event.key !== " ") return;
          event.preventDefault();
          releaseCapture();
        }}
        onBlur={() => {
          if (holding.current && !handsFreeRef.current) cancel();
        }}
      >
        <small>L Click Hold</small>
        <span>{phase === "listening" ? "Listening" : "Push to Talk"}</span>
        <small>R Click = On</small>
      </button>
      {unavailableReason ? (
        <p id="world-ptt-unavailable" className="world-hud__voice-reason">
          {unavailableReason}
        </p>
      ) : null}
      {disclosureOpen ? (
        <section
          className="world-voice-surface"
          aria-label="Local voice disclosure"
          aria-live="polite"
        >
          <strong>Local voice input</strong>
          {!provider?.available ? (
            <LocalVoiceSetup
              onReady={() => {
                void voiceClient.disclosure().then(setProvider);
              }}
            />
          ) : null}
          <p>
            {provider
              ? `${provider.implementation} · ${provider.language} · final captions only. Raw audio stays on this machine and is volatile until text send.`
              : voiceStatus}
          </p>
          <p>
            Microphone access starts only after you choose Enable microphone.
          </p>
          <div>
            <button
              type="button"
              className={
                provider?.available
                  ? "world-action--enabled"
                  : "world-action--unavailable"
              }
              disabled={!provider?.available || phase === "enabling"}
              onClick={enableMicrophone}
            >
              Enable microphone
            </button>
            <button
              type="button"
              className="world-action--enabled"
              onClick={cancel}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : phase === "final" || handsFree ? (
        <section
          className="world-voice-surface"
          aria-label="Final voice caption"
          aria-live="polite"
        >
          {recordingMeter}
          {handsFree ? <p role="status">{voiceStatus}</p> : null}
          <label htmlFor="world-voice-caption">Final caption</label>
          <textarea
            id="world-voice-caption"
            value={caption}
            maxLength={4_000}
            disabled={phase !== "final"}
            placeholder={
              handsFree
                ? "Final transcript appears when recording ends."
                : undefined
            }
            autoFocus={!handsFree}
            onChange={(event) => setCaption(event.target.value)}
          />
          <div>
            <button
              type="button"
              className={
                caption.trim() || (handsFree && phase === "listening")
                  ? "world-action--enabled"
                  : "world-action--unavailable"
              }
              disabled={
                phase === "transcribing" ||
                (!caption.trim() && !(handsFree && phase === "listening"))
              }
              onClick={() => {
                if (handsFreeRef.current && phaseRef.current === "listening") {
                  sendAfterTranscription.current = true;
                  handsFreeRef.current = false;
                  holding.current = false;
                  stopCapture();
                  return;
                }
                const accepted = caption.trim();
                if (!accepted) return;
                handsFreeRef.current = false;
                sendAfterTranscription.current = false;
                setHandsFree(false);
                onAcceptedText(accepted);
                setCaption("");
                updatePhase("enabled");
                setVoiceStatus("Voice text sent. Microphone is not capturing.");
              }}
            >
              Send
            </button>
            {handsFree ? (
              <button
                type="button"
                className={
                  phase === "listening"
                    ? "world-action--enabled"
                    : "world-action--unavailable"
                }
                disabled={phase !== "listening"}
                onClick={() => {
                  if (phaseRef.current !== "listening") return;
                  sendAfterTranscription.current = false;
                  holding.current = false;
                  stopCapture();
                }}
              >
                Transcribe
              </button>
            ) : null}
            <button
              type="button"
              className="world-action--enabled"
              onClick={cancel}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : phase === "listening" ||
        phase === "transcribing" ||
        phase === "failed" ? (
        <section
          className="world-voice-surface"
          aria-label="Voice input status"
          role="status"
        >
          {recordingMeter}
          <p>{voiceStatus}</p>
          <button
            type="button"
            className="world-action--enabled"
            onClick={cancel}
          >
            Cancel
          </button>
        </section>
      ) : null}
    </div>
  );
}
