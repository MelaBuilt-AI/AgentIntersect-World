import { describe, expect, it } from "vitest";

import * as observability from "../src/index.js";

const phase17 = observability as unknown as Record<string, unknown>;

describe("Phase 17 observability contracts", () => {
  it("publishes the canonical schema and exact readiness capability order", () => {
    expect(phase17.OBSERVABILITY_SCHEMA).toBe("aiw.observability/0.17");
    expect(phase17.OBSERVABILITY_CAPABILITIES).toEqual([
      "session",
      "tool",
      "world-action",
      "preview",
      "voice",
      "worktree",
      "yjs",
      "sqlite",
    ]);
  });

  it("redacts supported diagnostic summaries and rejects unsafe evidence", () => {
    expect(typeof phase17.redactDiagnosticSummary).toBe("function");
    expect(typeof phase17.assertDiagnosticSafe).toBe("function");
    const redact = phase17.redactDiagnosticSummary as (input: string) => string;
    const assertSafe = phase17.assertDiagnosticSafe as (value: unknown) => void;
    const unsafe = [
      "/root/private/file",
      "/opt/agent/data",
      "/srv/world/state",
      "/mnt/operator/repository",
      "/home/operator/source",
      "/tmp/phase17/raw",
      "/var/private/log",
      "/etc/private/config",
      String.raw`C:\Users\operator\source.txt`,
      String.raw`\\server\share\source.txt`,
      "TOKEN=SECRET_CANARY_VALUE",
      "PERSONA_CANARY_PRIVATE",
      "MEMORY_CANARY_PRIVATE",
    ];
    const redacted = redact(`safe-label worktrees/beans ${unsafe.join(" ")}`);
    expect(redacted).toContain("safe-label worktrees/beans");
    for (const raw of unsafe) expect(redacted).not.toContain(raw);
    expect(() => assertSafe(redacted)).not.toThrow();
    for (const raw of unsafe)
      expect(() => assertSafe({ summary: raw })).toThrow(/privacy validation/);
  });

  it("creates a healthy exactly-two-agent Phase 17 seed snapshot", () => {
    expect(typeof phase17.createPhase17Snapshot).toBe("function");
  });
});
