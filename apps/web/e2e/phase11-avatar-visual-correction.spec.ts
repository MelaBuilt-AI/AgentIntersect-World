import { expect, test } from "@playwright/test";

test("text-only imported editor keeps stance and save controls keyboard-activatable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/internal/dashboard?avatar3d=text");
  await page.getByRole("button", { name: "Create Avatar" }).click();
  await page.getByLabel("Required agent name").fill("Phase Eleven");
  const preview = page.getByTestId("avatar-preview");
  await expect(
    page.getByRole("checkbox", {
      name: "Text-only mode (does not load the GLB)",
    }),
  ).toBeChecked();
  await expect(preview.locator("canvas")).toHaveCount(0);
  await expect(preview).toContainText("WebGL unavailable");

  const model = page.getByRole("button", {
    name: "Open User Female 3 3D preview",
  });
  await model.focus();
  await page.keyboard.press("Enter");
  await expect(model).toHaveAttribute("aria-pressed", "true");

  const completeAvatar = page.getByRole("button", {
    name: "Use Complete Avatar",
  });
  await completeAvatar.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Save avatar and enter World" }),
  ).toBeEnabled();
  await expect(preview).toContainText("Phase Eleven");
  await expect(preview).toContainText("Complete User Female 3");
  await expect(preview.locator("canvas")).toHaveCount(0);
  expect(errors).toEqual([]);
});
