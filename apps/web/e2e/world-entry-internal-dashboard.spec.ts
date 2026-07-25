import { expect, test } from "@playwright/test";

import { seedConfiguredAvatar } from "./helpers.js";

test("explicit developer flag and exact internal path load the local dashboard", async ({
  page,
}) => {
  await seedConfiguredAvatar(page, "Mela");
  await page.goto("/internal/dashboard");
  await expect(
    page.getByRole("heading", {
      name: "One local operator. One living repository island.",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("AgentIntersect World home")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Internal dashboard unavailable" }),
  ).toHaveCount(0);
});
