import { expect, test } from "@playwright/test";

test("renders the Phase 1 foundation and live local-server health", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "AgentIntersect World" }),
  ).toBeVisible();
  await expect(
    page.getByText("Phase 1 · Engineering foundation"),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Local server healthy");
  await expect(page.getByRole("status")).toContainText("Node 24");
});
