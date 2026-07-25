import { expect, test } from "@playwright/test";

import { openPanel, seedConfiguredAvatar } from "./helpers.js";

test("Phase 8 evidence remains authoritative in reduced-motion DOM fallback and selects the repository object", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedConfiguredAvatar(page);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/internal/dashboard?fixture=phase8-evidence&webgl=off");
  await openPanel(page, "Evidence");
  const panel = page.getByRole("region", { name: "Evidence panel" });
  const current = panel.getByRole("article", { name: "Current evidence" });
  await expect(current).toBeVisible();
  await expect(
    panel.getByRole("article", { name: "Previous evidence" }),
  ).toBeVisible();
  await expect(current.getByText("job-phase8", { exact: true })).toBeVisible();
  await expect(current.getByText("run-phase8", { exact: true })).toBeVisible();
  await expect(
    current.getByText("verified · passed", { exact: true }),
  ).toBeVisible();
  await expect(
    current.getByText("reported-unverified", { exact: true }),
  ).toBeVisible();
  await current
    .getByText("Sanitized bounded text diff", { exact: true })
    .click();
  await expect(
    current.getByText("[REDACTED: secret-like content]", { exact: false }),
  ).toBeVisible();
  await expect(
    panel
      .getByRole("button", { name: "Reported path has no repository object" })
      .first(),
  ).toBeDisabled();

  await panel
    .getByRole("button", { name: "Select src/main.ts in repository" })
    .first()
    .click();
  await expect(page.getByRole("region", { name: "World panel" })).toBeVisible();
  await expect(page.getByTestId("webgl-fallback")).toContainText(
    "every repository action remains available",
  );
  const selected = page.getByRole("treeitem", { name: /main\.ts/ });
  await expect(selected).toHaveAttribute("aria-selected", "true");
  await expect(selected).toContainText("modified · observed-in-window");
  await expect(page.getByLabel("Selected object inspector")).toContainText(
    "Focused",
  );
  await expect(page.getByLabel("Selected object inspector")).toContainText(
    "modified · observed-in-window",
  );

  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  expect(consoleErrors).toEqual([]);
});
