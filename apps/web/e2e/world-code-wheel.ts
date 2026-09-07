import { expect, type Page } from "@playwright/test";

export async function openCodeWheel(page: Page) {
  if (
    await page.getByRole("group", { name: "Code Wheel", exact: true }).count()
  )
    return;
  // A normal middle press on exposed World; never dispatch a synthetic UI click.
  const point = await page.locator("main.world-room").evaluate((room) => {
    const bounds = room.getBoundingClientRect();
    for (const x of [
      bounds.left + bounds.width * 0.65,
      bounds.left + bounds.width * 0.5,
      bounds.left + bounds.width * 0.8,
    ]) {
      for (const y of [
        bounds.top + bounds.height * 0.45,
        bounds.top + bounds.height * 0.3,
      ]) {
        const target = document.elementFromPoint(x, y);
        if (
          target &&
          room.contains(target) &&
          !target.closest(
            'button, input, [role="button"], .world-screen__object, .repository-asset-palette',
          )
        )
          return { x, y };
      }
    }
    throw new Error("No exposed World input point");
  });
  await page.mouse.click(point.x, point.y, { button: "middle" });
  await expect(
    page.getByRole("group", { name: "Code Wheel", exact: true }),
  ).toBeVisible();
}
