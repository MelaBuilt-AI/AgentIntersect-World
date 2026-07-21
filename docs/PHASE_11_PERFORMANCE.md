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

Run `pnpm measure:phase11` after a production build. The browser journey proves the no-fetch first-open boundary, 12 visible fixture avatars, 64 semantic rows, one shared GLB request path, 120 measured frames, mobile no-overflow, forced-colors/reduced-motion semantics, and zero serious axe findings. Phase 10's manifest test additionally proves avatar, presentation, and repository dynamic imports remain independent.

The existing Three/R3F shared vendor chunk predates Phase 11 and remains shared with the Phase 5/10 repository renderer. The 500 KiB avatar budget is enforced against the new avatar-specific chunks, not charged again against that pre-existing shared renderer dependency; the observable startup entry and Phase 10 repository split remain independently capped.

Independent parent production build: 374.46 KiB initial entry, 0.21 KiB avatar-roster wrapper, 0.25 KiB single-avatar wrapper, and 1,727,424-byte GLB. The two evidence boards total 3,130,805 bytes. Skeleton-safe cloning stays inside the lazy avatar renderer and the GLB remains outside the entry path. Parent sampling rendered 12 visible avatars beside 64 semantic rows for 120 frames at 16.8 ms p95 with a 0 ms longest observed task; Phase 10 measurements remained within their frozen ceilings.
