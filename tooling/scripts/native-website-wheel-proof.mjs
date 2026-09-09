/* global document, window, fetch */
import process from "node:process";
import console from "node:console";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
const html = await (await fetch("http://127.0.0.1:45015/")).text();
const child = createServer((req, res) => res.end(html));
await new Promise((r) => child.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${child.address().port}`;
const parent = createServer((req, res) =>
  res.end(
    `<!doctype html><html><body style="margin:0;background:#222"><div style="perspective:900px;transform-style:preserve-3d;position:absolute;left:150px;top:160px;width:720px;height:300px"><div id="panel" style="transform-style:flat;width:720px;height:300px"><iframe style="width:100%;height:100%;border:0" src="${url}"></iframe></div></div></body></html>`,
  ),
);
await new Promise((r) => parent.listen(0, "127.0.0.1", r));
const browser = await chromium.connectOverCDP(
  process.env.EDGE_CDP ?? "http://127.0.0.1:49335",
);
const context = await browser.newContext({
  viewport: { width: 1200, height: 900 },
});
try {
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${parent.address().port}`);
  const f = page.frames().find((f) => f.url().startsWith(url));
  await f.waitForSelector("h1");
  await f.evaluate(() =>
    document.addEventListener(
      "wheel",
      (e) =>
        (window.__wheel = {
          target: e.target.tagName,
          prevented: e.defaultPrevented,
        }),
      { passive: true },
    ),
  );
  const results = [];
  for (const angle of [-60, -30, 0, 30, 60]) {
    await page
      .locator("#panel")
      .evaluate(
        (e, a) => (e.style.transform = `rotateY(${a}deg) rotateX(15deg)`),
        angle,
      );
    await f.evaluate(() => window.scrollTo(0, 0));
    const pt = await page.locator("iframe").evaluate((e) => {
      const b = e.getBoundingClientRect();
      for (const fy of [0.5, 0.3, 0.7])
        for (const fx of [0.5, 0.3, 0.7]) {
          const x = b.x + b.width * fx,
            y = b.y + b.height * fy;
          if (document.elementFromPoint(x, y) === e) return { x, y };
        }
      throw Error("no point");
    });
    await page.mouse.move(pt.x, pt.y);
    await page.mouse.wheel(0, 360);
    await page.waitForTimeout(350);
    results.push({
      angle,
      ...(await f.evaluate(() => ({
        scroll: document.scrollingElement.scrollTop,
        client: document.scrollingElement.clientHeight,
        height: document.scrollingElement.scrollHeight,
        event: window.__wheel,
      }))),
    });
  }
  console.log(JSON.stringify(results));
} finally {
  await context.close();
  await browser.close();
  parent.close();
  child.close();
}
