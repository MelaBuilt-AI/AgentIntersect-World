import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { expect, it } from "vitest";

it("keeps populated stale rows, connection form and entry action separate at desktop and portrait", async () => {
  const css = await readFile(
    new URL("../src/styles.css", import.meta.url),
    "utf8",
  );
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [
      { width: 1169, height: 469 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      await page.setContent(
        `<style>${css}</style><main class="world-experience world-experience--entry"><div class="world-entry-logo" style="height:240px">AgentIntersect_</div><div class="world-entry-connections"><section class="world-constellation-projection"><ol>${[1, 2, 3, 4].map((i) => `<li><span>Movement ${i} with a deliberately very long agent display name · codex · Stale / unavailable</span><span class="world-constellation-projection__actions"><button>Reconnect</button><button>Remove</button></span></li>`).join("")}</ol><button class="world-enter-action" disabled>Enter World</button></section><form class="world-agent-prompt"><div class="world-type-line">agent name?_</div><input aria-label="Agent name"><button>Connect agent</button><p class="world-entry-error">agent unavailable_ reconnect or remove a stale agent before entry</p></form></div></main>`,
      );
      const geometry = await page.evaluate(() => {
        const roster = document
          .querySelector(".world-constellation-projection")!
          .getBoundingClientRect();
        const form = document.querySelector("form")!.getBoundingClientRect();
        const enter = document
          .querySelector(".world-enter-action")!
          .getBoundingClientRect();
        return {
          separate: roster.bottom <= form.top,
          enterInRoster:
            enter.top >= roster.top && enter.bottom <= roster.bottom,
          rows: [...document.querySelectorAll("li")].every((row) => {
            const label = row.children[0]!.getBoundingClientRect(),
              actions = row.children[1]!.getBoundingClientRect();
            return label.right <= actions.left || label.bottom <= actions.top;
          }),
          width: document.querySelector("main")!.scrollWidth,
          viewport: innerWidth,
        };
      });
      expect(geometry.separate).toBe(true);
      expect(geometry.enterInRoster).toBe(true);
      expect(geometry.rows).toBe(true);
      expect(geometry.width).toBeLessThanOrEqual(geometry.viewport);
      await page.locator("form").scrollIntoViewIfNeeded();
      const evidence =
        process.env.AIW_TEST_EVIDENCE_DIR ??
        `/tmp/aiw-stale-layout-${process.pid}`;
      await mkdir(evidence, { recursive: true });
      await page.screenshot({
        path: `${evidence}/stale-rows-${viewport.width}.png`,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}, 20_000);
