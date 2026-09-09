// Native Chromium wheel regression for the preview input shield.
// Uses an isolated browser context; never attaches a live World/session.
// EDGE_CDP=http://127.0.0.1:49336 PREVIEW_URL=http://... node tooling/scripts/preview-input-wheel-proof.mjs <output-dir> [stylesheet]
/* global document, window, getComputedStyle */
import process from "node:process";
import console from "node:console";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const output = path.resolve(process.argv[2] ?? "/tmp/aiw-preview-input-proof");
await mkdir(output, { recursive: true });
const css = await readFile(
  process.argv[3] ?? "apps/web/src/styles.css",
  "utf8",
);
const child = createServer((_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(
    "<!doctype html><style>body{margin:0;font:24px sans-serif}header{height:80vh;background:#135fbb;color:white}main{height:3500px;background:linear-gradient(#eaf4ff,#135fbb)}</style><header><h1>Native preview scroll test</h1></header><main>Scrollable content</main>",
  );
});
await new Promise((resolve) => child.listen(0, "127.0.0.1", resolve));
const previewUrl =
  process.env.PREVIEW_URL ?? `http://127.0.0.1:${child.address().port}/`;
const html = `<!doctype html><style>${css}</style><main class="world-room"><div class="world-screen world-screen--hud" data-world-screen="preview"><div class="world-screen__camera"><div class="world-screen__object"><section class="world-view world-view--expanded"><header class="world-view__header">World View input regression</header><dl class="world-view__facts"><dt>Isolated native diagnostic</dt></dl><div class="world-view__screen"><iframe class="world-view__iframe" src="${previewUrl}" sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"></iframe><div class="world-view__input-shield" aria-hidden="true"></div></div><footer class="world-view__controls"><button id="interact" onclick="const shield=document.querySelector('.world-view__input-shield');shield.hidden=!shield.hidden;">Toggle preview input</button></footer></section></div></div></div></main>`;
const server = createServer((_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.connectOverCDP(
  process.env.EDGE_CDP ?? "http://127.0.0.1:49336",
);
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const rows = [];
try {
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const iframe = page.locator("iframe");
  const original = await iframe.elementHandle();
  const frame = await original.contentFrame();
  await frame.waitForSelector("h1");
  await frame.evaluate(() =>
    document.addEventListener(
      "wheel",
      (event) => {
        window.__wheel = {
          target: event.target.tagName,
          prevented: event.defaultPrevented,
        };
      },
      { passive: true },
    ),
  );
  for (const mode of ["hud", "spatial", "hud-return"]) {
    await page.evaluate((mode) => {
      const spatial = mode === "spatial";
      const root = document.querySelector(".world-screen");
      root.className = `world-screen world-screen--${spatial ? "spatial" : "hud"}`;
      root.style.cssText = spatial ? "perspective:900px" : "";
      document.querySelector(".world-screen__camera").style.cssText = spatial
        ? "transform:translateZ(900px) translate(720px,450px)"
        : "";
      document.querySelector(".world-screen__object").style.cssText = spatial
        ? "width:900px;height:650px;visibility:visible;transform:translate(-50%,-50%) translateZ(-1100px) rotateY(25deg)"
        : "";
      document
        .querySelector(".world-view")
        .classList.toggle("world-view--expanded", !spatial);
    }, mode);
    assert.equal(
      await iframe.evaluate((el) => getComputedStyle(el).pointerEvents),
      "auto",
    );
    assert.equal(
      await iframe.evaluate((el) => {
        const b = el.getBoundingClientRect();
        return document
          .elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)
          ?.classList.contains("world-view__input-shield");
      }),
      true,
    );
    await page.locator("#interact").click();
    const points = await iframe.evaluate((el) => {
      const b = el.getBoundingClientRect();
      return [0.15, 0.5, 0.85].flatMap((fy) =>
        [0.05, 0.3, 0.6, 0.9].map((fx) => {
          const x = b.x + b.width * fx,
            y = b.y + b.height * fy;
          return { x, y, hit: document.elementFromPoint(x, y) === el };
        }),
      );
    });
    for (const point of points) {
      assert.equal(point.hit, true);
      await frame.evaluate(() => {
        document.documentElement.style.scrollBehavior = "auto";
        document.scrollingElement.scrollTop = 0;
        window.__wheel = null;
      });
      await page.mouse.move(point.x, point.y);
      await page.mouse.wheel(0, 360);
      await frame.waitForFunction(
        () => document.scrollingElement.scrollTop > 0,
        null,
        { timeout: 2000 },
      );
      rows.push({
        mode,
        ...point,
        ...(await frame.evaluate(() => ({
          scrollTop: document.scrollingElement.scrollTop,
          wheel: window.__wheel,
        }))),
      });
      await writeFile(
        path.join(output, "wheel-points.json"),
        JSON.stringify(rows, null, 2),
      );
    }
    await page.screenshot({ path: path.join(output, `${mode}.png`) });
    await page.locator("#interact").click();
    assert.equal(
      await iframe.evaluate((node, old) => node === old, original),
      true,
    );
  }
  const saved = JSON.parse(
    await readFile(path.join(output, "wheel-points.json"), "utf8"),
  );
  assert.equal(saved.length, 36);
  assert(
    saved.every(
      (row) => row.hit && row.scrollTop > 0 && row.wheel?.prevented === false,
    ),
  );
  console.log(
    JSON.stringify({
      passed: saved.length,
      expected: 36,
      iframePreserved: true,
      shieldHitTested: true,
    }),
  );
} finally {
  await context.close();
  await browser.close();
  server.close();
  child.close();
}
