# GPU session lifecycle — PR35 follow-up

## Authorized scope (October 6, 2026)

Aaron1557064167465287852 requested the GPU-lifecycle work in the same PR35. Reset/reselection already manually passed repeated sessions, differing repositories, multi→single, and real Claude coding (1557060898697248840). Preserve that behavior and the still-open TEST45493 build/state. Develop separately in /home/mela_ai/AgentIntersect-World-gpu; push to existing fix/reset-session-agent-release, no merge/release/provider changes.

Acceptance: explicitly release retired renderer/device resources through the actual pinned canvas teardown; release clone-owned avatar skeleton resources without disposing shared assets; inspect repository/cache ownership and fix only demonstrated gaps. Focused lifecycle regressions and conventional core gates required. Physical GPU-memory stabilization requires separate controlled human cycles: same reset/scene repeatedly, repository swaps, then avatar swaps. No scripted product journeys or modification of live session authorized.

Read-only baseline: TEST45493 owner/build/health passed; NVIDIA adapter13155 then13073MiB (12.77GiB), total16303MiB. Whole-device snapshots, not tab attribution or before/after proof. Formatted Windows per-process counters were implausible and rejected. User observes growth after transitions despite earlier hour-long idle stability.

Primary candidate: renderer-r3f world-renderer.js creates Three0.186 WebGPURenderer. Fiber9.6.1 unmount calls renderLists?.dispose and forceContextLoss?.(), not renderer.dispose. WebGPURenderer lacks forceContextLoss; its dispose releases renderer managers and owned backend/device. Secondary: SkeletonUtils-cloned avatars rendered as primitives retain clone-owned skeleton textures without explicit disposal; shared source geometries/materials/textures must remain usable. RepositoryCityInstance disposes cloned materials; loaded source model caching is not by itself a physical GPU leak.

## Implementation and verification

- `createWorldRenderer` supplies Fiber9's synchronous `forceContextLoss` teardown hook, delegating once to the renderer's asynchronous `dispose()` and reporting failures. This covers its WebGPU and WebGL2-fallback backends without modifying dependencies.
- `retainModelResources` reference-counts each cached source scene. Final release is deferred one timer turn so Strict Mode replay and same-commit reuse can cancel disposal. It releases source geometries, materials, textures and skeletons; CPU asset data and images remain reusable, and an active avatar/preview/city instance protects the source. No blanket loader-cache clear or forced GC.
- Imported-avatar clones and raw-review clones explicitly dispose their own skeleton textures. Existing mixer/batch/impostor cleanup remains; cloned city materials already had owner cleanup. Source ownership is registered in both normal imported-avatar mounts, raw review and loaded city instances.
- Renderer regression RED: actual installed Fiber canvas unmount called fixture renderer.dispose zero times. GREEN: three successive teardowns call it once each, including the fallback-backend fixture and duplicate callback.
- Real React/Fiber avatar-component test mounts two shared avatars under Strict Mode, removes one, removes the last, and reuses the cached source. Clone texture and source-resource disposal follow ownership. Removing the clone cleanup reproduces RED (zero calls rather than one); restoring it passes. Loader/GPU are fixtures, not browser/hardware evidence.
- Model-resource tests exercise real Three objects: two consumers, Strict Mode retain cancellation, final release, reusable source data and independent clone-owned bone textures.
- Full Node24.18.0 `check:core` PASS: format, lint, types, architecture, **1,624 tests / 289 files**, normal build and disposable-port API/startup smoke. Initial broad renderer invocation lacked built workspace schema output; core built the prerequisites and covered all57renderer test files. Initial lint failure corrected to explicit globalThis browser globals.
- Existing Three CommonJS deprecation and bundle-size warnings remain nonfatal. No product browser journey executed, and no physical VRAM reclamation claimed. TEST45493 remained on its prior bytes.

## Controlled hands-on retest (pending)

After authorized replacement of the retained lane with this build, record adapter baseline and keep graphics/browser/background applications fixed. Start the same agent/avatars and repository; repeat three reset/re-entry cycles, recording settled memory after each. Separately alternate two repositories without session reset; then swap avatars while keeping scene/agent count fixed. Revisit the original configuration in each sequence. Record both in-scene and post-reset/selection readings; allow delayed teardown/reclamation to settle. A stable repeatable plateau is distinct from growth each time the same configuration is revisited. Driver-wide readings alone do not allocate every byte to World.

Aaron's functional reset acceptance on the earlier PR35 build remains valid evidence; new GPU-lifecycle behavior and retained visuals/animations still need human acceptance. PR35 remains draft/unmerged; do not reload, reset, shut down or patch the existing retained session automatically.
