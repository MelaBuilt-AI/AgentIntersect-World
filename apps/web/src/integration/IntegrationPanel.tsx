import type { HarnessReadiness, IntegrationState } from "./types.js";

export function IntegrationPanel({
  state,
  readiness,
}: {
  readonly state: IntegrationState;
  readonly readiness: HarnessReadiness | null;
}) {
  const replayed =
    state.replay.replayed ||
    state.status === "stale" ||
    state.status === "offline" ||
    state.status === "mismatch";
  return (
    <section
      className="integration-panel"
      aria-labelledby="integration-heading"
      data-integration-status={state.status}
    >
      <header className="integration-panel__header">
        <div>
          <span className="terminal-kicker">agentintersect_read_</span>
          <h2 id="integration-heading">Phase 6 observation-only</h2>
        </div>
        <span
          className={`integration-status integration-status--${state.status}`}
          role="status"
        >
          {state.status}
        </span>
      </header>
      <p className="truthful-copy">
        Health, workspace, state, snapshot, feed, and SSE are read only. No job,
        worker, authentication, or execution command is available.
      </p>
      <div
        className="integration-diagnostics"
        aria-label="Integration diagnostics"
      >
        {state.diagnostics.length === 0 ? (
          <p>No integration diagnostics.</p>
        ) : (
          state.diagnostics.map((item) => <p key={item}>{item}</p>)
        )}
        {readiness && (
          <p>
            <strong>Selected harness:</strong> {readiness.status} —{" "}
            {readiness.diagnostic}
          </p>
        )}
      </div>
      <div className="integration-grid">
        <section aria-labelledby="phase-board-heading">
          <h3 id="phase-board-heading">Phase board</h3>
          {state.projection.phaseBoard.current ? (
            <dl>
              <dt>Current observation</dt>
              <dd>
                {state.projection.phaseBoard.current.id} ·{" "}
                {state.projection.phaseBoard.current.status ?? "observed"}
              </dd>
            </dl>
          ) : (
            <p>Truthful empty phase board.</p>
          )}
          {state.projection.phaseBoard.previous.map((phase) => (
            <p key={phase.id}>
              <strong>Previous / replayed:</strong> {phase.id} ·{" "}
              {phase.status ?? "observed"}
            </p>
          ))}
        </section>
        <section aria-labelledby="roster-heading">
          <h3 id="roster-heading">Observed roster</h3>
          {state.projection.roster.length === 0 ? (
            <p>No owned agent or worker observations.</p>
          ) : (
            <ul>
              {state.projection.roster.map((agent) => (
                <li key={agent.id}>
                  <strong>{agent.id}</strong> ·{" "}
                  {agent.harness ?? "unknown harness"} ·{" "}
                  {agent.status ?? "observed"}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section
        className="integration-timeline"
        aria-labelledby="timeline-heading"
      >
        <h3 id="timeline-heading">Bounded normalized timeline</h3>
        <p>
          {replayed
            ? "Previous / replayed last-good observations"
            : "Current fresh observations"}{" "}
          · {state.replay.acceptedCount} accepted
        </p>
        {state.projection.timeline.length === 0 ? (
          <p>Nothing has been observed yet.</p>
        ) : (
          <ol>
            {state.projection.timeline.map((event) => (
              <li key={event.id}>
                <time dateTime={event.occurredAt}>{event.occurredAt}</time>
                <strong>{event.type}</strong>
                <span>
                  {event.source}
                  {event.fallbackId ? " · canonical fallback ID" : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <div
        className="observation-controls"
        aria-label="Disabled execution controls"
      >
        <button type="button" disabled>
          Start selected harness
        </button>
        <button type="button" disabled>
          Advance phase
        </button>
        <span>
          Disabled: Phase 6 can observe but cannot execute or mutate
          AgentIntersect.
        </span>
      </div>
    </section>
  );
}
