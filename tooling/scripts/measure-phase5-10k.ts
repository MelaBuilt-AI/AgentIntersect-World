import {
  boundedSemanticObjects,
  prepareRepositoryInstances,
  type RepositoryRenderObject,
} from "@agentintersect-world/renderer-r3f";

const objects: RepositoryRenderObject[] = Array.from(
  { length: 10_000 },
  (_, index) => ({
    ref: `aiw://object/${index.toString(16).padStart(32, "0")}`,
    kind: "file",
    name: `fixture-${String(index).padStart(5, "0")}.ts`,
    fileKind: "source",
    language: "typescript",
    position: { x: index % 100, y: 0, z: Math.floor(index / 100) },
    bounds: { x: index % 100, z: Math.floor(index / 100), width: 1, depth: 1 },
  }),
);

prepareRepositoryInstances(objects);
const durations: number[] = [];
let prepared = prepareRepositoryInstances(objects);
for (let attempt = 0; attempt < 7; attempt += 1) {
  const started = performance.now();
  prepared = prepareRepositoryInstances(objects);
  durations.push(performance.now() - started);
}
const selectionStarted = performance.now();
const sourceGroup = prepared.groups["source-file-code-slab"];
const selectionIndex = sourceGroup.refs.indexOf(objects.at(-1)?.ref ?? "");
const selectionMs = performance.now() - selectionStarted;
const sorted = [...durations].sort((left, right) => left - right);

process.stdout.write(
  `${JSON.stringify(
    {
      node: process.version,
      instances: prepared.total,
      matrixFloats: sourceGroup.matrices.length,
      semanticRows: boundedSemanticObjects(objects, 160).length,
      warmRunsMs: durations.map((duration) => Number(duration.toFixed(3))),
      medianPreparationMs: Number((sorted[3] ?? 0).toFixed(3)),
      maximumPreparationMs: Number(Math.max(...durations).toFixed(3)),
      selectionIndex,
      selectionMs: Number(selectionMs.toFixed(3)),
      thresholdMs: 250,
      thresholdPassed: Math.max(...durations) < 250 && selectionIndex === 9_999,
    },
    null,
    2,
  )}\n`,
);
