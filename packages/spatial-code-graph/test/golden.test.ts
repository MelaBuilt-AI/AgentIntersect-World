import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";
import { RepositoryGenerationSchema } from "@agentintersect-world/world-schema";

import { projectRepositoryGeneration, queryWorldTiles } from "../src/index.js";

const fixture = async (name: string) =>
  JSON.parse(
    await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"),
  ) as unknown;

describe("Phase 4 serialized goldens", () => {
  it("matches the checked-in snapshot and bounded tile response byte-for-byte", async () => {
    const scenarios = (await fixture("phase4-scenarios.json")) as Record<
      string,
      unknown
    >;
    expect(Object.keys(scenarios).sort()).toEqual([
      "ambiguous",
      "caseOnlyRename",
      "collisions",
      "normal",
      "rename",
      "separatorEquivalent",
      "unicodeEquivalent",
    ]);
    const input = RepositoryGenerationSchema.parse(
      await fixture("phase4-generation.json"),
    );
    const snapshot = projectRepositoryGeneration(input);
    const tiles = queryWorldTiles(snapshot, {
      lod: 4,
      minX: 0,
      maxX: 15,
      minZ: 0,
      maxZ: 15,
      limit: 16,
    });
    const expected = await fixture("phase4-output.json");
    expect(JSON.stringify({ snapshot, tiles })).toBe(JSON.stringify(expected));
    expect(JSON.stringify(expected)).not.toContain(input.rootPath);
  });
});
