import { useQuery } from "@tanstack/react-query";
import type {
  EvidenceChange,
  EvidenceRecord,
} from "@agentintersect-world/world-schema";

import { getCurrentEvidence, type EvidencePair } from "./evidence-client.js";

function ChangeRow({
  change,
  onSelectObject,
}: {
  readonly change: EvidenceChange;
  readonly onSelectObject: (ref: string, path: string) => void;
}) {
  const selectable = change.objectRef !== null;
  return (
    <li
      className={`evidence-change evidence-change--${change.outcome}`}
      data-evidence-outcome={change.outcome}
      data-evidence-attribution={change.attribution}
    >
      <div className="evidence-change__summary">
        <span className={`evidence-badge evidence-badge--${change.outcome}`}>
          {change.outcome}
        </span>
        <strong>{change.path}</strong>
        {change.previousPath && <span>from {change.previousPath}</span>}
      </div>
      <dl className="evidence-change__truth">
        <div>
          <dt>Attribution</dt>
          <dd>{change.attribution}</dd>
        </div>
        <div>
          <dt>Observation</dt>
          <dd>{change.observationLabel}</dd>
        </div>
        <div>
          <dt>Object</dt>
          <dd>{change.objectState}</dd>
        </div>
      </dl>
      <button
        type="button"
        className="evidence-select"
        disabled={!selectable}
        onClick={() => {
          if (change.objectRef) onSelectObject(change.objectRef, change.path);
        }}
      >
        {selectable
          ? `Select ${change.path} in repository`
          : "Reported path has no repository object"}
      </button>
      {change.diff && (
        <details>
          <summary>Sanitized bounded text diff</summary>
          <pre>{change.diff}</pre>
        </details>
      )}
      {change.binary && <p>Binary content unavailable; metadata and hash only.</p>}
      {change.diagnostics.map((diagnostic) => (
        <p key={diagnostic}>{diagnostic}</p>
      ))}
    </li>
  );
}

function EvidenceRecordView({
  label,
  record,
  onSelectObject,
}: {
  readonly label: "Current evidence" | "Previous evidence";
  readonly record: EvidenceRecord;
  readonly onSelectObject: (ref: string, path: string) => void;
}) {
  return (
    <article className="evidence-record" aria-label={label}>
      <header>
        <span className="terminal-kicker">{label}</span>
        <h3>{record.lifecycle} · {record.attributionLabel}</h3>
      </header>
      <dl className="evidence-identities">
        <div><dt>Intent ID</dt><dd>{record.intentId}</dd></div>
        <div><dt>Job ID</dt><dd>{record.jobId}</dd></div>
        <div><dt>Run ID</dt><dd>{record.runId}</dd></div>
        <div>
          <dt>Observation window</dt>
          <dd>{record.observationWindow.openedAt} → {record.observationWindow.closedAt}</dd>
        </div>
        <div><dt>Test truth</dt><dd>{record.test.verification} · {record.test.state}</dd></div>
      </dl>
      <p>{record.test.diagnostic}</p>
      <p className="evidence-bounds">
        Bounds: {record.bounds.maxChangedPaths} paths · 1 MiB total text diff · 128 KiB per file · {record.bounds.redactions} redactions
      </p>
      {(record.bounds.pathsTruncated || record.bounds.diffTruncated) && (
        <p role="status">Evidence is explicitly truncated; hashes, sizes, and diagnostics remain authoritative.</p>
      )}
      <ul className="evidence-changes">
        {record.changes.map((change) => (
          <ChangeRow
            key={`${change.previousPath ?? ""}:${change.path}:${change.outcome}`}
            change={change}
            onSelectObject={onSelectObject}
          />
        ))}
      </ul>
    </article>
  );
}

export function EvidencePanel({
  evidence,
  onSelectObject,
}: {
  readonly evidence: EvidencePair;
  readonly onSelectObject: (ref: string, path: string) => void;
}) {
  if (!evidence.current)
    return <section className="panel-state" role="status">No completed Phase 8 evidence is available.</section>;
  return (
    <section className="evidence-panel" aria-labelledby="evidence-panel-title">
      <header className="panel-heading">
        <span>Phase 8 · authoritative DOM evidence</span>
        <h2 id="evidence-panel-title">Observed repository effects</h2>
        <p>Changes are observed in the exact run window; exclusive agent authorship is never claimed.</p>
      </header>
      <EvidenceRecordView label="Current evidence" record={evidence.current} onSelectObject={onSelectObject} />
      {evidence.previous && (
        <EvidenceRecordView label="Previous evidence" record={evidence.previous} onSelectObject={onSelectObject} />
      )}
    </section>
  );
}

export function EvidencePanelLoader({
  fixture,
  onSelectObject,
}: {
  readonly fixture?: EvidencePair;
  readonly onSelectObject: (ref: string, path: string) => void;
}) {
  const query = useQuery({
    queryKey: ["phase8-evidence-current", Boolean(fixture)],
    queryFn: async () => {
      if (fixture) return fixture;
      const result = await getCurrentEvidence();
      if (result.status !== "ok") throw new Error(result.message);
      return result.data;
    },
    retry: false,
  });
  if (query.isPending)
    return <section className="panel-state" role="status">Loading current and previous evidence…</section>;
  if (query.isError)
    return <section className="panel-state" role="alert">Evidence unavailable: {query.error.message}</section>;
  return <EvidencePanel evidence={query.data} onSelectObject={onSelectObject} />;
}
