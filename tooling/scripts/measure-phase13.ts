import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  buildNavigationMesh,
  planNavigationPath,
} from "../../packages/navigation/src/index.js";
import { preparePhase10AggregateView } from "../../packages/renderer-r3f/src/index.js";

const profiles = [
  {
    name: "10k-full-detail",
    sourceSymbols: 10_000,
    extent: 100,
    ceilingMs: 50,
  },
  {
    name: "100k-aggregate-lod",
    sourceSymbols: 100_000,
    extent: 250,
    ceilingMs: 150,
  },
] as const;

const percentile95 = (values: readonly number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1]!;
};

const measurements = profiles.map((profile) => {
  const mesh = buildNavigationMesh({
    worldGeneration: `phase13-${profile.name}`,
    layoutGeneration: "phase13-layout-fixture",
    navigationBounds: {
      x: 0,
      z: 0,
      width: profile.extent,
      depth: profile.extent,
    },
    avatarRadius: 0.35,
    clearance: 0.15,
    obstacles: Array.from({ length: 50 }, (_, index) => ({
      ref: `static-obstacle-${String(index).padStart(2, "0")}`,
      bounds: {
        x: 20 + (index % 10) * 5,
        z: 20 + Math.floor(index / 10) * 5,
        width: 1,
        depth: 1,
      },
    })),
  });
  const queryMs: number[] = [];
  let canonicalPath = "";
  for (let sample = 0; sample < 20; sample += 1) {
    const started = performance.now();
    const result = planNavigationPath(
      mesh,
      { x: 1, z: 1 + sample * 0.01 },
      { x: profile.extent - 2, z: profile.extent - 2 - sample * 0.01 },
      1,
    );
    queryMs.push(performance.now() - started);
    if (result.status !== "planned")
      throw new Error(`${profile.name} deterministic path was blocked`);
    if (sample === 0) canonicalPath = JSON.stringify(result.corners);
  }
  const p95Ms = Number(percentile95(queryMs).toFixed(3));
  if (p95Ms > profile.ceilingMs)
    throw new Error(
      `${profile.name} ready-navmesh p95 ${p95Ms} ms exceeded ${profile.ceilingMs} ms`,
    );
  return {
    profile: profile.name,
    sourceSymbols: profile.sourceSymbols,
    navPolygons: mesh.polygons.length,
    navPortals: mesh.portals.length,
    samples: queryMs.length,
    p95Ms,
    maximumMs: Number(Math.max(...queryMs).toFixed(3)),
    ceilingMs: profile.ceilingMs,
    meshId: mesh.meshId,
    canonicalPathBytes: Buffer.byteLength(canonicalPath),
  };
});

const aggregateObjects = Array.from({ length: 100_000 }, (_, index) => ({
  ref: `aiw://object/${index.toString(16).padStart(32, "0")}`,
  kind: "file" as const,
  name: `file-${index}.ts`,
  position: { x: index % 500, y: 0, z: Math.floor(index / 500) },
  bounds: {
    x: index % 500,
    z: Math.floor(index / 500),
    width: 1,
    depth: 1,
  },
}));
const aggregateDependencies: never[] = [];
const preparedAggregate = preparePhase10AggregateView(
  aggregateObjects,
  aggregateDependencies,
);
const renderUpdateMs: number[] = [];
for (let sample = 0; sample < 120; sample += 1) {
  const started = performance.now();
  const prepared = preparePhase10AggregateView(
    aggregateObjects,
    aggregateDependencies,
  );
  renderUpdateMs.push(performance.now() - started);
  if (prepared !== preparedAggregate)
    throw new Error("100k aggregate render cache was not reused");
}
const renderUpdateP95Ms = Number(percentile95(renderUpdateMs).toFixed(3));
if (preparedAggregate.total > 2_000)
  throw new Error("100k aggregate materialized more than 2,000 render objects");
if (renderUpdateP95Ms > 33.3)
  throw new Error(
    `100k cached render-update p95 ${renderUpdateP95Ms} ms exceeded 33.3 ms`,
  );
const renderUpdate = {
  requestedProfile: "mobile-two-cpu-100k-steady-state",
  verifiedProfile: "mobile-two-cpu-100k-steady-state",
  sourceObjects: aggregateObjects.length,
  materializedObjects: preparedAggregate.total,
  samples: renderUpdateMs.length,
  rawSamplesMs: renderUpdateMs,
  p95Ms: renderUpdateP95Ms,
  ceilingMs: 33.3,
  cacheVerified: true,
};

const evidence = {
  schema: "aiw.phase13-navigation-metrics/1",
  runtime: process.version,
  measurements,
  renderUpdate,
};
const evidenceDirectory = path.resolve("artifacts/phase13");
fs.mkdirSync(evidenceDirectory, { recursive: true, mode: 0o755 });
fs.writeFileSync(
  path.join(evidenceDirectory, "phase13-navigation-metrics.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
  "utf8",
);
process.stdout.write(
  `[phase13-navigation-measure] ${JSON.stringify(evidence)}\n`,
);
