# Phase 10 measured performance

Closed: 2026-07-20

Commands:

- `corepack pnpm@11.15.0 measure:phase10`
- `corepack pnpm@11.15.0 check`
- strict parent two-CPU pressure repetitions of the two aggregate Playwright journeys

Final exact-SHA environment: Node `v24.18.0`, Linux x64, AMD EPYC 7763, 2 reported CPUs, and 7,938 MiB host memory in private Actions run `29780316891`. The Node measurements ran serialized at fixture level and used the production two-worker maximum.

## Node graph measurements

| Metric                  | Frozen ceiling |               Exact-SHA CI measured | Result |
| ----------------------- | -------------: | ----------------------------------: | ------ |
| 10k cold graph wall     |      30,000 ms |                        1,771.195 ms | passed |
| 10k warm no-change wall |       8,000 ms |                          341.367 ms | passed |
| 10k peak RSS delta      |        512 MiB |                         244.980 MiB | passed |
| 100k cold graph wall    |      90,000 ms |                        8,690.970 ms | passed |
| 100k peak RSS delta     |        768 MiB |                         458.133 MiB | passed |
| Per-file hard timeout   |         500 ms | unchanged, post-ready dispatch only | passed |

The 500-source-file fixture plus package manifest reported 501 coverage records, 498 parsed files, 7,953 accepted symbols, 1,491 dependencies, and three truthful fallbacks. Cold generation parsed 498 files; warm generation reused all 501 entries. Event-loop-delay max/p99 were 154.534/96.403 ms. The execution sentinel remained absent.

The 5,000-source-file fixture plus package manifest reported 5,001 coverage records, 5,000 parsed files, 80,000 symbols, 15,000 dependencies, and one manifest fallback. Cold generation parsed 5,000 files; warm generation reused all 5,001 entries in 3,872.476 ms (no frozen 100k warm ceiling exists). Event-loop-delay max/p99 were 1,863.320/17.220 ms. These delay values are reported as measured and are not reclassified as browser main-thread results. The execution sentinel remained absent.

### Parser readiness correction

The first exact-SHA parser run exposed cold-worker replacement thrash because the 500 ms file timer began before checksum verification, WASM initialization, and grammar loading completed. The final pool has a separate bounded startup timeout, preloads the three unique grammars before announcing `ready`, and starts the unchanged 500 ms timer only after a ready worker accepts a task. Startup failure marks parsing unavailable once and drains queued work to truthful whole-file fallback; genuine post-readiness file timeout still terminates and replaces the worker before queued work resumes. Exact CI restored the expected 498/3 and 5,000/1 parsed/fallback counts without warming outside the measured region.

## Browser metrics

Exact-SHA CI ran serialized Chromium through `pnpm check` and emitted:

| Aggregate view | Frames | Frame p95 ceiling | Exact-CI frame p95 | Longest-task ceiling | Exact-CI longest task | Symbol rows | Result |
| -------------- | -----: | ----------------: | -----------------: | -------------------: | --------------------: | ----------: | ------ |
| 10k            |    120 |           33.3 ms |            16.7 ms |               100 ms |                 78 ms |           0 | passed |
| 100k           |    120 |           33.3 ms |            16.7 ms |               100 ms |                 56 ms |           0 | passed |

The Long Tasks observer was available, so neither exact-CI longest-task value was inferred. Diagnostics were printed before assertion enforcement. The p95 calculation remains standard nearest-rank `ceil(N×0.95)-1`, normalized only to 0.001 ms; the test still samples at least 120 real animation frames and does not use reduced motion, discard slow frames, take a best-of-N result, or weaken either ceiling.

The steady-state sample now begins after the existing semantic typewriter-complete marker, while the Long Tasks observer remains installed before navigation and still captures initialization/LOD projection. This prevents unrelated shell typing from contaminating a claim specifically named as steady aggregate-view frame time without moving startup work outside the 100 ms gate.

## Strict two-CPU parent pressure proof

Parent verification reproduced the prior CI failure by pinning browser/server children to CPUs 0–1 while one finite tracked pressure loop occupied each CPU. Before the production correction, the same harness measured 100k at 33.4 ms p95 / 124 ms longest task and 10k at 33.4 ms / 114 ms. After the correction, three serialized repetitions passed unchanged limits:

| Repetition | 100k p95 | 100k longest | 10k p95 | 10k longest |
| ---------: | -------: | -----------: | ------: | ----------: |
|          1 |  16.7 ms |        80 ms | 16.7 ms |       70 ms |
|          2 |  16.7 ms |        63 ms | 16.7 ms |       63 ms |
|          3 |  16.7 ms |        78 ms | 16.8 ms |       67 ms |

All six samples retained 120 frames and zero whole-repository symbol rows. Every pressure loop, Chromium process, Vite preview, local server, and relevant listener was stopped after proof.

## Production startup boundary

The original web build placed 1,383.34 kB (382.96 kB gzip) in one eager entry chunk. Phase 10 closeout now emits:

- entry: 359.48 kB (106.40 kB gzip);
- presentation synchronization: 113.24 kB (34.24 kB gzip), loaded through an immediate truthful Suspense lane so Phase 9 synchronization remains active;
- repository/R3F: 911.96 kB (242.89 kB gzip), loaded when the World panel is opened;
- shared world client: 0.34 kB (0.25 kB gzip).

A production-manifest regression requires presentation and repository surfaces to remain independent dynamic imports. Hardware reporting at two CPUs also activates allowed cosmetic quality scaling—static hero mark and disabled decorative halo/cursor animations—without changing selection, coverage, fallback, counts, current/previous state, semantic DOM, or reduced-motion truth. The remaining lazy repository chunk warning is non-blocking because it no longer burdens initial shell startup and is loaded only for the selected World surface.

## Structural visible-detail bounds

Focused renderer evidence retains the fixed caps: at most 2,000 total prepared repository objects, 512 symbol instances, 1,024 dependency edges, and 200 semantic symbol rows. Aggregate and focused exact candidate bridges enter the R3F lane; unresolved/external relationships remain explicitly non-drawable in the semantic lane. The API retains the 128-tile maximum and exposes no whole-repository symbol-detail route; an `allDetail` aggregate query receives a controlled 400 response.

## Final verification

The final implementation passed 294/294 Vitest, 26/26 typecheck tasks, 11/11 architecture tests, 14/14 build tasks, smoke, 25/25 Playwright, Storybook production build, a zero-vulnerability production audit, and 298-file fresh-copy verification. Private implementation SHA `5ccb0656798f27cec85512282422a5c058f992f2` passed exact-SHA Actions run `29780316891`.
