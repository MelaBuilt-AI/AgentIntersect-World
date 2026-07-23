import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { VoiceJourneyExperience } from "../src/voice/VoiceJourneyPanel.js";
import { BrowserSpeechPlayback } from "../src/voice/browser-voice.js";
import { createInitialVoiceJourneyState } from "../src/voice/voice-state.js";
import { PHASE15_VOICE_FIXTURE } from "../src/voice/voice-fixtures.js";

const noop = () => undefined;

describe("Phase 15 semantic voice journey", () => {
  it("renders the exact ten numbered steps and pre-activation disclosure", () => {
    const html = renderToStaticMarkup(
      <VoiceJourneyExperience
        state={PHASE15_VOICE_FIXTURE}
        onAction={noop}
        onTranscript={() => undefined}
      />,
    );
    expect(html.match(/voice-step__/g) ?? []).toHaveLength(10);
    for (const text of [
      "1. Inspect provider and device disclosure",
      "2. Enable microphone explicitly",
      "3. Push and hold to talk",
      "4. Stop capture",
      "5. Review volatile captions",
      "6. Edit final transcript",
      "7. Send or cancel",
      "8. Receive canonical text and captions",
      "9. Speak reply optionally",
      "10. Interrupt or stop playback",
      "whisper.cpp v1.9.1",
      "Local process",
      "Raw audio never leaves this machine",
      "volatile until accepted text send",
    ])
      expect(html).toContain(text);
  });

  it("labels partial degradation as progress, never transcript text", () => {
    const html = renderToStaticMarkup(
      <VoiceJourneyExperience
        state={{ ...PHASE15_VOICE_FIXTURE, captureState: "listening" }}
        onAction={noop}
        onTranscript={() => undefined}
      />,
    );
    expect(html).toContain("Lexical partial captions unavailable");
    expect(html).toContain("Capture progress is not transcript text");
    expect(html).toContain("Final caption (editable)");
    expect(html).toContain('aria-live="polite"');
  });

  it("uses blue enabled and grey disabled controls with keyboard/touch semantics", () => {
    const html = renderToStaticMarkup(
      <VoiceJourneyExperience
        state={PHASE15_VOICE_FIXTURE}
        onAction={noop}
        onTranscript={() => undefined}
      />,
    );
    expect(html).toContain("voice-primary voice-primary--enabled");
    expect(html).toContain("voice-primary voice-primary--disabled");
    expect(html).toContain('aria-keyshortcuts="Space"');
    expect(html).toContain("Press and hold Space or touch/hold");
    expect(html).toContain("Stop playback / barge in");
  });

  it("shows consentful opaque voice proposal and no secret/path/device canaries", () => {
    const html = renderToStaticMarkup(
      <VoiceJourneyExperience
        state={PHASE15_VOICE_FIXTURE}
        onAction={noop}
        onTranscript={() => undefined}
      />,
    );
    expect(html).toContain("Explicit agent self-description proposal");
    expect(html).toContain("Preview voice");
    expect(html).toContain("Accept voice");
    expect(html).toContain("Change voice");
    expect(html).toContain("Decline voice");
    expect(html).toContain("Revoke voice");
    expect(html).not.toMatch(
      /\/home\/|\.staging|persona_canary|Secret Microphone/,
    );
  });

  it("is fully semantic without WebGL and exposes current/recovered truth", () => {
    const html = renderToStaticMarkup(
      <VoiceJourneyExperience
        state={{
          ...PHASE15_VOICE_FIXTURE,
          recovery: "Previous / recovered · playback interrupted",
        }}
        onAction={noop}
        onTranscript={() => undefined}
      />,
    );
    expect(html).toContain("Previous / recovered · playback interrupted");
    expect(html).toContain('aria-label="Phase 15 voice journey"');
    expect(html).not.toMatch(/canvas|webgl/i);
  });

  it("derives live TTS truth and selectable voices from browser capability, not fixtures", () => {
    const unavailable = createInitialVoiceJourneyState(
      null,
      new BrowserSpeechPlayback({ synthesis: null }),
    );
    expect(unavailable.ttsAvailable).toBe(false);
    expect(unavailable.ttsDisclosure).toMatch(/unavailable/i);
    expect(unavailable.voiceOptions).toEqual([]);

    const html = renderToStaticMarkup(
      <VoiceJourneyExperience
        state={{
          ...PHASE15_VOICE_FIXTURE,
          voiceOptions: [
            {
              id: "system.voice.default",
              label: "Browser/system default voice",
            },
          ],
          selectedVoiceId: "system.voice.default",
        }}
        onAction={noop}
        onTranscript={() => undefined}
        onVoiceSelection={() => undefined}
      />,
    );
    expect(html).toContain("Select browser/system voice");
    expect(html).toContain("Browser/system default voice");
  });

  it("disables further speech immediately after voice revocation", () => {
    const html = renderToStaticMarkup(
      <VoiceJourneyExperience
        state={{
          ...PHASE15_VOICE_FIXTURE,
          canonicalReply: "Canonical reply",
          selectedVoiceId: "system.voice.default",
          voiceConsent: "revoked",
        }}
        onAction={noop}
        onTranscript={() => undefined}
      />,
    );
    expect(html).toMatch(/Speak canonical reply<\/button>/);
    expect(html).toMatch(
      /class="voice-primary voice-primary--disabled"[^>]*disabled=""[^>]*>Speak canonical reply/,
    );
  });
});
