import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { inspectArchitecture } from "./check-architecture.js";

const fixture = (name: string) =>
  resolve("tooling/fixtures/architecture", name);

describe("architecture checker fails closed", () => {
  it.each([
    ["cycle", "dependency-cycle"],
    ["forbidden-direction", "forbidden-dependency"],
    ["browser-node", "browser-node-import"],
    ["sync-authority", "sync-authority-import"],
    ["deep-import", "deep-workspace-import"],
  ])("rejects the %s fixture", async (name, expectedCode) => {
    const violations = await inspectArchitecture(fixture(name));
    expect(violations.map(({ code }) => code)).toContain(expectedCode);
  });

  it("rejects filesystem access from presentation sync", async () => {
    const violations = await inspectArchitecture(fixture("sync-authority"));
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "sync-authority-import",
          message: expect.stringContaining("fs"),
        }),
      ]),
    );
  });

  it("accepts the real Phase 1 graph", async () => {
    await expect(inspectArchitecture(resolve("."))).resolves.toEqual([]);
  });
});
