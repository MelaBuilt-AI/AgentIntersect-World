import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
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

test.use({ trace: "off" });

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

async function installWorldFixtures(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let data: unknown;
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
    else if (pathname.endsWith("/avatar-proposal")) data = proposal;
    else if (pathname.endsWith("/history"))
      data = {
        sessionId: session.sessionId,
        continuity: "current",
        messages: [],
        transcriptAuthority: "hermes",
        avatarConsent: null,
      };
    else if (pathname.endsWith("/avatar-consent")) data = { state: "accepted" };
    else if (pathname.endsWith("/stream")) {
      const body = request.postDataJSON() as {
        readonly text?: unknown;
        readonly context?: { readonly userDisplayName?: unknown };
      } | null;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: streamBody(
          typeof body?.text === "string" ? body.text : "",
          typeof body?.context?.userDisplayName === "string"
            ? body.context.userDisplayName
            : "World user",
        ),
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
        createdAt: "2026-07-25T00:00:00.000Z",
        updatedAt: "2026-07-25T00:00:01.000Z",
        progress: {
          phase: "complete",
          discoveredFiles: 1,
          indexedFiles: 1,
          bytesHashed: 4800,
        },
      };
    else if (pathname.endsWith("/world/current")) data = { snapshot };
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
  await seedConfiguredAvatar(page, userDisplayName);
  await installWorldFixtures(page);
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
    await page.screenshot({
      path: `${evidenceDirectory}/returning-identity-mobile.png`,
      fullPage: true,
    });

  await page.getByRole("button", { name: /Single Agent/ }).click();
  await expectOutwardConstellation(page);
  if (evidence === "desktop" || evidence === "mobile")
    await page.screenshot({
      path: `${evidenceDirectory}/constellation-outward-${evidence}.png`,
      fullPage: true,
    });
  await page.getByRole("button", { name: /hermes_/ }).click();
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
  await expect(page.getByRole("button", { name: "Enter World" })).toHaveCount(
    0,
  );
  if (
    evidence === "desktop" ||
    evidence === "large-desktop" ||
    evidence === "phase18-5"
  ) {
    await expect(page.getByTestId("avatar-preview")).toBeVisible();
    await expect(
      page.locator('.avatar-kit-canvas[data-avatar-render-ready="true"]'),
    ).toBeVisible();
    await page.screenshot({
      path: `${evidenceDirectory}/mr-fluff-avatar-desktop.png`,
      fullPage: true,
    });
  }
  await page.getByLabel("Required agent name").fill("Mr Fluff");
  await page.getByRole("button", { name: "Accept and save avatar" }).click();
  const enterWorld = page.getByRole("button", { name: "Enter World" });
  await expect(enterWorld).toBeEnabled();
  await enterWorld.click();
  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-floor-state",
    "blank",
  );
  await expect(page.getByTestId("world-hud")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Push to talk/ }),
  ).toBeDisabled();
  await expectSharedHudBottomTrack(page);
  if (
    evidence === "desktop" ||
    evidence === "large-desktop" ||
    evidence === "pointer-lock" ||
    evidence === "phase18-5"
  ) {
    const canvas = page.locator('canvas[data-camera-mode="third-person"]');
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
      "0.850",
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
    await expect(canvas).toHaveAttribute("data-avatar-render-ready", "true");
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
  await page.getByRole("button", { name: "Send" }).click();
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
  if (evidence !== "no-webgl")
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-agent-activity",
      "completed",
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
  await messageComposer.fill("Please load the approved repository");
  await messageComposer.press("Enter");
  await expect(page.locator("main.world-room")).toHaveAttribute(
    "data-floor-state",
    "repository",
  );
  await expect(page.getByText("Repository floor · Current")).toBeVisible();
  await expect(
    page.getByText(
      /Repository floor · Current · 2 packages · 2 directories · 5 files/,
    ),
  ).toBeVisible();
  await expectSharedHudBottomTrack(page);
  if (
    evidence === "desktop" ||
    evidence === "large-desktop" ||
    evidence === "phase18-5"
  )
    await expect(
      page.locator('canvas[data-floor-state="repository"]'),
    ).toHaveAttribute("data-avatar-render-ready", "true");
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
  await expect(page.getByRole("button", { name: /hermes_/ })).toHaveClass(
    /world-action--enabled/,
  );
  for (const harness of [/openclaw_/, /claude_/, /codex_/]) {
    await expect(page.getByRole("button", { name: harness })).toHaveClass(
      /world-action--unavailable/,
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
  // The journey includes full GLB loading plus a 120-frame measurement on
  // two-CPU software renderers. The frame budgets below remain unchanged.
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await completeJourney(page, "phase18-5");
  await expect(
    page.getByRole("list", { name: "Repository floor objects" }),
  ).toContainText("source-file-code-slab");
  const transcriptItems = page
    .getByRole("log", { name: "Conversation and activity" })
    .getByRole("listitem");
  const transcriptItemCount = await transcriptItems.count();
  const actionComposer = page.getByLabel("Message Mr Fluff");
  await actionComposer.fill("Refresh Phase 18.5 action proof");
  await actionComposer.press("Enter");
  await expect(transcriptItems).toHaveCount(transcriptItemCount + 4);
  await expect(
    page.locator('canvas[data-floor-state="repository"]'),
  ).toHaveAttribute("data-agent-avatar-action", "Celebrate");
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
      userAction: canvas?.dataset.userAvatarAction ?? null,
      agentAction: canvas?.dataset.agentAvatarAction ?? null,
      agentFace: canvas?.dataset.agentAvatarFace ?? null,
      agentSecondary: canvas?.dataset.agentAvatarSecondary ?? null,
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
  await expect(
    page.locator('canvas[data-floor-state="repository"]'),
  ).toHaveAttribute("data-agent-avatar-action", "Idle");
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
    userAction: "Idle",
    agentAction: "Celebrate",
    agentFace: "Smile",
    agentSecondary: "Celebrate",
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
  await page.setViewportSize({ width: 1728, height: 1080 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await completeJourney(page, "large-desktop");
  const dimensions = await page.evaluate(() => {
    const box = (selector: string) => {
      const bounds = document
        .querySelector<HTMLElement>(selector)!
        .getBoundingClientRect();
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
      canvas: box("canvas"),
    };
  });
  expect(dimensions.experience).toEqual(dimensions.viewport);
  expect(dimensions.room).toEqual(dimensions.viewport);
  expect(dimensions.canvas).toEqual(dimensions.viewport);
});

test("held right-button canvas look follows both axes and clears every exit guard @pointer-lock", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await completeJourney(page, "pointer-lock");
  const room = page.locator("main.world-room");
  const canvas = page.locator("canvas");
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
      .poll(() =>
        canvas.evaluate((element) => document.pointerLockElement === element),
      )
      .toBe(locked);

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
  await page
    .getByLabel("Message Mr Fluff")
    .click({ button: "right", force: true });
  await expect(page.locator("body")).toHaveAttribute(
    "data-context-menu-prevented",
    "false",
  );
  await expect(room).toHaveAttribute("data-mouse-look", "idle");

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

  await page.mouse.down({ button: "right" });
  await expectCanvasPointerLock(true);
  await page.keyboard.press("Escape");
  await expectCanvasPointerLock(false);
  await expect(room).toHaveAttribute("data-mouse-look", "idle");
  await page.mouse.up({ button: "right" });

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
});

test("fixture addressing follows a second selected avatar name", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ reducedMotion: "reduce" });
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
