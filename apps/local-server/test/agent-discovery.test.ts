import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const roots: string[] = [];

it("names native Linux from OS metadata without probing Windows or WSL", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-linux-label-"));
  roots.push(root);
  const run = vi.fn();
  const { discoverAgents } = await import("../src/agent-discovery.js");
  const result = await discoverAgents({
    platform: "linux",
    home: root,
    searchPath: "",
    host: { platform: "linux" },
    osRelease: 'NAME="Arch Linux"\nID=arch\n',
    run,
  });
  expect(result.environments).toEqual([
    { id: "local", label: "Linux (Arch Linux)", status: "scanned" },
  ]);
  expect(run).not.toHaveBeenCalled();
});

it("coalesces the current WSL distro and its enumeration without losing other installations", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-wsl-alias-"));
  roots.push(root);
  const bin = path.join(root, "bin");
  await mkdir(bin);
  const executable = path.join(bin, "codex");
  await writeFile(executable, "#!/bin/sh\nexit 42\n");
  await chmod(executable, 0o700);
  const run = vi.fn(async (_command: string, args: readonly string[]) => {
    if (args.includes("--list")) return "Ubuntu\n";
    if (args.includes("-EncodedCommand"))
      return JSON.stringify({
        home: "C:\\Users\\Test",
        installations: [],
        defaultWslDistro: "Ubuntu",
      });
    return JSON.stringify({
      home: root,
      installations: [
        {
          adapterId: "codex",
          executablePath: executable,
          canonicalExecutablePath: executable,
          identities: [
            {
              id: "default",
              label: "Default",
              kind: "profile",
              profilePath: path.join(root, ".codex"),
            },
          ],
        },
      ],
    });
  });
  const { discoverAgents } = await import("../src/agent-discovery.js");
  const result = await discoverAgents({
    platform: "linux",
    home: root,
    searchPath: bin,
    host: { platform: "linux", distro: "Ubuntu" },
    run,
  });
  expect(result.installations).toHaveLength(1);
  expect(result.installations[0]?.environment).toEqual({
    id: "wsl:Ubuntu",
    kind: "wsl",
    label: "WSL (Ubuntu)",
    distro: "Ubuntu",
  });
  expect(result.environments.filter((e) => e.id === "wsl:Ubuntu")).toHaveLength(
    1,
  );
  expect(result.defaultWslDistro).toBe("Ubuntu");
});
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

it("finds all four local harnesses and their native identities without running them or changing profiles", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-discovery-"));
  roots.push(root);
  const bin = path.join(root, "bin with spaces");
  await mkdir(bin);
  for (const command of ["hermes", "openclaw", "codex", "claude"]) {
    await writeFile(
      path.join(bin, command),
      "#!/bin/sh\nprintf 'discovery must not execute this' >&2\nexit 42\n",
    );
    await chmod(path.join(bin, command), 0o700);
  }
  await mkdir(path.join(root, ".hermes", "profiles", "research"), {
    recursive: true,
  });
  await mkdir(path.join(root, ".openclaw"));
  const protectedConfig = JSON.stringify({
    gateway: { auth: { token: "SECRET_CANARY" } },
    agents: {
      list: [
        { id: "main", name: "Claw" },
        { id: "writer", name: "Writer" },
      ],
    },
  });
  await writeFile(
    path.join(root, ".openclaw", "openclaw.json"),
    protectedConfig,
  );
  await mkdir(path.join(root, ".codex"));
  await writeFile(
    path.join(root, ".codex", "config.toml"),
    '[profiles.local]\nmodel = "my-model"\n',
  );
  await mkdir(path.join(root, ".claude", "agents"), { recursive: true });
  await writeFile(
    path.join(root, ".claude", "agents", "reviewer.md"),
    "do not read this personality during discovery",
  );
  const before = await readdir(root, { recursive: true });
  const module = await import("../src/agent-discovery.js").catch(() => null);
  expect(
    module,
    "Agent discovery must exist without legacy environment configuration",
  ).not.toBeNull();
  const result = await module!.discoverLocalAgents({
    home: root,
    searchPath: bin,
    environment: { id: "local", kind: "linux", label: "Local Linux" },
  });
  expect(result.map((item) => item.adapterId).sort()).toEqual([
    "claude-code",
    "codex",
    "hermes",
    "openclaw",
  ]);
  expect(
    result
      .find((item) => item.adapterId === "hermes")
      ?.identities.map((identity) => identity.id),
  ).toEqual(["default", "research"]);
  expect(
    result
      .find((item) => item.adapterId === "openclaw")
      ?.identities.map((identity) => identity.id),
  ).toEqual(["main", "writer"]);
  expect(
    result
      .find((item) => item.adapterId === "codex")
      ?.identities.map((identity) => identity.id),
  ).toEqual(["default", "local"]);
  expect(
    result
      .find((item) => item.adapterId === "claude-code")
      ?.identities.map((identity) => identity.id),
  ).toEqual(["default", "reviewer"]);
  expect(result.every((item) => item.status === "found")).toBe(true);
  expect(JSON.stringify(result)).not.toContain("SECRET_CANARY");
  expect(
    await readFile(path.join(root, ".openclaw", "openclaw.json"), "utf8"),
  ).toBe(protectedConfig);
  expect(await readdir(root, { recursive: true })).toEqual(before);
});

it("scans Windows and running WSL separately, labels stopped distributions, and never starts them", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-discovery-topology-"));
  roots.push(root);
  const windowsHome = "C:\\Users\\Test User";
  const run = vi.fn(async (_command: string, args: readonly string[]) => {
    if (args.includes("--list"))
      return args.includes("--running")
        ? "Ubuntu\0\r\n"
        : "Ubuntu\0\r\nDebian\0\r\n";
    if (args.includes("-EncodedCommand"))
      return JSON.stringify({
        home: windowsHome,
        installations: [
          {
            adapterId: "codex",
            executablePath: windowsHome + "\\bin\\codex.cmd",
            identities: [],
          },
        ],
      });
    if (args.includes("--distribution"))
      return JSON.stringify({
        home: "/home/test",
        installations: [
          {
            adapterId: "codex",
            executablePath: "/usr/bin/codex",
            identities: [],
          },
        ],
      });
    throw new Error("unexpected invocation");
  });
  const module = await import("../src/agent-discovery.js");
  expect(module).toHaveProperty("discoverAgents");
  const result = await module.discoverAgents({
    platform: "win32",
    home: root,
    searchPath: "",
    run,
  });
  expect(result.installations.map((entry) => entry.environment.kind)).toEqual([
    "windows",
    "wsl",
  ]);
  expect(new Set(result.installations.map((entry) => entry.id)).size).toBe(2);
  expect(result.environments).toContainEqual(
    expect.objectContaining({ label: "WSL (Debian)", status: "stopped" }),
  );
  expect(
    run.mock.calls
      .filter(([, args]) => args.includes("--distribution"))
      .map(([, args]) => args[args.indexOf("--distribution") + 1]),
  ).toEqual(["Ubuntu"]);
  expect(result.installations.every((entry) => entry.status === "found")).toBe(
    true,
  );
});

it("saves the stable launcher path rather than pinning a symlink's versioned target", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-discovery-update-"));
  roots.push(root);
  const bin = path.join(root, "bin");
  await mkdir(bin);
  const target = path.join(root, "claude-version-A");
  await writeFile(target, "#!/bin/sh\nexit 0\n");
  await chmod(target, 0o700);
  const launcher = path.join(bin, "claude");
  await symlink(target, launcher);
  const { discoverLocalAgents } = await import("../src/agent-discovery.js");
  const options = {
    home: root,
    searchPath: bin,
    environment: { id: "local", kind: "linux" as const, label: "Linux" },
  };
  const [before] = await discoverLocalAgents(options);
  expect(before?.executablePath).toBe(launcher);
  await rm(launcher);
  const updatedTarget = path.join(root, "claude-version-B");
  await writeFile(updatedTarget, "#!/bin/sh\nexit 0\n");
  await chmod(updatedTarget, 0o700);
  await symlink(updatedTarget, launcher);
  const [after] = await discoverLocalAgents(options);
  expect(after?.id).toBe(before?.id);
  expect(after?.executablePath).toBe(launcher);
});
