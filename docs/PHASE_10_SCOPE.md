# AgentIntersect World — Phase 10 Draft Scope

Date prepared: 2026-07-20
Status: **NEXT SESSION / NOT STARTED**
Dependency: completed Phase 3 indexing pipeline, Phase 4 layout/identity, Phase 5 renderer, and Phase 9 exact-SHA closeout
Runtime baseline: Node `v24.18.0`, pnpm `11.15.0`

## Objective

Add language Tier 1 symbol and dependency structure while proving bounded performance, truthful fallback, and usable level-of-detail behavior for large repositories.

## Proposed smallest functionality-first slice

The fresh Phase 10 session must freeze a bounded vertical slice before implementation. The recommended starting shape is:

1. one exact pinned Tier 1 grammar set covering only a deliberately small language subset already represented by World-owned fixtures;
2. strict versioned symbol/import-edge schemas with deterministic opaque identity and explicit confidence/fallback states;
3. parser worker isolation with per-file byte, time, nesting, symbol, and edge ceilings;
4. safe package/import resolution that never executes selected-repository code, tools, hooks, package managers, shells, language servers, or arbitrary binaries;
5. incremental invalidation tied to the authoritative Phase 3 generation, with cancellation, last-good preservation, and file-level fallback on unsupported, unavailable, malformed, timed-out, or over-budget parsing;
6. bundled dependency edges plus focus-only symbol detail through the existing semantic DOM/R3F selection lane;
7. bounded 10,000- and 100,000-logical-object fixtures with explicit index, main-thread, frame, memory, and browser-detail budgets;
8. deterministic acceptance evidence for symbol identity, import edges, rename/invalidation, unavailable grammar, malformed/adversarial input, cancellation, fallback, LOD/culling/instancing, and no all-detail 100k rendering.

This draft is preparation only. It does not freeze the slice and authorizes no implementation.

## Canonical in-scope surface

- Pinned tree-sitter grammars and a bounded Tier 1 parser registry.
- Symbols, imports/dependency edges, confidence, and tests.
- Parser workers, timeout/cancellation, and incremental invalidation.
- Package/import resolution within strict read-only rules.
- Bundled edges and focus-only function/symbol detail.
- LOD selection, virtualization, culling, instancing, visible tile streaming, and quality auto-scaling.
- Truthful parser coverage/degraded-state UI.
- Bounded 10k/100k fixtures and repeatable performance measurements.

## Explicitly out of scope

- Perfect or whole-program call graphs.
- Executing language tooling, selected-repository code, tests, hooks, package managers, shells, LSP servers, compilers, or arbitrary binaries.
- All languages or full-detail whole-repository rendering.
- Generalized semantic editing or repository mutation.
- Cloud parser services, public ingress, internet discovery, unrelated users/agents, accounts, or multi-tenancy.
- Phase 11 avatar work or later-phase lifecycle/observability work.
- Release, deployment, publication, tags, package publication, visibility changes, or original-AgentIntersect modification.

## Fresh-session decisions to freeze before coding

1. **Tier 1 language/grammar matrix:** exact languages, grammar packages, versions, source/provenance, licenses, checksums, unavailable-grammar behavior, and update policy.
2. **Schema and identity:** symbol/import-edge schema version, opaque identity inputs, duplicate/overload handling, rename continuity, confidence values, and file-level fallback contract.
3. **Parser isolation and bounds:** worker model, maximum input bytes, parse timeout, nesting/depth, symbols/edges per file, aggregate concurrency/memory, cancellation, and malformed/adversarial behavior.
4. **Dependency resolution:** allowed manifest/import evidence, relative/package resolution rules, unresolved/ambiguous/cyclic-edge representation, and explicit prohibition on tool or repository execution.
5. **Incremental invalidation and recovery:** authoritative generation coupling, changed-file invalidation, cancellation races, cache/checksum/last-good behavior, grammar/schema migration, and degradation truth.
6. **LOD and renderer contract:** file/package/symbol levels, edge bundling thresholds, focus-only detail, culling/instancing, DOM equivalence, reduced-motion/WebGL fallback, and selection semantics.
7. **Performance budgets and fixtures:** deterministic 10k/100k fixture composition plus index latency, parser throughput, main-thread block, frame-time, memory, visible-node/edge, and browser all-detail denial thresholds.
8. **Acceptance transcript and review gate:** exact unit/integration/API/browser/performance evidence, unsupported/broken-parser fallback, rename/invalidation, no-execution canaries, and the bounded parser supply-chain review required by the canonical exit gate.

## Required artifacts when implemented

- Parser registry and bundled Tier 1 grammar provenance/lock manifest.
- Strict symbol/dependency schema and migration.
- Worker-isolated parser/index integration with bounded persistence/recovery.
- Dependency bridge and LOD renderer/projection.
- Coverage/degraded-state UI and Storybook states.
- World-owned malformed/adversarial, rename/invalidation, unavailable-grammar, 10k, and 100k fixtures.
- Repeatable performance report and parser supply-chain review.
- Phase 10 implementation report and updated project/design status.

## Acceptance boundary

Phase 10 may be called complete only when:

- the approved Tier 1 fixtures map symbols/import edges accurately;
- unsupported, unavailable, malformed, timed-out, cancelled, and over-budget parsing degrades truthfully to the authoritative file level without corrupting last-good state;
- incremental edits and renames invalidate/reuse exactly the approved surface;
- selected-repository code and tools are never executed;
- LOD/virtualization keeps the browser from attempting all-detail 100k rendering;
- approved index/main-thread/frame/memory budgets pass or threshold changes receive explicit user approval;
- semantic DOM, reduced motion, and WebGL fallback preserve equivalent status/selection truth;
- the performance report and bounded parser supply-chain review are complete;
- parent source inspection, functional proof, first-hand browser testing, complete repository gates, private commit/push, and exact-SHA CI are green.

## Restart boundary

A fresh session should read `AGENTS.md`, `PROJECT_STATUS.md`, `PHASE_9_REPORT.md`, `docs/PHASE_9_SCOPE.md`, this draft, and the canonical Phase 10 design section; verify the clean private Phase 9 closeout; refresh jCodeMunch; then freeze the smallest observable Phase 10 slice before launching one bounded implementation worker.

Do not start Phase 10 in this end-session closeout.
