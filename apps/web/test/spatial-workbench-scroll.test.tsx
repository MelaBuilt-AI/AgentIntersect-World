import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect as browserExpect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { expect, it } from "vitest";

it("scrolls Work Inspector under the CSS3D projection and preserves HUD scrolling", async () => {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    plugins: [
      react(),
      {
        name: "workbench-scroll-component-fixture",
        configureServer(vite) {
          vite.middlewares.use(
            "/__scroll_fixture",
            async (_request, response) => {
              response.setHeader("content-type", "text/html");
              response.end(
                await vite.transformIndexHtml(
                  "/__scroll_fixture",
                  '<div id="root"></div><script type="module" src="/test/fixtures/workbench-scroll-component.tsx"></script>',
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
    const page = await browser.newPage({
      viewport: { width: 1280, height: 960 },
    });
    await page.goto(`${server.resolvedUrls!.local[0]}__scroll_fixture`);
    await page.locator(".world-screen--spatial").waitFor();
    await page.evaluate(() => {
      document.querySelector<HTMLElement>(".world-screen")!.style.perspective =
        "900px";
      // Production CSS3D coordinate conversion: camera z=6, screen scale=0.006.
      document.querySelector<HTMLElement>(
        ".world-screen__camera",
      )!.style.transform =
        "translateZ(900px) matrix3d(1,0,0,0,0,-1,0,0,0,0,1,0,0,0,-6,1) translate(640px,480px)";
      const object = document.querySelector<HTMLElement>(
        ".world-screen__object",
      )!;
      object.style.visibility = "visible";
      object.style.transform =
        "translate(-50%,-50%) matrix3d(0.006,0,0,0,0,-0.006,0,0,0,0,0.006,0,0,0,0,1)";
    });
    const inspector = page.getByRole("region", { name: "Work Inspector" });
    const panel = page.getByRole("complementary", {
      name: "Current Workstream",
    });
    for (const mode of ["spatial", "hud"] as const) {
      if (mode === "hud") {
        await panel.evaluate((e) => {
          e.scrollTop = 0;
        });
        await page
          .getByRole("button", { name: /Return Workbench to HUD/ })
          .click();
        await page.locator(".world-screen--hud").waitFor();
        // The renderer clears its own projection styles on return to HUD.
        await page.evaluate(() => {
          for (const selector of [
            ".world-screen",
            ".world-screen__camera",
            ".world-screen__object",
          ])
            document.querySelector<HTMLElement>(selector)!.style.cssText = "";
        });
      }
      await browserExpect(inspector).toBeVisible();
      const bounds = await inspector.boundingBox();
      const point = { x: bounds!.x + 80, y: bounds!.y + 60 };
      expect(
        await page.evaluate(
          ({ x, y }) =>
            Boolean(
              document.elementFromPoint(x, y)?.closest(".work-inspector"),
            ),
          point,
        ),
      ).toBe(true);
      expect(
        await panel.evaluate(
          (e) =>
            e.scrollHeight > e.clientHeight ||
            e.querySelector(".work-inspector")!.scrollHeight >
              e.querySelector(".work-inspector")!.clientHeight,
        ),
      ).toBe(true);
      await page.mouse.move(point.x, point.y);
      await page.mouse.wheel(0, 400);
      await browserExpect
        .poll(
          async () =>
            (await inspector.evaluate((e) => e.scrollTop)) +
            (await panel.evaluate((e) => e.scrollTop)),
          { message: `${mode} wheel must scroll content` },
        )
        .toBeGreaterThan(0);
      const output = process.env.AIW_TEST_EVIDENCE_DIR;
      if (output) {
        await mkdir(output, { recursive: true });
        await page.screenshot({
          path: `${output}/workbench-scroll-${mode}.png`,
        });
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
}, 30_000);
