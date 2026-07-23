import { describe, expect, it, vi } from "vitest";

import {
  BrowserSpeechPlayback,
  VoiceCaptureController,
  exactSessionBinding,
} from "../src/voice/browser-voice.js";
import { inspectPcm16Wav } from "@agentintersect-world/voice";

describe("Phase 15 browser capture and playback", () => {
  it("truthfully reports permission denied, no device, and unsupported audio", async () => {
    const denied = new VoiceCaptureController({
      getUserMedia: vi
        .fn()
        .mockRejectedValue(new DOMException("denied", "NotAllowedError")),
    });
    await expect(denied.enable()).rejects.toMatchObject({
      code: "permission-denied",
    });

    const absent = new VoiceCaptureController({
      getUserMedia: vi
        .fn()
        .mockRejectedValue(new DOMException("missing", "NotFoundError")),
    });
    await expect(absent.enable()).rejects.toMatchObject({ code: "no-device" });
    expect(
      new VoiceCaptureController({ audioContext: null }).availability(),
    ).toMatchObject({
      available: false,
      reason: "unsupported-format",
    });
  });

  it("stops speech before capture and releases audio on cancel", async () => {
    const stopPlayback = vi.fn();
    const controller = new VoiceCaptureController({
      stopPlayback,
      fixtureSamples: new Float32Array(16_000),
    });
    await controller.enable();
    await controller.start();
    expect(stopPlayback).toHaveBeenCalledOnce();
    controller.cancel();
    expect(controller.snapshot()).toMatchObject({
      state: "cancelled",
      sampleCount: 0,
    });
  });

  it("enforces the local 30-second stop without waiting for provider progress", async () => {
    let callback: (() => void) | undefined;
    const automaticStop = vi.fn((wav: Uint8Array, reason: string) => {
      expect(inspectPcm16Wav(wav).sampleRate).toBe(16_000);
      expect(reason).toBe("time-ceiling");
    });
    const controller = new VoiceCaptureController({
      fixtureSamples: new Float32Array(16_000),
      onAutomaticStop: automaticStop,
      setTimer: (next) => {
        callback = next;
        return 1 as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => undefined,
    });
    await controller.enable();
    await controller.start();
    callback?.();
    await vi.waitFor(() => expect(automaticStop).toHaveBeenCalledOnce());
    expect(controller.snapshot()).toMatchObject({
      state: "stopped",
      sampleCount: 0,
      stopReason: "time-ceiling",
    });
  });

  it("re-attests every exact authority field", () => {
    const session = {
      schema: "aiw.agent-session/0.12" as const,
      sessionId: "11111111-1111-4111-8111-111111111111",
      adapterId: "hermes",
      adapterSessionRef: "effective",
      adapterRootSessionRef: "root",
      profile: "default",
      workspaceId: "workspace",
      repositoryRef: "repository",
      mode: "explore" as const,
      permissionRevision: 2,
      capabilitySnapshotHash: "a".repeat(64),
      continuity: "current",
      status: "ready",
    };
    expect(exactSessionBinding(session, { ...session })).toBe(true);
    expect(
      exactSessionBinding(session, {
        ...session,
        capabilitySnapshotHash: "b".repeat(64),
      }),
    ).toBe(false);
  });

  it("truthfully degrades unavailable/failing TTS and stops within the call", async () => {
    const unavailable = new BrowserSpeechPlayback({ synthesis: null });
    expect(unavailable.availability().available).toBe(false);
    await expect(
      unavailable.speak("caption stays canonical"),
    ).rejects.toMatchObject({
      code: "tts-unavailable",
    });

    const cancel = vi.fn();
    const playback = new BrowserSpeechPlayback({
      synthesis: { speak: vi.fn(), cancel, speaking: true },
      utterance: () => ({}) as SpeechSynthesisUtterance,
    });
    playback.stop();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("enumerates opaque browser voices and speaks with the explicitly selected one", async () => {
    const voices = [
      {
        name: "Voice A",
        lang: "en-US",
        voiceURI: "voice-a",
        localService: true,
        default: true,
      },
      {
        name: "Voice B",
        lang: "en-GB",
        voiceURI: "voice-b",
        localService: false,
        default: false,
      },
    ] as SpeechSynthesisVoice[];
    let utterance: SpeechSynthesisUtterance | undefined;
    const playback = new BrowserSpeechPlayback({
      synthesis: {
        speak: (value) => {
          utterance = value;
          queueMicrotask(() =>
            value.onstart?.(new Event("start") as SpeechSynthesisEvent),
          );
        },
        cancel: vi.fn(),
        speaking: false,
        getVoices: () => voices,
      },
      utterance: () => ({}) as SpeechSynthesisUtterance,
    });
    const options = playback.voiceOptions();
    expect(options).toHaveLength(3);
    expect(options[1]?.id).not.toContain("voice-a");
    await playback.speak("selected", options[2]?.id);
    expect(utterance?.voice).toBe(voices[1]);
  });
});
