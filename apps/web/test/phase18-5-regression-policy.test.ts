import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  repositoryProjectionLimit,
  supportedRepositoryProjection,
} from "../src/repository/repository-render-policy.js";
import { compactAvatarPreviewUses3d } from "../src/avatar/avatar-preview-policy.js";

describe("Phase 18.5 full-gate regression policies", () => {
  it("bounds a requested graph lane before its query resolves", () => {
    expect(repositoryProjectionLimit(false, false)).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(repositoryProjectionLimit(true, false)).toBe(2_000);
    expect(repositoryProjectionLimit(true, true)).toBe(160);
    const panelSource = readFileSync(
      new URL("../src/repository/RepositoryWorldPanel.tsx", import.meta.url),
      "utf8",
    );
    expect(panelSource).toMatch(
      /repositoryProjectionLimit\(graphRequested, fallbackReason !== null\)/u,
    );
  });

  it("collects only supported repository objects up to the projection limit", () => {
    const objects = [
      { ref: "repo", kind: "repository" },
      { ref: "pkg", kind: "package" },
      { ref: "symbol", kind: "symbol" },
      { ref: "dir", kind: "directory" },
      { ref: "file", kind: "file" },
    ] as const;
    expect(
      supportedRepositoryProjection(objects, 2).map(({ ref }) => ref),
    ).toEqual(["pkg", "dir"]);
    expect(
      supportedRepositoryProjection(objects, Number.POSITIVE_INFINITY).map(
        ({ ref }) => ref,
      ),
    ).toEqual(["pkg", "dir", "file"]);
  });

  it("keeps compact dashboard avatars static instead of mounting optional WebGL", () => {
    expect(compactAvatarPreviewUses3d(false)).toBe(true);
    expect(compactAvatarPreviewUses3d(true)).toBe(false);
  });
});
