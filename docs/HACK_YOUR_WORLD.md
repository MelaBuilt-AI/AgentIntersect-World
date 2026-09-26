# Hack your World — custom authoring

## Follow-up PR — original descriptions and five-second notices

Aaron requested this separate follow-up in Discord `1553092183744057415`. Newly agent-created Worlds retain the exact description submitted at creation as optional slot metadata, separate from the validated rendering recipe. Open the custom dialog and expand **View description — Current World**, or **Custom slots on this PC → View description — Custom N**, then **Copy description**. Viewing/copying a slot does not load it or call an agent. The saved prompt survives refresh/backend restart; editing a later draft cannot overwrite it. Weather-only changes retain the original creation prompt; manually authored JSON and older slots without metadata say that no original description was saved. Old prompts cannot be reconstructed from recipes.

All transient Hack notifications now expire after five seconds: copied brief/description, clipboard or draft-storage errors, invalid recipes, saved/temporary-use/removal notices, slot errors, and generation/load failure alerts. Repeating the same notification restarts its timer; moving between dialog and World does not revive expired text. Expiry changes presentation only: failed preview state stays failed, retry controls remain available, active progress/current World labels and unresolved save/replace/remove decisions remain until resolved.

This follow-up is not new visual acceptance or merge permission. Preserve TEST45447 and its already-accepted build/state; no provider reruns, releases or Phase20. Normal code CI and isolated component/API proof are required for the new PR; human review of the changed UI remains separate.

## Previously accepted feature status

**Requested feature visuals, everyday-use checks and audio checks are user-accepted.** Aaron approved the distant lightning in Discord `1553070041526829118`, then confirmed the complete everyday-use and listening checklist in `1553072689655054407`. This document is the current feature summary; the [development history](HACK_YOUR_WORLD_HISTORY.md) preserves earlier attempts, failures and superseded runtime notes.

Aaron authorized PR delivery in Discord `1553079897830985900`: commit/push, obtain exact-head GitHub CI and readiness success, then merge. The Field Guide and public README will be updated alongside delivery. Preserve the accepted visuals and retained runtime; releases, installers and provider changes remain separate.

### First-hand acceptance

- **Transitions:** the floor/sky dematerialization and materialization look good; actors remain in the transforming World.
- **Performance:** Aaron reports substantially better FPS with the requested effects enabled. This is his tested workload, not an all-device FPS guarantee.
- **Scenery:** decorative rock shadows and grounding are accepted.
- **Lightning:** nearby strikes, larger upper-sky lightning and the additional small, frequent distant horizon lightning are accepted. Preserve the accepted look.
- **Saved worlds:** save a custom World, refresh and select it again with its weather/distant-lightning settings restored — PASS.
- **Cancellation/revert:** retaining a usable previous World through the requested cancel/revert checks — PASS.
- **Cycling:** Original → custom → another World → Original, without lingering effects/audio from the previous environment — PASS.
- **Listening:** ambience/nearby thunder balance, appropriate stopping on World changes and effects mute — PASS. Frequent horizon bolts intentionally do not generate a flood of thunder events.

The last four checks are Aaron's explicit full PASS for items 1 and 2 of the closeout checklist, not an inference from unit tests. They do not certify every unrelated PR feature, prolonged comfort, mono playback, every hardware/backend combination or optional microphone setup. The separate follow/Run correction has technical proof; no separate first-hand verdict is recorded here.

## Operator experience

- Original World remains the initial default. Left-click the globe under Escape for Menu to cycle Original, Sunlit Trails, Martian Expanse and saved custom Worlds.
- Hold right-click on the globe, or use Shift+F10/ContextMenu, to describe a World. Descriptions support 1–500 words with a 12,000-character cap. Multi-agent users choose the designer; only explicit Create dispatches the request.
- The selected actor's Dance loops during generation/loading with “Hacking your World!”. Existing scenery remains usable until the replacement is ready; environment-local effects do not obscure actor bodies.
- The committed scene swap starts Bow, “Enter World.”, the completion sound and concise report. Animation ownership then releases to normal movement/Idle/work. Reduced Motion uses static status/Idle and skips animated interference/weather.
- After preview, choose **Save to Custom**, **Use without saving**, or **Revert**. Cancellation, invalid output and failed loading retain the previous World and reject late results.
- The optional advanced recipe editor contains data-only visual settings, not executable code. Filling a starting point, copying a brief, previewing and saving are separate actions; none silently dispatches coding work.

### Weather and distant lightning

Expand **Weather and expanded scenery** to pin particle, lightning, ground/horizon, cutout and ambience choices. Explicit selections override generated choices; From description leaves them to the agent. **Preview these settings** does not contact an agent. Original uses Sunlit Trails as a scenic starting point.

- Particle modes: clear, light/heavy rain, snow, ash, sparkles, wind streaks, blowing leaves, sand and embers. One particle type per recipe; lightning can accompany it.
- Main lightning supports off, distant/upper sky, local, or both, with existing intensity, cadence and soft-illumination controls.
- **Distant horizon lightning** is an additional independently configured band above the mountain silhouettes. It supports density 0–1, interval 2–12 seconds per region and elevation 0–20 degrees. Explicit defaults are density 0.7, interval 4 seconds and elevation 2 degrees; shorter intervals plus higher density give a busier distant storm.
- Regions flash at staggered times with small varied bolts and localized glows, rather than a synchronized full-screen burst. Upper/local lightning remains intact. Omitting the horizon setting, or density zero, leaves it off and preserves older recipes.
- Effects mute/autoplay unlock remains authoritative; music is separate. World replacement, mute, Reduced Motion and exit stop owned weather cues/tails. No new audio provider or speech synthesis is added.

Example description:

> A rocky storm world with large branching lightning overhead, plus many small, frequent distant bolts just above the mountain ridges, with soft surrounding flashes.

### Custom slots and continuity

There are eight explicit install-local numbered slots. Saves use the configured backend data root's `environment-library/`, not browser-origin localStorage, and are read back before being reported as saved. Occupied-slot replacement and removal require confirmation. There is no oldest-item eviction or name-based overwrite; empty slots are skipped when cycling.

Legacy browser-saved recipes remain explicitly importable without deleting their originals. Transient notices and error alerts expire after five seconds; underlying failure state and retry/decision controls remain. Project / Current Work clears the measured Hack controls and notices rather than overlapping them.

## Library and rendering

- The original environment pack and 48-asset custom library provide terrain/ground colors, masks, backgrounds, horizons, celestial sprites and atmosphere layers.
- The v2 intake accounts for 553 supplied source files and 58 runtime media files: eight horizons, six ground colors, ten decorative cutouts, eight FX atlases and 26 sounds. Masters, variants, individual frames and supplier preview software are not all runtime assets. See the [v2 inventory and original verification](HACK_YOUR_WORLD_WEATHER.md).
- Recipes are validated `aiw.environment/1` data with allowlisted assets. They do not accept arbitrary paths, URLs, executable code or shaders, and cannot modify repository authority or movement collision rules.
- Current rendering uses Three 0.186.0/WebGPU, supported PCF/SunLight shadows, retained scene resources and prepared transitions. Cutouts use alpha-shaped cast shadows and contact shading. Independent live atlas UVs preserve moving lightning even with a stationary camera, without per-flash image uploads.
- All-effects optimization removed redundant shadow rendering from fog-only depth capture without reducing the enabled effects or their quality settings. Technical mechanism, evidence and limits are in the [renderer summary](THREE_WEBGPU_UPGRADE.md).

### Known limits and deferred work

Decorative cutouts are camera-facing 2D artwork, not volumetric rock meshes. Terrain remains finite and essentially flat; authored grass/rock scatter and supplied cutout counts are bounded. Source seams, transparent padding, softness and upscaled masters can limit fidelity. Higher input dimensions do not imply native 4K detail or independent PBR maps.

No physical weather collision/shelter, terrain deformation, damage, water simulation or camera shake is promised. True terrain meshes, denser scenery, water systems and further weather expansion are later slices, not missing scope in this PR.

## Restricted generation and native selection

The session-scoped GET/POST `/agent-sessions/:sessionId/environment` uses the selected stored connection through the normal `/api` proxy. Generation validates the returned recipe, shares exact-session busy ownership and releases it on completion/cancellation. It does not resume or rewrite the coding conversation.

The stateless `/environment/mcp` endpoint exposes `describe_environment` and `propose_environment` for validated data-only proposals; it is not installed globally and does not apply scenes directly. There is no unrestricted-chat fallback.

Technical full-path recipe generation has passed for OpenClaw WSL, default Hermes WSL, Codex WSL/Windows native and Claude WSL/Windows native. Each uses the selected supported installation with feature-specific restricted generation and canonical authentication ownership. These earlier provider results are not rerun by documentation closeout. Differently rooted named Hermes OAuth profiles remain unsupported; deep Windows paths remain subject to native accessibility limits. Detailed mechanisms and original failures are preserved in [history](HACK_YOUR_WORLD_HISTORY.md).

## Verification and delivery status

Latest horizon-change verification: **60 files / 236 affected tests plus 11 architecture checks**, scoped formatting/lint, schema/renderer builds, web/backend types, normal frontend build and isolated backend compilation passed. Native Windows Edge captures show both lightning layers, changing lower-band samples, retained actor identity and removal under Reduced Motion, with zero captured errors. Real compiled-backend HTTP save/readback after restart preserved both main and horizon settings; isolated component preview/save/reload/cycling passed.

Evidence: `~/.hermes/runs/aiw-horizon-lightning-20260925/` (`gate.log`, `summary.json`, `smoke.json`, `native-final/`, `component/`). Earlier full-suite and renderer results remain scoped to their recorded versions; 236 is the latest affected-suite count, not a fresh whole-project run. Existing optional large-chunk and Three CJS warnings remain.

**Authorized PR delivery work:** perform the normal final code checks, commit/push, exact-head hosted CI/readiness and green-gated merge. These local changes have not been represented as delivered by the older draft PR26 checkpoint. No additional feature expansion or repeat of accepted manual checks is recommended absent a concrete regression.

## Asset provenance

Aaron confirms in Discord `1553072689655054407` that the feature's visual assets were produced through his ChatGPT/Codex subscription workflow, and its audio through his ElevenLabs subscription using Codex. This resolves the previously unknown supplier-origin note for these supplied packs. Record the owner's statement without inventing an independently verified plan, model identity or blanket redistribution license.

Generated-media terms remain separate from the software MIT license; source hashes, imports and derivatives remain documented. See [Third-party notices](../THIRD_PARTY_NOTICES.md). Recording provenance does not itself publish assets or authorize a push, release, standalone asset resale or installer.

## Retained normal test

**TEST45447: http://127.0.0.1:45447/** is the retained operator test; leave its browser, state and served artifacts untouched. Matching backend uses the tested `server-dist/index.js`; frontend uses the tested `web-dist/`.

- Service: `aiw-horizon-review-20260925.service`; backend 44047; native Edge CDP 49447.
- Kit: `~/.hermes/runs/aiw-horizon-lightning-20260925/review/`.
- Windows state/profile root: `C:\Users\Mela AI\AppData\Local\AgentIntersect-World\acceptance\aiw-horizon-review-20260925`.
- From the kit, `python3 check.py`, `python3 stop.py check` and `python3 close-browser.py check` are read-only. Re-attest owners before any later authorized close; never use historical PID values as kill authority.
- TEST45443 was stopped; its profile, state and work remain retained. No old native roster/registration state was copied into this fresh test. Optional local voice setup remains separate and was unavailable at launch; the listening PASS does not imply microphone installation.

The service survives chat turns, not necessarily Windows/WSL shutdown or sleep. No stop, restart, refresh, setup or provider action is part of this documentation update.
