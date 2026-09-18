import { describe, expect, it, vi } from "vitest";

import {
  BrowserSpeechPlayback,
  VoiceCaptureController,
  exactSessionBinding,
} from "../src/voice/browser-voice.js";
import {
  inspectPcm16Wav,
  MAX_ENCODED_AUDIO_BYTES,
} from "@agentintersect-world/voice";

describe("Phase 15 browser capture and playback", () => {
  it("reports actual microphone levels and clears them when recording ends", async () => {
    const processor = {
      onaudioprocess: null as
        | null
        | ((event: {
            inputBuffer: { getChannelData(channel: number): Float32Array };
          }) => void),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const track = { stop: vi.fn() };
    const controller = new VoiceCaptureController({
      getUserMedia: async () => ({ getTracks: () => [track] }),
      audioContext: () => ({
        sampleRate: 16_000,
        destination: {},
        createMediaStreamSource: () => ({
          connect: vi.fn(),
          disconnect: vi.fn(),
        }),
        createScriptProcessor: () => processor,
        close: async () => undefined,
      }),
    });
    await controller.enable();
    await controller.start();
    const feed = (level: number) =>
      processor.onaudioprocess?.({
        inputBuffer: {
          getChannelData: () => new Float32Array(1_600).fill(level),
        },
      });
    try {
      feed(0);
      expect(controller.snapshot()).toMatchObject({ inputLevel: 0 });
      feed(0.25);
      expect(controller.snapshot()).toMatchObject({ inputLevel: 0.25 });
      feed(-0.5);
      expect(controller.snapshot()).toMatchObject({ inputLevel: 0.5 });
      feed(0);
      expect(controller.snapshot()).toMatchObject({ inputLevel: 0 });
      feed(0.25);
      await controller.stop();
      expect(controller.snapshot()).toMatchObject({
        state: "stopped",
        inputLevel: 0,
      });
      await controller.start();
      expect(controller.snapshot()).toMatchObject({ inputLevel: 0 });
      feed(0.5);
      controller.cancel();
      expect(controller.snapshot()).toMatchObject({
        state: "cancelled",
        inputLevel: 0,
      });
      expect(processor.onaudioprocess).toBeNull();
    } finally {
      controller.cancel();
    }
  });
  it("reports a quick empty click without producing a provider WAV", async () => {
    const controller = new VoiceCaptureController({
      fixtureSamples: new Float32Array(0),
    });
    await controller.enable();
    await controller.start();
    await expect(controller.stop()).rejects.toMatchObject({
      code: "empty-recording",
      message: "Nothing recorded. Left click and hold while talking.",
    });
    expect(controller.snapshot().sampleCount).toBe(0);
    await controller.start();
    controller.cancel();
  });
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
      expect(wav.byteLength).toBeLessThanOrEqual(MAX_ENCODED_AUDIO_BYTES);
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

  it("never emits a WAV beyond the 4 MiB capture ceiling", async () => {
    let processor:
      | {
          onaudioprocess:
            | ((event: {
                inputBuffer: {
                  getChannelData: (channel: number) => Float32Array;
                };
              }) => void)
            | null;
          connect: ReturnType<typeof vi.fn>;
          disconnect: ReturnType<typeof vi.fn>;
        }
      | undefined;
    const automaticStop = vi.fn((wav: Uint8Array, reason: string) => {
      expect(reason).toBe("size-ceiling");
      expect(wav.byteLength).toBeLessThanOrEqual(MAX_ENCODED_AUDIO_BYTES);
    });
    const track = { stop: vi.fn() };
    const controller = new VoiceCaptureController({
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [track],
        getAudioTracks: () => [track],
      }),
      audioContext: () => ({
        sampleRate: 16_000,
        destination: {},
        createMediaStreamSource: () => ({
          connect: vi.fn(),
          disconnect: vi.fn(),
        }),
        createScriptProcessor: () => {
          processor = {
            onaudioprocess: null,
            connect: vi.fn(),
            disconnect: vi.fn(),
          };
          return processor;
        },
        close: vi.fn().mockResolvedValue(undefined),
      }),
      onAutomaticStop: automaticStop,
    });

    await controller.enable();
    await controller.start();
    processor?.onaudioprocess?.({
      inputBuffer: {
        getChannelData: () => new Float32Array(MAX_ENCODED_AUDIO_BYTES / 2),
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(automaticStop).toHaveBeenCalledOnce();
  });

  it("discards capture immediately when the active microphone device is lost", async () => {
    let ended: (() => void) | undefined;
    const stop = vi.fn();
    const track = {
      label: "Fixture microphone",
      stop,
      addEventListener: (_type: "ended", listener: () => void) => {
        ended = listener;
      },
      removeEventListener: vi.fn(),
    };
    const stream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
    };
    const processor = {
      onaudioprocess: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const terminated = vi.fn();
    const controller = new VoiceCaptureController({
      getUserMedia: vi.fn().mockResolvedValue(stream),
      audioContext: () => ({
        sampleRate: 16_000,
        destination: {},
        createMediaStreamSource: () => ({
          connect: vi.fn(),
          disconnect: vi.fn(),
        }),
        createScriptProcessor: () => processor,
        close: vi.fn().mockResolvedValue(undefined),
      }),
      onTerminated: terminated,
    });

    await controller.enable();
    await controller.start();
    ended?.();

    expect(terminated).toHaveBeenCalledOnce();
    expect(terminated).toHaveBeenCalledWith("lost-device");
    expect(controller.snapshot()).toMatchObject({
      state: "failed",
      sampleCount: 0,
      stopReason: "lost-device",
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
