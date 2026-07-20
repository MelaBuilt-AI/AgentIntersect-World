# AgentIntersect World — Phase 8 Draft Scope

Date prepared: 2026-07-20
Status: **NEXT / NOT STARTED — preparation only; implementation is not authorized**
Dependency: completed Phase 7 durable intent/run mapping and completed Phase 5 repository island
Runtime baseline: Node `v24.18.0`, pnpm `11.15.0`

## Proposed objective

Bind observed real-run effects to repository objects and evidence-backed visual states so the operator can inspect what changed and why without treating animation or harness claims as proof.

## Proposed smallest vertical slice

1. Capture a bounded repository baseline before one known run observation window.
2. Reconcile post-run Git/filesystem state into confirmed create/modify/delete/rename/binary outcomes.
3. Preserve ambiguity when a concurrent human or unrelated process may have changed a file.
4. Expose one bounded, sanitized before/after diff/evidence API keyed by Phase 7 intent/job/run IDs.
5. Link confirmed affected paths to existing Phase 4 object IDs and Phase 5 repository-island selection.
6. Show a minimal Evidence panel and changed-object visual state with a full DOM/reduced-motion equivalent.
7. Treat harness-reported paths or telemetry as `reported` candidates until repository evidence confirms them.
8. Attach truthful test evidence: passed, failed, not run, unavailable, or unverified.

## Proposed non-goals

- Editing files from World.
- Auto-revert or rollback.
- Semantic diff support for every language.
- Claiming exclusive agent authorship when the observation window is ambiguous.
- Treating green animation as success evidence.
- General provenance/audit export, remote evidence storage, or public sharing.
- Phase 9 synchronization, Phase 10 symbol/dependency work, deployment, release, tag, or publication.

## Decisions to freeze before implementation

A future Phase 8 session should explicitly confirm:

- the exact observation-window boundary and concurrent-human attribution policy;
- Git-only versus Git-plus-filesystem reconciliation for the first slice;
- maximum file count, diff bytes, per-file bytes, binary handling, and secret-like content policy;
- rename-confidence behavior and when to remain create+delete;
- test-evidence sources and what constitutes verified versus reported;
- the first changed-object visual treatment and reduced-motion/DOM equivalent;
- retention and restart semantics for baselines/diffs;
- the disposable fixture and complete acceptance transcript.

## Required preparation before coding

1. Read `PHASE_7_REPORT.md`, this draft, `PROJECT_STATUS.md`, and the Phase 8 design section.
2. Reconfirm the Phase 7 exact-SHA baseline and CI.
3. Refresh jCodeMunch and map Phase 7 run/intent IDs to Phase 4 world objects and Phase 5 renderer selection.
4. Ask the operator to freeze the decisions above.
5. Use one bounded implementation round, independent parent proof, first-hand functional testing, and only observed-defect corrections.

## Stop boundary

This document is a handoff artifact, not implementation authorization. Do not begin Phase 8 automatically. No release, deployment, publication, public ingress, or visibility change is authorized.
