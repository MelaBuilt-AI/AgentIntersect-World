import { describe, expect, it } from "vitest";

import { phase10MeasurementFailures } from "./phase10-measurement-verdict.js";

const passing = {
  tenThousand: {
    sentinelAbsent: true,
    ceilings: { coldWallPassed: true, warmWallPassed: true, rssPassed: true },
  },
  hundredThousand: {
    sentinelAbsent: true,
    ceilings: { coldWallPassed: true, warmWallPassed: null, rssPassed: true },
  },
} as const;

describe("Phase 10 measurement enforcement", () => {
  it("accepts both applicable scales while keeping 100k warm unbounded", () => {
    expect(phase10MeasurementFailures(passing)).toEqual([]);
  });

  it.each([
    [
      "10k cold wall",
      {
        ...passing,
        tenThousand: {
          ...passing.tenThousand,
          ceilings: { ...passing.tenThousand.ceilings, coldWallPassed: false },
        },
      },
    ],
    [
      "10k warm wall",
      {
        ...passing,
        tenThousand: {
          ...passing.tenThousand,
          ceilings: { ...passing.tenThousand.ceilings, warmWallPassed: false },
        },
      },
    ],
    [
      "100k RSS",
      {
        ...passing,
        hundredThousand: {
          ...passing.hundredThousand,
          ceilings: { ...passing.hundredThousand.ceilings, rssPassed: false },
        },
      },
    ],
    [
      "10k sentinel",
      {
        ...passing,
        tenThousand: { ...passing.tenThousand, sentinelAbsent: false },
      },
    ],
    [
      "100k sentinel",
      {
        ...passing,
        hundredThousand: { ...passing.hundredThousand, sentinelAbsent: false },
      },
    ],
  ])("rejects %s failure", (_label, result) => {
    expect(phase10MeasurementFailures(result)).not.toEqual([]);
  });
});
