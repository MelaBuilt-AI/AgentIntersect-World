import type {
  Workstream,
  WorkstreamTracerSource,
} from "./workstream-tracer.js";

export function WorkInspector({
  workstream,
  fixture = false,
  source,
  onCancel,
  actionPending = false,
}: {
  readonly workstream: Workstream;
  readonly fixture?: boolean;
  readonly source?: WorkstreamTracerSource | undefined;
  readonly onCancel?: (() => void) | undefined;
  readonly actionPending?: boolean | undefined;
}) {
  const resolvedSource = source ?? (fixture ? "demo" : null);
  const cancellable =
    Boolean(workstream.authority) &&
    ["planning", "working", "blocked"].includes(workstream.status);
  return (
    <section className="work-inspector" aria-label="Work Inspector">
      <header>
        <h2>Work Inspector</h2>
        {resolvedSource === "demo" ? (
          <p className="work-inspector__fixture">
            <strong>Deterministic demo fixture</strong> · read-only tracer. No
            live branch, preview, push, approval, or check result.
          </p>
        ) : null}
        {resolvedSource === "phase14" ? (
          <p className="work-inspector__source">
            <strong>Authoritative Phase 14 read-only projection</strong> ·
            existing current journey. No Phase 14 action is available here.
          </p>
        ) : null}
        {resolvedSource === "live" ? (
          <p className="work-inspector__source">
            <strong>Authoritative current Workstream</strong> · owned local
            authority and correlated evidence only.
          </p>
        ) : null}
        <p>
          <strong>{workstream.title}</strong>
        </p>
        <p>
          Status: {workstream.status} · {workstream.currentActivity}
        </p>
      </header>
      <section aria-labelledby="work-inspector-plan">
        <h3 id="work-inspector-plan">Plan</h3>
        <ol>
          {workstream.plan.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="work-inspector-files">
        <h3 id="work-inspector-files">Changed files</h3>
        {workstream.changedFiles.length === 0 ? (
          <p>No changed files reported yet.</p>
        ) : (
          <ul>
            {workstream.changedFiles.map((file) => (
              <li key={file.path}>
                <code>{file.path}</code> · {file.change}
                <br />
                <small>Diff summary reference: {file.diffSummaryRef}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="work-inspector-validation">
        <h3 id="work-inspector-validation">Validation</h3>
        {workstream.validation.length === 0 ? (
          <p>No validation checks reported yet.</p>
        ) : (
          <ul>
            {workstream.validation.map((check) => (
              <li key={check.id}>
                <strong>{check.label}</strong> · {check.state}
                <br />
                <span>{check.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p>
        Updated{" "}
        <time dateTime={workstream.updatedAt}>{workstream.updatedAt}</time>
      </p>
      {resolvedSource === "live" && onCancel ? (
        <button
          type="button"
          className={cancellable ? "world-action--enabled" : undefined}
          disabled={!cancellable || actionPending}
          onClick={onCancel}
        >
          {actionPending ? "Cancelling Workstream…" : "Cancel Workstream"}
        </button>
      ) : null}
    </section>
  );
}
