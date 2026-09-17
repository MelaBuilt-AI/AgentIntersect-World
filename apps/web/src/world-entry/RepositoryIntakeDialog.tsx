import { useState } from "react";
import {
  discoverRepositoryPath,
  type RepositoryPaths,
} from "./repository-intake-client.js";

export type RepositoryProject = {
  readonly id: string;
  readonly name: string;
  readonly rootPath: string;
  readonly source: "local" | "created" | "github";
  readonly githubRepository?: string;
  readonly pinned: boolean;
  readonly lastOpenedAt: string;
  readonly availability?: "available" | "missing" | "unavailable";
  readonly repositoryId?: string;
  readonly savedWorkState?: "available" | "unavailable";
  readonly workstreams?: readonly {
    workstreamId: string;
    title: string;
    status: string;
    updatedAt: string;
    branch: string;
    worktreeState: string;
    agentId: string;
    nativeSessionId: string;
  }[];
  readonly milestones?: readonly {
    id: string;
    kind: string;
    label: string;
    occurredAt: string;
    workstreamId?: string;
    head?: string;
  }[];
};

function SavedProjectCard({
  project,
  busy,
  onOpen,
  onPin,
  onResume,
}: {
  readonly project: RepositoryProject;
  readonly busy: boolean;
  readonly onOpen: (rootPath: string, name?: string) => void;
  readonly onPin: (id: string, pinned: boolean) => void;
  readonly onResume?: (
    project: RepositoryProject,
    workstreamId: string,
  ) => void;
}) {
  const [selectedId, setSelectedId] = useState(
    project.workstreams?.[0]?.workstreamId ?? "",
  );
  const [confirmed, setConfirmed] = useState(false);
  const selected = project.workstreams?.find(
    (work) => work.workstreamId === selectedId,
  );
  const unavailable =
    project.availability === "missing" ||
    project.availability === "unavailable";
  const resumable =
    !!selected &&
    !["missing", "removed", "wrong-branch"].includes(selected.worktreeState) &&
    selected.status !== "cancelled";
  return (
    <li className="saved-project-card">
      <strong>{project.name}</strong>
      <code>{project.rootPath}</code>
      <small>
        {project.availability ?? "Availability checked on open"} · Last opened{" "}
        {new Date(project.lastOpenedAt).toLocaleString()}
      </small>
      <div>
        <button
          type="button"
          className={
            !busy && !unavailable ? "world-action--enabled" : undefined
          }
          disabled={busy || unavailable}
          onClick={() => onOpen(project.rootPath, project.name)}
        >
          Open project
        </button>
        <button
          type="button"
          className={!busy ? "world-action--enabled" : undefined}
          disabled={busy}
          onClick={() => onPin(project.id, !project.pinned)}
        >
          {project.pinned ? "Unpin" : "Pin"}
        </button>
      </div>
      {project.savedWorkState === "unavailable" ? (
        <p>
          Saved work is currently unavailable. Its files and history have not
          been removed.
        </p>
      ) : project.workstreams?.length ? (
        <>
          <label>
            Saved work for {project.name}
            <select
              value={selectedId}
              disabled={busy}
              onChange={(event) => {
                setSelectedId(event.target.value);
                setConfirmed(false);
              }}
            >
              {project.workstreams.map((work, index) => (
                <option key={work.workstreamId} value={work.workstreamId}>
                  {index === 0 ? "Latest · " : ""}
                  {work.title} · {work.status}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <>
              <p>
                {selected.branch} · {selected.worktreeState} · Saved{" "}
                {new Date(selected.updatedAt).toLocaleString()}
              </p>
              <small>Conversation: {selected.nativeSessionId}</small>
            </>
          ) : null}
          <label className="saved-project-card__consent">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy || unavailable || !resumable}
              onChange={(event) => setConfirmed(event.target.checked)}
            />{" "}
            Resume this saved worktree and conversation without a coding turn
          </label>
          <button
            type="button"
            className={
              confirmed && !busy && !unavailable && resumable
                ? "world-action--enabled"
                : undefined
            }
            disabled={
              busy || unavailable || !resumable || !confirmed || !onResume
            }
            onClick={() => {
              if (selected) onResume?.(project, selected.workstreamId);
            }}
          >
            Resume saved work
          </button>
          {!resumable ? (
            <p>
              This saved work is unavailable to resume. Open the project to
              inspect it; no files will be reset.
            </p>
          ) : null}
        </>
      ) : (
        <p>
          No saved Workstreams. Open the project, then choose New Workstream.
        </p>
      )}
      {project.milestones?.length ? (
        <details>
          <summary>
            Work and Git milestones ({project.milestones.length})
          </summary>
          <ol>
            {project.milestones.map((milestone) => (
              <li key={milestone.id}>
                <strong>{milestone.kind}</strong> ·{" "}
                {new Date(milestone.occurredAt).toLocaleString()}
                <p>{milestone.label}</p>
                {milestone.head ? <code>{milestone.head}</code> : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      <small>
        Resume verifies current files. Milestones are history, not rollback
        actions.
      </small>
    </li>
  );
}

export function RepositoryIntakeDialog({
  projects,
  busy,
  message,
  onOpen,
  onResume,
  onCreate,
  onClone,
  onPin,
  onClose,
}: {
  readonly projects: readonly RepositoryProject[];
  readonly busy: boolean;
  readonly message: string;
  readonly onOpen: (rootPath: string, name?: string) => void;
  readonly onResume?: (
    project: RepositoryProject,
    workstreamId: string,
  ) => void;
  readonly onCreate: (rootPath: string, name: string) => void;
  readonly onClone: (
    repository: string,
    destination: string,
    name?: string,
  ) => void;
  readonly onPin: (projectId: string, pinned: boolean) => void;
  readonly onClose: () => void;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const orderedProjects = [...projects].sort((left, right) =>
    right.lastOpenedAt.localeCompare(left.lastOpenedAt),
  );
  const lastOpened = orderedProjects[0];
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? lastOpened;
  const [localPath, setLocalPath] = useState("");
  const [localName, setLocalName] = useState("");
  const [newPath, setNewPath] = useState("");
  const [newName, setNewName] = useState("");
  const [githubRepository, setGithubRepository] = useState("");
  const [clonePath, setClonePath] = useState("");
  const [cloneName, setCloneName] = useState("");

  const [paths, setPaths] = useState<RepositoryPaths | null>(null);
  const [pathBusy, setPathBusy] = useState(false);
  const [pathMessage, setPathMessage] = useState("");
  const discover = async (createProjects = false) => {
    setPathBusy(true);
    try {
      const found = await discoverRepositoryPath(createProjects);
      setPaths(found);
      setLocalPath(
        found.homePath + (found.homePath.includes("\\") ? "\\" : "/"),
      );
      setNewPath(found.projectsExists ? found.projectsPath : found.homePath);
      setClonePath(found.projectsPath);
      setPathMessage(
        found.projectsExists
          ? "Projects folder found. Choose a project name or edit the local path."
          : "No projects folder yet. Create it below, or choose another parent folder.",
      );
    } catch (error) {
      setPathMessage(
        error instanceof Error ? error.message : "Path discovery unavailable",
      );
    } finally {
      setPathBusy(false);
    }
  };
  const validName = Boolean(
    newName.trim() &&
    !/[\\/]/u.test(newName) &&
    ![".", ".."].includes(newName.trim()),
  );
  const destination =
    newPath.replace(/[\\/]+$/u, "") +
    (newPath.includes("\\") ? "\\" : "/") +
    newName.trim();

  const validCloneName = Boolean(
    cloneName.trim() &&
    !/[\\/]/u.test(cloneName) &&
    ![".", ".."].includes(cloneName.trim()),
  );
  const cloneDestination =
    clonePath.trim().replace(/[\\/]+$/u, "") +
    (clonePath.includes("\\") ? "\\" : "/") +
    cloneName.trim();
  const canClone = Boolean(
    !busy &&
    !pathBusy &&
    githubRepository.trim() &&
    clonePath.trim() &&
    validCloneName,
  );

  return (
    <section
      className="repository-intake"
      role="dialog"
      aria-modal="true"
      aria-labelledby="repository-intake-title"
    >
      <header>
        <div>
          <span>workbench_project_</span>
          <h2 id="repository-intake-title">Repository Intake_</h2>
          <p>Choose the project that becomes this World.</p>
        </div>
        <button
          type="button"
          aria-label="Close repository intake"
          onClick={onClose}
          disabled={busy}
        >
          ×
        </button>
      </header>

      <p role="status" aria-live="polite">
        {message}
      </p>

      <section aria-label="Local path discovery">
        <button
          type="button"
          className="world-action--enabled"
          disabled={busy || pathBusy}
          onClick={() => void discover()}
        >
          Discover path
        </button>
        <p>
          Discover the home folder of the user running World on this machine. No
          folders are created by discovery.
        </p>
        {pathMessage ? <p role="status">{pathMessage}</p> : null}
        {paths && !paths.projectsExists ? (
          <button
            type="button"
            className="world-action--enabled"
            disabled={busy || pathBusy}
            onClick={() => void discover(true)}
          >
            Create projects folder: {paths.projectsPath}
          </button>
        ) : null}
      </section>
      <div className="repository-intake__grid">
        <section aria-labelledby="repository-recents-title">
          <h3 id="repository-recents-title">Saved project library</h3>
          <p>
            Projects opened through World stay here. Open loads files only;
            Resume restores saved work without sending a task.
          </p>
          {lastOpened && selectedProject ? (
            <>
              <div className="saved-project-library__last-opened">
                <small>Last opened</small>
                <strong>{lastOpened.name}</strong>
                <code>{lastOpened.rootPath}</code>
              </div>
              <label className="saved-project-library__selector">
                Select Project
                <select
                  value={selectedProject.id}
                  disabled={busy}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                >
                  {orderedProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                      {project.id === lastOpened.id ? " · Last opened" : ""}
                      {project.pinned ? " · Pinned" : ""} · {project.rootPath}
                    </option>
                  ))}
                </select>
              </label>
              <ul>
                <SavedProjectCard
                  key={selectedProject.id}
                  project={selectedProject}
                  busy={busy}
                  onOpen={onOpen}
                  onPin={onPin}
                  {...(onResume ? { onResume } : {})}
                />
              </ul>
            </>
          ) : (
            <p>No saved projects yet.</p>
          )}
        </section>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onOpen(localPath, localName.trim() || undefined);
          }}
        >
          <h3>Open local</h3>
          <label>
            <span>Local repository path</span>
            <input
              value={localPath}
              onChange={(event) => setLocalPath(event.currentTarget.value)}
              placeholder="Discover path, then choose your repository folder"
              autoComplete="off"
            />
          </label>
          <label>
            <span>Friendly name (optional)</span>
            <input
              value={localName}
              onChange={(event) => setLocalName(event.currentTarget.value)}
              maxLength={120}
            />
          </label>
          <button
            type="submit"
            className={localPath.trim() ? "world-action--enabled" : undefined}
            disabled={busy || !localPath.trim()}
          >
            Open local
          </button>
        </form>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (validName) onCreate(destination, newName.trim());
          }}
        >
          <h3>Create new</h3>
          <label>
            <span>Project name</span>
            <input
              value={newName}
              onChange={(event) => setNewName(event.currentTarget.value)}
              maxLength={120}
            />
          </label>
          <label>
            <span>Project parent folder</span>
            <input
              value={newPath}
              onChange={(event) => setNewPath(event.currentTarget.value)}
              placeholder="Discover path or enter a parent folder"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            className={
              validName && newPath.trim() ? "world-action--enabled" : undefined
            }
            disabled={busy || pathBusy || !validName || !newPath.trim()}
          >
            Create new
          </button>
          {newPath && newName ? (
            <p>
              Will create: <code>{destination}</code>
            </p>
          ) : null}
          {newName && !validName ? (
            <p role="alert">
              Use one folder name, without slashes or dot traversal.
            </p>
          ) : null}
        </form>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canClone)
              onClone(
                githubRepository.trim(),
                cloneDestination,
                cloneName.trim(),
              );
          }}
        >
          <h3>Clone GitHub</h3>
          <label>
            <span>GitHub repository</span>
            <input
              value={githubRepository}
              onChange={(event) =>
                setGithubRepository(event.currentTarget.value)
              }
              placeholder="owner/repository"
              autoComplete="off"
            />
          </label>
          <label>
            <span>Clone destination</span>
            <input
              value={clonePath}
              onChange={(event) => setClonePath(event.currentTarget.value)}
              placeholder="Discover path or enter a parent folder"
              autoComplete="off"
            />
          </label>
          <p>The new folder will be created inside this destination.</p>
          <label>
            <span>Folder Name to Create</span>
            <input
              required
              value={cloneName}
              onChange={(event) => setCloneName(event.currentTarget.value)}
              maxLength={120}
            />
          </label>
          <button
            type="submit"
            className={canClone ? "world-action--enabled" : undefined}
            disabled={!canClone}
          >
            Clone GitHub
          </button>
          {clonePath.trim() && validCloneName ? (
            <p>
              Will clone into: <code>{cloneDestination}</code>
            </p>
          ) : null}
          {cloneName && !validCloneName ? (
            <p role="alert">
              Use one folder name, without slashes or dot traversal.
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
