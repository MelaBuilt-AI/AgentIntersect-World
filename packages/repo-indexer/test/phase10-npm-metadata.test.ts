import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { indexRepository } from "../src/index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("Phase 10 authoritative npm metadata", () => {
  it("indexes bounded name/exports/imports/main/module/types without running scripts", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase10-npm-"));
    roots.push(root);
    await mkdir(join(root, "src"));
    const sentinel = join(root, "executed");
    await writeFile(join(root, "src", "index.ts"), "export const value = 1;\n");
    await writeFile(
      join(root, "src", "feature.ts"),
      "export const feature = 1;\n",
    );
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "@fixture/core",
        exports: { ".": "./src/index.ts", "./feature": "./src/feature.ts" },
        imports: { "#feature": "./src/feature.ts" },
        main: "./src/index.ts",
        module: "./src/index.ts",
        types: "./src/index.ts",
        scripts: {
          postinstall: `node -e "require('fs').writeFileSync('${sentinel}','bad')"`,
        },
      }),
    );
    const generation = await indexRepository({ rootPath: root });
    expect(generation.packages[0]).toMatchObject({
      name: "@fixture/core",
      npmResolution: {
        exports: [
          { specifier: ".", target: "./src/index.ts" },
          { specifier: "./feature", target: "./src/feature.ts" },
        ],
        imports: [{ specifier: "#feature", target: "./src/feature.ts" }],
        main: "./src/index.ts",
        module: "./src/index.ts",
        types: "./src/index.ts",
      },
    });
    await expect(readFile(sentinel)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("normalizes safe bare fallback targets and rejects unsafe targets", async () => {
    const root = await mkdtemp(join(tmpdir(), "aiw-phase10-npm-targets-"));
    roots.push(root);
    await mkdir(join(root, "dist"));
    await writeFile(join(root, "dist", "index.js"), "export const safe = 1;\n");
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "@fixture/bare-target",
        main: "dist/index.js",
        module: "dist/index.js",
        types: "dist/index.js",
        exports: {
          ".": "dist/index.js",
          "./unsafe": "./src/../../escape.js",
          "./nul": "./src/\u0000bad.js",
          "./empty": "",
          "./oversized": `./${"a".repeat(4_100)}`,
          "./absolute": "/absolute/index.js",
          "./drive": "C:\\absolute\\index.js",
        },
      }),
    );
    const generation = await indexRepository({ rootPath: root });
    expect(generation.packages[0]?.npmResolution).toEqual({
      exports: [{ specifier: ".", target: "./dist/index.js" }],
      imports: [],
      main: "./dist/index.js",
      module: "./dist/index.js",
      types: "./dist/index.js",
    });
  });
});
