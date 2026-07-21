import { useEffect, useMemo, useRef, useState } from "react";

import {
  AgentSessionClient,
  type AvatarProposal,
  type DesignPreview,
  type NativeSession,
  type SessionCapability,
  type WorldAgentSession,
} from "./session-client.js";
import {
  applyAgentStreamEvent,
  beginAgentStreamTurn,
  completeAgentStreamTurn,
  failAgentStreamTurn,
  type ChatMessage,
} from "./agent-stream-state.js";
import { PHASE12_SESSION_FIXTURE } from "./session-fixtures.js";

type Mode = "explore" | "collaborate";

export type AgentSessionViewState = {
  readonly health: "detecting" | "ready" | "offline";
  readonly profile: "default";
  readonly capabilities: readonly SessionCapability[];
  readonly nativeSessions: readonly NativeSession[];
  readonly selectedNativeSession: string;
  readonly mode: Mode;
  readonly worldSession: WorldAgentSession | null;
  readonly repositoryRef: string;
  readonly workspaceId: string;
  readonly continuityLabel: "Current" | "Previous / recovered" | "Unavailable";
  readonly messages: readonly ChatMessage[];
  readonly toolStatuses: readonly string[];
  readonly avatarProposal: AvatarProposal | null;
  readonly avatarConsent: "pending" | "accepted" | "declined" | "revoked";
  readonly designs: readonly DesignPreview[];
  readonly lastResult: string;
  readonly busy: boolean;
};

export function AgentSessionExperience({
  state,
  onNativeSession,
  onMode,
  onConnect,
  onSend,
  onAvatarDecision,
  onAvatarEdit,
  onAvatarRevoke,
}: {
  readonly state: AgentSessionViewState;
  readonly onNativeSession: (sessionId: string) => void;
  readonly onMode: (mode: Mode) => void;
  readonly onConnect: () => void;
  readonly onSend: (text: string) => void;
  readonly onAvatarDecision: (decision: "accepted" | "declined") => void;
  readonly onAvatarEdit: (displayName: string) => void;
  readonly onAvatarRevoke: () => void;
}) {
  const [draft, setDraft] = useState("");
  const manifest = state.capabilities.find(
    (item) => item.adapterId === "hermes",
  );
  const connected = state.worldSession !== null;
  const sendEnabled =
    connected && !state.busy && manifest?.capabilities.sendText === true;
  const avatarConsentEnabled = state.health !== "offline";
  const avatarRevokeEnabled =
    avatarConsentEnabled && state.avatarConsent === "accepted";
  const step = (number: number, title: string, content: React.ReactNode) => (
    <li>
      <span className="connector-step__number" aria-hidden="true">
        {number}
      </span>
      <div>
        <h3>{title}</h3>
        {content}
      </div>
    </li>
  );
  return (
    <section
      className="agent-session-panel"
      aria-labelledby="agent-session-title"
    >
      <header className="agent-session-panel__header">
        <div>
          <span className="terminal-kicker">persistent_agent_session_</span>
          <h2 id="agent-session-title">Hermes connector and World chat</h2>
        </div>
        <span className={`session-truth session-truth--${state.health}`}>
          {state.continuityLabel} · {state.health}
        </span>
      </header>
      <ol
        className="connector-flow"
        aria-label="Numbered Hermes connector flow"
      >
        {step(
          1,
          "Detect plugin and API health",
          <p>
            {state.health === "ready"
              ? "Loopback capability attestation ready."
              : "Hermes connector unavailable."}
          </p>,
        )}
        {step(
          2,
          "Confirm profile",
          <p>
            <strong>{state.profile}</strong> profile; bearer stays on the World
            server.
          </p>,
        )}
        {step(
          3,
          "Select existing Discord session",
          <label>
            Session
            <select
              value={state.selectedNativeSession}
              onChange={(event) => onNativeSession(event.target.value)}
              aria-label="Existing Hermes session"
            >
              {state.nativeSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.id} · {session.title}
                </option>
              ))}
            </select>
          </label>,
        )}
        {step(
          4,
          "Inspect capabilities",
          <ul className="capability-list">
            {Object.entries(manifest?.capabilities ?? {}).map(
              ([name, enabled]) => (
                <li key={name}>
                  <span>{name}</span>
                  <strong>
                    {enabled
                      ? "Supported"
                      : `Unavailable: ${manifest?.unavailable[name] ?? "Not advertised"}`}
                  </strong>
                </li>
              ),
            )}
          </ul>,
        )}
        {step(
          5,
          "Select session mode",
          <div className="session-mode-actions">
            <button
              type="button"
              className={`session-action ${state.mode === "explore" ? "session-action--active" : ""}`}
              onClick={() => onMode("explore")}
            >
              Explore · read-only
            </button>
            <button
              type="button"
              className={`session-action ${state.mode === "collaborate" ? "session-action--active" : ""}`}
              onClick={() => onMode("collaborate")}
            >
              Collaborate · native policy
            </button>
            <button
              type="button"
              className="session-action session-action--disabled"
              disabled
            >
              Autonomous · disabled
            </button>
            <span>
              Later phase: bounded Autonomous execution is not available.
            </span>
          </div>,
        )}
        {step(
          6,
          "Review permission behavior",
          <p>
            {manifest?.capabilities.approvals
              ? "Native approval choices are forwarded unchanged."
              : `Unavailable: ${manifest?.unavailable.approvals ?? "Native approvals stay in Hermes."}`}
          </p>,
        )}
        {step(
          7,
          connected ? "Resume exact session" : "Connect exact session",
          <button
            type="button"
            className="session-action session-action--active"
            disabled={state.health !== "ready"}
            onClick={onConnect}
          >
            {connected ? "Re-attest and resume" : "Connect existing session"}
          </button>,
        )}
        {step(
          8,
          "Send harmless persistent text",
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.trim() && sendEnabled) {
                onSend(draft.trim());
                setDraft("");
              }
            }}
          >
            <label>
              Message
              <textarea
                value={draft}
                maxLength={16_384}
                onChange={(event) => setDraft(event.target.value)}
                disabled={!sendEnabled}
              />
            </label>
            <button
              className={
                sendEnabled
                  ? "session-action session-action--active"
                  : "session-action session-action--disabled"
              }
              disabled={!sendEnabled}
            >
              Send to exact session
            </button>
          </form>,
        )}
        {step(
          9,
          "Review bounded avatar proposal",
          state.avatarProposal ? (
            <div className="avatar-proposal">
              <label>
                Display name
                <input
                  aria-label="Edit bounded avatar display name"
                  className={
                    avatarConsentEnabled
                      ? undefined
                      : "avatar-proposal__input--disabled"
                  }
                  value={state.avatarProposal.displayName}
                  maxLength={64}
                  disabled={!avatarConsentEnabled}
                  onChange={(event) => onAvatarEdit(event.target.value)}
                />
              </label>
              <p>{state.avatarProposal.sourceDisclosure}</p>
              <p>{state.avatarProposal.rationale}</p>
              <div>
                <button
                  className={
                    avatarConsentEnabled
                      ? "session-action session-action--active"
                      : "session-action session-action--disabled"
                  }
                  type="button"
                  disabled={!avatarConsentEnabled}
                  onClick={() => onAvatarDecision("accepted")}
                >
                  Accept / save edits
                </button>
                <button
                  className={
                    avatarConsentEnabled
                      ? "session-action session-action--active"
                      : "session-action session-action--disabled"
                  }
                  type="button"
                  disabled={!avatarConsentEnabled}
                  onClick={() => onAvatarDecision("declined")}
                >
                  Decline
                </button>
                <button
                  className={
                    avatarRevokeEnabled
                      ? "session-action session-action--active"
                      : "session-action session-action--disabled"
                  }
                  type="button"
                  disabled={!avatarRevokeEnabled}
                  onClick={onAvatarRevoke}
                >
                  Revoke
                </button>
              </div>
            </div>
          ) : (
            <p>
              No plugin-owned proposal is available; neutral avatar remains.
            </p>
          ),
        )}
        {step(
          10,
          "Enter or reopen World chat",
          <dl className="session-identity">
            <div>
              <dt>Profile</dt>
              <dd>{state.profile}</dd>
            </div>
            <div>
              <dt>Session</dt>
              <dd>{state.selectedNativeSession || "not selected"}</dd>
            </div>
            <div>
              <dt>Repository</dt>
              <dd>{state.repositoryRef}</dd>
            </div>
            <div>
              <dt>Workspace</dt>
              <dd>{state.workspaceId}</dd>
            </div>
          </dl>,
        )}
      </ol>
      <section
        className="persistent-chat"
        aria-label="Persistent accessible World chat"
      >
        <header>
          <h3>World display projection</h3>
          <span>{state.continuityLabel}</span>
        </header>
        <p>
          Hermes transcript is canonical. World retains only bounded approved
          display content.
        </p>
        <ol aria-live="polite" aria-relevant="additions text">
          {state.messages.map((message, index) => (
            <li key={`${message.role}-${index}`}>
              <strong>{message.role === "user" ? "Operator" : "Hermes"}</strong>
              <p>{message.text}</p>
            </li>
          ))}
        </ol>
      </section>
      <aside
        className="agent-overhead-status"
        aria-label="Bounded overhead agent status"
      >
        <span>{state.busy ? "Hermes is responding…" : "Hermes ready"}</span>
        <p>
          {state.messages.at(-1)?.text.slice(0, 160) ??
            "No approved display message."}
        </p>
        {state.toolStatuses.length > 0 ? (
          <ul aria-label="Live bounded tool status" aria-live="polite">
            {state.toolStatuses.map((status, index) => (
              <li key={`${status}-${index}`}>{status}</li>
            ))}
          </ul>
        ) : null}
      </aside>
      <section
        className="guided-build-preview"
        aria-labelledby="guided-build-title"
      >
        <h3 id="guided-build-title">Guided Build validation preview</h3>
        <p>
          AgentIntersect owns import, submission, phases, approvals,
          advancement, jobs, and processes. This view cannot mutate them.
        </p>
        {state.designs.length === 0 ? (
          <p>No bounded design files discovered.</p>
        ) : (
          <ul>
            {state.designs.map((design) => (
              <li key={design.relativePath}>
                <strong>{design.name}</strong>
                <span>{design.relativePath}</span>
                <span>Validation: {design.validation}</span>
                <span>Phases: {design.phaseHeadings.join(", ") || "none"}</span>
                <span>
                  Acceptance: {design.acceptanceHeadings.join(", ") || "none"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="session-results" role="status" aria-live="polite">
        <span>result_</span>
        <strong>{state.lastResult}</strong>
      </div>
    </section>
  );
}

const initialState: AgentSessionViewState = {
  ...PHASE12_SESSION_FIXTURE,
  health: "detecting",
  capabilities: [],
  nativeSessions: [],
  selectedNativeSession: "",
  worldSession: null,
  continuityLabel: "Unavailable",
  messages: [],
  toolStatuses: [],
  avatarProposal: null,
  designs: [],
  lastResult: "Detecting the loopback Hermes adapter…",
};

const SESSION_POINTER_KEY = "aiw.agent-session.pointer.0.12";
const WORLD_SESSION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function AgentSessionPanel({
  fixtureState,
  enabled = true,
}: {
  readonly fixtureState?: AgentSessionViewState;
  readonly enabled?: boolean;
} = {}) {
  const client = useMemo(() => new AgentSessionClient(), []);
  const activeStream = useRef<AbortController | null>(null);
  const [state, setState] = useState(
    fixtureState ??
      (enabled
        ? initialState
        : {
            ...initialState,
            health: "offline" as const,
            lastResult:
              "Agent sessions are not enabled in the local World server configuration.",
          }),
  );
  useEffect(() => {
    if (fixtureState || !enabled) return;
    let active = true;
    const savedPointer = window.localStorage.getItem(SESSION_POINTER_KEY);
    const resumablePointer =
      savedPointer && WORLD_SESSION_ID.test(savedPointer) ? savedPointer : null;
    if (savedPointer && !resumablePointer)
      window.localStorage.removeItem(SESSION_POINTER_KEY);
    const restored = resumablePointer
      ? Promise.all([
          client.status(resumablePointer),
          client.history(resumablePointer),
          client.avatarProposal(resumablePointer),
        ])
          .then(([worldSession, history, avatarProposal]) => ({
            worldSession,
            history,
            avatarProposal,
            missing: false as const,
          }))
          .catch(() => ({ missing: true as const }))
      : Promise.resolve(null);
    void Promise.all([
      client.capabilities(),
      client.nativeSessions("hermes"),
      client.designs(),
      restored,
    ])
      .then(([capabilities, nativeSessions, designs, recovery]) => {
        if (!active) return;
        if (recovery?.missing)
          window.localStorage.removeItem(SESSION_POINTER_KEY);
        const resumed = recovery && !recovery.missing ? recovery : null;
        setState((current) => ({
          ...current,
          health: "ready",
          capabilities,
          nativeSessions,
          selectedNativeSession:
            resumed?.worldSession.adapterSessionRef ??
            nativeSessions[0]?.id ??
            "",
          worldSession: resumed?.worldSession ?? null,
          continuityLabel: resumed
            ? resumed.worldSession.continuity === "previous-recovered"
              ? "Previous / recovered"
              : "Current"
            : "Unavailable",
          messages: resumed?.history.messages ?? [],
          avatarProposal: resumed?.avatarProposal ?? null,
          avatarConsent:
            resumed?.history.avatarConsent?.state ?? current.avatarConsent,
          designs,
          lastResult: resumed
            ? "Exact World session and bounded history projection resumed."
            : recovery?.missing
              ? "Saved World session is missing or unavailable; reconnect explicitly."
              : nativeSessions.length > 0
                ? "Hermes ready; select and connect the existing session."
                : "Hermes ready, but no existing session is available.",
        }));
      })
      .catch(() => {
        if (active)
          setState((current) => ({
            ...current,
            health: "offline",
            lastResult: "Hermes plugin/API is offline or unavailable.",
          }));
      });
    return () => {
      active = false;
    };
  }, [client, enabled, fixtureState]);
  useEffect(
    () => () => {
      activeStream.current?.abort();
    },
    [],
  );
  const connect = () => {
    if (!state.selectedNativeSession) return;
    setState((current) => ({
      ...current,
      busy: true,
      lastResult: "Attesting exact session binding…",
    }));
    void client
      .attach({
        adapterId: "hermes",
        adapterSessionRef: state.selectedNativeSession,
        profile: "default",
        workspaceId: state.workspaceId,
        repositoryRef: state.repositoryRef,
        mode: state.mode,
        ...(state.mode === "collaborate" ? { modeConfirmed: true } : {}),
      })
      .then(async (worldSession) => ({
        worldSession,
        avatarProposal: await client
          .avatarProposal(worldSession.sessionId)
          .catch(() => null),
      }))
      .then(({ worldSession, avatarProposal }) => {
        window.localStorage.setItem(
          SESSION_POINTER_KEY,
          worldSession.sessionId,
        );
        setState((current) => ({
          ...current,
          worldSession,
          avatarProposal,
          busy: false,
          continuityLabel:
            worldSession.continuity === "previous-recovered"
              ? "Previous / recovered"
              : "Current",
          lastResult: "Exact existing Hermes session connected.",
        }));
      })
      .catch((error: unknown) =>
        setState((current) => ({
          ...current,
          busy: false,
          continuityLabel: "Unavailable",
          lastResult:
            error instanceof Error ? error.message : "Session attach failed.",
        })),
      );
  };
  const send = (text: string) => {
    if (!state.worldSession) return;
    if (fixtureState) {
      setState((current) => ({
        ...current,
        messages: [
          ...current.messages,
          { role: "user", text },
          { role: "assistant", text: `Fixture persistent reply: ${text}` },
        ],
        lastResult: "Fixture final response received in the exact session.",
      }));
      return;
    }
    const worldSession = state.worldSession;
    const controller = new AbortController();
    activeStream.current?.abort();
    activeStream.current = controller;
    setState((current) => ({
      ...current,
      ...beginAgentStreamTurn(current.messages, text),
      busy: true,
      lastResult: "Turn accepted; streaming the authoritative response.",
    }));
    void client
      .stream(worldSession, text, {
        signal: controller.signal,
        onEvent: (event) =>
          setState((current) => ({
            ...current,
            ...applyAgentStreamEvent(current, event),
            lastResult: event.type.startsWith("tool.")
              ? "Hermes tool status received; details remain redacted."
              : "Hermes response is streaming in order.",
          })),
      })
      .then((result) =>
        setState((current) => ({
          ...current,
          ...completeAgentStreamTurn(current, result.finalText),
          busy: false,
          lastResult: "Hermes final response received in the exact session.",
        })),
      )
      .catch((error: unknown) =>
        setState((current) => ({
          ...current,
          ...failAgentStreamTurn(current),
          busy: false,
          lastResult:
            error instanceof Error
              ? `Stream ended: ${error.message}`
              : "Stream ended with an unknown error.",
        })),
      )
      .finally(() => {
        if (activeStream.current === controller) activeStream.current = null;
      });
  };
  return (
    <AgentSessionExperience
      state={state}
      onNativeSession={(selectedNativeSession) => {
        window.localStorage.removeItem(SESSION_POINTER_KEY);
        setState((current) => ({
          ...current,
          selectedNativeSession,
          worldSession: null,
          messages: [],
          toolStatuses: [],
          avatarProposal: null,
          avatarConsent: "pending",
          continuityLabel: "Unavailable",
          lastResult:
            "Existing session selected; connect to attest its binding.",
        }));
      }}
      onMode={(mode) => {
        if (
          mode === "collaborate" &&
          !window.confirm(
            "Collaborate is more permissive than Explore. Continue with native Hermes approval policy?",
          )
        )
          return;
        window.localStorage.removeItem(SESSION_POINTER_KEY);
        setState((current) => ({
          ...current,
          mode,
          worldSession: null,
          continuityLabel: "Unavailable",
          lastResult: `${mode === "explore" ? "Explore" : "Collaborate"} selected; reconnect to bind permission revision.`,
        }));
      }}
      onConnect={connect}
      onSend={send}
      onAvatarEdit={(displayName) =>
        setState((current) => ({
          ...current,
          avatarProposal: current.avatarProposal
            ? { ...current.avatarProposal, displayName }
            : null,
          avatarConsent: "pending",
          lastResult: "Bounded avatar proposal edit is awaiting consent.",
        }))
      }
      onAvatarDecision={(decision) => {
        if (fixtureState) {
          setState((current) => ({
            ...current,
            avatarConsent: decision,
            lastResult:
              decision === "accepted"
                ? "Bounded avatar proposal accepted."
                : "Avatar proposal declined; neutral profile retained.",
          }));
          return;
        }
        if (!state.worldSession || !state.avatarProposal) return;
        setState((current) => ({ ...current, busy: true }));
        void client
          .avatarConsent(
            state.worldSession.sessionId,
            decision,
            state.avatarProposal,
          )
          .then(() =>
            setState((current) => ({
              ...current,
              busy: false,
              avatarConsent: decision,
              lastResult:
                decision === "accepted"
                  ? "Bounded avatar proposal and edits accepted."
                  : "Avatar proposal declined; neutral profile retained.",
            })),
          )
          .catch((error: unknown) =>
            setState((current) => ({
              ...current,
              busy: false,
              lastResult:
                error instanceof Error
                  ? error.message
                  : "Avatar consent failed.",
            })),
          );
      }}
      onAvatarRevoke={() => {
        if (fixtureState) {
          setState((current) => ({
            ...current,
            avatarConsent: "revoked",
            lastResult:
              "Agent avatar consent revoked; previous remains recoverable.",
          }));
          return;
        }
        if (!state.worldSession) return;
        setState((current) => ({ ...current, busy: true }));
        void client
          .revokeAvatarConsent(state.worldSession.sessionId)
          .then(() =>
            setState((current) => ({
              ...current,
              busy: false,
              avatarConsent: "revoked",
              lastResult:
                "Agent avatar consent revoked; previous remains recoverable.",
            })),
          )
          .catch((error: unknown) =>
            setState((current) => ({
              ...current,
              busy: false,
              lastResult:
                error instanceof Error
                  ? error.message
                  : "Avatar revoke failed.",
            })),
          );
      }}
    />
  );
}
