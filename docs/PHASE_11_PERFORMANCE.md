# Phase 11 avatar performance contract

The semantic editor and roster render before any optional 3D module. `AvatarScene.tsx` and `AvatarRosterScene.tsx` are dynamic imports; text-only and forced WebGL fallback paths do not import them or fetch the GLB. The 12-avatar fixture uses one canvas, one GLB load, cloned scene graphs with shared geometry/material data, and no whole-repository symbol detail.

Enforced budgets:

- initial production entry: at most 400 KiB uncompressed;
- avatar-specific lazy wrapper chunks: at most 500 KiB uncompressed;
- GLB: at most 3 MiB;
- `.blend`: at most 15 MiB;
- combined appearance and motion evidence boards: at most 4 MiB;
- visible 3D avatars: at most 12;
- semantic roster rows: at most 64;
- supported 120-frame p95: at most 33.3 ms;
- supported longest main-thread task: at most 100 ms.

Run `pnpm measure:phase11` after a production build. On hardware reporting more than two CPUs, the browser journey proves the no-fetch first-open boundary, 12 visible fixture avatars, 64 semantic rows, one shared GLB request path, 120 measured frames, mobile no-overflow, forced-colors/reduced-motion semantics, and zero serious axe findings. On hardware reporting two or fewer CPUs, avatar WebGL cosmetics are disabled in the World hero, configured roster card, and performance fixture; the GLB stays unfetched while all 12 fixture summaries, all 64 roster rows, and every lifecycle action remain semantic. Phase 10's manifest test additionally proves avatar, presentation, and repository dynamic imports remain independent.

The existing Three/R3F shared vendor chunk predates Phase 11 and remains shared with the Phase 5/10 repository renderer. The 500 KiB avatar budget is enforced against the new avatar-specific chunks, not charged again against that pre-existing shared renderer dependency; the observable startup entry and Phase 10 repository split remain independently capped.

Independent parent production build: 374.94 KiB initial entry, 0.21 KiB avatar-roster wrapper, 0.25 KiB single-avatar wrapper, and 1,727,424-byte GLB. The two evidence boards total 3,130,805 bytes. Skeleton-safe cloning stays inside the lazy avatar renderer and the GLB remains outside the entry path. Full-hardware parent sampling rendered 12 visible avatars beside 64 semantic rows for 120 frames at 16.8 ms p95 with a 0 ms longest observed task. A hard `CPUQuota=200%` reproduction with browser `hardwareConcurrency=2` rendered zero WebGL cosmetics, made no GLB request, retained all 12 fixture summaries and 64 semantic rows, and measured 16.7 ms p95 with a 0 ms longest observed task. Phase 10 measurements remained within their frozen ceilings.

Final visual-CI correction `933fdd0725bc2631821ad0a5e5c3dd7506f34d0e` keeps production quality selection unchanged while making browser evidence deterministic: low-core journeys explicitly select constrained cosmetics, the historical desktop baseline explicitly selects full cosmetics, and the true-3D journey waits for selected species/shirt first-frame readiness instead of fixed sleeps. No screenshot baseline, 0.04 cross-run allowance, frame ceiling, Long Task ceiling, or visible-avatar/semantic-row budget changed. Exact-SHA Actions run `29795954168` passed Phase 11 measurement on a two-CPU runner at 16.7 ms p95, 0 ms longest task, zero WebGL cosmetics, 64 semantic rows, and 120 frames; the later complete Playwright suite passed 28/28.
