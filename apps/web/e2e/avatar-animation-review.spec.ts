import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("direct raw clip playback and review receipt remain technical review-only evidence", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/internal/avatar-animation-review");

  await expect(
    page.getByRole("heading", { name: "Avatar animation review" }),
  ).toBeVisible();
  await expect(page.getByTestId("review-model-id")).toHaveText("cat-agent-01");
  const agentModel = page.getByRole("combobox", { name: /^Agent model/u });
  await expect(agentModel).toHaveValue("cat-agent-01");
  await agentModel.selectOption("robot-agent-05");
  await expect(page.getByTestId("review-model-id")).toHaveText(
    "robot-agent-05",
  );
  await agentModel.selectOption("cat-agent-01");
  await expect(page.getByTestId("review-runtime-truth")).toContainText(
    "review-only",
  );
  await expect(page.getByTestId("review-playback-state")).toHaveText("paused");
  await expect(page.getByTestId("review-canvas")).toHaveAttribute(
    "data-review-render-state",
    "ready",
    { timeout: 30_000 },
  );

  const playbackSeconds = async () => {
    const value = await page
      .getByTestId("review-sample-position")
      .textContent();
    return Number(value?.match(/· ([0-9.]+) s/u)?.[1] ?? Number.NaN);
  };
  await page.getByRole("button", { name: "Sample 0%" }).click();
  const frameAtStart = await page.getByTestId("review-canvas").screenshot();
  await page.getByRole("button", { name: "Start clip" }).click();
  await expect(page.getByTestId("review-playback-state")).toHaveText("playing");
  await expect.poll(playbackSeconds).toBeGreaterThan(0.1);
  await page.getByRole("button", { name: "Pause clip" }).click();
  await expect(page.getByTestId("review-playback-state")).toHaveText("paused");
  const pausedSeconds = await playbackSeconds();
  await page.waitForTimeout(250);
  expect(await playbackSeconds()).toBe(pausedSeconds);
  await page.getByRole("button", { name: "Sample 50%" }).click();
  await expect(page.getByTestId("review-sample-position")).toContainText("50%");
  const frameAtMidpoint = await page.getByTestId("review-canvas").screenshot();
  expect(frameAtMidpoint.equals(frameAtStart)).toBe(false);
  await page.getByRole("button", { name: "Replay clip" }).click();
  await expect(page.getByTestId("review-playback-state")).toHaveText("playing");
  await page.getByRole("button", { name: "Pause clip" }).click();

  for (const semantic of [
    "Jump",
    "Dance",
    "Clap",
    "Cheer",
    "Wave",
    "Bow",
    "Agree",
    "Angry",
    "Laugh",
  ])
    await page.getByLabel(`${semantic} verdict`).selectOption("ambiguous");

  const receipt = page.getByRole("textbox", {
    name: "Review receipt",
    exact: true,
  });
  await expect(receipt).toHaveValue(/"modelId": "cat-agent-01"/u);
  await expect(receipt).not.toHaveValue(/sessionId/u);
  const receiptText = await receipt.inputValue();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download receipt" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(
    "avatar-animation-review-cat-agent-01.json",
  );
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  expect(await readFile(downloadPath!, "utf8")).toBe(receiptText);
  await page
    .getByLabel("Import review receipt")
    .fill(
      receiptText.replace(
        /"manifestSha256": "[a-f0-9]{64}"/u,
        `"manifestSha256": "${"0".repeat(64)}"`,
      ),
    );
  await page.getByRole("button", { name: "Validate imported receipt" }).click();
  await expect(page.getByRole("alert")).toContainText("refused");
  await page.getByLabel("Import review receipt").fill(receiptText);
  await page.getByRole("button", { name: "Validate imported receipt" }).click();
  await expect(page.getByText(/Receipt valid for cat-agent-01/u)).toBeVisible();
  const screenshot = testInfo.outputPath("avatar-animation-review.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach("avatar-animation-review", {
    path: screenshot,
    contentType: "image/png",
  });

  await page.getByLabel("Review target").selectOption("user");
  const userModel = page.getByRole("combobox", {
    name: /^User model/u,
  });
  await expect(userModel).toHaveValue("");
  await userModel.selectOption("user-female-03");
  await expect(page.getByTestId("review-model-id")).toHaveText(
    "user-female-03",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    })),
  ).toEqual({ viewport: 390, document: 390, body: 390 });
});
