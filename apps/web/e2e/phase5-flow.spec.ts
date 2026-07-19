import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { openPanel } from "./helpers.js";

const savedAvatar = {
  version: 1,
  body: "female",
  accent: "cyan",
  showHalo: true,
  showHelmet: true,
  showFace: true,
  showEyes: true,
  showGlow: true,
};

async function seedAvatar(page: Page) {
  await page.addInitScript((profile) => {
    localStorage.setItem("aiw.avatar-appearance.v1", JSON.stringify(profile));
  }, savedAvatar);
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
  await page.goto("/");
  await expect(page.getByTestId("identify-opening")).toBeVisible();
  await expect(page.getByText("identify_", { exact: false })).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  await expect(page).toHaveScreenshot("phase5-identify-desktop.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.02,
  });
  await page.getByRole("button", { name: "Begin identification" }).click();
  await expect(page.getByTestId("identify-transition")).toBeVisible();
  await expect(page.getByTestId("avatar-preview")).toBeVisible();
  await expect(page).toHaveScreenshot("phase5-avatar-builder-desktop.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.02,
  });
  await page.getByRole("radio", { name: "male", exact: true }).check();
  await page.getByRole("radio", { name: "violet", exact: true }).check();
  await page.getByLabel("Hair / helmet").uncheck();
  await expect(
    page.getByTestId("avatar-preview").locator(".avatar-preview__layer--head"),
  ).toHaveAttribute("src", /avatar-puppet-male-head\.png$/);
  await page
    .getByRole("button", { name: "Save appearance and enter World" })
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
  await expect(page.getByText("hermes selected only")).toBeVisible();

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
  await page.getByRole("radio", { name: "female", exact: true }).check();
  await page
    .getByRole("button", { name: "Save appearance and enter World" })
    .click();
  await expect(
    page.getByText("Avatar appearance updated locally."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close Settings panel" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("phase5-dashboard-desktop.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.02,
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
  await expect(page).toHaveScreenshot("phase5-island-desktop.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.03,
  });

  const canvas = page.locator("canvas");
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  await canvas.click({
    position: {
      x: (canvasBox?.width ?? 1) * 0.24,
      y: (canvasBox?.height ?? 1) * 0.24,
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
  await page
    .getByRole("button", { name: "Save appearance and enter World" })
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
  const male = page.getByRole("radio", { name: "male", exact: true });
  await male.focus();
  await page.keyboard.press("Space");
  const save = page.getByRole("button", {
    name: "Save appearance and enter World",
  });
  await save.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Avatar appearance updated locally."),
  ).toBeVisible();
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
    maxDiffPixelRatio: 0.03,
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
