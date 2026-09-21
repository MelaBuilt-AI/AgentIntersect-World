import { useEffect, useRef, useState } from "react";
import { RepositoryGitPanel } from "./RepositoryGitPanel.js";
import {
  selectedRepositoryProject,
  repositoryGitStatus,
  type GitStatus,
} from "./repository-workbench-client.js";
import type { WorkstreamApiRecord } from "./workstream-client.js";
import "./repository-workbench.css";

export function AgentChangeWorkDialog({
  repositoryId,
  source,
  agentName,
  onContinue,
  onCancel,
}: {
  repositoryId: string;
  source: Pick<WorkstreamApiRecord, "workstreamId" | "title">;
  agentName: string;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);
  const [result, setResult] = useState<{
    repositoryId: string;
    workstreamId: string;
    projectId?: string;
    status?: GitStatus;
    error?: string;
  } | null>(null);
  const [version, setVersion] = useState(0);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const current =
    result?.repositoryId === repositoryId &&
    result.workstreamId === source.workstreamId
      ? result
      : null;
  const status = current?.status;
  const clean = status?.changes.length === 0;
  useEffect(() => {
    let active = true;
    const identity = { repositoryId, workstreamId: source.workstreamId };
    void selectedRepositoryProject(repositoryId)
      .then(async ({ project }) => {
        if (!project)
          throw new Error(
            "Project unavailable. Cancel and reopen the project before changing agents.",
          );
        const status = await repositoryGitStatus(
          project.id,
          source.workstreamId,
        );
        if (active) setResult({ ...identity, projectId: project.id, status });
      })
      .catch((reason: unknown) => {
        if (active)
          setResult({
            ...identity,
            error:
              reason instanceof Error
                ? reason.message
                : "Git status unavailable",
          });
      });
    return () => {
      active = false;
    };
  }, [repositoryId, source.workstreamId, version]);
  return (
    <div
      className="world-avatar-overlay"
      data-world-selection="agent-change-work"
    >
      <section
        className="repository-workbench repository-workbench--new"
        data-world-ui="true"
        role="dialog"
        aria-modal="true"
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            if (!busy) onCancel();
          }
        }}
        aria-label="Save work before changing agent"
      >
        <header>
          <h2>
            {status
              ? clean
                ? "Ready to change agent"
                : "Local commit before changing agent?"
              : "Check work before changing agent"}
          </h2>
          <button type="button" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </header>
        <p>
          <strong>{agentName}</strong> has worked on{" "}
          <strong>{source.title}</strong>.
        </p>
        <p>
          The existing Workstream stays with its agent. After changing agents,
          start a new Workstream to continue this project.
        </p>
        {!current ? <p role="status">Checking Workstream Git status…</p> : null}
        {current?.error ? (
          <>
            <p role="alert">
              Git status unavailable · {current.error}. No commit state assumed.
            </p>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setVersion((value) => value + 1);
              }}
            >
              Retry Git status
            </button>
          </>
        ) : null}
        {status ? (
          clean ? (
            <p role="status">
              {status.head ? (
                <>
                  All changes committed ·{" "}
                  <span>{status.head.slice(0, 12)}</span>. No new commit needed.
                  In New Workstream, choose{" "}
                  <strong>Start from this Workstream’s last commit</strong> to
                  continue from this saved version.
                </>
              ) : (
                <>Working tree is clean. No changes to commit.</>
              )}
            </p>
          ) : (
            <p>
              This Workstream has uncommitted changes. You can save a local
              commit now, or keep those edits. In New Workstream, choose{" "}
              <strong>Copy current uncommitted work</strong> to carry them
              forward, or{" "}
              <strong>Start from this Workstream’s last commit</strong> for the
              saved version. Neither choice publishes anything.
            </p>
          )
        ) : null}
        {review && current?.projectId && !clean ? (
          <RepositoryGitPanel
            projectId={current.projectId}
            workstreamId={source.workstreamId}
            showCheckpoint={false}
            onNew={() => {}}
            onCommitted={(status) => {
              setResult({ ...current, status });
              if (status.changes.length === 0) onContinue();
            }}
            onBusyChange={setBusy}
            commitOnly
          />
        ) : null}
        <div className="repository-workbench__actions">
          {status && !clean && !review ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setReview(true)}
            >
              Review local commit
            </button>
          ) : null}
          <button type="button" disabled={busy || !status} onClick={onContinue}>
            {status && !clean
              ? "Change without committing"
              : "Continue to Change Agent"}
          </button>
        </div>
      </section>
    </div>
  );
}
