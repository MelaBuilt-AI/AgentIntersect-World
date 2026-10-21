import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, unlinkSync } from "node:fs";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  open,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir, homedir } from "node:os";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { createInterface } from "node:readline/promises";

const exec = promisify(execFile);
const repository = "MelaBuilt-AI/AgentIntersect-World";

async function present(filename) {
  try {
    await access(filename);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function runningDirectory(root) {
  const state =
    process.platform === "win32"
      ? process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local")
      : process.env.XDG_STATE_HOME || join(homedir(), ".local", "state");
  return join(
    state,
    "agentintersect-world",
    "running",
    createHash("sha256").update(resolve(root)).digest("hex"),
  );
}

export async function assertStopped(root) {
  const markers = await readdir(runningDirectory(root)).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  for (const marker of markers) {
    if (!/^[1-9][0-9]*$/.test(marker))
      throw new Error(
        "Unknown running-instance marker; inspect the installation before updating.",
      );
    try {
      process.kill(Number(marker), 0);
    } catch (error) {
      if (error.code === "ESRCH") continue;
      throw error;
    }
    throw new Error(
      "World is running. Close its window or type quit before updating.",
    );
  }
}

export async function markRunning(root) {
  const lock = `${root}.update.lock`;
  if (await present(lock))
    throw new Error("An update is in progress; start World after it finishes.");
  const marker = join(runningDirectory(root), String(process.pid));
  await mkdir(dirname(marker), { recursive: true });
  await writeFile(marker, "running\n", { flag: "wx" });
  const cleanup = () => {
    try {
      unlinkSync(marker);
    } catch {
      /* Already removed. */
    }
  };
  if (await present(lock)) {
    cleanup();
    throw new Error("An update is in progress; start World after it finishes.");
  }
  process.once("exit", cleanup);
  return cleanup;
}

export async function verifyArchive(filename, sha256) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  if (hash.digest("hex") !== sha256)
    throw new Error("Update checksum mismatch; installed files are unchanged.");
}

export async function installLinuxUpdate(root, archive, update) {
  root = resolve(root);
  const lockPath = `${root}.update.lock`;
  const lock = await open(lockPath, "wx", 0o600).catch(() => {
    throw new Error(
      "Cannot lock this installation. An update may be running, or this system installation needs its package manager.",
    );
  });
  let stage;
  try {
    await assertStopped(root);
    await access(root, constants.W_OK);
    const current = JSON.parse(
      await readFile(join(root, "BUILD.json"), "utf8"),
    );
    if (
      current.platform !== "linux-x64" ||
      !versionParts(current.version) ||
      compare(update.version, current.version) <= 0
    )
      throw new Error("Update is not newer than this Linux installation.");
    await verifyArchive(archive, update.sha256);
    const name = `AgentIntersect-World-${update.version}-linux-x64`;
    const listing = await exec("tar", ["-tzf", archive], {
      maxBuffer: 16 * 1024 * 1024,
    });
    for (const member of listing.stdout.trim().split("\n")) {
      if (
        !(member === name || member.startsWith(`${name}/`)) ||
        member.split("/").includes("..") ||
        member.includes("\\")
      )
        throw new Error("Unsafe update archive path.");
    }
    const types = await exec("tar", ["-tvzf", archive], {
      maxBuffer: 16 * 1024 * 1024,
    });
    if (
      types.stdout
        .trim()
        .split("\n")
        .some((line) => !["-", "d"].includes(line[0]))
    )
      throw new Error("Update archive contains links or special files.");
    stage = await mkdtemp(join(dirname(root), ".aiw-update-"));
    await exec(
      "tar",
      [
        "-xzf",
        archive,
        "--no-same-owner",
        "--no-same-permissions",
        "-C",
        stage,
      ],
      { maxBuffer: 1024 * 1024 },
    );
    const extracted = join(stage, name);
    const build = JSON.parse(
      await readFile(join(extracted, "BUILD.json"), "utf8"),
    );
    if (
      build.version !== update.version ||
      build.platform !== "linux-x64" ||
      build.sourceDirty !== false
    )
      throw new Error("Update build identity mismatch.");
    for (const required of [
      "agentintersect-world",
      "runtime/node",
      "apps/local-server/cli.mjs",
    ])
      await access(join(extracted, required));
    const backup = `${root}.previous-${current.version}-${Date.now()}`;
    await rename(root, backup);
    try {
      await rename(extracted, root);
    } catch (error) {
      await rename(backup, root);
      throw error;
    }
    return backup;
  } finally {
    if (stage) await rm(stage, { recursive: true, force: true });
    await lock.close();
    await rm(lockPath, { force: true });
  }
}

async function publishedReleases() {
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const response = await fetch(
      `https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`,
      {
        headers: {
          accept: "application/vnd.github+json",
          "user-agent": "AgentIntersect-World-updater",
        },
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok)
      throw new Error(
        `Release check failed (HTTP ${response.status}). Installed files are unchanged.`,
      );
    const entries = await response.json();
    if (!Array.isArray(entries)) throw new Error("Invalid release listing.");
    all.push(...entries);
    if (entries.length < 100) return all;
  }
  throw new Error(
    "Release listing exceeded the supported bound; no update selected.",
  );
}

async function download(update, destination) {
  const response = await fetch(update.asset.browser_download_url, {
    signal: AbortSignal.timeout(600000),
  });
  if (!response.ok || !response.body)
    throw new Error(`Update download failed (HTTP ${response.status}).`);
  let bytes = 0;
  await pipeline(
    response.body,
    new Transform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        callback(
          bytes > update.asset.size || bytes > 2 * 1024 ** 3
            ? new Error("Update download exceeded its declared size.")
            : null,
          chunk,
        );
      },
    }),
    createWriteStream(destination, { flags: "wx", mode: 0o700 }),
  );
  if (bytes !== update.asset.size)
    throw new Error("Update download size mismatch.");
  await verifyArchive(destination, update.sha256);
}

export async function runUpdate(root, args) {
  if (args.some((arg) => !["--check", "--yes"].includes(arg)))
    throw new Error("Usage: agentintersect-world update [--check] [--yes]");
  const build = JSON.parse(await readFile(join(root, "BUILD.json"), "utf8"));
  if (!["linux-x64", "windows-x64"].includes(build.platform))
    throw new Error("This platform does not support installed updates.");
  if (build.sourceDirty)
    throw new Error("Development builds do not update themselves.");
  const installation = await readFile(join(root, "INSTALLATION.json"), "utf8")
    .then(JSON.parse)
    .catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
  const debian = build.platform === "linux-x64" && installation?.type === "deb";
  const update = selectUpdate(
    await publishedReleases(),
    build.version,
    debian ? "linux-deb" : build.platform,
  );
  if (!update) {
    console.log(
      `AgentIntersect World ${build.version} is up to date for its release channel.`,
    );
    return;
  }
  console.log(`Update available: ${build.version} → ${update.version}`);
  if (args.includes("--check")) return;
  await assertStopped(root);
  console.log(
    "Saved state and agent profiles are not removed. Close World before continuing.",
  );
  if (!args.includes("--yes")) {
    if (!process.stdin.isTTY)
      throw new Error(
        "Run interactively to approve the update, or pass --yes.",
      );
    const input = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      if (
        !/^y(?:es)?$/i.test(
          (
            await input.question("Download and apply this update? [y/N] ")
          ).trim(),
        )
      )
        return;
    } finally {
      input.close();
    }
  }
  const temp = await mkdtemp(join(tmpdir(), "aiw-download-"));
  let keepDownload = false;
  try {
    const archive = join(temp, update.asset.name);
    await download(update, archive);
    if (debian) {
      await assertStopped(root);
      console.log(
        "Applying the verified Debian package using sudo dpkg. Your system may ask for its password.",
      );
      const child = spawn("sudo", ["dpkg", "-i", archive], {
        stdio: "inherit",
      });
      await new Promise((done, fail) => {
        child.once("error", fail);
        child.once("exit", (code) =>
          code === 0
            ? done()
            : fail(
                new Error(
                  `Package update failed (${code}); inspect dpkg output before retrying.`,
                ),
              ),
        );
      });
      const installed = JSON.parse(
        await readFile(join(root, "BUILD.json"), "utf8"),
      );
      if (installed.version !== update.version)
        throw new Error(
          "Package manager finished but installed version did not verify.",
        );
      console.log(`Updated to ${update.version}. Saved state is unchanged.`);
    } else if (build.platform === "linux-x64") {
      const backup = await installLinuxUpdate(root, archive, update);
      console.log(
        `Updated to ${update.version}. Previous installation retained: ${backup}\nStart World using your usual command. Saved state is unchanged.`,
      );
    } else {
      await assertStopped(root);
      const child = spawn(
        archive,
        [`/DIR=${root}`, "/CLOSEAPPLICATIONS", "/NORESTART"],
        { detached: true, stdio: "ignore", windowsHide: false },
      );
      await new Promise((resolveSpawn, reject) => {
        child.once("spawn", resolveSpawn);
        child.once("error", reject);
      });
      child.unref();
      keepDownload = true;
      console.log(
        `Verified installer opened. Follow its prompts to finish updating; this command has not verified installation completion. Download retained: ${archive}`,
      );
    }
  } finally {
    if (!keepDownload) await rm(temp, { recursive: true, force: true });
  }
}

function versionParts(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/.exec(value);
  return match
    ? [
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
        match[4] === undefined ? Infinity : Number(match[4]),
      ]
    : null;
}

function compare(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  }
  return 0;
}

export function selectUpdate(releases, current, platform) {
  if (!versionParts(current))
    throw new Error("Installed version is not a supported release version.");
  const candidates = releases.filter(
    (r) =>
      !r.draft &&
      typeof r.tag_name === "string" &&
      versionParts(r.tag_name.slice(1)) &&
      r.tag_name.startsWith("v") &&
      (current.includes("-rc.") ||
        (!r.prerelease && !r.tag_name.includes("-"))) &&
      compare(r.tag_name.slice(1), current) > 0,
  );
  candidates.sort((a, b) => compare(b.tag_name.slice(1), a.tag_name.slice(1)));
  if (!candidates.length) return null;
  const release = candidates[0];
  const version = release.tag_name.slice(1);
  const suffix =
    platform === "windows-x64"
      ? "-windows-x64-setup.exe"
      : platform === "linux-deb"
        ? "-linux-x64.deb"
        : "-linux-x64.tar.gz";
  const assets = release.assets.filter(
    (a) =>
      a.name.startsWith(`AgentIntersect-World-${version}-`) &&
      a.name.endsWith(suffix),
  );
  if (assets.length !== 1)
    throw new Error(
      "The release does not have exactly one compatible update asset.",
    );
  const asset = assets[0];
  if (!/^sha256:[a-f0-9]{64}$/.test(asset.digest ?? ""))
    throw new Error(
      "The release asset lacks a SHA-256 digest; update refused.",
    );
  const expectedUrl = `https://github.com/${repository}/releases/download/v${version}/${asset.name}`;
  if (
    asset.browser_download_url !== expectedUrl ||
    !/^[A-Za-z0-9._-]+$/.test(asset.name)
  )
    throw new Error("Release asset URL is outside the canonical repository.");
  return { version, asset, sha256: asset.digest.slice(7) };
}
