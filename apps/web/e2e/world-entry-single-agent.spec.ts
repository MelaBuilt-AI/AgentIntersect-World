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

const evidenceDirectory = resolve(
  process.env.AIW_PHASE18_EVIDENCE_DIR ?? "artifacts/phase18",
);
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

function streamBody(
  requestText: string,
  userDisplayName: string,
  toolMetadata: Record<string, string> = {},
) {
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
      ...toolMetadata,
    }),
    worldEvent(4, "tool.completed", {
      toolName: repository ? "repository.index" : "terminal.status",
      ...toolMetadata,
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

async function enterFixtureWorld(
  page: Page,
  path = "/",
  displayName = "Mr Fluff",
) {
  await page.goto(path);
  await page.getByRole("button", { name: /Single Agent/ }).click();
  await page.getByRole("button", { name: "Connect hermes" }).click();
  await page.getByLabel("Agent name").fill("Mr Fluff");
  await page.getByRole("button", { name: "Connect agent" }).click();
  await expect(
    page.getByRole("region", { name: "Agent avatar selection" }),
  ).toBeVisible();
  await page.getByLabel("Agent name", { exact: true }).fill(displayName);
  await page
    .getByRole("button", { name: "Open Cat Agent 1 3D preview", exact: true })
    .click();
  await expect(
    page
      .getByTestId("avatar-preview")
      .locator(
        '.imported-avatar-canvas[data-avatar-imported-id="cat-agent-01"]',
      ),
  ).toHaveAttribute("data-avatar-render-ready", "true", { timeout: 60_000 });
  const acceptAvatar = page.getByRole("button", {
    name: "Accept Agent Avatar",
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
  await expect(page.locator(".world-room")).toHaveAttribute(
    "data-scene-ready",
    "true",
    { timeout: 60_000 },
  );
}

test("@avatar-stability cold previews and selection preserve thumbnail positions", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/*.glb", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Create Avatar" }).click();
  const cards = page.locator(
    ".avatar-onboarding__choices .imported-avatar-option",
  );
  await expect(cards).toHaveCount(6);
  const boxes = () =>
    cards.evaluateAll((elements) =>
      elements.map((e) => {
        const r = e.querySelector("img")!.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height];
      }),
    );
  const before = await boxes();
  release();
  await expect(page.locator(".imported-avatar-canvas")).toHaveAttribute(
    "data-avatar-render-ready",
    "true",
    { timeout: 60_000 },
  );
  expect(await boxes()).toEqual(before);
  for (const index of [1, 4, 2, 0]) {
    await cards.nth(index).click();
    expect(await boxes()).toEqual(before);
    await expect(page.locator(".imported-avatar-canvas")).toHaveAttribute(
      "data-avatar-render-ready",
      "true",
      { timeout: 60_000 },
    );
    expect(await boxes()).toEqual(before);
  }
});

test("@avatar-onboarding minimal user and agent selection, Idle previews and rain bezels", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await installWorldFixtures(page, { restoreStatus: true });
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Create Avatar" }).click();
  const builder = page.locator(".avatar-builder--onboarding");
  const preview = builder.locator(".imported-avatar-canvas");
  const expectContainedThumbnails = async () => {
    await expect
      .poll(() =>
        builder.locator(".imported-avatar-option").evaluateAll((cards) =>
          cards.every((card) => {
            const image = card.querySelector("img")!;
            const a = card.getBoundingClientRect(),
              b = image.getBoundingClientRect();
            return (
              b.width > 10 &&
              b.height > 10 &&
              b.left >= a.left &&
              b.right <= a.right &&
              b.top >= a.top &&
              b.bottom <= a.bottom
            );
          }),
        ),
      )
      .toBe(true);
  };
  const verifySelection = async (
    role: "user" | "agent",
    card: string,
    id: string,
    count: number,
  ) => {
    await expect(builder.locator("input")).toHaveCount(1);
    await expect(builder.locator("button")).toHaveCount(count + 1);
    await expect(
      builder.locator("select, input[type=checkbox], h1, h2, figcaption"),
    ).toHaveCount(0);
    await builder
      .getByRole("button", { name: `Open ${card} 3D preview`, exact: true })
      .click();
    await expect(preview).toHaveAttribute("data-avatar-imported-id", id);
    await expect(preview).toHaveAttribute("data-avatar-render-ready", "true", {
      timeout: 60_000,
    });
    const { importedAvatarAsset } =
      await import("@agentintersect-world/avatar-system/imported-avatar");
    await expect(preview).toHaveAttribute(
      "data-avatar-clip-index",
      String(importedAvatarAsset(id)!.semanticClips.Idle.clipIndex),
    );
    const label =
      role === "user" ? "Accept user Avatar" : "Accept Agent Avatar";
    await expect(builder.locator(".avatar-onboarding__choices")).toHaveText(
      label,
    );
    const geometry = await builder.evaluate((element) => {
      const choices = element.querySelector(".avatar-onboarding__choices")!;
      const preview = element.querySelector(".avatar-builder__preview")!;
      const a = choices.getBoundingClientRect(),
        b = preview.getBoundingClientRect();
      const style = getComputedStyle(choices, "::before");
      return {
        leftRight: a.right <= b.left,
        right: b.right,
        rain: style.backgroundImage,
        animation: style.animationName,
      };
    });
    expect(geometry.leftRight).toBe(true);
    expect(geometry.right).toBeLessThanOrEqual(1440);
    expect(geometry.rain).toContain("02_terminal_rain.webp");
    expect(geometry.animation).toBe("avatar-onboarding-rain");
    await expectContainedThumbnails();
    await expect(page.locator(".world-audio")).toBeHidden();
    const first = await preview.screenshot();
    await expect
      .poll(async () => (await preview.screenshot()).equals(first), {
        timeout: 10_000,
      })
      .toBe(false);
    await page.screenshot({
      path: testInfo.outputPath(`${role}-onboarding-desktop.png`),
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect
      .poll(() =>
        builder
          .locator(".avatar-onboarding__choices")
          .evaluate(
            (element) => getComputedStyle(element, "::before").animationName,
          ),
      )
      .toBe("none");
    await page.setViewportSize({ width: 390, height: 844 });
    await expectContainedThumbnails();
    await expect
      .poll(() =>
        builder.evaluate(
          (element) =>
            element.getBoundingClientRect().right <= innerWidth &&
            element.scrollWidth <= element.clientWidth + 1,
        ),
      )
      .toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`${role}-onboarding-portrait.png`),
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
  };
  await expect(
    builder.getByRole("button", { name: "Accept user Avatar" }),
  ).toBeDisabled();
  await page.getByLabel("User name", { exact: true }).fill("Aaron");
  await verifySelection("user", "User Female 3", "user-female-03", 6);
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("aiw.avatar.profile.0.18.5")),
    )
    .toBe(null);
  await builder.getByRole("button", { name: "Accept user Avatar" }).click();
  await page.getByRole("button", { name: /Single Agent/ }).click();
  await page.getByRole("button", { name: "Connect hermes" }).click();
  await page.getByLabel("Agent name", { exact: true }).fill("Mr Fluff");
  await page.getByRole("button", { name: "Connect agent" }).click();
  await verifySelection("agent", "Dog Agent 5", "dog-agent-05", 17);
  await expect(page.getByRole("button", { name: "Enter World" })).toHaveCount(
    0,
  );
  await builder.getByRole("button", { name: "Accept Agent Avatar" }).click();
  await expect(page.getByRole("button", { name: "Enter World" })).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Enter World" }).click();
  const canvas = page.locator(".world-room canvas");
  await expect(page.locator(".world-room")).toHaveAttribute(
    "data-scene-ready",
    "true",
    { timeout: 60_000 },
  );
  await expect(canvas).toHaveAttribute("data-avatar-arrival", "waiting");
  await page.screenshot({
    path: testInfo.outputPath("arrival-environment.png"),
  });
  await expect(canvas).toHaveAttribute("data-avatar-arrival", "materializing");
  await expect
    .poll(async () =>
      Number(await canvas.getAttribute("data-avatar-arrival-progress")),
    )
    .toBeGreaterThan(0.35);
  await page.screenshot({
    path: testInfo.outputPath("arrival-materializing.png"),
  });
  await expect(canvas).toHaveAttribute("data-avatar-arrival", "complete", {
    timeout: 15_000,
  });
  await page.screenshot({ path: testInfo.outputPath("arrival-complete.png") });
  expect(errors).toEqual([]);
});

for (const loading of ["loaded", "stalled"] as const) {
  test(`@world-entry-transition ${loading} textures gate the first visible World`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedConfiguredAvatar(page, "Aaron");
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await installWorldFixtures(page, { restoreStatus: true });
    await page.route(
      "**/assets/code-world/15_code_nebula_sky.webp",
      async (route) => {
        await held;
        await route.continue();
      },
    );
    const entering = enterFixtureWorld(page);
    try {
      const transition = page.locator(".world-entry-transition");
      await expect(transition).toBeVisible({ timeout: 60_000 });
      await expect(transition).toHaveAttribute("data-ready", "false");
      await expect(page.locator(".world-room")).toHaveAttribute(
        "data-scene-ready",
        "false",
      );
      await page.screenshot({ path: testInfo.outputPath("entry-waiting.png") });
      if (loading === "stalled") {
        await page
          .getByRole("button", { name: "Continue in text-only view" })
          .click({ timeout: 15_000 });
        await expect(page.locator(".world-room")).toHaveAttribute(
          "data-renderer",
          "semantic",
        );
      } else release();
      await entering;
      await expect(transition).not.toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("entry-revealed.png"),
      });
    } finally {
      release();
      await entering.catch(() => undefined);
    }
  });
}

test("@audio-pass1 plays the real supplied album and local playlist through the normal World player", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const { instrumentAudio, exerciseAudio } = await import("./world-audio.js");
  await instrumentAudio(page);
  await page.addInitScript(() =>
    localStorage.setItem("aiw.audio.music-muted", "true"),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedConfiguredAvatar(page, "Aaron");
  await installWorldFixtures(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Expand audio player" }).click();
  const player = page.getByRole("complementary", {
    name: "World audio player",
  });
  await expect(player).toContainText("Black Circuit");
  await expect(
    player.getByRole("button", { name: "Mute music", exact: true }),
  ).toBeVisible();
  const play = player.getByRole("button", { name: "Play music", exact: true });
  if (await play.isVisible()) await play.click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const all = (
          window as unknown as { __worldAudioElements: HTMLAudioElement[] }
        ).__worldAudioElements;
        return (
          all.some(
            (a) =>
              a.src.includes("00-black-circuit") &&
              a.loop &&
              a.currentTime > 0.2,
          ) ||
          JSON.stringify(
            all.map((a) => ({
              src: a.src,
              paused: a.paused,
              loop: a.loop,
              time: a.currentTime,
              duration: a.duration,
              ready: a.readyState,
              error: a.error?.message,
            })),
          )
        );
      }),
    )
    .toBe(true);
  await enterFixtureWorld(page);
  try {
    const { openCodeWheel } = await import("./world-code-wheel.js");
    const projectionCues = () =>
      page.evaluate(() =>
        (
          window as unknown as {
            __worldAudioEvents: { src: string; event: string }[];
          }
        ).__worldAudioEvents
          .filter(
            (e) => e.event === "requested" && /projection-(on|off)/.test(e.src),
          )
          .map((e) => e.src),
      );
    const beforeWheel = (await projectionCues()).length;
    await openCodeWheel(page);
    await expect.poll(projectionCues).toHaveLength(beforeWheel + 1);
    expect((await projectionCues()).at(-1)).toContain("projection-on");
    // A real middle click inside the wheel dismisses via its own portal handler,
    // not the room's synthetic pointer path.
    const closePoint = await page
      .getByRole("button", { name: "All agents", exact: true })
      .evaluate((element) => {
        const box = element.getBoundingClientRect();
        const x = box.x + box.width / 2,
          y = box.y + box.height / 2;
        if (!element.contains(document.elementFromPoint(x, y)))
          throw Error("Code Wheel center is obstructed");
        return { x, y };
      });
    await page.mouse.click(closePoint.x, closePoint.y, { button: "middle" });
    await expect(
      page.getByRole("group", { name: "Code Wheel", exact: true }),
    ).toHaveCount(0);
    await expect.poll(projectionCues).toHaveLength(beforeWheel + 2);
    expect((await projectionCues()).at(-1)).toContain("projection-off");
    await exerciseAudio(page, testInfo);
  } finally {
    await testInfo.attach("media-state", {
      contentType: "application/json",
      body: JSON.stringify(
        await page.evaluate(() =>
          (
            window as unknown as { __worldAudioElements: HTMLAudioElement[] }
          ).__worldAudioElements.map((a) => ({
            src: a.src,
            paused: a.paused,
            time: a.currentTime,
            duration: a.duration,
            readyState: a.readyState,
            error: a.error?.message,
          })),
        ),
      ),
    });
  }
});

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
  await expect(intake).toContainText("Saved project library");
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

for (const source of ["clone", "open", "create"] as const) {
  test(`@repository-loading holds the animated indicator through ${source}, indexing and rendered city`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedConfiguredAvatar(page, "Aaron");
    await installWorldFixtures(page, { repositoryProjects: [] });
    let releaseOperation!: () => void;
    let releaseIndex!: () => void;
    let releaseModels!: () => void;
    const operationGate = new Promise<void>((resolve) => {
      releaseOperation = resolve;
    });
    const indexGate = new Promise<void>((resolve) => {
      releaseIndex = resolve;
    });
    const modelGate = new Promise<void>((resolve) => {
      releaseModels = resolve;
    });
    let indexStarted = false;
    let modelStarted = false;
    await page.route(`**/api/repository-intake/${source}`, async (route) => {
      await operationGate;
      await route.fulfill({
        json: envelope({
          project: {
            id: "loading-test",
            name: "Loading test",
            rootPath: "/tmp/loading-test",
            source:
              source === "clone"
                ? "github"
                : source === "create"
                  ? "created"
                  : "local",
            pinned: false,
            lastOpenedAt: "2026-09-17T12:00:00.000Z",
          },
        }),
      });
    });
    await page.route("**/api/repository-indexes", async (route) => {
      indexStarted = true;
      await indexGate;
      await route.fallback();
    });
    await page.route("**/assets/repository-city/*.glb", async (route) => {
      modelStarted = true;
      await modelGate;
      await route.continue();
    });
    try {
      await enterFixtureWorld(page);
      const { openCodeWheel } = await import("./world-code-wheel.js");
      await openCodeWheel(page);
      await page
        .getByRole("button", { name: "Load Repo", exact: true })
        .click();
      const intake = page.getByRole("dialog", { name: "Repository Intake_" });
      if (source === "clone") {
        await intake
          .getByLabel("GitHub repository", { exact: true })
          .fill("netbox-community/netbox");
        await intake
          .getByLabel("Clone destination", { exact: true })
          .fill("/tmp");
        await intake
          .getByLabel("Folder Name to Create", { exact: true })
          .fill("loading-test");
        await intake
          .getByRole("button", { name: "Clone GitHub", exact: true })
          .click();
      } else if (source === "create") {
        await intake
          .getByLabel("Project parent folder", { exact: true })
          .fill("/tmp");
        await intake
          .getByLabel("Project name", { exact: true })
          .fill("loading-test");
        await intake
          .getByRole("button", { name: "Create new", exact: true })
          .click();
      } else {
        await intake
          .getByLabel("Local repository path", { exact: true })
          .fill("/tmp/loading-test");
        await intake
          .getByRole("button", { name: "Open local", exact: true })
          .click();
      }
      const loading = page.getByRole("status", {
        name: "Loading repository",
        exact: true,
      });
      await expect(loading).toBeVisible();
      const indicator = await loading.elementHandle();
      await expect(loading.locator(".world-type-line")).toHaveAttribute(
        "data-state",
        "complete",
      );
      await expect(loading.locator(".world-type-line")).toContainText(
        "Loading...",
      );
      if (source === "clone") {
        await expect(loading.locator(".terminal-cursor")).toHaveCSS(
          "animation-name",
          /cursor/,
        );
        const artwork = loading.locator("svg");
        await expect(artwork.locator("image")).toHaveCount(1);
        await expect(artwork.locator("mask, clipPath")).toHaveCount(0);
        await expect(artwork.locator("image")).toHaveCSS("transform", "none");
        const trails = artwork.locator(".world-loading-indicator__trail");
        await expect(trails).toHaveCount(12);
        await expect(trails.first()).toHaveCSS(
          "animation-name",
          "world-loader-orbit",
        );
        const frame = async (time: number) => {
          await loading.evaluate((element, t) => {
            for (const animation of element.getAnimations({ subtree: true })) {
              animation.pause();
              animation.currentTime = t;
            }
          }, time);
          return await artwork.screenshot();
        };
        const first = await frame(700);
        const second = await frame(1900);
        expect(first.equals(second)).toBe(false);
        await page.screenshot({
          path: testInfo.outputPath("repository-loading-desktop.png"),
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(artwork).toBeInViewport();
        await expect(loading.locator(".world-type-line")).toBeInViewport();
        await page.screenshot({
          path: testInfo.outputPath("repository-loading-portrait.png"),
        });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect(
          loading.locator(".world-loading-indicator__art"),
        ).toHaveCSS("animation-name", "none");
        await expect(loading.locator(".terminal-cursor")).toHaveCSS(
          "animation-name",
          "none",
        );
      }
      releaseOperation();
      await expect.poll(() => indexStarted).toBe(true);
      await expect(intake).toBeHidden();
      await expect(loading).toBeVisible();
      expect(await indicator!.evaluate((el) => el.isConnected)).toBe(true);
      releaseIndex();
      await expect.poll(() => modelStarted).toBe(true);
      await expect(loading).toBeVisible();
      expect(await indicator!.evaluate((el) => el.isConnected)).toBe(true);
      releaseModels();
      await expect(loading).toHaveCount(0, { timeout: 30_000 });
      await expect(page.locator(".world-experience--room")).toHaveAttribute(
        "data-repository-readiness",
        "ready",
      );
      await expect(page.getByTestId("world-hud")).toContainText(
        "Repository city · ready",
      );
    } finally {
      releaseOperation();
      releaseIndex();
      releaseModels();
    }
  });
}

for (const paths of [
  {
    homePath: "/home/browser-fixture",
    projectsPath: "/home/browser-fixture/projects",
    projectsExists: true,
    separator: "/",
  },
  {
    homePath: "C:\\Users\\Fixture",
    projectsPath: "C:\\Users\\Fixture\\projects",
    projectsExists: false,
    separator: "\\",
  },
]) {
  test(`@github-clone-folder discovers a clone parent and requires a child folder (${paths.separator === "/" ? "posix" : "windows"})`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedConfiguredAvatar(page, "Aaron");
    await installWorldFixtures(page, { repositoryProjects: [] });
    const clones: unknown[] = [];
    let discoveryWrites = 0;
    await page.route("**/api/repository-intake/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("discover-path")) {
        return route.fulfill({
          json: envelope({
            homePath: paths.homePath,
            projectsPath: paths.projectsPath,
            projectsExists: paths.projectsExists,
          }),
        });
      }
      if (path.endsWith("projects-directory")) discoveryWrites++;
      if (path.endsWith("/clone")) {
        const input = route.request().postDataJSON();
        clones.push(input);
        return route.fulfill({
          json: envelope({
            project: {
              id: "clone-test",
              name: input.name,
              rootPath: input.destination,
              source: "github",
              pinned: false,
              lastOpenedAt: "2026-09-17T12:00:00.000Z",
            },
          }),
        });
      }
      return route.fallback();
    });
    await enterFixtureWorld(page);
    const { openCodeWheel } = await import("./world-code-wheel.js");
    await openCodeWheel(page);
    await page.getByRole("button", { name: "Load Repo", exact: true }).click();
    const intake = page.getByRole("dialog", { name: "Repository Intake_" });
    await intake
      .getByRole("button", { name: "Discover path", exact: true })
      .click();
    const parent = intake.getByLabel("Clone destination", { exact: true });
    await expect(parent).toHaveValue(paths.projectsPath);
    expect(discoveryWrites).toBe(0);
    const clone = intake.getByRole("button", {
      name: "Clone GitHub",
      exact: true,
    });
    await intake
      .getByLabel("GitHub repository", { exact: true })
      .fill("https://github.com/netbox-community/netbox");
    await expect(clone).toBeDisabled();
    const folder = intake.getByLabel("Folder Name to Create", { exact: true });
    await expect(folder).toHaveAttribute("required", "");
    for (const invalid of [
      "   ",
      "..",
      "../outside",
      "nested/folder",
      "nested\\folder",
    ]) {
      await folder.fill(invalid);
      await expect(clone).toBeDisabled();
      // Programmatic submission must share the disabled-state predicate.
      await clone.evaluate((button) =>
        button
          .closest("form")!
          .dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true }),
          ),
      );
    }
    expect(clones).toEqual([]);
    await folder.fill(" Clone test ");
    const target = `${paths.projectsPath}${paths.separator}Clone test`;
    await expect(intake).toContainText(`Will clone into: ${target}`);
    // Editable parent, optional trailing separator, and spaces remain supported.
    await parent.fill("");
    await expect(clone).toBeDisabled();
    await parent.fill(`${paths.projectsPath}${paths.separator}`);
    await expect(clone).toBeEnabled();
    await expect(intake).toContainText(`Will clone into: ${target}`);
    await page.screenshot({
      path: testInfo.outputPath("clone-folder-desktop.png"),
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await clone.scrollIntoViewIfNeeded();
    expect(
      await intake.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    await expect(clone).toBeInViewport();
    await page.screenshot({
      path: testInfo.outputPath("clone-folder-portrait.png"),
    });
    expect(clones).toEqual([]);
    await clone.click();
    await expect(intake).toBeHidden();
    expect(clones).toEqual([
      {
        repository: "https://github.com/netbox-community/netbox",
        destination: target,
        name: "Clone test",
      },
    ]);
    await expect(page.getByTestId("world-hud")).toContainText(
      "Repository floor",
    );
  });
}

test("@repository-workbench distinct menus discover paths and continue saved work with explicit Git actions", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
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

  const project = {
    id: "menu-test",
    repositoryId: repository.repositoryId,
    availability: "available",
    savedWorkState: "available",
    workstreams: [
      {
        workstreamId: baseWorkstream.workstreamId,
        title: baseWorkstream.title,
        status: "ready-for-review",
        updatedAt: baseWorkstream.updatedAt,
        branch: baseWorkstream.authority.branch,
        worktreeState: "dirty",
        agentId: agent.agentId,
        nativeSessionId: agent.nativeSessionId,
      },
    ],
    milestones: [
      {
        id: "checkpoint",
        kind: "checkpoint",
        label: "Saved settings",
        occurredAt: baseWorkstream.updatedAt,
        head: "a".repeat(40),
      },
    ],
    name: "Menu Test",
    rootPath: "/home/browser-fixture/projects/menu-test",
    source: "local",
    pinned: false,
    lastOpenedAt: "2026-09-07T00:00:00.000Z",
  };
  let current = {
    ...baseWorkstream,
    revision: 1 as number,
    status: "ready-for-review",
    agent: { ...agent, agentId: "previous-session" },
  };
  const history = () => [current];
  let continued = 0,
    created = 0,
    gitWrites = 0,
    directoryWrites = 0;
  let createdBody: Record<string, unknown> | null = null;
  let gitAttempts = 0;
  let gitReads = 0;
  let gitState = {
    head: "a".repeat(40),
    branch: "workstream/settings",
    upstream: null,
    remotes: ["origin"],
    changes: [{ path: "index.html", status: " M" }],
    commits: [
      {
        sha: "a".repeat(40),
        subject: "Initial website",
        date: "2026-09-07T00:00:00.000Z",
      },
    ],
  };
  const fulfill = (route: Route, data: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope(data)),
    });
  const libraryProjects = [
    ...Array.from({ length: 79 }, (_, index) => ({
      ...project,
      id: `archive-${index}`,
      name: `Archive ${index}`,
      rootPath: `/home/browser-fixture/projects/archive-${index}`,
      pinned: true,
      lastOpenedAt: "2026-09-01T00:00:00.000Z",
      workstreams: [],
      milestones: [],
    })),
    project,
  ];
  let openSequence = 0;
  await installWorldFixtures(page, {
    restoreStatus: true,
    repositoryProjects: libraryProjects,
    fulfillPreviewManager: async (route, path) => {
      await fulfill(
        route,
        path.includes("recipes")
          ? []
          : {
              schema: "aiw.preview-manager/1",
              active: null,
              latestAttempt: null,
              previousVerified: null,
              display: null,
            },
      );
    },
    fulfillWorkstreams: async (route, path) => {
      if (path.endsWith("/history"))
        return fulfill(route, { workstreams: history() });
      if (path.endsWith("/continue")) {
        const body = route.request().postDataJSON();
        expect(body.confirm).toBe(true);
        expect(body.agent.agentId).toBe(session.sessionId);
        continued++;
        current = { ...current, agent, revision: current.revision + 1 };
        return fulfill(route, {
          workstream: current,
          replayed: false,
          previewResume: continued === 1 ? "failed" : "ready",
        });
      }
      if (
        route.request().method() === "POST" &&
        path.endsWith("/workstreams")
      ) {
        created++;
        createdBody = route.request().postDataJSON();
        return fulfill(route, {
          workstream: {
            ...current,
            task: createdBody?.task,
            title: createdBody?.title,
          },
          replayed: false,
        });
      }
      return fulfill(route, current);
    },
  });
  await page.route("**/api/repository-intake/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("discover-path") || path.endsWith("projects-directory")) {
      if (route.request().method() === "POST") {
        expect(route.request().postDataJSON()).toEqual({ confirm: true });
        directoryWrites++;
      }
      return fulfill(route, {
        homePath: "/home/browser-fixture",
        projectsPath: "/home/browser-fixture/projects",
        projectsExists: directoryWrites > 0,
      });
    }
    if (path.endsWith("/open") && route.request().method() === "POST") {
      const opened = libraryProjects.find(
        (entry) => entry.rootPath === route.request().postDataJSON().rootPath,
      )!;
      opened.lastOpenedAt = `2026-09-17T12:00:0${++openSequence}.000Z`;
      return fulfill(route, { project: opened });
    }
    if (path.endsWith("selected")) return fulfill(route, { project });
    if (path.endsWith("/git")) {
      if (route.request().method() === "POST") {
        const input = route.request().postDataJSON();
        expect(input.confirm).toBe(true);
        expect(input.files).toEqual(["index.html"]);
        expect(input.workstreamId).toBe(current.workstreamId);
        if (++gitAttempts === 1) {
          gitState = { ...gitState, head: "d".repeat(40) };
          return route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({
              ok: false,
              error: {
                code: "conflict",
                message: "Review required after a concurrent Git change",
              },
            }),
          });
        }
        gitWrites++;
        gitState = { ...gitState, head: "c".repeat(40), changes: [] };
        return fulfill(route, {
          status: gitState,
          message: "Committed fixture checkpoint. No push performed.",
        });
      }
      gitReads++;
      return fulfill(route, gitState);
    }
    return route.fallback();
  });
  await enterFixtureWorld(page);
  const { openCodeWheel } = await import("./world-code-wheel.js");
  await openCodeWheel(page);
  await page.getByRole("button", { name: "Load Repo", exact: true }).click();
  const intake = page.getByRole("dialog", { name: "Repository Intake_" });
  const projectSelect = intake.getByRole("combobox", {
    name: "Select Project",
    exact: true,
  });
  await expect(projectSelect).toHaveValue(project.id);
  await expect(projectSelect.locator("option")).toHaveCount(80);
  await expect(intake.locator(".saved-project-card")).toHaveCount(1);
  await expect(
    intake.locator(".saved-project-library__last-opened"),
  ).toContainText("Menu Test");
  const libraryOpens: unknown[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/repository-intake/open")
    )
      libraryOpens.push(request.postDataJSON());
  });
  await projectSelect.selectOption("archive-78");
  await expect(intake.locator(".saved-project-card")).toContainText(
    "Archive 78",
  );
  expect(libraryOpens).toHaveLength(0);
  await intake
    .getByRole("button", { name: "Open project", exact: true })
    .click();
  await expect(intake).toBeHidden();
  expect(libraryOpens).toEqual([
    {
      rootPath: "/home/browser-fixture/projects/archive-78",
      name: "Archive 78",
    },
  ]);
  await page.reload();
  // This menu fixture does not persist avatar consent; finish its explicit re-entry gate.
  await expect(
    page.getByRole("region", { name: "Agent avatar selection" }),
  ).toBeVisible();
  await expect(
    page
      .getByTestId("avatar-preview")
      .locator(
        '.imported-avatar-canvas[data-avatar-imported-id="cat-agent-01"]',
      ),
  ).toHaveAttribute("data-avatar-render-ready", "true", { timeout: 60_000 });
  await page
    .getByRole("button", { name: "Accept Agent Avatar", exact: true })
    .click();
  await page.getByRole("button", { name: "Enter World", exact: true }).click();
  await expect(page.getByTestId("world-hud")).toBeVisible();
  await openCodeWheel(page);
  await page.getByRole("button", { name: "Load Repo", exact: true }).click();
  await expect(projectSelect).toHaveValue("archive-78");
  await expect(
    intake.locator(".saved-project-library__last-opened"),
  ).toContainText("Archive 78");
  await page.screenshot({
    path: testInfo.outputPath("compact-project-library.png"),
  });
  await projectSelect.selectOption(project.id);
  await intake
    .getByRole("button", { name: "Discover path", exact: true })
    .click();
  await expect(intake.getByLabel("Local repository path")).toHaveValue(
    "/home/browser-fixture/",
  );
  expect(directoryWrites).toBe(0);
  await intake.getByRole("button", { name: /Create projects folder:/ }).click();
  await expect(intake.getByLabel("Project parent folder")).toHaveValue(
    "/home/browser-fixture/projects",
  );
  await intake.getByLabel("Project name", { exact: true }).fill("my-project");
  await expect(intake).toContainText(
    "/home/browser-fixture/projects/my-project",
  );
  await page.screenshot({ path: testInfo.outputPath("load-repo-desktop.png") });
  await intake
    .getByRole("button", { name: "Open project", exact: true })
    .click();
  await expect(page.locator(".world-experience--room")).toHaveAttribute(
    "data-repository-readiness",
    "ready",
    { timeout: 30_000 },
  );
  await expect(
    page.getByRole("status", { name: "Loading repository", exact: true }),
  ).toHaveCount(0);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openCodeWheel(page);
  await page.getByRole("button", { name: "Workbench", exact: true }).click();
  const workbench = page.getByRole("dialog", { name: "Repository Workbench" });
  await expect(
    workbench.getByRole("heading", { name: "Workbench", exact: true }),
  ).toBeVisible();
  await expect(
    workbench.getByRole("button", { name: "Open current work / World View" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("dialog", { name: "New Workstream", exact: true }),
  ).toHaveCount(0);
  await workbench
    .getByRole("button", { name: /Latest · Build a settings panel/ })
    .click();
  await expect(
    workbench.getByRole("button", { name: "Continue saved work", exact: true }),
  ).toBeDisabled();
  await workbench
    .getByRole("checkbox", { name: /Continue this saved worktree/ })
    .check();
  await workbench
    .getByRole("button", { name: "Continue saved work", exact: true })
    .click();
  await expect(workbench).toContainText(
    "Saved work restored. No coding turn was sent.",
  );
  await expect(workbench).toContainText(
    "Preview could not restart. Open current work / World View to review and retry the approved preview.",
  );
  await page.screenshot({
    path: testInfo.outputPath("continuity-preview-failed.png"),
  });
  expect(continued).toBe(1);
  expect(created).toBe(0);
  await workbench
    .getByRole("checkbox", { name: /Continue this saved worktree/ })
    .check();
  await workbench
    .getByRole("button", { name: "Continue saved work", exact: true })
    .click();
  await expect(workbench).toHaveCount(0);
  const restoredWork = page.locator(".world-workstream-status");
  await expect(restoredWork).toContainText(
    "Approved preview restarted and is ready.",
  );
  await expect(restoredWork).not.toContainText("Preview could not restart.");
  await expect(
    restoredWork
      .getByRole("status")
      .filter({ hasText: "Saved work restored." }),
  ).toBeInViewport();
  await expect(
    restoredWork.getByRole("region", { name: "Work Inspector", exact: true }),
  ).toHaveCount(0);
  expect(continued).toBe(2);
  expect(created).toBe(0);
  await page.screenshot({
    path: testInfo.outputPath("continuity-preview-ready.png"),
  });
  await openCodeWheel(page);
  await page.getByRole("button", { name: "Load Repo", exact: true }).click();
  await expect(intake).toContainText("Saved project library");
  await expect(intake).toContainText("workstream/settings · dirty");
  await intake.getByText("Work and Git milestones (1)").click();
  await expect(intake).toContainText("Saved settings");
  const resume = intake.getByRole("button", {
    name: "Resume saved work",
    exact: true,
  });
  await expect(resume).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("project-library-portrait.png"),
  });
  expect(
    await intake.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await intake
    .getByRole("checkbox", {
      name: "Resume this saved worktree and conversation without a coding turn",
    })
    .check();
  const accepted = {
    ...proposal,
    avatarSource: {
      kind: "imported",
      version: 2,
      mode: "original",
      modelId: "cat-agent-01",
    },
  };
  await page.route(
    `**/api/agent-sessions/${session.sessionId}/history`,
    (route) =>
      fulfill(route, {
        sessionId: session.sessionId,
        continuity: "current",
        messages: [{ role: "user", text: "Keep my unfinished settings" }],
        transcriptAuthority: "hermes",
        avatarConsent: { state: "accepted", current: accepted, previous: null },
      }),
  );
  await page.route(
    `**/api/agent-sessions/${session.sessionId}/avatar-proposal`,
    (route) => fulfill(route, accepted),
  );
  const codingRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /\/stream$/.test(new URL(request.url()).pathname)
    )
      codingRequests.push(request.url());
  });
  await page.screenshot({
    path: testInfo.outputPath("project-library-desktop.png"),
  });
  await resume.click();
  await expect(intake).toHaveCount(0);
  expect(continued).toBe(3);
  await expect(
    page.getByRole("log", { name: "Conversation and activity" }),
  ).toContainText("Keep my unfinished settings");
  expect(created).toBe(0);
  expect(codingRequests).toEqual([]);

  await openCodeWheel(page);
  await page.getByRole("button", { name: "Workbench", exact: true }).click();
  await workbench
    .getByRole("button", { name: /Latest · Build a settings panel/ })
    .click();
  await expect(
    workbench.getByRole("button", { name: "Open current work / World View" }),
  ).toBeEnabled();
  await workbench.getByRole("checkbox", { name: /index.html/ }).check();
  await workbench.getByLabel("Commit message").fill("feat: saved website");
  await workbench.getByRole("button", { name: /Review commit/ }).click();
  expect(gitWrites).toBe(0);
  const readsBeforeFailure = gitReads;
  await workbench
    .getByRole("button", { name: "Confirm commit", exact: true })
    .click();
  await expect.poll(() => gitReads).toBeGreaterThan(readsBeforeFailure);
  await expect(
    workbench.getByText("dddddddddddd", { exact: true }),
  ).toBeVisible();
  await expect(workbench.getByRole("alert")).toContainText(
    "Review required after a concurrent Git change",
  );
  expect(gitWrites).toBe(0);
  await workbench.getByRole("button", { name: /Review commit/ }).click();
  await workbench
    .getByRole("button", { name: "Confirm commit", exact: true })
    .click();
  await expect(workbench).toContainText(
    "Committed fixture checkpoint. No push performed.",
  );
  expect(gitWrites).toBe(1);
  await workbench
    .getByRole("heading", { name: "Workbench", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("workbench-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await workbench.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: testInfo.outputPath("workbench-portrait.png"),
  });
  expect(
    await workbench.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("workbench-portrait.png"),
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await workbench.getByRole("button", { name: "Commits", exact: true }).click();
  await workbench
    .getByRole("button", { name: "New Workstream from this commit" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "New Workstream",
    exact: true,
  });
  await expect(workbench).toHaveCount(0);
  await expect(dialog.getByLabel("New Workstream base commit")).toHaveValue(
    "a".repeat(40),
  );
  await dialog
    .getByLabel("New Workstream task")
    .fill("Add the next website page");
  await dialog.getByLabel("New Workstream branch").fill("feature/next-page");
  await expect(
    dialog.getByRole("button", { name: "Start Workstream", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath("new-workstream-desktop.png"),
  });
  await dialog
    .getByRole("checkbox", { name: /Create this isolated worktree/ })
    .check();
  await dialog
    .getByRole("button", { name: "Start Workstream", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(created).toBe(1);
  expect(createdBody).toMatchObject({
    branch: "feature/next-page",
    startPoint: "a".repeat(40),
    prIntent: "draft-pr",
    task: "Add the next website page",
  });
  expect(errors).toEqual([]);
});

test("@workbench-normal drives one Workstream through normal World conversation", async ({
  page,
}, testInfo) => {
  // Includes the full discussion/queue journey and front/back/oblique cloud proofs.
  // The unchanged journey passed locally in 253s and on hosted CI in ~286s;
  // two hosted attempts reached different late actions at the old 300s watchdog.
  // Allow whole-journey runtime headroom; retain every per-assertion deadline.
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
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
  let currentWorkstream: Record<string, unknown> | null = {
    ...baseWorkstream,
    workstreamId: "old-session-workstream",
    status: "blocked",
    agent: {
      ...agent,
      agentId: "old-agent",
      nativeSessionId: "old-root",
      rootNativeSessionId: "old-root",
    },
  };
  const plainFeedback =
    "In this existing website, change only the heading to Fresh Food, Happy People.";
  let finishPlainTurn: (() => void) | undefined;
  let websiteSource: string | null = null;
  let createRequests = 0;
  let iterationRequests = 0;
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
      const intent = route.request().postDataJSON().intent;
      expect(intent).toBe(
        requestText === "hi codex" ||
          requestText === "change the title to food is good"
          ? "discussion"
          : "work",
      );
      if (requestText === plainFeedback) {
        const events = [
          ...baseWorkstream.events,
          {
            eventId: "plain-chat-start",
            status: "working",
            summary: plainFeedback,
            occurredAt: new Date().toISOString(),
          },
        ];
        currentWorkstream = {
          ...baseWorkstream,
          revision: 3,
          status: "working",
          events,
          projection: {
            ...baseWorkstream.projection,
            currentActivity: "Editing settings.tsx",
            activeFile: { path: "settings.tsx", activityId: "file-edit-plain" },
            changedFiles: [
              {
                path: "settings.tsx",
                change: "untracked",
                diffSummary: "?? settings.tsx",
              },
            ],
          },
        };
        await new Promise<void>((resolve) => {
          finishPlainTurn = resolve;
        });
        currentWorkstream = {
          ...currentWorkstream,
          status: "ready-for-review",
          revision: 4,
          events: [
            ...events,
            {
              eventId: "plain-chat-done",
              status: "ready-for-review",
              summary: "Changed settings.tsx. Validation: focused test passed.",
              occurredAt: new Date().toISOString(),
            },
          ],
        };
      }
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: streamBody(requestText, userDisplayName),
      });
    },
    fulfillWorkstreams: async (route, pathname) => {
      const request = route.request();
      if (pathname.endsWith("/source")) {
        const file = new URL(request.url()).searchParams.get("path");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            envelope({
              repositoryRef: repository.repositoryId,
              objectRef:
                file ??
                `aiw://object/workstream-${baseWorkstream.workstreamId}`,
              path: file,
              content: file ? websiteSource : null,
              files: websiteSource
                ? [{ ref: "settings.tsx", path: "settings.tsx" }]
                : [],
              startLine: 1,
              truncated: false,
              message: websiteSource
                ? "Owned Workstream source"
                : "No source files yet.",
            }),
          ),
        });
        return;
      }

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
      if (request.method() === "POST" && pathname.endsWith("/iterations")) {
        iterationRequests += 1;
        const input = request.postDataJSON() as Record<string, unknown>;
        expect(input).toEqual({
          requestId: expect.stringMatching(/^iterate-/u),
          correlationId: expect.any(String),
          expectedRevision: iterationRequests,
          feedback:
            iterationRequests === 1
              ? "change it to use the blue active state"
              : plainFeedback,
          repository,
          agent,
        });
        currentWorkstream = {
          ...baseWorkstream,
          revision: 2,
          updatedAt: "2026-09-03T15:01:00.000Z",
          events: [
            ...baseWorkstream.events,
            {
              eventId: `${baseWorkstream.workstreamId}/event/2`,
              status: "working",
              summary:
                "Iteration requested · change it to use the blue active state",
              occurredAt: "2026-09-03T15:01:00.000Z",
            },
          ],
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
      if (request.method() === "POST" && pathname.endsWith("/cancel")) {
        currentWorkstream = {
          ...baseWorkstream,
          revision: 3,
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

  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-repository-readiness",
    "ready",
    { timeout: 30_000 },
  );
  await expect(
    page.getByRole("complementary", {
      name: "Current Workstream",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-workstream-slab="old-session-workstream"]'),
  ).toHaveCount(0);
  await composer.fill("Build a settings panel");
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeEnabled();
  const [createdWorkstream] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith("/workstreams") &&
        response.request().method() === "POST",
    ),
    composer.press("Enter"),
  ]);
  expect(createdWorkstream.ok()).toBe(true);
  expect(await createdWorkstream.finished()).toBeNull();
  const workstream = page.getByRole("complementary", {
    name: "Current Workstream",
  });
  await expect(workstream).toBeVisible();
  await expect(workstream).toContainText("Workbench · working");
  await expect.poll(() => createRequests).toBe(1);
  expect(streamRequests).toEqual([]);
  const actor = page.locator(".world-room__avatars li[data-roster-id]").first();
  await expect(actor).toHaveAttribute("data-avatar-action", "Run");
  const startX = Number(await actor.getAttribute("data-position-x"));
  await expect
    .poll(async () => Number(await actor.getAttribute("data-position-x")))
    .not.toBe(startX);
  await expect(actor).toHaveAttribute("data-work-state", "coding", {
    timeout: 20000,
  });
  await expect(actor).toHaveAttribute("data-avatar-action", /Dig|Work/);
  await expect(actor).toContainText("Owned worktree is current and ready.");
  const overview = page.getByRole("complementary", {
    name: "Project / Current Work",
    exact: true,
  });
  await expect(overview).toContainText(baseWorkstream.title);
  await expect(overview).toContainText(baseWorkstream.authority.branch);
  await expect(overview.locator(".repository-assets__thumbnail")).toHaveCount(
    0,
  );
  await expect(
    overview.getByRole("region", { name: "Work Inspector" }),
  ).toHaveCount(0);
  // Exercise the Linux fallback even on hosts with Consolas installed.
  await page.addStyleTag({
    content:
      '.project-overview, .project-overview * { font-family: "Liberation Mono", monospace; }',
  });
  await expect
    .poll(() =>
      overview.evaluate((element) => {
        const panel = element.getBoundingClientRect();
        const hint = document
          .querySelector(".agent-setup-escape-hint")!
          .getBoundingClientRect();
        const arrange = element
          .querySelector('[aria-controls="workspace-arrangement"]')!
          .getBoundingClientRect();
        return panel.top > hint.bottom && arrange.bottom <= panel.bottom;
      }),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("project-current-work-desktop.png"),
  });
  await page.screenshot({
    path: testInfo.outputPath("workstream-slab-actor.png"),
  });
  const slab = page.locator(
    `[data-workstream-slab="${baseWorkstream.workstreamId}"]`,
  );
  await expect(slab).toHaveCount(1);
  await slab.focus();
  await slab.press("Enter");
  await expect(
    page.getByRole("region", { name: "Source code viewport" }),
  ).toContainText("No source files yet.");
  websiteSource = "export const settings = true;";
  currentWorkstream = {
    ...currentWorkstream,
    projection: {
      ...baseWorkstream.projection,
      currentActivity: "Writing settings.tsx",
      diff: {
        summary: "Added settings",
        patch: "+export const settings = true;",
        truncated: false,
      },
    },
  };
  await page
    .getByRole("region", { name: "Source code viewport" })
    .getByRole("button", { name: "settings.tsx", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Source code viewport" }),
  ).toContainText("export const settings = true;");
  await expect(actor).toContainText("Writing settings.tsx");
  await page.screenshot({
    path: testInfo.outputPath("workstream-slab-coding.png"),
  });
  await page
    .getByRole("button", { name: "Ask about this", exact: true })
    .click();
  await expect(composer).toHaveValue(/settings\.tsx/);
  await expect(composer).toHaveValue(/workstream\/settings/);
  await expect(composer).toHaveValue(/export const settings = true/);
  expect(streamRequests).toEqual([]);
  expect(createRequests).toBe(1);
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

  await overview
    .getByRole("button", { name: "Open work details", exact: true })
    .click();
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

  await composer.fill("/work change it to use the blue active state");
  const [iterationResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response
          .url()
          .endsWith(`/agent-sessions/${session.sessionId}/stream`) &&
        response.request().method() === "POST",
    ),
    composer.press("Enter"),
  ]);
  expect(iterationResponse.ok()).toBe(true);
  expect(await iterationResponse.finished()).toBeNull();
  await expect
    .poll(() => streamRequests)
    .toEqual(["change it to use the blue active state"]);
  expect(createRequests).toBe(1);
  expect(iterationRequests).toBe(1);
  // This sequential journey waits for the turn to finish; FIFO-in-flight behavior
  // has separate coverage below. A received stream request is not turn completion.
  await expect(
    workstream.getByRole("button", {
      name: "Close Work Inspector",
      exact: true,
    }),
  ).toBeEnabled();

  await composer.fill(`/work ${plainFeedback}`);
  await composer.press("Enter");
  await expect.poll(() => streamRequests.at(-1)).toBe(plainFeedback);
  await expect(actor).toHaveAttribute("data-object-ref", /workstream-file-/);
  await expect(actor).toHaveAttribute("data-work-state", "coding", {
    timeout: 20000,
  });
  await expect(actor).toHaveAttribute("data-avatar-action", /Dig|Work/);
  const bubbleRoom = page.locator(".world-room");
  await page.screenshot({ path: testInfo.outputPath("bubble-near.png") });
  const initialZ = Number(
    await bubbleRoom.getAttribute("data-user-position-z"),
  );
  await bubbleRoom.focus();
  await page.keyboard.down("s");
  try {
    await expect
      .poll(
        async () =>
          Number(await bubbleRoom.getAttribute("data-user-position-z")),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(initialZ + 12);
  } finally {
    await page.keyboard.up("s");
  }
  // Face the agent through ordinary lateral travel, keeping real HUDs visible.
  const agentX = Number(await bubbleRoom.getAttribute("data-agent-position-x"));
  const userX = Number(await bubbleRoom.getAttribute("data-user-position-x"));
  const lateral = agentX < userX ? "a" : "d";
  await page.keyboard.down(lateral);
  try {
    await expect
      .poll(
        async () => {
          const x = Number(
            await bubbleRoom.getAttribute("data-user-position-x"),
          );
          return lateral === "a" ? x <= agentX : x >= agentX;
        },
        { timeout: 20_000 },
      )
      .toBe(true);
  } finally {
    await page.keyboard.up(lateral);
  }
  const readableBubble = page.locator(".world-activity-bubble:visible").first();
  await expect(readableBubble).toBeVisible();
  await (
    await import("./world-activity-cloud.js")
  ).verifyActivityCloud(page, readableBubble, testInfo);
  const bubbleBox = (await readableBubble.boundingBox())!;
  expect(bubbleBox.x).toBeGreaterThanOrEqual(0);
  expect(bubbleBox.y).toBeGreaterThanOrEqual(0);
  expect(bubbleBox.x + bubbleBox.width).toBeLessThanOrEqual(1440);
  expect(bubbleBox.y + bubbleBox.height).toBeLessThanOrEqual(900);
  await page.screenshot({ path: testInfo.outputPath("bubble-far.png") });
  await testInfo.attach("bubble-distance", {
    body: JSON.stringify({
      initialZ,
      farZ: Number(await bubbleRoom.getAttribute("data-user-position-z")),
    }),
    contentType: "application/json",
  });
  await expect(
    page.getByRole("log", { name: "Conversation and activity" }),
  ).toContainText("Starting report");
  expect(createRequests).toBe(1);
  expect(iterationRequests).toBe(2); // only explicit /work resumes coding
  await page.screenshot({
    path: testInfo.outputPath("continued-file-dig.png"),
  });
  await composer.fill("hi codex");
  await composer.press("Enter");
  await expect(
    page.getByText("1 queued · waiting for the current turn", { exact: true }),
  ).toBeVisible();
  expect(streamRequests).not.toContain("hi codex");
  const eventsBeforeDiscussion = (currentWorkstream!.events as unknown[])
    .length;
  await page.screenshot({ path: testInfo.outputPath("discussion-queued.png") });
  finishPlainTurn!();
  await expect.poll(() => streamRequests.at(-1)).toBe("hi codex");
  await expect(
    page.getByText("1 queued · waiting for the current turn", { exact: true }),
  ).toHaveCount(0);
  await expect(workstream).toHaveAttribute(
    "data-workstream-status",
    "ready-for-review",
  );
  await expect(actor).toHaveAttribute("data-avatar-action", "Idle");
  await expect(
    page.getByRole("log", { name: "Conversation and activity" }),
  ).toContainText("Completion report");

  // Imperative wording without /work stays discussion in the same open task.
  await composer.fill("change the title to food is good");
  await composer.press("Enter");
  await expect
    .poll(() => streamRequests.at(-1))
    .toBe("change the title to food is good");
  await expect(page.locator(".world-chat")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  expect(iterationRequests).toBe(2);
  expect((currentWorkstream!.events as unknown[]).length).toBe(
    eventsBeforeDiscussion + 1,
  );
  await expect(
    page.getByRole("log", { name: "Conversation and activity" }),
  ).toContainText("Mr Fluff is here and ready.");
  await page.screenshot({
    path: testInfo.outputPath("discussion-and-reports.png"),
  });
  await composer.fill("cancel current workstream");
  await composer.press("Enter");
  await expect(workstream).toHaveAttribute(
    "data-workstream-status",
    "cancelled",
  );
  await expect(workstream).toContainText("Owned clean worktree removed.");
  await expect(actor).toHaveAttribute("data-work-state", "idle");
  await expect(actor).toHaveAttribute("data-avatar-action", "Idle");
  await expect(slab).toHaveCount(0);
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

for (const screenJourney of [
  "hud",
  "spatial",
  "code",
  "code-overlap",
  "arrangement",
])
  test(
    screenJourney === "arrangement"
      ? "@arrangement-controls @pointer-lock contains selectors and manipulates visual props"
      : screenJourney === "code-overlap"
        ? "@code-screen-overlap stays opaque over a rear screen from multiple positions"
        : screenJourney === "code"
          ? "@repository-code-screen @pointer-lock inspects an object in World and fullscreen"
          : screenJourney === "spatial"
            ? "@spatial-screens toggles and moves three interactive World screens"
            : "@workbench-world-view keeps preview interaction inside the mounted World",
    async ({ page }, testInfo) => {
      // Combined preview, focus, spatial placement and motion proof on software WebGL.
      test.setTimeout(300_000);
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
      const updatedPreview = {
        ...preview,
        previewId: "preview-world-view-iteration",
        revision: 5,
        workstreamRevision: 2,
        port: 45_174,
        pid: 4322,
        url: "http://127.0.0.1:45174/preview-fixture",
        health: {
          ok: true,
          status: 200,
          checkedAt: "2026-09-03T20:02:00.000Z",
        },
        startedAt: "2026-09-03T20:01:30.000Z",
        readyAt: "2026-09-03T20:02:00.000Z",
      } as const;
      const failedPreview = {
        ...updatedPreview,
        previewId: "preview-world-view-failed",
        revision: 6,
        workstreamRevision: 3,
        state: "failed",
        port: 45_175,
        pid: null,
        url: null,
        health: null,
        startedAt: "2026-09-03T20:02:30.000Z",
        readyAt: null,
        stoppedAt: "2026-09-03T20:02:31.000Z",
        portClosed: true,
        error: "Replacement preview failed readiness.",
      } as const;
      const finalPreview = {
        ...updatedPreview,
        previewId: "preview-world-view-final",
        revision: 7,
        workstreamRevision: 3,
        port: 45_176,
        pid: 4323,
        url: "http://127.0.0.1:45176/preview-fixture",
        health: {
          ok: true,
          status: 200,
          checkedAt: "2026-09-03T20:03:00.000Z",
        },
        startedAt: "2026-09-03T20:02:40.000Z",
        readyAt: "2026-09-03T20:03:00.000Z",
      } as const;
      let currentWorkstream: Record<string, unknown> | null = null;
      let previewReady = false;
      let activePreview:
        typeof preview | typeof updatedPreview | typeof finalPreview = preview;
      let latestAttempt:
        | typeof preview
        | typeof updatedPreview
        | typeof failedPreview
        | typeof finalPreview = preview;
      let startRequests = 0;
      let firstStartFailed = false;
      const missingFilePreview = {
        ...failedPreview,
        workstreamRevision: 1,
        logs: "Static preview unavailable: create index.html in the owned Workstream and retry.\n",
      };
      const plainFeedback =
        "In this existing website, change only the homepage heading to Fresh Food, Happy People.";
      const plainPreview = {
        ...finalPreview,
        previewId: "preview-plain-chat",
        revision: 8,
        workstreamRevision: 4,
        url: "http://127.0.0.1:43123/preview-plain-fixture",
      };
      let iterationRequests = 0;
      let latestAttemptFailed = false;
      const browserErrors: string[] = [];
      await page.route("**/preview-plain-fixture", (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<!doctype html><h1>Fresh Food, Happy People</h1>",
        }),
      );
      await page.route("**/preview-fixture", (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: '<!doctype html><label style="position:sticky;top:0">Preview state<input aria-label="Preview state" value="kept"></label><div style="height:2500px;background:linear-gradient(#0369a1,#38bdf8)">Scrollable website</div>',
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
          if (
            request.method() === "GET" &&
            pathname.endsWith("/preview-recipes")
          ) {
            // Reproduce hosted recipe loading outlasting the UI assertion.
            if (screenJourney === "spatial")
              await new Promise((resolve) => setTimeout(resolve, 8_000));
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
                  active: previewReady ? activePreview : null,
                  latestAttempt: previewReady
                    ? latestAttempt
                    : firstStartFailed
                      ? missingFilePreview
                      : null,
                  previousVerified:
                    previewReady && latestAttemptFailed ? activePreview : null,
                  display: previewReady
                    ? {
                        truth: latestAttemptFailed
                          ? "previous-verified"
                          : "current",
                        preview: activePreview,
                      }
                    : null,
                }),
              ),
            });
            return;
          }
          if (request.method() === "POST" && pathname.endsWith("/previews")) {
            if (screenJourney === "hud" && !firstStartFailed) {
              firstStartFailed = true;
              await route.fulfill({
                status: 201,
                contentType: "application/json",
                body: JSON.stringify(
                  envelope({ preview: missingFilePreview, replayed: false }),
                ),
              });
              return;
            }
            startRequests += 1;
            previewReady = true;
            const responsePreview =
              startRequests === 1
                ? preview
                : startRequests === 2
                  ? updatedPreview
                  : startRequests === 3
                    ? failedPreview
                    : startRequests === 4
                      ? finalPreview
                      : plainPreview;
            latestAttempt = responsePreview;
            latestAttemptFailed = responsePreview.state === "failed";
            if (responsePreview.state === "ready")
              activePreview = responsePreview;
            const body = request.postDataJSON() as Record<string, unknown>;
            expect(body).toEqual({
              requestId: expect.any(String),
              correlationId: body.requestId,
              expectedWorkstreamRevision:
                startRequests === 1
                  ? 1
                  : startRequests === 2
                    ? 2
                    : startRequests <= 4
                      ? 3
                      : 4,
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
              body: JSON.stringify(
                envelope({ preview: responsePreview, replayed: false }),
              ),
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
          if (
            request.method() === "POST" &&
            pathname.endsWith("/workstreams")
          ) {
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
          if (request.method() === "POST" && pathname.endsWith("/iterations")) {
            iterationRequests += 1;
            const feedback =
              iterationRequests === 1
                ? "change it to use the blue active state"
                : iterationRequests === 2
                  ? "make the heading larger"
                  : plainFeedback;
            const input = request.postDataJSON() as Record<string, unknown>;
            expect(input).toEqual({
              requestId: expect.stringMatching(/^iterate-/u),
              correlationId: expect.any(String),
              expectedRevision: iterationRequests,
              feedback,
              repository,
              agent,
            });
            currentWorkstream = {
              ...baseWorkstream,
              revision: iterationRequests + 1,
              updatedAt: `2026-09-03T20:0${iterationRequests}:30.000Z`,
              projection: {
                currentActivity: "Validated visual feedback iteration.",
                changedFiles: [
                  {
                    path: "src/App.tsx",
                    change: "modified",
                    diffSummary: "M src/App.tsx",
                  },
                ],
                diff: {
                  summary: "1 file changed",
                  patch: "@@ -1 +1 @@",
                  truncated: false,
                },
                validation: [
                  {
                    command: "pnpm test",
                    exitCode: 0,
                    summary: "Tests passed",
                  },
                ],
                evidenceRefs: [`agent-event:iteration-${iterationRequests}`],
              },
              events: [
                {
                  eventId: `${baseWorkstream.workstreamId}/event/${iterationRequests + 1}`,
                  status: "working",
                  summary: `Iteration requested · ${feedback}`,
                  occurredAt: `2026-09-03T20:0${iterationRequests}:30.000Z`,
                },
              ],
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
          if (request.method() === "POST" && pathname.endsWith("/cancel")) {
            previewReady = false;
            currentWorkstream = {
              ...baseWorkstream,
              revision: 4,
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
          await route.fulfill({
            status: 404,
            body: "workstream fixture missing",
          });
        },
        fulfillStream: async (route, requestText, userDisplayName) => {
          if (requestText === plainFeedback)
            currentWorkstream = {
              ...currentWorkstream,
              revision: 4,
              status: "working",
              events: [
                {
                  eventId: "plain-preview-start",
                  status: "working",
                  summary: plainFeedback,
                  occurredAt: new Date().toISOString(),
                },
              ],
            };
          await new Promise((resolve) => setTimeout(resolve, 250));
          if (currentWorkstream && iterationRequests > 0)
            currentWorkstream = {
              ...currentWorkstream,
              status: "ready-for-review",
              events:
                requestText === plainFeedback
                  ? [
                      ...currentWorkstream.events,
                      {
                        eventId: "plain-preview-complete",
                        status: "ready-for-review",
                        summary:
                          "**Changed files:** `index.html`\n\n**Checks:**\n3 passed, 0 failed.\n- Inline Node.js check: **passed**\n- node --test tests/homepage.test.mjs: **passed**\n- Whitespace check: **passed**\n\nFull details: Workstream Inspector.",
                        occurredAt: new Date().toISOString(),
                      },
                    ]
                  : currentWorkstream.events,
            };
          await route.fulfill({
            status: 200,
            contentType: "text/event-stream",
            body: streamBody(
              requestText,
              userDisplayName,
              requestText === plainFeedback
                ? {
                    repositoryPath: "index.html",
                    activityId: "activity:heading-edit",
                  }
                : {},
            ),
          });
        },
      });
      // Preview readiness must not stand in for the independently loaded city.
      // Hold real city assets until the spatial assertions have started.
      let releaseCityAssets: (() => void) | undefined;
      if (screenJourney === "spatial") {
        const cityAssetsReleased = new Promise<void>((resolve) => {
          releaseCityAssets = resolve;
        });
        await page.route("**/assets/repository-city/**", async (route) => {
          await cityAssetsReleased;
          await route.continue();
        });
      }
      const { instrumentAudio, assertAudioCues } =
        await import("./world-audio.js");
      await instrumentAudio(page);
      await enterFixtureWorld(
        page,
        "/",
        screenJourney === "arrangement" ? "Codex" : "Mr Fluff",
      );

      const recipesResponse = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname.endsWith("/preview-recipes") &&
          response.request().method() === "GET",
      );
      const composer = page.getByLabel(
        screenJourney === "arrangement" ? "Message Codex" : "Message Mr Fluff",
      );
      await composer.fill("Let's pick up work on the Notes App");
      await composer.press("Enter");
      await expect(page.locator("main.world-room")).toHaveAttribute(
        "data-floor-state",
        "repository",
        { timeout: 30_000 },
      );
      // The floor can switch before the repository-load conversation settles.
      await expect(
        page.getByRole("log", { name: "Conversation and activity" }),
      ).toContainText("Repository loaded locally");
      await composer.fill("Build World View");
      await expect(
        page.getByRole("button", { name: "Send", exact: true }),
      ).toBeEnabled();
      await expect(composer).toBeFocused();
      const [createdWorkstream] = await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname.endsWith("/workstreams") &&
            response.request().method() === "POST",
        ),
        page.keyboard.press("Enter"),
      ]);
      expect(createdWorkstream.ok()).toBe(true);
      expect(await createdWorkstream.finished()).toBeNull();
      await expect.poll(() => currentWorkstream).not.toBeNull();

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
      if (screenJourney !== "spatial") {
        // These journeys do not exercise pending city loads. Wait for the
        // renderer's independent startup before starting preview work.
        await expect(page.locator("main.world-room")).toHaveAttribute(
          "data-repository-readiness",
          "ready",
          { timeout: 30_000 },
        );
      }
      // Recipe loading is an independent network boundary, not a disabled
      // Start button. Keep the UI assertion's original budget after it settles.
      const loadedRecipes = await recipesResponse;
      expect(loadedRecipes.ok()).toBe(true);
      expect(await loadedRecipes.finished()).toBeNull();
      const launcher = workstream.getByRole("button", {
        name: "Start World View",
      });
      await expect(launcher).toBeEnabled();
      await expect(launcher).toHaveCSS("background-image", /linear-gradient/iu);
      await launcher.click();
      if (screenJourney === "hud") {
        const retry = workstream.getByRole("button", {
          name: "Retry World View",
          exact: true,
        });
        await expect(retry).toBeEnabled();
        await page.waitForResponse(
          (response) =>
            response.request().method() === "GET" &&
            response.url().includes("/previews/current"),
        );
        await expect(workstream).toContainText(
          "index.html is missing from this Workstream",
        );
        await expect(
          page.getByRole("region", { name: "World View", exact: true }),
        ).toHaveCount(0);
        await page.screenshot({
          path: testInfo.outputPath("first-preview-failure.png"),
        });
        await retry.click();
        await expect(workstream).not.toContainText(
          "index.html is missing from this Workstream",
        );
      }
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
      if (screenJourney === "arrangement") {
        const { exerciseArrangementControls } =
          await import("./world-arrangement-controls.js");
        await exerciseArrangementControls(page, testInfo);
        expect(browserErrors).toEqual([]);
        return;
      }
      if (screenJourney === "hud") {
        const { openCodeWheel } = await import("./world-code-wheel.js");
        await openCodeWheel(page);
        const wheel = page.getByRole("group", {
          name: "Code Wheel",
          exact: true,
        });
        await wheel
          .getByRole("button", { name: "Screens", exact: true })
          .press("Enter");
        const previewToggle = wheel.getByRole("button", {
          name: "World View",
          exact: true,
        });
        await expect(previewToggle).toHaveAttribute("aria-disabled", "false");
        const label = previewToggle.locator("text");
        const point = await label.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const x = box.left + box.width / 2,
            y = box.top + box.height / 2;
          const hit = document.elementFromPoint(x, y);
          return {
            x,
            y,
            reachable: Boolean(hit && element.parentElement?.contains(hit)),
            hit: hit?.tagName,
          };
        });
        await page.screenshot({
          path: testInfo.outputPath("world-view-menu-from-hud.png"),
        });
        expect(point.reachable, JSON.stringify(point)).toBe(true);
        await page.mouse.click(point.x, point.y);
        await expect(
          page.locator('[data-world-screen="preview"]'),
        ).toHaveAttribute("data-screen-mode", "spatial");
        await previewToggle.press("Enter");
        await expect(
          page.locator('[data-world-screen="preview"]'),
        ).toHaveAttribute("data-screen-mode", "hud");
        await wheel
          .getByRole("button", { name: "Screens", exact: true })
          .press("Enter");
      }
      if (screenJourney === "code-overlap") {
        const { exerciseRepositoryCodeScreen } =
          await import("./world-repository-code-screen.js");
        await exerciseRepositoryCodeScreen(page, testInfo, true);
        expect(browserErrors).toEqual([]);
        return;
      }
      if (screenJourney === "code") {
        const { exerciseRepositoryCodeScreen } =
          await import("./world-repository-code-screen.js");
        await exerciseRepositoryCodeScreen(page, testInfo);
        await assertAudioCues(page, testInfo, [
          "world-jack-in",
          "repo-city-spawn",
          "repo-select-",
          "screen-extrude-on",
          "screen-extrude-off",
          "projection-on",
          "projection-off",
        ]);
        expect(browserErrors).toEqual([]);
        return;
      }
      if (screenJourney === "spatial") {
        const { exerciseSpatialScreens } =
          await import("./world-spatial-screens.js");
        // Deliberately outlast the 5s visibility assertion; synchronization must
        // use renderer readiness, not an assumed asset-load duration.
        await expect(room).toHaveAttribute(
          "data-repository-readiness",
          "loading",
        );
        // A new city load must not suspend the mounted World/canvas.
        await expect(
          page.locator('canvas[data-scene-id="world-room"]'),
        ).toBeVisible();
        const releaseTimer = setTimeout(() => releaseCityAssets?.(), 6_500);
        try {
          await exerciseSpatialScreens(page, testInfo);
        } finally {
          clearTimeout(releaseTimer);
          releaseCityAssets?.();
        }
        expect(browserErrors).toEqual([]);
        expect(startRequests).toBe(1);
        await assertAudioCues(page, testInfo, [
          "world-jack-in",
          "repo-city-spawn",
          "object-grab",
          "object-hold-loop",
          "object-drop",
          "projection-on",
          "projection-off",
        ]);
        return;
      }
      const audioPlayer = page.getByRole("complementary", {
        name: "World audio player",
      });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const expanded of [false, true]) {
          if (expanded)
            await audioPlayer
              .getByRole("button", { name: "Expand audio player" })
              .click();
          await expect
            .poll(() =>
              page.evaluate(() => {
                const audio = document
                  .querySelector(".world-audio")!
                  .getBoundingClientRect();
                const panel = document
                  .querySelector(".world-screen--hud .world-workstream-status")!
                  .getBoundingClientRect();
                return panel.top >= audio.bottom;
              }),
            )
            .toBe(true);
          await page.screenshot({
            path: testInfo.outputPath(
              `audio-workbench-${width}-${expanded}.png`,
            ),
          });
          if (expanded)
            await audioPlayer
              .getByRole("button", { name: "Collapse audio player" })
              .click();
        }
      }
      await page.setViewportSize({ width: 1440, height: 900 });
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
      const expandedBounds = await expanded.boundingBox();
      const previewBounds = await expanded
        .locator(".world-view__screen")
        .boundingBox();
      expect(expandedBounds).not.toBeNull();
      expect(previewBounds).not.toBeNull();
      expect(previewBounds!.height).toBeGreaterThan(
        expandedBounds!.height * 0.45,
      );
      const previewIframe = expanded.locator("iframe");
      const originalPreviewIframe = await previewIframe.elementHandle();
      await expect(previewIframe).toHaveCSS("pointer-events", "auto");
      expect(
        await previewIframe.evaluate((element) => {
          const b = element.getBoundingClientRect();
          return document
            .elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)
            ?.classList.contains("world-view__input-shield");
        }),
      ).toBe(true);
      await expanded
        .getByRole("button", { name: "Interact with preview" })
        .click();
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
      await expect(previewFrame.getByLabel("Preview state")).toHaveValue(
        "kept",
      );
      const zoom = await room.getAttribute("data-camera-zoom");
      for (const fraction of [0.15, 0.5, 0.85]) {
        await previewFrame.locator("html").evaluate(() => {
          document.scrollingElement!.scrollTop = 0;
        });
        const point = await previewIframe.evaluate((element, fraction) => {
          const b = element.getBoundingClientRect();
          const x = b.x + b.width * fraction,
            y = b.y + b.height / 2;
          return { x, y, hit: document.elementFromPoint(x, y) === element };
        }, fraction);
        expect(point.hit).toBe(true);
        await page.mouse.move(point.x, point.y);
        await page.mouse.wheel(0, 240);
        await expect
          .poll(() =>
            previewFrame
              .locator("html")
              .evaluate(() => document.scrollingElement!.scrollTop),
          )
          .toBeGreaterThan(0);
      }
      expect(await room.getAttribute("data-camera-zoom")).toBe(zoom);
      expect(
        await previewIframe.evaluate(
          (node, original) => node === original,
          originalPreviewIframe,
        ),
      ).toBe(true);
      await expanded.getByRole("button", { name: "Return to World" }).click();
      await expect(expanded.locator(".world-view__input-shield")).toBeVisible();
      await expect(room).toHaveAttribute("data-input-owner", "world");
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("dialog", { name: "World View" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("dialog", { name: "World menu" }),
      ).toHaveCount(0);
      await expect(
        view.getByRole("button", { name: "Expand World View" }),
      ).toBeFocused();
      await view.getByRole("button", { name: "Expand World View" }).click();
      await expect(previewFrame.getByLabel("Preview state")).toHaveValue(
        "kept",
      );
      await expanded.getByRole("button", { name: "Close World View" }).click();
      await expect(room).toHaveAttribute("data-input-owner", "world");

      await composer.fill("/work change it to use the blue active state");
      await composer.press("Enter");
      await expect(view).toHaveAttribute("data-preview-id", preview.previewId);
      await expect(view).toHaveAttribute("data-iteration-state", "updating");
      await expect(view).toContainText(
        "Updating from visual feedback · preview revision 4 remains verified.",
      );
      await expect.poll(() => startRequests).toBe(2);
      await expect(view).toHaveAttribute(
        "data-preview-id",
        updatedPreview.previewId,
      );
      await expect(view).toHaveAttribute("data-iteration-state", "ready");
      await expect(view).toContainText(
        "Updated World View ready · preview revision 5.",
      );
      await expect(view).toContainText("Preview revision 5");

      await composer.fill("/work make the heading larger");
      await composer.press("Enter");
      await expect(view).toHaveAttribute(
        "data-preview-id",
        updatedPreview.previewId,
      );
      await expect(view).toHaveAttribute("data-iteration-state", "updating");
      await expect.poll(() => startRequests).toBe(3);
      await expect(view).toHaveAttribute(
        "data-preview-truth",
        "previous-verified",
      );
      await expect(view).toHaveAttribute(
        "data-preview-id",
        updatedPreview.previewId,
      );
      await expect(view).toHaveAttribute("data-iteration-state", "failed");
      await expect(view).toContainText(
        "Replacement preview failed readiness. Verified preview retained.",
      );

      const retry = view.getByRole("button", {
        name: "Refresh preview",
        exact: true,
      });
      await expect(retry).toBeEnabled();
      await expect(retry).toHaveCSS("background-image", /linear-gradient/iu);
      await retry.click();
      await expect.poll(() => startRequests).toBe(4);
      await expect(view).toHaveAttribute(
        "data-preview-id",
        finalPreview.previewId,
      );
      await expect(view).toHaveAttribute("data-preview-truth", "current");
      await expect(view).toHaveAttribute("data-iteration-state", "ready");
      await expect(view).toContainText(
        "Updated World View ready · preview revision 7.",
      );

      if (screenJourney === "hud") {
        await view.locator("iframe").evaluate((frame) => {
          (
            window as unknown as { continuationFrame: Element }
          ).continuationFrame = frame;
        });
        await composer.fill(`/work ${plainFeedback}`);
        await composer.press("Enter");
        await expect.poll(() => startRequests).toBe(5);
        await expect(view).toHaveAttribute(
          "data-preview-id",
          plainPreview.previewId,
        );
        await expect(
          view
            .frameLocator("iframe")
            .getByRole("heading", { name: "Fresh Food, Happy People" }),
        ).toBeVisible();
        const completionReport = page
          .locator(".world-transcript__item")
          .filter({
            has: page.getByRole("heading", {
              name: "Completion report",
              exact: true,
            }),
          })
          .last();
        await expect(completionReport).toContainText(plainFeedback);
        await expect(completionReport.locator("li")).toHaveCount(3);
        await expect(completionReport).toContainText("3 passed, 0 failed.");
        await expect(completionReport).not.toContainText("assert.equal");
        await expect(completionReport).toContainText(
          "Full details: Workstream Inspector.",
        );
        await completionReport.scrollIntoViewIfNeeded();
        await page
          .getByRole("log", { name: "Conversation and activity" })
          .screenshot({
            path: testInfo.outputPath("formatted-current-iteration-report.png"),
          });
        expect(iterationRequests).toBe(3); // every explicit /work turn records an iteration
        expect(
          await view
            .locator("iframe")
            .evaluate(
              (frame) =>
                (window as unknown as { continuationFrame: Element })
                  .continuationFrame === frame,
            ),
        ).toBe(true);
        const { openCodeWheel } = await import("./world-code-wheel.js");
        await openCodeWheel(page);
        await view
          .getByRole("button", { name: "Expand World View", exact: true })
          .click();
        const expandedView = page.getByRole("dialog", {
          name: "World View",
          exact: true,
        });
        await expect(expandedView).toHaveAttribute(
          "data-world-view-expanded",
          "true",
        );
        const visibleLayer = await page.evaluate(() => {
          const wheel = document.querySelector(".code-wheel")!;
          const box = wheel.getBoundingClientRect();
          const hit = document.elementFromPoint(
            box.x + box.width / 2,
            box.y + box.height / 2,
          );
          return !!hit?.closest(".world-view");
        });
        expect(visibleLayer).toBe(true);
        await expect(
          page.getByRole("group", { name: "Code Wheel", exact: true }),
        ).toHaveCount(1);
        await page.screenshot({
          path: testInfo.outputPath(
            "updated-preview-wheel-behind-fullscreen.png",
          ),
        });
        await expandedView
          .getByRole("button", { name: "Close World View", exact: true })
          .click();
      }

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
      expect(startRequests).toBe(screenJourney === "hud" ? 5 : 4);
      expect(browserErrors).toEqual([]);
    },
  );

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

  const overview = page.getByRole("complementary", {
    name: "Project / Current Work",
    exact: true,
  });
  await overview
    .getByRole("button", { name: "Arrange workspace", exact: true })
    .click();
  await overview.getByText("Visual-only props", { exact: true }).click();
  const assetSearch = overview.getByLabel("Search assets");
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
  // Identity restoration leaves the floor blank; explicit loads use the normal snapshot fixture.
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
    page.getByRole("button", { name: /Push to Talk/ }),
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
    page.getByRole("region", { name: "Agent avatar selection" }),
  ).toBeVisible();
  const blockedEnterWorld = page.getByRole("button", { name: "Enter World" });
  await expect(blockedEnterWorld).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Accept Agent Avatar" }),
  ).toBeVisible();
  // This tests persisted consent across reload, not cancellation of a GLB
  // texture decode. Finish the actual preview before navigating away.
  if (evidence === "desktop" || evidence === "large-desktop")
    await expect(
      page.locator(
        '.imported-avatar-canvas[data-avatar-imported-id="cat-agent-01"]',
      ),
    ).toHaveAttribute("data-avatar-render-ready", "true", { timeout: 20_000 });
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Agent avatar selection" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter World" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Accept Agent Avatar" }),
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
  await page.getByLabel("Agent name", { exact: true }).fill("Mr Fluff");
  await page
    .getByRole("button", { name: "Open Cat Agent 1 3D preview", exact: true })
    .click();
  if (evidence !== "no-webgl")
    await expect(
      page
        .getByTestId("avatar-preview")
        .locator(
          '.imported-avatar-canvas[data-avatar-imported-id="cat-agent-01"]',
        ),
    ).toHaveAttribute("data-avatar-render-ready", "true", { timeout: 60_000 });
  const saveAvatar = page.getByRole("button", {
    name: "Accept Agent Avatar",
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
  // The blank floor mounts before the entry transition releases the HUD.
  await expect(
    page.getByRole("status").filter({ hasText: /^Entering World$/ }),
  ).toBeHidden({ timeout: 30_000 });
  await expect(page.getByTestId("world-hud")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Push to Talk/ }),
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
    await page.getByLabel("Message Mr Fluff").focus();
    // Stop World input, then synchronize the renderer with authoritative position
    // before checking that typing cannot move the avatar.
    const movedPosition = await page
      .locator("main.world-room")
      .evaluate(
        (room) =>
          `${room.getAttribute("data-user-position-x")},${room.getAttribute("data-user-position-z")}`,
      );
    await expect(canvas).toHaveAttribute("data-user-position", movedPosition);
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
    await page
      .getByRole("button", { name: "Arrange workspace", exact: true })
      .click();
    await page.getByText("Visual-only props", { exact: true }).click();
    await page.getByLabel("Search assets").fill("deployment");
    await page.getByRole("button", { name: "Place prop" }).click();
    const inspector = page.getByRole("region", {
      name: "Selected object details",
    });
    await inspector.getByRole("button", { name: "Focus" }).click();
    await expect(canvas).toHaveAttribute(
      "data-camera-focus",
      "repository-city",
      { timeout: 30_000 },
    );
    await inspector.getByRole("button", { name: "Remove prop" }).click();
    await expect(canvas).toHaveAttribute("data-camera-focus", "user");
    await page.getByLabel("Search assets").fill("");
    await page
      .getByRole("button", { name: "Done arranging", exact: true })
      .click();
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

  const restoreWrites: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (
      request.method() === "POST" &&
      /repository-indexes|repository-intake|workstreams|\/stream$/.test(path)
    ) {
      restoreWrites.push(path);
    }
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
      page.getByRole("region", { name: /^(User|Agent) avatar selection$/ }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Enter World" })).toHaveCount(
      0,
    );
    await expect(transcript.locator("li")).toHaveCount(2);
  }
  expect(restoreWrites).toEqual([]);
  // An unavailable repository does not invalidate the accepted native session.
  await page.route("**/api/world/current", (route) =>
    route.fulfill({
      status: 404,
      json: {
        ok: false,
        error: { code: "not_found", message: "No saved repository" },
      },
    }),
  );
  await page.reload();
  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-floor-state",
    "blank",
  );
  await expect(
    page.getByRole("log", { name: "Conversation and activity" }),
  ).toContainText("Yes — this is the same exact session.");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("aiw.agent-session.pointer.0.12"),
    ),
  ).toBe(session.sessionId);
  expect(restoreWrites).toEqual([]);
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
  await expect(page.getByLabel("User name", { exact: true })).toBeVisible();
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
  let emptyWorkstreamLookups = 0;
  page.on("response", (response) => {
    if (
      response.status() === 404 &&
      new URL(response.url()).pathname === "/api/workstreams/current"
    )
      emptyWorkstreamLookups++;
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // This exact endpoint deliberately returns not_found when no work exists.
    // Preserve all other HTTP, console and page errors as failures.
    if (
      message.text().includes("404 (Not Found)") &&
      new URL(message.location().url || "http://fixture.invalid").pathname ===
        "/api/workstreams/current"
    )
      return;
    errors.push(message.text());
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
  expect(emptyWorkstreamLookups).toBe(1);
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
  // Both fresh hosted runs exhausted 30s near the final movement checks;
  // the same full journey passed in a faithful local two-CPU scope (12.6s).
  // Preserve each action/assertion budget while allowing cold hosted rendering.
  test.setTimeout(60_000);
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
        target.kind === "relative"
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
        const target = action?.target as MovementFixture["target"];
        expect(["relative", "follow-user"]).toContain(target.kind);
        activateMovement("user-directed", target);
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
  expect(streamedMessages).toEqual([]);
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
  await expect(room).toHaveAttribute("data-agent-movement-state", "idle");
  const resting = await position();
  await composer.blur();
  await page.keyboard.down("KeyW");
  try {
    await expect
      .poll(
        async () => {
          const current = await position();
          return Math.hypot(current.x - resting.x, current.z - resting.z);
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0.25);
  } finally {
    await page.keyboard.up("KeyW");
  }
  await composer.fill("/agent stop");
  await composer.press("Enter");
  await expect(room).toHaveAttribute("data-agent-movement-state", "idle");
  const stopped = await position();
  await composer.blur();
  await page.keyboard.down("KeyD");
  try {
    await page.waitForTimeout(800);
    expect(await position()).toEqual(stopped);
  } finally {
    await page.keyboard.up("KeyD");
  }

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
  await page.addStyleTag({
    content:
      '.world-room, .world-room * { font-family: "Liberation Mono", monospace; }',
  });
  await expect(page.locator('[data-renderer="semantic"]')).toBeVisible();
  await expect(
    page.getByText("WorldEntryExperience.tsx", { exact: false }),
  ).toBeVisible();
  const room = page.locator("main.world-room");
  await expect(room).toHaveAttribute("data-repository-readiness", "ready");
  const cityCount = Number(
    await room.getAttribute("data-repository-city-count"),
  );
  await page
    .getByRole("button", { name: "Arrange workspace", exact: true })
    .click();
  expect(
    await page.locator(".project-overview").evaluate((element) => {
      const panel = element.getBoundingClientRect();
      const transcript = document
        .querySelector(".world-transcript")!
        .getBoundingClientRect();
      return panel.bottom < transcript.top;
    }),
  ).toBe(true);
  await page.getByText("Visual-only props", { exact: true }).click();
  await page.getByLabel("Search assets").fill("deployment");
  await expect(page.locator(".repository-assets__card")).toHaveCount(1);
  await page.getByRole("button", { name: "Place prop" }).click();
  await expect(room).toHaveAttribute(
    "data-repository-city-count",
    String(cityCount + 1),
  );
  const inspector = page.getByRole("region", {
    name: "Selected object details",
  });
  await expect(inspector).toContainText("Deployment Portal");
  await inspector.getByRole("button", { name: "Unpin" }).click();
  await inspector.getByRole("button", { name: "Pin", exact: true }).click();
  await inspector
    .getByRole("button", { name: "Explain visual metaphor" })
    .click();
  await expect(page.getByLabel("Message Mr Fluff")).toHaveValue(
    "@Mr Fluff Explain that this Director placement has no linked repository item. Do not invent a path or code role. Then explain the Deployment Portal (26-deployment-portal) visual metaphor.",
  );
  await page.screenshot({
    path: `${evidenceDirectory}/repository-city-director.png`,
  });
  await inspector.getByRole("button", { name: "Remove prop" }).click();
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
  await inspector.getByRole("button", { name: "Remove prop" }).click();
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
