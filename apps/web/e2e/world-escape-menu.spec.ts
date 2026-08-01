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
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() !== "GET" && !pathname.endsWith("/attach"))
      mutationPaths.push(`${request.method()} ${pathname}`);
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
          id: session.adapterRootSessionRef,
          source: "cli",
          title: "Current Hermes lane",
          displayName: "Mr Fluff",
        },
      ];
    else if (pathname.endsWith("/agent-sessions/attach")) data = session;
    else if (pathname.endsWith("/status")) data = session;
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

test("Escape is active only in World, traps focus, and stays inert for editable owners", async ({
  page,
}) => {
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
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Escape listener is absent outside the normal World", async ({ page }) => {
  const errors = capturePageErrors(page);
  await installWorldState(page, false);
  await installSessionFixture(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Single Agent" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "World menu" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Settings stays product-facing and Change Avatar selects the exact role and agent", async ({
  page,
}) => {
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
  ).toBeVisible();
  await expect(page.getByText("User Male 1", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open Robot Agent 5 3D preview" })
    .click();
  await page.getByRole("button", { name: "Use Complete Avatar" }).click();
  await page.getByRole("button", { name: "Accept and save avatar" }).click();
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
  const errors = capturePageErrors(page);
  await installWorldState(page);
  const fixture = await installSessionFixture(page);
  await page.goto("/");
  await openRestoredWorld(page);

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
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Change Agent" }).click();
  await expect(page.getByLabel("Agent name")).toBeVisible();
  expect(fixture.mutationPaths).toEqual([]);

  await page.evaluate((activeSessionId) => {
    localStorage.setItem("aiw.agent-session.pointer.0.12", activeSessionId);
  }, sessionId);
  await page.reload();
  await openRestoredWorld(page);
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
  await page.setViewportSize({ width: 1365, height: 900 });
  const errors = capturePageErrors(page);
  await installWorldState(page, false);
  const fixture = await installSessionFixture(page, {
    initialProposal: legacyProposal,
    liveProposalAvailable: false,
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Single Agent" }).click();
  await page.getByRole("button", { name: /hermes_/u }).click();

  await page.getByLabel("Agent name").fill("Beans");
  await page.getByRole("button", { name: "Connect agent" }).click();
  await expect(
    page.getByText("agent not found", { exact: true }),
  ).toBeVisible();
  expect(fixture.mutationPaths).toEqual([]);
  await page.getByRole("button", { name: "Retry" }).click();

  await page.getByLabel("Agent name").fill("Mr Fluff");
  await page.getByRole("button", { name: "Connect agent" }).click();
  await expect(
    page.getByRole("heading", { name: "Change Mr Fluff’s avatar" }),
  ).toBeVisible();
  await expect(page.getByText("Preserved legacy profile")).toBeVisible();
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
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Open Robot Agent 5 3D preview" }),
  ).toHaveAttribute("aria-pressed", "false");

  await page
    .getByRole("button", { name: "Open Cat Agent 1 3D preview" })
    .click();
  await page.getByRole("button", { name: "Use Complete Avatar" }).click();
  await page.getByRole("button", { name: "Accept and save avatar" }).click();
  await page.getByRole("button", { name: "Enter World" }).click();
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
