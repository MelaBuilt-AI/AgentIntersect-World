import { useEffect, useRef } from "react";
import { WorldScreen, WorldScreenToggle } from "./WorldScreen.js";

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
  const focusTarget = useRef<HTMLElement>(null);
  const focusedWorkstreamId = useRef<string | null>(null);
  const resolvedSource = source ?? (fixture ? "demo" : null);
  const cancellable =
    Boolean(workstream.authority) &&
    ["planning", "working", "blocked", "completed"].includes(workstream.status);
  const cancelLabel = actionPending
    ? "Cancelling Workstream…"
    : cancellable
      ? "Cancel Workstream"
      : workstream.authority
        ? `Cancel unavailable — Workstream is ${workstream.status}.`
        : "Cancel unavailable — no owned worktree.";
  useEffect(() => {
    if (focusedWorkstreamId.current === workstream.workstreamId) return;
    const target = focusTarget.current;
    if (!target) return;
    focusedWorkstreamId.current = workstream.workstreamId;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: "auto", block: "nearest" });
  }, [workstream.workstreamId]);
  return (
    <section
      id="work-inspector"
      ref={focusTarget}
      className="work-inspector"
      aria-label="Work Inspector"
      tabIndex={-1}
    >
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
        {resolvedSource === "live" &&
        workstream.status === "cancelled" &&
        workstream.authority?.worktreeState === "removed" ? (
          <p role="status">
            Workstream cancelled. The owned worktree was removed.
          </p>
        ) : null}
      </header>
      <section aria-labelledby="work-inspector-plan">
        <h3 id="work-inspector-plan">Plan</h3>
        <ol>
          {workstream.plan.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      {workstream.diff ? (
        <section aria-labelledby="work-inspector-diff">
          <h3 id="work-inspector-diff">Bounded diff</h3>
          <p>{workstream.diff.summary || "No tracked diff yet."}</p>
          {workstream.diff.patch ? <pre>{workstream.diff.patch}</pre> : null}
          {workstream.diff.truncated ? <p>Diff view truncated.</p> : null}
        </section>
      ) : null}
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
      {workstream.evidenceRefs && workstream.evidenceRefs.length > 0 ? (
        <section aria-labelledby="work-inspector-evidence">
          <h3 id="work-inspector-evidence">Evidence references</h3>
          <ul>
            {workstream.evidenceRefs.map((reference) => (
              <li key={reference}>{reference}</li>
            ))}
          </ul>
        </section>
      ) : null}
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
          {cancelLabel}
        </button>
      ) : null}
    </section>
  );
}

export function WorldWorkstreamStatus({
  workstream,
  open,
  pending,
  message,
  onInspect,
  onCancel,
  worldViewAction,
  onApproveStaticPreview,
}: {
  readonly workstream: Workstream;
  readonly open: boolean;
  readonly pending: boolean;
  readonly message: string | null;
  readonly onInspect: () => void;
  readonly onCancel: () => void;
  readonly onApproveStaticPreview?: (() => void) | undefined;
  readonly worldViewAction?: {
    readonly label: string;
    readonly message?: string;
    readonly enabled: boolean;
    readonly onStart: () => void;
  };
}) {
  return (
    <WorldScreen id="workbench">
      <aside
        className="world-workstream-status"
        aria-label="Current Workstream"
        data-workstream-status={workstream.status}
      >
        <header>
          <WorldScreenToggle id="workbench" />
          <strong>Workbench · {workstream.status}</strong>
          <span>{workstream.title}</span>
        </header>
        <p>{workstream.currentActivity}</p>
        {message ? <p role="status">{message}</p> : null}
        <button
          type="button"
          className="world-action--enabled"
          aria-controls="work-inspector"
          aria-expanded={open}
          disabled={pending}
          onClick={onInspect}
        >
          {open ? "Close Work Inspector" : "Inspect current Workstream"}
        </button>
        {onApproveStaticPreview ? (
          <div>
            <p>
              Static website: approve World’s read-only loopback server for
              index.html in this Workstream. No package scripts or network
              permissions are granted to the agent.
            </p>
            <button
              type="button"
              className="world-action--enabled"
              disabled={pending}
              onClick={onApproveStaticPreview}
            >
              Approve static website preview
            </button>
          </div>
        ) : null}
        {worldViewAction?.message ? (
          <p role="status">{worldViewAction.message}</p>
        ) : null}
        {worldViewAction ? (
          <button
            type="button"
            className={
              worldViewAction.enabled
                ? "world-action--enabled"
                : "world-action--unavailable"
            }
            disabled={!worldViewAction.enabled || pending}
            onClick={worldViewAction.onStart}
          >
            {worldViewAction.label}
          </button>
        ) : null}
        {open ? (
          <WorkInspector
            workstream={workstream}
            source="live"
            onCancel={onCancel}
            actionPending={pending}
          />
        ) : null}
      </aside>
    </WorldScreen>
  );
}
