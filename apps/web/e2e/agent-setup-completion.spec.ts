import { expect, test } from "@playwright/test";
import {
  RegistrationSchema,
  type AgentRegistration,
} from "@agentintersect-world/world-schema/agent-setup";

test("setup explicitly selects native Hermes conversation and confirms each prerequisite change", async ({
  page,
}) => {
  const posts: { pathname: string; body: Record<string, unknown> }[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const state = {
    schema: "aiw.agent-setup/1",
    completed: false,
    registrations: [],
  };
  const installation = {
    id: "fixture-hermes",
    adapterId: "hermes",
    environment: { id: "local", kind: "linux", label: "Local fixture" },
    executablePath: "/fixture/hermes",
    homePath: "/fixture",
    identities: [
      {
        id: "selected",
        label: "Selected profile",
        kind: "profile",
        profilePath: "/fixture/profiles/selected",
      },
    ],
    status: "found",
  };
  const plan = {
    id: "11111111-1111-4111-8111-111111111111",
    expiresAt: "2099-01-01T00:00:00Z",
    target: "Local fixture · Selected profile · /fixture/profiles/selected",
    actions: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        kind: "enable-hermes-world-plugin",
        title: "Enable the installed World plugin",
        reason: "Plugin is disabled.",
        effect: "Enable this profile only; no restart.",
        paths: ["/fixture/profiles/selected/config.yaml"],
      },
    ],
    guidance: [
      "Native login and gateway restart remain separate owner actions.",
    ],
  };
  await page.route("**/api/agent-setup**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const body =
      request.method() === "POST"
        ? (request.postDataJSON() as Record<string, unknown>)
        : {};
    if (request.method() === "POST") posts.push({ pathname, body });
    let data: unknown = state;
    if (pathname.endsWith("/discover"))
      data = {
        environments: [
          { id: "local", label: "Local fixture", status: "scanned" },
        ],
        installations: [installation],
      };
    else if (pathname.endsWith("/conversations"))
      data = [
        {
          id: "native-existing-42",
          title: "Existing native work",
          source: "cli",
        },
      ];
    else if (pathname.endsWith("/preview")) data = plan;
    else if (pathname.endsWith("/cancel")) data = { cancelled: true };
    else if (pathname.endsWith("/apply"))
      data = {
        applied: true,
        check: { status: "ready", message: "Native fixture ready." },
      };
    else if (pathname.endsWith("/attach"))
      data = {
        registration: null,
        check: {
          status: "needs-attention",
          message: "Fixture attachment captured; no real harness was called.",
        },
      };
    else if (pathname.endsWith("/check"))
      data = { status: "ready", message: "Native fixture ready." };
    await route.fulfill({ json: { ok: true, data } });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Discover Agents", exact: true })
    .click();
  await page.locator("summary").filter({ hasText: "Hermes" }).click();
  await page
    .getByLabel("Agent name", { exact: true })
    .fill("World display label");
  await expect(page.getByLabel("Conversation for new Worlds")).toHaveValue("");
  await page
    .getByRole("button", { name: "List existing Hermes conversations" })
    .click();
  await page
    .getByLabel("Conversation for new Worlds")
    .selectOption("native-existing-42");
  await page.getByRole("button", { name: "Preview prerequisites" }).click();
  const apply = page.getByRole("button", { name: "Apply approved change" });
  await expect(apply).toBeDisabled();
  expect(posts.filter((p) => p.pathname.endsWith("/apply"))).toHaveLength(0);
  await page.getByRole("button", { name: "Cancel prerequisite plan" }).click();
  await expect(
    page.getByText("Plan cancelled. No change applied."),
  ).toBeVisible();
  expect(posts.filter((p) => p.pathname.endsWith("/apply"))).toHaveLength(0);
  await page.getByRole("button", { name: "Preview prerequisites" }).click();
  await page
    .getByRole("checkbox", {
      name: "I approve this specific change to this native profile.",
    })
    .check();
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(page.getByText(/Change applied and rechecked/)).toBeVisible();
  expect(posts.filter((p) => p.pathname.endsWith("/apply"))).toEqual([
    {
      pathname: "/api/agent-setup/prerequisites/apply",
      body: { planId: plan.id, actionId: plan.actions[0]!.id, confirmed: true },
    },
  ]);
  await page
    .getByRole("button", { name: "Attach to Agent Intersect World" })
    .click();
  await expect(page.getByText(/Fixture attachment captured/)).toBeVisible();
  expect(posts.find((p) => p.pathname.endsWith("/attach"))?.body).toEqual({
    installationId: installation.id,
    identityId: "selected",
    displayName: "World display label",
    conversationRef: "native-existing-42",
  });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Agent Setup Menu", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("@setup-feedback groups environments, confirms attachment and restores inputs after failed recheck", async ({
  page,
}, testInfo) => {
  const installation = {
    id: "codex-wsl",
    adapterId: "codex",
    environment: {
      id: "wsl:Ubuntu",
      kind: "wsl",
      label: "WSL (Ubuntu)",
      distro: "Ubuntu",
    },
    executablePath: "/usr/local/bin/codex",
    homePath: "/home/user",
    identities: [
      {
        id: "default",
        label: "Default",
        kind: "profile",
        profilePath: "/home/user/.codex",
      },
    ],
    status: "found",
  };
  const state: {
    schema: "aiw.agent-setup/1";
    completed: boolean;
    registrations: AgentRegistration[];
  } = { schema: "aiw.agent-setup/1", completed: false, registrations: [] };
  let ready = true;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/agent-setup**", async (route) => {
    const url = new URL(route.request().url());
    let data: unknown = state;
    if (url.pathname.endsWith("/discover"))
      data = {
        currentWslDistro: "Ubuntu",
        defaultWslDistro: "Ubuntu",
        environments: [
          { id: "wsl:Ubuntu", label: "WSL (Ubuntu)", status: "scanned" },
        ],
        installations: [
          installation,
          {
            ...installation,
            id: "codex-alternative",
            executablePath: "/other/codex",
          },
        ],
      };
    if (url.pathname.endsWith("/attach")) {
      const input = route.request().postDataJSON();
      const registration = RegistrationSchema.parse({
        ...installation,
        id: "11111111-1111-4111-8111-111111111111",
        installationId: input.installationId,
        identity: installation.identities[0],
        displayName: input.displayName,
        connectedAt: new Date().toISOString(),
      });
      state.registrations = [registration];
      data = {
        registration,
        check: { status: "ready", message: "Native connection ready" },
      };
    }
    if (url.pathname.endsWith("/recheck"))
      data = {
        status: ready ? "ready" : "needs-attention",
        message: ready
          ? "Native connection ready"
          : "Selected native installation is unavailable. Retry or select another.",
      };
    await route.fulfill({ json: { ok: true, data } });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Discover Agents", exact: true })
    .click();
  await page.locator("summary").filter({ hasText: "Codex" }).click();
  const group = page.locator('[data-setup-environment="wsl"]');
  await expect(group).toHaveCount(1);
  await group.getByLabel("Agent name", { exact: true }).fill("Codex 1");
  await group
    .getByRole("button", { name: "Attach to Agent Intersect World" })
    .click();
  const success = group.getByRole("button", {
    name: /Codex · WSL \(Ubuntu\) · “Codex 1” — Successfully Connected/,
  });
  await expect(success).toBeVisible();
  await expect(group.getByLabel("Agent name", { exact: true })).toBeHidden();
  await expect(success).toHaveCSS("background-color", "rgb(23, 103, 61)");
  await page.screenshot({ path: testInfo.outputPath("setup-green.png") });
  ready = false;
  await page.getByRole("button", { name: "Recheck", exact: true }).click();
  await expect(success).toBeHidden();
  await expect(group.getByLabel("Agent name", { exact: true })).toHaveValue(
    "Codex 1",
  );
  await expect(group.getByLabel("Agent name", { exact: true })).toBeVisible();
  await expect(group.getByLabel("Native identity")).toHaveValue("default");
  await page.setViewportSize({ width: 390, height: 844 });
  await group
    .getByLabel("Agent name", { exact: true })
    .scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("setup-recheck-mobile.png"),
  });
  expect(errors).toEqual([]);
});
