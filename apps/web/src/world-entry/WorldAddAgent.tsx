import { useContext, useEffect, useRef, useState } from "react";
import type { AvatarDraft } from "@agentintersect-world/avatar-system";
import type { AgentRegistration } from "@agentintersect-world/world-schema/agent-setup";
import {
  AgentSessionClient,
  type AvatarProposal,
  type ConstellationState,
  type WorldAgentSession,
} from "../sessions/session-client.js";
import { AgentSetupContext } from "./agent-setup-context.js";
import { recheckSetupAgent } from "./agent-setup-client.js";
import { setupEnvironmentLabel } from "./agent-setup-presentation.js";
import { createWorldEntryClient } from "./world-entry-client.js";
import { WorldEntryAgentAvatar } from "./WorldEntryAgentAvatar.js";

function rosterAgent(session: WorldAgentSession, proposal: AvatarProposal) {
  return {
    rosterId: session.sessionId,
    adapterId: session.adapterId,
    sessionOwnership:
      session.adapterId === "hermes" && !session.connectionId
        ? ("operator-persistent" as const)
        : ("world-owned" as const),
    worldSessionId: session.sessionId,
    nativeRootSessionRef:
      typeof session.adapterRootSessionRef === "string"
        ? session.adapterRootSessionRef
        : session.adapterSessionRef,
    displayName: proposal.displayName,
  };
}

type Candidate = { session: WorldAgentSession; proposal: AvatarProposal };
export default function WorldAddAgent({
  currentSession,
  currentProposal,
  onClose,
  onAdded,
}: {
  readonly currentSession: WorldAgentSession;
  readonly currentProposal: AvatarProposal;
  readonly onClose: () => void;
  readonly onAdded: (
    roster: ConstellationState,
    sessions: Readonly<Record<string, WorldAgentSession>>,
    proposal: AvatarProposal,
    draft: AvatarDraft,
  ) => void;
}) {
  const setup = useContext(AgentSetupContext);
  const [api] = useState(() => new AgentSessionClient());
  const [client] = useState(() =>
    createWorldEntryClient({ sessionClient: api }),
  );
  const [roster, setRoster] = useState<ConstellationState | null>(null);
  const [sessions, setSessions] = useState<
    Readonly<Record<string, WorldAgentSession>>
  >({ [currentSession.sessionId]: currentSession });
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState<string | null>(null);
  useEffect(() => {
    const pick = (e: Event) => {
      if (
        e instanceof CustomEvent &&
        typeof e.detail?.connectionId === "string"
      )
        setRequested(e.detail.connectionId);
    };
    window.addEventListener("aiw:add-saved-agent", pick);
    return () => window.removeEventListener("aiw:add-saved-agent", pick);
  }, []);
  const [error, setError] = useState("");
  const owner = useRef("");
  const worldInstanceId = roster?.projection.worldInstanceId ?? "";
  const controller = useRef<AbortController | null>(null);
  const live = useRef(true);
  const pending = useRef<Candidate | null>(null);
  const joined = useRef(false);
  const openedSetup = useRef(false);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    live.current = true;
    dialog.current?.focus();
    void api
      .currentConstellation()
      .then(async (next) => {
        const attached = await Promise.all(
          next.projection.agents.map((a) => api.status(a.worldSessionId)),
        );
        if (!live.current) return;
        setSessions(
          Object.fromEntries(
            [currentSession, ...attached].map((s) => [s.sessionId, s]),
          ),
        );
        owner.current = next.projection.worldInstanceId;
        setRoster(next);
      })
      .catch(() => {
        if (live.current)
          setError("Saved roster could not be checked. Cancel and retry.");
      });
    return () => {
      live.current = false;
      controller.current?.abort();
      if (
        pending.current &&
        !joined.current &&
        pending.current.session.adapterId !== "hermes"
      )
        void api
          .endWorldSession(pending.current.session.sessionId, owner.current)
          .catch(() => {});
    };
  }, [api, currentSession]);
  const used = new Set(
    Object.values(sessions)
      .map((s) => s.connectionId)
      .filter(Boolean),
  );
  const available = (setup?.registrations ?? []).filter((r) => !used.has(r.id));
  const selectedRegistration = available.find((r) => r.id === requested);
  const count = roster ? Math.max(1, roster.projection.agents.length) : 1;
  useEffect(() => {
    if (roster && count < 4 && !available.length && !openedSetup.current) {
      openedSetup.current = true;
      window.dispatchEvent(
        new CustomEvent("aiw:open-agent-setup", {
          detail: { addToWorld: true },
        }),
      );
    }
  }, [roster, count, available.length]);
  async function connect(registration: AgentRegistration) {
    if (busy || !roster || count >= 4) return;
    setBusy(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const check = await recheckSetupAgent(registration.id);
      if (abort.signal.aborted) return;
      if (check.status !== "ready") throw new Error(check.message);
      const result = await client.connectWorldOwnedAgent(
        registration.adapterId,
        worldInstanceId,
        registration.displayName,
        registration.id,
        abort.signal,
      );
      if (!("session" in result)) throw new Error(result.message);
      if (abort.signal.aborted || !live.current) {
        if (result.session.adapterId !== "hermes")
          await api.endWorldSession(result.session.sessionId, worldInstanceId);
        return;
      }
      if (!result.proposal) throw new Error("Agent avatar is unavailable.");
      pending.current = { session: result.session, proposal: result.proposal! };
      setCandidate(pending.current);
    } catch (e) {
      if (live.current && !abort.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "Agent connection unavailable. Retry or Cancel.",
        );
    } finally {
      if (live.current) setBusy(false);
    }
  }
  async function accept(proposal: AvatarProposal, draft: AvatarDraft) {
    if (!candidate || busy) return;
    setBusy(true);
    setError("");
    try {
      if (!(await client.acceptAgentAvatar(candidate.session, proposal)))
        throw new Error("Avatar save unavailable. Retry.");
      let next = await api.currentConstellation();
      if (
        next.projection.agents.length >= 4 &&
        !next.projection.agents.some(
          (a) => a.worldSessionId === candidate.session.sessionId,
        )
      )
        throw new Error("4 of 4 agents — World is full.");
      if (
        !next.projection.agents.some(
          (a) => a.worldSessionId === currentSession.sessionId,
        )
      ) {
        next = await api.addConstellationAgent({
          expectedRevision: next.projection.revision,
          idempotencyKey: crypto.randomUUID(),
          worldInstanceId,
          agent: rosterAgent(currentSession, currentProposal),
        });
        const existing = next.projection.agents.find(
          (a) => a.worldSessionId === currentSession.sessionId,
        )!;
        next = await api.setConstellationAvatar(existing.rosterId, {
          expectedRevision: next.projection.revision,
          idempotencyKey: crypto.randomUUID(),
          worldInstanceId,
          avatar: {
            status: "accepted",
            profileId: currentProposal.proposalId,
            sessionId: currentSession.sessionId,
          },
        });
      }
      const present = next.projection.agents.find(
        (a) => a.worldSessionId === candidate.session.sessionId,
      );
      if (!present)
        next = await api.addConstellationAgent({
          expectedRevision: next.projection.revision,
          idempotencyKey: crypto.randomUUID(),
          worldInstanceId,
          agent: rosterAgent(candidate.session, proposal),
        });
      const added = next.projection.agents.find(
        (a) => a.worldSessionId === candidate.session.sessionId,
      )!;
      next = await api.setConstellationAvatar(added.rosterId, {
        expectedRevision: next.projection.revision,
        idempotencyKey: crypto.randomUUID(),
        worldInstanceId,
        avatar: {
          status: "accepted",
          profileId: proposal.proposalId,
          sessionId: candidate.session.sessionId,
        },
      });
      joined.current = true;
      onAdded(
        next,
        { ...sessions, [candidate.session.sessionId]: candidate.session },
        proposal,
        draft,
      );
    } catch (e) {
      if (live.current)
        setError(
          e instanceof Error ? e.message : "Could not add agent. Retry.",
        );
    } finally {
      if (live.current) setBusy(false);
    }
  }
  return (
    <div className="world-escape-backdrop">
      <section
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Add Agent"
        className={`world-escape-dialog world-add-agent${candidate ? " world-add-agent--avatar" : ""}`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            if (!busy || !candidate) onClose();
          }
          if (e.key === "Tab") {
            const items = [
              ...e.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
              ),
            ].filter((el) => el.getClientRects().length);
            const first = items[0],
              last = items.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <h2>Add Agent</h2>
        <p>{count} of 4 agents</p>
        {candidate ? (
          <WorldEntryAgentAvatar
            proposal={candidate.proposal}
            busy={busy}
            error={error}
            onAccept={(p, d) => void accept(p, d)}
          />
        ) : (
          <>
            <p>Your current World, conversations and work stay open.</p>
            {selectedRegistration ? (
              <p role="status">
                “{selectedRegistration.displayName}” is ready to add. Select its
                Add button below.
              </p>
            ) : null}
            {count >= 4 ? (
              <p>World is full. Four simultaneous agents are supported.</p>
            ) : (
              available.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="world-action--enabled"
                  aria-pressed={r.id === requested}
                  disabled={busy || !roster}
                  onClick={() => void connect(r)}
                >
                  Add{" "}
                  {r.adapterId === "claude-code" ? "Claude Code" : r.adapterId}{" "}
                  · {setupEnvironmentLabel(r.environment)} · “{r.displayName}”
                </button>
              ))
            )}
            <button
              type="button"
              className="world-action--enabled"
              disabled={busy || count >= 4}
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("aiw:open-agent-setup", {
                    detail: { addToWorld: true },
                  }),
                )
              }
            >
              Set Up Another Agent
            </button>
            {busy ? <p role="status">Connecting agent…</p> : null}
            {error ? <p role="alert">{error}</p> : null}
          </>
        )}
        <button
          type="button"
          className="world-action--enabled"
          disabled={busy && !!candidate}
          onClick={onClose}
        >
          Cancel
        </button>
      </section>
    </div>
  );
}
