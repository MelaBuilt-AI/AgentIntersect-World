// Rasterizes assets/brand/agentintersect-appicon.svg into the committed installer icons.
// Run after changing the SVG: corepack pnpm@11.15.0 exec node tooling/release/render-icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const brand = fileURLToPath(new URL("../../assets/brand/", import.meta.url));
const svg = await readFile(`${brand}agentintersect-appicon.svg`, "utf8");
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const browser = await chromium.launch();
const page = await browser.newPage();
const render = async (size) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  return page.screenshot({ omitBackground: true, type: "png" });
};
const pngs = [];
for (const size of icoSizes) pngs.push(await render(size));
await writeFile(`${brand}agentintersect-appicon-512.png`, await render(512));
await browser.close();

// ICO container with embedded PNG images (supported since Windows Vista).
const header = Buffer.alloc(6 + 16 * pngs.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
pngs.forEach((png, index) => {
  const size = icoSizes[index];
  const entry = 6 + index * 16;
  header.writeUInt8(size >= 256 ? 0 : size, entry);
  header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(`${brand}agentintersect.ico`, Buffer.concat([header, ...pngs]));
console.log(`wrote agentintersect.ico (${icoSizes.join(", ")}) and 512px PNG`);
