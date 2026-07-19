import assert from "node:assert/strict";
import test from "node:test";

import { scanCommittedEvidence } from "../src/index.ts";

test("every committed Phase 0 fixture, report, and transcript is sanitized", async () => {
  const scan = await scanCommittedEvidence(process.cwd());
  assert.ok(scan.files.length >= 3, "expected fixture, report, and transcript");
  assert.deepEqual(scan.violations, []);
});
