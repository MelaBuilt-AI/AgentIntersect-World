import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const CURRENT_IMPORTED_AVATAR_CONTRACT_SCHEMA =
  "aiw.imported-avatar.current-inputs/1" as const;
export const IMPORTED_AVATAR_MANIFEST_PATH =
  "apps/web/public/assets/imported-avatars/manifest.json" as const;
const IMPORTED_AVATAR_DIRECTORY =
  "apps/web/public/assets/imported-avatars" as const;
const EXPECTED_IMPORTED_GLB_COUNT = 23;

export const CURRENT_IMPORTED_AVATAR_INPUTS = [
  {
    path: "apps/web/src/world-entry/WorldRoom.tsx",
    role: "world-orchestrator",
  },
  {
    path: "packages/renderer-r3f/src/world-room-canvas.tsx",
    role: "compatibility-world-canvas",
  },
  {
    path: "packages/renderer-r3f/src/world-room-imported-canvas.tsx",
    role: "imported-world-canvas",
  },
  {
    path: "packages/renderer-r3f/src/imported-avatar-canvas.tsx",
    role: "imported-preview-renderer",
  },
  {
    path: "packages/renderer-r3f/src/imported-avatar-animation.ts",
    role: "imported-animation",
  },
  { path: "packages/avatar-system/src/index.ts", role: "base-profile" },
  {
    path: "packages/avatar-system/src/imported-avatar.ts",
    role: "imported-profile",
  },
  {
    path: "packages/avatar-system/src/imported-avatar-registry.generated.ts",
    role: "imported-registry",
  },
  {
    path: "apps/web/src/world-entry/world-imported-avatar.ts",
    role: "imported-world-selection",
  },
  { path: "packages/renderer-r3f/src/index.ts", role: "repository-projection" },
  {
    path: "packages/renderer-r3f/src/repository-visual-kit.ts",
    role: "repository-visual-kit",
  },
  {
    path: "apps/web/src/world-entry/world-agent-movement-model.ts",
    role: "movement-composition",
  },
  {
    path: "apps/web/src/world-entry/world-navigation-model.ts",
    role: "camera-composition",
  },
  { path: "apps/web/src/styles.css", role: "world-styles" },
  { path: "package.json", role: "build-identity" },
  { path: "pnpm-lock.yaml", role: "build-identity" },
  { path: "apps/web/package.json", role: "build-identity" },
  { path: "apps/web/vite.config.ts", role: "build-identity" },
  {
    path: "apps/web/e2e/world-entry-single-agent.spec.ts",
    role: "browser-journey",
  },
  { path: "apps/web/e2e/helpers.ts", role: "browser-fixture" },
] as const;

type ManifestAsset = {
  readonly id: string;
  readonly sha256: string;
  readonly byteSize: number;
  readonly registry: { readonly assetUrl: string };
};

type ManifestLike = {
  readonly schema?: unknown;
  readonly authority?: unknown;
  readonly assets?: unknown;
};

export type CurrentInputFingerprint = {
  readonly path: string;
  readonly role: string;
  readonly byteSize: number;
  readonly sha256: string;
};

export type VerifiedImportedGlb = {
  readonly id: string;
  readonly path: string;
  readonly byteSize: number;
  readonly sha256: string;
};

export type CurrentImportedAvatarInputs = {
  readonly schema: typeof CURRENT_IMPORTED_AVATAR_CONTRACT_SCHEMA;
  readonly acceptanceTrack: "current-imported-avatar";
  readonly historicalPhase18_5NativeEvidence: "not-read-not-current";
  readonly manifest: {
    readonly path: typeof IMPORTED_AVATAR_MANIFEST_PATH;
    readonly assetCount: 23;
    readonly verifiedAssetCount: 23;
    readonly sha256: string;
  };
  readonly inputs: readonly CurrentInputFingerprint[];
  readonly glbs: readonly VerifiedImportedGlb[];
  readonly inputSetSha256: string;
};

const sha256Bytes = (bytes: Buffer | string): string =>
  createHash("sha256").update(bytes).digest("hex");

const sha256File = (path: string): string => sha256Bytes(readFileSync(path));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const manifestFailure = (message: string): never => {
  throw new Error(
    `Current imported-avatar manifest verification failed: ${message}`,
  );
};

function parseManifestAssets(manifest: ManifestLike): readonly ManifestAsset[] {
  if (!Array.isArray(manifest.assets))
    return manifestFailure("manifest assets are missing");
  if (manifest.assets.length !== EXPECTED_IMPORTED_GLB_COUNT)
    return manifestFailure("manifest must declare exactly 23 assets");

  const ids = new Set<string>();
  const paths = new Set<string>();
  return manifest.assets.map((value, index) => {
    if (!isRecord(value) || !isRecord(value.registry))
      return manifestFailure(`asset ${index} is malformed`);
    const { id, sha256, byteSize } = value;
    const assetUrl = value.registry.assetUrl;
    if (
      typeof id !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id) ||
      ids.has(id)
    )
      return manifestFailure(`asset ${index} has an invalid or duplicate id`);
    if (
      typeof assetUrl !== "string" ||
      assetUrl !== `/assets/imported-avatars/${id}.glb` ||
      basename(assetUrl) !== `${id}.glb` ||
      paths.has(assetUrl)
    )
      return manifestFailure(
        `asset ${id} has an invalid or duplicate GLB path`,
      );
    if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(sha256))
      return manifestFailure(`asset ${id} has an invalid SHA-256`);
    if (!Number.isSafeInteger(byteSize) || (byteSize as number) <= 0)
      return manifestFailure(`asset ${id} has an invalid byte size`);
    ids.add(id);
    paths.add(assetUrl);
    return {
      id,
      sha256,
      byteSize: byteSize as number,
      registry: { assetUrl },
    };
  });
}

export function verifyImportedManifestAssets(
  manifest: ManifestLike,
  workspaceRoot = process.cwd(),
): readonly VerifiedImportedGlb[] {
  const assets = parseManifestAssets(manifest);
  const assetDirectory = resolve(workspaceRoot, IMPORTED_AVATAR_DIRECTORY);
  if (!existsSync(assetDirectory))
    return manifestFailure("imported GLB directory is missing");

  const expectedFiles = assets.map(({ id }) => `${id}.glb`).sort();
  for (const file of expectedFiles) {
    if (!existsSync(resolve(assetDirectory, file)))
      return manifestFailure(`missing imported GLB: ${file}`);
  }
  const shippedFiles = readdirSync(assetDirectory)
    .filter((path) => path.endsWith(".glb"))
    .sort();
  if (
    shippedFiles.length !== EXPECTED_IMPORTED_GLB_COUNT ||
    shippedFiles.some((path, index) => path !== expectedFiles[index])
  )
    return manifestFailure(
      "manifest/shipped GLB membership is incomplete or differs",
    );

  return assets
    .map((asset) => {
      const relativePath = `${IMPORTED_AVATAR_DIRECTORY}/${asset.id}.glb`;
      const absolutePath = resolve(workspaceRoot, relativePath);
      const actualByteSize = statSync(absolutePath).size;
      if (actualByteSize !== asset.byteSize)
        return manifestFailure(`manifest byte-size drift: ${relativePath}`);
      const actualSha256 = sha256File(absolutePath);
      if (actualSha256 !== asset.sha256)
        return manifestFailure(`manifest hash drift: ${relativePath}`);
      return {
        id: asset.id,
        path: relativePath,
        byteSize: actualByteSize,
        sha256: actualSha256,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

const fingerprintInput = (
  workspaceRoot: string,
  path: string,
  role: string,
): CurrentInputFingerprint => {
  if (path.startsWith("artifacts/phase18-5/"))
    throw new Error(`Historical/current contract confusion: ${path}`);
  const absolutePath = resolve(workspaceRoot, path);
  if (!existsSync(absolutePath))
    throw new Error(`Current input is missing: ${path}`);
  return {
    path,
    role,
    byteSize: statSync(absolutePath).size,
    sha256: sha256File(absolutePath),
  };
};

export function verifyCurrentImportedAvatarInputs(
  workspaceRoot = process.cwd(),
): CurrentImportedAvatarInputs {
  const manifestAbsolutePath = resolve(
    workspaceRoot,
    IMPORTED_AVATAR_MANIFEST_PATH,
  );
  if (!existsSync(manifestAbsolutePath))
    throw new Error(
      `Current input is missing: ${IMPORTED_AVATAR_MANIFEST_PATH}`,
    );
  const manifestBytes = readFileSync(manifestAbsolutePath);
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as ManifestLike;
  if (
    manifest.schema !== "aiw.replacement-avatar-assets/3" ||
    manifest.authority !== "repository-owned-replacement-avatar-registry"
  )
    return manifestFailure("schema or authority differs from current registry");

  // The manifest becomes transitive authority only after all shipped GLBs pass.
  const glbs = verifyImportedManifestAssets(manifest, workspaceRoot);
  const inputs = [
    fingerprintInput(
      workspaceRoot,
      IMPORTED_AVATAR_MANIFEST_PATH,
      "imported-manifest",
    ),
    ...CURRENT_IMPORTED_AVATAR_INPUTS.map(({ path, role }) =>
      fingerprintInput(workspaceRoot, path, role),
    ),
  ].sort((left, right) => left.path.localeCompare(right.path));
  const fingerprintAuthority = {
    schema: CURRENT_IMPORTED_AVATAR_CONTRACT_SCHEMA,
    acceptanceTrack: "current-imported-avatar",
    historicalPhase18_5NativeEvidence: "not-read-not-current",
    inputs,
    glbs,
  } as const;
  return {
    ...fingerprintAuthority,
    manifest: {
      path: IMPORTED_AVATAR_MANIFEST_PATH,
      assetCount: EXPECTED_IMPORTED_GLB_COUNT,
      verifiedAssetCount: glbs.length,
      sha256: sha256Bytes(manifestBytes),
    },
    inputSetSha256: sha256Bytes(JSON.stringify(fingerprintAuthority)),
  } as CurrentImportedAvatarInputs;
}

const invokedPath = process.argv[1];
if (
  invokedPath &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  try {
    process.stdout.write(
      `${JSON.stringify(verifyCurrentImportedAvatarInputs(), null, 2)}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
