import { describe, expect, it } from "vitest";

import { runPhase17Drill } from "./phase17-fixture.js";

describe("Phase 17 production-backed recovery drill", () => {
  it("passes every bounded recovery, privacy, preservation, and cleanup check", async () => {
    const result = await runPhase17Drill();
    expect(result.verdict).toBe("PASS");
    expect(Object.values(result.checks).every(Boolean)).toBe(true);
    expect(result.measurements.readinessRows).toBe(8);
    expect(result.measurements.eventCount).toBeGreaterThan(0);
    expect(result.cleanup).toEqual({
      exportAbsent: true,
      ownedProcessesZero: true,
      listenersZero: true,
      temporaryFilesZero: true,
      fixtureRootRemoved: true,
    });
  });
});
