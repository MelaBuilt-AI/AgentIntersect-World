# AgentIntersect World — Project Status

Updated: 2026-07-19

## Current milestone

**Phase 3 — Repository discovery and deterministic metadata indexing: COMPLETE**

- Evidence: `PHASE_3_REPORT.md`, `docs/PHASE_3_SCOPE.md`, and `docs/PHASE_3_ENGINEERING.md`
- Baseline: completed Phase 2 commit `4a75ca099ca3a5fb0d0c9638cc4eef680c1bdb03`
- Version: `0.3.0-phase3`
- Runtime: Node `v24.18.0`, pnpm `11.15.0`
- Workspace: 15 projects / 14 named app-package graph entries
- Functional apps: Vite/React operator page plus Fastify local authority server
- Focused Phase 3 tests: 4 files / 22 tests
- Complete tests: 13 files / 54 tests
- Typecheck: 19/19 tasks
- Architecture regressions: 9/9; checker reports no violations across 14 packages
- Production build: 13/13 tasks
- Playwright: 6/6
- Fresh-copy verification: complete aggregate passed for 132 source files
- Live API: 12 OpenAPI paths plus Git/non-Git create/replay/conflict/cancel/current proof
- Browser: numbered repository flow, truthful loading/error/empty/success states, zero console errors, zero desktop/mobile horizontal overflow
- Review cadence: one bounded audit, one targeted correction pass, parent targeted re-review, no second broad review
- Private remote: `https://github.com/MelaBuilt-AI/AgentIntersect-World`
- Release/tag/package publication/public visibility change: none; repository remains private

## Completed Phase 3 surface

### Repository metadata index

- Canonical `realpath` root validation for selected Git and non-Git directories
- Fixed vendor/build/cache exclusions and root `.gitignore` support for non-Git roots
- Symlink skipping without target traversal
- Sorted relative directory/file/package metadata
- Language, file-kind, binary, oversize, bounded hash, package, and Git status classification
- Safe npm/Python/Cargo/Go/Maven package names; Maven accepts only one direct project artifact
- Hardened argument-array Git branch/HEAD/status reads with no repository hooks/scripts/content execution
- Deterministic SHA-256 generation fingerprints excluding IDs/timestamps/duration

### Bounded work and lifecycle

- Default 2,500 files; hard maximum 10,000
- 2 MiB per-file and 64 MiB cumulative hash limits
- Truthful bounded `prunedEntries` observation, not an exhaustive ignored-file count
- Asynchronous progress and idempotent cancellation
- Last-good preservation after failure/cancellation
- 20 newest in-memory operation records
- Active work aborted and awaited during server close
- Manual rescan only; no watcher or restart persistence claim

### API

- `POST /repository-indexes`
- `GET /repository-indexes`
- `GET /repository-indexes/current`
- `GET /repository-indexes/:id`
- `POST /repository-indexes/:id/cancel`

### Operator flow

1. Select and index a repository root.
2. Cancel current indexing while preserving last good.
3. Review distinct Current index and Last good generation results.

The last-good card distinguishes loading, successful empty state, unavailable/invalid response, success, and recovery after a later successful index. Existing Phase 2 authority/demo operation behavior remains available.

## Verification highlights

- Disposable Git/non-Git fixtures only; no original-AgentIntersect repository indexing.
- Unchanged rescan retained its fingerprint; relevant content changes changed it.
- Package manifest remained byte-identical.
- Package-script and Git-hook sentinels remained absent.
- Git branch, HEAD, dirty state, tracked modification, and untracked status were correct.
- Cancellation preserved the exact prior last-good generation.
- Desktop 1,440 px and mobile 390 px layouts had no horizontal overflow or clipping.
- Ports and disposable Phase 3 directories were clear after testing.

## Sole audit disposition

The one audit found three Moderate blockers, all corrected in the one permitted targeted pass:

1. renamed misleading `ignoredFiles` to documented bounded `prunedEntries`;
2. constrained Maven identity to one unambiguous direct `project/artifactId`;
3. replaced false `None yet` presentation on last-good request failure with explicit loading/error state.

Cumulative hash-budget coverage and smoke setup cleanup protection were also added. Parent focused/full/browser/fresh-copy retesting is green.

## Next-session marker

**Phase 4 is the approved focus for the next session. Phase 4 implementation was not started in this session.**

A fresh session must begin by reading `AGENTS.md`, `PHASE_3_REPORT.md`, this tracker, and the canonical Phase 4 design; then freeze the smallest observable Phase 4 scope before launching any implementation worker.

## Next milestone

**Phase 4 — World object model, deterministic identity, and layout**

### Functionality-first objective

Transform the completed Phase 3 generation into versioned World objects with deterministic stable IDs and bounded deterministic layout data that can be consumed by both the future semantic 2D shell and repository island renderer.

### Phase 4 boundaries

- Consume Phase 3 outputs; do not rebuild repository traversal.
- Preserve deterministic identity across unchanged rebuilds.
- Define explicit rename/case/Unicode behavior.
- Keep absolute paths out of shareable DTOs.
- Produce bounded tiles/LOD and golden fixtures before broad semantics.
- Do not add real workers, AgentIntersect mutation, PartyKit/Yjs, public ingress, or Phase 5 browser-shell work.

Phase 4 is authorized as the next-session focus. No Phase 4 implementation was started during this closeout; the fresh session must freeze its bounded scope before coding.

## Accepted Phase 5 UX direction

The user approved reuse of the original AgentIntersect opening identity screen and dashboard visual language at the browser-shell milestone:

- `identify_` opening with a local avatar-appearance builder;
- selected original graphics copied byte-for-byte with provenance and hashes;
- inherited hero/nav/output interactions ported into World-owned React components;
- hero choices OpenClaw, Hermes, Claude Code, and Codex;
- World menus: **World, Repositories, Agents, Activity, Evidence, Settings**;
- Phase 6 adds truthful harness readiness and Phase 7 the first bounded worker action.

The original Connect/OnBoarding/Design/Control/Workers/Records menu bodies and authority are not copied. Original AgentIntersect remains unmodified and is not a routine verification dependency.

## Non-blocking backlog

### Phase 3

- Durable generation persistence and restart recovery
- Complete nested `.gitignore` behavior for non-Git roots
- Watcher/automatic rescan policy
- Browser polling retry policy after a surfaced request error

### Phase 2

- Improve generated OpenAPI response-schema fidelity where useful
- Refresh or downgrade top-level authority readiness if the server disappears after initial load

### Phase 1 tooling

- Add SIGINT/SIGTERM cleanup for externally interrupted `verify:fresh` runs

Historical items should be revisited only when their affected surfaces are deliberately touched.
