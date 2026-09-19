# AgentIntersect World — Phase 17 Technical Acceptance Report

Date: 2026-07-23

Status: **USER ACCEPTED / SEALED / COMPLETE**

Verdict: **ACCEPTANCE PASS**

Phase 17 delivers the user-authorized bounded observability, diagnostics, and
deterministic-recovery slice frozen in `docs/PHASE_17_SCOPE.md`. Parent review,
focused correction, direct runtime challenges, full repository verification,
production browser proof, and disposable fresh-copy verification are complete.

The technical implementation/evidence tree at
`bdfb1c8ae58303e8afad41f6a2411fd8adfeef93` passed private exact-SHA
`phase-1-checks` run `30019778458`, job `89249166240`. After that proof, the
user explicitly accepted Phase 17 in the new session on 2026-07-23. This tracked
report cannot self-reference the future status-only seal commit or its CI run;
those remain external GitHub/vault closeout records.

## Delivered slice

- Strict `aiw.observability/0.17` identity and stable bounded correlation across
  repository, session, agent, task, worktree, operation, capability, and revision.
- Exactly eight derived readiness rows: `session`, `tool`, `world-action`,
  `preview`, `voice`, `worktree`, `yjs`, and `sqlite`.
- Checksummed atomic current/previous snapshots, maximum-512 event ledger,
  maximum-32 incidents, corrupt-current preservation, and truthful
  `previous-recovered` projection.
- One World-owned operation can be terminated only with exact repository,
  session, operation, revision, route/body identity, and literal approval.
- Restart truth keeps `unknown`, `interrupted`, `orphaned`, and `failed`
  distinct. Process disappearance never becomes completion.
- Recovery is inspect/preview first, explicit-approval gated, idempotent only for
  the exact persisted request receipt, and restricted to derived Phase 17 state
  and owned-process bookkeeping. It never edits Git content or deletes a
  worktree.
- Diagnostic preview/export is allowlisted, redacted, local-only, checksummed,
  byte-bounded to 1 MiB, retained at three exports, and revalidated on exact
  replay. Deletion proves both managed bundle and sidecar absent, including
  orphan/reappeared-file cases.
- The production API, thin local CLI, and lazy shell-integrated Diagnostics &
  Recovery panel share the same service and contracts.

## Independent correction review

A fresh focused privacy/recovery review found six concrete blocker families. One
bounded correction pass addressed only those findings:

1. Absolute-path/privacy redaction across POSIX, Windows-drive, and UNC forms.
2. Export integrity and exact original-revision replay binding.
3. Deletion absence proof for orphan, one-file, absent, and reappeared pairs.
4. Exact termination and apply authority, including path/body operation identity.
5. Fixed-file target-symlink refusal for current, previous, ledger, and preview
   receipts while preserving outside sentinels byte-identically.
6. Production API/CLI parity for wrong identities, revisions, and exact retries.

Focused RED evidence reached product assertions before each correction. The
corrected focused affected suite passed 5 files / 23 tests; Phase 17 conformance
then passed 8 files / 27 tests.

## Parent-authored runtime challenges

The pre-correction parent challenge exposed false/idempotent claims when an export
file was missing or corrupted and when deletion replay saw reappeared files.
After correction, `/tmp/aiw-phase17-parent-recovery-pass.mts` passed all direct
service challenges:

- missing or corrupted replay fails closed;
- wrong request revision conflicts;
- exact replay is accepted only while both files revalidate;
- orphan-pair deletion removes both files and proves absence;
- deletion replay removes a reappeared exact managed file before claiming
  absence.

## Deterministic recovery drill

Tracked evidence: `artifacts/phase17/recovery-drill.json`.

- Verdict: **PASS**, all **17/17** checks true.
- Revisions: current 4, previous 3; 6 retained events; 1 incident; exactly 8
  readiness rows.
- One owned child was killed after `operation-started` and before completion.
  Reload classified it orphaned; final operation state is `reconciled` with
  `completionRecorded:false`.
- Recovery preview was non-mutating; exact apply/export/delete retries replayed
  idempotently.
- The 4,311-byte local diagnostic bundle was privacy-safe and absent after
  explicit deletion.
- Repository HEAD, worktree topology, status, and fixture marker digests were
  identical before and after recovery.
- Privacy leak flags were all false.
- Cleanup proved zero owned processes, listeners, and temporary files; the
  export and disposable fixture root were absent.

## Parent verification

All commands ran from `/home/user/AgentIntersect-World` with Node `v24.18.0`
and pnpm `11.15.0`.

1. `corepack pnpm@11.15.0 conformance:phase17`
   - PASS: 18/18 package builds; 8/8 test files; 27/27 tests.
2. Parent recovery/privacy challenge
   - PASS: missing/corrupt/wrong-revision export replay rejected; exact deletion
     and replay absence proof accepted.
3. `corepack pnpm@11.15.0 measure:phase17`
   - PASS: 20/20 production builds; recovery drill 17/17; production-backed
     Playwright 1/1.
4. `corepack pnpm@11.15.0 check`
   - PASS: Prettier, ESLint, 38/38 typecheck tasks, 11/11 architecture tests,
     580/580 Vitest tests across 240/240 suites, 20/20 production builds, smoke,
     and 44/44 Playwright journeys.
5. `corepack pnpm@11.15.0 verify:fresh`
   - PASS from a disposable copied tree: locked install, uncached package build,
     generated-avatar validation, full checks/browser suite, and 502 project
     source files verified.

## First-hand browser and visual proof

The parent opened the production-built shell against the real local Phase 17
service, created the interrupted-operation state through production HTTP APIs,
and visually inspected the Diagnostics & Recovery panel.

The first screenshot exposed duplicate browser list markers outside buttons that
already contained step numbers. A focused Playwright assertion for
`list-style-type: none` failed RED with the pre-fix production CSS. The minimal
CSS reset was then applied, the production web app rebuilt, and the same browser
journey passed GREEN. A second first-hand screenshot confirmed:

- all six controls are singly numbered in workflow order;
- enabled controls are consistently blue;
- unavailable controls are grey, focusable, and explained;
- all eight readiness rows, current/previous/loss labels, and the incident
  timeline are readable;
- the panel is integrated into the existing shell with no clipping, overlap,
  bad wrapping, or horizontal overflow.

The regression also passed inside the complete 44-test Playwright suite and the
fresh-copy rerun.

## Privacy, authority, and recovery verdict

- No raw prompt, transcript, persona/memory content, environment values,
  credentials, raw diffs/source, secret canaries, or absolute paths are allowed
  into exported diagnostic surfaces.
- Unprovable safety fails closed.
- Corrupt evidence is preserved before previous verified truth is projected.
- Recovery never fabricates completion, mutates repository/worktree content,
  runs destructive Git commands, auto-deletes worktrees, or kills unowned or
  protected processes.
- Exact request receipts bind apply, export, and delete replay.
- UI, API, and CLI use the same production authority.

## Preserved boundaries

- At the Phase 17 seal, Phase 15 remained unsealed solely for physical-microphone
  acceptance. That gate later passed with explicit user acceptance on 2026-07-24;
  Phase 15 is now sealed while its local STT provider remains staged and
  unactivated.
- Phase 13 Discord → World continuity remains FAIL/deferred under its existing
  waiver and was not retried.
- Phase 16 remains accepted, sealed, and complete.
- Phase 18 remains unauthorized and was not started.
- No tag, release, publication, deployment, public ingress, visibility change,
  provider activation, Hermes core/profile change, original-AgentIntersect
  operation, or tester distribution occurred.

## User acceptance and seal

All local, privacy, runtime, browser, cleanup, fresh-copy, private-push, and
exact-SHA technical gates were green before the acceptance decision. The user
then said, “Nice job fluff! Bring it home! Accepted.” Phase 17 is user accepted,
sealed, and complete.

This status-only Phase 17 closeout changed no implementation, recovery behavior,
verification evidence, privacy boundary, or artifact measurement. At that time,
Phase 15 remained unsealed solely for its physical-microphone journey. The gate
later passed and Phase 15 was explicitly sealed on 2026-07-24 without provider
promotion/activation. Phase 13 Discord → World continuity remains FAIL/deferred
under waiver, and Phase 18 remains separately unauthorized and not started. No
tag, release, publication, deployment, public ingress, visibility change,
provider activation, Hermes core change, or original-AgentIntersect operation
is authorized by either seal.
