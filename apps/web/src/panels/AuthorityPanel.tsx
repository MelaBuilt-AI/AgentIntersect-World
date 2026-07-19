import type { OperationRecord } from "@agentintersect-world/world-schema";
import { useEffect, useState } from "react";

import type { AuthorityState } from "../authority/use-authority.js";
import {
  cancelOperation,
  getOperation,
  listOperations,
  startDemoOperation,
} from "../health-client.js";
import { recoverActiveOrRecent } from "./operation-recovery.js";

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

export function AuthorityPanel({
  authority,
}: {
  readonly authority: AuthorityState;
}) {
  const [current, setCurrent] = useState<OperationRecord | null>(null);
  const [previous, setPrevious] = useState<OperationRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rehydrating, setRehydrating] = useState(true);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let active = true;
    void listOperations().then((result) => {
      if (!active) return;
      if (result.status === "ok") {
        const recovered = recoverActiveOrRecent(result.data.operations);
        setCurrent(recovered);
        setPrevious(
          result.data.operations.find((item) => item.id !== recovered?.id) ??
            null,
        );
      } else {
        setMessage(result.message);
      }
      setRehydrating(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (current?.status !== "running") return;
    let active = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const operationId = current.id;
    const maximum =
      authority.status === "ready"
        ? Math.ceil(authority.ready.config.demoOperationMaxMs / 250) + 20
        : 40;
    const poll = async () => {
      attempts += 1;
      const result = await getOperation(operationId);
      if (!active) return;
      if (result.status !== "ok") {
        setMessage(result.message);
        return;
      }
      setCurrent(result.data);
      if (result.data.status === "running" && attempts < maximum)
        timer = setTimeout(() => void poll(), 250);
    };
    timer = setTimeout(() => void poll(), 250);
    return () => {
      active = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [authority, current?.id, current?.status]);

  const canStart =
    authority.status === "ready" &&
    current?.status !== "running" &&
    !rehydrating &&
    !starting;
  const canCancel = current?.status === "running" && !cancelling;
  const start = async () => {
    if (!canStart || authority.status !== "ready") return;
    setStarting(true);
    setMessage(null);
    if (current !== null) setPrevious(current);
    const result = await startDemoOperation(
      Math.min(1_200, authority.ready.config.demoOperationMaxMs),
      "Operator demo",
      `operator-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    if (result.status === "ok") setCurrent(result.data);
    else setMessage(result.message);
    setStarting(false);
  };
  const cancel = async () => {
    if (!canCancel || current === null) return;
    setCancelling(true);
    setMessage(null);
    const result = await cancelOperation(current.id);
    if (result.status === "ok") setCurrent(result.data);
    else setMessage(result.message);
    setCancelling(false);
  };
  return (
    <section className="panel-content" aria-labelledby="authority-panel-title">
      <header className="panel-heading">
        <span>Phase 2 authority demo</span>
        <h2 id="authority-panel-title">Local authority</h2>
        <p>Run and review the existing bounded local demo operation.</p>
      </header>
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
              <span>Network scope: {authority.ready.config.networkScope}</span>
            </>
          )}
          {authority.status === "unavailable" && (
            <strong>{authority.message}</strong>
          )}
          {authority.status === "error" && <strong>{authority.message}</strong>}
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
          <p>Cancellation is safe to repeat while reviewing the same record.</p>
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
          {message !== null && <p role="alert">{message}</p>}
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
    </section>
  );
}
