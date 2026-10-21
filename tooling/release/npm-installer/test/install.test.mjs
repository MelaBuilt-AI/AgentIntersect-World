import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  existsSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const cli = new URL("../install.mjs", import.meta.url);
const archive = process.env.AIW_TEST_ARCHIVE;

function withHome(callback) {
  const home = mkdtempSync(join(tmpdir(), "aiw-npm-install-"));
  try {
    return callback(home, {
      ...process.env,
      HOME: home,
      XDG_DATA_HOME: join(home, "data"),
      XDG_BIN_HOME: join(home, "bin"),
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

test("upgrades its own older wrapper while preserving the old installation and refusing unrelated commands", () =>
  withHome((home, env) => {
    const version = /const version = "([^"]+)"/.exec(
      readFileSync(cli, "utf8"),
    )[1];
    const versions = join(home, "data", "agentintersect-world", "versions");
    const old = join(versions, "0.14.0");
    const current = join(versions, version);
    for (const dir of [old, current]) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "agentintersect-world"), "#!/bin/sh\nexit 0\n");
      writeFileSync(
        join(dir, "BUILD.json"),
        JSON.stringify({
          version: dir === old ? "0.14.0" : version,
          platform: "linux-x64",
          sourceDirty: false,
        }),
      );
    }
    mkdirSync(env.XDG_BIN_HOME, { recursive: true });
    const bin = join(env.XDG_BIN_HOME, "agentintersect-world");
    writeFileSync(
      bin,
      `#!/bin/sh\n# AgentIntersect World npm installer\nexec '${join(old, "agentintersect-world")}' "$@"\n`,
    );
    let result = spawnSync(process.execPath, [cli.pathname, "install"], {
      env,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(readFileSync(bin, "utf8").includes(current));
    assert.ok(existsSync(join(old, "BUILD.json")));
    writeFileSync(
      bin,
      "#!/bin/sh\n# AgentIntersect World npm installer\necho unrelated\n",
    );
    result = spawnSync(process.execPath, [cli.pathname, "install"], {
      env,
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unrelated command/);
    assert.match(readFileSync(bin, "utf8"), /echo unrelated/);
  }));

test("rejects an archive with the wrong digest without installing", () =>
  withHome((home, env) => {
    const bad = join(home, "bad.tar.gz");
    writeFileSync(bad, "not the release archive");
    const result = spawnSync(
      process.execPath,
      [cli.pathname, "install", "--archive", bad],
      { env, encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /checksum mismatch/i);
    assert.equal(existsSync(join(home, "bin", "agentintersect-world")), false);
  }));

test(
  "installs the verified portable archive and invokes its bundled launcher",
  { skip: !archive },
  () =>
    withHome((home, env) => {
      const run = () =>
        spawnSync(
          process.execPath,
          [cli.pathname, "install", "--archive", archive],
          { env, encoding: "utf8", timeout: 240_000 },
        );
      const result = run();
      assert.equal(result.status, 0, result.stderr);
      const command = join(home, "bin", "agentintersect-world");
      assert.ok(existsSync(command));
      assert.match(
        readFileSync(command, "utf8"),
        /AgentIntersect World npm installer/,
      );
      const installed = join(
        home,
        "data",
        "agentintersect-world",
        "versions",
        "0.15.0-rc.3",
      );
      assert.ok(existsSync(join(installed, "runtime", "node")));
      assert.ok(
        existsSync(join(installed, "apps", "local-server", "launch.mjs")),
      );
      assert.equal(
        JSON.parse(readFileSync(join(installed, "BUILD.json"), "utf8"))
          .sourceCommit,
        "39ce7448ca5fca7c84c5cbb4009bd283c5bee8cc",
      );
      const repeat = run();
      assert.equal(repeat.status, 0, repeat.stderr);
      assert.match(repeat.stdout, /already installed/i);
      const syntax = spawnSync("sh", ["-n", command], {
        env,
        encoding: "utf8",
      });
      assert.equal(syntax.status, 0, syntax.stderr);
      const runtime = spawnSync(
        join(installed, "runtime", "node"),
        ["--version"],
        { env, encoding: "utf8" },
      );
      assert.equal(runtime.status, 0, runtime.stderr);
      assert.match(runtime.stdout, /^v24\.18\.0/);
      const launch = spawnSync(command, ["--no-open"], {
        env: { ...env, AIW_APP_PORT: "1", AIW_PORT: "1" },
        encoding: "utf8",
        timeout: 10_000,
      });
      assert.notEqual(launch.status, 0);
      assert.match(launch.stderr, /Use two distinct valid AIW_APP_PORT/);
    }),
);
