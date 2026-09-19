# Audio pass 1 and integration repair — active scope

> **September 9 delivery update:** Aaron authorized the cumulative PR, push and conditional merge after CI/readiness are green (`1547254171474993302`). The current delivery/acceptance cutline is `PROJECT_STATUS.md`; dated no-delivery and pending-test statements below are historical records, not current authorization. Retained runtimes, public/release actions and later-phase scopes remain protected.

Aaron authorized direct end-to-end implementation in message `1546400539430883369`, supplying `aiw_audio.txt` on 2026-09-07. This supersedes the prior planning-only marker, but not the separate merge/publication, protected-profile, retained-runtime cleanup, full Slice 6 or Phase 20 gates.

## Latest operator checkpoint — 2026-09-07 16:11 EDT

Aaron accepted the Code Wheel audio (`1546558521611518223`) and subsequently confirmed the full coding flow and new website opening in World View (`1546575094506328175`). Earlier first-preview failure is now handled visibly, and the Codex default coding deadline is bounded at ten minutes. Idle alone remains insufficient evidence of coding success.

The remaining wheel failure was reproduced natively: changing the iframe from pointer-events none to auto left uncancelled wheel events unable to scroll. Keeping the iframe enabled from initial mount and controlling ownership with a separate input shield passes 36/36 points each in Windows Chrome and Edge, using the actual website and served production stylesheet. Normal World HUD/spatial journeys 2/2 and focused tests/types/lint/build pass. **Aaron's final mouse-scroll acceptance is pending**, not implied by technical proof. See `PROJECT_STATUS.md` and `/home/user/.hermes/runs/aiw-scroll-current-20260907/`.

At handoff (`1546613809068908545`) Aaron explicitly asked to keep World45279 and current website46381 running until his return. Existing Workstream/session preserved; no coding retry, restart, rebuild or Git delivery during closeout. Prior complete audio listening pass remains accepted; the later setup-autoplay launch change has technical proof but no separate explicit operator verdict.

## Historical operator acceptance and requested extension — 2026-09-07

Aaron explicitly passed audio in `1546525099711004753`: “audio is a complete pass”. His requested Code Wheel middle-mouse open/close projection cues are implemented and browser-tested, with new cue listening acceptance pending. The same message requested Workstream code-slab embodiment and reported spatial-preview wheel failure. Embodiment has fixture-browser proof; wheel scrolling passes automated/isolated native diagnostics but the exact operator failure remains unresolved, not fixed. See current `PROJECT_STATUS.md` and `aiw-workstream-embodiment-20260907/RESUME-OUTCOME.md`.

## 2026-09-07 operator corrections — THREE FIXES VERIFIED; scrolling remains OPEN

Aaron authorized all reported fixes in `1546548733208952903`.

- **Stale Workstream:** selected repository was correct. The server retained a blocked Workstream from a different Codex session. Normal World now hides that foreign-owner slab/preview; a new request creates a fresh Workstream. Before replacement the server archives the old record under its store's `archive/` and preserves its dirty worktree. An in-flight old turn still blocks replacement. No old native retry, cancellation, or reassignment.
- **Setup music:** every launch starts music enabled, ignoring the legacy saved music-mute flag. Browser autoplay policy still governs playback, with existing first-interaction/Play unlock. Effects mute retains its saved preference; music mute still works within the launch.
- **Code Wheel dismissal:** its portal-owned close callback now emits `projection-off`. A real middle click on the center reproduced the silent dismissal; the previous synthetic room-handler test missed it.
- **Proof:** 51 focused tests in four files PASS; affected lint, web/server types and production builds PASS. Final production browser audio + stale-owner normal-Workstream journeys **2/2 PASS** (`final-proof/`). Full spatial-screen journey **1/1 PASS** in `combined-repro/`; its audio failure is the retained pre-fix RED. Final audio desktop and Workstream actor screenshots inspected. No new full-suite or live Codex execution claim.
- **Scrolling NOT fixed:** operator video retained. Isolated native Edge and Chrome replay of captured spatial DOM, including the actual old homepage, delivered wheel input and scrolled at sampled points. A tall-page angle matrix also passed. These results do not reproduce or invalidate Aaron's native angle/spot failure; no speculative scroll handler was added. The old homepage is short, not the requested multi-section test page, because those later tasks were rejected. Retest after a successful fresh homepage request; exact live failing pose/input capture may still be needed.
- **Activated:** only `aiw-pass1-acceptance-20260907.service` restarted after verifying selected Codex idle. Same frontend `http://127.0.0.1:45279/`, backend43879, state directory and ready session retained. Session and Workstream store files remained byte-identical across restart (`post-reload.json`); served entry assets match the fresh build. The owned preview process may need starting again through normal controls. No browser reset, automatic Codex request, Hermes restart, provider change, commit/push or phase promotion.

Evidence root: `/home/user/.hermes/runs/aiw-operator-notes-20260907/`. Manual acceptance is still Aaron's; refresh the existing page, retry the multi-section homepage request, then test scrolling, follow-up pages, setup playback and wheel dismissal.

## Historical technical closeout — 2026-09-07

Implemented and technically verified; Aaron's listening/visual approval is still pending. Final local lint/types/build and 1,153 tests across 184 files passed. Four affected production-browser journeys passed. Real native Codex selected-root/worktree/edit/receipt/approved-preview/follow-up/revision-2 proof passed in `native-attempt6`; no Hermes acceptance is implied. The later player-height/Workbench spacing correction passed the final affected browser gate without changing backend behavior.

The checklist below records the implemented technical scope, not human acceptance. Earlier failed runs are preserved. Current manual preview: http://127.0.0.1:45279/ (fresh isolated Codex-only state, Node24). Evidence and operator steps: `/home/user/.hermes/runs/aiw-pass1-completion-20260907/OUTCOME.md`.

## Delivery slices

1. Integration repair: selected repository → owned worktree → native cwd/task context; changed-file evidence; approved owned loopback preview; terminal failure/recovery truth; populated stale-agent layout.
2. Audio pass 1: lightweight player, supplied soundtrack/effects and local file playlists. Independently testable from integration repair. No streaming-service login/integration in this pass.

Work directly in the ordinary project worktree. Preserve pre-existing untracked plans/QA files, failed homepage/native session and all retained operator processes/state. Fresh disposable verification may exercise new sessions; do not retry or cancel the retained failed session. No external Sites action. No change to original AgentIntersect or protected provider/profile configuration.

## Audio acceptance

Use the supplied Black Circuit assets from `C:\Codex\3D avatars\AgentIntersect-World-Black-Circuit`. Preserve masters; prefer supplied matching web encodings for lightweight browser delivery after validating their manifest/files. No runtime generation/API credentials.

- [x] Opening: `00-black-circuit` loops from first permitted playback through startup menus, ends on entering World. Show actionable autoplay-unlock state; never block entry.
- [x] World: tracks 01–12 play in numeric order, then repeat the playlist, not one track.
- [x] Compact onscreen player in menus and World: separate music and effects mutes, play/pause, previous/next, track title and source selection. Keep active blue/disabled grey and responsive/keyboard-accessible controls.
- [x] Local multi-file/folder selection creates a browser-only playlist; support local M3U/M3U8 ordering against explicitly selected files. No file upload or implicit filesystem/network access. Revoke object URLs on replacement/teardown; show unsupported/missing files truthfully. Local files need reselection after reload.
- [x] Reserve a clearly unavailable streaming-services source without pretending integration exists.
- [x] Enter World button: `world-jack-in`.
- [x] In-World ambience: `code-canopy` loop, controlled by effects mute.
- [x] Agent coding begins: `agent-activate`; ongoing: `agent-coding-loop`; cancellation/failure: `agent-cancel`; successful completion: `agent-complete`. Bind to structured active work/terminal events, not prose or rerenders; independent per-agent loops, clean terminal/removal teardown.
- [x] Grab object/spatial screen: `object-grab`; held: one `object-hold-loop` (spec items 12/14 duplicate); drop: stop loop and `object-drop`.
- [x] Repository code screen on/off: `screen-extrude-on` / `screen-extrude-off`.
- [x] Repository City first successful load: `repo-city-spawn`; object selection: randomized `repo-select-01/02/03` per selection.
- [x] Spatial screen → 3D: `projection-on`; → 2D HUD: `projection-off` (explicit implementation assumption for spec item 20, whose asset is omitted).
- [x] Code/World View focus enlargement: `projection-on`; return: `projection-off`.
- [x] Submit/chat: `ui-activate`; Back: `ui-back`; disabled interaction attempt: `ui-unavailable`; ordinary menu buttons: randomized `ui-click-01/02/03`. Avoid double-firing generic and specific effects for one action.
- [x] Start loops at most once per owner; stop on release, terminal failure, removal, World exit or teardown; prevent delayed async loading from resurrecting stopped loops.
- [x] Updated by operator request: setup music starts enabled each launch (legacy saved music mute ignored); music mute applies during the current launch and effects mute remains persistent. Music pause holds actual playback time and music mute does not mute effects. Keep long media lazy/streamed and bound effect concurrency.

## Integration acceptance

- [x] Selected root, not launcher fallback, owns new workstream creation. Empty/unborn repositories either work in isolation or refuse before dispatch with a clear initial-commit instruction; never silently write into World.
- [x] Server resolves native cwd from attested workstream authority, not arbitrary client path or prompt parsing. Native metadata/auth remains in its isolated runtime home. Task context names owned workspace and instructs local preview through World, not external hosting.
- [x] Real worktree changes appear in workstream diff/evidence; no fabricated validation pass.
- [x] World View exposes approval for a bounded supported local preview recipe and launches through the existing process owner, not a sandboxed agent server/network bypass. Keep previous verified preview on candidate failure.
- [x] Failed native turn is persisted/projected unavailable or failed, never ready/working; precise safe error and explicit recovery controls, no automatic native retry.
- [x] Populated stale roster and connection form have separate layout space; long names/messages wrap without overlapping actions or Enter World at desktop/portrait.

## Remaining human/delivery gates

- [x] Aaron's audio pass 1 listening/balance approval.
- [x] New Code Wheel cues manually accepted; Aaron observed slab spawn, travel, Dig coding and Idle, then confirmed successful coding and new website opening.
- [ ] Native iframe-wheel correction manually accepted across center/left/right in expanded HUD and spatial mode; technical reproduction and correction now pass, operator retest next.
- [ ] Separate explicit verdict on the later setup-autoplay launch change (browser unlock restriction preserved).
- [ ] Separately authorized commit/push/PR/merge and exact-SHA CI.
- [ ] Full Slice 6, Hermes acceptance and Phase 20 remain separate scopes, not promoted by this repair.

## Verification and non-goals

Focused regression RED/GREEN, affected types/lint/build, exact built-browser UI/media time proof and normal-World repository/workstream/preview behavior. Separate fixture proof, real native provider proof and Aaron's subjective audio/visual acceptance. Keep preserved historical failure evidence. No generic command executor, autoplay bypass, agent TTS, streaming implementation, new public network access, source-master edits, public release, merge or unsupported later-phase promotion.
