import { expect, test, type Page, type Route } from "@playwright/test";

import { seedConfiguredAvatar } from "./helpers.js";
import { openCodeWheel } from "./world-code-wheel.js";
import { randomUUID } from "node:crypto";
import { RepositoryIndexOperationSchema } from "@agentintersect-world/world-schema";
import {
  WorldActionEnvelopeSchema,
  WorldActionProposalSchema,
} from "@agentintersect-world/world-action-protocol";

const worldInstanceId = "80000000-0000-4000-8000-000000000008";

test("@agent-handoff commit or skip before switching and choose the new Workstream source", async ({
  page,
}, testInfo) => {
  // Commit/skip, source choices and retained-World checks take ~120s on two CPUs.
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedConfiguredAvatar(page, "Aaron");
  await installFixture(page, 0);
  await page.addInitScript(
    (id) => localStorage.setItem("aiw.agent-session.pointer.0.12", id),
    agents[0].worldSessionId,
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const registrations = agents.map((a, i) => ({
    id: `11111111-1111-4111-8111-11111111111${i}`,
    adapterId: a.adapterId,
    displayName: a.displayName,
    installationId: a.adapterId,
    environment: {
      id: "wsl:Ubuntu",
      kind: "wsl",
      label: "WSL (Ubuntu)",
      distro: "Ubuntu",
    },
    executablePath: "/fixture/agent",
    homePath: "/fixture",
    identity: {
      id: "default",
      label: "Default",
      kind: "profile",
      profilePath: "/fixture/profile",
    },
    connectedAt: new Date().toISOString(),
  }));
  await page.route("**/api/agent-setup**", (route) =>
    fulfillJson(
      route,
      envelope(
        route.request().url().endsWith("/recheck")
          ? { status: "ready", message: "Ready" }
          : { schema: "aiw.agent-setup/1", completed: true, registrations },
      ),
    ),
  );
  const repository = {
    repositoryId: "aiw://object/22222222222222222222222222222222",
    revision: "77777777-7777-4777-8777-777777777777",
  };
  let work = {
    schema: "aiw.workstream/1",
    workstreamId: "88888888-8888-4888-8888-888888888888",
    revision: 2,
    title: "Existing website",
    task: "Existing website",
    repository,
    agent: {
      agentId: agents[0].worldSessionId,
      nativeSessionId: agents[0].nativeRootSessionRef,
      rootNativeSessionId: agents[0].nativeRootSessionRef,
      revision: "0",
    },
    authority: {
      schema: "aiw.worktree-authority-receipt/1",
      ownerId: "source-owner",
      requestId: "source-request",
      worktreeId: "worktree-source",
      repositoryId: repository.repositoryId,
      relativePath: "worktree-source",
      branch: "workstream/source",
      head: "a".repeat(40),
      state: "dirty",
      statusSummary: "Dirty",
      validatedAt: "2026-09-03T15:00:00.000Z",
      attestation: "b".repeat(64),
    },
    worktreeState: "dirty",
    evidenceOperationRefs: [],
    projection: {
      currentActivity: "Homepage ready",
      changedFiles: [
        { path: "index.html", change: "added", diffSummary: "?? index.html" },
      ],
      diff: { summary: "", patch: "", truncated: false },
      validation: [],
      evidenceRefs: [],
    },
    status: "ready-for-review",
    createdAt: "2026-09-03T15:00:00.000Z",
    updatedAt: "2026-09-03T15:00:00.000Z",
    events: [],
  };
  const sourceId = work.workstreamId;
  let head = "a".repeat(40);
  let dirty = true;
  const creates: Record<string, unknown>[] = [];
  const iterations: unknown[] = [];
  const commits: Record<string, unknown>[] = [];
  const gitStatus = () => ({
    head,
    branch: "workstream/source",
    upstream: null,
    remotes: [],
    changes: dirty ? [{ path: "index.html", status: "??" }] : [],
    commits: [
      { sha: head, subject: "Website", date: "2026-09-03T15:00:00.000Z" },
    ],
  });
  await page.route(
    "**/api/repository-intake/projects/code-wheel-project/git**",
    async (route) => {
      if (route.request().method() === "POST") {
        commits.push(route.request().postDataJSON());
        head = "c".repeat(40);
        dirty = false;
        await fulfillJson(
          route,
          envelope({ status: gitStatus(), message: "Local commit created" }),
        );
      } else await fulfillJson(route, envelope(gitStatus()));
    },
  );
  await page.route("**/api/workstreams**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/source")) {
      const file = new URL(route.request().url()).searchParams.get("path");
      return fulfillJson(
        route,
        envelope({
          objectRef: file ?? `aiw://object/workstream-${sourceId}`,
          repositoryRef: repository.repositoryId,
          path: file ?? work.title,
          kind: file ? "file" : "workstream",
          files: [{ ref: "index.html", path: "index.html" }],
          content: file ? "<body>Preserved earlier website</body>" : null,
          message: "Saved Workstream source",
        }),
      );
    }
    if (path.endsWith("/previews/current"))
      return fulfillJson(
        route,
        envelope({
          schema: "aiw.preview-manager/1",
          active: null,
          latestAttempt: null,
          previousVerified: null,
          display: null,
        }),
      );
    if (route.request().method() === "POST") {
      if (path.endsWith("/iterations")) {
        iterations.push(route.request().postDataJSON());
        return fulfillJson(
          route,
          envelope({ workstream: work, replayed: false }),
        );
      }
      const body = route.request().postDataJSON();
      creates.push(body);
      work = { ...work, ...body, workstreamId: randomUUID(), revision: 1 };
      return fulfillJson(
        route,
        envelope({ workstream: work, replayed: false }),
      );
    }
    return fulfillJson(
      route,
      envelope(path.endsWith("/history") ? { workstreams: [work] } : work),
    );
  });
  await page.goto("/");
  const room = page.locator(".world-room");
  await expect(room).toHaveAttribute("data-scene-ready", "true", {
    timeout: 60_000,
  });
  await room
    .locator("canvas")
    .evaluate((el) => el.setAttribute("data-handoff-retained", "yes"));
  await openCodeWheel(page);
  await page.getByRole("button", { name: "Load Repo", exact: true }).click();
  await page.getByLabel("Local repository path").fill("/fixture");
  await page.getByRole("button", { name: "Open local", exact: true }).click();
  await expect(
    page.locator(".world-experience[data-repository-readiness]"),
  ).toHaveAttribute("data-repository-readiness", "ready", { timeout: 60_000 });
  const initialChat = page.getByRole("textbox", {
    name: "Message Mr Fluff",
    exact: true,
  });
  await initialChat.fill("/work status");
  await initialChat.press("Enter");
  await expect(
    page.locator(
      '.world-workstream-status[data-workstream-status="ready-for-review"]',
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close Work Inspector", exact: true })
    .click();
  const openChange = async () => {
    await room.focus();
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Change Agent", exact: true })
      .click();
  };
  const prompt = page.getByRole("dialog", {
    name: "Save work before changing agent",
  });
  await openChange();
  await expect(prompt).toBeVisible();
  await expect(page.locator(".world-experience--room")).toHaveAttribute(
    "inert",
    "",
  );
  await prompt.focus();
  await page.keyboard.press("Escape");
  await expect(prompt).toHaveCount(0);
  await openChange();
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(commits).toHaveLength(0);
  expect(creates).toHaveLength(0);
  await openChange();
  await expect(
    prompt.getByRole("button", { name: "Review local commit" }),
  ).toBeEnabled();
  await page.screenshot({
    path: testInfo.outputPath("change-agent-work-prompt.png"),
  });
  await prompt.getByRole("button", { name: "Review local commit" }).click();
  await prompt.getByRole("checkbox", { name: /index.html/ }).check();
  await prompt
    .getByLabel("Commit message", { exact: true })
    .fill("Save website before switching");
  await prompt
    .getByRole("button", { name: "Review commit (1 files)", exact: true })
    .click();
  expect(commits).toHaveLength(0);
  await prompt
    .getByRole("button", { name: "Confirm commit", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Change Agent", exact: true }),
  ).toBeVisible();
  expect(commits).toHaveLength(1);
  expect(commits[0]).toMatchObject({
    action: "commit",
    confirm: true,
    workstreamId: sourceId,
    files: ["index.html"],
  });
  await page
    .getByRole("dialog", { name: "Change Agent", exact: true })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  dirty = true;
  await openCodeWheel(page);
  await page.getByRole("button", { name: "Workbench", exact: true }).click();
  const bench = page.getByRole("dialog", {
    name: "Repository Workbench",
    exact: true,
  });
  await bench
    .getByRole("combobox", { name: "Workbench Git target", exact: true })
    .selectOption(sourceId);
  await bench
    .getByRole("button", { name: "Inspect saved files", exact: true })
    .click();
  const savedFiles = bench.getByRole("region", {
    name: "Saved Workstream files",
    exact: true,
  });
  await savedFiles
    .getByRole("button", { name: "index.html", exact: true })
    .click();
  await expect(
    savedFiles.getByLabel("Saved file contents", { exact: true }),
  ).toHaveText("<body>Preserved earlier website</body>");
  expect(commits).toHaveLength(1);
  expect(creates).toHaveLength(0);
  expect(iterations).toHaveLength(0);
  await savedFiles.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("saved-workstream-files.png"),
  });
  await bench
    .getByRole("button", { name: "Close saved files", exact: true })
    .click();
  await bench.getByRole("checkbox", { name: /index.html/ }).check();
  await bench
    .getByLabel("Commit message", { exact: true })
    .fill("Manual Workbench commit");
  await bench
    .getByRole("button", { name: "Review commit (1 files)", exact: true })
    .click();
  await bench
    .getByRole("button", { name: "Confirm commit", exact: true })
    .click();
  await expect(
    bench.getByText("Working tree is clean.", { exact: true }),
  ).toBeVisible();
  expect(commits).toHaveLength(2);
  expect(commits[1]).toMatchObject({
    workstreamId: sourceId,
    message: "Manual Workbench commit",
  });
  await bench
    .getByRole("button", { name: "Close Workbench", exact: true })
    .click();
  // Read actual Git, even while the saved Workstream projection says dirty.
  await openChange();
  await expect(prompt.getByText(/All changes committed/)).toBeVisible();
  await expect(
    prompt.getByRole("button", { name: "Review local commit" }),
  ).toHaveCount(0);
  await expect(
    prompt.getByRole("button", { name: "Change without committing" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("change-agent-committed.png"),
  });
  await prompt
    .getByRole("button", { name: "Continue to Change Agent", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Change Agent", exact: true })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(commits).toHaveLength(2);
  dirty = true;
  await openChange();
  await prompt
    .getByRole("button", { name: "Change without committing" })
    .click();
  const chooser = page.getByRole("dialog", {
    name: "Change Agent",
    exact: true,
  });
  await chooser
    .getByRole("button", { name: "Connect codex", exact: true })
    .click();
  await expect(
    chooser.getByRole("button", { name: "Accept Agent Avatar", exact: true }),
  ).toBeEnabled({ timeout: 30_000 });
  await chooser
    .getByRole("button", { name: "Accept Agent Avatar", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Message Codex", exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  expect(commits).toHaveLength(2);
  const chat = page.getByRole("textbox", {
    name: "Message Codex",
    exact: true,
  });
  await chat.fill("/work Change the homepage text");
  await chat.press("Enter");
  await expect(
    page
      .getByTestId("world-hud")
      .getByText(
        "Workbench error · Existing work owned by another agent. Start a new Workstream to continue this project.",
        { exact: true },
      ),
  ).toBeVisible();
  expect(iterations).toHaveLength(0);
  expect(creates).toHaveLength(0);
  await expect(page.getByText("Starting report", { exact: true })).toHaveCount(
    0,
  );
  for (const mode of ["uncommitted", "last-commit"] as const) {
    const expectedSource = work.workstreamId;
    await openCodeWheel(page);
    await page
      .getByRole("group", { name: "Code Wheel", exact: true })
      .getByRole("button", { name: "New Workstream", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "New Workstream",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS("background-color", "rgb(8, 17, 30)");
    await expect(dialog.getByRole("radio", { checked: true })).toHaveCount(0);
    await dialog
      .getByRole("radio", {
        name:
          mode === "uncommitted"
            ? "Copy current uncommitted work"
            : "Start from this Workstream’s last commit",
        exact: true,
      })
      .check();
    await dialog
      .getByLabel("New Workstream task")
      .fill("Change only the homepage text");
    await dialog.getByLabel("Workstream delivery intent").selectOption("local");
    await dialog.getByRole("checkbox").check();
    await expect(
      dialog.getByRole("button", { name: "Start Workstream", exact: true }),
    ).toBeEnabled();
    if (mode === "uncommitted") {
      await page.screenshot({
        path: testInfo.outputPath("new-workstream-source.png"),
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await dialog
        .getByRole("button", { name: "Start Workstream", exact: true })
        .scrollIntoViewIfNeeded();
      await expect(
        dialog.getByRole("button", { name: "Start Workstream", exact: true }),
      ).toBeInViewport();
      await page.screenshot({
        path: testInfo.outputPath("new-workstream-source-portrait.png"),
      });
      await page.setViewportSize({ width: 1280, height: 900 });
    }
    await dialog
      .getByRole("button", { name: "Start Workstream", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    expect(creates.at(-1)).toMatchObject({
      sourceWorkstream: {
        workstreamId: expectedSource,
        mode,
        expectedHead: head,
      },
      agent: { agentId: agents[2].worldSessionId },
      prIntent: "local",
    });
  }
  expect(creates).toHaveLength(2);
  await expect(room.locator("canvas")).toHaveAttribute(
    "data-handoff-retained",
    "yes",
  );
  expect(errors).toEqual([]);
});

test("slow movement polling stays single-flight and never duplicates the primary roster agent", async ({
  page,
}) => {
  await installFixture(page, 2);
  await seedConfiguredAvatar(page, "Probe");
  await page.route("**/api/agent-setup", (route) =>
    fulfillJson(
      route,
      envelope({
        schema: "aiw.agent-setup/1",
        completed: true,
        registrations: [],
      }),
    ),
  );
  await page.route("**/api/constellation/messages", (route) =>
    route.request().method() === "GET"
      ? fulfillJson(route, envelope([]))
      : route.fallback(),
  );
  const requests: string[] = [];
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/world-actions/*", async (route) => {
    requests.push(new URL(route.request().url()).pathname);
    await pending;
    await fulfillJson(route, {
      capability: { enabled: true },
      actions: [],
      executions: [],
    });
  });
  try {
    await page.goto("/");
    await page.getByTestId("world-hud").waitFor();
    await expect.poll(() => new Set(requests).size).toBe(2);
    // Keep the response pending across several old 500ms interval ticks.
    await page.waitForTimeout(1600);
    expect(requests).toHaveLength(2);
  } finally {
    release();
  }
});
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

async function installFixture(
  page: Page,
  initialCount = 4,
  registeredHermes = false,
) {
  const rosterAgents = [...agents.slice(0, initialCount)];
  const additions: unknown[] = [];
  const transcriptionBodies: unknown[] = [];
  const groupedBodies: Array<Record<string, unknown>> = [];
  let nextGroupedResponse: Promise<void> | undefined;
  const resolvedTargetRosterIds: Array<string | null> = [];
  const hermesHistoryMessages: Array<{
    readonly role: "user" | "assistant";
    readonly text: string;
  }> = [];
  let reconnected = initialCount < 3;
  let claudeFailed = false;
  let hermesFailed = false;
  const hermesConnectionId = "77000000-0000-4000-8000-000000000007";
  const hermesAttachBodies: Array<Record<string, unknown>> = [];
  let constellationReadyAfterRestore = true;
  const sessionFor = (agent: (typeof agents)[number]) => ({
    schema: "aiw.agent-session/0.12",
    sessionId: agent.worldSessionId,
    adapterId: agent.adapterId,
    ...(registeredHermes && agent.adapterId === "hermes"
      ? { connectionId: hermesConnectionId }
      : {}),
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
    status:
      (agent.adapterId === "claude-code" && claudeFailed) ||
      (agent.adapterId === "hermes" && hermesFailed)
        ? "error"
        : "ready",
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
      agents: rosterAgents.map((agent) => ({
        ...agent,
        worldInstanceId,
        ...(registeredHermes && agent.adapterId === "hermes"
          ? { sessionOwnership: "world-owned" }
          : {}),
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
    // Keep the real server-owned setup gate; these fixtures replace native work only.
    if (
      route.request().method() === "GET" &&
      new URL(route.request().url()).pathname === "/api/agent-setup"
    ) {
      await route.continue();
      return;
    }
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();

    if (pathname.endsWith("/workstreams/current")) {
      await route.fulfill({
        status: 404,
        json: {
          ok: false,
          error: { code: "not_found", message: "No current Workstream" },
        },
      });
      return;
    }
    if (pathname.endsWith("/repository-intake/selected") && method === "GET") {
      await fulfillJson(
        route,
        envelope({
          project: {
            id: "code-wheel-project",
            name: "Code Wheel fixture",
            rootPath: "/fixture",
            source: "local",
            pinned: false,
            lastOpenedAt: "2026-05-23T00:00:00Z",
          },
        }),
      );
      return;
    }
    if (
      pathname.endsWith("/repository-intake/projects/code-wheel-project/git") &&
      method === "GET"
    ) {
      await fulfillJson(
        route,
        envelope({
          rootPath: "/fixture",
          branch: "main",
          head: "a".repeat(40),
          changes: [],
          upstream: null,
          commits: [],
          remotes: [],
        }),
      );
      return;
    }

    if (initialCount < 4 && pathname === "/api/agent-sessions/world") {
      const adapterId = request.postDataJSON().adapterId;
      await fulfillJson(
        route,
        envelope(sessionFor(agents.find((a) => a.adapterId === adapterId)!)),
      );
      return;
    }
    if (
      initialCount < 4 &&
      pathname === "/api/constellation/agents" &&
      method === "POST"
    ) {
      const input = request.postDataJSON();
      additions.push(input);
      const added = agents.find(
        (a) => a.worldSessionId === input.agent.worldSessionId,
      )!;
      if (!rosterAgents.includes(added)) rosterAgents.push(added);
      reconnected = true;
      await fulfillJson(route, envelope(constellation()));
      return;
    }
    if (initialCount < 4 && pathname.endsWith("/avatar") && method === "POST") {
      await fulfillJson(route, envelope(constellation()));
      return;
    }
    if (
      initialCount < 4 &&
      pathname.endsWith("/avatar-consent") &&
      method === "POST"
    ) {
      await fulfillJson(route, envelope({ state: "accepted" }));
      return;
    }
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
      const input = request.postDataJSON();
      hermesAttachBodies.push(input);
      if (
        registeredHermes &&
        (input.connectionId !== hermesConnectionId ||
          input.worldInstanceId !== worldInstanceId)
      ) {
        await fulfillJson(
          route,
          {
            ok: false,
            error: {
              code: "conflict",
              message: "Hermes World ownership does not match",
            },
          },
          409,
        );
        return;
      }
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
    additions,
    hermesAttachBodies,
    failHermes: () => {
      hermesFailed = true;
    },
    recoverHermes: () => {
      hermesFailed = false;
      return constellation();
    },
    connectAll: () => {
      reconnected = true;
    },
    failClaude: () => {
      claudeFailed = true;
    },
    recoverClaude: () => {
      claudeFailed = false;
      return constellation();
    },
    removeClaude: () => {
      const index = rosterAgents.findIndex(
        (agent) => agent.adapterId === "claude-code",
      );
      if (index >= 0) rosterAgents.splice(index, 1);
      return constellation();
    },
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

for (const reconnect of [false, true]) {
  test(`@hermes-connection-restore preserves four agents and history (reconnect: ${reconnect})`, async ({
    page,
  }, testInfo) => {
    // Two refreshes plus a rendered four-avatar capture exceed the default
    // single-page watchdog on software-rendered CI.
    test.setTimeout(60000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedConfiguredAvatar(page, "Aaron");
    const fixture = await installFixture(page, 4, true);
    fixture.connectAll();
    if (reconnect) fixture.failHermes();
    await page.route("**/api/agent-setup", (route) =>
      fulfillJson(
        route,
        envelope({
          schema: "aiw.agent-setup/1",
          completed: true,
          registrations: [],
        }),
      ),
    );
    await page.route("**/api/constellation/messages", (route) =>
      route.request().method() === "GET"
        ? fulfillJson(route, envelope([]))
        : route.fallback(),
    );
    await page.route(
      "**/api/constellation/agents/roster-hermes/reconnect",
      (route) => fulfillJson(route, envelope(fixture.recoverHermes())),
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    if (reconnect) {
      const roster = page.getByRole("region", {
        name: "Connected agent constellation",
      });
      const hermes = roster.locator("li").filter({ hasText: "Mr Fluff" });
      await expect(hermes).toHaveAttribute("data-connection", "unavailable");
      await expect(
        roster.getByRole("button", { name: "Enter World" }),
      ).toBeDisabled();
      await hermes
        .getByRole("button", { name: "Reconnect", exact: true })
        .click();
      await expect(
        roster.getByRole("button", { name: "Enter World" }),
      ).toBeEnabled();
      await roster.getByRole("button", { name: "Enter World" }).click();
    }
    const assertRoster = async () => {
      await expect(page.getByTestId("world-hud")).toBeVisible();
      await expect
        .poll(() =>
          page
            .locator("[data-roster-id][data-activity-state]")
            .evaluateAll((rows) =>
              rows.map((row) => row.getAttribute("data-roster-id")).sort(),
            ),
        )
        .toEqual(agents.map((agent) => agent.rosterId).sort());
    };
    await assertRoster();
    const input = page.getByLabel("Message All agents", { exact: true });
    await input.fill("Hermes connection restore proof");
    await input.press("Enter");
    await expect.poll(() => fixture.groupedBodies.length).toBe(1);
    for (let refresh = 0; refresh < 2; refresh += 1) {
      await page.reload();
      await assertRoster();
      await expect(
        page
          .getByText("Mr Fluff received Hermes connection restore proof", {
            exact: false,
          })
          .first(),
      ).toBeVisible();
    }
    expect(fixture.additions).toEqual([]);
    expect(fixture.hermesAttachBodies.length).toBeGreaterThan(0);
    for (const body of fixture.hermesAttachBodies)
      expect(body).toMatchObject({
        connectionId: "77000000-0000-4000-8000-000000000007",
        worldInstanceId,
        adapterSessionRef: "native-hermes",
      });
    expect(errors).toEqual([]);
    const room = page.locator('[data-scene-id="world-room"]').first();
    await expect(room).toHaveAttribute("data-scene-ready", "true", {
      timeout: 30000,
    });
    await expect(room.locator("canvas")).toHaveAttribute(
      "data-avatar-arrival",
      "complete",
      { timeout: 30000 },
    );
    await page.screenshot({
      path: testInfo.outputPath("hermes-restored-world.png"),
    });
  });
}

for (const recovery of ["Reconnect", "Remove"] as const) {
  test(`@failed-turn-restore exposes ${recovery} after a failed Current agent and preserves healthy history`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedConfiguredAvatar(page, "Aaron");
    const fixture = await installFixture(page);
    fixture.connectAll();
    await page.route("**/api/agent-setup**", (route) =>
      route.fulfill({
        json: envelope({
          schema: "aiw.agent-setup/1",
          completed: true,
          registrations: [],
        }),
      }),
    );
    await page.route("**/api/constellation/messages", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: envelope([]) })
        : route.fallback(),
    );
    await page.route(
      "**/api/constellation/agents/roster-claude/reconnect",
      (route) => route.fulfill({ json: envelope(fixture.recoverClaude()) }),
    );
    await page.route("**/api/constellation/agents/roster-claude", (route) =>
      route.fulfill({ json: envelope(fixture.removeClaude()) }),
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.getByTestId("world-hud")).toBeVisible();
    const input = page.getByLabel("Message All agents", { exact: true });
    await input.fill("before failed turn");
    await input.press("Enter");
    await expect.poll(() => fixture.groupedBodies.length).toBe(1);
    await expect(
      page
        .getByText("Mr Fluff received before failed turn", { exact: false })
        .first(),
    ).toBeVisible();
    fixture.failClaude();
    await page.reload();
    const roster = page.getByRole("region", {
      name: "Connected agent constellation",
    });
    const failed = roster.locator("li").filter({ hasText: "Claude" });
    await expect(failed).toHaveAttribute("data-connection", "unavailable");
    // The entry roster lives in the existing scrollable setup surface.
    // Exercise normal scrolling before requiring a reachable recovery control.
    await failed
      .getByRole("button", { name: recovery, exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      failed.getByRole("button", { name: recovery, exact: true }),
    ).toBeInViewport();
    await expect(
      roster.getByRole("button", { name: "Enter World" }),
    ).toBeDisabled();
    await page.screenshot({
      path: testInfo.outputPath("failed-agent-recovery.png"),
    });
    await failed.getByRole("button", { name: recovery, exact: true }).click();
    await expect(
      roster.getByRole("button", { name: "Enter World" }),
    ).toBeEnabled();
    await roster.getByRole("button", { name: "Enter World" }).click();
    await expect(page.getByTestId("world-hud")).toBeVisible();
    await expect(
      page
        .getByText("Mr Fluff received before failed turn", { exact: false })
        .first(),
    ).toBeVisible();
    await input.fill("after recovery");
    await input.press("Enter");
    await expect.poll(() => fixture.groupedBodies.length).toBe(2);
    await page.reload();
    await expect(page.getByTestId("world-hud")).toBeVisible();
    await expect(
      page
        .getByText("Mr Fluff received after recovery", { exact: false })
        .first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("reentered-world.png") });
  });
}

test("@setup-escape returns from automatic setup to a clickable Add Agent dialog", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedConfiguredAvatar(page, "Aaron");
  await installFixture(page, 2);
  await page.route("**/api/agent-setup**", (route) =>
    route.fulfill({
      json: envelope({
        schema: "aiw.agent-setup/1",
        completed: true,
        registrations: [],
      }),
    }),
  );
  await page.route("**/api/constellation/messages", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: envelope([]) })
      : route.fallback(),
  );
  await page.goto("/");
  await expect(page.getByTestId("world-hud")).toBeVisible();
  const hint = page.locator(".agent-setup-escape-hint");
  const hintBox = await hint.boundingBox();
  expect(hintBox!.x).toBeGreaterThanOrEqual(12);
  expect(hintBox!.x).toBeLessThanOrEqual(24);
  expect(hintBox!.y).toBeLessThanOrEqual(24);
  await page.screenshot({
    path: testInfo.outputPath("escape-hint-top-left.png"),
  });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add Agent", exact: true }).click();
  const setup = page.getByRole("dialog", {
    name: "Agent Setup Menu",
    exact: true,
  });
  await expect(setup).toBeVisible();
  const discover = setup.getByRole("button", {
    name: "Discover Agents",
    exact: true,
  });
  await expect
    .poll(() =>
      discover.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        );
      }),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(setup).toHaveCount(0);
  const add = page.getByRole("dialog", { name: "Add Agent", exact: true });
  const cancel = add.getByRole("button", { name: "Cancel", exact: true });
  await expect(cancel).toBeVisible();
  await expect
    .poll(() =>
      cancel.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        );
      }),
    )
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath("add-after-escape.png") });
  await cancel.click();
  await expect(add).toHaveCount(0);
  await expect(page.getByTestId("world-hud")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add Agent", exact: true }).click();
  await expect(setup).toBeVisible();
  await setup.getByRole("button", { name: "Close Agent Setup Menu" }).click();
  await expect(cancel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(add).toHaveCount(0);
});

for (const [connectAction, single] of [
  ["Change Agent", false],
  ["Add Agent", false],
  ["Change Agent", true],
] as const) {
  test(`@menu-continuity ${connectAction} single=${single} retains repository, current work and avatar saves`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1600, height: 1000 });
    await seedConfiguredAvatar(page, "Aaron");
    const fixture = await installFixture(page, single ? 0 : 2);
    if (single)
      await page.addInitScript(
        (id) => localStorage.setItem("aiw.agent-session.pointer.0.12", id),
        agents[0].worldSessionId,
      );
    await page.route("**/api/constellation/messages", (route) =>
      route.request().method() === "GET"
        ? fulfillJson(route, envelope([]))
        : route.fallback(),
    );
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const mutations: string[] = [];
    page.on("request", (r) => {
      if (r.method() !== "GET") mutations.push(new URL(r.url()).pathname);
    });
    const registration = {
      id: "11111111-1111-4111-8111-111111111111",
      adapterId: "claude-code",
      displayName: "Claude",
      installationId: "claude",
      environment: {
        id: "wsl:Ubuntu",
        kind: "wsl",
        label: "WSL (Ubuntu)",
        distro: "Ubuntu",
      },
      executablePath: "/fixture/claude",
      homePath: "/fixture",
      identity: {
        id: "default",
        label: "Default",
        kind: "profile",
        profilePath: "/fixture/.claude",
      },
      connectedAt: new Date().toISOString(),
    };
    await page.route("**/api/agent-setup**", (route) =>
      fulfillJson(
        route,
        envelope(
          route.request().url().endsWith("/recheck")
            ? { status: "ready", message: "Ready" }
            : {
                schema: "aiw.agent-setup/1",
                completed: true,
                registrations: [registration],
              },
        ),
      ),
    );
    const repository = {
      repositoryId: "aiw://object/22222222222222222222222222222222",
      revision: "77777777-7777-4777-8777-777777777777",
    };
    const workOwner = agents[single ? 0 : 1];
    const agent = {
      agentId: workOwner.worldSessionId,
      nativeSessionId: workOwner.nativeRootSessionRef,
      rootNativeSessionId: workOwner.nativeRootSessionRef,
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
      } else if (new URL(route.request().url()).pathname.endsWith("/history"))
        await route.fulfill({
          json: {
            ok: true,
            data: { workstreams: currentWorkstream ? [currentWorkstream] : [] },
          },
        });
      else if (currentWorkstream)
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

    await page.route("**/api/preview-recipes?*", (route) =>
      fulfillJson(route, envelope([])),
    );
    const preview = {
      schema: "aiw.preview-record/1",
      previewId: "menu-preview",
      revision: 1,
      state: "ready",
      workstreamId: baseWorkstream.workstreamId,
      workstreamRevision: 1,
      repository,
      agent,
      worktreeId: "worktree-settings",
      worktreeState: "current",
      recipeId: "fixture",
      recipeRevision: 1,
      host: "127.0.0.1",
      port: 45173,
      pid: null,
      url: "http://127.0.0.1:45173/menu-preview-fixture",
      health: { ok: true, status: 200, checkedAt: "2026-09-19T00:00:00Z" },
      logs: "",
      logsTruncated: false,
      startedAt: "2026-09-19T00:00:00Z",
      readyAt: "2026-09-19T00:00:00Z",
      stoppedAt: null,
      portClosed: null,
      recovered: false,
      error: null,
    };
    await page.route("**/api/workstreams/*/previews/current", (route) =>
      fulfillJson(
        route,
        envelope({
          schema: "aiw.preview-manager/1",
          active: preview,
          latestAttempt: preview,
          previousVerified: null,
          display: { truth: "current", preview },
        }),
      ),
    );
    await page.route("**/menu-preview-fixture", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><html><body><p>Fixture live preview</p><input aria-label='Preview draft' value='Preserve this preview document'></body></html>",
      }),
    );
    await page.goto("/");
    const room = page.locator(".world-room");
    await expect(room).toHaveAttribute("data-scene-ready", "true", {
      timeout: 60_000,
    });
    await openCodeWheel(page);
    await page.getByRole("button", { name: "Load Repo", exact: true }).click();
    await page.getByLabel("Local repository path").fill("/fixture");
    await page.getByRole("button", { name: "Open local", exact: true }).click();
    await expect(room).toHaveAttribute("data-floor-state", "repository");
    await expect(
      page.locator(".world-experience[data-repository-readiness]"),
    ).toHaveAttribute("data-repository-readiness", "ready", {
      timeout: 60_000,
    });
    await openCodeWheel(page);
    if (!single)
      await page
        .getByRole("button", { name: "Send next message to Claw", exact: true })
        .click();
    await page
      .locator(".code-wheel")
      .getByRole("button", { name: "New Workstream", exact: true })
      .click();
    const task = page.getByRole("dialog", {
      name: "New Workstream",
      exact: true,
    });
    await task
      .getByRole("textbox", { name: "New Workstream task", exact: true })
      .fill("Keep this running work");
    await task
      .getByRole("checkbox", { name: /Create this isolated worktree/ })
      .check();
    await task
      .getByRole("button", { name: "Start Workstream", exact: true })
      .click();
    const workStatus = page.getByRole("complementary", {
      name: "Current Workstream",
    });
    await expect(workStatus).toBeVisible();
    expect(createRequests).toHaveLength(1);
    await room.evaluate((el) =>
      el.setAttribute("data-continuity-proof", "original"),
    );
    const canvas = room.locator("canvas");
    await canvas.evaluate((el) =>
      el.setAttribute("data-continuity-proof", "original"),
    );
    await page
      .getByLabel(single ? "Message Mr Fluff" : "Message Claw", { exact: true })
      .fill("keep this draft");
    const previewFrame = page.locator(".world-view__iframe");
    await expect(previewFrame).toBeVisible();
    await previewFrame.evaluate((el) =>
      el.setAttribute("data-continuity-proof", "original"),
    );
    const previewDocument = page.frameLocator(".world-view__iframe");
    await expect(previewDocument.getByLabel("Preview draft")).toHaveValue(
      "Preserve this preview document",
    );
    await previewDocument
      .getByLabel("Preview draft")
      .evaluate((el: HTMLInputElement) => {
        el.value = "Live unsaved preview state";
      });
    const assertContinuity = async () => {
      await expect(previewFrame).toHaveAttribute(
        "data-continuity-proof",
        "original",
      );
      await expect(previewDocument.getByLabel("Preview draft")).toHaveValue(
        "Live unsaved preview state",
      );
      await expect(room).toHaveAttribute("data-continuity-proof", "original");
      await expect(canvas).toHaveAttribute("data-continuity-proof", "original");
      await expect(room).toHaveAttribute("data-floor-state", "repository");
      await expect(workStatus).toBeVisible();
      await expect(workStatus).toContainText("Keep this running work");
      expect(createRequests).toHaveLength(1);
      expect(currentWorkstream).toMatchObject({
        status: "working",
        agent: { agentId: workOwner.worldSessionId },
      });
      await expect(
        page.getByRole("textbox", { name: /^Message / }),
      ).toHaveValue("keep this draft");
    };
    const menu = async (action: string, reviewSavedWork = false) => {
      await room.focus();
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: action, exact: true }).click();
      if (action === "Change Agent" && reviewSavedWork) {
        const savedWork = page.getByRole("dialog", {
          name: "Save work before changing agent",
          exact: true,
        });
        await expect(savedWork).toContainText("All changes committed");
        await savedWork
          .getByRole("button", {
            name: "Continue to Change Agent",
            exact: true,
          })
          .click();
      }
    };
    await menu("Change Agent", true);
    await page.screenshot({
      path: testInfo.outputPath("change-agent-desktop.png"),
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const switchDialog = page.getByRole("dialog", {
      name: "Change Agent",
      exact: true,
    });
    expect(
      await switchDialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    const logoGeometry = await switchDialog.evaluate((el) => ({
      labelTop: el
        .querySelector(".world-entry-logo__terminal")!
        .getBoundingClientRect().top,
      controlsBottom: Math.max(
        ...[...el.querySelectorAll(".world-harness")].map(
          (button) => button.getBoundingClientRect().bottom,
        ),
      ),
    }));
    expect(logoGeometry.labelTop).toBeGreaterThanOrEqual(
      logoGeometry.controlsBottom,
    );
    await page.screenshot({
      path: testInfo.outputPath("change-agent-portrait.png"),
    });
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page
      .getByRole("button", { name: "Use Mr Fluff", exact: true })
      .click();
    await expect(
      page.getByLabel("Message Mr Fluff", { exact: true }),
    ).toBeVisible();
    await assertContinuity();
    await menu("Change Avatar");
    await page
      .getByRole("button", { name: "Mr Fluff · connected agent", exact: true })
      .click();
    const selector = page.getByRole("region", {
      name: "Agent avatar selection",
      exact: true,
    });
    await expect(selector).toBeVisible();
    await selector
      .getByRole("button", { name: "Open Robot Agent 5 3D preview" })
      .click();
    await expect(
      selector.locator(
        '.imported-avatar-canvas[data-avatar-imported-id="robot-agent-05"]',
      ),
    ).toHaveAttribute("data-avatar-render-ready", "true", { timeout: 30_000 });
    await selector
      .getByRole("button", { name: "Accept Agent Avatar", exact: true })
      .click();
    await expect(selector).toHaveCount(0);
    await assertContinuity();
    if (!single) {
      await menu("Change Avatar");
      await page
        .getByRole("button", { name: "Claw · connected agent", exact: true })
        .click();
      await expect(
        selector.getByLabel("Agent name", { exact: true }),
      ).toHaveValue("Claw");
      await expect(selector.locator(".imported-avatar-canvas")).toHaveAttribute(
        "data-avatar-render-ready",
        "true",
        { timeout: 30_000 },
      );
      await selector
        .getByRole("button", { name: "Accept Agent Avatar", exact: true })
        .click();
      await expect(selector).toHaveCount(0);
      expect(mutations).toContain(
        `/api/agent-sessions/${agents[1].worldSessionId}/avatar-consent`,
      );
    }
    await assertContinuity();
    await menu("Change Avatar");
    await page
      .getByRole("button", { name: "Aaron · user", exact: true })
      .click();
    const user = page.getByRole("region", {
      name: "User avatar selection",
      exact: true,
    });
    await expect(user.locator(".imported-avatar-canvas")).toHaveAttribute(
      "data-avatar-render-ready",
      "true",
      { timeout: 30_000 },
    );
    await user
      .getByRole("button", { name: "Accept user Avatar", exact: true })
      .click();
    await assertContinuity();
    await menu(connectAction, single);
    const change = page.getByRole("dialog", {
      name: connectAction,
      exact: true,
    });
    if (connectAction === "Change Agent")
      await change
        .getByRole("button", { name: "Connect claude", exact: true })
        .click();
    else await change.getByRole("button", { name: /Add Claude Code/ }).click();
    await expect(change.locator(".imported-avatar-canvas")).toHaveAttribute(
      "data-avatar-render-ready",
      "true",
      { timeout: 30_000 },
    );
    const avatarAccepted = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith(
          single
            ? `/agent-sessions/${agents[3].worldSessionId}/avatar-consent`
            : "/constellation/agents/roster-claude/avatar",
        ),
    );
    await change
      .getByRole("button", { name: "Accept Agent Avatar", exact: true })
      .click();
    const accepted = await avatarAccepted;
    expect(accepted.ok()).toBe(true);
    expect(await accepted.finished()).toBeNull();
    await expect(change).toHaveCount(0);
    await expect(
      page.getByLabel(
        connectAction === "Change Agent"
          ? "Message Claude"
          : "Message Mr Fluff",
        { exact: true },
      ),
    ).toBeVisible();
    await assertContinuity();
    await menu("Add Agent");
    await page
      .getByRole("dialog", { name: "Add Agent", exact: true })
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await assertContinuity();
    expect(
      mutations.filter((p) => /end-world|\/end$|\/cancel$|\/continue$/.test(p)),
    ).toEqual([]);
    expect(fixture.additions).toHaveLength(single ? 0 : 1);
    expect(
      mutations.filter((p) => p === "/api/repository-indexes"),
    ).toHaveLength(1);
    await page.screenshot({
      path: testInfo.outputPath("retained-repository-work.png"),
    });
    expect(errors).toEqual([]);
  });
}

for (const configured of [true, false]) {
  test(`@single-switch configured=${configured} changes harness without adding an agent or replacing World`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedConfiguredAvatar(page, "Aaron");
    const fixture = await installFixture(page, 0);
    await page.addInitScript(
      (id) => localStorage.setItem("aiw.agent-session.pointer.0.12", id),
      agents[0].worldSessionId,
    );
    const registration = {
      id: "11111111-1111-4111-8111-111111111111",
      adapterId: "claude-code",
      displayName: "Claude",
      installationId: "claude",
      environment: {
        id: "wsl:Ubuntu",
        kind: "wsl",
        label: "WSL (Ubuntu)",
        distro: "Ubuntu",
      },
      executablePath: "/fixture/claude",
      homePath: "/fixture",
      identity: {
        id: "default",
        label: "Default",
        kind: "profile",
        profilePath: "/fixture/.claude",
      },
      connectedAt: new Date().toISOString(),
    };
    let attached = configured;
    await page.route("**/api/agent-setup**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/attach")) {
        attached = true;
        await fulfillJson(
          route,
          envelope({
            registration,
            check: { status: "ready", message: "Ready" },
          }),
        );
      } else if (path.endsWith("/discover")) {
        await fulfillJson(
          route,
          envelope({
            installations: [
              {
                id: "claude",
                adapterId: "claude-code",
                executablePath: "/fixture/claude",
                homePath: "/fixture",
                environment: registration.environment,
                identities: [registration.identity],
              },
            ],
            environments: [
              { id: "wsl:Ubuntu", label: "WSL (Ubuntu)", status: "scanned" },
            ],
            truncated: false,
            currentWslDistro: "Ubuntu",
            defaultWslDistro: "Ubuntu",
          }),
        );
      } else
        await fulfillJson(
          route,
          envelope(
            path.endsWith("/recheck")
              ? { status: "ready", message: "Ready" }
              : {
                  schema: "aiw.agent-setup/1",
                  completed: true,
                  registrations: attached ? [registration] : [],
                },
          ),
        );
    });
    // restoreHermes delegates non-Hermes pointers through their native adapter.
    const mutations: string[] = [];
    page.on("request", (r) => {
      if (r.method() !== "GET") mutations.push(new URL(r.url()).pathname);
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    const room = page.locator(".world-room");
    await expect(room).toHaveAttribute("data-scene-ready", "true", {
      timeout: 60_000,
    });
    await openCodeWheel(page);
    await page.getByRole("button", { name: "Load Repo", exact: true }).click();
    await page.getByLabel("Local repository path").fill("/fixture");
    await page.getByRole("button", { name: "Open local", exact: true }).click();
    await expect(
      page.locator(".world-experience[data-repository-readiness]"),
    ).toHaveAttribute("data-repository-readiness", "ready", {
      timeout: 60_000,
    });
    await room.evaluate((el) =>
      el.setAttribute("data-switch-continuity", "original"),
    );
    await room
      .locator("canvas")
      .evaluate((el) => el.setAttribute("data-switch-continuity", "original"));
    await page
      .getByRole("textbox", { name: /^Message / })
      .fill("keep this draft");
    await room.focus();
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Change Agent", exact: true })
      .click();
    const change = page.getByRole("dialog", {
      name: "Change Agent",
      exact: true,
    });
    await change
      .getByRole("button", { name: "Connect claude", exact: true })
      .click({ timeout: 10_000 });
    if (!configured) {
      const setup = page.getByRole("dialog", {
        name: "Agent Setup Menu",
        exact: true,
      });
      await expect(setup).toBeVisible();
      const section = setup.locator("details.agent-setup-harness").filter({
        has: page.locator("summary strong", { hasText: "Claude Code" }),
      });
      await expect(section).toHaveAttribute("open", "");
      await expect(section.locator("summary")).toBeFocused();
      await setup
        .getByRole("button", { name: "Discover Agents", exact: true })
        .click();
      await section.getByLabel("Agent name", { exact: true }).fill("Claude");
      await section
        .getByRole("button", {
          name: "Attach to Agent Intersect World",
          exact: true,
        })
        .click();
    }
    const accept = change.getByRole("button", {
      name: "Accept Agent Avatar",
      exact: true,
    });
    await expect(accept).toBeEnabled({ timeout: 30_000 });
    await accept.click();
    await expect(change).toHaveCount(0);
    await expect(room).toHaveAttribute("data-switch-continuity", "original");
    await expect(room.locator("canvas")).toHaveAttribute(
      "data-switch-continuity",
      "original",
    );
    await expect(room).toHaveAttribute("data-floor-state", "repository");
    await expect(
      page.getByRole("textbox", { name: "Message Claude", exact: true }),
    ).toHaveValue("keep this draft");
    await expect(
      page
        .getByRole("region", { name: "World scene status" })
        .getByRole("listitem")
        .filter({ hasText: "connected agent avatar" }),
    ).toHaveCount(1);
    expect(fixture.additions).toHaveLength(0);
    expect(
      mutations.filter((p) => /end-world|\/end$|\/cancel$|\/continue$/.test(p)),
    ).toEqual([]);
    expect(
      await page.evaluate(() =>
        localStorage.getItem("aiw.agent-session.pointer.0.12"),
      ),
    ).toBe(agents[3].worldSessionId);
    await page.screenshot({
      path: testInfo.outputPath("single-agent-replaced.png"),
    });
    expect(errors).toEqual([]);
  });
}

test("@single-switch-all Codex changes to Claude, Hermes, OpenClaw and back in one World", async ({
  page,
}, testInfo) => {
  // Five harness turns, work/motion and restoration measured ~386s on two CPUs.
  test.setTimeout(480_000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await seedConfiguredAvatar(page, "Aaron");
  const fixture = await installFixture(page, 0);
  const histories = new Map<
    string,
    { role: "user" | "assistant"; text: string }[]
  >();
  await page.route("**/api/agent-sessions/*/stream", async (route) => {
    const sessionId = new URL(route.request().url()).pathname
      .split("/")
      .at(-2)!;
    const agent = agents.find(
      (candidate) => candidate.worldSessionId === sessionId,
    )!;
    const text = String(route.request().postDataJSON().text);
    const finalText = `[fixture] ${agent.displayName} answered: ${text}`;
    histories.set(sessionId, [
      ...(histories.get(sessionId) ?? []),
      { role: "user", text },
      { role: "assistant", text: finalText },
    ]);
    const event = (name: string, data: unknown) =>
      `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
    await route.fulfill({
      contentType: "text/event-stream",
      body: [
        event("world.event", {
          schema: "aiw.agent-event/0.12",
          eventId: randomUUID(),
          sessionId,
          sequence: 1,
          occurredAt: new Date().toISOString(),
          correlationId: randomUUID(),
          type: "message.assistant-delta",
          payload: { text: finalText },
          redaction: { applied: false, count: 0 },
        }),
        event("world.final", {
          schema: "aiw.agent-stream-terminal/0.12",
          sessionId,
          status: "completed",
          finalText,
        }),
        event("world.done", {
          schema: "aiw.agent-stream-terminal/0.12",
          sessionId,
          status: "completed",
        }),
      ].join(""),
    });
  });
  await page.route("**/api/agent-sessions/*/history", async (route) => {
    const sessionId = new URL(route.request().url()).pathname
      .split("/")
      .at(-2)!;
    const agent = agents.find(
      (candidate) => candidate.worldSessionId === sessionId,
    )!;
    await fulfillJson(
      route,
      envelope({
        sessionId,
        continuity: "current",
        messages: histories.get(sessionId) ?? [],
        transcriptAuthority:
          agent.adapterId === "hermes" ? "hermes" : "world-projection",
        avatarConsent: {
          state: "accepted",
          current: proposalFor(agent),
          previous: null,
        },
      }),
    );
  });
  const speakers: string[] = [];
  const assertSpeakers = () =>
    expect(
      page.locator(".world-transcript__item--assistant > strong"),
    ).toHaveText(speakers);
  const chatWith = async (name: string) => {
    const input = page.getByRole("textbox", {
      name: `Message ${name}`,
      exact: true,
    });
    await input.fill(`Hi ${name}`);
    await input.press("Enter");
    await expect(
      page
        .getByText(`[fixture] ${name} answered: Hi ${name}`, { exact: true })
        .last(),
    ).toBeVisible();
    await expect(page.locator(".world-chat")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    speakers.push(name);
    await assertSpeakers();
  };
  const registration = {
    id: "11111111-1111-4111-8111-111111111111",
    adapterId: "claude-code",
    displayName: "Claude",
    installationId: "claude",
    environment: {
      id: "wsl:Ubuntu",
      kind: "wsl",
      label: "WSL (Ubuntu)",
      distro: "Ubuntu",
    },
    executablePath: "/fixture/claude",
    homePath: "/fixture",
    identity: {
      id: "default",
      label: "Default",
      kind: "profile",
      profilePath: "/fixture/.claude",
    },
    connectedAt: new Date().toISOString(),
  };

  const registrations = agents.map((agent, i) => ({
    ...registration,
    id: `11111111-1111-4111-8111-11111111111${i}`,
    adapterId: agent.adapterId,
    displayName: agent.displayName,
  }));
  await page.route("**/api/agent-setup**", (route) =>
    fulfillJson(
      route,
      envelope(
        route.request().url().endsWith("/recheck")
          ? { status: "ready", message: "Ready" }
          : { schema: "aiw.agent-setup/1", completed: true, registrations },
      ),
    ),
  );
  let creates = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/agent-sessions/world") creates++;
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Single Agent — available", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Connect codex", exact: true })
    .click();
  await page
    .getByLabel("Saved agent", { exact: true })
    .selectOption(registrations[2]!.id);
  await page
    .getByRole("button", { name: "Connect agent", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Accept Agent Avatar", exact: true }),
  ).toBeEnabled({ timeout: 30_000 });
  await page
    .getByRole("button", { name: "Accept Agent Avatar", exact: true })
    .click();
  await page.getByRole("button", { name: "Enter World", exact: true }).click();
  const room = page.locator(".world-room");
  await expect(room).toHaveAttribute("data-scene-ready", "true", {
    timeout: 60_000,
  });
  await room
    .locator("canvas")
    .evaluate((el) => el.setAttribute("data-four-harness", "original"));
  await chatWith("Codex");
  for (const [label, name] of [
    ["claude", "Claude"],
    ["hermes", "Mr Fluff"],
    ["openclaw", "Claw"],
    ["codex", "Codex"],
  ]) {
    await room.focus();
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Change Agent", exact: true })
      .click();
    if (label === "codex") {
      await page
        .getByRole("dialog", { name: "Save work before changing agent" })
        .getByRole("button", { name: "Continue to Change Agent", exact: true })
        .click();
    }
    const dialog = page.getByRole("dialog", {
      name: "Change Agent",
      exact: true,
    });
    await dialog
      .getByRole("button", { name: `Connect ${label}`, exact: true })
      .click();
    if (label !== "codex") {
      await expect(
        dialog.getByRole("button", {
          name: "Accept Agent Avatar",
          exact: true,
        }),
      ).toBeEnabled({ timeout: 30_000 });
      await dialog
        .getByRole("button", { name: "Accept Agent Avatar", exact: true })
        .click();
    }
    // A cold avatar transition can finish after the generic five-second menu
    // assertion budget. Wait for the actual new recipient, then check closure.
    await expect(
      page.getByRole("textbox", { name: `Message ${name}`, exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toHaveCount(0);
    await expect(room.locator("canvas")).toHaveAttribute(
      "data-four-harness",
      "original",
    );
    await assertSpeakers();
    await chatWith(name!);
    if (label === "openclaw") {
      const repository = {
        repositoryId: "aiw://object/22222222222222222222222222222222",
        revision: "77777777-7777-4777-8777-777777777777",
      };
      let working = true;
      let current: Record<string, unknown> | null = null;
      await page.route("**/api/workstreams**", async (route) => {
        if (route.request().method() === "POST") {
          current = {
            ...route.request().postDataJSON(),
            schema: "aiw.workstream/1",
            workstreamId: "88888888-8888-4888-8888-888888888888",
            revision: 1,
            repository,
            status: "working",
            title: "Replacement agent work",
            task: "Replacement agent work",
            authority: {
              schema: "aiw.worktree-authority-receipt/1",
              ownerId: "owner",
              requestId: "request",
              worktreeId: "worktree-switch",
              repositoryId: repository.repositoryId,
              relativePath: "worktree-switch",
              branch: "workstream/switch",
              head: "a".repeat(40),
              state: "current",
              statusSummary: "Working",
              validatedAt: "2026-09-20T12:00:00Z",
              attestation: "b".repeat(64),
            },
            worktreeState: "current",
            evidenceOperationRefs: [],
            projection: {
              currentActivity: "Working",
              activeFile: null,
              changedFiles: [],
              diff: { summary: "", patch: "", truncated: false },
              validation: [],
              evidenceRefs: [],
            },
            createdAt: "2026-09-20T12:00:00Z",
            updatedAt: "2026-09-20T12:00:00Z",
            events: [
              {
                eventId: "turn-openclaw",
                status: "working",
                summary: "Task: Replacement agent work",
                occurredAt: "2026-09-20T12:00:00Z",
              },
            ],
          };
          await fulfillJson(
            route,
            envelope({ workstream: current, replayed: false }),
          );
        } else if (current) {
          await fulfillJson(
            route,
            envelope({ ...current, status: working ? "working" : "blocked" }),
          );
        } else await route.fallback();
      });
      await openCodeWheel(page);
      await page
        .getByRole("button", { name: "Load Repo", exact: true })
        .click();
      await page.getByLabel("Local repository path").fill("/fixture");
      await page
        .getByRole("button", { name: "Open local", exact: true })
        .click();
      await expect(
        page.locator(".world-experience[data-repository-readiness]"),
      ).toHaveAttribute("data-repository-readiness", "ready", {
        timeout: 60_000,
      });
      await openCodeWheel(page);
      await page
        .locator(".code-wheel")
        .getByRole("button", { name: "New Workstream", exact: true })
        .click();
      const task = page.getByRole("dialog", {
        name: "New Workstream",
        exact: true,
      });
      await task
        .getByRole("textbox", { name: "New Workstream task", exact: true })
        .fill("Replacement agent work");
      await task
        .getByRole("checkbox", { name: /Create this isolated worktree/ })
        .check();
      await task
        .getByRole("button", { name: "Start Workstream", exact: true })
        .click();
      await expect(room).toHaveAttribute(
        "data-agent-movement-state",
        "moving",
        { timeout: 15_000 },
      );
      await expect(room.locator("canvas")).toHaveAttribute(
        "data-agent-avatar-action",
        "Dig",
        { timeout: 30_000 },
      );
      await page.screenshot({
        path: testInfo.outputPath("switched-openclaw-dig.png"),
      });
      working = false;
      await expect(room.locator("canvas")).toHaveAttribute(
        "data-agent-avatar-action",
        "Idle",
        { timeout: 15_000 },
      );
      // Operational acknowledgements/reports are separate from native reply headings.
      speakers.push("World", "Claw");
      await assertSpeakers();
    }
    await expect(
      page
        .getByRole("region", { name: "World scene status" })
        .getByRole("listitem")
        .filter({ hasText: "connected agent avatar" }),
    ).toHaveCount(1);
  }
  expect(creates).toBe(4); // Returning to Codex reuses its exact existing native session.
  expect(fixture.additions).toHaveLength(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("aiw.agent-session.pointer.0.12"),
    ),
  ).toBe(agents[2].worldSessionId);
  await page.screenshot({
    path: testInfo.outputPath("four-harness-roundtrip.png"),
  });
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Message Codex", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator(".world-transcript__item--assistant > strong"),
  ).toHaveText(["Codex", "Codex"]);
  expect(creates).toBe(4); // Refresh itself preserves the exact native session.
  await expect(room).toHaveAttribute("data-scene-ready", "true", {
    timeout: 60_000,
  });
  await room.focus();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Change Agent", exact: true }).click();
  const restoredChange = page.getByRole("dialog", {
    name: "Change Agent",
    exact: true,
  });
  await restoredChange
    .getByRole("button", { name: "Connect claude", exact: true })
    .click();
  await expect(
    restoredChange.getByRole("button", {
      name: "Accept Agent Avatar",
      exact: true,
    }),
  ).toBeEnabled();
  await restoredChange
    .getByRole("button", { name: "Accept Agent Avatar", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Message Claude", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".world-transcript__item--assistant > strong"),
  ).toHaveText(["Codex", "Codex"]);
  expect(creates).toBe(5); // A reload clears only the mounted-World switch cache.
  expect(errors).toEqual([]);
});

for (const initialCount of [0, 2, 3]) {
  test(`@setup-add expands ${initialCount === 0 ? "single" : `${initialCount}-agent`} World without remounting, cancellation and refresh`, async ({
    page,
  }, testInfo) => {
    // Measured two-CPU add/refresh journeys: ~102s (two agents), ~162s (three).
    // The four-avatar path also exercises 24 preview edits and both layouts.
    test.setTimeout(
      initialCount === 3 ? 240_000 : initialCount === 2 ? 180_000 : 120_000,
    );
    await page.emulateMedia({
      reducedMotion: initialCount === 2 ? "no-preference" : "reduce",
    });
    await page.setViewportSize({ width: 1600, height: 1000 });
    await seedConfiguredAvatar(page, "Aaron");
    const fixture = await installFixture(page, initialCount);
    await page.route("**/api/constellation/messages", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: envelope([]) })
        : route.fallback(),
    );
    if (initialCount === 0)
      await page.addInitScript(
        (sessionId) =>
          localStorage.setItem("aiw.agent-session.pointer.0.12", sessionId),
        agents[0].worldSessionId,
      );
    let creates = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/agent-sessions/world")
        creates += 1;
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const registration = {
      id: "11111111-1111-4111-8111-111111111111",
      adapterId: "claude-code",
      displayName: "Claude",
      installationId: "claude",
      environment: {
        id: "wsl:Ubuntu",
        kind: "wsl",
        label: "WSL (Ubuntu)",
        distro: "Ubuntu",
      },
      executablePath: "/fixture/claude",
      homePath: "/fixture",
      identity: {
        id: "default",
        label: "Default",
        kind: "profile",
        profilePath: "/fixture/.claude",
      },
      connectedAt: new Date().toISOString(),
    };
    await page.route("**/api/agent-setup**", (route) =>
      route.fulfill({
        json: envelope(
          route.request().url().endsWith("/recheck")
            ? { status: "ready", message: "Fixture ready" }
            : {
                schema: "aiw.agent-setup/1",
                completed: true,
                registrations: [registration],
              },
        ),
      }),
    );
    await page.addInitScript(() => {
      const originalPlay = HTMLMediaElement.prototype.play;
      const arrivals: { time: number; currentTime: number }[] = [];
      Object.assign(window, { __arrivalPlayback: arrivals });
      HTMLMediaElement.prototype.play = function () {
        if (this.src.endsWith("/avatar-materialize.wav")) {
          const sample = { time: performance.now(), currentTime: 0 };
          arrivals.push(sample);
          this.addEventListener("timeupdate", () => {
            sample.currentTime = Math.max(sample.currentTime, this.currentTime);
          });
        }
        return originalPlay.call(this);
      };
    });
    await page.goto("/");
    if (initialCount >= 3) {
      await page
        .getByRole("button", { name: "Reconnect", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Enter World", exact: true })
        .click();
    }
    await expect(page.getByTestId("world-hud")).toBeVisible();
    const room = page.locator('[data-scene-id="world-room"]').first();
    await expect(room).toHaveAttribute("data-scene-ready", "true", {
      timeout: 60_000,
    });
    await room.evaluate((el) =>
      el.setAttribute("data-add-continuity", "same-mounted-world"),
    );
    const canvas = room.locator("canvas");
    await expect(canvas).toHaveAttribute(
      "data-phase18_5-render-ready",
      "true",
      { timeout: 30000 },
    );
    await expect(canvas).toHaveAttribute("data-avatar-arrival", "complete", {
      timeout: 30000,
    });
    await canvas.evaluate((el) =>
      el.setAttribute("data-live-canvas", "original"),
    );
    page.on("console", (message) => {
      if (
        message.type() === "error" ||
        message.text().includes("Too many active WebGL contexts")
      )
        errors.push(message.text());
    });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Add Agent", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add Agent", exact: true });
    await expect(
      dialog.getByText(`${Math.max(1, initialCount)} of 4 agents`),
    ).toBeVisible();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let recheckStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      recheckStarted = resolve;
    });
    await page.route(
      "**/api/agent-setup/connections/*/recheck",
      async (route) => {
        recheckStarted();
        await held;
        await route.fulfill({
          json: envelope({ status: "ready", message: "Ready" }),
        });
      },
      { times: 1 },
    );
    await dialog.getByRole("button", { name: /Add Claude Code/ }).click();
    await started;
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    release();
    await expect(dialog).toBeHidden();
    expect(creates).toBe(0);
    expect(fixture.additions).toHaveLength(0);
    await expect(room).toHaveAttribute(
      "data-add-continuity",
      "same-mounted-world",
    );
    let releaseAvatar!: () => void;
    const pendingAvatar = new Promise<void>((resolve) => {
      releaseAvatar = resolve;
    });
    if (initialCount === 2)
      await page.route("**/cat-agent-01.glb", async (route) => {
        await pendingAvatar;
        await route.continue();
      });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Add Agent", exact: true }).click();
    await dialog.getByRole("button", { name: /Add Claude Code/ }).click();
    await expect(
      dialog.getByRole("button", { name: "Accept Agent Avatar", exact: true }),
    ).toBeEnabled({ timeout: 30000 });
    if (initialCount !== 2)
      await expect(dialog.locator(".imported-avatar-canvas")).toHaveAttribute(
        "data-avatar-render-ready",
        "true",
        { timeout: 30000 },
      );
    await page.screenshot({
      path: testInfo.outputPath(
        initialCount === 2
          ? "add-avatar-pending.png"
          : "add-avatar-desktop.png",
      ),
    });
    const preview = dialog.locator(".avatar-builder__preview");
    expect((await preview.boundingBox())!.width).toBeGreaterThan(400);
    if (initialCount === 3) {
      // Name edits must not allocate a capability context on every render.
      const name = dialog.getByRole("textbox", {
        name: "Agent name",
        exact: true,
      });
      for (let edit = 0; edit < 24; edit++) await name.fill(`Claude ${edit}`);
      await name.fill("Claude");
      await expect(canvas).toBeVisible();
      await expect(canvas).toHaveAttribute("data-live-canvas", "original");
      await page.setViewportSize({ width: 390, height: 844 });
      await preview.scrollIntoViewIfNeeded();
      // Read one atomic post-resize layout snapshot. Polling this immutable
      // CSS geometry adds a second watchdog around slow browser transport.
      const geometry = await page.evaluate(() => {
        const el = document.querySelector(
          '[role="dialog"][aria-label="Add Agent"]',
        )!;
        const box = el
          .querySelector(".avatar-builder__preview")!
          .getBoundingClientRect();
        return {
          x: box.x,
          width: box.width,
          right: box.right,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        };
      });
      expect(geometry.width, JSON.stringify(geometry)).toBeGreaterThan(260);
      expect(geometry.x).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(390);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(
        geometry.clientWidth + 1,
      );
      await page.screenshot({
        path: testInfo.outputPath("add-avatar-portrait.png"),
      });
      await page.setViewportSize({ width: 1600, height: 1000 });
    }
    await page.evaluate(() => {
      (
        window as unknown as { __arrivalPlayback: unknown[] }
      ).__arrivalPlayback.length = 0;
    });
    const avatarSaved = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          "/api/constellation/agents/roster-claude/avatar" &&
        response.request().method() === "POST",
    );
    await dialog
      .getByRole("button", { name: "Accept Agent Avatar", exact: true })
      .click();
    try {
      // Consent, roster addition and avatar persistence precede UI completion.
      // Start the UI assertion at its owning final-response boundary.
      expect((await avatarSaved).ok()).toBe(true);
      await expect(dialog).toBeHidden({ timeout: 15000 });
      await expect(
        page
          .getByRole("region", { name: "World scene status" })
          .getByRole("listitem")
          .filter({ hasText: "connected agent avatar" }),
      ).toHaveCount(Math.max(1, initialCount) + 1);
      await expect(canvas).toBeVisible();
      await expect(canvas).toHaveAttribute("data-live-canvas", "original");
      await expect(canvas).toHaveAttribute(
        "data-phase18_5-render-ready",
        "true",
      );
      if (initialCount === 2)
        await page.screenshot({
          path: testInfo.outputPath("world-during-avatar-load.png"),
        });
    } finally {
      releaseAvatar();
    }
    await expect(page.getByTestId("world-room-canvas")).toHaveAttribute(
      "data-ready-avatar-count",
      String(Math.max(1, initialCount) + 2),
      { timeout: 30000 },
    );
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute("data-live-canvas", "original");
    await expect(canvas).toHaveAttribute(
      "data-avatar-arrival-id",
      "roster-claude",
    );
    if (initialCount === 2) {
      await expect(canvas).toHaveAttribute(
        "data-avatar-arrival",
        "materializing",
        { timeout: 15000 },
      );
      await expect
        .poll(
          async () => {
            const progress = Number(
              await canvas.getAttribute("data-avatar-arrival-progress"),
            );
            return progress >= 0.35 && progress < 0.75;
          },
          { intervals: [16] },
        )
        .toBe(true);
      await page.screenshot({
        path: testInfo.outputPath("added-agent-materializing.png"),
      });
    }
    await expect(canvas).toHaveAttribute("data-avatar-arrival", "complete", {
      timeout: 15000,
    });
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const sound = (
            window as unknown as {
              __arrivalPlayback: { currentTime: number }[];
            }
          ).__arrivalPlayback;
          return sound.length === 1 && sound[0]!.currentTime > 0.2;
        }),
      )
      .toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("world-added-no-refresh.png"),
    });

    await expect(dialog).toBeHidden();
    await expect(room).toHaveAttribute(
      "data-add-continuity",
      "same-mounted-world",
    );
    expect(fixture.additions).toHaveLength(initialCount === 0 ? 2 : 1);
    expect(creates).toBe(1);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Add Agent", exact: true }).click();
    await expect(
      dialog.getByText(`${Math.max(1, initialCount) + 1} of 4 agents`),
    ).toBeVisible();
    if (initialCount === 3)
      await expect(
        dialog.getByRole("button", { name: "Set Up Another Agent" }),
      ).toBeDisabled();
    await page.screenshot({
      path: testInfo.outputPath("add-agent-capacity.png"),
    });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(room).toHaveAttribute(
      "data-add-continuity",
      "same-mounted-world",
    );
    await page.reload();
    await expect(page.getByTestId("world-hud")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Add Agent", exact: true }).click();
    await expect(
      dialog.getByText(`${Math.max(1, initialCount) + 1} of 4 agents`),
    ).toBeVisible();
    expect(creates).toBe(1);
    expect(errors).toEqual([]);
  });
}

for (const mode of ["mention", "sticky"] as const) {
  test(`@message-target ${mode} limits Thinking and retains explicit selection`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1600, height: 1000 });
    await seedConfiguredAvatar(page, "Aaron");
    const fixture = await installFixture(page, 4);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let release: (() => void) | undefined;
    await page.route("**/api/constellation/messages", async (route) => {
      if (route.request().method() === "POST")
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      await route.fallback();
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Reconnect", exact: true }).click();
    await page
      .getByRole("button", { name: "Enter World", exact: true })
      .click();
    await expect(page.getByTestId("world-hud")).toBeVisible();
    const canvas = page.locator('canvas[data-scene-id="world-room"]');
    await expect(canvas).toHaveAttribute("data-avatar-arrival", "complete", {
      timeout: 30000,
    });
    if (mode === "sticky") {
      await openCodeWheel(page);
      await page
        .getByRole("button", {
          name: "Send next message to Codex",
          exact: true,
        })
        .click();
    }
    const cases =
      mode === "mention"
        ? [
            { text: "@Claw first question", ids: ["roster-openclaw"] },
            { text: "@codex second question", ids: ["roster-codex"] },
          ]
        : [
            { text: "first question", ids: ["roster-codex"] },
            { text: "second question", ids: ["roster-codex"] },
            {
              text: "all together",
              ids: agents.map((agent) => agent.rosterId),
            },
          ];
    try {
      for (const [index, item] of cases.entries()) {
        if (mode === "sticky" && index === 2) {
          await openCodeWheel(page);
          await page
            .getByRole("button", {
              name: "Clear Codex and send to all agents",
              exact: true,
            })
            .click();
        }
        const selected = mode === "sticky" && index < 2;
        const input = page.getByRole("textbox", {
          name: selected ? "Message Codex" : "Message All agents",
          exact: true,
        });
        await input.fill(item.text);
        await input.press("Enter");
        await expect.poll(() => Boolean(release)).toBe(true);
        await expect
          .poll(async () =>
            page
              .locator('li[data-roster-id][data-activity-state="thinking"]')
              .evaluateAll((rows) =>
                rows.map((row) => row.getAttribute("data-roster-id")),
              ),
          )
          .toEqual(item.ids);
        await page.screenshot({
          path: testInfo.outputPath(`${mode}-${index}-thinking.png`),
        });
        release!();
        release = undefined;
        await expect.poll(() => fixture.groupedBodies.length).toBe(index + 1);
        await expect(
          page.locator('li[data-roster-id][data-activity-state="thinking"]'),
        ).toHaveCount(0);
        await expect(input).toBeVisible();
        if (selected)
          expect(fixture.groupedBodies[index]).toHaveProperty(
            "targetRosterId",
            "roster-codex",
          );
        else
          expect(fixture.groupedBodies[index]).not.toHaveProperty(
            "targetRosterId",
          );
      }
    } finally {
      release?.();
    }
    expect(errors).toEqual([]);
  });
}

test("@setup-cancel initial connection returns to selection and ignores a late response", async ({
  page,
}) => {
  await seedConfiguredAvatar(page, "Aaron");
  await installFixture(page, 0);
  let release!: () => void;
  let requestStarted!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    requestStarted = resolve;
  });
  await page.route("**/api/agent-sessions/world", async (route) => {
    requestStarted();
    await held;
    await route.fallback();
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: /Single Agent/ }).click();
  await page
    .getByRole("button", { name: "Connect codex", exact: true })
    .click();
  await page.getByLabel("Agent name", { exact: true }).fill("Mr Fluff");
  await page
    .getByRole("button", { name: "Connect agent", exact: true })
    .click();
  await started;
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  release();
  await expect(
    page.getByRole("button", { name: /Single Agent/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect codex", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Agent avatar selection" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Connect codex", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Connect agent", exact: true }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});

for (const [action, dialogName] of [
  ["Load Repo", "Repository Intake_"],
  ["Workbench", "Repository Workbench"],
  ["New Workstream", "New Workstream"],
] as const) {
  test(`@wheel-dismiss ${action} closes the wheel without losing its target`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedConfiguredAvatar(page, "Aaron");
    await installFixture(page, 4);
    await page.route("**/api/workstreams/history**", async (route) => {
      await fulfillJson(route, { ok: true, data: { workstreams: [] } });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Reconnect", exact: true }).click();
    await page
      .getByRole("button", { name: "Enter World", exact: true })
      .click();
    await expect(page.getByTestId("world-hud")).toBeVisible();
    await openCodeWheel(page);
    await page
      .getByRole("button", { name: "Send next message to Codex", exact: true })
      .click();
    await page
      .locator(".code-wheel")
      .getByRole("button", { name: action, exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: dialogName, exact: true });
    await expect(dialog).toBeVisible();
    if (action === "Workbench") {
      await expect(
        dialog.getByText(/Load a repository first using Load Repo/),
      ).toBeVisible();
    }
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await expect(page.locator(".code-wheel")).toHaveCount(0);
    // Middle clicks inside these windows remain UI-owned, not wheel triggers.
    await dialog.getByRole("heading").first().click({ button: "middle" });
    await expect(dialog).toBeVisible();
    await expect(page.locator(".code-wheel")).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("window-with-wheel-closed.png"),
    });
    await dialog
      .getByRole("button", { name: /^Close/ })
      .first()
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByLabel("Message Codex", { exact: true }),
    ).toBeVisible();
    await openCodeWheel(page);
    await expect(
      page.getByRole("button", {
        name: "Send next message to Codex",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
  });
}

test("@code-wheel real controls isolate scene input, retain targeting and spatial state", async ({
  page,
}, testInfo) => {
  // Full current two-CPU journey measured ~157s; hosted 180s expired at resize.
  // Preserve the actual containment bounds and individual assertion deadlines.
  test.setTimeout(240_000);
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
    } else if (new URL(route.request().url()).pathname.endsWith("/history"))
      await route.fulfill({
        json: {
          ok: true,
          data: { workstreams: currentWorkstream ? [currentWorkstream] : [] },
        },
      });
    else if (currentWorkstream)
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
  const stream = wheel.locator(".code-wheel__stream");
  await expect(stream).toHaveCSS("animation-name", "code-wheel-stream");
  const initialFlow = await stream.evaluate(
    (element) => getComputedStyle(element).transform,
  );
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
  // Prove animated pointer selection first. The remaining targeting, dialogs,
  // placement and reload assertions do not need a continuously drawn World.
  await expect
    .poll(() =>
      stream.evaluate((element) => getComputedStyle(element).transform),
    )
    .not.toBe(initialFlow);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(stream).toHaveCSS("animation-name", "none");
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
    .toBe(1);
  expect(movement.find((x) => x.path.endsWith("/interrupt"))!.path).toContain(
    agents[1].worldSessionId,
  );
  await expect(page.getByLabel("Message Claw")).toBeVisible();
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
  await expect(wheel).toHaveCount(0);
  await openCodeWheel(page);
  await wheel.getByRole("button", { name: "Load Repo", exact: true }).click();
  await expect(wheel).toHaveCount(0);
  await page.getByLabel("Local repository path").fill("/fixture");
  await page.getByRole("button", { name: "Open local", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Place Project / Current Work in World" }),
  ).toBeVisible();
  await openCodeWheel(page);
  await wheel.getByRole("button", { name: "Screens", exact: true }).click();
  const beforePlacement = await wheel.boundingBox();
  await page
    .locator(".code-wheel__outer")
    .getByRole("button", { name: "Project / Current Work", exact: true })
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
    .getByRole("button", { name: "Project / Current Work", exact: true })
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
    .getByRole("textbox", { name: "New Workstream task", exact: true })
    .fill("Build the fixture settings panel");
  await expect(
    taskDialog.getByRole("button", { name: "Start Workstream", exact: true }),
  ).toBeDisabled();
  await taskDialog
    .getByRole("checkbox", { name: /Create this isolated worktree/ })
    .check();
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
  await expect(wheel).toHaveCount(0);
  await openCodeWheel(page);
  await wheel
    .getByRole("button", { name: "Workbench", exact: true })
    .first()
    .click();
  const workbench = page.getByRole("dialog", { name: "Repository Workbench" });
  await expect(workbench).toBeVisible();
  await expect(wheel).toHaveCount(0);
  await workbench
    .getByRole("button", {
      name: "Open current work / World View",
      exact: true,
    })
    .click();
  await expect(workbench).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Work Inspector" }),
  ).toBeVisible();
  // HUD windows intentionally sit above the wheel (CONTINUATION_CORRECTIONS.md).
  // Reopen on exposed floor, away from the newly opened right-hand inspector,
  // before testing pointer activation of the outer screen controls.
  await expect(wheel).toHaveCount(0);
  const wheelOrigin = await page
    .locator("main.world-room")
    .evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const x = bounds.x + bounds.width / 2;
      const y = bounds.y + bounds.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        x,
        y,
        exposed:
          !!hit &&
          element.contains(hit) &&
          !hit.closest(
            '[data-world-ui="true"], button, [role="button"], input',
          ),
      };
    });
  expect(wheelOrigin.exposed).toBe(true);
  await page.mouse.click(wheelOrigin.x, wheelOrigin.y, { button: "middle" });
  await expect(wheel).toBeVisible();
  await wheel.getByRole("button", { name: "Screens", exact: true }).click();
  const screenButtons = page.locator(".code-wheel__outer");
  await screenButtons
    .getByRole("button", { name: "Project / Current Work", exact: true })
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
  // setViewportSize precedes React's resize projection; assert the settled bounds.
  await expect(async () => {
    const rect = await page.locator(".code-wheel").boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.x).toBeGreaterThanOrEqual(7);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(383);
  }).toPass({ timeout: 5_000 });
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
  // CI reached the final reload at the 30s cap after completing voice/text flows.
  // Bound this four-avatar, multi-input journey without weakening step assertions.
  test.setTimeout(120_000);
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
  await expect(pushToTalk).toContainText("Push to Talk");
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
  await expect(page.getByLabel("Message Codex")).toBeVisible();
  await page
    .getByRole("button", {
      name: "Clear Codex and send to all agents",
      exact: true,
    })
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
  // PR15 restores the roster/transcript, not an implicitly selected repository.
  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-floor-state",
    "blank",
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
