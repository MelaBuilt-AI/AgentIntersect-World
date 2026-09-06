import { describe, expect, it } from "vitest";
import * as city from "../src/repository-city-state.js";

describe("growing code-world floor", () => {
  it("places Director objects in the expanded area instead of snapping to the old city", () => {
    const position = { x: 100, z: -90 };
    const state = city.reduceRepositoryCity(city.createRepositoryCityState(), {
      type: "manual.add",
      instanceId: "manual:outer-floor",
      assetId: "04-repository-root-hub",
      position,
    });
    expect(state.instances[0]?.position).toEqual(position);
    expect(
      city.worldFloorSize(68, 10000, state.instances, []) / 2,
    ).toBeGreaterThan(104);
  });
  it("doubles the default side length and grows without shrinking", () => {
    expect(city.REPOSITORY_CITY_FLOOR_SIZE).toBe(68);
    expect(city.worldFloorSize).toBeTypeOf("function");
    expect(city.worldFloorSize(68, 0, [], [])).toBe(68);
    const loaded = city.worldFloorSize(68, 1000, [], []);
    expect(loaded).toBeGreaterThan(68);
    const expanded = city.worldFloorSize(
      loaded,
      1000,
      [],
      [{ x: 90, z: -100, radius: 5 }],
    );
    expect(expanded / 2).toBeGreaterThanOrEqual(105);
    expect(city.worldFloorSize(expanded, 0, [], [])).toBe(expanded);
  });
  it("contains off-center repository object footprints with walking clearance", () => {
    const instance: city.RepositoryCityInstance = {
      instanceId: "manual:edge",
      assetId: "04-repository-root-hub",
      position: { x: 80, z: 10 },
      status: "idle",
      lifecycle: "idle",
      pinned: true,
      manual: true,
      linkedRepoData: null,
      sourceEvent: null,
    };
    expect(city.worldFloorSize).toBeTypeOf("function");
    expect(city.worldFloorSize(68, 1, [instance], []) / 2).toBeGreaterThan(84);
  });
});
