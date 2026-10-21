import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const updater = await import("../../apps/local-server/update.mjs").catch(
  () => null,
);
const release = (version, extra = {}) => ({
  tag_name: `v${version}`,
  draft: false,
  prerelease: version.includes("-"),
  assets: [
    {
      name: `AgentIntersect-World-${version}-linux-x64.tar.gz`,
      digest: `sha256:${"a".repeat(64)}`,
      browser_download_url: `https://github.com/MelaBuilt-AI/AgentIntersect-World/releases/download/v${version}/AgentIntersect-World-${version}-linux-x64.tar.gz`,
      size: 1,
    },
  ],
  ...extra,
});

test("selects only a newer compatible published release with an exact verified asset", () => {
  assert.ok(updater, "installed updater is missing");
  const found = updater.selectUpdate(
    [
      release("0.15.0-rc.3"),
      release("0.15.0-rc.9", { draft: true }),
      release("0.15.0-rc.2"),
    ],
    "0.15.0-rc.2",
    "linux-x64",
  );
  assert.equal(found.version, "0.15.0-rc.3");
  assert.equal(
    updater.selectUpdate([release("0.15.0-rc.2")], "0.15.0-rc.3", "linux-x64"),
    null,
  );
  assert.equal(
    updater.selectUpdate([release("0.16.0-rc.1")], "0.15.0", "linux-x64"),
    null,
  );
  assert.equal(
    updater.selectUpdate([release("0.15.0")], "0.15.0-rc.3", "linux-x64")
      .version,
    "0.15.0",
  );
  assert.throws(
    () =>
      updater.selectUpdate(
        [
          release("0.15.0-rc.3", {
            assets: [{ ...release("0.15.0-rc.3").assets[0], digest: null }],
          }),
        ],
        "0.15.0-rc.2",
        "linux-x64",
      ),
    /digest|checksum/i,
  );
});

test(
  "Linux update verifies bytes, retains rollback and state, and refuses running instances",
  { skip: process.platform !== "linux" },
  async () => {
    assert.equal(
      typeof updater.installLinuxUpdate,
      "function",
      "Linux updater missing",
    );
    const temp = await mkdtemp(path.join(tmpdir(), "aiw-update-test-"));
    try {
      const root = path.join(temp, "installed app");
      const build = {
        version: "0.15.0-rc.2",
        platform: "linux-x64",
        sourceDirty: false,
      };
      await mkdir(root);
      await writeFile(path.join(root, "BUILD.json"), JSON.stringify(build));
      await writeFile(path.join(root, "owner-file"), "retained in backup");
      const state = path.join(temp, "saved-state");
      await writeFile(state, "do not touch");
      const name = "AgentIntersect-World-0.15.0-rc.3-linux-x64";
      const payload = path.join(temp, name);
      await mkdir(path.join(payload, "apps/local-server"), { recursive: true });
      await mkdir(path.join(payload, "runtime"));
      await writeFile(
        path.join(payload, "BUILD.json"),
        JSON.stringify({ ...build, version: "0.15.0-rc.3" }),
      );
      await writeFile(
        path.join(payload, "agentintersect-world"),
        "#!/bin/sh\nexit 0\n",
        { mode: 0o755 },
      );
      await writeFile(path.join(payload, "runtime/node"), "fixture");
      await writeFile(
        path.join(payload, "apps/local-server/cli.mjs"),
        "// fixture",
      );
      const archive = path.join(temp, "update.tar.gz");
      execFileSync("tar", ["-czf", archive, "-C", temp, name]);
      const sha256 = createHash("sha256")
        .update(await readFile(archive))
        .digest("hex");
      const update = { version: "0.15.0-rc.3", sha256 };
      await assert.rejects(
        updater.installLinuxUpdate(root, archive, {
          ...update,
          sha256: "0".repeat(64),
        }),
        /checksum/i,
      );
      assert.equal(
        JSON.parse(await readFile(path.join(root, "BUILD.json"))).version,
        build.version,
      );
      const cleanup = await updater.markRunning(root);
      await assert.rejects(
        updater.installLinuxUpdate(root, archive, update),
        /running|close/i,
      );
      cleanup();
      const backup = await updater.installLinuxUpdate(root, archive, update);
      assert.equal(
        JSON.parse(await readFile(path.join(root, "BUILD.json"))).version,
        update.version,
      );
      assert.equal(
        await readFile(path.join(backup, "owner-file"), "utf8"),
        "retained in backup",
      );
      assert.equal(await readFile(state, "utf8"), "do not touch");
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  },
);

test("Debian installations select the package-manager payload", () => {
  const item = release("0.15.0-rc.3");
  item.assets[0].name = item.assets[0].name.replace(".tar.gz", ".deb");
  item.assets[0].browser_download_url =
    item.assets[0].browser_download_url.replace(".tar.gz", ".deb");
  assert.equal(
    updater
      .selectUpdate([item], "0.15.0-rc.2", "linux-deb")
      .asset.name.endsWith(".deb"),
    true,
  );
});

test("installed CLI exposes update help without starting World", () => {
  let output = "";
  try {
    output = execFileSync(
      process.execPath,
      ["apps/local-server/cli.mjs", "--help"],
      { encoding: "utf8" },
    );
  } catch {
    /* Assertion below reports the missing command. */
  }
  assert.match(output, /update \[--check\] \[--yes\]/);
  assert.doesNotMatch(output, /local server ready/);
});

test("rejects a release asset URL outside the canonical repository", () => {
  assert.ok(updater);
  assert.throws(
    () =>
      updater.selectUpdate(
        [
          release("0.15.0-rc.3", {
            assets: [
              {
                ...release("0.15.0-rc.3").assets[0],
                browser_download_url: "https://example.com/payload",
              },
            ],
          }),
        ],
        "0.15.0-rc.2",
        "linux-x64",
      ),
    /URL|origin/i,
  );
});
