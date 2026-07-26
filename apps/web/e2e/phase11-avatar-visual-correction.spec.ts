import { expect, test, type Locator, type Page } from "@playwright/test";

import { selectAvatarCosmeticQuality } from "./helpers.js";

async function expectAvatarReady(
  preview: Locator,
  selection: { readonly species: string; readonly shirt: string },
) {
  const renderer = preview.locator(".avatar-kit-canvas");
  await expect(renderer).toHaveAttribute(
    "data-avatar-species",
    selection.species,
  );
  await expect(renderer).toHaveAttribute("data-avatar-shirt", selection.shirt);
  await expect(renderer).toHaveAttribute("data-avatar-render-ready", "true");
  await expect(renderer.locator("canvas")).toBeVisible();
}

async function selectRadioWithKeyboard(page: Page, radio: Locator) {
  await radio.focus();
  await page.keyboard.press("Space");
  await expect(radio).toBeChecked();
}

test("corrected 3D editor renders connected human, dog, and cat choices with activatable controls", async ({
  page,
}) => {
  // Full-quality GLB proof uses software rendering on two-CPU CI runners.
  // Keep the product assertions strict while bounding only the outer watchdog.
  test.setTimeout(120_000);
  await selectAvatarCosmeticQuality(page, "full");
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/internal/dashboard");
  await page.getByRole("button", { name: "Create Avatar" }).click();
  await page.getByLabel("Required agent name").fill("Phase Eleven");
  const preview = page.getByTestId("avatar-preview");
  await expectAvatarReady(preview, { species: "human", shirt: "Codex" });
  await expect(preview.locator(".avatar-nameplate")).toHaveText("Phase Eleven");
  await preview.screenshot({ path: "/tmp/aiw-phase11-correction-human.png" });

  const dog = page.getByRole("radio", { name: "Dog", exact: true });
  await selectRadioWithKeyboard(page, dog);
  await selectRadioWithKeyboard(
    page,
    page
      .getByRole("group", { name: "Hands" })
      .getByRole("radio", { name: "Paws", exact: true }),
  );
  await selectRadioWithKeyboard(
    page,
    page
      .getByRole("group", { name: "Feet" })
      .getByRole("radio", { name: "Paws", exact: true }),
  );
  await selectRadioWithKeyboard(
    page,
    page.getByRole("radio", { name: "Short", exact: true }),
  );
  await selectRadioWithKeyboard(
    page,
    page.getByRole("radio", { name: "Dog curled", exact: true }),
  );
  await selectRadioWithKeyboard(
    page,
    page.getByRole("radio", { name: "Muzzle", exact: true }),
  );
  await selectRadioWithKeyboard(
    page,
    page.getByRole("radio", { name: "Claude", exact: true }),
  );
  await expectAvatarReady(preview, { species: "dog", shirt: "Claude" });
  await preview.screenshot({ path: "/tmp/aiw-phase11-correction-dog.png" });

  const cat = page.getByRole("radio", { name: "Cat", exact: true });
  await selectRadioWithKeyboard(page, cat);
  await selectRadioWithKeyboard(
    page,
    page
      .getByRole("group", { name: "Hands" })
      .getByRole("radio", { name: "Clawed paws", exact: true }),
  );
  await selectRadioWithKeyboard(
    page,
    page
      .getByRole("group", { name: "Feet" })
      .getByRole("radio", { name: "Clawed paws", exact: true }),
  );
  await selectRadioWithKeyboard(
    page,
    page.getByRole("radio", { name: "Long", exact: true }),
  );
  await selectRadioWithKeyboard(
    page,
    page.getByRole("radio", { name: "Cat curled", exact: true }),
  );
  // Keep the live proof face unobscured; the evidence board proves the mask module.
  const solid = page.getByRole("radio", { name: "Solid", exact: true });
  await selectRadioWithKeyboard(page, solid);
  const hermes = page.getByRole("radio", { name: "Hermes", exact: true });
  await selectRadioWithKeyboard(page, hermes);
  await expectAvatarReady(preview, { species: "cat", shirt: "Hermes" });
  await preview.screenshot({ path: "/tmp/aiw-phase11-correction-cat.png" });

  const openClaw = page.getByRole("radio", {
    name: "OpenClaw",
    exact: true,
  });
  await selectRadioWithKeyboard(page, openClaw);
  await expectAvatarReady(preview, { species: "cat", shirt: "OpenClaw" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await preview.scrollIntoViewIfNeeded();
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
