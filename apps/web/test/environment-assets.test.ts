import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  ENVIRONMENT_ASSETS,
  ENVIRONMENT_AMBIENCE,
} from "@agentintersect-world/world-schema/environment";

import { ENVIRONMENT_EVENT_AUDIO } from "@agentintersect-world/world-schema/environment-audio";

it("ships every allowlisted texture and sound with matching provenance hashes", async () => {
  const root = new URL("../public/", import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL("assets/environments/manifest.json", root), "utf8"),
  ) as { assets: { path: string; sha256: string; bytes: number }[] };
  const library = JSON.parse(
    await readFile(
      new URL("assets/environments/library-v1/manifest.json", root),
      "utf8",
    ),
  ) as {
    assets: {
      id: string;
      output: { file: string; sha256: string; bytes: number };
    }[];
  };
  expect(library.assets).toHaveLength(48);
  manifest.assets.push(
    ...library.assets.map((asset) => ({
      path: `assets/environments/library-v1/${asset.output.file}`,
      sha256: asset.output.sha256,
      bytes: asset.output.bytes,
    })),
  );
  const expansion = JSON.parse(
    await readFile(
      new URL("assets/environments/expansion-v2/manifest.json", root),
      "utf8",
    ),
  ) as { assets: typeof manifest.assets };
  expect(expansion.assets).toHaveLength(58);
  manifest.assets.push(...expansion.assets);
  const expected = [
    ...Object.values(ENVIRONMENT_ASSETS).map((a) => a.src.slice(1)),
    ...[
      ...ENVIRONMENT_AMBIENCE,
      ...ENVIRONMENT_EVENT_AUDIO,
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
    else if (asset.path.endsWith(".png"))
      expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    else expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
  }
});
