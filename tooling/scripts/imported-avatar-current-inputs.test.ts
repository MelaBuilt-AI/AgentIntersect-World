import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  CURRENT_IMPORTED_AVATAR_INPUTS,
  verifyCurrentImportedAvatarInputs,
  verifyImportedManifestAssets,
} from "./imported-avatar-current-inputs.js";

const temporaryRoots: string[] = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true });
});

const sha256 = (value: Buffer | string) =>
  createHash("sha256").update(value).digest("hex");

const expectedInputs = [
  "apps/web/e2e/helpers.ts",
  "apps/web/e2e/world-entry-single-agent.spec.ts",
  "apps/web/package.json",
  "apps/web/src/styles.css",
  "apps/web/src/world-entry/WorldRoom.tsx",
  "apps/web/src/world-entry/world-agent-movement-model.ts",
  "apps/web/src/world-entry/world-imported-avatar.ts",
  "apps/web/src/world-entry/world-navigation-model.ts",
  "apps/web/vite.config.ts",
  "package.json",
  "packages/avatar-system/src/imported-avatar-registry.generated.ts",
  "packages/avatar-system/src/imported-avatar.ts",
  "packages/avatar-system/src/index.ts",
  "packages/renderer-r3f/src/imported-avatar-animation.ts",
  "packages/renderer-r3f/src/imported-avatar-canvas.tsx",
  "packages/renderer-r3f/src/index.ts",
  "packages/renderer-r3f/src/repository-visual-kit.ts",
  "packages/renderer-r3f/src/world-room-canvas.tsx",
  "packages/renderer-r3f/src/world-room-imported-canvas.tsx",
  "pnpm-lock.yaml",
] as const;

describe("current imported-avatar acceptance input contract", () => {
  it("declares the complete bounded source surface without historical evidence", () => {
    expect(
      CURRENT_IMPORTED_AVATAR_INPUTS.map(({ path }) => path).sort(),
    ).toEqual([...expectedInputs].sort());
    expect(CURRENT_IMPORTED_AVATAR_INPUTS.map(({ role }) => role)).toEqual(
      expect.arrayContaining([
        "world-orchestrator",
        "compatibility-world-canvas",
        "imported-world-canvas",
        "imported-preview-renderer",
        "imported-animation",
        "base-profile",
        "imported-profile",
        "imported-registry",
        "repository-projection",
        "repository-visual-kit",
        "movement-composition",
        "camera-composition",
        "world-styles",
        "build-identity",
        "browser-journey",
        "browser-fixture",
      ]),
    );
    expect(
      CURRENT_IMPORTED_AVATAR_INPUTS.some(({ path }) =>
        path.startsWith("artifacts/phase18-5/"),
      ),
    ).toBe(false);
  });

  it("verifies all 23 manifest-bound GLBs before emitting deterministic fingerprints", () => {
    const first = verifyCurrentImportedAvatarInputs(resolve("."));
    const second = verifyCurrentImportedAvatarInputs(resolve("."));
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      schema: "aiw.imported-avatar.current-inputs/1",
      acceptanceTrack: "current-imported-avatar",
      historicalPhase18_5NativeEvidence: "not-read-not-current",
      manifest: {
        path: "apps/web/public/assets/imported-avatars/manifest.json",
        assetCount: 23,
        verifiedAssetCount: 23,
      },
    });
    expect(first.glbs).toHaveLength(23);
    expect(first.inputs).toHaveLength(expectedInputs.length + 1);
    expect(first.inputSetSha256).toMatch(/^[a-f0-9]{64}$/u);
    for (const glb of first.glbs) {
      expect(glb.path).toMatch(
        /^apps\/web\/public\/assets\/imported-avatars\/[a-z0-9-]+\.glb$/u,
      );
      expect(glb.byteSize).toBeGreaterThan(0);
      expect(glb.sha256).toMatch(/^[a-f0-9]{64}$/u);
    }
  });

  it("fails closed on missing files, hash drift, and incomplete membership", () => {
    const root = mkdtempSync(join(tmpdir(), "aiw-current-inputs-"));
    temporaryRoots.push(root);
    const assetDirectory = join(
      root,
      "apps/web/public/assets/imported-avatars",
    );
    mkdirSync(assetDirectory, { recursive: true });
    const assets = Array.from({ length: 23 }, (_, index) => {
      const id = `fixture-${String(index).padStart(2, "0")}`;
      const bytes = Buffer.from(`glb-${id}`);
      writeFileSync(join(assetDirectory, `${id}.glb`), bytes);
      return {
        id,
        sha256: sha256(bytes),
        byteSize: bytes.byteLength,
        registry: { assetUrl: `/assets/imported-avatars/${id}.glb` },
      };
    });

    expect(verifyImportedManifestAssets({ assets }, root)).toHaveLength(23);

    writeFileSync(
      join(assetDirectory, "fixture-00.glb"),
      Buffer.alloc(assets[0]?.byteSize ?? 1, "x"),
    );
    expect(() => verifyImportedManifestAssets({ assets }, root)).toThrow(
      /manifest hash drift/u,
    );
    writeFileSync(
      join(assetDirectory, "fixture-00.glb"),
      readFileSync(join(assetDirectory, "fixture-01.glb")),
    );
    rmSync(join(assetDirectory, "fixture-22.glb"));
    expect(() => verifyImportedManifestAssets({ assets }, root)).toThrow(
      /missing imported GLB/u,
    );
    writeFileSync(join(assetDirectory, "unlisted.glb"), "extra");
    expect(() =>
      verifyImportedManifestAssets({ assets: assets.slice(0, 22) }, root),
    ).toThrow(/exactly 23 assets|membership/u);
  });
});
