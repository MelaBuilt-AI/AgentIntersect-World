import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { promisify } from "node:util";
import {
  WINDOWS_DISCOVERY_SCRIPT,
  WSL_DISCOVERY_SCRIPT,
} from "./agent-discovery-scripts.js";
import { access, readdir, readFile, realpath, stat } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

import {
  SETUP_HARNESSES,
  type SetupHarness,
  type AgentEnvironment,
  type NativeIdentity,
  type AgentInstallation,
  type DiscoveryResult,
} from "@agentintersect-world/world-schema/agent-setup";
export { SETUP_HARNESSES };
export type {
  SetupHarness,
  AgentEnvironment,
  NativeIdentity,
  AgentInstallation,
  DiscoveryResult,
};

import { currentEnvironment } from "./agent-environment.js";

const commands: Record<SetupHarness, string> = {
  hermes: "hermes",
  openclaw: "openclaw",
  codex: "codex",
  "claude-code": "claude",
};
const safeIdentity = (value: string) =>
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);

async function directories(root: string): Promise<string[]> {
  try {
    return (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && safeIdentity(entry.name))
      .map((entry) => entry.name)
      .sort()
      .slice(0, 64);
  } catch {
    return [];
  }
}

async function boundedText(filename: string): Promise<string> {
  try {
    if ((await stat(filename)).size > 262_144) return "";
    return await readFile(filename, "utf8");
  } catch {
    return "";
  }
}

async function nativeIdentities(
  adapterId: SetupHarness,
  home: string,
): Promise<NativeIdentity[]> {
  const directory = path.join(
    home,
    adapterId === "claude-code" ? ".claude" : `.${adapterId}`,
  );
  const defaultIdentity: NativeIdentity = {
    id: "default",
    label: "Default",
    kind: "profile",
    profilePath: directory,
  };
  if (adapterId === "hermes")
    return [
      defaultIdentity,
      ...(await directories(path.join(directory, "profiles"))).map((id) => ({
        id,
        label: id,
        kind: "profile" as const,
        profilePath: path.join(directory, "profiles", id),
      })),
    ];
  if (adapterId === "codex") {
    const text = await boundedText(path.join(directory, "config.toml"));
    const profiles = [
      ...text.matchAll(
        /^\s*\[profiles\.(?:"([A-Za-z0-9._-]+)"|([A-Za-z0-9._-]+))\]\s*(?:#.*)?$/gm,
      ),
    ]
      .map((match) => match[1] ?? match[2]!)
      .filter(safeIdentity);
    return [
      defaultIdentity,
      ...[...new Set(profiles)]
        .filter((id) => id !== "default")
        .slice(0, 64)
        .map((id) => ({ ...defaultIdentity, id, label: id })),
    ];
  }
  if (adapterId === "claude-code") {
    const files = await readdir(path.join(directory, "agents")).catch(
      () => [] as string[],
    );
    return [
      defaultIdentity,
      ...files
        .filter(
          (file) => file.endsWith(".md") && safeIdentity(file.slice(0, -3)),
        )
        .sort()
        .slice(0, 64)
        .map((file) => ({
          id: file.slice(0, -3),
          label: file.slice(0, -3),
          kind: "agent" as const,
          profilePath: directory,
        })),
    ];
  }
  try {
    const config = JSON.parse(
      await boundedText(path.join(directory, "openclaw.json")),
    ) as { agents?: { list?: { id?: unknown; name?: unknown }[] } };
    const agents = Array.isArray(config.agents?.list) ? config.agents.list : [];
    const identities = agents
      .flatMap((agent): NativeIdentity[] =>
        typeof agent.id === "string" && safeIdentity(agent.id)
          ? [
              {
                id: agent.id,
                label:
                  typeof agent.name === "string"
                    ? agent.name
                        .split("")
                        .filter(
                          (character) =>
                            character.charCodeAt(0) >= 32 &&
                            character.charCodeAt(0) !== 127,
                        )
                        .join("")
                        .slice(0, 80)
                    : agent.id,
                kind: "agent",
                profilePath: directory,
              },
            ]
          : [],
      )
      .slice(0, 64);
    if (identities.length) return identities;
  } catch {
    /* An absent/unreadable config is a setup prerequisite, not a secret-bearing error. */
  }
  return [{ id: "main", label: "Main", kind: "agent", profilePath: directory }];
}

export function installationId(
  environmentId: string,
  adapterId: SetupHarness,
  executablePath: string,
): string {
  return createHash("sha256")
    .update(JSON.stringify([environmentId, adapterId, executablePath]))
    .digest("hex")
    .slice(0, 32);
}

/** Bounded metadata inspection only: never invoke a harness or source a shell profile. */
export async function discoverLocalAgents(options: {
  readonly home: string;
  readonly searchPath: string;
  readonly environment: AgentEnvironment;
}): Promise<AgentInstallation[]> {
  const isWindows = options.environment.kind === "windows";
  const searchDirectories = [
    ...new Set(
      [
        ...options.searchPath.split(isWindows ? ";" : path.delimiter),
        path.join(options.home, ".local", "bin"),
        path.join(options.home, ".cargo", "bin"),
        path.join(options.home, ".bun", "bin"),
        path.join(options.home, ".npm-global", "bin"),
        path.join(options.home, "AppData", "Roaming", "npm"),
        ...(
          await directories(path.join(options.home, ".nvm", "versions", "node"))
        ).map((version) =>
          path.join(options.home, ".nvm", "versions", "node", version, "bin"),
        ),
      ].filter((directory) => path.isAbsolute(directory)),
    ),
  ].slice(0, 160);
  const result: AgentInstallation[] = [];
  for (const adapterId of SETUP_HARNESSES) {
    const seen = new Set<string>();
    for (const directory of searchDirectories) {
      for (const extension of isWindows ? [".exe", ".cmd", ".bat", ""] : [""]) {
        const filename = path.join(directory, commands[adapterId] + extension);
        try {
          if (!(await stat(filename)).isFile()) continue;
          await access(filename, isWindows ? constants.F_OK : constants.X_OK);
          const resolvedTarget = await realpath(filename);
          if (seen.has(resolvedTarget) || seen.size >= 32) continue;
          seen.add(resolvedTarget);
          const executablePath = filename;
          result.push({
            id: installationId(
              options.environment.id,
              adapterId,
              executablePath,
            ),
            adapterId,
            environment: options.environment,
            executablePath,
            canonicalExecutablePath: resolvedTarget,
            homePath: options.home,
            identities: await nativeIdentities(adapterId, options.home),
            status: "found",
          });
        } catch {
          /* Missing or inaccessible candidate: continue the bounded search. */
        }
      }
    }
  }
  return result;
}

export type DiscoveryRunner = (
  command: string,
  args: readonly string[],
) => Promise<string>;
const exec = promisify(execFile);
const runDiscovery: DiscoveryRunner = async (command, args) => {
  const result = await exec(command, [...args], {
    timeout: 12_000,
    maxBuffer: 262_144,
    windowsHide: true,
    encoding: "buffer",
  });
  const output = result.stdout;
  return output.includes(0)
    ? output.toString("utf16le")
    : output.toString("utf8");
};

function foreignInstallations(
  output: string,
  environment: AgentEnvironment,
): AgentInstallation[] {
  const value = JSON.parse(output.replace(/^\uFEFF/, "").trim()) as {
    home: string;
    installations: {
      adapterId: SetupHarness;
      executablePath: string;
      canonicalExecutablePath?: string;
      identities: NativeIdentity[];
    }[];
  };
  if (
    typeof value.home !== "string" ||
    value.home.length > 4096 ||
    !Array.isArray(value.installations) ||
    value.installations.length > 128
  )
    throw new Error("Invalid discovery response");
  return value.installations.map((item) => {
    if (
      !SETUP_HARNESSES.includes(item.adapterId) ||
      typeof item.executablePath !== "string" ||
      item.executablePath.length > 4096 ||
      !Array.isArray(item.identities) ||
      item.identities.length > 65
    )
      throw new Error("Invalid installation metadata");
    for (const identity of item.identities) {
      if (
        !safeIdentity(identity.id) ||
        typeof identity.label !== "string" ||
        identity.label.length > 80 ||
        !["profile", "agent"].includes(identity.kind) ||
        typeof identity.profilePath !== "string" ||
        identity.profilePath.length > 4096
      )
        throw new Error("Invalid identity metadata");
    }
    return {
      id: installationId(environment.id, item.adapterId, item.executablePath),
      adapterId: item.adapterId,
      environment,
      executablePath: item.executablePath,
      ...(typeof item.canonicalExecutablePath === "string"
        ? { canonicalExecutablePath: item.canonicalExecutablePath }
        : {}),
      homePath: value.home,
      identities: item.identities,
      status: "found",
    };
  });
}

export async function discoverAgents(
  options: {
    readonly platform?: NodeJS.Platform;
    readonly host?: { platform: NodeJS.Platform; distro?: string };
    readonly osRelease?: string;
    readonly home?: string;
    readonly searchPath?: string;
    readonly run?: DiscoveryRunner;
  } = {},
): Promise<DiscoveryResult> {
  const platform = options.platform ?? process.platform;
  const home = options.home ?? homedir();
  const run = options.run ?? runDiscovery;
  const installations: AgentInstallation[] = [];
  const environments: Array<DiscoveryResult["environments"][number]> = [];
  const isWindows = platform === "win32";
  const host =
    options.host ??
    (options.platform && options.platform !== process.platform
      ? { platform }
      : await currentEnvironment());
  const isWsl = platform === "linux" && !!host.distro;
  let defaultWslDistro: string | undefined;
  const scanForeign = async (
    environment: AgentEnvironment,
    command: string,
    args: readonly string[],
  ) => {
    try {
      const output = await run(command, args);
      installations.push(...foreignInstallations(output, environment));
      if (environment.kind === "windows") {
        const candidate = JSON.parse(
          output.replace(/^\uFEFF/, "").trim(),
        ).defaultWslDistro;
        if (
          typeof candidate === "string" &&
          /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/.test(candidate)
        )
          defaultWslDistro = candidate;
      }
      environments.push({
        id: environment.id,
        label: environment.label,
        status: "scanned",
      });
    } catch {
      environments.push({
        id: environment.id,
        label: environment.label,
        status: "unavailable",
        message:
          environment.kind === "wsl"
            ? "Could not inspect this running distribution. Check WSL access and Python 3, then Recheck."
            : "Windows discovery is unavailable. Check Windows interop, then Recheck.",
      });
    }
  };
  if (!isWindows) {
    const distro = isWsl ? host.distro : undefined;
    const osRelease =
      platform === "linux" && !isWsl
        ? (options.osRelease ?? (await boundedText("/etc/os-release")))
        : "";
    const distroName =
      /^NAME=(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([^\r\n]+))$/m.exec(osRelease);
    const linuxName = distroName?.slice(1).find(Boolean);
    const environment: AgentEnvironment = {
      id: distro ? `wsl:${distro}` : "local",
      kind: isWsl ? "wsl" : platform === "darwin" ? "macos" : "linux",
      label: distro
        ? `WSL (${distro})`
        : platform === "darwin"
          ? "macOS (Native)"
          : linuxName
            ? `Linux (${linuxName})`
            : "Linux (Native)",
      ...(distro ? { distro } : {}),
    };
    installations.push(
      ...(await discoverLocalAgents({
        home,
        searchPath: options.searchPath ?? process.env.PATH ?? "",
        environment,
      })),
    );
    environments.push({
      id: environment.id,
      label: environment.label,
      status: "scanned",
    });
  }
  if (isWindows || isWsl) {
    const powershell = isWindows
      ? "powershell.exe"
      : "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";
    const wsl = isWindows ? "wsl.exe" : "/mnt/c/Windows/System32/wsl.exe";
    await scanForeign(
      { id: "windows", kind: "windows", label: "Windows (Native)" },
      powershell,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        Buffer.from(WINDOWS_DISCOVERY_SCRIPT, "utf16le").toString("base64"),
      ],
    );
    try {
      const names = (value: string) => [
        ...new Set(
          value
            .replaceAll(String.fromCharCode(0), "")
            .split(/\r?\n/)
            .map((line) => line.replace(/^\uFEFF/, "").trim())
            .filter((name) => /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/.test(name)),
        ),
      ];
      const all = names(await run(wsl, ["--list", "--quiet"]));
      const running = new Set(
        names(await run(wsl, ["--list", "--running", "--quiet"])),
      );
      for (const distro of all.slice(0, 8)) {
        const environment: AgentEnvironment = {
          id: `wsl:${distro}`,
          kind: "wsl",
          label: `WSL (${distro})`,
          distro,
        };
        if (!running.has(distro)) {
          environments.push({
            id: environment.id,
            label: environment.label,
            status: "stopped",
            message:
              "Start this distribution yourself, then Recheck. Discovery does not start stopped distributions.",
          });
          continue;
        }
        await scanForeign(environment, wsl, [
          "--distribution",
          distro,
          "--exec",
          "python3",
          "-c",
          WSL_DISCOVERY_SCRIPT,
        ]);
      }
      if (all.length > 8)
        environments.push({
          id: "wsl:limit",
          label: "Additional WSL distributions",
          status: "unavailable",
          message:
            "Discovery inspected the first eight distributions. Use an explicit installation for additional environments.",
        });
    } catch {
      environments.push({
        id: "wsl",
        label: "WSL",
        status: "unavailable",
        message:
          "WSL enumeration is unavailable. Windows results are retained.",
      });
    }
  }
  // Deduplicate only a proven environment identity, never equal path strings across distributions.
  const seen = new Set<string>();
  const unique = installations.filter((item) => {
    const key = JSON.stringify([
      item.environment.id,
      item.adapterId,
      item.homePath,
      item.canonicalExecutablePath ?? item.executablePath,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    installations: unique,
    environments: [...new Map(environments.map((e) => [e.id, e])).values()],
    ...(defaultWslDistro ? { defaultWslDistro } : {}),
    ...(host.distro ? { currentWslDistro: host.distro } : {}),
  };
}
