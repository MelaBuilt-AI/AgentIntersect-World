import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ENVIRONMENT_PRESETS } from "@agentintersect-world/world-schema/environment";
import { HackYourWorld } from "../src/world-entry/HackYourWorld.js";

it("keeps the globe below Escape and the native recipe dialog inside desktop and portrait viewports", async () => {
  const css = (
    await Promise.all(
      [
        "../src/styles.css",
        "../src/world-entry/agent-setup.css",
        "../src/world-entry/hack-your-world.css",
        "../src/audio/audio-player.css",
      ].map((p) => readFile(new URL(p, import.meta.url), "utf8")),
    )
  ).join("\n");
  const html = renderToStaticMarkup(
    <HackYourWorld
      active={ENVIRONMENT_PRESETS[0]!}
      phase="idle"
      error=""
      reducedMotion={true}
      onSelect={() => {}}
      onDialogChange={() => {}}
    />,
  );
  const browser = await chromium.launch({
    headless: true,
    args: ["--mute-audio"],
  });
  const out =
    process.env.AIW_TEST_EVIDENCE_DIR ??
    `/tmp/aiw-environment-component-${process.pid}`;
  await mkdir(out, { recursive: true });
  try {
    for (const viewport of [
      { width: 1600, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      await page.setContent(
        `<style>${css}</style><span class="agent-setup-escape-hint">Escape for Menu</span><section class="world-room">${html}</section><section class="world-audio"><div class="world-audio__bar"><button>♫</button><span class="world-audio__title">Black Circuit</span><button>Ⅱ</button></div></section>`,
      );
      const rect = await page.evaluate(() => {
        const hint = document
          .querySelector(".agent-setup-escape-hint")!
          .getBoundingClientRect();
        const button = document
          .querySelector(".hack-world__trigger")!
          .getBoundingClientRect();
        const audio = document
          .querySelector(".world-audio")!
          .getBoundingClientRect();
        return {
          gap: button.top - hint.bottom,
          left: button.left,
          right: button.right,
          separate:
            button.right <= audio.left ||
            button.top >= audio.bottom ||
            button.bottom <= audio.top,
        };
      });
      expect(rect.gap).toBeGreaterThan(0);
      expect(rect.left).toBeGreaterThanOrEqual(12);
      expect(rect.right).toBeLessThan(viewport.width);
      expect(rect.separate).toBe(true);
      await page.screenshot({
        path: `${out}/environment-hud-${viewport.width}.png`,
      });
      await page
        .locator("dialog")
        .evaluate((dialog) => (dialog as HTMLDialogElement).showModal());
      const bounds = await page.locator("dialog").boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
      await page.screenshot({
        path: `${out}/environment-dialog-${viewport.width}.png`,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}, 20000);
