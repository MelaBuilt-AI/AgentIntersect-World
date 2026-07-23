# Phase 17 Scope Freeze

Status: **USER-AUTHORIZED BOUNDED IMPLEMENTATION SHAPE / USER ACCEPTED / SEALED / COMPLETE**

This document is the mandatory first repository edit for Phase 17. It freezes the
authorized implementation shape below. Phase 18 remains unauthorized and has not
started. If repository evidence materially contradicts any decision here,
implementation must stop without reinterpreting the decision.

Acceptance closeout: the technical implementation/evidence tree at
`bdfb1c8ae58303e8afad41f6a2411fd8adfeef93` passed private exact-SHA
`phase-1-checks` run `30019778458`, job `89249166240`. After that proof, the
user explicitly accepted Phase 17 in the new session on 2026-07-23. Phase 17 is
accepted, sealed, and complete. Phase 15 remains unsealed solely for its
physical-microphone journey with the local STT provider staged/unactivated;
Phase 13 Discord → World continuity remains FAIL/deferred under waiver; and
Phase 18 remains separately unauthorized and not started.

## 1. One bounded vertical slice

Implement one complete local recovery journey, not a general observability
platform:

1. Begin from a healthy exactly-two-agent Phase 16 coordination fixture/state
   (Mr Fluff/Hermes and Beans/OpenClaw, with distinct tasks and worktrees).
2. Start one World-owned bounded operation representing a tool, edit, test, or
   preview stage through production service boundaries.
3. Terminate the owned child after `operation-started` and before any completion
   record.
4. Restart or reload authoritative Phase 17 state.
5. Classify the operation as interrupted/orphaned without fabricating success,
   verify both worktrees and the repository remain intact, and show the precise
   degraded capability and loss range.
6. Preview a no-mutation recovery plan.
7. Apply only safe, idempotent derived-state/process reconciliation under
   explicit operator action. Do not mutate Git content, auto-resolve conflicts,
   or delete worktrees.
8. Generate a privacy-safe diagnostic preview, export it locally only after
   preview, and delete it with proof.
9. Demonstrate deterministic restart/recovery and cleanup through focused tests,
   a production-backed measurement/drill, and a browser journey.

## 2. Identity and correlation

- Canonical schema identity is `aiw.observability/0.17`.
- Every incident and event uses stable bounded correlation keys sufficient to
  trace repository, session, agent, task, worktree, operation, capability, and
  revision.
- Existing validated IDs and sanitized repository-relative labels are used.
  Browser/shareable evidence never persists raw absolute worktree paths.
- Event ordering and current/previous revision truth are deterministic.
- Fuzzy inference must never turn missing evidence into exclusive attribution or
  completion.

## 3. Readiness model

Expose an authoritative capability readiness matrix for exactly `session`,
`tool`, `world-action`, `preview`, `voice`, `worktree`, `yjs`, and `sqlite`.
Each row has a bounded `ready | degraded | unavailable | recovery-needed`
status, last verified time and revision, concise evidence, and permitted action
state. The staged but unactivated Phase 15 voice provider is truthfully
`unavailable` and does not block non-voice Phase 17 acceptance. Overall readiness
is derived from the rows and is not independently invented.

## 4. Local persistence, checksums, and retention

- State is local/private only, with no network export or external telemetry.
- Use checksummed `current` and `previous` snapshots with atomic writes and an
  append-only bounded event ledger consistent with repository persistence
  patterns.
- Preserve a corrupt current snapshot as evidence before safe repair/rebuild. If
  current is invalid and previous is valid, label recovery truth
  `previous-recovered`, not `current`.
- Retain at most 512 events, 32 incidents, and 3 local diagnostic exports.
  Exported bundles are at most 1 MiB. Pruning and rotation are deterministic,
  idempotent, and report removed items.
- All paths stay within an explicit World-owned Phase 17 state root. Reject
  traversal and symlink escape before read, write, or delete.

## 5. Recovery authority

- Inspection and recovery-plan preview never mutate authoritative state.
- Apply requires explicit operator action. It may rebuild only derivable Phase 17
  state, reconcile World-owned process/preview records, and truthfully mark
  interrupted/orphaned operations.
- Preserve non-derivable loss ranges explicitly.
- Never fabricate tool, preview, or session completion; auto-delete worktrees;
  run Git merge/reset/clean/checkout as recovery; or kill unowned/protected
  processes.
- Repeated apply, export, and delete operations are safe and return explicit
  idempotent results.

## 6. Privacy and redaction

- Diagnostic preview/export is summary-first and excludes raw prompts,
  transcripts, persona or memory contents, environment values,
  credentials/tokens, raw repository diffs, raw source content, and absolute
  paths.
- Use deterministic allowlisted manifest fields and redaction for supported
  free-text summaries.
- Secret and persona canaries must be absent from every persisted diagnostic
  surface, including JSON/Markdown exports and stored command/error summaries.
- Preview is mandatory before export. Export fails closed unless
  redaction/validation proves safety.
- Deletion is constrained to the managed export root and proves absence
  afterward.

## 7. Operator-visible UI

Add a lazy Diagnostics & Recovery surface in the existing shell backed by
production APIs/state, not a mock-only dashboard. It includes:

1. Overall readiness and all eight capability rows.
2. A correlated incident timeline.
3. Explicit `Current state`, `Previous verified state`, and `Loss window`
   labels.
4. Numbered controls in workflow order: inspect preserved state, preview
   recovery, apply safe recovery, preview diagnostics, export diagnostics, and
   delete export.
5. Consistently blue enabled controls. Unavailable/inactive controls are grey,
   focusable, and include accessible explanations.
6. Exact safe/degraded/recovered text, keyboard/DOM equivalence, no clipping,
   overlap, or horizontal overflow on supported desktop and mobile widths,
   reduced-motion support, and useful operation without WebGL.

## 8. Production API and CLI equivalence

- Add bounded local-server production endpoints following existing
  routing/service patterns for snapshot/readiness, incident inspection, recovery
  preview/apply, diagnostic preview/export/delete, and the deterministic drill
  where appropriate.
- Add a thin local recovery CLI using the same production service/contracts for
  at least `inspect`, `preview-recovery`, `apply-recovery`,
  `preview-diagnostics`, `export-diagnostics`, and `delete-export`. Recovery
  logic must not be duplicated.
- APIs and CLI reject wrong repository/session/revision/operation identifiers and
  unsafe paths before mutation.

## 9. Evidence and TDD

- Use vertical RED-to-GREEN cycles. For every new supported behavior, write and
  run one focused failing assertion before the minimal implementation. A harness
  or configuration failure is not RED.
- Track `docs/PHASE_17_SCOPE.md`,
  `docs/PHASE_17_IMPLEMENTATION_CONTRACT.md`, `PHASE_17_REPORT.md`,
  `artifacts/phase17/recovery-drill.json`, Phase 17
  package/service/UI/API/CLI tests, and one production-backed Playwright journey.
- Add root scripts `conformance:phase17` and `measure:phase17`.
- The deterministic drill proves: killed owned operation; no fabricated
  completion; exact current/previous/loss truth; safe preview/apply; worktree and
  repository preservation; redacted export/delete; restart persistence;
  idempotence; and zero owned process/listener/temp residue.

## 10. Closeout boundaries

- Update `PROJECT_STATUS.md`, `AgentIntersect_WorldDD.md`, and
  `PHASE_17_REPORT.md` only from measured evidence after implementation checks
  are green.
- During the worker stage, wording remained **IMPLEMENTATION CANDIDATE / PARENT
  VERIFICATION PENDING** and no worker could claim user acceptance, remote push,
  exact-SHA CI, or a Phase 17 seal. Those gates were later satisfied by parent
  verification, private push, exact-SHA CI, and the user's explicit acceptance.
- Preserve Phase 15 pending/unactivated, the Phase 13 waiver, and Phase 16
  sealed completion.
- Phase 18 remains unauthorized and has not started.
