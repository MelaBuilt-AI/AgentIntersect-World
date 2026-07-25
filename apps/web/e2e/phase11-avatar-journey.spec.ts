import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openPanel, seedConfiguredAvatar } from "./helpers.js";

test("Phase 11 name-gated text-only editor saves, reopens, exports, and deletes without GLB fetch", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  const errors: string[] = [];
  const assets: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("aiw-avatar-kit.glb"))
      assets.push(request.url());
  });
  await page.goto("/internal/dashboard?avatar3d=text");
  await page.getByRole("button", { name: "Create Avatar" }).click();
  const save = page.getByRole("button", {
    name: "Save avatar and enter World",
  });
  await expect(save).toBeDisabled();
  await page.getByLabel("Required agent name").fill("  Cafe\u0301  ");
  await expect(save).toBeEnabled();
  await page.getByText("Dog", { exact: true }).click();
  await page.getByText("Husky", { exact: true }).click();
  await page.getByText("Paws", { exact: true }).first().click();
  await page.getByText("Short", { exact: true }).click();
  await page.getByText("Dog curled", { exact: true }).click();
  await page.getByText("Mask", { exact: true }).click();
  await page.getByText("Claude", { exact: true }).click();
  await save.click();
  await expect(page.getByTestId("world-hero")).toBeVisible();
  await openPanel(page, "Settings");
  await expect(page.getByTestId("avatar-semantic-summary")).toContainText(
    "Café",
  );
  await page.getByRole("button", { name: "Preview local export" }).click();
  await expect(page.locator(".avatar-builder__status")).toContainText(
    "Export preview ready",
  );
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "none" });
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("body *")]
      .filter(
        (element) =>
          element.getBoundingClientRect().right >
          document.documentElement.clientWidth + 0.5,
      )
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        right: element.getBoundingClientRect().right,
        width: element.getBoundingClientRect().width,
      }))
      .slice(0, 10),
  );
  expect(overflow).toEqual([]);
  expect(assets).toEqual([]);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Delete/reset avatar" }).click();
  await expect(page.getByTestId("identify-opening")).toBeVisible();
});

test("Phase 11 keeps GLB lazy, degrades 3D count on two CPUs, retains 64 semantic rows, and measures 120 frames", async ({
  page,
}) => {
  if (process.env.AIW_PHASE11_FORCE_CONSTRAINED === "1")
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", {
        configurable: true,
        value: 2,
      });
    });
  const glb: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("aiw-avatar-kit.glb")) glb.push(request.url());
  });
  await page.goto("/internal/dashboard");
  await expect(page.getByTestId("identify-opening")).toBeVisible();
  expect(glb).toEqual([]);
  await seedConfiguredAvatar(page);
  await page.reload();
  await openPanel(page, "Agents");
  await page.goto("/internal/dashboard?fixture=phase11-performance");
  await openPanel(page, "Agents");
  await expect(page.getByTestId("avatar-performance-fixture")).toBeVisible();
  await expect(page.locator(".avatar-roster > ul > li")).toHaveCount(64);
  const hardwareConcurrency = await page.evaluate(
    () => navigator.hardwareConcurrency,
  );
  const expectedVisibleAvatars = hardwareConcurrency <= 2 ? 0 : 12;
  if (expectedVisibleAvatars === 0) {
    await page.waitForTimeout(500);
    expect(glb).toEqual([]);
  } else {
    await expect.poll(() => glb.length).toBeGreaterThan(0);
  }
  const rosterSurface = page.locator(
    ".avatar-kit-roster-canvas, .avatar-kit-roster-static",
  );
  await expect(rosterSurface).toBeVisible();
  await expect(rosterSurface).toHaveAttribute(
    "data-avatar-count",
    String(expectedVisibleAvatars),
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestIdleCallback(() => resolve(), { timeout: 1000 }),
      ),
  );
  // Keep shader compilation, the one-frame fixture transition, and browser GC
  // outside the supported steady-state sample window.
  await page.waitForTimeout(750);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestIdleCallback(() => resolve(), { timeout: 1000 }),
      ),
  );
  const metric = await page.evaluate(
    () =>
      new Promise<{ p95: number; longest: number }>((resolve) => {
        const frames: number[] = [];
        let prior = performance.now();
        let longest = 0;
        const observer =
          "PerformanceObserver" in window
            ? new PerformanceObserver((list) => {
                for (const entry of list.getEntries())
                  longest = Math.max(longest, entry.duration);
              })
            : null;
        try {
          observer?.observe({ type: "longtask" });
        } catch {
          observer?.disconnect();
        }
        const tick = (now: number) => {
          frames.push(now - prior);
          prior = now;
          if (frames.length < 120) requestAnimationFrame(tick);
          else {
            observer?.disconnect();
            const sorted = [...frames].sort((a, b) => a - b);
            resolve({ p95: sorted[Math.floor(sorted.length * 0.95)], longest });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
  console.info(
    "[phase11-browser-measure]",
    JSON.stringify({
      hardwareConcurrency,
      visibleAvatars: expectedVisibleAvatars,
      semanticRows: 64,
      frames: 120,
      frameP95Ms: Number(metric.p95.toFixed(1)),
      longestTaskMs: Number(metric.longest.toFixed(1)),
    }),
  );
  expect(metric.p95).toBeLessThanOrEqual(33.3);
  expect(metric.longest).toBeLessThanOrEqual(100);
});
