import { useEffect, useState } from "react";
import {
  repositoryGitAction,
  repositoryGitStatus,
  repositoryGithubStatus,
  type GitAction,
  type GitStatus,
  type PullRequest,
} from "./repository-workbench-client.js";

export function RepositoryGitPanel({
  projectId,
  workstreamId,
  onNew,
  showCheckpoint = true,
  commitOnly = false,
  onCommitted,
  onBusyChange,
}: {
  showCheckpoint?: boolean;
  commitOnly?: boolean;
  onCommitted?: (status: GitStatus) => void;
  onBusyChange?: (busy: boolean) => void;
  projectId: string;
  workstreamId: string;
  onNew: (sha: string) => void;
}) {
  const [gitRead, setGitRead] = useState<{
    projectId: string;
    workstreamId: string;
    version: number;
    status: GitStatus | null;
    error: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [files, setFiles] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [remote, setRemote] = useState("");
  const [base, setBase] = useState("main");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState(true);
  const [githubRead, setGithubRead] = useState<{
    key: string;
    phase: "loading" | "current" | "stale" | "unavailable";
    prs: PullRequest[] | null;
    error: string | null;
  } | null>(null);
  const [pending, setPending] = useState<GitAction | null>(null);
  const [tab, setTab] = useState<"changes" | "commits" | "sync" | "github">(
    "changes",
  );
  useEffect(() => {
    let active = true;
    void repositoryGitStatus(projectId, workstreamId)
      .then((value) => {
        if (active) {
          setGitRead({
            projectId,
            workstreamId,
            version,
            status: value,
            error: null,
          });
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setGitRead((previous) => ({
            projectId,
            workstreamId,
            version,
            status:
              previous?.projectId === projectId &&
              previous.workstreamId === workstreamId
                ? previous.status
                : null,
            error:
              reason instanceof Error
                ? reason.message
                : "Git status unavailable",
          }));
      });
    return () => {
      active = false;
    };
  }, [projectId, workstreamId, version]);
  const git =
    gitRead?.projectId === projectId && gitRead.workstreamId === workstreamId
      ? gitRead
      : null;
  const status = git?.status ?? null;
  const gitLoading = git?.version !== version;
  const gitCurrent = !gitLoading && !git?.error && status !== null;
  const selectedRemote = status?.remotes.includes(remote)
    ? remote
    : (status?.remotes[0] ?? "");
  const selectedFiles = files.filter((path) =>
    status?.changes.some((file) => file.path === path),
  );
  const githubKey = JSON.stringify([
    projectId,
    workstreamId,
    selectedRemote,
    status?.branch,
    status?.head,
  ]);
  const github = githubRead?.key === githubKey ? githubRead : null;
  const prs = github?.prs ?? null;
  const confirm = async () => {
    if (!pending || !status || !gitCurrent || busy) return;
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    setMessage(null);
    try {
      const result = await repositoryGitAction(
        projectId,
        workstreamId,
        status,
        pending,
      );
      setGitRead({
        projectId,
        workstreamId,
        version,
        status: result.status,
        error: null,
      });
      setMessage(result.message);
      setFiles([]);
      setGithubRead(
        result.pr
          ? {
              key: JSON.stringify([
                projectId,
                workstreamId,
                selectedRemote,
                result.status.branch,
                result.status.head,
              ]),
              phase: "current",
              prs: [result.pr],
              error: null,
            }
          : null,
      );
      setPending(null);
      if (pending.action === "commit") onCommitted?.(result.status);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Git action failed");
      // A command may have succeeded before a later readback failed. Never blindly replay it.
      setPending(null);
      setGithubRead(null);
      setVersion((value) => value + 1);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };
  const checkGithub = async () => {
    if (!selectedRemote || !gitCurrent || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setGithubRead({ key: githubKey, phase: "loading", prs, error: null });
    try {
      const result = await repositoryGithubStatus(
        projectId,
        workstreamId,
        selectedRemote,
      );
      setGithubRead({
        key: githubKey,
        phase: "current",
        prs: result.prs,
        error: null,
      });
    } catch (reason) {
      setGithubRead({
        key: githubKey,
        phase: prs !== null ? "stale" : "unavailable",
        prs,
        error: reason instanceof Error ? reason.message : "GitHub unavailable",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="repository-git-panel" aria-label="Repository Git">
      <div className="repository-workbench__heading">
        <h3>Git workspace</h3>
        <button
          type="button"
          disabled={busy || !!pending || gitLoading}
          onClick={() => {
            setError(null);
            setMessage(null);
            setGithubRead(null);
            setVersion((value) => value + 1);
          }}
        >
          Refresh Git
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {!gitLoading && git?.error ? <p role="alert">{git.error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {!gitCurrent ? (
        <p role="status">
          {gitLoading
            ? status
              ? "Refreshing Git… Shown data is last known; actions are disabled."
              : "Reading repository…"
            : status
              ? "Git status is stale. Refresh to retry; actions are disabled."
              : "Status unavailable. Refresh to retry; no action is enabled."}
        </p>
      ) : null}
      {!status ? null : (
        <>
          <p>
            <strong>{status.branch || "Detached HEAD"}</strong> ·{" "}
            {status.head ? (
              <code>{status.head.slice(0, 12)}</code>
            ) : (
              "No commits yet"
            )}{" "}
            · {status.upstream ?? "No upstream"}
          </p>
          {!commitOnly ? (
            <nav aria-label="Git sections">
              {(["changes", "commits", "sync", "github"] as const).map(
                (name) => (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={tab === name}
                    disabled={busy || !!pending}
                    onClick={() => setTab(name)}
                  >
                    {
                      {
                        changes: "Changes",
                        commits: "Commits",
                        sync: "Sync",
                        github: "GitHub / PR",
                      }[name]
                    }
                  </button>
                ),
              )}
            </nav>
          ) : null}
          <fieldset disabled={busy || !!pending || !gitCurrent}>
            {tab === "changes" ? (
              <>
                <p>
                  Review and choose files. A commit contains only the selected
                  files; unrelated changes stay untouched. Repository hooks and
                  commit signing are not run by these menu actions.
                </p>
                {!status.head && showCheckpoint ? (
                  <button
                    type="button"
                    onClick={() => setPending({ action: "checkpoint" })}
                  >
                    Create initial checkpoint
                  </button>
                ) : null}
                {status.changes.length === 0 ? (
                  <p>Working tree is clean.</p>
                ) : (
                  <div
                    className="repository-workbench__list"
                    aria-label="Changed files"
                  >
                    {status.changes.map((file) => (
                      <label
                        key={file.path}
                        className="repository-workbench__file"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(file.path)}
                          onChange={(event) =>
                            setFiles(
                              event.target.checked
                                ? [...files, file.path]
                                : files.filter((path) => path !== file.path),
                            )
                          }
                        />
                        <code>{file.status}</code>
                        <span>
                          {file.originalPath ? `${file.originalPath} → ` : ""}
                          {file.path}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <label>
                  Commit message
                  <input
                    aria-label="Commit message"
                    maxLength={2000}
                    value={commitMessage}
                    onChange={(event) => setCommitMessage(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={!selectedFiles.length || !commitMessage.trim()}
                  onClick={() =>
                    setPending({
                      action: "commit",
                      message: commitMessage.trim(),
                      files: selectedFiles,
                    })
                  }
                >
                  Review commit ({selectedFiles.length} files)
                </button>
              </>
            ) : null}
            {tab === "commits" ? (
              <>
                <p>
                  Latest commits on this workspace branch (up to 30). Starting
                  here creates a separate Workstream branch; it never resets
                  this workspace.
                </p>
                <ol className="repository-workbench__list">
                  {status.commits.map((commit) => (
                    <li key={commit.sha}>
                      <strong>{commit.subject}</strong>
                      <code title={commit.sha}>{commit.sha.slice(0, 12)}</code>
                      <time>{commit.date}</time>
                      <button type="button" onClick={() => onNew(commit.sha)}>
                        New Workstream from this commit
                      </button>
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
            {tab === "sync" || tab === "github" ? (
              <label>
                Remote
                <select
                  aria-label="Git remote"
                  value={selectedRemote}
                  onChange={(event) => {
                    setRemote(event.target.value);
                    setGithubRead(null);
                  }}
                >
                  {status.remotes.length ? (
                    status.remotes.map((name) => (
                      <option key={name}>{name}</option>
                    ))
                  ) : (
                    <option value="">No configured remote</option>
                  )}
                </select>
              </label>
            ) : null}
            {tab === "sync" ? (
              <>
                <p>
                  Fetch updates remote knowledge. Pull accepts fast-forwards
                  only and requires a clean worktree. Push publishes this
                  branch’s commits, never tags or a force update.
                </p>
                {status.remotes.length === 0 ? (
                  <p>
                    No remote is configured. Clone a repository through Load
                    Repo, or configure its remote with Git first. This menu does
                    not create remote repositories.
                  </p>
                ) : null}
                <div className="repository-workbench__actions">
                  {(["fetch", "pull", "push"] as const).map((action) => (
                    <button
                      key={action}
                      type="button"
                      disabled={
                        !selectedRemote ||
                        !status.head ||
                        (action === "pull" && status.changes.length > 0)
                      }
                      onClick={() =>
                        setPending({ action, remote: selectedRemote })
                      }
                    >
                      {
                        {
                          fetch: "Review fetch",
                          pull: "Review fast-forward pull",
                          push: "Review push",
                        }[action]
                      }
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {tab === "github" ? (
              <>
                <p>
                  Uses the GitHub CLI and your existing local sign-in. No
                  automatic login, push, merge, release, or repository creation.
                </p>
                <button
                  type="button"
                  disabled={!selectedRemote}
                  onClick={() => void checkGithub()}
                >
                  Check GitHub status
                </button>
                <p role="status">
                  {!github
                    ? "GitHub status not checked."
                    : github.phase === "loading"
                      ? "Checking GitHub… Previous results are not current."
                      : github.phase === "stale"
                        ? "GitHub results are stale. Retry Check GitHub status."
                        : github.phase === "unavailable"
                          ? "GitHub status unavailable. Retry Check GitHub status."
                          : "GitHub status checked. Results belong to the last successful check."}
                </p>
                {github?.error ? <p role="alert">{github.error}</p> : null}
                {prs !== null ? (
                  <div aria-label="GitHub pull requests">
                    {prs.length === 0 ? (
                      <p>No PRs found for this branch.</p>
                    ) : (
                      prs.map((pr) => (
                        <article key={pr.number}>
                          <a href={pr.url} target="_blank" rel="noreferrer">
                            #{pr.number} {pr.title}
                          </a>
                          <p>
                            {pr.state} ·{" "}
                            {pr.isDraft ? "Draft" : "Ready for review"} ·{" "}
                            {pr.headRefName} → {pr.baseRefName}
                          </p>
                          <code>{pr.headRefOid.slice(0, 12)}</code>
                          <ul>
                            {pr.statusCheckRollup?.map((check, index) => (
                              <li key={index}>
                                {check.name ?? check.context ?? "Check"}:{" "}
                                {check.conclusion ||
                                  check.state ||
                                  check.status ||
                                  "Pending"}
                              </li>
                            ))}
                          </ul>
                          <p>
                            Checks above belong to the displayed PR head, not
                            uncommitted local files.
                          </p>
                        </article>
                      ))
                    )}
                  </div>
                ) : null}
                <h4>Create a pull request</h4>
                <p>
                  Commit and explicitly push this exact branch first. Creation
                  checks for an existing open PR before publishing.
                </p>
                <label>
                  Base branch
                  <input
                    aria-label="PR base branch"
                    value={base}
                    onChange={(event) => setBase(event.target.value)}
                    maxLength={128}
                  />
                </label>
                <label>
                  PR title
                  <input
                    aria-label="PR title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={256}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    aria-label="PR description"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    maxLength={8000}
                  />
                </label>
                <label className="repository-workbench__file">
                  <input
                    type="checkbox"
                    checked={draft}
                    onChange={(event) => setDraft(event.target.checked)}
                  />
                  Create as draft
                </label>
                <button
                  type="button"
                  disabled={
                    !selectedRemote ||
                    !status.head ||
                    status.changes.length > 0 ||
                    !title.trim() ||
                    !base.trim() ||
                    base === status.branch
                  }
                  onClick={() =>
                    setPending({
                      action: "create-pr",
                      remote: selectedRemote,
                      base,
                      title: title.trim(),
                      body,
                      draft,
                    })
                  }
                >
                  Review PR creation
                </button>
              </>
            ) : null}
          </fieldset>
          {pending && gitCurrent ? (
            <section
              className="repository-workbench__confirm"
              aria-label="Confirm Git action"
            >
              <h4>Confirm {pending.action}</h4>
              <p>
                Target: <strong>{status.branch}</strong> at{" "}
                <code>{status.head ?? "unborn HEAD"}</code>
                {pending.remote ? ` → ${pending.remote}` : ""}.
              </p>
              {pending.files ? (
                <>
                  <p>{pending.message}</p>
                  <ul>
                    {pending.files.map((path) => (
                      <li key={path}>{path}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {pending.action === "create-pr" ? (
                <p>
                  {pending.draft ? "Draft" : "Review-ready"} PR: {pending.title}{" "}
                  → {pending.base}. This publishes the title and description to
                  GitHub.
                </p>
              ) : null}
              {pending.action === "push" ? (
                <p>
                  This publishes committed code to the selected remote.
                  Uncommitted files are not included.
                </p>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirm()}
              >
                {busy ? "Running…" : `Confirm ${pending.action}`}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPending(null)}
              >
                Cancel action
              </button>
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}
