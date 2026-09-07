import { expect, test, type Page, type Route } from "@playwright/test";

import { seedConfiguredAvatar } from "./helpers.js";
import { randomUUID } from "node:crypto";
import { RepositoryIndexOperationSchema } from "@agentintersect-world/world-schema";
import {
  WorldActionEnvelopeSchema,
  WorldActionProposalSchema,
} from "@agentintersect-world/world-action-protocol";

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
    rosterId: "roster-openclaw",
    adapterId: "openclaw",
    sessionOwnership: "world-owned",
    worldSessionId: "30000000-0000-4000-8000-000000000003",
    nativeRootSessionRef: "native-openclaw",
    displayName: "Claw",
    addedOrder: 1,
  },
  {
    rosterId: "roster-codex",
    adapterId: "codex",
    sessionOwnership: "world-owned",
    worldSessionId: "20000000-0000-4000-8000-000000000002",
    nativeRootSessionRef: "native-codex",
    displayName: "Codex",
    addedOrder: 2,
  },
  {
    rosterId: "roster-claude",
    adapterId: "claude-code",
    sessionOwnership: "world-owned",
    worldSessionId: "40000000-0000-4000-8000-000000000004",
    nativeRootSessionRef: "native-claude",
    displayName: "Claude",
    addedOrder: 3,
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
  shirt:
    agent.adapterId === "hermes"
      ? "Hermes"
      : agent.adapterId === "openclaw"
        ? "OpenClaw"
        : agent.adapterId === "codex"
          ? "Codex"
          : "Claude",
  movementStyle: "shared-biped-core",
  sourceDisclosure: "Deterministic local Task 15 browser fixture.",
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
  let nextGroupedResponse: Promise<void> | undefined;
  const resolvedTargetRosterIds: Array<string | null> = [];
  const hermesHistoryMessages: Array<{
    readonly role: "user" | "assistant";
    readonly text: string;
  }> = [];
  let reconnected = false;
  let constellationReadyAfterRestore = true;
  const sessionFor = (agent: (typeof agents)[number]) => ({
    schema: "aiw.agent-session/0.12",
    sessionId: agent.worldSessionId,
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
  });
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
      label: "Task 15 deterministic microphone",
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
      __task15GetUserMediaCalls: 0,
      __task15SpeechSpeakCalls: 0,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const fixtureWindow = window as unknown as {
            __task15GetUserMediaCalls: number;
          };
          fixtureWindow.__task15GetUserMediaCalls += 1;
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
          __task15SpeechSpeakCalls:
            ((window as unknown as { __task15SpeechSpeakCalls: number })
              .__task15SpeechSpeakCalls ?? 0) + 1,
        });
      };
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();

    if (pathname.endsWith("/constellation/current")) {
      const current = constellation();
      if (!constellationReadyAfterRestore) {
        await fulfillJson(
          route,
          envelope({
            ...current,
            projection: { ...current.projection, entryReady: false },
          }),
        );
      } else await fulfillJson(route, envelope(current));
      return;
    }

    if (pathname.endsWith("/world/current") && method === "GET") {
      await fulfillJson(
        route,
        envelope({
          snapshot: {
            schema: "aiw.world/0.4",
            identityVersion: "aiw.identity/1",
            layoutVersion: "aiw.layout/grid/1",
            snapshotId: "1".repeat(32),
            generationFingerprint: "c".repeat(64),
            workspaceRef: "aiw://object/11111111111111111111111111111111",
            repositoryRef: "aiw://object/22222222222222222222222222222222",
            objects: [
              {
                kind: "workspace",
                id: "1".repeat(32),
                ref: "aiw://object/11111111111111111111111111111111",
                name: "Task 15 workspace",
                parentRef: null,
                childRefs: ["aiw://object/22222222222222222222222222222222"],
                position: { x: 0, y: 0, z: 0 },
                bounds: { x: 0, z: 0, width: 24, depth: 24 },
              },
              {
                kind: "repository",
                id: "2".repeat(32),
                ref: "aiw://object/22222222222222222222222222222222",
                name: "Task 15 repository",
                parentRef: "aiw://object/11111111111111111111111111111111",
                childRefs: ["aiw://object/33333333333333333333333333333333"],
                position: { x: 0, y: 0, z: 0 },
                bounds: { x: 0, z: 0, width: 20, depth: 20 },
              },
              {
                kind: "package",
                id: "3".repeat(32),
                ref: "aiw://object/33333333333333333333333333333333",
                name: "task15-disposable-acceptance",
                parentRef: "aiw://object/22222222222222222222222222222222",
                childRefs: ["aiw://object/44444444444444444444444444444444"],
                path: ".",
                packageKind: "npm",
                packageName: "task15-disposable-acceptance",
                position: { x: 2, y: 0, z: 2 },
                bounds: { x: 1, z: 1, width: 2, depth: 2 },
              },
              {
                kind: "file",
                id: "4".repeat(32),
                ref: "aiw://object/44444444444444444444444444444444",
                name: "Task15Claude.md",
                parentRef: "aiw://object/33333333333333333333333333333333",
                childRefs: [],
                path: "Task15Claude.md",
                size: 193,
                fileKind: "source",
                language: "markdown",
                contentHash: "d".repeat(64),
                pathHistory: [],
                position: { x: 6, y: 0, z: 8 },
                bounds: { x: 5, z: 7, width: 2, depth: 2 },
              },
            ],
            tiles: [],
            limits: {
              fullDetailFiles: 10_000,
              maxTileRecords: 128,
              maxPathHistory: 8,
              maxTombstones: 256,
            },
          },
        }),
      );
      return;
    }

    if (pathname.endsWith("/agent-sessions/native") && method === "GET") {
      const hermes = agents.find((agent) => agent.adapterId === "hermes")!;
      await fulfillJson(
        route,
        envelope([
          {
            id: hermes.nativeRootSessionRef,
            source: "cli",
            title: hermes.displayName,
            displayName: hermes.displayName,
            messageCount: 12,
          },
        ]),
      );
      return;
    }

    if (pathname.endsWith("/agent-sessions/attach") && method === "POST") {
      const hermes = agents.find((agent) => agent.adapterId === "hermes")!;
      await fulfillJson(route, envelope(sessionFor(hermes)));
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
      constellationReadyAfterRestore = true;
      const sessionId = decodeURIComponent(sessionMatch[1]!);
      const operation = sessionMatch[2]!;
      const agent = agents.find(
        (candidate) => candidate.worldSessionId === sessionId,
      )!;
      const proposal = proposalFor(agent);
      const session = sessionFor(agent);
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
                  messages:
                    agent.adapterId === "hermes" ? hermesHistoryMessages : [],
                  transcriptAuthority:
                    agent.adapterId === "hermes"
                      ? "hermes"
                      : "world-projection",
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
      const mentionedName =
        typeof body.text === "string"
          ? /^@([^\s]+)(?:\s|$)/u.exec(body.text)?.[1]
          : undefined;
      const targetRosterId =
        typeof body.targetRosterId === "string"
          ? body.targetRosterId
          : (agents.find(
              (agent) =>
                mentionedName?.localeCompare(agent.displayName, undefined, {
                  sensitivity: "accent",
                }) === 0,
            )?.rosterId ?? null);
      resolvedTargetRosterIds.push(targetRosterId);
      const recipients = targetRosterId
        ? agents.filter((agent) => agent.rosterId === targetRosterId)
        : agents;
      if (recipients.some((agent) => agent.adapterId === "hermes")) {
        const text = String(body.text);
        hermesHistoryMessages.push(
          { role: "user", text },
          { role: "assistant", text: `Mr Fluff received ${text}` },
        );
      }
      const responseReady = nextGroupedResponse;
      nextGroupedResponse = undefined;
      await responseReady;
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

  await page.route("**/api/repository-intake/projects", (route) =>
    route.fulfill({ json: { ok: true, data: { projects: [] } } }),
  );
  await page.route("**/api/repository-intake/open", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          project: {
            id: "code-wheel-project",
            name: "Code Wheel fixture",
            rootPath: "/fixture",
            source: "local",
            pinned: false,
            lastOpenedAt: "2026-05-23T00:00:00Z",
          },
        },
      },
    }),
  );
  await page.route("**/api/repository-indexes", (route) =>
    fulfillJson(
      route,
      envelope(
        RepositoryIndexOperationSchema.parse({
          id: "66666666-6666-4666-8666-666666666666",
          rootPath: ".",
          status: "succeeded",
          generation: {
            id: "77777777-7777-4777-8777-777777777777",
            fingerprint: "b".repeat(64),
            rootPath: ".",
            repositoryName: "fixture",
            startedAt: "2026-07-25T00:00:00.000Z",
            completedAt: "2026-07-25T00:00:01.000Z",
            durationMs: 1_000,
            git: { present: false, branch: null, head: null, dirty: false },
            directories: [],
            files: [],
            packages: [],
            coverage: {
              discoveredFiles: 0,
              indexedFiles: 0,
              prunedEntries: 0,
              skippedSymlinks: 0,
              directories: 0,
              packages: 0,
              binaryFiles: 0,
              oversizedFiles: 0,
              bytesHashed: 0,
            },
          },
          createdAt: "2026-07-25T00:00:00.000Z",
          updatedAt: "2026-07-25T00:00:01.000Z",
          progress: {
            phase: "complete",
            discoveredFiles: 1,
            indexedFiles: 1,
            bytesHashed: 4800,
          },
        }),
      ),
    ),
  );
  return {
    transcriptionBodies,
    groupedBodies,
    resolvedTargetRosterIds,
    holdNextGroupedResponse: () => {
      let release!: () => void;
      nextGroupedResponse = new Promise<void>((resolve) => {
        release = resolve;
      });
      return release;
    },
    delayConstellationReadyUntilRestore: () => {
      constellationReadyAfterRestore = false;
    },
  };
}

async function openCodeWheel(page: Page) {
  if (
    await page.getByRole("group", { name: "Code Wheel", exact: true }).count()
  )
    return;
  // A normal middle press on exposed World; never dispatch a synthetic UI click.
  const point = await page.locator("main.world-room").evaluate((room) => {
    const bounds = room.getBoundingClientRect();
    for (const x of [
      bounds.left + bounds.width * 0.65,
      bounds.left + bounds.width * 0.5,
      bounds.left + bounds.width * 0.8,
    ]) {
      for (const y of [
        bounds.top + bounds.height * 0.45,
        bounds.top + bounds.height * 0.3,
      ]) {
        const target = document.elementFromPoint(x, y);
        if (
          target &&
          room.contains(target) &&
          !target.closest(
            'button, input, [role="button"], .world-screen__object, .repository-asset-palette',
          )
        )
          return { x, y };
      }
    }
    throw new Error("No exposed World input point");
  });
  await page.mouse.click(point.x, point.y, { button: "middle" });
  await expect(
    page.getByRole("group", { name: "Code Wheel", exact: true }),
  ).toBeVisible();
}

test("@code-wheel real controls isolate scene input, retain targeting and spatial state", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await seedConfiguredAvatar(page, "Aaron");
  const fixture = await installFixture(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const repository = {
    repositoryId: "aiw://object/22222222222222222222222222222222",
    revision: "77777777-7777-4777-8777-777777777777",
  };
  const agent = {
    agentId: agents[1].worldSessionId,
    nativeSessionId: agents[1].nativeRootSessionRef,
    rootNativeSessionId: agents[1].nativeRootSessionRef,
    revision: "0",
  };
  const baseWorkstream = {
    schema: "aiw.workstream/1",
    workstreamId: "88888888-8888-4888-8888-888888888888",
    revision: 1,
    title: "Build a settings panel",
    task: "Build a settings panel",
    repository,
    agent,
    authority: {
      schema: "aiw.worktree-authority-receipt/1",
      ownerId: "workstream-owner",
      requestId: "workstream-authority-request",
      worktreeId: "worktree-settings",
      repositoryId: repository.repositoryId,
      relativePath: "worktree-settings",
      branch: "workstream/settings",
      head: "a".repeat(40),
      state: "current",
      statusSummary: "Owned worktree is current and ready.",
      validatedAt: "2026-09-03T15:00:00.000Z",
      attestation: "b".repeat(64),
    },
    worktreeState: "current",
    evidenceOperationRefs: [],
    projection: {
      currentActivity: "Owned worktree is current and ready.",
      changedFiles: [],
      diff: { summary: "", patch: "", truncated: false },
      validation: [],
      evidenceRefs: [],
    },
    status: "working",
    createdAt: "2026-09-03T15:00:00.000Z",
    updatedAt: "2026-09-03T15:00:00.000Z",
    events: [
      {
        eventId: "88888888-8888-4888-8888-888888888888/event/1",
        status: "working",
        summary: "Owned worktree is current and ready.",
        occurredAt: "2026-09-03T15:00:00.000Z",
      },
    ],
  } as const;
  let currentWorkstream: Record<string, unknown> | null = null;
  const createRequests: Record<string, unknown>[] = [];
  await page.route("**/api/workstreams**", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      createRequests.push(body);
      currentWorkstream = { ...baseWorkstream, ...body };
      await route.fulfill({
        json: {
          ok: true,
          data: { workstream: currentWorkstream, replayed: false },
        },
      });
    } else if (currentWorkstream)
      await route.fulfill({ json: { ok: true, data: currentWorkstream } });
    else
      await route.fulfill({
        status: 404,
        json: {
          ok: false,
          error: { code: "not_found", message: "No current Workstream" },
        },
      });
  });
  const movement: { path: string; body: unknown }[] = [];
  await page.route("**/api/world-actions/**", async (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      movement.push({
        path: new URL(req.url()).pathname,
        body: req.postDataJSON(),
      });
      await fulfillJson(
        route,
        {},
        req.url().endsWith("/proposals") ? 202 : 200,
      );
    } else
      await fulfillJson(route, {
        capability: { enabled: true },
        actions: [],
        executions: [],
      });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Reconnect", exact: true }).click();
  await page.getByRole("button", { name: "Enter World", exact: true }).click();
  await expect(page.getByTestId("world-hud")).toBeVisible();
  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-renderer",
    "webgl",
  );
  await expect(page.locator(".world-room__agent-targets")).toHaveCount(0);
  const wheelHint = page.getByText(
    "Press Middle Mouse to open the Code Wheel",
    { exact: true },
  );
  await expect(wheelHint).toBeVisible();
  const hintBox = (await wheelHint.boundingBox())!;
  const chatBox = (await page.locator(".world-hud__controls").boundingBox())!;
  expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(chatBox.y);
  expect(chatBox.y - hintBox.y - hintBox.height).toBeLessThan(16);
  await page.screenshot({
    path: testInfo.outputPath("code-wheel-first-load-hint.png"),
  });
  await page
    .getByRole("textbox", { name: /^Message / })
    .click({ button: "middle" });
  await expect(wheelHint).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Code Wheel", exact: true }),
  ).toHaveCount(0);
  await openCodeWheel(page);
  await expect(wheelHint).toBeHidden();
  const wheel = page.getByRole("group", { name: "Code Wheel", exact: true });
  const nameButton = (name: string) =>
    wheel.getByRole("button", {
      name: `Send next message to ${name}`,
      exact: true,
    });
  await expect(
    wheel.getByRole("button", { name: /^Send next message to / }),
  ).toHaveCount(4);
  const selectedCodeBefore = await page
    .locator(".repository-code-screen")
    .count();
  await nameButton("Claw").click();
  await expect(
    page.getByRole("textbox", { name: "Message Claw", exact: true }),
  ).toBeVisible();
  await wheel
    .getByRole("button", {
      name: "Clear Claw and send to all agents",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Message All agents", exact: true }),
  ).toBeVisible();
  expect(await page.locator(".repository-code-screen").count()).toBe(
    selectedCodeBefore,
  );
  const draft = page.getByRole("textbox", { name: /^Message / });
  await draft.fill("keep this unsent draft");
  await nameButton("Claw").click();
  await wheel.getByRole("button", { name: "Follow me", exact: true }).click();
  await expect
    .poll(() => movement.filter((x) => x.path.endsWith("/proposals")).length)
    .toBe(1);
  expect(movement[0]!.path).toContain(agents[1].worldSessionId);
  await expect(draft).toHaveValue("keep this unsent draft");
  await wheel.getByRole("button", { name: "Agent Stop", exact: true }).click();
  await expect
    .poll(() => movement.filter((x) => x.path.endsWith("/interrupt")).length)
    .toBe(4);
  expect(fixture.groupedBodies).toHaveLength(0);
  await wheel
    .getByRole("button", { name: "New Workstream", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "New Workstream", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start Workstream", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("dialog", { name: "New Workstream", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(wheel).toBeVisible();
  await wheel.getByRole("button", { name: "Load Repo", exact: true }).click();
  await page.getByLabel("Local repository path").fill("/fixture");
  await page.getByRole("button", { name: "Open local", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Place Live / Director in World" }),
  ).toBeVisible();
  await wheel.getByRole("button", { name: "Screens", exact: true }).click();
  const beforePlacement = await wheel.boundingBox();
  await page
    .locator(".code-wheel__outer")
    .getByRole("button", { name: "Live / Director", exact: true })
    .click();
  await expect(
    page.locator(
      '[data-world-screen="director"][data-screen-mode="spatial"] .world-screen__object',
    ),
  ).toBeVisible();
  expect(await wheel.boundingBox()).toEqual(beforePlacement);
  await wheel
    .getByRole("button", { name: "Send next message to Claw" })
    .click();
  await expect(page.getByLabel("Message Claw")).toBeVisible();
  await page
    .locator(".code-wheel__outer")
    .getByRole("button", { name: "Live / Director", exact: true })
    .click();
  expect(await wheel.boundingBox()).toEqual(beforePlacement);
  await wheel.getByRole("button", { name: "All agents", exact: true }).click();
  await wheel.getByRole("button", { name: "Screens", exact: true }).click();
  await wheel.getByRole("button", { name: "Screens", exact: true }).click();
  await expect(
    wheel.getByRole("button", { name: "World View", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  // Explicit confirmation reaches the existing Workstream API exactly once.
  expect(createRequests).toHaveLength(0);
  await nameButton("Claw").click();
  await wheel
    .getByRole("button", { name: "New Workstream", exact: true })
    .click();
  expect(createRequests).toHaveLength(0);
  const taskDialog = page.getByRole("dialog", {
    name: "New Workstream",
    exact: true,
  });
  await taskDialog
    .getByRole("textbox")
    .fill("Build the fixture settings panel");
  await taskDialog
    .getByRole("button", { name: "Start Workstream", exact: true })
    .click();
  await expect.poll(() => createRequests.length).toBe(1);
  expect(createRequests[0]).toMatchObject({
    task: "Build the fixture settings panel",
    agent: { agentId: agents[1].worldSessionId },
  });
  await expect(
    page.getByRole("complementary", { name: "Current Workstream" }),
  ).toBeVisible();
  await wheel
    .getByRole("button", { name: "Workbench", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("region", { name: "Work Inspector" }),
  ).toBeVisible();
  const screenButtons = page.locator(".code-wheel__outer");
  await screenButtons
    .getByRole("button", { name: "Live / Director", exact: true })
    .click();
  await screenButtons
    .getByRole("button", { name: "Workbench", exact: true })
    .click();
  const screenPoses = await page
    .locator('[data-world-screen][data-screen-mode="spatial"]')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        id: node.getAttribute("data-world-screen"),
        x: Number(node.getAttribute("data-screen-x")),
        z: Number(node.getAttribute("data-screen-z")),
      })),
    );
  expect(screenPoses).toHaveLength(2);
  expect(
    Math.hypot(
      screenPoses[0]!.x - screenPoses[1]!.x,
      screenPoses[0]!.z - screenPoses[1]!.z,
    ),
  ).toBeGreaterThan(4);
  await page.screenshot({ path: testInfo.outputPath("code-wheel-open.png") });
  // Wheel stays open after outside left click; UI middle press never opens/closes it.
  await draft.click({ button: "middle" });
  await expect(wheel).toBeVisible();
  await wheel
    .getByRole("button", { name: "All agents", exact: true })
    .click({ button: "middle" });
  await expect(wheel).toHaveCount(0);
  await expect(wheelHint).toBeHidden();
  await draft.click({ button: "middle" });
  await expect(wheel).toHaveCount(0);
  await openCodeWheel(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      page
        .locator(".code-wheel__stream")
        .evaluate((el) => getComputedStyle(el).animationName),
    )
    .toBe("none");
  await page.setViewportSize({ width: 390, height: 844 });
  const rect = await page.locator(".code-wheel").boundingBox();
  expect(rect!.x).toBeGreaterThanOrEqual(7);
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(383);
  await page.screenshot({
    path: testInfo.outputPath("code-wheel-portrait.png"),
  });
  await page.reload();
  await expect(page.getByTestId("world-hud")).toBeVisible();
  await expect(wheelHint).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("code-wheel-fresh-load-hint-portrait.png"),
  });
  expect(errors).toEqual([]);
});

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

test("movement mentions preserve chat routing and secondary follow advances during held input", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await seedConfiguredAvatar(page, "Aaron");
  const fixture = await installFixture(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  type Envelope = ReturnType<typeof WorldActionEnvelopeSchema.parse>;
  const active = new Map<string, { envelope: Envelope; state: string }>();
  const directedActors: string[] = [];
  const stops: string[] = [];
  await page.route("**/api/world-actions/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const sessionId = pathname.split("/")[3]!;
    if (request.method() === "POST" && pathname.endsWith("/proposals")) {
      const proposal = WorldActionProposalSchema.parse(request.postDataJSON());
      expect(proposal.actions[0]).toMatchObject({
        actorId: sessionId,
        source: "user-directed",
      });
      directedActors.push(sessionId);
      const envelope = WorldActionEnvelopeSchema.parse({
        schema: "aiw.world-action/0.13",
        requestId: randomUUID(),
        batchId: randomUUID(),
        sessionId,
        adapterSessionRef: agents.find((a) => a.worldSessionId === sessionId)!
          .nativeRootSessionRef,
        repositoryRef: "aiw://object/repository-a",
        worldGeneration: "world-a",
        layoutGeneration: "layout-a",
        graphGeneration: null,
        capabilitySnapshotHash: "a".repeat(64),
        sequence: directedActors.length,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
        actions: proposal.actions.map((action) => ({
          ...action,
          actionId: randomUUID(),
        })),
      });
      active.set(sessionId, { envelope, state: "path-planned" });
      await fulfillJson(route, {}, 202);
    } else if (request.method() === "POST") {
      const movement = active.get(sessionId);
      if (pathname.endsWith("/interrupt")) {
        stops.push(sessionId);
        if (movement) movement.state = "cancelled";
      } else if (movement) movement.state = request.postDataJSON().event;
      await fulfillJson(route, {});
    } else {
      const movement = active.get(sessionId);
      await fulfillJson(route, {
        capability: { enabled: true },
        actions: movement
          ? movement.envelope.actions.map((action) => ({
              actionId: action.actionId,
              kind: "move-agent",
              state: movement.state,
            }))
          : [],
        executions:
          movement && ["moving", "path-planned"].includes(movement.state)
            ? [{ accepted: true, envelope: movement.envelope }]
            : [],
      });
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Reconnect", exact: true }).click();
  await page.getByRole("button", { name: "Enter World", exact: true }).click();
  await expect(page.getByTestId("world-hud")).toBeVisible();
  const room = page.locator("main.world-room");
  const actorRows = page
    .getByRole("region", { name: "World scene status" })
    .getByRole("listitem")
    .filter({ hasText: "connected agent avatar" });
  await expect(actorRows).toHaveCount(4);
  const positions = () =>
    actorRows.evaluateAll((rows) =>
      rows.map((row) => {
        const match = row.textContent!.match(
          /position (-?[\d.]+),(-?[\d.]+)/u,
        )!;
        return { x: Number(match[1]), z: Number(match[2]) };
      }),
    );
  const send = async (text: string) => {
    const input = page.getByRole("textbox", { name: /^Message /u });
    await input.fill(text);
    await input.press("Enter");
    await input.blur();
  };
  const select = async () => {
    await openCodeWheel(page);
    await page
      .getByRole("button", { name: "Send next message to Codex", exact: true })
      .click();
  };
  // Ordinary chat retains selection-first backend routing and original text.
  await select();
  await send("@Mr Fluff explain following");
  await expect.poll(() => fixture.groupedBodies.length).toBe(1);
  expect(fixture.groupedBodies[0]).toMatchObject({
    text: "@Mr Fluff explain following",
    targetRosterId: "roster-codex",
  });
  await select();
  await send("@Mr Fluff /agent follow");
  await expect.poll(() => directedActors).toEqual([agents[0].worldSessionId]);
  await send("@Mr Fluff /agent stop");
  await expect.poll(() => stops).toEqual([agents[0].worldSessionId]);
  await select();
  await send("@Unknown Agent /agent follow");
  await expect(page.getByTestId("world-hud")).toContainText(
    "agent movement refused · recipient unavailable",
  );
  await send("@Mr Fluff /agent move invalid");
  await expect(page.getByTestId("world-hud")).toContainText(
    "agent movement refused · use /agent move",
  );
  expect(fixture.groupedBodies).toHaveLength(1);
  expect(directedActors).toHaveLength(1);
  await page
    .getByRole("button", {
      name: "Clear Codex and send to all agents",
      exact: true,
    })
    .click();
  await send("follow me");
  await expect.poll(() => directedActors.length).toBe(5);
  await expect
    .poll(
      async () =>
        (await actorRows.allTextContents()).every((text) =>
          text.includes("Idle"),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
  const before = await positions();
  const samples: Awaited<ReturnType<typeof positions>>[] = [];
  await page.keyboard.down("ArrowUp");
  try {
    // Sample while input is still held: release-only proof misses RAF clock resets.
    await expect
      .poll(
        async () => {
          const current = await positions();
          samples.push(current);
          return current.every(
            (point, index) =>
              Math.hypot(
                point.x - before[index]!.x,
                point.z - before[index]!.z,
              ) > 0.5,
          );
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  } finally {
    await page.keyboard.up("ArrowUp");
  }
  await send("stop following me");
  await expect
    .poll(async () =>
      (await actorRows.allTextContents()).every((text) =>
        text.includes("Idle"),
      ),
    )
    .toBe(true);
  const stopped = await positions();
  const userX = Number(await room.getAttribute("data-user-position-x"));
  await page.keyboard.down("ArrowRight");
  try {
    await expect
      .poll(
        async () =>
          Number(await room.getAttribute("data-user-position-x")) - userX,
      )
      .toBeGreaterThan(2);
    expect(await positions()).toEqual(stopped);
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  expect(errors).toEqual([]);
  await testInfo.attach("continuous-secondary-movement", {
    body: JSON.stringify(
      { directedActors, stops, before, samples, stopped, errors },
      null,
      2,
    ),
    contentType: "application/json",
  });
});

test("Task 15 composes four exact agents with grouped text, targeting, and push-to-talk", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedConfiguredAvatar(page, "Aaron");
  const fixture = await installFixture(page);
  await page.goto("/");

  const blockedEnterWorld = page.getByRole("button", { name: "Enter World" });
  if ((await blockedEnterWorld.count()) === 0)
    await expect(blockedEnterWorld).toHaveCount(0);
  else await expect(blockedEnterWorld).toBeDisabled();
  const constellationRegion = page.getByRole("region", {
    name: "Connected agent constellation",
  });
  await expect(
    constellationRegion.getByText("Codex · codex · Stale"),
  ).toBeVisible();
  await expect(constellationRegion.getByRole("listitem")).toHaveCount(4);
  await page.getByRole("button", { name: "Reconnect" }).click();
  const enterWorld = page.getByRole("button", { name: "Enter World" });
  await expect(enterWorld).toBeEnabled();
  await enterWorld.click();
  await expect(page.getByTestId("world-hud")).toBeVisible();
  await openCodeWheel(page);
  await expect(
    page.getByRole("button", { name: /^Send next message to /u }),
  ).toHaveCount(4);
  await expect(
    page
      .getByRole("region", { name: "World scene status" })
      .getByRole("listitem")
      .filter({ hasText: "connected agent avatar" }),
  ).toHaveCount(4);
  await expect(
    page.getByRole("link", { name: /Workbench|dashboard/iu }),
  ).toHaveCount(0);
  const pushToTalk = page.locator("button.world-ptt");
  const agentActivityStates = page.locator(
    "[data-roster-id][data-activity-state]",
  );
  await expect(agentActivityStates).toHaveCount(4);
  expect(
    await agentActivityStates.evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-activity-state")),
    ),
  ).toEqual(["idle", "idle", "idle", "idle"]);
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
        (window as unknown as { __task15GetUserMediaCalls: number })
          .__task15GetUserMediaCalls,
    ),
  ).toBe(0);
  await disclosure.getByRole("button", { name: "Enable microphone" }).click();
  await expect(disclosure).toBeHidden();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __task15GetUserMediaCalls: number })
          .__task15GetUserMediaCalls,
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
  // Keep the real request pending until its activity state is observed.
  const releaseBroadcast = fixture.holdNextGroupedResponse();
  await page
    .getByRole("region", { name: "Final voice caption" })
    .getByRole("button", { name: "Send" })
    .click();
  try {
    await expect
      .poll(() =>
        agentActivityStates.evaluateAll((items) =>
          items.map((item) => item.getAttribute("data-activity-state")),
        ),
      )
      .toEqual(["thinking", "thinking", "thinking", "thinking"]);
  } finally {
    releaseBroadcast();
  }
  await expect
    .poll(() =>
      agentActivityStates.evaluateAll((items) =>
        items.map((item) => item.getAttribute("data-activity-state")),
      ),
    )
    .toEqual(["idle", "idle", "idle", "idle"]);
  await expect(page.getByLabel("Message All agents")).toBeVisible();

  await page
    .getByRole("button", { name: "Send next message to Codex" })
    .click();
  await expect(page.getByLabel("Message Codex")).toBeVisible();
  await page
    .getByRole("button", { name: "Clear Codex and send to all agents" })
    .click();
  await expect(page.getByLabel("Message All agents")).toBeVisible();
  await page
    .getByRole("button", { name: "Send next message to Codex" })
    .click();
  await expect(page.getByLabel("Message Codex")).toBeVisible();
  await pushToTalk.focus();
  await page.keyboard.down("Space");
  await expect(pushToTalk).toContainText("Listening");
  await page.keyboard.up("Space");
  await expect(page.getByLabel("Final caption")).toHaveValue("voice final 4");
  const releaseTargeted = fixture.holdNextGroupedResponse();
  await page
    .getByRole("region", { name: "Final voice caption" })
    .getByRole("button", { name: "Send" })
    .click();
  try {
    await expect
      .poll(() =>
        agentActivityStates.evaluateAll((items) =>
          items.map((item) => item.getAttribute("data-activity-state")),
        ),
      )
      .toEqual(["idle", "idle", "thinking", "idle"]);
  } finally {
    releaseTargeted();
  }
  await expect
    .poll(() =>
      agentActivityStates.evaluateAll((items) =>
        items.map((item) => item.getAttribute("data-activity-state")),
      ),
    )
    .toEqual(["idle", "idle", "idle", "idle"]);
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
        (window as unknown as { __task15SpeechSpeakCalls: number })
          .__task15SpeechSpeakCalls,
    ),
  ).toBe(0);

  const broadcastInput = page.getByLabel("Message All agents");
  await broadcastInput.fill("typed Task 15 broadcast");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByLabel("Message All agents")).toBeVisible();
  await broadcastInput.fill("@Claude typed Task 15 target");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByLabel("Message All agents")).toBeVisible();

  await expect.poll(() => fixture.groupedBodies.length).toBe(4);
  expect(fixture.groupedBodies).toHaveLength(4);
  expect(fixture.groupedBodies[2]).toMatchObject({
    text: "typed Task 15 broadcast",
  });
  expect(fixture.groupedBodies[2]).not.toHaveProperty("targetRosterId");
  expect(fixture.groupedBodies[3]).toMatchObject({
    text: "@Claude typed Task 15 target",
  });
  expect(fixture.groupedBodies[3]).not.toHaveProperty("targetRosterId");
  expect(fixture.resolvedTargetRosterIds[3]).toBe("roster-claude");

  fixture.delayConstellationReadyUntilRestore();
  await page.reload();
  await expect(page.getByTestId("world-hud")).toBeVisible();
  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-floor-state",
    "repository",
  );
  await openCodeWheel(page);
  await expect(
    page.getByRole("button", { name: /^Send next message to /u }),
  ).toHaveCount(4);
  await expect(
    page.getByText("typed Task 15 broadcast", { exact: true }),
  ).toBeVisible();

  const receipt = {
    schema: "aiw.phase19-task15-deterministic-browser/1",
    caseId: "four-agent-grouped-voice-refresh",
    source: "production-bundle-with-deterministic-routes",
    agents: agents.map((agent) => ({
      rosterId: agent.rosterId,
      adapterId: agent.adapterId,
      sessionOwnership: agent.sessionOwnership,
      addedOrder: agent.addedOrder,
    })),
    checks: {
      staleEntryBlockedBeforeReconnect: true,
      exactReconnectEnabledEntry: true,
      fourTargetControlsAndAvatars: true,
      internalWorkbenchAbsent: true,
      pointerTouchFocusedSpaceVoice: true,
      broadcastAndSelectedVoiceRouting: true,
      typedBroadcastAndExactMentionRouting: true,
      rawAudioAbsentFromGroupedPayloads: true,
      speechPlaybackAbsent: true,
      refreshRestoredWorldRosterAndTranscript: true,
    },
    transcriptionCount: fixture.transcriptionBodies.length,
    groupedRequestCount: fixture.groupedBodies.length,
    resolvedTargetRosterIds: fixture.resolvedTargetRosterIds,
  };
  await testInfo.attach("task15-deterministic-receipt", {
    body: `${JSON.stringify(receipt, null, 2)}\n`,
    contentType: "application/json",
  });
});
