import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { openPanel, seedConfiguredAvatar } from "./helpers.js";

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  test(`Phase 12 exact-session connector is accessible on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
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
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await seedConfiguredAvatar(page);
    await page.goto("/?fixture=phase12-session");
    await openPanel(page, "Agents");
    await expect(
      page.getByRole("heading", { name: "Hermes connector and World chat" }),
    ).toBeVisible();
    await expect(page.locator(".connector-flow > li")).toHaveCount(10);
    await expect(
      page.locator(".session-identity dd").filter({
        hasText: "20260721_011618_330489c8",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Autonomous/ }),
    ).toBeDisabled();
    const active = page.getByRole("button", { name: /Explore/ });
    const disabled = page.getByRole("button", { name: /Autonomous/ });
    expect(
      await active.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    ).not.toBe(
      await disabled.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    );
    const message = page.getByLabel("Message");
    await message.fill("harmless persistent turn");
    await page.getByRole("button", { name: "Send to exact session" }).click();
    await expect(
      page
        .getByLabel("Persistent accessible World chat")
        .getByText("Fixture persistent reply: harmless persistent turn"),
    ).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      ),
    ).toEqual([]);
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("body *")]
        .filter(
          (element) =>
            element.getBoundingClientRect().right >
            document.documentElement.clientWidth + 0.5,
        )
        .map((element) => element.className)
        .slice(0, 10),
    );
    expect(overflow).toEqual([]);
    expect(errors).toEqual([]);
    await page.reload();
    await openPanel(page, "Agents");
    await expect(page.getByText("Current · ready")).toBeVisible();
  });
}

test("Phase 12 offline avatar consent controls are disabled and neutral-grey", async ({
  page,
}) => {
  await seedConfiguredAvatar(page);
  await page.goto("/?fixture=phase12-offline");
  await openPanel(page, "Agents");
  await expect(page.getByText("Unavailable · offline")).toBeVisible();
  await expect(
    page.getByText(
      "Hermes plugin/API is offline; send and consent controls are unavailable.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect existing session" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Send to exact session" }),
  ).toBeDisabled();

  const displayName = page.getByLabel("Edit bounded avatar display name");
  const active = page.getByRole("button", { name: /Explore/ });
  const neutral = page.getByRole("button", { name: /Autonomous/ });
  const activeBackground = await active.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  const neutralBackground = await neutral.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await expect(displayName).toBeDisabled();
  expect(
    await displayName.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).toBe(neutralBackground);

  for (const name of ["Accept / save edits", "Decline", "Revoke"]) {
    const control = page.getByRole("button", { name });
    await expect(control).toBeDisabled();
    await expect(control).toHaveClass(/session-action--disabled/);
    await expect(control).not.toHaveClass(/session-action--active/);
    expect(
      await control.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    ).toBe(neutralBackground);
  }
  expect(neutralBackground).not.toBe(activeBackground);
});

test("Phase 12 browser reload resumes the durable World projection", async ({
  page,
}) => {
  let streamCalls = 0;
  const session = {
    schema: "aiw.agent-session/0.12",
    sessionId: "11111111-1111-4111-8111-111111111111",
    adapterId: "hermes",
    adapterSessionRef: "20260721_011618_330489c8",
    profile: "default",
    workspaceId: "ws_fixture",
    repositoryRef: "repo_fixture",
    mode: "explore",
    permissionRevision: 0,
    capabilitySnapshotHash: "a".repeat(64),
    continuity: "current",
    status: "ready",
  } as const;
  const envelope = (data: unknown) => ({
    ok: true,
    data,
    meta: {
      correlationId: "33333333-3333-4333-8333-333333333333",
      schema: "aiw.api/0.3",
    },
  });
  await page.route("**/api/agent-sessions/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let data: unknown;
    if (pathname.endsWith("/capabilities"))
      data = [
        {
          adapterId: "hermes",
          capabilities: {
            attach: true,
            sendText: true,
            streamDeltas: true,
            toolStatus: true,
            approvals: false,
          },
          unavailable: { approvals: "Native approvals stay in Hermes." },
        },
      ];
    else if (pathname.endsWith("/native"))
      data = [
        {
          id: session.adapterSessionRef,
          source: "discord",
          title: "Existing Discord lane",
        },
      ];
    else if (
      pathname.endsWith("/attach") &&
      route.request().method() === "POST"
    )
      data = session;
    else if (pathname.endsWith("/status")) data = session;
    else if (pathname.endsWith("/history"))
      data = {
        sessionId: session.sessionId,
        continuity: "current",
        messages: [
          { role: "user", text: "durable browser turn" },
          { role: "assistant", text: "durable recovered reply" },
        ],
        avatarConsent: null,
        transcriptAuthority: "hermes",
      };
    else if (pathname.endsWith("/avatar-proposal")) data = null;
    else if (pathname.endsWith("/stream")) {
      streamCalls += 1;
      const terminal = (event: string, value: unknown) =>
        `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
      const worldEvent = (
        sequence: number,
        type: string,
        payload: Record<string, unknown>,
        redaction = { applied: false, count: 0 },
      ) =>
        terminal("world.event", {
          schema: "aiw.agent-event/0.12",
          eventId: `${String(sequence).padStart(8, "0")}-4444-4444-8444-444444444444`,
          sessionId: session.sessionId,
          sequence,
          occurredAt: "2026-07-21T05:00:00.000Z",
          correlationId: "55555555-5555-4555-8555-555555555555",
          type,
          payload,
          redaction,
        });
      const body =
        streamCalls === 1
          ? [
              worldEvent(1, "message.user-accepted", { text: "stream it" }),
              worldEvent(2, "message.assistant-delta", {
                text: "progressive ",
              }),
              worldEvent(
                3,
                "tool.started",
                { toolName: "terminal" },
                { applied: true, count: 2 },
              ),
              worldEvent(4, "message.assistant-delta", { text: "final" }),
              worldEvent(5, "message.assistant-final", {
                text: "progressive final",
              }),
              terminal("world.final", {
                schema: "aiw.agent-stream-terminal/0.12",
                sessionId: session.sessionId,
                status: "completed",
                finalText: "progressive final",
              }),
              terminal("world.done", {
                schema: "aiw.agent-stream-terminal/0.12",
                sessionId: session.sessionId,
                status: "completed",
              }),
            ].join("")
          : [
              terminal("world.error", {
                schema: "aiw.agent-stream-terminal/0.12",
                sessionId: session.sessionId,
                status: "error",
                message: "Fixture stream disconnected.",
              }),
              terminal("world.done", {
                schema: "aiw.agent-stream-terminal/0.12",
                sessionId: session.sessionId,
                status: "error",
              }),
            ].join("");
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "cache-control": "no-cache" },
        body,
      });
    } else return route.abort();
    await route.fulfill({
      status: pathname.endsWith("/attach") ? 201 : 200,
      contentType: "application/json",
      body: JSON.stringify(envelope(data)),
    });
  });
  await page.route("**/api/guided-build/designs", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope([])),
    }),
  );
  await seedConfiguredAvatar(page);
  await page.goto("/?fixture=phase12-api");
  await openPanel(page, "Agents");
  const connect = page.getByRole("button", {
    name: "Connect existing session",
  });
  await expect(connect).toBeEnabled();
  await connect.click();
  await expect(page.getByText("Current · ready")).toBeVisible();
  await page.getByLabel("Message").fill("stream it");
  await page.getByRole("button", { name: "Send to exact session" }).click();
  await expect(
    page
      .getByLabel("Persistent accessible World chat")
      .getByText("progressive final"),
  ).toHaveCount(1);
  await expect(page.getByText("terminal · started")).toBeVisible();
  await page.getByLabel("Message").fill("disconnect it");
  await page.getByRole("button", { name: "Send to exact session" }).click();
  await expect(
    page.getByText(/Stream ended: Fixture stream disconnected/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send to exact session" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("aiw.agent-session.pointer.0.12"),
    ),
  ).toBe(session.sessionId);
  await page.reload();
  await openPanel(page, "Agents");
  await expect(
    page
      .getByLabel("Persistent accessible World chat")
      .getByText("durable recovered reply"),
  ).toBeVisible();
  await expect(page.getByText("Current · ready")).toBeVisible();
});
