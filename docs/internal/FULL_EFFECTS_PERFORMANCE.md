# Full-quality four-agent performance pass

Authorized October 4, 2026 by Aaron (Discord 1556315230492037273).

## Scope

- One new performance PR from merged main b9c8249, separate checkout `perf/world-full-effects`.
- Target real Clone test repository city with four agents, all graphics effects ON, unchanged full visual quality.
- Reduce steady-state rendering overhead and subtle frame pacing stalls based on source and real native baseline evidence.
- Preserve effect density, resolution/DPR, MSAA, reflection resolution, shadow quality, assets, animation cadence, and normal behavior.
- Keep populated TEST45487 intact; no refresh/navigation/reset/build-output change or native-agent dispatch in it.
- No dependency changes, provider/profile changes, speculative hardening, merge, release or publication.
- Conventional focused regressions and full core gate, exact-head CI; native read-only observation and human visual/performance review, not scripted product-navigation journeys.

## Baseline

Read-only native Edge observation captured a settled repository floor, 49 rendered city objects, four agents plus user (five live full-quality avatars), WebGPU r186, DPR1, bloom/reflections/MSAA on. Viewport1912x948, devicePixelRatio2, hardwareConcurrency16. User reports all graphics controls ON and poor FPS/subtle stutter. No input/navigation by Mr Fluff.

20-second CPU-profiled RAF sample:1065 callbacks, p50 16.7ms/p95 33.2ms/p99 33.4ms/max50.1ms, one gap>50ms. These are CPU-profiled callback intervals, not GPU-presented FPS or an unprofiled speed baseline. CPU stack is dominated by main/nested render passes, per-object draw submission and WebGPU uniform uploads; reflected sun/shadow rendering is significant. Evidence in ~/.hermes/runs/aiw-full-effects-20261004/.

## Implemented changes

- Batch compatible opaque skinned parts only in the full-quality World live-model path. Preserve source geometry attributes, material identity, skeleton/bind matrices, animations, hidden parts and shadow flags; creator previews remain independently pickable. Layout-effect setup/cleanup supports remount without mutating cached source assets.
- Keep animation observation at its existing cadence, but write role-scoped DOM evidence directly instead of reconciling the complete city through React state for each sample.
- Update repository status/selection emissive tint when its inputs change rather than on every frame.
- Use a single double-sided draw for crossed additive light-shaft/rain planes instead of separate front/back draws. Shader formulas, density and effect settings are unchanged.

Read-only live props confirmed all eight graphics toggles true and these exact models: `user-male-01`, `cat-agent-01`, `cat-agent-02`, `dog-agent-02`, `robot-agent-02`. Their source mesh primitive counts are respectively 14, 13, 61, 56 and 15 (159 total). The real-asset test verifies one compatible batch per asset (five for this roster). This is a geometry/draw-owner reduction, **not a measured total frame draw count or FPS improvement**. Whole-avatar batching also trades fine-grained part culling for fewer submissions and allocates merged geometry for the mounted avatar.

## Verification and limits

- Focused regressions: 6 passed, including all 23 shipped GLBs, sampled vertex skinning across every source animation clip, hidden-part preservation, material/geometry preservation and disposal/remount. The Node geometry/rig test deliberately omits image decoding; it does not prove rendered texture/shadow equivalence.
- Full unit/integration/component suite: 1,601 tests passed in 280 files.
- Formatting, lint, TypeScript, architecture, normal production build and disposable startup/API smoke passed under Node 24.18.0.
- Avatar verification and current imported-asset input verification passed; source assets and dependency lockfile are unchanged.
- Populated TEST45487 remains the baseline, not the candidate. No candidate refresh, agent dispatch or served-build replacement was performed in it.
- Candidate native visual/smoothness acceptance and matched before/after frame timing remain **pending**. No FPS percentage or no-regression visual verdict is claimed. Keep the PR draft; merge/release are not authorized.

## Acceptance

- Keep every graphics control and visual parameters unchanged.
- Focused tests prove reduced redundant work and preserve rendering/interaction contracts.
- Baseline and candidate observations use matched repository/avatars/settings/viewport/camera where attainable; state/cache/load differences disclosed.
- Claim FPS improvement only from appropriate matched evidence; final first-hand visual and smoothness verdict belongs to Aaron.
