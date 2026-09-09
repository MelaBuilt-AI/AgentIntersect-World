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
};

export function RepositoryIntakeDialog({
  projects,
  busy,
  message,
  onOpen,
  onCreate,
  onClone,
  onPin,
  onClose,
}: {
  readonly projects: readonly RepositoryProject[];
  readonly busy: boolean;
  readonly message: string;
  readonly onOpen: (rootPath: string, name?: string) => void;
  readonly onCreate: (rootPath: string, name: string) => void;
  readonly onClone: (
    repository: string,
    destination: string,
    name?: string,
  ) => void;
  readonly onPin: (projectId: string, pinned: boolean) => void;
  readonly onClose: () => void;
}) {
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
          <h3 id="repository-recents-title">Recent / pinned</h3>
          {projects.length === 0 ? (
            <p>No saved projects yet.</p>
          ) : (
            <ul>
              {projects.map((project) => (
                <li key={project.id}>
                  <strong>{project.name}</strong>
                  <small>
                    {project.source === "github"
                      ? project.githubRepository
                      : project.source}
                  </small>
                  <div>
                    <button
                      type="button"
                      className="world-action--enabled"
                      disabled={busy}
                      onClick={() => onOpen(project.rootPath, project.name)}
                    >
                      Open recent
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onPin(project.id, !project.pinned)}
                    >
                      {project.pinned ? "Unpin" : "Pin"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
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
            onClone(githubRepository, clonePath, cloneName.trim() || undefined);
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
              placeholder="Full destination folder for this clone"
              autoComplete="off"
            />
          </label>
          <label>
            <span>Friendly name (optional)</span>
            <input
              value={cloneName}
              onChange={(event) => setCloneName(event.currentTarget.value)}
              maxLength={120}
            />
          </label>
          <button
            type="submit"
            className={
              githubRepository.trim() && clonePath.trim()
                ? "world-action--enabled"
                : undefined
            }
            disabled={busy || !githubRepository.trim() || !clonePath.trim()}
          >
            Clone GitHub
          </button>
        </form>
      </div>
    </section>
  );
}
