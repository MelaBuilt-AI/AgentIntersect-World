/* global document, window */
import process from "node:process";
import console from "node:console";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
const child = createServer((req, res) =>
  res.end(
    '<!doctype html><html><body style="margin:0"><h1>Scrollable preview</h1><div style="height:3000px;background:linear-gradient(blue,cyan)">Actual tall page</div></body></html>',
  ),
);
await new Promise((r) => child.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${child.address().port}`;
const parent = createServer((req, res) =>
  res.end(
    `<!doctype html><html><body style="margin:0;background:#222"><div style="perspective:900px;position:absolute;left:100px;top:60px;width:800px;height:700px"><div id="panel" style="transform:rotateY(15deg) rotateX(10deg);transform-style:flat;width:800px;height:650px"><iframe style="width:100%;height:100%" src="${url}"></iframe></div></div></body></html>`,
  ),
);
await new Promise((r) => parent.listen(0, "127.0.0.1", r));
const browser = process.env.EDGE_CDP
  ? await chromium.connectOverCDP(process.env.EDGE_CDP)
  : await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
  });
  await page.goto(`http://127.0.0.1:${parent.address().port}`);
  const f = page.frames().find((f) => f.url().startsWith(url));
  await f.waitForSelector("h1");
  const results = [];
  for (const mode of ["spatial", "hud"]) {
    await page
      .locator("#panel")
      .evaluate(
        (e, m) =>
          (e.style.transform =
            m === "hud" ? "none" : "rotateY(15deg) rotateX(10deg)"),
        mode,
      );
    await f.evaluate(() => {
      window.scrollTo(0, 0);
      window.__wheel = [];
      document.addEventListener(
        "wheel",
        (e) =>
          window.__wheel.push({
            target: e.target.tagName,
            prevented: e.defaultPrevented,
          }),
        { passive: true },
      );
    });
    await page.mouse.move(450, 350);
    await page.mouse.wheel(0, 480);
    await page.waitForTimeout(300);
    results.push({
      mode,
      ...(await f.evaluate(() => ({
        scroll: document.scrollingElement.scrollTop,
        height: document.scrollingElement.scrollHeight,
        events: window.__wheel,
      }))),
    });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  parent.close();
  child.close();
}
