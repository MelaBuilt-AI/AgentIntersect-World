#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";

const version = "0.15.0-rc.2";
const name = `AgentIntersect-World-${version}-linux-x64`;
const sha256 =
  "aab167c13ab20ca98dd721b56a8f5d34f394913969512f1fcbca84bff7b3b9d7";
const url = `https://github.com/MelaBuilt-AI/AgentIntersect-World/releases/download/v${version}/${name}.tar.gz`;

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function checkSha(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  if (hash.digest("hex") !== sha256)
    throw new Error("Archive checksum mismatch; nothing installed");
}

async function unpack(archive, destination) {
  await new Promise((done, fail) => {
    const child = spawn(
      "tar",
      [
        "-xzf",
        archive,
        "--no-same-owner",
        "--no-same-permissions",
        "-C",
        destination,
      ],
      { stdio: "inherit" },
    );
    child.on("error", fail);
    child.on("exit", (code) =>
      code === 0 ? done() : fail(new Error(`tar exited with ${code}`)),
    );
  });
}

async function install(archive) {
  if (
    process.platform !== "linux" ||
    process.arch !== "x64" ||
    !process.report.getReport().header.glibcVersionRuntime
  ) {
    throw new Error("Only Linux x64 with glibc is supported by this package");
  }
  const home = process.env.HOME || homedir();
  const root = join(
    process.env.XDG_DATA_HOME || join(home, ".local", "share"),
    "agentintersect-world",
    "versions",
  );
  const target = join(root, version);
  const bin = join(
    process.env.XDG_BIN_HOME || join(home, ".local", "bin"),
    "agentintersect-world",
  );
  const launcher = join(target, "agentintersect-world");
  const wrapper = `#!/bin/sh\n# AgentIntersect World npm installer\nexec '${launcher.replaceAll("'", "'\\''")}' "$@"\n`;
  if ((await exists(bin)) && (await readFile(bin, "utf8")) !== wrapper) {
    throw new Error(`Refusing to replace an unrelated command: ${bin}`);
  }
  if (await exists(target)) {
    if (!(await exists(launcher)))
      throw new Error(
        `Incomplete installation at ${target}; inspect it manually`,
      );
    console.log(
      `AgentIntersect World ${version} already installed at ${target}`,
    );
  } else {
    await mkdir(root, { recursive: true });
    const stage = await mkdtemp(join(root, ".install-"));
    try {
      let source = archive;
      if (!source) {
        source = join(stage, `${name}.tar.gz`);
        console.log(`Downloading ${url}`);
        const response = await fetch(url);
        if (!response.ok || !response.body)
          throw new Error(`Download failed (HTTP ${response.status})`);
        await pipeline(response.body, createWriteStream(source));
      }
      await checkSha(source);
      await unpack(source, stage);
      const extracted = join(stage, name);
      if (!(await exists(join(extracted, "agentintersect-world"))))
        throw new Error("Archive lacks its launcher");
      const build = JSON.parse(
        await readFile(join(extracted, "BUILD.json"), "utf8"),
      );
      if (
        build.version !== version ||
        build.platform !== "linux-x64" ||
        build.sourceDirty
      )
        throw new Error("Archive identity mismatch");
      await rename(extracted, target);
    } finally {
      await rm(stage, { recursive: true, force: true });
    }
  }
  await mkdir(dirname(bin), { recursive: true });
  if (!(await exists(bin))) {
    const temporary = `${bin}.${process.pid}.tmp`;
    try {
      await writeFile(temporary, wrapper, { flag: "wx", mode: 0o755 });
      await chmod(temporary, 0o755);
      await rename(temporary, bin);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  const icon = join(target, "agentintersect-appicon-512.png");
  const desktop = join(
    process.env.XDG_DATA_HOME || join(home, ".local", "share"),
    "applications",
    "agentintersect-world.desktop",
  );
  await mkdir(dirname(desktop), { recursive: true });
  await writeFile(
    desktop,
    `[Desktop Entry]\nType=Application\nName=AgentIntersect World\nComment=Your code becomes a place\nExec="${launcher}"\n${(await exists(icon)) ? `Icon=${icon}\n` : ""}Terminal=true\nCategories=Development;\n`,
  );
  console.log(`Installed: ${target}\nLaunch: ${bin}`);
  if (!process.env.PATH?.split(":").includes(dirname(bin)))
    console.log(`Add ${dirname(bin)} to PATH to use: agentintersect-world`);
}

async function main() {
  const args = process.argv.slice(2);
  if (
    args[0] !== "install" ||
    ![1, 3].includes(args.length) ||
    (args.length === 3 && args[1] !== "--archive")
  ) {
    throw new Error(
      "Usage: agentintersect-world-install install [--archive /path/to/verified-linux-x64.tar.gz]",
    );
  }
  await install(args[2] ? resolve(args[2]) : undefined);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
