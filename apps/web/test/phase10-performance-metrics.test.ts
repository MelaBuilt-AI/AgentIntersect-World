import { CodeGraphCurrentDataSchema } from "@agentintersect-world/world-schema";
import { describe, expect, it } from "vitest";

import {
  nearestRankPercentile,
  normalizeBrowserDuration,
} from "../e2e/performance-metrics.js";
import {
  createPhase10AggregateFixture,
  getPhase10CodeGraph10KStatus,
  getPhase10CodeGraph100KStatus,
} from "../src/fixtures/phase10-code-graph.js";

describe("Phase 10 browser performance metrics", () => {
  it("uses the nearest-rank p95 rather than the next stricter sample", () => {
    const samples = [
      ...Array.from({ length: 114 }, () => 16.7),
      ...Array.from({ length: 6 }, () => 33.3),
    ];
    expect(nearestRankPercentile(samples, 0.95)).toBe(16.7);
    samples[113] = 33.3;
    expect(nearestRankPercentile(samples, 0.95)).toBe(33.3);
  });

  it("normalizes binary timestamp noise without hiding a real breach", () => {
    expect(normalizeBrowserDuration(33.30000000000018)).toBe(33.3);
    expect(normalizeBrowserDuration(33.301)).toBe(33.301);
    expect(normalizeBrowserDuration(Number.POSITIVE_INFINITY)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it("rejects invalid percentile requests and reports empty samples", () => {
    expect(nearestRankPercentile([], 0.95)).toBe(Number.POSITIVE_INFINITY);
    expect(() => nearestRankPercentile([1], 0)).toThrow(RangeError);
    expect(() => nearestRankPercentile([1], 1.01)).toThrow(RangeError);
  });

  it("lazily builds schema-valid large fixtures with matching aggregates", () => {
    const tenThousand = getPhase10CodeGraph10KStatus();
    const hundredThousand = getPhase10CodeGraph100KStatus();
    expect(CodeGraphCurrentDataSchema.parse(tenThousand)).toBeTruthy();
    expect(CodeGraphCurrentDataSchema.parse(hundredThousand)).toBeTruthy();
    expect(tenThousand.current?.coverage).toHaveLength(500);
    expect(hundredThousand.current?.coverage).toHaveLength(5_000);
    expect(
      createPhase10AggregateFixture(hundredThousand.current?.generationId)
        .generationId,
    ).toBe(hundredThousand.current?.generationId);
  });
});
