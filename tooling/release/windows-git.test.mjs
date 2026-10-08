import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configureBundledGit } from "../../apps/local-server/windows-git.mjs";

test("bundled Git is inherited without changing caller or global configuration", async () => {
  const root = await mkdtemp(join(tmpdir(), "aiw-git-env-"));
  try {
    await mkdir(join(root, "cmd"));
    await mkdir(join(root, "bin"));
    await writeFile(join(root, "cmd", "git.exe"), "fixture");
    await writeFile(join(root, "bin", "bash.exe"), "fixture");
    const original = { Path: "C:\\Windows\\System32", HOME: "existing-home" };
    const env = { ...original };
    await configureBundledGit(root, env, "win32");
    assert.equal(
      env.Path,
      `${join(root, "cmd")};${join(root, "bin")};${original.Path}`,
    );
    assert.equal(env.CLAUDE_CODE_GIT_BASH_PATH, join(root, "bin", "bash.exe"));
    assert.equal(env.HOME, original.HOME);
    assert.deepEqual(original, {
      Path: "C:\\Windows\\System32",
      HOME: "existing-home",
    });
    assert.equal(
      env.PATH,
      undefined,
      "Windows must not get duplicate case-insensitive PATH keys",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("source/Linux launches remain unchanged when no bundle is present", async () => {
  const env = { PATH: "original", CLAUDE_CODE_GIT_BASH_PATH: "custom" };
  await configureBundledGit("/does-not-exist", env, "linux");
  await configureBundledGit("/does-not-exist", env, "win32");
  assert.deepEqual(env, {
    PATH: "original",
    CLAUDE_CODE_GIT_BASH_PATH: "custom",
  });
});

test("an incomplete bundled Git fails rather than silently using system Git", async () => {
  const root = await mkdtemp(join(tmpdir(), "aiw-git-missing-"));
  try {
    await assert.rejects(configureBundledGit(root, {}, "win32"), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
