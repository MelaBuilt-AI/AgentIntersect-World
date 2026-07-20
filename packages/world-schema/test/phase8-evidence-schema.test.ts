import { describe, expect, it } from "vitest";

import {
  EvidenceBaselineSchema,
  EvidenceLookupDataSchema,
  EvidenceLookupQuerySchema,
  EvidenceRecordSchema,
  EVIDENCE_MAX_CHANGED_PATHS,
  EVIDENCE_MAX_FILE_DIFF_BYTES,
  EVIDENCE_MAX_TOTAL_DIFF_BYTES,
} from "../src/index.js";

const intentId = "670774c6-d71f-48b7-8936-8bd54a6cc520";
const objectRef = `aiw://object/${"a".repeat(32)}`;
const sanitizedDiff =
  "--- a/src/example.ts\n+++ b/src/example.ts\n-[REDACTED: secret-like content]\n+export const after = 2;\n";
const sanitizedDiffBytes = new TextEncoder().encode(sanitizedDiff).byteLength;

const baseline = {
  schema: "aiw.evidence-baseline/0.8",
  intentId,
  generationId: "770774c6-d71f-48b7-8936-8bd54a6cc521",
  generationFingerprint: "b".repeat(64),
  repositoryRef: objectRef,
  git: { present: true, head: "c".repeat(40), dirty: false },
  sealedAt: "2026-07-20T12:00:00.000Z",
  files: [
    {
      path: "src/example.ts",
      size: 20,
      contentHash: "d".repeat(64),
      binary: false,
      oversized: false,
      sanitizedText: "export const before = 1;\n",
      redactions: 0,
      gitStatus: null,
      objectRef,
    },
  ],
};

const evidence = {
  schema: "aiw.evidence/0.8",
  intentId,
  jobId: "job-phase8",
  runId: "run-phase8",
  lifecycle: "complete",
  generationId: baseline.generationId,
  generationFingerprint: baseline.generationFingerprint,
  repositoryRef: objectRef,
  observationWindow: {
    openedAt: baseline.sealedAt,
    closedAt: "2026-07-20T12:01:00.000Z",
  },
  attributionLabel: "observed-in-window",
  changes: [
    {
      path: "src/example.ts",
      outcome: "modified",
      observationLabel: "observed-in-window",
      attribution: "reported-and-confirmed",
      reported: true,
      binary: false,
      before: { size: 20, contentHash: "d".repeat(64) },
      after: { size: 19, contentHash: "e".repeat(64) },
      diff: sanitizedDiff,
      diffBytes: sanitizedDiffBytes,
      truncated: false,
      redactions: 1,
      objectRef,
      objectState: "live",
      diagnostics: [],
    },
  ],
  bounds: {
    maxChangedPaths: 256,
    maxTotalDiffBytes: 1_048_576,
    maxFileDiffBytes: 131_072,
    changedPathsObserved: 1,
    changedPathsReturned: 1,
    totalDiffBytes: sanitizedDiffBytes,
    pathsTruncated: false,
    diffTruncated: false,
    redactions: 1,
  },
  test: {
    state: "passed",
    verification: "verified",
    artifactPath: ".agentintersect-world/test-evidence.json",
    artifactHash: "f".repeat(64),
    reportedState: "passed",
    diagnostic:
      "Exact correlated structured test evidence was independently confirmed.",
  },
  diagnostics: [],
  completedAt: "2026-07-20T12:01:00.000Z",
};

describe("Phase 8 evidence schemas", () => {
  it("accepts strict bounded baseline and completed evidence records", () => {
    expect(EvidenceBaselineSchema.parse(baseline)).toEqual(baseline);
    expect(EvidenceRecordSchema.parse(evidence)).toEqual(evidence);
    expect(EVIDENCE_MAX_CHANGED_PATHS).toBe(256);
    expect(EVIDENCE_MAX_TOTAL_DIFF_BYTES).toBe(1024 * 1024);
    expect(EVIDENCE_MAX_FILE_DIFF_BYTES).toBe(128 * 1024);
    expect(() =>
      EvidenceRecordSchema.parse({ ...evidence, rootPath: "/secret" }),
    ).toThrow();
  });

  it("requires exactly one lookup identity and returns current plus previous", () => {
    expect(EvidenceLookupQuerySchema.parse({ intentId })).toEqual({ intentId });
    expect(EvidenceLookupQuerySchema.parse({ jobId: "job-phase8" })).toEqual({
      jobId: "job-phase8",
    });
    expect(EvidenceLookupQuerySchema.parse({ runId: "run-phase8" })).toEqual({
      runId: "run-phase8",
    });
    expect(() => EvidenceLookupQuerySchema.parse({})).toThrow();
    expect(() =>
      EvidenceLookupQuerySchema.parse({ intentId, runId: "run-phase8" }),
    ).toThrow();
    expect(
      EvidenceLookupDataSchema.parse({ current: evidence, previous: null }),
    ).toEqual({
      current: evidence,
      previous: null,
    });
  });

  it("rejects over-bound paths and diff payloads", () => {
    expect(() =>
      EvidenceRecordSchema.parse({
        ...evidence,
        changes: Array.from({ length: 257 }, () => evidence.changes[0]),
      }),
    ).toThrow();
    expect(() =>
      EvidenceRecordSchema.parse({
        ...evidence,
        changes: [{ ...evidence.changes[0], diff: "x".repeat(131_073) }],
      }),
    ).toThrow();
    expect(() =>
      EvidenceRecordSchema.parse({
        ...evidence,
        changes: [
          {
            ...evidence.changes[0],
            diff: "🙂".repeat(40_000),
            diffBytes: 1,
          },
        ],
        bounds: { ...evidence.bounds, totalDiffBytes: 1 },
      }),
    ).toThrow();
  });
});
