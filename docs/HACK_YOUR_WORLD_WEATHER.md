# Hack your World — v2 scenery, weather and lightning

> **Historical r185 intake/implementation record, not current runtime or acceptance authority.** Current behavior and owner acceptance are consolidated in [Hack your World](HACK_YOUR_WORLD.md); current rendering is summarized in [Three/WebGPU](THREE_WEBGPU_UPGRADE.md). Aaron has since accepted the requested appearance, everyday-use and listening/mute checks and confirmed subscription-generated visual/audio provenance. Earlier pending/no-upgrade/leave-running statements below describe the original attempt only; they are not open gates or live TEST instructions.

## Scope and operator verdict

Aaron's September24 feedback (Discord1552713775969472565) accepts the corrected transition smoothness and complementary black sections. This continuation fixes Project / Current Work HUD overlap and the persistent Use without saving confirmation, and integrates the supplied v2 visual/audio packs plus weather/lightning. New visual/interaction/listening acceptance remains PENDING.

No Three upgrade:0.185.1 remains installed. No native-provider reruns, account changes, new mesh generation, collision/damage, repository authority, public delivery, installers or Phase20.

## Complete intake

Sources, left unchanged:

- `C:\Codex\3D avatars\aiw-environment-expansion-v2` —436files.
- `C:\Codex\3D avatars\aiw-environment-audio-expansion-v2` —117files.

The [runtime/provenance manifest](../apps/web/public/assets/environments/expansion-v2/manifest.json) accounts for all553source files and58runtime media files. Importer: `tooling/scripts/import-environment-expansion.py`; supplier scripts/vendor preview software are not executed or installed.

- Eight RGBA horizon overlays, copied from runtime PNGs; wrap once around the cylinder.
- Six ground base colors, encoded as quality92 WebP without invented PBR maps.
- Ten transparent concept pictures, honestly exposed as optional decorative cutouts (1024px lossless WebP), **not GLB meshes**. Up to3types ×12instances; no collision or work-object semantics.
- Eight RGBA atlases using all ten supplied lightning/impact sources: three bolt shapes, horizontal arc, contact flash, shockwave, ground arcs, sparks, dust and fading scorch. Half-texel inset frame UVs, clamped edges, no mipmaps or duplicate-alpha masks.
- Fifteen byte-identical OGG ambience loops and eleven byte-identical event sounds. Whole-file loop/effect playback through existing audio ownership, no new audio provider.
- Masters, native images/audio takes, individual atlas frames, matching opacity/progress masks, QA and previews are inventoried but not redundantly loaded/shipped. Atlas RGBA already includes opacity.

Source limitations: props remain decorative cutouts, and some horizon/ground seams and source upscaling remain. The requested listening/mute checks are now user-accepted; long-session fatigue/mono coverage is not inferred. Aaron confirmed ChatGPT/Codex-subscription visuals and ElevenLabs-subscription audio generated using Codex (`1553072689655054407`). This supersedes the earlier unknown supplier-origin concern without inventing a blanket media license or authorizing publication. See [notices](../THIRD_PARTY_NOTICES.md).

## Operator controls

Hold right-click on Hack your World (or Shift+F10), then expand **Weather and expanded scenery**. Describe the World normally or pin particle/lightning, ground/horizon, cutout and ambience choices. Explicit controls override generated results. **Preview these settings** modifies the current scenic recipe without contacting an agent; Original uses Sunlit Trails as its base. Preview keeps Save to Custom / Use without saving / Revert; all recipe fields persist through the existing numbered slot API.

Weather: clear, light rain, heavy rain, snow, ash, sparkles, wind streaks, blowing leaves, sand and embers. Intensity/wind are0–1; lightning is off, distant, local, or both. Strike interval8–60seconds, default14; soft scene illumination is separately selectable. Particle choice is one type per recipe; lightning can accompany any type. Agents receive the actual extended schema and IDs, not an unsupported prose promise.

Both save and temporary-use confirmations expire after5000ms; errors remain visible. The project HUD clears the measured Hack controls/notices, including wrapping and tall preview states, with responsive height containment. The3D screen/camera behavior is unchanged.

## Renderer/audio boundaries

- One seeded particle buffer and draw call per active type: at most1152heavy-rain or384other particles, scaled by intensity; no per-particle React nodes. Procedural weather particles are not represented as supplied textures.
- Camera-facing ground cutouts are explicit2D scenery; all actors, city objects, movement and interaction ownership remain unchanged.
- One active lightning event timeline, starting after3seconds then the bounded interval. Both alternates distant/local. Local endpoints are clamped inside the actual floor and selected around the user's current position, with upright bolt/dust/sparks and horizontal ground flash/arcs/shockwave/scorch. Distant bolts/arcs inhabit the sky volume with no local ground impacts. No camera shake, gameplay damage, terrain deformation or physical shelter/rain collision.
- Supplied40fps lightning atlases are played at8fps over2seconds instead of replaying their rapid strobe. Scene illumination is one restrained soft pulse, never a fullscreen white overlay. Reduced Motion unmounts weather effects and suppresses weather event audio; actual operator comfort remains unaccepted.
- Strike callback comes from the renderer in both canvas paths. Local strike/impact/sizzle/near thunder and delayed distant thunder use the existing effects mute/unlock policy. At most one owned event group; mute, World replacement, Reduced Motion and exit cancel delayed cues and stop tails. Rain/wind/sand layer on scene ambience; music is separate.
- Existing resource preloading/paced GPU preparation, stable Original/compositor, cancellation and disposal remain. Recipe URLs/code/assets outside the allowlist remain refused. Weather is optional so older slots remain valid.

## Verification

Evidence root: `~/.hermes/runs/aiw-expansion-weather-20260924/`.

- Toast RED reproduced persisted Use without saving; HUD RED measured67.97pxoverlap. Corrected isolated real React components + disposable slot API prove4999msvisible/5000msabsent, preview/message clearance,390/894/1440pxwidths, explicit weather choices→save→disk readback→reload/cycle. This is not product-navigation automation.
- Source/hash coverage accounts for all58runtime media; all26OGGs fully decode through FFmpeg with no errors. Listening is not inferred.
- Isolated renderer: nine modes have live uniform time and different temporal samples; weather-on versus weather-off at the exact same frozen sky/time proves visible particles in every mode. Real atlas UVs advance; local bolt meets its ground impact; distant sky bolt/arc is separate; no captured page/shader errors. Reduced Motion removes weather/strikes; removal releases weather/environment geometry/textures while retaining the box actor. This is a box fixture/SwiftShader proof, not native-avatar performance/comfort acceptance.
- Initial elevated comparison left subtle particles faint; adjusted ash/sparkle/wind/sand/ember size and repeated normal-camera proof. Both attempts preserved (`render/`, `render-final/`). Final captures inspected; wind/sand remain intentionally subtle. Conventional final code/build results and live review ownership are recorded in the current status/handoff.

Final conventional gate PASS:253test files/1496tests,11architecture checks,format/lint/types, normal production build and startup/API smoke. Entry404614bytes within409600. Startup-budget failures411020and410234 were corrected by a lazy weather-audio owner and on-demand validated audio-path resolution; earlier attempts remain in evidence logs. Actual media58/58 and feature chunks match the new live review, both saved slots unchanged at replacement.

## Next gate

Open the verified normal build with retained state and saved custom slots; Aaron owns actual appearance, motion, sound, generation fidelity and comfort feedback. Fix concrete reported defects only. r186 upgrade, real prop meshes, physical weather interactions, publication/CI/merge and installers remain separate decisions.
