import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { build } from "vite";

type ManifestChunk = {
  readonly dynamicImports?: readonly string[];
  readonly file: string;
  readonly imports?: readonly string[];
  readonly isEntry?: boolean;
};

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

describe("production startup chunk boundaries", () => {
  it("keeps the renderer and presentation provider behind independent chunks", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "aiw-web-chunks-"));
    temporaryRoots.push(outputRoot);
    const webRoot = resolve("apps/web");

    await build({
      root: webRoot,
      configFile: resolve(webRoot, "vite.config.ts"),
      logLevel: "error",
      build: {
        emptyOutDir: true,
        manifest: true,
        outDir: outputRoot,
      },
    });

    const manifest = JSON.parse(
      await readFile(join(outputRoot, ".vite/manifest.json"), "utf8"),
    ) as Record<string, ManifestChunk>;
    const entry = Object.values(manifest).find((chunk) => chunk.isEntry);

    expect(entry).toBeDefined();
    expect(entry?.dynamicImports).toEqual(
      expect.arrayContaining([
        "src/presentation/PresentationPanelLoader.tsx",
        "src/repository/RepositoryWorldPanel.tsx",
      ]),
    );
    expect(manifest).toHaveProperty(
      "src/presentation/PresentationPanelLoader.tsx",
    );
    expect(manifest).toHaveProperty("src/repository/RepositoryWorldPanel.tsx");
  });
});
