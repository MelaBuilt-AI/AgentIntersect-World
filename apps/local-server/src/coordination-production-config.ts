import { lstat, realpath } from "node:fs/promises";
import { isAbsolute } from "node:path";

export const PHASE16_REPOSITORY_ROOT_ENV =
  "AIW_PHASE16_REPOSITORY_ROOT" as const;
export const PHASE16_WORKTREE_PARENT_ENV =
  "AIW_PHASE16_WORKTREE_PARENT" as const;

export type ProductionCoordinationGitConfig = {
  readonly approvedRepositoryRoot: string;
  readonly allowedWorktreeParent: string;
};

async function canonicalDirectory(
  value: string,
  label: string,
): Promise<string> {
  if (!isAbsolute(value)) throw new Error(`${label} must be an absolute path`);
  const information = await lstat(value);
  if (information.isSymbolicLink() || !information.isDirectory())
    throw new Error(`${label} must be a real directory`);
  return realpath(value);
}

export async function loadProductionCoordinationGitConfig(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<ProductionCoordinationGitConfig | null> {
  const repositoryRoot = environment[PHASE16_REPOSITORY_ROOT_ENV]?.trim();
  const worktreeParent = environment[PHASE16_WORKTREE_PARENT_ENV]?.trim();
  if (!repositoryRoot && !worktreeParent) return null;
  if (!repositoryRoot || !worktreeParent)
    throw new Error(
      `${PHASE16_REPOSITORY_ROOT_ENV} and ${PHASE16_WORKTREE_PARENT_ENV} must be configured together`,
    );
  return {
    approvedRepositoryRoot: await canonicalDirectory(
      repositoryRoot,
      PHASE16_REPOSITORY_ROOT_ENV,
    ),
    allowedWorktreeParent: await canonicalDirectory(
      worktreeParent,
      PHASE16_WORKTREE_PARENT_ENV,
    ),
  };
}
