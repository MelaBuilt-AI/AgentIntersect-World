# Three.js r186 compatibility evaluation — AgentIntersect World

Date: 2026-09-24. Status: **HISTORICAL PRE-WEATHER EVALUATION**.

**Superseded current direction:** r186/WebGPU/SunLight is installed. Aaron's TEST45429 rendering/stall FAIL was corrected locally; old test closed with state retained. Fresh corrected TEST45433 is RUNNING, manual retest PENDING. See [the authoritative correction report](THREE_WEBGPU_UPGRADE.md). The non-activation/exclusion/retention statements below describe this earlier evaluation, not current permissions or runtime state.

## Recommendation

**Next-session decision (Discord1552734236388233257):** Aaron selected the controlled r186 upgrade as the next session's focus. This report is still evaluation evidence, not an installed upgrade; no activation during end-session prep. The earlier r185 transition smoothness/black sections now have his scoped PASS. The subsequently added v2 scenery/weather/lightning build remains pending hands-on review, and this earlier r186 evaluation predates it. Recheck that expanded renderer/audio/lifecycle surface when performing the upgrade; preserve the current live r185 review and its saved state until coordinated replacement.

A controlled r185→r186 upgrade is a reasonable next slice, **after the current r185 transition corrections receive Aaron's focused hands-on verdict**. Do not combine the dependency upgrade with a WebGPU migration, new weather, Gaussian splats, or a lighting redesign. The existing application builds and the bounded compatibility probes pass against r186, but this is not full native-GPU / avatar / spatial-screen visual acceptance.

Before an authorized upgrade, explicitly select supported PCF shadows rather than relying on React Three Fiber's deprecated boolean default. Review the changed PBR/bloom appearance and retained-resource behavior on the actual product. Do not promise an automatic FPS improvement or automatic new features merely from changing the version.

## Current installation and isolation

- World renderer package pins `three` exactly to **0.185.1**; no caret/range. It also pins `@react-three/fiber` **9.6.1** and React **19.2.7**. The lockfile fixes the installed graph. An installed World build does not self-update this library.
- Fiber 9.6.1 declares Three peer range `>=0.156`; r186 satisfies the declaration. A broad peer range is not comprehensive compatibility proof.
- Current rendering is **classic WebGLRenderer through R3F**, with GLSL `onBeforeCompile` patches, EffectComposer, UnrealBloomPass, OutputPass, Reflector and GLTFLoader/SkeletonUtils. World has no runtime TSL or WebGPURenderer import.
- The official `three@0.186.0` npm archive was staged outside the repository, SRI SHA-512 verified, safely inventoried and extracted without executing package scripts. No package install, lockfile edit, dependency replacement, provider activation, or live-app switch occurred.
- Official archive: `https://registry.npmjs.org/three/-/three-0.186.0.tgz`
- Archive SHA-256: `61eeff9d7616005c9a481c796f52287d81fbbbc0d55eaca5565322924252c1aa`
- Package reports MIT and gitHead `148ef33ecb6d2502ff796d4554abd1549c95d519`.
- GitHub r186 release is now published as a stable release, **2026-09-24T14:35:44Z**. An earlier `releases/latest` lookup returned r185; the explicit r186 release and npm artifact were subsequently verified. The earlier result is not the current conclusion.

## Verified compatibility evidence

1. Scanned **294 runtime source files**, including tracked and untracked source, for affected APIs and Three imports. Type declaration stubs were excluded from the usage count and considered separately. A broad `Source` regex match was a PowerShell `Get-Command ... .Source` property, not a Three import. The three `shadows` text matches include one comment and two actual Canvas props.
2. All runtime imported addon paths exist in r186: GLTFLoader, SkeletonUtils, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, Reflector. The production bundler resolved their actual imports successfully.
3. All referenced named GLSL ShaderChunk includes still exist. This is a structural check, not proof that changed lighting equations produce identical pixels.
4. Built current World with **temporary evaluation-only aliases** pointing Three/core/addons at the verified r186 package. No product manifests/configuration changed. The bundle graph had no module from the installed `three@0.185.1` directory. Entry **403,877 bytes**, below the unchanged **409,600-byte** budget.
5. Ran the renderer test directory under r186 aliases: **29 files / 140 tests PASS**. This is the targeted renderer suite, not a claim that the complete application/native suite ran on r186.
6. Ran an isolated source-renderer fixture with an actual **r186 WebGLRenderer**, Original→Sunlit→Mars→Original, bloom/AA enabled, an actor box, and the new held complementary black/code patches. Original's object and texture identities remained stable; no captured page/shader errors. Inspected the captured pixels: code sky/floor, localized black sections and actor proxy remained visible.
7. Reproduced the relevant warning: `THREE.WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.` Also observed the Clock→Timer deprecation already present in the current rendering stack.
8. An initial dev-fixture attempt reported multiple Three instances because the external alias was separately prebundled. That attempt is retained as invalid isolation evidence. Explicit shared dependency prebundling removed the duplicate-library warning; final render evidence uses one shared revision. No product workaround was introduced.
9. Package/lockfile hashes were recorded and compared around the evaluation build; installed and declared production Three remain 0.185.1. The live r185 review has been preserved separately.

Evidence directory: `~/.hermes/runs/aiw-three186-evaluation-20260924/` — `provenance.json`, `source-scan.json`, `build-proof.json`, `build-tests.log`, `render-proof.json`, and renderer captures.

## Requested features: what they mean for World

### SunLight with cascaded shadows — relevant, opt-in

Confirmed as an addon at `three/addons/lights/SunLight.js`. Classic WebGLRenderer support is included. WebGPURenderer support requires registering SunLightNode in the renderer's node library. This is a useful candidate for larger outdoor environments and more stable near/far shadow detail.

It is not a drop-in rename of our DirectionalLight: SunLight has no `target`; its position defines a direction toward the origin. Current World lights follow the user and use an explicit target. An integration needs deliberate direction/cascade coverage, shadow resolution, bias, camera-distance and performance choices. CSM adds shadow work; “higher performance” is not an unconditional promise. Existing fixtures did not enable SunLight or benchmark its cascades.

### Native Gaussian splats — real, but not a drop-in World feature

Confirmed official `GaussianSplat`, loaders and utilities. The shipped class states it requires **WebGPURenderer** and supports that renderer's `forceWebGL` fallback, **not classic WebGLRenderer**. This distinction matters: our existing WebGL renderer, custom GLSL patches and postprocessing are not automatically converted by upgrading Three.

The release includes view-dependent spherical harmonics, sort invalidation corrections, culling and raycasting support. Older pre-release descriptions claiming SH0-only support are not authoritative for this shipped artifact. Actual quality and speed depend on trained splat data, sorting, density and hardware. Current textures/GLBs do not become splats. This would be a separate asset/rendering project, not the next default upgrade benefit.

### PBR / energy compensation changes — relevant visual migration risk

Confirmed multi-scattering and diffuse/sheen energy-conservation changes, including removal of the old `BRDF_GGX_Multiscatter` function. World does not call that function directly. Existing shader hooks still resolve and the isolated environment shaders compile.

However, our standard materials, imported glTF materials, metal/rough surfaces and bloom thresholds can look different under the same lights. Build success does not certify identical visual balance. Compare actual avatar skin/fur/clothes, rock/grass material sampling, bright code, shadows and wet-floor/reflection composition before accepting an upgrade. Do not silently retune the accepted art during the dependency change.

### compileComputeAsync() — not our present stutter solution

Confirmed on the common renderer architecture used by **WebGPURenderer**, for ComputeNodes. It is not an added method on classic WebGLRenderer and does not pre-upload our ordinary textures or cure scene remounting automatically.

More directly relevant: r186 fixes classic **WebGLRenderer.compileAsync()** when a tracked material is disposed mid-flight. World already has explicit shader-warmup/material-ownership safeguards around avatar arrival; an upgrade does not justify deleting those safeguards without their lifecycle proof.

### Additional practical r186 improvements

- UnrealBloomPass no longer requests depth buffers for its blur targets and uses combined bilinear taps. Our existing `blendMaterial` field still exists, preserving the hook used for alpha-safe CSS3D screen holes. Performance gains and visual equivalence still need native proof.
- GLTFLoader has texture-transform/instancing/skinning corrections. Relevant to imported assets, but no blanket avatar acceptance follows from the environment fixture.
- Built-in Sky/SkyMesh cloud improvements are optional: World currently uses its accepted layered supplied textures, not those addons. They will not replace the sky by themselves.

## Removal / behavior-change impact

### PCFSoftShadowMap — INDIRECT IMPACT FOUND

The numeric exported constant is still present and deprecated; it is the old rendering path that has been removed. Both current renderer families warn/fall back to PCF.

World runtime source has no direct reference, **but** the pinned R3F implementation sets `THREE.PCFSoftShadowMap` when a Canvas has boolean `shadows`. Both `world-room-canvas.tsx` and `world-room-imported-canvas.tsx` use that prop. The warning was reproduced in the r186 renderer fixture.

Migration action, only after upgrade authorization: explicitly use the supported R3F percentage/PCF configuration (or equivalent typed shadowMap settings), then check actual shadow quality and console behavior. No such product edit was made in this evaluation.

### rangeFog / viewportResolution — no current direct impact

The old TSL names are absent in the inspected r186 exports; current names include `rangeFogFactor`, `screenSize` and `viewportSize`. World does not import TSL or reference either removed identifier. Any future WebGPU/weather port must use the current APIs rather than copying an old example.

### Removed minified distributions — no current build blocker

The archive contains non-minified core/module/WebGPU/TSL builds and the CJS wrapper, not `.min.js` counterparts. World imports the package/addons through Vite and already performs its own production bundling/minification. No direct Three `.min.js` URL/path was found. The isolated production build passed without changing budgets.

### CommonJS deprecation — browser unaffected; ESM remains preferred

`require('three')` has not disappeared yet. The inspected CJS wrapper emits a deprecation warning and uses require(esm), with removal planned for a future version. World's runtime source is ESM and contains no `require('three')`; the browser build resolves ESM. The supported Node runtime is24, so this is not a reason to rewrite the browser stack. Do not promise compatibility for unsupported old Node versions or arbitrary third-party CommonJS scripts.

### Source → TextureSource — no current direct impact

TextureSource is exported. A deprecated Source compatibility class is also still exported and warns when constructed. No genuine World import/construction of Three.Source was found. Existing texture creation through Texture/TextureLoader does not need a manual rename. New code should use TextureSource if that low-level API is needed.

### Additional migration-guide changes checked

- Object3D now has `dispose()` which dispatches a disposal event; it does not automatically dispose shared geometry/materials/textures. World has no runtime custom Object3D subclass overriding dispose. R3F may now invoke that method on additional object types during cleanup. Retained resource lifecycle and model switching should remain explicit upgrade checks.
- BufferGeometryUtils.toTrianglesDrawMode now mutates in place: no direct World caller.
- SimplifyModifier.modify is now async and its implementation changed: no World caller.
- LightProbeGrid/Helper WebGL names changed: no World caller.
- Sky/SkyMesh `up` uniform removed: World does not use those addons.
- GTAONode distance parameters changed: World does not use GTAONode.
- Shader/data declaration files are locally maintained lightweight stubs; a green TypeScript check alone cannot establish all Three runtime API compatibility. Actual import build and renderer execution supply additional evidence, but not every application path.

## Weather feasibility — no upgrade required for a first slice

Rain and swirling wind-carried particles are feasible on the existing r185 WebGL stack. A small practical implementation would use bounded instanced streaks/particles with shader-driven movement, not thousands of React objects or per-particle application state updates.

Proposed recipe controls: precipitation mode (none/rain), intensity, wind direction/speed and a bounded particle amount. Add dust/mist/wispy wind cues separately; wind itself is invisible, so its effect must be represented by transported particles. Keep the emitters around the relevant visible region, preserve avatar/UI readability, stop resources when off/World exits, and honor Reduced Motion and audio mute/unlock. Ground/object collision/splashes and shelter are separate choices, not implied by basic rain.

Three's official compute-rain example demonstrates the broader capability, but its WebGPURenderer/TSL implementation is not a direct copy-and-paste into our classic renderer. We do not need to block a modest weather feature on WebGPU or r186.

No weather implementation or schema changes were made in this pass.

## Remaining acceptance before any real upgrade

- Explicit upgrade authorization, coordinated Three core/addons and verified single-version bundle; exact lockfile update only then.
- Explicit supported shadow configuration, warning reconciliation, and affected code tests/build.
- Native hands-on comparison of existing avatars and animation, scene switches, bloom/AA, wet-floor reflection, CSS3D transparency, materialization and save/restore. Reuse unchanged evidence; no reinstated scripted product-navigation suite.
- Native performance/smoothness verdict with the same resolution/effects; do not substitute software renderer counts for FPS claims.
- Keep optional SunLight/weather/splats as separate implementation decisions. A library upgrade does not authorize a renderer migration or a new asset pipeline.

## Sources

- Release: https://github.com/mrdoob/three.js/releases/tag/r186
- Migration guide: https://github.com/mrdoob/three.js/wiki/Migration-Guide#185--186
- Immutable package metadata: https://registry.npmjs.org/three/0.186.0
- SunLight implementation: https://github.com/mrdoob/three.js/blob/r186/examples/jsm/lights/SunLight.js
- GaussianSplat renderer limitation: https://github.com/mrdoob/three.js/blob/r186/examples/jsm/objects/GaussianSplat.js
- Classic WebGLRenderer: https://github.com/mrdoob/three.js/blob/r186/src/renderers/WebGLRenderer.js
- WebGPURenderer/common compute path: https://github.com/mrdoob/three.js/blob/r186/src/renderers/common/Renderer.js
- Official compute-rain example: https://threejs.org/examples/webgpu_compute_particles_rain.html
