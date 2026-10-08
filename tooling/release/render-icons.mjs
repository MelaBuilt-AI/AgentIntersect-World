// Rasterizes assets/brand/agentintersect-appicon.svg into the committed installer icons.
// Run after changing the SVG: corepack pnpm@11.15.0 exec node tooling/release/render-icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const brand = fileURLToPath(new URL("../../assets/brand/", import.meta.url));
const svg = await readFile(`${brand}agentintersect-appicon.svg`, "utf8");
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1024, height: 1024 },
  deviceScaleFactor: 1,
});
// Render the supplied composition at its intrinsic size first. Rendering its
// non-scaling-stroke directly at 16px makes 110px strokes swallow the artwork.
await page.setContent(
  `<style>html,body{margin:0;background:transparent}svg{display:block;width:1024px;height:1024px}</style>${svg}`,
);
const master = await page.screenshot({ omitBackground: true, type: "png" });
const render = async (size) =>
  Buffer.from(
    await page.evaluate(
      async ({ data, size }) => {
        const image = new globalThis.Image();
        image.src = data;
        await image.decode();
        const canvas = globalThis.document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(image, 0, 0, size, size);
        return canvas.toDataURL("image/png").split(",")[1];
      },
      { data: `data:image/png;base64,${master.toString("base64")}`, size },
    ),
    "base64",
  );
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
