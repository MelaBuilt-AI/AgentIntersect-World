import { useMemo, useState } from "react";
import {
  REPOSITORY_ASSET_BY_ID,
  REPOSITORY_ASSET_CATEGORIES,
  REPOSITORY_ASSET_MANIFEST,
  type RepositoryAssetId,
  type RepositoryCityInstance,
} from "@agentintersect-world/renderer-r3f";
import { WorldScreen, WorldScreenToggle } from "./WorldScreen.js";
import { useWorldScreens } from "./world-screen-context.js";
import type { Workstream } from "./workstream-tracer.js";

/** Project overview owns presentation only; Workbench continues to own work. */
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
  onSelectWorkstream,
  projectName = "Loaded repository",
  agentName = "No assigned agent",
  onOpenWorkbench,
  onNewWorkstream,
  instances = [],
  onSelectObject,
}: {
  readonly mode: "live" | "director";
  readonly selected: RepositoryCityInstance | null;
  readonly onMode: (mode: "live" | "director") => void;
  readonly onPlace: (assetId: RepositoryAssetId) => void;
  readonly onFocus?: ((id: string) => void) | undefined;
  readonly onPin?: ((id: string, pinned: boolean) => void) | undefined;
  readonly onRemove?: ((id: string) => void) | undefined;
  readonly onAskAgent?:
    ((instance: RepositoryCityInstance) => void) | undefined;
  readonly availableWorkstream?: Workstream | null | undefined;
  readonly onSelectWorkstream?: ((id: string) => void) | undefined;
  readonly projectName?: string | undefined;
  readonly agentName?: string | undefined;
  readonly onOpenWorkbench?: (() => void) | undefined;
  readonly onNewWorkstream?: (() => void) | undefined;
  readonly instances?: readonly RepositoryCityInstance[];
  readonly onSelectObject?: ((id: string) => void) | undefined;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const screens = useWorldScreens();
  const visible = useMemo(
    () =>
      REPOSITORY_ASSET_MANIFEST.filter(
        (asset) =>
          (category === "all" || asset.category === category) &&
          `${asset.label} ${asset.meaning}`
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
      ),
    [category, query],
  );
  const asset = selected ? REPOSITORY_ASSET_BY_ID.get(selected.assetId) : null;
  const work = availableWorkstream;
  return (
    <WorldScreen id="director">
      <aside
        className="repository-assets project-overview"
        aria-label="Project / Current Work"
      >
        <header>
          <strong>Project / Current Work</strong>
          <WorldScreenToggle id="director" />
        </header>
        <h2>{projectName}</h2>
        {work ? (
          <section aria-label="Project work summary">
            <h3>{work.title}</h3>
            <p>
              <strong>{work.status}</strong> · {agentName}
            </p>
            <p className="project-overview__branch">
              {work.authority?.authority.branch ?? "Branch unavailable"}
            </p>
            <p>{work.currentActivity}</p>
            <p>
              {work.changedFiles.length} changed files ·{" "}
              {work.validation.length
                ? `${work.validation.filter((check) => check.state === "passed").length} passed / ${work.validation.filter((check) => check.state === "failed").length} failed / ${work.validation.length} checks`
                : "No validation reported"}
            </p>
            <button
              type="button"
              className="world-action--enabled"
              disabled={!onSelectWorkstream}
              onClick={() => onSelectWorkstream?.(work.workstreamId)}
            >
              Open work details
            </button>
          </section>
        ) : (
          <p>No current Workstream. Open saved work or start a new task.</p>
        )}
        <div className="project-overview__actions">
          <button
            type="button"
            className="world-action--enabled"
            disabled={!onOpenWorkbench}
            onClick={onOpenWorkbench}
          >
            Open Workbench
          </button>
          <button
            type="button"
            className="world-action--enabled"
            disabled={!onNewWorkstream}
            onClick={onNewWorkstream}
          >
            New Workstream
          </button>
        </div>
        <button
          type="button"
          className="world-action--enabled"
          aria-expanded={mode === "director"}
          aria-controls="workspace-arrangement"
          onClick={() => {
            onMode(mode === "director" ? "live" : "director");
            setCatalogOpen(false);
          }}
        >
          {mode === "director" ? "Done arranging" : "Arrange workspace"}
        </button>
        {mode === "director" ? (
          <section id="workspace-arrangement" aria-label="Arrange workspace">
            <p>
              Live work keeps updating. Arrange screens using their bottom move
              strip; hold and scroll to rotate. Layout is local to this open
              World.
            </p>
            <div className="project-overview__actions">
              {(["workbench", "preview"] as const)
                .filter((id) =>
                  screens?.screens.some((screen) => screen.id === id),
                )
                .map((id) => (
                  <WorldScreenToggle key={id} id={id} />
                ))}
            </div>
            <label>
              Choose object to focus or pin
              <select
                aria-label="Arrange object"
                value={selected?.instanceId ?? ""}
                onChange={(event) =>
                  onSelectObject?.(event.currentTarget.value)
                }
              >
                <option value="">Choose an object</option>
                {instances.map((instance) => (
                  <option key={instance.instanceId} value={instance.instanceId}>
                    {instance.manual ? "Prop · " : ""}
                    {String(
                      instance.linkedRepoData?.label ??
                        REPOSITORY_ASSET_BY_ID.get(instance.assetId)?.label,
                    )}
                  </option>
                ))}
              </select>
            </label>
            {selected && asset ? (
              <section
                className="repository-asset-inspector"
                aria-label="Selected object details"
              >
                <h3>{String(selected.linkedRepoData?.label ?? asset.label)}</h3>
                <p>
                  {selected.manual
                    ? "Visual-only prop · no linked repository item. Does not create files, run tests, or deploy."
                    : `${selected.linkedRepoData?.kind ?? "Activity"} · ${selected.linkedRepoData?.path ?? "Current World activity"}`}
                </p>
                <p>{asset.meaning}</p>
                <div className="project-overview__actions">
                  <button
                    type="button"
                    className="world-action--enabled"
                    onClick={() => onFocus?.(selected.instanceId)}
                  >
                    Focus
                  </button>
                  <button
                    type="button"
                    className="world-action--enabled"
                    onClick={() =>
                      onPin?.(selected.instanceId, !selected.pinned)
                    }
                  >
                    {selected.pinned ? "Unpin" : "Pin"}
                  </button>
                  {selected.manual ? (
                    <>
                      <button
                        type="button"
                        className="world-action--enabled"
                        onClick={() => onRemove?.(selected.instanceId)}
                      >
                        Remove prop
                      </button>
                      <button
                        type="button"
                        className="world-action--enabled"
                        onClick={() => onAskAgent?.(selected)}
                      >
                        Explain visual metaphor
                      </button>
                    </>
                  ) : null}
                </div>
              </section>
            ) : null}
            <details
              onToggle={(event) => setCatalogOpen(event.currentTarget.open)}
            >
              <summary>Visual-only props</summary>
              <p>
                Optional decoration, not work commands. Drag to the floor or use
                Place prop.
              </p>
              {catalogOpen ? (
                <>
                  <label>
                    Search assets
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.currentTarget.value)}
                    />
                  </label>
                  <label>
                    Category
                    <select
                      value={category}
                      onChange={(event) =>
                        setCategory(event.currentTarget.value)
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
                  <ul className="repository-assets__grid">
                    {visible.map((item) => (
                      <li key={item.id}>
                        <article
                          className="repository-assets__card"
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData(
                              "application/x-aiw-repository-asset",
                              item.id,
                            );
                            event.dataTransfer.effectAllowed = "copy";
                          }}
                        >
                          <img
                            className="repository-assets__thumbnail"
                            src={item.thumbnailUrl}
                            alt=""
                            loading="lazy"
                          />
                          <strong>{item.label}</strong>
                          <small>Visual-only prop</small>
                          <button
                            type="button"
                            className="world-action--enabled"
                            onClick={() => onPlace(item.id)}
                          >
                            Place prop
                          </button>
                        </article>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </details>
          </section>
        ) : null}
      </aside>
    </WorldScreen>
  );
}
