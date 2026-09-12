import { expect, test, type Page } from "@playwright/test";

const sessionId = "11111111-1111-4111-8111-111111111111";
const proposalId = "22222222-2222-4222-8222-222222222222";
const session = {
  schema: "aiw.agent-session/0.12",
  sessionId,
  adapterId: "hermes",
  adapterSessionRef: "native-mr-fluff",
  adapterRootSessionRef: "native-mr-fluff",
  profile: "default",
  workspaceId: "world-entry",
  repositoryRef: "current",
  mode: "explore",
  permissionRevision: 0,
  capabilitySnapshotHash: "a".repeat(64),
  continuity: "current",
  status: "ready",
} as const;
const importedProposal = {
  schema: "aiw.avatar-proposal/0.12",
  proposalId,
  sessionId,
  displayName: "Mr Fluff",
  species: "cat",
  head: "cat",
  hands: "paws",
  feet: "paws",
  fur: "short",
  tail: "cat",
  markings: "solid",
  bodyColor: "charcoal",
  shirt: "Hermes",
  movementStyle: "shared-biped-core",
  sourceDisclosure: "Bounded local fixture.",
  rationale: "Explicit operator selection.",
  createdAt: "2026-07-28T20:00:00.000Z",
  avatarSource: {
    kind: "imported",
    version: 2,
    mode: "original",
    modelId: "cat-agent-01",
  },
} as const;
const legacyProposal = {
  ...importedProposal,
  proposalId: "44444444-4444-4444-8444-444444444444",
  sourceDisclosure: "Accepted legacy fixture.",
  rationale: "Preserve unchanged until explicit migration.",
  avatarSource: undefined,
};
const envelope = (data: unknown) => ({
  ok: true,
  data,
  meta: {
    correlationId: "33333333-3333-4333-8333-333333333333",
    schema: "aiw.api/0.3",
  },
});

function capturePageErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function installWorldState(page: Page, withPointer = true) {
  await page.addInitScript(
    ({ activeSessionId, installPointer }) => {
      const profile = {
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
          modelId: "user-male-01",
        },
        createdAt: "2026-07-28T20:00:00.000Z",
        updatedAt: "2026-07-28T20:00:00.000Z",
      };
      localStorage.setItem(
        "aiw.avatar.profile.0.18.5",
        JSON.stringify({
          schema: "aiw.avatar-store/0.18.5",
          current: profile,
          previous: null,
        }),
      );
      if (installPointer)
        localStorage.setItem("aiw.agent-session.pointer.0.12", activeSessionId);
    },
    { activeSessionId: sessionId, installPointer: withPointer },
  );
}

async function installSessionFixture(
  page: Page,
  options: {
    readonly initialProposal?: Record<string, unknown>;
    readonly liveProposalAvailable?: boolean;
  } = {},
) {
  let acceptedProposal: Record<string, unknown> =
    options.initialProposal ?? importedProposal;
  const mutationPaths: string[] = [];
  await page.route("**/api/**", async (route) => {
    // Keep the real server-owned setup gate; these fixtures replace native work only.
    if (
      route.request().method() === "GET" &&
      new URL(route.request().url()).pathname === "/api/agent-setup"
    ) {
      await route.continue();
      return;
    }
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() !== "GET" && !pathname.endsWith("/attach"))
      mutationPaths.push(`${request.method()} ${pathname}`);
    let data: unknown;
    if (pathname.includes("/world-actions/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          protocol: "aiw.world-action/0.13",
          capability: { enabled: true },
          actions: [],
          executions: [],
        }),
      });
      return;
    }
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
          id: session.adapterRootSessionRef,
          source: "cli",
          title: "Current Hermes lane",
          displayName: "Mr Fluff",
        },
      ];
    else if (pathname.endsWith("/agent-sessions/attach")) data = session;
    else if (pathname.endsWith("/status")) data = session;
    else if (pathname.endsWith("/constellation/current"))
      data = {
        projection: {
          schema: "aiw.constellation/0.19",
          mode: "multi-agent",
          worldInstanceId: "55555555-5555-4555-8555-555555555555",
          lifecycle: "assembling",
          revision: 0,
          agents: [],
          entryReady: false,
          truth: "current",
        },
        terminalOutcomes: [],
        unavailableReason: null,
      };
    else if (pathname.endsWith("/work-focus")) data = { focus: null };
    else if (pathname.endsWith("/avatar-proposal"))
      data = options.liveProposalAvailable === false ? null : acceptedProposal;
    else if (pathname.endsWith("/history"))
      data = {
        sessionId,
        continuity: "current",
        messages: [],
        transcriptAuthority: "hermes",
        avatarConsent: {
          state: "accepted",
          current: acceptedProposal,
          previous: null,
        },
      };
    else if (pathname.endsWith("/avatar-consent")) {
      const body = request.postDataJSON() as {
        readonly proposal?: Record<string, unknown>;
      };
      acceptedProposal = body.proposal ?? acceptedProposal;
      data = { state: "accepted" };
    } else {
      await route.fulfill({ status: 404, body: "fixture route missing" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope(data)),
    });
  });
  return {
    mutationPaths,
    acceptedProposal: () => acceptedProposal,
  };
}

async function openRestoredWorld(page: Page) {
  await expect(page.locator(".world-room")).toBeVisible();
  await page.locator(".world-room").focus();
}

async function installAutonomousMovementFixture(page: Page) {
  type MovementState = "path-planned" | "moving" | "arrived" | "interrupted";
  let sequence = 0;
  let movement: {
    readonly action: Record<string, unknown>;
    readonly envelope: Record<string, unknown>;
    state: MovementState;
    reason: string;
    offered: boolean;
  } | null = null;
  const lifecycle: Array<{
    readonly pathname: string;
    readonly body: Record<string, unknown>;
  }> = [];
  const activate = (input: {
    readonly actionId: string;
    readonly x: number;
    readonly speed: number;
  }) => {
    sequence += 1;
    const action = {
      kind: "move-agent",
      schema: "aiw.agent-movement/1",
      actionId: input.actionId,
      actorId: sessionId,
      source: "agent-autonomous",
      speed: input.speed,
      target: { kind: "coordinate", x: input.x, z: 1 },
    };
    movement = {
      action,
      state: "path-planned",
      reason: "agent-autonomous",
      offered: true,
      envelope: {
        schema: "aiw.world-action/0.13",
        requestId: `${String(sequence).padStart(8, "0")}-0000-4000-8000-000000000001`,
        batchId: `${String(sequence).padStart(8, "0")}-0000-4000-8000-000000000002`,
        sessionId,
        adapterSessionRef: "native-mr-fluff",
        repositoryRef: "aiw://object/repository-a",
        worldGeneration: "world-a",
        layoutGeneration: "blank-world",
        graphGeneration: null,
        capabilitySnapshotHash: "a".repeat(64),
        sequence,
        createdAt: "2026-08-03T20:00:00.000Z",
        expiresAt: "2026-08-03T20:00:30.000Z",
        actions: [action],
      },
    };
  };
  await page.route("**/api/world-actions/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          protocol: "aiw.world-action/0.13",
          capability: { enabled: true },
          actions: movement
            ? [
                {
                  actionId: movement.action.actionId,
                  kind: "move-agent",
                  state: movement.state,
                  reason: movement.reason,
                },
              ]
            : [],
          executions:
            movement?.offered === true
              ? [{ accepted: true, envelope: movement.envelope }]
              : [],
        }),
      });
      return;
    }
    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
    lifecycle.push({ pathname, body });
    if (movement && pathname.endsWith("/transition")) {
      if (body.event === "moving") movement.state = "moving";
      if (body.event === "arrived") {
        movement.state = "arrived";
        movement.offered = false;
      }
    } else if (movement && pathname.endsWith("/interrupt")) {
      movement.state = "interrupted";
      movement.reason = "cancel";
      movement.offered = false;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ actions: [] }),
    });
  });
  return {
    activate,
    lifecycle,
    reofferTerminalRequest: () => {
      if (movement) movement.offered = true;
    },
  };
}

test("validated autonomous movement walks, arrives, runs, and remains interrupted", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const errors = capturePageErrors(page);
  await installWorldState(page);
  await installSessionFixture(page);
  const authority = await installAutonomousMovementFixture(page);
  await page.goto("/");
  await openRestoredWorld(page);
  const room = page.locator(".world-room");

  authority.activate({
    actionId: "66666666-6666-4666-8666-666666666666",
    x: -1,
    speed: 1,
  });
  await expect(room).toHaveAttribute(
    "data-agent-movement-source",
    "agent-autonomous",
    { timeout: 30_000 },
  );
  await expect(room).toHaveAttribute("data-agent-movement-state", "moving");
  await expect(room).toHaveAttribute("data-agent-avatar-semantic", "Walk");
  await expect(room).toHaveAttribute(
    "data-agent-avatar-rendered-clip-index",
    "19",
  );

  authority.activate({
    actionId: "77777777-7777-4777-8777-777777777777",
    x: 2.5,
    speed: 1,
  });
  await expect(room).toHaveAttribute("data-agent-movement-state", "idle", {
    timeout: 30_000,
  });
  const arrivedX = Number(await room.getAttribute("data-agent-position-x"));
  // Allow one millimetre of frame-step/float epsilon around the ±0.25 arrival window.
  expect(arrivedX).toBeGreaterThanOrEqual(2.249);
  expect(arrivedX).toBeLessThanOrEqual(2.751);
  await expect(room).toHaveAttribute("data-agent-avatar-semantic", "Idle");
  await expect(room).toHaveAttribute(
    "data-agent-avatar-rendered-clip-index",
    "1",
  );
  await expect(page.locator(".world-hud__captions")).toContainText(
    "agent arrived",
  );

  authority.activate({
    actionId: "88888888-8888-4888-8888-888888888888",
    x: 10,
    speed: 8,
  });
  await expect(room).toHaveAttribute("data-agent-movement-state", "moving", {
    timeout: 10_000,
  });
  await expect(room).toHaveAttribute("data-agent-avatar-semantic", "Run");
  await expect(room).toHaveAttribute(
    "data-agent-avatar-rendered-clip-index",
    "4",
  );
  const runningX = Number(await room.getAttribute("data-agent-position-x"));
  await expect
    .poll(async () => Number(await room.getAttribute("data-agent-position-x")))
    .toBeGreaterThan(runningX + 0.2);

  const composer = page.getByLabel("Message Mr Fluff");
  await composer.fill("/agent stop");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(room).toHaveAttribute("data-agent-movement-state", "idle");
  await expect(room).toHaveAttribute("data-agent-avatar-semantic", "Idle");
  await expect
    .poll(() =>
      authority.lifecycle.some(
        ({ pathname, body }) =>
          pathname.endsWith("/interrupt") && body.reason === "cancel",
      ),
    )
    .toBe(true);
  const interruptedX = await room.getAttribute("data-agent-position-x");
  authority.reofferTerminalRequest();
  await page.waitForTimeout(700);
  await expect(room).toHaveAttribute("data-agent-movement-state", "idle");
  await expect(room).toHaveAttribute("data-agent-position-x", interruptedX!);

  const screenshot = testInfo.outputPath("autonomous-agent-movement.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach("autonomous-agent-movement", {
    path: screenshot,
    contentType: "image/png",
  });
  expect(errors).toEqual([]);
});

test("accepted user model plays exact Space and local gesture clips without transport", async ({
  page,
}, testInfo) => {
  // Exact transient clip receipts take 1.9 minutes in a faithful two-CPU
  // local scope and exceed three minutes on GitHub's software renderer.
  test.setTimeout(360_000);
  const errors = capturePageErrors(page);
  await installWorldState(page);
  const fixture = await installSessionFixture(page);
  await page.goto("/");
  await openRestoredWorld(page);
  const room = page.locator(".world-room");
  await expect(room).toHaveAttribute(
    "data-user-avatar-imported-id",
    "user-male-01",
  );
  await expect(room).toHaveAttribute(
    "data-agent-avatar-imported-id",
    "cat-agent-01",
  );

  const armUserAnimationCapture = async (
    semantic: string,
    clipIndex: string,
  ) => {
    await room.evaluate(
      (element, expected) => {
        delete document.body.dataset.capturedUserAnimation;
        const capture = () => {
          if (
            element.getAttribute("data-user-avatar-semantic") !==
              expected.semantic ||
            element.getAttribute("data-user-avatar-rendered-clip-index") !==
              expected.clipIndex
          )
            return false;
          document.body.dataset.capturedUserAnimation = `${expected.semantic}:${expected.clipIndex}`;
          return true;
        };
        if (capture()) return;
        const observer = new MutationObserver(() => {
          if (capture()) observer.disconnect();
        });
        observer.observe(element, {
          attributes: true,
          attributeFilter: [
            "data-user-avatar-semantic",
            "data-user-avatar-rendered-clip-index",
          ],
        });
      },
      { semantic, clipIndex },
    );
  };
  const expectCapturedUserAnimation = async (
    semantic: string,
    clipIndex: string,
  ) =>
    expect(page.locator("body")).toHaveAttribute(
      "data-captured-user-animation",
      `${semantic}:${clipIndex}`,
      { timeout: 10_000 },
    );

  await armUserAnimationCapture("Jump", "6");
  await page.keyboard.press("Space");
  await expectCapturedUserAnimation("Jump", "6");

  const composer = page.getByLabel("Message Mr Fluff");
  const accepted = [
    ["dance", "Dance", "20"],
    ["clap", "Clap", "13"],
    ["cheer", "Cheer", "17"],
    ["wave", "Wave", "7"],
    ["bow", "Bow", "4"],
    ["agree", "Agree", "11"],
    ["angry", "Angry", "19"],
    ["laugh", "Laugh", "5"],
  ] as const;
  for (const [command, semantic, clipIndex] of accepted) {
    await armUserAnimationCapture(semantic, clipIndex);
    await composer.fill(`/${command}`);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expectCapturedUserAnimation(semantic, clipIndex);
  }
  expect(fixture.mutationPaths).toEqual([]);

  await room.focus();
  await armUserAnimationCapture("Walk", "2");
  await page.keyboard.down("w");
  await expectCapturedUserAnimation("Walk", "2");
  await page.keyboard.up("w");
  await expect(room).toHaveAttribute("data-user-avatar-semantic", "Idle");
  await expect(room).toHaveAttribute(
    "data-user-avatar-rendered-clip-index",
    "15",
  );
  const screenshot = testInfo.outputPath(
    "accepted-runtime-animation-clips.png",
  );
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach("accepted-runtime-animation-clips", {
    path: screenshot,
    contentType: "image/png",
  });
  expect(errors).toEqual([]);
});

test("World Escape traps focus, respects editable owners, and delegates to reopened setup", async ({
  page,
}) => {
  // Software-rendered CI can spend more than 90 seconds reaching the final
  // keyboard close after proving every preceding menu/focus contract.
  test.setTimeout(180_000);
  const errors = capturePageErrors(page);
  await installWorldState(page);
  await installSessionFixture(page);
  await page.goto("/");
  await openRestoredWorld(page);

  await page.keyboard.press("Escape");
  const menu = page.getByRole("dialog", { name: "World menu" });
  await expect(menu).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Close World menu" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Settings" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(page.locator(".world-room")).toBeFocused();

  const composer = page.getByLabel("Message Mr Fluff");
  await composer.focus();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(composer).toBeFocused();
  expect(
    await composer.evaluate((element) => {
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(false);

  const room = page.locator(".world-room");
  await room.focus();
  await room.evaluate((element) =>
    element.setAttribute("data-mouse-look", "active"),
  );
  expect(
    await room.evaluate((element) => {
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(false);
  await expect(menu).toHaveCount(0);
  await room.evaluate((element) =>
    element.setAttribute("data-mouse-look", "idle"),
  );

  await page.evaluate(() => {
    const unrelated = document.createElement("section");
    unrelated.id = "unrelated-modal-owner";
    unrelated.setAttribute("role", "dialog");
    unrelated.setAttribute("aria-modal", "true");
    unrelated.setAttribute("aria-label", "Unrelated modal");
    document.body.append(unrelated);
  });
  expect(
    await room.evaluate((element) => {
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(false);
  await expect(menu).toHaveCount(0);
  await page.locator("#unrelated-modal-owner").evaluate((element) => {
    element.remove();
  });
  expect(
    await room.evaluate((element) => {
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(true);
  await expect(menu).toBeVisible();
  await page
    .getByRole("button", { name: "Agent Setup Menu", exact: true })
    .click();
  const setup = page.getByRole("dialog", {
    name: "Agent Setup Menu",
    exact: true,
  });
  await expect(setup).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await page.getByRole("button", { name: "Close Agent Setup Menu" }).click();
  await expect(setup).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Escape opens the entry menu during agent selection", async ({ page }) => {
  const errors = capturePageErrors(page);
  await installWorldState(page, false);
  await installSessionFixture(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Single Agent" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "World menu" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Change Agent", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Agent Setup Menu", exact: true }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});

test("first-run setup gates selection without discovering automatically and retains Escape", async ({
  page,
}) => {
  await installWorldState(page, false);
  await installSessionFixture(page);
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
  let discoveryRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/agent-setup/discover")
      discoveryRequests += 1;
  });
  await page.goto("/");
  await expect(
    page.getByRole("dialog", { name: "Agent Setup Menu", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Single Agent", exact: true }),
  ).toHaveCount(0);
  expect(discoveryRequests).toBe(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "World menu" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "World menu" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Discover Agents", exact: true }),
  ).toBeVisible();
  expect(discoveryRequests).toBe(0);
});

test("slash focuses active World chat and submitted history restores its draft", async ({
  page,
}) => {
  // Software-rendered CI can spend more than five minutes on six animated
  // submissions; keyboard/history assertions remain exact.
  test.setTimeout(600_000);
  const errors = capturePageErrors(page);
  await installWorldState(page);
  await installSessionFixture(page);
  await installAutonomousMovementFixture(page);
  await page.goto("/");
  await openRestoredWorld(page);

  const room = page.locator(".world-room");
  const composer = page.getByLabel("Message Mr Fluff");
  expect(
    await room.evaluate((element) => {
      const event = new KeyboardEvent("keydown", {
        key: "/",
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(true);
  await expect(composer).toBeFocused();
  await expect(composer).toHaveValue("/");

  await composer.fill("existing draft");
  await room.focus();
  await page.keyboard.press("/");
  await expect(composer).toBeFocused();
  await expect(composer).toHaveValue("existing draft");
  await page.keyboard.press("/");
  await expect(composer).toHaveValue("existing draft/");

  await room.focus();
  await page.keyboard.press("Escape");
  const menu = page.getByRole("dialog", { name: "World menu" });
  await expect(menu).toBeVisible();
  const settings = page.getByRole("button", { name: "Settings" });
  await expect(settings).toBeFocused();
  expect(
    await settings.evaluate((element) => {
      const event = new KeyboardEvent("keydown", {
        key: "/",
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(false);
  await expect(settings).toBeFocused();
  await page.keyboard.press("Escape");

  for (const submission of [
    "/wave",
    "/bow",
    "/clap",
    "/clap",
    "/laugh",
    "/dance",
  ]) {
    await composer.fill(submission);
    const send = page.getByRole("button", { name: "Send", exact: true });
    await expect(send).toBeEnabled();
    await send.click();
  }
  await composer.fill("unsent draft");
  await expect(composer).toBeFocused();
  for (const expected of ["/dance", "/laugh", "/clap", "/clap", "/bow"]) {
    await page.keyboard.press("ArrowUp");
    await expect(composer).toHaveValue(expected);
  }
  await page.keyboard.press("ArrowUp");
  await expect(composer).toHaveValue("/bow");
  for (const expected of [
    "/clap",
    "/clap",
    "/laugh",
    "/dance",
    "unsent draft",
  ]) {
    await page.keyboard.press("ArrowDown");
    await expect(composer).toHaveValue(expected);
  }
  expect(
    await composer.evaluate((input: HTMLInputElement) => input.selectionStart),
  ).toBe("unsent draft".length);
  expect(errors).toEqual([]);
});

test("Settings stays product-facing and Change Avatar selects the exact role and agent", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = capturePageErrors(page);
  await installWorldState(page);
  const fixture = await installSessionFixture(page);
  await page.goto("/");
  await openRestoredWorld(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(
    page.getByRole("heading", { name: "World settings" }),
  ).toBeVisible();
  await expect(page.getByLabel("Show World control hints")).toBeChecked();
  await page.getByLabel("Show World control hints").uncheck();
  await expect(
    page.getByRole("status", { name: "World controls" }),
  ).toHaveCount(0);
  await page.getByLabel("Show World control hints").check();
  await page.getByLabel("Large menu text").check();
  await expect(page.locator(".world-escape-dialog")).toHaveAttribute(
    "data-large-text",
    "true",
  );
  await expect(page.getByText(/internal dashboard/iu)).toHaveCount(0);
  await page.getByRole("button", { name: "Back to World menu" }).click();
  await page.getByRole("button", { name: "Change Avatar" }).click();
  await expect(
    page.getByRole("heading", { name: "Choose avatar to change" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mr Fluff · connected agent" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Change Mr Fluff’s avatar" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("User Male 1", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open Robot Agent 5 3D preview" })
    .click();
  await page.getByRole("button", { name: "Use Complete Avatar" }).click();
  const saveAgentAvatar = page.getByRole("button", {
    name: "Accept and save avatar",
  });
  await expect(saveAgentAvatar).toBeEnabled();
  await saveAgentAvatar.click();
  await expect(page.locator(".world-room")).toBeVisible();
  expect(fixture.acceptedProposal().avatarSource).toMatchObject({
    kind: "imported",
    version: 2,
    mode: "original",
    modelId: "robot-agent-05",
  });

  await page.locator(".world-room").focus();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Change Avatar" }).click();
  await page.getByRole("button", { name: "World User · user" }).click();
  await expect(
    page.getByRole("heading", { name: "Change World User’s avatar" }),
  ).toBeVisible();
  await expect(page.getByText("User Male 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Cat Agent 1", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Save user avatar" }).click();
  await expect(page.locator(".world-room")).toBeVisible();
  await page.reload();
  await openRestoredWorld(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(".world-escape-dialog")).toHaveAttribute(
    "data-large-text",
    "true",
  );
  expect(errors).toEqual([]);
});

test("Reset confirms while Logout and Change Agent clear only the browser attachment", async ({
  page,
}) => {
  // Three full restore/detach cycles can exceed the generic 30-second watchdog
  // on two-CPU software-rendered CI; every state and mutation assertion remains.
  test.setTimeout(60_000);
  const errors = capturePageErrors(page);
  await installWorldState(page);
  const fixture = await installSessionFixture(page);
  await page.goto("/");
  await openRestoredWorld(page);
  // Restore/detach state is the contract; do not cancel pending GLB decoding
  // with the next reload and mistake that navigation abort for a texture fault.
  await expect(
    page.locator('canvas[data-scene-id="world-room"]'),
  ).toHaveAttribute("data-avatar-render-ready", "true", { timeout: 20_000 });

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Reset Session" }).click();
  await expect(
    page.getByRole("heading", { name: "Reset current World session?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel reset" }).click();
  await expect(page.locator(".world-room")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "World menu" })).toBeVisible();
  await page.getByRole("button", { name: "Reset Session" }).click();
  await page.getByRole("button", { name: "Reset current session" }).click();
  await expect(
    page.getByRole("button", { name: "Single Agent" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("aiw.agent-session.pointer.0.12"),
    ),
  ).toBeNull();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("aiw.avatar.profile.0.18.5"),
    ),
  ).not.toBeNull();
  expect(fixture.mutationPaths).toEqual([]);

  await page.evaluate((activeSessionId) => {
    localStorage.setItem("aiw.agent-session.pointer.0.12", activeSessionId);
  }, sessionId);
  await page.reload();
  await openRestoredWorld(page);
  // Restore/detach state is the contract; do not cancel pending GLB decoding
  // with the next reload and mistake that navigation abort for a texture fault.
  await expect(
    page.locator('canvas[data-scene-id="world-room"]'),
  ).toHaveAttribute("data-avatar-render-ready", "true", { timeout: 20_000 });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Change Agent" }).click();
  await expect(page.getByLabel("Agent name")).toBeVisible();
  expect(fixture.mutationPaths).toEqual([]);

  await page.evaluate((activeSessionId) => {
    localStorage.setItem("aiw.agent-session.pointer.0.12", activeSessionId);
  }, sessionId);
  await page.reload();
  await openRestoredWorld(page);
  // Restore/detach state is the contract; do not cancel pending GLB decoding
  // with the next reload and mistake that navigation abort for a texture fault.
  await expect(
    page.locator('canvas[data-scene-id="world-room"]'),
  ).toHaveAttribute("data-avatar-render-ready", "true", { timeout: 20_000 });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(
    page.getByRole("button", { name: "Single Agent" }),
  ).toBeVisible();
  expect(fixture.mutationPaths).toEqual([]);
  expect(errors).toEqual([]);
});

test("live-shaped authority keeps misses truthful and migrates legacy Mr Fluff through cat and robot reloads", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1365, height: 900 });
  const errors = capturePageErrors(page);
  await installWorldState(page, false);
  const fixture = await installSessionFixture(page, {
    initialProposal: legacyProposal,
    liveProposalAvailable: false,
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Single Agent" }).click();
  await page.getByRole("button", { name: "Connect hermes" }).click();

  await page.getByLabel("Agent name").fill("Beans");
  await page.getByRole("button", { name: "Connect agent" }).click();
  await expect(
    page.locator('span[aria-hidden="true"]', {
      hasText: /^agent not found$/u,
    }),
  ).toBeVisible();
  expect(fixture.mutationPaths).toEqual([]);
  await page.getByRole("button", { name: "Retry" }).click();

  await page.getByLabel("Agent name").fill("Mr Fluff");
  await page.getByRole("button", { name: "Connect agent" }).click();
  await expect(
    page.getByRole("region", { name: "Agent avatar selection" }),
  ).toBeVisible();
  await expect(page.getByLabel("Agent name", { exact: true })).toHaveValue(
    "Mr Fluff",
  );
  await expect(page.getByText("Preserved legacy profile")).toHaveCount(0);
  await expect(page.getByTestId("avatar-preview")).toHaveAttribute(
    "data-avatar-source",
    "imported",
  );
  await expect(page.getByTestId("avatar-preview")).toHaveAttribute(
    "data-avatar-imported-id",
    "cat-agent-01",
  );
  expect(fixture.acceptedProposal().avatarSource).toBeUndefined();
  expect(fixture.mutationPaths).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Open Cat Agent 1 3D preview" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Open Robot Agent 5 3D preview" }),
  ).toHaveAttribute("aria-pressed", "false");

  await page
    .getByRole("button", { name: "Open Cat Agent 1 3D preview" })
    .click();
  const saveCatAvatar = page.getByRole("button", {
    name: "Accept Agent Avatar",
  });
  await expect(saveCatAvatar).toBeEnabled();
  await saveCatAvatar.click();
  const enterWorld = page.getByRole("button", { name: "Enter World" });
  await expect(enterWorld).toBeEnabled({ timeout: 30_000 });
  await enterWorld.click();
  await expect(page.locator(".world-room")).toHaveAttribute(
    "data-agent-avatar-imported-id",
    "cat-agent-01",
  );
  await page.reload();
  await expect(page.locator(".world-room")).toHaveAttribute(
    "data-agent-avatar-imported-id",
    "cat-agent-01",
  );

  await page.locator(".world-room").focus();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Change Avatar" }).click();
  await page
    .getByRole("button", { name: "Mr Fluff · connected agent" })
    .click();
  await page
    .getByRole("button", { name: "Open Robot Agent 5 3D preview" })
    .click();
  await page.getByRole("button", { name: "Use Complete Avatar" }).click();
  await page.getByRole("button", { name: "Accept and save avatar" }).click();
  await expect(page.locator(".world-room")).toHaveAttribute(
    "data-agent-avatar-imported-id",
    "robot-agent-05",
  );
  await page.reload();
  await expect(page.locator(".world-room")).toHaveAttribute(
    "data-agent-avatar-imported-id",
    "robot-agent-05",
  );
  expect(fixture.acceptedProposal().avatarSource).toMatchObject({
    kind: "imported",
    version: 2,
    mode: "original",
    modelId: "robot-agent-05",
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".world-room").focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "World menu" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  expect(errors).toEqual([]);
});
