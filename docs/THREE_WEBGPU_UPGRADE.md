# Three r186 / WebGPU / SunLight upgrade

## Current outcome

The renderer migration and subsequent Hack your World corrections are implemented locally. Aaron accepts transition appearance, improved performance on his tested workload, decorative rock shadows, nearby/upper lightning and the additional distant horizon lightning. He also fully passes the feature's save/refresh/reselect, cancellation/revert, cycling and listening/mute checklist (Discord `1553072689655054407`). The [feature summary](HACK_YOUR_WORLD.md) owns the exact acceptance scope and remaining PR delivery gates.

**TEST45447 remains the retained normal operator test at http://127.0.0.1:45447/.** Its matching frontend/backend and state stay untouched. The subsequent authorized PR delivery preserves this build and browser; merge remains gated on exact-head CI/readiness. Earlier runtime directions and unsuccessful attempts are preserved in [renderer history](THREE_WEBGPU_UPGRADE_HISTORY.md), not active instructions.

## Implemented renderer contract

- Pinned Three 0.186.0 with R3F 9.6.1. World and preview canvases use awaited modern renderer factories and report the actual backend/revision; a renderer class name alone is not backend proof.
- Both World canvases explicitly select supported PCF shadows. SunLight uses two bounded cascades; reflection rendering owns separate shadow state so it cannot refit the main-view atlas/matrices to the mirror camera.
- Authored material/effect shaders use static node/TSL implementations, not browser-time GLSL transpilation. Correct color-uniform binding prevents the previously reproduced rain NaNs and resulting bloom blackout.
- The shared postprocess owner preserves bloom/AA and transparent screen apertures. Fog depth/coverage capture preserves scene alpha and excludes unused lighting/shadow work while main-view effects remain enabled.
- Original's texture-bearing environment and shared lighting/compositor identities survive cosmetic switches. Candidate textures/materials are prepared before the visible swap, using the actual nested renderer path and GPU completion rather than CPU submission alone. Blob-decoded images avoid the reproduced HTML-image conversion stalls.
- Stable React-owned material identities retain delayed textures and prevent stale cleanup from restoring white floor/sky materials. Completed visibility state remains compatible with retained scene lifecycles.
- Environment transitions reuse the actual avatar streaming-cell effect: dematerialize outgoing floor/sky, then materialize the new environment at the existing pace. Actors, repository objects and camera stay mounted. Reduced Motion bypasses animated dissolve.
- Original's code sky has one UV-repeat owner, with the accepted 8×4 scale; it no longer receives the duplicated repeat from a cloned texture node.

## Weather and scenery corrections

### Cutout grounding

Decorative alpha cards cast silhouette-shaped shadows from the relevant light-facing side. Catalog/import metadata accounts for transparent artwork padding; a small seating inset and soft contact shade improve grounding. These remain flat decorative pictures, not terrain meshes or physical obstacles. Aaron accepts their current shadows.

### Upper/local lightning

Distant events spread bolt/arc pairs across the upper sky with localized flashes; local strikes retain their ground impacts and existing audio ownership. Explicit live node sampling fixes the reproduced stationary-camera problem where CPU UV updates advanced but ordinary-material observation retained a blank GPU atlas frame. No per-frame image reupload is required.

### Additional horizon lightning

Optional `weather.horizonLightning` independently controls density, interval and elevation. Missing settings or density zero leave this layer off, preserving older recipes and upper/local lightning. The default low band is calibrated against the visible mountain silhouettes, not the transparent upper boundary of their geometry.

At most 24 spatial regions share the supplied atlas, with their own live UV/opacity uniforms. Brief staggered flashes vary in frame, slant, size and position, accompanied by localized glows. There are no new point/shadow lights, ground impacts or repeated thunder events for each small flash. Reduced Motion unmounts animated weather. Controls, automatic/copied briefs, reports and saved slots all carry the additive setting. Aaron explicitly accepts the resulting distant lightning.

### Appearance-preserving optimization

Fog's depth/coverage-only pass no longer rebuilds SunLight shadow atlases. Visible cascades, reflections, fog, bloom, AA, rain, shafts and resolutions remain unchanged. The matched Default/48-model fixture reduced draw calls from 592 to 520 and passes from 22 to 20, with image differences within one channel value. Timing samples were mixed; those measurements establish reduced redundant work, not a universal FPS percentage. Aaron separately reports the product runs much better on his tested repository workload.

## Technical evidence

Latest affected verification is **60 files / 236 tests plus 11 architecture checks**, with scoped formatting/lint, producer builds, web/backend types, normal frontend build and isolated backend compilation passing. This is the latest affected suite, not a new whole-project run. Historical full-suite and intermediate results keep their original scope in the archived report.

Evidence root: `~/.hermes/runs/aiw-horizon-lightning-20260925/`.

- `gate.log`: conventional code/build checks.
- `native-final/report.json`: native Windows Edge rendering, no captured errors, retained larger upper bolts, small near-ridge flashes, distinct temporal samples and Reduced Motion leaving no weather objects. The actor remains mounted.
- `native-final/horizon-*.png` and matched off captures: actual lower-layer contribution, not merely visible mesh flags or changing CPU clocks.
- `component/`: isolated real controls → preview → custom-slot save → reload/cycling with horizon settings.
- `smoke.json`: newly compiled full backend started twice against disposable state; real HTTP save/read after restart preserves main and horizon settings, and its owned listener closes.
- `summary.json`: aggregate technical result. The later first-hand verdict is recorded separately in the feature summary.

The tested normal frontend entry is `index-D6dVs-1Y.js`, 404614 bytes under the unchanged 409600-byte ceiling, SHA-256 `f09fa0ecaa8f8369afe1a0062188bb99ebae56173de1e203f28d63a0ef4c1f2f`. The served entry matched it at launch. The matching backend is the same evidence root's `server-dist/index.js`; its relocated static-preview CLI was also executed from a disposable site and served the expected bytes. No installer/native Windows backend-package claim follows from a Windows browser backed by WSL.

Existing optional large-chunk and Three CJS warnings remain. Native fixtures establish the pictured effects and sampled behavior, not all-device performance, a fallback-GPU matrix, prolonged comfort or every semantic audio trigger.

## Retained runtime and operating boundary

- URL: **http://127.0.0.1:45447/**; backend 44047; Edge CDP 49447.
- Service: `aiw-horizon-review-20260925.service`.
- Current kit: `~/.hermes/runs/aiw-horizon-lightning-20260925/review/`.
- State/profile: `C:\Users\Mela AI\AppData\Local\AgentIntersect-World\acceptance\aiw-horizon-review-20260925`.
- Frontend: evidence root `web-dist/`; backend: matching `server-dist/`. Do not rebuild either beneath the operator.
- Read-only helpers: `python3 check.py`, `python3 stop.py check`, `python3 close-browser.py check` from the kit. Never redirect a checker's output onto its input receipt.
- Only on separately authorized closure: re-attest and run `close-browser.py stop`, then `stop.py stop`. Keep state/work unless deletion is explicitly authorized. Do not rerun the fresh-entry observer after operator use.

TEST45443 was retired after replacement approval; its browser was already closed, its three owned service processes/listeners exited, and its profile/state/work remain retained. Old native work/history is not silently copied into a fresh roster. Optional local voice was unavailable at launch and remains a separate user-controlled setup. No host-shutdown/sleep uptime guarantee is implied.

## Remaining boundaries

- Requested Hack your World everyday-use, visual and listening checks are accepted; do not reopen them from historical pending lists.
- The incidental follow/Run displacement correction has focused technical evidence, but is not independently accepted by the Hack checklist.
- True 3D terrain/props, physical weather, additional effects, native Windows backend packaging and broader recovery/Workbench work remain separate scope.
- Asset-generation provenance is now owner-confirmed; see [notices](../THIRD_PARTY_NOTICES.md). This is not a blanket MIT media sublicense or a publication action.
- Normal final code checks and exact-head hosted CI/readiness are required by the now-authorized commit/push/green-gated merge. Releases, installers, downloads, provider/profile changes and Phase20 remain gated.
