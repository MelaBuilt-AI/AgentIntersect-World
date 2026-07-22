import assert from "node:assert/strict";
import test from "node:test";

import { greeting } from "../src/greeting.mjs";

if (process.env.AIW_PHASE14_TEST_MODE === "output") {
  process.stdout.write("o".repeat(128 * 1024));
  process.stderr.write("e".repeat(128 * 1024));
}

test("exports the approved Phase 14 greeting", async () => {
  if (process.env.AIW_PHASE14_TEST_MODE === "fail") {
    assert.fail("intentional Phase 14 failure");
  }
  if (process.env.AIW_PHASE14_TEST_MODE === "hang") {
    await new Promise(() => undefined);
  }
  assert.equal(greeting, "Hello from the approved Phase 14 edit.");
});
