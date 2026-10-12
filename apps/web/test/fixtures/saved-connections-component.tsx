import { useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  AgentRegistration,
  AgentSetupState,
} from "@agentintersect-world/world-schema/agent-setup";
import { AgentSetupMenu } from "../../src/world-entry/AgentSetupMenu.js";
import "../../src/styles.css";

const installation = {
  id: "current-install",
  adapterId: "codex" as const,
  environment: { id: "windows", kind: "windows" as const, label: "Windows" },
  executablePath:
    "C:\\Program Files\\WindowsApps\\OpenAI.Codex_current\\app\\resources\\codex.exe",
  homePath: "C:\\Users\\Fixture",
  identities: [
    {
      id: "default",
      label: "Default",
      kind: "profile" as const,
      profilePath: "C:\\Users\\Fixture\\.codex",
    },
  ],
  status: "found" as const,
};
const registration: AgentRegistration = {
  id: "11111111-1111-4111-8111-111111111111",
  adapterId: "codex",
  installationId: installation.id,
  environment: installation.environment,
  executablePath: installation.executablePath,
  homePath: installation.homePath,
  identity: installation.identities[0]!,
  displayName: "Codex",
  connectedAt: "2026-10-12T00:00:00Z",
};
export function Fixture() {
  const repaired = new URLSearchParams(location.search).has("repaired");
  const [state, setState] = useState<AgentSetupState>({
    schema: "aiw.agent-setup/1",
    completed: true,
    registrations: [
      {
        ...registration,
        ...(repaired
          ? {}
          : {
              installationId: "old-install",
              executablePath: "C:\\Old\\codex.exe",
            }),
      },
      {
        ...registration,
        id: "22222222-2222-4222-8222-222222222222",
        displayName: "Codex2",
      },
    ],
  });
  const [result, setResult] = useState<unknown>(null);
  return (
    <>
      <AgentSetupMenu
        state={state}
        discovery={{
          environments: [
            { id: "windows", label: "Windows", status: "scanned" },
          ],
          installations: [installation],
        }}
        busy={false}
        message="Isolated component fixture — no native agent calls"
        checks={Object.fromEntries(
          state.registrations
            .filter((r) => r.installationId === installation.id)
            .map((r) => [
              r.id,
              { status: "ready" as const, message: "Fixture verified" },
            ]),
        )}
        onDiscover={() => {}}
        onAttach={(input) => {
          setResult(input);
          setState((current) => ({
            ...current,
            registrations: current.registrations.map((r) =>
              r.id === input.replaceConnectionId
                ? {
                    ...r,
                    installationId: input.installationId,
                    executablePath: installation.executablePath,
                    displayName: input.displayName,
                  }
                : r,
            ),
          }));
        }}
        onRecheck={(id) => setResult({ recheck: id })}
        onAddAgent={(id) => setResult({ add: id })}
        onComplete={() => {}}
      />
      <pre id="result" hidden>
        {JSON.stringify(result)}
      </pre>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
