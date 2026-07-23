export type Phase15MetricInput = {
  readonly captureStateTransitionMs: readonly number[];
  readonly wavEncodeAndBindingMs: readonly number[];
  readonly ttsStateTransitionMs: readonly number[];
  readonly stopPlaybackStateTransitionMs: readonly number[];
  readonly incrementalHeapMiB: number;
  readonly providerAttestation: {
    readonly available: boolean;
    readonly reason: string | null;
  };
};

const maximum = (values: readonly number[]): number => Math.max(...values);
const p95 = (values: readonly number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  return (
    sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY
  );
};

export function evaluatePhase15Metrics(input: Phase15MetricInput) {
  if (
    input.captureStateTransitionMs.length === 0 ||
    input.wavEncodeAndBindingMs.length === 0 ||
    input.ttsStateTransitionMs.length === 0 ||
    input.stopPlaybackStateTransitionMs.length === 0
  )
    throw new Error("Phase 15 verdict requires raw samples for every profile.");
  const metrics = [
    {
      name: "synthetic-capture-state-transition",
      samplesMs: input.captureStateTransitionMs,
      supplementalCeilingMs: 250,
    },
    {
      name: "synthetic-wav-encode-and-binding-check",
      samplesMs: input.wavEncodeAndBindingMs,
      supplementalCeilingMs: 10_000,
    },
    {
      name: "synthetic-tts-state-transition",
      samplesMs: input.ttsStateTransitionMs,
      supplementalCeilingMs: 5_000,
    },
    {
      name: "synthetic-stop-playback-state-transition",
      samplesMs: input.stopPlaybackStateTransitionMs,
      supplementalCeilingMs: 100,
    },
  ].map((metric) => ({
    ...metric,
    sampleCount: metric.samplesMs.length,
    p95Ms: p95(metric.samplesMs),
    maximumMs: maximum(metric.samplesMs),
    pass: maximum(metric.samplesMs) <= metric.supplementalCeilingMs,
  }));
  const heap = {
    incrementalHeapMiB: input.incrementalHeapMiB,
    supplementalCeilingMiB: 32,
    pass: input.incrementalHeapMiB <= 32,
  };
  return {
    evidenceKind: "synthetic-control-microbenchmark" as const,
    acceptanceEvidence: false,
    metrics,
    heap,
    capability: {
      providerAttested: input.providerAttestation.available,
      providerReason: input.providerAttestation.reason,
      lexicalPartials: false,
      lexicalPartialReason:
        "Pinned whisper-cli returns final text only; progress is never transcript text.",
    },
    limitations: [
      "These samples measure deterministic in-process control primitives, not microphone capture, native STT, or browser speech synthesis.",
      "Frozen acceptance timings are recorded separately in phase15-browser-performance.json and phase15-live-provider.json.",
    ],
    verdict: metrics.every(({ pass }) => pass) && heap.pass,
  };
}
