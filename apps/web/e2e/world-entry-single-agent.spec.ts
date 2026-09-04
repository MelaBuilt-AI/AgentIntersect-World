import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page, type Route } from "@playwright/test";
// @ts-expect-error -- Playwright E2E runs in Node; the web app tsconfig intentionally exposes only Vite types.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  classifyPhase18_5Renderer,
  readPhase18_5HardwareEvidence,
  validatePhase18_5HardwareEvidence,
} from "../../../tooling/scripts/phase18-5-performance-evidence.js";
import { seedConfiguredAvatar } from "./helpers.js";

const test = base.extend({ trace: "off" });
const traceTest = test.extend({ trace: "retain-on-failure" });

const evidenceDirectory = resolve("artifacts/phase18");
const phase18_5EvidenceDirectory = resolve("artifacts/phase18-5");
mkdirSync(evidenceDirectory, { recursive: true });
mkdirSync(phase18_5EvidenceDirectory, { recursive: true });

function sanitizeTraceArchive(archivePath: string) {
  const sanitizer = String.raw`
import os
import sys
import tempfile
import zipfile

archive_path, workspace = sys.argv[1:3]
home = os.path.expanduser("~")
redactions = sorted(
    ((workspace.encode(), b"<workspace>"), (home.encode(), b"<home>")),
    key=lambda item: len(item[0]),
    reverse=True,
)
text_members = {"trace.trace", "trace.network", "trace.stacks"}

with zipfile.ZipFile(archive_path, "r") as source:
    entries = [(info, source.read(info.filename)) for info in source.infolist()]

descriptor, temporary_path = tempfile.mkstemp(
    prefix="aiw-phase18-trace-", suffix=".zip", dir=os.path.dirname(archive_path)
)
os.close(descriptor)
try:
    with zipfile.ZipFile(temporary_path, "w") as target:
        for info, payload in entries:
            if info.filename in text_members:
                for private_prefix, replacement in redactions:
                    payload = payload.replace(private_prefix, replacement)
            target.writestr(info, payload)

    with zipfile.ZipFile(temporary_path, "r") as check:
        for info in check.infolist():
            if info.filename not in text_members:
                continue
            payload = check.read(info.filename)
            if any(private_prefix in payload for private_prefix, _ in redactions):
                raise RuntimeError(f"private path survived in {info.filename}")
    os.replace(temporary_path, archive_path)
finally:
    if os.path.exists(temporary_path):
        os.unlink(temporary_path)
`;
  execFileSync("python3", ["-c", sanitizer, archivePath, resolve(".")], {
    stdio: "pipe",
  });
}

const session = {
  schema: "aiw.agent-session/0.12",
  sessionId: "11111111-1111-4111-8111-111111111111",
  adapterId: "hermes",
  adapterSessionRef: "native-mr-fluff",
  profile: "default",
  workspaceId: "world-entry",
  repositoryRef: "current",
  mode: "explore",
  permissionRevision: 0,
  capabilitySnapshotHash: "a".repeat(64),
  avatarProfileRef: null,
  continuity: "current",
  status: "ready",
} as const;

const proposal = {
  schema: "aiw.avatar-proposal/0.12",
  proposalId: "22222222-2222-4222-8222-222222222222",
  sessionId: session.sessionId,
  displayName: "Mr Fluff",
  species: "cat",
  head: "cat",
  hands: "paws",
  feet: "paws",
  fur: "short",
  tail: "cat",
  markings: "tuxedo",
  bodyColor: "charcoal",
  shirt: "Hermes",
  movementStyle: "shared-biped-core",
  sourceDisclosure: "Bounded local fixture proposal.",
  rationale: "Awaiting deliberate operator editing.",
  createdAt: "2026-07-25T00:00:00.000Z",
} as const;

const ref = (value: string) => `aiw://object/${value.padStart(32, "0")}`;
const snapshot = {
  schema: "aiw.world/0.4",
  identityVersion: "aiw.identity/1",
  layoutVersion: "aiw.layout/grid/1",
  snapshotId: "1".repeat(32),
  generationFingerprint: "b".repeat(64),
  workspaceRef: ref("1"),
  repositoryRef: ref("2"),
  objects: [
    {
      kind: "workspace",
      id: "1".repeat(32),
      ref: ref("1"),
      name: "Local workspace",
      parentRef: null,
      childRefs: [ref("2")],
      position: { x: 2, y: 0, z: 2 },
      bounds: { x: 0, z: 0, width: 8, depth: 8 },
    },
    {
      kind: "repository",
      id: "2".repeat(32),
      ref: ref("2"),
      name: "AgentIntersect World",
      parentRef: ref("1"),
      childRefs: [ref("3"), ref("5")],
      position: { x: 8, y: 0, z: 8 },
      bounds: { x: 0, z: 0, width: 16, depth: 16 },
    },
    {
      kind: "package",
      id: "3".repeat(32),
      ref: ref("3"),
      name: "@agentintersect-world/web",
      parentRef: ref("2"),
      childRefs: [ref("4")],
      path: "apps/web",
      packageKind: "npm",
      packageName: "@agentintersect-world/web",
      position: { x: 5, y: 0, z: 2 },
      bounds: { x: 4, z: 1, width: 2, depth: 2 },
    },
    {
      kind: "directory",
      id: "4".repeat(32),
      ref: ref("4"),
      name: "world-entry",
      parentRef: ref("3"),
      childRefs: [ref("7"), ref("8"), ref("9")],
      path: "apps/web/src/world-entry",
      fileCount: 3,
      position: { x: 5, y: 0, z: 4 },
      bounds: { x: 4, z: 3, width: 2, depth: 2 },
    },
    {
      kind: "package",
      id: "5".repeat(32),
      ref: ref("5"),
      name: "@agentintersect-world/renderer-r3f",
      parentRef: ref("2"),
      childRefs: [ref("6")],
      path: "packages/renderer-r3f",
      packageKind: "npm",
      packageName: "@agentintersect-world/renderer-r3f",
      position: { x: 10, y: 0, z: 4 },
      bounds: { x: 9, z: 3, width: 2, depth: 2 },
    },
    {
      kind: "directory",
      id: "6".repeat(32),
      ref: ref("6"),
      name: "renderer source",
      parentRef: ref("5"),
      childRefs: [ref("a"), ref("b")],
      path: "packages/renderer-r3f/src",
      fileCount: 2,
      position: { x: 10, y: 0, z: 6 },
      bounds: { x: 9, z: 5, width: 2, depth: 2 },
    },
    {
      kind: "file",
      id: "7".repeat(32),
      ref: ref("7"),
      name: "WorldEntryExperience.tsx",
      parentRef: ref("4"),
      childRefs: [],
      path: "apps/web/src/world-entry/WorldEntryExperience.tsx",
      size: 14_200,
      fileKind: "source",
      language: "typescript",
      contentHash: "c".repeat(64),
      pathHistory: [],
      position: { x: 4, y: 0, z: 6 },
      bounds: { x: 4, z: 6, width: 1, depth: 1 },
    },
    {
      kind: "file",
      id: "8".repeat(32),
      ref: ref("8"),
      name: "WorldRoom.tsx",
      parentRef: ref("4"),
      childRefs: [],
      path: "apps/web/src/world-entry/WorldRoom.tsx",
      size: 5_900,
      fileKind: "source",
      language: "typescript",
      contentHash: "d".repeat(64),
      pathHistory: [],
      position: { x: 5, y: 0, z: 6 },
      bounds: { x: 5, z: 6, width: 1, depth: 1 },
    },
    {
      kind: "file",
      id: "9".repeat(32),
      ref: ref("9"),
      name: "world-entry-machine.ts",
      parentRef: ref("4"),
      childRefs: [],
      path: "apps/web/src/world-entry/world-entry-machine.ts",
      size: 4800,
      fileKind: "source",
      language: "typescript",
      contentHash: "e".repeat(64),
      pathHistory: [],
      position: { x: 6, y: 0, z: 6 },
      bounds: { x: 6, z: 6, width: 1, depth: 1 },
    },
    {
      kind: "file",
      id: "a".repeat(32),
      ref: ref("a"),
      name: "avatar-kit-canvas.tsx",
      parentRef: ref("6"),
      childRefs: [],
      path: "packages/renderer-r3f/src/avatar-kit-canvas.tsx",
      size: 8_900,
      fileKind: "source",
      language: "typescript",
      contentHash: "a".repeat(64),
      pathHistory: [],
      position: { x: 9, y: 0, z: 8 },
      bounds: { x: 9, z: 8, width: 1, depth: 1 },
    },
    {
      kind: "file",
      id: "b".repeat(32),
      ref: ref("b"),
      name: "world-room-canvas.tsx",
      parentRef: ref("6"),
      childRefs: [],
      path: "packages/renderer-r3f/src/world-room-canvas.tsx",
      size: 7_600,
      fileKind: "source",
      language: "typescript",
      contentHash: "b".repeat(64),
      pathHistory: [],
      position: { x: 11, y: 0, z: 8 },
      bounds: { x: 11, z: 8, width: 1, depth: 1 },
    },
  ],
  tiles: [],
  limits: {
    fullDetailFiles: 10_000,
    maxTileRecords: 128,
    maxPathHistory: 8,
    maxTombstones: 256,
  },
} as const;

const envelope = (data: unknown) => ({
  ok: true,
  data,
  meta: {
    correlationId: "33333333-3333-4333-8333-333333333333",
    schema: "aiw.api/0.3",
  },
});

function streamBody(requestText: string, userDisplayName: string) {
  const terminal = (event: string, value: unknown) =>
    `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
  const worldEvent = (
    sequence: number,
    type: string,
    payload: Record<string, unknown>,
  ) =>
    terminal("world.event", {
      schema: "aiw.agent-event/0.12",
      eventId: `${String(sequence).padStart(8, "0")}-4444-4444-8444-444444444444`,
      sessionId: session.sessionId,
      sequence,
      occurredAt: "2026-07-25T00:00:00.000Z",
      correlationId: "55555555-5555-4555-8555-555555555555",
      type,
      payload,
      redaction: { applied: false, count: 0 },
    });
  const repository = /repository/iu.test(requestText);
  const finalText = repository
    ? "[fixture] The repository floor is ready."
    : `[fixture] Hello ${userDisplayName} — Mr Fluff is here and ready.`;
  return [
    worldEvent(1, "message.user-accepted", {
      text: requestText,
    }),
    worldEvent(2, "message.assistant-delta", {
      text: repository
        ? "[fixture] Loading the approved repository."
        : `[fixture] Hello ${userDisplayName} — `,
    }),
    worldEvent(3, "tool.started", {
      toolName: repository ? "repository.index" : "terminal.status",
    }),
    worldEvent(4, "tool.completed", {
      toolName: repository ? "repository.index" : "terminal.status",
    }),
    worldEvent(5, "message.assistant-final", {
      text: finalText,
    }),
    terminal("world.final", {
      schema: "aiw.agent-stream-terminal/0.12",
      sessionId: session.sessionId,
      status: "completed",
      finalText,
    }),
    terminal("world.done", {
      schema: "aiw.agent-stream-terminal/0.12",
      sessionId: session.sessionId,
      status: "completed",
    }),
  ].join("");
}

type WorldFixtureOptions = {
  readonly avatarProposal?: unknown;
  readonly history?: unknown;
  readonly restoreStatus?: boolean;
  readonly snapshot?: unknown;
  readonly phase14Current?: unknown;
  readonly repositoryProjects?: readonly unknown[];
  readonly fulfillPreviewManager?: (
    route: Route,
    pathname: string,
  ) => Promise<void>;
  readonly fulfillWorldActions?: (
    route: Route,
    pathname: string,
  ) => Promise<void>;
  readonly fulfillWorkstreams?: (
    route: Route,
    pathname: string,
  ) => Promise<void>;
  readonly fulfillStream?: (
    route: Route,
    requestText: string,
    userDisplayName: string,
  ) => Promise<void>;
};

async function installWorldFixtures(
  page: Page,
  options: WorldFixtureOptions = {},
) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let data: unknown;
    if (
      pathname.endsWith("/repository-intake/projects") &&
      request.method() === "GET"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          envelope({
            projects: options.repositoryProjects ?? [
              {
                id: "project-approved",
                name: "approved repository",
                rootPath: ".",
                source: "local",
                pinned: true,
                lastOpenedAt: "2026-09-02T00:00:00.000Z",
              },
            ],
          }),
        ),
      });
      return;
    } else if (
      pathname.endsWith("/repository-intake/open") &&
      request.method() === "POST"
    ) {
      const body = request.postDataJSON() as {
        readonly rootPath: string;
        readonly name?: string;
      };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(
          envelope({
            project: {
              id: "project-selected",
              name: body.name ?? "Selected repository",
              rootPath: body.rootPath,
              source: "local",
              pinned: false,
              lastOpenedAt: "2026-09-02T00:00:00.000Z",
            },
          }),
        ),
      });
      return;
    } else if (pathname.includes("/world-actions/")) {
      if (options.fulfillWorldActions) {
        await options.fulfillWorldActions(route, pathname);
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          protocol: "aiw.world-action/0.13",
          capability: { enabled: true },
          actions: [],
          executions: [],
        }),
      });
      return;
    }
    if (
      (pathname.includes("/preview-recipes") ||
        pathname.includes("/previews")) &&
      options.fulfillPreviewManager
    ) {
      await options.fulfillPreviewManager(route, pathname);
      return;
    }
    if (pathname.includes("/workstreams") && options.fulfillWorkstreams) {
      await options.fulfillWorkstreams(route, pathname);
      return;
    }
    if (
      pathname.endsWith("/phase14/journeys/current") &&
      request.method() === "GET"
    ) {
      if (options.phase14Current === undefined) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "No Phase 14 journey" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(options.phase14Current),
      });
      return;
    }
    if (pathname.endsWith("/agent-sessions/capabilities"))
      data = [
        {
          adapterId: "hermes",
          capabilities: { attach: true, sendText: true, streamDeltas: true },
          unavailable: {},
        },
      ];
    else if (pathname.endsWith("/agent-sessions/native"))
      data = [
        {
          id: session.adapterSessionRef,
          source: "cli",
          title: "Mr Fluff",
          messageCount: 12,
        },
      ];
    else if (pathname.endsWith("/agent-sessions/attach")) data = session;
    else if (
      options.restoreStatus &&
      request.method() === "GET" &&
      pathname.endsWith(`/agent-sessions/${session.sessionId}/status`)
    )
      data = session;
    else if (pathname.endsWith("/constellation/current"))
      data = {
        projection: {
          schema: "aiw.constellation/0.19",
          mode: "multi-agent",
          worldInstanceId: "55555555-5555-4555-8555-555555555555",
          lifecycle: "assembling",
          revision: 0,
          agents: [],
          entryReady: false,
          truth: "current",
        },
        terminalOutcomes: [],
        unavailableReason: null,
      };
    else if (pathname.endsWith("/work-focus")) data = { focus: null };
    else if (pathname.endsWith("/avatar-proposal"))
      data = options.avatarProposal ?? proposal;
    else if (pathname.endsWith("/history"))
      data =
        options.history ??
        ({
          sessionId: session.sessionId,
          continuity: "current",
          messages: [],
          transcriptAuthority: "hermes",
          avatarConsent: null,
        } as const);
    else if (pathname.endsWith("/avatar-consent")) data = { state: "accepted" };
    else if (pathname.endsWith("/stream")) {
      const body = request.postDataJSON() as {
        readonly text?: unknown;
        readonly context?: { readonly userDisplayName?: unknown };
      } | null;
      const requestText = typeof body?.text === "string" ? body.text : "";
      const userDisplayName =
        typeof body?.context?.userDisplayName === "string"
          ? body.context.userDisplayName
          : "World user";
      if (options.fulfillStream) {
        await options.fulfillStream(route, requestText, userDisplayName);
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: streamBody(requestText, userDisplayName),
      });
      return;
    } else if (
      pathname.endsWith("/repository-indexes") &&
      request.method() === "POST"
    )
      data = {
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
      };
    else if (pathname.endsWith("/world/current"))
      data = { snapshot: options.snapshot ?? snapshot };
    else {
      await route.fulfill({ status: 404, body: "fixture route missing" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope(data)),
    });
  });
}

async function enterFixtureWorld(page: Page, path = "/") {
  await page.goto(path);
  await page.getByRole("button", { name: /Single Agent/ }).click();
  await page.getByRole("button", { name: "Connect hermes" }).click();
  await page.getByLabel("Agent name").fill("Mr Fluff");
  await page.getByRole("button", { name: "Connect agent" }).click();
  await expect(
    page.getByRole("heading", { name: "Create Mr Fluff’s avatar" }),
  ).toBeVisible();
  await page.getByLabel("Required agent name").fill("Mr Fluff");
  await page.getByRole("button", { name: "Use Complete Avatar" }).click();
  await expect(
    page
      .getByTestId("avatar-preview")
      .locator(
        '.imported-avatar-canvas[data-avatar-imported-id="cat-agent-01"]',
      ),
  ).toHaveAttribute("data-avatar-render-ready", "true", { timeout: 60_000 });
  const acceptAvatar = page.getByRole("button", {
    name: "Accept and save avatar",
  });
  await expect(acceptAvatar).toBeEnabled();
  await acceptAvatar.focus();
  await expect(acceptAvatar).toBeFocused();
  await page.keyboard.press("Enter");
  const enterWorld = page.getByRole("button", { name: "Enter World" });
  await expect(enterWorld).toBeVisible({ timeout: 60_000 });
  await expect(enterWorld).toBeEnabled({ timeout: 60_000 });
  await enterWorld.click();
  await expect(page.getByTestId("world-hud")).toBeVisible({ timeout: 30_000 });
}

test("@repository-intake selects a local project from normal World", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedConfiguredAvatar(page, "Aaron");
  await installWorldFixtures(page, { repositoryProjects: [] });
  await enterFixtureWorld(page);

  const composer = page.getByLabel("Message Mr Fluff");
  await composer.fill("Please load a repository");
  await composer.press("Enter");

  const intake = page.getByRole("dialog", { name: "Repository Intake_" });
  await expect(intake).toBeVisible();
  await expect(intake).toContainText("Recent / pinned");
  await expect(intake).toContainText("Open local");
  await expect(intake).toContainText("Create new");
  await expect(intake).toContainText("Clone GitHub");

  await intake.getByLabel("Local repository path").fill("/tmp/notes-app");
  const openLocal = intake.getByRole("button", {
    name: "Open local",
    exact: true,
  });
  await expect(openLocal).toHaveCSS("background-image", /linear-gradient/iu);
  await openLocal.click();

  await expect(intake).not.toBeVisible();
  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-floor-state",
    "repository",
    { timeout: 30_000 },
  );
  await expect(
    page.getByRole("heading", { name: "Repository floor" }),
  ).toBeVisible();
});

test("@workbench-normal drives one Workstream through normal World conversation", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedConfiguredAvatar(page, "Aaron");

  const repository = {
    repositoryId: snapshot.repositoryRef,
    revision: "77777777-7777-4777-8777-777777777777",
  } as const;
  const agent = {
    agentId: session.sessionId,
    nativeSessionId: session.adapterSessionRef,
    rootNativeSessionId: session.adapterSessionRef,
    revision: "0",
  } as const;
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
  let createRequests = 0;
  const streamRequests: string[] = [];
  await installWorldFixtures(page, {
    restoreStatus: true,
    repositoryProjects: [
      {
        id: "notes-app",
        name: "Notes App",
        rootPath: "/tmp/notes-app",
        source: "local",
        pinned: true,
        lastOpenedAt: "2026-09-03T14:00:00.000Z",
      },
    ],
    fulfillStream: async (route, requestText, userDisplayName) => {
      streamRequests.push(requestText);
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: streamBody(requestText, userDisplayName),
      });
    },
    fulfillWorkstreams: async (route, pathname) => {
      const request = route.request();
      if (
        request.method() === "GET" &&
        pathname.endsWith("/workstreams/current")
      ) {
        if (!currentWorkstream) {
          await route.fulfill({
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({
              ok: false,
              error: { code: "not_found", message: "No current Workstream" },
            }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(envelope(currentWorkstream)),
        });
        return;
      }
      if (request.method() === "POST" && pathname.endsWith("/workstreams")) {
        createRequests += 1;
        const input = request.postDataJSON() as {
          readonly title: string;
          readonly task: string;
        };
        currentWorkstream = {
          ...baseWorkstream,
          title: input.title,
          task: input.task,
        };
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(
            envelope({ workstream: currentWorkstream, replayed: false }),
          ),
        });
        return;
      }
      if (request.method() === "POST" && pathname.endsWith("/cancel")) {
        currentWorkstream = {
          ...baseWorkstream,
          revision: 2,
          status: "cancelled",
          worktreeState: "removed",
          projection: {
            ...baseWorkstream.projection,
            currentActivity: "Owned clean worktree removed.",
          },
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            envelope({ workstream: currentWorkstream, replayed: false }),
          ),
        });
        return;
      }
      await route.fulfill({ status: 404, body: "workstream fixture missing" });
    },
  });
  await enterFixtureWorld(page);

  const composer = page.getByLabel("Message Mr Fluff");
  await composer.fill("Let's pick up work on the Notes App");
  await composer.press("Enter");
  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-floor-state",
    "repository",
    { timeout: 30_000 },
  );
  await expect(
    page.getByRole("dialog", { name: "Repository Intake_" }),
  ).toHaveCount(0);

  await composer.fill("Build a settings panel");
  await composer.press("Enter");
  const workstream = page.getByRole("complementary", {
    name: "Current Workstream",
  });
  await expect(workstream).toBeVisible();
  await expect(workstream).toContainText("Workbench · working");
  await expect.poll(() => createRequests).toBe(1);
  expect(streamRequests).toEqual([]);
  const inspect = workstream.getByRole("button", {
    name: "Inspect current Workstream",
  });
  await expect(inspect).toHaveCSS("background-image", /linear-gradient/iu);
  const bounds = await workstream.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1440);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);

  await composer.fill("inspect current workstream");
  await composer.press("Enter");
  await expect(
    workstream.getByRole("region", { name: "Work Inspector" }),
  ).toBeVisible();
  expect(
    await workstream
      .locator("h2, h3, p, strong, span, button")
      .evaluateAll((nodes) =>
        nodes
          .filter((node) => node.scrollWidth > node.clientWidth + 1)
          .map((node) => node.textContent?.trim() ?? ""),
      ),
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("workbench-normal-expanded.png"),
  });

  await composer.fill("change it to use the blue active state");
  await composer.press("Enter");
  await expect
    .poll(() => streamRequests)
    .toEqual(["change it to use the blue active state"]);
  expect(createRequests).toBe(1);

  await composer.fill("cancel current workstream");
  await composer.press("Enter");
  await expect(workstream).toHaveAttribute(
    "data-workstream-status",
    "cancelled",
  );
  await expect(workstream).toContainText("Owned clean worktree removed.");
  const unavailableCancel = workstream.getByRole("button", {
    name: "Cancel unavailable — Workstream is cancelled.",
  });
  await expect(unavailableCancel).toBeDisabled();
  await expect(unavailableCancel).toHaveCSS(
    "background-color",
    "rgb(75, 85, 99)",
  );
  await expect(unavailableCancel).toHaveCSS("background-image", "none");
  await expect(
    page.getByRole("link", { name: /Workbench|dashboard/iu }),
  ).toHaveCount(0);
  await expect(page.getByText("Authoritative Workbench")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileBounds = await workstream.boundingBox();
  const hudBounds = await page.getByTestId("world-hud").boundingBox();
  expect(mobileBounds).not.toBeNull();
  expect(hudBounds).not.toBeNull();
  expect(mobileBounds!.x).toBeGreaterThanOrEqual(0);
  expect(mobileBounds!.x + mobileBounds!.width).toBeLessThanOrEqual(390);
  expect(mobileBounds!.y).toBeGreaterThanOrEqual(0);
  expect(mobileBounds!.y + mobileBounds!.height).toBeLessThanOrEqual(
    hudBounds!.y,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("@workbench-world-view keeps preview interaction inside the mounted World", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedConfiguredAvatar(page, "Aaron");

  const repository = {
    repositoryId: snapshot.repositoryRef,
    revision: "77777777-7777-4777-8777-777777777777",
  } as const;
  const agent = {
    agentId: session.sessionId,
    nativeSessionId: session.adapterSessionRef,
    rootNativeSessionId: session.adapterSessionRef,
    revision: "0",
  } as const;
  const authority = {
    schema: "aiw.worktree-authority-receipt/1",
    ownerId: "workstream-owner",
    requestId: "workstream-authority-request",
    worktreeId: "worktree-world-view",
    repositoryId: repository.repositoryId,
    relativePath: "worktree-world-view",
    branch: "workstream/world-view",
    head: "a".repeat(40),
    state: "current",
    statusSummary: "Owned worktree is current and ready.",
    validatedAt: "2026-09-03T20:00:00.000Z",
    attestation: "b".repeat(64),
  } as const;
  const baseWorkstream = {
    schema: "aiw.workstream/1",
    workstreamId: "88888888-8888-4888-8888-888888888888",
    revision: 1,
    title: "Build World View",
    task: "Build World View",
    repository,
    agent,
    authority,
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
    createdAt: "2026-09-03T20:00:00.000Z",
    updatedAt: "2026-09-03T20:00:00.000Z",
    events: [],
  } as const;
  const recipe = {
    schema: "aiw.preview-recipe/1",
    recipeId: "world-view-web",
    revision: 3,
    repositoryId: repository.repositoryId,
    label: "World View browser preview",
    executable: "pnpm",
    args: ["preview", "--host", "{host}", "--port", "{port}"],
    readinessPath: "/",
    browserPath: "/preview-fixture",
    approvedAt: "2026-09-03T20:00:00.000Z",
  } as const;
  const preview = {
    schema: "aiw.preview-record/1",
    previewId: "preview-world-view",
    revision: 4,
    state: "ready",
    workstreamId: baseWorkstream.workstreamId,
    workstreamRevision: baseWorkstream.revision,
    repository,
    agent,
    worktreeId: authority.worktreeId,
    worktreeState: "current",
    recipeId: recipe.recipeId,
    recipeRevision: recipe.revision,
    host: "127.0.0.1",
    port: 45_173,
    pid: 4321,
    url: "http://127.0.0.1:45173/preview-fixture",
    health: {
      ok: true,
      status: 200,
      checkedAt: "2026-09-03T20:01:00.000Z",
    },
    logs: "ready",
    logsTruncated: false,
    startedAt: "2026-09-03T20:00:30.000Z",
    readyAt: "2026-09-03T20:01:00.000Z",
    stoppedAt: null,
    portClosed: null,
    recovered: false,
    error: null,
  } as const;
  let currentWorkstream: Record<string, unknown> | null = null;
  let previewReady = false;
  let startRequests = 0;
  const browserErrors: string[] = [];
  await page.route("**/preview-fixture", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: '<!doctype html><label>Preview state<input aria-label="Preview state" value="kept"></label>',
    }),
  );
  await installWorldFixtures(page, {
    restoreStatus: true,
    repositoryProjects: [
      {
        id: "notes-app",
        name: "Notes App",
        rootPath: "/tmp/notes-app",
        source: "local",
        pinned: true,
        lastOpenedAt: "2026-09-03T19:00:00.000Z",
      },
    ],
    fulfillPreviewManager: async (route, pathname) => {
      const request = route.request();
      if (request.method() === "GET" && pathname.endsWith("/preview-recipes")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(envelope([recipe])),
        });
        return;
      }
      if (
        request.method() === "GET" &&
        pathname.endsWith("/previews/current")
      ) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            envelope({
              schema: "aiw.preview-manager/1",
              active: previewReady ? preview : null,
              latestAttempt: previewReady ? preview : null,
              previousVerified: null,
              display: previewReady ? { truth: "current", preview } : null,
            }),
          ),
        });
        return;
      }
      if (request.method() === "POST" && pathname.endsWith("/previews")) {
        startRequests += 1;
        previewReady = true;
        const body = request.postDataJSON() as Record<string, unknown>;
        expect(body).toEqual({
          requestId: expect.any(String),
          correlationId: body.requestId,
          expectedWorkstreamRevision: baseWorkstream.revision,
          repository,
          agent,
          recipeId: recipe.recipeId,
          expectedRecipeRevision: recipe.revision,
        });
        expect(JSON.stringify(body)).not.toMatch(
          /executable|args|cwd|environment|relativePath|branch|head/,
        );
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(envelope({ preview, replayed: false })),
        });
        return;
      }
      await route.fulfill({ status: 404, body: "preview fixture missing" });
    },
    fulfillWorkstreams: async (route, pathname) => {
      const request = route.request();
      if (
        request.method() === "GET" &&
        pathname.endsWith("/workstreams/current")
      ) {
        await route.fulfill(
          currentWorkstream
            ? {
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(envelope(currentWorkstream)),
              }
            : {
                status: 404,
                contentType: "application/json",
                body: JSON.stringify({
                  ok: false,
                  error: {
                    code: "not_found",
                    message: "No current Workstream",
                  },
                }),
              },
        );
        return;
      }
      if (request.method() === "POST" && pathname.endsWith("/workstreams")) {
        currentWorkstream = baseWorkstream;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(
            envelope({ workstream: currentWorkstream, replayed: false }),
          ),
        });
        return;
      }
      if (request.method() === "POST" && pathname.endsWith("/cancel")) {
        previewReady = false;
        currentWorkstream = {
          ...baseWorkstream,
          revision: 2,
          status: "cancelled",
          worktreeState: "removed",
          projection: {
            ...baseWorkstream.projection,
            currentActivity: "Owned clean worktree removed.",
          },
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            envelope({ workstream: currentWorkstream, replayed: false }),
          ),
        });
        return;
      }
      await route.fulfill({ status: 404, body: "workstream fixture missing" });
    },
  });
  await enterFixtureWorld(page);

  const composer = page.getByLabel("Message Mr Fluff");
  await composer.fill("Let's pick up work on the Notes App");
  await composer.press("Enter");
  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-floor-state",
    "repository",
    { timeout: 30_000 },
  );
  await composer.fill("Build World View");
  await composer.press("Enter");

  const workstream = page.getByRole("complementary", {
    name: "Current Workstream",
  });
  await expect(workstream).toBeVisible();
  page.on("console", (message) => {
    if (message.type() === "error")
      browserErrors.push(
        `${message.text()}${message.location().url ? ` @ ${message.location().url}` : ""}`,
      );
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      browserErrors.push(`${response.status()} ${response.url()}`);
  });
  const launcher = workstream.getByRole("button", {
    name: "Start World View",
  });
  await expect(launcher).toBeEnabled();
  await expect(launcher).toHaveCSS("background-image", /linear-gradient/iu);
  await launcher.click();
  await expect.poll(() => startRequests).toBe(1);

  const view = page.getByRole("region", { name: "World View" });
  await expect(view).toBeVisible();
  await expect(view).toHaveAttribute("data-preview-truth", "current");
  await expect(view).toContainText("Current verified preview");
  await expect(view).toContainText("workstream/world-view");
  await expect(view.locator("iframe")).toHaveCount(1);
  await expect(view.locator("canvas")).toHaveCount(0);
  await expect.poll(() => startRequests).toBe(1);

  const room = page.locator("main.world-room");
  await room.focus();
  await page.keyboard.down("w");
  await page.waitForTimeout(120);
  await page.keyboard.up("w");
  const worldState = await room.evaluate((element) => ({
    x: element.getAttribute("data-user-position-x"),
    z: element.getAttribute("data-user-position-z"),
    yaw: element.getAttribute("data-camera-yaw"),
    pitch: element.getAttribute("data-camera-pitch"),
  }));

  await view.getByRole("button", { name: "Expand World View" }).click();
  const expanded = page.getByRole("dialog", { name: "World View" });
  await expect(expanded).toBeVisible();
  await expanded.getByRole("button", { name: "Interact with preview" }).click();
  await expect(expanded).toHaveAttribute("data-input-owner", "preview");
  await expect(room).toHaveAttribute("data-input-owner", "preview");
  await page.keyboard.down("w");
  await page.waitForTimeout(120);
  await page.keyboard.up("w");
  await expect
    .poll(() =>
      room.evaluate((element) => ({
        x: element.getAttribute("data-user-position-x"),
        z: element.getAttribute("data-user-position-z"),
        yaw: element.getAttribute("data-camera-yaw"),
        pitch: element.getAttribute("data-camera-pitch"),
      })),
    )
    .toEqual(worldState);

  const previewFrame = page.frameLocator(
    'iframe[title="World View preview: Build World View"]',
  );
  await expect(previewFrame.getByLabel("Preview state")).toHaveValue("kept");
  await expanded.getByRole("button", { name: "Return to World" }).click();
  await expect(room).toHaveAttribute("data-input-owner", "world");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "World View" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "World menu" })).toHaveCount(0);
  await expect(
    view.getByRole("button", { name: "Expand World View" }),
  ).toBeFocused();
  await view.getByRole("button", { name: "Expand World View" }).click();
  await expect(previewFrame.getByLabel("Preview state")).toHaveValue("kept");
  await expanded.getByRole("button", { name: "Close World View" }).click();
  await expect(room).toHaveAttribute("data-input-owner", "world");

  const bounds = await view.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1440);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("workbench-world-view.png"),
  });

  await composer.fill("cancel current workstream");
  await composer.press("Enter");
  await expect(workstream).toHaveAttribute(
    "data-workstream-status",
    "cancelled",
  );
  await expect(page.getByLabel("World View")).toHaveCount(0);
  await expect(
    workstream.getByRole("button", { name: /World View unavailable/iu }),
  ).toBeDisabled();
  expect(startRequests).toBe(1);
  expect(browserErrors).toEqual([]);
});

test("@workstream-tracer deterministic Work Inspector stays truthful and keyboard accessible", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedConfiguredAvatar(page, "Aaron");
  await installWorldFixtures(page);
  await enterFixtureWorld(page, "/?workstreamTracer=demo");

  const composer = page.getByLabel("Message Mr Fluff");
  await composer.fill("/repo load .");
  await composer.press("Enter");
  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-floor-state",
    "repository",
    { timeout: 30_000 },
  );

  const inspect = page.getByRole("button", {
    name: "Inspect demo workstream",
  });
  await expect(inspect).toHaveAttribute("aria-expanded", "false");
  await page.evaluate(() => {
    const scrollIntoView = Element.prototype.scrollIntoView;
    (
      window as unknown as {
        workInspectorScrolls: ScrollIntoViewOptions[];
      }
    ).workInspectorScrolls = [];
    Element.prototype.scrollIntoView = function (
      options?: boolean | ScrollIntoViewOptions,
    ) {
      if (this.getAttribute("aria-label") === "Work Inspector")
        (
          window as unknown as {
            workInspectorScrolls: ScrollIntoViewOptions[];
          }
        ).workInspectorScrolls.push(options as ScrollIntoViewOptions);
      scrollIntoView.call(this, options);
    };
  });
  await inspect.focus();
  await inspect.press("Enter");

  const inspector = page.getByRole("region", { name: "Work Inspector" });
  await expect(inspector).toBeVisible();
  await expect(inspector).toBeFocused();
  await expect(inspector).toBeInViewport();
  const openInspect = page.getByRole("button", {
    name: "Work Inspector open",
  });
  await expect(openInspect).toHaveAttribute("aria-expanded", "true");
  await expect(openInspect).toHaveAttribute("aria-controls", "work-inspector");
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as {
            workInspectorScrolls: ScrollIntoViewOptions[];
          }
        ).workInspectorScrolls,
    ),
  ).toEqual([{ behavior: "auto", block: "nearest" }]);

  const assetSearch = page.getByLabel("Search assets");
  await assetSearch.fill("branch");
  await expect(assetSearch).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as {
            workInspectorScrolls: ScrollIntoViewOptions[];
          }
        ).workInspectorScrolls,
    ),
  ).toHaveLength(1);
  await expect(inspector).toContainText("Deterministic demo fixture");
  await expect(inspector).toContainText(
    "No live branch, preview, push, approval, or check result",
  );
  await expect(inspector).toContainText("In-world Work Inspector tracer");
  await expect(inspector).toContainText("Fixture only — no check has run.");
});

test("@workstream-tracer-live reads and inspects only the current Phase 14 journey", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedConfiguredAvatar(page, "Aaron");
  const phase14Requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/phase14/"))
      phase14Requests.push(
        `${request.method()} ${new URL(request.url()).pathname}`,
      );
  });
  await installWorldFixtures(page, {
    phase14Current: {
      operationId: "99999999-9999-4999-8999-999999999999",
      createdAt: "2026-08-06T20:00:00.000Z",
      updatedAt: "2026-08-06T20:04:00.000Z",
      status: "active",
      step: 8,
      session: {
        adapterSessionRef: "phase14-hermes-fixture-session",
        continuity: "fixture-existing",
      },
      disposable: {
        repositoryId: "aiw://object/repository-phase14-magic-slice",
        fixtureRevision: "phase14-magic-slice/1",
        target: "src/greeting.mjs",
        symbol: "greeting",
      },
      events: [
        {
          eventId: "88888888-8888-4888-8888-888888888888",
          operation: "test",
          state: "running",
          sequence: 8,
          occurredAt: "2026-08-06T20:04:00.000Z",
        },
      ],
      explanation: null,
      edit: {
        outcome: "applied",
        diff: "--- previous/src/greeting.mjs\n+++ current/src/greeting.mjs",
        patchDigest: "3".repeat(64),
        previousHash: "8".repeat(64),
        currentHash: "a".repeat(64),
        previousEvidenceRef: "aiw://evidence/source-previous",
        currentEvidenceRef: "aiw://evidence/diff-current",
        error: null,
      },
      approval: null,
      test: {
        state: "running",
        argv: ["/usr/bin/node", "--test", "test/greeting.test.mjs"],
        stdout: "",
        stderr: "",
        stdoutTruncated: false,
        stderrTruncated: false,
        exitCode: null,
        signal: null,
        timedOut: false,
        startedAt: "2026-08-06T20:03:00.000Z",
        finishedAt: null,
        evidenceRef: null,
      },
      preview: null,
      evidenceRefs: ["aiw://evidence/diff-current"],
    },
  });
  await enterFixtureWorld(page, "/?workstreamTracer=phase14");

  const composer = page.getByLabel("Message Mr Fluff");
  await composer.fill("/repo load .");
  await composer.press("Enter");
  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-floor-state",
    "repository",
    { timeout: 30_000 },
  );

  const inspect = page.getByRole("button", {
    name: "Inspect current Phase 14 workstream",
  });
  await inspect.focus();
  await inspect.press("Enter");

  const inspector = page.getByRole("region", { name: "Work Inspector" });
  await expect(inspector).toContainText(
    "Authoritative Phase 14 read-only projection",
  );
  await expect(inspector).toContainText("Status: validating");
  await expect(inspector).toContainText("Phase 14 test running");
  await expect(inspector).toContainText("src/greeting.mjs");
  await expect(inspector).toContainText("aiw://evidence/diff-current");
  await expect(inspector).toContainText(
    "State running · exit unavailable · timed out no.",
  );
  await expect(inspector).not.toContainText("Deterministic demo fixture");
  expect(phase14Requests).toEqual(["GET /api/phase14/journeys/current"]);
});

async function restoreFixtureWorld(
  page: Page,
  importedModelId = "robot-agent-02",
) {
  const acceptedProposal = {
    ...proposal,
    avatarSource: {
      kind: "imported",
      version: 2,
      mode: "original",
      modelId: importedModelId,
    },
  } as const;
  await page.addInitScript(
    ({ key, activeSessionId }) => localStorage.setItem(key, activeSessionId),
    {
      key: "aiw.agent-session.pointer.0.12",
      activeSessionId: session.sessionId,
    },
  );
  await installWorldFixtures(page, {
    avatarProposal: acceptedProposal,
    restoreStatus: true,
    history: {
      sessionId: session.sessionId,
      continuity: "current",
      messages: [],
      transcriptAuthority: "hermes",
      avatarConsent: {
        state: "accepted",
        current: acceptedProposal,
        previous: null,
      },
    },
  });
  await page.goto("/");
  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-floor-state",
    "blank",
  );
  await expect(page.getByTestId("world-hud")).toBeVisible();
}

async function forcePhase18_5Render(page: Page) {
  const canvas = page.locator('canvas[data-camera-mode="third-person"]');
  await canvas.evaluate(
    (element) =>
      new Promise<void>((resolveRender, rejectRender) => {
        const requestId = Date.now();
        const complete = (event: Event) => {
          if ((event as CustomEvent).detail?.requestId !== requestId) return;
          window.clearTimeout(timeout);
          element.removeEventListener("aiw:render-sample", complete);
          resolveRender();
        };
        const timeout = window.setTimeout(() => {
          element.removeEventListener("aiw:render-sample", complete);
          rejectRender(new Error("Phase 18.5 evidence render timed out"));
        }, 5_000);
        element.addEventListener("aiw:render-sample", complete);
        element.dispatchEvent(
          new CustomEvent("aiw:measure-render", { detail: { requestId } }),
        );
      }),
  );
}

async function preparePhase18_5World(page: Page) {
  await seedConfiguredAvatar(page, "Aaron");
  await restoreFixtureWorld(page, "cat-agent-01");
  await expect(
    page.getByRole("button", { name: /Push to talk/ }),
  ).toBeEnabled();
  await expectSharedHudBottomTrack(page);

  const canvas = page.locator('canvas[data-camera-mode="third-person"]');
  await expect(canvas).toHaveAttribute("data-avatar-render-ready", "true", {
    timeout: 30_000,
  });
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-user-avatar-species", "human");
  await expect(canvas).toHaveAttribute("data-user-avatar-shirt", "Codex");
  await expect(canvas).toHaveAttribute("data-agent-avatar-species", "cat");
  await expect(canvas).toHaveAttribute("data-agent-avatar-shirt", "Hermes");
  await expect(canvas).toHaveAttribute("data-user-avatar-source", "custom");
  await expect(canvas).toHaveAttribute("data-agent-avatar-source", "imported");
  await expect(canvas).toHaveAttribute(
    "data-agent-avatar-imported-id",
    "cat-agent-01",
  );
  await forcePhase18_5Render(page);
  await page.screenshot({
    path: `${phase18_5EvidenceDirectory}/browser-world-avatar.png`,
    fullPage: true,
  });
  const messageComposer = page.getByLabel("Message Mr Fluff");
  const transcript = page.getByRole("log", {
    name: "Conversation and activity",
  });
  const chatForm = page.locator("form.world-chat");
  await expect(chatForm).toHaveAttribute("aria-busy", "false");
  await messageComposer.fill("Please load the approved repository");
  await messageComposer.press("Enter");
  await expect(transcript).toContainText(
    "YouPlease load the approved repository",
    { timeout: 30_000 },
  );
  await expect(transcript).toContainText(
    "Mr FluffRepository loaded locally · Current · 2 packages · 2 directories · 5 files",
    { timeout: 60_000 },
  );
  await expect(chatForm).toHaveAttribute("aria-busy", "false", {
    timeout: 120_000,
  });
  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-floor-state",
    "repository",
    { timeout: 30_000 },
  );
  await expect(
    page.getByRole("heading", { name: "Repository floor" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Repository floor objects" })
      .getByRole("listitem"),
  ).toHaveCount(9);
  await expectSharedHudBottomTrack(page);
  await expect(
    page.locator('canvas[data-floor-state="repository"]'),
  ).toHaveAttribute("data-avatar-render-ready", "true", {
    timeout: 30_000,
  });
  await forcePhase18_5Render(page);
  await page.screenshot({
    path: `${phase18_5EvidenceDirectory}/browser-world-repository.png`,
    fullPage: true,
  });
}

async function expectPhase18_5ActionProjection(page: Page) {
  const transcriptItems = page
    .getByRole("log", { name: "Conversation and activity" })
    .getByRole("listitem");
  const transcriptItemCount = await transcriptItems.count();
  const repositoryCanvas = page.locator(
    'canvas[data-floor-state="repository"]',
  );
  const actionComposer = page.getByLabel("Message Mr Fluff");
  await actionComposer.fill("Refresh Phase 18.5 action proof");
  const cheerObservation = await repositoryCanvas.evaluateHandle((canvas) => {
    let observer: MutationObserver | null = null;
    let timeout: number | null = null;
    const cleanup = () => {
      observer?.disconnect();
      if (timeout !== null) window.clearTimeout(timeout);
    };
    const observation = new Promise<{
      readonly action: string | undefined;
      readonly face: string | undefined;
      readonly secondary: string | undefined;
    }>((resolveCheer, rejectCheer) => {
      const capture = () => {
        if (canvas.dataset.agentAvatarAction !== "Cheer") return;
        const snapshot = {
          action: canvas.dataset.agentAvatarAction,
          face: canvas.dataset.agentAvatarFace,
          secondary: canvas.dataset.agentAvatarSecondary,
        };
        cleanup();
        resolveCheer(snapshot);
      };
      observer = new MutationObserver(capture);
      observer.observe(canvas, {
        attributes: true,
        attributeFilter: [
          "data-agent-avatar-action",
          "data-agent-avatar-face",
          "data-agent-avatar-secondary",
        ],
      });
      timeout = window.setTimeout(() => {
        cleanup();
        rejectCheer(new Error("Phase 18.5 Cheer observation timed out"));
      }, 15_000);
      capture();
    });
    return { observation };
  });
  await actionComposer.press("Enter");
  await expect(transcriptItems).toHaveCount(transcriptItemCount + 4);
  const transientSnapshot = await cheerObservation
    .evaluate(({ observation }) => observation)
    .finally(() => cheerObservation.dispose());
  expect(transientSnapshot.action).toBe("Cheer");
  // The imported clip and projected activity layer use independent clocks.
  expect([
    { face: "Smile", secondary: "Celebrate" },
    { face: "neutral", secondary: "Neutral" },
  ]).toContainEqual({
    face: transientSnapshot.face,
    secondary: transientSnapshot.secondary,
  });
}

async function expectOutwardConstellation(
  page: Page,
  nativeAcceptance = false,
) {
  const geometry = await page.evaluate(() => {
    const mark = document
      .querySelector<HTMLElement>(".world-entry-logo__mark")!
      .getBoundingClientRect();
    const center = {
      x: mark.left + mark.width / 2,
      y: mark.top + mark.height / 2,
    };
    const button = (selector: string) => {
      const bounds = document
        .querySelector<HTMLElement>(selector)!
        .getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
        radial:
          Math.hypot(
            bounds.left + bounds.width / 2 - center.x,
            bounds.top + bounds.height / 2 - center.y,
          ) / mark.width,
      };
    };
    return {
      viewport: {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      },
      mark: {
        left: mark.left,
        right: mark.right,
        top: mark.top,
        bottom: mark.bottom,
        width: mark.width,
        height: mark.height,
      },
      center,
      openclaw: button(".world-harness--openclaw"),
      hermes: button(".world-harness--hermes"),
      claude: button(".world-harness--claude"),
      codex: button(".world-harness--codex"),
    };
  });
  for (const value of [
    geometry.openclaw,
    geometry.hermes,
    geometry.claude,
    geometry.codex,
  ]) {
    expect(value.radial).toBeGreaterThan(0.52);
    expect(value.left).toBeGreaterThanOrEqual(-0.5);
    expect(value.right).toBeLessThanOrEqual(geometry.viewport.width + 0.5);
    expect(value.top).toBeGreaterThanOrEqual(-0.5);
    expect(value.bottom).toBeLessThanOrEqual(geometry.viewport.height + 0.5);
  }
  expect(geometry.openclaw.x).toBeLessThan(geometry.center.x);
  expect(geometry.openclaw.y).toBeLessThan(geometry.center.y);
  expect(geometry.hermes.x).toBeGreaterThan(geometry.center.x);
  expect(geometry.hermes.y).toBeLessThan(geometry.center.y);
  expect(geometry.claude.x).toBeLessThan(geometry.center.x);
  expect(geometry.claude.y).toBeGreaterThan(geometry.center.y);
  expect(geometry.codex.x).toBeGreaterThan(geometry.center.x);
  expect(geometry.codex.y).toBeGreaterThan(geometry.center.y);
  if (nativeAcceptance) {
    expect(geometry.viewport).toEqual({ width: 1912, height: 948 });
    expect(geometry.mark.width).toBeCloseTo(620, 0);
    expect(geometry.mark.height).toBeCloseTo(620, 0);
    expect(geometry.mark.left - geometry.openclaw.x).toBeGreaterThanOrEqual(90);
    expect(geometry.mark.left - geometry.claude.x).toBeGreaterThanOrEqual(90);
    expect(geometry.hermes.x - geometry.mark.right).toBeGreaterThanOrEqual(90);
    expect(geometry.codex.x - geometry.mark.right).toBeGreaterThanOrEqual(90);
    const upperEndpointY = geometry.mark.top + geometry.mark.height * 0.115;
    const lowerEndpointY = geometry.mark.top + geometry.mark.height * 0.885;
    expect(Math.abs(geometry.openclaw.y - upperEndpointY)).toBeLessThanOrEqual(
      1,
    );
    expect(Math.abs(geometry.hermes.y - upperEndpointY)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.claude.y - lowerEndpointY)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.codex.y - lowerEndpointY)).toBeLessThanOrEqual(1);
  }
  return geometry;
}

async function expectSharedHudBottomTrack(page: Page) {
  const geometry = await page.evaluate(() => {
    const transcript = document
      .querySelector<HTMLElement>(".world-transcript")!
      .getBoundingClientRect();
    const controls = document
      .querySelector<HTMLElement>(".world-hud__controls")!
      .getBoundingClientRect();
    return {
      bottomDelta: Math.abs(transcript.bottom - controls.bottom),
      overlap:
        transcript.left < controls.right &&
        transcript.right > controls.left &&
        transcript.top < controls.bottom &&
        transcript.bottom > controls.top,
      overflowY: getComputedStyle(
        document.querySelector<HTMLElement>(".world-transcript")!,
      ).overflowY,
      viewportWidth: document.documentElement.clientWidth,
      transcriptLeft: transcript.left,
      controlsRight: controls.right,
    };
  });
  expect(geometry.bottomDelta).toBeLessThanOrEqual(1);
  expect(geometry.overlap).toBe(false);
  expect(geometry.overflowY).toBe("auto");
  expect(geometry.transcriptLeft).toBeGreaterThanOrEqual(-0.5);
  expect(geometry.controlsRight).toBeLessThanOrEqual(
    geometry.viewportWidth + 0.5,
  );
}

async function measurePhase18_5Frames(page: Page) {
  return page.evaluate(async () => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      'canvas[data-floor-state="repository"]',
    );
    if (!canvas || canvas.dataset.phase18_5RenderReady !== "true")
      throw new Error("Phase 18.5 World renderer is not ready");
    const warmupFrames = 45;
    const cadenceSampleCount = 120;
    const renderSampleCount = 24;
    const waitFrames = (count: number) =>
      new Promise<void>((resolve) => {
        let remaining = count;
        const frame = () => {
          remaining -= 1;
          if (remaining <= 0) resolve();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
    await waitFrames(warmupFrames);

    let longestTaskMs = 0;
    const longTaskDurationsMs: number[] = [];
    const recordLongTasks = (entries: readonly PerformanceEntry[]) => {
      for (const entry of entries) {
        longestTaskMs = Math.max(longestTaskMs, entry.duration);
        longTaskDurationsMs.push(entry.duration);
      }
    };
    const observer = new PerformanceObserver((list) =>
      recordLongTasks(list.getEntries()),
    );
    let observingLongTasks = false;
    try {
      observer.observe({ type: "longtask" });
      observingLongTasks = true;
    } catch {
      observer.disconnect();
    }
    const cadenceMs = await new Promise<number[]>((resolve) => {
      const samples: number[] = [];
      let previous: number | null = null;
      const frame = (now: number) => {
        if (previous !== null) samples.push(now - previous);
        previous = now;
        if (samples.length < cadenceSampleCount) requestAnimationFrame(frame);
        else resolve(samples);
      };
      requestAnimationFrame(frame);
    });
    if (observingLongTasks) {
      recordLongTasks(observer.takeRecords());
      observer.disconnect();
    }

    let requestId = 0;
    const render = () =>
      new Promise<number>((resolve, reject) => {
        const id = ++requestId;
        const completed = (event: Event) => {
          const detail = (event as CustomEvent).detail;
          if (detail?.requestId !== id) return;
          clearTimeout(timeout);
          canvas.removeEventListener("aiw:render-sample", completed);
          resolve(detail.durationMs);
        };
        const timeout = window.setTimeout(() => {
          canvas.removeEventListener("aiw:render-sample", completed);
          reject(new Error("Phase 18.5 render sample timed out"));
        }, 1_000);
        canvas.addEventListener("aiw:render-sample", completed);
        canvas.dispatchEvent(
          new CustomEvent("aiw:measure-render", {
            detail: { requestId: id },
          }),
        );
      });
    const renderWorkMs: number[] = [];
    for (let index = 0; index < renderSampleCount; index += 1) {
      await waitFrames(2);
      renderWorkMs.push(await render());
    }
    return {
      cadenceMs,
      renderWorkMs,
      longestTaskMs,
      longTaskDurationsMs,
      warmupFrames,
      cadenceSampleCount,
      renderSampleCount,
    };
  });
}

async function completeJourney(
  page: Page,
  evidence:
    | "desktop"
    | "large-desktop"
    | "mobile"
    | "no-webgl"
    | "pointer-lock"
    | "fixture-name"
    | "phase18-5",
  userDisplayName = "Aaron",
) {
  // Desktop journeys load both accepted GLBs, exercise movement, complete two
  // fixture turns, and capture full-page evidence. GitHub's two-CPU software
  // renderer can take more than three minutes without changing any assertion.
  test.setTimeout(
    evidence === "desktop" || evidence === "large-desktop"
      ? 600_000
      : evidence === "pointer-lock" || evidence === "fixture-name"
        ? 300_000
        : 120_000,
  );
  await seedConfiguredAvatar(page, userDisplayName);
  await installWorldFixtures(page, { restoreStatus: true });
  await page.goto("/");
  await expect(page.locator(".world-entry-logo__name")).toHaveText(
    userDisplayName,
  );
  await expect(
    page.getByText("AgentIntersect", { exact: true }).last(),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /dashboard/i })).toHaveCount(0);
  if (evidence === "desktop")
    await page.screenshot({
      path: `${evidenceDirectory}/returning-identity-desktop.png`,
      fullPage: true,
    });
  if (evidence === "mobile")
    await page.locator("main").screenshot({
      path: `${evidenceDirectory}/returning-identity-mobile.png`,
    });

  await page.getByRole("button", { name: /Single Agent/ }).click();
  await expectOutwardConstellation(page);
  if (evidence === "desktop")
    await page.screenshot({
      path: `${evidenceDirectory}/constellation-outward-desktop.png`,
      fullPage: true,
    });
  if (evidence === "mobile")
    await page.locator("main").screenshot({
      path: `${evidenceDirectory}/constellation-outward-mobile.png`,
    });
  await page.getByRole("button", { name: "Connect hermes" }).click();
  await page.getByLabel("Agent name").fill("Missing Agent");
  await page.getByRole("button", { name: "Connect agent" }).click();
  await expect(page.locator(".world-agent-prompt--retry")).toContainText(
    "agent not found",
  );
  await page.getByRole("button", { name: "Retry" }).click();
  await page.getByLabel("Agent name").fill("Mr Fluff");
  await page.getByRole("button", { name: "Connect agent" }).click();
  await expect(
    page.getByRole("heading", { name: "Create Mr Fluff’s avatar" }),
  ).toBeVisible();
  const blockedEnterWorld = page.getByRole("button", { name: "Enter World" });
  await expect(blockedEnterWorld).toBeDisabled();
  await expect(
    page.getByText(
      "Use Complete Avatar, then Accept and save avatar to unlock Enter World.",
    ),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Create Mr Fluff’s avatar" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enter World" }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "Use Complete Avatar, then Accept and save avatar to unlock Enter World.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Use Complete Avatar" }),
  ).toBeEnabled();
  if (
    evidence === "desktop" ||
    evidence === "large-desktop" ||
    evidence === "phase18-5"
  ) {
    await expect(page.getByTestId("avatar-preview")).toBeVisible();
    await expect(
      page.locator(
        '.imported-avatar-canvas[data-avatar-render-ready="true"][data-avatar-imported-id="cat-agent-01"]',
      ),
    ).toBeVisible({ timeout: 20_000 });
    await page.screenshot({
      path: `${evidenceDirectory}/mr-fluff-avatar-desktop.png`,
      fullPage: true,
    });
  }
  await page.getByLabel("Required agent name").fill("Mr Fluff");
  await page.getByRole("button", { name: "Use Complete Avatar" }).click();
  if (evidence !== "no-webgl")
    await expect(
      page
        .getByTestId("avatar-preview")
        .locator(
          '.imported-avatar-canvas[data-avatar-imported-id="cat-agent-01"]',
        ),
    ).toHaveAttribute("data-avatar-render-ready", "true", { timeout: 60_000 });
  const saveAvatar = page.getByRole("button", {
    name: "Accept and save avatar",
  });
  await expect(saveAvatar).toBeEnabled();
  await saveAvatar.click();
  const enterWorld = page.getByRole("button", { name: "Enter World" });
  await expect(enterWorld).toBeEnabled({ timeout: 30_000 });
  await enterWorld.click();
  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-floor-state",
    "blank",
    { timeout: 30_000 },
  );
  await expect(page.getByTestId("world-hud")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Push to talk/ }),
  ).toBeEnabled();
  await expectSharedHudBottomTrack(page);
  if (
    evidence === "desktop" ||
    evidence === "large-desktop" ||
    evidence === "pointer-lock" ||
    evidence === "phase18-5"
  ) {
    const canvas = page.locator('canvas[data-camera-mode="third-person"]');
    await expect(canvas).toHaveAttribute("data-avatar-render-ready", "true", {
      timeout: 20_000,
    });
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute("data-user-avatar-species", "human");
    await expect(canvas).toHaveAttribute("data-user-avatar-shirt", "Codex");
    await expect(canvas).toHaveAttribute(
      "data-user-avatar-ground-offset",
      "0.855",
    );
    await expect(canvas).toHaveAttribute("data-agent-avatar-species", "cat");
    await expect(canvas).toHaveAttribute("data-agent-avatar-shirt", "Hermes");
    await expect(canvas).toHaveAttribute(
      "data-agent-avatar-ground-offset",
      "0.000",
    );
    const cameraHeading = await canvas.getAttribute("data-camera-yaw");
    await expect(canvas).toHaveAttribute(
      "data-controlled-avatar-heading",
      cameraHeading ?? "",
    );
    await expect(canvas).toHaveAttribute(
      "data-agent-avatar-heading",
      "independent",
    );
    await expect(canvas).toHaveAttribute("data-user-avatar-source", "custom");
    await expect(canvas).toHaveAttribute(
      "data-agent-avatar-source",
      "imported",
    );
    await expect(canvas).toHaveAttribute(
      "data-agent-avatar-imported-id",
      "cat-agent-01",
    );
    await expect(canvas).toHaveAttribute("data-user-position", "0,0");
    await page.keyboard.down("KeyW");
    try {
      await expect(canvas).not.toHaveAttribute("data-user-position", "0,0");
    } finally {
      await page.keyboard.up("KeyW");
    }
    const movedPosition = await canvas.getAttribute("data-user-position");
    await page.getByLabel("Message Mr Fluff").focus();
    await page.keyboard.press("KeyA");
    await page.waitForTimeout(80);
    await expect(canvas).toHaveAttribute(
      "data-user-position",
      movedPosition ?? "",
    );
  }
  await page.getByLabel("Message Mr Fluff").fill("hi");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  if (evidence !== "no-webgl")
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-agent-activity",
      "completed",
      { timeout: 30_000 },
    );
  const transcript = page.getByRole("log", {
    name: "Conversation and activity",
  });
  await expect(transcript).toContainText("Youhi");
  await expect(transcript).toContainText(
    `Mr Fluff[fixture] Hello ${userDisplayName} — Mr Fluff is here and ready.`,
  );
  await expect(transcript).toContainText("Coding completed · terminal.status");
  await expect(page.locator("[data-activity-state=completed]")).toContainText(
    "Mr Fluff completed",
  );
  if (evidence === "desktop")
    await page.screenshot({
      path: `${evidenceDirectory}/blank-room-desktop.png`,
      fullPage: true,
    });
  if (evidence === "phase18-5")
    await page.screenshot({
      path: `${phase18_5EvidenceDirectory}/browser-world-avatar.png`,
      fullPage: true,
    });

  const messageComposer = page.getByLabel("Message Mr Fluff");
  const sendMessage = page.getByRole("button", { name: "Send", exact: true });
  const chatForm = page.locator("form.world-chat");
  await expect(chatForm).toHaveAttribute("aria-busy", "false", {
    timeout: 60_000,
  });
  await messageComposer.fill("Please load the approved repository");
  await expect(sendMessage).toBeEnabled();
  await messageComposer.press("Enter");
  await expect(transcript).toContainText(
    "YouPlease load the approved repository",
    { timeout: 30_000 },
  );
  await expect(transcript).toContainText(
    "Mr FluffRepository loaded locally · Current · 2 packages · 2 directories · 5 files",
    { timeout: 60_000 },
  );
  await expect(chatForm).toHaveAttribute("aria-busy", "false", {
    timeout: 120_000,
  });
  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-floor-state",
    "repository",
    { timeout: 30_000 },
  );
  await expect(
    page.getByRole("heading", { name: "Repository floor" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Repository floor objects" })
      .getByRole("listitem"),
  ).toHaveCount(9);
  await expectSharedHudBottomTrack(page);
  if (
    evidence === "desktop" ||
    evidence === "large-desktop" ||
    evidence === "phase18-5"
  )
    await expect(
      page.locator('canvas[data-floor-state="repository"]'),
    ).toHaveAttribute("data-avatar-render-ready", "true", {
      timeout: 30_000,
    });
  if (evidence === "desktop") {
    const room = page.locator("main.world-room");
    const canvas = page.locator('canvas[data-floor-state="repository"]');
    await page.getByRole("button", { name: "Director" }).click();
    await page.getByLabel("Search assets").fill("deployment");
    await page.getByRole("button", { name: "Place on grid" }).click();
    const inspector = page.getByRole("region", { name: "Asset Inspector" });
    await inspector.getByRole("button", { name: "Focus" }).click();
    await expect(canvas).toHaveAttribute(
      "data-camera-focus",
      "repository-city",
      { timeout: 30_000 },
    );
    await inspector.getByRole("button", { name: "Remove" }).click();
    await expect(canvas).toHaveAttribute("data-camera-focus", "user");
    await page.getByLabel("Search assets").fill("");
    await page.getByRole("button", { name: "Live" }).click();
    await expect(room).toHaveAttribute("data-repository-city-mode", "live");
  }
  if (
    evidence === "desktop" ||
    evidence === "large-desktop" ||
    evidence === "mobile" ||
    evidence === "no-webgl"
  ) {
    const output =
      evidence === "desktop"
        ? "repository-floor-desktop.png"
        : evidence === "large-desktop"
          ? "repository-floor-large-desktop.png"
          : evidence === "mobile"
            ? "repository-floor-mobile.png"
            : "no-webgl-semantic.png";
    if (evidence === "mobile")
      await page.locator("main").screenshot({
        path: `${evidenceDirectory}/${output}`,
      });
    else
      await page.screenshot({
        path: `${evidenceDirectory}/${output}`,
        fullPage: true,
      });
  }
  if (evidence === "phase18-5")
    await page.screenshot({
      path: `${phase18_5EvidenceDirectory}/browser-world-repository.png`,
      fullPage: true,
    });
}

test("in-flight follow-ups remain editable and dispatch one at a time in FIFO order", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedConfiguredAvatar(page, "Aaron");
  const streamRequests: string[] = [];
  let releaseFirstStream = () => {};
  const firstStreamGate = new Promise<void>((resolveGate) => {
    releaseFirstStream = resolveGate;
  });
  await installWorldFixtures(page, {
    fulfillStream: async (route, requestText) => {
      streamRequests.push(requestText);
      if (streamRequests.length === 1) await firstStreamGate;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: streamBody(requestText, "Aaron").replaceAll(
          "[fixture] Hello Aaron — Mr Fluff is here and ready.",
          `[fixture] Reply to ${requestText}.`,
        ),
      });
    },
  });
  await enterFixtureWorld(page);

  const composer = page.getByLabel("Message Mr Fluff");
  const send = page.getByRole("button", { name: "Send", exact: true });
  await composer.fill("first request");
  await send.click();
  await expect.poll(() => [...streamRequests]).toEqual(["first request"]);

  await expect(composer).toBeEnabled();
  await composer.fill("second follow-up");
  await expect(send).toBeEnabled();
  await expect(send).toHaveClass(/world-action--enabled/);
  await send.click();

  const transcript = page.getByRole("log", {
    name: "Conversation and activity",
  });
  await expect(transcript).toContainText("Youfirst request");
  await expect(transcript).toContainText("Yousecond follow-up");
  await expect(page.locator(".world-hud__captions")).toContainText("1 queued");
  expect(streamRequests).toEqual(["first request"]);

  releaseFirstStream();
  await expect
    .poll(() => [...streamRequests])
    .toEqual(["first request", "second follow-up"]);
  await expect(transcript).toContainText(
    "Mr Fluff[fixture] Reply to first request.",
  );
  await expect(transcript).toContainText(
    "Mr Fluff[fixture] Reply to second follow-up.",
  );
  const transcriptItems = await transcript.locator("li").allTextContents();
  const positions = [
    "Youfirst request",
    "Yousecond follow-up",
    "Mr Fluff[fixture] Reply to first request.",
    "Mr Fluff[fixture] Reply to second follow-up.",
  ].map((text) => transcriptItems.indexOf(text));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((left, right) => left - right));
  for (const text of [
    "Youfirst request",
    "Yousecond follow-up",
    "Mr Fluff[fixture] Reply to first request.",
    "Mr Fluff[fixture] Reply to second follow-up.",
  ])
    expect(transcriptItems.filter((item) => item === text)).toHaveLength(1);
});

test("ordinary refresh restores the accepted exact session and authoritative transcript directly into World", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedConfiguredAvatar(page, "Aaron");
  await page.addInitScript(
    ({ key, sessionId }) => localStorage.setItem(key, sessionId),
    {
      key: "aiw.agent-session.pointer.0.12",
      sessionId: session.sessionId,
    },
  );
  const acceptedProposal = {
    ...proposal,
    avatarSource: {
      kind: "imported",
      version: 2,
      mode: "original",
      modelId: "cat-agent-01",
    },
  } as const;
  await installWorldFixtures(page, {
    avatarProposal: acceptedProposal,
    restoreStatus: true,
    history: {
      sessionId: session.sessionId,
      continuity: "current",
      messages: [
        { role: "user", text: "Are you still live?" },
        { role: "assistant", text: "Yes — this is the same exact session." },
      ],
      transcriptAuthority: "hermes",
      avatarConsent: {
        state: "accepted",
        current: acceptedProposal,
        previous: null,
      },
    },
  });

  for (let load = 0; load < 2; load += 1) {
    if (load === 0) await page.goto("/");
    else await page.reload();
    await expect(page.locator("main.world-room")).toHaveAttribute(
      "data-floor-state",
      "blank",
    );
    await expect(page.getByTestId("world-hud")).toBeVisible();
    const transcript = page.getByRole("log", {
      name: "Conversation and activity",
    });
    await expect(transcript).toContainText("YouAre you still live?");
    await expect(transcript).toContainText(
      "Mr FluffYes — this is the same exact session.",
    );
    await expect(
      page.getByRole("button", { name: "Connect agent" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: /Create .* avatar/ }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Enter World" })).toHaveCount(
      0,
    );
    await expect(transcript.locator("li")).toHaveCount(2);
  }
});

test("agent-name prompt replaces the completed session choice without overlap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1419, height: 776 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedConfiguredAvatar(page, "Aaron");
  await installWorldFixtures(page);
  await page.goto("/");

  await page.getByRole("button", { name: /Single Agent/ }).click();
  await page.getByRole("button", { name: "Connect hermes" }).click();

  const prompt = page.locator(".world-agent-prompt");
  await expect(prompt).toBeVisible();
  await expect(page.getByLabel("Agent name")).toBeVisible();
  await expect(page.locator(".world-entry-logo__session-choices")).toHaveCount(
    0,
  );
  const promptBounds = await prompt.boundingBox();
  expect(promptBounds).not.toBeNull();
  expect(promptBounds?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect(
    (promptBounds?.y ?? 0) + (promptBounds?.height ?? 0),
  ).toBeLessThanOrEqual(776);
});

test("native acceptance constellation aligns endpoint rows and moves outward", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1912, height: 948 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedConfiguredAvatar(page, "Aaron");
  await installWorldFixtures(page);
  await page.goto("/");
  await expect(page.locator(".world-entry-logo__name")).toHaveText("Aaron");
  await page.getByRole("button", { name: /Single Agent/ }).click();
  const geometry = await expectOutwardConstellation(page, true);
  await expect(
    page.getByRole("button", { name: "Connect hermes" }),
  ).toHaveClass(/world-action--enabled/);
  for (const harness of [
    "Connect openclaw",
    "Connect claude",
    "Connect codex",
  ]) {
    await expect(page.getByRole("button", { name: harness })).toHaveClass(
      /world-action--enabled/,
    );
  }
  writeFileSync(
    "/tmp/aiw-phase18-harness-geometry-1912x948.json",
    `${JSON.stringify(geometry, null, 2)}\n`,
  );
  await page.screenshot({
    path: "/tmp/aiw-phase18-harness-1912x948.png",
  });
});

test("clean storage reaches the true identify_ opening and user avatar creator", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
  const opening = page.getByTestId("identify-opening");
  await expect(opening).toBeVisible();
  await expect(
    opening.locator('img[src="/assets/dashboard/agentintersect_animated.svg"]'),
  ).toBeVisible();
  await expect(page.getByText("identify_", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Avatar" }),
  ).toBeVisible();
  await page.screenshot({
    path: `${evidenceDirectory}/first-launch-opening.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Create Avatar" }).click();
  await expect(page.getByTestId("avatar-preview")).toBeVisible();
  await expect(page.getByLabel("Required agent name")).toBeVisible();
  await page.screenshot({
    path: `${evidenceDirectory}/first-launch-avatar-creator.png`,
    fullPage: true,
  });
});

test("production boundary completes the returning-user Hermes magic slice", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await seedConfiguredAvatar(page, "Aaron");
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: false,
  });
  try {
    await page.goto("/");
    await expect(page.locator(".world-entry-logo__name")).toHaveText("Aaron");
    await expect(
      page.getByRole("button", { name: /Single Agent/ }),
    ).toBeVisible();
  } finally {
    const tracePath = `${evidenceDirectory}/world-entry-trace.zip`;
    await context.tracing.stop({ path: tracePath });
    sanitizeTraceArchive(tracePath);
  }
  await completeJourney(page, "desktop");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expectPhase18_5ActionProjection(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "1.25";
  });
  await expectSharedHudBottomTrack(page);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
  const results = await new AxeBuilder({ page }).analyze();
  const severe = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  writeFileSync(
    `${evidenceDirectory}/accessibility-summary.json`,
    `${JSON.stringify(
      {
        schema: "aiw.phase18-accessibility/1",
        tested: [
          "keyboard",
          "axe",
          "reduced-motion",
          "captions",
          "desktop-overflow",
        ],
        seriousOrCriticalViolations: severe.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
        })),
      },
      null,
      2,
    )}\n`,
  );
  expect(severe).toEqual([]);
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("body *")]
      .filter(
        (element) =>
          element.getBoundingClientRect().right >
          document.documentElement.clientWidth + 0.5,
      )
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          className: element.className,
          right: bounds.right,
          width: bounds.width,
          text: element.textContent?.slice(0, 80),
        };
      })
      .slice(0, 10),
  );
  expect(overflow).toEqual([]);
  expect(errors).toEqual([]);
});

test("Phase 18.5 integrates the avatar family and semantic repository kit @phase18-5-performance", async ({
  page,
}) => {
  // The proportional accepted-session setup keeps the complete 120-frame
  // cadence and 24-sample render proof inside the strict two-CPU watchdog.
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await preparePhase18_5World(page);
  await expect(
    page.getByRole("list", { name: "Repository floor objects" }),
  ).toContainText("source-file-code-slab");
  const repositoryCanvas = page.locator(
    'canvas[data-floor-state="repository"]',
  );
  const inspection = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      'canvas[data-floor-state="repository"]',
    );
    const room = document.querySelector<HTMLElement>("main.world-room");
    const context =
      canvas?.getContext("webgl2") ?? canvas?.getContext("webgl") ?? null;
    const debugRendererInfo = context?.getExtension(
      "WEBGL_debug_renderer_info",
    ) as { readonly UNMASKED_RENDERER_WEBGL: number } | null;
    const unmaskedRenderer = context
      ? String(
          context.getParameter(
            debugRendererInfo?.UNMASKED_RENDERER_WEBGL ?? context.RENDERER,
          ),
        )
      : null;
    return {
      renderer: room?.dataset.renderer ?? null,
      unmaskedRenderer,
      hardwareConcurrency: navigator.hardwareConcurrency,
      floor: room?.dataset.floorState ?? null,
      avatarReady: canvas?.dataset.avatarRenderReady ?? null,
      cosmeticQuality: canvas?.dataset.cosmeticQuality ?? null,
      renderDpr: canvas?.dataset.renderDpr ?? null,
      userSpecies: canvas?.dataset.userAvatarSpecies ?? null,
      agentSpecies: canvas?.dataset.agentAvatarSpecies ?? null,
      agentRepresentation: canvas?.dataset.agentAvatarRepresentation ?? null,
      userAction: canvas?.dataset.userAvatarAction ?? null,
      userLod: canvas?.dataset.userAvatarLod ?? null,
      agentLod: canvas?.dataset.agentAvatarLod ?? null,
      renderLoop: canvas?.dataset.renderLoop ?? null,
      renderLoopMode: canvas?.dataset.renderLoopMode ?? null,
      semanticRows: document.querySelectorAll(
        ".world-room__repository-objects li",
      ).length,
    };
  });
  const constrainedCosmetics =
    /swiftshader|llvmpipe|lavapipe|softpipe|software raster|microsoft basic render driver|software emulation/iu.test(
      inspection.unmaskedRenderer ?? "",
    ) ||
    (Number.isFinite(inspection.hardwareConcurrency) &&
      Number.isInteger(inspection.hardwareConcurrency) &&
      inspection.hardwareConcurrency > 0 &&
      inspection.hardwareConcurrency <= 2);
  const expectedCosmeticQuality = constrainedCosmetics ? "constrained" : "full";
  const expectedRenderDpr = constrainedCosmetics ? 0.25 : 1;
  const expectedRenderLoopMode = constrainedCosmetics
    ? "continuous-constrained"
    : "continuous-native";
  const expectedAgentRepresentation = constrainedCosmetics
    ? "runtime-impostor"
    : "live-model";
  await repositoryCanvas.evaluate(
    (canvas) =>
      new Promise<void>((resolveIdle) => {
        if (
          canvas.dataset.agentAvatarAction === "Idle" &&
          canvas.dataset.agentAvatarFace === "neutral" &&
          canvas.dataset.agentAvatarSecondary === "Neutral"
        ) {
          resolveIdle();
          return;
        }
        const observer = new MutationObserver(() => {
          if (
            canvas.dataset.agentAvatarAction !== "Idle" ||
            canvas.dataset.agentAvatarFace !== "neutral" ||
            canvas.dataset.agentAvatarSecondary !== "Neutral"
          )
            return;
          observer.disconnect();
          resolveIdle();
        });
        observer.observe(canvas, {
          attributes: true,
          attributeFilter: [
            "data-agent-avatar-action",
            "data-agent-avatar-face",
            "data-agent-avatar-secondary",
          ],
        });
      }),
  );
  await expect(repositoryCanvas).toHaveAttribute(
    "data-agent-avatar-action",
    "Idle",
  );
  await expect(repositoryCanvas).toHaveAttribute(
    "data-agent-avatar-face",
    "neutral",
  );
  await expect(repositoryCanvas).toHaveAttribute(
    "data-agent-avatar-secondary",
    "Neutral",
  );
  const frames = await measurePhase18_5Frames(page);
  const percentile = (values: readonly number[], fraction: number) =>
    [...values].sort((left, right) => left - right)[
      Math.ceil(values.length * fraction) - 1
    ] ?? Number.POSITIVE_INFINITY;
  const thresholds = {
    renderWorkP95Ms: 16.7,
    cadenceP95Ms: 16.8,
    longestTaskMs: 100,
  } as const;
  const cadenceAuthority = classifyPhase18_5Renderer(
    inspection.unmaskedRenderer,
  );
  const cadenceAuthoritative = cadenceAuthority === "hardware";
  const cadenceDiagnostics = {
    minMs: Math.min(...frames.cadenceMs),
    medianMs: percentile(frames.cadenceMs, 0.5),
    p90Ms: percentile(frames.cadenceMs, 0.9),
    p95Ms: percentile(frames.cadenceMs, 0.95),
    maxMs: Math.max(...frames.cadenceMs),
    samplesOverThreshold: frames.cadenceMs.filter(
      (duration) => duration > thresholds.cadenceP95Ms,
    ).length,
  };
  const retainedLongTaskDurations = [...frames.longTaskDurationsMs]
    .sort((left, right) => right - left)
    .slice(0, 20);
  const longTaskDiagnostics = {
    count: frames.longTaskDurationsMs.length,
    maxMs: frames.longestTaskMs,
    totalMs: frames.longTaskDurationsMs.reduce(
      (total, duration) => total + duration,
      0,
    ),
    retainedLongestDurationsMs: retainedLongTaskDurations,
  };
  const measurement = {
    schema: "aiw.phase18-5.measurement/2",
    renderer: inspection.unmaskedRenderer,
    hardwareConcurrency: inspection.hardwareConcurrency,
    cosmeticQuality: inspection.cosmeticQuality,
    renderDpr: inspection.renderDpr,
    cadenceAuthority,
    cadenceAuthoritative,
    samples: 120,
    warmupFrames: frames.warmupFrames,
    cadenceSamples: frames.cadenceSampleCount,
    renderSamples: frames.renderSampleCount,
    renderWorkP95Ms: percentile(frames.renderWorkMs, 0.95),
    cadenceP95Ms: cadenceDiagnostics.p95Ms,
    longestTaskMs: frames.longestTaskMs,
    cadenceDiagnostics,
    longTaskDiagnostics,
    thresholds,
  };
  const renderWorkPassed =
    measurement.renderWorkP95Ms <= measurement.thresholds.renderWorkP95Ms;
  const rawCadenceWithinThreshold =
    measurement.cadenceP95Ms <= measurement.thresholds.cadenceP95Ms;
  const cadencePassed = cadenceAuthoritative && rawCadenceWithinThreshold;
  const longTaskPassed =
    measurement.longestTaskMs <= measurement.thresholds.longestTaskMs;
  const hardwareEvidenceValidation = validatePhase18_5HardwareEvidence(
    readPhase18_5HardwareEvidence(),
  );
  const hardwareEvidencePassed = hardwareEvidenceValidation.passed;
  const functionalPassed =
    errors.length === 0 &&
    inspection.renderer === "webgl" &&
    inspection.floor === "repository" &&
    inspection.avatarReady === "true" &&
    inspection.agentRepresentation === expectedAgentRepresentation &&
    inspection.cosmeticQuality === expectedCosmeticQuality &&
    inspection.renderDpr === String(expectedRenderDpr) &&
    inspection.userLod === "LOD0" &&
    inspection.agentLod === "LOD0" &&
    inspection.renderLoop === "continuous" &&
    inspection.renderLoopMode === expectedRenderLoopMode &&
    inspection.semanticRows > 0;
  const passed =
    functionalPassed &&
    renderWorkPassed &&
    longTaskPassed &&
    (cadenceAuthoritative ? cadencePassed : hardwareEvidencePassed);
  writeFileSync(
    `${phase18_5EvidenceDirectory}/phase18-5-measurement.json`,
    `${JSON.stringify(
      {
        ...measurement,
        functionalPassed,
        renderWorkPassed,
        rawCadenceWithinThreshold,
        cadencePassed,
        longTaskPassed,
        hardwareEvidencePassed,
        hardwareEvidenceErrors: hardwareEvidenceValidation.errors,
        passed,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    `${phase18_5EvidenceDirectory}/browser-inspection.json`,
    `${JSON.stringify(
      {
        schema: "aiw.phase18-5.browser-inspection/1",
        passed: functionalPassed,
        errors,
        inspection: {
          ...inspection,
          cadenceAuthority,
          cadenceAuthoritative,
        },
      },
      null,
      2,
    )}\n`,
  );
  expect(inspection).toMatchObject({
    renderer: "webgl",
    floor: "repository",
    avatarReady: "true",
    hardwareConcurrency: expect.any(Number),
    cosmeticQuality: expectedCosmeticQuality,
    renderDpr: String(expectedRenderDpr),
    userSpecies: "human",
    agentSpecies: "cat",
    agentRepresentation: expectedAgentRepresentation,
    userAction: "Idle",
    userLod: "LOD0",
    agentLod: "LOD0",
    renderLoop: "continuous",
    renderLoopMode: expectedRenderLoopMode,
  });
  expect(measurement).toMatchObject({
    hardwareConcurrency: inspection.hardwareConcurrency,
    cosmeticQuality: expectedCosmeticQuality,
    renderDpr: String(expectedRenderDpr),
  });
  expect(errors).toEqual([]);
  expect(measurement.renderWorkP95Ms).toBeLessThanOrEqual(16.7);
  expect(measurement.longestTaskMs).toBeLessThanOrEqual(100);
  if (cadenceAuthoritative) {
    expect(rawCadenceWithinThreshold).toBe(true);
    expect(cadencePassed).toBe(true);
  } else {
    expect(cadencePassed).toBe(false);
    expect(hardwareEvidenceValidation).toEqual({ passed: true, errors: [] });
  }
  expect(passed).toBe(true);
});

test("mobile keyboard/reduced-motion/forced-colors journey remains contained", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({
    reducedMotion: "reduce",
    forcedColors: "active",
  });
  await completeJourney(page, "mobile");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-render-loop",
    "demand",
  );
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-render-loop-mode",
    "demand-reduced-motion",
  );
  for (const selector of [
    ".world-room__semantic",
    ".world-room__activity-semantic",
  ]) {
    await expect(page.locator(selector)).toHaveCSS("clip", /rect/);
    await expect(page.locator(selector)).toHaveCSS("width", "1px");
  }
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("body *")]
      .filter(
        (element) =>
          !element.closest(
            ".world-room__semantic, .world-room__activity-semantic",
          ) &&
          element.getBoundingClientRect().right >
            document.documentElement.clientWidth + 0.5,
      )
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          className: element.className,
          right: bounds.right,
          width: bounds.width,
          text: element.textContent?.slice(0, 80),
        };
      })
      .slice(0, 10),
  );
  expect(overflow).toEqual([]);
  const messageComposer = page.getByLabel("Message Mr Fluff");
  await messageComposer.focus();
  await expect(messageComposer).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(messageComposer).not.toBeFocused();
  await expect(page.locator(":focus")).toBeVisible();
});

test("large desktop World and HUD fill and reflow with the browser viewport", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1728, height: 1080 });
  await seedConfiguredAvatar(page, "Aaron");
  await restoreFixtureWorld(page);
  await expectSharedHudBottomTrack(page);

  const room = page.locator("main.world-room");
  const messageComposer = page.getByLabel("Message Mr Fluff");
  const transcript = page.getByRole("log", {
    name: "Conversation and activity",
  });
  await messageComposer.focus();
  await expect(messageComposer).toBeFocused();
  await messageComposer.fill("Please load the approved repository");
  await messageComposer.press("Enter");
  await expect(transcript).toContainText(
    "YouPlease load the approved repository",
    { timeout: 30_000 },
  );
  await expect(transcript).toContainText(
    "Mr FluffRepository loaded locally · Current · 2 packages · 2 directories · 5 files",
    { timeout: 60_000 },
  );
  await expect(room).toHaveAttribute("data-floor-state", "repository", {
    timeout: 30_000,
  });
  await expect(room).toHaveAttribute("data-repository-readiness", "ready", {
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: "Repository floor" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page
      .getByRole("list", { name: "Repository floor objects" })
      .getByRole("listitem"),
  ).toHaveCount(9, { timeout: 30_000 });
  const repositoryCanvas = page.locator(
    'canvas[data-floor-state="repository"]',
  );
  await expect(repositoryCanvas).toBeVisible({ timeout: 30_000 });
  await expect(repositoryCanvas).toHaveAttribute(
    "data-avatar-render-ready",
    "true",
    { timeout: 30_000 },
  );
  await expectSharedHudBottomTrack(page);

  const dimensions = await page.evaluate(() => {
    const box = (selector: string, visible = false) => {
      const elements = [...document.querySelectorAll<HTMLElement>(selector)];
      const element = visible
        ? elements.find((candidate) => {
            const bounds = candidate.getBoundingClientRect();
            return bounds.width > 0 && bounds.height > 0;
          })
        : elements[0];
      const bounds = element!.getBoundingClientRect();
      return {
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    return {
      viewport: {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      },
      experience: box(".world-experience"),
      room: box(".world-room"),
      canvas: box('canvas[data-floor-state="repository"]', true),
    };
  });
  expect(dimensions.experience).toEqual(dimensions.viewport);
  expect(dimensions.room).toEqual(dimensions.viewport);
  expect(dimensions.canvas).toEqual(dimensions.viewport);
  await page.screenshot({
    path: `${evidenceDirectory}/repository-floor-large-desktop.png`,
    fullPage: true,
  });
});

test("held right-button canvas look follows both axes and clears every exit guard @pointer-lock", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedConfiguredAvatar(page, "Aaron");
  await restoreFixtureWorld(page);
  const room = page.locator("main.world-room");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-avatar-render-ready", "true", {
    timeout: 30_000,
  });
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  const initialYaw = Number(await canvas.getAttribute("data-camera-yaw"));
  const initialPitch = Number(await canvas.getAttribute("data-camera-pitch"));
  await page.evaluate(() => {
    window.addEventListener("contextmenu", (event) => {
      document.body.dataset.contextMenuPrevented = String(
        event.defaultPrevented,
      );
    });
    window.addEventListener(
      "pointerdown",
      (event) => {
        document.body.dataset.lastPointerId = String(event.pointerId);
      },
      true,
    );
  });
  const expectCanvasPointerLock = async (locked: boolean) =>
    expect
      .poll(
        () =>
          canvas.evaluate((element) => document.pointerLockElement === element),
        { timeout: 15_000 },
      )
      .toBe(locked);

  if (
    await canvas.evaluate((element) => document.pointerLockElement === element)
  ) {
    await page.evaluate(() => document.exitPointerLock());
    await page.keyboard.press("Escape");
  }
  await expectCanvasPointerLock(false);
  await page.mouse.click(center.x, center.y, { button: "left" });
  await expect(room).toHaveAttribute("data-mouse-look", "idle");
  await expectCanvasPointerLock(false);
  await expect(canvas).toHaveAttribute(
    "data-camera-yaw",
    initialYaw.toFixed(3),
  );

  await page.mouse.move(center.x, center.y);
  await page.mouse.down({ button: "right" });
  await expectCanvasPointerLock(true);
  await expect(room).toHaveAttribute("data-mouse-look", "active");
  await page.mouse.move(center.x + 120, center.y - 80, { steps: 4 });
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-camera-yaw")))
    .toBeGreaterThan(initialYaw);
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-camera-pitch")))
    .toBeLessThan(initialPitch);
  const rightYaw = Number(await canvas.getAttribute("data-camera-yaw"));
  const upPitch = Number(await canvas.getAttribute("data-camera-pitch"));
  expect(rightYaw).toBeGreaterThan(initialYaw);
  expect(upPitch).toBeLessThan(initialPitch);
  await expect
    .poll(async () => {
      const yaw = Number(await canvas.getAttribute("data-camera-yaw"));
      const heading = Number(
        await canvas.getAttribute("data-controlled-avatar-heading"),
      );
      return Math.abs(yaw - heading);
    })
    .toBeLessThan(0.001);
  await expect(canvas).toHaveAttribute(
    "data-agent-avatar-heading",
    "independent",
  );
  await page.mouse.up({ button: "right" });
  await expectCanvasPointerLock(false);
  await expect(room).toHaveAttribute("data-mouse-look", "idle");
  await expect(page.locator("body")).toHaveAttribute(
    "data-context-menu-prevented",
    "true",
  );
  const composerContextMenuPrevented = await page
    .getByLabel("Message Mr Fluff")
    .evaluate((element) => {
      const event = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        button: 2,
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });
  expect(composerContextMenuPrevented).toBe(false);
  await expect(page.locator("body")).toHaveAttribute(
    "data-context-menu-prevented",
    "false",
  );
  await expect(room).toHaveAttribute("data-mouse-look", "idle");

  await page.mouse.click(center.x, center.y, { button: "left" });
  await page.mouse.move(center.x, center.y);
  await page.mouse.down({ button: "right" });
  await expectCanvasPointerLock(true);
  await expect(room).toHaveAttribute("data-mouse-look", "active");
  await page.mouse.move(center.x - 60, center.y + 80, { steps: 4 });
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-camera-yaw")))
    .toBeLessThan(rightYaw);
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-camera-pitch")))
    .toBeGreaterThan(upPitch);
  const leftYaw = Number(await canvas.getAttribute("data-camera-yaw"));
  const downPitch = Number(await canvas.getAttribute("data-camera-pitch"));
  expect(leftYaw).toBeLessThan(rightYaw);
  expect(downPitch).toBeGreaterThan(upPitch);
  await page.mouse.up({ button: "right" });
  await expectCanvasPointerLock(false);
  const releasedYaw = await canvas.getAttribute("data-camera-yaw");
  await page.mouse.move(center.x + 160, center.y);
  await expect(canvas).toHaveAttribute("data-camera-yaw", releasedYaw ?? "");

  await page.mouse.move(center.x, center.y);
  await page.mouse.down({ button: "right" });
  await expectCanvasPointerLock(true);
  await expect(room).toHaveAttribute("data-mouse-look", "active");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expectCanvasPointerLock(false);
  await expect(room).toHaveAttribute("data-mouse-look", "idle");
  await page.mouse.up({ button: "right" });

  await page.mouse.click(center.x, center.y, { button: "left" });
  await page.mouse.down({ button: "right" });
  await expectCanvasPointerLock(true);
  await canvas.evaluate((element) => {
    element.dispatchEvent(
      new PointerEvent("pointercancel", {
        bubbles: true,
        pointerId: Number(document.body.dataset.lastPointerId),
      }),
    );
  });
  await expectCanvasPointerLock(false);
  await expect(room).toHaveAttribute("data-mouse-look", "idle");
  await page.mouse.up({ button: "right" });

  await page.mouse.click(center.x, center.y, { button: "left" });
  await page.mouse.down({ button: "right" });
  await expectCanvasPointerLock(true);
  await expect(room).toHaveAttribute("data-mouse-look", "active");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expectCanvasPointerLock(false);
  await expect(room).toHaveAttribute("data-mouse-look", "idle");
  await page.mouse.up({ button: "right" });

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await page.mouse.click(center.x, center.y, { button: "left" });
  await page.mouse.down({ button: "right" });
  await expectCanvasPointerLock(true);
  await expect(room).toHaveAttribute("data-mouse-look", "active");
  await page.keyboard.press("Escape");
  await expectCanvasPointerLock(false);
  await expect(room).toHaveAttribute("data-mouse-look", "idle");
  await page.mouse.up({ button: "right" });

  await room.focus();
  const positionBeforeForwardValue = String(
    await canvas.getAttribute("data-user-position"),
  );
  const positionBeforeForward = positionBeforeForwardValue
    .split(",")
    .map(Number);
  await page.keyboard.down("KeyW");
  try {
    await expect
      .poll(() => canvas.getAttribute("data-user-avatar-action"))
      .toMatch(/StartWalk|Walk/u);
    await expect
      .poll(() => canvas.getAttribute("data-user-position"))
      .not.toBe(positionBeforeForwardValue);
  } finally {
    await page.keyboard.up("KeyW");
  }
  await expect(canvas).toHaveAttribute("data-user-avatar-action", "StopWalk");
  await expect
    .poll(() => canvas.getAttribute("data-user-avatar-action"))
    .toBe("Idle");
  const positionAfterForward = String(
    await canvas.getAttribute("data-user-position"),
  )
    .split(",")
    .map(Number);
  const heading = Number(
    await canvas.getAttribute("data-controlled-avatar-heading"),
  );
  const movementX = positionAfterForward[0] - positionBeforeForward[0];
  const movementZ = positionAfterForward[1] - positionBeforeForward[1];
  expect(Math.hypot(movementX, movementZ)).toBeGreaterThan(0);
  expect(
    movementX * Math.sin(heading) + movementZ * -Math.cos(heading),
  ).toBeGreaterThan(0);

  await canvas.evaluate((element) => {
    Object.defineProperty(element, "requestPointerLock", {
      configurable: true,
      value: () => Promise.reject(new Error("fixture pointer lock rejection")),
    });
  });
  await page.mouse.move(center.x, center.y);
  await page.mouse.down({ button: "right" });
  await expectCanvasPointerLock(false);
  await expect(room).toHaveAttribute("data-mouse-look", "idle");
  await page.mouse.up({ button: "right" });

  await page.screenshot({
    path: `${evidenceDirectory}/repository-floor-pointer-lock.png`,
    fullPage: true,
  });
});

test("lower non-interactive HUD band owns camera capture while chat keeps context menu @pointer-lock-lower", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedConfiguredAvatar(page, "Aaron");
  await restoreFixtureWorld(page);

  const room = page.locator("main.world-room");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-avatar-render-ready", "true", {
    timeout: 30_000,
  });
  expect(
    await page.evaluate(() =>
      Boolean(document.querySelector('canvas[data-scene-id="world-room"]')),
    ),
  ).toBe(true);
  await page.evaluate(() => {
    window.addEventListener("pointerdown", (event) => {
      document.body.dataset.lowerPointerDown = JSON.stringify({
        button: event.button,
        pointerId: event.pointerId,
        prevented: event.defaultPrevented,
        target: (event.target as HTMLElement | null)?.className ?? null,
      });
    });
    window.addEventListener("contextmenu", (event) => {
      document.body.dataset.lowerContextMenuPrevented = String(
        event.defaultPrevented,
      );
    });
  });
  const lowerStatusBounds = await page
    .locator(".world-hud__captions")
    .boundingBox();
  expect(lowerStatusBounds).not.toBeNull();
  if (!lowerStatusBounds) return;
  const lowerStatusPoint = {
    x: lowerStatusBounds.x + lowerStatusBounds.width / 2,
    y: lowerStatusBounds.y + lowerStatusBounds.height / 2,
  };
  expect(
    await page.evaluate(
      ({ x, y }) =>
        document
          .elementFromPoint(x, y)
          ?.closest("input, textarea, select, button, a, form") === null,
      lowerStatusPoint,
    ),
  ).toBe(true);

  const expectPointerLock = async (locked: boolean) =>
    expect
      .poll(
        () =>
          canvas.evaluate((element) => document.pointerLockElement === element),
        { timeout: 15_000 },
      )
      .toBe(locked);

  await page.mouse.move(lowerStatusPoint.x, lowerStatusPoint.y);
  await page.mouse.down({ button: "right" });
  await expect(page.locator("body")).toHaveAttribute(
    "data-lower-pointer-down",
    /"prevented":true/u,
  );
  await expectPointerLock(true);
  await expect(room).toHaveAttribute("data-mouse-look", "active");
  await page.mouse.up({ button: "right" });
  await expectPointerLock(false);
  await expect(page.locator("body")).toHaveAttribute(
    "data-lower-context-menu-prevented",
    "true",
  );

  const composerContextMenuPrevented = await page
    .getByLabel("Message Mr Fluff")
    .evaluate((element) => {
      const event = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        button: 2,
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });
  expect(composerContextMenuPrevented).toBe(false);
  await expect(page.locator("body")).toHaveAttribute(
    "data-lower-context-menu-prevented",
    "false",
  );

  await page.mouse.move(lowerStatusPoint.x, lowerStatusPoint.y);
  await page.mouse.down({ button: "right" });
  await expectPointerLock(true);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expectPointerLock(false);
  await page.mouse.up({ button: "right" });

  await page.mouse.move(lowerStatusPoint.x, lowerStatusPoint.y);
  await page.mouse.down({ button: "right" });
  await expectPointerLock(true);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expectPointerLock(false);
  await page.mouse.up({ button: "right" });
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await page.mouse.move(lowerStatusPoint.x, lowerStatusPoint.y);
  await page.mouse.down({ button: "right" });
  await expectPointerLock(true);
  await page.keyboard.press("Escape");
  await expectPointerLock(false);
  await page.mouse.up({ button: "right" });

  await page.mouse.move(lowerStatusPoint.x, lowerStatusPoint.y);
  await page.mouse.down({ button: "right" });
  await expectPointerLock(true);
  await page.evaluate(() => {
    const pointerId = Number(
      JSON.parse(document.body.dataset.lowerPointerDown ?? "{}").pointerId,
    );
    window.dispatchEvent(
      new PointerEvent("pointercancel", { bubbles: true, pointerId }),
    );
  });
  await expectPointerLock(false);
  await page.mouse.up({ button: "right" });

  await canvas.evaluate((element) => {
    Object.defineProperty(element, "requestPointerLock", {
      configurable: true,
      value: () => Promise.reject(new Error("fixture pointer lock rejection")),
    });
  });
  await page.mouse.move(lowerStatusPoint.x, lowerStatusPoint.y);
  await page.mouse.down({ button: "right" });
  await expectPointerLock(false);
  await expect(room).toHaveAttribute("data-mouse-look", "idle");
  await page.mouse.up({ button: "right" });
});

const repositoryCityCorrectionTitle =
  "repository city correction keeps loading local, restores source materials, and moves by both paths";

traceTest(repositoryCityCorrectionTitle, async ({ page }) => {
  // The full-page evidence capture follows all semantic and movement checks.
  // Software WebGL on GitHub's two-CPU runner can spend more than six minutes
  // reaching that final capture without changing the asserted behavior.
  traceTest.setTimeout(720_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await seedConfiguredAvatar(page, "Aaron");

  type MovementFixture = {
    readonly actionId: string;
    readonly source: "user-directed" | "agent-autonomous";
    readonly target:
      | {
          readonly kind: "relative";
          readonly direction: "left";
          readonly distance: 5;
        }
      | { readonly kind: "follow-user"; readonly stoppingRadius: 1.5 };
  };
  let movement: MovementFixture | null = null;
  const streamedMessages: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const largeSnapshot = {
    ...snapshot,
    objects: [
      ...snapshot.objects,
      ...Array.from({ length: 120 }, (_, offset) => {
        const id = (offset + 12).toString(16).padStart(32, "0");
        return {
          kind: "file" as const,
          id,
          ref: ref(id),
          name: `large-repository-${offset}.ts`,
          parentRef: ref("2"),
          childRefs: [],
          path: `src/large-repository-${offset}.ts`,
          size: 1_024 + offset,
          fileKind: "source" as const,
          language: "typescript",
          contentHash: offset.toString(16).padStart(64, "0"),
          pathHistory: [],
          position: { x: offset % 20, y: 0, z: Math.floor(offset / 20) },
          bounds: {
            x: offset % 20,
            z: Math.floor(offset / 20),
            width: 1,
            depth: 1,
          },
        };
      }),
    ],
  };
  const activateMovement = (
    source: MovementFixture["source"],
    target: MovementFixture["target"],
  ) => {
    movement = {
      actionId:
        source === "user-directed"
          ? "66666666-6666-4666-8666-666666666666"
          : "77777777-7777-4777-8777-777777777777",
      source,
      target,
    };
  };
  await installWorldFixtures(page, {
    restoreStatus: true,
    snapshot: largeSnapshot,
    fulfillStream: async (route, requestText, userDisplayName) => {
      streamedMessages.push(requestText);
      if (requestText.trim().toLocaleLowerCase() === "follow me")
        activateMovement("agent-autonomous", {
          kind: "follow-user",
          stoppingRadius: 1.5,
        });
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: streamBody(requestText, userDisplayName),
      });
    },
    fulfillWorldActions: async (route, pathname) => {
      const request = route.request();
      if (pathname.endsWith("/proposals") && request.method() === "POST") {
        const body = request.postDataJSON() as {
          readonly actions?: readonly {
            readonly source?: unknown;
            readonly target?: unknown;
          }[];
        };
        const action = body.actions?.[0];
        expect(action?.source).toBe("user-directed");
        expect(action?.target).toEqual({
          kind: "relative",
          direction: "left",
          distance: 5,
        });
        activateMovement("user-directed", {
          kind: "relative",
          direction: "left",
          distance: 5,
        });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{}",
        });
        return;
      }
      if (request.method() === "GET") {
        const active = movement;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            active
              ? {
                  capability: { enabled: true },
                  actions: [
                    {
                      actionId: active.actionId,
                      kind: "move-agent",
                      state: "path-planned",
                      reason: active.source,
                    },
                  ],
                  executions: [
                    {
                      accepted: true,
                      envelope: {
                        schema: "aiw.world-action/0.13",
                        requestId: "22222222-2222-4222-8222-222222222222",
                        batchId: "33333333-3333-4333-8333-333333333333",
                        sessionId: session.sessionId,
                        adapterSessionRef: session.adapterSessionRef,
                        repositoryRef: "aiw://object/repository-a",
                        worldGeneration: "world-a",
                        layoutGeneration: "layout-a",
                        graphGeneration: null,
                        capabilitySnapshotHash: "a".repeat(64),
                        sequence: active.source === "user-directed" ? 1 : 2,
                        createdAt: new Date(Date.now() - 1_000).toISOString(),
                        expiresAt: new Date(Date.now() + 30_000).toISOString(),
                        actions: [
                          {
                            kind: "move-agent",
                            schema: "aiw.agent-movement/1",
                            actionId: active.actionId,
                            actorId: session.sessionId,
                            source: active.source,
                            speed: 4,
                            target: active.target,
                          },
                        ],
                      },
                    },
                  ],
                }
              : {
                  capability: { enabled: true },
                  actions: [],
                  executions: [],
                },
          ),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    },
  });
  await enterFixtureWorld(page);

  const room = page.locator("main.world-room");
  const composer = page.getByLabel("Message Mr Fluff");
  const repositoryTranscript = page.getByRole("log", {
    name: "Conversation and activity",
  });
  await expect(room).toHaveAttribute("data-floor-state", "blank");
  await composer.fill("/repo load MelaBuilt-AI/agentclutch");
  await composer.press("Enter");
  await expect(repositoryTranscript).toContainText(
    "You/repo load MelaBuilt-AI/agentclutch",
    { timeout: 30_000 },
  );
  await expect(room).toHaveAttribute("data-floor-state", "repository", {
    timeout: 60_000,
  });
  await expect(room).toHaveAttribute("data-repository-readiness", "ready", {
    timeout: 60_000,
  });
  await expect(page.locator("#root")).toBeVisible();
  await expect(room).toBeVisible();
  expect(pageErrors).toEqual([]);
  expect(streamedMessages).toEqual([]);
  await expect(repositoryTranscript).toContainText(
    "Repository loaded locally · Current · 2 packages · 2 directories · 125 files",
  );
  await expect(repositoryTranscript).not.toContainText(
    "repository loading is unavailable",
  );

  const canvas = page.locator('canvas[data-floor-state="repository"]');
  await expect(canvas).toHaveAttribute("data-avatar-render-ready", "true", {
    timeout: 30_000,
  });
  await page.waitForTimeout(1_250);
  const evidenceDirectory =
    process.env.AIW_REPOSITORY_CITY_BROWSER_OUTPUT ??
    "/tmp/aiw-repository-city-browser-proof";
  mkdirSync(evidenceDirectory, { recursive: true });
  await page.screenshot({
    path: resolve(evidenceDirectory, "repository-city-idle-materials.png"),
    fullPage: true,
  });

  const position = async () => ({
    x: Number(await room.getAttribute("data-agent-position-x")),
    z: Number(await room.getAttribute("data-agent-position-z")),
  });
  const directBefore = await position();
  await composer.fill("/agent move left 5");
  await composer.press("Enter");
  await expect(room).toHaveAttribute("data-agent-movement-state", "moving", {
    timeout: 30_000,
  });
  await expect
    .poll(
      async () => {
        const current = await position();
        return Math.hypot(
          current.x - directBefore.x,
          current.z - directBefore.z,
        );
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0.2);
  const directAfter = await position();
  expect(streamedMessages).toEqual([]);
  await expect(room).toHaveAttribute("data-agent-movement-state", "idle", {
    timeout: 15_000,
  });

  movement = null;
  const followBefore = await position();
  await composer.fill("follow me");
  await composer.press("Enter");
  await expect
    .poll(() => streamedMessages, { timeout: 30_000 })
    .toEqual(["follow me"]);
  await expect
    .poll(
      async () => {
        const current = await position();
        return Math.hypot(
          current.x - followBefore.x,
          current.z - followBefore.z,
        );
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0.2);
  const followAfter = await position();

  writeFileSync(
    resolve(evidenceDirectory, "movement-proof.json"),
    JSON.stringify(
      {
        schema: "aiw.repository-city-correction-browser-proof/1",
        repositoryLoadStreamRequests: 0,
        direct: { before: directBefore, after: directAfter },
        follow: { before: followBefore, after: followAfter },
        streamedMessages,
      },
      null,
      2,
    ) + "\n",
  );
  expect(pageErrors).toEqual([]);
});

test("no-WebGL semantic state completes the same repository-floor journey", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => null,
    });
  });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await completeJourney(page, "no-webgl");
  await expect(page.locator('[data-renderer="semantic"]')).toBeVisible();
  await expect(
    page.getByText("WorldEntryExperience.tsx", { exact: false }),
  ).toBeVisible();
  const room = page.locator("main.world-room");
  await expect(room).toHaveAttribute("data-repository-readiness", "ready");
  const cityCount = Number(
    await room.getAttribute("data-repository-city-count"),
  );
  await page.getByRole("button", { name: "Director" }).click();
  await page.getByLabel("Search assets").fill("deployment");
  await expect(page.locator(".repository-assets__card")).toHaveCount(1);
  await page.getByRole("button", { name: "Place on grid" }).click();
  await expect(room).toHaveAttribute(
    "data-repository-city-count",
    String(cityCount + 1),
  );
  const inspector = page.getByRole("region", { name: "Asset Inspector" });
  await expect(inspector).toContainText("Deployment Portal");
  await inspector.getByRole("button", { name: "Unpin" }).click();
  await inspector.getByRole("button", { name: "Pin", exact: true }).click();
  await inspector.getByRole("button", { name: "Ask Agent to Explain" }).click();
  await expect(page.getByLabel("Message Mr Fluff")).toHaveValue(
    "@Mr Fluff Explain that this Director placement has no linked repository item. Do not invent a path or code role. Then explain the Deployment Portal (26-deployment-portal) visual metaphor.",
  );
  await page.screenshot({
    path: `${evidenceDirectory}/repository-city-director.png`,
  });
  await inspector.getByRole("button", { name: "Remove" }).click();
  await expect(room).toHaveAttribute(
    "data-repository-city-count",
    String(cityCount),
  );
  await page.getByLabel("Search assets").fill("code slab");
  await page.locator(".repository-assets__card").dragTo(room, {
    targetPosition: { x: 760, y: 260 },
  });
  await expect(room).toHaveAttribute(
    "data-repository-city-count",
    String(cityCount + 1),
  );
  await expect(inspector).toContainText("Code Slab");
  await inspector.getByRole("button", { name: "Remove" }).click();
  await expect(room).toHaveAttribute(
    "data-repository-city-count",
    String(cityCount),
  );
});

test("fixture addressing follows a second selected avatar name", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await completeJourney(page, "fixture-name", "Riley");
  await expect(
    page.getByRole("log", { name: "Conversation and activity" }),
  ).toContainText(
    "Mr Fluff[fixture] Hello Riley — Mr Fluff is here and ready.",
  );
});

test("normal entry never exposes the internal dashboard", async ({ page }) => {
  await seedConfiguredAvatar(page, "Mela");
  await page.goto("/");
  await expect(page.locator(".world-entry-logo")).toBeVisible();
  await expect(page.getByText(/diagnostics|evidence|recovery/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agents" })).toHaveCount(0);
});
