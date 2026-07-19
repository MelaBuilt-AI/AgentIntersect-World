import assert from "node:assert/strict";
import test from "node:test";

import { captureEmergencyStopContract } from "../src/index.ts";

test("emergency stop handles only the exact registered harmless child", async () => {
  const checkout = process.env.AGENTINTERSECT_CHECKOUT;
  assert.ok(checkout, "AGENTINTERSECT_CHECKOUT is required");
  const capture = await captureEmergencyStopContract(checkout);

  assert.equal(
    capture.boundaryKind,
    "current-private-implementation-candidate",
  );
  assert.equal(capture.ownedAliveBefore, true);
  assert.equal(capture.unownedAliveBefore, true);
  assert.equal(capture.responseStatus, 200);
  assert.equal(capture.scope, "agentintersect_owned_subprocesses_only");
  assert.equal(capture.ignoredCallerPid, true);
  assert.equal(capture.terminatedCount, 1);
  assert.equal(capture.rejectedCount, 0);
  assert.equal(capture.ownedHandled, true);
  assert.equal(capture.unownedAliveAfter, true);
  assert.equal(capture.durableEventCount, 1);
  assert.equal(capture.cleanupComplete, true);
  assert.equal(capture.serviceTerminated, true);
  assert.equal(capture.workspaceDisposed, true);
});
