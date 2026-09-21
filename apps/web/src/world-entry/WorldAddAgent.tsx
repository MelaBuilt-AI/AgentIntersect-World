import { useContext, useEffect, useEffectEvent, useRef, useState } from "react";
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
import { WorldEntryLogo } from "./WorldEntryLogo.js";
import { useReducedMotion } from "../motion/use-reduced-motion.js";
import type { WorldEntryAdapterId } from "./world-entry-machine.js";

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

export type WorldAgentChoice = {
  session: WorldAgentSession;
  proposal: AvatarProposal;
  draft: AvatarDraft;
};
type Candidate = { session: WorldAgentSession; proposal: AvatarProposal };
export default function WorldAddAgent({
  currentSession,
  currentProposal,
  mode = "add",
  singleAgent = false,
  switchBlocked = false,
  previousAgents = [],
  onReplaced,
  userName = "User",
  onSelect,
  onClose,
  onAdded,
}: {
  readonly currentSession: WorldAgentSession;
  readonly currentProposal: AvatarProposal;
  readonly mode?: "add" | "change";
  readonly singleAgent?: boolean;
  readonly switchBlocked?: boolean;
  readonly previousAgents?: readonly WorldAgentChoice[];
  readonly onReplaced?: (choice: WorldAgentChoice) => void;
  readonly userName?: string;
  readonly onSelect?: (rosterId: string) => void;
  readonly onClose: () => void;
  readonly onAdded: (
    roster: ConstellationState,
    sessions: Readonly<Record<string, WorldAgentSession>>,
    proposal: AvatarProposal,
    draft: AvatarDraft,
  ) => void;
}) {
  const setup = useContext(AgentSetupContext);
  const reducedMotion = useReducedMotion();
  const [harness, setHarness] = useState<WorldEntryAdapterId>(
    currentSession.adapterId as WorldEntryAdapterId,
  );
  const [name, setName] = useState("");
  const changing = mode === "change";
  const replacing = changing && singleAgent;
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
  const connectSaved = useEffectEvent((registration: AgentRegistration) => {
    void connect(registration);
  });
  useEffect(() => {
    const pick = (e: Event) => {
      if (
        e instanceof CustomEvent &&
        typeof e.detail?.connectionId === "string"
      ) {
        setRequested(e.detail.connectionId);
        if (changing && e.detail.registration)
          connectSaved(e.detail.registration);
      }
    };
    window.addEventListener("aiw:add-saved-agent", pick);
    return () => window.removeEventListener("aiw:add-saved-agent", pick);
  }, [changing]);
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
  const available = (setup?.registrations ?? []).filter(
    (r) => replacing || !used.has(r.id),
  );
  const selectedRegistration = available.find((r) => r.id === requested);
  const count = roster ? Math.max(1, roster.projection.agents.length) : 1;
  useEffect(() => {
    if (
      !changing &&
      roster &&
      count < 4 &&
      !available.length &&
      !openedSetup.current
    ) {
      openedSetup.current = true;
      window.dispatchEvent(
        new CustomEvent("aiw:open-agent-setup", {
          detail: { addToWorld: true },
        }),
      );
    }
  }, [roster, count, available.length, changing]);
  async function connect(registration?: AgentRegistration) {
    if (
      busy ||
      (changing && switchBlocked) ||
      !roster ||
      (!replacing && count >= 4)
    )
      return;
    setBusy(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      if (registration) {
        const check = await recheckSetupAgent(registration.id);
        if (abort.signal.aborted) return;
        if (check.status !== "ready") {
          window.dispatchEvent(
            new CustomEvent("aiw:open-agent-setup", {
              detail: {
                addToWorld: true,
                switchAgent: changing,
                harness: registration.adapterId,
              },
            }),
          );
          throw new Error(check.message);
        }
      }
      const retained = replacing
        ? previousAgents.find(
            (a) => a.session.connectionId === registration?.id && registration,
          )
        : undefined;
      if (retained) {
        const restored = await api.status(retained.session.sessionId);
        if (restored.status !== "ready")
          throw new Error(
            "Saved agent is unavailable. Recheck it in Agent Setup.",
          );
        if (!abort.signal.aborted && live.current)
          onReplaced?.({ ...retained, session: restored });
        return;
      }
      const result =
        !registration && harness === "hermes"
          ? await client.connectHermes(name.trim())
          : await client.connectWorldOwnedAgent(
              registration?.adapterId ?? harness,
              worldInstanceId,
              registration?.displayName ?? name.trim(),
              registration?.id,
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

  const selectPrevious = async (choice: WorldAgentChoice) => {
    if (busy || switchBlocked) return;
    setBusy(true);
    setError("");
    try {
      const session = await api.status(choice.session.sessionId);
      if (session.status !== "ready")
        throw new Error(
          "Saved agent is unavailable. Recheck it in Agent Setup.",
        );
      if (live.current) onReplaced?.({ ...choice, session });
    } catch (e) {
      if (live.current)
        setError(
          e instanceof Error ? e.message : "Saved agent is unavailable.",
        );
    } finally {
      if (live.current) setBusy(false);
    }
  };
  const pickHarness = (adapterId: WorldEntryAdapterId) => {
    if (busy || switchBlocked || !roster) return;
    setHarness(adapterId);
    setError("");
    if (replacing && adapterId === currentSession.adapterId) {
      onClose();
      return;
    }
    const previous = replacing
      ? previousAgents.filter((a) => a.session.adapterId === adapterId)
      : [];
    if (previous.length === 1) {
      void selectPrevious(previous[0]!);
      return;
    }
    const connected = roster.projection.agents.filter(
      (a) =>
        a.adapterId === adapterId &&
        a.connection === "connected" &&
        a.avatar.status === "accepted",
    );
    if (!replacing && connected.length === 1) {
      onSelect?.(connected[0]!.rosterId);
      return;
    }
    const saved = available.filter((r) => r.adapterId === adapterId);
    if (saved.length === 1) {
      void connect(saved[0]);
      return;
    }
    if (saved.length > 1) return; // Explicit environment/identity choice below.
    window.dispatchEvent(
      new CustomEvent("aiw:open-agent-setup", {
        detail: { addToWorld: true, switchAgent: true, harness: adapterId },
      }),
    );
  };
  async function accept(proposal: AvatarProposal, draft: AvatarDraft) {
    if (!candidate || busy) return;
    setBusy(true);
    setError("");
    try {
      if (!(await client.acceptAgentAvatar(candidate.session, proposal)))
        throw new Error("Avatar save unavailable. Retry.");
      if (replacing) {
        joined.current = true;
        onReplaced?.({ session: candidate.session, proposal, draft });
        return;
      }
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
    <div className="world-escape-backdrop" data-world-selection={mode}>
      <section
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={changing ? "Change Agent" : "Add Agent"}
        aria-busy={busy && !!candidate}
        data-world-selection={mode}
        className={`world-escape-dialog world-add-agent${candidate ? " world-add-agent--avatar" : changing ? " world-change-agent" : ""}`}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !changing) {
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
        <h2>{changing ? "Change Agent" : "Add Agent"}</h2>
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
            {changing && switchBlocked ? (
              <p role="status">
                Wait for the current chat turn or queued messages to finish
                before switching agents.
              </p>
            ) : null}
            {changing ? (
              <>
                <p>
                  {replacing
                    ? "Switch your single active agent. The previous agent’s conversation and work stay saved; they are not transferred."
                    : "Choose your active agent. Existing agents keep their sessions and any work already in progress."}
                </p>
                <div
                  className="world-escape-actions"
                  aria-label="Connected agents"
                >
                  {(roster?.projection.agents.length
                    ? roster.projection.agents
                        .filter(
                          (a) =>
                            a.connection === "connected" &&
                            a.avatar.status === "accepted",
                        )
                        .map((a) => ({ id: a.rosterId, name: a.displayName }))
                    : [
                        {
                          id: currentSession.sessionId,
                          name: currentProposal.displayName,
                        },
                      ]
                  ).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="world-action--enabled"
                      disabled={busy}
                      onClick={() => onSelect?.(a.id)}
                    >
                      Use {a.name}
                    </button>
                  ))}
                </div>
                <WorldEntryLogo
                  userName={userName}
                  stage="prompt"
                  reducedMotion={reducedMotion}
                  singleSelected={false}
                  selectedHarness={harness}
                  connectionPending={busy || switchBlocked || !roster}
                  rosterFull={false}
                  onSingle={() => {}}
                  onHarness={pickHarness}
                />
                {!setup && count < 4 ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (name.trim() && !busy) void connect();
                    }}
                  >
                    <label>
                      Agent name
                      <input
                        aria-label="Agent name"
                        value={name}
                        maxLength={80}
                        disabled={busy}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <button
                      type="submit"
                      className="world-action--enabled"
                      disabled={busy || !roster || !name.trim()}
                    >
                      Connect agent
                    </button>
                  </form>
                ) : null}
              </>
            ) : null}
            {selectedRegistration ? (
              <p role="status">
                “{selectedRegistration.displayName}” is ready to add. Select its
                Add button below.
              </p>
            ) : null}
            {count >= 4 && !replacing ? (
              <p>World is full. Four simultaneous agents are supported.</p>
            ) : (
              available
                .filter((r) => !changing || r.adapterId === harness)
                .map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="world-action--enabled"
                    aria-pressed={r.id === requested}
                    disabled={busy || !roster}
                    onClick={() => void connect(r)}
                  >
                    {changing ? "Connect" : "Add"}{" "}
                    {r.adapterId === "claude-code"
                      ? "Claude Code"
                      : r.adapterId}{" "}
                    · {setupEnvironmentLabel(r.environment)} · “{r.displayName}”
                  </button>
                ))
            )}
            <button
              type="button"
              className="world-action--enabled"
              disabled={busy || (!replacing && count >= 4)}
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
