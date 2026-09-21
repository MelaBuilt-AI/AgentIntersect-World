import { useEffect, useState } from "react";
import {
  repositoryGitStatus,
  selectedRepositoryProject,
  type GitStatus,
} from "./repository-workbench-client.js";
import "./repository-workbench.css";
import type {
  WorkstreamApiRecord,
  WorkstreamCreateInput,
} from "./workstream-client.js";

export type NewWorkstreamOptions = {
  sourceWorkstream?: NonNullable<WorkstreamCreateInput["sourceWorkstream"]>;
  task: string;
  branch?: string;
  startPoint: string;
  prIntent: "local" | "draft-pr";
};
export function NewWorkstreamDialog({
  repositoryId,
  agentName,
  startPoint,
  sourceWorkstream = null,
  onStart,
  onClose,
  onWorkbench,
}: {
  repositoryId: string | null;
  agentName: string | null;
  startPoint: string;
  sourceWorkstream?: Pick<
    WorkstreamApiRecord,
    "workstreamId" | "revision" | "title"
  > | null;
  onStart: (options: NewWorkstreamOptions) => Promise<void>;
  onClose: () => void;
  onWorkbench: () => void;
}) {
  const [task, setTask] = useState("");
  const [branch, setBranch] = useState("");
  const [base, setBase] = useState(startPoint);
  const [sourceMode, setSourceMode] = useState<
    "" | "uncommitted" | "last-commit" | "commit"
  >(sourceWorkstream && startPoint === "HEAD" ? "" : "commit");
  const [sourceStatus, setSourceStatus] = useState<GitStatus | null>(null);
  const [prIntent, setPrIntent] = useState<"local" | "draft-pr">("draft-pr");
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!repositoryId) return;
    let active = true;
    void selectedRepositoryProject(repositoryId)
      .then(async ({ project }) => {
        if (!project)
          throw new Error("Open this repository through Load Repo first");
        const value = await repositoryGitStatus(project.id);
        const workStatus = sourceWorkstream
          ? await repositoryGitStatus(project.id, sourceWorkstream.workstreamId)
          : null;
        if (active) {
          setStatus(value);
          setSourceStatus(workStatus);
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : "Repository unavailable",
          );
      });
    return () => {
      active = false;
    };
  }, [repositoryId, sourceWorkstream]);
  const canStart =
    !!repositoryId &&
    !!agentName &&
    !!status?.head &&
    !!task.trim() &&
    (sourceMode === "commit"
      ? /^(HEAD|[a-f0-9]{40,64})$/.test(base.trim())
      : !!sourceMode && !!sourceStatus?.head) &&
    confirmed &&
    !busy;
  return (
    <section
      className="repository-workbench repository-workbench--new"
      data-world-ui="true"
      role="dialog"
      aria-label="New Workstream"
    >
      <header>
        <div>
          <p className="repository-workbench__eyebrow">
            NEW TASK / FEATURE BRANCH
          </p>
          <h2>New Workstream</h2>
        </div>
        <button type="button" disabled={busy} onClick={onClose}>
          Close
        </button>
      </header>
      <p>
        Create an isolated branch and worktree, then send one task to{" "}
        <strong>{agentName ?? "a selected connected agent"}</strong>. The
        original Workstream keeps its agent and files. Choose which version the
        new agent receives.
      </p>
      {!repositoryId ? (
        <p>Load a repository first.</p>
      ) : !status && !error ? (
        <p>Reading source repository…</p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {status && !status.head ? (
        <p>
          This repository has no commits. Open Workbench and explicitly create
          an initial checkpoint first.
        </p>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canStart) return;
          setBusy(true);
          setError(null);
          void onStart({
            task: task.trim(),
            ...(branch.trim() ? { branch: branch.trim() } : {}),
            startPoint: base.trim(),
            ...(sourceWorkstream &&
            sourceStatus?.head &&
            (sourceMode === "uncommitted" || sourceMode === "last-commit")
              ? {
                  sourceWorkstream: {
                    workstreamId: sourceWorkstream.workstreamId,
                    expectedRevision: sourceWorkstream.revision,
                    expectedHead: sourceStatus.head,
                    mode: sourceMode,
                  },
                }
              : {}),
            prIntent,
          })
            .catch((reason: unknown) =>
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Workstream could not start",
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Task
            <textarea
              aria-label="New Workstream task"
              value={task}
              onChange={(event) => setTask(event.target.value)}
              maxLength={2000}
              required
            />
          </label>
          <label>
            Feature branch
            <input
              aria-label="New Workstream branch"
              placeholder="Leave blank for a unique world/… branch"
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              maxLength={128}
            />
          </label>
          {sourceWorkstream ? (
            <fieldset>
              <legend>Continue from: {sourceWorkstream.title}</legend>
              <label className="repository-workbench__file">
                <input
                  type="radio"
                  name="workstream-source"
                  checked={sourceMode === "uncommitted"}
                  onChange={() => setSourceMode("uncommitted")}
                />
                Copy current uncommitted work
              </label>
              <p>
                Includes the last commit plus current edits, deletions and new
                files. No commit is created; the original stays unchanged.
                Ignored files (such as dependencies) are not copied.
              </p>
              <label className="repository-workbench__file">
                <input
                  type="radio"
                  name="workstream-source"
                  checked={sourceMode === "last-commit"}
                  onChange={() => setSourceMode("last-commit")}
                />
                Start from this Workstream’s last commit
              </label>
              <p>
                Use the saved version
                {sourceStatus?.head
                  ? ` (${sourceStatus.head.slice(0, 12)})`
                  : ""}
                , excluding all uncommitted edits.
              </p>
              <label className="repository-workbench__file">
                <input
                  type="radio"
                  name="workstream-source"
                  checked={sourceMode === "commit"}
                  onChange={() => setSourceMode("commit")}
                />
                Start from project HEAD or another commit
              </label>
            </fieldset>
          ) : null}
          {sourceMode === "commit" ? (
            <>
              <label>
                Start from commit
                <input
                  aria-label="New Workstream base commit"
                  value={base}
                  onChange={(event) => setBase(event.target.value)}
                  list="workstream-base-commits"
                  required
                />
              </label>
              <datalist id="workstream-base-commits">
                <option value="HEAD">Current source HEAD</option>
                {status?.commits.map((commit) => (
                  <option key={commit.sha} value={commit.sha}>
                    {commit.subject}
                  </option>
                ))}
              </datalist>
              <p>
                Use HEAD or an exact commit SHA. A new branch is created;
                existing files are never reset or checked out. Uncommitted
                source changes are not copied into the new worktree.
              </p>
            </>
          ) : null}
          <label>
            Delivery intent
            <select
              aria-label="Workstream delivery intent"
              value={prIntent}
              onChange={(event) =>
                setPrIntent(event.target.value as "local" | "draft-pr")
              }
            >
              <option value="draft-pr">Feature / draft PR intended</option>
              <option value="local">Local-only Workstream</option>
            </select>
          </label>
          <p>
            PR intent is saved locally. Workbench provides separate confirmed
            commit, push and GitHub PR actions. Starting here does not publish
            anything.
          </p>
          <label className="repository-workbench__file">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Create this isolated worktree and send the task to the selected
            agent.
          </label>
          <div className="repository-workbench__actions">
            <button type="submit" disabled={!canStart}>
              {busy ? "Starting…" : "Start Workstream"}
            </button>
            <button type="button" onClick={onWorkbench}>
              Open Workbench instead
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
