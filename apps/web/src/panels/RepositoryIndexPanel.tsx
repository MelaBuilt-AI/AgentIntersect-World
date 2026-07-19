import type {
  RepositoryGeneration,
  RepositoryIndexOperation,
} from "@agentintersect-world/world-schema";
import { useEffect, useState } from "react";

import {
  cancelRepositoryIndex,
  getCurrentRepositoryIndex,
  getRepositoryIndex,
  listRepositoryIndexes,
  startRepositoryIndex,
} from "../repository-index-client.js";
import { recoverActiveOrRecent } from "./operation-recovery.js";

type LastGoodState =
  | { status: "loading" }
  | { status: "ready"; generation: RepositoryGeneration | null }
  | { status: "error"; message: string };

export function RepositoryIndexPanel({
  authorityReady,
  onIndexed,
}: {
  readonly authorityReady: boolean;
  readonly onIndexed?: () => void;
}) {
  const [rootPath, setRootPath] = useState("");
  const [operation, setOperation] = useState<RepositoryIndexOperation | null>(
    null,
  );
  const [lastGood, setLastGood] = useState<LastGoodState>({
    status: "loading",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [rehydrating, setRehydrating] = useState(true);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let active = true;
    void getCurrentRepositoryIndex().then((result) => {
      if (!active) return;
      if (result.status === "ok")
        setLastGood({ status: "ready", generation: result.data.generation });
      else setLastGood({ status: "error", message: result.message });
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void listRepositoryIndexes().then((result) => {
      if (!active) return;
      if (result.status === "ok") {
        setOperation(recoverActiveOrRecent(result.data.operations));
      } else {
        setMessage(result.message);
      }
      setRehydrating(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (operation?.status !== "running") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      const result = await getRepositoryIndex(operation.id);
      if (!active) return;
      if (result.status !== "ok") {
        setMessage(result.message);
        return;
      }
      setOperation(result.data);
      if (result.data.status === "succeeded" && result.data.generation) {
        setLastGood({ status: "ready", generation: result.data.generation });
        onIndexed?.();
      }
      if (result.data.status === "running")
        timer = setTimeout(() => void poll(), 150);
    };
    timer = setTimeout(() => void poll(), 100);
    return () => {
      active = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [onIndexed, operation?.id, operation?.status]);

  const canStart =
    authorityReady &&
    rootPath.trim().length > 0 &&
    operation?.status !== "running" &&
    !rehydrating &&
    !starting;
  const canCancel = operation?.status === "running" && !cancelling;
  const start = async () => {
    if (!canStart) return;
    setStarting(true);
    setMessage(null);
    const result = await startRepositoryIndex(
      rootPath.trim(),
      `repository-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    if (result.status === "ok") setOperation(result.data);
    else setMessage(result.message);
    setStarting(false);
  };
  const cancel = async () => {
    if (!canCancel || operation === null) return;
    setCancelling(true);
    setMessage(null);
    const result = await cancelRepositoryIndex(operation.id);
    if (result.status === "ok") setOperation(result.data);
    else setMessage(result.message);
    setCancelling(false);
  };
  return (
    <section className="panel-content" aria-labelledby="repository-index-title">
      <header className="panel-heading">
        <span>Phase 3 repository index</span>
        <h2 id="repository-index-title">Deterministic metadata index</h2>
        <p>
          Inspect a selected Git or non-Git directory without executing its
          content.
        </p>
      </header>
      <div className="operator-flow repository-flow">
        <section className="operator-step">
          <span className="card-number">01</span>
          <h2>Step 1 — Select and index repository</h2>
          <label htmlFor="repository-root">Repository root</label>
          <input
            id="repository-root"
            value={rootPath}
            onChange={(event) => setRootPath(event.target.value)}
            placeholder="Local absolute path (never shown in World output)"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => void start()}
            disabled={!canStart}
          >
            {starting
              ? "Starting…"
              : lastGood.status === "ready" && lastGood.generation
                ? "Rescan"
                : "Start index"}
          </button>
        </section>
        <section className="operator-step">
          <span className="card-number">02</span>
          <h2>Step 2 — Cancel current index</h2>
          <p>
            Stop active discovery while preserving the last successful
            generation.
          </p>
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={!canCancel}
          >
            {cancelling ? "Cancelling…" : "Cancel current index"}
          </button>
        </section>
        <section className="operator-step operator-step--review">
          <span className="card-number">03</span>
          <h2>Step 3 — Review repository metadata</h2>
          {message && <p role="alert">{message}</p>}
          <div className="review-grid repository-review">
            <article data-testid="current-index">
              <h3>Current index</h3>
              {operation === null ? (
                <p>None yet — select a repository to begin.</p>
              ) : (
                <>
                  <strong
                    className={`operation-status operation-status--${operation.status}`}
                  >
                    {operation.status}
                  </strong>
                  <p>
                    {operation.progress.phase}:{" "}
                    {operation.progress.indexedFiles}/
                    {operation.progress.discoveredFiles} files ·{" "}
                    {operation.progress.bytesHashed} bytes hashed
                  </p>
                  <code>
                    Local repository selection withheld from shareable World
                    output
                  </code>
                  {operation.error && <p>{operation.error}</p>}
                </>
              )}
            </article>
            <article data-testid="last-good-index">
              <h3>Last good generation</h3>
              {lastGood.status === "loading" ? (
                <p aria-live="polite">Loading last good generation…</p>
              ) : lastGood.status === "error" ? (
                <p role="alert">{lastGood.message}</p>
              ) : lastGood.generation === null ? (
                <p>None yet</p>
              ) : (
                <>
                  <strong>{lastGood.generation.repositoryName}</strong>
                  <p>
                    {lastGood.generation.coverage.indexedFiles} files ·{" "}
                    {lastGood.generation.coverage.directories} directories ·{" "}
                    {lastGood.generation.coverage.packages} packages
                  </p>
                  <code className="fingerprint">
                    {lastGood.generation.fingerprint}
                  </code>
                  <ul className="file-preview">
                    {lastGood.generation.files.slice(0, 12).map((file) => (
                      <li key={file.path}>
                        {file.path} · {file.language ?? file.fileKind}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          </div>
        </section>
      </div>
    </section>
  );
}
