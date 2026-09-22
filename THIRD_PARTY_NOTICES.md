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
- **Other supplied textures, UI/brand artwork and effects:** retain their source records. Before changing repository visibility, the maintainer must confirm that public source redistribution and any intended reuse license are covered for each supplied family; a local-file provenance or hash alone is not a permission grant.

Names and logos of GitHub, Discord, X, Claude, Codex, Hermes, OpenClaw and other third parties identify integrations or destinations. No endorsement or trademark license is implied.

## Music and sound effects — commercial use confirmed

The Black Circuit soundtrack/effect pack has a [file/hash provenance inventory](apps/web/public/audio/black-circuit/provenance.json). The supplied source pack's production README identifies **ElevenLabs Music v2** for the music and **ElevenLabs Sound Effects v2** for the effects, with no third-party reference recording uploaded. That establishes generation provenance, not the generating account's subscription/license terms or permission to sublicense raw audio through a public source repository. Review the applicable [Music terms](https://elevenlabs.io/music-terms), model/API terms and [Sound Effects terms](https://elevenlabs.io/sound-effects-terms) against the actual account agreement. Additional materialization and repository-stream effects likewise need an explicit owner/source rights record.

The maintainer confirms an ElevenLabs subscription that permits commercial use. That confirmation is recorded; commercial-use permission is not treated as missing. The [model-specific terms for v1/v2](https://elevenlabs.io/eleven-music-model-specific-terms) separately address Music Libraries & Repositories and distinguish those rights from commercial media use. Before exposing raw soundtrack files for unrestricted reuse, confirm the intended source-distribution arrangement against the applicable agreement or with ElevenLabs. This notice does not conclude that bundling audio in World is prohibited, and it does not blanket-relicense the audio under MIT. The exact plan name, any custom permissions, and separate grants for other supplied artwork/effects have not been independently verified.

## Screenshots and recordings

Product demos and historical proof captures may contain usernames, paths, conversation content or third-party interfaces. Review those separately from software licensing. Moving a capture into `docs/internal` does not make it private in a public repository. Historical evidence bytes have not been rewritten by this notice.
