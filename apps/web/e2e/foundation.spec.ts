import { expect, test } from "@playwright/test";

import { enterDashboard, openPanel } from "./helpers.js";

test("preserves the foundation identity and live local-server health", async ({
  page,
}) => {
  await enterDashboard(page);

  await expect(
    page.getByRole("heading", {
      name: "One local operator. One living repository island.",
    }),
  ).toBeVisible();
  await openPanel(page, "World");
  const authority = page.locator(".server-status");
  await expect(authority).toContainText("Local server healthy");
  await expect(authority).toContainText("Node 24");
});
