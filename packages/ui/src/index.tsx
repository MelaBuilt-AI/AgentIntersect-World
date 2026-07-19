import type { HealthResponse } from "@agentintersect-world/world-schema";

export type ServerHealthState =
  | { status: "loading" }
  | { status: "healthy"; health: HealthResponse }
  | { status: "unavailable"; message: string };

export function ServerStatus({ state }: { readonly state: ServerHealthState }) {
  if (state.status === "loading") {
    return (
      <section
        className="server-status server-status--loading"
        role="status"
        aria-live="polite"
      >
        <span className="status-dot" aria-hidden="true" />
        <div>
          <strong>Checking local server…</strong>
          <span>Connecting on this machine</span>
        </div>
      </section>
    );
  }

  if (state.status === "unavailable") {
    return (
      <section
        className="server-status server-status--unavailable"
        role="status"
        aria-live="polite"
      >
        <span className="status-dot" aria-hidden="true" />
        <div>
          <strong>{state.message}</strong>
          <span>
            Start the local server with pnpm dev, then refresh this page.
          </span>
        </div>
      </section>
    );
  }

  const nodeVersion = state.health.runtime.version.replace(/^v/, "");
  return (
    <section
      className="server-status server-status--healthy"
      role="status"
      aria-live="polite"
    >
      <span className="status-dot" aria-hidden="true" />
      <div>
        <strong>Local server healthy</strong>
        <span>
          Node {nodeVersion} · {state.health.version}
        </span>
      </div>
    </section>
  );
}
