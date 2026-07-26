import {
  boundedSemanticObjects,
  DEFAULT_REPOSITORY_CAMERA,
  applyRepositoryCameraLook,
  applyRepositoryCameraZoom,
  measureRepositoryPreparation,
  preparePhase10AggregateView,
  preparePhase10VisibleDetail,
  projectToMinimap,
  resolveWebGLCapability,
  type RepositoryRenderObject,
  type RepositoryCameraMode,
  type RepositoryCameraState,
  type WebGLFallbackReason,
} from "@agentintersect-world/renderer-r3f";
import type {
  CodeGraphCurrentData,
  CodeGraphAggregateData,
  EvidenceRecord,
  WorldObject,
  WorldSnapshot,
} from "@agentintersect-world/world-schema";
import { useQuery } from "@tanstack/react-query";
import {
  Component,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  PHASE5_ABSOLUTE_PATH_FIXTURE,
  PHASE5_WORLD_FIXTURE,
  createPhase5TenThousandFixture,
} from "../fixtures/phase5-world.js";
import { useReducedMotion } from "../motion/use-reduced-motion.js";
import { getCurrentRepositoryIndex } from "../repository-index-client.js";
import { getCurrentWorld, getWorldTiles } from "../world-client.js";
import {
  getCurrentCodeGraph,
  getCodeGraphAggregates,
  getFocusedFileGraph,
} from "../code-graph-client.js";
import { getCurrentEvidence } from "../evidence/evidence-client.js";
import { PHASE8_EVIDENCE_FIXTURE } from "../evidence/evidence-fixtures.js";
import {
  PHASE10_CODE_GRAPH_STATUS,
  createPhase10AggregateFixture,
  createPhase10FocusedFixture,
  getPhase10CodeGraph10KStatus,
  getPhase10CodeGraph100KStatus,
} from "../fixtures/phase10-code-graph.js";
import {
  createRepositoryBrowserModel,
  moveSelection,
  safeObjectPath,
  searchRepositoryObjects,
} from "./repository-browser-model.js";
import { currentRepositorySelection } from "./repository-selection.js";
import { WorldActionPanel } from "../world-actions/WorldActionPanel.js";
import { performOperatorTeleport } from "../world-actions/operator-navigation.js";
import {
  repositoryProjectionLimit,
  supportedRepositoryProjection,
} from "./repository-render-policy.js";

const RepositoryIslandCanvas = lazy(() =>
  import("@agentintersect-world/renderer-r3f/repository-island").then(
    ({ RepositoryIslandCanvas: Canvas }) => ({ default: Canvas }),
  ),
);

function rendererObjects(
  objects: readonly WorldObject[],
  evidenceByRef: ReadonlyMap<
    string,
    EvidenceRecord["changes"][number]["outcome"]
  >,
): readonly RepositoryRenderObject[] {
  return objects
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
    .map((object) => {
      const evidenceOutcome = evidenceByRef.get(object.ref);
      return {
        ref: object.ref,
        kind: object.kind,
        name: object.name,
        position: object.position,
        bounds: object.bounds,
        ...(object.kind === "file"
          ? {
              fileKind: object.fileKind,
              language: object.language,
              size: object.size,
            }
          : {}),
        ...(evidenceOutcome ? { evidenceOutcome } : {}),
      };
    });
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
  readonly fixture?:
    | boolean
    | "10k"
    | "absolute-paths"
    | "phase8"
    | "phase10"
    | "phase10-10k"
    | "phase10-100k";
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
  const evidenceQuery = useQuery({
    queryKey: ["phase8-evidence-world", fixture],
    queryFn: async () => {
      if (fixture === "phase8") return PHASE8_EVIDENCE_FIXTURE;
      const result = await getCurrentEvidence();
      if (result.status !== "ok") throw new Error(result.message);
      return result.data;
    },
    enabled: currentQuery.isSuccess,
    retry: false,
  });
  const graphQuery = useQuery({
    queryKey: ["phase10-code-graph", fixture],
    queryFn: async () => {
      if (fixture === "phase10") return PHASE10_CODE_GRAPH_STATUS;
      if (fixture === "phase10-10k") return getPhase10CodeGraph10KStatus();
      if (fixture === "phase10-100k") return getPhase10CodeGraph100KStatus();
      const result = await getCurrentCodeGraph();
      if (result.status !== "ok") throw new Error(result.message);
      return result.data;
    },
    enabled:
      currentQuery.isSuccess &&
      (!fixture ||
        fixture === "phase10" ||
        fixture === "phase10-10k" ||
        fixture === "phase10-100k"),
    retry: false,
  });
  const aggregateQuery = useQuery({
    queryKey: [
      "phase10-code-graph-aggregates",
      fixture,
      graphQuery.data?.current?.generationId,
      2,
    ],
    queryFn: async () => {
      if (
        fixture === "phase10" ||
        fixture === "phase10-10k" ||
        fixture === "phase10-100k"
      )
        return createPhase10AggregateFixture(
          graphQuery.data?.current?.generationId,
        );
      const result = await getCodeGraphAggregates(2, 1_024);
      if (result.status !== "ok") throw new Error(result.message);
      return result.data;
    },
    enabled: graphQuery.data?.current != null,
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
      evidence={evidenceQuery.data?.current ?? null}
      graphStatus={graphQuery.data ?? null}
      graphAggregate={aggregateQuery.data ?? null}
      phase10Fixture={
        fixture === "phase10" ||
        fixture === "phase10-10k" ||
        fixture === "phase10-100k"
      }
      graphRequested={
        !fixture ||
        fixture === "phase10" ||
        fixture === "phase10-10k" ||
        fixture === "phase10-100k"
      }
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
  evidence,
  graphStatus,
  graphAggregate,
  phase10Fixture,
  graphRequested,
}: {
  readonly snapshot: WorldSnapshot;
  readonly tileCount: number;
  readonly fallbackReason: WebGLFallbackReason | null;
  readonly setFallbackReason: (reason: WebGLFallbackReason) => void;
  readonly reducedMotion: boolean;
  readonly evidence: EvidenceRecord | null;
  readonly graphStatus: CodeGraphCurrentData | null;
  readonly graphAggregate: CodeGraphAggregateData | null;
  readonly phase10Fixture: boolean;
  readonly graphRequested: boolean;
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
  const requested = currentRepositorySelection();
  const requestedRef =
    requested && model.byRef.has(requested.ref) ? requested.ref : null;
  const [selectedRef, setSelectedRef] = useState<string | null>(
    requestedRef ?? repository?.ref ?? null,
  );
  const [focusRef, setFocusRef] = useState<string | null>(requestedRef);
  const [agentPosition, setAgentPosition] = useState<{
    readonly x: number;
    readonly z: number;
  } | null>(null);
  const [cameraMode, setCameraMode] =
    useState<RepositoryCameraMode>("third-person");
  const [cameraState, setCameraState] = useState<RepositoryCameraState>(
    DEFAULT_REPOSITORY_CAMERA,
  );
  const [cameraPreferences, setCameraPreferences] = useState({
    sensitivity: 0.8,
    invertedY: false,
    fieldOfView: 75,
    easing: 0.35,
  });
  const cameraSurfaceRef = useRef<HTMLDivElement | null>(null);
  const cameraDragRef = useRef<{
    readonly pointerId: number;
    readonly x: number;
    readonly y: number;
  } | null>(null);
  const cameraMouseDragRef = useRef<{
    readonly x: number;
    readonly y: number;
  } | null>(null);
  const applyCameraLook = useCallback(
    (input: {
      readonly movementX: number;
      readonly movementY: number;
      readonly sensitivity: number;
      readonly invertedY: boolean;
    }) =>
      setCameraState((current) => applyRepositoryCameraLook(current, input)),
    [],
  );
  useEffect(() => {
    const surface = cameraSurfaceRef.current;
    if (!surface) return;
    const down = (event: MouseEvent) => {
      if (cameraMode === "first-person" || event.button !== 0) return;
      cameraMouseDragRef.current = { x: event.clientX, y: event.clientY };
    };
    const move = (event: MouseEvent) => {
      const drag = cameraMouseDragRef.current;
      if (!drag) return;
      applyCameraLook({
        movementX: event.clientX - drag.x,
        movementY: event.clientY - drag.y,
        sensitivity: cameraPreferences.sensitivity,
        invertedY: cameraPreferences.invertedY,
      });
      cameraMouseDragRef.current = { x: event.clientX, y: event.clientY };
    };
    const up = () => {
      cameraMouseDragRef.current = null;
    };
    surface.addEventListener("mousedown", down, true);
    window.addEventListener("mousemove", move, true);
    window.addEventListener("mouseup", up, true);
    return () => {
      surface.removeEventListener("mousedown", down, true);
      window.removeEventListener("mousemove", move, true);
      window.removeEventListener("mouseup", up, true);
      cameraMouseDragRef.current = null;
    };
  }, [applyCameraLook, cameraMode, cameraPreferences]);
  const selected =
    selectedRef === null ? null : (model.byRef.get(selectedRef) ?? null);
  const focusedFile =
    focusRef === null ? null : (model.byRef.get(focusRef) ?? null);
  const focusedGraphQuery = useQuery({
    queryKey: [
      "phase10-focused-file",
      focusRef,
      phase10Fixture,
      graphStatus?.current?.generationId,
    ],
    queryFn: async () => {
      if (focusRef === null) throw new Error("No focused file");
      if (phase10Fixture)
        return createPhase10FocusedFixture(
          focusRef,
          graphStatus?.current?.generationId,
        );
      const result = await getFocusedFileGraph(focusRef, 4);
      if (result.status !== "ok") throw new Error(result.message);
      return result.data;
    },
    enabled:
      graphStatus?.current != null &&
      focusedFile?.kind === "file" &&
      focusRef !== null,
    retry: false,
  });
  const focusedGraph =
    focusedGraphQuery.data?.generationId === graphStatus?.current?.generationId
      ? focusedGraphQuery.data
      : null;
  const selectedSymbol = focusedGraph?.symbols.find(
    (symbol) => symbol.ref === selectedRef,
  );
  const evidenceByRef = useMemo(
    () =>
      new Map(
        (evidence?.changes ?? []).flatMap((change) =>
          change.objectRef ? [[change.objectRef, change.outcome] as const] : [],
        ),
      ),
    [evidence],
  );
  const projectedWorldObjects = useMemo(
    () =>
      supportedRepositoryProjection(
        snapshot.objects,
        repositoryProjectionLimit(graphRequested, fallbackReason !== null),
      ),
    [fallbackReason, graphRequested, snapshot.objects],
  );
  const renderObjects = useMemo(
    () => rendererObjects(projectedWorldObjects, evidenceByRef),
    [evidenceByRef, projectedWorldObjects],
  );
  const preparation = useMemo(
    () => measureRepositoryPreparation(renderObjects),
    [renderObjects],
  );
  const aggregatePreparation = useMemo(
    () =>
      graphAggregate
        ? preparePhase10AggregateView(renderObjects, graphAggregate.edges)
        : preparation.prepared,
    [graphAggregate, preparation.prepared, renderObjects],
  );
  const phase10Detail = useMemo(() => {
    const focusedRenderFile =
      renderObjects.find((object) => object.ref === focusedGraph?.fileRef) ??
      (focusedFile?.kind === "file"
        ? rendererObjects([focusedFile], evidenceByRef)[0]
        : undefined);
    if (!focusedGraph || !focusedRenderFile) return null;
    return preparePhase10VisibleDetail({
      baseObjects: renderObjects,
      focusedFile: focusedRenderFile,
      symbols: focusedGraph.symbols,
      dependencies: focusedGraph.dependencies,
      selectedRef,
    });
  }, [evidenceByRef, focusedFile, focusedGraph, renderObjects, selectedRef]);
  const prepared = phase10Detail?.prepared ?? aggregatePreparation;
  const safeGraphLabel = (ref: string): string =>
    model.byRef.get(ref)?.name ?? ref;
  const aggregateGraphState =
    graphAggregate &&
    graphStatus?.current?.generationId === graphAggregate.generationId
      ? graphStatus.current.state
      : graphAggregate &&
          graphStatus?.previous?.generationId === graphAggregate.generationId
        ? "previous"
        : "generation mismatch";
  const select = useCallback((ref: string | null) => setSelectedRef(ref), []);
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
        {graphRequested && (
          <p
            className="code-graph-status"
            data-testid="code-graph-status"
            data-reduced-motion={reducedMotion}
            data-webgl-fallback={fallbackReason ?? "none"}
          >
            {graphStatus?.current ? (
              <>
                Phase 10 {graphStatus.current.state} ·{" "}
                {graphStatus.current.counts.parsedFiles}/
                {graphStatus.current.counts.files} files parsed ·{" "}
                {graphStatus.current.counts.symbols} symbols ·{" "}
                {graphStatus.current.degraded ? "degraded" : "complete"}
                {graphStatus.previous
                  ? ` · previous ${graphStatus.previous.generationId}`
                  : " · no previous graph"}
              </>
            ) : (
              <>Phase 10 graph unavailable</>
            )}
          </p>
        )}
        {graphAggregate && graphStatus?.current && (
          <section
            className="dependency-summary"
            aria-label="Current aggregate dependencies"
            data-testid="aggregate-dependency-summary"
            data-rendered-bridges={
              aggregatePreparation.dependencyBridges.length
            }
          >
            <h3>
              {aggregateGraphState === "current"
                ? "Current"
                : aggregateGraphState === "previous"
                  ? "Previous"
                  : "Mismatched"}{" "}
              aggregate dependencies · LOD {graphAggregate.lod}
            </h3>
            <p>
              {graphAggregate.totalEdges} relationships · showing{" "}
              {graphAggregate.edges.length} ·{" "}
              {graphAggregate.truncated ? "truncated" : "not truncated"} ·{" "}
              {graphStatus.current.degraded ? "degraded" : "complete"} ·{" "}
              {aggregateGraphState}
              {graphStatus.previous
                ? ` · previous ${graphStatus.previous.generationId}`
                : " · no previous graph"}
            </p>
            <ul>
              {graphAggregate.edges.slice(0, 64).map((edge) => {
                const drawable =
                  edge.targetRef !== null &&
                  edge.confidence.some(
                    (value) =>
                      value === "exact_file" ||
                      value === "exact_workspace_package",
                  );
                return (
                  <li key={edge.key} data-drawable={drawable}>
                    <span>{safeGraphLabel(edge.sourceRef)}</span>
                    <span aria-hidden="true"> → </span>
                    <span>
                      {edge.targetRef
                        ? safeGraphLabel(edge.targetRef)
                        : "no drawable target"}
                    </span>
                    <small>
                      {edge.count} · {edge.confidence.join(" + ")} ·{" "}
                      {drawable ? "drawable" : "non-drawable"} · cycle{" "}
                      {edge.cycleGroupId ?? "none"}
                    </small>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
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
            {visible.map((object) => {
              const evidenceOutcome = evidenceByRef.get(object.ref);
              return (
                <li
                  key={object.ref}
                  role="none"
                  data-evidence-outcome={evidenceOutcome}
                >
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
                    {evidenceOutcome && (
                      <span
                        className={`object-evidence-badge object-evidence-badge--${evidenceOutcome}`}
                      >
                        {evidenceOutcome} · observed-in-window
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {focusedGraph && (
            <section
              className="symbol-detail"
              aria-label="Focused file symbols"
              data-testid="focused-symbol-detail"
              data-whole-repository-detail="false"
            >
              <h3>Focused symbols</h3>
              <p role="status">
                {focusedGraph.coverage.state} · {focusedGraph.symbols.length}{" "}
                symbols · showing {phase10Detail?.semanticSymbols.length ?? 0}{" "}
                rows · {focusedGraph.dependencies.length} dependencies · graph{" "}
                {focusedGraph.state}
              </p>
              {focusedGraph.coverage.fallbackReason && (
                <p>
                  {focusedGraph.coverage.fallbackReason.replaceAll("_", " ")}
                </p>
              )}
              <ul>
                {(phase10Detail?.semanticSymbols ?? []).map((symbol) => (
                  <li key={symbol.ref}>
                    <button
                      type="button"
                      aria-pressed={selectedRef === symbol.ref}
                      data-symbol-ref={symbol.ref}
                      onClick={() => select(symbol.ref)}
                    >
                      {symbol.name}
                    </button>
                  </li>
                ))}
              </ul>
              <h3>Focused dependencies</h3>
              <p data-testid="focused-dependency-status">
                {focusedGraph.dependencies.length} relationships · showing{" "}
                {Math.min(focusedGraph.dependencies.length, 1_024)} ·{" "}
                {focusedGraph.truncated || phase10Detail?.dependenciesTruncated
                  ? "truncated"
                  : "not truncated"}
              </p>
              <ul aria-label="Focused file dependencies">
                {focusedGraph.dependencies.slice(0, 1_024).map((edge) => {
                  const drawable =
                    edge.candidateRefs.length > 0 &&
                    edge.confidence.some(
                      (value) =>
                        value === "exact_file" ||
                        value === "exact_workspace_package",
                    );
                  return (
                    <li key={edge.ref} data-drawable={drawable}>
                      <strong>{edge.specifier}</strong>
                      <span>
                        {edge.candidateRefs.length === 0
                          ? "no candidate target"
                          : edge.candidateRefs
                              .slice(0, 8)
                              .map(safeGraphLabel)
                              .join(", ")}
                        {edge.candidateRefs.length > 8
                          ? ` · ${edge.candidateRefs.length - 8} more targets`
                          : ""}
                      </span>
                      <small>
                        {edge.confidence.join(" + ")} ·{" "}
                        {drawable ? "drawable" : "non-drawable"} · cycle{" "}
                        {edge.cycleGroupId ?? "none"}
                      </small>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </section>
        <section
          className="island-view"
          aria-label="Repository island visualization"
        >
          {fallbackReason === null ? (
            <CanvasBoundary
              onFailure={() => setFallbackReason("creation-failed")}
            >
              <div
                ref={cameraSurfaceRef}
                className="island-canvas"
                data-testid="repository-canvas"
                data-camera-mode={cameraMode}
                data-camera-yaw={cameraState.yaw}
                data-camera-pitch={cameraState.pitch}
                data-camera-distance={cameraState.distance}
                data-agent-position={
                  agentPosition
                    ? `${agentPosition.x},${agentPosition.z}`
                    : "none"
                }
                data-photo-hidden={cameraMode === "photo"}
                onPointerDownCapture={(event) => {
                  if (
                    cameraMode === "first-person" ||
                    event.pointerType === "mouse"
                  )
                    return;
                  cameraDragRef.current = {
                    pointerId: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                  };
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                }}
                onPointerMoveCapture={(event) => {
                  const drag = cameraDragRef.current;
                  if (!drag || drag.pointerId !== event.pointerId) return;
                  applyCameraLook({
                    movementX: event.clientX - drag.x,
                    movementY: event.clientY - drag.y,
                    sensitivity: cameraPreferences.sensitivity,
                    invertedY: cameraPreferences.invertedY,
                  });
                  cameraDragRef.current = {
                    pointerId: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                  };
                }}
                onPointerUpCapture={(event) => {
                  if (cameraDragRef.current?.pointerId === event.pointerId)
                    cameraDragRef.current = null;
                }}
                onPointerCancelCapture={() => {
                  cameraDragRef.current = null;
                }}
                onWheelCapture={(event) => {
                  if (cameraMode === "first-person") return;
                  setCameraState((current) =>
                    applyRepositoryCameraZoom(current, event.deltaY),
                  );
                }}
              >
                <RepositoryIslandCanvas
                  prepared={prepared}
                  selectedRef={selectedRef}
                  focusRef={focusRef}
                  agentPosition={agentPosition}
                  cameraMode={cameraMode}
                  cameraState={cameraState}
                  fieldOfView={cameraPreferences.fieldOfView}
                  cameraEasing={reducedMotion ? 0 : cameraPreferences.easing}
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
                    data-evidence-outcome={evidenceByRef.get(object.ref)}
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                    aria-label={`Travel to ${object.name} from overview`}
                    onClick={() => {
                      performOperatorTeleport({
                        snapshot,
                        selectedRef: object.ref,
                        noWebGL: fallbackReason !== null,
                        onAgentPosition: setAgentPosition,
                        onSelect: select,
                        onFocus: setFocusRef,
                      });
                    }}
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
          {selectedSymbol && (
            <dl data-testid="selected-symbol-truth">
              <div>
                <dt>Symbol</dt>
                <dd>{selectedSymbol.name}</dd>
              </div>
              <div>
                <dt>Kind</dt>
                <dd>{selectedSymbol.kind}</dd>
              </div>
              <div>
                <dt>File</dt>
                <dd>{selectedSymbol.fileRef}</dd>
              </div>
              <div>
                <dt>Selection mode</dt>
                <dd>Semantic DOM and R3F equivalent</dd>
              </div>
            </dl>
          )}
          {selected === null && !selectedSymbol ? (
            <p>No object selected</p>
          ) : selected ? (
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
              {evidenceByRef.has(selected.ref) && (
                <div>
                  <dt>Observed change</dt>
                  <dd>
                    {evidenceByRef.get(selected.ref)} · observed-in-window
                  </dd>
                </div>
              )}
            </dl>
          ) : null}
        </aside>
      </div>
      <WorldActionPanel
        snapshot={snapshot}
        selectedRef={selectedRef}
        onSelect={select}
        onFocus={setFocusRef}
        onAgentPosition={setAgentPosition}
        noWebGL={fallbackReason !== null}
        reducedMotion={reducedMotion}
        cameraYaw={cameraState.yaw}
        onCameraMode={setCameraMode}
        onCameraLook={applyCameraLook}
        onCameraPreferences={(preferences) =>
          setCameraPreferences({
            sensitivity: preferences.sensitivity,
            invertedY: preferences.invertedY,
            fieldOfView: preferences.fieldOfView,
            easing: preferences.easing,
          })
        }
      />
    </section>
  );
}
