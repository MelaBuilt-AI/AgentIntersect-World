import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect as browserExpect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { expect, it } from "vitest";

it.each([false, true])(
  "repairs versionless installations and selects exact saved connections (already repaired: %s; isolated component)",
  async (repaired) => {
    const server = await createServer({
      configFile: false,
      root: fileURLToPath(new URL("..", import.meta.url)),
      plugins: [
        react(),
        {
          name: "saved-connections-fixture",
          configureServer(vite) {
            vite.middlewares.use(
              "/__saved_connections",
              async (_request, response) => {
                response.setHeader("content-type", "text/html");
                response.end(
                  await vite.transformIndexHtml(
                    "/__saved_connections",
                    '<div id="root"></div><script type="module" src="/test/fixtures/saved-connections-component.tsx"></script>',
                  ),
                );
              },
            );
          },
        },
      ],
      server: { host: "127.0.0.1", port: 0 },
    });
    await server.listen();
    const browser = await chromium.launch({ headless: true });
    try {
      for (const viewport of [
        { width: 1440, height: 1000 },
        { width: 390, height: 844 },
      ]) {
        const page = await browser.newPage({ viewport });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/api/**", (route) =>
          route.fulfill({ json: { ok: true, data: {} } }),
        );
        await page.goto(
          `${server.resolvedUrls!.local[0]}__saved_connections${repaired ? "?repaired=1" : ""}`,
        );
        if (!repaired) {
          const repair = page.getByRole("button", {
            name: "Use discovered installation",
            exact: true,
          });
          await browserExpect(repair).toHaveCount(1);
          await repair.click();
          expect(
            JSON.parse((await page.locator("#result").textContent()) ?? "null"),
          ).toMatchObject({
            installationId: "current-install",
            identityId: "default",
            displayName: "Codex",
            replaceConnectionId: "11111111-1111-4111-8111-111111111111",
          });
          await browserExpect(repair).toHaveCount(0);
        }
        await page.locator('[data-setup-harness="codex"] > summary').click();
        const forms = page.locator('[data-setup-harness="codex"] form');
        await browserExpect(forms).toHaveCount(2);
        for (const [index, name, id] of [
          [0, "Codex", "11111111-1111-4111-8111-111111111111"],
          [1, "Codex2", "22222222-2222-4222-8222-222222222222"],
        ] as const) {
          const form = forms.nth(index);
          const connected = form.getByRole("button", {
            name: new RegExp(`“${name}” — Successfully Connected`),
          });
          await browserExpect(connected).toBeVisible();
          await form
            .getByRole("button", { name: "Add Agent", exact: true })
            .click();
          expect(
            JSON.parse((await page.locator("#result").textContent()) ?? "null"),
          ).toEqual({ add: id });
          await connected.click();
          await browserExpect(form.getByLabel("Agent name")).toHaveValue(name);
          await form
            .getByRole("button", {
              name: "Attach to Agent Intersect World",
              exact: true,
            })
            .click();
          expect(
            JSON.parse((await page.locator("#result").textContent()) ?? "null"),
          ).toMatchObject({ displayName: name, replaceConnectionId: id });
          await connected.click();
        }
        await page
          .locator('[data-setup-harness="codex"]')
          .scrollIntoViewIfNeeded();
        for (const button of await forms
          .getByRole("button", { name: "Add Agent", exact: true })
          .all()) {
          const bounds = await button.boundingBox();
          expect(bounds!.x).toBeGreaterThanOrEqual(0);
          expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
        }
        if (process.env.AIW_TEST_EVIDENCE_DIR) {
          await mkdir(process.env.AIW_TEST_EVIDENCE_DIR, { recursive: true });
          await page.screenshot({
            path: `${process.env.AIW_TEST_EVIDENCE_DIR}/saved-connections-${repaired}-${viewport.width}.png`,
          });
        }
        expect(errors).toEqual([]);
        await page.close();
      }
    } finally {
      await browser.close();
      await server.close();
    }
  },
  60000,
);
