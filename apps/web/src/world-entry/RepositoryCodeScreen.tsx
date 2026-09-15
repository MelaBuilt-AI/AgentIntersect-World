import "./repository-code-screen.css";
import { audioCue } from "../audio/world-audio.js";
import { buildCodeQuestionPrompt } from "./repository-explain-prompt.js";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { WEB_API_BASE_PATH } from "@agentintersect-world/config";
import { type RepositoryCityInstance } from "@agentintersect-world/renderer-r3f";
import type { Workstream } from "./workstream-tracer.js";
import { WorldScreen } from "./WorldScreen.js";
import { useWorldScreens } from "./world-screen-context.js";

type CodeResult = {
  objectRef: string;
  repositoryRef: string;
  path: string;
  kind: string;
  content: string | null;
  files: { ref: string; path: string }[];
  message: string;
};

export function RepositoryCodeScreen({
  instance,
  workstream = null,
  openingYaw,
  reducedMotion,
  onClose,
  onAskAgent,
  onInspectionChange,
  fullscreen: controlledFullscreen,
  onFullscreenChange,
}: {
  readonly workstream?: Workstream | null;
  readonly instance: RepositoryCityInstance;
  readonly openingYaw: number;
  readonly reducedMotion: boolean;
  readonly onClose: () => void;
  readonly onAskAgent?: ((prompt: string) => void) | undefined;
  readonly onInspectionChange: (active: boolean) => void;
  readonly fullscreen?: boolean;
  readonly onFullscreenChange?: import("react").Dispatch<
    import("react").SetStateAction<boolean>
  >;
}) {
  const controller = useWorldScreens();
  const enabled = controller?.enabled ?? false;
  const [localFullscreen, setLocalFullscreen] = useState(false);
  const fullscreen = controlledFullscreen ?? localFullscreen;
  const setFullscreen = onFullscreenChange ?? setLocalFullscreen;
  const [focused, setFocused] = useState(false);
  const originalRef =
    typeof instance.linkedRepoData?.ref === "string"
      ? instance.linkedRepoData.ref
      : null;
  const repositoryRef =
    typeof instance.linkedRepoData?.repositoryRef === "string"
      ? instance.linkedRepoData.repositoryRef
      : null;
  const [fileRef, setFileRef] = useState(
    workstream && instance.linkedRepoData?.kind === "file"
      ? String(instance.linkedRepoData.path)
      : originalRef,
  );
  const [result, setResult] = useState<{
    ref: string;
    data?: CodeResult;
    error?: string;
  } | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(0);
  const spatial = enabled && !fullscreen;
  const inspecting = fullscreen || focused;
  const priorInspecting = useRef(inspecting);
  useEffect(() => {
    if (priorInspecting.current !== inspecting)
      audioCue(inspecting ? "projection-on" : "projection-off");
    priorInspecting.current = inspecting;
  }, [inspecting]);
  // This component is keyed to an opening, not camera updates. A projection
  // stays above its object, facing the view from which it was selected.
  const [pose] = useState(() => ({
    x: instance.position.x,
    z: instance.position.z,
    y: 3.7,
    yaw: -openingYaw,
  }));
  const [revealStartedAt] = useState(() => performance.now());
  const workstreamId = workstream?.workstreamId;
  const workstreamRevision = workstream?.authority?.revision;
  const workstreamWorking = workstream?.status === "working";
  const data = result?.ref === fileRef ? result.data : undefined;
  const error = result?.ref === fileRef ? result.error : undefined;

  useEffect(() => {
    if (!fileRef || !repositoryRef) return;
    const abort = new AbortController();
    const query = workstreamId
      ? new URLSearchParams(fileRef === originalRef ? {} : { path: fileRef })
      : new URLSearchParams({ repositoryRef, objectRef: fileRef });
    const url = workstreamId
      ? `${WEB_API_BASE_PATH}/workstreams/${encodeURIComponent(workstreamId)}/source?${query}`
      : `${WEB_API_BASE_PATH}/repository-code?${query}`;
    let pending = false;
    const load = () => {
      if (pending) return;
      pending = true;
      void fetch(url, {
        signal: abort.signal,
        cache: "no-store",
      })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok)
            throw new Error(
              typeof body.error === "string"
                ? body.error
                : "Source is unavailable.",
            );
          const value = body.data as CodeResult;
          if (
            value.objectRef !== fileRef ||
            value.repositoryRef !== repositoryRef ||
            (value.content !== null && typeof value.content !== "string") ||
            !Array.isArray(value.files)
          )
            throw new Error("Invalid source response.");
          if (!abort.signal.aborted) setResult({ ref: fileRef, data: value });
        })
        .catch((failure: unknown) => {
          if (!abort.signal.aborted)
            setResult({
              ref: fileRef,
              error:
                failure instanceof Error
                  ? failure.message
                  : "Source is unavailable.",
            });
        })
        .finally(() => {
          pending = false;
        });
    };
    load();
    const timer = workstreamWorking ? window.setInterval(load, 1500) : null;
    return () => {
      abort.abort();
      if (timer !== null) window.clearInterval(timer);
    };
  }, [
    fileRef,
    originalRef,
    repositoryRef,
    workstreamId,
    workstreamRevision,
    workstreamWorking,
  ]);

  useEffect(() => {
    const viewport = scroll.current;
    if (!viewport) return;
    // Chromium can dispatch wheel events into CSS3D content without scrolling
    // its compositor layer. Own the bounded viewport scroll, not World zoom.
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      const scale =
        event.deltaMode === 1
          ? 20
          : event.deltaMode === 2
            ? viewport.clientHeight
            : 1;
      viewport.scrollTop += event.shiftKey ? 0 : event.deltaY * scale;
      viewport.scrollLeft +=
        (event.deltaX || (event.shiftKey ? event.deltaY : 0)) * scale;
    };
    viewport.addEventListener("wheel", wheel, { passive: false });
    return () => viewport.removeEventListener("wheel", wheel);
  }, []);

  useLayoutEffect(() => {
    onInspectionChange(inspecting);
    return () => onInspectionChange(false);
  }, [inspecting, onInspectionChange]);
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scrollTop.current;
  }, [spatial]);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (
        event.code === "Digit4" &&
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !(
          event.target instanceof Element &&
          event.target.closest(
            'input, textarea, select, [contenteditable="true"]',
          )
        )
      ) {
        event.preventDefault();
        setFullscreen((value) => !value);
      } else if (event.key === "Escape" && inspecting) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (fullscreen) setFullscreen(false);
        else setFocused(false);
      }
    };
    window.addEventListener("keydown", keys, true);
    return () => window.removeEventListener("keydown", keys, true);
  }, [fullscreen, inspecting, setFullscreen]);

  return (
    <WorldScreen
      id="code"
      spatial={spatial}
      pose={pose}
      focused={spatial && focused}
      movable={false}
      revealStartedAt={revealStartedAt}
      reducedMotion={reducedMotion}
    >
      <section
        className={`repository-code-screen${spatial ? "" : " repository-code-screen--fullscreen"}`}
        role={spatial ? "region" : "dialog"}
        aria-modal={spatial ? undefined : true}
        aria-label="Repository code"
        data-code-object={instance.instanceId}
        data-code-focused={inspecting}
        data-code-fullscreen={!spatial}
      >
        <header>
          <div>
            <strong>Repository code · read only</strong>
            <small>
              {workstream
                ? `Workstream source · ${workstream.authority?.authority.branch ?? "branch unavailable"}`
                : "Loaded repository source · not a Workstream worktree"}
            </small>
            <p>
              {data?.path ||
                String(
                  instance.linkedRepoData?.path ??
                    instance.linkedRepoData?.label ??
                    "Unlinked object",
                )}
            </p>
          </div>
          <div className="repository-code-screen__actions">
            <button
              type="button"
              className={
                data && onAskAgent ? "world-action--enabled" : undefined
              }
              disabled={!data || !onAskAgent}
              onClick={() => {
                if (!data || !onAskAgent) return;
                onAskAgent(
                  buildCodeQuestionPrompt({
                    path: data.path,
                    repositoryRef: data.repositoryRef,
                    content: data.content,
                    workstream,
                  }),
                );
                onClose();
              }}
            >
              Ask about this
            </button>
            {spatial ? (
              <button
                type="button"
                className="world-action--enabled"
                data-audio="handled"
                onClick={() => setFocused(true)}
              >
                Focus code view
              </button>
            ) : null}
            <button
              type="button"
              className="world-action--enabled"
              aria-keyshortcuts="Alt+4"
              data-audio="handled"
              disabled={!enabled}
              onClick={() => setFullscreen((value) => !value)}
            >
              {spatial ? "Fullscreen code" : "Return code to object"} · Alt+4
            </button>
            {inspecting ? (
              <button
                type="button"
                className="world-action--enabled"
                onClick={() => {
                  setFocused(false);
                  setFullscreen(false);
                }}
                data-audio="handled"
              >
                Return to World
              </button>
            ) : null}
            <button
              type="button"
              className="world-action--enabled"
              onClick={onClose}
              data-audio="handled"
            >
              Close code
            </button>
          </div>
        </header>
        <p className="repository-code-screen__hint">
          Click code to focus · scroll to inspect · Alt+4 fullscreen / object ·
          Escape releases focus · Ask about this prepares a chat draft, never
          sends it
        </p>
        <div
          ref={scroll}
          className="repository-code-screen__scroll"
          tabIndex={0}
          role="region"
          aria-label="Source code viewport"
          onClick={() => {
            if (spatial) setFocused(true);
            scroll.current?.focus({ preventScroll: true });
          }}
          onScroll={(event) => {
            scrollTop.current = event.currentTarget.scrollTop;
          }}
        >
          {!fileRef || !repositoryRef ? (
            <p>No repository source is linked to this object.</p>
          ) : error ? (
            <p role="alert">{error}</p>
          ) : !data ? (
            <p role="status">Loading repository source…</p>
          ) : data.content !== null ? (
            <pre>
              <code>
                {data.content.split("\n").map((line, index) => (
                  <span className="repository-code-screen__line" key={index}>
                    <span aria-hidden="true">{index + 1}</span>
                    {line}
                    {"\n"}
                  </span>
                ))}
              </code>
            </pre>
          ) : (
            <>
              <p>{data.message}</p>
              <ul>
                {data.files.map((file) => (
                  <li key={file.ref}>
                    <button
                      type="button"
                      className="world-action--enabled"
                      onClick={() => {
                        scrollTop.current = 0;
                        setFileRef(file.ref);
                      }}
                    >
                      {file.path}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <footer>
          {data?.message ?? "Read-only repository inspection"}
          {fileRef !== originalRef ? (
            <button
              type="button"
              className="world-action--enabled"
              onClick={() => {
                scrollTop.current = 0;
                setFileRef(originalRef);
              }}
            >
              Back to object files
            </button>
          ) : null}
        </footer>
      </section>
    </WorldScreen>
  );
}
