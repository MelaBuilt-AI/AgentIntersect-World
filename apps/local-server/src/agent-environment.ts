import {
  execFile,
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, rm, realpath } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type {
  AgentEnvironment,
  AgentRegistration,
} from "@agentintersect-world/world-schema/agent-setup";

// A separate control pipe keeps cancellation available after native stdin EOF.
// Credentials are loaded by the target harness in its own environment.
export const NATIVE_PROCESS_BRIDGE = String.raw`
import os,sys,json,base64,subprocess,threading,signal
spec=json.loads(base64.b64decode(sys.argv[1]))
first=json.loads(sys.stdin.readline())
env=os.environ.copy(); env.update(spec['env'])
child=subprocess.Popen([spec['executable']]+spec['args'],cwd=spec['cwd'],env=env,stdin=subprocess.PIPE,start_new_session=os.name!='nt')
def cancel():
    if child.poll() is not None: return
    if os.name=='nt':
        subprocess.run(['taskkill.exe','/PID',str(child.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=5)
    else:
        try: os.killpg(child.pid,signal.SIGKILL)
        except ProcessLookupError: pass
def control():
    try:
        for line in sys.stdin:
            if json.loads(line).get('cancel'): break
    finally: cancel()
threading.Thread(target=control,daemon=True).start()
try:
    child.stdin.write(first['input'].encode('utf-8')); child.stdin.close()
except BrokenPipeError: pass
code=child.wait()
os._exit(code if code>=0 else 1)
`;
/** Bounded environment guidance; never raw command output or credentials. */
export class AgentEnvironmentError extends Error {}

/** Convert only locations inside the attested native root back to repository paths. */
export function relativeNativeWorkspacePath(
  value: string,
  root: string,
): string | null {
  if (value.split(/[\\/]/).includes("..")) return null;
  const windows = /^(?:[A-Za-z]:[\\/]|\\\\)/.test(root);
  const candidate = windows ? value.replace(/^\/([a-z])\//i, "$1:/") : value;
  if (!windows && /^(?:[A-Za-z]:|\\\\)/.test(candidate)) return null;
  const paths = windows ? path.win32 : path.posix;
  if (/^[A-Za-z]:[^\\/]/.test(candidate)) return null;
  const result = paths.isAbsolute(candidate)
    ? paths.relative(root, candidate)
    : candidate;
  if (
    !result ||
    result === ".." ||
    result.startsWith(`..${paths.sep}`) ||
    paths.isAbsolute(result)
  )
    return null;
  return result.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function assertNativeWorkspacePath(
  registration: Pick<AgentRegistration, "adapterId" | "environment">,
  nativePath: string,
): void {
  if (
    registration.adapterId === "codex" &&
    registration.environment.kind === "windows" &&
    nativePath.startsWith("\\\\")
  )
    throw new AgentEnvironmentError(
      "Windows Codex requires a drive-backed workspace and report directory. Choose a shared Windows drive or a WSL Codex connection; native sandbox permissions are not bypassed.",
    );
}

const exec = promisify(execFile);
export async function currentEnvironment(): Promise<HostEnvironment> {
  let distro = process.env.WSL_DISTRO_NAME;
  if (!distro && process.platform === "linux") {
    if (
      /microsoft/i.test(
        await readFile("/proc/sys/kernel/osrelease", "utf8").catch(() => ""),
      )
    )
      distro = (await exec("wslpath", ["-w", "/"], { timeout: 3000 })).stdout
        .trim()
        .split("\\")[3];
  }
  return { platform: process.platform, ...(distro ? { distro } : {}) };
}
export function isLocalEnvironment(
  target: AgentEnvironment,
  host: HostEnvironment,
): boolean {
  return target.kind === "windows"
    ? host.platform === "win32"
    : target.kind === "wsl"
      ? host.platform === "linux" &&
        (target.id === "local" || target.distro === host.distro)
      : host.platform === (target.kind === "macos" ? "darwin" : "linux");
}

export class AgentEnvironmentExecution {
  constructor(
    readonly registration: AgentRegistration,
    readonly host: HostEnvironment,
    readonly python: string,
    readonly prefix: readonly string[] = [],
  ) {}
  mapPath(value: string): string {
    return mapEnvironmentPath(value, this.registration.environment, this.host);
  }
  async pythonCommand(
    script: string,
    args: readonly string[] = [],
  ): Promise<string> {
    const result = await exec(
      this.python,
      [...this.prefix, "-c", script, ...args],
      { timeout: 10000, maxBuffer: 262144, windowsHide: true },
    );
    return result.stdout;
  }
  async readNativeFile(filename: string): Promise<string> {
    return this.pythonCommand(
      "import sys,pathlib; p=pathlib.Path(sys.argv[1]); assert p.stat().st_size<=262144; sys.stdout.buffer.write(p.read_bytes())",
      [filename],
    );
  }
  async verifyWorkspace(directory: string, writable = false): Promise<void> {
    assertNativeWorkspacePath(this.registration, this.mapPath(directory));
    const filename = path.join(directory, `.aiw-access-${randomUUID()}`);
    const token = randomUUID();
    try {
      await writeFile(filename, token, { flag: "wx", mode: 0o600 });
      const observed = writable
        ? await this.pythonCommand(
            "import sys; p=sys.argv[1]; f=open(p,'r+',encoding='utf-8'); v=f.read(); f.seek(0); f.write(v); f.flush(); f.close(); sys.stdout.write(v)",
            [this.mapPath(filename)],
          )
        : await this.readNativeFile(this.mapPath(filename));
      if (observed !== token)
        throw new AgentEnvironmentError(
          "Workspace mapping does not resolve the same files. Select a shared project and World data directory.",
        );
    } catch (error) {
      if (error instanceof AgentEnvironmentError) throw error;
      throw new AgentEnvironmentError(
        `The selected harness cannot ${writable ? "read and write" : "read"} the owned workspace or report directory in its native environment. Choose accessible shared storage and Recheck the connection.`,
      );
    } finally {
      await rm(filename, { force: true });
    }
  }
  async gitEnvironment(
    directory: string,
    required = false,
  ): Promise<Record<string, string>> {
    const env: Record<string, string> = {};
    // Native Git must not follow a foreign absolute .git pointer in a World worktree.
    const gitdir = await exec(
      "git",
      ["-C", directory, "rev-parse", "--absolute-git-dir"],
      { timeout: 3000 },
    )
      .then((r) => r.stdout.trim())
      .catch(() => null);
    if (gitdir) {
      const common = (
        await exec(
          "git",
          [
            "-C",
            directory,
            "rev-parse",
            "--path-format=absolute",
            "--git-common-dir",
          ],
          { timeout: 3000 },
        )
      ).stdout.trim();
      env.GIT_DIR = this.mapPath(gitdir);
      env.GIT_COMMON_DIR = this.mapPath(common);
      env.GIT_WORK_TREE = this.mapPath(directory);
      await this.pythonCommand(
        "import os,sys; assert all(os.path.isdir(p) for p in sys.argv[1:])",
        [env.GIT_DIR, env.GIT_COMMON_DIR],
      ).catch(() => {
        throw new AgentEnvironmentError(
          "The selected harness cannot access this Workstream's native Git metadata. Use shared storage or the matching WSL connection, then Recheck.",
        );
      });
    }
    if (!gitdir && required)
      throw new AgentEnvironmentError(
        "Owned Git metadata is unavailable. Reopen the project and verify its saved Workstream before retrying.",
      );
    return env;
  }

  async spawn(
    args: readonly string[],
    directory: string,
  ): Promise<ChildProcessWithoutNullStreams> {
    await this.verifyWorkspace(directory);
    const r = this.registration;
    const env: Record<string, string> =
      r.adapterId === "codex"
        ? { CODEX_HOME: r.identity.profilePath }
        : r.adapterId === "claude-code"
          ? { CLAUDE_CONFIG_DIR: r.identity.profilePath, HOME: r.homePath }
          : {};
    Object.assign(env, await this.gitEnvironment(directory));
    const mappedArgs = args.map((arg, index) =>
      args[index - 1] === "--add-dir" ? this.mapPath(arg) : arg,
    );
    const spec = {
      executable: r.executablePath,
      args: mappedArgs,
      cwd: this.mapPath(directory),
      env,
    };
    return spawn(
      this.python,
      [
        ...this.prefix,
        "-c",
        NATIVE_PROCESS_BRIDGE,
        Buffer.from(JSON.stringify(spec)).toString("base64"),
      ],
      { detached: true, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
  }
  writeInput(child: ChildProcessWithoutNullStreams, input: string): void {
    child.stdin.write(JSON.stringify({ input }) + "\n");
  }
  async terminate(child: ChildProcessWithoutNullStreams): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => resolve(), 6000);
      child.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
      child.stdin.write(JSON.stringify({ cancel: true }) + "\n", () => {});
    });
  }
}
export async function createEnvironmentExecution(
  registration: AgentRegistration,
  suppliedHost?: HostEnvironment,
): Promise<AgentEnvironmentExecution | undefined> {
  const host = suppliedHost ?? (await currentEnvironment());
  if (isLocalEnvironment(registration.environment, host)) return undefined;
  if (registration.environment.kind === "windows" && host.distro) {
    const powershell =
      "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";
    const pythonPath = (
      await exec(
        powershell,
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "(Get-Command python.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source",
        ],
        { timeout: 5000 },
      )
    ).stdout.trim();
    const match = /^([A-Za-z]):\\(.*)$/.exec(pythonPath);
    if (!match || pythonPath.includes("WindowsApps"))
      throw new Error(
        "Install Python 3 in Windows using its native installer, then Recheck. It supervises cross-environment execution and cancellation.",
      );
    const python = await realpath(
      `/mnt/${match[1]!.toLowerCase()}/${match[2]!.replaceAll("\\", "/")}`,
    );
    if (!/\.exe$/i.test(registration.executablePath))
      throw new Error(
        "Select the native Windows .exe launcher. Shell .cmd/.bat launchers are not supported across environments.",
      );
    return new AgentEnvironmentExecution(registration, host, python);
  }
  if (
    registration.environment.kind === "wsl" &&
    registration.environment.distro
  ) {
    const wsl =
      host.platform === "win32" ? "wsl.exe" : "/mnt/c/Windows/System32/wsl.exe";
    const running = (
      await exec(wsl, ["--list", "--running", "--quiet"], {
        timeout: 5000,
        encoding: "buffer",
      })
    ).stdout;
    const names = (
      running.includes(0) ? running.toString("utf16le") : running.toString()
    )
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((s) => s.trim());
    if (!names.includes(registration.environment.distro))
      throw new Error(
        "The selected WSL distribution is stopped. Start it explicitly, then Recheck.",
      );
    return new AgentEnvironmentExecution(registration, host, wsl, [
      "--distribution",
      registration.environment.distro,
      "--exec",
      "python3",
    ]);
  }
  throw new Error("This environment is not accessible from this World server.");
}

type HostEnvironment = { platform: NodeJS.Platform; distro?: string };
export function mapEnvironmentPath(
  value: string,
  target: AgentEnvironment,
  host: HostEnvironment,
): string {
  const absolute =
    host.platform === "win32"
      ? /^(?:[A-Za-z]:[\\/]|\\\\[^\\]+\\[^\\]+)/.test(value)
      : path.posix.isAbsolute(value);
  if (!absolute)
    throw new AgentEnvironmentError(
      "Workspace mapping requires an absolute path in the World server's environment.",
    );
  if (target.kind === "windows") {
    if (host.platform === "win32") return value;
    const drive = /^\/mnt\/([a-z])(?:\/(.*))?$/i.exec(value);
    if (drive)
      return `${drive[1]!.toUpperCase()}:\\${(drive[2] ?? "").replaceAll("/", "\\")}`;
    if (host.distro && value.startsWith("/"))
      return `\\\\wsl.localhost\\${host.distro}${value.replaceAll("/", "\\")}`;
  } else if (target.kind === "wsl") {
    if (
      host.platform !== "win32" &&
      (target.id === "local" || target.distro === host.distro)
    )
      return value;
    const drive = /^([A-Za-z]):[\\/](.*)$/.exec(value);
    if (drive)
      return `/mnt/${drive[1]!.toLowerCase()}/${drive[2]!.replaceAll("\\", "/")}`;
    const unc = /^\\\\wsl(?:\.localhost|\$)\\([^\\]+)(\\.*)$/i.exec(value);
    if (unc && unc[1] === target.distro) return unc[2]!.replaceAll("\\", "/");
    if (/^\/mnt\/[a-z](?:\/|$)/i.test(value)) return value;
  } else if (host.platform === (target.kind === "macos" ? "darwin" : "linux"))
    return value;
  throw new AgentEnvironmentError(
    "Workspace is not shared with the selected environment. Choose a repository and World data directory on a shared Windows drive, or select the matching WSL distribution, then Recheck.",
  );
}
