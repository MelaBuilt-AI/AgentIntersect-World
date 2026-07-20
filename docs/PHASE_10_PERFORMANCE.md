# Phase 10 measured performance

Measured: 2026-07-20T18:46:34.402Z in the final fresh-copy verifier

Command: `corepack pnpm@11.15.0 measure:phase10`

Environment: Node `v24.18.0`, Linux x64, AMD Ryzen 7 7800X3D 8-Core Processor, 16 reported CPUs, 15,796 MiB reported host memory. The command ran serialized at the fixture level and used the production two-worker maximum.

## Node graph measurements

| Metric                  | Frozen ceiling |                                  Measured | Result |
| ----------------------- | -------------: | ----------------------------------------: | ------ |
| 10k cold graph wall     |      30,000 ms |                                577.319 ms | passed |
| 10k warm no-change wall |       8,000 ms |                                206.532 ms | passed |
| 10k peak RSS delta      |        512 MiB |                               240.203 MiB | passed |
| 100k cold graph wall    |      90,000 ms |                              4,040.260 ms | passed |
| 100k peak RSS delta     |        768 MiB |                               650.848 MiB | passed |
| Per-file hard timeout   |         500 ms | enforced constant plus timeout regression | passed |

The 500-source-file fixture declared approximately 8,000 declarations and 1,500 dependency occurrences. Including its indexed package manifest, the graph reported 501 coverage records, 498 parsed files, 7,953 accepted symbols, 1,491 resolved/preserved dependency edges, and three truthful fallbacks (malformed, unsupported, and manifest). Cold generation parsed 498 files; warm generation reused all 501 entries. Event-loop-delay max/p99 were 86.901/86.770 ms. The execution sentinel remained absent.

The 5,000-source-file fixture declared 80,000 declarations and 15,000 dependency occurrences. Including its indexed package manifest, the graph reported 5,001 coverage records, 5,000 parsed files, 80,000 accepted symbols, 15,000 dependency edges, and one manifest fallback. Cold generation parsed 5,000 files; warm generation reused all 5,001 entries and took 2,699.933 ms (no frozen 100k warm ceiling exists). Event-loop-delay max/p99 were 1,148.191/444.334 ms. These delay values are reported as measured and are not reclassified as browser main-thread results. The execution sentinel remained absent.

## Browser metrics

The serialized Chromium command `corepack pnpm@11.15.0 exec playwright test apps/web/e2e/phase10-code-graph-journey.spec.ts --workers=1` passed the three Phase 10 journeys and emitted these real measurements:

| Aggregate view | Frames | Frame p95 ceiling | Measured frame p95 | Longest-task ceiling | Measured longest task | Result |
| -------------- | -----: | ----------------: | -----------------: | -------------------: | --------------------: | ------ |
| 10k            |    120 |           33.3 ms |            16.7 ms |               100 ms |                 73 ms | passed |
| 100k           |    120 |           33.3 ms |            16.8 ms |               100 ms |                 77 ms | passed |

The Long Tasks observer was available in this Chromium run, so neither longest-task value is inferred or marked passed from an unavailable metric. Both aggregate views materialized zero whole-repository symbol rows. The focused journey also passed aggregate/focused dependency confidence, cycle and drawable/non-drawable truth, renderer bridge count, DOM symbol-row cap, semantic/WebGL-fallback selection equivalence, degraded fallback truth, overflow, and zero-console-error assertions.

Independent parent first-hand proof used the production build with its Node 24 loopback API. At 1,440 px desktop width it rendered one live WebGL canvas, one exact dependency bridge, three focused symbol instances, and truthful external non-drawable dependency metadata with zero console/page errors and equal 1,440 px client/scroll widths. At 390 px mobile width with reduced motion and WebGL disabled, the complete semantic fallback remained reachable with equal 390 px client/scroll widths and zero errors.

## Structural visible-detail bounds

Focused renderer unit evidence passed the fixed caps: at most 2,000 total prepared repository objects, 512 symbol instances, 1,024 dependency edges, and 200 semantic symbol rows. Aggregate and focused exact candidate bridges are projected into the R3F lane, while unresolved/external relationships remain explicitly non-drawable in the semantic lane. The API retains the existing 128-tile maximum and exposes no whole-repository symbol-detail route; an `allDetail` aggregate query receives a controlled 400 response. The 100k browser fixture carries counts/coverage and bounded aggregates only until one authoritative file is focused.
