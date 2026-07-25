import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { openPanel, seedConfiguredAvatar } from "./helpers.js";

test("Phase 17 production diagnostics recovers, exports, and deletes truthfully", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => null,
    });
  });
  const identity = {
    repositoryId: "repo-phase17-browser",
    sessionId: "phase17-browser",
  };
  const initialized = await page.request.post(
    "/api/diagnostics/drill/initialize",
    {
      data: {
        ...identity,
        bindings: [
          {
            agentId: "mr-fluff",
            taskId: "task-fluff-doc",
            worktreeId: "worktree-fluff",
            worktreeLabel: "worktrees/mr-fluff",
          },
          {
            agentId: "beans",
            taskId: "task-beans-doc",
            worktreeId: "worktree-beans",
            worktreeLabel: "worktrees/beans",
          },
        ],
      },
    },
  );
  expect(initialized.status()).toBe(200);
  const initializedBody = (await initialized.json()) as {
    data: { revision: number };
  };
  const started = await page.request.post("/api/diagnostics/drill/operations", {
    data: {
      ...identity,
      expectedRevision: initializedBody.data.revision,
      operationId: "operation-browser",
      agentId: "beans",
      taskId: "task-beans-doc",
      worktreeId: "worktree-beans",
      capability: "tool",
      stage: "test",
      commandSummary:
        "bounded browser test TOKEN=SECRET_CANARY_VALUE PERSONA_CANARY",
      operatorApproval: "approved",
    },
  });
  expect(started.status()).toBe(200);
  const startedBody = (await started.json()) as {
    data: { revision: number };
  };
  const terminated = await page.request.post(
    "/api/diagnostics/drill/operations/operation-browser/terminate",
    {
      data: {
        ...identity,
        expectedRevision: startedBody.data.revision,
        operationId: "operation-browser",
        operatorApproval: "approved",
      },
    },
  );
  expect(terminated.status()).toBe(200);

  await seedConfiguredAvatar(page);
  await page.goto("/internal/dashboard");
  await openPanel(page, "Diagnostics");
  const panel = page.getByLabel("Diagnostics & Recovery");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Overall readiness:")).toContainText(
    "recovery-needed",
  );
  await expect(panel.locator(".diagnostics-readiness tbody tr")).toHaveCount(8);
  await expect(panel.getByText("Current state", { exact: true })).toBeVisible();
  await expect(
    panel.getByText("Previous verified state", { exact: true }),
  ).toBeVisible();
  await expect(panel.getByText("Loss window", { exact: true })).toBeVisible();
  await expect(
    panel.getByText("operation-browser", { exact: true }),
  ).toBeVisible();
  await expect(panel.locator(".diagnostics-actions > li")).toHaveCount(6);
  await expect(panel.locator(".diagnostics-actions")).toHaveCSS(
    "list-style-type",
    "none",
  );

  await panel
    .getByRole("button", { name: "1. Inspect preserved state" })
    .click();
  await expect(panel.getByRole("status").last()).toContainText(
    "Preserved state inspected",
  );
  const previewRecovery = panel.getByRole("button", {
    name: "2. Preview recovery",
  });
  await expect(previewRecovery).toHaveClass(/diagnostics-primary--enabled/);
  await previewRecovery.focus();
  await page.keyboard.press("Enter");
  await expect(panel.getByRole("status").last()).toContainText(
    "Recovery previewed. Mutation: none.",
  );
  const apply = panel.getByRole("button", { name: "3. Apply safe recovery" });
  await expect(apply).toHaveClass(/diagnostics-primary--enabled/);
  await apply.click();
  await expect(panel.getByRole("status").last()).toContainText(
    "Recovered safely. Derived state reconciled; Git and worktrees untouched.",
  );
  await expect(
    panel.getByText("operation-orphaned · recovered", { exact: true }),
  ).toBeVisible();

  const diagnosticPreview = panel.getByRole("button", {
    name: "4. Preview diagnostics",
  });
  await diagnosticPreview.click();
  await expect(panel.getByRole("status").last()).toContainText(
    "Diagnostics preview safe: allowlisted, redacted, local only.",
  );
  const exportButton = panel.getByRole("button", {
    name: "5. Export diagnostics",
  });
  await expect(exportButton).toHaveClass(/diagnostics-primary--enabled/);
  await exportButton.click();
  await expect(panel.getByRole("status").last()).toContainText(
    "Exported locally:",
  );
  const deleteButton = panel.getByRole("button", {
    name: "6. Delete export",
  });
  await expect(deleteButton).toHaveClass(/diagnostics-primary--enabled/);
  await deleteButton.click();
  await expect(panel.getByRole("status").last()).toContainText(
    "Export deleted; managed files are absent.",
  );

  const recoveredPreview = panel.getByRole("button", {
    name: "2. Preview recovery",
  });
  await expect(recoveredPreview).toHaveAttribute("aria-disabled", "true");
  await recoveredPreview.focus();
  await expect(recoveredPreview).toBeFocused();
  let mutationRequests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/diagnostics/recovery/")
    )
      mutationRequests += 1;
  });
  await page.keyboard.press("Enter");
  expect(mutationRequests).toBe(0);

  const wrongIdentity = await page.request.post(
    "/api/diagnostics/recovery/preview",
    {
      data: {
        repositoryId: "wrong-repository",
        sessionId: identity.sessionId,
        expectedRevision: 4,
        operationId: "operation-browser",
      },
    },
  );
  expect(wrongIdentity.status()).toBe(409);
  await expect(panel).not.toContainText("SECRET_CANARY");
  await expect(panel).not.toContainText("PERSONA_CANARY");
  expect(
    await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    })),
  ).toEqual({ viewport: 390, document: 390, body: 390 });
  const accessibility = await new AxeBuilder({ page })
    .include(".diagnostics-panel")
    .analyze();
  expect(
    accessibility.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
});
