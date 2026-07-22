import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import {
  applyHermesProfileChange,
  createHermesProfilePreview,
  restoreHermesProfileBackup,
} from "./hermes-profile-change.js";

const roots: string[] = [];
const hermesRuntime =
  process.env.AIW_HERMES_TEST_RUNTIME ??
  path.join(os.homedir(), ".hermes", "hermes-agent");
const hermesPython =
  process.env.AIW_HERMES_TEST_PYTHON ??
  path.join(hermesRuntime, "venv", "bin", "python3");
const hermesDiscoveryIt =
  fs.existsSync(hermesPython) &&
  fs.existsSync(path.join(hermesRuntime, "hermes_cli"))
    ? it
    : it.skip;
const temp = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-hermes-profile-"));
  roots.push(root);
  return root;
};
const installFreshPlugin = () => {
  const profile = temp();
  const output = temp();
  const source = path.resolve("integrations/hermes/agentintersect-world");
  fs.writeFileSync(path.join(profile, "config.yaml"), "plugins: {}\n", {
    mode: 0o600,
  });
  fs.writeFileSync(path.join(profile, ".env"), "FIXTURE_ONLY=true\n", {
    mode: 0o600,
  });
  const preview = createHermesProfilePreview({
    profileRoot: profile,
    pluginSource: source,
    outputRoot: output,
    apiServerKey: "generated-high-entropy-secret",
    timestamp: "20260721T060004Z",
  });
  const installed = applyHermesProfileChange({
    ...preview,
    profileRoot: profile,
    pluginSource: source,
    apiServerKey: "generated-high-entropy-secret",
  });
  return {
    profile,
    plugin: path.join(profile, "plugins", "agentintersect-world"),
    manifest: installed.backupManifestPath,
  };
};
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});

describe("deterministic parent-owned Hermes profile change", () => {
  it("previews hashes without secrets, installs only allowlisted paths, and restores byte-identically", () => {
    const profile = temp();
    const output = temp();
    const source = path.resolve("integrations/hermes/agentintersect-world");
    const config = "model: fixture\nplugins:\n  enabled:\n    - existing\n";
    const env = "PROVIDER_TOKEN=keep-secret\nAPI_SERVER_PORT=9000\n";
    fs.writeFileSync(path.join(profile, "config.yaml"), config, {
      mode: 0o600,
    });
    fs.writeFileSync(path.join(profile, ".env"), env, { mode: 0o600 });
    const preview = createHermesProfilePreview({
      profileRoot: profile,
      pluginSource: source,
      outputRoot: output,
      apiServerKey: "generated-high-entropy-secret",
      timestamp: "20260721T060000Z",
    });
    const previewText = fs.readFileSync(preview.previewPath, "utf8");
    expect(previewText).not.toMatch(/keep-secret|high-entropy|PROVIDER_TOKEN/);
    expect(
      preview.operations.map((operation) => operation.path).sort(),
    ).toEqual([
      ".env",
      "config.yaml",
      "plugins/agentintersect-world/__init__.py",
      "plugins/agentintersect-world/plugin.yaml",
    ]);
    const installed = applyHermesProfileChange({
      ...preview,
      profileRoot: profile,
      pluginSource: source,
      apiServerKey: "generated-high-entropy-secret",
    });
    expect(fs.readFileSync(path.join(profile, "config.yaml"), "utf8")).toMatch(
      /agentintersect-world/,
    );
    expect(fs.readFileSync(path.join(profile, ".env"), "utf8")).toMatch(
      /API_SERVER_HOST=127\.0\.0\.1/,
    );
    expect(fs.statSync(path.join(profile, ".env")).mode & 0o777).toBe(0o600);
    restoreHermesProfileBackup(installed.backupManifestPath, profile);
    expect(fs.readFileSync(path.join(profile, "config.yaml"), "utf8")).toBe(
      config,
    );
    expect(fs.readFileSync(path.join(profile, ".env"), "utf8")).toBe(env);
    expect(
      fs.existsSync(path.join(profile, "plugins", "agentintersect-world")),
    ).toBe(false);
    expect(fs.existsSync(path.join(profile, "agentintersect-world"))).toBe(
      false,
    );
  });

  it("fails closed when any previewed old hash drifts", () => {
    const profile = temp();
    const output = temp();
    fs.writeFileSync(path.join(profile, "config.yaml"), "plugins: {}\n");
    fs.writeFileSync(path.join(profile, ".env"), "UNCHANGED=value\n");
    const preview = createHermesProfilePreview({
      profileRoot: profile,
      pluginSource: path.resolve("integrations/hermes/agentintersect-world"),
      outputRoot: output,
      apiServerKey: "generated-high-entropy-secret",
      timestamp: "20260721T060001Z",
    });
    fs.appendFileSync(path.join(profile, "config.yaml"), "drift: true\n");
    expect(() =>
      applyHermesProfileChange({
        ...preview,
        profileRoot: profile,
        pluginSource: path.resolve("integrations/hermes/agentintersect-world"),
        apiServerKey: "generated-high-entropy-secret",
      }),
    ).toThrow(/drift/i);
    expect(fs.existsSync(path.join(profile, "plugins"))).toBe(false);
  });

  it("restores original file and directory modes without unrelated drift", () => {
    const profile = temp();
    const output = temp();
    const source = path.resolve("integrations/hermes/agentintersect-world");
    const plugins = path.join(profile, "plugins");
    const unrelated = path.join(plugins, "existing.txt");
    fs.chmodSync(profile, 0o750);
    fs.mkdirSync(plugins, { mode: 0o750 });
    fs.writeFileSync(path.join(profile, "config.yaml"), "plugins: {}\n", {
      mode: 0o640,
    });
    fs.writeFileSync(path.join(profile, ".env"), "FIXTURE_ONLY=true\n", {
      mode: 0o640,
    });
    fs.writeFileSync(unrelated, "unchanged\n", { mode: 0o644 });
    const before = {
      profile: fs.statSync(profile).mode & 0o777,
      plugins: fs.statSync(plugins).mode & 0o777,
      config: fs.statSync(path.join(profile, "config.yaml")).mode & 0o777,
      env: fs.statSync(path.join(profile, ".env")).mode & 0o777,
      unrelated: fs.statSync(unrelated).mode & 0o777,
      unrelatedBytes: fs.readFileSync(unrelated),
    };

    const preview = createHermesProfilePreview({
      profileRoot: profile,
      pluginSource: source,
      outputRoot: output,
      apiServerKey: "generated-high-entropy-secret",
      timestamp: "20260721T060003Z",
    });
    const installed = applyHermesProfileChange({
      ...preview,
      profileRoot: profile,
      pluginSource: source,
      apiServerKey: "generated-high-entropy-secret",
    });
    restoreHermesProfileBackup(installed.backupManifestPath, profile);

    expect(fs.statSync(profile).mode & 0o777).toBe(before.profile);
    expect(fs.statSync(plugins).mode & 0o777).toBe(before.plugins);
    expect(fs.statSync(path.join(profile, "config.yaml")).mode & 0o777).toBe(
      before.config,
    );
    expect(fs.statSync(path.join(profile, ".env")).mode & 0o777).toBe(
      before.env,
    );
    expect(fs.statSync(unrelated).mode & 0o777).toBe(before.unrelated);
    expect(fs.readFileSync(unrelated)).toEqual(before.unrelatedBytes);
    expect(fs.existsSync(path.join(plugins, "agentintersect-world"))).toBe(
      false,
    );
  });

  it("removes a generated CPython import cache while restoring a newly installed plugin", () => {
    const installed = installFreshPlugin();
    const cache = path.join(installed.plugin, "__pycache__");
    fs.mkdirSync(cache);
    fs.writeFileSync(
      path.join(cache, "__init__.cpython-313.pyc"),
      Buffer.from([0xa7, 0x0d, 0x0d, 0x0a]),
    );

    restoreHermesProfileBackup(installed.manifest, installed.profile);

    expect(fs.existsSync(installed.plugin)).toBe(false);
  });

  it("removes bounded Phase 13 proposal spool state from an isolated profile", () => {
    const installed = installFreshPlugin();
    const spool = path.join(
      installed.profile,
      "agentintersect-world",
      "world-action-proposals",
    );
    fs.mkdirSync(spool, { recursive: true, mode: 0o700 });
    fs.writeFileSync(
      path.join(spool, "00000000-0000-4000-8000-000000000001.json"),
      '{"schema":"aiw.hermes-world-action-proposal/0.13"}\n',
      { mode: 0o600 },
    );

    restoreHermesProfileBackup(installed.manifest, installed.profile);

    expect(
      fs.existsSync(path.join(installed.profile, "agentintersect-world")),
    ).toBe(false);
  });

  it("validates installed source hashes before removing an accepted import cache", () => {
    const installed = installFreshPlugin();
    const cache = path.join(installed.plugin, "__pycache__");
    const cacheFile = path.join(cache, "__init__.cpython-311.pyc");
    fs.mkdirSync(cache);
    fs.writeFileSync(cacheFile, "generated cache");
    fs.appendFileSync(path.join(installed.plugin, "__init__.py"), "# drift\n");

    expect(() =>
      restoreHermesProfileBackup(installed.manifest, installed.profile),
    ).toThrow(/Installed profile drift/);
    expect(fs.readFileSync(cacheFile, "utf8")).toBe("generated cache");
  });

  it("fails closed without deleting an unexpected plugin-root file", () => {
    const installed = installFreshPlugin();
    const unexpected = path.join(installed.plugin, "unexpected.txt");
    fs.writeFileSync(unexpected, "keep");

    expect(() =>
      restoreHermesProfileBackup(installed.manifest, installed.profile),
    ).toThrow(/unexpected drift/);
    expect(fs.readFileSync(unexpected, "utf8")).toBe("keep");
  });

  it("fails closed without deleting an unexpected import-cache filename", () => {
    const installed = installFreshPlugin();
    const cache = path.join(installed.plugin, "__pycache__");
    const unexpected = path.join(cache, "plugin.cpython-311.pyc");
    fs.mkdirSync(cache);
    fs.writeFileSync(unexpected, "keep");

    expect(() =>
      restoreHermesProfileBackup(installed.manifest, installed.profile),
    ).toThrow(/unexpected drift/);
    expect(fs.readFileSync(unexpected, "utf8")).toBe("keep");
  });

  it("fails closed without following a symlinked import-cache directory", () => {
    const installed = installFreshPlugin();
    const target = temp();
    const marker = path.join(target, "marker.txt");
    fs.writeFileSync(marker, "keep");
    fs.symlinkSync(target, path.join(installed.plugin, "__pycache__"), "dir");

    expect(() =>
      restoreHermesProfileBackup(installed.manifest, installed.profile),
    ).toThrow(/unexpected drift/);
    expect(fs.readFileSync(marker, "utf8")).toBe("keep");
    expect(
      fs.lstatSync(path.join(installed.plugin, "__pycache__")).isSymbolicLink(),
    ).toBe(true);
  });

  it("fails closed without following a symlinked import-cache entry", () => {
    const installed = installFreshPlugin();
    const cache = path.join(installed.plugin, "__pycache__");
    const target = path.join(temp(), "target.pyc");
    fs.mkdirSync(cache);
    fs.writeFileSync(target, "keep");
    fs.symlinkSync(target, path.join(cache, "__init__.cpython-311.pyc"));

    expect(() =>
      restoreHermesProfileBackup(installed.manifest, installed.profile),
    ).toThrow(/unexpected drift/);
    expect(fs.readFileSync(target, "utf8")).toBe("keep");
  });

  it("fails closed on a nested import-cache directory", () => {
    const installed = installFreshPlugin();
    const nested = path.join(
      installed.plugin,
      "__pycache__",
      "__init__.cpython-311.pyc",
    );
    fs.mkdirSync(nested, { recursive: true });

    expect(() =>
      restoreHermesProfileBackup(installed.manifest, installed.profile),
    ).toThrow(/unexpected drift/);
    expect(fs.statSync(nested).isDirectory()).toBe(true);
  });

  hermesDiscoveryIt(
    "loads the installed observer through Hermes discovery across isolated profile restarts",
    () => {
      const profile = temp();
      const output = temp();
      const source = path.resolve("integrations/hermes/agentintersect-world");
      fs.writeFileSync(path.join(profile, "config.yaml"), "plugins: {}\n", {
        mode: 0o600,
      });
      fs.writeFileSync(path.join(profile, ".env"), "FIXTURE_ONLY=true\n", {
        mode: 0o600,
      });
      const preview = createHermesProfilePreview({
        profileRoot: profile,
        pluginSource: source,
        outputRoot: output,
        apiServerKey: "generated-high-entropy-secret",
        timestamp: "20260721T060002Z",
      });
      const installed = applyHermesProfileChange({
        ...preview,
        profileRoot: profile,
        pluginSource: source,
        apiServerKey: "generated-high-entropy-secret",
      });
      const probe = [
        "from hermes_cli.plugins import discover_plugins,get_plugin_manager,has_hook",
        "discover_plugins(force=True)",
        "names=[p.get('name') for p in get_plugin_manager().list_plugins()]",
        "assert 'agentintersect-world' in names",
        "assert has_hook('pre_approval_request')",
      ].join(";");
      for (let restart = 0; restart < 2; restart += 1) {
        const result = spawnSync(hermesPython, ["-c", probe], {
          cwd: hermesRuntime,
          env: {
            ...process.env,
            HERMES_HOME: profile,
            PYTHONDONTWRITEBYTECODE: "1",
          },
          encoding: "utf8",
        });
        expect(result.status, result.stderr).toBe(0);
        expect(`${result.stdout}${result.stderr}`).not.toMatch(
          /generated-high-entropy-secret/,
        );
      }
      restoreHermesProfileBackup(installed.backupManifestPath, profile);
      expect(
        fs.existsSync(path.join(profile, "plugins", "agentintersect-world")),
      ).toBe(false);
      expect(fs.existsSync(path.join(profile, "agentintersect-world"))).toBe(
        false,
      );
    },
  );
});
