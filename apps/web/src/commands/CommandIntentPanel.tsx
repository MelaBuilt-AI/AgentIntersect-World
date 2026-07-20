import type {
  CommandIntentRecord,
  CommandIntentRequest,
} from "@agentintersect-world/world-schema";
import { useEffect, useMemo, useState } from "react";

import type { HarnessReadiness } from "../integration/types.js";
import {
  createCommandIntent,
  getCommandIntent,
  listCommandIntents,
} from "./command-client.js";

const TERMINAL_LIFECYCLES = new Set(["complete", "failed"]);

export function CommandIntentPanel({
  harness,
  readiness,
  phaseId,
  commandsEnabled,
  fixtureMode = false,
}: {
  readonly harness: CommandIntentRequest["harness"];
  readonly readiness: HarnessReadiness | null;
  readonly phaseId: string | null;
  readonly commandsEnabled: boolean;
  readonly fixtureMode?: boolean;
}) {
  const [token, setToken] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [expectedRevision, setExpectedRevision] = useState("");
  const [current, setCurrent] = useState<CommandIntentRecord | null>(null);
  const [previous, setPrevious] = useState<CommandIntentRecord | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState(
    "No Phase 7 command intent has been submitted in this view.",
  );
  const [submitting, setSubmitting] = useState(false);
  const ready =
    commandsEnabled && readiness?.status === "ready" && phaseId === "phase_7";
  const valid =
    ready &&
    /^[\x20-\x7e]{1,128}$/.test(idempotencyKey) &&
    /^[\x20-\x7e]{1,128}$/.test(expectedRevision) &&
    token.length > 0 &&
    token.length <= 256 &&
    /^[\x20-\x7e]+$/.test(token);
  const request = useMemo<CommandIntentRequest | null>(
    () =>
      phaseId === "phase_7" && /^[\x20-\x7e]{1,128}$/.test(expectedRevision)
        ? {
            schema: "aiw.command-intent.request/0.7",
            kind: "worker.enqueue-phase",
            phaseId,
            harness,
            expectedRevision,
            fixture: "phase7-disposable-artifact-v1",
          }
        : null,
    [expectedRevision, harness, phaseId],
  );

  useEffect(() => {
    let active = true;
    void listCommandIntents().then((result) => {
      if (!active || result.status !== "ok") return;
      const latest = result.data.intents.at(-1);
      if (!latest) return;
      setCurrent(latest);
      setMessage(
        `Restored durable intent ${latest.id} at ${latest.lifecycle ?? latest.state}.`,
      );
      if (
        latest.state === "confirmed" &&
        !TERMINAL_LIFECYCLES.has(latest.lifecycle ?? "")
      )
        setActiveId(latest.id);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let active = true;
    const refresh = async () => {
      const result = await getCommandIntent(activeId);
      if (!active || result.status !== "ok") return;
      setCurrent((prior) => {
        if (
          prior &&
          (prior.lifecycle !== result.data.lifecycle ||
            prior.state !== result.data.state)
        )
          setPrevious(prior);
        return result.data;
      });
      if (
        result.data.lifecycle &&
        TERMINAL_LIFECYCLES.has(result.data.lifecycle)
      ) {
        setActiveId(null);
        setMessage(
          `Exact job ${result.data.jobId ?? "unmapped"} reached ${result.data.lifecycle}.`,
        );
      }
    };
    void refresh();
    const timer = window.setInterval(
      () => void refresh(),
      fixtureMode ? 150 : 2_000,
    );
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeId, fixtureMode]);

  const submit = async () => {
    if (!valid || !request || submitting) return;
    setSubmitting(true);
    const secret = token;
    setToken("");
    const result = await createCommandIntent(secret, idempotencyKey, request);
    setSubmitting(false);
    if (result.status !== "ok") {
      setMessage(result.message);
      return;
    }
    setPrevious(current);
    setCurrent(result.data);
    setMessage(
      result.data.state === "ambiguous"
        ? "Create response is ambiguous. World will reconcile read-only and will not resend."
        : `Intent ${result.data.id} recorded as ${result.data.state}.`,
    );
    if (
      result.data.state === "confirmed" &&
      !TERMINAL_LIFECYCLES.has(result.data.lifecycle ?? "")
    )
      setActiveId(result.data.id);
  };

  return (
    <section
      className="command-intent-panel"
      data-testid="phase7-command-panel"
    >
      <header className="command-intent-panel__header">
        <div>
          <span className="terminal-kicker">phase7_command_intent_</span>
          <h2>One bounded AgentIntersect worker action</h2>
        </div>
        <span
          className={`integration-status integration-status--${ready ? "ready" : "disabled"}`}
        >
          {ready ? "available" : "disabled"}
        </span>
      </header>
      <p className="truthful-copy">
        World may submit one fixture job. AgentIntersect alone claims, executes,
        and completes it. Transport uncertainty is never retried.
      </p>

      <div className="command-flow">
        <section>
          <h3>1. Command authority</h3>
          <label>
            Dedicated command token
            <input
              type="password"
              value={token}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setToken(event.target.value)}
              disabled={!commandsEnabled}
            />
          </label>
          <p>
            The token is held only in component memory and cleared on submit.
          </p>
        </section>

        <section>
          <h3>2. Validate bounded intent</h3>
          <label>
            Idempotency key
            <input
              value={idempotencyKey}
              maxLength={128}
              onChange={(event) => setIdempotencyKey(event.target.value)}
            />
          </label>
          <label>
            Expected revision
            <input
              value={expectedRevision}
              maxLength={128}
              onChange={(event) => setExpectedRevision(event.target.value)}
            />
          </label>
          <dl>
            <dt>Phase</dt>
            <dd>{phaseId ?? "unavailable"}</dd>
            <dt>Selected harness</dt>
            <dd>{harness}</dd>
            <dt>Dispatch policy</dt>
            <dd>one attempt · no automatic resend</dd>
            <dt>Requested limits</dt>
            <dd>10 minutes · 80k model tokens / $1.00 where enforceable</dd>
          </dl>
          <button
            className="command-action"
            type="button"
            disabled={!valid || submitting}
            onClick={() => void submit()}
          >
            {submitting
              ? "Submitting one attempt…"
              : "Enqueue bounded Phase 7 job"}
          </button>
          <p role="status" aria-live="polite">
            {message}
          </p>
        </section>

        <section>
          <h3>3. Current and previous status</h3>
          {current ? (
            <dl className="command-identifiers">
              <dt>Intent state</dt>
              <dd>{current.state}</dd>
              <dt>Lifecycle</dt>
              <dd>{current.lifecycle ?? "awaiting mapping"}</dd>
              <dt>Intent ID</dt>
              <dd>{current.id}</dd>
              <dt>Session ID</dt>
              <dd>{current.sessionId ?? "unavailable"}</dd>
              <dt>Job ID</dt>
              <dd>{current.jobId ?? "unavailable"}</dd>
              <dt>Run ID</dt>
              <dd>{current.runId ?? "unavailable"}</dd>
            </dl>
          ) : (
            <p>No current intent.</p>
          )}
          <p>
            Previous status: {previous?.lifecycle ?? previous?.state ?? "none"}
          </p>
          <div role="group" aria-label="Command diagnostics">
            {current?.diagnostics.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
          <button type="button" disabled>
            Claim or execute job
          </button>
        </section>

        <section>
          <h3>4. Fixture-only result</h3>
          <p>
            <strong>phase7-result.json</strong>
          </p>
          <div className="fixture-result-grid">
            <div>
              <span>Before</span>
              <pre>No artifact</pre>
            </div>
            <div>
              <span>After</span>
              <pre>
                {current?.artifact
                  ? JSON.stringify(current.artifact.after, null, 2)
                  : "Awaiting exact fixture evidence"}
              </pre>
            </div>
          </div>
          <p>Verification: {current?.artifact?.verification ?? "pending"}</p>
          <p>
            Result:{" "}
            {current?.result
              ? JSON.stringify(current.result)
              : current?.lifecycle === "complete"
                ? "No separate result payload; the fixture evidence above is authoritative."
                : "pending"}
          </p>
        </section>
      </div>
    </section>
  );
}
