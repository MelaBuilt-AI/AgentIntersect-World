import { EvidenceRecordSchema } from "@agentintersect-world/world-schema";
import { describe, expect, it, vi } from "vitest";

import {
  getCurrentEvidence,
  lookupEvidence,
} from "../src/evidence/evidence-client.js";

const evidence = EvidenceRecordSchema.parse({
  schema: "aiw.evidence/0.8",
  intentId: "670774c6-d71f-48b7-8936-8bd54a6cc520",
  jobId: "job-phase8",
  runId: "run-phase8",
  lifecycle: "complete",
  generationId: "770774c6-d71f-48b7-8936-8bd54a6cc521",
  generationFingerprint: "b".repeat(64),
  repositoryRef: `aiw://object/${"a".repeat(32)}`,
  observationWindow: {
    openedAt: "2026-07-20T12:00:00.000Z",
    closedAt: "2026-07-20T12:01:00.000Z",
  },
  attributionLabel: "observed-in-window",
  changes: [],
  bounds: {
    maxChangedPaths: 256,
    maxTotalDiffBytes: 1_048_576,
    maxFileDiffBytes: 131_072,
    changedPathsObserved: 0,
    changedPathsReturned: 0,
    totalDiffBytes: 0,
    pathsTruncated: false,
    diffTruncated: false,
    redactions: 0,
  },
  test: {
    state: "unavailable",
    verification: "none",
    diagnostic:
      "No exact correlated structured on-disk test evidence was reported.",
  },
  diagnostics: [],
  completedAt: "2026-07-20T12:01:00.000Z",
});

const envelope = (data: unknown) => ({
  ok: true,
  data,
  meta: {
    correlationId: "a5cf11a9-754e-4d76-946b-55a77c0eef28",
    schema: "aiw.api/0.3",
  },
});

describe("Phase 8 evidence client", () => {
  it("validates current/previous and an exact encoded lookup", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(envelope({ current: evidence, previous: null })),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(envelope({ current: evidence, previous: null })),
        ),
      );
    expect((await getCurrentEvidence(fetcher)).status).toBe("ok");
    expect(
      (await lookupEvidence({ runId: "run phase8" }, fetcher)).status,
    ).toBe("ok");
    expect(fetcher.mock.calls[1]?.[0]).toContain("/evidence?runId=run+phase8");
  });

  it("rejects a path-leaking or malformed evidence response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify(
          envelope({
            current: { ...evidence, rootPath: "/private/repo" },
            previous: null,
          }),
        ),
      ),
    );
    expect(await getCurrentEvidence(fetcher)).toEqual({
      status: "error",
      message: "Invalid local server response",
    });
  });
});
