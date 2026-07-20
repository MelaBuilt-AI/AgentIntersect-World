# AgentIntersect World — Phase 7 Completion Report

Date: 2026-07-20
Status: **COMPLETE — privately verified; exact commit/CI evidence is recorded externally after push**
Runtime: Node `v24.18.0`, pnpm `11.15.0`

## Outcome

Phase 7 adds one narrow command-authority path: an authorized loopback or explicitly trusted-LAN operator can persist and submit one bounded `worker.enqueue-phase` intent, World re-attests the pinned AgentIntersect daemon immediately before mutation, AgentIntersect alone creates/claims/runs/completes the `phase_run` job, and World reconciles the exact lifecycle and a fixture-only artifact view without launching or completing the worker itself.

The original AgentIntersect repository remained unchanged at `14c620271cd02e455d3244241de951e00ef77a4d`.

## Implemented slice

- Versioned `aiw.command-intent.request/0.7` and `aiw.command-intent/0.7` schemas.
- Checksum-protected durable intent generations with immutable intent identity/request fingerprint.
- States `pending`, `confirmed`, `ambiguous`, `rejected`, and `failed` plus queued/claimed/running/complete/failed lifecycle projection.
- `POST /commands/intents`, `GET /commands/intents`, and `GET /commands/intents/:id`.
- Dedicated in-memory bearer-token entry, constant-time token comparison, loopback policy, and explicit trusted-LAN policy.
- Fresh workspace/process, phase, revision, session, harness, readiness, and pinned-contract validation immediately before `POST /v1/worker/jobs`.
- One dispatch attempt. A lost/uncertain create response becomes durable `ambiguous` and is never automatically resent because the pinned create contract does not prove same-intent idempotency.
- Intent/correlation/phase/session/job/run mapping and Phase 6 read-path reconciliation.
- Local-only bounded raw create/final-job logs with sanitized durable/shareable diagnostics.
- Four-step Activity operator flow with reachable current/previous status, restored durable intent after reload/restart, grey unavailable controls, and the fixture-only `phase7-result.json` before/after/verification view.
- Normalization for the actual pinned AgentIntersect daemon-state and dashboard-snapshot payload shapes, including design revision derivation from the pinned plan source hash.

## Parent-discovered defects and focused corrections

The independent parent pass did not accept the implementation report as evidence. Direct source/live inspection exposed five concrete supported-workflow defects; each received a focused regression and was retested:

1. **Pinned runtime payload mismatch:** the real AgentIntersect `/v1/state` uses `currentPhaseId` plus phase/session arrays, while dashboard worker state is bucketed and the latest session is named separately. The World read facade now normalizes those real pinned shapes and cross-enriches the freshly matching snapshot revision from the daemon plan hash.
2. **Incomplete pre-mutation authority validation:** absent revision evidence or a non-running dashboard phase could pass. Both fresh sources must now identify the expected running phase, matching session, and expected revision before create.
3. **Unbounded create-response/raw-log handling:** response bodies and local raw records are now stream-bounded to 256 KiB with an explicit truncation marker.
4. **Incomplete restart/result journey:** the Activity panel now restores the latest durable intent on mount and truthfully distinguishes a complete fixture with no separate result payload from a still-pending result.
5. **No-op reconciliation churn:** repeated reads/restart reconciliation no longer rewrites unchanged intent generations, advances `updatedAt`, or recaptures the same final raw record.

No broad or routine second audit was run; the project workflow required independent parent inspection, first-hand functional testing, observed-defect fixes, and retest.

## Deterministic verification

Final post-fix local verification was green:

- Formatting: passed.
- ESLint: passed.
- Typecheck: 25/25 tasks.
- Architecture: 9/9 tests; no violations across 14 packages.
- Vitest: 32 files / 187 tests.
- Production build: 14/14 tasks.
- Smoke: passed on disposable ports.
- Playwright: 20/20 with one worker, including the bounded Phase 7 command journey.
- Storybook production build: passed.
- Fresh-copy verification: passed for 230 project source files.
- Production advisory audit: no known vulnerabilities.
- `git diff --check`: passed.

Expected large application/Storybook chunk warnings remain non-blocking local-product backlog items; no delivery/publication work was authorized.

## First-hand unchanged-AgentIntersect proof

A disposable temporary Git repository and AgentIntersect workspace were used. The real pinned AgentIntersect daemon and dashboard ran unchanged, and World attested the actual process/workspace/phase/revision immediately before create.

Observed proof:

- Loopback submission returned `202`, a durable confirmed intent, and one queued `phase_run` job.
- Identical retry returned `200` with `x-idempotent-replay: true`; AgentIntersect still reported exactly one job.
- AgentIntersect's real worker queue claimed and completed that job using a disposable offline executor owned by the AgentIntersect worker process. World did not spawn the executor or submit completion.
- The executor created exactly:

```json
{
  "message": "AgentIntersect World Phase 7 fixture complete",
  "verified": true
}
```

- World observed the same job through the Phase 6 read path, mapped it to the durable intent, and displayed `verification: passed`.
- The final intent identity/lifecycle/artifact remained byte-identical across a World server restart; the canonical record hash remained `b6c2529837a14b3bf6647e2b6eb2633d4e0e57828c5da57513ed7236d6b513bf`.
- A private-interface request to `192.168.0.40` under explicit LAN scope and the dedicated token replayed the same intent/job without mutation; a wrong token returned `401` and AgentIntersect still reported one job.
- Mobile live-browser proof restored the durable completed intent, showed the four numbered steps and fixture result before the long observation timeline, retained active-blue/disabled-grey semantics, had no horizontal overflow, and produced no console errors.
- Raw local evidence remained bounded and local; browser storage did not contain the command token.

The disposable executor intentionally performed no dependency installation and no repository/network operation. This proof establishes the unchanged AgentIntersect queue/claim/execution/completion boundary and the World authority/reconciliation path; it does not claim that the pinned AgentIntersect Codex adapter enforces the requested token/cost ceilings.

## Truthful limitations

- The pinned worker-create contract has no proven idempotency key. Ambiguous create outcomes therefore remain ambiguous until read-path evidence reconciles them; World never resends automatically.
- The pinned create contract does not expose enforceable 80k-token or `$1.00` limits. World records the requested limits but explicitly does not claim enforcement.
- The pinned AgentIntersect Codex phase executor currently supplies an output schema rejected by the configured contemporary Codex CLI. The original repository was intentionally not changed; the acceptance fixture used AgentIntersect's supported disposable executor override instead. Model-backed executor compatibility remains a separate pinned-contract/backlog item, not a reason to weaken World authority.
- Phase 7 exposes only the known fixture artifact. General repository diffs, evidence attribution, changed-object animation, and test beacons belong to Phase 8.

## Stop boundary

No release, tag, deployment, package publication, public ingress, visibility change, or Phase 8 implementation occurred. Phase 8 remains **NEXT / NOT STARTED** and requires its own scope confirmation.
