import {
  REPOSITORY_ASSET_BY_ID,
  REPOSITORY_ASSET_CATEGORIES,
  REPOSITORY_ASSET_MANIFEST,
  REPOSITORY_STATUS_PRESENTATION,
  type RepositoryAssetId,
  type RepositoryCityInstance,
} from "@agentintersect-world/renderer-r3f";
import { useMemo, useState } from "react";

import { WorldScreen, WorldScreenToggle } from "./WorldScreen.js";
import { WorkInspector } from "./WorkInspector.js";
import type {
  Workstream,
  WorkstreamTracerSource,
} from "./workstream-tracer.js";

export function RepositoryAssetPalette({
  mode,
  selected,
  onMode,
  onPlace,
  onFocus,
  onPin,
  onRemove,
  onAskAgent,
  availableWorkstream,
  workstream,
  onSelectWorkstream,
  workstreamSource,
  tracerMessage,
  onCreateWorkstream,
  workstreamTask,
  workstreamCreateUnavailableReason,
  onCancelWorkstream,
  workstreamActionPending = false,
}: {
  readonly mode: "live" | "director";
  readonly selected: RepositoryCityInstance | null;
  readonly onMode: (mode: "live" | "director") => void;
  readonly onPlace: (assetId: RepositoryAssetId) => void;
  readonly onFocus?: ((instanceId: string) => void) | undefined;
  readonly onPin?: ((instanceId: string, pinned: boolean) => void) | undefined;
  readonly onRemove?: ((instanceId: string) => void) | undefined;
  readonly onAskAgent?:
    ((instance: RepositoryCityInstance) => void) | undefined;
  readonly availableWorkstream?: Workstream | null | undefined;
  readonly workstream?: Workstream | null | undefined;
  readonly onSelectWorkstream?: ((workstreamId: string) => void) | undefined;
  readonly workstreamSource?: WorkstreamTracerSource | undefined;
  readonly tracerMessage?: string | null | undefined;
  readonly onCreateWorkstream?: (() => void) | undefined;
  readonly workstreamTask?: string | null | undefined;
  readonly workstreamCreateUnavailableReason?: string | null | undefined;
  readonly onCancelWorkstream?: (() => void) | undefined;
  readonly workstreamActionPending?: boolean | undefined;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<
    "all" | (typeof REPOSITORY_ASSET_CATEGORIES)[number]
  >("all");
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return REPOSITORY_ASSET_MANIFEST.filter(
      (asset) =>
        (category === "all" || asset.category === category) &&
        (normalized.length === 0 ||
          `${asset.label} ${asset.meaning}`
            .toLocaleLowerCase()
            .includes(normalized)),
    );
  }, [category, query]);
  const selectedAsset = selected
    ? (REPOSITORY_ASSET_BY_ID.get(selected.assetId) ?? null)
    : null;
  const workstreamOpen =
    Boolean(workstream) &&
    workstream?.workstreamId === availableWorkstream?.workstreamId;
  return (
    <WorldScreen id="director">
      <aside className="repository-assets" aria-label="Repository assets">
        <WorldScreenToggle id="director" />
        <details open>
          <summary>Repository Asset Palette</summary>
          <div className="repository-assets__controls">
            <div
              className="repository-assets__modes"
              aria-label="Asset placement mode"
            >
              <button
                type="button"
                aria-pressed={mode === "live"}
                onClick={() => onMode("live")}
              >
                Live
              </button>
              <button
                type="button"
                aria-pressed={mode === "director"}
                onClick={() => onMode("director")}
              >
                Director
              </button>
            </div>
            <label>
              <span>Search assets</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                type="search"
              />
            </label>
            <label>
              <span>Category</span>
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.currentTarget.value as typeof category)
                }
              >
                <option value="all">All categories</option>
                {REPOSITORY_ASSET_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            {mode === "director" ? (
              <p>Drag to the repository grid or use Place on grid.</p>
            ) : (
              <p>Live events choose assets automatically.</p>
            )}
          </div>
          <ul className="repository-assets__grid" aria-live="polite">
            {visible.map((asset) => (
              <li key={asset.id}>
                <article
                  className="repository-assets__card"
                  draggable={mode === "director"}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "application/x-aiw-repository-asset",
                      asset.id,
                    );
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  <img
                    className="repository-assets__thumbnail"
                    src={asset.thumbnailUrl}
                    alt=""
                    loading="lazy"
                  />
                  <strong>{asset.label}</strong>
                  <small>{asset.category}</small>
                  <button
                    type="button"
                    disabled={mode !== "director"}
                    onClick={() => onPlace(asset.id)}
                  >
                    Place on grid
                  </button>
                </article>
              </li>
            ))}
          </ul>
        </details>
        {availableWorkstream || tracerMessage ? (
          <section
            className="workstream-tracer-control"
            aria-label={
              workstreamSource === "live"
                ? "Authoritative Workbench"
                : workstreamSource === "phase14"
                  ? "Phase 14 diagnostic tracer"
                  : "Workbench tracer demo"
            }
          >
            <strong>
              {workstreamSource === "live"
                ? "Authoritative Workbench · current local Workstream"
                : workstreamSource === "phase14"
                  ? "Phase 14 diagnostic tracer · read-only"
                  : "Workbench tracer · demo fixture"}
            </strong>
            {tracerMessage ? <p role="status">{tracerMessage}</p> : null}
            {availableWorkstream ? (
              <button
                type="button"
                aria-controls="work-inspector"
                aria-expanded={workstreamOpen}
                onClick={() =>
                  onSelectWorkstream?.(availableWorkstream.workstreamId)
                }
              >
                {workstreamOpen
                  ? "Work Inspector open"
                  : workstreamSource === "live"
                    ? "Inspect current Workstream"
                    : workstreamSource === "phase14"
                      ? "Inspect current Phase 14 workstream"
                      : "Inspect demo workstream"}
              </button>
            ) : null}
            {workstreamSource === "live" && !availableWorkstream ? (
              <>
                <button
                  type="button"
                  className={
                    onCreateWorkstream &&
                    workstreamTask &&
                    !workstreamCreateUnavailableReason &&
                    !workstreamActionPending
                      ? "world-action--enabled"
                      : undefined
                  }
                  disabled={
                    !onCreateWorkstream ||
                    !workstreamTask ||
                    Boolean(workstreamCreateUnavailableReason) ||
                    workstreamActionPending
                  }
                  onClick={onCreateWorkstream}
                >
                  {workstreamActionPending
                    ? "Creating Workstream…"
                    : "Create Workstream"}
                </button>
                {!workstreamTask || workstreamCreateUnavailableReason ? (
                  <p role="status">
                    {workstreamCreateUnavailableReason ??
                      "Send a feature request in World chat first."}
                  </p>
                ) : null}
              </>
            ) : null}
          </section>
        ) : null}
        {workstream ? (
          <WorkInspector
            workstream={workstream}
            source={workstreamSource}
            onCancel={onCancelWorkstream}
            actionPending={workstreamActionPending}
          />
        ) : null}
        {selected && selectedAsset ? (
          <section
            className="repository-asset-inspector"
            aria-label="Asset Inspector"
          >
            <h2>Asset Inspector</h2>
            <h3>{selectedAsset.label}</h3>
            <p>{selectedAsset.inspectorCopy}</p>
            <p>
              <strong>
                {REPOSITORY_STATUS_PRESENTATION[selected.status].marker}{" "}
                {REPOSITORY_STATUS_PRESENTATION[selected.status].label}
              </strong>
            </p>
            {selected.linkedRepoData ? (
              <dl>
                {Object.entries(selected.linkedRepoData).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>Manual director placement · no linked repository item.</p>
            )}
            <div className="repository-asset-inspector__actions">
              <button
                type="button"
                onClick={() => onFocus?.(selected.instanceId)}
              >
                Focus
              </button>
              <button
                type="button"
                onClick={() => onPin?.(selected.instanceId, !selected.pinned)}
              >
                {selected.pinned ? "Unpin" : "Pin"}
              </button>
              <button
                type="button"
                disabled={!selected.manual}
                onClick={() => onRemove?.(selected.instanceId)}
              >
                Remove
              </button>
              <button
                type="button"
                disabled
                title="Repository navigation is not connected in this World view"
              >
                Locate Repo Item
              </button>
              <button type="button" onClick={() => onAskAgent?.(selected)}>
                Ask Agent to Explain
              </button>
            </div>
          </section>
        ) : null}
      </aside>
    </WorldScreen>
  );
}
