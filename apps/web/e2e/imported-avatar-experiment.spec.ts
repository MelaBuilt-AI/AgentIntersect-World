import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE_DIR =
  process.env.AIW_PLAYWRIGHT_EVIDENCE_DIR ??
  fileURLToPath(
    new URL(
      "../../../artifacts/avatar-replacement-evidence/world-animation-completion-v1/browser/",
      import.meta.url,
    ),
  );
const STATIC_PRODUCTION_ORIGIN = "http://aiw.local";
const WEB_DIST = fileURLToPath(new URL("../dist/", import.meta.url));

test.beforeAll(() => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await page.route(`${STATIC_PRODUCTION_ORIGIN}/**`, async (route) => {
    const requestUrl = new URL(route.request().url());
    const pathname = decodeURIComponent(requestUrl.pathname);
    const filePath =
      pathname === "/"
        ? resolve(WEB_DIST, "index.html")
        : resolve(WEB_DIST, `.${pathname}`);
    if (!filePath.startsWith(WEB_DIST)) {
      await route.fulfill({ status: 404, body: "not found" });
      return;
    }
    try {
      await route.fulfill({ status: 200, path: filePath });
    } catch {
      await route.fulfill({ status: 404, body: "not found" });
    }
  });
});

const apiEnvelope = (data: unknown) => ({
  ok: true,
  data,
  meta: {
    correlationId: "33333333-3333-4333-8333-333333333333",
    schema: "aiw.api/0.3",
  },
});

const expectBuilderComposition = async (
  page: Page,
  selectedCardName: string,
) => {
  const selectedCard = page.getByRole("button", { name: selectedCardName });
  const previewPanel = page.getByTestId("avatar-preview-panel");
  const completeAvatarControl = page.getByRole("button", {
    name: "Use Complete Avatar",
  });
  const catalogSummary = page.locator(".imported-avatar-catalog__summary");

  await expect(selectedCard).toBeInViewport({ ratio: 0.98 });
  await expect(catalogSummary).toBeInViewport({ ratio: 0.98 });
  await expect(
    previewPanel.getByRole("heading", { name: "Complete avatar preview" }),
  ).toBeInViewport({ ratio: 0.98 });
  await expect(previewPanel.locator(".imported-avatar-canvas")).toBeInViewport({
    ratio: 0.8,
  });
  await expect(completeAvatarControl).toBeInViewport({ ratio: 0.98 });
  await completeAvatarControl.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(completeAvatarControl).toBeFocused();
  await expect(completeAvatarControl).toHaveCSS("outline-style", "solid");
  await expect(page.getByRole("button", { name: /Modular/iu })).toHaveCount(0);
  await expect(page.locator(".avatar-builder__status")).not.toHaveCSS(
    "position",
    "sticky",
  );

  const overlap = await page.evaluate(() => {
    const result = document.querySelector(".avatar-builder__status");
    const explanation = document.querySelector(
      ".avatar-source-picker > p[role='status']",
    );
    if (
      !(result instanceof HTMLElement) ||
      !(explanation instanceof HTMLElement)
    )
      return true;
    const a = result.getBoundingClientRect();
    const b = explanation.getBoundingClientRect();
    return !(
      a.right <= b.left ||
      a.left >= b.right ||
      a.bottom <= b.top ||
      a.top >= b.bottom
    );
  });
  expect(overlap).toBe(false);
};

const expectContainedActualGlbPreview = async (page: Page) => {
  const preview = page.getByTestId("avatar-preview");
  await expect(preview).toHaveCSS("border-radius", "12px");
  await expect(preview.locator(".avatar-nameplate")).toHaveCSS(
    "position",
    "relative",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
};

test("first-launch Builder selects a complete avatar before naming without blanking", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/");
  await page.getByRole("button", { name: "Create Avatar" }).click();
  const nameInput = page.getByLabel("Required agent name");
  const save = page.getByRole("button", {
    name: "Save avatar and enter World",
  });
  await expect(nameInput).toHaveValue("");
  await expect(save).toBeDisabled();

  await page
    .getByRole("button", { name: "Open User Female 3 3D preview" })
    .click();
  await page.getByRole("button", { name: "Use Complete Avatar" }).click();
  await page.waitForTimeout(100);

  expect(pageErrors).toEqual([]);
  await expect(page.locator("#root")).toContainText("Create your World avatar");
  await expect(
    page.getByText(
      "User Female 3 is selected in this unsaved draft and previewed from its actual GLB.",
    ),
  ).toBeVisible();
  await expect(save).toBeDisabled();

  await nameInput.fill("Replacement Tester");
  await expect(save).toBeEnabled();
});

test("six stance cards open a separate GLB preview and persist a complete avatar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const importedRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/assets/imported-avatars/"))
      importedRequests.push(new URL(request.url()).pathname);
  });
  await page.goto("/");
  const storageBeforePreview = await page.evaluate(() =>
    localStorage.getItem("aiw.avatar.profile.0.18.5"),
  );
  await page.getByRole("button", { name: "Create Avatar" }).click();
  await page.getByLabel("Required agent name").fill("Replacement Tester");

  const cards = page.getByRole("button", { name: /Open .* 3D preview/u });
  await expect(cards).toHaveCount(6);
  await expect(
    page.getByLabel("User avatar stance cards (6 available)"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Complete avatar preview" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "User Male 1 is previewed from its actual GLB. It is not selected, saved, or accepted.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save avatar and enter World" }),
  ).toBeDisabled();
  await expect(
    page.getByTestId("avatar-preview").locator(".imported-avatar-canvas"),
  ).toHaveAttribute("data-avatar-imported-id", "user-male-01");
  await expect(
    page.getByTestId("avatar-preview").locator(".imported-avatar-canvas"),
  ).toHaveAttribute("data-avatar-render-ready", "true", { timeout: 20_000 });
  await page.getByTestId("avatar-preview-panel").scrollIntoViewIfNeeded();
  await expectContainedActualGlbPreview(page);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("aiw.avatar.profile.0.18.5"),
    ),
  ).toBe(storageBeforePreview);
  expect([
    ...new Set(importedRequests.filter((path) => path.endsWith(".glb"))),
  ]).toEqual(["/assets/imported-avatars/user-male-01.glb"]);
  await page.screenshot({
    path: `${EVIDENCE_DIR}/builder-user-first-load-user-male-01-glb-ready-unsaved.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Open User Female 3 3D preview" })
    .click();
  await expect(
    page.getByText(
      "User Female 3 is previewed from its actual GLB. It is not selected, saved, or accepted.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save avatar and enter World" }),
  ).toBeDisabled();
  const canvasHost = page
    .getByTestId("avatar-preview")
    .locator(".imported-avatar-canvas");
  await expect(canvasHost).toHaveAttribute(
    "data-avatar-imported-id",
    "user-female-03",
  );
  await expect(canvasHost).toHaveAttribute("data-avatar-render-ready", "true", {
    timeout: 20_000,
  });
  await expect(page.getByText("3D preview ready")).toBeVisible();
  await page.getByRole("button", { name: "Use Complete Avatar" }).click();
  await expect(
    page.getByText(
      "User Female 3 is selected in this unsaved draft and previewed from its actual GLB.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save avatar and enter World" }),
  ).toBeEnabled();
  await expectBuilderComposition(page, "Open User Female 3 3D preview");
  await page.screenshot({
    path: `${EVIDENCE_DIR}/builder-user-desktop-selected-user-female-03-with-glb-preview-and-original-controls.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Use Complete Avatar" })
    .scrollIntoViewIfNeeded();
  await expect(page.locator(".avatar-builder__status")).toBeVisible();
  await expectContainedActualGlbPreview(page);
  await page.screenshot({
    path: `${EVIDENCE_DIR}/builder-user-mobile-user-female-03-no-horizontal-overflow.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 1600, height: 1000 });
  const saveAvatar = page.getByRole("button", {
    name: "Save avatar and enter World",
  });
  await expect(saveAvatar).toBeEnabled();
  await saveAvatar.click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const envelope = JSON.parse(
          localStorage.getItem("aiw.avatar.profile.0.18.5") ?? "null",
        );
        return envelope?.current?.avatarSource;
      }),
    )
    .toEqual({
      kind: "imported",
      version: 2,
      mode: "original",
      modelId: "user-female-03",
    });
  expect([
    ...new Set(importedRequests.filter((path) => path.endsWith(".glb"))),
  ]).toEqual([
    "/assets/imported-avatars/user-male-01.glb",
    "/assets/imported-avatars/user-female-03.glb",
  ]);
  await page.screenshot({
    path: `${EVIDENCE_DIR}/user-female-03-original-selected.png`,
    fullPage: true,
  });
});

test("text-only selection loads no GLB and stale removed IDs require re-selection", async ({
  page,
}) => {
  const staleEnvelope = JSON.stringify({
    schema: "aiw.avatar-store/0.18.5",
    current: {
      schema: "aiw.avatar/0.18.5",
      profileId: "avatar_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      agentRef: null,
      agentName: "Stale Operator",
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
      avatarSource: {
        kind: "imported",
        assetId: "cat-agent",
        previewClipIndex: 0,
      },
      createdAt: "2026-07-30T21:00:00.000Z",
      updatedAt: "2026-07-30T21:00:00.000Z",
    },
    previous: null,
  });
  await page.addInitScript((raw) => {
    localStorage.setItem("aiw.avatar.profile.0.18.5", raw);
  }, staleEnvelope);
  const glbRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".glb")) glbRequests.push(request.url());
  });

  await page.goto("/?avatar3d=text");
  await page.getByRole("button", { name: "Create Avatar" }).click();
  await expect(
    page.getByText(/saved imported model was removed/iu),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("aiw.avatar.profile.0.18.5"),
    ),
  ).toBe(staleEnvelope);

  await page
    .getByRole("button", { name: "Open User Male 2 3D preview" })
    .click();
  await expect(page.getByText("Text-only mode")).toBeVisible();
  expect(glbRequests).toEqual([]);
});

test("seventeen agent stances and mounted user-directed movement work in production", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const session = {
    schema: "aiw.agent-session/0.12",
    sessionId: "11111111-1111-4111-8111-111111111111",
    adapterId: "hermes",
    adapterSessionRef: "native-mr-fluff",
    profile: "default",
    workspaceId: "world-entry",
    repositoryRef: "current",
    mode: "explore",
    permissionRevision: 0,
    capabilitySnapshotHash: "a".repeat(64),
    continuity: "current",
    status: "ready",
  } as const;
  const proposal = {
    schema: "aiw.avatar-proposal/0.12",
    proposalId: "22222222-2222-4222-8222-222222222222",
    sessionId: session.sessionId,
    displayName: "Mr Fluff",
    species: "cat",
    head: "cat",
    hands: "paws",
    feet: "paws",
    fur: "short",
    tail: "cat",
    markings: "tuxedo",
    bodyColor: "charcoal",
    shirt: "Hermes",
    movementStyle: "shared-biped-core",
    sourceDisclosure: "Bounded local fixture proposal.",
    rationale: "Awaiting deliberate operator editing.",
    createdAt: "2026-07-25T00:00:00.000Z",
  } as const;
  await page.addInitScript(() => {
    const current = {
      schema: "aiw.avatar/0.18.5",
      profileId: "avatar_0123456789abcdef0123456789abcdef",
      agentRef: null,
      agentName: "World User",
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
      avatarSource: {
        kind: "imported",
        version: 2,
        mode: "original",
        modelId: "user-male-02",
      },
      createdAt: "2026-07-30T21:00:00.000Z",
      updatedAt: "2026-07-30T21:00:00.000Z",
    };
    localStorage.setItem(
      "aiw.avatar.profile.0.18.5",
      JSON.stringify({
        schema: "aiw.avatar-store/0.18.5",
        current,
        previous: null,
      }),
    );
  });
  let acceptedProposal: Record<string, unknown> | null = null;
  const streamedTexts: string[] = [];
  const movementProposals: Record<string, unknown>[] = [];
  const movementLifecyclePosts: {
    readonly pathname: string;
    readonly body: Record<string, unknown>;
  }[] = [];
  const autonomousAction = {
    kind: "move-agent",
    schema: "aiw.agent-movement/1",
    actionId: "66666666-6666-4666-8666-666666666666",
    actorId: session.sessionId,
    source: "agent-autonomous",
    speed: 1,
    target: { kind: "coordinate", x: -10, z: 1 },
  } as const;
  let activeMovementAction: Record<string, unknown> | null = null;
  const movementEnvelope = (action: Record<string, unknown>) => {
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 30_000);
    const autonomous = action.actionId === autonomousAction.actionId;
    return {
      schema: "aiw.world-action/0.13",
      requestId: autonomous
        ? "77777777-7777-4777-8777-777777777771"
        : "99999999-9999-4999-8999-999999999991",
      batchId: autonomous
        ? "77777777-7777-4777-8777-777777777772"
        : "99999999-9999-4999-8999-999999999992",
      sessionId: session.sessionId,
      adapterSessionRef: session.adapterSessionRef,
      repositoryRef: "aiw://object/repository-a",
      worldGeneration: "world-a",
      layoutGeneration: "blank-world",
      graphGeneration: null,
      capabilitySnapshotHash: "a".repeat(64),
      sequence: autonomous ? 1 : 2,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      actions: [action],
    };
  };
  await page.route("**/world-actions/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          protocol: "aiw.world-action/0.13",
          actions: [],
          executions: activeMovementAction
            ? [
                {
                  accepted: true,
                  envelope: movementEnvelope(activeMovementAction),
                },
              ]
            : [],
        }),
      });
      return;
    }
    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
    if (method === "POST" && pathname.endsWith("/proposals")) {
      movementProposals.push(body);
      const proposedAction = (body.actions as Record<string, unknown>[])[0]!;
      activeMovementAction = {
        ...proposedAction,
        actionId: "88888888-8888-4888-8888-888888888888",
      };
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: true,
          envelope: movementEnvelope(activeMovementAction),
        }),
      });
      return;
    }
    movementLifecyclePosts.push({ pathname, body });
    if (method === "POST" && pathname.endsWith("/interrupt"))
      activeMovementAction = null;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ actions: [] }),
    });
  });
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.includes("/world-actions/")) {
      await route.fallback();
      return;
    }
    let data: unknown;
    if (pathname.endsWith("/agent-sessions/capabilities"))
      data = [
        {
          adapterId: "hermes",
          capabilities: { attach: true, sendText: true, streamDeltas: true },
          unavailable: {},
        },
      ];
    else if (pathname.endsWith("/agent-sessions/native"))
      data = [
        {
          id: session.adapterSessionRef,
          source: "cli",
          title: "Mr Fluff",
          messageCount: 12,
        },
      ];
    else if (
      pathname.endsWith("/agent-sessions/attach") ||
      pathname.endsWith("/status")
    )
      data = session;
    else if (pathname.endsWith("/avatar-proposal"))
      data = acceptedProposal ?? proposal;
    else if (pathname.endsWith("/history"))
      data = {
        sessionId: session.sessionId,
        continuity: "current",
        messages: [],
        transcriptAuthority: "hermes",
        avatarConsent: {
          state: "accepted",
          current: acceptedProposal ?? proposal,
          previous: null,
        },
      };
    else if (pathname.endsWith("/avatar-consent")) {
      const body = route.request().postDataJSON() as {
        proposal?: Record<string, unknown>;
      };
      acceptedProposal = body.proposal ?? null;
      data = { state: "accepted" };
    } else if (pathname.endsWith("/stream")) {
      const body = route.request().postDataJSON() as {
        readonly text?: unknown;
      } | null;
      const requestText = typeof body?.text === "string" ? body.text : "";
      streamedTexts.push(requestText);
      const event = (name: string, value: unknown) =>
        `event: ${name}\ndata: ${JSON.stringify(value)}\n\n`;
      const finalText = "Hello from the visible agent response.";
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: [
          event("world.event", {
            schema: "aiw.agent-event/0.12",
            eventId: "44444444-4444-4444-8444-444444444444",
            sessionId: session.sessionId,
            sequence: 1,
            occurredAt: "2026-08-01T00:00:00.000Z",
            correlationId: "55555555-5555-4555-8555-555555555555",
            type: "message.assistant-final",
            payload: { text: finalText },
            redaction: { applied: false, count: 0 },
          }),
          event("world.final", {
            schema: "aiw.agent-stream-terminal/0.12",
            sessionId: session.sessionId,
            status: "completed",
            finalText,
          }),
          event("world.done", {
            schema: "aiw.agent-stream-terminal/0.12",
            sessionId: session.sessionId,
            status: "completed",
          }),
        ].join(""),
      });
      return;
    } else {
      await route.fulfill({ status: 404, body: "fixture route missing" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(apiEnvelope(data)),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Single Agent/u }).click();
  await page.getByRole("button", { name: /hermes_/u }).click();
  await page.getByLabel("Agent name").fill("Mr Fluff");
  await page.getByRole("button", { name: "Connect agent" }).click();
  await expect(
    page.getByRole("heading", { name: "Change Mr Fluff’s avatar" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByRole("button", { name: /Open .* 3D preview/u }),
  ).toHaveCount(17);
  await expect(
    page.getByLabel("Agent avatar stance cards (17 available)"),
  ).toBeVisible();
  const agentCanvas = page
    .getByTestId("avatar-preview")
    .locator(".imported-avatar-canvas");
  await expect(agentCanvas).toHaveAttribute(
    "data-avatar-imported-id",
    "cat-agent-01",
  );
  await expect(agentCanvas).toHaveAttribute(
    "data-avatar-render-ready",
    "true",
    {
      timeout: 20_000,
    },
  );
  await expectContainedActualGlbPreview(page);
  expect(acceptedProposal).toBeNull();
  await page.reload();
  await expect(
    page.getByLabel("Agent avatar stance cards (17 available)"),
  ).toBeVisible();
  await expect(
    page.getByTestId("avatar-preview").locator(".imported-avatar-canvas"),
  ).toHaveAttribute("data-avatar-imported-id", "cat-agent-01");
  await expect(
    page.getByTestId("avatar-preview").locator(".imported-avatar-canvas"),
  ).toHaveAttribute("data-avatar-render-ready", "true", { timeout: 20_000 });
  expect(acceptedProposal).toBeNull();
  await page
    .getByRole("button", { name: "Open Robot Agent 5 3D preview" })
    .click();
  await expect(
    page.getByTestId("avatar-preview").locator(".imported-avatar-canvas"),
  ).toHaveAttribute("data-avatar-render-ready", "true", { timeout: 20_000 });
  await expect(page.getByText("3D preview ready")).toBeVisible();
  await page.getByRole("button", { name: "Use Complete Avatar" }).click();
  await expectBuilderComposition(page, "Open Robot Agent 5 3D preview");
  await page.screenshot({
    path: `${EVIDENCE_DIR}/builder-agent-desktop-selected-robot-agent-05-with-glb-preview-and-original-controls.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Accept and save avatar" }).click();
  expect(acceptedProposal?.avatarSource).toEqual({
    kind: "imported",
    version: 2,
    mode: "original",
    modelId: "robot-agent-05",
  });
  await page.getByRole("button", { name: "Enter World" }).click();
  const worldCanvas = page.getByTestId("world-room-canvas");
  await expect(worldCanvas).toHaveAttribute(
    "data-user-avatar-imported-id",
    "user-male-02",
  );
  await expect(worldCanvas).toHaveAttribute(
    "data-agent-avatar-imported-id",
    "robot-agent-05",
  );
  await expect(worldCanvas).toHaveAttribute(
    "data-user-avatar-rendered-clip",
    "NlaTrack.005",
  );
  await expect(worldCanvas).toHaveAttribute(
    "data-agent-avatar-rendered-clip",
    "NlaTrack.018",
  );
  await expect(worldCanvas).toHaveAttribute(
    "data-avatar-render-ready",
    "true",
    {
      timeout: 20_000,
    },
  );
  await expect(worldCanvas).toHaveAttribute(
    "data-user-avatar-animation-source-id",
    "user-male-02",
    { timeout: 20_000 },
  );
  await expect(worldCanvas).toHaveAttribute(
    "data-agent-avatar-animation-source-id",
    "robot-agent-05",
    { timeout: 20_000 },
  );
  await expect(
    page.getByText("Static source pose · animation semantics unverified"),
  ).toHaveCount(0);
  await expect(page.getByPlaceholder("Message Mr Fluff")).toBeVisible();
  const productionManifest = JSON.parse(
    readFileSync(
      resolve(WEB_DIST, "assets/imported-avatars/manifest.json"),
      "utf8",
    ),
  ) as {
    readonly assets: readonly {
      readonly id: string;
      readonly semanticClips: Readonly<Record<string, number>>;
      readonly semanticEvidence: Readonly<
        Record<string, { readonly verification: string }>
      >;
      readonly semanticReview: Readonly<
        Record<string, { readonly verdict: string }>
      >;
    }[];
  };
  expect(productionManifest.assets).toHaveLength(23);
  expect(
    productionManifest.assets.every((asset) => {
      const fullyReviewed =
        asset.id === "cat-agent-01" || asset.id === "user-male-01";
      return (
        Object.keys(asset.semanticClips).length === 12 &&
        Object.values(asset.semanticEvidence).every(
          ({ verification }) => verification === "structural-temporal-evidence",
        ) &&
        Object.values(asset.semanticReview).filter(
          ({ verdict }) => verdict === "pass",
        ).length === (fullyReviewed ? 12 : 3) &&
        Object.values(asset.semanticReview).filter(
          ({ verdict }) => verdict === "ambiguous",
        ).length === (fullyReviewed ? 0 : 9)
      );
    }),
  ).toBe(true);
  await page.setViewportSize({ width: 1920, height: 1080 });

  const readAnimationSnapshot = async (state: string) => {
    const host = await worldCanvas.evaluate(
      (element, label) => ({
        state: label,
        capturedAt: performance.now(),
        user: {
          sourceAssetId: element.getAttribute(
            "data-user-avatar-animation-source-id",
          ),
          mixerRoot: element.getAttribute("data-user-avatar-mixer-root"),
          mixerTime: Number(
            element.getAttribute("data-user-avatar-mixer-time"),
          ),
          actionTime: Number(
            element.getAttribute("data-user-avatar-action-time"),
          ),
          sequence: Number(
            element.getAttribute("data-user-avatar-animation-sequence"),
          ),
          clip: element.getAttribute("data-user-avatar-rendered-clip"),
          clipIndex: Number(
            element.getAttribute("data-user-avatar-rendered-clip-index"),
          ),
          locomotion: element.getAttribute("data-user-avatar-locomotion"),
          boneName: element.getAttribute("data-user-avatar-bone-name"),
          boneQuaternion: element.getAttribute(
            "data-user-avatar-bone-quaternion",
          ),
        },
        agent: {
          sourceAssetId: element.getAttribute(
            "data-agent-avatar-animation-source-id",
          ),
          mixerRoot: element.getAttribute("data-agent-avatar-mixer-root"),
          mixerTime: Number(
            element.getAttribute("data-agent-avatar-mixer-time"),
          ),
          actionTime: Number(
            element.getAttribute("data-agent-avatar-action-time"),
          ),
          sequence: Number(
            element.getAttribute("data-agent-avatar-animation-sequence"),
          ),
          clip: element.getAttribute("data-agent-avatar-rendered-clip"),
          clipIndex: Number(
            element.getAttribute("data-agent-avatar-rendered-clip-index"),
          ),
          locomotion: element.getAttribute("data-agent-avatar-locomotion"),
          boneName: element.getAttribute("data-agent-avatar-bone-name"),
          boneQuaternion: element.getAttribute(
            "data-agent-avatar-bone-quaternion",
          ),
        },
      }),
      state,
    );
    const worldPosition = await worldCanvas
      .locator("canvas")
      .getAttribute("data-user-position");
    return { ...host, worldPosition };
  };

  const motionTrace = [await readAnimationSnapshot("idle-1")];
  const firstIdle = motionTrace[0]!;
  await expect
    .poll(async () =>
      Number(
        await worldCanvas.getAttribute("data-user-avatar-animation-sequence"),
      ),
    )
    .toBeGreaterThan(firstIdle.user.sequence);
  await expect
    .poll(async () =>
      worldCanvas.getAttribute("data-user-avatar-bone-quaternion"),
    )
    .not.toBe(firstIdle.user.boneQuaternion);
  await expect
    .poll(async () =>
      worldCanvas.getAttribute("data-agent-avatar-bone-quaternion"),
    )
    .not.toBe(firstIdle.agent.boneQuaternion);
  motionTrace.push(await readAnimationSnapshot("idle-2"));
  expect(motionTrace[1]!.user.mixerTime).toBeGreaterThan(
    firstIdle.user.mixerTime,
  );
  expect(motionTrace[1]!.agent.mixerTime).toBeGreaterThan(
    firstIdle.agent.mixerTime,
  );
  expect(firstIdle.user.mixerRoot).not.toBe(firstIdle.agent.mixerRoot);
  await page.screenshot({
    path: `${EVIDENCE_DIR}/world-motion-user-male-02-and-robot-agent-05-idle-grounded-framing.png`,
  });

  const room = page.locator(".world-room");
  const chatInput = page.getByPlaceholder("Message Mr Fluff");
  await chatInput.fill("  /DaNcE  ");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(room).toHaveAttribute("data-user-avatar-semantic", "Idle");
  await expect(worldCanvas).toHaveAttribute(
    "data-user-avatar-rendered-clip",
    "NlaTrack.005",
  );
  await expect(worldCanvas).toHaveAttribute(
    "data-user-avatar-animation-verification",
    "semantic-review-pass",
  );
  await page.screenshot({
    path: `${EVIDENCE_DIR}/world-one-shot-user-dance-refused-idle.png`,
  });
  expect(streamedTexts).toEqual([]);
  await expect(page.getByText("/DaNcE", { exact: false })).toHaveCount(0);

  await room.focus();
  await page.keyboard.press("Space");
  await expect(room).toHaveAttribute("data-user-avatar-semantic", "Idle");
  await expect(worldCanvas).toHaveAttribute(
    "data-user-avatar-rendered-clip",
    "NlaTrack.005",
  );
  await page.screenshot({
    path: `${EVIDENCE_DIR}/world-one-shot-user-jump-refused-idle.png`,
  });

  await chatInput.fill("hello");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(room).toHaveAttribute("data-agent-avatar-semantic", "Idle");
  await expect(worldCanvas).toHaveAttribute(
    "data-agent-avatar-rendered-clip",
    "NlaTrack.018",
  );
  await page.screenshot({
    path: `${EVIDENCE_DIR}/world-one-shot-agent-wave-refused-idle.png`,
  });
  expect(streamedTexts).toEqual(["hello"]);

  activeMovementAction = autonomousAction;
  const autonomousStartX = Number(
    await room.getAttribute("data-agent-position-x"),
  );
  await expect(room).toHaveAttribute(
    "data-agent-movement-source",
    "agent-autonomous",
    { timeout: 10_000 },
  );
  await expect(room).toHaveAttribute("data-agent-movement-state", "moving");
  await expect
    .poll(async () => Number(await room.getAttribute("data-agent-position-x")))
    .toBeLessThan(autonomousStartX - 0.1);

  const chatCountBeforeDirection = streamedTexts.length;
  await chatInput.fill("  /AgEnT MoVe 10 1  ");
  await page.getByRole("button", { name: "Send" }).click();
  await expect
    .poll(() => movementProposals.length, { timeout: 10_000 })
    .toBe(1);
  expect(movementProposals[0]).toEqual({
    actions: [
      {
        kind: "move-agent",
        schema: "aiw.agent-movement/1",
        actorId: session.sessionId,
        source: "user-directed",
        speed: 4,
        target: { kind: "coordinate", x: 10, z: 1 },
      },
    ],
    ttlMs: 30_000,
  });
  expect(streamedTexts).toHaveLength(chatCountBeforeDirection);
  await expect(room).toHaveAttribute(
    "data-agent-movement-source",
    "user-directed",
    {
      timeout: 10_000,
    },
  );
  await expect(room).toHaveAttribute(
    "data-agent-movement-request",
    "88888888-8888-4888-8888-888888888888",
  );
  await expect(room).toHaveAttribute(
    "data-agent-avatar-cue-source",
    "locomotion",
  );
  await expect(room).toHaveAttribute("data-agent-avatar-semantic", /Walk|Run/u);
  const directedStartX = Number(
    await room.getAttribute("data-agent-position-x"),
  );
  await expect
    .poll(async () => Number(await room.getAttribute("data-agent-position-x")))
    .toBeGreaterThan(directedStartX + 0.1);
  await expect
    .poll(
      () =>
        movementLifecyclePosts.some(
          ({ pathname, body }) =>
            pathname.endsWith("/transition") && body.event === "arrived",
        ),
      { timeout: 10_000 },
    )
    .toBe(true);

  const proposalCountBeforeRefusal = movementProposals.length;
  await chatInput.fill("/agent move 16 0");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".world-hud__captions")).toContainText(
    "agent movement refused",
  );
  expect(movementProposals).toHaveLength(proposalCountBeforeRefusal);
  expect(streamedTexts).toHaveLength(chatCountBeforeDirection);

  await chatInput.fill("/agent stop");
  await page.getByRole("button", { name: "Send" }).click();
  await expect
    .poll(() =>
      movementLifecyclePosts.some(
        ({ pathname, body }) =>
          pathname.endsWith("/interrupt") && body.reason === "cancel",
      ),
    )
    .toBe(true);
  await expect(room).toHaveAttribute("data-agent-movement-state", "idle");
  await expect(room).toHaveAttribute("data-agent-avatar-semantic", "Idle");
  expect(streamedTexts).toHaveLength(chatCountBeforeDirection);

  await page.locator(".world-room").focus();
  await page.keyboard.down("w");
  await expect(worldCanvas).toHaveAttribute(
    "data-user-avatar-rendered-clip",
    "NlaTrack.003",
  );
  await page.waitForTimeout(360);
  motionTrace.push(await readAnimationSnapshot("walk"));
  expect(motionTrace.at(-1)!.user.actionTime).toBeGreaterThan(0.2);
  expect(motionTrace.at(-1)!.user.boneName).toBe("L_Thigh");
  await page.screenshot({
    path: `${EVIDENCE_DIR}/world-motion-user-male-02-walk-robot-agent-05-idle.png`,
  });

  await page.keyboard.down("Shift");
  await expect(worldCanvas).toHaveAttribute(
    "data-user-avatar-rendered-clip",
    "NlaTrack.020",
  );
  await page.waitForTimeout(360);
  motionTrace.push(await readAnimationSnapshot("run"));
  expect(motionTrace.at(-1)!.user.actionTime).toBeGreaterThan(0.2);
  expect(motionTrace.at(-1)!.user.boneName).toBe("L_Thigh");
  await page.screenshot({
    path: `${EVIDENCE_DIR}/world-motion-user-male-02-run-robot-agent-05-idle.png`,
  });
  await page.keyboard.up("Shift");
  await page.keyboard.up("w");
  await expect(worldCanvas).toHaveAttribute(
    "data-user-avatar-rendered-clip",
    "NlaTrack.005",
  );
  await page.waitForTimeout(360);
  motionTrace.push(await readAnimationSnapshot("returned-idle"));
  writeFileSync(
    `${EVIDENCE_DIR}/world-motion-user-male-02-robot-agent-05-trace.json`,
    `${JSON.stringify(
      {
        schema: "aiw.browser-model-local-motion-trace/1",
        userModel: "user-male-02",
        agentModel: "robot-agent-05",
        crossfadeSeconds: 0.22,
        samples: motionTrace,
      },
      null,
      2,
    )}\n`,
  );

  const changeAgentAndCapture = async (
    buttonName: string,
    modelId: string,
    screenshotName: string,
  ) => {
    await page.locator(".world-room").focus();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Change Avatar" }).click();
    await page
      .getByRole("button", { name: "Mr Fluff · connected agent" })
      .click();
    await page.getByRole("button", { name: buttonName }).click();
    await expect(
      page.getByRole("button", { name: "Accept and save avatar" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Use Complete Avatar" }).click();
    await page.getByRole("button", { name: "Accept and save avatar" }).click();
    await expect(page.locator(".world-room")).toHaveAttribute(
      "data-agent-avatar-imported-id",
      modelId,
    );
    await expect(worldCanvas).toHaveAttribute(
      "data-avatar-render-ready",
      "true",
      {
        timeout: 20_000,
      },
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator(".world-room")).toHaveAttribute(
      "data-agent-avatar-animation-verification",
      "semantic-review-pass",
    );
    await expect(worldCanvas).toHaveAttribute(
      "data-agent-avatar-animation-source-id",
      modelId,
      { timeout: 20_000 },
    );
    await page.screenshot({
      path: `${EVIDENCE_DIR}/${screenshotName}`,
    });
  };

  await changeAgentAndCapture(
    "Open Cat Agent 1 3D preview",
    "cat-agent-01",
    "world-animated-user-male-02-and-cat-agent-01-grounded-framing.png",
  );
  await changeAgentAndCapture(
    "Open Dog Agent 1 3D preview",
    "dog-agent-01",
    "world-animated-user-male-02-and-dog-agent-01-grounded-framing.png",
  );
});
