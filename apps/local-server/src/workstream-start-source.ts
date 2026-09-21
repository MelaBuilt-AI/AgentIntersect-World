import {
  chmod,
  lstat,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";
import { workspaceCommand } from "./repository-git.js";

type FileChange = { path: string; bytes: Buffer | null; mode: number };

/** Read paused work only. Never stage, stash, commit, or follow external links. */
export async function captureUncommittedWork(
  directory: string,
): Promise<FileChange[]> {
  const git = (args: string[]) =>
    workspaceCommand(directory, "git", ["--no-optional-locks", ...args]);
  const names = [
    ...new Set(
      (
        (await git([
          "diff",
          "--name-only",
          "--no-renames",
          "-z",
          "HEAD",
          "--",
        ])) + (await git(["ls-files", "--others", "--exclude-standard", "-z"]))
      )
        .split("\0")
        .filter(Boolean),
    ),
  ];
  if (names.length > 256)
    throw Error(
      "Too many uncommitted files to copy. Make a local commit first.",
    );
  const root = await realpath(directory);
  const changes: FileChange[] = [];
  let size = 0;
  for (const path of names) {
    if (
      isAbsolute(path) ||
      path.split(/[\\/]/).some((part) => ["..", ".git"].includes(part))
    )
      throw Error("Unsupported path in uncommitted work. Nothing was copied.");
    const file = join(root, path);
    let info;
    try {
      info = await lstat(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (!info || info.isDirectory()) {
      changes.push({ path, bytes: null, mode: 0 });
      continue;
    }
    const resolved = relative(root, await realpath(file));
    if (
      info.isSymbolicLink() ||
      !info.isFile() ||
      resolved.startsWith("..") ||
      isAbsolute(resolved)
    )
      throw Error(
        "Uncommitted links or special files cannot be copied. Make a local commit first.",
      );
    size += info.size;
    if (size > 64 * 1024 * 1024)
      throw Error(
        "Uncommitted changes exceed 64 MiB. Make a local commit first.",
      );
    changes.push({
      path,
      bytes: await readFile(file),
      mode: info.mode & 0o777,
    });
  }
  return changes;
}

/** Apply only to a newly allocated owned worktree before native dispatch. */
export async function applyUncommittedWork(
  directory: string,
  changes: FileChange[],
): Promise<void> {
  const root = await realpath(directory);
  // Validate parents before either deletions or writes, not after following a link.
  for (const change of changes) {
    let parent = dirname(join(directory, change.path));
    while (parent !== directory) {
      try {
        if ((await lstat(parent)).isSymbolicLink())
          throw Error("Cannot copy changes through a linked directory.");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      parent = dirname(parent);
    }
  }
  for (const change of [...changes].sort(
    (a, b) => b.path.length - a.path.length,
  ))
    await rm(join(directory, change.path), { recursive: true, force: true });
  for (const change of changes) {
    if (change.bytes === null) continue;
    const file = join(directory, change.path);
    await mkdir(dirname(file), { recursive: true });
    const resolved = relative(root, await realpath(dirname(file)));
    if (resolved.startsWith("..") || isAbsolute(resolved))
      throw Error("Copy destination is outside the new worktree.");
    await writeFile(file, change.bytes);
    await chmod(file, change.mode);
  }
}
