import { useEffect, useState } from "react";

import {
  applyRecovery,
  deleteDiagnosticExport,
  exportDiagnostics,
  getDiagnosticsSnapshot,
  previewDiagnostics,
  previewRecovery,
  type DiagnosticProjection,
  type ReadinessRow,
  type ReadinessStatus,
} from "./diagnostics-client.js";

const CAPABILITIES = [
  "session",
  "tool",
  "world-action",
  "preview",
  "voice",
  "worktree",
  "yjs",
  "sqlite",
] as const;

function overall(rows: readonly ReadinessRow[]): ReadinessStatus {
  const nonVoice = rows.filter((row) => row.capability !== "voice");
  if (nonVoice.some((row) => row.status === "recovery-needed"))
    return "recovery-needed";
  if (nonVoice.some((row) => row.status === "unavailable"))
    return "unavailable";
  if (nonVoice.some((row) => row.status === "degraded")) return "degraded";
  return "ready";
}

function unavailableRows(): ReadinessRow[] {
  return CAPABILITIES.map((capability) => ({
    capability,
    status: "unavailable",
    lastVerifiedAt: "1970-01-01T00:00:00.000Z",
    lastVerifiedRevision: 0,
    evidence: "Authoritative Phase 17 state is not initialized.",
    permittedAction: "none",
  }));
}

export function DiagnosticsPanel({
  projection,
  result,
  recoveryPreviewed,
  diagnosticPreviewId,
  exportId,
  onAction,
}: {
  readonly projection: DiagnosticProjection;
  readonly result: string;
  readonly recoveryPreviewed: boolean;
  readonly diagnosticPreviewId: string | null;
  readonly exportId: string | null;
  readonly onAction: (step: number) => void;
}) {
  const snapshot = projection.current;
  const rows = snapshot?.readiness ?? unavailableRows();
  const needsRecovery =
    snapshot?.operations.some(
      (operation) =>
        operation.state === "orphaned" ||
        operation.state === "interrupted" ||
        operation.reconciliation === "required",
    ) ?? false;
  const available = [
    true,
    needsRecovery,
    needsRecovery && recoveryPreviewed,
    snapshot !== null,
    snapshot !== null && diagnosticPreviewId !== null,
    snapshot !== null && exportId !== null,
  ];
  const labels = [
    "Inspect preserved state",
    "Preview recovery",
    "Apply safe recovery",
    "Preview diagnostics",
    "Export diagnostics",
    "Delete export",
  ];
  const explanations = [
    "Reload current, previous, preserved-corrupt, and loss truth.",
    needsRecovery
      ? "Builds a no-mutation plan."
      : "Unavailable until an interrupted operation is classified.",
    recoveryPreviewed
      ? "Applies only idempotent derived-state/process reconciliation."
      : "Unavailable until recovery is previewed.",
    snapshot
      ? "Builds a summary-first allowlisted manifest."
      : "Unavailable until authoritative state exists.",
    diagnosticPreviewId
      ? "Writes at most 1 MiB inside the managed local export root."
      : "Unavailable until diagnostics are previewed.",
    exportId
      ? "Deletes only the exact managed export and verifies absence."
      : "Unavailable until a local export exists.",
  ];
  return (
    <section
      className="diagnostics-panel"
      aria-label="Diagnostics & Recovery"
      data-truth={projection.truth}
    >
      <header>
        <span className="terminal-kicker">phase17_diagnostics_</span>
        <h2>Diagnostics &amp; Recovery</h2>
        <p>
          Local/private recovery truth · schema{" "}
          <code>aiw.observability/0.17</code>
        </p>
      </header>

      <div className="diagnostics-overall" role="status" aria-live="polite">
        Overall readiness: <strong>{overall(rows)}</strong>
      </div>

      <dl className="diagnostics-truth">
        <div>
          <dt>Current state</dt>
          <dd>{snapshot?.currentState ?? "Unavailable: no current state."}</dd>
        </div>
        <div>
          <dt>Previous verified state</dt>
          <dd>
            {snapshot?.previousVerifiedState ??
              projection.previous?.currentState ??
              "Unavailable: no previous verified state."}
          </dd>
        </div>
        <div>
          <dt>Loss window</dt>
          <dd>{snapshot?.lossWindow ?? "Unknown until state is inspected."}</dd>
        </div>
      </dl>

      <div
        className="diagnostics-table-wrap"
        tabIndex={0}
        aria-label="Scrollable capability readiness matrix"
      >
        <table className="diagnostics-readiness">
          <caption>Eight authoritative capability rows</caption>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              <th scope="col">Status</th>
              <th scope="col">Last verified</th>
              <th scope="col">Evidence / permitted action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.capability}>
                <th scope="row">{row.capability}</th>
                <td>
                  <span
                    className={`readiness-status readiness-status--${row.status}`}
                  >
                    {row.status}
                  </span>
                </td>
                <td>
                  revision {row.lastVerifiedRevision}
                  <br />
                  <time dateTime={row.lastVerifiedAt}>
                    {row.lastVerifiedAt}
                  </time>
                </td>
                <td>
                  {row.evidence}
                  <br />
                  <small>Permitted: {row.permittedAction}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section aria-labelledby="incident-timeline-title">
        <h3 id="incident-timeline-title">Correlated incident timeline</h3>
        {snapshot?.incidents.length ? (
          <ol className="diagnostics-incidents">
            {snapshot.incidents.map((incident) => (
              <li key={incident.incidentId}>
                <strong>
                  {incident.kind} · {incident.status}
                </strong>
                <p>{incident.summary}</p>
                <dl>
                  {(
                    Object.entries(incident.correlation) as [
                      keyof typeof incident.correlation,
                      string | number,
                    ][]
                  ).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <small>
                  revision {incident.revision} · completion evidence: absent
                </small>
              </li>
            ))}
          </ol>
        ) : (
          <p>No correlated incidents are recorded.</p>
        )}
      </section>

      <ol className="diagnostics-actions" aria-label="Recovery workflow">
        {labels.map((label, index) => {
          const enabled = available[index] ?? false;
          return (
            <li key={label} data-step={index + 1}>
              <button
                type="button"
                className={`diagnostics-primary diagnostics-primary--${
                  enabled ? "enabled" : "disabled"
                }`}
                aria-disabled={!enabled}
                aria-describedby={`diagnostics-step-${index + 1}`}
                onClick={() => {
                  if (enabled) onAction(index + 1);
                }}
              >
                {index + 1}. {label}
              </button>
              <small id={`diagnostics-step-${index + 1}`}>
                {explanations[index]}
              </small>
            </li>
          );
        })}
      </ol>
      <p className="diagnostics-result" role="status" aria-live="polite">
        {result}
      </p>
    </section>
  );
}

export function DiagnosticsPanelLoader() {
  const [projection, setProjection] = useState<DiagnosticProjection>({
    schema: "aiw.observability-projection/0.17",
    truth: "unavailable",
    current: null,
    previous: null,
    recoverySource: "empty",
    preservedCorruptCurrent: null,
  });
  const [result, setResult] = useState("Inspect authoritative state to begin.");
  const [recoveryPreviewed, setRecoveryPreviewed] = useState(false);
  const [diagnosticPreviewId, setDiagnosticPreviewId] = useState<string | null>(
    null,
  );
  const [exportId, setExportId] = useState<string | null>(null);

  const inspect = async (signal?: AbortSignal) => {
    const next = await getDiagnosticsSnapshot(signal);
    setProjection(next);
    return next;
  };

  useEffect(() => {
    const controller = new AbortController();
    void getDiagnosticsSnapshot(controller.signal)
      .then((next) => {
        setProjection(next);
        setResult("Current and previous authoritative truth loaded.");
      })
      .catch((error) =>
        setResult(
          error instanceof Error ? error.message : "Diagnostics unavailable.",
        ),
      );
    return () => controller.abort();
  }, []);

  const perform = async (step: number) => {
    try {
      if (step === 1) {
        const next = await inspect();
        setResult(
          next.preservedCorruptCurrent
            ? `1. Preserved corrupt current: ${next.preservedCorruptCurrent}`
            : "1. Preserved state inspected. No corrupt current is present.",
        );
        return;
      }
      const snapshot = projection.current;
      if (!snapshot)
        throw new Error("Authoritative Phase 17 state unavailable.");
      if (step === 2) {
        const plan = await previewRecovery(snapshot);
        setRecoveryPreviewed(true);
        setResult(
          `2. Recovery previewed. Mutation: ${plan.mutation}. ${plan.lossWindow}`,
        );
      } else if (step === 3) {
        await applyRecovery(snapshot);
        setRecoveryPreviewed(false);
        await inspect();
        setResult(
          "3. Recovered safely. Derived state reconciled; Git and worktrees untouched.",
        );
      } else if (step === 4) {
        const preview = await previewDiagnostics(snapshot);
        setDiagnosticPreviewId(preview.previewId);
        setResult(
          "4. Diagnostics preview safe: allowlisted, redacted, local only.",
        );
      } else if (step === 5) {
        if (!diagnosticPreviewId)
          throw new Error("Preview diagnostics before export.");
        const exported = await exportDiagnostics(snapshot, diagnosticPreviewId);
        setExportId(exported.record.exportId);
        await inspect();
        setResult(
          `5. Exported locally: ${exported.record.relativePath} (${exported.record.bytes} bytes).`,
        );
      } else if (step === 6) {
        if (!exportId) throw new Error("No managed export is selected.");
        const deleted = await deleteDiagnosticExport(snapshot, exportId);
        setExportId(null);
        await inspect();
        setResult(
          deleted.absentAfterDelete
            ? "6. Export deleted; managed files are absent."
            : "6. Export deletion could not prove absence.",
        );
      }
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : "Diagnostics action failed.",
      );
    }
  };

  return (
    <DiagnosticsPanel
      projection={projection}
      result={result}
      recoveryPreviewed={recoveryPreviewed}
      diagnosticPreviewId={diagnosticPreviewId}
      exportId={exportId}
      onAction={(step) => void perform(step)}
    />
  );
}
