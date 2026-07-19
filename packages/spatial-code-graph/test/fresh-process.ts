import { readFileSync } from "node:fs";

import { RepositoryGenerationSchema } from "@agentintersect-world/world-schema";

import { projectRepositoryGeneration, queryWorldTiles } from "../src/index.js";

const generation = RepositoryGenerationSchema.parse(
  JSON.parse(
    readFileSync(
      new URL("./fixtures/phase4-generation.json", import.meta.url),
      "utf8",
    ),
  ),
);
const snapshot = projectRepositoryGeneration(generation);
const tiles = queryWorldTiles(snapshot, {
  lod: 4,
  minX: 0,
  maxX: 15,
  minZ: 0,
  maxZ: 15,
  limit: 16,
});
process.stdout.write(`${JSON.stringify({ snapshot, tiles })}\n`);
