import { fileURLToPath } from "node:url";
import { chromium, expect as browserExpect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { it } from "vitest";

it("retains the startup failure after the shell exits and its socket closes", async () => {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    plugins: [
      react(),
      {
        name: "admin-shell-component-fixture",
        configureServer(vite) {
          vite.middlewares.use(
            "/__shell_fixture",
            async (_request, response) => {
              response.setHeader("content-type", "text/html");
              response.end(
                await vite.transformIndexHtml(
                  "/__shell_fixture",
                  '<div id="root"></div><script type="module" src="/test/fixtures/admin-shell-component.tsx"></script>',
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
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route("**/api/admin-shells", (route) =>
      route.fulfill({
        json: {
          data: {
            websocketPath: "/admin-shells/fixture",
            ticket: "fixture",
            elevation: "uac",
          },
        },
      }),
    );
    const reason =
      "Windows PowerShell is unavailable: terminal dependency is missing.";
    await page.routeWebSocket("**/api/admin-shells/fixture?*", (socket) => {
      socket.onMessage(() => {
        socket.send(JSON.stringify({ type: "status", message: reason }));
        socket.send(JSON.stringify({ type: "exit" }));
        socket.close();
      });
    });
    await page.goto(`${server.resolvedUrls!.local[0]}__shell_fixture`);
    await browserExpect(
      page.locator('[data-shell-ended="true"]'),
    ).toBeVisible();
    await browserExpect(page.getByRole("status")).toContainText(reason);
  } finally {
    await browser.close();
    await server.close();
  }
}, 30_000);
