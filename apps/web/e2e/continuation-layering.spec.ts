import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("@continuation-layering keeps the open Code Wheel behind HUD and fullscreen panels", async ({
  page,
}) => {
  const css = await Promise.all(
    ["../src/styles.css", "../src/world-entry/world-code-wheel.css"].map(
      (file) => readFile(new URL(file, import.meta.url), "utf8"),
    ),
  );
  await page.setContent(
    `<style>${css.join("\n")}</style><div class="world-screen world-screen--hud"><div class="world-screen__camera"><div class="world-screen__object"><section class="world-view" style="top:80px;height:400px;background:#071322" aria-label="World View"><h2>World View</h2><p>Website preview</p></section></div></div></div><div class="code-wheel" style="left:calc(50% - 292px);top:30px;background:#0cf;pointer-events:auto" role="group" aria-label="Code Wheel">Code Wheel remains open</div>`,
  );
  for (const expanded of [false, true]) {
    await page
      .locator(".world-view")
      .evaluate(
        (node, expanded) =>
          node.classList.toggle("world-view--expanded", expanded),
        expanded,
      );
    expect(
      await page.evaluate(() =>
        Boolean(
          document
            .elementFromPoint(innerWidth / 2, 240)
            ?.closest(".world-view"),
        ),
      ),
    ).toBe(true);
    await expect(page.getByRole("group", { name: "Code Wheel" })).toHaveCount(
      1,
    );
  }
});
