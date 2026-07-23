import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Phase 17 root acceptance commands", () => {
  it("publishes bounded conformance and measurement scripts", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { scripts?: Record<string, string> };
    expect(manifest.scripts?.["conformance:phase17"]).toContain(
      "phase17-contracts.test.ts",
    );
    expect(manifest.scripts?.["measure:phase17"]).toContain(
      "measure-phase17.ts",
    );
  });
});
