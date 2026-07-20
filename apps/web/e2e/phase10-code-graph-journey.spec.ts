import { expect, test } from "@playwright/test";

import { openPanel } from "./helpers.js";

const profile = {
  version: 1,
  body: "male",
  accent: "cyan",
  showHalo: true,
  showHelmet: true,
  showFace: true,
  showEyes: true,
  showGlow: true,
};

test("Phase 10 focuses one file, preserves semantic fallback selection, and surfaces degraded coverage", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    (value) =>
      localStorage.setItem("aiw.avatar-appearance.v1", JSON.stringify(value)),
    profile,
  );
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?fixture=phase10-graph&webgl=off");
  await openPanel(page, "World");
  const status = page.getByTestId("code-graph-status");
  await expect(status).toContainText("Phase 10 current");
  await expect(status).toContainText("2/3 files parsed");
  await expect(status).toContainText("degraded");
  await expect(status).toContainText(
    "previous 09090909-0909-4909-8909-090909090909",
  );
  await expect(status).toHaveAttribute("data-reduced-motion", "true");
  await expect(status).toHaveAttribute("data-webgl-fallback", "disabled");
  const aggregate = page.getByTestId("aggregate-dependency-summary");
  await expect(aggregate).toContainText(
    "Current aggregate dependencies · LOD 2",
  );
  await expect(aggregate).toContainText(
    "2 relationships · showing 2 · not truncated",
  );
  await expect(aggregate).toContainText("exact_file · drawable · cycle");
  await expect(aggregate).toContainText("external · non-drawable · cycle none");
  await expect(aggregate).toHaveAttribute("data-rendered-bridges", "1");

  await page.getByRole("treeitem", { name: /main\.ts/ }).click();
  await page.getByRole("button", { name: "Focus selected object" }).click();
  const detail = page.getByTestId("focused-symbol-detail");
  await expect(detail).toContainText("parsed · 3 symbols · showing 3 rows");
  await expect(detail).toHaveAttribute("data-whole-repository-detail", "false");
  expect(await detail.locator("[data-symbol-ref]").count()).toBeLessThanOrEqual(
    200,
  );
  await expect(page.getByTestId("focused-dependency-status")).toContainText(
    "2 relationships · showing 2 · not truncated",
  );
  await expect(detail).toContainText("./signals.xyzzy");
  await expect(detail).toContainText("exact_file · drawable · cycle");
  await expect(detail).toContainText("external-only");
  await expect(detail).toContainText("external · non-drawable · cycle none");
  await detail.getByRole("button", { name: "resolve", exact: true }).click();
  await expect(page.getByTestId("selected-symbol-truth")).toContainText(
    "Semantic DOM and R3F equivalent",
  );

  await page.getByRole("treeitem", { name: /island\.css/ }).click();
  await page.getByRole("button", { name: "Focus selected object" }).click();
  await expect(detail).toContainText("fallback · 0 symbols · showing 0 rows");
  await expect(detail).toContainText("unsupported extension");
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  expect(errors).toEqual([]);
});

test("Phase 10 100k aggregate view materializes zero repository-wide symbols and meets browser ceilings", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const target = globalThis as typeof globalThis & {
      __aiwLongTasks?: number[];
    };
    target.__aiwLongTasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          target.__aiwLongTasks?.push(entry.duration);
      }).observe({ entryTypes: ["longtask"] });
    } catch {
      // Chromium without Long Tasks support is reported as unverified below.
    }
  });
  await page.addInitScript(
    (value) =>
      localStorage.setItem("aiw.avatar-appearance.v1", JSON.stringify(value)),
    profile,
  );
  await page.goto("/?fixture=phase10-100k&webgl=off");
  await openPanel(page, "World");
  await expect(page.getByTestId("code-graph-status")).toContainText(
    "5000/5000 files parsed",
  );
  await expect(page.getByTestId("code-graph-status")).toContainText(
    "80000 symbols",
  );
  expect(await page.locator("[data-symbol-ref]").count()).toBe(0);
  expect(
    await page.locator("[data-whole-repository-detail='true']").count(),
  ).toBe(0);
  const frames = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const durations: number[] = [];
        let previous = performance.now();
        const sample = (now: number) => {
          durations.push(now - previous);
          previous = now;
          if (durations.length >= 120) resolve(durations);
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
  );
  const sorted = [...frames].sort((left, right) => left - right);
  const p95 =
    sorted[Math.floor(sorted.length * 0.95)] ?? Number.POSITIVE_INFINITY;
  expect(p95).toBeLessThanOrEqual(33.3);
  const longTasks = await page.evaluate(
    () =>
      (globalThis as typeof globalThis & { __aiwLongTasks?: number[] })
        .__aiwLongTasks ?? [],
  );
  if (longTasks.length > 0)
    expect(Math.max(...longTasks)).toBeLessThanOrEqual(100);
  process.stdout.write(
    `[phase10-browser-measure] ${JSON.stringify({
      scale: "100k",
      frameP95Ms: p95,
      longestTaskMs:
        longTasks.length > 0 ? Math.max(...longTasks) : "unverified",
      frames: frames.length,
      wholeRepositorySymbolRows: 0,
    })}\n`,
  );
});

test("Phase 10 10k aggregate view meets the 120-frame and no-all-detail ceilings", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const target = globalThis as typeof globalThis & {
      __aiwLongTasks?: number[];
    };
    target.__aiwLongTasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          target.__aiwLongTasks?.push(entry.duration);
      }).observe({ entryTypes: ["longtask"] });
    } catch {
      // Unsupported collection remains explicitly unverified.
    }
  });
  await page.addInitScript(
    (value) =>
      localStorage.setItem("aiw.avatar-appearance.v1", JSON.stringify(value)),
    profile,
  );
  await page.goto("/?fixture=phase10-10k&webgl=off");
  await openPanel(page, "World");
  await expect(page.getByTestId("code-graph-status")).toContainText(
    "500/500 files parsed",
  );
  expect(await page.locator("[data-symbol-ref]").count()).toBe(0);
  const frames = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const durations: number[] = [];
        let previous = performance.now();
        const sample = (now: number) => {
          durations.push(now - previous);
          previous = now;
          if (durations.length >= 120) resolve(durations);
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
  );
  const sorted = [...frames].sort((left, right) => left - right);
  const p95 =
    sorted[Math.floor(sorted.length * 0.95)] ?? Number.POSITIVE_INFINITY;
  expect(p95).toBeLessThanOrEqual(33.3);
  const longTasks = await page.evaluate(
    () =>
      (globalThis as typeof globalThis & { __aiwLongTasks?: number[] })
        .__aiwLongTasks ?? [],
  );
  if (longTasks.length > 0)
    expect(Math.max(...longTasks)).toBeLessThanOrEqual(100);
  process.stdout.write(
    `[phase10-browser-measure] ${JSON.stringify({
      scale: "10k",
      frameP95Ms: p95,
      longestTaskMs:
        longTasks.length > 0 ? Math.max(...longTasks) : "unverified",
      frames: frames.length,
      wholeRepositorySymbolRows: 0,
    })}\n`,
  );
});
