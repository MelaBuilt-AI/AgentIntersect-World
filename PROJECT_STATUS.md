# AgentIntersect World — Project Status

Updated: 2026-07-19

## Current milestone

**Phase 4 — World object model, deterministic identity, and layout: COMPLETE**

- Evidence: `PHASE_4_REPORT.md`, `docs/PHASE_4_SCOPE.md`, and `docs/PHASE_4_ENGINEERING.md`
- Baseline: completed Phase 3/next-marker commit `6a37c94d6c9869401a35deb08e68d6a807dbc234`
- Version: `0.4.0-phase4`
- Runtime: Node `v24.18.0`, pnpm `11.15.0`
- Workspace: 15 projects / 14 named app-package graph entries
- Focused Phase 4 tests: 4 files / 31 tests
- Complete tests: 17 files / 85 tests
- Typecheck: 20/20 tasks
- Architecture regressions: 9/9; checker reports no violations across 14 packages
- Production build: 13/13 tasks
- Playwright: 6/6
- Fresh-copy verification: complete aggregate passed for 144 project source files
- Live API: OpenAPI 3.0.3 with 14 paths; real snapshot/tile/privacy/shutdown proof passed
- Review cadence: one bounded audit, one targeted correction pass, one targeted blocker re-review, no second broad audit
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

## Next milestone

**Phase 5 — Inherited identity/dashboard shell and first repository island**

### Functionality-first objective

Use the completed Phase 4 snapshot/tile API to deliver the first useful semantic browser World and one repository island while porting only the already approved AgentIntersect identity/dashboard visual baseline into World-owned React components.

### Frozen direction

- Selected scope: **balanced shell + inherited 2D avatar + one hybrid semantic-DOM/R3F repository island**.
- Phase 5 proves the complete identify → avatar appearance → dashboard → harness intent → repository → island → inspect workflow.
- Heavy avatar/environment production waits until this functional workflow is proven.
- Future embodied avatars use one shared biped core rig and one reusable primary animation set.
- Humans, cats, dogs, and future animal species vary through modular fur, tails, ears, muzzles, paws, claws, markings, palettes, clothing, and terminal accents.
- Optional secondary tail/ear motion may exist later, but it must not require separate primary locomotion animation sets.
- Phase 5 remains 2D for avatar appearance; no Blender, 3D rig, 3D avatar animation, or broad environment-art production is authorized in this phase.

### Phase 5 entry requirements

1. Read `AGENTS.md`, `PROJECT_STATUS.md`, `PHASE_4_REPORT.md`, `docs/PHASE_4_SCOPE.md`, and the canonical Phase 5 design.
2. Freeze a bounded Phase 5 scope before implementation.
3. Freeze the one-time original-AgentIntersect visual extraction source set, provenance manifest, and SHA-256 copy checks before copying assets.
4. Preserve the frozen universal-biped avatar direction; do not begin Blender/modeling work during Phase 5.
5. Preserve the semantic DOM-equivalent workflow, keyboard/reduced-motion/high-contrast behavior, and WebGL fallback.
6. Keep Phase 6 readiness projection and Phase 7 worker execution out of Phase 5.
7. Keep original AgentIntersect unmodified and avoid recurring source dependency after the authorized one-time extraction.
8. Keep the repository private; no tag, release, package publication, deployment, or visibility change without explicit approval.

**Phase 5 direction is recorded; implementation has not started.**

## Non-blocking backlog

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
