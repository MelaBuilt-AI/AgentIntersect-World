import { describe, expect, it } from "vitest";

import { extractAdapterRepositoryLocator } from "../src/repository-work-focus.js";

describe("Phase 19 Task 12 structured adapter locators", () => {
  it.each([
    [
      "codex",
      "file_change",
      { changes: [{ path: "src/a.ts" }, { path: "src/b.ts" }] },
      ["src/a.ts", "src/b.ts"],
    ],
    ["claude-code", "Edit", { file_path: "src/a.ts" }, ["src/a.ts"]],
    ["hermes", "read_file", { path: "src/a.ts" }, ["src/a.ts"]],
    ["openclaw", "write_file", { file_path: "src/a.ts" }, ["src/a.ts"]],
  ] as const)(
    "extracts only the %s allowlist",
    (adapterId, toolName, args, paths) => {
      expect(
        extractAdapterRepositoryLocator(adapterId, toolName, args),
      ).toMatchObject({ paths });
    },
  );

  it.each([
    ["codex", "command_execution", { command: "sed -n 1p src/a.ts" }],
    ["claude-code", "Bash", { command: "cat src/a.ts" }],
    ["hermes", "unknown_tool", { path: "src/a.ts" }],
    ["openclaw", "web_search", { query: "src/a.ts" }],
    ["hermes", "read_file", { nested: { path: "src/a.ts" } }],
  ] as const)(
    "refuses non-authoritative %s payloads",
    (adapterId, toolName, args) => {
      expect(
        extractAdapterRepositoryLocator(adapterId, toolName, args),
      ).toBeUndefined();
    },
  );

  it("bounds paths without retaining other arguments", () => {
    const locator = extractAdapterRepositoryLocator("claude-code", "Write", {
      file_path: "src/a.ts",
      content: "SECRET_PROVIDER_ARGUMENT",
    });
    expect(locator).toEqual({ operation: "edit", paths: ["src/a.ts"] });
    expect(JSON.stringify(locator)).not.toContain("SECRET_PROVIDER_ARGUMENT");
    expect(
      extractAdapterRepositoryLocator("claude-code", "Write", {
        file_path: "x".repeat(4_097),
      }),
    ).toBeUndefined();
  });
});
