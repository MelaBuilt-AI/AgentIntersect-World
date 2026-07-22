import { builtinModules } from "node:module";
import { readdir, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

type Manifest = {
  readonly name?: string;
  readonly exports?: unknown;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
};

export type ArchitectureViolation = {
  readonly code:
    | "missing-exports"
    | "dependency-cycle"
    | "forbidden-dependency"
    | "browser-node-import"
    | "browser-server-import"
    | "sync-authority-import"
    | "deep-workspace-import";
  readonly file: string;
  readonly message: string;
};

const allowedWorkspaceDependencies: Readonly<
  Record<string, readonly string[]>
> = {
  "@agentintersect-world/agent-session-protocol": [],
  "@agentintersect-world/agentintersect-client": [],
  "@agentintersect-world/avatar-system": [],
  "@agentintersect-world/config": [],
  "@agentintersect-world/local-server": [
    "@agentintersect-world/agent-session-protocol",
    "@agentintersect-world/agentintersect-client",
    "@agentintersect-world/config",
    "@agentintersect-world/observability",
    "@agentintersect-world/navigation",
    "@agentintersect-world/persistence",
    "@agentintersect-world/repo-indexer",
    "@agentintersect-world/spatial-code-graph",
    "@agentintersect-world/sync-yjs",
    "@agentintersect-world/tool-protocol",
    "@agentintersect-world/world-event-protocol",
    "@agentintersect-world/world-action-protocol",
    "@agentintersect-world/world-schema",
  ],
  "@agentintersect-world/observability": ["@agentintersect-world/world-schema"],
  "@agentintersect-world/navigation": [],
  "@agentintersect-world/persistence": [
    "@agentintersect-world/world-event-protocol",
  ],
  "@agentintersect-world/renderer-r3f": [],
  "@agentintersect-world/repo-indexer": ["@agentintersect-world/world-schema"],
  "@agentintersect-world/spatial-code-graph": [
    "@agentintersect-world/world-schema",
  ],
  "@agentintersect-world/sync-yjs": [],
  "@agentintersect-world/tool-protocol": [],
  "@agentintersect-world/ui": ["@agentintersect-world/world-schema"],
  "@agentintersect-world/web": [
    "@agentintersect-world/avatar-system",
    "@agentintersect-world/config",
    "@agentintersect-world/renderer-r3f",
    "@agentintersect-world/sync-yjs",
    "@agentintersect-world/ui",
    "@agentintersect-world/world-schema",
  ],
  "@agentintersect-world/world-event-protocol": [],
  "@agentintersect-world/world-action-protocol": [],
  "@agentintersect-world/world-schema": [],
};

const browserRoots = new Set([
  "@agentintersect-world/avatar-system",
  "@agentintersect-world/renderer-r3f",
  "@agentintersect-world/spatial-code-graph",
  "@agentintersect-world/sync-yjs",
  "@agentintersect-world/ui",
  "@agentintersect-world/web",
]);

const serverOnlyImports = new Set([
  "fastify",
  "@agentintersect-world/agentintersect-client",
  "@agentintersect-world/local-server",
  "@agentintersect-world/observability",
  "@agentintersect-world/persistence",
  "@agentintersect-world/repo-indexer",
]);

const authorityPattern =
  /(agentintersect-client|local-server|command|filesystem|(?:^|node:)fs(?:\/|$)|process|child_process|worker_threads|lifecycle)/i;
const importPattern =
  /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)/g;
const nodeImports = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);

const presentationPersistenceNodeImports = new Set([
  "node:crypto",
  "node:fs",
  "node:fs/promises",
  "node:path",
]);

async function existingDirectories(root: string): Promise<string[]> {
  const directories: string[] = [];
  for (const parent of ["apps", "packages"] as const) {
    try {
      for (const entry of await readdir(resolve(root, parent), {
        withFileTypes: true,
      })) {
        if (entry.isDirectory())
          directories.push(resolve(root, parent, entry.name));
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return directories;
}

async function sourceFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(current: string) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (/\.(?:[cm]?ts|tsx)$/.test(entry.name)) files.push(path);
    }
  }
  await visit(resolve(directory, "src"));
  return files;
}

function workspaceDependencies(manifest: Manifest): string[] {
  return Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.peerDependencies,
  }).filter((name) => name.startsWith("@agentintersect-world/"));
}

function declaresSubpathExport(manifest: Manifest, subpath: string): boolean {
  if (
    manifest.exports === null ||
    typeof manifest.exports !== "object" ||
    Array.isArray(manifest.exports)
  ) {
    return false;
  }
  return Object.hasOwn(manifest.exports, `./${subpath}`);
}

function findCycles(graph: ReadonlyMap<string, readonly string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const active = new Set<string>();
  const stack: string[] = [];

  function visit(node: string) {
    if (active.has(node)) {
      const start = stack.indexOf(node);
      cycles.push([...stack.slice(start), node]);
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    active.add(node);
    stack.push(node);
    for (const dependency of graph.get(node) ?? []) {
      if (graph.has(dependency)) visit(dependency);
    }
    stack.pop();
    active.delete(node);
  }

  for (const node of graph.keys()) visit(node);
  return cycles;
}

export async function inspectArchitecture(
  root: string,
): Promise<ArchitectureViolation[]> {
  const absoluteRoot = resolve(root);
  const violations: ArchitectureViolation[] = [];
  const packages = new Map<
    string,
    { directory: string; manifest: Manifest; file: string }
  >();

  for (const directory of await existingDirectories(absoluteRoot)) {
    const file = resolve(directory, "package.json");
    let manifest: Manifest;
    try {
      manifest = JSON.parse(await readFile(file, "utf8")) as Manifest;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    if (!manifest.name) continue;
    packages.set(manifest.name, { directory, manifest, file });
    if (manifest.exports === undefined) {
      violations.push({
        code: "missing-exports",
        file: relative(absoluteRoot, file),
        message: `${manifest.name} must declare explicit exports`,
      });
    }
  }

  const graph = new Map<string, readonly string[]>();
  for (const [name, item] of packages) {
    const dependencies = workspaceDependencies(item.manifest);
    graph.set(name, dependencies);
    const allowed = new Set(allowedWorkspaceDependencies[name] ?? []);
    for (const dependency of dependencies) {
      if (!allowed.has(dependency)) {
        violations.push({
          code: "forbidden-dependency",
          file: relative(absoluteRoot, item.file),
          message: `${name} may not depend on ${dependency}`,
        });
      }
    }
  }

  for (const cycle of findCycles(graph)) {
    violations.push({
      code: "dependency-cycle",
      file: "package graph",
      message: cycle.join(" -> "),
    });
  }

  const browserReachable = new Set(browserRoots);
  const pendingBrowserPackages = [...browserRoots];
  while (pendingBrowserPackages.length > 0) {
    const packageName = pendingBrowserPackages.pop();
    if (packageName === undefined) break;
    for (const dependency of graph.get(packageName) ?? []) {
      if (browserReachable.has(dependency)) continue;
      browserReachable.add(dependency);
      pendingBrowserPackages.push(dependency);
    }
  }

  for (const [packageName, item] of packages) {
    for (const file of await sourceFiles(item.directory)) {
      const source = await readFile(file, "utf8");
      const packageRelativeFile = relative(item.directory, file)
        .split(sep)
        .join("/");
      const declaredNodeSubpathSource =
        packageRelativeFile === "src/node.ts" &&
        declaresSubpathExport(item.manifest, "node");
      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1] ?? match[2] ?? match[3];
        if (!specifier) continue;
        const displayFile = relative(absoluteRoot, file).split(sep).join("/");
        const deepWorkspaceImport = specifier.match(
          /^(@agentintersect-world\/[^/]+)\/(.+)/,
        );
        const importedPackage = deepWorkspaceImport?.[1];
        const importedSubpath = deepWorkspaceImport?.[2];
        const declaredSubpath =
          importedPackage !== undefined && importedSubpath !== undefined
            ? packages.get(importedPackage)
            : undefined;
        if (
          deepWorkspaceImport &&
          (declaredSubpath === undefined ||
            !declaresSubpathExport(declaredSubpath.manifest, importedSubpath!))
        ) {
          violations.push({
            code: "deep-workspace-import",
            file: displayFile,
            message: `deep workspace import is prohibited: ${specifier}`,
          });
        }
        if (
          browserReachable.has(packageName) &&
          !declaredNodeSubpathSource &&
          (nodeImports.has(specifier) || importedSubpath === "node")
        ) {
          violations.push({
            code: "browser-node-import",
            file: displayFile,
            message: `browser source may not import Node-only module ${specifier}`,
          });
        }
        if (
          browserReachable.has(packageName) &&
          serverOnlyImports.has(specifier)
        ) {
          violations.push({
            code: "browser-server-import",
            file: displayFile,
            message: `browser source may not import server-only package ${specifier}`,
          });
        }
        if (
          packageName === "@agentintersect-world/sync-yjs" &&
          authorityPattern.test(specifier) &&
          !(
            declaredNodeSubpathSource &&
            presentationPersistenceNodeImports.has(specifier)
          )
        ) {
          violations.push({
            code: "sync-authority-import",
            file: displayFile,
            message: `presentation sync may not import authority module ${specifier}`,
          });
        }
      }
    }
  }

  return violations;
}

async function main() {
  const violations = await inspectArchitecture(resolve("."));
  if (violations.length > 0) {
    for (const violation of violations) {
      process.stderr.write(
        `${violation.code}: ${violation.file}: ${violation.message}\n`,
      );
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    "Architecture check passed: 15 workspace packages, including browser-safe Phase 12 authority boundaries.\n",
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) await main();
