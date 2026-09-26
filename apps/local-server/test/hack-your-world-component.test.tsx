import { mkdtemp, rm, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Fastify from "fastify";
import { chromium, expect as browserExpect } from "@playwright/test";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { expect, it } from "vitest";
import { registerEnvironmentLibraryRoutes } from "../src/environment-library.js";

// An isolated component + real disposable slot API, never the product/onboarding/agent UI.
it("shows hold/click/orbit feedback and saves previews into durable numbered cycling slots", async () => {
  const root = await mkdtemp(join(tmpdir(), "aiw-slot-component-"));
  const server = Fastify();
  const out =
    process.env.AIW_TEST_EVIDENCE_DIR ??
    `/tmp/aiw-slot-component-evidence-${process.pid}`;
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    await build({
      configFile: false,
      define: { "process.env.NODE_ENV": JSON.stringify("development") },
      plugins: [react()],
      logLevel: "error",
      build: {
        outDir: join(root, "dist"),
        emptyOutDir: true,
        lib: {
          entry: resolve("apps/web/test/fixtures/hack-world-component.tsx"),
          name: "SlotFixture",
          formats: ["iife"],
          fileName: () => "component.js",
          cssFileName: "component",
        },
      },
    });
    await server.register(
      async (api) => registerEnvironmentLibraryRoutes(api, join(root, "slots")),
      { prefix: "/api" },
    );
    server.get("/api/agent-sessions/fixture/environment", async () => ({
      ok: true,
      data: { available: true, reason: null, sessionId: "fixture" },
    }));
    server.get("/", async (_req, reply) =>
      reply
        .type("text/html")
        .send(
          '<meta charset="utf-8"><link rel="stylesheet" href="/component.css"><style>body{background:#102030;color:white;font-family:Consolas,monospace}</style><div id="root"></div><script src="/component.js"></script>',
        ),
    );
    server.get("/component.js", async (_req, reply) =>
      reply
        .type("application/javascript")
        .send(await readFile(join(root, "dist/component.js"))),
    );
    server.get("/component.css", async (_req, reply) =>
      reply
        .type("text/css")
        .send(await readFile(join(root, "dist/component.css"))),
    );
    const url = await server.listen({ port: 0, host: "127.0.0.1" });
    const page = await browser.newPage({
      viewport: { width: 1100, height: 800 },
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error("Component runtime error:", error.message);
    });
    await page.goto(url);
    const trigger = page.getByRole("button", { name: /^Hack your World/ });
    await browserExpect(trigger).toBeVisible();
    const orbit = page.locator(".hack-world__orbit").first();
    expect(
      await orbit.evaluate((el) => getComputedStyle(el).animationDuration),
    ).toBe("3.6s");
    await page.getByText("Fixture transition", { exact: true }).click();
    expect(
      await orbit.evaluate((el) => getComputedStyle(el).animationDuration),
    ).toBe("0.65s");
    await page.getByText("Fixture transition", { exact: true }).click();
    await trigger.click();
    await browserExpect(page.locator(".hack-world__click")).toHaveCount(1);
    await browserExpect(page.getByLabel("Active fixture")).toHaveText("sunlit");
    const box = (await trigger.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down({ button: "right" });
    await browserExpect(page.locator(".hack-world__hold-track")).toBeVisible();
    await page.mouse.up({ button: "right" });
    await browserExpect(page.locator(".hack-world__hold-track")).toHaveCount(0);
    await browserExpect(page.getByRole("dialog")).toHaveCount(0);
    await page.mouse.down({ button: "right" });
    await browserExpect(page.getByRole("dialog")).toBeVisible();
    await page.mouse.up({ button: "right" });
    await page.getByLabel("Your World description").fill("Icy blue mountains");
    await page
      .getByRole("button", { name: "Create with connected agent" })
      .click();
    await browserExpect(
      page.getByText("Save this World to a custom slot?", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Custom slot", exact: true })
      .selectOption("3");
    const assertClearance = async () =>
      browserExpect
        .poll(async () =>
          page.evaluate(() => {
            const hud = document
              .querySelector(".hack-world")!
              .getBoundingClientRect();
            const project = document
              .querySelector(".project-overview")!
              .getBoundingClientRect();
            return project.top - hud.bottom;
          }),
        )
        .toBeGreaterThanOrEqual(8);
    await assertClearance();
    await page.screenshot({ path: join(out, "save-prompt.png") });
    await page.clock.install();
    // pauseAt advances to a future instant; a sampled "now" can be past by
    // the next protocol call. Freeze before the action starts its toast timer.
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
    await page
      .getByRole("button", { name: "Save to Custom 3", exact: true })
      .click();
    await browserExpect(
      page
        .getByRole("status")
        .filter({ hasText: /Saved to Custom slot 3 on this PC/ }),
    ).toBeVisible();
    expect(
      JSON.parse(await readFile(join(root, "slots/slot-3.json"), "utf8")).name,
    ).toBe("Fixture Glacier");
    expect(
      JSON.parse(await readFile(join(root, "slots/slot-3.json"), "utf8"))
        .originalDescription,
    ).toBe("Icy blue mountains");
    const savedToast = page
      .getByRole("status")
      .filter({ hasText: /Saved to Custom slot 3 on this PC/ });
    await page.clock.runFor(4999);
    await browserExpect(savedToast).toBeVisible();
    await page.clock.runFor(1);
    await browserExpect(savedToast).toHaveCount(0);
    await page.clock.resume();
    await page.reload();
    for (const expected of ["sunlit", "mars", "slot-3", "original"]) {
      await trigger.click();
      await browserExpect(page.getByLabel("Active fixture")).toHaveText(
        expected,
      );
    }
    await trigger.focus();
    await page.keyboard.press("Shift+F10");
    await page
      .getByRole("button", { name: "Create with connected agent" })
      .click();
    await page
      .getByRole("combobox", { name: "Custom slot", exact: true })
      .selectOption("3");
    await browserExpect(
      page.getByRole("button", { name: "Save to Custom 3", exact: true }),
    ).toBeDisabled();
    await page.getByRole("checkbox", { name: /Replace/ }).check();
    await browserExpect(
      page.getByRole("button", { name: "Save to Custom 3", exact: true }),
    ).toBeEnabled();
    // pauseAt advances to a future instant; a sampled "now" can be past by
    // the next protocol call. Freeze before the action starts its toast timer.
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
    await page.getByRole("button", { name: "Use without saving" }).click();
    const temporaryToast = page
      .getByRole("status")
      .filter({ hasText: /Using this World for now/ });
    await page.clock.runFor(4999);
    await browserExpect(temporaryToast).toBeVisible();
    await assertClearance();
    await page.screenshot({ path: join(out, "use-for-now-clearance.png") });
    await page.clock.runFor(1);
    await browserExpect(temporaryToast).toHaveCount(0);
    await page.clock.resume();
    await page.getByText("Fixture reduced motion", { exact: true }).click();
    expect(
      await orbit.evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
    await page.setViewportSize({ width: 390, height: 844 });
    for (const width of [390, 894, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await browserExpect
        .poll(async () =>
          page.evaluate(() => {
            const hud = document
              .querySelector(".hack-world")!
              .getBoundingClientRect();
            const project = document
              .querySelector(".project-overview")!
              .getBoundingClientRect();
            return project.top - hud.bottom;
          }),
        )
        .toBeGreaterThanOrEqual(8);
    }
    await page.screenshot({ path: join(out, "hud-portrait.png") });
    await trigger.focus();
    await page.keyboard.press("Shift+F10");
    await page
      .getByText("Weather and expanded scenery", { exact: true })
      .click();
    await page
      .getByLabel("Weather particles", { exact: true })
      .selectOption("snow");
    await page.getByLabel("Lightning", { exact: true }).selectOption("both");
    await page
      .getByLabel("Ground texture", { exact: true })
      .selectOption("ground_tundra_lichen");
    await page
      .getByLabel("Horizon overlay", { exact: true })
      .selectOption("horizon_glacial_ridges");
    await page
      .getByLabel("Decorative cutout", { exact: true })
      .selectOption("prop_ice_shard_cluster");
    await page
      .getByLabel("Environment ambience", { exact: true })
      .selectOption("polar_ice_creaks_loop");
    await page.getByText("Distant horizon lightning", { exact: true }).click();
    await page
      .getByRole("combobox", { name: "Horizon lightning", exact: true })
      .selectOption("on");
    await page
      .getByLabel("Seconds between flashes in each region", { exact: true })
      .fill("3");
    await page.screenshot({ path: join(out, "weather-settings.png") });
    await page
      .getByRole("button", { name: "Preview these settings", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Custom slot", exact: true })
      .selectOption("2");
    await page
      .getByRole("button", { name: "Save to Custom 2", exact: true })
      .click();
    await browserExpect(
      page.getByRole("status").filter({ hasText: /Saved to Custom slot 2/ }),
    ).toBeVisible();
    const weatherSlot = JSON.parse(
      await readFile(join(root, "slots/slot-2.json"), "utf8"),
    );
    expect(weatherSlot.weather).toMatchObject({
      particles: "snow",
      lightning: "both",
      horizonLightning: { density: 0.7, interval: 3, elevation: 2 },
    });
    expect(weatherSlot.props[0].asset).toBe("prop_ice_shard_cluster");
    expect(weatherSlot.audio.ambience).toBe("polar_ice_creaks_loop");
    await page.reload();
    for (const expected of ["sunlit", "mars", "slot-2"]) {
      await trigger.click();
      await browserExpect(page.getByLabel("Active fixture")).toHaveText(
        expected,
      );
    }
    await trigger.focus();
    await page.keyboard.press("Shift+F10");
    await page
      .getByText("Advanced: edit a World recipe (optional)", { exact: true })
      .click();
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
    await page
      .getByRole("button", { name: "Copy environment brief", exact: true })
      .click();
    const briefNotice = page
      .getByRole("status")
      .filter({ hasText: "Environment brief copied. No agent was contacted." });
    await browserExpect(briefNotice).toBeVisible();
    await page
      .getByRole("button", { name: "Back to World", exact: true })
      .click();
    await page.clock.runFor(4999);
    await browserExpect(briefNotice).toBeVisible();
    await page.clock.runFor(1);
    await browserExpect(briefNotice).toHaveCount(0);
    await trigger.focus();
    await page.keyboard.press("Shift+F10");
    await page
      .getByText("View description — Current World", { exact: true })
      .click();
    const original = page.getByRole("textbox", {
      name: "Original description — Current World",
      exact: true,
    });
    await browserExpect(original).toHaveValue("Icy blue mountains");
    await page
      .getByLabel("Your World description", { exact: true })
      .fill("A different draft, not this World's prompt");
    await page
      .getByRole("button", {
        name: "Copy description — Current World",
        exact: true,
      })
      .click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "Icy blue mountains",
    );
    await page.getByText("Custom slots on this PC", { exact: true }).click();
    await page
      .getByText("View description — Custom 3", { exact: true })
      .click();
    await browserExpect(
      page.getByRole("textbox", {
        name: "Original description — Custom 3",
        exact: true,
      }),
    ).toHaveValue("Icy blue mountains");
    await browserExpect(page.getByLabel("Active fixture")).toHaveText("slot-2");
    await page.screenshot({ path: join(out, "saved-description.png") });
    const copiedDescription = page.getByRole("status").filter({
      hasText: "Original description copied. No agent was contacted.",
    });
    await page.clock.runFor(4000);
    await page
      .getByRole("button", { name: "Copy description — Custom 3", exact: true })
      .click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "Icy blue mountains",
    );
    await page.clock.runFor(4999);
    await browserExpect(copiedDescription).toBeVisible();
    await page.clock.runFor(1);
    await browserExpect(copiedDescription).toHaveCount(0);

    // Expected clipboard refusal uses the same bounded notification lifecycle.
    await page.evaluate(() => {
      navigator.clipboard.writeText = async () => {
        throw new Error("fixture permission refusal");
      };
    });
    await page
      .getByRole("button", {
        name: "Copy description — Current World",
        exact: true,
      })
      .click();
    const clipboardError = page
      .getByRole("status")
      .filter({ hasText: /Clipboard unavailable/ });
    await browserExpect(clipboardError).toBeVisible();
    await page.clock.runFor(5000);
    await browserExpect(clipboardError).toHaveCount(0);
    const advanced = page.getByText(
      "Advanced: edit a World recipe (optional)",
      { exact: true },
    );
    if (
      !(await advanced.evaluate((el) => el.parentElement!.hasAttribute("open")))
    )
      await advanced.click();
    await page
      .getByLabel("Data-only environment recipe", { exact: true })
      .fill("not json");
    await page
      .getByRole("button", { name: "Preview recipe", exact: true })
      .click();
    const invalidRecipe = page
      .getByRole("status")
      .filter({ hasText: /Recipe refused/ });
    await browserExpect(invalidRecipe).toBeVisible();
    await page.clock.runFor(5000);
    await browserExpect(invalidRecipe).toHaveCount(0);
    await page
      .getByRole("button", { name: "Back to World", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Fixture error", exact: true })
      .click();
    const environmentError = page
      .getByRole("alert")
      .filter({ hasText: "Fixture environment failed" });
    await browserExpect(environmentError).toBeVisible();
    await page.clock.runFor(4999);
    await browserExpect(environmentError).toBeVisible();
    await page.clock.runFor(1);
    await browserExpect(environmentError).toHaveCount(0);
    await page
      .getByRole("button", { name: "Fixture error", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Fixture error", exact: true })
      .click();
    await browserExpect(environmentError).toBeVisible();
    await page.clock.runFor(5000);
    await browserExpect(environmentError).toHaveCount(0);

    // Old recipe-only slots are readable without fabricating their prompt.
    const olderRecipe = JSON.parse(
      await readFile(join(root, "slots/slot-3.json"), "utf8"),
    );
    delete olderRecipe.originalDescription;
    await server.inject({
      method: "PUT",
      url: "/api/environment-library/1",
      payload: { recipe: olderRecipe },
    });
    await page.clock.resume();
    await page.reload();
    await trigger.focus();
    await page.keyboard.press("Shift+F10");
    await page.getByText("Custom slots on this PC", { exact: true }).click();
    await page
      .getByText("View description — Custom 1", { exact: true })
      .click();
    await browserExpect(
      page.getByText("No original description was saved for this World.", {
        exact: true,
      }),
    ).toBeVisible();
    await browserExpect(
      page.getByRole("button", {
        name: "Copy description — Custom 1",
        exact: true,
      }),
    ).toHaveCount(0);

    // Fading a load error must leave a real retry control available.
    await page.route("**/api/environment-library", (route) =>
      route.fulfill({
        status: 503,
        json: { error: "Fixture slots unavailable" },
      }),
    );
    await page.reload();
    await browserExpect(
      page.getByRole("alert").filter({ hasText: "Fixture slots unavailable" }),
    ).toBeVisible();
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
    await page.clock.runFor(5000);
    await browserExpect(
      page.getByRole("alert").filter({ hasText: "Fixture slots unavailable" }),
    ).toHaveCount(0);
    await page.unroute("**/api/environment-library");
    await page
      .getByRole("button", { name: "Retry slots", exact: true })
      .click();
    await browserExpect(
      page.getByRole("button", { name: "Retry slots", exact: true }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
}, 45000);
