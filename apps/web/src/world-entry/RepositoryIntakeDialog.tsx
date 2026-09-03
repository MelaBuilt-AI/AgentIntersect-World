import { useState } from "react";

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
              placeholder="/home/me/projects/notes-app"
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
            onCreate(newPath, newName);
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
            <span>New local path</span>
            <input
              value={newPath}
              onChange={(event) => setNewPath(event.currentTarget.value)}
              placeholder="/home/me/projects/new-project"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            className={
              newName.trim() && newPath.trim()
                ? "world-action--enabled"
                : undefined
            }
            disabled={busy || !newName.trim() || !newPath.trim()}
          >
            Create new
          </button>
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
              placeholder="/home/me/projects/repository"
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
