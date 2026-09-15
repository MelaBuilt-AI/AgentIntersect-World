import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { expect, it } from "vitest";

it("keeps the Escape hint top-left and separate from the music controls", async () => {
  const css = (
    await Promise.all(
      [
        "../src/world-entry/agent-setup.css",
        "../src/audio/audio-player.css",
      ].map((p) => readFile(new URL(p, import.meta.url), "utf8")),
    )
  ).join("\n");
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [
      { width: 1600, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      await page.setContent(
        `<style>body{margin:0;background:#03070d}*{box-sizing:border-box}${css}</style><span class="agent-setup-escape-hint">Escape for Menu</span><section class="world-audio"><div class="world-audio__bar"><button>♫</button><span class="world-audio__title">Black Circuit</span><button>Ⅱ</button></div></section>`,
      );
      const geometry = await page.evaluate(() => {
        const hint = document
          .querySelector(".agent-setup-escape-hint")!
          .getBoundingClientRect();
        const audio = document
          .querySelector(".world-audio")!
          .getBoundingClientRect();
        return {
          left: hint.left,
          top: hint.top,
          right: hint.right,
          viewport: innerWidth,
          separate: hint.right <= audio.left || hint.bottom <= audio.top,
        };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(12);
      expect(geometry.left).toBeLessThanOrEqual(24);
      expect(geometry.top).toBeLessThanOrEqual(24);
      expect(geometry.right).toBeLessThan(geometry.viewport);
      expect(geometry.separate).toBe(true);
      const out =
        process.env.AIW_TEST_EVIDENCE_DIR ??
        `/tmp/aiw-escape-hint-${process.pid}`;
      await mkdir(out, { recursive: true });
      await page.screenshot({
        path: `${out}/escape-hint-${viewport.width}.png`,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}, 20000);
