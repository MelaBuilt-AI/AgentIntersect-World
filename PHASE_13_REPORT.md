# Phase 13 closeout report

Status: **COMPLETE UNDER USER WAIVER; LIVE DISCORD → WORLD CONTINUITY DEFERRED**.

## Delivered repository slice

Phase 13 delivers the strict `aiw.world-action/0.13` protocol, a
capability-attested Hermes proposal helper, exact World-owned identity and
revision binding, bounded proposal import and persistence, atomic target
prevalidation, rename/tombstone truth, deterministic polygon-navmesh navigation
and replay, physical interaction-zone arrival checks, interruption,
supersession and cancellation, bounded trace/timeline projections, an in-island
agent marker, accessible camera/movement/fallback controls, no-WebGL semantic
equivalence, Storybook states, and browser journeys. Phase 12 chat remains
independent and available when structured actions degrade.

Focused RED→GREEN work also corrected one concrete compressed-session defect:
ordinary Hermes SSE frames remain capped at 32 KiB, while only the known
`run.completed` terminal frame may use the existing 1 MiB total-stream ceiling.
World validates terminal metadata but does not emit or persist the transcript;
520 KiB completion and 1.1 MiB rejection regressions enforce the boundary.

## Final live attempt verdict

The final retry for exact Discord root `20260722_091729_13e06549` is **FAIL**.
World resolved the exact root through the runtime-proven compression continuation
`20260722_120242_5f0f5a2f`, attached the logical session, persisted the first
World-originated user message, and observed assistant deltas. The authoritative
terminal frame then failed validation because it contained no current-turn
assistant message. No assistant-final, structured World Action proposal, visible
movement/arrival, or final World chat turn was recorded.

The retained runner state records `failureKind: product-failure`, `verdict:
fail`, expected World finals `3`, actual World finals `0`, and terminal error
`upstream_protocol_invalid`. A stale `success.json` from an earlier preflight is
not the terminal marker: its own note says the final persisted outcome remains
the existing failure. `complete.txt`, `failure.json`,
`live-acceptance-evidence.json`, `final-attempt-status.md`, and the final systemd
log agree on the failed final attempt.

Per the user's explicit final-attempt rule, this live continuation is now pinned
as deferred backlog. It was not retried, no second product correction was made,
and the live gate is not represented as green. Phase 13 is closed under the
user's waiver because the bounded local product slice and all non-live gates are
accepted; the exact-root Discord → World continuation remains a future
integration milestone.

## Verification

Node `v24.18.0` and pnpm `11.15.0` final verification passed:

- complete `pnpm check`: formatting, lint, 32/32 typecheck tasks, 11/11
  architecture tests, 438/438 Vitest tests, 17/17 builds, smoke, and 38/38
  Playwright journeys;
- Storybook production build;
- zero known production dependency vulnerabilities;
- fresh-copy install and aggregate verification across 388 copied source files;
- Phase 13 measurement/browser suite, 6/6;
- pointer-lock journey stability: 5/5 exact repeats, 5/5 fresh Playwright/Xvfb
  processes, and zero swap/OOM under the fixed 6 GiB RAM / 1 GiB swap boundary;
- final static, staged-diff, secret, and mutation-boundary review.

Machine-readable evidence retains 120 raw render-work and 120 raw cadence
samples per browser profile. Desktop 10k measured 0.20000000298023224 ms
render-work p95, 16.700000000000728 ms cadence p95, 0 ms longest task, and
2.0244522094726562 MiB incremental heap. Mobile/two-CPU 100k measured
0.8999999985098839 ms, 16.700000000000273 ms, 0 ms, and
4.91937255859375 MiB. Ready-navmesh p95 was 0.551 ms at 10k and 0.283 ms at
100k.

Instrumented controls isolated the intermittent native renderer-memory runaway
to headless Chromium while real pointer lock was held. The Phase 13 journey
therefore runs in headed Chromium under Xvfb while every ordinary Playwright
journey remains headless. Product pointer-lock behavior and acceptance criteria
are unchanged. The exact journey passed 5/5 repeats and five fresh processes
below 0.851 GiB; the complete Phase 13 suite passed 6/6 below 1.023 GiB. All
parent runs remained inside 6 GiB RAM / 1 GiB swap with zero swap and no OOM.

The retained screenshot was inspected first-hand: controls remain reachable,
active controls are blue, the disabled tour is grey and explicitly labeled,
current versus previous/recovered truth is distinct, semantic fallback does not
claim arrival, and no horizontal clipping is visible. The retained 3.64-second
video is honestly a manual control/escape demonstration, not a successful live
agent tour; that visual portion is deferred with the live integration feature.

## Safety, cleanup, and authority

World Actions did not mutate repository source or execution state during
acceptance. The original AgentIntersect repository and Hermes core were not
edited. The default Hermes config and `.env` hashes match the pre-attempt values,
the temporary plugin/runtime paths are absent, the gateway is healthy, no Phase
13 runner/listener or cron job remains, and disposable Playwright recordings
were removed while canonical Phase 13 evidence was retained.

No tag, release, package publication, deployment, public ingress, visibility
change, or Phase 14 production implementation occurred.
