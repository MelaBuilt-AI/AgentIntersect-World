import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { openPanel, seedConfiguredAvatar } from "./helpers.js";

test("Phase 16 two-agent coordination is truthful, accessible, and bounded", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: 2,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => null,
    });
  });
  await seedConfiguredAvatar(page);
  await page.goto("/internal/dashboard?fixture=phase16-coordination");
  await openPanel(page, "Agents");

  const panel = page.getByLabel("Phase 16 multi-agent coordination");
  await expect(panel).toBeVisible();
  await expect(panel.locator(".coordination-agent-card")).toHaveCount(2);
  await expect(panel.getByText("Mr Fluff", { exact: true })).toBeVisible();
  await expect(panel.getByText("Beans", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Follow Beans" }).click();
  await expect(panel.getByText("Following Beans")).toBeVisible();
  await expect(
    panel.getByText("Interest contention · not a Git conflict"),
  ).toBeVisible();
  await expect(panel.getByText("Git conflict · merge not run")).toBeVisible();
  await expect(
    panel.getByText("Inert visible record · no authority"),
  ).toBeVisible();
  await expect(panel.locator(".coordination-actions > li")).toHaveCount(14);

  const reconcile = panel.getByRole("button", {
    name: "10. Validate worktree bindings",
  });
  await expect(reconcile).toBeEnabled();
  await reconcile.click();
  await expect(
    page.getByText("10. Fixture worktree bindings reconciled."),
  ).toBeVisible();

  const approve = panel.getByRole("button", {
    name: "12. Approve candidate (merge not run)",
  });
  await expect(approve).toBeEnabled();
  await approve.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("12. Fixture candidate approved. Merge was not run."),
  ).toBeVisible();
  await expect(
    panel.getByText("operator-approved · merge not run"),
  ).toBeVisible();

  const cleanup = panel.getByRole("button", {
    name: "13. Preview cleanup",
  });
  await expect(cleanup).toBeEnabled();
  await cleanup.click();
  await expect(
    page.getByText("13. Fixture cleanup previewed. Nothing was deleted."),
  ).toBeVisible();

  const cancel = panel.getByRole("button", {
    name: "14. Cancel coordination",
  });
  await expect(cancel).toBeEnabled();
  await cancel.click();
  await expect(
    page.getByText("14. Fixture coordination cancelled. Owned processes: 0."),
  ).toBeVisible();
  await expect(cancel).toBeDisabled();

  const disabled = panel.getByRole("button", {
    name: "2. Bind Mr Fluff",
  });
  await expect(disabled).toBeDisabled();
  const resultBeforeDisabledActivation = await page
    .getByRole("status")
    .last()
    .textContent();
  let disabledDispatches = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/api/coordination/")
    )
      disabledDispatches += 1;
  });
  await disabled.focus();
  await expect(disabled).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").last()).toHaveText(
    resultBeforeDisabledActivation ?? "",
  );
  expect(disabledDispatches).toBe(0);
  await expect(disabled).toHaveAttribute("aria-disabled", "true");
  await expect(disabled).toHaveClass(/coordination-primary--disabled/);
  await expect(cleanup).toHaveClass(/coordination-primary--enabled/);

  expect(
    await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    })),
  ).toEqual({ viewport: 390, document: 390, body: 390 });

  const accessibility = await new AxeBuilder({ page })
    .include(".coordination-panel")
    .analyze();
  expect(
    accessibility.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
});

test("Phase 16 live service proxy polls current truth serially and cleans up", async ({
  page,
}) => {
  let snapshotRequests = 0;
  let inFlightSnapshotRequests = 0;
  let maximumInFlight = 0;
  const isSnapshotRequest = (request: { method(): string; url(): string }) =>
    request.method() === "GET" &&
    request.url().includes("/api/coordination/snapshot");
  page.on("request", (request) => {
    if (!isSnapshotRequest(request)) return;
    snapshotRequests += 1;
    inFlightSnapshotRequests += 1;
    maximumInFlight = Math.max(maximumInFlight, inFlightSnapshotRequests);
  });
  const finished = (request: { method(): string; url(): string }) => {
    if (isSnapshotRequest(request)) inFlightSnapshotRequests -= 1;
  };
  page.on("requestfinished", finished);
  page.on("requestfailed", finished);

  await seedConfiguredAvatar(page);
  await page.goto("/internal/dashboard");
  await openPanel(page, "Agents");
  const panel = page.getByLabel("Phase 16 multi-agent coordination");
  await expect(panel).toBeVisible();
  await expect.poll(() => snapshotRequests).toBeGreaterThanOrEqual(1);

  const initial = await page.request.get("/api/coordination/snapshot");
  expect(initial.status()).toBe(200);
  const initialBody = (await initial.json()) as {
    data: {
      revision: number | null;
      coordinationSessionId: string | null;
      cancelled: boolean | null;
      agents: Array<{
        agentId: "mr-fluff" | "beans";
        nativeSessionId: string;
      }>;
    };
  };
  expect(initialBody.data.cancelled).not.toBe(true);
  let revision = initialBody.data.revision ?? 0;
  let coordinationSessionId =
    initialBody.data.coordinationSessionId ?? "phase16-live-polling";
  let nativeSessionId = initialBody.data.agents.find(
    (agent) => agent.agentId === "mr-fluff",
  )?.nativeSessionId;
  const postAction = async (
    correlationId: string,
    action: Record<string, unknown>,
  ) => {
    const response = await page.request.post("/api/coordination/actions", {
      data: {
        schema: "aiw.coordination-action/0.16",
        coordinationSessionId,
        actor: "operator",
        operatorApproval: "approved",
        expectedRevision: revision,
        correlationId,
        action,
      },
    });
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { data: { revision: number } };
    revision = body.data.revision;
  };

  if (initialBody.data.revision === null) {
    await postAction("live-polling-initialize", {
      kind: "session.initialize",
      repositoryId: "repo-live-polling",
      repositoryDisplayName: "Live polling fixture",
      operatorId: "operator-local",
    });
    coordinationSessionId = "phase16-live-polling";
  }
  if (!nativeSessionId) {
    nativeSessionId = "hermes-live-polling";
    await postAction("live-polling-bind-fluff", {
      kind: "agent.bind",
      binding: {
        agentId: "mr-fluff",
        adapter: "hermes",
        displayName: "Mr Fluff",
        avatarId: "mr-fluff",
        nativeSessionId,
        model: "gpt-5.6-sol",
        toolStreamId: "tool-live-polling",
        evidenceStreamId: "evidence-live-polling",
        status: "ready",
      },
    });
  }
  await postAction(`live-polling-task-${revision}`, {
    kind: "task.upsert",
    task: {
      taskId: "task-live-polling",
      title: "Live proxy polling task",
      status: "ready",
      dependencyTaskIds: [],
      ownerAgentId: null,
    },
  });
  await postAction(`live-polling-assign-${revision}`, {
    kind: "task.assign",
    taskId: "task-live-polling",
    agentId: "mr-fluff",
    nativeSessionId,
  });

  await expect(panel.getByText(nativeSessionId)).toBeVisible({
    timeout: 5_000,
  });
  await expect(panel.getByText("Live proxy polling task")).toBeVisible();
  await expect.poll(() => snapshotRequests).toBeGreaterThanOrEqual(2);
  expect(maximumInFlight).toBe(1);

  await page.goto("about:blank");
  const requestsAfterUnmount = snapshotRequests;
  await page.waitForTimeout(1_250);
  expect(snapshotRequests).toBe(requestsAfterUnmount);
  expect(inFlightSnapshotRequests).toBe(0);
});
