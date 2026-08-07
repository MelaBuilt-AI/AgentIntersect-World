import { describe, expect, it } from "vitest";

import type { Phase14Journey } from "../src/phase14-service.js";
import {
  WorkstreamPhase14AdapterError,
  projectWorkstreamPhase14Evidence,
  type WorkstreamPhase14Owner,
} from "../src/workstream-phase14-adapter.js";

const operationId = "11111111-1111-4111-8111-111111111111";
const correlationId = "22222222-2222-4222-8222-222222222222";
const repositoryId = "repo-current";
const nativeSessionId = "phase14-hermes-fixture-session";
const digest = "a".repeat(64);
const now = "2026-08-07T00:00:00.000Z";

const owner: WorkstreamPhase14Owner = {
  workstreamId: "workstream-one",
  correlationId,
  repositoryId,
  nativeSessionId,
  evidenceOperationRefs: [operationId],
};

function journey(values: Partial<Phase14Journey> = {}): Phase14Journey {
  return {
    schema: "aiw.phase14-operation/1",
    operationId,
    correlationId,
    createdAt: now,
    updatedAt: now,
    status: "active",
    step: 8,
    session: {
      worldSessionId: "33333333-3333-4333-8333-333333333333",
      adapterId: "phase14-fixture",
      adapterSessionRef: nativeSessionId,
      rootSessionRef: "phase14-hermes-fixture-root",
      continuity: "fixture-existing",
    },
    disposable: {
      copyName: "fixture-copy",
      repositoryId,
      rootAttestation: digest,
      fixtureRevision: "fixture-revision-1",
      target: "src/greeting.mjs",
      symbol: "greeting",
      initialHash: digest,
      patchDigest: digest,
    },
    operationIds: {
      read: "44444444-4444-4444-8444-444444444444",
      edit: "55555555-5555-4555-8555-555555555555",
      test: "66666666-6666-4666-8666-666666666666",
      preview: "77777777-7777-4777-8777-777777777777",
    },
    events: [],
    search: null,
    explanation: null,
    edit: {
      outcome: "applied",
      diff: "unprojected raw diff",
      patchDigest: digest,
      previousHash: digest,
      currentHash: "b".repeat(64),
      previousEvidenceRef: "evidence:previous",
      currentEvidenceRef: "evidence:current",
      operationId: "55555555-5555-4555-8555-555555555555",
      error: null,
    },
    approval: null,
    test: {
      state: "succeeded",
      argv: [process.execPath, "--test", "test/greeting.test.mjs"],
      stdout: "unprojected output",
      stderr: "",
      stdoutTruncated: false,
      stderrTruncated: false,
      exitCode: 0,
      signal: null,
      timedOut: false,
      startedAt: now,
      finishedAt: now,
      evidenceRef: "evidence:test",
    },
    preview: {
      state: "stopped",
      url: "http://127.0.0.1:12345",
      port: 12345,
      health: { ok: true, schema: "aiw.phase14-preview/1" },
      logs: "unprojected logs",
      logsTruncated: false,
      startedAt: now,
      readyAt: now,
      stoppedAt: now,
      portClosed: true,
      evidenceRef: "evidence:preview",
      step: 10,
    },
    evidenceRefs: ["evidence:current", "evidence:test", "evidence:preview"],
    recovered: false,
    ...values,
  };
}

describe("Workstream Phase 14 evidence adapter", () => {
  it("projects only correlated operation lifecycle and bounded evidence facts", () => {
    const projected = projectWorkstreamPhase14Evidence(journey(), owner);

    expect(projected).toEqual({
      schema: "aiw.workstream-phase14-evidence/1",
      workstreamId: owner.workstreamId,
      operationId,
      lifecycle: { status: "active", step: 8 },
      operationIds: {
        read: "44444444-4444-4444-8444-444444444444",
        edit: "55555555-5555-4555-8555-555555555555",
        test: "66666666-6666-4666-8666-666666666666",
        preview: "77777777-7777-4777-8777-777777777777",
      },
      edit: {
        operationId: "55555555-5555-4555-8555-555555555555",
        outcome: "applied",
        patchDigest: digest,
        previousEvidenceRef: "evidence:previous",
        currentEvidenceRef: "evidence:current",
      },
      test: {
        state: "succeeded",
        exitCode: 0,
        timedOut: false,
        startedAt: now,
        finishedAt: now,
        evidenceRef: "evidence:test",
      },
      preview: {
        state: "stopped",
        startedAt: now,
        readyAt: now,
        stoppedAt: now,
        portClosed: true,
        evidenceRef: "evidence:preview",
      },
      createdAt: now,
      updatedAt: now,
    });
    expect(JSON.stringify(projected)).not.toMatch(
      /unprojected raw diff|unprojected output|unprojected logs|127\.0\.0\.1|argv/,
    );
  });

  it.each([
    ["workstream", { evidenceOperationRefs: [] }],
    ["repository", { repositoryId: "repo-other" }],
    ["session", { nativeSessionId: "session-other" }],
    ["correlation", { correlationId: "correlation-other" }],
  ])("rejects a mismatched %s reference", (_label, mismatch) => {
    expect(() =>
      projectWorkstreamPhase14Evidence(journey(), { ...owner, ...mismatch }),
    ).toThrow(WorkstreamPhase14AdapterError);
  });

  it("keeps absent edit, validation, preview, and completion facts absent", () => {
    const projected = projectWorkstreamPhase14Evidence(
      journey({
        step: 1,
        operationIds: {},
        edit: null,
        test: null,
        preview: null,
        evidenceRefs: [],
      }),
      owner,
    );

    expect(projected.lifecycle).toEqual({ status: "active", step: 1 });
    expect(projected.operationIds).toEqual({});
    expect(projected).not.toHaveProperty("edit");
    expect(projected).not.toHaveProperty("test");
    expect(projected).not.toHaveProperty("preview");
  });
});
