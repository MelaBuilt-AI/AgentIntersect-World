import { describe, expect, it } from "vitest";

import {
  boundedSemanticObjects,
  prepareRepositoryInstances,
  resolveWebGLCapability,
} from "../src/index.js";

describe("repository renderer preparation", () => {
  it("prepares 10,000 deterministic transforms without DOM materialization", () => {
    const objects = Array.from({ length: 10_000 }, (_, index) => ({
      ref: `aiw://object/${index.toString(16).padStart(32, "0")}`,
      kind: "file" as const,
      name: `file-${index}.unknown`,
      position: { x: index % 100, y: 0, z: Math.floor(index / 100) },
      bounds: {
        x: index % 100,
        z: Math.floor(index / 100),
        width: 1,
        depth: 1,
      },
    }));
    const started = performance.now();
    const prepared = prepareRepositoryInstances(objects);
    const durationMs = performance.now() - started;
    expect(prepared.groups.file.count).toBe(10_000);
    expect(prepared.groups.file.matrices).toHaveLength(160_000);
    expect(durationMs).toBeLessThan(250);
    expect(boundedSemanticObjects(objects, 120)).toHaveLength(120);
  });

  it("reports disabled and creation-failure fallbacks truthfully", () => {
    expect(resolveWebGLCapability({ forceDisabled: true })).toEqual({
      available: false,
      reason: "disabled",
    });
    expect(resolveWebGLCapability({ createContext: () => null })).toEqual({
      available: false,
      reason: "creation-failed",
    });
  });
});
