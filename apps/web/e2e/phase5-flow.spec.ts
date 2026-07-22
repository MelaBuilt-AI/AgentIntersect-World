import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  openPanel,
  seedConfiguredAvatar,
  selectAvatarCosmeticQuality,
} from "./helpers.js";

// The approved pixels remain authoritative. This bounded allowance covers
// Linux CI versus WSL glyph/PNG rasterization without accepting layout drift.
const CROSS_RUN_VISUAL_DIFF_RATIO = 0.04;

async function seedAvatar(page: Page) {
  await seedConfiguredAvatar(page);
}

async function expectNoSeriousAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
}

test("first-open identify/avatar, durable harness, stable shell, Settings edit, and desktop evidence", async ({
  page,
}) => {
  await selectAvatarCosmeticQuality(page, "full");
  await page.goto("/");
  await expect(page.getByTestId("identify-opening")).toBeVisible();
  await expect(page.getByText("identify_", { exact: false })).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  await expect(page).toHaveScreenshot("phase5-identify-desktop.png", {
    animations: "disabled",
    maxDiffPixelRatio: CROSS_RUN_VISUAL_DIFF_RATIO,
  });
  await page.getByRole("button", { name: "Begin identification" }).click();
  await expect(page.getByTestId("identify-transition")).toBeVisible();
  await expect(page.getByTestId("avatar-preview")).toBeVisible();
  await expect(page).toHaveScreenshot("phase5-avatar-builder-desktop.png", {
    animations: "disabled",
    maxDiffPixelRatio: CROSS_RUN_VISUAL_DIFF_RATIO,
  });
  await page.getByLabel("Required agent name").fill("Codex");
  await page.getByText("Dog", { exact: true }).click();
  await page.getByText("Husky", { exact: true }).click();
  await page
    .getByRole("button", { name: "Save avatar and enter World" })
    .click();
  await expect(page.getByTestId("world-entry-transition")).toBeVisible();

  const hero = page.getByTestId("world-hero");
  await expect(page.getByTestId("typewriter-line")).toHaveAttribute(
    "data-state",
    "typing",
  );
  await expect(page.getByTestId("typewriter-line")).toHaveAttribute(
    "data-state",
    "complete",
  );
  const heroBefore = await hero.boundingBox();
  await expect(
    page
      .getByRole("navigation", { name: "World categories" })
      .getByRole("button"),
  ).toHaveText([
    "World",
    "Repositories",
    "Agents",
    "Activity",
    "Evidence",
    "Settings",
  ]);
  await page.getByLabel("Default harness intent").selectOption("openclaw");
  await page.getByLabel("Current harness intent").selectOption("hermes");
  await expect(
    page.getByText(/Selected harness read status: disabled/),
  ).toBeVisible();

  const repositories = page.getByRole("button", {
    name: "Repositories",
    exact: true,
  });
  await repositories.click();
  await expect(
    page.getByRole("heading", { name: "Deterministic metadata index" }),
  ).toBeVisible();
  await repositories.click();
  await expect(
    page.getByRole("heading", { name: "Deterministic metadata index" }),
  ).toHaveCount(0);
  const heroAfter = await hero.boundingBox();
  expect(heroAfter).toEqual(heroBefore);
  const line = await page.getByTestId("typewriter-line").boundingBox();
  const cursor = await page.getByTestId("inline-cursor").boundingBox();
  expect(line).not.toBeNull();
  expect(cursor).not.toBeNull();
  expect((cursor?.top ?? 0) >= (line?.top ?? 0)).toBe(true);
  expect((cursor?.bottom ?? 0) <= (line?.bottom ?? 0) + 2).toBe(true);

  await page.reload();
  await expect(page.getByTestId("identify-opening")).toHaveCount(0);
  await expect(page.getByLabel("Default harness intent")).toHaveValue(
    "openclaw",
  );
  await expect(page.getByLabel("Current harness intent")).toHaveValue("hermes");
  await openPanel(page, "Settings");
  await expect(
    page.getByRole("heading", { name: "Edit avatar appearance" }),
  ).toBeVisible();
  await page.getByText("Human", { exact: true }).click();
  await page.getByRole("button", { name: "Save avatar changes" }).click();
  await expect(page.getByText(/Avatar profile updated locally/)).toBeVisible();
  await page.getByRole("button", { name: "Close Settings panel" }).click();
  await expect(page.getByTestId("typewriter-line")).toHaveAttribute(
    "data-state",
    "complete",
  );
  await expect(page.locator(".dashboard-shell")).toHaveAttribute(
    "data-cosmetic-quality",
    "full",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("phase5-dashboard-desktop.png", {
    animations: "disabled",
    maxDiffPixelRatio: CROSS_RUN_VISUAL_DIFF_RATIO,
  });
});

test("repository island shares semantic selection/focus and survives context loss", async ({
  page,
}) => {
  await seedAvatar(page);
  await page.goto("/?fixture=phase5");
  await openPanel(page, "World");
  await expect(
    page.getByRole("heading", { name: "phase5-fixture island" }),
  ).toBeVisible();
  await expect(page.getByTestId("repository-canvas")).toBeVisible();
  await page
    .getByLabel("Search packages, directories, and files")
    .fill("xyzzy");
  await page.getByRole("treeitem", { name: /signals\.xyzzy/ }).click();
  const inspector = page.getByLabel("Selected object inspector");
  await expect(inspector).toContainText("signals.xyzzy");
  await expect(inspector).toContainText("Unsupported / unknown");
  await page.getByRole("button", { name: "Focus selected object" }).click();
  await expect(inspector).toContainText("Focused");
  await expect(page.locator("body")).not.toContainText("/home/");
  await expectNoSeriousAxeViolations(page);
  await page
    .getByRole("heading", { name: "phase5-fixture island" })
    .evaluate((element) =>
      element.parentElement?.scrollIntoView({ block: "start" }),
    );
  await expect(page).toHaveScreenshot("phase5-island-desktop.png", {
    animations: "disabled",
    maxDiffPixelRatio: CROSS_RUN_VISUAL_DIFF_RATIO,
  });

  const canvas = page.getByTestId("repository-canvas").locator("canvas");
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  await canvas.click({
    position: {
      x: (canvasBox?.width ?? 1) * 0.42,
      y: (canvasBox?.height ?? 1) * 0.46,
    },
  });
  await expect(inspector).not.toContainText("signals.xyzzy");

  await canvas.dispatchEvent("webglcontextlost");
  await expect(page.getByTestId("webgl-fallback")).toContainText(
    "context lost",
  );
  await page
    .getByLabel("Search packages, directories, and files")
    .fill("main.ts");
  await page.getByRole("treeitem", { name: /main\.ts/ }).focus();
  await page.keyboard.press("Enter");
  await expect(inspector).toContainText("main.ts");
  await expect(inspector).toContainText("Focused");
});

test("absolute object paths are redacted from the rendered inspector", async ({
  page,
}) => {
  await seedAvatar(page);
  await page.goto("/?fixture=phase5-paths&webgl=off");
  await openPanel(page, "World");
  await page
    .getByLabel("Search packages, directories, and files")
    .fill("signals.xyzzy");
  await page.getByRole("treeitem", { name: /signals\.xyzzy/ }).click();
  const inspector = page.getByLabel("Selected object inspector");
  await expect(inspector).toContainText("Not applicable");
  await expect(inspector).not.toContainText("server\\share");
  await expect(page.locator("body")).not.toContainText("private\\repo");
});

test("reduced motion skips transitions and completes typewriter immediately", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Begin identification" }).click();
  await expect(page.getByTestId("identify-transition")).toHaveCount(0);
  await expect(page.getByTestId("avatar-preview")).toBeVisible();
  await page.getByLabel("Required agent name").fill("Codex");
  await page
    .getByRole("button", { name: "Save avatar and enter World" })
    .click();
  await expect(page.getByTestId("world-entry-transition")).toHaveCount(0);
  await expect(page.getByTestId("typewriter-line")).toHaveAttribute(
    "data-state",
    "complete",
  );
});

test("keyboard-only navigation searches, selects, focuses, closes, and edits Settings", async ({
  page,
}) => {
  await seedAvatar(page);
  await page.goto("/?fixture=phase5&webgl=off");
  const world = page.getByRole("button", { name: "World", exact: true });
  await world.focus();
  await page.keyboard.press("Enter");
  const search = page.getByLabel("Search packages, directories, and files");
  await search.focus();
  await page.keyboard.type("xyzzy");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  const inspector = page.getByLabel("Selected object inspector");
  await expect(inspector).toContainText("signals.xyzzy");
  await expect(inspector).toContainText("Focused");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "phase5-fixture island" }),
  ).toHaveCount(0);

  const settings = page.getByRole("button", { name: "Settings", exact: true });
  await settings.focus();
  await page.keyboard.press("Enter");
  const dog = page.getByRole("radio", { name: "Dog", exact: true });
  await dog.focus();
  await page.keyboard.press("Space");
  const save = page.getByRole("button", {
    name: "Save avatar changes",
  });
  await save.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Avatar profile updated locally/)).toBeVisible();
});

test("disabled/creation-failed fallback, reduced motion, high contrast, and mobile overflow remain complete", async ({
  page,
}) => {
  await seedAvatar(page);
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?fixture=phase5&webgl=off");
  await openPanel(page, "World");
  await expect(page.getByTestId("webgl-fallback")).toContainText("disabled");
  await page
    .getByLabel("Search packages, directories, and files")
    .fill("signals");
  await page.getByRole("treeitem", { name: /signals\.xyzzy/ }).click();
  await page.getByRole("button", { name: "Focus selected object" }).click();
  await expect(page.getByLabel("Selected object inspector")).toContainText(
    "Focused",
  );
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  const cursorDuration = await page
    .getByTestId("inline-cursor")
    .evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).animationDuration),
    );
  expect(cursorDuration).toBeLessThanOrEqual(0.001);
  await expect(page).toHaveScreenshot("phase5-fallback-mobile.png", {
    animations: "disabled",
    maxDiffPixelRatio: CROSS_RUN_VISUAL_DIFF_RATIO,
  });

  await page.goto("/?fixture=phase5&webgl=fail");
  await openPanel(page, "World");
  await expect(page.getByTestId("webgl-fallback")).toContainText(
    "creation failed",
  );
});

test("10k fixture prepares, renders, searches, and selects without 10k DOM rows", async ({
  page,
}, testInfo) => {
  await seedAvatar(page);
  await page.goto("/?fixture=phase5-10k");
  const renderStarted = performance.now();
  await openPanel(page, "World");
  const measurement = page.getByTestId("instance-measurement");
  await expect(measurement).toContainText("10,001 instanced objects prepared", {
    timeout: 15_000,
  });
  await expect(page.getByTestId("repository-canvas")).toBeVisible();
  const interactiveRenderMs = performance.now() - renderStarted;
  const preparationMs = Number(
    await measurement.getAttribute("data-preparation-ms"),
  );
  expect(preparationMs).toBeLessThan(250);
  expect(await page.getByRole("treeitem").count()).toBeLessThanOrEqual(160);
  const interactionStarted = performance.now();
  await page
    .getByLabel("Search packages, directories, and files")
    .fill("fixture-09999.unknown");
  await page.getByRole("treeitem", { name: /fixture-09999\.unknown/ }).click();
  await page.getByRole("button", { name: "Focus selected object" }).click();
  await expect(page.getByLabel("Selected object inspector")).toContainText(
    "Focused",
  );
  const selectionMs = performance.now() - interactionStarted;
  await testInfo.attach("phase5-10k-browser-measurement.json", {
    body: Buffer.from(
      JSON.stringify(
        {
          instances: 10_001,
          preparationMs,
          interactiveRenderMs,
          selectionMs,
          semanticRows: 160,
        },
        null,
        2,
      ),
    ),
    contentType: "application/json",
  });
});
