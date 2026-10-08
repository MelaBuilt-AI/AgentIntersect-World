import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  existsSync,
  rmSync,
  writeFileSync,
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
        "0.15.0-rc.2",
      );
      assert.ok(existsSync(join(installed, "runtime", "node")));
      assert.ok(
        existsSync(join(installed, "apps", "local-server", "launch.mjs")),
      );
      assert.equal(
        JSON.parse(readFileSync(join(installed, "BUILD.json"), "utf8"))
          .sourceCommit,
        "7b97db1fb2c4490cabc0d606a0cf55585390c4bb",
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
