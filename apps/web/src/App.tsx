import { APP_METADATA } from "@agentintersect-world/config";
import type { OperationRecord } from "@agentintersect-world/world-schema";
import { useEffect, useState } from "react";

import {
  cancelOperation,
  getOperation,
  loadAuthority,
  startDemoOperation,
  type AuthorityLoadResult,
} from "./health-client.js";

const foundations = [
  ["Workspace", "pnpm 11 + Turborepo"],
  ["Runtime", "Node 24 + Fastify"],
  ["Interface", "React 19 + Vite"],
] as const;

type AuthorityState = { status: "loading" } | AuthorityLoadResult;

function OperationDetails({
  operation,
  testId,
}: {
  readonly operation: OperationRecord | null;
  readonly testId: string;
}) {
  return (
    <div className="operation-record" data-testid={testId}>
      {operation === null ? (
        <p>None yet</p>
      ) : (
        <>
          <strong
            className={`operation-status operation-status--${operation.status}`}
          >
            {operation.status}
          </strong>
          <span>{operation.label ?? "Unlabelled demo"}</span>
          <p>{operation.result}</p>
          <code>{operation.id}</code>
        </>
      )}
    </div>
  );
}

export function App() {
  const [authority, setAuthority] = useState<AuthorityState>({
    status: "loading",
  });
  const [current, setCurrent] = useState<OperationRecord | null>(null);
  const [previous, setPrevious] = useState<OperationRecord | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let active = true;
    void loadAuthority().then((result) => {
      if (active) setAuthority(result);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (current?.status !== "running") return;
    let active = true;
    let attempts = 0;
    const operationId = current.id;
    const configuredMaximum =
      authority.status === "ready"
        ? authority.ready.config.demoOperationMaxMs
        : 5_000;
    const maximumAttempts = Math.ceil(configuredMaximum / 250) + 20;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      attempts += 1;
      const result = await getOperation(operationId);
      if (!active) return;
      if (result.status === "ok") {
        setCurrent(result.data);
        if (result.data.status !== "running") return;
      } else {
        setActionMessage(result.message);
        return;
      }
      if (attempts >= maximumAttempts) {
        setActionMessage("Operation status polling reached its bounded limit");
        return;
      }
      timer = setTimeout(() => void poll(), 250);
    };
    timer = setTimeout(() => void poll(), 250);
    return () => {
      active = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [current?.id, current?.status, authority]);

  const canStart =
    authority.status === "ready" && current?.status !== "running" && !starting;
  const canCancel = current?.status === "running" && !cancelling;

  const start = async () => {
    if (!canStart || authority.status !== "ready") return;
    setStarting(true);
    setActionMessage(null);
    if (current !== null) setPrevious(current);
    const durationMs = Math.min(
      1_200,
      authority.ready.config.demoOperationMaxMs,
    );
    const result = await startDemoOperation(
      durationMs,
      "Operator demo",
      `operator-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    if (result.status === "ok") setCurrent(result.data);
    else setActionMessage(result.message);
    setStarting(false);
  };

  const cancel = async () => {
    if (!canCancel || current === null) return;
    setCancelling(true);
    setActionMessage(null);
    const result = await cancelOperation(current.id);
    if (result.status === "ok") setCurrent(result.data);
    else setActionMessage(result.message);
    setCancelling(false);
  };

  return (
    <main>
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />
      <header className="topbar">
        <a
          className="wordmark"
          href="#authority"
          aria-label="AgentIntersect World home"
        >
          <span className="wordmark-mark" aria-hidden="true">
            AI
          </span>
          <span>AgentIntersect World</span>
        </a>
        <span className="phase-pill">Local authority</span>
      </header>

      <section className="hero" id="authority">
        <div className="eyebrow">Phase 2 · Local authority</div>
        <h1>AgentIntersect World</h1>
        <p className="lede">
          Inspect the local authority, run one bounded demo operation, cancel
          it, and review the result without leaving this trusted local/LAN
          session.
        </p>

        <section
          className={`server-status server-status--${authority.status === "ready" ? "healthy" : authority.status}`}
          role="status"
          aria-live="polite"
        >
          <span className="status-dot" aria-hidden="true" />
          <div>
            {authority.status === "loading" && (
              <strong>Checking local server…</strong>
            )}
            {authority.status === "ready" && (
              <>
                <strong>Local server healthy</strong>
                <span>
                  Node {authority.ready.runtime.version.replace(/^v/, "")} ·{" "}
                  {authority.ready.version}
                </span>
                <span>
                  Network scope: {authority.ready.config.networkScope}
                </span>
                <span>
                  {authority.ready.config.instanceName} ·{" "}
                  {authority.ready.config.host}:{authority.ready.config.port} ·
                  demo limit {authority.ready.config.demoOperationMaxMs} ms
                </span>
              </>
            )}
            {authority.status === "unavailable" && (
              <>
                <strong>{authority.message}</strong>
                <span>Start the local server with pnpm dev, then refresh.</span>
              </>
            )}
            {authority.status === "error" && (
              <>
                <strong>Local server response error</strong>
                <span>{authority.message}</span>
              </>
            )}
          </div>
        </section>

        <div className="operator-flow" aria-label="Demo operation controls">
          <section className="operator-step">
            <span className="card-number">01</span>
            <h2>Step 1 — Start demo operation</h2>
            <p>Start a bounded in-memory delay owned by this local server.</p>
            <button
              type="button"
              onClick={() => void start()}
              disabled={!canStart}
            >
              {starting ? "Starting…" : "Start demo operation"}
            </button>
          </section>

          <section className="operator-step">
            <span className="card-number">02</span>
            <h2>Step 2 — Cancel current operation</h2>
            <p>
              Cancellation is safe to repeat while reviewing the same record.
            </p>
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={!canCancel}
            >
              {cancelling ? "Cancelling…" : "Cancel current operation"}
            </button>
          </section>

          <section className="operator-step operator-step--review">
            <span className="card-number">03</span>
            <h2>Step 3 — Review result</h2>
            {actionMessage !== null && (
              <p className="action-error" role="alert">
                {actionMessage}
              </p>
            )}
            <div className="review-grid">
              <article>
                <h3>Current operation</h3>
                <OperationDetails
                  operation={current}
                  testId="current-operation"
                />
              </article>
              <article>
                <h3>Previous operation</h3>
                <OperationDetails
                  operation={previous}
                  testId="previous-operation"
                />
              </article>
            </div>
          </section>
        </div>

        <div className="foundation-grid" aria-label="Foundation technologies">
          {foundations.map(([label, value], index) => (
            <article key={label}>
              <span className="card-number">0{index + 1}</span>
              <h2>{label}</h2>
              <p>{value}</p>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <span>{APP_METADATA.version}</span>
        <span>Local / trusted LAN</span>
      </footer>
    </main>
  );
}
