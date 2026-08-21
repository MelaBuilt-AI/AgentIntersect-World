import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { enterDashboard, openPanel } from "./helpers.js";

let fixtureRoot = "";
let largeRoot = "";

test.beforeAll(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), "aiw-phase3-e2e-repo-"));
  largeRoot = await mkdtemp(join(tmpdir(), "aiw-phase3-e2e-large-"));
  await writeFile(
    join(fixtureRoot, "package.json"),
    JSON.stringify({
      name: "phase3-e2e",
      scripts: { postinstall: "touch SENTINEL_EXECUTED" },
    }),
  );
  await writeFile(join(fixtureRoot, "index.ts"), "export const phase = 3;\n");
  for (let start = 0; start < 2_000; start += 100) {
    await Promise.all(
      Array.from({ length: 100 }, (_, offset) => {
        const index = start + offset;
        return writeFile(
          join(largeRoot, `file-${String(index).padStart(4, "0")}.ts`),
          `export const value${index} = ${index};\n`,
        );
      }),
    );
  }
});

test.afterAll(async () => {
  await Promise.all(
    [fixtureRoot, largeRoot]
      .filter(Boolean)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

const nullGenerationResponse = {
  ok: true,
  data: { generation: null },
  meta: {
    correlationId: "a5cf11a9-754e-4d76-946b-55a77c0eef28",
    schema: "aiw.api/0.3",
  },
};

test("shows loading until a healthy null last-good response is known", async ({
  page,
}) => {
  await page.route("**/api/repository-indexes/current", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ json: nullGenerationResponse });
  });
  await enterDashboard(page);
  await openPanel(page, "Repositories");
  const lastGood = page.getByTestId("last-good-index");
  await expect(lastGood).toContainText("Loading last good generation");
  await expect(lastGood).toContainText("None yet");
});

test("shows an unavailable last-good response without claiming none exists", async ({
  page,
}) => {
  await page.route("**/api/repository-indexes/current", (route) =>
    route.abort("connectionrefused"),
  );
  await enterDashboard(page);
  await openPanel(page, "Repositories");
  const lastGood = page.getByTestId("last-good-index");
  await expect(lastGood.getByRole("alert")).toContainText(
    "Local server unavailable",
  );
  await expect(lastGood).not.toContainText("None yet");
});

test("shows an invalid last-good response and replaces it after a successful index", async ({
  page,
}) => {
  await page.route(
    "**/api/repository-indexes/current",
    (route) => route.fulfill({ json: {} }),
    { times: 1 },
  );
  await enterDashboard(page);
  await openPanel(page, "Repositories");
  const lastGood = page.getByTestId("last-good-index");
  await expect(lastGood.getByRole("alert")).toContainText(
    "Invalid local server response",
  );
  await expect(lastGood).not.toContainText("None yet");

  await page.getByLabel("Repository root").fill(fixtureRoot);
  await page.getByRole("button", { name: "Start index" }).click();
  await expect(lastGood).toContainText("phase3-e2e", { timeout: 10_000 });
  await expect(lastGood.getByRole("alert")).toHaveCount(0);
});

test("indexes, deterministically rescans, cancels, and retains last good", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.route("**/api/agent-sessions/native**", async (route) => {
    await route.fulfill({
      json: {
        ok: true,
        data: [],
        meta: {
          correlationId: "22222222-2222-4222-8222-222222222222",
          schema: "aiw.api/0.3",
        },
      },
    });
  });
  await enterDashboard(page);
  await openPanel(page, "Repositories");

  const input = page.getByLabel("Repository root");
  const cancel = page.getByRole("button", { name: "Cancel current index" });
  await input.fill(fixtureRoot);
  const start = page.getByRole("button", { name: /^(?:Start index|Rescan)$/ });
  await expect(start).toBeEnabled();
  await expect(start).toHaveCSS("background-color", "rgb(37, 99, 235)");
  await expect(cancel).toBeDisabled();
  await expect(cancel).toHaveCSS("background-color", "rgb(75, 85, 99)");
  await start.click();
  await expect(page.getByTestId("current-index")).toContainText("succeeded", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("last-good-index")).toContainText("phase3-e2e");
  const fingerprint = await page
    .getByTestId("last-good-index")
    .locator("code")
    .textContent();

  await page.getByRole("button", { name: "Rescan" }).click();
  await expect(page.getByTestId("current-index")).toContainText("succeeded", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("last-good-index").locator("code")).toHaveText(
    fingerprint ?? "",
  );

  await input.fill(largeRoot);
  await page.getByRole("button", { name: "Rescan" }).click();
  await expect(cancel).toBeEnabled({ timeout: 5_000 });
  await page.getByRole("button", { name: "Agents", exact: true }).click();
  await expect(page.getByTestId("current-index")).toHaveCount(0);
  await openPanel(page, "Repositories");
  await expect(page.getByTestId("current-index")).toContainText("running");
  await expect(cancel).toHaveCSS("background-color", "rgb(37, 99, 235)");
  await cancel.click();
  await expect(page.getByTestId("current-index")).toContainText("cancelled");
  await expect(page.getByTestId("last-good-index").locator("code")).toHaveText(
    fingerprint ?? "",
  );
  await expect(
    access(join(fixtureRoot, "SENTINEL_EXECUTED")),
  ).rejects.toMatchObject({ code: "ENOENT" });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(browserErrors).toEqual([]);
});
