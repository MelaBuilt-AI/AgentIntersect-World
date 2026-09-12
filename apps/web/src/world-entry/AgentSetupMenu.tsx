import { useEffect, useRef, useState } from "react";
import type {
  AgentInstallation,
  AgentSetupState,
  DiscoveryResult,
  SetupHarness,
} from "@agentintersect-world/world-schema/agent-setup";
import "./agent-setup.css";
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
  busy,
  onAttach,
}: {
  readonly installation: AgentInstallation;
  readonly busy: boolean;
  readonly onAttach: (input: AttachInput) => void;
}) {
  const [identityId, setIdentityId] = useState(
    installation.identities[0]?.id ?? "",
  );
  const [displayName, setDisplayName] = useState("");
  const [working, setWorking] = useState(false);
  const [conversationRef, setConversationRef] = useState("");
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
      <fieldset disabled={busy || working}>
        <legend>{installation.environment.label}</legend>
        <span className="agent-setup-found">Found — not attached</span>
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
}: {
  readonly state: AgentSetupState;
  readonly discovery: DiscoveryResult | null;
  readonly busy: boolean;
  readonly message: string;
  readonly onDiscover: (additionalDirectory?: string) => void;
  readonly onAttach: (input: AttachInput) => void;
  readonly onRecheck: (connectionId: string) => void;
  readonly onComplete: () => void;
  readonly onClose?: () => void;
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
            Read-only search of accessible Windows and WSL installations. No
            installs, logins, provider changes or service restarts.
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
                  installations.map((installation) => (
                    <InstallationForm
                      key={installation.id}
                      installation={installation}
                      busy={busy}
                      onAttach={onAttach}
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
                      · {registration.environment.label} ·{" "}
                      {registration.identity.label}
                    </span>
                    <small>
                      Saved — connection readiness is checked before use
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
