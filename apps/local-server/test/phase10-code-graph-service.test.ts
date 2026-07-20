import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { indexRepository } from "@agentintersect-world/repo-indexer";
import { projectRepositoryGeneration } from "@agentintersect-world/spatial-code-graph";
import {
  CodeGraphCacheStore,
  CodeGraphGenerationEngine,
} from "@agentintersect-world/spatial-code-graph/node";

import { CodeGraphService } from "../src/code-graph-service.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("Phase 10 code graph service initialization", () => {
  it("reports recovered previous truth and rebuild requirement before indexing", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase10-service-repo-"));
    const cache = await mkdtemp(join(tmpdir(), "aiw-phase10-service-cache-"));
    roots.push(root, cache);
    await writeFile(join(root, "index.ts"), "export const first = 1;\n");
    const firstGeneration = await indexRepository({ rootPath: root });
    const firstWorld = projectRepositoryGeneration(firstGeneration);
    const writer = new CodeGraphGenerationEngine({
      store: new CodeGraphCacheStore(cache),
      workerCount: 1,
    });
    await writer.generate(firstGeneration, firstWorld);
    await writeFile(join(root, "index.ts"), "export const second = 2;\n");
    const secondGeneration = await indexRepository({ rootPath: root });
    await writer.generate(
      secondGeneration,
      projectRepositoryGeneration(secondGeneration, {
        previousSnapshot: firstWorld,
      }),
    );
    await writer.close();
    await writeFile(join(cache, "current.json"), '{"corrupt":true}');

    const service = new CodeGraphService(
      new CodeGraphGenerationEngine({
        store: new CodeGraphCacheStore(cache),
        workerCount: 1,
      }),
    );
    try {
      await service.initialize();
      expect(service.status()).toMatchObject({
        current: { generationId: firstGeneration.id, state: "previous" },
        previous: null,
        buildingGenerationId: null,
        lastError: "cache_rebuild_required",
      });
    } finally {
      await service.close();
    }
  });
});
