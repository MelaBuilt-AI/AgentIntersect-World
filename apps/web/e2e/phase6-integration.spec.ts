import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { openPanel } from "./helpers.js";

const profile = {
  version: 1,
  body: "female",
  accent: "cyan",
  showHalo: true,
  showHelmet: true,
  showFace: true,
  showEyes: true,
  showGlow: true,
};

async function seed(page: Page) {
  await page.addInitScript(
    (value) =>
      localStorage.setItem("aiw.avatar-appearance.v1", JSON.stringify(value)),
    profile,
  );
}

test("ready integration drives selected harness while execution stays disabled", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/?fixture=phase6-ready");
  await expect(
    page.getByText(/Selected harness read status: ready/),
  ).toBeVisible();
  await openPanel(page, "Activity");
  const panel = page.locator("[data-integration-status=ready]");
  await expect(
    panel.getByRole("heading", { name: "Phase 6 observation-only" }),
  ).toBeVisible();
  await expect(panel.getByText("Current observation")).toBeVisible();
  await expect(panel.getByText("Previous / replayed:")).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Start selected harness" }),
  ).toBeDisabled();
  await expect(
    panel.getByRole("button", { name: "Advance phase" }),
  ).toBeDisabled();
});

for (const fixture of ["offline", "mismatch", "replayed", "hostile"] as const) {
  test(`${fixture} integration state is truthful, bounded, and accessible`, async ({
    page,
  }) => {
    await seed(page);
    await page.goto(`/?fixture=phase6-${fixture}`);
    await openPanel(page, "Activity");
    const expectedStatus =
      fixture === "replayed" || fixture === "hostile" ? "ready" : fixture;
    const panel = page.locator(`[data-integration-status=${expectedStatus}]`);
    await expect(panel).toBeVisible();
    await expect(
      panel.getByText(expectedStatus, { exact: true }),
    ).toBeVisible();
    if (fixture === "offline")
      await expect(
        panel.getByText("Nothing has been observed yet."),
      ).toBeVisible();
    if (fixture === "mismatch" || fixture === "replayed")
      await expect(
        panel.getByText(/Previous \/ replayed last-good/),
      ).toBeVisible();
    if (fixture === "hostile") {
      await expect(page.locator("body")).not.toContainText("secret-value");
      await expect(page.locator("body")).not.toContainText("/home/operator");
    }
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter(
        (item) => item.impact === "serious" || item.impact === "critical",
      ),
    ).toEqual([]);
  });
}

test("mobile integration panel has no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await seed(page);
  await page.goto("/?fixture=phase6-replayed");
  await openPanel(page, "Activity");
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  await expect(
    page.getByRole("button", { name: "Start selected harness" }),
  ).toBeDisabled();
});
