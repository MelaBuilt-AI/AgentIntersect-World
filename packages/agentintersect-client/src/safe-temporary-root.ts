import fs from "node:fs/promises";
import path from "node:path";

export const FIXED_TEMPORARY_ROOT = "/tmp";

export class TemporaryRootError extends Error {
  readonly mismatch: string;

  constructor(mismatch: string, options?: ErrorOptions) {
    super(`Phase 0 temporary-root attestation failed: ${mismatch}`, options);
    this.name = "TemporaryRootError";
    this.mismatch = mismatch;
  }
}

function containsPath(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`))
  );
}

export async function attestFixedTemporaryRoot(
  checkout?: string,
): Promise<{ temporaryRoot: string; checkoutRoot?: string }> {
  let temporaryRoot: string;
  try {
    temporaryRoot = await fs.realpath(FIXED_TEMPORARY_ROOT);
  } catch (error) {
    throw new TemporaryRootError("temporary_root.unavailable", {
      cause: error,
    });
  }
  if (temporaryRoot !== FIXED_TEMPORARY_ROOT) {
    throw new TemporaryRootError("temporary_root.not_canonical");
  }

  let temporaryRootStat;
  try {
    temporaryRootStat = await fs.stat(temporaryRoot);
  } catch (error) {
    throw new TemporaryRootError("temporary_root.unavailable", {
      cause: error,
    });
  }
  if (!temporaryRootStat.isDirectory()) {
    throw new TemporaryRootError("temporary_root.not_directory");
  }
  if (checkout === undefined) return { temporaryRoot };

  let checkoutRoot: string;
  try {
    checkoutRoot = await fs.realpath(checkout);
  } catch (error) {
    throw new TemporaryRootError("checkout.unavailable", { cause: error });
  }
  if (
    containsPath(temporaryRoot, checkoutRoot) ||
    containsPath(checkoutRoot, temporaryRoot)
  ) {
    throw new TemporaryRootError("temporary_root.checkout_overlap");
  }
  return { temporaryRoot, checkoutRoot };
}

export function safeTemporaryEnvironment(
  temporaryRoot: string,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TMPDIR: temporaryRoot,
    TMP: temporaryRoot,
    TEMP: temporaryRoot,
  };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

export async function createSafeTemporaryWorkspace(
  checkout: string,
  prefix: string,
): Promise<{ temporaryRoot: string; workspace: string }> {
  const { temporaryRoot } = await attestFixedTemporaryRoot(checkout);
  const created = await fs.mkdtemp(path.join(temporaryRoot, prefix));
  let workspace: string;
  try {
    workspace = await fs.realpath(created);
    if (
      !containsPath(temporaryRoot, workspace) ||
      workspace === temporaryRoot
    ) {
      throw new TemporaryRootError("workspace.outside_temporary_root");
    }
  } catch (error) {
    await fs.rm(created, { recursive: true, force: true });
    throw error;
  }
  return { temporaryRoot, workspace };
}
