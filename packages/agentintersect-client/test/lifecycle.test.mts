import assert from "node:assert/strict";
import test from "node:test";

import { captureLifecycleContract } from "../src/index.ts";

test("fresh disposable state proves worker, handoff, evidence, and safe-pause semantics", async () => {
  const checkout = process.env.AGENTINTERSECT_CHECKOUT;
  assert.ok(checkout, "AGENTINTERSECT_CHECKOUT is required");
  const capture = await captureLifecycleContract(checkout);

  assert.equal(capture.createStatus, 201);
  assert.equal(capture.createdJobStatus, "queued");
  assert.equal(capture.claimStatus, 200);
  assert.equal(capture.claimedJobStatus, "running");
  assert.equal(capture.claimedBy, "phase0-owner");
  assert.equal(capture.wrongWorkerStatus, 409);
  assert.equal(capture.completionStatus, 202);
  assert.equal(capture.completedJobStatus, "complete");
  assert.equal(capture.duplicateStatus, 409);
  assert.equal(capture.reconciledJobStatus, "complete");
  assert.equal(capture.failedResultStatus, 202);
  assert.equal(capture.failedJobStatus, "failed");
  assert.equal(capture.durableCompletionEvents, 2);
  assert.deepEqual(capture.handoff, {
    phaseId: "phase_1",
    validationOk: true,
    integrityAlgorithm: "sha256",
  });
  assert.deepEqual(capture.evidence, {
    phaseId: "phase_1",
    relativePath: "phase_1/phase0/result.json",
    durableEventCount: 1,
  });
  assert.equal(capture.safePauseRequested, "pause_requested");
  assert.equal(capture.safePauseReached, "paused_safe");
  assert.equal(capture.nextPhaseStarted, false);
  assert.equal(capture.servicesTerminated, true);
  assert.equal(capture.workspaceDisposed, true);
});
