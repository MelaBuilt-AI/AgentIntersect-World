import type { Page } from "@playwright/test";

export async function selectAvatarCosmeticQuality(
  page: Page,
  quality: "full" | "constrained",
) {
  await page.addInitScript((selectedQuality) => {
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: selectedQuality === "full" ? 8 : 2,
    });
  }, quality);
}

export async function enterDashboard(page: Page, path = "/") {
  await page.goto(path);
  const identify = page.getByTestId("identify-opening");
  if (await identify.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Begin identification" }).click();
    await page.getByLabel("Required agent name").fill("Codex");
    await page
      .getByRole("button", { name: "Save avatar and enter World" })
      .click();
  }
}

export async function openPanel(page: Page, name: string) {
  const trigger = page.getByRole("button", { name, exact: true });
  if ((await trigger.getAttribute("aria-expanded")) !== "true")
    await trigger.click();
}

export async function seedConfiguredAvatar(page: Page, agentName = "Codex") {
  await page.addInitScript((name) => {
    const current = {
      schema: "aiw.avatar/0.11",
      profileId: "avatar_0123456789abcdef0123456789abcdef",
      agentRef: null,
      agentName: name,
      species: "human",
      head: "round",
      hands: "hands",
      feet: "feet",
      fur: "none",
      tail: "none",
      markings: "solid",
      bodyColor: "warm-light",
      shirt: "Codex",
      mappingConsent: false,
      sourceDisclosure: "manual-local-input",
      createdAt: "2026-07-20T12:00:00.000Z",
      updatedAt: "2026-07-20T12:00:00.000Z",
    };
    localStorage.setItem(
      "aiw.avatar.profile.0.11",
      JSON.stringify({
        schema: "aiw.avatar-store/0.11",
        current,
        previous: null,
      }),
    );
  }, agentName);
}
