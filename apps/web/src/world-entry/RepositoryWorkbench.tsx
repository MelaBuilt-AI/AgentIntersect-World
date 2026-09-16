import { useEffect, useMemo, useState } from "react";
import type { RepositoryProject } from "./RepositoryIntakeDialog.js";
import { RepositoryGitPanel } from "./RepositoryGitPanel.js";
import {
  repositoryGitStatus,
  repositoryGitAction,
  type GitStatus,
  selectedRepositoryProject,
} from "./repository-workbench-client.js";
import {
  WorkstreamClient,
  type WorkstreamApiRecord,
} from "./workstream-client.js";
import "./repository-workbench.css";

export function RepositoryWorkbench({
  repositoryId,
  agentName,
  hasCurrentWork = false,
  onClose,
  onContinue,
  onInspect,
  onNew,
}: {
  repositoryId: string | null;
  agentName: string | null;
  hasCurrentWork?: boolean;
  onClose: () => void;
  onContinue: (record: WorkstreamApiRecord) => Promise<string>;
  onInspect: () => void;
  onNew: (sha: string) => void;
}) {
  const client = useMemo(() => new WorkstreamClient(), []);
  const [sourceGit, setSourceGit] = useState<GitStatus | null>(null);
  const [checkpointConfirmed, setCheckpointConfirmed] = useState(false);
  const [project, setProject] = useState<RepositoryProject | null>(null);
  const [history, setHistory] = useState<WorkstreamApiRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    if (!repositoryId) return;
    let active = true;
    void Promise.all([
      selectedRepositoryProject(repositoryId),
      client.history(repositoryId),
    ])
      .then(async ([selection, saved]) => {
        const git = selection.project
          ? await repositoryGitStatus(selection.project.id, "")
          : null;
        if (active) {
          setSourceGit(git);
          setProject(selection.project);
          setHistory(saved);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : "Workbench unavailable",
          );
      });
    return () => {
      active = false;
    };
  }, [repositoryId, client, version]);
  const selected =
    history?.find((record) => record.workstreamId === selectedId) ?? null;
  const unavailable =
    !!selected &&
    (selected.status === "cancelled" ||
      ["missing", "removed", "wrong-branch"].includes(selected.worktreeState));
  const continueWork = async () => {
    if (!selected || busy || !confirmed || !agentName || unavailable) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setMessage(await onContinue(selected));
      setConfirmed(false);
      setVersion((value) => value + 1);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Continuation unavailable",
      );
    } finally {
      setBusy(false);
    }
  };
  const checkpoint = async () => {
    if (
      !checkpointConfirmed ||
      !sourceGit ||
      sourceGit.head ||
      !project ||
      busy
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const result = await repositoryGitAction(project.id, "", sourceGit, {
        action: "checkpoint",
      });
      setSourceGit(result.status);
      setMessage(result.message);
      setCheckpointConfirmed(false);
      setVersion((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Checkpoint failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="repository-workbench"
      data-world-ui="true"
      role="dialog"
      aria-label="Repository Workbench"
    >
      <header>
        <div>
          <p className="repository-workbench__eyebrow">REPOSITORY</p>
          <h2>Workbench</h2>
        </div>
        <button type="button" disabled={busy} onClick={onClose}>
          Close Workbench
        </button>
      </header>
      <p>
        Continue saved work, inspect commits, and explicitly sync or publish. A
        new Workstream is a separate task and branch.
      </p>
      {!repositoryId ? (
        <p>
          Load a repository first using Load Repo. Saved work will appear here
          after loading its repository.
        </p>
      ) : (
        <>
          {error ? <p role="alert">{error}</p> : null}
          {message ? <p role="status">{message}</p> : null}
          <div className="repository-workbench__heading">
            <div>
              <strong>{project?.name ?? "Loaded repository"}</strong>
              {project ? <code>{project.rootPath}</code> : null}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirmed(false);
                setVersion((value) => value + 1);
              }}
            >
              Refresh Workbench
            </button>
          </div>
          <section
            className="repository-workbench__continuation"
            aria-label="Repository checkpoint prerequisite"
          >
            <h3>Step 1 · Repository checkpoint</h3>
            {!sourceGit ? (
              <p>Checking the source repository before a new Workstream…</p>
            ) : sourceGit.head ? (
              <p>
                Ready · this repository already has a commit. No new initial
                checkpoint is needed.
              </p>
            ) : (
              <>
                <p>
                  <strong>Required before New Workstream.</strong> This new
                  repository has no commits. Create its initial local checkpoint
                  first; this does not push or publish.
                </p>
                <label className="repository-workbench__file">
                  <input
                    type="checkbox"
                    checked={checkpointConfirmed}
                    disabled={busy}
                    onChange={(event) =>
                      setCheckpointConfirmed(event.target.checked)
                    }
                  />
                  Confirm initial local checkpoint
                </label>
                <button
                  type="button"
                  disabled={busy || !checkpointConfirmed}
                  onClick={() => void checkpoint()}
                >
                  {busy ? "Creating checkpoint…" : "Create initial checkpoint"}
                </button>
              </>
            )}
          </section>
          <div className="repository-workbench__actions">
            <button
              type="button"
              disabled={busy || !sourceGit?.head}
              onClick={() => {
                if (sourceGit?.head) onNew("HEAD");
              }}
            >
              New Workstream
            </button>
            <button
              type="button"
              disabled={busy || !hasCurrentWork}
              onClick={onInspect}
            >
              Open current work / World View
            </button>
          </div>
          <h3>Saved sessions & work</h3>
          <p>
            Saved in this World server’s data directory. Loading a repo lists
            its records without rebinding an agent, changing files, or starting
            a process.
          </p>
          {history === null ? (
            <p>
              {error
                ? "Saved work could not be loaded. Refresh to retry."
                : "Loading saved work…"}
            </p>
          ) : (
            <>
              {history.length === 0 ? (
                <p>
                  No saved Workstreams for this repository in this server. If
                  you used another World instance, reopen that instance; do not
                  recreate the task just to recover it.
                </p>
              ) : (
                <ol
                  className="repository-workbench__list"
                  aria-label="Saved Workstreams"
                >
                  {history.map((record, index) => (
                    <li key={record.workstreamId}>
                      <button
                        type="button"
                        disabled={busy}
                        aria-pressed={selectedId === record.workstreamId}
                        onClick={() => {
                          setSelectedId(record.workstreamId);
                          setConfirmed(false);
                          setMessage(null);
                        }}
                      >
                        <strong>
                          {index === 0 ? "Latest · " : ""}
                          {record.title}
                        </strong>
                        <span>
                          {record.authority.branch} · {record.status} ·{" "}
                          {record.worktreeState}
                        </span>
                        <time>{record.updatedAt}</time>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <label>
                Git target
                <select
                  aria-label="Workbench Git target"
                  disabled={busy}
                  value={selectedId}
                  onChange={(event) => {
                    setSelectedId(event.target.value);
                    setConfirmed(false);
                    setMessage(null);
                  }}
                >
                  <option value="">
                    Source repository (not a Workstream worktree)
                  </option>
                  {history.map((record) => (
                    <option
                      key={record.workstreamId}
                      value={record.workstreamId}
                    >
                      {record.title} · {record.authority.branch}
                    </option>
                  ))}
                </select>
              </label>
              {selected ? (
                <section
                  aria-label="Saved Workstream continuation"
                  className="repository-workbench__continuation"
                >
                  <h4>{selected.title}</h4>
                  <p>{selected.task}</p>
                  <code>
                    {selected.authority.branch} ·{" "}
                    {selected.authority.head.slice(0, 12)}
                  </code>
                  <p>
                    Saved session: {selected.agent.agentId}. Continuing
                    re-attests this worktree and binds it to{" "}
                    <strong>{agentName ?? "a selected connected agent"}</strong>
                    . Existing files and task history stay intact; a different
                    agent session does not inherit the old model’s conversation
                    memory.
                  </p>
                  <p>
                    {selected.prIntent === "draft-pr"
                      ? "Draft-PR intent saved. No PR is implied until explicitly created in GitHub / PR."
                      : "Local Workstream. PR publication is optional."}
                  </p>
                  <details>
                    <summary>Session / task timeline</summary>
                    <ul>
                      {selected.events.map((event) => (
                        <li key={event.eventId}>
                          <time>{event.occurredAt}</time> {event.summary}
                        </li>
                      ))}
                    </ul>
                  </details>
                  {unavailable ? (
                    <p>
                      Saved worktree is unavailable or on a different branch. No
                      files will be reset. Start a new Workstream from a source
                      commit instead.
                    </p>
                  ) : null}
                  <label className="repository-workbench__file">
                    <input
                      type="checkbox"
                      disabled={busy || unavailable || !agentName}
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    Continue this saved worktree with{" "}
                    {agentName ?? "a selected agent"}; send no coding turn.
                  </label>
                  <button
                    type="button"
                    disabled={busy || !confirmed || !agentName || unavailable}
                    onClick={() => void continueWork()}
                  >
                    {busy ? "Restoring…" : "Continue saved work"}
                  </button>
                </section>
              ) : null}
            </>
          )}
          {project ? (
            <RepositoryGitPanel
              key={`${project.id}:${selectedId}`}
              projectId={project.id}
              workstreamId={selectedId}
              onNew={onNew}
              showCheckpoint={false}
            />
          ) : history !== null ? (
            <p>
              This repository is not registered in Load Repo. Open its path
              there to enable Git controls.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
