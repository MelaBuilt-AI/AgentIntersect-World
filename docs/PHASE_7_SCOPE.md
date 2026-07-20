# AgentIntersect World — Phase 7 Draft Scope

Date prepared: 2026-07-19
Status: **NEXT / NOT STARTED — freeze the bounded implementation scope in a fresh session before coding**
Dependency: Phase 6 read integration and normalized replay
Runtime: Node `v24.18.0`, pnpm `11.15.0`

## Objective

Enqueue one real bounded AgentIntersect `phase_run` job through a validated host-local intent and observe its exact lifecycle end to end without AgentIntersect World spawning a harness or submitting completion itself.

## Why this phase exists

Phase 6 proved truthful read-only health, state, snapshot, feed, SSE, persistence, replay, and readiness projection. Phase 7 is the first command-authority slice and the decisive “real agent” proof. It must remain one narrow mutation path rather than expanding into a general control plane.

## Supported environment and trust model

- One operator using their own World and AgentIntersect instances on the same computer.
- Loopback-only mutation authority for this phase; trusted-LAN workers remain out of scope.
- The unchanged AgentIntersect daemon owns queueing, claim, execution, and completion.
- World owns intent validation, idempotency/reconciliation, truthful lifecycle projection, and operator-visible diagnostics.
- AgentIntersect responses, process identity, phase/revision state, and timing remain untrusted until attested and validated.

## Proposed in-scope vertical slice

1. A host-only `worker.enqueue-phase` intent.
2. Selection of the Phase 5 default/current harness or an explicitly selected owned-agent harness origin.
3. Validation of phase, harness, expected revision, readiness, and fresh AgentIntersect authority.
4. Durable intent identity and idempotency state before the external mutation.
5. AgentIntersect daemon attestation immediately before `POST /v1/worker/jobs`.
6. One bounded `phase_run` job creation request.
7. Ambiguous timeout/retry reconciliation that never silently dispatches twice.
8. Mapping of intent, correlation, phase, session, job, and run identifiers.
9. Truthful queued, claimed, running, complete, and failed lifecycle observation through the Phase 6 read path.
10. A visible run-detail/operator result that identifies the exact job and whether creation is confirmed, rejected, ambiguous, or reconciled.

## Explicit non-goals

Phase 7 must not add:

- browser-side or World-side harness command spawning;
- LAN workers or remote mutation authority;
- multiple simultaneous demo jobs;
- direct completion/result submission by World;
- safe pause, cancel, resume, auto-advance, or Emergency Stop controls;
- file edits, diff construction, test/evidence projection, or changed-object animation;
- general MCP command authority;
- external harness authentication/configuration writes;
- public ingress, deployment, tags, releases, package publication, or visibility changes;
- changes to the original AgentIntersect repository.

## Authority and safety invariants

- World never reports a job as created until AgentIntersect supplies confirmed evidence.
- Double-click, retry, restart, and ambiguous timeout produce at most one logical dispatch.
- A stale, offline, mismatched, or unsupported Phase 6 authority state disables enqueue.
- Expected revision, current phase, selected harness, and workspace/process identity are revalidated immediately before mutation.
- AgentIntersect remains the sole owner of claim, harness execution, and completion.
- World never silently retries an ambiguous create request; it reconciles using durable intent/job evidence.
- Every rejection and ambiguous outcome preserves operator-visible diagnostics and a safe next action.

## Expected artifacts

- Versioned command-intent schema and durable intent ledger.
- Host-local policy/validation module.
- Narrow command service and one mutation route, provisionally `/commands/intents`.
- AgentIntersect worker-create compatibility adapter using the pinned Phase 0 worker contract.
- Intent/job reconciliation reducer integrated with the Phase 6 read projection.
- Run-detail panel with current/previous state and visible status/results.
- Disposable bounded real-agent fixture and transcript/evidence capture.
- Focused intent/idempotency/authority tests plus integrated local proof.
- `PHASE_7_REPORT.md`, updated project status/design, and the normal private exact-SHA CI closeout when the phase is complete.

## Required functional evidence

At minimum, the implementation session must prove:

1. one valid intent creates one real bounded AgentIntersect job;
2. double-click and identical retry create at most one dispatch;
3. wrong revision, phase, harness, workspace, process, stale authority, and unsupported contract reject before mutation;
4. daemon restart between preflight and create does not bypass re-attestation;
5. timeout after request send becomes explicit `ambiguous` until reconciled, never an automatic second POST;
6. restart recovers durable intent/job mapping;
7. queued → claimed → running → complete/failed states map to the exact job;
8. World never spawns the harness and never submits job completion;
9. the browser exposes reachable current/previous status and keeps unavailable actions grey;
10. one disposable real-job recording and AgentIntersect state transcript demonstrate unchanged AgentIntersect ownership.

## Delivery workflow

Use the project-local functionality-first cadence:

1. one bounded Codex implementation/report;
2. Mr Fluff inspection and independent focused/full/live proof;
3. prompt first-hand operator testing;
4. audit only if real testing exposes a concrete issue or the user explicitly requests one;
5. fix observed defects with focused regressions and rerun affected proof;
6. stop after Phase 7 closeout—do not begin Phase 8 automatically.

## Approval and stop boundaries

- This document prepares the next session; it does **not** authorize Phase 7 implementation in the current session.
- The fresh session must confirm/freeze the exact intent schema, route, bounded job fixture, timeout, cost ceiling, and acceptance transcript before coding.
- Commit/push may follow the normal private workflow only after the Phase 7 slice and parent/first-hand proof are green.
- No release, tag, deployment, publication, public ingress, visibility change, or Phase 8 implementation is authorized without explicit user instruction.
