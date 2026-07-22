# Phase 13 performance evidence

Measured locally on 2026-07-22 with Node v24.18.0, pnpm 11.15.0, Linux x64,
an AMD Ryzen 7 7800X3D, 16 reported CPUs, and serialized Playwright workers.

The polygon-navmesh measurement passed with 61 deterministic walkable polygons
and 110 portals: the 10k full-detail fixture measured 0.551 ms p95 against
50 ms, and the 100k aggregate-LOD fixture measured 0.283 ms p95 against
150 ms. The retained machine-readable result is
`artifacts/phase13/phase13-navigation-metrics.json`.

The approved hybrid desktop fixture passed. It retained 120 unrounded
main-thread render-work samples and 120 unrounded requestAnimationFrame cadence
intervals. Render work uses an application-owned contained DOM probe with an
alternating style-width mutation followed by a synchronous layout read; it is
measured directly and is never derived by subtracting cadence. Render-work p95
was 0.20000000298023224 ms against 16.7 ms, raw cadence p95 was
16.700000000000728 ms against 16.8 ms, the longest task was 0 ms, and
incremental heap was 2.0244522094726562 MiB. Every integrity and threshold
check in the written artifact passed.

The constrained mobile/two-CPU 100k fixture also retained both raw 120-sample
series. Render-work p95 was 0.8999999985098839 ms, raw cadence p95 was
16.700000000000273 ms, the longest task was 0 ms, incremental heap was
4.91937255859375 MiB, and whole-repository semantic/detail rows remained zero.
Its existing 33.3 ms cadence, 100 ms Long Task, and 96 MiB heap gates remain
unchanged and passed.

The fresh full check kept inherited browser boundaries green: Phase 10 measured
16.7 ms p95 / 60 ms longest task at 100k and 16.7 ms / 61 ms at 10k, while
Phase 11 rendered 12 visible avatars and 64 semantic rows at 16.7 ms p95 with a
0 ms longest task.

## Pointer-lock renderer-memory diagnosis and containment

Instrumented controls isolated the intermittent native renderer-memory growth
to headless Chromium while real pointer lock was held. A minimal static page
reproduced approximately 774 MiB of native renderer growth in 12 seconds with
WebGL disabled while JavaScript heap and DOM counts remained flat. The same
minimal pointer-lock path in headed Chromium under Xvfb remained stable at
approximately 445 MiB, with a 458.1 MiB observed peak. This evidence ruled out
the repository graph, R3F scene, camera transition, and keyboard fan-out as the
owner of the runaway.

The Playwright harness therefore keeps every ordinary journey in the canonical
unnamed headless Chromium project and isolates only
`phase13-world-action-journey.spec.ts` in a headed Chromium project executed
under Xvfb. Product pointer-lock behavior, keyboard targeting, assertions,
acceptance thresholds, and the 6 GiB RAM / 1 GiB swap boundary remain unchanged.

Parent-owned bounded verification passed:

- exact pointer-lock repeat: 5/5 in 22.3 seconds, 0.851 GiB peak;
- five fresh Playwright/Xvfb processes: 5/5, 0.826 GiB peak;
- complete Phase 13 browser spec: 6/6 in 20.8 seconds, 1.023 GiB peak;
- final complete `pnpm check`: 38/38 Playwright and 438/438 Vitest, 2.311 GiB peak;
- fresh-copy verification: 388 copied source files, 38/38 Playwright,
  2.736 GiB peak.

All bounded parent runs used zero swap and recorded no OOM kill. No browser
memory limit or acceptance threshold was increased.

The Phase 13 screenshot and short manual control/escape video are retained as
`artifacts/phase13/phase13-world-actions.png` and
`artifacts/phase13/phase13-tour.webm`. The screenshot was inspected first-hand
with no visible clipping or horizontal overflow. The 3.64-second video proves
manual camera/control and Escape behavior; it is not represented as a successful
live agent tour because the final Discord → World integration attempt failed and
that feature is deferred under the Phase 13 waiver.
