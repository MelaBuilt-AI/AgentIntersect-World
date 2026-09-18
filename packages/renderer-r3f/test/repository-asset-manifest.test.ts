import { describe, expect, it } from "vitest";

import {
  REPOSITORY_ASSET_CATEGORIES,
  REPOSITORY_ASSET_MANIFEST,
  REPOSITORY_STATUS_PRESENTATION,
} from "../src/repository-asset-manifest.js";

describe("repository asset manifest", () => {
  it("defines exactly 26 stable, paired assets", () => {
    expect(REPOSITORY_ASSET_MANIFEST).toHaveLength(26);
    expect(new Set(REPOSITORY_ASSET_MANIFEST.map(({ id }) => id)).size).toBe(
      26,
    );
    expect(
      new Set(REPOSITORY_ASSET_MANIFEST.map(({ glbUrl }) => glbUrl)).size,
    ).toBe(26);
    expect(
      new Set(REPOSITORY_ASSET_MANIFEST.map(({ thumbnailUrl }) => thumbnailUrl))
        .size,
    ).toBe(26);

    for (const asset of REPOSITORY_ASSET_MANIFEST) {
      expect(asset.glbUrl).toBe(`/assets/repository-city/${asset.id}.glb`);
      expect(asset.thumbnailUrl).toBe(
        `/assets/repository-city/${asset.id}.png`,
      );
      expect(asset.sourceHashes.glb).toMatch(/^[a-f0-9]{64}$/u);
      expect(asset.sourceHashes.png).toMatch(/^[a-f0-9]{64}$/u);
      expect(REPOSITORY_ASSET_CATEGORIES).toContain(asset.category);
      expect(asset.meaning.length).toBeGreaterThan(12);
      expect(asset.inspectorCopy.length).toBeGreaterThan(12);
      expect(asset.eventTypes.length).toBeGreaterThan(0);
      expect(asset.effects).toEqual(
        expect.objectContaining({
          materialize: "avatar-code-assembly",
          idle: "terminal-rain",
          reducedMotion: "static-rain-semantic-marker",
        }),
      );
    }
  });

  it("maps every event type once and exposes non-color status semantics", () => {
    const events = REPOSITORY_ASSET_MANIFEST.flatMap(
      ({ eventTypes }) => eventTypes,
    );
    expect(new Set(events).size).toBe(events.length);
    expect(events).toEqual(
      expect.arrayContaining([
        "repository.loaded",
        "directory.discovered",
        "file.updated",
        "test.failed",
        "pull-request.merged",
        "deployment.completed",
      ]),
    );
    expect(REPOSITORY_STATUS_PRESENTATION).toEqual({
      idle: {
        color: "#8aa0ad",
        label: "Idle / source material",
        marker: "○",
      },
      active: { color: "#41e9ff", label: "Active / success", marker: "✓" },
      pending: { color: "#ffbf47", label: "Pending", marker: "…" },
      failure: { color: "#ff4d63", label: "Failure", marker: "!" },
      special: { color: "#b76cff", label: "Merge / deploy", marker: "◆" },
    });
  });
});
