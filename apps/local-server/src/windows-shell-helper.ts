import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

// When World runs inside WSL, an elevated Windows PowerShell needs the shell
// helper to run on Windows. We stage a pinned Windows Node.js plus the helper
// and its two dependencies under %LOCALAPPDATA%, then UAC-launch that copy.

const run = promisify(execFile);
const require = createRequire(import.meta.url);

export const WINDOWS_POWERSHELL =
  "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";
const WINDOWS_TAR = "/mnt/c/Windows/System32/tar.exe";
export const WINDOWS_NODE = {
  version: "v24.18.0",
  archive: "node-v24.18.0-win-x64.zip",
  sha256: "0ae68406b42d7725661da979b1403ec9926da205c6770827f33aac9d8f26e821",
} as const;

export const isWslHost = (): boolean =>
  process.platform === "linux" &&
  existsSync("/proc/sys/fs/binfmt_misc/WSLInterop");

export type WindowsHelper = {
  /** Windows paths, ready for Start-Process. */
  readonly node: string;
  readonly helper: string;
};

const toWsl = async (windowsPath: string) =>
  (await run("wslpath", ["-u", windowsPath])).stdout.trim();

async function localAppData(): Promise<string> {
  const { stdout } = await run(WINDOWS_POWERSHELL, [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "[Environment]::GetFolderPath('LocalApplicationData')",
  ]);
  const path = stdout.trim();
  if (!/^[A-Za-z]:\\/.test(path))
    throw new Error("Windows LocalAppData could not be resolved.");
  return path;
}

async function ensureNode(
  windowsRoot: string,
  download: typeof fetch,
): Promise<string> {
  const folder = WINDOWS_NODE.archive.replace(/\.zip$/, "");
  const windowsNode = `${windowsRoot}\\runtime\\${folder}\\node.exe`;
  if (existsSync(await toWsl(windowsNode))) return windowsNode;
  const runtime = await toWsl(`${windowsRoot}\\runtime`);
  await mkdir(runtime, { recursive: true });
  const response = await download(
    `https://nodejs.org/dist/${WINDOWS_NODE.version}/${WINDOWS_NODE.archive}`,
    { signal: AbortSignal.timeout(300_000) },
  );
  if (!response.ok)
    throw new Error(`Node.js download failed (HTTP ${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== WINDOWS_NODE.sha256)
    throw new Error("Node.js download did not match its pinned checksum.");
  const archive = join(runtime, `${WINDOWS_NODE.archive}.partial`);
  await writeFile(archive, bytes);
  try {
    await run(WINDOWS_TAR, [
      "-xf",
      `${windowsRoot}\\runtime\\${WINDOWS_NODE.archive}.partial`,
      "-C",
      `${windowsRoot}\\runtime`,
      `${folder}/node.exe`,
    ]);
  } finally {
    await rm(archive, { force: true });
  }
  return windowsNode;
}

/** Package folder from its entry point (some packages don't export package.json). */
async function packageRoot(name: string, from = require): Promise<string> {
  let directory = dirname(from.resolve(name));
  while (!existsSync(join(directory, "package.json"))) {
    if (dirname(directory) === directory)
      throw new Error(`${name} has no package.json.`);
    directory = dirname(directory);
  }
  return directory;
}

async function ensureHelper(
  windowsRoot: string,
  helperSource: string,
): Promise<string> {
  const pty = await packageRoot("@lydell/node-pty");
  const ptyWindows = await packageRoot(
    "@lydell/node-pty-win32-x64",
    createRequire(join(pty, "package.json")),
  );
  const ws = await packageRoot("ws");
  const version = async (root: string) =>
    (
      JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
        version: string;
      }
    ).version;
  const key = createHash("sha256")
    .update(await readFile(helperSource))
    .update(`${await version(pty)}|${await version(ws)}`)
    .digest("hex")
    .slice(0, 16);
  const windowsDirectory = `${windowsRoot}\\admin-shell\\${key}`;
  const windowsHelper = `${windowsDirectory}\\admin-shell-helper.mjs`;
  const directory = await toWsl(windowsDirectory);
  if (existsSync(join(directory, "ready"))) return windowsHelper;
  const staging = `${directory}.partial`;
  await rm(staging, { recursive: true, force: true });
  const modules = join(staging, "node_modules");
  const copy = (source: string, target: string) =>
    cp(source, target, {
      recursive: true,
      dereference: true,
      filter: (path) => !path.endsWith(".pdb"),
    });
  await copy(pty, join(modules, "@lydell", "node-pty"));
  await copy(ptyWindows, join(modules, "@lydell", "node-pty-win32-x64"));
  await copy(ws, join(modules, "ws"));
  await cp(helperSource, join(staging, "admin-shell-helper.mjs"));
  await writeFile(join(staging, "ready"), key);
  await rm(directory, { recursive: true, force: true });
  await rename(staging, directory);
  return windowsHelper;
}

let pending: Promise<WindowsHelper> | undefined;

/** Stages (once) the Windows Node.js runtime and shell helper for a WSL-hosted World. */
export function ensureWindowsHelper(
  helperSource: string,
  download: typeof fetch = fetch,
): Promise<WindowsHelper> {
  pending ??= (async () => {
    const windowsRoot = `${await localAppData()}\\AgentIntersect-World`;
    const [node, helper] = await Promise.all([
      ensureNode(windowsRoot, download),
      ensureHelper(windowsRoot, helperSource),
    ]);
    return { node, helper };
  })().catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
