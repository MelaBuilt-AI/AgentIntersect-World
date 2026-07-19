import { describe, expect, it } from "vitest";

import {
  createRepositoryBrowserModel,
  moveSelection,
  safeObjectPath,
  searchRepositoryObjects,
} from "../src/repository/repository-browser-model.js";

const objects = [
  {
    ref: "aiw://object/00000000000000000000000000000001",
    kind: "repository" as const,
    name: "fixture-repository",
    parentRef: null,
    childRefs: ["aiw://object/00000000000000000000000000000002"],
  },
  {
    ref: "aiw://object/00000000000000000000000000000002",
    kind: "file" as const,
    name: "mystery.xyzzy",
    path: "src/mystery.xyzzy",
    language: null,
    fileKind: "text" as const,
    parentRef: "aiw://object/00000000000000000000000000000001",
    childRefs: [],
  },
] as const;

describe("shared semantic repository browser model", () => {
  it("keeps unsupported-language files searchable and selectable", () => {
    const model = createRepositoryBrowserModel(objects);
    expect(
      searchRepositoryObjects(model, "xyzzy").map((item) => item.ref),
    ).toEqual([objects[1].ref]);
    expect(moveSelection(model, objects[0].ref, "next")).toBe(objects[1].ref);
    expect(model.byRef.get(objects[1].ref)?.language).toBeNull();
  });

  it.each([
    "/home/operator/private/file.ts",
    "C:\\Users\\operator\\private\\file.ts",
    "\\home\\operator\\private\\file.ts",
    "\\\\server\\share\\private\\repo\\file.ts",
    "\\\\?\\C:\\private\\file.ts",
    "\\\\.\\PhysicalDrive0",
    "file:///home/operator/private/file.ts",
    "FiLe://server/share/private/file.ts",
  ])("redacts absolute object path %s", (path) => {
    expect(safeObjectPath({ ...objects[1], path })).toBeNull();
  });

  it("normalizes useful relative paths", () => {
    expect(
      safeObjectPath({ ...objects[1], path: "src\\nested\\mystery.xyzzy" }),
    ).toBe("src/nested/mystery.xyzzy");
  });
});
