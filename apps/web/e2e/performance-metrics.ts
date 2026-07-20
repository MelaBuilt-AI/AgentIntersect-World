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
