import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { VoiceCaptureController } from "../src/voice/browser-voice.js";
import { WorldPushToTalk } from "../src/world-entry/WorldPushToTalk.js";

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

describe("Phase 19 World voice input", () => {
  it("enables push-to-talk in the normal World instead of hard-coding it unavailable", () => {
    const source = readFileSync(
      fileURLToPath(
        new URL("../src/world-entry/WorldEntryExperience.tsx", import.meta.url),
      ),
      "utf8",
    );

    expect(source).not.toContain("pushToTalkAvailable={false}");
    expect(source).toContain("onVoiceSend={(text) => void sendText(text)}");
  });

  it("keeps one adjacent hold control without rendering the Phase 15 dashboard", () => {
    const html = renderToStaticMarkup(
      createElement(WorldPushToTalk, {
        available: true,
        session,
        onAcceptedText: vi.fn(),
        captureController: new VoiceCaptureController({
          fixtureSamples: new Float32Array(16_000),
        }),
      }),
    );

    expect(html).toContain("Push to Talk");
    expect(html).toContain("L Click Hold");
    expect(html).toContain("R Click = On");
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toMatch(/\sdisabled(?:=|>)/u);
    expect(html).not.toMatch(
      /VoiceJourney|ten numbered steps|speech synthesis/iu,
    );
  });
});
