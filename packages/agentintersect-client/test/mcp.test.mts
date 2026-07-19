import assert from "node:assert/strict";
import test from "node:test";

import { captureMcpContract } from "../src/index.ts";

test("live MCP process handles sequential JSON-RPC with exact tools and request IDs", async () => {
  const checkout = process.env.AGENTINTERSECT_CHECKOUT;
  assert.ok(checkout, "AGENTINTERSECT_CHECKOUT is required");
  const capture = await captureMcpContract(checkout);

  assert.equal(capture.initializeId, 41);
  assert.equal(capture.protocolVersion, "2024-11-05");
  assert.equal(capture.serverName, "agentintersect-clm");
  assert.equal(capture.serverVersion, "0.1.0");
  assert.deepEqual(capture.capabilityKeys, ["tools"]);
  assert.equal(capture.hasResourcesCapability, false);
  assert.equal(capture.listId, "tools-2");
  assert.deepEqual(capture.toolNames, [
    "clm_get_current_phase",
    "clm_report_telemetry",
    "clm_request_handoff",
    "clm_get_resume_packet",
    "clm_record_evidence",
  ]);
  assert.equal(capture.failureId, 77);
  assert.equal(capture.failureCode, -32000);
  assert.equal(capture.interactionsBeforeClose, 3);
  assert.equal(capture.exitedCleanly, true);
  assert.equal(capture.workspaceDisposed, true);
});
