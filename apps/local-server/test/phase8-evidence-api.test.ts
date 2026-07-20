import {
  EvidenceRecordSchema,
  type EvidenceRecord,
} from "@agentintersect-world/world-schema";
import { describe, expect, it } from "vitest";

import { EvidenceServiceError } from "../src/evidence-service.js";
import { createLocalServer } from "../src/server.js";

const intentId = "670774c6-d71f-48b7-8936-8bd54a6cc520";
const ref = `aiw://object/${"a".repeat(32)}`;

function record(): EvidenceRecord {
  return EvidenceRecordSchema.parse({
    schema: "aiw.evidence/0.8",
    intentId,
    jobId: "job-phase8",
    runId: "run-phase8",
    lifecycle: "complete",
    generationId: "770774c6-d71f-48b7-8936-8bd54a6cc521",
    generationFingerprint: "b".repeat(64),
    repositoryRef: ref,
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
}

describe("Phase 8 strict evidence API", () => {
  it("looks up by exactly one intent/job/run identity and exposes current/previous", async () => {
    const evidence = record();
    const evidenceService = {
      latest: () => ({ current: evidence, previous: null }),
      lookup: (query: {
        intentId?: string;
        jobId?: string;
        runId?: string;
      }) => {
        if (
          query.intentId === intentId ||
          query.jobId === evidence.jobId ||
          query.runId === evidence.runId
        )
          return { current: evidence, previous: null };
        throw new EvidenceServiceError(
          "not_found",
          "Evidence record not found",
        );
      },
    };
    const server = createLocalServer({
      evidenceService: evidenceService as never,
    });

    for (const query of [
      `intentId=${intentId}`,
      "jobId=job-phase8",
      "runId=run-phase8",
    ]) {
      const response = await server.inject({
        method: "GET",
        url: `/evidence?${query}`,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({
        current: evidence,
        previous: null,
      });
    }
    const latest = await server.inject({
      method: "GET",
      url: "/evidence/current",
    });
    expect(latest.statusCode).toBe(200);
    expect(latest.json().data).toEqual({ current: evidence, previous: null });
    await server.close();
  });

  it("rejects zero, multiple, unknown, and extra lookup parameters truthfully", async () => {
    const evidenceService = {
      latest: () => ({ current: null, previous: null }),
      lookup: () => {
        throw new EvidenceServiceError(
          "not_found",
          "Evidence record not found",
        );
      },
    };
    const server = createLocalServer({
      evidenceService: evidenceService as never,
    });
    expect(
      (await server.inject({ method: "GET", url: "/evidence" })).statusCode,
    ).toBe(400);
    expect(
      (
        await server.inject({
          method: "GET",
          url: `/evidence?intentId=${intentId}&runId=run-phase8`,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await server.inject({ method: "GET", url: "/evidence?jobId=unknown" }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await server.inject({
          method: "GET",
          url: "/evidence?jobId=unknown&rootPath=/private",
        })
      ).statusCode,
    ).toBe(400);
    const current = await server.inject({
      method: "GET",
      url: "/evidence/current",
    });
    expect(current.statusCode).toBe(200);
    expect(current.json().data).toEqual({ current: null, previous: null });

    const openapi = (
      await server.inject({ method: "GET", url: "/openapi.json" })
    ).json();
    expect(
      Object.keys(openapi.paths["/evidence"].get.responses).sort(),
    ).toEqual(["200", "400", "404", "503"]);
    await server.close();
  });
});
