# AgentIntersect World — Phase 8 Frozen Scope

Date frozen: 2026-07-20
Status: **FROZEN / LOCAL COMPLETE — private exact-SHA CI closeout pending**
Dependency: completed Phase 7 durable intent/run mapping and completed Phase 5 repository island
Runtime baseline: Node `v24.18.0`, pnpm `11.15.0`

## Objective

Bind observed real-run effects to repository objects and evidence-backed visual states so the operator can inspect what changed and why without treating animation or harness claims as proof.

## Frozen vertical slice

1. Persist a checksum-protected pending intent before sealing a repository baseline. Seal after local request/scope validation and before the single external AgentIntersect create attempt; fail closed before mutation when sealing fails.
2. Keep the observation window open until the exact intent/job/run reaches an observed terminal lifecycle and post-run evidence is captured. Describe all repository outcomes as `observed-in-window`, never as exclusive agent authorship.
3. Reconcile bounded Git-plus-filesystem state, including tracked, untracked, ignore-respecting, non-Git, deleted, exact rename, and binary outcomes. Selected-repository scripts, hooks, binaries, package managers, shells, and arbitrary commands are never executed; only hardened read-only Git metadata commands are permitted.
4. Bound each evidence record to 256 changed paths, 1 MiB of sanitized text diff in total, and 128 KiB per file. Binary payloads are never embedded. Oversize/unavailable data retains size/hash/status and explicit diagnostics. Secret-like lines are replaced with explicit redaction markers before durable/API/UI persistence.
5. Confirm a rename only for a unique one-to-one delete/create pair with the same complete content hash. Collisions, partial hashes, oversize/unhashed files, and non-unique candidates remain create plus delete.
6. Use test states `passed`, `failed`, `not-run`, `unavailable`, and `unverified`. World runs no repository tests. Harness claims alone remain reported/unverified. Passed or failed becomes verified only from an exact intent/job/run-correlated bounded structured on-disk artifact that is schema-valid, hash-consistent with the correlated report, and independently present in repository-window evidence. Explicit no-test evidence may be `not-run`; absent evidence is `unavailable`; malformed or conflicting evidence is `unverified`.
7. Make the DOM Evidence panel authoritative. It shows current versus previous records, exact IDs, observation window, attribution, outcomes/object links, bounds/redactions, and test truth. Linked rows use the Phase 5 repository selection path; deleted rows use a retained baseline/tombstone ref when available. Persistent DOM and renderer change treatment must not imply test success. Reduced motion and WebGL fallback retain identical text, badges, and selection semantics, with blue actionable and grey disabled controls.
8. Keep immutable intent-keyed pending baselines and completed evidence checksum-protected, atomic, local-only, and capped to the latest 20. Active baselines survive restart and finalize exactly once. Completed records reload byte-identically and idempotent reconciliation does not rewrite timestamps or generations. Corrupt current storage fails closed to verified previous/last-good state when possible; failed capture never replaces completed last-good evidence. Raw secret-like content is never retained and there is no export/public-sharing surface.

## Attribution contract

- Exact correlated reported paths become `reported-and-confirmed` only when repository evidence independently confirms the same path/outcome.
- Unreported changes, conflicting telemetry, pre-existing dirty state, and concurrent-change signals remain explicitly `ambiguous`.
- Reported paths without repository confirmation remain `reported-unverified` and are never silently dropped.

## Disposable acceptance fixture

A World-owned temporary Git repository and project-owned Phase 7 service/contract fixtures must deterministically prove one tracked text modification, new text file, deletion, unique exact-content rename, binary change, secret-like redaction, unreported ambiguous concurrent change, exact structured correlated verified test artifact, reported-but-unconfirmed path, and restart/finalize/reload/idempotency.

The acceptance transcript must prove identity-keyed API lookup, exact outcomes/bounds/redaction/object mapping/test truth, current/previous UI, Evidence-row selection, persistent change treatment, reduced-motion/DOM equivalence, no horizontal overflow, and zero browser console errors.

## Required surface

- Strict versioned `aiw.evidence/0.8`-family baseline/evidence/change/test schemas and types.
- Bounded local capture/reconciliation/store service linked to Phase 7 intent/job/run lifecycle and the selected successful repository generation.
- One strict sanitized read API resolving by exactly one intent ID, job ID, or run ID.
- Phase 4 object/tombstone mapping and Phase 5 selection integration.
- Real Evidence panel plus persistent changed-object DOM/renderer treatment and reduced-motion equivalent.
- Strict OpenAPI request/response truth and deterministic unit, integration, API, browser, and Storybook coverage.

## Non-goals

- Editing files from World, auto-revert, rollback, or a generic semantic-diff framework.
- Exclusive agent-authorship claims.
- Running selected-repository tests or other selected-repository commands.
- Evidence export, remote evidence storage, or public sharing.
- Phase 9 or later-phase work.
- Release, deployment, publication, public ingress, visibility changes, or changes to the original AgentIntersect repository.

## Exit boundary

Phase 8 implementation and independent parent verification are locally complete after focused RED→GREEN work, two parent-observed corrections, the serialized full/fresh-copy gates, and first-hand browser proof. Private commit/push and exact-SHA CI are the remaining closeout steps; no routine audit or re-audit is part of this implementation round.
