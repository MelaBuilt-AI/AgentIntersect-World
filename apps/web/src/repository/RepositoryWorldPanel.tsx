import {
  RepositoryIslandCanvas,
  boundedSemanticObjects,
  measureRepositoryPreparation,
  projectToMinimap,
  resolveWebGLCapability,
  type RepositoryRenderObject,
  type WebGLFallbackReason,
} from "@agentintersect-world/renderer-r3f";
import type {
  WorldObject,
  WorldSnapshot,
} from "@agentintersect-world/world-schema";
import { useQuery } from "@tanstack/react-query";
import { Component, useCallback, useMemo, useState } from "react";

import {
  PHASE5_ABSOLUTE_PATH_FIXTURE,
  PHASE5_WORLD_FIXTURE,
  createPhase5TenThousandFixture,
} from "../fixtures/phase5-world.js";
import { useReducedMotion } from "../motion/use-reduced-motion.js";
import { getCurrentRepositoryIndex } from "../repository-index-client.js";
import { getCurrentWorld, getWorldTiles } from "../world-client.js";
import {
  createRepositoryBrowserModel,
  moveSelection,
  safeObjectPath,
  searchRepositoryObjects,
} from "./repository-browser-model.js";

function rendererObjects(
  snapshot: WorldSnapshot,
): readonly RepositoryRenderObject[] {
  return snapshot.objects
    .filter(
      (
        object,
      ): object is Extract<
        WorldObject,
        { kind: "package" | "directory" | "file" }
      > =>
        object.kind === "package" ||
        object.kind === "directory" ||
        object.kind === "file",
    )
    .map((object) => ({
      ref: object.ref,
      kind: object.kind,
      name: object.name,
      position: object.position,
      bounds: object.bounds,
    }));
}

class CanvasBoundary extends Component<
  { readonly onFailure: () => void; readonly children: React.ReactNode },
  { readonly failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function RepositoryWorldPanel({
  fixture = false,
  forcedFallback,
}: {
  readonly fixture?: boolean | "10k" | "absolute-paths";
  readonly forcedFallback?: WebGLFallbackReason;
}) {
  const reducedMotion = useReducedMotion();
  const forcedMode =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("webgl");
  const initialCapability = useMemo(
    () =>
      resolveWebGLCapability(
        forcedMode === "off"
          ? { forceDisabled: true }
          : forcedMode === "fail"
            ? { createContext: () => null }
            : {},
      ),
    [forcedMode],
  );
  const [fallbackReason, setFallbackReason] =
    useState<WebGLFallbackReason | null>(
      forcedFallback ??
        (initialCapability.available ? null : initialCapability.reason),
    );
  const currentQuery = useQuery({
    queryKey: ["world-current", fixture],
    queryFn: async () => {
      if (fixture === "10k") return createPhase5TenThousandFixture();
      if (fixture === "absolute-paths") return PHASE5_ABSOLUTE_PATH_FIXTURE;
      if (fixture) return PHASE5_WORLD_FIXTURE;
      const currentRepository = await getCurrentRepositoryIndex();
      if (currentRepository.status !== "ok")
        throw new Error(currentRepository.message);
      if (currentRepository.data.generation === null)
        throw new Error("No successful repository index is available yet");
      const result = await getCurrentWorld();
      if (result.status !== "ok") throw new Error(result.message);
      return result.data.snapshot;
    },
    retry: false,
  });
  const tileQuery = useQuery({
    queryKey: ["world-tiles", fixture],
    queryFn: async () => {
      if (fixture === "10k") return createPhase5TenThousandFixture().tiles;
      if (fixture === "absolute-paths")
        return PHASE5_ABSOLUTE_PATH_FIXTURE.tiles;
      if (fixture) return PHASE5_WORLD_FIXTURE.tiles;
      const result = await getWorldTiles();
      if (result.status !== "ok") throw new Error(result.message);
      return result.data.tiles;
    },
    enabled: Boolean(fixture) || currentQuery.isSuccess,
    retry: false,
  });
  if (currentQuery.isPending) {
    return (
      <p className="panel-state" role="status">
        Loading current World snapshot…
      </p>
    );
  }
  if (currentQuery.isError) {
    return <RepositoryWorldErrorState message={currentQuery.error.message} />;
  }
  return (
    <RepositoryBrowser
      snapshot={currentQuery.data}
      tileCount={tileQuery.data?.length ?? 0}
      fallbackReason={fallbackReason}
      setFallbackReason={setFallbackReason}
      reducedMotion={reducedMotion}
    />
  );
}

export function RepositoryWorldErrorState({
  message,
}: {
  readonly message: string;
}) {
  return (
    <section className="panel-state panel-state--error" role="alert">
      <span className="terminal-kicker">world_api_error_</span>
      <h2>Repository island request failed</h2>
      <p>{message}</p>
      <p>Use the Repository index controls, then reopen World.</p>
    </section>
  );
}

export function RepositoryWorldEmptyState() {
  return (
    <section className="panel-state" role="status">
      <span className="terminal-kicker">world_empty_</span>
      <h2>No repository island is available yet</h2>
      <p>Index a repository to create the first shareable World snapshot.</p>
      <button type="button" disabled>
        Open unavailable island
      </button>
    </section>
  );
}

function RepositoryBrowser({
  snapshot,
  tileCount,
  fallbackReason,
  setFallbackReason,
  reducedMotion,
}: {
  readonly snapshot: WorldSnapshot;
  readonly tileCount: number;
  readonly fallbackReason: WebGLFallbackReason | null;
  readonly setFallbackReason: (reason: WebGLFallbackReason) => void;
  readonly reducedMotion: boolean;
}) {
  const model = useMemo(
    () => createRepositoryBrowserModel(snapshot.objects),
    [snapshot.objects],
  );
  const repository =
    model.byRef.get(snapshot.repositoryRef) ?? model.ordered[0] ?? null;
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => searchRepositoryObjects(model, query),
    [model, query],
  );
  const keyboardModel = useMemo(
    () =>
      query.trim().length === 0 ? model : createRepositoryBrowserModel(results),
    [model, query, results],
  );
  const visible = boundedSemanticObjects(results, 160);
  const [selectedRef, setSelectedRef] = useState<string | null>(
    repository?.ref ?? null,
  );
  const [focusRef, setFocusRef] = useState<string | null>(null);
  const selected =
    selectedRef === null ? null : (model.byRef.get(selectedRef) ?? null);
  const renderObjects = useMemo(() => rendererObjects(snapshot), [snapshot]);
  const preparation = useMemo(
    () => measureRepositoryPreparation(renderObjects),
    [renderObjects],
  );
  const prepared = preparation.prepared;
  const select = useCallback((ref: string) => setSelectedRef(ref), []);
  const keyboardMove = (direction: Parameters<typeof moveSelection>[2]) => {
    const next = moveSelection(keyboardModel, selectedRef, direction);
    setSelectedRef(next);
    requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(
        `[data-object-ref="${CSS.escape(next ?? "")}"]`,
      );
      element?.focus();
    });
  };
  const handleKeys = (event: React.KeyboardEvent) => {
    const directions: Partial<
      Record<string, Parameters<typeof moveSelection>[2]>
    > = {
      ArrowDown: "next",
      ArrowUp: "previous",
      ArrowLeft: "parent",
      Home: "first",
      End: "last",
    };
    if (event.key === "Enter" && selectedRef !== null) {
      event.preventDefault();
      setFocusRef(selectedRef);
      return;
    }
    const direction = directions[event.key];
    if (direction !== undefined) {
      event.preventDefault();
      keyboardMove(direction);
    }
  };
  return (
    <section className="world-browser" aria-labelledby="world-browser-title">
      <header className="panel-heading world-browser__heading">
        <span>Phase 4 snapshot · {tileCount} bounded tiles</span>
        <h2 id="world-browser-title">
          {repository?.name ?? "Repository"} island
        </h2>
        <p>
          One shared selection drives the semantic browser, canvas, focus
          target, inspector, and overview. Relative paths only.
        </p>
      </header>
      <div className="world-browser__layout">
        <section
          className="semantic-browser"
          aria-label="Semantic repository browser"
        >
          <label htmlFor="repository-search">
            Search packages, directories, and files
          </label>
          <input
            id="repository-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value.slice(0, 240))}
            onKeyDown={handleKeys}
            placeholder="Search name, relative path, kind, language…"
          />
          <p className="result-count" role="status" aria-live="polite">
            {results.length} matches · showing {visible.length} semantic rows
          </p>
          <ul
            className="object-tree"
            role="tree"
            aria-label="Repository objects"
            onKeyDown={handleKeys}
          >
            {visible.map((object) => (
              <li key={object.ref} role="none">
                <button
                  type="button"
                  role="treeitem"
                  aria-selected={selectedRef === object.ref}
                  tabIndex={selectedRef === object.ref ? 0 : -1}
                  data-object-ref={object.ref}
                  style={
                    {
                      "--tree-depth": model.depthByRef.get(object.ref) ?? 0,
                    } as React.CSSProperties
                  }
                  onClick={() => select(object.ref)}
                  onFocus={() => select(object.ref)}
                >
                  <span
                    className={`kind-icon kind-icon--${object.kind}`}
                    aria-hidden="true"
                  />
                  <span>{object.name}</span>
                  <small>{object.kind}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section
          className="island-view"
          aria-label="Repository island visualization"
        >
          {fallbackReason === null ? (
            <CanvasBoundary
              onFailure={() => setFallbackReason("creation-failed")}
            >
              <div className="island-canvas" data-testid="repository-canvas">
                <RepositoryIslandCanvas
                  prepared={prepared}
                  selectedRef={selectedRef}
                  focusRef={focusRef}
                  onSelect={select}
                  onContextLost={() => setFallbackReason("context-lost")}
                  reducedMotion={reducedMotion}
                />
              </div>
            </CanvasBoundary>
          ) : (
            <div
              className="canvas-fallback"
              role="status"
              data-testid="webgl-fallback"
            >
              <strong>Semantic mode active</strong>
              <span>
                WebGL {fallbackReason.replace("-", " ")}; every repository
                action remains available.
              </span>
            </div>
          )}
          <div className="island-toolbar">
            <button
              type="button"
              disabled={selectedRef === null}
              onClick={() => setFocusRef(selectedRef)}
            >
              Focus selected object
            </button>
            <span
              data-testid="instance-measurement"
              data-preparation-ms={preparation.durationMs.toFixed(3)}
            >
              {prepared.total.toLocaleString()} instanced objects prepared
            </span>
          </div>
          <section className="minimap" aria-label="Repository overview minimap">
            <strong>Overview</strong>
            <div className="minimap__plot">
              {renderObjects.slice(0, 80).map((object) => {
                const point = projectToMinimap(object, prepared.overview);
                return (
                  <button
                    key={object.ref}
                    type="button"
                    className={selectedRef === object.ref ? "is-selected" : ""}
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                    aria-label={`Select ${object.name} from overview`}
                    onClick={() => select(object.ref)}
                  />
                );
              })}
            </div>
          </section>
        </section>
        <aside
          className="object-inspector"
          aria-label="Selected object inspector"
        >
          <span className="terminal-kicker">inspect_</span>
          {selected === null ? (
            <p>No object selected</p>
          ) : (
            <dl>
              <div>
                <dt>Name</dt>
                <dd>{selected.name}</dd>
              </div>
              <div>
                <dt>Kind</dt>
                <dd>{selected.kind}</dd>
              </div>
              <div>
                <dt>Relative path</dt>
                <dd>{safeObjectPath(selected) ?? "Not applicable"}</dd>
              </div>
              {selected.kind === "file" && (
                <>
                  <div>
                    <dt>Language</dt>
                    <dd>{selected.language ?? "Unsupported / unknown"}</dd>
                  </div>
                  <div>
                    <dt>File kind</dt>
                    <dd>{selected.fileKind}</dd>
                  </div>
                  <div>
                    <dt>Size</dt>
                    <dd>{selected.size.toLocaleString()} bytes</dd>
                  </div>
                </>
              )}
              {selected.kind === "package" && (
                <div>
                  <dt>Package</dt>
                  <dd>{selected.packageName ?? selected.packageKind}</dd>
                </div>
              )}
              <div>
                <dt>Focus</dt>
                <dd>{focusRef === selected.ref ? "Focused" : "Not focused"}</dd>
              </div>
            </dl>
          )}
        </aside>
      </div>
    </section>
  );
}
