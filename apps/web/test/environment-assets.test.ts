import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  ENVIRONMENT_ASSETS,
  ENVIRONMENT_AMBIENCE,
} from "@agentintersect-world/world-schema/environment";

it("ships every allowlisted texture and sound with matching provenance hashes", async () => {
  const root = new URL("../public/", import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL("assets/environments/manifest.json", root), "utf8"),
  ) as { assets: { path: string; sha256: string; bytes: number }[] };
  const expected = [
    ...Object.values(ENVIRONMENT_ASSETS).map((a) => a.src.slice(1)),
    ...[
      ...ENVIRONMENT_AMBIENCE,
      "glitch-static-crackle",
      "screen-flicker",
      "screen-loading-warp-complete",
    ].map((id) => `audio/environments/${id}.ogg`),
  ];
  expect(manifest.assets.map((a) => a.path).sort()).toEqual(expected.sort());
  for (const asset of manifest.assets) {
    const bytes = await readFile(new URL(asset.path, root));
    expect(bytes.length, asset.path).toBe(asset.bytes);
    expect(createHash("sha256").update(bytes).digest("hex"), asset.path).toBe(
      asset.sha256,
    );
    if (asset.path.endsWith(".ogg"))
      expect(bytes.subarray(0, 4).toString()).toBe("OggS");
    else expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
  }
});
