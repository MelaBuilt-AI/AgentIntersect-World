import { expect, test, type Page, type Route } from "@playwright/test";

import { seedConfiguredAvatar } from "./helpers.js";
import { openCodeWheel } from "./world-code-wheel.js";

const worldInstanceId = "80000000-0000-4000-8000-000000000008";
const agents = [
  {
    rosterId: "roster-hermes",
    adapterId: "hermes",
    sessionOwnership: "operator-persistent",
    worldSessionId: "10000000-0000-4000-8000-000000000001",
    nativeRootSessionRef: "native-hermes",
    displayName: "Mr Fluff",
    addedOrder: 0,
  },
  {
    rosterId: "roster-codex",
    adapterId: "codex",
    sessionOwnership: "world-owned",
    worldSessionId: "20000000-0000-4000-8000-000000000002",
    nativeRootSessionRef: "native-codex",
    displayName: "Codex",
    addedOrder: 1,
  },
] as const;

const envelope = (data: unknown) => ({
  ok: true,
  data,
  meta: {
    correlationId: "90000000-0000-4000-8000-000000000009",
    schema: "aiw.api/0.3",
  },
});

const proposalFor = (agent: (typeof agents)[number]) => ({
  schema: "aiw.avatar-proposal/0.12",
  proposalId: `avatar-${agent.adapterId}`,
  sessionId: agent.worldSessionId,
  displayName: agent.displayName,
  species: "human",
  head: "round",
  hands: "hands",
  feet: "feet",
  fur: "none",
  tail: "none",
  markings: "solid",
  bodyColor: "warm-light",
  shirt: agent.adapterId === "hermes" ? "Hermes" : "Codex",
  movementStyle: "shared-biped-core",
  sourceDisclosure: "Deterministic local Task 14 browser fixture.",
  rationale: "Accepted fixture avatar.",
  createdAt: "2026-08-24T21:00:00.000Z",
  avatarSource: {
    kind: "imported",
    version: 2,
    mode: "original",
    modelId: "robot-agent-01",
  },
});

async function fulfillJson(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
}

async function installFixture(page: Page) {
  const transcriptionBodies: unknown[] = [];
  const groupedBodies: Array<Record<string, unknown>> = [];
  let reconnected = false;
  const constellation = () => ({
    projection: {
      schema: "aiw.constellation/0.19",
      mode: "multi-agent",
      worldInstanceId,
      lifecycle: "active",
      revision: reconnected ? 3 : 2,
      agents: agents.map((agent) => ({
        ...agent,
        worldInstanceId,
        continuity:
          agent.adapterId === "codex" && !reconnected ? "stale" : "current",
        connection:
          agent.adapterId === "codex" && !reconnected ? "stale" : "connected",
        avatar: {
          status: "accepted",
          profileId: proposalFor(agent).proposalId,
          sessionId: agent.worldSessionId,
        },
      })),
      entryReady: reconnected,
      truth: "current",
    },
    terminalOutcomes: [],
    unavailableReason: null,
  });

  await page.addInitScript(() => {
    const microphoneTrack = {
      label: "Task 14 deterministic microphone",
      readyState: "live",
      stop: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    const stream = {
      getTracks: () => [microphoneTrack],
      getAudioTracks: () => [microphoneTrack],
    };
    Object.assign(window, {
      __task14GetUserMediaCalls: 0,
      __task14SpeechSpeakCalls: 0,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const fixtureWindow = window as unknown as {
            __task14GetUserMediaCalls: number;
          };
          fixtureWindow.__task14GetUserMediaCalls += 1;
          return stream;
        },
      },
    });
    class FixtureAudioContext {
      readonly sampleRate = 16_000;
      readonly destination = {};
      createMediaStreamSource() {
        return { connect: () => undefined, disconnect: () => undefined };
      }
      createScriptProcessor() {
        const processor = {
          onaudioprocess: null as
            | ((event: {
                inputBuffer: {
                  getChannelData: () => Float32Array;
                };
              }) => void)
            | null,
          connect: () => {
            queueMicrotask(() =>
              processor.onaudioprocess?.({
                inputBuffer: {
                  getChannelData: () => new Float32Array(1_600).fill(0.125),
                },
              }),
            );
          },
          disconnect: () => undefined,
        };
        return processor;
      }
      async close() {}
    }
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FixtureAudioContext,
    });
    if (window.speechSynthesis)
      window.speechSynthesis.speak = () => {
        Object.assign(window, {
          __task14SpeechSpeakCalls:
            ((window as unknown as { __task14SpeechSpeakCalls: number })
              .__task14SpeechSpeakCalls ?? 0) + 1,
        });
      };
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();

    if (pathname.endsWith("/constellation/current")) {
      await fulfillJson(route, envelope(constellation()));
      return;
    }

    if (
      pathname.endsWith("/constellation/agents/roster-codex/reconnect") &&
      method === "POST"
    ) {
      reconnected = true;
      await fulfillJson(route, envelope(constellation()));
      return;
    }

    const sessionMatch = pathname.match(
      /\/agent-sessions\/([^/]+)\/(status|history|avatar-proposal|work-focus)$/u,
    );
    if (sessionMatch) {
      const sessionId = decodeURIComponent(sessionMatch[1]!);
      const operation = sessionMatch[2]!;
      const agent = agents.find(
        (candidate) => candidate.worldSessionId === sessionId,
      )!;
      const proposal = proposalFor(agent);
      const session = {
        schema: "aiw.agent-session/0.12",
        sessionId,
        adapterId: agent.adapterId,
        adapterSessionRef: agent.nativeRootSessionRef,
        adapterRootSessionRef: agent.nativeRootSessionRef,
        adapterPreviousSessionRef: null,
        profile: "default",
        workspaceId: "world-entry",
        repositoryRef: "current",
        worktreeRef: null,
        mode: "explore",
        permissionRevision: 0,
        capabilitySnapshotHash: "d".repeat(64),
        avatarProfileRef: null,
        continuity: "current",
        status: "ready",
        currentFocusObjectIds: [],
        currentTaskRef: null,
        activeRunId: null,
        lastEventSequence: 0,
        createdAt: "2026-08-24T21:00:00.000Z",
        updatedAt: "2026-08-24T21:00:00.000Z",
      };
      const data =
        operation === "status"
          ? session
          : operation === "avatar-proposal"
            ? proposal
            : operation === "work-focus"
              ? { focus: null }
              : {
                  sessionId,
                  continuity: "current",
                  messages: [],
                  transcriptAuthority: agent.adapterId,
                  avatarConsent: {
                    state: "accepted",
                    current: proposal,
                    previous: null,
                  },
                };
      await fulfillJson(route, envelope(data));
      return;
    }

    if (pathname.includes("/world-actions/") && method === "GET") {
      await fulfillJson(route, {
        capability: { enabled: true },
        actions: [],
        executions: [],
      });
      return;
    }

    if (pathname.endsWith("/voice/disclosure")) {
      await fulfillJson(
        route,
        envelope({
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
        }),
      );
      return;
    }

    if (pathname.endsWith("/activity") && method === "PUT") {
      await fulfillJson(
        route,
        envelope({
          schema: "aiw.voice-store/0.15",
          preferences: [],
          operations: [],
          activity: request.postDataJSON()?.activity ?? null,
        }),
      );
      return;
    }

    if (pathname.endsWith("/transcriptions") && method === "POST") {
      transcriptionBodies.push(request.postDataJSON());
      const number = transcriptionBodies.length;
      await fulfillJson(
        route,
        envelope({
          schema: "aiw.voice-transcription-result/0.15",
          utteranceId: `50000000-0000-4000-8000-00000000000${number}`,
          finalText: `voice final ${number}`,
          partialText: null,
          partialCapability: "unavailable",
          elapsedMs: 3,
        }),
      );
      return;
    }

    if (pathname.endsWith("/constellation/messages") && method === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      groupedBodies.push(body);
      const targetRosterId =
        typeof body.targetRosterId === "string" ? body.targetRosterId : null;
      const recipients = targetRosterId
        ? agents.filter((agent) => agent.rosterId === targetRosterId)
        : agents;
      await fulfillJson(
        route,
        envelope({
          schema: "aiw.constellation-message/0.19",
          groupId: `60000000-0000-4000-8000-00000000000${groupedBodies.length}`,
          requestId: body.requestId,
          correlationId: "70000000-0000-4000-8000-000000000007",
          text: body.text,
          target: targetRosterId
            ? { kind: "agent", rosterId: targetRosterId }
            : { kind: "broadcast" },
          recipientRosterIds: recipients.map((agent) => agent.rosterId),
          recipients: recipients.map((agent) => ({
            rosterId: agent.rosterId,
            worldSessionId: agent.worldSessionId,
            state: "completed",
            finalText: `${agent.displayName} received ${String(body.text)}`,
            errorLabel: null,
          })),
          createdAt: "2026-08-24T21:00:00.000Z",
          updatedAt: "2026-08-24T21:00:01.000Z",
        }),
        201,
      );
      return;
    }

    if (pathname.endsWith("/phase14/journeys/current")) {
      await route.fulfill({ status: 404, body: "fixture unavailable" });
      return;
    }

    await route.fulfill({
      status: 404,
      body: `unexpected ${method} ${pathname}`,
    });
  });

  return { transcriptionBodies, groupedBodies };
}

async function recordPointer(
  page: Page,
  pointerType: "mouse" | "touch",
  pointerId: number,
) {
  const button = page.locator("button.world-ptt");
  await button.dispatchEvent("pointerdown", {
    pointerId,
    pointerType,
    button: 0,
    buttons: 1,
  });
  await expect(button).toContainText("Listening");
  await button.dispatchEvent("pointerup", {
    pointerId,
    pointerType,
    button: 0,
    buttons: 0,
  });
  await expect(
    page.getByRole("region", { name: "Final voice caption" }),
  ).toBeVisible();
}

test("normal World push-to-talk sends final-only grouped text without TTS", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedConfiguredAvatar(page, "Aaron");
  const fixture = await installFixture(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Reconnect" }).click();
  const enterWorld = page.getByRole("button", { name: "Enter World" });
  await expect(enterWorld).toBeEnabled();
  await enterWorld.click();
  await expect(page.getByTestId("world-hud")).toBeVisible();
  const pushToTalk = page.locator("button.world-ptt");
  await expect(pushToTalk).toBeEnabled();

  await pushToTalk.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    buttons: 1,
  });
  const disclosure = page.getByRole("region", {
    name: "Local voice disclosure",
  });
  await expect(disclosure).toContainText("final captions only");
  await expect(disclosure).toContainText("Raw audio stays on this machine");
  await expect(page.getByLabel("Message All agents")).toBeEnabled();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __task14GetUserMediaCalls: number })
          .__task14GetUserMediaCalls,
    ),
  ).toBe(0);
  await disclosure.getByRole("button", { name: "Enable microphone" }).click();
  await expect(disclosure).toBeHidden();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __task14GetUserMediaCalls: number })
          .__task14GetUserMediaCalls,
    ),
  ).toBe(1);

  await pushToTalk.dispatchEvent("pointerdown", {
    pointerId: 11,
    pointerType: "mouse",
    button: 0,
    buttons: 1,
  });
  await expect(pushToTalk).toContainText("Listening");
  await pushToTalk.dispatchEvent("pointercancel", {
    pointerId: 11,
    pointerType: "mouse",
  });
  await expect(pushToTalk).toContainText("Push to talk");
  expect(fixture.transcriptionBodies).toHaveLength(0);

  await recordPointer(page, "mouse", 2);
  await expect(page.getByLabel("Final caption")).toHaveValue("voice final 1");
  await page
    .getByRole("region", { name: "Final voice caption" })
    .getByRole("button", { name: "Cancel" })
    .click();
  expect(fixture.groupedBodies).toHaveLength(0);

  await recordPointer(page, "touch", 3);
  await expect(page.getByLabel("Final caption")).toHaveValue("voice final 2");
  await page
    .getByRole("region", { name: "Final voice caption" })
    .getByRole("button", { name: "Cancel" })
    .click();
  expect(fixture.groupedBodies).toHaveLength(0);

  await pushToTalk.focus();
  await page.keyboard.down("Space");
  await expect(pushToTalk).toContainText("Listening");
  await page.keyboard.up("Space");
  const finalCaption = page.getByLabel("Final caption");
  await expect(finalCaption).toHaveValue("voice final 3");
  await finalCaption.fill("edited broadcast caption");
  await page
    .getByRole("region", { name: "Final voice caption" })
    .getByRole("button", { name: "Send" })
    .click();
  await expect(page.getByLabel("Message All agents")).toBeVisible();

  await openCodeWheel(page);
  await page
    .getByRole("button", { name: "Send next message to Codex" })
    .click();
  await expect(page.getByLabel("Message Codex")).toBeVisible();
  await pushToTalk.focus();
  await page.keyboard.down("Space");
  await expect(pushToTalk).toContainText("Listening");
  await page.keyboard.up("Space");
  await expect(page.getByLabel("Final caption")).toHaveValue("voice final 4");
  await page
    .getByRole("region", { name: "Final voice caption" })
    .getByRole("button", { name: "Send" })
    .click();
  await expect(page.getByLabel("Message All agents")).toBeVisible();

  expect(fixture.transcriptionBodies).toHaveLength(4);
  expect(fixture.groupedBodies).toHaveLength(2);
  expect(fixture.groupedBodies[0]).toMatchObject({
    text: "edited broadcast caption",
  });
  expect(fixture.groupedBodies[0]).not.toHaveProperty("targetRosterId");
  expect(fixture.groupedBodies[1]).toMatchObject({
    text: "voice final 4",
    targetRosterId: "roster-codex",
  });
  expect(JSON.stringify(fixture.groupedBodies)).not.toMatch(
    /wav|audio|base64/iu,
  );
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __task14SpeechSpeakCalls: number })
          .__task14SpeechSpeakCalls,
    ),
  ).toBe(0);
});
