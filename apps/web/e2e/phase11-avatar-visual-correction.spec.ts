import { expect, test } from "@playwright/test";

test("corrected 3D editor renders connected human, dog, and cat choices with activatable controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Begin identification" }).click();
  await page.getByLabel("Required agent name").fill("Phase Eleven");
  const preview = page.getByTestId("avatar-preview");
  await expect(preview.locator("canvas")).toBeVisible();
  await expect(preview.locator(".avatar-nameplate")).toHaveText("Phase Eleven");
  await page.waitForTimeout(600);
  await preview.screenshot({ path: "/tmp/aiw-phase11-correction-human.png" });

  const dog = page.getByRole("radio", { name: "Dog", exact: true });
  await dog.check();
  await expect(dog).toBeChecked();
  await page
    .getByRole("group", { name: "Hands" })
    .getByRole("radio", { name: "Paws", exact: true })
    .check();
  await page
    .getByRole("group", { name: "Feet" })
    .getByRole("radio", { name: "Paws", exact: true })
    .check();
  await page.getByRole("radio", { name: "Short", exact: true }).check();
  await page.getByRole("radio", { name: "Dog curled", exact: true }).check();
  await page.getByRole("radio", { name: "Muzzle", exact: true }).check();
  await page.getByRole("radio", { name: "Claude", exact: true }).check();
  await page.waitForTimeout(350);
  await preview.screenshot({ path: "/tmp/aiw-phase11-correction-dog.png" });

  const cat = page.getByRole("radio", { name: "Cat", exact: true });
  await cat.focus();
  await page.keyboard.press("Space");
  await expect(cat).toBeChecked();
  await page
    .getByRole("group", { name: "Hands" })
    .getByRole("radio", { name: "Clawed paws", exact: true })
    .check();
  await page
    .getByRole("group", { name: "Feet" })
    .getByRole("radio", { name: "Clawed paws", exact: true })
    .check();
  await page.getByRole("radio", { name: "Long", exact: true }).check();
  await page.getByRole("radio", { name: "Cat curled", exact: true }).check();
  // Keep the live proof face unobscured; the evidence board proves the mask module.
  await page.getByRole("radio", { name: "Solid", exact: true }).check();
  await page.getByRole("radio", { name: "Hermes", exact: true }).check();
  await page.waitForTimeout(350);
  await preview.screenshot({ path: "/tmp/aiw-phase11-correction-cat.png" });

  await page.getByRole("radio", { name: "OpenClaw", exact: true }).check();
  await page.evaluate(() => window.scrollTo(0, 0));
  await preview.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await preview.screenshot({
    path: "/tmp/aiw-phase11-correction-openclaw.png",
  });

  const nameplate = await preview.locator(".avatar-nameplate").boundingBox();
  const canvas = await preview.locator("canvas").boundingBox();
  expect(nameplate).not.toBeNull();
  expect(canvas).not.toBeNull();
  expect(nameplate!.y).toBeLessThan(canvas!.y + canvas!.height * 0.2);
  expect(errors).toEqual([]);
});
