# AgentIntersect World — Phase 4 Scope

Date: 2026-07-19
Status: FROZEN FOR IMPLEMENTATION
Phase: World object model, deterministic identity, and layout
Baseline: `6a37c94d6c9869401a35deb08e68d6a807dbc234`
Runtime: Node `v24.18.0`, pnpm `11.15.0`
Risk tier: Standard — deterministic derived-data/API work with no repository mutation or external authority

## Delivery contract

Use the project’s functionality-first cadence:

1. one Codex `gpt-5.6-sol`/high implementation worker using vertical RED→GREEN slices;
2. parent inspection and focused/full/type/build/live/fresh-copy proof;
3. one fresh bounded read-only audit;
4. at most one targeted correction pass for confirmed blockers;
5. parent retest, documentation, private commit/push, and CI verification;
6. stop without a second broad audit.

A review finding blocks only when it demonstrates a supported execution path to wrong deterministic identity/layout, schema/API incompatibility, unbounded normal operation, path disclosure, valid-input crash/hang, data corruption, or a direct acceptance-criterion violation. Unsupported platforms, speculative public-internet actors, broad hardening, rich graph semantics, and later-phase product suggestions are non-blocking backlog.

## Smallest observable vertical slice

Transform the current successful Phase 3 `RepositoryGeneration` into a versioned, shareable, deterministic World snapshot and bounded LOD tile views. Expose the current snapshot and tile query through read-only local-server APIs so future semantic 2D and Phase 5 repository-island consumers share the same authoritative data.

## Exact implementation surface

### `@agentintersect-world/world-schema`

Add strict Zod schemas and exported TypeScript types for:

- schema/version literals for the Phase 4 snapshot and layout algorithm;
- opaque `aiw://` object references;
- workspace, repository, directory, file, package, and tombstone World objects;
- deterministic bounds/positions and hierarchy relationships;
- rename/path-history metadata with explicit confidence;
- aggregate LOD tiles and tile-query responses;
- path-private World snapshot and current-snapshot API payloads.

Shareable schemas must reject unknown fields and must not contain `rootPath`, absolute paths, or other host-local path fields.

### `@agentintersect-world/spatial-code-graph`

Replace the skeletal capability with a World projection implementation that:

- consumes a parsed Phase 3 `RepositoryGeneration`; it must not read the filesystem, invoke Git, or rebuild traversal;
- builds deterministic opaque IDs and `aiw://` references from versioned canonical identity inputs;
- normalizes input separators to POSIX and Unicode to NFC before identity/layout decisions;
- keeps path matching case-sensitive;
- detects and rejects canonical-path collisions, including separator/Unicode-normalization collisions;
- optionally consumes a previous snapshot for deterministic rename/tombstone projection;
- retains identity for an unchanged path and for one unambiguous exact-content rename;
- treats ambiguous exact-content matches as new objects rather than guessing a rename;
- records case-only renames explicitly when unique exact-content evidence exists;
- produces stable hierarchy objects, deterministic bounds, positions, and seeded district/block/building placement;
- produces bounded deterministic LOD tiles and supports bounded tile queries;
- avoids overlap for emitted layout bounds and validates containment;
- never includes the source absolute root path in the returned snapshot or tile DTOs.

The identity/layout algorithm is versioned. Same input, options, previous snapshot, and version must serialize byte-for-byte identically across repeated processes. IDs and positions may change only when their documented identity/layout inputs or algorithm version change.

### `@agentintersect-world/local-server`

Add read-only World projection APIs over `RepositoryIndexService.current()`:

- one endpoint for the current World snapshot;
- one bounded endpoint/query for LOD tiles.

Requirements:

- return the existing correlated API envelope and strict Phase 4 schemas;
- return a truthful not-found response when no successful Phase 3 generation exists;
- reject malformed/out-of-range tile queries before projection;
- do not start indexing, mutate repositories, persist World state, or expose `rootPath`;
- add the operations to generated OpenAPI with truthful request/response metadata.

No Phase 4 browser-shell or graphics UI is added. Live HTTP JSON is the observable operator/developer surface for this phase.

### Fixtures, tests, and documentation

Add:

- golden repository-generation fixtures covering normal, rename, case-only rename, Unicode normalization, separator normalization, ambiguity, and collision behavior;
- golden serialized snapshot and tile outputs;
- focused schema, identity, rename, layout, containment, bounds, tile-query, API, and path-privacy regressions;
- a representative 10,000-file full-detail input and a 100,000-object aggregate/layout benchmark or proof that remains bounded and completes without materializing unbounded tile responses;
- deterministic fresh-process comparison using serialized outputs;
- `docs/PHASE_4_ENGINEERING.md` describing identity, normalization, rename confidence, layout/LOD algorithm, limits, API, and deferred behavior;
- final `PHASE_4_REPORT.md`, `PROJECT_STATUS.md`, design milestone update, and version/package metadata only after parent verification and audit disposition are known.

## Frozen identity and rename semantics

1. Convert repository-relative separators to `/` and normalize each path to Unicode NFC.
2. Treat canonical paths as case-sensitive.
3. Reject two live input records that collapse to the same canonical path after separator/Unicode normalization.
4. Same object kind plus same canonical path retains the same identity.
5. A removed file and added file with the same non-null exact content hash form a rename only when the match is one-to-one.
6. A unique exact-content rename retains the prior file ID and records the old canonical reference in bounded path history with `confidence: "exact-content"`.
7. A unique case-only rename follows the same rule and is marked explicitly.
8. Ambiguous matches never guess: removed prior objects become bounded tombstones and added records receive new IDs.
9. Directory/package rename inference beyond deterministic same-path identity is deferred unless it falls directly out of a uniquely renamed file hierarchy without ambiguity.
10. Tombstones and path history are bounded by constants documented in code and engineering notes.

## Frozen layout and LOD semantics

- Layout seed is derived from the versioned repository/world identity and explicit layout version, never timestamps or operation IDs.
- Object ordering is canonical and deterministic before packing.
- Repository → district; top-level hierarchy → blocks; directories/packages/files → bounded buildings/plots appropriate to their object kind.
- Bounds are finite, non-negative in size, contained by their parent, and collision-free within the emitted sibling set.
- Full-detail output remains capped by the Phase 3 10,000-file limit.
- LOD tiles aggregate counts by kind/language/file kind and return a deterministic bounded number of records per query.
- Tile requests have explicit integer LOD/range/limit bounds and stable ordering.
- No renderer-specific Three.js/R3F objects enter shared schemas.

## Acceptance criteria

1. A valid Phase 3 generation produces a strict `aiw.world/0.4` snapshot containing versioned workspace/repository/hierarchy objects, deterministic layout, and bounded tiles.
2. Repeated fresh-process builds from identical input/options serialize identically, including IDs, ordering, positions, bounds, aggregates, and tile responses.
3. Same-path objects retain identity; unique exact-content and case-only file renames retain identity with explicit history/confidence; ambiguous matches never guess.
4. `/` and `\\` fixture forms normalize identically; NFC/NFD forms normalize identically; canonical collisions fail with a typed error instead of silently merging objects.
5. Shareable snapshot, tile, golden, API, log, and error payloads contain no absolute source root path.
6. Emitted child bounds are finite, contained, and non-overlapping for representative, 10,000-file, and aggregate-scale fixtures.
7. Tile queries are deterministic and bounded; invalid or oversized requests fail predictably.
8. The live local server returns correlated current-snapshot and tile responses from the last-good Phase 3 generation, returns truthful not-found without one, and advertises the routes in OpenAPI.
9. Existing Phase 1–3 APIs, indexing behavior, browser flow, tests, architecture rules, build, and fresh-copy verification remain green.
10. No selected repository content executes or mutates, no original AgentIntersect file is inspected or changed, and no Phase 5 graphics/avatar/browser-shell work appears in the diff.

## Authoritative verification

Run with Node `v24.18.0` and pnpm `11.15.0`:

- focused Phase 4 schema/spatial/server tests;
- golden fixture equality and a fresh-process deterministic serialization check;
- 10,000-file and 100,000-object bounded aggregate/layout proof;
- `corepack pnpm@11.15.0 format:check`;
- `corepack pnpm@11.15.0 lint`;
- `corepack pnpm@11.15.0 typecheck`;
- `corepack pnpm@11.15.0 check:architecture`;
- `corepack pnpm@11.15.0 test`;
- `corepack pnpm@11.15.0 build`;
- live local-server health/OpenAPI/snapshot/tile/no-generation/privacy proof;
- `corepack pnpm@11.15.0 smoke`;
- `corepack pnpm@11.15.0 test:e2e` to prove the unchanged Phase 3 browser path;
- `corepack pnpm@11.15.0 verify:fresh`;
- `git diff --check` and final process/listener/temp cleanup.

## Explicit non-goals

- No filesystem traversal, Git inspection, package parsing, watch/rescan, or persistence replacement.
- No symbols, ASTs, imports, dependencies, call graphs, or rich semantic graph.
- No 3D/R3F rendering, browser World shell, avatar work, Blender work, inherited AgentIntersect graphics, animation, physics, or XR.
- No workers, harness execution, AgentIntersect mutation, event replay, PartyKit/Yjs, unrelated users, public ingress, cloud service, or internet collaboration.
- No durable migration system beyond versioned fixture/schema compatibility and documented future migration metadata.
- No releases, tags, package publication, public visibility change, or original AgentIntersect modification.

## Approval boundary

The user authorized Phase 4 implementation and normal private commit/push after the frozen acceptance gates pass. Releases, tags, publication, public visibility changes, Phase 5 visual extraction, and changes to original AgentIntersect remain separately approval-gated.
