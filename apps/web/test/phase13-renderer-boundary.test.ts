import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Phase 13 semantic-first renderer boundary", () => {
  it("keeps Three/R3F canvases out of the renderer core entry and exposes lazy subpaths", async () => {
    const manifest = JSON.parse(
      await readFile(resolve("packages/renderer-r3f/package.json"), "utf8"),
    ) as { exports: Record<string, unknown> };
    const entry = await readFile(
      resolve("packages/renderer-r3f/src/index.ts"),
      "utf8",
    );
    const repositoryPanel = await readFile(
      resolve("apps/web/src/repository/RepositoryWorldPanel.tsx"),
      "utf8",
    );
    const islandCanvas = await readFile(
      resolve("packages/renderer-r3f/src/repository-island-canvas.tsx"),
      "utf8",
    );
    expect(manifest.exports).toHaveProperty("./repository-island");
    expect(manifest.exports).toHaveProperty("./avatar-kit");
    expect(entry).not.toMatch(/repository-island-canvas|avatar-kit-canvas/);
    expect(repositoryPanel).toContain(
      'import("@agentintersect-world/renderer-r3f/repository-island")',
    );
    expect(islandCanvas).toContain("agent-world-action-marker");
    expect(repositoryPanel).toContain("agentPosition={agentPosition}");
  });
});
