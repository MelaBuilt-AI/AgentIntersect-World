import type { Page } from "@playwright/test";

export async function enterDashboard(page: Page, path = "/") {
  await page.goto(path);
  const identify = page.getByTestId("identify-opening");
  if (await identify.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Begin identification" }).click();
    await page
      .getByRole("button", { name: "Save appearance and enter World" })
      .click();
  }
}

export async function openPanel(page: Page, name: string) {
  const trigger = page.getByRole("button", { name, exact: true });
  if ((await trigger.getAttribute("aria-expanded")) !== "true")
    await trigger.click();
}
