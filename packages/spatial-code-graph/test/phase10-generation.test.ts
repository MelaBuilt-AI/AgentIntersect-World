import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { indexRepository } from "../../repo-indexer/src/index.js";
import {
  CodeGraphCacheStore,
  CodeGraphGenerationEngine,
} from "@agentintersect-world/spatial-code-graph/node";
import { projectRepositoryGeneration } from "../src/index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("Phase 10 generation coupling", () => {
  it("loads a verified persisted graph before a fresh engine generates", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase10-restart-"));
    const cache = await mkdtemp(join(tmpdir(), "aiw-phase10-restart-cache-"));
    roots.push(root, cache);
    await writeFile(join(root, "index.ts"), "export const persisted = 1;\n");
    const generation = await indexRepository({ rootPath: root });
    const world = projectRepositoryGeneration(generation);
    const first = new CodeGraphGenerationEngine({
      store: new CodeGraphCacheStore(cache),
      workerCount: 1,
    });
    await first.generate(generation, world);
    await first.close();

    const restarted = new CodeGraphGenerationEngine({
      store: new CodeGraphCacheStore(cache),
      workerCount: 1,
    });
    try {
      expect(restarted.current()).toBeNull();
      const initialized = await restarted.initialize();
      expect(initialized).toEqual({ recovered: false, needsRebuild: false });
      expect(restarted.current()?.generationId).toBe(generation.id);
      expect(restarted.current()?.state).toBe("current");
    } finally {
      await restarted.close();
    }
  });

  it("initializes with truthful previous state after corrupt-current recovery", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase10-recovery-"));
    const cache = await mkdtemp(join(tmpdir(), "aiw-phase10-recovery-cache-"));
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
    const secondWorld = projectRepositoryGeneration(secondGeneration, {
      previousSnapshot: firstWorld,
    });
    await writer.generate(secondGeneration, secondWorld);
    await writer.close();
    await writeFile(join(cache, "current.json"), '{"corrupt":true}');

    const recovered = new CodeGraphGenerationEngine({
      store: new CodeGraphCacheStore(cache),
      workerCount: 1,
    });
    try {
      expect(await recovered.initialize()).toEqual({
        recovered: true,
        needsRebuild: true,
      });
      expect(recovered.current()).toMatchObject({
        generationId: firstGeneration.id,
        state: "previous",
      });
      expect(recovered.previous()).toBeNull();
    } finally {
      await recovered.close();
    }
  });

  it("reuses checksum entries and preserves symbol identity across a Phase 4 content rename", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase10-generation-"));
    const cache = await mkdtemp(
      join(tmpdir(), "aiw-phase10-generation-cache-"),
    );
    roots.push(root, cache);
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "src", "before.ts"),
      "export function stable() { return 1; }\n",
    );
    const firstGeneration = await indexRepository({ rootPath: root });
    const firstWorld = projectRepositoryGeneration(firstGeneration);
    const engine = new CodeGraphGenerationEngine({
      store: new CodeGraphCacheStore(cache),
      workerCount: 1,
    });
    try {
      const first = await engine.generate(firstGeneration, firstWorld);
      expect(first.stats.parsedFiles).toBe(1);
      await rename(
        join(root, "src", "before.ts"),
        join(root, "src", "after.ts"),
      );
      const secondGeneration = await indexRepository({ rootPath: root });
      const secondWorld = projectRepositoryGeneration(secondGeneration, {
        previousSnapshot: firstWorld,
      });
      const second = await engine.generate(secondGeneration, secondWorld);
      expect(second.stats.reusedFiles).toBe(1);
      expect(second.graph.symbols[0]?.id).toBe(first.graph.symbols[0]?.id);
      expect(second.graph.generationId).toBe(secondGeneration.id);

      await writeFile(
        join(root, "src", "after.ts"),
        "export function changed() { return 2; }\n",
      );
      const thirdGeneration = await indexRepository({ rootPath: root });
      const thirdWorld = projectRepositoryGeneration(thirdGeneration, {
        previousSnapshot: secondWorld,
      });
      const third = await engine.generate(thirdGeneration, thirdWorld);
      expect(third.stats.parsedFiles).toBe(1);
      expect(third.stats.reusedFiles).toBe(0);
      expect(third.graph.symbols[0]?.id).not.toBe(second.graph.symbols[0]?.id);
    } finally {
      await engine.close();
    }
  });

  it("discards a superseded generation and retains the newer last-good graph", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase10-race-"));
    const cache = await mkdtemp(join(tmpdir(), "aiw-phase10-race-cache-"));
    roots.push(root, cache);
    await writeFile(join(root, "first.ts"), "export const first = 1;\n");
    const firstGeneration = await indexRepository({ rootPath: root });
    const firstWorld = projectRepositoryGeneration(firstGeneration);
    await writeFile(join(root, "second.ts"), "export const second = 2;\n");
    const secondGeneration = await indexRepository({ rootPath: root });
    const secondWorld = projectRepositoryGeneration(secondGeneration, {
      previousSnapshot: firstWorld,
    });
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reads = 0;
    const engine = new CodeGraphGenerationEngine({
      store: new CodeGraphCacheStore(cache),
      workerCount: 1,
      beforeRead: async () => {
        reads += 1;
        if (reads === 1) await blocked;
      },
    });
    try {
      const superseded = engine.generate(firstGeneration, firstWorld);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const current = engine.generate(secondGeneration, secondWorld);
      release();
      await expect(superseded).rejects.toThrow(/superseded|cancelled/u);
      const committed = await current;
      expect(engine.current()?.generationId).toBe(committed.graph.generationId);
      expect(committed.graph.generationId).toBe(secondGeneration.id);
    } finally {
      release();
      await engine.close();
    }
  });

  it("never reuses hashless supported files after their content changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase10-hashless-"));
    const cache = await mkdtemp(join(tmpdir(), "aiw-phase10-hashless-cache-"));
    roots.push(root, cache);
    await writeFile(join(root, "index.ts"), "export const before = 1;\n");
    const indexedFirst = await indexRepository({ rootPath: root });
    const firstGeneration = {
      ...indexedFirst,
      files: indexedFirst.files.map((file) => ({ ...file, contentHash: null })),
    };
    const firstWorld = projectRepositoryGeneration(firstGeneration);
    const engine = new CodeGraphGenerationEngine({
      store: new CodeGraphCacheStore(cache),
      workerCount: 1,
    });
    try {
      const first = await engine.generate(firstGeneration, firstWorld);
      expect(first.graph.symbols[0]?.name).toBe("before");
      await writeFile(join(root, "index.ts"), "export const after_ = 2;\n");
      const indexedSecond = await indexRepository({ rootPath: root });
      const secondGeneration = {
        ...indexedSecond,
        files: indexedSecond.files.map((file) => ({
          ...file,
          contentHash: null,
        })),
      };
      const secondWorld = projectRepositoryGeneration(secondGeneration, {
        previousSnapshot: firstWorld,
      });
      const second = await engine.generate(secondGeneration, secondWorld);
      expect(second.stats).toMatchObject({ reusedFiles: 0, parsedFiles: 1 });
      expect(second.graph.symbols[0]?.name).toBe("after_");
    } finally {
      await engine.close();
    }
  });

  it("uses exact indexed npm mappings without donating the package root to subpaths", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "aiw-phase10-workspace-resolution-"),
    );
    const cache = await mkdtemp(
      join(tmpdir(), "aiw-phase10-workspace-resolution-cache-"),
    );
    roots.push(root, cache);
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "index.ts"), "export default 1;\n");
    await writeFile(join(root, "src", "feature.ts"), "export default 2;\n");
    await writeFile(
      join(root, "src", "consumer.ts"),
      [
        'import root from "@scope/pkg";',
        'import feature from "@scope/pkg/feature";',
        'import missing from "@scope/pkg/not-exported";',
        'import internal from "#internal";',
        'import external from "external-only";',
        "export { root, feature, missing, internal, external };",
        "",
      ].join("\n"),
    );
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "@scope/pkg",
        exports: { ".": "./src/index.ts", "./feature": "./src/feature.ts" },
        imports: { "#internal": "./src/feature.ts" },
        main: "src/index.ts",
      }),
    );
    const generation = await indexRepository({ rootPath: root });
    const engine = new CodeGraphGenerationEngine({
      store: new CodeGraphCacheStore(cache),
      workerCount: 1,
    });
    try {
      const result = await engine.generate(
        generation,
        projectRepositoryGeneration(generation),
      );
      const bySpecifier = new Map(
        result.graph.dependencies.map((edge) => [edge.specifier, edge]),
      );
      expect(bySpecifier.get("@scope/pkg")).toMatchObject({
        confidence: ["exact_workspace_package"],
        candidateRefs: [expect.stringMatching(/^aiw:\/\/object\//u)],
      });
      expect(bySpecifier.get("@scope/pkg/feature")).toMatchObject({
        confidence: ["exact_workspace_package"],
        candidateRefs: [expect.stringMatching(/^aiw:\/\/object\//u)],
      });
      expect(bySpecifier.get("@scope/pkg/not-exported")).toMatchObject({
        confidence: ["unresolved"],
        candidateRefs: [],
      });
      expect(bySpecifier.get("#internal")).toMatchObject({
        confidence: ["exact_workspace_package"],
        candidateRefs: [expect.stringMatching(/^aiw:\/\/object\//u)],
      });
      expect(bySpecifier.get("external-only")).toMatchObject({
        confidence: ["external"],
        candidateRefs: [],
      });
    } finally {
      await engine.close();
    }
  });
});
