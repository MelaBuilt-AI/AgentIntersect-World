import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  VoiceOperationProjection,
  encodePcm16Wav,
  sameVoiceBinding,
  type VoiceBinding,
} from "../../packages/voice/src/index.js";
import { WhisperCliProvider } from "../../packages/voice/src/node.js";
import { evaluatePhase15Metrics } from "./phase15-measurement-verdict.js";

const sampleCount = 120;
const binding: VoiceBinding = {
  schema: "aiw.voice-binding/0.15",
  worldSessionId: "11111111-1111-4111-8111-111111111111",
  adapterId: "hermes",
  adapterRootSessionRef: "root",
  adapterEffectiveSessionRef: "effective",
  mode: "explore",
  permissionRevision: 1,
  capabilitySnapshotHash: "a".repeat(64),
};

const sample = (operation: () => void, count = sampleCount): number[] =>
  Array.from({ length: count }, () => {
    const started = performance.now();
    operation();
    return performance.now() - started;
  });

const heapBefore = process.memoryUsage().heapUsed;
const captureStateTransitionMs = sample(() => {
  const state = { listening: true, visible: "Listening" };
  if (!state.listening || state.visible !== "Listening")
    throw new Error("Capture state did not become visible.");
});
const wavEncodeAndBindingMs = sample(() => {
  const samples = new Float32Array(16_000);
  const wav = encodePcm16Wav(samples, 16_000);
  if (!sameVoiceBinding(binding, { ...binding }))
    throw new Error("Exact session binding was not retained.");
  wav.fill(0);
  samples.fill(0);
}, 30);
const ttsStateTransitionMs = sample(() => {
  const state = { requested: true, speaking: true };
  if (!state.requested || !state.speaking)
    throw new Error("Playback state did not become visible.");
});
const stopPlaybackStateTransitionMs = sample(() => {
  const playback = { speaking: true };
  playback.speaking = false;
  if (playback.speaking) throw new Error("Playback did not stop.");
});
const projection = new VoiceOperationProjection();
for (let index = 0; index < 20; index += 1)
  projection.record({
    id: `metric-${index}`,
    outcome: "completed",
    occurredAt: new Date(Date.now() - index).toISOString(),
    detail: `bounded operation ${index}`,
  });
const heapAfter = process.memoryUsage().heapUsed;
const incrementalHeapMiB = Math.max(0, heapAfter - heapBefore) / 1024 / 1024;
const providerRoot = process.env.AIW_PHASE15_STT_PROVIDER_ROOT;
const providerAttestation = await new WhisperCliProvider(
  providerRoot ? { providerRoot } : {},
).attest();
const evaluated = evaluatePhase15Metrics({
  captureStateTransitionMs,
  wavEncodeAndBindingMs,
  ttsStateTransitionMs,
  stopPlaybackStateTransitionMs,
  incrementalHeapMiB,
  providerAttestation,
});
const evidence = {
  schema: "aiw.phase15-control-microbenchmark/1",
  measuredAt: new Date().toISOString(),
  runtime: process.version,
  profiles: ["node-low-concurrency-synthetic-control"],
  rawSamples: {
    captureStateTransitionMs,
    wavEncodeAndBindingMs,
    ttsStateTransitionMs,
    stopPlaybackStateTransitionMs,
  },
  providerAttestation,
  retention: {
    operations: projection.snapshot().operations.length,
    maximumOperations: 20,
    serializedBytes: Buffer.byteLength(JSON.stringify(projection.snapshot())),
    maximumBytes: 256 * 1024,
  },
  ...evaluated,
};
if (!evidence.verdict)
  throw new Error(
    `Phase 15 supplemental control microbenchmark failed: ${JSON.stringify(evidence)}`,
  );
const directory = path.resolve("artifacts/phase15");
fs.mkdirSync(directory, { recursive: true, mode: 0o755 });
fs.writeFileSync(
  path.join(directory, "phase15-core-performance.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
  "utf8",
);
process.stdout.write(
  `[phase15-control-microbenchmark] ${JSON.stringify(evidence)}\n`,
);
