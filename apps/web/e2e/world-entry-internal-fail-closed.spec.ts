import { expect, test } from "@playwright/test";

import { seedConfiguredAvatar } from "./helpers.js";

test("direct internal dashboard access fails closed without the developer flag", async ({
  page,
}) => {
  await seedConfiguredAvatar(page, "Mela");
  await page.goto("/internal/dashboard");
  await expect(
    page.getByRole("heading", { name: "Internal dashboard unavailable" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Agents" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "One local operator. One living repository island.",
    }),
  ).toHaveCount(0);
});
