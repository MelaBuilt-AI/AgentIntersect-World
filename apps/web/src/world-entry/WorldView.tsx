import { useCallback, useEffect, useRef, useState } from "react";

import type { PreviewProjection } from "./preview-manager-client.js";
import type { Workstream } from "./workstream-tracer.js";
import type { WorldInputOwner } from "./world-view-model.js";

export function WorldView({
  workstream,
  projection,
  onInputOwnerChange,
}: {
  readonly workstream: Workstream;
  readonly projection: PreviewProjection;
  readonly onInputOwnerChange: (owner: WorldInputOwner) => void;
}) {
  const display = projection.display;
  const [expanded, setExpanded] = useState(false);
  const [inputOwner, setInputOwner] = useState<WorldInputOwner>("world");
  const opener = useRef<HTMLButtonElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const returnControl = useRef<HTMLButtonElement>(null);

  const assignInputOwner = useCallback(
    (owner: WorldInputOwner) => {
      setInputOwner(owner);
      onInputOwnerChange(owner);
    },
    [onInputOwnerChange],
  );

  const collapse = useCallback(() => {
    setExpanded(false);
    assignInputOwner("world");
    window.requestAnimationFrame(() => opener.current?.focus());
  }, [assignInputOwner]);

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (inputOwner === "preview") {
        assignInputOwner("world");
        window.requestAnimationFrame(() => returnControl.current?.focus());
        return;
      }
      collapse();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [assignInputOwner, collapse, expanded, inputOwner]);

  useEffect(
    () => () => {
      onInputOwnerChange("world");
    },
    [onInputOwnerChange],
  );

  const previewUrl = display?.preview.url;
  if (!display || !previewUrl) return null;
  const preview = display.preview;
  const branch = workstream.authority?.authority.branch ?? "Unavailable";
  const truthLabel =
    display.truth === "current"
      ? "Current verified preview"
      : "Previous verified preview";
  const readyAt =
    preview.readyAt ?? preview.health?.checkedAt ?? preview.startedAt;

  return (
    <section
      className={`world-view${expanded ? " world-view--expanded" : ""}`}
      aria-label="World View"
      aria-modal={expanded ? true : undefined}
      data-preview-truth={display.truth}
      data-preview-state={preview.state}
      data-preview-id={preview.previewId}
      data-world-view-expanded={expanded}
      data-input-owner={inputOwner}
      role={expanded ? "dialog" : "region"}
    >
      <header className="world-view__header">
        <div>
          <span className="world-view__eyebrow">World View</span>
          <strong>{workstream.title}</strong>
        </div>
        <span
          className={`world-view__truth world-view__truth--${display.truth}`}
          role="status"
        >
          {truthLabel}
        </span>
      </header>

      <dl className="world-view__facts">
        <div>
          <dt>Repository</dt>
          <dd>{preview.repository.repositoryId}</dd>
        </div>
        <div>
          <dt>Branch</dt>
          <dd>{branch}</dd>
        </div>
        <div>
          <dt>Worktree</dt>
          <dd>{preview.worktreeId}</dd>
        </div>
        <div>
          <dt>Revision</dt>
          <dd>Preview revision {preview.revision}</dd>
        </div>
        <div>
          <dt>Ready</dt>
          <dd>
            <time dateTime={readyAt}>{readyAt}</time>
          </dd>
        </div>
      </dl>

      <div className="world-view__screen">
        <iframe
          ref={iframe}
          className={`world-view__iframe${
            inputOwner === "preview" ? " world-view__iframe--interactive" : ""
          }`}
          src={previewUrl}
          title={`World View preview: ${workstream.title}`}
          sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
          referrerPolicy="no-referrer"
          tabIndex={inputOwner === "preview" ? 0 : -1}
        />
        {!expanded ? (
          <button
            ref={opener}
            type="button"
            className="world-view__expand world-action--enabled"
            aria-expanded="false"
            onClick={() => {
              setExpanded(true);
              assignInputOwner("world");
            }}
          >
            Expand World View
          </button>
        ) : null}
      </div>

      {expanded ? (
        <footer className="world-view__controls">
          {inputOwner === "world" ? (
            <button
              ref={returnControl}
              type="button"
              className="world-action--enabled"
              onClick={() => {
                assignInputOwner("preview");
                window.requestAnimationFrame(() => iframe.current?.focus());
              }}
            >
              Interact with preview
            </button>
          ) : (
            <button
              ref={returnControl}
              type="button"
              className="world-action--enabled"
              onClick={() => assignInputOwner("world")}
            >
              Return to World
            </button>
          )}
          <span role="status">
            Input: {inputOwner === "preview" ? "Preview" : "World"}
          </span>
          <button
            type="button"
            className="world-view__close world-action--enabled"
            onClick={collapse}
          >
            Close World View
          </button>
        </footer>
      ) : null}
    </section>
  );
}
