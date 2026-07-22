# Phase 14 performance evidence

Measured locally on 2026-07-22 with Node v24.18.0, pnpm 11.15.0, Linux x64,
an AMD Ryzen 7 7800X3D, serialized Vitest, and one Playwright worker.

The deterministic protocol/service projection retained 120 raw samples for
each frozen operation. Projecting and ordering 100 events measured 0.010 ms
p95 against 50 ms. Rendering the maximum 8 KiB edit/diff projection measured
0.706 ms p95 against 50 ms. Truncating a 128 KiB test stream to a visibly
bounded 64 KiB projection measured 4.519 ms p95 against 10 ms. The retained
Node heap increment was 6.960 MiB against the 32 MiB desktop and constrained
mobile/two-CPU ceilings. The machine-readable source is
`artifacts/phase14/phase14-projection-metrics.json`.

The real desktop browser journey retained 120 unrounded semantic-DOM
render-work samples and 120 unrounded `requestAnimationFrame` cadence samples.
Render-work p95 was 0.400 ms against 16.7 ms, cadence p95 was 16.700 ms against
16.8 ms, the longest task was 0 ms, and the measured Phase 14 incremental heap
was 0 MiB against 32 MiB. The machine-readable source is
`artifacts/phase14/phase14-desktop-browser-metrics.json`.

The forced-colors, reduced-motion, touch, no-WebGL mobile/two-CPU journey also
retained both 120-sample series. It verified exactly two reported CPUs,
render-work p95 0.500 ms, cadence p95 16.800 ms, longest task 0 ms, and
incremental heap 0 MiB. The machine-readable source is
`artifacts/phase14/phase14-mobile-two-cpu-browser-metrics.json`.

The real-process preview emitted its ready record and passed strict loopback
health within the five-second target in the integrated service and browser
journeys. Each journey used the hard ten-second readiness ceiling, killed and
awaited its owned process tree, proved the preview port closed, removed its
disposable copy, and preserved the three tracked fixture hashes. The complete
trace-backed journey and inspected desktop/mobile captures are retained at:

- `artifacts/phase14/phase14-complete-journey-trace.zip`
- `artifacts/phase14/phase14-complete-journey.png`
- `artifacts/phase14/phase14-mobile-semantic-fallback.png`

The browser and deterministic evidence artifacts all report `verdict: true`.
