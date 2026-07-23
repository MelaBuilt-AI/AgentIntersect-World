import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { openPanel, seedConfiguredAvatar } from "./helpers.js";

test("Phase 16 two-agent coordination is truthful, accessible, and bounded", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: 2,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => null,
    });
  });
  await seedConfiguredAvatar(page);
  await page.goto("/?fixture=phase16-coordination");
  await openPanel(page, "Agents");

  const panel = page.getByLabel("Phase 16 multi-agent coordination");
  await expect(panel).toBeVisible();
  await expect(panel.locator(".coordination-agent-card")).toHaveCount(2);
  await expect(panel.getByText("Mr Fluff", { exact: true })).toBeVisible();
  await expect(panel.getByText("Beans", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Follow Beans" }).click();
  await expect(panel.getByText("Following Beans")).toBeVisible();
  await expect(
    panel.getByText("Interest contention · not a Git conflict"),
  ).toBeVisible();
  await expect(panel.getByText("Git conflict · merge not run")).toBeVisible();
  await expect(
    panel.getByText("Inert visible record · no authority"),
  ).toBeVisible();
  await expect(panel.locator(".coordination-actions > li")).toHaveCount(14);

  const reconcile = panel.getByRole("button", {
    name: "10. Validate worktree bindings",
  });
  await expect(reconcile).toBeEnabled();
  await reconcile.click();
  await expect(
    page.getByText("10. Fixture worktree bindings reconciled."),
  ).toBeVisible();

  const approve = panel.getByRole("button", {
    name: "12. Approve candidate (merge not run)",
  });
  await expect(approve).toBeEnabled();
  await approve.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("12. Fixture candidate approved. Merge was not run."),
  ).toBeVisible();
  await expect(
    panel.getByText("operator-approved · merge not run"),
  ).toBeVisible();

  const cleanup = panel.getByRole("button", {
    name: "13. Preview cleanup",
  });
  await expect(cleanup).toBeEnabled();
  await cleanup.click();
  await expect(
    page.getByText("13. Fixture cleanup previewed. Nothing was deleted."),
  ).toBeVisible();

  const cancel = panel.getByRole("button", {
    name: "14. Cancel coordination",
  });
  await expect(cancel).toBeEnabled();
  await cancel.click();
  await expect(
    page.getByText("14. Fixture coordination cancelled. Owned processes: 0."),
  ).toBeVisible();
  await expect(cancel).toBeDisabled();

  const disabled = panel.getByRole("button", {
    name: "2. Bind Mr Fluff",
  });
  await expect(disabled).toBeDisabled();
  await expect(disabled).toHaveClass(/coordination-primary--disabled/);
  await expect(cleanup).toHaveClass(/coordination-primary--enabled/);

  expect(
    await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    })),
  ).toEqual({ viewport: 390, document: 390, body: 390 });

  const accessibility = await new AxeBuilder({ page })
    .include(".coordination-panel")
    .analyze();
  expect(
    accessibility.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
});
