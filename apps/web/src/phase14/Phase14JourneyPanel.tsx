import { useEffect, useMemo, useState } from "react";

import {
  Phase14Client,
  type Phase14Action,
  type Phase14JourneyState,
} from "./phase14-client.js";

const emptyState: Phase14JourneyState = {
  operationId: null,
  createdAt: null,
  updatedAt: null,
  status: "idle",
  step: 0,
  session: null,
  disposable: null,
  events: [],
  explanation: null,
  edit: null,
  approval: null,
  test: null,
  preview: null,
  evidenceRefs: [],
};

const currentSource =
  'export const greeting = "Hello from the approved Phase 14 edit.";';
const previousSource =
  'export const greeting = "Hello from the Phase 14 fixture.";';

// Storybook and browser-only fixture state; it has no runtime authority.
// eslint-disable-next-line react-refresh/only-export-components
export const PHASE14_JOURNEY_FIXTURE: Phase14JourneyState = {
  operationId: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-07-22T12:00:00.000Z",
  updatedAt: "2026-07-22T12:10:00.000Z",
  status: "completed",
  step: 10,
  session: {
    adapterSessionRef: "phase14-hermes-fixture-session",
    continuity: "fixture-existing",
  },
  disposable: {
    repositoryId: "aiw://object/repository-phase14-magic-slice",
    fixtureRevision: "phase14-magic-slice/1",
    target: "src/greeting.mjs",
    symbol: "greeting",
  },
  events: [
    {
      eventId: "22222222-2222-4222-8222-222222222222",
      operation: "preview",
      state: "succeeded",
      sequence: 20,
      occurredAt: "2026-07-22T12:09:00.000Z",
    },
  ],
  explanation: {
    continuity: { state: "current", reason: null },
    claims: {
      sourceFacts: [
        { label: "source-fact", text: "The module exports greeting." },
      ],
      runtimeObservations: [
        {
          label: "runtime-observation",
          text: "World found one exact symbol occurrence.",
        },
      ],
      testResults: [
        { label: "test-result", text: "The focused Node test passed." },
      ],
      interpretations: [
        {
          label: "interpretation",
          text: "The preview renders the exported value.",
        },
      ],
    },
  },
  edit: {
    outcome: "applied",
    diff: `--- previous/src/greeting.mjs\n+++ current/src/greeting.mjs\n@@ -1,1 +1,1 @@\n-${previousSource}\n+${currentSource}\n`,
    patchDigest: "3".repeat(64),
    previousHash: "8".repeat(64),
    currentHash: "a".repeat(64),
    previousEvidenceRef: "aiw://evidence/phase14-fixture-diff-previous",
    currentEvidenceRef: "aiw://evidence/phase14-fixture-diff-current",
    error: null,
  },
  approval: {
    approvalId: "33333333-3333-4333-8333-333333333333",
    expiresAt: "2026-07-22T12:05:00.000Z",
    used: true,
    revoked: false,
  },
  test: {
    state: "succeeded",
    argv: ["/usr/bin/node", "--test", "test/greeting.test.mjs"],
    stdout: "# pass 1",
    stderr: "",
    stdoutTruncated: false,
    stderrTruncated: false,
    exitCode: 0,
    signal: null,
    timedOut: false,
    startedAt: "2026-07-22T12:07:00.000Z",
    finishedAt: "2026-07-22T12:08:00.000Z",
    evidenceRef: "aiw://evidence/phase14-fixture-test-result",
  },
  preview: {
    state: "stopped",
    url: "http://127.0.0.1:43114/",
    health: { ok: true, schema: "aiw.phase14-preview/1" },
    logs: '{"schema":"aiw.phase14-preview-ready/1","port":43114}',
    logsTruncated: false,
    portClosed: true,
    evidenceRef: "aiw://evidence/phase14-fixture-preview-health",
  },
  evidenceRefs: [
    "aiw://evidence/phase14-fixture-source-current",
    "aiw://evidence/phase14-fixture-diff-current",
    "aiw://evidence/phase14-fixture-test-result",
    "aiw://evidence/phase14-fixture-preview-health",
  ],
};

const steps = [
  "Attach fixture session",
  "Read and search greeting",
  "Show revision-bound explanation",
  "Preview exact replacement",
  "Approve once",
  "Apply atomically",
  "Show current vs previous diff",
  "Run focused test",
  "Verify loopback preview",
  "Stop, clean, correlate",
] as const;

function enabled(state: Phase14JourneyState, action: Phase14Action): boolean {
  if (action === "create")
    return state.operationId === null || state.status !== "active";
  if (!state.operationId || state.status !== "active") return false;
  if (action === "inspect") return state.step === 1;
  if (action === "prepare-edit") return state.step === 3;
  if (action === "approve") return state.step === 4;
  if (action === "revoke")
    return state.step === 5 && Boolean(state.approval && !state.approval.used);
  if (action === "apply") return state.step === 5;
  if (action === "test") return state.step === 7;
  if (action === "start-preview") return state.step === 8;
  if (action === "stop-preview") return state.preview?.state === "ready";
  return state.step > 0 && state.step < 10;
}

const controls: readonly { action: Phase14Action; label: string }[] = [
  { action: "create", label: "Attach fixture session" },
  { action: "inspect", label: "Read and explain" },
  { action: "prepare-edit", label: "Preview exact edit" },
  { action: "approve", label: "Approve once" },
  { action: "revoke", label: "Revoke approval" },
  { action: "apply", label: "Apply edit" },
  { action: "test", label: "Run focused test" },
  { action: "start-preview", label: "Start loopback preview" },
  { action: "stop-preview", label: "Stop preview" },
  { action: "cancel", label: "Cancel operation" },
];

export function Phase14JourneyExperience({
  state,
  busy = false,
  message = "Authoritative event state is shown below.",
  onAction,
}: {
  readonly state: Phase14JourneyState;
  readonly busy?: boolean;
  readonly message?: string;
  readonly onAction: (action: Phase14Action) => void;
}) {
  const claims = state.explanation
    ? [
        ...state.explanation.claims.sourceFacts,
        ...state.explanation.claims.runtimeObservations,
        ...state.explanation.claims.testResults,
        ...state.explanation.claims.interpretations,
      ]
    : [];
  return (
    <section className="phase14-journey" aria-labelledby="phase14-title">
      <header>
        <span className="terminal-kicker">phase14_developer_journey_</span>
        <h2 id="phase14-title">Approved edit, test, and local preview</h2>
        <p>
          Exact fixture only. Phase 12 chat stays independently usable if this
          lane fails; World movement is presentation only.
        </p>
      </header>

      <ol className="phase14-steps" aria-label="Phase 14 numbered journey">
        {steps.map((label, index) => {
          const number = index + 1;
          const complete = state.step >= number;
          return (
            <li
              key={label}
              className="phase14-step__item"
              data-state={
                complete
                  ? "complete"
                  : number === state.step + 1
                    ? "current"
                    : "pending"
              }
              aria-current={number === state.step + 1 ? "step" : undefined}
            >
              {number}. {label}
            </li>
          );
        })}
      </ol>

      <section className="phase14-actions" aria-label="Phase 14 actions">
        <h3>Actions</h3>
        <div className="phase14-action-grid">
          {controls.map(({ action, label }) => (
            <button
              key={action}
              type="button"
              className="phase14-primary"
              disabled={busy || !enabled(state, action)}
              onClick={() => onAction(action)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section
        className="phase14-status"
        aria-label="Phase 14 authoritative status"
      >
        <h3>Authoritative event state</h3>
        <p role="status" aria-live="polite">
          {busy ? "Operation running…" : message}
        </p>
        <dl>
          <div>
            <dt>Status</dt>
            <dd>{state.status}</dd>
          </div>
          <div>
            <dt>Fixture session</dt>
            <dd>{state.session?.adapterSessionRef ?? "not attached"}</dd>
          </div>
          <div>
            <dt>Repository revision</dt>
            <dd>{state.disposable?.fixtureRevision ?? "not attested"}</dd>
          </div>
          <div>
            <dt>Latest event</dt>
            <dd>
              {state.events.at(-1)
                ? `${state.events.at(-1)?.operation} · ${state.events.at(-1)?.state}`
                : "none"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="phase14-evidence" aria-label="Phase 14 evidence">
        <h3>Evidence</h3>
        <p>
          File <code>{state.disposable?.target ?? "src/greeting.mjs"}</code> ·
          symbol <code>{state.disposable?.symbol ?? "greeting"}</code>
        </p>
        {claims.length > 0 && (
          <ul className="phase14-claims">
            {claims.map((claim, index) => (
              <li key={`${claim.label}-${index}`}>
                <strong>{claim.label}</strong> {claim.text}
              </li>
            ))}
          </ul>
        )}
        {state.edit && (
          <div className="phase14-diff-grid">
            <article>
              <h4>Previous source</h4>
              <pre>{previousSource}</pre>
              <small>{state.edit.previousHash}</small>
            </article>
            <article>
              <h4>Current source</h4>
              <pre>
                {state.edit.currentHash ? currentSource : "Not applied"}
              </pre>
              <small>{state.edit.currentHash ?? state.edit.outcome}</small>
            </article>
            <details>
              <summary>Exact unified diff</summary>
              <pre>{state.edit.diff}</pre>
            </details>
          </div>
        )}
        {state.test && (
          <article className="phase14-process-result">
            <h4>Focused test · {state.test.state}</h4>
            <code>node --test test/greeting.test.mjs</code>
            <p>
              Exit {String(state.test.exitCode)} · signal{" "}
              {state.test.signal ?? "none"} · timeout{" "}
              {String(state.test.timedOut)}
            </p>
            <pre>
              {state.test.stdout || state.test.stderr || "No retained output"}
            </pre>
          </article>
        )}
        {state.preview && (
          <article className="phase14-process-result">
            <h4>Loopback preview · {state.preview.state}</h4>
            {state.preview.url && (
              <a href={state.preview.url}>{state.preview.url}</a>
            )}
            <p>
              Health {state.preview.health?.schema ?? "unavailable"} · port
              closed {String(state.preview.portClosed)}
            </p>
          </article>
        )}
        {state.evidenceRefs.length > 0 && (
          <ul
            className="phase14-correlations"
            aria-label="Final correlated evidence"
          >
            {state.evidenceRefs.map((reference) => (
              <li key={reference}>{reference}</li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

export function Phase14JourneyPanel({
  fixtureState,
}: {
  readonly fixtureState?: Phase14JourneyState;
}) {
  const queryFixture =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("fixture") ===
      "phase14-journey"
      ? PHASE14_JOURNEY_FIXTURE
      : undefined;
  const resolvedFixture = fixtureState ?? queryFixture;
  const client = useMemo(() => new Phase14Client(), []);
  const [state, setState] = useState<Phase14JourneyState>(
    resolvedFixture ?? emptyState,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    resolvedFixture
      ? "Fixture shows the complete correlated journey."
      : "Create the disposable fixture journey to begin.",
  );

  useEffect(() => {
    if (resolvedFixture) return;
    let active = true;
    client
      .current<Phase14JourneyState>()
      .then((current) => {
        if (active) {
          setState(current);
          setMessage("Recovered current/previous Phase 14 truth.");
        }
      })
      .catch(() => {
        if (active)
          setMessage(
            "Phase 14 lane is ready for setup; existing Phase 12 chat remains available.",
          );
      });
    return () => {
      active = false;
    };
  }, [client, resolvedFixture]);

  const act = async (action: Phase14Action) => {
    if (resolvedFixture) return;
    setBusy(true);
    try {
      const result =
        action === "create"
          ? await client.create<Phase14JourneyState>()
          : await client.action<unknown>(action, state.operationId as string, {
              ...(state.edit ? { patchDigest: state.edit.patchDigest } : {}),
              ...(state.approval
                ? { approvalId: state.approval.approvalId }
                : {}),
            });
      const next =
        action === "create"
          ? (result as Phase14JourneyState)
          : await client.get<Phase14JourneyState>(state.operationId as string);
      setState(next);
      setMessage(`${action} completed with authoritative server evidence.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `${error.message}. Phase 12 chat remains independently usable.`
          : "Phase 14 action failed; Phase 12 chat remains independently usable.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Phase14JourneyExperience
      state={state}
      busy={busy}
      message={message}
      onAction={(action) => void act(action)}
    />
  );
}
