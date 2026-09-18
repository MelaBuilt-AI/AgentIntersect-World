import { expect, test } from "@playwright/test";

test("optional voice setup needs explicit consent and never enables a microphone", async ({
  page,
}) => {
  let installs = 0;
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () => {
          throw new Error("setup must not request microphone");
        },
      },
    });
  });
  await page.route("**/api/voice/setup", async (route) => {
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toEqual({ consent: true });
      installs++;
    }
    await route.fulfill({
      json: {
        ok: true,
        data: {
          state: installs ? "ready" : "not-installed",
          platform: "linux-x64",
          downloadBytes: 157343446,
          message: installs
            ? "Local voice installed and verified. Microphone remains off."
            : "Optional local English transcription is not installed.",
        },
      },
    });
  });
  await page.route("**/api/agent-setup", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          schema: "aiw.agent-setup/1",
          completed: false,
          registrations: [],
        },
      },
    }),
  );
  await page.goto("/");
  await page.getByText("Local voice setup (optional)", { exact: true }).click();
  const install = page.getByRole("button", {
    name: "Install local voice",
    exact: true,
  });
  await expect(install).toBeDisabled();
  expect(installs).toBe(0);
  await page
    .getByLabel("I agree to download and install local voice on this computer")
    .check();
  await install.click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Local voice installed and verified" }),
  ).toBeVisible();
  expect(installs).toBe(1);
  await expect(
    page.getByRole("button", { name: "Continue to Agent Select" }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/aiw-pr15-voice-setup.png" });
});
