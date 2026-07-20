import {
  EvidenceCurrentDataSchema,
  EvidenceRecordSchema,
  type EvidenceRecord,
} from "@agentintersect-world/world-schema";

const fileRef = "aiw://object/00000000000000000000000000000005";
const repositoryRef = "aiw://object/00000000000000000000000000000002";

function evidence(
  values: Partial<Pick<EvidenceRecord, "intentId" | "jobId" | "runId" | "completedAt">> = {},
): EvidenceRecord {
  const diff =
    "--- a/src/main.ts\n+++ b/src/main.ts\n-export const token = 1;\n+[REDACTED: secret-like content]\n";
  const diffBytes = new TextEncoder().encode(diff).byteLength;
  return EvidenceRecordSchema.parse({
    schema: "aiw.evidence/0.8",
    intentId: values.intentId ?? "670774c6-d71f-48b7-8936-8bd54a6cc520",
    jobId: values.jobId ?? "job-phase8",
    runId: values.runId ?? "run-phase8",
    lifecycle: "complete",
    generationId: "770774c6-d71f-48b7-8936-8bd54a6cc521",
    generationFingerprint: "b".repeat(64),
    repositoryRef,
    observationWindow: {
      openedAt: "2026-07-20T12:00:00.000Z",
      closedAt: values.completedAt ?? "2026-07-20T12:01:00.000Z",
    },
    attributionLabel: "observed-in-window",
    changes: [
      {
        path: "src/main.ts",
        outcome: "modified",
        observationLabel: "observed-in-window",
        attribution: "reported-and-confirmed",
        reported: true,
        binary: false,
        before: { size: 480, contentHash: "a".repeat(64) },
        after: { size: 512, contentHash: "c".repeat(64) },
        diff,
        diffBytes,
        truncated: false,
        redactions: 1,
        objectRef: fileRef,
        objectState: "live",
        diagnostics: [],
      },
      {
        path: "reported-but-missing.txt",
        outcome: "reported",
        observationLabel: "observed-in-window",
        attribution: "reported-unverified",
        reported: true,
        binary: false,
        before: null,
        after: null,
        diffBytes: 0,
        truncated: false,
        redactions: 0,
        objectRef: null,
        objectState: "unavailable",
        diagnostics: ["Repository evidence did not confirm this reported path."],
      },
    ],
    bounds: {
      maxChangedPaths: 256,
      maxTotalDiffBytes: 1_048_576,
      maxFileDiffBytes: 131_072,
      changedPathsObserved: 2,
      changedPathsReturned: 2,
      totalDiffBytes: diffBytes,
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
      diagnostic: "Exact correlated structured test evidence was independently confirmed.",
    },
    diagnostics: [],
    completedAt: values.completedAt ?? "2026-07-20T12:01:00.000Z",
  });
}

export const PHASE8_EVIDENCE_FIXTURE = EvidenceCurrentDataSchema.parse({
  current: evidence(),
  previous: evidence({
    intentId: "870774c6-d71f-48b7-8936-8bd54a6cc522",
    jobId: "job-phase8-previous",
    runId: "run-phase8-previous",
    completedAt: "2026-07-20T11:01:00.000Z",
  }),
});
