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
