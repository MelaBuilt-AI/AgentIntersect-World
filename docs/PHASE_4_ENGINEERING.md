# Phase 4 Engineering — World Projection

Phase 4 derives a shareable `aiw.world/0.4` snapshot from the already parsed Phase 3 `RepositoryGeneration`. The spatial package performs no filesystem traversal, Git calls, package parsing, child-process work, or repository mutation. The local server exposes the derived data through read-only HTTP endpoints; no browser shell or Phase 5 visual work is included.

## Versioned identity and privacy

- Snapshot schema: `aiw.world/0.4`.
- Identity algorithm: `aiw.identity/1`.
- Layout algorithm: `aiw.layout/grid/1`.
- Object IDs are the first 128 bits of SHA-256 over UTF-8 canonical inputs joined by NUL separators, with no terminal NUL. Canonical identity values containing NUL are rejected because delimiter-only tuple encoding would otherwise be ambiguous.
- References are opaque `aiw://object/<id>` values. Historical canonical references are opaque `aiw://path/<id>` values.
- The canonical Phase 3 `rootPath` participates only in a one-way private repository-key hash. It is never returned in snapshots, tiles, API failures, or checked-in output goldens.
- Operation UUIDs, timestamps, durations, and indexing progress do not affect identity or layout.

Repository-relative input paths convert backslashes to `/`, normalize Unicode to NFC, retain case, and reject absolute paths, drive-qualified paths, empty segments, `.` segments, `..` segments, and NUL. The authoritative Phase 3 schema caps repository paths at 4,096 characters, path segments and the repository display name at 512 characters, and the private root path at 4,096 characters. Sorting uses direct Unicode code-unit order rather than host locale. Two records of the same source kind that normalize to the same canonical path fail with `WorldProjectionError` code `canonical_collision`; they are never merged. Directories, files, and packages are separate source kinds because a package manifest is also a file by design.

## Rename, history, and tombstones

Same-kind, same-canonical-path files retain their ID even when content metadata changes. For removed and added files, a non-null exact content hash retains the prior file ID only when there is exactly one removed and one added candidate for that hash. The retained file appends a history entry with `confidence: "exact-content"`; a case-only spelling change also sets `caseOnly: true`.

Ambiguous hashes never select a winner. Added files receive their normal new-path IDs and removed files become tombstones. Previous snapshots participate only when their opaque repository reference matches the current private repository identity, so switching repository roots cannot donate IDs. Path history retains the newest 8 entries and tombstones retain a deterministic maximum of 256 records. Directory and package rename inference is deferred.

When a removed path reappears, its live file reclaims the historical identity and the matching tombstone is removed. A file reintroduced at a different path may likewise reclaim one tombstoned identity only through unique one-to-one exact-content evidence, with the same bounded history entry used for a live-to-live rename. Live IDs and references are always removed from the carried tombstone set, so a snapshot never emits the same identity as both live and tombstoned.

## Integer layout

Objects form a workspace → repository → directory hierarchy with files and packages attached to the nearest emitted directory; tombstones attach to the repository. Every leaf occupies a `2 × 2` integer plot. Each parent adds a one-unit border and packs direct children in a deterministic seeded horizontal strip with one-unit gaps. The seed hashes the private repository identity, repository object ID, and layout version. Emitted object order is independently canonical.

All positions and bounds are finite non-negative integers. Parent dimensions are computed from their children, then absolute placement proceeds from the workspace origin. Both passes use explicit iterative stacks, so a valid bounded hierarchy does not depend on the JavaScript call-stack limit. The construction guarantees containment and non-overlap among direct siblings without floating-point heuristics. Phase 4 accepts at most 10,000 files, 10,000 directories, and 10,000 packages and emits at most 40,512 objects including bounded tombstones.

## LOD tiles and limits

LOD levels are integers 0 through 4. Level `n` uses a fixed `2^n × 2^n` logical grid over repository bounds, so a snapshot can contain at most 341 aggregate records across all levels. Tiles count objects by kind and files by language and file kind. Keys and tiles are canonically sorted.

Tile queries require integer `lod`, `minX`, `maxX`, `minZ`, `maxZ`, and `limit`. Coordinates are 0 through 15, minima cannot exceed maxima, and the response limit is 1 through 128. Invalid library queries raise `WorldTileQueryError`; the HTTP route rejects malformed, unknown, or out-of-range parameters before projection.

The aggregate-scale proof covers exactly 100,000 logical objects while materializing no full-detail objects and at most 341 aggregate tiles. It uses the same fixed-grid count distribution and an integer strip containment proof. This is a bounded projection proof, not new repository traversal capacity; Phase 3 and full-detail projection remain capped at 10,000 files.

## API

- `GET /world/current` returns a correlated success envelope containing the strict current World snapshot.
- `GET /world/tiles` returns a correlated success envelope containing the strict bounded query and tile response.
- Both return a specific correlated 404 when no successful Phase 3 generation exists.
- Tile query validation and World projection validation failures return 400. Canonical projection collisions return 409.
- Generated OpenAPI declares both operations, required bounded query parameters, and 200/400/404/409 response meanings.

The server eagerly projects each successful Phase 3 generation into a bounded process-memory-only snapshot cache, so rename continuity does not depend on an intervening World API read. A projection failure is retained for truthful responses but does not replace the prior good projection used by a later successful transition. Repository-root changes cannot inherit identities because the projector rejects a previous snapshot with a different private repository identity. No World state is persisted, and the server does not start indexing, mutate repositories, or add any new authority.

## Determinism evidence and deferred behavior

Checked-in fixtures cover normal input, exact-content rename, case-only rename, Unicode equivalence, separator equivalence, ambiguous matches, and canonical collisions. The output golden contains both the full snapshot and a bounded tile response. A fresh-process runner serializes the same fixture twice for byte equality. Focused tests also verify strict schemas, root-path absence, containment, sibling non-overlap, 10,000-file full detail, and the bounded 100,000-object aggregate proof.

Deferred work includes richer semantic/symbol graphs, directory/package rename inference, durable snapshot migrations or persistence, alternative layout versions, render-specific objects, browser/3D/avatar work, workers, collaboration, and public ingress.
