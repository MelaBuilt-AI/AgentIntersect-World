import { describe, expect, it } from "vitest";

import { recoverActiveOrRecent } from "../src/panels/operation-recovery.js";

describe("transient panel operation recovery", () => {
  const completed = { id: "newest", status: "succeeded" };
  const running = { id: "active", status: "running" };
  const previous = { id: "previous", status: "cancelled" };

  it("prefers an active operation even when a newer record exists", () => {
    expect(recoverActiveOrRecent([completed, running, previous])).toBe(running);
  });

  it("falls back deterministically to the newest recent record", () => {
    expect(recoverActiveOrRecent([completed, previous])).toBe(completed);
    expect(recoverActiveOrRecent([])).toBeNull();
  });
});
