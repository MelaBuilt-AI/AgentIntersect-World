import fs from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { openPanel, seedConfiguredAvatar } from "./helpers.js";

const session = {
  schema: "aiw.agent-session/0.12",
  sessionId: "11111111-1111-4111-8111-111111111111",
  adapterId: "hermes",
  adapterSessionRef: "20260721_011618_330489c8",
  adapterRootSessionRef: "phase15-root-session",
  profile: "default",
  workspaceId: "ws_fixture",
  repositoryRef: "repo_fixture",
  mode: "explore",
  permissionRevision: 0,
  capabilitySnapshotHash: "a".repeat(64),
  continuity: "current",
  status: "ready",
} as const;

const envelope = (data: unknown) => ({
  ok: true,
  data,
  meta: {
    correlationId: "33333333-3333-4333-8333-333333333333",
    schema: "aiw.api/0.3",
  },
});

test("Phase 15 exact numbered push-to-talk journey is accessible and authority-bound", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: 2,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => null,
    });
    const track = {
      label: "Fixture Browser Mic",
      readyState: "live",
      stop: () => undefined,
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [track],
          getAudioTracks: () => [track],
        }),
      },
    });
    class FixtureAudioContext {
      sampleRate = 16_000;
      destination = {};
      createMediaStreamSource() {
        return { connect: () => undefined, disconnect: () => undefined };
      }
      createScriptProcessor() {
        return {
          onaudioprocess: null,
          connect: () => undefined,
          disconnect: () => undefined,
        };
      }
      async close() {}
    }
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FixtureAudioContext,
    });
    class FixtureUtterance {
      onstart: null | (() => void) = null;
      onerror: null | (() => void) = null;
      voice = null;
      constructor(readonly text: string) {}
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: FixtureUtterance,
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speaking: false,
        cancel: () => undefined,
        speak: (utterance: FixtureUtterance) =>
          queueMicrotask(() => utterance.onstart?.()),
      },
    });
  });

  const requests: { path: string; body: string | null }[] = [];
  let transcriptionRequests = 0;
  await page.route("**/api/voice/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    requests.push({ path: pathname, body: request.postData() });
    let data: unknown;
    if (pathname.endsWith("/disclosure"))
      data = {
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
      };
    else if (pathname.endsWith("/preference")) data = null;
    else if (pathname.endsWith("/state"))
      data = {
        schema: "aiw.voice-store/0.15",
        preferences: [],
        operations: [],
        activity: null,
      };
    else if (pathname.endsWith("/activity"))
      data = {
        schema: "aiw.voice-store/0.15",
        preferences: [],
        operations: [],
        activity: (request.postDataJSON() as { activity: string | null })
          .activity,
      };
    else if (pathname.endsWith("/transcriptions")) {
      transcriptionRequests += 1;
      if (transcriptionRequests === 1)
        await new Promise((resolve) => setTimeout(resolve, 500));
      data = {
        schema: "aiw.voice-transcription-result/0.15",
        utteranceId: "44444444-4444-4444-8444-444444444444",
        finalText: "fixture final transcript",
        partialText: null,
        partialCapability: "unavailable",
        elapsedMs: 18,
      };
    } else if (pathname.endsWith("/send"))
      data = { finalText: "canonical fixture reply", deltas: [] };
    else if (request.method() === "DELETE") {
      await new Promise((resolve) => setTimeout(resolve, 500));
      data = { voiceConsent: "revoked", approvedVoiceId: null };
    } else data = { voiceConsent: "accepted" };
    await route
      .fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(envelope(data)),
      })
      .catch(() => undefined);
  });
  await page.route("**/api/agent-sessions/*/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope(session)),
    });
  });

  await seedConfiguredAvatar(page);
  await page.goto("/internal/dashboard?fixture=phase15-voice");
  expect(await page.evaluate(() => navigator.hardwareConcurrency)).toBe(2);
  await openPanel(page, "Agents");
  const journey = page.getByLabel("Phase 15 voice journey");
  await expect(journey).toBeVisible();
  await expect(journey.locator(".voice-step__item")).toHaveCount(10);

  await test.step("1 inspect disclosure", async () => {
    await expect(
      journey.getByText("whisper.cpp v1.9.1", { exact: false }),
    ).toBeVisible();
    await expect(
      journey.getByText("Raw audio never leaves this machine"),
    ).toBeVisible();
  });
  await test.step("2 explicitly enable microphone", async () => {
    const enable = journey.getByRole("button", {
      name: "Enable microphone for this activation",
    });
    expect(
      await enable.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          forcedColorAdjust: style.forcedColorAdjust,
          backgroundColor: style.backgroundColor,
          color: style.color,
        };
      }),
    ).toEqual({
      forcedColorAdjust: "none",
      backgroundColor: "rgb(23, 105, 207)",
      color: "rgb(255, 255, 255)",
    });
    expect(
      await journey
        .getByRole("button", { name: "Stop capture now" })
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    ).toBe("rgb(75, 80, 88)");
    await enable.click();
    await expect(
      journey.getByText("Microphone enabled for push-to-talk", {
        exact: false,
      }),
    ).toBeVisible();
  });
  await test.step("2b cancel and discard an in-flight local transcription", async () => {
    const hold = journey.getByRole("button", { name: "Hold to talk" });
    await hold.dispatchEvent("pointerdown", { pointerId: 40 });
    await expect(
      journey.getByText("Listening · release to stop"),
    ).toBeVisible();
    await journey
      .getByRole("button", { name: "Listening · release to stop" })
      .dispatchEvent("pointerup", { pointerId: 40 });
    await expect(journey.getByText(/local final transcription/i)).toBeVisible();
    await journey
      .getByRole("button", { name: "Cancel and discard utterance" })
      .click();
    await expect(journey.getByText(/utterance cancelled/i)).toBeVisible();
    await page.waitForTimeout(650);
    await expect(journey.getByText(/utterance cancelled/i)).toBeVisible();
    await expect(journey.getByLabel("Final caption (editable)")).toHaveValue(
      "",
    );
  });
  const control = journey.getByRole("button", { name: "Hold to talk" });
  let captureResponseMs = Number.POSITIVE_INFINITY;
  await test.step("3 push and hold, with 4 stop on release", async () => {
    const started = await page.evaluate(() => performance.now());
    await control.dispatchEvent("pointerdown");
    await expect(
      journey.getByText("Listening · release to stop"),
    ).toBeVisible();
    captureResponseMs =
      (await page.evaluate(() => performance.now())) - started;
    expect(captureResponseMs).toBeLessThanOrEqual(250);
    await journey
      .getByRole("button", { name: "Listening · release to stop" })
      .dispatchEvent("pointerup");
  });
  await test.step("5 review honest final-only captions and 6 edit final", async () => {
    await expect(
      journey.getByText("Lexical partial captions unavailable"),
    ).toBeVisible();
    const transcript = journey.getByLabel("Final caption (editable)");
    await expect(transcript).toHaveValue("fixture final transcript");
    await transcript.fill("edited fixture final transcript");
  });
  await test.step("7 send and 8 receive canonical reply", async () => {
    await journey
      .getByRole("button", { name: "Send through exact text path" })
      .click();
    await expect(journey.getByText("canonical fixture reply")).toBeVisible();
    const send = requests.find(({ path }) => path.endsWith("/send"));
    expect(send?.body).toContain("edited fixture final transcript");
    expect(send?.body).toContain(session.capabilitySnapshotHash);
    expect(send?.body).toContain(session.adapterRootSessionRef);
  });
  await test.step("9 request speech and 10 stop immediately", async () => {
    const started = await page.evaluate(() => performance.now());
    await journey
      .getByRole("button", { name: "Speak canonical reply" })
      .click();
    await expect(
      journey.getByText("Speaking from an authoritative playback event."),
    ).toBeVisible();
    const requestToSpeakingMs =
      (await page.evaluate(() => performance.now())) - started;
    expect(requestToSpeakingMs).toBeLessThanOrEqual(1_000);
    const stopStarted = await page.evaluate(() => performance.now());
    await journey
      .getByRole("button", { name: "Stop playback / barge in" })
      .click();
    await expect(
      journey.getByText("Playback stopped", { exact: false }),
    ).toBeVisible();
    const stopResponseMs =
      (await page.evaluate(() => performance.now())) - stopStarted;
    expect(stopResponseMs).toBeLessThanOrEqual(100);
    fs.mkdirSync(path.resolve("artifacts/phase15"), { recursive: true });
    fs.writeFileSync(
      path.resolve("artifacts/phase15/phase15-browser-performance.json"),
      `${JSON.stringify(
        {
          schema: "aiw.phase15-browser-performance/1",
          profile: "mobile-two-cpu-reduced-motion-forced-colors-no-webgl",
          hardwareConcurrency: await page.evaluate(
            () => navigator.hardwareConcurrency,
          ),
          captureResponseMs,
          captureCeilingMs: 250,
          requestToSpeakingMs,
          requestToSpeakingTargetMs: 1_000,
          stopResponseMs,
          stopCeilingMs: 100,
          verdict: true,
        },
        null,
        2,
      )}\n`,
    );
  });
  await test.step("9b voice revocation fails closed before persistence resolves", async () => {
    const speak = journey.getByRole("button", {
      name: "Speak canonical reply",
    });
    await expect(speak).toBeEnabled();
    await journey.getByRole("button", { name: "Revoke voice" }).click();
    await expect(speak).toBeDisabled({ timeout: 150 });
    await expect(journey.getByLabel("Select browser/system voice")).toHaveValue(
      "",
    );
    await expect(journey.getByText("Consent: revoked")).toBeVisible();
    await page.waitForTimeout(550);
    await expect(speak).toBeDisabled();
  });

  const serious = (await new AxeBuilder({ page }).analyze()).violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  );
  expect(serious).toEqual([]);
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".voice-journey *")]
      .filter(
        (element) =>
          element.getBoundingClientRect().right >
          document.documentElement.clientWidth + 0.5,
      )
      .map((element) => element.className)
      .slice(0, 10),
  );
  expect(overflow).toEqual([]);
  expect(JSON.stringify(requests)).not.toMatch(
    /Secret Microphone|persona_canary|\/home\/|\.staging/,
  );
  await page.screenshot({
    path: "artifacts/phase15/phase15-voice-mobile.png",
    fullPage: true,
  });
});
