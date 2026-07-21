import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import YAML from "yaml";

const PLUGIN_FILES = ["__init__.py", "plugin.yaml"] as const;
const ENV_KEYS = [
  "API_SERVER_ENABLED",
  "API_SERVER_HOST",
  "API_SERVER_PORT",
  "API_SERVER_KEY",
] as const;
const MANAGED_DIRECTORIES = [
  "plugins",
  "plugins/agentintersect-world",
  "agentintersect-world",
  "agentintersect-world/turn-locks",
] as const;
const RUNTIME_STATE_FILES = [
  "avatar-proposal.json",
  "capabilities.json",
  "events.jsonl",
] as const;

export type ProfileOperation = {
  readonly path: string;
  readonly operation: "create" | "update";
  readonly mode: "0600";
  readonly oldSha256: string | null;
  readonly newSha256: string;
};

export type ProfilePreview = {
  readonly schema: "aiw.hermes-profile-preview/0.12";
  readonly timestamp: string;
  readonly outputRoot: string;
  readonly previewPath: string;
  readonly operations: readonly ProfileOperation[];
};

type PreviewInput = {
  readonly profileRoot: string;
  readonly pluginSource: string;
  readonly outputRoot: string;
  readonly apiServerKey: string;
  readonly timestamp: string;
};

type ApplyInput = ProfilePreview & {
  readonly profileRoot: string;
  readonly pluginSource: string;
  readonly apiServerKey: string;
};

function sha(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeRoot(input: string, label: string): string {
  if (!path.isAbsolute(input)) throw new Error(`${label} must be absolute`);
  const resolved = path.resolve(input);
  if (resolved === path.parse(resolved).root)
    throw new Error(`${label} cannot be a filesystem root`);
  return resolved;
}

function ensureApiKey(value: string): void {
  if (value.length < 24 || value.length > 256 || !/^[\x20-\x7e]+$/.test(value))
    throw new Error("API server key must be 24..256 visible ASCII characters");
}

function renderConfig(existing: Buffer): Buffer {
  const parsed: unknown = YAML.parse(existing.toString("utf8")) ?? {};
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Hermes config.yaml must contain a mapping");
  const config = parsed as Record<string, unknown>;
  const plugins =
    config.plugins &&
    typeof config.plugins === "object" &&
    !Array.isArray(config.plugins)
      ? (config.plugins as Record<string, unknown>)
      : {};
  const current = Array.isArray(plugins.enabled)
    ? plugins.enabled.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  plugins.enabled = [...new Set([...current, "agentintersect-world"])].sort();
  config.plugins = plugins;
  return Buffer.from(YAML.stringify(config, { lineWidth: 0 }), "utf8");
}

function renderEnv(existing: Buffer, apiServerKey: string): Buffer {
  ensureApiKey(apiServerKey);
  const desired: Readonly<Record<(typeof ENV_KEYS)[number], string>> = {
    API_SERVER_ENABLED: "true",
    API_SERVER_HOST: "127.0.0.1",
    API_SERVER_PORT: "8642",
    API_SERVER_KEY: apiServerKey,
  };
  const found = new Set<string>();
  const lines = existing
    .toString("utf8")
    .split(/\r?\n/)
    .filter((line, index, all) => {
      return !(index === all.length - 1 && line === "");
    });
  const updated = lines.map((line) => {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    const key = match?.[1] as (typeof ENV_KEYS)[number] | undefined;
    if (!key || !ENV_KEYS.includes(key)) return line;
    if (found.has(key))
      throw new Error(`Hermes .env contains duplicate ${key}`);
    found.add(key);
    return `${key}=${desired[key]}`;
  });
  for (const key of ENV_KEYS)
    if (!found.has(key)) updated.push(`${key}=${desired[key]}`);
  return Buffer.from(`${updated.join("\n")}\n`, "utf8");
}

function desiredFiles(input: {
  profileRoot: string;
  pluginSource: string;
  apiServerKey: string;
}): Map<string, Buffer> {
  const profile = safeRoot(input.profileRoot, "profileRoot");
  const source = safeRoot(input.pluginSource, "pluginSource");
  const configPath = path.join(profile, "config.yaml");
  const envPath = path.join(profile, ".env");
  if (!fs.existsSync(configPath) || fs.lstatSync(configPath).isSymbolicLink())
    throw new Error("Hermes config.yaml must be an existing regular file");
  if (fs.existsSync(envPath) && fs.lstatSync(envPath).isSymbolicLink())
    throw new Error("Hermes .env cannot be a symlink");
  const targetPlugin = path.join(profile, "plugins", "agentintersect-world");
  if (fs.existsSync(targetPlugin)) {
    if (fs.lstatSync(targetPlugin).isSymbolicLink())
      throw new Error("Hermes plugin target cannot be a symlink");
    const unexpected = fs
      .readdirSync(targetPlugin)
      .filter(
        (entry) =>
          !PLUGIN_FILES.includes(entry as (typeof PLUGIN_FILES)[number]),
      );
    if (unexpected.length > 0)
      throw new Error("Hermes plugin target contains unexpected drift");
  }
  const files = new Map<string, Buffer>();
  files.set("config.yaml", renderConfig(fs.readFileSync(configPath)));
  files.set(
    ".env",
    renderEnv(
      fs.existsSync(envPath) ? fs.readFileSync(envPath) : Buffer.alloc(0),
      input.apiServerKey,
    ),
  );
  for (const name of PLUGIN_FILES) {
    const sourcePath = path.join(source, name);
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile())
      throw new Error(`Plugin artifact ${name} is missing`);
    files.set(
      `plugins/agentintersect-world/${name}`,
      fs.readFileSync(sourcePath),
    );
  }
  return files;
}

function oldBytes(profileRoot: string, relative: string): Buffer | null {
  const target = path.join(profileRoot, relative);
  if (!fs.existsSync(target)) return null;
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error(`Profile target ${relative} must be a regular file`);
  return fs.readFileSync(target);
}

export function createHermesProfilePreview(
  input: PreviewInput,
): ProfilePreview {
  const profileRoot = safeRoot(input.profileRoot, "profileRoot");
  const outputRoot = safeRoot(input.outputRoot, "outputRoot");
  if (!/^\d{8}T\d{6}Z$/.test(input.timestamp))
    throw new Error("timestamp must use YYYYMMDDTHHMMSSZ");
  const files = desiredFiles({ ...input, profileRoot });
  const operations = [...files.entries()].map(([relative, desired]) => {
    const previous = oldBytes(profileRoot, relative);
    return {
      path: relative,
      operation: previous ? ("update" as const) : ("create" as const),
      mode: "0600" as const,
      oldSha256: previous ? sha(previous) : null,
      newSha256: sha(desired),
    };
  });
  const preview: ProfilePreview = {
    schema: "aiw.hermes-profile-preview/0.12",
    timestamp: input.timestamp,
    outputRoot,
    previewPath: path.join(outputRoot, `preview-${input.timestamp}.json`),
    operations,
  };
  fs.mkdirSync(outputRoot, { recursive: true, mode: 0o700 });
  const publicPreview = {
    schema: preview.schema,
    timestamp: preview.timestamp,
    operations: preview.operations,
  };
  fs.writeFileSync(
    preview.previewPath,
    `${JSON.stringify(publicPreview, null, 2)}\n`,
    {
      mode: 0o600,
    },
  );
  return preview;
}

function ensureDirectory(target: string): void {
  if (fs.existsSync(target)) {
    const stat = fs.lstatSync(target);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error(`Profile directory ${target} must be a real directory`);
    return;
  }
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  fs.chmodSync(target, 0o700);
}

function atomicWrite(target: string, value: Buffer, mode = 0o600): void {
  ensureDirectory(path.dirname(target));
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, value, { mode: 0o600 });
  fs.renameSync(temporary, target);
  fs.chmodSync(target, mode);
}

export function applyHermesProfileChange(input: ApplyInput): {
  readonly backupManifestPath: string;
} {
  const profileRoot = safeRoot(input.profileRoot, "profileRoot");
  const files = desiredFiles(input);
  const expectedPaths = [...files.keys()].sort();
  const operationPaths = input.operations.map(
    ({ path: operationPath }) => operationPath,
  );
  if (
    new Set(operationPaths).size !== operationPaths.length ||
    JSON.stringify([...operationPaths].sort()) !== JSON.stringify(expectedPaths)
  )
    throw new Error(
      "Profile preview operations do not match the frozen allowlist",
    );
  for (const operation of input.operations) {
    const previous = oldBytes(profileRoot, operation.path);
    const actual = previous ? sha(previous) : null;
    if (actual !== operation.oldSha256)
      throw new Error(`Profile drift detected at ${operation.path}`);
    const desired = files.get(operation.path);
    if (!desired || sha(desired) !== operation.newSha256)
      throw new Error(`Preview input drift detected at ${operation.path}`);
  }
  const backupRoot = path.join(input.outputRoot, "backups", input.timestamp);
  fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
  const directories = MANAGED_DIRECTORIES.map((relative) => {
    const target = path.join(profileRoot, relative);
    if (!fs.existsSync(target))
      return { path: relative, existed: false, mode: null };
    const stat = fs.lstatSync(target);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error(`Profile directory ${relative} must be a real directory`);
    return { path: relative, existed: true, mode: stat.mode & 0o777 };
  });
  const entries = input.operations.map((operation) => {
    const previous = oldBytes(profileRoot, operation.path);
    if (previous) atomicWrite(path.join(backupRoot, operation.path), previous);
    const target = path.join(profileRoot, operation.path);
    return {
      path: operation.path,
      existed: previous !== null,
      sha256: previous ? sha(previous) : null,
      mode: previous ? fs.statSync(target).mode & 0o777 : null,
      installedSha256: operation.newSha256,
    };
  });
  const backupManifestPath = path.join(backupRoot, "manifest.json");
  fs.writeFileSync(
    backupManifestPath,
    `${JSON.stringify(
      {
        schema: "aiw.hermes-profile-backup/0.12",
        timestamp: input.timestamp,
        entries,
        directories,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  for (const operation of input.operations) {
    const desired = files.get(operation.path);
    if (!desired) throw new Error(`Missing prepared file ${operation.path}`);
    atomicWrite(path.join(profileRoot, operation.path), desired);
  }
  return { backupManifestPath };
}

export function restoreHermesProfileBackup(
  manifestPath: string,
  profileRootInput: string,
): void {
  const profileRoot = safeRoot(profileRootInput, "profileRoot");
  const manifestRoot = path.dirname(path.resolve(manifestPath));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    schema?: string;
    entries?: Array<{
      path: string;
      existed: boolean;
      sha256: string | null;
      mode: number | null;
      installedSha256: string;
    }>;
    directories?: Array<{
      path: string;
      existed: boolean;
      mode: number | null;
    }>;
  };
  if (
    manifest.schema !== "aiw.hermes-profile-backup/0.12" ||
    !Array.isArray(manifest.entries) ||
    !Array.isArray(manifest.directories)
  )
    throw new Error("Backup manifest is invalid");
  const expectedPaths = [
    "config.yaml",
    ".env",
    ...PLUGIN_FILES.map((name) => `plugins/agentintersect-world/${name}`),
  ].sort();
  const entryPaths = manifest.entries.map((entry) => entry.path);
  if (
    new Set(entryPaths).size !== entryPaths.length ||
    JSON.stringify([...entryPaths].sort()) !== JSON.stringify(expectedPaths) ||
    JSON.stringify(manifest.directories.map((entry) => entry.path)) !==
      JSON.stringify(MANAGED_DIRECTORIES)
  )
    throw new Error("Backup manifest paths do not match the frozen allowlist");
  for (const entry of manifest.entries) {
    const installed = oldBytes(profileRoot, entry.path);
    if (!installed || sha(installed) !== entry.installedSha256)
      throw new Error(`Installed profile drift detected at ${entry.path}`);
    if (entry.existed) {
      const backup = fs.readFileSync(path.join(manifestRoot, entry.path));
      if (
        sha(backup) !== entry.sha256 ||
        !Number.isInteger(entry.mode) ||
        (entry.mode ?? -1) < 0 ||
        (entry.mode ?? -1) > 0o777
      )
        throw new Error(`Backup drift detected at ${entry.path}`);
    }
  }
  for (const directory of manifest.directories) {
    const target = path.join(profileRoot, directory.path);
    if (directory.existed) {
      if (
        !fs.existsSync(target) ||
        !fs.statSync(target).isDirectory() ||
        !Number.isInteger(directory.mode) ||
        (fs.statSync(target).mode & 0o777) !== directory.mode
      )
        throw new Error(
          `Installed profile directory drift at ${directory.path}`,
        );
    }
  }
  const pluginDirectory = path.join(
    profileRoot,
    "plugins",
    "agentintersect-world",
  );
  const pluginDirectoryRecord = manifest.directories.find(
    (entry) => entry.path === "plugins/agentintersect-world",
  );
  let pluginImportCache:
    | { readonly directory: string; readonly files: readonly string[] }
    | undefined;
  if (pluginDirectoryRecord && !pluginDirectoryRecord.existed) {
    const pluginEntries = fs.readdirSync(pluginDirectory, {
      withFileTypes: true,
    });
    const unexpected = pluginEntries.filter(
      (entry) =>
        !PLUGIN_FILES.includes(entry.name as (typeof PLUGIN_FILES)[number]) &&
        entry.name !== "__pycache__",
    );
    if (unexpected.length > 0)
      throw new Error("Installed plugin directory contains unexpected drift");
    const cacheEntry = pluginEntries.find(
      (entry) => entry.name === "__pycache__",
    );
    if (cacheEntry) {
      if (!cacheEntry.isDirectory() || cacheEntry.isSymbolicLink())
        throw new Error("Installed plugin directory contains unexpected drift");
      const cacheDirectory = path.join(pluginDirectory, cacheEntry.name);
      const cacheEntries = fs.readdirSync(cacheDirectory, {
        withFileTypes: true,
      });
      if (
        cacheEntries.some(
          (entry) =>
            !entry.isFile() ||
            entry.isSymbolicLink() ||
            !/^__init__\.cpython-\d+\.pyc$/.test(entry.name),
        )
      )
        throw new Error("Installed plugin directory contains unexpected drift");
      pluginImportCache = {
        directory: cacheDirectory,
        files: cacheEntries.map((entry) => entry.name),
      };
    }
  }
  const runtimeDirectory = path.join(profileRoot, "agentintersect-world");
  const runtimeDirectoryRecord = manifest.directories.find(
    (entry) => entry.path === "agentintersect-world",
  );
  if (
    runtimeDirectoryRecord &&
    !runtimeDirectoryRecord.existed &&
    fs.existsSync(runtimeDirectory)
  ) {
    const unexpected = fs
      .readdirSync(runtimeDirectory, { withFileTypes: true })
      .filter(
        (entry) =>
          !(
            entry.isFile() &&
            RUNTIME_STATE_FILES.includes(
              entry.name as (typeof RUNTIME_STATE_FILES)[number],
            )
          ) && !(entry.isDirectory() && entry.name === "turn-locks"),
      );
    if (unexpected.length > 0)
      throw new Error("Installed runtime state contains unexpected drift");
    const lockDirectory = path.join(runtimeDirectory, "turn-locks");
    if (fs.existsSync(lockDirectory)) {
      const unexpectedLocks = fs
        .readdirSync(lockDirectory, { withFileTypes: true })
        .filter(
          (entry) =>
            !entry.isFile() || !/^[a-f0-9]{64}\.lock$/.test(entry.name),
        );
      if (unexpectedLocks.length > 0)
        throw new Error(
          "Installed runtime lock state contains unexpected drift",
        );
    }
  }
  if (pluginImportCache) {
    for (const name of pluginImportCache.files)
      fs.unlinkSync(path.join(pluginImportCache.directory, name));
    fs.rmdirSync(pluginImportCache.directory);
  }
  for (const entry of manifest.entries) {
    const target = path.join(profileRoot, entry.path);
    if (entry.existed) {
      const backup = fs.readFileSync(path.join(manifestRoot, entry.path));
      atomicWrite(target, backup, entry.mode ?? 0o600);
    } else {
      fs.unlinkSync(target);
    }
  }
  if (
    runtimeDirectoryRecord &&
    !runtimeDirectoryRecord.existed &&
    fs.existsSync(runtimeDirectory)
  ) {
    for (const name of RUNTIME_STATE_FILES) {
      const target = path.join(runtimeDirectory, name);
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
    const lockDirectory = path.join(runtimeDirectory, "turn-locks");
    if (fs.existsSync(lockDirectory)) {
      for (const name of fs.readdirSync(lockDirectory))
        fs.unlinkSync(path.join(lockDirectory, name));
    }
  }
  for (const directory of [...manifest.directories].reverse()) {
    if (directory.existed) continue;
    const target = path.join(profileRoot, directory.path);
    if (fs.existsSync(target)) {
      if (fs.readdirSync(target).length > 0)
        throw new Error(
          `Created profile directory is not empty: ${directory.path}`,
        );
      fs.rmdirSync(target);
    }
  }
}

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (
    !command ||
    !["preview", "install", "uninstall", "restore"].includes(command)
  )
    throw new Error(
      "Usage: hermes-profile-change <preview|install|uninstall|restore> ...",
    );
  const profileRoot = argument("--profile");
  if (command === "restore" || command === "uninstall") {
    restoreHermesProfileBackup(argument("--manifest"), profileRoot);
    process.stdout.write("Hermes profile backup restored.\n");
    return;
  }
  const apiServerKey = process.env.AIW_HERMES_API_KEY;
  if (!apiServerKey)
    throw new Error("AIW_HERMES_API_KEY must be provided server-side");
  const pluginSource = argument("--plugin");
  if (command === "preview") {
    const preview = createHermesProfilePreview({
      profileRoot,
      pluginSource,
      outputRoot: argument("--output"),
      apiServerKey,
      timestamp: argument("--timestamp"),
    });
    process.stdout.write(
      `Secret-free preview written: ${preview.previewPath}\n`,
    );
    return;
  }
  const previewPath = path.resolve(argument("--preview"));
  const publicPreview = JSON.parse(fs.readFileSync(previewPath, "utf8")) as {
    schema: ProfilePreview["schema"];
    timestamp: string;
    operations: ProfileOperation[];
  };
  if (publicPreview.schema !== "aiw.hermes-profile-preview/0.12")
    throw new Error("Profile preview schema is invalid");
  const applied = applyHermesProfileChange({
    ...publicPreview,
    outputRoot: path.dirname(previewPath),
    previewPath,
    profileRoot,
    pluginSource,
    apiServerKey,
  });
  process.stdout.write(
    `Profile change installed; backup manifest: ${applied.backupManifestPath}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  void main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Hermes profile change failed"}\n`,
    );
    process.exitCode = 1;
  });
