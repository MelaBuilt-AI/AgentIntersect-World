# AgentIntersect World — Phase 4 Completion Report

Date: 2026-07-19
Status: COMPLETE
Phase: World object model, deterministic identity, and layout
Baseline: `6a37c94d6c9869401a35deb08e68d6a807dbc234` (completed Phase 3 and Phase 4 marker)
Version: `0.4.0-phase4`

## Result

Phase 4 transforms the completed Phase 3 `RepositoryGeneration` into a strict, versioned, path-private `aiw.world/0.4` snapshot with deterministic `aiw://` object references, bounded rename history and tombstones, renderer-independent hierarchy/layout coordinates, and bounded aggregate tiles. The local authority server exposes the current World snapshot and tile query through read-only APIs.

Phase 4 consumes Phase 3 metadata only. The spatial projection performs no filesystem traversal, Git invocation, package parsing, child-process work, repository mutation, worker execution, or original-AgentIntersect access. No Phase 5 browser-shell, avatar, renderer, Blender, PartyKit/Yjs, public-ingress, release, or publication work entered the slice.

The phase completed its required cadence:

1. frozen `docs/PHASE_4_SCOPE.md` contract;
2. one Codex `gpt-5.6-sol`/high implementation worker;
3. parent source, deterministic, API, aggregate, browser, live-server, and fresh-copy proof;
4. one bounded read-only audit;
5. one targeted correction pass for five confirmed blockers;
6. one targeted five-blocker re-review and complete parent retest;
7. no second broad audit.

## Delivered functionality

### Versioned World DTOs

`packages/world-schema` now defines:

- `aiw.world/0.4` snapshot schema;
- `aiw.identity/1` opaque identity scheme;
- `aiw.layout/grid/1` deterministic layout scheme;
- strict workspace, repository, directory, package, file, and tombstone objects;
- opaque `aiw://object/<32 hex>` object references;
- opaque `aiw://path/<32 hex>` canonical path references;
- integer positions and positive integer bounds;
- bounded path history, child references, tombstones, tiles, and tile responses;
- strict tile query validation;
- aligned Phase 3 path/name limits at the authoritative schema boundary.

Shareable World DTOs contain repository-relative paths where needed for useful navigation, but never return the selected absolute root path or `rootPath` property.

### Deterministic identity

`packages/spatial-code-graph` derives identities with a browser-compatible SHA-256 implementation over UTF-8 canonical values joined by NUL separators, with no trailing delimiter. Embedded NUL values are rejected to prevent tuple ambiguity.

Identity behavior is explicit and tested:

- separator normalization converts `\\` to `/`;
- Unicode paths normalize to NFC;
- path case remains significant;
- unchanged paths retain their stable ID;
- a unique exact-content rename retains identity and appends bounded path history;
- case-only rename is labeled explicitly;
- ambiguous exact-content candidates do not donate identity;
- normalization collisions fail with typed `WorldProjectionError`;
- repository-root changes cannot inherit identity;
- removals produce bounded tombstones;
- same-path resurrection and unique tombstone-backed reintroduction reconcile the tombstone before the live identity is emitted;
- all output IDs/refs remain unique and parent/child references remain reciprocal.

Independent parent proof matched the expected standard-derived repository reference:

```text
aiw://object/ee0c463b51663994a938e656bad37981
```

### Deterministic layout and tiles

The projector creates renderer-independent layout data for workspace → repository → directory/package/file/tombstone hierarchy.

- Direct children are deterministically ordered and packed without overlap.
- Parent bounds contain descendants.
- Layout uses iterative measure and placement stacks, avoiding call-stack dependence for deep valid hierarchies.
- Full-detail projection remains capped at 10,000 files and 10,000 records per supported metadata collection.
- Every snapshot contains LOD 0–4 tile aggregates with counts by kind, language, and file kind.
- Tile coordinates remain within a fixed 16×16 grid.
- Tile responses return at most 128 records in deterministic order.
- A bounded arithmetic proof covers exactly 100,000 logical aggregate objects while materializing zero full-detail objects and at most 341 aggregate tiles.

### Golden and fresh-process determinism

Checked-in fixtures cover:

- normal projection;
- separator equivalence;
- Unicode equivalence;
- canonical collisions;
- deterministic rename;
- case-only rename;
- ambiguous rename;
- serialized snapshot and tile output.

Repeated fresh-process runs serialize byte-identically. Golden outputs contain no selected absolute root path.

### Process-memory continuity

The local `RepositoryIndexService` now invokes a bounded successful-generation listener. The server eagerly projects each successful Phase 3 generation so rename continuity does not depend on an intervening `/world/*` read.

- Unchanged successful transitions remain deterministic.
- Repository-root switches cannot donate prior identity.
- Projection failures return truthful errors but do not poison the prior good snapshot used by later recovery.
- World state remains process-memory-only; no persistence claim was added.

### Read-only World API

Added:

- `GET /world/current`
- `GET /world/tiles?lod=&minX=&maxX=&minZ=&maxZ=&limit=`

Both use correlated strict response envelopes and advertise the supported 200/400/404/409 statuses in OpenAPI. The generated OpenAPI document remains 3.0.3 and now contains 14 application paths.

The Phase 3 repository indexing and browser workflows remain intact. Phase 4 does not yet add a World browser panel; that semantic shell and first repository island belong to Phase 5.

## Frozen limits

| Limit                        |                                Value |
| ---------------------------- | -----------------------------------: |
| Repository/full-detail files |                               10,000 |
| Directories                  |                               10,000 |
| Packages                     |                               10,000 |
| Path length                  |                     4,096 characters |
| Path segment/object name     |                       512 characters |
| Path history per file        |                            8 entries |
| Tombstones                   |                                  256 |
| LOD levels                   |                                  0–4 |
| Tile grid                    |                                16×16 |
| Tile response                |                            128 tiles |
| Aggregate proof              | 100,000 logical objects / ≤341 tiles |

## Parent verification

All commands used Node `v24.18.0` and pnpm `11.15.0`.

| Verification               | Final result                                               |
| -------------------------- | ---------------------------------------------------------- |
| Focused Phase 4 tests      | 4 files / 31 tests, green                                  |
| Formatting                 | Prettier, green                                            |
| Lint                       | ESLint, green                                              |
| Typecheck                  | 20/20 Turborepo tasks, green                               |
| Architecture checker       | 14 packages, no violations                                 |
| Architecture regressions   | 9/9, green                                                 |
| Complete Vitest suite      | 17 files / 85 tests, green                                 |
| Production build           | 13/13 tasks, green                                         |
| Disposable smoke           | Phase 3 authority/index/no-execution plus built web, green |
| Playwright                 | 6/6, green                                                 |
| Fresh-copy verification    | complete aggregate green for 144 project source files      |
| `git diff --check`         | green                                                      |
| Targeted blocker re-review | 5/5 PASS; no correction-introduced blocker                 |

### Independent identity and lifecycle proof

Parent-created reproduction proved:

```json
{
  "duplicateIds": [],
  "restoredKinds": [],
  "customRepositoryRef": "aiw://object/ee0c463b51663994a938e656bad37981",
  "expectedRepositoryRef": "aiw://object/ee0c463b51663994a938e656bad37981",
  "sha256MatchesNode": true
}
```

### Real HTTP proof

A real loopback Fastify listener on a disposable port indexed a disposable repository, then served the World snapshot and tiles:

```text
health: 200
repository-index create: 202
index terminal status: succeeded
/world/current: 200, aiw.world/0.4
/world/tiles: 200
snapshot objects: 4
snapshot tiles: 9
returned tiles: 2
OpenAPI paths: 14
/world/current statuses: 200/400/404/409
/world/tiles statuses: 200/400/404/409
absolute root/rootPath leak: false
listener refused requests after close: true
```

The disposable repository was deleted after verification.

## Sole audit and correction

The one read-only audit initially returned FAIL for five supported contract violations:

1. a recreated file could coexist with its retained tombstone under the same ID/ref;
2. canonical digest encoding appended a trailing NUL and did not match the documented delimiter-only SHA-256 contract;
3. lazy projection lost rename continuity when successful generations changed before any World endpoint was read;
4. Phase 3 accepted overlong/deep shapes that could fall through to untyped Zod or call-stack failures in World projection;
5. `/world/current` could return 400 while OpenAPI omitted that status.

The one targeted correction pass:

- reconciled live identities against same-ID tombstones and added reciprocal/unique hierarchy regressions;
- removed the trailing delimiter, added independent Node SHA-256 vectors, rejected embedded NUL, and regenerated goldens;
- eagerly projected every successful generation through the service listener while preserving prior good state on projection failure;
- aligned authoritative path/name limits, wrapped projection validation as typed errors, and made layout iterative;
- synchronized actual and advertised World endpoint statuses.

Parent reproduction, focused/aggregate/live/fresh-copy tests, and one targeted five-item re-review all passed. No second broad audit ran.

## Deferred non-blocking scope

- `WorldSnapshotSchema` validates strict DTO shape but does not independently refine every relational invariant; production snapshots are generated internally and focused tests enforce the current graph invariants.
- OpenAPI response bodies remain intentionally broad objects; current status metadata and runtime Zod envelopes are truthful.
- The 100,000-object arithmetic proof is bounded and deterministic but is not a full materialized 100,000-object benchmark.
- World snapshots/history remain process-memory-only and do not survive server restart.
- Existing Phase 3 caveats remain: root-only non-Git `.gitignore`, manual rescan, bounded observed prune counts, and no automatic watcher.
- Symbols, dependency/call graphs, browser World shell, repository island rendering, avatar work, AgentIntersect read/mutation integration, multiplayer, and persistence remain later phases.

## Scope and repository compliance

- Original AgentIntersect was not inspected or modified during Phase 4 implementation, audit, correction, or parent verification.
- No selected repository scripts, hooks, binaries, package managers, shells, or arbitrary commands executed.
- No Blender files, scripts, models, images, or videos were created.
- No GitHub visibility, tag, release, deployment, or package publication action occurred.
- AgentIntersect World remains private.

## Next milestone

**Phase 5 — Inherited identity/dashboard shell and first repository island.**

Phase 5 has not started. Before implementation it must freeze the bounded source extraction/provenance manifest, avatar embodiment/rig decision, browser-shell acceptance evidence, and first repository-island scope. The approved original-AgentIntersect visual inheritance and Blender pipeline remain deferred until that explicit Phase 5 start.
