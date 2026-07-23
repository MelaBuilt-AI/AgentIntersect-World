import type {
  AgentId,
  CoordinationAction,
  CoordinationPresentation,
} from "@agentintersect-world/multi-agent-coordination";
import { useEffect, useRef, useState } from "react";

import {
  getCoordinationSnapshot,
  postCoordinationAction,
  reconcileCoordination,
} from "./coordination-client.js";
import { PHASE16_COORDINATION_FIXTURE } from "./coordination-fixtures.js";

const ACTIONS = [
  "Initialize coordination session",
  "Bind Mr Fluff",
  "Bind Beans",
  "Assign bounded tasks",
  "Declare file/object interest",
  "Record attributable message",
  "Record explicit handoff",
  "Create approved worktree",
  "Attach approved worktree",
  "Validate worktree bindings",
  "Prepare merge candidate",
  "Approve candidate (merge not run)",
  "Preview cleanup",
  "Cancel coordination",
] as const;

export function CoordinationPanel({
  projection,
  onAction,
}: {
  readonly projection: CoordinationPresentation;
  readonly onAction: (step: number) => void;
}) {
  const [followedAgent, setFollowedAgent] = useState<AgentId>("mr-fluff");
  const snapshot = projection.revision === null ? null : projection;
  const enabled = new Set<number>();
  if (snapshot?.worktrees.length) {
    enabled.add(10);
    enabled.add(13);
  }
  if (
    snapshot &&
    !snapshot.cancelled &&
    snapshot.mergeCandidates.some(
      (candidate) => candidate.state !== "operator-approved",
    )
  )
    enabled.add(12);
  if (snapshot && !snapshot.cancelled) enabled.add(14);
  const disabledReason = (step: number): string => {
    if (step === 1)
      return "Initialization requires exact session and repository input through the local API.";
    if ([2, 3, 4, 5, 6, 7, 8, 9, 11].includes(step))
      return "This exact-input action is available only through the local API.";
    if (step === 10)
      return "Disabled until at least one exact worktree binding exists.";
    if (step === 12)
      return "Disabled until an unapproved merge candidate exists.";
    if (step === 13) return "Disabled until an exact worktree binding exists.";
    return "Coordination is already cancelled.";
  };
  const truth =
    projection.truth === "current"
      ? "Current"
      : projection.truth === "previous-recovered"
        ? "Previous / recovered"
        : "Unavailable";
  return (
    <section
      className="coordination-panel"
      aria-label="Phase 16 multi-agent coordination"
    >
      <header className="coordination-panel__header">
        <div>
          <span className="terminal-kicker">phase16_coordination_</span>
          <h2>Two-agent worktree coordination</h2>
        </div>
        <strong data-truth={projection.truth}>{truth}</strong>
      </header>
      <p className="truthful-copy">
        One operator · exactly two editing agents · messages are visible inert
        records · merge approval never runs a merge.
      </p>
      {snapshot && (
        <p className="coordination-follow" role="status">
          Following{" "}
          {snapshot.agents.find((agent) => agent.agentId === followedAgent)
            ?.displayName ?? "no bound agent"}
        </p>
      )}
      {!snapshot ? (
        <p role="status">
          {projection.unavailableReason ??
            "No coordination session has been initialized."}
        </p>
      ) : (
        <>
          <div className="coordination-roster" aria-label="Exact agent roster">
            {snapshot.agents.map((agent) => {
              const task = snapshot.tasks.find(
                (value) => value.taskId === agent.taskId,
              );
              const worktree = snapshot.worktrees.find(
                (value) => value.worktreeId === agent.worktreeId,
              );
              return (
                <article
                  className="coordination-agent-card"
                  key={agent.agentId}
                  data-agent={agent.agentId}
                >
                  <span className="coordination-avatar" aria-hidden>
                    {agent.agentId === "mr-fluff" ? "MF" : "B"}
                  </span>
                  <div>
                    <h3>{agent.displayName}</h3>
                    <p>
                      {agent.adapter} · {agent.model} · {agent.status}
                    </p>
                    <dl>
                      <dt>Task</dt>
                      <dd>{task?.title ?? "Unassigned"}</dd>
                      <dt>Worktree / branch</dt>
                      <dd>
                        {worktree
                          ? `${worktree.displayPath} · ${worktree.branch}`
                          : "Unbound"}
                      </dd>
                      <dt>Git truth</dt>
                      <dd>
                        {worktree
                          ? `${worktree.state} · ${worktree.head}`
                          : "Unavailable"}
                      </dd>
                    </dl>
                    <button
                      type="button"
                      className="coordination-follow__button"
                      aria-pressed={followedAgent === agent.agentId}
                      onClick={() => setFollowedAgent(agent.agentId)}
                    >
                      Follow {agent.displayName}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <section className="coordination-truth-grid">
            <article>
              <h3>Interest and contention</h3>
              {snapshot.contention.map((contention) => (
                <p key={contention.contentionId}>
                  <strong>Interest contention · not a Git conflict</strong>
                  <br />
                  {contention.target} · {contention.agentIds.join(", ")}
                </p>
              ))}
            </article>
            <article>
              <h3>Messages and handoffs</h3>
              {snapshot.messages.map((message) => (
                <blockquote key={message.messageId}>
                  <strong>
                    {message.senderAgentId} → {message.recipientAgentId}
                  </strong>
                  <br />
                  {message.summary}
                  <footer>Inert visible record · no authority</footer>
                </blockquote>
              ))}
              {snapshot.handoffs.map((handoff) => (
                <p key={handoff.handoffId}>
                  Handoff {handoff.senderAgentId} → {handoff.recipientAgentId} ·{" "}
                  {handoff.evidenceCount} exact evidence record(s)
                </p>
              ))}
            </article>
            <article>
              <h3>Merge, conflict, and test truth</h3>
              {snapshot.mergeCandidates.map((candidate) => (
                <div key={candidate.candidateId}>
                  <strong>
                    {candidate.state === "conflicting"
                      ? "Git conflict · merge not run"
                      : `${candidate.state} · merge not run`}
                  </strong>
                  <p>
                    {candidate.sourceBranch} → {candidate.targetBranch}
                  </p>
                  <p>
                    Exact diff {candidate.diffDigest.slice(0, 12)} ·{" "}
                    {candidate.changedPathCount} path(s)
                  </p>
                </div>
              ))}
              {snapshot.testEvidence.map((test) => (
                <p key={test.testId}>
                  {test.statusSummary} · {test.digest.slice(0, 12)}
                </p>
              ))}
            </article>
          </section>
        </>
      )}
      <ol
        className="coordination-actions"
        aria-label="Numbered operator actions"
      >
        {ACTIONS.map((label, index) => {
          const step = index + 1;
          const actionEnabled = enabled.has(step);
          return (
            <li key={label} data-step={step}>
              <button
                type="button"
                className={`coordination-primary coordination-primary--${
                  actionEnabled ? "enabled" : "disabled"
                }`}
                disabled={!actionEnabled}
                aria-describedby={`coordination-step-${step}-reason`}
                onClick={() => onAction(step)}
              >
                {step}. {label}
              </button>
              <small id={`coordination-step-${step}-reason`}>
                {actionEnabled
                  ? "Explicit operator action; result remains visible."
                  : disabledReason(step)}
              </small>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function CoordinationPanelLoader({
  fixture = false,
}: {
  readonly fixture?: boolean;
}) {
  const [projection, setProjection] = useState<CoordinationPresentation | null>(
    fixture ? PHASE16_COORDINATION_FIXTURE : null,
  );
  const [result, setResult] = useState(
    fixture
      ? "Deterministic fixture loaded. This is not the later live Beans proof."
      : "Loading current coordination truth…",
  );
  const actionSequence = useRef(0);
  useEffect(() => {
    if (fixture) return;
    const controller = new AbortController();
    void getCoordinationSnapshot(controller.signal)
      .then((next) => {
        setProjection(next);
        setResult("Current coordination truth loaded.");
      })
      .catch((error: unknown) =>
        setResult(
          error instanceof Error ? error.message : "Coordination unavailable.",
        ),
      );
    return () => controller.abort();
  }, [fixture]);

  const perform = async (step: number) => {
    const revision = projection?.revision;
    if (!projection || revision === null || revision === undefined) {
      setResult("Initialize through the explicit local API contract first.");
      return;
    }
    try {
      actionSequence.current += 1;
      const snapshot = projection;
      if (fixture) {
        if (step === 10) {
          setResult("10. Fixture worktree bindings reconciled.");
        } else if (step === 12) {
          setProjection({
            ...projection,
            mergeCandidates: snapshot.mergeCandidates.map((candidate) => ({
              ...candidate,
              state: "operator-approved",
            })),
          });
          setResult("12. Fixture candidate approved. Merge was not run.");
        } else if (step === 13) {
          setResult("13. Fixture cleanup previewed. Nothing was deleted.");
        } else if (step === 14) {
          setProjection({
            ...projection,
            cancelled: true,
            agents: snapshot.agents.map((agent) => ({
              ...agent,
              status: "cancelled",
            })),
          });
          setResult("14. Fixture coordination cancelled. Owned processes: 0.");
        } else {
          setResult(`${step}. Fixture action is prerequisite-gated.`);
        }
        return;
      }
      if (step === 10) {
        setProjection(
          await reconcileCoordination(
            snapshot.coordinationSessionId ?? "unavailable",
          ),
        );
        setResult("10. Worktree bindings reconciled from Git.");
        return;
      }
      const common = {
        schema: "aiw.coordination-action/0.16",
        coordinationSessionId: snapshot.coordinationSessionId ?? "unavailable",
        actor: "operator",
        operatorApproval: "approved",
        expectedRevision: revision,
        correlationId: `browser-action-${step}-${actionSequence.current}`,
      } as const;
      let action: CoordinationAction;
      if (step === 12) {
        const candidate = snapshot.mergeCandidates.find(
          (value) => value.state !== "operator-approved",
        );
        if (!candidate) throw new Error("No candidate is available.");
        action = {
          ...common,
          action: {
            kind: "merge-candidate.approve",
            candidateId: candidate.candidateId,
          },
        };
      } else if (step === 13) {
        const worktree = snapshot.worktrees[0];
        if (!worktree) throw new Error("No worktree is available.");
        action = {
          ...common,
          action: {
            kind: "cleanup.preview",
            agentId: worktree.agentId,
            worktreeId: worktree.worktreeId,
          },
        };
      } else if (step === 14) {
        action = {
          ...common,
          action: {
            kind: "coordination.cancel",
            reason: "Operator cancelled coordination from the World panel.",
          },
        };
      } else {
        setResult(
          `${step}. Action is fixture-visible and requires exact API input.`,
        );
        return;
      }
      setProjection(await postCoordinationAction(action));
      setResult(
        step === 12
          ? "12. Candidate approved. Merge was not run."
          : step === 13
            ? "13. Cleanup preview recorded. Nothing was deleted."
            : "14. Coordination cancelled and owned work stopped.",
      );
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Action failed.");
    }
  };

  if (!projection)
    return (
      <section className="coordination-panel" role="status">
        {result}
      </section>
    );
  return (
    <>
      <CoordinationPanel
        projection={projection}
        onAction={(step) => void perform(step)}
      />
      <p className="coordination-result" role="status" aria-live="polite">
        {result}
      </p>
    </>
  );
}
