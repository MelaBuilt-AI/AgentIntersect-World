import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeEvidence } from "../src/index.ts";

test("evidence sanitization deterministically removes paths, PIDs, and secrets", () => {
  const value = {
    checkout: "/home/operator/AgentIntersect",
    workspace: "/tmp/aiw-contract-abcd/workspace",
    pid: 42424,
    children: { pids: [42424, 42425] },
    apiToken: "live-secret-value",
    message: "Bearer live-secret-value at /proc/42424/stat",
    stable: "agentintersect-daemon/v1",
  };
  const first = sanitizeEvidence(value, {
    homePaths: ["/home/operator/AgentIntersect"],
    tempPaths: ["/tmp/aiw-contract-abcd"],
    livePids: [42424, 42425],
  });
  const second = sanitizeEvidence(value, {
    homePaths: ["/home/operator/AgentIntersect"],
    tempPaths: ["/tmp/aiw-contract-abcd"],
    livePids: [42424, 42425],
  });

  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    checkout: "<CHECKOUT>",
    workspace: "<TEMP>/workspace",
    pid: "<PID>",
    children: { pids: ["<PID>", "<PID>"] },
    apiToken: "<REDACTED>",
    message: "Bearer <REDACTED> at /proc/<PID>/stat",
    stable: "agentintersect-daemon/v1",
  });
});
