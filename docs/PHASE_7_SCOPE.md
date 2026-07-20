# AgentIntersect World — Phase 7 Frozen Scope

Date prepared: 2026-07-19
Status: **COMPLETE — implemented and independently verified on 2026-07-20**
Dependency: Phase 6 read integration and normalized replay
Runtime: Node `v24.18.0`, pnpm `11.15.0`

## Objective

Enqueue one real bounded AgentIntersect `phase_run` job through a validated host-local intent and observe its exact lifecycle end to end without AgentIntersect World spawning a harness or submitting completion itself.

## Why this phase exists

Phase 6 proved truthful read-only health, state, snapshot, feed, SSE, persistence, replay, and readiness projection. Phase 7 is the first command-authority slice and the decisive “real agent” proof. It must remain one narrow mutation path rather than expanding into a general control plane.

## Supported environment and trust model

- One operator using their own World and AgentIntersect instances on the same computer or trusted LAN.
- Loopback and explicitly configured trusted-LAN clients may submit intents. Command submission requires a dedicated bearer/token secret that is never returned by safe config, persisted in browser storage, or written to durable evidence.
- LAN scope must remain an explicit `AIW_NETWORK_SCOPE=lan` opt-in; public ingress and unrelated clients remain out of scope.
- The unchanged AgentIntersect daemon owns queueing, claim, execution, and completion.
- World owns intent validation, idempotency/reconciliation, truthful lifecycle projection, and operator-visible diagnostics.
- AgentIntersect responses, process identity, phase/revision state, and timing remain untrusted until attested and validated.

## Proposed in-scope vertical slice

1. A `worker.enqueue-phase` intent submitted to the World server from loopback or an explicitly authorized trusted-LAN client.
2. Selection of the Phase 5 default/current harness or an explicitly selected owned-agent harness origin.
3. Validation of phase, harness, expected revision, readiness, and fresh AgentIntersect authority.
4. A durable minimal intent state machine: `pending` → `confirmed` | `ambiguous` | `rejected` | `failed`, with immutable intent identity and request fingerprint before the external mutation.
5. AgentIntersect daemon attestation immediately before `POST /v1/worker/jobs`.
6. One bounded `phase_run` job creation request.
7. One same-intent resend after a short delay only if the pinned AgentIntersect create contract proves that intent key is idempotent. The current Phase 0 contract does not prove this, so unsupported/uncertain creates remain `ambiguous` and are not resent.
8. Mapping of intent, correlation, phase, session, job, and run identifiers.
9. Truthful queued, claimed, running, complete, and failed lifecycle observation through the Phase 6 read path.
10. A visible run-detail/operator result that identifies the exact job and whether creation is confirmed, rejected, ambiguous, or failed.
11. A fixture-only minimal file/result view showing the expected text/JSON artifact change and tiny offline verification result; no generalized repository diff engine or construction visualization.
12. One disposable temporary-repository job that creates the known artifact, runs without dependency installation or network access, and is bounded to a 10-minute hard timeout, one dispatch attempt, and at most 80k model tokens or $1.00 equivalent where the selected harness exposes enforceable usage limits.

## Explicit non-goals

Phase 7 must not add:

- browser-side or World-side harness command spawning;
- LAN workers or public/untrusted remote mutation authority;
- multiple simultaneous demo jobs;
- direct completion/result submission by World;
- safe pause, cancel, resume, auto-advance, or Emergency Stop controls;
- generalized Phase 8 repository diff/evidence construction or changed-object animation beyond the single fixture-only result view;
- general MCP command authority;
- external harness authentication/configuration writes;
- public ingress, deployment, tags, releases, package publication, or visibility changes;
- changes to the original AgentIntersect repository.

## Authority and safety invariants

- World never reports a job as created until AgentIntersect supplies confirmed evidence.
- Double-click, retry, restart, and ambiguous timeout produce at most one logical dispatch. World must not resend unless the pinned create contract proves same-intent idempotency.
- A stale, offline, mismatched, or unsupported Phase 6 authority state disables enqueue.
- Expected revision, current phase, selected harness, and workspace/process identity are revalidated immediately before mutation.
- AgentIntersect remains the sole owner of claim, harness execution, and completion.
- World never silently retries an ambiguous create request; it reconciles using durable intent/job evidence.
- Every rejection and ambiguous outcome preserves operator-visible diagnostics and a safe next action.
- Raw AgentIntersect and harness logs remain local-only. Any durable/shareable transcript or UI result is sanitized with the Phase 6 redaction boundary before persistence or display.

## Expected artifacts

- Versioned command-intent schema and durable minimal-state intent ledger.
- Host-local policy/validation module.
- Narrow command service and one mutation route, provisionally `/commands/intents`.
- AgentIntersect worker-create compatibility adapter using the pinned Phase 0 worker contract.
- Intent/job reconciliation reducer integrated with the Phase 6 read projection.
- Run-detail panel with current/previous state, visible status/results, token entry held only in memory, and the fixture-only artifact/result view.
- Disposable bounded real-agent fixture, raw local logs, sanitized durable result, and final AgentIntersect job record.
- Focused backend tests for authorization, validation, duplicate submission, unsupported resend/idempotency, rejection states, persistence/restart, and redaction plus one browser real-job journey.
- `PHASE_7_REPORT.md`, updated project status/design, and the normal private exact-SHA CI closeout when the phase is complete.

## Required functional evidence

At minimum, the implementation session must prove:

1. one valid intent creates one real bounded AgentIntersect job;
2. double-click and identical retry create at most one dispatch; because the pinned Phase 0 create contract has no proven idempotency key, a lost response remains `ambiguous` without resend;
3. missing/wrong command token, wrong revision, phase, harness, workspace, process, stale authority, and unsupported contract reject before mutation;
4. daemon restart between preflight and create does not bypass re-attestation;
5. timeout after request send becomes explicit `ambiguous` until reconciled, never an automatic second POST;
6. restart recovers durable intent/job mapping;
7. queued → claimed → running → complete/failed states map to the exact job;
8. World never spawns the harness and never submits job completion;
9. the browser exposes reachable current/previous status, the fixture-only artifact/result view, and grey unavailable actions; command secrets are not persisted;
10. raw local AgentIntersect/harness logs and the final job record exist, while durable/shareable output is sanitized;
11. one disposable real-job browser journey demonstrates unchanged AgentIntersect ownership from an authorized client. Focused backend tests cover both loopback and trusted-LAN request policy; a second real LAN worker/job is not required.

## Completion evidence

Phase 7 is complete. The authoritative narrative and first-hand transcript are in `PHASE_7_REPORT.md`.

- One real unchanged-AgentIntersect `phase_run` job was created, claimed, executed through an AgentIntersect-owned disposable offline executor, completed, and reconciled to one durable World intent.
- Identical loopback and explicit trusted-LAN retries replayed the same intent/job; the queue remained at exactly one job. Wrong-token, authority-mismatch, stale, malformed, ambiguous, and restart cases are covered by focused regressions and live proof where applicable.
- The fixture artifact and verification are restored after browser/World restart; unchanged reconciliation remains byte-stable.
- Final gates: 187/187 Vitest, 20/20 Playwright, 25/25 typecheck, 9/9 architecture, 14/14 build, smoke, Storybook, 230-file fresh-copy verification, advisory audit, and `git diff --check` are green.
- The original AgentIntersect repository remained clean at its pinned revision. No release/public action or Phase 8 implementation occurred.

## Delivery workflow

Use the project-local functionality-first cadence:

1. one bounded Codex implementation/report;
2. Mr Fluff inspection and independent focused/full/live proof;
3. prompt first-hand operator testing;
4. audit only if real testing exposes a concrete issue or the user explicitly requests one;
5. fix observed defects with focused regressions and rerun affected proof;
6. stop after Phase 7 closeout—do not begin Phase 8 automatically.

## Approval and stop boundaries

- The user authorized the frozen Phase 7 implementation in this session on 2026-07-20.
- The user selected and froze the exact intent state shape, route boundary, disposable job fixture, timeout/cost ceiling, transcript policy, focused-test/browser journey, and fixture-only result view before coding.
- Commit/push may follow the normal private workflow only after the Phase 7 slice and parent/first-hand proof are green.
- No release, tag, deployment, publication, public ingress, visibility change, or Phase 8 implementation is authorized without explicit user instruction.
