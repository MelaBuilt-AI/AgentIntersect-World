import { expect, test } from "@playwright/test";

import { openPanel } from "./helpers.js";

const profile = {
  version: 1,
  body: "female",
  accent: "cyan",
  showHalo: true,
  showHelmet: true,
  showFace: true,
  showEyes: true,
  showGlow: true,
};

const request = {
  schema: "aiw.command-intent.request/0.7",
  kind: "worker.enqueue-phase",
  phaseId: "phase_7",
  harness: "codex",
  expectedRevision: "ce8495fcd0963165a9c68b98414a203c4dc25ace",
  fixture: "phase7-disposable-artifact-v1",
};

const baseIntent = {
  schema: "aiw.command-intent/0.7",
  id: "7e8f8590-4d7a-45d5-9ada-e8aa735d60af",
  idempotencyKey: "browser-real-job-1",
  requestFingerprint: "0".repeat(64),
  request,
  state: "confirmed",
  correlationId: "7a726025-40bf-4ee5-a185-243ac0a7bbf8",
  phaseId: "phase_7",
  sessionId: "session-7",
  jobId: "job-7",
  runId: "run-7",
  diagnostics: [
    "The pinned create contract cannot enforce the requested 80k model-token or $1.00 ceiling; no enforcement is claimed.",
  ],
  rawLogRef: "raw-command-logs/intent/create-response.json",
  createdAt: "2026-07-20T12:00:00.000Z",
  updatedAt: "2026-07-20T12:00:00.000Z",
};

test("authorized Phase 7 real-job journey stays one-dispatch and shows fixture result", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(
    (value) =>
      localStorage.setItem("aiw.avatar-appearance.v1", JSON.stringify(value)),
    profile,
  );
  let createCalls = 0;
  let reads = 0;
  await page.route("**/api/commands/intents", async (route) => {
    if (route.request().method() === "POST") {
      createCalls += 1;
      expect(route.request().headers().authorization).toBe(
        "Bearer phase7-browser-command-token",
      );
      expect(route.request().headers()["idempotency-key"]).toBe(
        "browser-real-job-1",
      );
      expect(route.request().postDataJSON()).toEqual(request);
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: { ...baseIntent, lifecycle: "queued" },
          meta: {
            correlationId: "7a726025-40bf-4ee5-a185-243ac0a7bbf8",
            schema: "aiw.api/0.3",
          },
        }),
      });
      return;
    }
    await route.fallback();
  });
  await page.route("**/api/commands/intents/*", async (route) => {
    reads += 1;
    const complete = reads >= 2;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          ...baseIntent,
          lifecycle: complete ? "complete" : "running",
          result: complete
            ? { verification: "passed", note: "offline fixture verified" }
            : undefined,
          artifact: complete
            ? {
                path: "phase7-result.json",
                before: null,
                after: {
                  message: "AgentIntersect World Phase 7 fixture complete",
                  verified: true,
                },
                verification: "passed",
              }
            : undefined,
          updatedAt: complete
            ? "2026-07-20T12:00:02.000Z"
            : "2026-07-20T12:00:01.000Z",
        },
        meta: {
          correlationId: "7a726025-40bf-4ee5-a185-243ac0a7bbf8",
          schema: "aiw.api/0.3",
        },
      }),
    });
  });

  await page.goto("/?fixture=phase7-job");
  await openPanel(page, "Activity");
  const panel = page.getByTestId("phase7-command-panel");
  await expect(
    panel.getByRole("heading", { name: "1. Command authority" }),
  ).toBeVisible();
  await expect(
    panel.getByRole("heading", { name: "2. Validate bounded intent" }),
  ).toBeVisible();
  await expect(
    panel.getByRole("heading", { name: "3. Current and previous status" }),
  ).toBeVisible();
  await expect(
    panel.getByRole("heading", { name: "4. Fixture-only result" }),
  ).toBeVisible();

  await panel
    .getByLabel("Dedicated command token")
    .fill("phase7-browser-command-token");
  await panel.getByLabel("Idempotency key").fill("browser-real-job-1");
  await panel.getByLabel("Expected revision").fill(request.expectedRevision);
  const submit = panel.getByRole("button", {
    name: "Enqueue bounded Phase 7 job",
  });
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(panel.getByText("complete", { exact: true })).toBeVisible();
  await expect(panel.getByText(/Previous status: running/)).toBeVisible();
  await expect(
    panel.getByText("phase7-result.json", { exact: true }),
  ).toBeVisible();
  await expect(panel.getByText(/offline fixture verified/)).toBeVisible();
  await expect(
    panel.getByText(/AgentIntersect World Phase 7 fixture complete/),
  ).toBeVisible();
  await expect(panel.getByText(/Verification: passed/)).toBeVisible();
  await expect(panel.getByLabel("Dedicated command token")).toHaveValue("");
  expect(createCalls).toBe(1);
  const storage = await page.evaluate(() => ({
    ...localStorage,
    ...sessionStorage,
  }));
  expect(JSON.stringify(storage)).not.toContain("phase7-browser-command-token");
  await expect(
    panel.getByRole("button", { name: "Claim or execute job" }),
  ).toBeDisabled();
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
});
