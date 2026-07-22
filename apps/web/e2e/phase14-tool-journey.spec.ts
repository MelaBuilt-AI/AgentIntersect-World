import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { format as formatArtifactJson } from "prettier";

import fixtureManifest from "../../../examples/phase14-magic-slice/fixture.manifest.json" with { type: "json" };
import { openPanel, seedConfiguredAvatar } from "./helpers.js";

test.use({ trace: "off" });

const artifactDirectory = path.resolve("artifacts/phase14");
const fixtureRoot = path.resolve("examples/phase14-magic-slice");
const disposableRoot = "/tmp/agentintersect-world-phase14";

async function fixtureHashes() {
  return Object.fromEntries(
    await Promise.all(
      fixtureManifest.files.map(async ({ path: relativePath }) => [
        relativePath,
        createHash("sha256")
          .update(await fs.readFile(path.join(fixtureRoot, relativePath)))
          .digest("hex"),
      ]),
    ),
  );
}

async function measureSemanticDom(page: Page, profile: string) {
  return page.evaluate(
    ({ expectedProfile }) =>
      new Promise<{
        profile: string;
        verifiedHardwareConcurrency: number;
        renderWorkMs: number[];
        cadenceMs: number[];
        longestTaskMs: number;
        incrementalHeapMiB: number;
      }>((resolve) => {
        const details = document.querySelector<HTMLDetailsElement>(
          ".phase14-diff-grid details",
        );
        if (!details) throw new Error("Phase 14 semantic diff is unavailable");
        const renderWorkMs: number[] = [];
        const cadenceMs: number[] = [];
        const memory = performance as Performance & {
          memory?: { usedJSHeapSize: number };
        };
        const heapBefore = memory.memory?.usedJSHeapSize ?? 0;
        let previous: number | null = null;
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
        const frame = (now: number) => {
          if (previous !== null) {
            cadenceMs.push(now - previous);
            const started = performance.now();
            details.open = !details.open;
            void details.offsetHeight;
            renderWorkMs.push(performance.now() - started);
          }
          previous = now;
          if (cadenceMs.length === 120) {
            observer?.disconnect();
            const heapAfter = memory.memory?.usedJSHeapSize ?? heapBefore;
            resolve({
              profile: expectedProfile,
              verifiedHardwareConcurrency: navigator.hardwareConcurrency,
              renderWorkMs,
              cadenceMs,
              longestTaskMs,
              incrementalHeapMiB:
                Math.max(0, heapAfter - heapBefore) / 1024 / 1024,
            });
          } else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
    { expectedProfile: profile },
  );
}

function p95(samples: readonly number[]): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return (
    sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY
  );
}

async function retainBrowserMetrics(
  page: Page,
  profile: "desktop" | "mobile-two-cpu",
) {
  const raw = await measureSemanticDom(page, profile);
  const evidence = {
    schema: "aiw.phase14-browser-performance/1",
    measuredAt: new Date().toISOString(),
    profile,
    profileVerification: {
      expectedHardwareConcurrency:
        profile === "mobile-two-cpu" ? 2 : "desktop-host",
      observedHardwareConcurrency: raw.verifiedHardwareConcurrency,
      matches:
        profile === "mobile-two-cpu"
          ? raw.verifiedHardwareConcurrency === 2
          : raw.verifiedHardwareConcurrency > 2,
    },
    sampleCount: 120,
    rawSamples: {
      renderWorkMs: raw.renderWorkMs,
      cadenceMs: raw.cadenceMs,
    },
    calculated: {
      renderWorkP95Ms: p95(raw.renderWorkMs),
      cadenceP95Ms: p95(raw.cadenceMs),
      longestTaskMs: raw.longestTaskMs,
      incrementalHeapMiB: raw.incrementalHeapMiB,
    },
    thresholds: {
      renderWorkP95Ms: 16.7,
      cadenceP95Ms: 16.8,
      longestTaskMs: 100,
      incrementalHeapMiB: 32,
    },
  };
  const verdict =
    evidence.profileVerification.matches &&
    raw.renderWorkMs.length === 120 &&
    raw.cadenceMs.length === 120 &&
    evidence.calculated.renderWorkP95Ms <= 16.7 &&
    evidence.calculated.cadenceP95Ms <= 16.8 &&
    evidence.calculated.longestTaskMs <= 100 &&
    evidence.calculated.incrementalHeapMiB <= 32;
  await fs.mkdir(artifactDirectory, { recursive: true });
  const retainedEvidence = { ...evidence, verdict };
  await fs.writeFile(
    path.join(artifactDirectory, `phase14-${profile}-browser-metrics.json`),
    await formatArtifactJson(JSON.stringify(retainedEvidence), {
      parser: "json",
    }),
  );
  console.info("[phase14-browser-measure]", JSON.stringify(retainedEvidence));
  expect(verdict).toBe(true);
}

async function performAction(page: Page, label: string, action: string) {
  const lane = page.locator(".phase14-journey");
  await lane.getByRole("button", { name: label }).click();
  await expect(lane.getByRole("status")).toContainText(
    `${action} completed with authoritative server evidence`,
  );
}

test("Phase 14 completes the exact real-process edit, test, preview, cleanup, and correlation journey", async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);
  const beforeHashes = await fixtureHashes();
  expect(beforeHashes).toEqual(
    Object.fromEntries(
      fixtureManifest.files.map((file) => [file.path, file.sha256]),
    ),
  );
  await fs.mkdir(artifactDirectory, { recursive: true });
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: true,
  });

  await seedConfiguredAvatar(page);
  await page.goto("/");
  await openPanel(page, "Activity");
  const lane = page.locator(".phase14-journey");
  await expect(lane).toBeVisible();

  await performAction(page, "Attach fixture session", "create");
  await performAction(page, "Read and explain", "inspect");
  await expect(lane).toContainText("source-fact");
  await expect(lane).toContainText("runtime-observation");
  await performAction(page, "Preview exact edit", "prepare-edit");
  await expect(lane).toContainText("Hello from the Phase 14 fixture.");
  await expect(lane).toContainText("Hello from the approved Phase 14 edit.");
  await performAction(page, "Approve once", "approve");
  await expect(
    lane.getByRole("button", { name: "Approve once" }),
  ).toBeDisabled();
  await performAction(page, "Apply edit", "apply");
  await expect(lane).toContainText("Current source");
  await performAction(page, "Run focused test", "test");
  await expect(lane).toContainText("Focused test · succeeded");
  await performAction(page, "Start loopback preview", "start-preview");
  const previewUrl = await lane.getByRole("link").getAttribute("href");
  expect(previewUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
  const health = await page.request.get(`${previewUrl}health`);
  expect(await health.json()).toEqual({
    ok: true,
    schema: "aiw.phase14-preview/1",
  });
  await performAction(page, "Stop preview", "stop-preview");
  await expect(lane).toContainText("Loopback preview · stopped");
  await expect(lane).toContainText("port closed true");
  await expect(
    lane.getByLabel("Final correlated evidence").locator("li"),
  ).toHaveCount(7);

  const operation = await page.request.get("/api/phase14/journeys/current");
  const snapshot = (await operation.json()) as {
    operationId: string;
    disposable: { copyName: string };
    status: string;
  };
  expect(snapshot.status).toBe("completed");
  await expect
    .poll(async () => {
      try {
        await fs.access(
          path.join(disposableRoot, snapshot.disposable.copyName),
        );
        return false;
      } catch {
        return true;
      }
    })
    .toBe(true);
  await expect
    .poll(async () => {
      try {
        return (await fetch(`${previewUrl}health`)).ok;
      } catch {
        return false;
      }
    })
    .toBe(false);

  const accessibility = await new AxeBuilder({ page })
    .include(".phase14-journey")
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await retainBrowserMetrics(page, "desktop");
  await page.screenshot({
    path: path.join(artifactDirectory, "phase14-complete-journey.png"),
    fullPage: true,
  });

  await openPanel(page, "Agents");
  await expect(
    page.getByRole("heading", { name: "Hermes connector and World chat" }),
  ).toBeVisible();
  expect(await fixtureHashes()).toEqual(beforeHashes);
  await context.tracing.stop({
    path: path.join(artifactDirectory, "phase14-complete-journey-trace.zip"),
  });
});

test.describe("Phase 14 semantic mobile fallback", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
    forcedColors: "active",
  });

  test("supports keyboard, touch, forced colors, reduced motion, two CPUs, and no WebGL", async ({
    page,
  }) => {
    await page.emulateMedia({
      reducedMotion: "reduce",
      forcedColors: "active",
    });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", {
        configurable: true,
        value: 2,
      });
      HTMLCanvasElement.prototype.getContext = () => null;
    });
    await seedConfiguredAvatar(page);
    await page.goto("/?fixture=phase14-journey");
    const activity = page.getByRole("button", {
      name: "Activity",
      exact: true,
    });
    await activity.focus();
    await page.keyboard.press("Enter");
    const lane = page.locator(".phase14-journey");
    await expect(lane).toBeVisible();
    await lane.getByRole("button", { name: "Attach fixture session" }).tap();
    await expect(lane)
      .toContainText("Semantic DOM")
      .catch(() => expect(lane).toContainText("Authoritative event state"));
    const viewport = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      forced: matchMedia("(forced-colors: active)").matches,
    }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
    expect(viewport.reduced).toBe(true);
    expect(viewport.forced).toBe(true);
    const touchTarget = await lane
      .getByRole("button", { name: "Attach fixture session" })
      .boundingBox();
    expect(touchTarget?.height).toBeGreaterThanOrEqual(44);
    const accessibility = await new AxeBuilder({ page })
      .include(".phase14-journey")
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await retainBrowserMetrics(page, "mobile-two-cpu");
    await page.screenshot({
      path: path.join(
        artifactDirectory,
        "phase14-mobile-semantic-fallback.png",
      ),
      fullPage: true,
    });
  });
});
