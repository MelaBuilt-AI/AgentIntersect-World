import assert from "node:assert/strict";
import test from "node:test";

import { captureHttpSseContract } from "../src/index.ts";

test("real daemon and dashboard prove HTTP, SSE framing, and reconnect candidates", async () => {
  const checkout = process.env.AGENTINTERSECT_CHECKOUT;
  assert.ok(checkout, "AGENTINTERSECT_CHECKOUT is required");

  const capture = await captureHttpSseContract(checkout);
  assert.equal(capture.daemonReady, true);
  assert.equal(capture.dashboardReady, true);
  assert.equal(capture.attested, true);
  assert.equal(capture.daemonStateStatus, 200);
  assert.equal(capture.daemonNotFoundStatus, 404);
  assert.deepEqual(capture.healthKeys, [
    "ok",
    "pid",
    "processStartTime",
    "protocol",
    "service",
    "workspaceIdentity",
  ]);
  assert.ok(capture.snapshotKeys.includes("safePause"));
  assert.ok(capture.snapshotKeys.includes("workerJobs"));
  assert.deepEqual(capture.eventFeedKeys, ["events", "ok"]);
  assert.match(capture.sse.contentType, /^text\/event-stream/);
  assert.match(capture.sse.cacheControl, /no-store/);
  assert.equal(capture.sse.event, "events");
  assert.equal(capture.sse.hasData, true);
  assert.equal(capture.sse.hasId, false);
  assert.equal(capture.sse.lastEventIdHonored, false);
  assert.equal(capture.sse.reconnectObservedNewEvent, true);
  assert.equal(capture.servicesTerminated, true);
  assert.equal(capture.workspaceDisposed, true);
});
