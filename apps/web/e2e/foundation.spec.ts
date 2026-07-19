import { expect, test } from "@playwright/test";

test("preserves the foundation identity and live local-server health", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "AgentIntersect World" }),
  ).toBeVisible();
  await expect(page.getByText("Phase 3 · Local authority")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Local server healthy");
  await expect(page.getByRole("status")).toContainText("Node 24");
});
