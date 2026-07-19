import { expect, test } from "@playwright/test";

test("runs the visible numbered start, cancel, and review flow", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/");

  await expect(page.getByText("Phase 2 · Local authority")).toBeVisible();
  await expect(page.getByText("Network scope: loopback")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Step 1 — Start demo operation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Step 2 — Cancel current operation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Step 3 — Review result" }),
  ).toBeVisible();

  const start = page.getByRole("button", { name: "Start demo operation" });
  const cancel = page.getByRole("button", { name: "Cancel current operation" });
  await expect(start).toBeEnabled();
  await expect(start).toHaveCSS("background-color", "rgb(37, 99, 235)");
  await expect(cancel).toBeDisabled();
  await expect(cancel).toHaveCSS("background-color", "rgb(75, 85, 99)");
  await expect(
    page.getByText("Current operation", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Previous operation", { exact: true }),
  ).toBeVisible();

  await start.click();
  await expect(page.getByTestId("current-operation")).toContainText("running");
  await expect(cancel).toBeEnabled();
  await expect(cancel).toHaveCSS("background-color", "rgb(37, 99, 235)");
  await cancel.click();
  await expect(page.getByTestId("current-operation")).toContainText(
    "cancelled",
  );
  await expect(page.getByTestId("current-operation")).toContainText(
    "Demo operation cancelled",
  );

  await start.click();
  await expect(page.getByTestId("previous-operation")).toContainText(
    "cancelled",
  );
  await expect(page.getByTestId("current-operation")).toContainText("running");
  await expect(page.getByTestId("current-operation")).toContainText(
    "succeeded",
    { timeout: 5_000 },
  );
  await expect(page.getByTestId("current-operation")).toContainText(
    "Demo operation completed",
  );
  await expect(cancel).toBeDisabled();

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(browserErrors).toEqual([]);
  await page.screenshot({
    path: "test-results/phase2-operator-flow.png",
    fullPage: true,
  });
});
