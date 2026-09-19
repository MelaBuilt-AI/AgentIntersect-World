# Phase 14 — Frozen Scope

**Status:** FROZEN / APPROVED / IMPLEMENTATION AUTHORIZED

**Implementation result:** COMPLETE / INDEPENDENT PARENT PROOF PASS / PRIVATE EXACT-SHA CI GREEN

**Closeout:** implementation/correction commit `68a41925fa93fca23c8b2efffd56e8869d6676a0`; exact-SHA GitHub Actions run `29963116363` green

**Frozen:** 2026-07-22

**Authorized:** 2026-07-22 by the user

**Baseline:** `c49042793e45921501bfd9c3003f857fd25647de` on clean private `main`; exact-SHA GitHub Actions run `29956534885` green

**Runtime:** Node `v24.18.0`, pnpm `11.15.0`, Codex `0.144.1`
**Implementation authority:** Complete only the bounded Phase 14 vertical slice in this contract with strict vertical RED→GREEN TDD. The implementation worker may inspect and edit this repository, use existing pinned workspace dependencies, and run bounded local tests/builds. Prefer no new third-party dependency. Mr Fluff owns independent proof and any private commit, push, or exact-SHA CI closeout.

## Objective

Complete the one-agent development magic slice by connecting real World-owned read/search/edit/test/preview operations, revision-bound visual code explanation, explicit single-use approval, exact current/previous evidence, and a health-checked loopback preview without turning model prose, World Actions, presentation state, or avatar motion into authority.

## Inherited boundaries

- AgentIntersect World remains independent. Do not inspect or modify `/home/user/AgentIntersect`.
- The topology is one trusted operator with local or trusted-LAN agents/views. Phase 14 preview itself is loopback-only.
- Phase 12 chat remains independently usable if the Phase 14 lane fails.
- Phase 13 World Actions remain presentation-only and cannot read, edit, test, launch, approve, cancel, or stop Phase 14 work.
- Structured World-owned events and persisted records are authoritative. Prose, inferred thought, animation, browser-only state, and decorative effects are not.
- No chain-of-thought, hidden-reasoning simulation, arbitrary shell authority, public ingress, tunnels, cloud deployment, package publication, release, tag, visibility change, Hermes-core/profile modification, Phase 15+ work, or external-project modification is authorized.
- The failed Phase 13 exact-root Discord → World continuity path remains explicitly deferred. Phase 14 must not invoke, simulate, retry, or claim it.

## 1. Canonical fixture and exact journey

Create the tracked, World-owned, dependency-free fixture `examples/phase14-magic-slice/`:

- `src/greeting.mjs` exports exactly `greeting` with initial source string `Hello from the Phase 14 fixture.`
- `test/greeting.test.mjs` uses `node:test` and expects `Hello from the approved Phase 14 edit.`
- `preview.mjs` serves the greeting and exposes strict `GET /health` JSON `{ "ok": true, "schema": "aiw.phase14-preview/1" }`.
- a strict manifest records schema/revision, exact files, commands, target, symbol, expected replacement, SHA-256 hashes, and World-owned provenance.

Every mutation or execution journey uses an explicitly created disposable copy beneath the canonical real root `/tmp/agentintersect-world-phase14/`. Runtime acceptance must never mutate the tracked fixture or repository worktree. Each disposable copy is bound to repository identity, fixture-manifest revision, exact target `src/greeting.mjs`, symbol `greeting`, initial file SHA-256, and patch digest.

The numbered operator journey is exactly:

1. attach a deterministic existing Hermes-compatible fixture session without invoking the current Discord session;
2. perform a real World-owned read/search of `greeting`;
3. show revision-bound source and explanation;
4. preview the exact one-file replacement and current-versus-previous unified diff;
5. obtain explicit single-use approval;
6. atomically apply the edit;
7. show the applied current-versus-previous diff;
8. run the allowlisted focused test;
9. start the loopback preview and verify health;
10. stop and clean the preview and correlate all evidence.

Cancellation must work before approval, during test execution, during preview startup, and while preview is running.

## 2. Strict tool-event contract

Create strict versioned protocol `aiw.tool-event/0.14` for operations `read`, `search`, `edit`, `test`, and `preview` and lifecycle states `requested`, `accepted`, `running`, `succeeded`, `failed`, `cancelled`, and `superseded`.

Where relevant, events require adapter-owned exact World session ID, adapter/root session references, repository ID/root attestation, fixture revision, UUID operation/event/correlation/parent IDs, monotonically increasing sequence, ISO timestamps, provenance, current/previous evidence refs, and redaction metadata.

Contract ceilings and behavior:

- strict unknown-field rejection;
- UUID operation, event, and correlation IDs;
- deterministic replay ordering;
- idempotent same-ID/same-digest replay;
- HTTP `409` on a conflicting duplicate;
- request expiry after 15 minutes;
- no more than 100 replayed events;
- no event larger than 32 KiB;
- displayed arguments bounded and redacted to 4 KiB;
- no prose-to-shell reconstruction and no free-form command authority.

## 3. Revision-bound explanation contract

Create strict `aiw.code-explanation/0.14` records bound to exact repository identity, fixture revision, file evidence ref, symbol `greeting`, exact line range, source hash, and originating read/search event.

Claims use separate arrays and labels for `source-fact`, `runtime-observation`, `test-result`, and `interpretation`. Serialized explanations are at most 16 KiB and each displayed claim is at most 1 KiB. Missing, moved, revision-stale, or hash-stale targets fail closed with truthful stale/continuity metadata and no mutation.

The semantic DOM is authoritative. Phase 14 exposes no chain-of-thought, hidden reasoning, or decorative thought bubbles.

## 4. Mutation and approval boundary

Phase 14 supports exactly one-file exact-text replacement. General patches and multi-file edits are excluded.

Mutation is restricted to the attested disposable fixture root and exact `src/greeting.mjs`. Reject absolute paths, traversal, symlinks, binary files, NUL bytes, stale hashes/revisions, unexpected pre-existing changes, and paths outside the allowlist.

Bounds:

- one mutation operation;
- source file at most 64 KiB;
- intended replacement/diff input at most 8 KiB;
- operation timeout 5 seconds;
- displayed and persisted unified diff at most 16 KiB.

Show the exact previous/current unified diff before approval. Approval is explicit, scoped to session/repository/revision/target/patch digest, single-use, revocable before execution, and expires after 5 minutes. Re-attest every binding immediately before an atomic same-directory temp-file plus rename. Dirty or unexpected state is rejected and preserved.

Persist only truthful outcomes: `not-applied`, `applied`, `cancelled`, `failed`, or `applied-evidence-failed`. World Actions and presentation code never mutate files.

## 5. Focused-test adapter

Allow only argv equivalent to `[process.execPath, "--test", "test/greeting.test.mjs"]` with `shell:false` and cwd fixed to the attested disposable fixture.

The adapter owns one child process/process group, supplies a minimal non-secret environment, enforces a 30-second timeout, retains at most 64 KiB stdout and 64 KiB stderr with visible truncation, and reports exact exit code, signal, timeout, and cancellation truth. Cancellation kills and awaits the owned process tree. No daemon escape, arbitrary command, package manager, publication, deployment, credential access, or inherited secret environment is allowed.

## 6. Loopback preview profile

Allow only exact `process.execPath` execution of fixture `preview.mjs` with host `127.0.0.1`, OS-assigned port `0`, `shell:false`, and one owned process tree. The fixture emits a machine-readable readiness record.

- `GET /health` returns exactly `{ "ok": true, "schema": "aiw.phase14-preview/1" }`.
- Poll loopback only.
- Readiness target is at most 5 seconds; hard startup timeout is 10 seconds.
- Maximum lifetime is 5 minutes.
- Retain at most 64 KiB combined logs.
- States are `requested`, `starting`, `ready`, `unhealthy`, `stopped`, `failed`, and `cancelled`.
- Stop/cancel kills and awaits the owned tree and proves the port is closed.

Trusted-LAN preview, tunnels, public/cloud ingress, and browser state as authority are excluded.

## 7. World presentation and accessible operator flow

Add one dedicated Phase 14 developer/tool journey integrated into the existing shell, session, and repository experience without breaking Phase 12 chat or Phase 13 actions.

Use visible numbered steps and distinct action, evidence, and status areas. Every enabled primary action uses the existing consistent blue treatment; disabled controls are grey. Show exact file/symbol focus, authoritative event state, current/previous diff, explanation labels, approve/revoke/cancel, test progress/result, preview URL/health/stop, and final correlated evidence.

All controls and results are reachable in semantic DOM order by keyboard and touch, with screen-reader live regions, reduced-motion, forced-colors, responsive mobile layout, and no-WebGL equivalence. Movement and animation are illustrative only. Existing chat remains independently usable if the lane fails.

## 8. Persistence, replay, and recovery

Use World-owned checksum-protected atomic persistence with last-good/recovered truth.

- Retain the newest 20 operations for at most 7 days.
- Aggregate store is at most 1 MiB.
- Replay at most 100 events; each event at most 32 KiB.
- Explanation at most 16 KiB; diff at most 16 KiB.
- Test stdout and stderr at most 64 KiB each.
- Preview logs at most 64 KiB combined.
- Evict deterministically oldest-first.

Persist only bounded redacted projections, hashes, status, timings, and evidence refs—never raw transcript, full environment, credentials, secrets, or unbounded logs. On restart, nonterminal test/preview work becomes truthfully interrupted/recovered. Never signal a process using only stale persisted PID identity. Duplicate replay stays idempotent.

## 9. Performance budgets

Inherit the Phase 13 raw-sample contracts:

- main-thread render-work p95 at most 16.7 ms;
- raw `requestAnimationFrame` cadence p95 at most 16.8 ms;
- longest task at most 100 ms;
- retain 120 machine-readable samples.

Add deterministic Phase 14 measurements:

- project/replay 100 events p95 at most 50 ms;
- render maximum 8 KiB edit/diff p95 at most 50 ms;
- truncate maximum 128 KiB test output p95 at most 10 ms;
- preview readiness target at most 5 seconds, hard limit 10 seconds;
- Phase 14 incremental heap at most 32 MiB on desktop and constrained mobile/two-CPU profiles.

Preserve Phase 10 10k/100k aggregate behavior and never materialize whole-repository symbol/tool detail.

## 10. Acceptance evidence and deferred backlog

The Phase 13 Discord → World continuity failure remains excluded and deferred.

Acceptance requires strict vertical RED→GREEN evidence and integrated tests for:

- strict schemas and unknown-field rejection;
- session/repository/root/revision/hash identity binding;
- approval single-use, expiry, revoke, cancellation, and conflict;
- stale/dirty/symlink/absolute/traversal/path/binary/NUL rejection;
- atomic exact-text edit and truthful outcome/evidence failure;
- test pass/fail/exit/signal/timeout/cancel/output truncation/process cleanup;
- preview ready/unhealthy/timeout/cancel/running-stop/port cleanup;
- duplicate/restart/recovery/retention/last-good behavior;
- redaction and current/previous truth;
- proof that the tracked fixture and repository worktree were never mutated by runtime acceptance.

Also retain:

- desktop, mobile, keyboard, touch, reduced-motion, forced-colors, and no-WebGL browser journeys;
- Storybook states and screenshot evidence;
- a short retained video or trace-backed equivalent showing the complete numbered journey;
- machine-readable performance evidence;
- an integrated real-process journey using actual `node --test` and actual loopback preview.

Develop focused suites serially with `TURBO_CONCURRENCY=1`, Vitest `--maxWorkers=1 --no-file-parallelism`, and Playwright `--workers=1`. At closeout run impacted suites, one authoritative full `pnpm check`, Storybook build, production advisory audit, fresh-copy verification, and `git diff --check`. Existing thresholds and tests must not be weakened.

## Architecture and delivery profile

Prefer cohesive Phase 14 protocol/service/routes/client/panel structure rather than bloating unrelated legacy files. Reuse existing bounded redaction, evidence, API envelope, persistence, session identity, repository reference, semantic fallback, and process-cleanup patterns where correct.

Do not expose arbitrary root selection through the public API. Acceptance setup may create and attest the disposable fixture only through server configuration or a narrow fixture-only profile. Browser fixture states are allowed for stories, but acceptance success requires real server adapters and real processes.

## Explicit non-goals and authority gates

- no arbitrary shell, terminal emulator, general workflow engine, broad IDE/editor, general patch, or multi-file edit;
- no autonomous/unapproved repository mutation;
- no multiple concurrent projects, agents, edits, tests, or previews;
- no public/LAN preview, tunnel, deployment, publication, release, tag, package publication, or visibility change;
- no Hermes core/profile edit and no original-AgentIntersect inspection or modification;
- no retry or simulation of deferred Phase 13 continuity;
- no Phase 15+ implementation;
- no commit or push by the implementation worker.

## Acceptance statement

Phase 14 is complete only when the exact ten-step disposable-fixture journey works end to end with authoritative structured events, revision-bound explanation, one explicit approved atomic edit, real focused test, real loopback preview, exact evidence correlation, cancellation/recovery truth, bounded persistence/performance, accessible semantic operation, complete cleanup, and proof that the tracked fixture/worktree remained unchanged. Completion is not claimed until the required evidence exists; parent verification and private exact-SHA CI remain separate closeout authority.
