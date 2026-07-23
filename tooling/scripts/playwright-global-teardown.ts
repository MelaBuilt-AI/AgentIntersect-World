import { lstat, rm } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, resolve } from "node:path";

const MANAGED_ROOT = /^aiw-phase17-playwright-\d+(?:-[a-z0-9-]+)?$/u;

export async function cleanupPhase17PlaywrightRoot(
  root: string,
): Promise<void> {
  const resolvedRoot = resolve(root);
  const safeTemporaryRoot = realpathSync(tmpdir());
  if (
    !isAbsolute(root) ||
    resolvedRoot !== root ||
    dirname(resolvedRoot) !== safeTemporaryRoot ||
    !MANAGED_ROOT.test(basename(resolvedRoot))
  ) {
    throw new Error("Refusing unsafe Phase 17 Playwright cleanup root");
  }
  const stat = await lstat(resolvedRoot).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return undefined;
    throw error;
  });
  if (!stat) return;
  if (stat.isSymbolicLink())
    throw new Error("Refusing symlink Phase 17 Playwright cleanup root");
  await rm(resolvedRoot, { recursive: true, force: true, maxRetries: 3 });
}

export default async function globalTeardown(): Promise<void> {
  const root = process.env.AIW_PHASE17_PLAYWRIGHT_CLEANUP_ROOT;
  if (root) await cleanupPhase17PlaywrightRoot(root);
}
