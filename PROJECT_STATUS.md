# AgentIntersect World — Project Status

Updated: 2026-07-19

## Current milestone

**Phase 5 — Inherited identity/dashboard shell and first repository island: COMPLETE**

- Evidence: `PHASE_5_REPORT.md`, `docs/PHASE_5_SCOPE.md`, and `docs/PHASE_5_ASSET_PROVENANCE.md`
- Baseline: completed Phase 4 commit `82ff9af0ceec4734e9b8be54e44b49697acaccc0`
- Version: `0.5.0-phase5`
- Runtime: Node `v24.18.0`, pnpm `11.15.0`
- Workspace: 15 projects / 14 named app-package graph entries
- Focused corrected-surface tests: 7 files / 24 tests; focused Playwright 12/12
- Complete tests: 24 files / 109 tests
- Typecheck: 22/22 tasks
- Architecture regressions: 9/9; checker reports no violations across 14 packages
- Production build: 13/13 tasks; Storybook production build green
- Playwright: 13/13 with five visual baselines
- Fresh-copy verification: complete aggregate passed for 202 project source files
- Asset proof: 18/18 copied files match the authorized AgentIntersect source bytes
- 10k proof: 10,000 instances, ≤160 semantic rows, 1.765 ms maximum preparation against a 250 ms threshold
- Review cadence: one bounded audit, one four-blocker correction pass, one targeted 4/4 re-review, no second broad audit
- Private remote: `https://github.com/MelaBuilt-AI/AgentIntersect-World`
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

## Next milestone

**Phase 6 — AgentIntersect read integration and normalized replay**

Phase 6 may project real read-only AgentIntersect state and events into a durable, idempotent World timeline. It must preserve the existing execution boundary: harness readiness/connection claims require verified integration state, while worker/job mutation remains disabled until Phase 7. Freeze a bounded Phase 6 contract, compatibility matrix, replay fixtures, persistence limits, and redaction/truncation rules before implementation.

## Non-blocking backlog

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
