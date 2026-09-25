# Third-party notices and asset provenance

## Scope of the root license

The root [MIT license](LICENSE) applies to the project's first-party software. It does not replace licenses on third-party components or create rights to third-party trademarks. This notice records provenance and review status; it does not invent or substitute a license for supplied media.

## Runtime dependencies

[Production dependency inventory](docs/licenses/production-dependencies.json) records installed production dependency names, versions and declared licenses from the pinned workspace. It intentionally omits local installation paths and account details.

The inventory currently contains MIT, Apache-2.0, BSD-3-Clause and ISC declarations. Retain the applicable upstream copyright/license/NOTICE texts when redistributing those components. A metadata inventory is not a substitute for the license files accompanying an installed dependency or a packaged distribution. Refresh it when the lockfile or production dependency set changes; development tools are outside this production-only inventory.

Node.js and any separately downloaded local speech provider/model retain their own licenses. Product installers must include the exact notices for what they actually bundle; this source soft launch does not certify a future installer. Supported agent harnesses are separate products and are not relicensed by this repository.

## Models and graphics

- **Original Blender avatar kit:** project-authored geometry, rig and animations. See [asset provenance](docs/PHASE_11_ASSET_PROVENANCE.md).
- **Imported avatar models:** the maintainer generated these under a Tripo3D subscription and explicitly confirmed public use and redistribution for AgentIntersect World. See the source-and-usage authority in [the imported-avatar scope](docs/AVATAR_REPLACEMENT_MODULAR_ANIMATION_SCOPE.md). This is the recorded owner confirmation, not an independent legal opinion or a claim that every Tripo3D plan has identical terms.
- **Repository City models:** [the intake receipt](assets/repository-city/receipt.json) records the same owner-confirmed Tripo3D provenance and byte-preserving import.
- **Other supplied textures, UI/brand artwork and effects:** the maintainer approved their inclusion in this source publication. Retain their source records and applicable supplier terms. A file provenance/hash is not an independent permission grant, and the root software license does not create a blanket media sublicense.

Names and logos of GitHub, Discord, X, Claude, Codex, Hermes, OpenClaw and other third parties identify integrations or destinations. No endorsement or trademark license is implied.

## Music and sound effects — commercial use confirmed

The Black Circuit soundtrack/effect pack has a [file/hash provenance inventory](apps/web/public/audio/black-circuit/provenance.json). The supplied source pack identifies **ElevenLabs Music v2** and **ElevenLabs Sound Effects v2**, with no third-party reference recording uploaded. The maintainer confirms a subscription permitting commercial use and explicitly approves retaining the music and sounds in World, including this source publication. Materialization and repository-stream effects retain their supplied source records.

This records the owner's use/publication decision, not an independent legal opinion about every subscription plan or a grant of unrestricted audio reuse. Applicable [Music terms](https://elevenlabs.io/music-terms), [v1/v2 model-specific terms](https://elevenlabs.io/eleven-music-model-specific-terms) and [Sound Effects terms](https://elevenlabs.io/sound-effects-terms) remain separate from the software MIT license. No blanket MIT relicensing of audio is asserted.

## Hack your World environment pack

The maintainer supplied eight terrain/sky PNGs and eleven atmosphere/transition WAV masters for this feature. The [environment asset manifest](apps/web/public/assets/environments/manifest.json) records source filenames/hashes, browser encodings and output hashes. The original masters are retained outside this repository; only derived WebP textures and Vorbis audio are shipped here. The supplied floor images are precomposed material artwork, not independent PBR layers. These records establish provenance, not a blanket MIT sublicense for media. The supplied 48-asset [custom-library-v1 manifest](apps/web/public/assets/environments/library-v1/manifest.json) additionally records independent ground colors, masks, skies, horizons, celestial sprites and atmospheric layers. Its supplier identifies built-in image generation (model identity not exposed) plus procedural Python masks/starfields. Larger generated masters are upscaled rather than native 4K; transforms, alpha/dimensions, source hashes and lossless browser outputs are recorded without asserting renderer or legal certification.

## Environment expansion v2 — owner-confirmed generated provenance

Aaron supplied the v2 visual/audio packs for this local feature pass. The [v2 import manifest](apps/web/public/assets/environments/expansion-v2/manifest.json) accounts for all553 source files and58 runtime files:8 horizons,6 ground colors,10 explicitly decorative concept cutouts (no supplied GLB meshes),8 animated FX atlases and26 OGG sounds (15loops/11events). Native/master/frame/mask variants and supplier preview software remain at the supplied source paths, not copied as executable dependencies. Runtime RGBA horizons/atlases and OGGs are byte-identical; ground WebPs and1024px lossless cutouts are documented derivatives. Supplied seams, upscaling and the cutouts’ flat geometry remain limitations. Aaron subsequently accepted the requested feature appearance and listening/mute behavior; broader mono/long-session comfort is not implied.

Aaron confirms in Discord `1553072689655054407` that all supplied Hack your World visual assets were produced through his ChatGPT/Codex subscription workflow, and the audio through his ElevenLabs subscription using Codex. This owner statement covers the base environment, custom-library and v2 expansion packs and supersedes the earlier unknown supplier-origin note. The retained pack metadata identifies built-in image generation/procedural assets and ElevenLabs Sound Effects v2; exact image-model identity is not newly inferred.

This records owner-provided provenance, not an independent account-plan/legal certification or unrestricted downstream media license. Applicable OpenAI/ElevenLabs terms remain separate from the software MIT license; original manifests and source/derivative hashes are retained. This documentation approval is not itself permission to push, publish, release, resell standalone assets or bundle an installer; those project delivery actions still require authorization.

## Screenshots and recordings (existing publication)

Product demos and historical proof captures contain names, paths, identifiers, short development/testing excerpts and third-party interfaces. Following the bounded review described in the [source soft-launch checklist](docs/launch/PUBLIC_SOFT_LAUNCH_CHECKLIST.md), the maintainer approved retaining the reviewed history as-is. This is a publication decision, not exhaustive pixel/audio clearance or third-party relicensing. `docs/internal` is organizational rather than private; historical evidence bytes remain unchanged.
