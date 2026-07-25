import fs from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { format as formatArtifactJson } from "prettier";

import { openPanel, seedConfiguredAvatar } from "./helpers.js";
import { createPhase13BrowserMetricEvidence } from "./performance-metrics.js";

test.use({ trace: "off" });

async function measureHybridFrameSeries(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{
        cadenceMs: number[];
        renderWorkMs: number[];
        longestTaskMs: number;
        renderSamplesVerified: boolean;
      }>((resolve, reject) => {
        const canvas = document.querySelector(".island-canvas canvas");
        if (!(canvas instanceof HTMLCanvasElement)) {
          reject(new Error("Repository WebGL canvas is unavailable"));
          return;
        }
        if (canvas.dataset.phase13RenderReady !== "true") {
          reject(new Error("Repository WebGL renderer is not ready"));
          return;
        }
        const cadenceMs: number[] = [];
        const renderWorkMs: number[] = [];
        let verifiedUpdates = 0;
        let requestId = 0;
        let previousFrame: number | null = null;
        let longestTaskMs = 0;
        const observer =
          "PerformanceObserver" in window
            ? new PerformanceObserver((list) => {
                for (const entry of list.getEntries())
                  longestTaskMs = Math.max(longestTaskMs, entry.duration);
              })
            : null;
        try {
          observer?.observe({ type: "longtask" });
        } catch {
          observer?.disconnect();
        }
        const sampleRender = () =>
          new Promise<number>((sampleResolve, sampleReject) => {
            const id = ++requestId;
            const completed = (event: Event) => {
              const detail = (event as CustomEvent).detail as
                | { readonly requestId?: number; readonly durationMs?: number }
                | undefined;
              if (detail?.requestId !== id) return;
              window.clearTimeout(timeout);
              canvas.removeEventListener("aiw:render-sample", completed);
              if (!Number.isFinite(detail.durationMs)) {
                sampleReject(new Error("Repository render sample was invalid"));
                return;
              }
              verifiedUpdates += 1;
              sampleResolve(detail.durationMs!);
            };
            const timeout = window.setTimeout(() => {
              canvas.removeEventListener("aiw:render-sample", completed);
              sampleReject(new Error("Repository render sample timed out"));
            }, 1_000);
            canvas.addEventListener("aiw:render-sample", completed);
            canvas.dispatchEvent(
              new CustomEvent("aiw:measure-render", {
                detail: { requestId: id },
              }),
            );
          });
        const frame = async (now: number) => {
          if (previousFrame === null) {
            previousFrame = now;
            requestAnimationFrame(frame);
            return;
          }
          cadenceMs.push(now - previousFrame);
          previousFrame = now;
          renderWorkMs.push(await sampleRender());
          if (cadenceMs.length === 120) {
            observer?.disconnect();
            resolve({
              cadenceMs,
              renderWorkMs,
              longestTaskMs,
              renderSamplesVerified: verifiedUpdates === 120,
            });
          } else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
  );
}

test("Phase 13 defaults to third person, enters first person explicitly, and Escape/operator movement interrupt @pointer-lock", async ({
  page,
}) => {
  await seedConfiguredAvatar(page);
  await page.goto("/internal/dashboard?fixture=phase10-graph");
  await openPanel(page, "World");
  const actions = page.locator(".world-actions");
  await expect(actions).toBeVisible();
  await expect(actions.locator("..")).toHaveAttribute(
    "data-camera-mode",
    "third-person",
  );
  await expect(actions).toContainText(
    "Connect a Phase 12 Hermes session for agent-led World Actions",
  );
  await expect(actions).toContainText("Phase 12 chat remains available");

  await actions.getByRole("button", { name: "Follow" }).click();
  await page.keyboard.press("ArrowUp");
  await expect(actions.getByRole("status").last()).toHaveText(
    /Operator moved forward.*no agent arrival is implied/,
  );

  await actions.getByRole("button", { name: "Enter first-person" }).click();
  await expect(actions.locator("..")).toHaveAttribute(
    "data-camera-mode",
    "first-person",
  );
  await page.keyboard.press("Escape");
  await expect(actions.locator("..")).toHaveAttribute(
    "data-camera-mode",
    "third-person",
  );
  await expect(actions.getByRole("status").last()).toContainText(
    "Escape returned control",
  );

  await actions.getByRole("button", { name: "Enter first-person" }).click();
  await expect(actions.locator("..")).toHaveAttribute(
    "data-camera-mode",
    "first-person",
  );
  await page.keyboard.press("w");
  await expect(actions.getByRole("status").last()).toHaveText(
    /Operator moved forward.*no agent arrival is implied/,
  );
  await expect(
    actions.getByRole("button", { name: "Start agent tour" }),
  ).toBeDisabled();
  await expect(actions).toContainText("Focus fallback");
  await expect(actions).toContainText("Teleport fallback");
});

test("Phase 13 manual controls change the rendered camera and actor state @pointer-lock", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await seedConfiguredAvatar(page);
  await page.goto("/internal/dashboard?fixture=phase10-graph");
  await openPanel(page, "World");
  const actions = page.locator(".world-actions");
  const canvas = page.getByTestId("repository-canvas");
  const renderSurface = canvas.locator("canvas");
  await expect(renderSurface).toHaveAttribute(
    "data-phase13-render-ready",
    "true",
  );
  const bounds = await renderSurface.boundingBox();
  if (!bounds) throw new Error("repository camera surface is unavailable");

  const initialYaw = await canvas.getAttribute("data-camera-yaw");
  const initialTransform = await renderSurface.getAttribute(
    "data-camera-transform",
  );
  await renderSurface.dispatchEvent("mousedown", {
    button: 0,
    clientX: bounds.x + bounds.width / 2,
    clientY: bounds.y + bounds.height / 2,
  });
  await page.evaluate(
    ({ x, y }) =>
      window.dispatchEvent(
        new MouseEvent("mousemove", { clientX: x, clientY: y }),
      ),
    {
      x: bounds.x + bounds.width / 2 + 80,
      y: bounds.y + bounds.height / 2 - 30,
    },
  );
  await page.evaluate(() => window.dispatchEvent(new MouseEvent("mouseup")));
  await expect(canvas).not.toHaveAttribute("data-camera-yaw", initialYaw ?? "");
  await expect(renderSurface).not.toHaveAttribute(
    "data-camera-transform",
    initialTransform ?? "",
  );

  await actions.getByText("Camera comfort settings").click();
  await actions.getByLabel("Camera easing").fill("0.8");
  await actions.getByLabel("Field of view").fill("90");
  await expect(renderSurface).toHaveAttribute("data-camera-easing", "0.8");
  await expect
    .poll(async () =>
      Number(await renderSurface.getAttribute("data-camera-fov")),
    )
    .toBeCloseTo(90, 2);

  await actions.getByRole("button", { name: "Enter first-person" }).click();
  expect(await page.evaluate(() => document.pointerLockElement !== null)).toBe(
    true,
  );
  await expect(canvas).toHaveAttribute("data-camera-mode", "first-person");
  const firstPersonYaw = await canvas.getAttribute("data-camera-yaw");
  await page.evaluate(() => {
    const event = new MouseEvent("mousemove");
    Object.defineProperties(event, {
      movementX: { value: 24 },
      movementY: { value: -6 },
    });
    document.dispatchEvent(event);
  });
  await expect(canvas).not.toHaveAttribute(
    "data-camera-yaw",
    firstPersonYaw ?? "",
  );
  const actorBefore = await canvas.getAttribute("data-agent-position");
  await page.evaluate(() => {
    const target = document.pointerLockElement ?? document.body;
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "w",
        bubbles: true,
        composed: true,
      }),
    );
  });
  await expect(canvas).not.toHaveAttribute(
    "data-agent-position",
    actorBefore ?? "",
  );
  await expect(renderSurface).toHaveAttribute(
    "data-agent-position",
    /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/,
  );

  await page.evaluate(() => {
    const target = document.pointerLockElement ?? document.body;
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        composed: true,
      }),
    );
  });
  await expect(canvas).toHaveAttribute("data-camera-mode", "third-person");
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  const touchYaw = await canvas.getAttribute("data-camera-yaw");
  await renderSurface.dispatchEvent("pointerdown", {
    pointerId: 77,
    pointerType: "touch",
    clientX: bounds.x + 20,
    clientY: bounds.y + 20,
  });
  await renderSurface.dispatchEvent("pointermove", {
    pointerId: 77,
    pointerType: "touch",
    clientX: bounds.x + 100,
    clientY: bounds.y + 50,
  });
  await renderSurface.dispatchEvent("pointerup", {
    pointerId: 77,
    pointerType: "touch",
    clientX: bounds.x + 100,
    clientY: bounds.y + 50,
  });
  await expect(canvas).not.toHaveAttribute("data-camera-yaw", touchYaw ?? "");

  const actorBeforeMinimap = await canvas.getAttribute("data-agent-position");
  const minimapTravel = page
    .getByRole("region", { name: "Repository overview minimap" })
    .getByRole("button", { name: /Travel to .* from overview/ })
    .nth(1);
  await minimapTravel.click();
  await expect(canvas).not.toHaveAttribute(
    "data-agent-position",
    actorBeforeMinimap ?? "",
  );
  await expect(minimapTravel).toHaveClass(/is-selected/);

  await actions.getByRole("button", { name: "Photo" }).click();
  await expect(canvas).toHaveAttribute("data-photo-hidden", "true");
  await actions.getByRole("button", { name: "Third-person" }).click();
  await expect(canvas).toHaveAttribute("data-photo-hidden", "false");
});

test("Phase 13 mobile/reduced-motion/forced-colors/no-WebGL retains semantic and touch equivalence", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await seedConfiguredAvatar(page);
  await page.goto("/internal/dashboard?fixture=phase10-graph&webgl=off");
  await openPanel(page, "World");
  const actions = page.locator(".world-actions");
  await expect(actions).toContainText(
    "Semantic mode: focus only; physical arrival is not claimed",
  );
  await expect(actions).toContainText("Touch movement controls");
  await expect(actions).toContainText("Reduced motion");
  await actions.getByRole("button", { name: "Tap forward" }).click();
  await expect(actions.getByRole("status").last()).toContainText(
    "Semantic movement selected",
  );
  await expect(actions.getByRole("status").last()).toContainText(
    "physical movement is not claimed without WebGL",
  );
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "none" });
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("Phase 13 captures deterministic frame/Long Task metrics and screenshot", async ({
  page,
}) => {
  const evidenceDirectory = path.resolve("artifacts/phase13");
  await fs.mkdir(evidenceDirectory, { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem(
      "aiw.avatar.profile.0.11",
      JSON.stringify({
        schema: "aiw.avatar-store/0.11",
        current: {
          schema: "aiw.avatar/0.11",
          profileId: "avatar_0123456789abcdef0123456789abcdef",
          agentRef: null,
          agentName: "Codex",
          species: "human",
          head: "round",
          hands: "hands",
          feet: "feet",
          fur: "none",
          tail: "none",
          markings: "solid",
          bodyColor: "warm-light",
          shirt: "Codex",
          mappingConsent: false,
          sourceDisclosure: "manual-local-input",
          createdAt: "2026-07-20T12:00:00.000Z",
          updatedAt: "2026-07-20T12:00:00.000Z",
        },
        previous: null,
      }),
    );
  });
  await page.goto("/internal/dashboard?fixture=phase10-10k");
  await expect(page.getByTestId("typewriter-line")).toHaveAttribute(
    "data-state",
    "complete",
  );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.collectGarbage");
  const heapBefore = await cdp.send("Runtime.getHeapUsage");
  await openPanel(page, "World");
  await expect(page.getByTestId("code-graph-status")).toContainText(
    "500/500 files parsed",
  );
  const actions = page.locator(".world-actions");
  await actions.getByRole("button", { name: "Third-person" }).click();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestIdleCallback(() => resolve(), { timeout: 1_000 }),
      ),
  );
  await page.waitForTimeout(750);
  const metric = await measureHybridFrameSeries(page);
  await cdp.send("HeapProfiler.collectGarbage");
  const heapAfter = await cdp.send("Runtime.getHeapUsage");
  const incrementalHeapMiB =
    Math.max(0, heapAfter.usedSize - heapBefore.usedSize) / (1024 * 1024);
  const symbolRows = await page.locator("[data-symbol-ref]").count();
  const timelineRows = await page
    .locator(".world-actions__timeline li")
    .count();
  const evidence = createPhase13BrowserMetricEvidence({
    profile: "desktop-10k-steady-state",
    verifiedProfile: (await page.evaluate(() => window.innerWidth >= 800))
      ? "desktop-10k-steady-state"
      : "unverified",
    renderSamplesVerified: metric.renderSamplesVerified,
    renderWorkMs: metric.renderWorkMs,
    cadenceMs: metric.cadenceMs,
    longestTaskMs: metric.longestTaskMs,
    incrementalHeapMiB,
    thresholds: {
      renderWorkP95Ms: 16.7,
      cadenceP95Ms: 16.8,
      longestTaskMs: 50,
      incrementalHeapMiB: 96,
    },
  });
  const retainedEvidence = {
    ...evidence,
    presentation: { symbolRows, timelineRows },
  };
  await fs.writeFile(
    path.join(evidenceDirectory, "phase13-browser-metrics.json"),
    await formatArtifactJson(JSON.stringify(retainedEvidence), {
      parser: "json",
    }),
    "utf8",
  );
  console.info("[phase13-browser-measure]", JSON.stringify(retainedEvidence));
  expect(evidence.verdict.pass).toBe(true);
  expect(symbolRows).toBeLessThanOrEqual(200);
  expect(timelineRows).toBeLessThanOrEqual(50);
  await actions.screenshot({
    path: path.join(evidenceDirectory, "phase13-world-actions.png"),
    animations: "disabled",
  });
});

test("Phase 13 100k mobile/two-CPU aggregate stays bounded and semantic", async ({
  page,
}) => {
  const evidenceDirectory = path.resolve("artifacts/phase13");
  await fs.mkdir(evidenceDirectory, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: 2,
    });
    localStorage.setItem(
      "aiw.avatar.profile.0.11",
      JSON.stringify({
        schema: "aiw.avatar-store/0.11",
        current: {
          schema: "aiw.avatar/0.11",
          profileId: "avatar_0123456789abcdef0123456789abcdef",
          agentRef: null,
          agentName: "Codex",
          species: "human",
          head: "round",
          hands: "hands",
          feet: "feet",
          fur: "none",
          tail: "none",
          markings: "solid",
          bodyColor: "warm-light",
          shirt: "Codex",
          mappingConsent: false,
          sourceDisclosure: "manual-local-input",
          createdAt: "2026-07-20T12:00:00.000Z",
          updatedAt: "2026-07-20T12:00:00.000Z",
        },
        previous: null,
      }),
    );
  });
  await page.goto("/internal/dashboard?fixture=phase10-100k");
  await expect(page.getByTestId("typewriter-line")).toHaveAttribute(
    "data-state",
    "complete",
  );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("HeapProfiler.collectGarbage");
  const heapBefore = await cdp.send("Runtime.getHeapUsage");
  await openPanel(page, "World");
  await expect(page.getByTestId("code-graph-status")).toContainText(
    "80000 symbols",
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestIdleCallback(() => resolve(), { timeout: 1_000 }),
      ),
  );
  await page.waitForTimeout(750);
  const metric = await measureHybridFrameSeries(page);
  await cdp.send("HeapProfiler.collectGarbage");
  const heapAfter = await cdp.send("Runtime.getHeapUsage");
  const incrementalHeapMiB =
    Math.max(0, heapAfter.usedSize - heapBefore.usedSize) / (1024 * 1024);
  const semanticSymbolRows = await page.locator("[data-symbol-ref]").count();
  const wholeRepositoryDetailRows = await page
    .locator("[data-whole-repository-detail='true']")
    .count();
  const timelineRows = await page
    .locator(".world-actions__timeline li")
    .count();
  const evidence = createPhase13BrowserMetricEvidence({
    profile: "mobile-two-cpu-100k-steady-state",
    verifiedProfile: (await page.evaluate(
      () => window.innerWidth <= 390 && navigator.hardwareConcurrency === 2,
    ))
      ? "mobile-two-cpu-100k-steady-state"
      : "unverified",
    renderSamplesVerified: metric.renderSamplesVerified,
    renderWorkMs: metric.renderWorkMs,
    cadenceMs: metric.cadenceMs,
    longestTaskMs: metric.longestTaskMs,
    incrementalHeapMiB,
    thresholds: {
      renderWorkP95Ms: 33.3,
      cadenceP95Ms: 33.3,
      longestTaskMs: 100,
      incrementalHeapMiB: 96,
    },
  });
  await fs.writeFile(
    path.join(evidenceDirectory, "phase13-mobile-two-cpu-100k-metrics.json"),
    await formatArtifactJson(
      JSON.stringify({
        ...evidence,
        presentation: {
          semanticSymbolRows,
          wholeRepositoryDetailRows,
          timelineRows,
        },
        constraint: {
          method: "cdp-cpu-throttling",
          cpuThrottlingRate: 4,
          hardwareConcurrencyHint: 2,
          physicalCoreClaimed: false,
        },
      }),
      { parser: "json" },
    ),
    "utf8",
  );
  expect(evidence.verdict.pass).toBe(true);
  expect(semanticSymbolRows).toBe(0);
  expect(wholeRepositoryDetailRows).toBe(0);
  expect(timelineRows).toBeLessThanOrEqual(50);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
});

test("Phase 13 retains a short tour-equivalent control video", async ({
  browser,
}) => {
  const evidenceDirectory = path.resolve("artifacts/phase13");
  await fs.mkdir(evidenceDirectory, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 960, height: 675 },
    recordVideo: { dir: evidenceDirectory, size: { width: 960, height: 675 } },
  });
  const page = await context.newPage();
  await page.goto(
    "http://127.0.0.1:45173/internal/dashboard?fixture=phase10-graph&webgl=off",
  );
  const identify = page.getByTestId("identify-opening");
  if (await identify.isVisible()) {
    await page.getByRole("button", { name: "Create Avatar" }).click();
    await page.getByLabel("Required agent name").fill("Codex");
    await page
      .getByRole("button", { name: "Save avatar and enter World" })
      .click();
  }
  await openPanel(page, "World");
  const actions = page.locator(".world-actions");
  await actions.getByRole("button", { name: "Third-person" }).click();
  await actions.getByRole("button", { name: "Follow" }).click();
  await actions.getByRole("button", { name: "Enter first-person" }).click();
  await page.keyboard.press("Escape");
  await expect(actions.getByRole("status").last()).toContainText(
    "Escape returned control",
  );
  const video = page.video();
  await context.close();
  if (!video) throw new Error("Phase 13 video capture was unavailable");
  await video.saveAs(path.join(evidenceDirectory, "phase13-tour.webm"));
});
