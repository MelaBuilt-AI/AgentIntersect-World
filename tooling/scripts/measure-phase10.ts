import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir, totalmem, cpus } from "node:os";
import { join } from "node:path";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";

import { indexRepository } from "@agentintersect-world/repo-indexer";
import { projectRepositoryGeneration } from "@agentintersect-world/spatial-code-graph";
import {
  CodeGraphCacheStore,
  CodeGraphGenerationEngine,
} from "@agentintersect-world/spatial-code-graph/node";

import {
  buildPhase10Fixture,
  type Phase10FixtureScale,
} from "./phase10-fixtures.js";
import { phase10MeasurementFailures } from "./phase10-measurement-verdict.js";

async function measureScale(scale: Phase10FixtureScale) {
  const fixtureRoot = await mkdtemp(join(tmpdir(), `aiw-phase10-${scale}-`));
  const cacheRoot = await mkdtemp(
    join(tmpdir(), `aiw-phase10-${scale}-cache-`),
  );
  const fixture = await buildPhase10Fixture(fixtureRoot, scale);
  const generation = await indexRepository({
    rootPath: fixtureRoot,
    maxFiles: 10_000,
  });
  const world = projectRepositoryGeneration(generation);
  const engine = new CodeGraphGenerationEngine({
    store: new CodeGraphCacheStore(cacheRoot),
  });
  const delay = monitorEventLoopDelay({ resolution: 10 });
  delay.enable();
  const beforeRss = process.memoryUsage().rss;
  let peakRss = beforeRss;
  const sampler = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }, 10);
  try {
    const coldStarted = performance.now();
    const cold = await engine.generate(generation, world);
    const coldMs = performance.now() - coldStarted;
    const warmStarted = performance.now();
    const warm = await engine.generate(generation, world);
    const warmMs = performance.now() - warmStarted;
    let sentinelAbsent = false;
    try {
      await access(fixture.sentinel);
    } catch {
      sentinelAbsent = true;
    }
    return {
      fixture,
      graphCounts: cold.graph.counts,
      coldMs: Number(coldMs.toFixed(3)),
      warmMs: Number(warmMs.toFixed(3)),
      rssDeltaMiB: Number(((peakRss - beforeRss) / 1024 / 1024).toFixed(3)),
      eventLoopDelayMaxMs: Number((delay.max / 1e6).toFixed(3)),
      eventLoopDelayP99Ms: Number((delay.percentile(99) / 1e6).toFixed(3)),
      coldStats: cold.stats,
      warmStats: warm.stats,
      sentinelAbsent,
      ceilings: {
        coldWallPassed: coldMs <= (scale === "10k" ? 30_000 : 90_000),
        warmWallPassed: scale === "10k" ? warmMs <= 8_000 : null,
        rssPassed:
          (peakRss - beforeRss) / 1024 / 1024 <= (scale === "10k" ? 512 : 768),
      },
    };
  } finally {
    clearInterval(sampler);
    delay.disable();
    await engine.close();
    await rm(fixtureRoot, { recursive: true });
    await rm(cacheRoot, { recursive: true });
  }
}

const result = {
  schema: "aiw.phase10-measurement/1",
  measuredAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpuModel: cpus()[0]?.model ?? "unavailable",
    cpuCount: cpus().length,
    totalMemoryMiB: Math.round(totalmem() / 1024 / 1024),
  },
  tenThousand: await measureScale("10k"),
  hundredThousand: await measureScale("100k"),
  browserMetrics: {
    initialLongestMainThreadTaskMs: "unverified",
    aggregateFrameP95Ms120Frames: "unverified",
    note: "Collect in the deterministic Phase 10 Playwright parent probe; Node does not claim browser metrics.",
  },
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
const failures = phase10MeasurementFailures(result);
if (failures.length > 0)
  throw new Error(`Phase 10 measurement failed: ${failures.join("; ")}`);
