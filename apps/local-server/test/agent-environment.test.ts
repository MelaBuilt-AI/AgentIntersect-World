import { expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { spawn } from "node:child_process";

it("supervises native argv, stdin, workspace and cancellation without a shell", async () => {
  const module = await import("../src/agent-environment.js");
  expect(module.NATIVE_PROCESS_BRIDGE).toBeTypeOf("string");
  if (!module.NATIVE_PROCESS_BRIDGE) return;
  const root = await mkdtemp(path.join(tmpdir(), "aiw-bridge-"));
  try {
    const script = path.join(root, "native.py");
    await writeFile(
      script,
      'import os,sys,json\nprint(json.dumps({"args":sys.argv[1:],"cwd":os.getcwd(),"input":sys.stdin.read(),"profile":os.environ["CODEX_HOME"]}),flush=True)\n',
    );
    const spec = {
      executable: "python3",
      args: [script, "a b", "x; touch NO", '"quote"'],
      cwd: root,
      env: { CODEX_HOME: "native-profile" },
    };
    const child = spawn("python3", [
      "-c",
      module.NATIVE_PROCESS_BRIDGE,
      Buffer.from(JSON.stringify(spec)).toString("base64"),
    ]);
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stdin.write(JSON.stringify({ input: "actual input\n" }) + "\n");
    expect((await once(child, "close"))[0]).toBe(0);
    expect(JSON.parse(output)).toEqual({
      args: spec.args.slice(1),
      cwd: root,
      input: "actual input\n",
      profile: "native-profile",
    });
    const slow = spawn("python3", [
      "-c",
      module.NATIVE_PROCESS_BRIDGE,
      Buffer.from(
        JSON.stringify({
          ...spec,
          args: [
            "-c",
            "import os,time; print(os.getpid(),flush=True); time.sleep(60)",
          ],
        }),
      ).toString("base64"),
    ]);
    const ready = once(slow.stdout, "data");
    slow.stdin.write(JSON.stringify({ input: "" }) + "\n");
    const [pidText] = await ready;
    const pid = Number(String(pidText).trim());
    slow.stdin.write(JSON.stringify({ cancel: true }) + "\n");
    await once(slow, "close");
    expect(() => process.kill(pid, 0)).toThrow();
    await expect(readFile(path.join(root, "NO"))).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("refuses a Codex UNC workspace before advertising native sandbox readiness", async () => {
  const { AgentEnvironmentExecution } =
    await import("../src/agent-environment.js");
  const execution = new AgentEnvironmentExecution(
    {
      adapterId: "codex",
      environment: { id: "windows", kind: "windows", label: "Windows" },
    } as ConstructorParameters<typeof AgentEnvironmentExecution>[0],
    { platform: "linux", distro: "Ubuntu" },
    "python3",
  );
  await expect(
    execution.verifyWorkspace("/home/example/world"),
  ).rejects.toThrow(/drive-backed/);
});

it("maps Windows/WSL workspaces without confusing distro identity or shell argv", async () => {
  const module = await import("../src/agent-environment.js").catch(() => null);
  expect(module?.mapEnvironmentPath).toBeTypeOf("function");
  if (!module) return;
  const host = { platform: "linux" as const, distro: "Ubuntu" };
  expect(
    module.mapEnvironmentPath(
      "/mnt/c/My Work/repo",
      { id: "windows", kind: "windows", label: "Windows" },
      host,
    ),
  ).toBe("C:\\My Work\\repo");
  expect(
    module.mapEnvironmentPath(
      "/home/user/work",
      { id: "windows", kind: "windows", label: "Windows" },
      host,
    ),
  ).toBe("\\\\wsl.localhost\\Ubuntu\\home\\user\\work");
  expect(
    module.mapEnvironmentPath(
      "C:\\My Work\\repo",
      { id: "wsl:Ubuntu", kind: "wsl", distro: "Ubuntu", label: "Ubuntu" },
      { platform: "win32" },
    ),
  ).toBe("/mnt/c/My Work/repo");
  expect(() =>
    module.mapEnvironmentPath(
      "/home/user/work",
      { id: "wsl:Other", kind: "wsl", distro: "Other", label: "Other" },
      host,
    ),
  ).toThrow(/shared|environment/i);
});

it("refuses relative or drive-relative paths even when source and target environments match", async () => {
  const { mapEnvironmentPath } = await import("../src/agent-environment.js");
  expect(() =>
    mapEnvironmentPath(
      "relative/repo",
      { id: "local", kind: "wsl", distro: "Ubuntu", label: "Ubuntu" },
      { platform: "linux", distro: "Ubuntu" },
    ),
  ).toThrow(/absolute/);
  expect(() =>
    mapEnvironmentPath(
      "C:relative",
      { id: "windows", kind: "windows", label: "Windows" },
      { platform: "win32" },
    ),
  ).toThrow(/absolute/);
});
it("shares drive roots across WSL distros without confusing private Linux roots", async () => {
  const { mapEnvironmentPath } = await import("../src/agent-environment.js");
  const target = {
    id: "wsl:Other",
    kind: "wsl" as const,
    distro: "Other",
    label: "Other",
  };
  expect(
    mapEnvironmentPath("/mnt/d", target, {
      platform: "linux",
      distro: "Ubuntu",
    }),
  ).toBe("/mnt/d");
  expect(() =>
    mapEnvironmentPath("/home/user/repo", target, {
      platform: "linux",
      distro: "Ubuntu",
    }),
  ).toThrow(/shared/);
});

it.each([
  [
    "Windows project to WSL",
    "C:\\My Work\\café\\repo",
    "wsl",
    "win32",
    undefined,
    "Ubuntu",
    "/mnt/c/My Work/café/repo",
  ],
  [
    "Windows forward-slash project to WSL",
    "D:/My Work/repo",
    "wsl",
    "win32",
    undefined,
    "Ubuntu",
    "/mnt/d/My Work/repo",
  ],
  [
    "WSL drive project to Windows",
    "/mnt/d/My Work/café/repo",
    "windows",
    "linux",
    "Ubuntu",
    undefined,
    "D:\\My Work\\café\\repo",
  ],
  [
    "WSL-private project to Windows UNC",
    "/home/user/My Work/repo",
    "windows",
    "linux",
    "Ubuntu",
    undefined,
    "\\\\wsl.localhost\\Ubuntu\\home\\user\\My Work\\repo",
  ],
  [
    "Windows-hosted WSL UNC to matching distro",
    "\\\\wsl.localhost\\Ubuntu\\home\\user\\repo",
    "wsl",
    "win32",
    undefined,
    "Ubuntu",
    "/home/user/repo",
  ],
  [
    "Legacy WSL UNC to matching distro",
    "\\\\wsl$\\Ubuntu\\home\\user\\repo",
    "wsl",
    "win32",
    undefined,
    "Ubuntu",
    "/home/user/repo",
  ],
  [
    "Shared drive across distros",
    "/mnt/c/My Work/repo",
    "wsl",
    "linux",
    "Ubuntu",
    "Debian",
    "/mnt/c/My Work/repo",
  ],
  [
    "Same WSL private project",
    "/home/user/repo",
    "wsl",
    "linux",
    "Ubuntu",
    "Ubuntu",
    "/home/user/repo",
  ],
  [
    "Same Windows drive",
    "C:\\My Work\\repo",
    "windows",
    "win32",
    undefined,
    undefined,
    "C:\\My Work\\repo",
  ],
] as const)(
  "maps %s",
  async (_label, value, kind, platform, hostDistro, targetDistro, expected) => {
    const { mapEnvironmentPath } = await import("../src/agent-environment.js");
    expect(
      mapEnvironmentPath(
        value,
        {
          id: targetDistro ? `wsl:${targetDistro}` : kind,
          kind,
          label: kind,
          ...(targetDistro ? { distro: targetDistro } : {}),
        },
        { platform, ...(hostDistro ? { distro: hostDistro } : {}) },
      ),
    ).toBe(expected);
  },
);
it("refuses a different distro's private UNC and unmounted network shares", async () => {
  const { mapEnvironmentPath } = await import("../src/agent-environment.js");
  const target = {
    id: "wsl:Ubuntu",
    kind: "wsl" as const,
    distro: "Ubuntu",
    label: "Ubuntu",
  };
  for (const value of [
    "\\\\wsl.localhost\\Debian\\home\\user\\repo",
    "\\\\server\\share\\repo",
  ])
    expect(() =>
      mapEnvironmentPath(value, target, { platform: "win32" }),
    ).toThrow(/shared/);
});
it.each(["hermes", "openclaw", "codex", "claude-code"] as const)(
  "keeps the native UNC support boundary explicit for %s",
  async (adapterId) => {
    const { assertNativeWorkspacePath } =
      await import("../src/agent-environment.js");
    const check = () =>
      assertNativeWorkspacePath(
        {
          adapterId,
          environment: { id: "windows", kind: "windows", label: "Windows" },
        },
        "\\\\wsl.localhost\\Ubuntu\\home\\repo",
      );
    if (adapterId === "codex") expect(check).toThrow(/WSL Codex/);
    else expect(check).not.toThrow(); // Access is then proven by verifyWorkspace, not by string translation.
  },
);
it("normalizes native UNC file activity only within the exact owned root", async () => {
  const { relativeNativeWorkspacePath } =
    await import("../src/agent-environment.js");
  const root = "\\\\wsl.localhost\\Ubuntu\\home\\user\\repo";
  expect(
    relativeNativeWorkspacePath(
      "//wsl.localhost/Ubuntu/home/user/repo/src/index.ts",
      root,
    ),
  ).toBe("src/index.ts");
  expect(
    relativeNativeWorkspacePath(
      "//wsl.localhost/Debian/home/user/repo/src/index.ts",
      root,
    ),
  ).toBeNull();
  expect(relativeNativeWorkspacePath("C:relative.txt", root)).toBeNull();
});
