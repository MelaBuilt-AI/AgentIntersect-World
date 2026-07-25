import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
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

    const priorNodeEnv = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "production";
    await build({
      root: webRoot,
      mode: "production",
      configFile: resolve(webRoot, "vite.config.ts"),
      logLevel: "error",
      build: {
        emptyOutDir: true,
        manifest: true,
        minify: "esbuild",
        outDir: outputRoot,
      },
    });
    if (priorNodeEnv === undefined) delete process.env["NODE_ENV"];
    else process.env["NODE_ENV"] = priorNodeEnv;

    const manifest = JSON.parse(
      await readFile(join(outputRoot, ".vite/manifest.json"), "utf8"),
    ) as Record<string, ManifestChunk>;
    const entry = Object.values(manifest).find((chunk) => chunk.isEntry);

    expect(entry).toBeDefined();
    expect(entry?.dynamicImports).toEqual(
      expect.arrayContaining([
        "src/avatar/AvatarScene.tsx",
        "src/shell/DashboardShell.tsx",
      ]),
    );
    expect(entry?.dynamicImports).not.toContain(
      "src/presentation/PresentationPanelLoader.tsx",
    );
    expect(entry?.dynamicImports).not.toContain(
      "src/repository/RepositoryWorldPanel.tsx",
    );
    expect(manifest["src/shell/DashboardShell.tsx"]?.dynamicImports).toEqual(
      expect.arrayContaining([
        "src/presentation/PresentationPanelLoader.tsx",
        "src/repository/RepositoryWorldPanel.tsx",
      ]),
    );
    expect(manifest).toHaveProperty(
      "src/presentation/PresentationPanelLoader.tsx",
    );
    expect(manifest).toHaveProperty("src/repository/RepositoryWorldPanel.tsx");
    expect(manifest).toHaveProperty("src/avatar/AvatarScene.tsx");
    expect(manifest["src/avatar/AvatarScene.tsx"]?.imports ?? []).not.toContain(
      "src/repository/RepositoryWorldPanel.tsx",
    );
    const entryBytes = (await stat(join(outputRoot, entry!.file))).size;
    const avatarBytes = (
      await stat(join(outputRoot, manifest["src/avatar/AvatarScene.tsx"]!.file))
    ).size;
    expect(entryBytes).toBeLessThanOrEqual(400 * 1024);
    expect(avatarBytes).toBeLessThanOrEqual(500 * 1024);

    const avatarRenderer = await readFile(
      resolve("packages/renderer-r3f/src/avatar-kit-canvas.tsx"),
      "utf8",
    );
    expect(avatarRenderer).toContain("SkeletonUtils.clone");
    expect(avatarRenderer).not.toContain("source.clone(true)");
  });
});
