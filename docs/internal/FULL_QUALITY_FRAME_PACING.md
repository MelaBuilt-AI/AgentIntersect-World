# Full-quality frame-pacing pass

Date: 2026-09-25. Requested by Aaron in Discord `1553102736613048422`, explicitly not a PR27 regression. Local work is separate from PR27; no merge/publication or replacement of TEST45449 is authorized here.

## Scope and changes

- Preserve all graphics toggles, asset bytes, texture resolution, model geometry, accepted lighting/effect parameters, and arrival/switch choreography.
- Keep the weather point light attached to the visible scene while changing its intensity and position. Hiding the local-bolt group previously removed that light and rebuilt unrelated scene materials on each distant/local alternation.
- Bound private model/effect preparation to four draw owners per batch, presenting the existing scene between batches. A many-mesh avatar is no longer counted as one cheap job. Readiness still waits for every submitted batch's GPU completion; temporary visibility and render-target changes are restored before presentation.
- Compute exact posed skeletal bounding boxes within those batches, then derive conservative enclosing spheres instead of skinning all vertices again for a separate sphere scan. No geometry is removed. Existing bounds are retained.
- Decode code artwork with the installed ImageBitmapLoader before exposing its full-resolution texture to native WebGPU. This avoids the measured HTML-image conversion/copy burst in first-use uploads. Retain the classic texture loader for other backends and close owned bitmaps on disposal or late completion after unmount.
- Keep replacement scenery's already-asynchronously-compiled private draw atomic. An experiment splitting that draw into mesh batches increased pipeline creation from 83 to 129 by repeatedly changing scene light membership; that experiment is not retained.

## Evidence

Private evidence root: `~/.hermes/runs/aiw-full-quality-pacing-20260925/`. `comparison.json` contains exact source paths, raw-derived metrics, configuration and memory counts. The timestamped video contact sheet and center-region motion analysis locate the supplied clip's roughly 11–14-second pause; they do not establish its cause alone.

Isolated renderer fixtures use native Windows Edge, the actual Three WebGPU backend (NVIDIA/Blackwell), a 3840×2064 drawing buffer, DPR1, every default graphics flag enabled, unchanged assets and matching cameras during measurement. Measurements include CPU profiling overhead. They do not navigate the normal product, run an agent, time model generation, or establish human acceptance. Background-throttling controls are fixture-only, identical for the matched comparison. The browser’s adapter information exposes no exact device model.

Baseline renderer source is pinned to PR27 head `1fe0c31a5e894abf3ecd871809dd85e20973af7c` through the fixture's read-only source loader; no checkout reset or operator-runtime replacement was used.

| Workload                               | Maximum measured CPU frame, before → after | Maximum observed frame gap, before → after |
| -------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| 48-object city preparation/arrival     | 549.8 → 63.8 ms                            | 559.9 → 248.4 ms                           |
| Cat-agent-01 initial arrival           | 760.9 → 299.3 ms                           | 2446.1 → 585.0 ms                          |
| Cat-agent-02 replacement               | 1161.4 → 79.8 ms                           | 9673.4 → 692.4 ms                          |
| Return to cat-agent-01                 | 661.1 → 268.3 ms                           | 2092.2 → 664.8 ms                          |
| Original → storm with 12 city objects  | 202.5 → 145.5 ms                           | 1347.6 → 1021.7 ms                         |
| Five alternating distant/local strikes | 46.9 → 14.7 ms                             | 379.2 → 348.5 ms                           |

These are individual profiled observations, not statistical FPS guarantees. Retain raw samples and intermediate/noisy attempts, not just the favorable measurements. The city operation took 8.553 → 8.861 seconds including its unchanged arrival choreography: improved responsiveness is not a shorter loading-time claim. The final custom-World sample still has a roughly one-second maximum gap and 41 intervals over50ms versus36 in the baseline; it is **not** evidence that cold transitions are now smooth. The repeated-storm optimization reduced pipeline creation from40 to4, but unrelated longer frame gaps remain.

Texture counts, reported texture byte sizes and geometry counts match for each paired workload. Final city:35 textures/196 geometries; storm:28/22; transition:47/61. Avatar animation callbacks progressed using the actual model-local Idle mapping. An initial avatar screenshot was occluded by the fixture's reference box; the separately inspected oblique-camera capture proves the complete textured cat is visible. That capture was taken outside measured intervals. City and final storm composition were inspected separately. This is technical rendering evidence, not Aaron's appearance or smoothness verdict.

## Verification and remaining boundary

Focused RED→GREEN coverage exercises stable light membership and unchanged local illumination, bounded preparation and intervening presentation, per-mesh preparation, skeletal bounds, atomic scenery exclusion, full-resolution bitmap publication and late/disposal cleanup. Existing readiness/GPU-completion and visibility restoration checks remain in place. Conventional full-gate results are retained externally in `gate.log`/`gate.exit`, avoiding self-referential evidence updates.

No assets were reduced or effects disabled. Large individual meshes, first-use GPU work and custom-environment transitions can still produce hitches. This pass removes demonstrated redundant work and large aggregate bursts; it does not claim every pause eliminated or every avatar/preset measured. Normal-product operator retest remains pending. Keep PR27 open/unmerged and TEST45449's prior served build/profile/state untouched until Aaron requests replacement.

## Avatar-change follow-up

Aaron1553124944672464938 accepts better overall performance and good initial user/agent entry, but reports remaining substantial pauses when changing either avatar. His additional message explicitly accepts copying the original World description and five-second messages; those checks are not reopened.

Native follow-up traces separate the selector preview from World replacement. Large skinned parts triggered synchronous sphere/box scans of hundreds of thousands of vertices (roughly100–140ms for individual parts). The correction snapshots the selected skeletal pose and calculates its exact boxes in approximately4ms cooperative slices before exposing the model or announcing readiness. A conservative enclosing sphere avoids a second scan. Superseded work cancels without publishing partial bounds. The model's existing Idle/arrival animation proceeds after readiness; no asset/detail/graphics setting changes.

Private before/after evidence: `~/.hermes/runs/aiw-avatar-change-pacing-20260925/`. Native bounds-call assertions fail against the before-correction artifact and pass after: zero synchronous skeletal bounds calls for both preview and World replacement. The candidate uses separate web build output; TEST45453 remains unchanged.

For the profiled agent models, repeated preview's maximum frame gap changed356.4→24.9ms; World samples changed632/493.3/509→69.2/66.9/70.6ms. User World samples changed505.4/688.4/527.1→62.4/73.5/72.7ms. These are isolated samples, not universal FPS or smoothness guarantees. Lightweight user previews did not demonstrate a gain: their maximum gaps were16.7–23.7ms before and65.2–71.0ms afterward, without long tasks above50ms. Preserve those results rather than claiming every preview improved. Cold agent preview retained a109.8ms maximum gap. Texture/model quality is unchanged, and complete posed models were inspected; human retest remains pending.

Focused regressions prove yielded exact-pose bounds, cancellation, and retained prepared bounds. Conventional formatting/lint/types/architecture/full unit checks plus isolated-output production build and startup/API smoke are recorded in this follow-up's `gate.log`/`gate.exit`. The smoke uses the unchanged backend and the new isolated frontend output, not the operator's served frontend. No push/merge or test replacement is inferred.
