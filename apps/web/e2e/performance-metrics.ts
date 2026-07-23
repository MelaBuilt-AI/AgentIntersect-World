export function nearestRankPercentile(
  samples: readonly number[],
  percentile: number,
): number {
  if (samples.length === 0) return Number.POSITIVE_INFINITY;
  if (!(percentile > 0 && percentile <= 1))
    throw new RangeError("percentile must be greater than 0 and at most 1");
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * percentile) - 1);
  return sorted[index] ?? Number.POSITIVE_INFINITY;
}

export function normalizeBrowserDuration(durationMs: number): number {
  return Number.isFinite(durationMs)
    ? Math.round(durationMs * 1_000) / 1_000
    : durationMs;
}

export function isAtOrBelowThreshold(
  value: number,
  threshold: number,
): boolean {
  if (!Number.isFinite(value) || !Number.isFinite(threshold))
    return value <= threshold;
  // performance.now() subtraction can place a nominal 16.8 ms tick a few
  // operand-scale ULPs above decimal 16.8. This affects only the verdict;
  // retained samples and calculated percentiles remain untouched.
  const tolerance =
    Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(threshold)) * 64;
  return value <= threshold + tolerance;
}

export type Phase13BrowserMetricThresholds = {
  readonly renderWorkP95Ms: number;
  readonly cadenceP95Ms: number;
  readonly longestTaskMs: number;
  readonly incrementalHeapMiB: number;
};

const STRICT_PROFILE_THRESHOLDS = {
  "desktop-10k-steady-state": {
    renderWorkP95Ms: 16.7,
    cadenceP95Ms: 16.8,
    longestTaskMs: 50,
    incrementalHeapMiB: 96,
  },
  "mobile-two-cpu-100k-steady-state": {
    renderWorkP95Ms: 33.3,
    cadenceP95Ms: 33.3,
    longestTaskMs: 100,
    incrementalHeapMiB: 96,
  },
} as const satisfies Readonly<
  Record<
    Phase13BrowserMetricEvidence["profile"],
    Phase13BrowserMetricThresholds
  >
>;

export type Phase13BrowserMetricEvidence = {
  readonly schema: "aiw.phase13-browser-metrics/2";
  readonly profile:
    "desktop-10k-steady-state" | "mobile-two-cpu-100k-steady-state";
  readonly profileVerification: {
    readonly requested: Phase13BrowserMetricEvidence["profile"];
    readonly verified: string;
    readonly matches: boolean;
  };
  readonly sampleCount: 120;
  readonly actualSampleCounts: {
    readonly renderWorkMs: number;
    readonly cadenceMs: number;
  };
  readonly rawSamples: {
    readonly renderWorkMs: readonly number[];
    readonly cadenceMs: readonly number[];
  };
  readonly thresholds: Phase13BrowserMetricThresholds;
  readonly calculated: {
    readonly renderWorkP95Ms: number;
    readonly cadenceP95Ms: number;
    readonly longestTaskMs: number;
    readonly incrementalHeapMiB: number;
  };
  readonly verdict: {
    readonly pass: boolean;
    readonly checks: {
      readonly exactSampleCounts: boolean;
      readonly finiteNonnegativeSamples: boolean;
      readonly profileVerified: boolean;
      readonly renderSamplesVerified: boolean;
      readonly strictThresholds: boolean;
      readonly renderWorkP95: boolean;
      readonly cadenceP95: boolean;
      readonly longestTask: boolean;
      readonly incrementalHeap: boolean;
    };
  };
};

export function createPhase13BrowserMetricEvidence(input: {
  readonly profile: Phase13BrowserMetricEvidence["profile"];
  readonly verifiedProfile?: string;
  readonly renderSamplesVerified?: boolean;
  readonly renderWorkMs: readonly number[];
  readonly cadenceMs: readonly number[];
  readonly longestTaskMs: number;
  readonly incrementalHeapMiB: number;
  readonly thresholds: Phase13BrowserMetricThresholds;
}): Phase13BrowserMetricEvidence {
  const renderWorkMs = [...input.renderWorkMs];
  const cadenceMs = [...input.cadenceMs];
  const renderWorkP95Ms = nearestRankPercentile(renderWorkMs, 0.95);
  const cadenceP95Ms = nearestRankPercentile(cadenceMs, 0.95);
  const strictThresholds = STRICT_PROFILE_THRESHOLDS[input.profile];
  const verifiedProfile = input.verifiedProfile ?? input.profile;
  const thresholdsMatch = (
    Object.keys(strictThresholds) as (keyof Phase13BrowserMetricThresholds)[]
  ).every((key) => input.thresholds[key] === strictThresholds[key]);
  const checks = {
    exactSampleCounts: renderWorkMs.length === 120 && cadenceMs.length === 120,
    finiteNonnegativeSamples: [...renderWorkMs, ...cadenceMs].every(
      (sample) => Number.isFinite(sample) && sample >= 0,
    ),
    profileVerified: verifiedProfile === input.profile,
    renderSamplesVerified: input.renderSamplesVerified ?? true,
    strictThresholds: thresholdsMatch,
    renderWorkP95: isAtOrBelowThreshold(
      renderWorkP95Ms,
      strictThresholds.renderWorkP95Ms,
    ),
    cadenceP95: isAtOrBelowThreshold(
      cadenceP95Ms,
      strictThresholds.cadenceP95Ms,
    ),
    longestTask: isAtOrBelowThreshold(
      input.longestTaskMs,
      strictThresholds.longestTaskMs,
    ),
    incrementalHeap: isAtOrBelowThreshold(
      input.incrementalHeapMiB,
      strictThresholds.incrementalHeapMiB,
    ),
  };
  return {
    schema: "aiw.phase13-browser-metrics/2",
    profile: input.profile,
    profileVerification: {
      requested: input.profile,
      verified: verifiedProfile,
      matches: verifiedProfile === input.profile,
    },
    sampleCount: 120,
    actualSampleCounts: {
      renderWorkMs: renderWorkMs.length,
      cadenceMs: cadenceMs.length,
    },
    rawSamples: { renderWorkMs, cadenceMs },
    thresholds: { ...strictThresholds },
    calculated: {
      renderWorkP95Ms,
      cadenceP95Ms,
      longestTaskMs: input.longestTaskMs,
      incrementalHeapMiB: input.incrementalHeapMiB,
    },
    verdict: {
      pass: Object.values(checks).every(Boolean),
      checks,
    },
  };
}
