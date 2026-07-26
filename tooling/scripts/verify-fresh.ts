import { spawn } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

async function capture(
  command: string,
  args: readonly string[],
): Promise<Buffer> {
  return await new Promise((resolveOutput, reject) => {
    const child = spawn(command, args, {
      cwd: resolve("."),
      stdio: ["ignore", "pipe", "inherit"],
    });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolveOutput(Buffer.concat(chunks));
      else reject(new Error(`${command} exited with ${String(code)}`));
    });
  });
}

async function run(
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<void> {
  await new Promise<void>((resolveExit, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, CI: "1" },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveExit();
      else
        reject(
          new Error(
            `${command} ${args.join(" ")} failed (${String(code ?? signal)})`,
          ),
        );
    });
  });
}

const temporaryRoot = await mkdtemp(
  resolve(tmpdir(), "agentintersect-world-phase11-"),
);
const freshRoot = resolve(temporaryRoot, "repo");
const expectedAvatarManifest = JSON.parse(
  await readFile("assets/avatar/aiw-avatar-kit.manifest.json", "utf8"),
);

try {
  await mkdir(freshRoot);
  const listed = await capture("git", [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
  ]);
  const files = listed.toString("utf8").split("\0").filter(Boolean);
  let copiedFiles = 0;
  for (const file of files) {
    try {
      await access(resolve(file));
    } catch {
      continue;
    }
    const destination = resolve(freshRoot, file);
    await mkdir(dirname(destination), { recursive: true });
    await cp(resolve(file), destination, { dereference: false });
    copiedFiles += 1;
  }

  await run(
    "corepack",
    ["pnpm@11.15.0", "install", "--frozen-lockfile"],
    freshRoot,
  );
  await run("corepack", ["pnpm@11.15.0", "measure:phase10"], freshRoot);
  let blenderAvailable = true;
  try {
    await access("/usr/local/bin/blender");
  } catch {
    blenderAvailable = false;
  }
  if (blenderAvailable) {
    await run("corepack", ["pnpm@11.15.0", "avatar:build"], freshRoot);
    await run("corepack", ["pnpm@11.15.0", "avatar:inspect"], freshRoot);
  }
  await run("corepack", ["pnpm@11.15.0", "avatar:verify"], freshRoot);
  if (blenderAvailable) {
    const regeneratedManifest = JSON.parse(
      await readFile(
        resolve(freshRoot, "assets/avatar/aiw-avatar-kit.manifest.json"),
        "utf8",
      ),
    );
    for (const file of [
      "apps/web/public/assets/avatar/aiw-avatar-kit.glb",
      "apps/web/public/assets/avatar/aiw-avatar-contact-sheet.png",
      "apps/web/public/assets/avatar/aiw-avatar-motion-sheet.png",
    ]) {
      if (
        regeneratedManifest.files[file].sha256 !==
        expectedAvatarManifest.files[file].sha256
      )
        throw new Error(`Fresh avatar regeneration differed for ${file}`);
    }
  }
  await run("corepack", ["pnpm@11.15.0", "measure:phase11"], freshRoot);
  await run(
    "corepack",
    [
      "pnpm@11.15.0",
      "exec",
      "prettier",
      "--write",
      "artifacts/phase18-5/phase18-5-measurement.json",
      "assets/avatar/aiw-avatar-kit.glb-inspection.json",
    ],
    freshRoot,
  );
  await run("corepack", ["pnpm@11.15.0", "check"], freshRoot);
  process.stdout.write(
    `Fresh verification passed for ${copiedFiles} project source files.\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
