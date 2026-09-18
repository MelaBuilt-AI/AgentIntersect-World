import { useEffect, useRef, useState } from "react";
import type {
  AgentInstallation,
  AgentSetupState,
  DiscoveryResult,
  SetupHarness,
  AgentRegistration,
  SetupCheck,
} from "@agentintersect-world/world-schema/agent-setup";
import "./agent-setup.css";
import { LocalVoiceSetup } from "./LocalVoiceSetup.js";
import {
  installationRegistration,
  setupEnvironmentLabel,
} from "./agent-setup-presentation.js";
import { InstallationSetupActions } from "./InstallationSetupActions.js";

type AttachInput = {
  installationId: string;
  identityId: string;
  displayName: string;
  conversationRef?: string | undefined;
};
const harnesses: readonly { id: SetupHarness; label: string }[] = [
  { id: "hermes", label: "Hermes" },
  { id: "openclaw", label: "OpenClaw" },
  { id: "codex", label: "Codex" },
  { id: "claude-code", label: "Claude Code" },
];
function InstallationForm({
  installation,
  registration,
  check,
  onAddAgent,
  busy,
  onAttach,
}: {
  readonly installation: AgentInstallation;
  readonly registration?: AgentRegistration | undefined;
  readonly check?: SetupCheck | undefined;
  readonly onAddAgent?: ((id: string) => void) | undefined;
  readonly busy: boolean;
  readonly onAttach: (input: AttachInput) => void;
}) {
  const [identityId, setIdentityId] = useState(
    registration?.identity.id ?? installation.identities[0]?.id ?? "",
  );
  const [displayName, setDisplayName] = useState(
    registration?.displayName ?? "",
  );
  const [editing, setEditing] = useState(false);
  const connected = registration && check?.status === "ready";
  const [working, setWorking] = useState(false);
  const [conversationRef, setConversationRef] = useState(
    registration?.conversationRef ?? "",
  );
  return (
    <form
      className="agent-setup-installation"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && !working && identityId && displayName.trim())
          onAttach({
            installationId: installation.id,
            identityId,
            displayName: displayName.trim(),
            ...(conversationRef ? { conversationRef } : {}),
          });
      }}
    >
      {connected ? (
        <div className="agent-setup-connected" role="status">
          <button
            type="button"
            className="agent-setup-success"
            aria-expanded={editing}
            onClick={() => setEditing((value) => !value)}
          >
            {harnesses.find((h) => h.id === registration.adapterId)?.label} ·{" "}
            {setupEnvironmentLabel(installation.environment)} · “
            {registration.displayName}” — Successfully Connected
          </button>
          {onAddAgent ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAddAgent(registration.id)}
            >
              Add Agent
            </button>
          ) : null}
        </div>
      ) : null}
      <fieldset hidden={!!connected && !editing} disabled={busy || working}>
        <legend>{setupEnvironmentLabel(installation.environment)}</legend>
        <span className="agent-setup-found">
          {registration
            ? (check?.message ?? "Saved — Recheck to verify connection")
            : "Found — not attached"}
        </span>
        <code className="agent-setup-path">{installation.executablePath}</code>
        <label>
          Native identity
          <select
            value={identityId}
            onChange={(event) => {
              setIdentityId(event.target.value);
              setConversationRef("");
            }}
          >
            {installation.identities.map((identity) => (
              <option key={identity.id} value={identity.id}>
                {identity.label} · {identity.kind}
              </option>
            ))}
          </select>
        </label>
        <label>
          Agent name
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={80}
            autoComplete="off"
            placeholder="Name this agent in World"
            required
          />
        </label>
        <InstallationSetupActions
          key={`${installation.id}:${identityId}`}
          input={{
            installationId: installation.id,
            identityId,
            displayName: displayName.trim() || "Native connection",
          }}
          hermes={installation.adapterId === "hermes"}
          busy={busy || working}
          onBusy={setWorking}
          onConversation={setConversationRef}
        />
        <p className="agent-setup-note">
          Keeps this native identity’s configuration.{" "}
          {conversationRef
            ? "New Worlds reuse the explicitly selected native conversation; no separate copy is created."
            : "New Worlds use separate conversations; saved work resumes its existing conversation."}
        </p>
        <button
          type="submit"
          disabled={busy || !identityId || !displayName.trim()}
        >
          Attach to Agent Intersect World
        </button>
      </fieldset>
    </form>
  );
}

function EnvironmentInstallations({
  installations,
  discovery,
  registrations,
  checks,
  busy,
  onAttach,
  onAddAgent,
}: {
  readonly installations: readonly AgentInstallation[];
  readonly discovery: DiscoveryResult;
  readonly registrations: readonly AgentRegistration[];
  readonly checks: Readonly<Record<string, SetupCheck>>;
  readonly busy: boolean;
  readonly onAttach: (input: AttachInput) => void;
  readonly onAddAgent?: ((id: string) => void) | undefined;
}) {
  const kind = installations[0]!.environment.kind;
  const distributions =
    kind === "wsl"
      ? [
          ...new Set([
            ...discovery.environments
              .filter((e) => e.id.startsWith("wsl:") && e.id !== "wsl:limit")
              .map((e) => e.id.slice(4)),
            ...installations.flatMap((i) =>
              i.environment.distro ? [i.environment.distro] : [],
            ),
          ]),
        ]
      : [];
  const preferred =
    discovery.defaultWslDistro ??
    discovery.currentWslDistro ??
    (distributions.length === 1 ? distributions[0] : "");
  const [distro, setDistro] = useState(preferred ?? "");
  const candidates = installations.filter(
    (i) =>
      kind !== "wsl" ||
      !distributions.length ||
      i.environment.distro === distro,
  );
  const [selected, setSelected] = useState("");
  const installation =
    candidates.find((i) => i.id === selected) ?? candidates[0];
  const environment = discovery.environments.find(
    (e) => e.id === `wsl:${distro}`,
  );
  const registration = installation
    ? installationRegistration(
        installation,
        registrations,
        discovery.currentWslDistro,
      )
    : undefined;
  return (
    <section className="agent-setup-environment" data-setup-environment={kind}>
      {kind === "wsl" && distributions.length > 1 ? (
        <label>
          WSL distribution
          <select
            value={distro}
            disabled={busy}
            onChange={(e) => {
              setDistro(e.target.value);
              setSelected("");
            }}
          >
            <option value="">Choose a distribution</option>
            {distributions.map((d) => (
              <option key={d} value={d}>
                {d}
                {d === discovery.defaultWslDistro ? " · Default" : ""}
                {d === discovery.currentWslDistro ? " · Current" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {candidates.length > 1 ? (
        <details className="agent-setup-note">
          <summary>Installation options ({candidates.length})</summary>
          <label>
            Installation
            <select
              value={installation?.id ?? ""}
              disabled={busy}
              onChange={(e) => setSelected(e.target.value)}
            >
              {candidates.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.executablePath} · {i.homePath}
                </option>
              ))}
            </select>
          </label>
        </details>
      ) : null}
      {installation ? (
        <InstallationForm
          key={installation.id}
          installation={installation}
          registration={registration}
          check={checks[registration?.id ?? ""]}
          busy={busy}
          onAttach={onAttach}
          onAddAgent={onAddAgent}
        />
      ) : (
        <p>
          {environment?.message ??
            "Select a distribution with an installed agent."}
        </p>
      )}
    </section>
  );
}

export function AgentSetupMenu({
  state,
  discovery,
  busy,
  message,
  onDiscover,
  onAttach,
  onRecheck,
  onComplete,
  onClose,
  closeOnEscape = false,
  checks = {},
  onAddAgent,
}: {
  readonly state: AgentSetupState;
  readonly checks?: Readonly<Record<string, SetupCheck>>;
  readonly onAddAgent?: ((id: string) => void) | undefined;
  readonly discovery: DiscoveryResult | null;
  readonly busy: boolean;
  readonly message: string;
  readonly onDiscover: (additionalDirectory?: string) => void;
  readonly onAttach: (input: AttachInput) => void;
  readonly onRecheck: (connectionId: string) => void;
  readonly onComplete: () => void;
  readonly onClose?: () => void;
  readonly closeOnEscape?: boolean;
}) {
  const [additionalDirectory, setAdditionalDirectory] = useState("");
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.current?.focus({ preventScroll: true });
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div className="agent-setup-layer" data-agent-setup="true">
      <section
        ref={dialog}
        className="agent-setup-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-setup-title"
        data-agent-setup="true"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape" && closeOnEscape && onClose) {
            event.preventDefault();
            event.stopPropagation();
            onClose();
            return;
          }
          if (event.key !== "Tab") return;
          const controls = [
            ...(dialog.current?.querySelectorAll<HTMLElement>(
              "button:not([disabled]), input:not([disabled]), select:not([disabled]), summary",
            ) ?? []),
          ].filter((node) => node.getClientRects().length > 0);
          const first = controls[0],
            last = controls.at(-1);
          if (!first || !last) {
            event.preventDefault();
            return;
          }
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === dialog.current)
          ) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <header className="agent-setup-header">
          <div>
            <span className="terminal-kicker">connect_your_agents_</span>
            <h1 id="agent-setup-title">Agent Setup Menu</h1>
            <p>Connect once. Choose who joins each World later.</p>
          </div>
          {onClose ? (
            <button
              type="button"
              className="agent-setup-secondary"
              onClick={onClose}
              aria-label="Close Agent Setup Menu"
            >
              Close
            </button>
          ) : null}
        </header>
        <div className="agent-setup-discovery">
          <button type="button" disabled={busy} onClick={() => onDiscover()}>
            Discover Agents
          </button>
          <p>
            Read-only search of this computer’s native and accessible WSL
            installations. No installs, logins, provider changes or service
            restarts.
          </p>
        </div>
        <details className="agent-setup-note">
          <summary>Installation not found?</summary>
          <label>
            Extra installation directory on the World server
            <input
              value={additionalDirectory}
              onChange={(event) => setAdditionalDirectory(event.target.value)}
              placeholder="Absolute directory containing the native launcher"
              disabled={busy}
            />
          </label>
          <button
            type="button"
            disabled={busy || !additionalDirectory.trim()}
            onClick={() => onDiscover(additionalDirectory.trim())}
          >
            Search this directory too
          </button>
          <p>
            This adds a local read-only search. Windows and WSL paths belong to
            their own environments; no service is started.
          </p>
        </details>
        <p className="agent-setup-status" role="status" aria-live="polite">
          {busy ? "Working… " : ""}
          {message}
        </p>
        {discovery?.environments
          .filter((environment) => environment.status !== "scanned")
          .map((environment) => (
            <p className="agent-setup-notice" key={environment.id}>
              <strong>{environment.label}:</strong>{" "}
              {environment.message ?? environment.status}
            </p>
          ))}
        <div className="agent-setup-harnesses">
          {harnesses.map((harness) => {
            const installations =
              discovery?.installations.filter(
                (installation) => installation.adapterId === harness.id,
              ) ?? [];
            return (
              <details
                key={harness.id}
                name="agent-setup-harness"
                className="agent-setup-harness"
              >
                <summary>
                  <strong>{harness.label}</strong>
                  <span>
                    {discovery
                      ? `${installations.length} found`
                      : "Not searched"}
                  </span>
                </summary>
                {installations.length ? (
                  [
                    ...new Set(installations.map((i) => i.environment.kind)),
                  ].map((kind) => (
                    <EnvironmentInstallations
                      key={kind}
                      installations={installations.filter(
                        (i) => i.environment.kind === kind,
                      )}
                      discovery={discovery!}
                      registrations={state.registrations}
                      checks={checks}
                      busy={busy}
                      onAttach={onAttach}
                      onAddAgent={onAddAgent}
                    />
                  ))
                ) : (
                  <p className="agent-setup-note">
                    {discovery
                      ? "No installation found in the searched locations. Install or sign in through the native harness, then Discover Agents again."
                      : "Discover Agents to find installations and available native identities."}
                  </p>
                )}
              </details>
            );
          })}
        </div>
        <section
          className="agent-setup-saved"
          aria-labelledby="agent-setup-saved-title"
        >
          <h2 id="agent-setup-saved-title">Saved connections</h2>
          {state.registrations.length ? (
            <ul>
              {state.registrations.map((registration) => (
                <li key={registration.id}>
                  <div>
                    <strong>{registration.displayName}</strong>
                    <span>
                      {
                        harnesses.find(
                          (harness) => harness.id === registration.adapterId,
                        )?.label
                      }{" "}
                      ·{" "}
                      {setupEnvironmentLabel(
                        registration.environment,
                        discovery?.currentWslDistro,
                      )}{" "}
                      · {registration.identity.label}
                    </span>
                    <small>
                      {checks[registration.id]?.status === "ready"
                        ? "Connection verified"
                        : (checks[registration.id]?.message ??
                          "Saved — connection readiness is checked before use")}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="agent-setup-secondary"
                    disabled={busy}
                    onClick={() => onRecheck(registration.id)}
                  >
                    Recheck
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No agents attached yet.</p>
          )}
        </section>
        <LocalVoiceSetup />
        <footer className="agent-setup-footer">
          <p>Setup saves connections, not your current World roster.</p>
          <button
            type="button"
            disabled={busy || state.registrations.length === 0}
            onClick={onComplete}
          >
            Continue to Agent Select
          </button>
        </footer>
      </section>
    </div>
  );
}
