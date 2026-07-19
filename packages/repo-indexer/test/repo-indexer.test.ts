import { execFile } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { RepositoryIndexError, indexRepository } from "../src/index.js";

const execFileAsync = promisify(execFile);
const roots: string[] = [];

async function fixture(prefix = "aiw-phase3-indexer-") {
  const root = await mkdtemp(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

async function git(root: string, ...args: string[]) {
  await execFileAsync("git", [
    "-c",
    "core.hooksPath=/dev/null",
    "-C",
    root,
    ...args,
  ]);
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("deterministic repository metadata index", () => {
  it("indexes a non-Git root with ignores, packages, classifications, binary, oversize, and symlink skips", async () => {
    const root = await fixture();
    const external = await fixture("aiw-phase3-external-");
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "node_modules", "bad"), { recursive: true });
    await mkdir(join(root, "ignored"), { recursive: true });
    await writeFile(join(root, ".gitignore"), "ignored/\n");
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "safe-fixture",
        scripts: { postinstall: "touch SHOULD_NOT_EXIST" },
      }),
    );
    await writeFile(
      join(root, "src", "main.ts"),
      "export const answer = 42;\n",
    );
    await writeFile(
      join(root, "image.png"),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0]),
    );
    await writeFile(
      join(root, "large.bin"),
      Buffer.alloc(2 * 1024 * 1024 + 1, 1),
    );
    await writeFile(join(root, "ignored", "hidden.ts"), "hidden");
    await writeFile(join(root, "ignored", "also-hidden.ts"), "hidden too");
    await writeFile(join(root, "node_modules", "bad", "index.js"), "bad");
    await writeFile(join(root, "node_modules", "bad", "other.js"), "also bad");
    await writeFile(join(external, "outside.ts"), "outside");
    await symlink(join(external, "outside.ts"), join(root, "escape.ts"));

    const beforePackage = await readFile(join(root, "package.json"), "utf8");
    const result = await indexRepository({ rootPath: root });
    expect(result.git.present).toBe(false);
    expect(result.files.map((file) => file.path)).toEqual([
      ".gitignore",
      "image.png",
      "large.bin",
      "package.json",
      "src/main.ts",
    ]);
    expect(
      result.files.find((file) => file.path === "src/main.ts"),
    ).toMatchObject({
      language: "typescript",
      fileKind: "source",
      binary: false,
    });
    expect(
      result.files.find((file) => file.path === "image.png"),
    ).toMatchObject({ fileKind: "asset", binary: true });
    expect(
      result.files.find((file) => file.path === "large.bin"),
    ).toMatchObject({ oversized: true, contentHash: null });
    expect(result.packages).toEqual([
      expect.objectContaining({
        path: "package.json",
        kind: "npm",
        name: "safe-fixture",
      }),
    ]);
    expect(result.coverage.skippedSymlinks).toBe(1);
    expect(result.coverage.prunedEntries).toBe(2);
    expect(await readFile(join(root, "package.json"), "utf8")).toBe(
      beforePackage,
    );
    await expect(
      readFile(join(root, "SHOULD_NOT_EXIST"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("reads hardened Git metadata/status without running hooks and changes fingerprints only for relevant changes", async () => {
    const root = await fixture();
    await git(root, "init", "-b", "phase3-test");
    await git(root, "config", "user.name", "Phase 3 Test");
    await git(root, "config", "user.email", "phase3@example.invalid");
    await mkdir(join(root, ".git", "hooks"), { recursive: true });
    await writeFile(
      join(root, ".git", "hooks", "post-index-change"),
      "#!/bin/sh\ntouch HOOK_EXECUTED\n",
      { mode: 0o755 },
    );
    await writeFile(join(root, "tracked.ts"), "export const value = 1;\n");
    await git(root, "add", "tracked.ts");
    await git(root, "commit", "-m", "fixture");
    await writeFile(join(root, "untracked.py"), "value = 1\n");

    const first = await indexRepository({ rootPath: root });
    const same = await indexRepository({ rootPath: root });
    expect(first.git).toMatchObject({
      present: true,
      branch: "phase3-test",
      dirty: true,
    });
    expect(first.git.head).toMatch(/^[0-9a-f]{40}$/);
    expect(
      first.files.find((file) => file.path === "untracked.py")?.gitStatus,
    ).toBe("??");
    expect(same.fingerprint).toBe(first.fingerprint);
    await writeFile(join(root, "tracked.ts"), "export const value = 2;\n");
    const changed = await indexRepository({ rootPath: root });
    expect(changed.fingerprint).not.toBe(first.fingerprint);
    expect(
      changed.files.find((file) => file.path === "tracked.ts")?.gitStatus,
    ).toContain("M");
    await expect(
      readFile(join(root, "HOOK_EXECUTED"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects invalid roots and bounds file counts", async () => {
    const root = await fixture();
    const file = join(root, "file.txt");
    await writeFile(file, "x");
    await expect(
      indexRepository({ rootPath: join(root, "missing") }),
    ).rejects.toMatchObject({ code: "invalid_root" });
    await expect(indexRepository({ rootPath: file })).rejects.toMatchObject({
      code: "invalid_root",
    });
    await writeFile(join(root, "second.txt"), "y");
    await expect(
      indexRepository({ rootPath: root, maxFiles: 1 }),
    ).rejects.toEqual(expect.any(RepositoryIndexError));
  });

  it("discovers all frozen package manifest kinds with safely extracted names", async () => {
    const root = await fixture();
    await writeFile(join(root, "package.json"), '{"name":"npm-name"}');
    await writeFile(
      join(root, "pyproject.toml"),
      '[project]\nname = "python-name"\n',
    );
    await writeFile(
      join(root, "Cargo.toml"),
      '[package]\nname = "cargo-name"\n',
    );
    await writeFile(join(root, "go.mod"), "module example.test/go-name\n");
    await writeFile(
      join(root, "pom.xml"),
      "<project><artifactId>maven-name</artifactId></project>",
    );
    const result = await indexRepository({ rootPath: root });
    expect(result.packages).toEqual([
      { path: "Cargo.toml", kind: "cargo", name: "cargo-name" },
      { path: "go.mod", kind: "go", name: "example.test/go-name" },
      { path: "package.json", kind: "npm", name: "npm-name" },
      { path: "pom.xml", kind: "maven", name: "maven-name" },
      { path: "pyproject.toml", kind: "python", name: "python-name" },
    ]);
  });

  it("extracts only an unambiguous direct Maven project artifact", async () => {
    const root = await fixture();
    await mkdir(join(root, "missing"), { recursive: true });
    await mkdir(join(root, "ambiguous"), { recursive: true });
    await writeFile(
      join(root, "pom.xml"),
      `<project>
        <parent><artifactId>parent-artifact</artifactId></parent>
        <dependencies>
          <dependency><artifactId>dependency-before</artifactId></dependency>
        </dependencies>
        <artifactId>direct-project</artifactId>
        <build><plugins>
          <plugin><artifactId>plugin-after</artifactId></plugin>
        </plugins></build>
      </project>`,
    );
    await writeFile(
      join(root, "missing", "pom.xml"),
      "<project><parent><artifactId>parent-only</artifactId></parent></project>",
    );
    await writeFile(
      join(root, "ambiguous", "pom.xml"),
      "<project><artifactId>one</artifactId><artifactId>two</artifactId></project>",
    );

    const result = await indexRepository({ rootPath: root });
    expect(result.packages).toEqual([
      { path: "ambiguous/pom.xml", kind: "maven", name: null },
      { path: "missing/pom.xml", kind: "maven", name: null },
      { path: "pom.xml", kind: "maven", name: "direct-project" },
    ]);
  });

  it("reports progress and promptly cooperates with cancellation", async () => {
    const root = await fixture();
    for (let index = 0; index < 500; index += 1)
      await writeFile(
        join(root, `file-${String(index).padStart(4, "0")}.ts`),
        `export const n = ${index};\n`,
      );
    const controller = new AbortController();
    const progress: string[] = [];
    const indexing = indexRepository({
      rootPath: root,
      signal: controller.signal,
      onProgress(value) {
        progress.push(value.phase);
        if (value.discoveredFiles >= 25) controller.abort();
      },
    });
    await expect(indexing).rejects.toMatchObject({ code: "cancelled" });
    expect(progress).toContain("discovering");
  });

  it("keeps later files as metadata after exhausting the cumulative hash budget", async () => {
    const root = await fixture();
    const twoMiB = Buffer.alloc(2 * 1024 * 1024, 97);
    for (let index = 0; index < 33; index += 1)
      await writeFile(
        join(root, `budget-${String(index).padStart(2, "0")}.txt`),
        twoMiB,
      );

    const result = await indexRepository({ rootPath: root });
    expect(result.coverage.bytesHashed).toBe(64 * 1024 * 1024);
    expect(result.files.at(-1)).toMatchObject({
      path: "budget-32.txt",
      size: 2 * 1024 * 1024,
      oversized: false,
      contentHash: null,
    });
  });
});
