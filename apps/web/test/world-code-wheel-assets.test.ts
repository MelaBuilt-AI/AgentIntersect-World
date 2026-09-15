import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";

it("keeps the Code Wheel artwork below a megabyte instead of decoding the World 4K texture", async () => {
  const source = await readFile(
    "apps/web/src/world-entry/WorldCodeWheel.tsx",
    "utf8",
  );
  const assets = [
    ...new Set(
      [...source.matchAll(/href="(\/assets\/[^"]+\.webp)"/g)].map(
        (match) => match[1]!,
      ),
    ),
  ];
  expect(assets).toHaveLength(1);
  for (const asset of assets) {
    const bytes = await readFile(path.join("apps/web/public", asset));
    expect(bytes.byteLength).toBeLessThan(1_000_000);
  }
});
