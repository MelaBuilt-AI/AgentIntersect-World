import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstat, open, readFile, readdir, realpath } from "node:fs/promises";
import { basename, dirname, extname, join, sep } from "node:path";
import { promisify } from "node:util";

import type {
  RepositoryDirectory,
  RepositoryFile,
  RepositoryGeneration,
  RepositoryGitMetadata,
  RepositoryIndexProgress,
  RepositoryPackage,
} from "@agentintersect-world/world-schema";
import createIgnore from "ignore";

export const REPO_INDEXER_CAPABILITY = "deterministic-metadata-index" as const;
export const DEFAULT_MAX_FILES = 2_500;
export const HARD_MAX_FILES = 10_000;
export const MAX_FILE_HASH_BYTES = 2 * 1024 * 1024;
export const MAX_TOTAL_HASH_BYTES = 64 * 1024 * 1024;

const execFileAsync = promisify(execFile);
const FIXED_EXCLUDED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "vendor",
  "dist",
  "build",
  "coverage",
  ".cache",
  ".turbo",
  "playwright-report",
  "test-results",
  ".playwright",
]);
const BINARY_EXTENSIONS = new Set([
  ".7z",
  ".a",
  ".avi",
  ".bin",
  ".bmp",
  ".class",
  ".dll",
  ".dylib",
  ".eot",
  ".exe",
  ".gif",
  ".gz",
  ".ico",
  ".jar",
  ".jpeg",
  ".jpg",
  ".mov",
  ".mp3",
  ".mp4",
  ".o",
  ".otf",
  ".pdf",
  ".png",
  ".so",
  ".tar",
  ".ttf",
  ".wav",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);

export function isKnownBinaryExtension(extension: string): boolean {
  return BINARY_EXTENSIONS.has(extension.toLowerCase());
}

const ASSET_EXTENSIONS = new Set([
  ".bmp",
  ".eot",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".mp3",
  ".mp4",
  ".otf",
  ".png",
  ".svg",
  ".ttf",
  ".wav",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
]);
const LANGUAGES: Readonly<Record<string, string>> = {
  ".c": "c",
  ".cc": "cpp",
  ".cpp": "cpp",
  ".cs": "csharp",
  ".css": "css",
  ".dart": "dart",
  ".ex": "elixir",
  ".exs": "elixir",
  ".fs": "fsharp",
  ".go": "go",
  ".graphql": "graphql",
  ".h": "c",
  ".hpp": "cpp",
  ".html": "html",
  ".java": "java",
  ".js": "javascript",
  ".jsx": "javascript",
  ".json": "json",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".lua": "lua",
  ".md": "markdown",
  ".mjs": "javascript",
  ".php": "php",
  ".proto": "protobuf",
  ".py": "python",
  ".rb": "ruby",
  ".rs": "rust",
  ".scss": "scss",
  ".sh": "shell",
  ".sql": "sql",
  ".swift": "swift",
  ".toml": "toml",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".vue": "vue",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".zig": "zig",
};
const PACKAGE_MANIFESTS: Readonly<Record<string, RepositoryPackage["kind"]>> = {
  "package.json": "npm",
  "pyproject.toml": "python",
  "Cargo.toml": "cargo",
  "go.mod": "go",
  "pom.xml": "maven",
};

export class RepositoryIndexError extends Error {
  override readonly name = "RepositoryIndexError";
  constructor(
    readonly code:
      "invalid_root" | "file_limit" | "cancelled" | "git_error" | "io_error",
    message: string,
  ) {
    super(message);
  }
}

export type IndexRepositoryOptions = {
  readonly rootPath: string;
  readonly maxFiles?: number;
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: RepositoryIndexProgress) => void;
};

type MutableProgress = {
  phase: RepositoryIndexProgress["phase"];
  discoveredFiles: number;
  indexedFiles: number;
  bytesHashed: number;
};

const posix = (path: string) => path.split(sep).join("/");
const comparePath = (left: { path: string }, right: { path: string }) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0;

function abortIfNeeded(signal: AbortSignal | undefined): void {
  if (signal?.aborted)
    throw new RepositoryIndexError(
      "cancelled",
      "Repository indexing cancelled",
    );
}

async function cooperate(signal: AbortSignal | undefined): Promise<void> {
  abortIfNeeded(signal);
  await new Promise<void>((resolve) => setImmediate(resolve));
  abortIfNeeded(signal);
}

function emit(
  progress: MutableProgress,
  callback: IndexRepositoryOptions["onProgress"],
): void {
  callback?.({ ...progress });
}

const GIT_ENV: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  LANG: "C",
  LC_ALL: "C",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_ATTR_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_PAGER: "cat",
  GIT_EXTERNAL_DIFF: "",
};

async function git(
  root: string,
  args: readonly string[],
  allowFailure = false,
  signal?: AbortSignal,
): Promise<string | null> {
  const hardened = [
    "--no-optional-locks",
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "core.fsmonitor=false",
    "-c",
    "core.pager=cat",
    "-c",
    "pager.branch=false",
    "-c",
    "pager.status=false",
    "-c",
    "core.attributesFile=/dev/null",
    "-c",
    "submodule.recurse=false",
    "-C",
    root,
    ...args,
  ];
  try {
    const { stdout } = await execFileAsync("git", hardened, {
      env: GIT_ENV,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
      signal,
    });
    return stdout;
  } catch (error) {
    if (signal?.aborted)
      throw new RepositoryIndexError(
        "cancelled",
        "Repository indexing cancelled",
      );
    if (allowFailure) return null;
    throw new RepositoryIndexError(
      "git_error",
      `Trusted Git metadata read failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

async function canonicalRoot(selected: string): Promise<string> {
  let canonical: string;
  try {
    canonical = await realpath(selected);
  } catch {
    throw new RepositoryIndexError(
      "invalid_root",
      "Repository root does not exist",
    );
  }
  let stat;
  try {
    stat = await lstat(canonical);
  } catch {
    throw new RepositoryIndexError(
      "invalid_root",
      "Repository root cannot be read",
    );
  }
  if (!stat.isDirectory())
    throw new RepositoryIndexError(
      "invalid_root",
      "Repository root must be a directory",
    );
  return canonical;
}

async function isGitRoot(
  root: string,
  signal: AbortSignal | undefined,
): Promise<boolean> {
  const output = await git(
    root,
    ["rev-parse", "--show-toplevel"],
    true,
    signal,
  );
  if (output === null) return false;
  try {
    return (await realpath(output.trim())) === root;
  } catch {
    return false;
  }
}

function fixedExcluded(path: string): boolean {
  return path.split("/").some((part) => FIXED_EXCLUDED_DIRECTORIES.has(part));
}

async function discoverGitFiles(
  root: string,
  progress: MutableProgress,
  options: IndexRepositoryOptions,
): Promise<{ paths: string[]; prunedEntries: number; symlinks: number }> {
  const output = await git(
    root,
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    false,
    options.signal,
  );
  const candidates = (output ?? "")
    .split("\0")
    .filter(Boolean)
    .map(posix)
    .sort();
  const paths: string[] = [];
  let prunedEntries = 0;
  let symlinks = 0;
  for (const candidate of candidates) {
    abortIfNeeded(options.signal);
    if (fixedExcluded(candidate)) {
      prunedEntries += 1;
      continue;
    }
    const absolute = join(root, candidate);
    let stat;
    try {
      stat = await lstat(absolute);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) {
      symlinks += 1;
      continue;
    }
    if (!stat.isFile()) continue;
    paths.push(candidate);
    progress.discoveredFiles += 1;
    if (paths.length > (options.maxFiles ?? DEFAULT_MAX_FILES))
      throw new RepositoryIndexError(
        "file_limit",
        `Repository exceeds the configured file limit of ${options.maxFiles ?? DEFAULT_MAX_FILES}`,
      );
    if (paths.length % 25 === 0) {
      emit(progress, options.onProgress);
      await cooperate(options.signal);
    }
  }
  emit(progress, options.onProgress);
  return { paths, prunedEntries, symlinks };
}

async function discoverNonGitFiles(
  root: string,
  progress: MutableProgress,
  options: IndexRepositoryOptions,
): Promise<{ paths: string[]; prunedEntries: number; symlinks: number }> {
  const matcher = createIgnore();
  try {
    matcher.add(await readFile(join(root, ".gitignore"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const paths: string[] = [];
  let prunedEntries = 0;
  let symlinks = 0;
  async function visit(relativeDirectory: string): Promise<void> {
    abortIfNeeded(options.signal);
    const entries = await readdir(join(root, relativeDirectory), {
      withFileTypes: true,
    });
    entries.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    for (const entry of entries) {
      const path = posix(join(relativeDirectory, entry.name));
      if (entry.isSymbolicLink()) {
        symlinks += 1;
        continue;
      }
      const ignoredByFixed =
        entry.isDirectory() && FIXED_EXCLUDED_DIRECTORIES.has(entry.name);
      const ignoredByRoot = matcher.ignores(
        entry.isDirectory() ? `${path}/` : path,
      );
      if (ignoredByFixed || ignoredByRoot) {
        prunedEntries += 1;
        continue;
      }
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        paths.push(path);
        progress.discoveredFiles += 1;
        if (paths.length > (options.maxFiles ?? DEFAULT_MAX_FILES))
          throw new RepositoryIndexError(
            "file_limit",
            `Repository exceeds the configured file limit of ${options.maxFiles ?? DEFAULT_MAX_FILES}`,
          );
        if (paths.length % 25 === 0) {
          emit(progress, options.onProgress);
          await cooperate(options.signal);
        }
      }
    }
  }
  await visit("");
  emit(progress, options.onProgress);
  return { paths, prunedEntries, symlinks };
}

async function gitStatus(
  root: string,
  signal: AbortSignal | undefined,
): Promise<Map<string, string>> {
  const output = await git(
    root,
    ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignored=no"],
    false,
    signal,
  );
  const values = (output ?? "").split("\0").filter(Boolean);
  const statuses = new Map<string, string>();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    const status = value.slice(0, 2);
    const path = posix(value.slice(3));
    statuses.set(path, status);
    if (status.includes("R") || status.includes("C")) index += 1;
  }
  return statuses;
}

async function gitMetadata(
  root: string,
  present: boolean,
  signal: AbortSignal | undefined,
): Promise<RepositoryGitMetadata> {
  if (!present)
    return { present: false, branch: null, head: null, dirty: false };
  const [branchOutput, headOutput, statusOutput] = await Promise.all([
    git(root, ["branch", "--show-current"], false, signal),
    git(root, ["rev-parse", "--verify", "HEAD"], true, signal),
    git(
      root,
      ["status", "--porcelain=v1", "--untracked-files=all", "--ignored=no"],
      false,
      signal,
    ),
  ]);
  return {
    present: true,
    branch: branchOutput?.trim() || null,
    head: headOutput?.trim() || null,
    dirty: Boolean(statusOutput),
  };
}

async function binarySample(path: string, extension: string): Promise<boolean> {
  if (isKnownBinaryExtension(extension)) return true;
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(8 * 1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).includes(0);
  } finally {
    await handle.close();
  }
}

function fileKind(
  path: string,
  extension: string,
  binary: boolean,
): RepositoryFile["fileKind"] {
  const name = basename(path);
  if (PACKAGE_MANIFESTS[name]) return "manifest";
  if (
    /(?:^|\/)(?:test|tests|__tests__|spec)(?:\/|$)|\.(?:test|spec)\.[^.]+$/i.test(
      path,
    )
  )
    return "test";
  if ([".md", ".mdx", ".rst", ".txt"].includes(extension))
    return "documentation";
  if (ASSET_EXTENSIONS.has(extension)) return "asset";
  if (binary) return "binary";
  if ([".json", ".jsonl", ".csv", ".xml", ".yaml", ".yml"].includes(extension))
    return "data";
  if (
    /^(?:Dockerfile|Makefile|\.env|\.gitignore)|\.(?:config\.[^.]+|ini|toml)$/i.test(
      name,
    )
  )
    return "configuration";
  return LANGUAGES[extension] ? "source" : "other";
}

async function hashFile(path: string): Promise<string> {
  const content = await readFile(path);
  return createHash("sha256").update(content).digest("hex");
}

function directMavenArtifactId(content: string): string | null {
  if (/<!DOCTYPE|<!ENTITY/i.test(content)) return null;
  const tokens =
    /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[A-Za-z_][^>]*>/g;
  const stack: string[] = [];
  let cursor = 0;
  let sawProject = false;
  let closedProject = false;
  let directArtifacts = 0;
  let artifactText: string[] | null = null;
  let candidate: string | null = null;
  const localName = (name: string) => name.split(":").at(-1) ?? name;

  for (const match of content.matchAll(tokens)) {
    const raw = match[0];
    const leadingText = content.slice(cursor, match.index);
    if (leadingText.includes("<")) return null;
    if (artifactText) artifactText.push(leadingText);
    else if (stack.length === 0 && leadingText.trim()) return null;
    cursor = (match.index ?? 0) + raw.length;

    if (raw.startsWith("<!--") || raw.startsWith("<?")) continue;
    if (raw.startsWith("<![CDATA[")) {
      if (artifactText) artifactText.push(raw.slice(9, -3));
      continue;
    }

    const name = raw.match(/^<\/?([A-Za-z_][\w:.-]*)\b/)?.[1];
    if (!name) return null;
    const closing = raw.startsWith("</");
    const selfClosing = /\/\s*>$/.test(raw);

    if (closing) {
      if (selfClosing || stack.at(-1) !== name) return null;
      if (
        artifactText &&
        stack.length === 2 &&
        localName(name) === "artifactId"
      ) {
        directArtifacts += 1;
        if (directArtifacts > 1) return null;
        const value = artifactText.join("").trim();
        candidate = value && !value.includes("&") ? value.slice(0, 240) : null;
        artifactText = null;
      }
      stack.pop();
      if (stack.length === 0) closedProject = true;
      continue;
    }

    if (closedProject) return null;
    if (stack.length === 0) {
      if (sawProject || localName(name) !== "project") return null;
      sawProject = true;
    }
    const directArtifact =
      stack.length === 1 &&
      localName(stack[0] ?? "") === "project" &&
      localName(name) === "artifactId";
    if (artifactText && !directArtifact) return null;
    if (directArtifact) {
      directArtifacts += selfClosing ? 1 : 0;
      if (directArtifacts > 1) return null;
      if (!selfClosing) artifactText = [];
    }
    if (!selfClosing) stack.push(name);
    else if (stack.length === 0) closedProject = true;
  }

  const trailingText = content.slice(cursor);
  if (trailingText.includes("<")) return null;
  if (artifactText) artifactText.push(trailingText);
  else if (stack.length === 0 && trailingText.trim()) return null;
  if (!sawProject || !closedProject || stack.length > 0 || artifactText)
    return null;
  return directArtifacts === 1 ? candidate : null;
}

async function packageRecord(
  root: string,
  path: string,
): Promise<RepositoryPackage | null> {
  const name = basename(path);
  const kind = PACKAGE_MANIFESTS[name];
  if (!kind) return null;
  try {
    if ((await lstat(join(root, path))).size > MAX_FILE_HASH_BYTES)
      return { path, kind, name: null };
  } catch {
    return { path, kind, name: null };
  }
  let content: string;
  try {
    content = await readFile(join(root, path), "utf8");
  } catch {
    return { path, kind, name: null };
  }
  let packageName: string | null;
  try {
    if (kind === "npm") {
      const value = JSON.parse(content) as { name?: unknown };
      packageName =
        typeof value.name === "string" && value.name.trim()
          ? value.name.trim().slice(0, 240)
          : null;
    } else if (kind === "go")
      packageName =
        content.match(/^module\s+([^\s]+)$/m)?.[1]?.slice(0, 240) ?? null;
    else if (kind === "maven") packageName = directMavenArtifactId(content);
    else {
      const section =
        kind === "cargo"
          ? (content.match(/\[package\]([\s\S]*?)(?:\n\[|$)/)?.[1] ?? "")
          : (content.match(/\[project\]([\s\S]*?)(?:\n\[|$)/)?.[1] ?? "");
      packageName =
        section
          .match(/^name\s*=\s*["']([^"']+)["']/m)?.[1]
          ?.trim()
          .slice(0, 240) ?? null;
    }
  } catch {
    packageName = null;
  }
  return { path, kind, name: packageName };
}

function directoriesFor(
  files: readonly RepositoryFile[],
): RepositoryDirectory[] {
  const counts = new Map<string, number>();
  for (const file of files) {
    let parent = posix(dirname(file.path));
    while (parent !== "." && parent !== "") {
      counts.set(parent, (counts.get(parent) ?? 0) + 1);
      const next = posix(dirname(parent));
      if (next === parent) break;
      parent = next;
    }
  }
  return [...counts]
    .map(([path, fileCount]) => ({ path, fileCount }))
    .sort(comparePath);
}

export async function indexRepository(
  options: IndexRepositoryOptions,
): Promise<RepositoryGeneration> {
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > HARD_MAX_FILES)
    throw new RepositoryIndexError(
      "file_limit",
      `maxFiles must be between 1 and ${HARD_MAX_FILES}`,
    );
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const progress: MutableProgress = {
    phase: "validating",
    discoveredFiles: 0,
    indexedFiles: 0,
    bytesHashed: 0,
  };
  emit(progress, options.onProgress);
  abortIfNeeded(options.signal);
  const root = await canonicalRoot(options.rootPath);
  const gitPresent = await isGitRoot(root, options.signal);
  progress.phase = "discovering";
  emit(progress, options.onProgress);
  const discovery = gitPresent
    ? await discoverGitFiles(root, progress, { ...options, maxFiles })
    : await discoverNonGitFiles(root, progress, { ...options, maxFiles });
  progress.phase = "git-metadata";
  emit(progress, options.onProgress);
  const [metadata, statuses] = await Promise.all([
    gitMetadata(root, gitPresent, options.signal),
    gitPresent
      ? gitStatus(root, options.signal)
      : Promise.resolve(new Map<string, string>()),
  ]);
  progress.phase = "classifying";
  emit(progress, options.onProgress);
  const files: RepositoryFile[] = [];
  const packages: RepositoryPackage[] = [];
  let binaryFiles = 0;
  let oversizedFiles = 0;
  for (const path of discovery.paths) {
    abortIfNeeded(options.signal);
    const absolute = join(root, path);
    const stat = await lstat(absolute);
    const extension = extname(path).toLowerCase();
    const binary = await binarySample(absolute, extension);
    const oversized = stat.size > MAX_FILE_HASH_BYTES;
    const withinBudget =
      !oversized && progress.bytesHashed + stat.size <= MAX_TOTAL_HASH_BYTES;
    const contentHash = withinBudget ? await hashFile(absolute) : null;
    if (withinBudget) progress.bytesHashed += stat.size;
    if (binary) binaryFiles += 1;
    if (oversized) oversizedFiles += 1;
    files.push({
      path,
      size: stat.size,
      fileKind: fileKind(path, extension, binary),
      language: LANGUAGES[extension] ?? null,
      binary,
      oversized,
      contentHash,
      gitStatus: statuses.get(path) ?? null,
    });
    const packageMetadata = await packageRecord(root, path);
    if (packageMetadata) packages.push(packageMetadata);
    progress.indexedFiles += 1;
    if (progress.indexedFiles % 25 === 0) {
      emit(progress, options.onProgress);
      await cooperate(options.signal);
    }
  }
  files.sort(comparePath);
  packages.sort(comparePath);
  const directories = directoriesFor(files);
  const coverage = {
    discoveredFiles: progress.discoveredFiles,
    indexedFiles: files.length,
    prunedEntries: discovery.prunedEntries,
    skippedSymlinks: discovery.symlinks,
    directories: directories.length,
    packages: packages.length,
    binaryFiles,
    oversizedFiles,
    bytesHashed: progress.bytesHashed,
  };
  progress.phase = "finalizing";
  emit(progress, options.onProgress);
  const stable = {
    rootPath: root,
    repositoryName: basename(root),
    git: metadata,
    directories,
    files,
    packages,
    coverage,
  };
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(stable))
    .digest("hex");
  const completed = Date.now();
  progress.phase = "complete";
  emit(progress, options.onProgress);
  return {
    id: randomUUID(),
    fingerprint,
    ...stable,
    startedAt,
    completedAt: new Date(completed).toISOString(),
    durationMs: Math.max(0, completed - started),
  };
}
