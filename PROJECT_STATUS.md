# AgentIntersect World — Project Status

Updated: 2026-07-20

## Current milestone

**Phase 8 — File diff, test evidence, and construction projection: LOCAL COMPLETE / EXACT-SHA CI PENDING**

- Evidence: `PHASE_8_REPORT.md`, `docs/PHASE_8_SCOPE.md`, and the World-owned disposable Phase 8 fixture.
- Baseline: completed Phase 7 commit `5994ee8ff51fff049de0060d30a5e589651cdcd2`.
- Version: `0.8.0-phase8`.
- Runtime: Node `v24.18.0`, pnpm `11.15.0`.
- Workspace: 15 projects / 14 named app-package graph entries.
- Complete tests: 37 files / 203 tests.
- Typecheck: 25/25 tasks.
- Architecture: 9/9 tests; checker reports no violations across 14 packages.
- Production build: 14/14 tasks; Storybook production build green.
- Smoke and complete Playwright: green; 21/21 browser tests passed with one worker.
- Fresh-copy verification: green for 245 project source files; production advisory audit found no known vulnerabilities.
- Worker fixture proof: sealed-before-mutation Git/filesystem baseline; tracked/create/delete/unique-rename/binary/redacted-secret/unreported-ambiguous/reported-unverified outcomes; exact correlated verified test artifact; restart/finalize/reload/idempotency; strict identity API; reduced-motion/WebGL fallback selection; no overflow or console errors.
- Independent parent probes corrected no-NUL binary embedding and authoritative rename-ref divergence, then passed the full gates and first-hand Evidence-to-World browser proof with zero JavaScript errors. No routine audit or re-audit ran.
- Private remote: `https://github.com/MelaBuilt-AI/AgentIntersect-World`.
- Phase 8 final private commit/push and exact-SHA CI evidence: pending closeout; the exact SHA/run is recorded externally after push to avoid a self-referential status commit.
- Release/tag/package publication/public visibility change: none; repository remains private.

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

## Phase 7 — COMPLETE

**Local command intent and real worker vertical core**

- A checksum-protected durable command-intent ledger persists immutable intent/request identity before one external mutation and represents explicit confirmed, ambiguous, rejected, and failed outcomes.
- Loopback and explicit trusted-LAN command submission require a dedicated bearer token held only in component memory; wrong authority fails before store mutation.
- World re-attests actual pinned AgentIntersect workspace/process, running phase, design revision, session, selected harness, readiness, and create-contract shape immediately before one `POST /v1/worker/jobs`.
- Identical retries replay one logical intent/job. Because pinned AgentIntersect create has no proven idempotency key, uncertain responses remain ambiguous and are not resent.
- The Phase 6 read path reconciles queued, claimed, running, complete, and failed evidence to the exact job/run while AgentIntersect alone owns claim, execution, and completion.
- The Activity panel restores durable state after reload/restart and shows the fixture-only artifact/verification with current/previous labels and truthful unavailable actions.
- Parent/live corrections made the actual pinned state/snapshot payloads compatible, enforced dual-source phase/revision evidence, bounded raw responses/logs, restored results, and stopped no-op durable churn.
- Full post-fix gates and unchanged-AgentIntersect loopback/LAN/real-job/restart/mobile proof are recorded in `PHASE_7_REPORT.md`.

## Phase 8 — LOCAL COMPLETE / EXACT-SHA CI PENDING

- Strict `aiw.evidence/0.8` baseline, change, test-truth, record, artifact, lookup, and current/previous schemas.
- Checksum-protected atomic local evidence store with retained restart baselines, last-good recovery, immutable intent identity, exact-once durable finalization, and latest-20 retention.
- Hardened read-only Git-plus-filesystem capture with 256-path, 1 MiB total, 128 KiB/file, binary metadata-only, secret-redaction, explicit truncation, and unique complete-hash rename behavior.
- Phase 7 seal-before-create and exact terminal intent/job/run finalization; one strict identity lookup API plus current/previous UI read.
- Phase 4 object/baseline/tombstone refs feed the Phase 5 repository selection/focus path and persistent DOM/R3F change markers without success-by-animation.
- Authoritative Evidence panel, Storybook states, reduced-motion/WebGL fallback equivalence, and the complete World-owned disposable acceptance fixture are green in worker verification.
- Independent parent proof is green: corrected no-NUL binary handling and authoritative rename refs, 203/203 Vitest, 25/25 typecheck, 9/9 architecture, 14/14 build, smoke, 21/21 Playwright, Storybook, zero-vulnerability production audit, 245-file fresh-copy verification, and first-hand browser selection/marker/console checks.

## Next milestone

**Phase 9 — NOT STARTED**

After private exact-SHA CI closeout for Phase 8, Phase 9 remains the next milestone. Phase 9 synchronization, file editing, rollback, generalized semantic diffs, exclusive authorship, evidence export, release/publication/public ingress, and visibility changes remain out of scope.

## Non-blocking backlog

### Phase 7

- Coordinate the pinned AgentIntersect Codex output-schema contract with the configured contemporary Codex CLI before claiming a model-backed acceptance fixture; keep the original repository unchanged unless separately authorized.
- Add create idempotency/resend only if a future pinned AgentIntersect contract proves a same-intent key.
- Enforce token/cost ceilings only when the selected harness exposes a trustworthy enforceable contract.

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
