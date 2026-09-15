import { WorkInspector } from "./WorkInspector.js";
import type {
  Workstream,
  WorkstreamTracerSource,
} from "./workstream-tracer.js";

/** Retained explicit query-gated tracer; never part of the normal overview. */
export function WorkstreamTracerPanel({
  source,
  workstream,
  selected,
  message,
  onInspect,
  onCreate,
  onCancel,
  pending,
  unavailable,
}: {
  readonly source: WorkstreamTracerSource;
  readonly workstream: Workstream | null;
  readonly selected: Workstream | null;
  readonly message: string | null;
  readonly onInspect: () => void;
  readonly onCreate: () => void;
  readonly onCancel: () => void;
  readonly pending: boolean;
  readonly unavailable: string | null;
}) {
  return (
    <aside className="world-workstream-status" aria-label="Workbench tracer">
      <strong>
        {source === "live"
          ? "Authoritative Workbench · current local Workstream"
          : source === "phase14"
            ? "Phase 14 diagnostic tracer · read-only"
            : "Workbench tracer · demo fixture"}
      </strong>
      {message ? <p role="status">{message}</p> : null}
      {workstream ? (
        <button
          type="button"
          className="world-action--enabled"
          onClick={onInspect}
        >
          {selected
            ? "Work Inspector open"
            : source === "live"
              ? "Inspect current Workstream"
              : source === "phase14"
                ? "Inspect current Phase 14 workstream"
                : "Inspect demo workstream"}
        </button>
      ) : source === "live" ? (
        <>
          <button
            type="button"
            disabled={pending || !!unavailable}
            onClick={onCreate}
          >
            Create Workstream
          </button>
          {unavailable ? <p>{unavailable}</p> : null}
        </>
      ) : null}
      {selected ? (
        <WorkInspector
          workstream={selected}
          source={source}
          onCancel={source === "live" ? onCancel : undefined}
          actionPending={pending}
        />
      ) : null}
    </aside>
  );
}
