import { describe, expect, it } from "vitest";

import { createPhase13BrowserMetricEvidence } from "../e2e/performance-metrics.js";

describe("Phase 13 hybrid browser performance evidence", () => {
  it("retains 120 unrounded raw series and calculates independent nearest-rank p95 values", () => {
    const renderWorkMs = [
      ...Array.from({ length: 114 }, () => 0.123_456_789),
      ...Array.from({ length: 6 }, () => 20.987_654_321),
    ];
    const cadenceMs = [
      ...Array.from({ length: 114 }, () => 16.700_000_123),
      ...Array.from({ length: 6 }, () => 16.799_999_987),
    ];
    const evidence = createPhase13BrowserMetricEvidence({
      profile: "desktop-10k-steady-state",
      renderWorkMs,
      cadenceMs,
      longestTaskMs: 0.012_345_678,
      incrementalHeapMiB: 1.234_567_89,
      thresholds: {
        renderWorkP95Ms: 16.7,
        cadenceP95Ms: 16.8,
        longestTaskMs: 50,
        incrementalHeapMiB: 96,
      },
    });

    expect(evidence.schema).toBe("aiw.phase13-browser-metrics/2");
    expect(evidence.sampleCount).toBe(120);
    expect(evidence.rawSamples.renderWorkMs).toEqual(renderWorkMs);
    expect(evidence.rawSamples.cadenceMs).toEqual(cadenceMs);
    expect(evidence.calculated.renderWorkP95Ms).toBe(0.123_456_789);
    expect(evidence.calculated.cadenceP95Ms).toBe(16.700_000_123);
    expect(evidence.calculated.longestTaskMs).toBe(0.012_345_678);
    expect(evidence.calculated.incrementalHeapMiB).toBe(1.234_567_89);
    expect(evidence.verdict).toEqual({
      pass: true,
      checks: {
        exactSampleCounts: true,
        finiteNonnegativeSamples: true,
        profileVerified: true,
        renderSamplesVerified: true,
        strictThresholds: true,
        renderWorkP95: true,
        cadenceP95: true,
        longestTask: true,
        incrementalHeap: true,
      },
    });
  });

  it("treats timer-subtraction representation noise as the 16.8 ms boundary without changing raw evidence", () => {
    const representationalBoundary = 16.800000000000182;
    const cadenceMs = [
      ...Array.from({ length: 113 }, () => 16.7),
      ...Array.from({ length: 7 }, () => representationalBoundary),
    ];
    const evidence = createPhase13BrowserMetricEvidence({
      profile: "desktop-10k-steady-state",
      renderWorkMs: Array.from({ length: 120 }, () => 0.1),
      cadenceMs,
      longestTaskMs: 0,
      incrementalHeapMiB: 1,
      thresholds: {
        renderWorkP95Ms: 16.7,
        cadenceP95Ms: 16.8,
        longestTaskMs: 50,
        incrementalHeapMiB: 96,
      },
    });

    expect(evidence.rawSamples.cadenceMs).toEqual(cadenceMs);
    expect(evidence.calculated.cadenceP95Ms).toBe(representationalBoundary);
    expect(evidence.verdict.checks.cadenceP95).toBe(true);
    expect(evidence.verdict.pass).toBe(true);
  });

  it("still fails a meaningful cadence overage above the representational tolerance", () => {
    const cadenceMs = [
      ...Array.from({ length: 113 }, () => 16.7),
      ...Array.from({ length: 7 }, () => 16.800_001),
    ];
    const evidence = createPhase13BrowserMetricEvidence({
      profile: "desktop-10k-steady-state",
      renderWorkMs: Array.from({ length: 120 }, () => 0.1),
      cadenceMs,
      longestTaskMs: 0,
      incrementalHeapMiB: 1,
      thresholds: {
        renderWorkP95Ms: 16.7,
        cadenceP95Ms: 16.8,
        longestTaskMs: 50,
        incrementalHeapMiB: 96,
      },
    });

    expect(evidence.rawSamples.cadenceMs).toEqual(cadenceMs);
    expect(evidence.calculated.cadenceP95Ms).toBe(16.800_001);
    expect(evidence.verdict.checks.cadenceP95).toBe(false);
    expect(evidence.verdict.pass).toBe(false);
  });

  it("preserves invalid raw intervals and fails the explicit integrity verdict", () => {
    const evidence = createPhase13BrowserMetricEvidence({
      profile: "desktop-10k-steady-state",
      renderWorkMs: Array.from({ length: 120 }, () => 0.1),
      cadenceMs: [-0.25, ...Array.from({ length: 119 }, () => 16.7)],
      longestTaskMs: 0,
      incrementalHeapMiB: 1,
      thresholds: {
        renderWorkP95Ms: 16.7,
        cadenceP95Ms: 16.8,
        longestTaskMs: 50,
        incrementalHeapMiB: 96,
      },
    });

    expect(evidence.rawSamples.cadenceMs[0]).toBe(-0.25);
    expect(evidence.verdict.checks.finiteNonnegativeSamples).toBe(false);
    expect(evidence.verdict.pass).toBe(false);
  });

  it("cannot relabel over-budget desktop render work with a weaker caller threshold", () => {
    const evidence = createPhase13BrowserMetricEvidence({
      profile: "desktop-10k-steady-state",
      verifiedProfile: "desktop-10k-steady-state",
      renderSamplesVerified: true,
      renderWorkMs: Array.from({ length: 120 }, () => 23),
      cadenceMs: Array.from({ length: 120 }, () => 16.7),
      longestTaskMs: 1,
      incrementalHeapMiB: 1,
      thresholds: {
        renderWorkP95Ms: 35,
        cadenceP95Ms: 35,
        longestTaskMs: 100,
        incrementalHeapMiB: 128,
      },
    });

    expect(evidence.profileVerification).toEqual({
      requested: "desktop-10k-steady-state",
      verified: "desktop-10k-steady-state",
      matches: true,
    });
    expect(evidence.thresholds.renderWorkP95Ms).toBe(16.7);
    expect(evidence.verdict.checks.strictThresholds).toBe(false);
    expect(evidence.verdict.checks.renderWorkP95).toBe(false);
    expect(evidence.verdict.pass).toBe(false);
  });
});
