import { useCallback, useEffect, useRef, useState } from "react";
import { audioCue } from "../audio/world-audio.js";

import { WorldScreen, WorldScreenToggle } from "./WorldScreen.js";
import { useSpatialScreen } from "./world-screen-context.js";

import type { PreviewProjection } from "./preview-manager-client.js";
import type { Workstream } from "./workstream-tracer.js";
import type { WorldInputOwner } from "./world-view-model.js";
import type { IterationStatus } from "./workbench-iteration-model.js";

export function WorldView({
  workstream,
  projection,
  iterationStatus,
  onInputOwnerChange,
  onRefresh,
  refreshPending = false,
}: {
  readonly workstream: Workstream;
  readonly projection: PreviewProjection;
  readonly iterationStatus?: IterationStatus | null;
  readonly onRefresh?: () => void;
  readonly refreshPending?: boolean;
  readonly onInputOwnerChange: (owner: WorldInputOwner) => void;
}) {
  const spatial = useSpatialScreen("preview");
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
    audioCue("projection-off");
    setExpanded(false);
    assignInputOwner("world");
    window.requestAnimationFrame(() => opener.current?.focus());
  }, [assignInputOwner]);

  useEffect(() => {
    if (!expanded && inputOwner !== "preview") return;
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
  }, [assignInputOwner, collapse, expanded, inputOwner, spatial]);

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
    <WorldScreen id="preview">
      <section
        className={`world-view${expanded && !spatial ? " world-view--expanded" : ""}`}
        aria-label="World View"
        aria-modal={expanded && !spatial ? true : undefined}
        data-preview-truth={display.truth}
        data-preview-state={preview.state}
        data-preview-id={preview.previewId}
        data-iteration-state={iterationStatus?.state ?? "idle"}
        data-world-view-expanded={expanded}
        data-input-owner={inputOwner}
        role={expanded && !spatial ? "dialog" : "region"}
      >
        <header className="world-view__header">
          <WorldScreenToggle id="preview" />
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
          {onRefresh ? (
            <div className="world-view__refresh">
              <button
                type="button"
                className={
                  refreshPending || workstream.status === "working"
                    ? "world-action--disabled"
                    : "world-action--enabled"
                }
                disabled={refreshPending || workstream.status === "working"}
                onClick={onRefresh}
              >
                {refreshPending ? "Refreshing preview…" : "Refresh preview"}
              </button>
              <small>
                Preview recipe already approved · updates refresh after
                validation.
              </small>
            </div>
          ) : null}
        </header>

        {iterationStatus ? (
          <p
            className={`world-view__iteration world-view__iteration--${iterationStatus.state}`}
            role="status"
          >
            {iterationStatus.message}
          </p>
        ) : null}

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
          {inputOwner === "world" ? (
            <div className="world-view__input-shield" aria-hidden="true" />
          ) : null}
          {!expanded && !spatial ? (
            <button
              ref={opener}
              type="button"
              className="world-view__expand world-action--enabled"
              aria-expanded="false"
              data-audio="handled"
              onClick={() => {
                audioCue("projection-on");
                setExpanded(true);
                assignInputOwner("world");
              }}
            >
              Expand World View
            </button>
          ) : null}
        </div>

        {expanded || spatial || inputOwner === "preview" ? (
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
                data-audio-cue="projection-off"
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
              data-audio="handled"
              onClick={collapse}
              hidden={spatial}
            >
              Close World View
            </button>
          </footer>
        ) : null}
      </section>
    </WorldScreen>
  );
}
