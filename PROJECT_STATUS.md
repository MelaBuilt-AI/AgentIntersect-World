# AgentIntersect World — Project Status

Updated: 2026-07-19

## Current milestone

**Phase 6 — AgentIntersect read integration and normalized replay: COMPLETE**

- Evidence: `PHASE_6_REPORT.md`, `docs/PHASE_6_SCOPE.md`, and World-owned Phase 0 compatibility fixtures
- Baseline: completed Phase 5 commit `344e73d24bdc18f7dcc7e9dc22ec7952eb2960f2`
- Version: `0.6.0-phase6`
- Runtime: Node `v24.18.0`, pnpm `11.15.0`
- Workspace: 15 projects / 14 named app-package graph entries
- Focused B1–B6 correction tests: 6 files / 64 tests passed serially
- Complete tests: 30 files / 174 tests passed
- Typecheck: 25/25 tasks
- Architecture regressions: 9/9; checker reports no violations across 14 packages
- Production build: 14/14 tasks; Storybook production build green with five Phase 6 states
- Smoke and complete Playwright: green; 19/19 browser tests passed with one worker
- Fresh-copy verification: green for 222 project source files; production advisory audit found no known vulnerabilities
- Review cadence: the historical bounded audit found B1–B6; one correction pass plus independent parent and first-hand proof are green. No routine targeted re-audit is required; audit only for a concrete observed issue or explicit user request
- Private remote: `https://github.com/MelaBuilt-AI/AgentIntersect-World`
- Exact final commit/CI evidence: recorded in the Phase 6 Obsidian concept and latest handoff after private push, avoiding a self-referential status commit
- Release/tag/package publication/public visibility change: none; repository remains private

## Completed Phase 4 surface

### Versioned World schema

- `aiw.world/0.4` snapshots
- `aiw.identity/1` opaque deterministic identity
- `aiw.layout/grid/1` renderer-independent layout
- Strict workspace, repository, directory, package, file, tombstone, tile, and query DTOs
- Opaque `aiw://object/<id>` and `aiw://path/<id>` references
- No selected absolute root or `rootPath` in shareable snapshot/tile DTOs

### Deterministic identity and lifecycle

- Browser-compatible standards-matching SHA-256 over NUL-separated canonical values
- Separator normalization, NFC normalization, and case-sensitive paths
- Stable unchanged-path IDs
- Unique exact-content rename donation with bounded path history
- Explicit case-only and ambiguous-rename behavior
- Typed normalization collision failures
- Bounded tombstones with deterministic resurrection/reintroduction reconciliation
- Repository-root isolation
- Eager successful-generation projection so rename continuity does not require an intermediate World API read
- Prior good snapshot preserved through projection failure for later recovery

### Layout and bounded LOD

- Deterministic hierarchy ordering and non-overlapping child packing
- Iterative stack-safe measure/place traversal
- Parent containment and reciprocal parent/child references
- Full-detail maximum: 10,000 files
- LOD 0–4 on a fixed 16×16 tile grid
- Maximum tile response: 128
- Bounded 100,000-logical-object aggregate proof with zero full-detail materialization and at most 341 tiles
- Byte-identical golden and fresh-process outputs

### API

- `GET /world/current`
- `GET /world/tiles?lod=&minX=&maxX=&minZ=&maxZ=&limit=`
- Correlated strict runtime envelopes
- Truthful 200/400/404/409 OpenAPI status metadata
- Existing Phase 2 authority and Phase 3 repository-index APIs remain intact

## Verification highlights

- Independent SHA-256 proof matched `aiw://object/ee0c463b51663994a938e656bad37981`.
- Recreated/reintroduced files produced no duplicate live/tombstone IDs or refs.
- A valid maximum 2,048-level hierarchy projected deterministically without stack overflow.
- 10,000-file full-detail and 100,000-object aggregate bounds passed.
- Real loopback HTTP proof indexed a disposable repository and returned a path-private `aiw.world/0.4` snapshot and tiles.
- OpenAPI advertised exactly the statuses exercised by both World endpoints.
- Listener refused requests after clean close.
- Fresh-copy install and complete aggregate verification passed for 144 source files.
- Original AgentIntersect was not inspected or modified; no Blender/graphics work occurred.

## Sole audit disposition

The one bounded audit confirmed five blockers, all fixed in the one permitted correction pass:

1. reconciled same-ID live objects and retained tombstones;
2. corrected trailing-NUL SHA-256 canonical encoding and regenerated goldens;
3. preserved rename continuity across unobserved successful generations;
4. aligned path/name limits, typed projection failures, and made layout iterative;
5. synchronized World runtime/OpenAPI status metadata.

The targeted five-blocker re-review returned PASS for all five and found no correction-introduced critical blocker. Parent focused, aggregate, real-HTTP, Playwright, and fresh-copy retesting is green. No second broad audit ran.

## Phase 5 — COMPLETE

**Inherited identity/dashboard shell and first repository island**

Phase 5 completed the balanced vertical slice recorded in `PHASE_5_REPORT.md`, `docs/PHASE_5_SCOPE.md`, and `docs/PHASE_5_ASSET_PROVENANCE.md`.

- The first-open `identify_` flow now leads through a locally persisted inherited 2D avatar builder and bounded transition into the dashboard.
- The World-owned shell preserves the approved hero/typewriter/cursor language, exact category taxonomy, persistent status/results area, and truthful default/current harness intent selection.
- Existing Phase 2 authority and Phase 3 repository-index flows remain reachable and recover running/recent operations across panel close/reopen.
- The Phase 4 snapshot/tile API powers one hybrid semantic-DOM/R3F repository island with instancing, synchronized selection, search, keyboard focus, inspector, overview/minimap, WebGL fallback, and absolute-path redaction.
- Exactly 18 selected inherited graphics were copied byte-identically from the authorized AgentIntersect commit; the original repository remained clean.
- Storybook states, five visual baselines, axe, reduced-motion, forced-colors, mobile-overflow, unsupported-language, context-loss, and measured 10k-instance evidence are green.
- One bounded audit found four blockers; one targeted correction resolved all four, and the targeted re-review returned PASS with zero residual blockers. No second broad audit ran.
- Workspace/runtime version is `0.5.0-phase5`; the repository remains private with no tag, release, deployment, package publication, or visibility change.

## Phase 6 — COMPLETE

**Read-only AgentIntersect integration and normalized replay**

- A narrow compatibility facade now attests the pinned health/workspace/process contract and reads daemon state, dashboard snapshot/feed, and dashboard SSE without exposing mutation authority.
- `aiw.event/0.6` supplies stable source/fallback event IDs, stable animation IDs, deterministic cross-source order, bounded hostile-data redaction/truncation, identifier mapping, and phase-board/roster/timeline projection.
- Node 24 SQLite owns transactional dedupe, source/checkpoint metadata, and reducer checkpoints; an append-oriented JSONL accepted-event ledger replays byte-identically and fails closed on a corrupt or partial tail while retaining the verified prefix.
- Startup/reconnect reconciliation preserves last-good state across offline, stale, mismatch, SSE gap/reset/overflow, and bounded-backpressure conditions.
- Strict GET-only local-server routes expose integration, phase-board, roster, timeline, replay/reconciliation, and selected-harness readiness projections. No Phase 6 mutation route exists.
- The Phase 5 shell shows ready/offline/stale/mismatch/error truth, current versus previous/replayed labels, bounded diagnostics, disabled grey observation-only execution controls, and desktop/mobile-accessible projection views.
- Local formatting, lint, typecheck, architecture, focused/aggregate tests, production build, smoke, browser, Storybook, advisory, and clean-copy gates are green.
- The sole bounded audit's B1–B6 findings received the one authorized targeted correction: authoritative latest observations are separate from deduplicated timeline identity; replay/checkpoint/crash ordering is fail-closed; nested contracts and streamed caps are pinned; the expanded redaction matrix is enforced through replay/storage/API/display; periodic freshness and SSE recovery have a clean lifecycle; and the stale Phase 5 browser assertion is corrected.
- Local correction verification and independent parent proof are green: focused 64/64, complete Vitest 174/174, typecheck 25/25, architecture 9/9, build 14/14, smoke, Playwright 19/19, Storybook, production advisory audit, 222-file fresh-copy verification, live A→B→A/restart/reconnect/malformed/oversized/redaction/disabled-execution proof, and desktop/mobile first-hand browser checks with zero console errors or horizontal overflow. No routine targeted re-audit was required.

## Next milestone

**Phase 7 — Local command intent and real worker vertical core: NEXT / NOT STARTED**

Preparation lives in `docs/PHASE_7_SCOPE.md`. In a fresh session, freeze the exact intent schema, host-only mutation route, bounded real-job fixture, timeout/cost ceiling, and acceptance transcript before coding. The proposed vertical slice validates one durable idempotent `worker.enqueue-phase` intent, re-attests AgentIntersect immediately before `POST /v1/worker/jobs`, reconciles ambiguous creation without duplicate dispatch, and observes the exact queued/claimed/running/complete/failed lifecycle through the Phase 6 read path.

Phase 7 implementation has not started. Browser/harness spawning, LAN workers, multiple simultaneous jobs, World-owned completion submission, lifecycle controls, Phase 8 diff/evidence work, and all release/publication/public-ingress actions remain out of scope.

## Non-blocking backlog

### Phase 6

- Split the large web/Storybook chunks when production delivery becomes active.
- Add ledger segment rotation/checksums only when retention requirements exceed the bounded Phase 6 single-ledger slice.
- Keep mutation authority, worker launch/claim/complete, and external configuration/authentication writes deferred to Phase 7 or later.

### Phase 5

- Distinguish tile loading/unavailable states from a truthful zero-tile result.
- Move WebGL capability probing out of React render and add explicit Three resource disposal before renderer remount/update frequency grows.
- Add optional GPU-frame/readback instrumentation for the 10k browser fixture when renderer performance work begins.
- Split the large web/Storybook chunks when production delivery, rather than local functional proof, becomes the active milestone.

### Phase 4

- Add independent relational refinements to `WorldSnapshotSchema` if snapshots become externally authored.
- Improve generated OpenAPI response-body fidelity where useful.
- Replace or supplement the bounded 100,000-object arithmetic proof with a materialized benchmark when performance work begins.
- Durable World snapshot/history persistence and restart recovery.

### Phase 3

- Complete nested `.gitignore` behavior for non-Git roots.
- Watcher/automatic rescan policy.
- Browser polling retry policy after a surfaced request error.
- Durable repository generation and operation-history persistence.

### Phase 2

- Refresh or downgrade top-level authority readiness if the server disappears after initial load.

### Phase 1 tooling

- Add SIGINT/SIGTERM cleanup for externally interrupted `verify:fresh` runs.

Historical items should be revisited only when their affected surfaces are deliberately touched.
