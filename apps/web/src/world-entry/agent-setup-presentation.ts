import type {
  AgentEnvironment,
  AgentInstallation,
  AgentRegistration,
} from "@agentintersect-world/world-schema/agent-setup";

export function setupEnvironmentLabel(
  environment: AgentEnvironment,
  currentDistro?: string,
): string {
  if (environment.kind === "windows") return "Windows (Native)";
  if (environment.kind === "macos") return "macOS (Native)";
  if (environment.kind === "wsl") {
    const distro =
      environment.distro ??
      (environment.id === "local" ? currentDistro : undefined);
    return distro ? `WSL (${distro})` : "WSL (Current distribution)";
  }
  return environment.label.startsWith("Linux (")
    ? environment.label
    : "Linux (Native)";
}

export function installationRegistration(
  installation: AgentInstallation,
  registrations: readonly AgentRegistration[],
  currentDistro?: string,
): AgentRegistration | undefined {
  return (
    registrations.find((r) => r.installationId === installation.id) ??
    registrations.find(
      (r) =>
        r.adapterId === installation.adapterId &&
        r.executablePath === installation.executablePath &&
        r.homePath === installation.homePath &&
        (r.environment.id === installation.environment.id ||
          (r.environment.kind === "wsl" &&
            installation.environment.kind === "wsl" &&
            r.environment.id === "local" &&
            installation.environment.distro === currentDistro)),
    )
  );
}
