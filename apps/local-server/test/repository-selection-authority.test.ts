import { describe, expect, it } from "vitest";

import { matchesSelectedRepository } from "../src/repository-selection-authority.js";

describe("repository selection World-action authority", () => {
  it("keeps a dynamic current session authorized for the selected concrete repository", () => {
    const selected = "aiw://object/0123456789abcdef0123456789abcdef";

    expect(matchesSelectedRepository("current", selected)).toBe(true);
    expect(matchesSelectedRepository(selected, selected)).toBe(true);
    expect(
      matchesSelectedRepository(
        "aiw://object/fedcba9876543210fedcba9876543210",
        selected,
      ),
    ).toBe(false);
  });
});
