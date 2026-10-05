# Full-quality four-agent performance pass

Authorized October 4, 2026 by Aaron (Discord 1556315230492037273).

## Current delivery status — October 5, 2026

Aaron authorized worktree review, commit/push, exact-head GitHub CI and readiness, then merge once clean (Discord 1556787860454248470). This supersedes the historical draft/no-merge holds below; release, package publication and provider changes remain unauthorized.

TEST45491 contains the cumulative changes described below plus:

- Full-rate live walking/camera/avatar updates with React controller/UI position publication bounded to 100 ms and a final-pose flush when movement stops. This supersedes the earlier original-publication-cadence description.
- One canvas-bounds read before spatial-screen DOM writes per frame, rather than interleaved reads for each screen.
- Imported grounding-ring geometry/material retained across fresh position arrays and movement, with explicit owned-resource disposal on replacement/unmount. Position updates retain the existing ring shape, color and floor height. CPU lifecycle tests use real Three resources and mocked hooks; they do not prove React concurrency or physical GPU reclamation.

The complete candidate passed `check:core` under Node 24.18.0: formatting, lint, types, architecture, 1,609 tests in 284 files, workspace builds and disposable startup/API smoke. Evidence: `~/.hermes/runs/aiw-walking-investigation/grounding-marker-candidate/check-core.log`. Hosted exact-head checks remain a separate delivery gate, not implied by this local result.

Aaron's first-hand TEST45491 review (Discord 1556785920999555114 and 1556787187461394475): Clone test loaded with agents and movement for at least five minutes; GPU RAM held in the reported 5.2–5.5 range, then rose to 5.7 after an avatar change and held there. Grounding rings look correct and follow avatars normally. Walking is better with no major freezes, but all-effects-on FPS remains noticeably lower than effects off and a minor left-to-right repository-city viewing pause remains. These are operator observations, not matched FPS measurements or proof that every leak is eliminated. Ring appearance/following PASS and earlier floor-expansion PASS are separate from these residual performance follow-ups; historical walking FAIL evidence remains below.

Preserve the already-open TEST45491, its built files, service, browser and state unchanged during delivery. No new instrumentation, browser journey, reset, reload or rebuild of its served output is authorized. TEST45489 is closed with state retained. GitHub receipts belong in the PR/external handoff rather than recursive status-only commits.

## Original scope (historical)

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

## Walking-stutter follow-up (local correction; not yet accepted)

Aaron reported improved camera-rotation feel but persistent rhythmic pauses while walking, supplied `pause moving.mp4`, and authorized investigation and fixes (Discord 1556488209280798731). Preserve the populated TEST45488 and its served build; do not reset/reload it or lower graphics quality. Merge, release and publication remain unauthorized.

The operator-triggered 45-second CPU/RAF observation is retained at `~/.hermes/runs/aiw-walking-investigation/20261004-222517/`. It recorded 3,821 RAF samples. During the later outward walk/sprint, the floor grew from 256 to 332 in 17 changes; many growth updates were immediately followed by 51–107 ms long tasks. The expansion interval also contains shader-node build and garbage-collection samples. These are instrumented main-thread observations, not GPU-presented FPS. The initial profiler-start gap and pre-trigger long tasks are not product pacing proof; the trace did not include the requested final stationary comparison.

Confirmed source/test defect: `WorldWetFloor` included floor size in the memoized reflector dependency set. Every growth step replaced the mirror mesh, material/node graph and reflection resources, disposing its retained reflected SunLight/shadow state. A focused regression failed on the first 256→260 expansion because the mesh identity changed.

Correction: retain a unit-plane reflector at the same viewport-dependent resolution and scale the plane in a layout effect when the floor expands. Preserve reflection sampling/opacity, shadow quality, MSAA and floor extent. The focused resize and reflection-sun tests pass (3 tests); plane bounds grow correctly while mesh/geometry/material identities stay stable. No movement-speed or input changes.

Scope limit: this fixes confirmed cold-resource churn at floor-growth boundaries, not a proven explanation for every subtle pause inside an already-sized floor. The capture also shows substantial React/R3F commit work and held position metadata while scene clocks advance; passive metadata is not proof of the camera's actual presented pose. The movement-update lead was initially unconfirmed; the bounded follow-up below tests its commit dependency separately.

Verification: the isolated build checkout `/home/mela_ai/AgentIntersect-World-walking-stutter` contains the same correction and regression as the PR34 working checkout. `pnpm check:core` passed under Node 24.18.0: formatting, lint, types, architecture, 1,602 tests in 281 files, normal production build and disposable startup/API smoke. Existing Three CJS-deprecation and Vite chunk-size warnings remain. Log: `~/.hermes/runs/aiw-walking-investigation/core-check.log`. TEST45488 still serves its original bytes; no candidate browser was opened, no commit/push/merge occurred, and first-hand corrected walking/reflection acceptance is pending.

### Fixed-size walking: live pose versus React commits

Aaron explicitly confirmed that the familiar rhythmic hitch occurred during the normal-sized portion of the same capture; floor expansion was an additional demonstration (Discord 1556497016069160981). These remain separate acceptance criteria.

In the 5–28 second fixed-size held-input window, 649 of 2,294 sample pairs retained the same passive position metadata while the scene clock advanced. CPU samples include React/R3F commit work. This motivates a scheduling hypothesis, not proof that those exact presented frames held the camera.

The focused renderer regression exercises the real imported and standard scene hooks with React commits deliberately deferred while live movement advances. Both original renderers held camera X at 0 when the next movement sample required 0.05; both failed before the correction. Existing commit-only camera tests passed. This establishes a commit-dependent camera limitation, not a measured reproduction of the native rhythmic cadence.

Correction: the existing movement RAF publishes each authoritative position to a stable ref before requesting the matching React state update. Both renderer paths read it in a pre-draw callback, moving the follow camera and applying the same uncommitted delta to the user avatar/grounding group. React state still updates at its original cadence for the rest of the controller/UI; movement speed, bounds, input ownership, graphics and animation cadence are unchanged. Repository-focus framing remains fixed, and spatial-screen focus keeps its later priority override. A catching-up React commit removes only the already-committed part of the transform, preventing double movement or snapback.

Verification: 32 focused tests in 5 files passed. The updated isolated checkout passed the complete `check:core` gate: formatting, lint, types, architecture, **1,604 tests in 281 files**, normal production build and disposable startup/API smoke. Log: `~/.hermes/runs/aiw-walking-investigation/live-motion-core-check.log`. Tests cover deferred commits, direction reversal, partial commit catch-up, repository focus and spatial-screen camera priority. Existing Three CJS-deprecation and Vite build warnings remain.

Status at build handoff: correction built and code-verified, native rhythmic-hitch resolution unconfirmed. This was not an FPS claim, a GPU-presented timing result or visual acceptance. TEST45488 was subsequently closed with user authorization and its state retained; the corrected build is running in TEST45489 (`~/.hermes/runs/aiw-walking-investigation/test45489/README.md`). No commit, push or merge occurred.

Operator retest (Discord 1556505655634829430): **floor expansion PASS; normal walking FAIL**. Aaron reports expansion is fixed but the subtle rhythmic walking pause persists even when facing away from the repository city. The live-pose correction did not establish symptom resolution and must not be presented as a successful walking fix. Facing away is a diagnostic clue, not proof that all city-related work is absent. Preserve populated TEST45489 for the next bounded causal investigation; no capture is armed. Overall smoothness acceptance remains failed, while the separate floor-expansion acceptance is retained.

### GC attribution and first measured allocation reduction

Aaron confirmed the familiar hitch during `pose-20261004-232448` (Discord 1556508368343142472). Its 3,775 actual pre-draw samples showed advancing live/camera positions during movement, but callback timing gaps and four 71–90 ms main-thread long tasks. Floor size stayed 224. This distinguishes callback delays from a camera pose held across otherwise advancing frames; it is not GPU-presented timing.

The subsequent `cpu-pose-20261004-233048` capture recorded 3,397 samples. All six observed long-task windows were dominated by garbage-collector CPU samples. Profiled task durations were 106–249 ms, larger than the earlier no-profiler observation; retain profiling overhead as a limitation. Its input timeline contains repeated walking segments rather than the requested long stationary endpoint. Raw profiles, clock anchors and analysis are under `~/.hermes/runs/aiw-walking-investigation/`.

A separate 20-second sampled-allocation observation (`allocation-20261004-233514`) included already-collected objects and recorded one stationary position with the page visible. Estimated allocations summed to 1,013,126,996 bytes; these are transient allocation estimates, not retained heap growth or evidence of a leak. The application-owned fog traversal accounted for 81,938,428 estimated bytes. Other major sites include renderer cache keys, sort comparators, uniforms, animation and React/R3F updates; the fog change is not a complete removal of allocation churn.

The fog prepass created a singleton material array for every visited object, including material-less hierarchy nodes, and per-mesh replacement tuples. The local correction branches directly for scalar materials, keeps original multi-material arrays, and reuses its visitor, predicates and restoration lists. Per-frame rendering, material eligibility, temporary visibility, capture resolution and quality are unchanged. A focused regression failed before correction (six singleton-list predicate visits across three captures) and passes afterward (zero visits and one stable visitor); existing depth compilation/preparation tests pass.

Full `check:core` passed in `/home/mela_ai/AgentIntersect-World-full-effects` after verifying its former TEST45488 service was stopped: **1,605 tests in 282 files**, formatting, lint, types, architecture, production build and disposable startup/API smoke. Log: `fog-allocation-core-check.log`. TEST45489 continues serving the earlier build from the separate walking-stutter checkout; it was not rebuilt, reset or reloaded. No commit/push/merge. This allocation-reduction candidate has not received matched native allocation/GC measurement or a new walking acceptance verdict; the walking defect remains OPEN.
