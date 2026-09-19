# Setup discovery, native connection and Add Agent follow-up

Updated: 2026-09-14. Aaron reports FULL PASS for the accumulated changes and fixes on fresh TEST 45345 and authorizes cumulative delivery through PR #12, exact-head green CI/readiness, merge, merged-main verification and handoff. This supersedes the earlier split-delivery plan and pending/uncommitted statements below, which remain historical execution records. Seven inherited plan/diagnostic/generated residuals stay excluded. Release/publication, runtime cleanup, Phase 20 and broader environment/restart acceptance remain separate. Exact final SHAs and workflow receipts are external to avoid recursive status commits.

## September 14 — wheel closes when opening task windows

Aaron (`1549069782802899049`) requests automatic close on Load Repo, Workbench and New Workstream, retaining the correct middle-click exclusion inside those windows.

Locally verified: primary Load Repo / Workbench / New Workstream activation calls the existing wheel-close handler, then the existing action. Selected recipient, Follow/Stop and Screens toggles remain unchanged. All three close/middle-click-exclusion/reopen-target browser cases and the complete Code Wheel pointer/workstream/spatial journey pass; the former Open local interception is resolved. Eight focused geometry/asset tests, web types, scoped lint/format and production build pass. Production output and screenshots: `/home/user/.hermes/runs/aiw-wheel-dismiss-20260914/` (`web`, `green`, `windows`, `window-final`). Initial `red` had a wrong test-only Reconnect label; `red-fixed` reproduces all three intended wheel-remains-open failures. Intermediate window captures exposed an incomplete Workstream history fixture, corrected with the existing API envelope and an explicit empty-history/no-alert assertion; final Workbench retest passes. These are fixture UI proofs, not native agent work or new operator acceptance.45337/current data remains untouched; disposable43931/45331 listeners closed. No commit/push/merge or automatic new operator lane.

## September 14 — message targeting corrected; earlier retest accepted

Aaron (`1549061540605464667`) reports ALL PASS on45337 for additions/materialization, exact source SFX and idle Code Wheel. That acceptance does not cover these newly reported target UI defects.

- Pending recipients now follow the existing dispatch rules: explicit wheel recipient first, otherwise a normalized, unambiguous leading @display-name mention, otherwise all ready connected agents. Unknown/ambiguous/empty mentions do not falsely light the entire roster. Response dispatch itself is unchanged. Thinking/activity and pending command sound use the same recipient IDs.
- Code Wheel recipient selection no longer clears when text/voice is queued or a directed movement command is handled. It persists across sends until explicit clearing; the existing X restores All agents. Successive sends preserve exact target IDs.
- Both new production-browser regressions failed on the previous build for their intended reasons, then passed against the rebuilt isolated frontend. Held requests prove only the addressed agent enters Thinking for two distinct mentions; two successive wheel-targeted messages remain targeted and X returns the next request to all agents. Screenshots were inspected. Grouped voice/text/refresh and mention/directed-follow journeys also pass.
- Focused tests: 41 passed. Web non-emitting types, scoped lint, formatting and diff checks pass. Production build lives in `/home/user/.hermes/runs/aiw-message-targeting-20260914/web`.
- The broader Code Wheel journey passes the newly persistent Follow/Stop targeting steps, then fails at Load Repo → Open local because the still-open wheel intercepts pointer input. The unchanged previous arrival/wheel build reproduces the same overlap in a separate baseline run; this is retained as a separate pre-existing UI failure, not silently counted as green or fixed outside the requested scope. Initial baseline-copy ESM/workspace-resolution attempts were harness failures before the valid reproduction.
- Evidence: `/home/user/.hermes/runs/aiw-message-targeting-20260914/` (`unit.json`, `red`, `green`, `affected`, `baseline-wheel`, `verification.json`). Four browser journeys passed; one additional broader journey failed. No native agent conversations, live operator UI actions, commit/push/merge or replacement manual lane.45337 and prior operator states remain untouched; disposable QA listeners43931/45331 are closed. Manual targeting acceptance pending.

## September 14 — later materialization, source SFX and idle-wheel correction

Aaron accepted the preceding Beans/Mr Fluff Add Agent retest (`1549046882590785641`) and requested materialization for later entrants plus correction of the Code Wheel's cold/idle opening stutter. His mid-turn addition supplies the sound from `C:\Codex\3D avatars\AgentIntersect-World-Avatar-Materialize\masters\sfx\avatar-materialize.wav`.

- Later appended actors now own an independent ready → GPU preparation → one-second wait → existing code-rain assembly. Established actors and the World/camera stay mounted. Initial entry retains its shared arrival; Reduced Motion preserves readiness/delay and skips assembly.
- The append-only render-slot identity remains stable during single-to-multi promotion, even when native session IDs become roster IDs. A real browser regression caught duplicate original/new-agent arrivals and two sound cues before this correction.
- Materialization sound fires once at actual reveal start: one shared cue for simultaneous initial entry and one per later entrant. It uses existing SFX mute/autoplay-unlock controls; cancelled selection does not trigger it. The source WAV is copied unchanged to `apps/web/public/audio/avatar-materialize.wav`: 720044 bytes, stereo PCM, 48000Hz, 2.5 seconds, SHA-256 `ccb8bb748a0daebbb00312082e8f49b6bbc2eee0cd7685b1c6f9c5a3987b5e0b`. Served bytes were compared with the supplied master.
- Native tracing identified expensive WebP decoding/raster work when the small wheel requested the full 4096px rain artwork. Only its SVG image references now use `02_terminal_rain_wheel.webp`, a 1024×1024 Pillow Lanczos/quality95/method6 derivative of the existing map. It is 340746 bytes with SHA-256 `acf4d5d4925cd37d077c88e735fc24db232d3715f6b2b58bf5e45fdda808c9a0`; the original World map remains unchanged (`d04ed6d1570ac038cae499aae1f8f60a42491a9f647626520a932fe5ea82a93b`). Wheel faces, glyph density, geometry, interaction and flowing appearance are retained; no perpetual hidden warmup loop was added.

### Verification and limits

Evidence root: `/home/user/.hermes/runs/aiw-arrival-wheel-20260914/`.

- 47 focused tests across five files passed; affected renderer/web types, lint, production build and whitespace checks passed. Asset-budget, per-group preparation, once-only cue, SFX policy and resource cleanup regressions cover the correction.
- `arrival-verified/results.json`: all three production-browser Add Agent journeys passed (single→two, two→three, three→four), with delayed new GLB, unchanged canvas, cancellation, capacity and refresh. Each addition produced exactly one real WAV playback with advancing media time. Normal-motion mid-assembly and completed screenshots were separately captured and visually inspected; other cases retained Reduced Motion.
- Retained failed/invalid evidence: early native probes used the wrong canvas selector/trigger host; these are harness failures, not timing evidence. `arrival-green` retained a portrait-geometry call deadline; its unchanged numerical bounds/deadline passed with a single atomic DOM geometry sample. `single-cue-red` proves duplicate cue requests. `arrival-final` accidentally bundled stale renderer `dist` after a non-emitting check; rebuilding the exporting workspace before the app produced `arrival-verified`. No assertion or timeout was loosened.
- Native wheel RED/GREEN trace/frame/pixel captures and initial-audio receipts live at the evidence root. Cold/warm/real-180-second-idle maximum frame gaps were166.7/149.9/166.7ms before and8.5/8.5/41.8ms after; all182/183/177 GREEN sky samples were distinct. Native initial entry produced one materialization WAV playback, advancing to2.5 seconds. These are fixture-controlled native Edge/live-model proofs, not a new real agent-chat test or Aaron's visual/listening verdict.
- Operator45333/backend43933/browser49333 and their accepted test state remain untouched. No gateway/native agent dispatch, commit, push, merge, release or automatic replacement retest is authorized or performed. Later refinements require Aaron's visual/listening retest.

## Implemented

- Discovery records backend-local WSL as WSL, reads native Linux distribution metadata and deduplicates launcher aliases only within the same environment/home. Windows, WSL distributions and genuine installation/profile alternatives stay distinguishable.
- Setup groups installation details under harness/environment cards. Durable ready attachments collapse to green Successfully Connected state. Failed recheck restores the setup inputs and retains the entered display name/profile.
- Claude's stream parser accepts the observed additive `rate_limit_event` without weakening initialization, session-identity or completion checks.
- Selection/connection Cancel invalidates the pending attempt and propagates abort to World-owned native creation; late-created identities are ended using their exact owner. Existing native bindings remain intact.
- Escape → Add Agent uses saved registrations, can open setup, requires explicit avatar acceptance, preserves the mounted World when expanding single-to-multi, and respects the four-agent cap. Existing roster members are retained when adding the next member. Refresh restores the expanded constellation.

## Evidence obtained

### Local code and browser proof

- 106 focused tests in 10 files passed: discovery, setup service/runtime/UI/selection, Claude/Codex adapters, session API and entry reducer/client.
- 7 adapter-conformance tests passed, including late cancellation ending only the newly created native identity while the preexisting session stays ready. Combined focused total: 113 tests in 11 files (not a full-repository test count).
- Changed-source/test formatting and lint passed. Web and local-server non-emitting typechecks passed. Package and full production builds passed under Node 24.18.0; no bundle ceiling was raised.
- Four new production-browser journeys passed: desktop/mobile grouping + green attachment + failed recheck; initial native connection Cancel; single-to-two Add Agent; three-to-four Add Agent. Addition journeys cover Cancel during recheck before native creation, explicit avatar acceptance, same DOM World marker, one successful native-create request, retained roster capacity and reload persistence. Strict page-error arrays stayed empty.
- Browser attempt 2 failed because the new fixture answered `/check` instead of the actual `/recheck`; corrected fixture passed unchanged production behavior. The earlier lifecycle-race diagnosis was explicitly withdrawn. No readiness assertion was weakened.
- The browser Cancel journey and gateway conformance test prove separate boundaries; they are not a claim of every native adapter's cancellation on real hardware.
- Desktop green status, portrait recheck and Add Agent capacity screenshots were captured and inspected. Human visual acceptance remains separate.

### Real native connection proof

Disposable World-owned session creation succeeded with the saved native configuration for Claude Windows, Claude WSL and Codex WSL. The exact created bindings were then read back from their persisted binding files as `ended:true`, `quarantined:false`.

Codex originally explicitly refused saved `gpt-6-astra` because its selected CLI version was too old. The update permission was reissued. The administrator-owned install could not be updated noninteractively; an operator sudo command was supplied. Subsequently `/usr/local/bin/codex --version` returned `codex-cli 0.154.0`; configuration/authentication hashes remained unchanged and its actual creation probe passed. No replacement model or second PATH-shadowing installation was used. These probes establish native connection creation, not new coding/Workstream/preview acceptance.

## Preserved state and delivery boundaries

- The existing operator candidate on port 45321 still verifies against the original acceptance manifest. It has not been replaced, reset, restarted or driven automatically.
- All seven frozen preexisting residual files matched their baseline hashes, including the intentionally dirty historical pointer-lock screenshot and build-info file. Do not stage those residuals with these fixes.
- Browser probes used disposable state and attempt-scoped evidence outside the repository. No commit, push, merge, release or public publication was performed in this follow-up.
- Keep setup corrections and Add Agent as separate delivery slices when preparing commits/PRs. The shared dirty candidate does not itself establish that split or authorize merging them together.

## September 13 operator failures and verified corrections

Aaron (`1548734762519240726`) accepted green connection confirmation and Cancel during selection. Chat, Add Agent picker layout and live renderer continuity failed on the 45323 lane; refresh restoring three agents did not constitute a pass.

Corrections:

- Grouped chat's route whitelist rejected the browser's supported `intent` field with HTTP 400. It now accepts the field and retains service-level validation; explicit discussion/work dispatch regressions passed.
- The avatar editor inherited the narrow 32rem Escape dialog. Its candidate stage now uses a wide desktop dialog and stacked portrait panels, with scroll containment.
- Newly accepted avatar drafts were keyed by session ID instead of roster ID. The immediate update now uses authoritative roster IDs and preserves existing accepted drafts.
- Loading a new imported actor could suspend the entire scene. A per-agent Suspense boundary keeps the established canvas visible while the new model loads.
- Capability probes created detached WebGL contexts without releasing them. The longer browser reproduction logged “Too many active WebGL contexts” and World context loss. Browser-owned probes now release their contexts; the preview checks capability once per mounted instance rather than on each name/parent update.

Proof: 131 focused tests in nine files passed after adapting a direct-component-call test to a React render context. Affected lint/format, production build and web/server typechecks passed. All three expanded Add Agent journeys passed (1→2 and 2→3 in `browser-final3`, 3→4 in `browser-final4`): original canvas identity/visibility, actual ready actor count, delayed GLB loading, repeated name edits, capacity/cancel and reload. Desktop/portrait editor and no-refresh World screenshots were inspected. These layout/continuity proofs use Reduced Motion on software WebGL, not native animation/performance acceptance. A missing fixture GET-message route was supplied; a busy multi-step save outlasted the former 5-second assertion under software rendering, so the new acceptance assertion has a bounded 15-second deadline and 120-second journey budget. Earlier failed attempts remain retained.

A real loopback grouped HTTP discussion using the current production services and newly created native Codex WSL, Claude WSL and OpenClaw sessions returned HTTP 201 with three completed `CHAT_OK` replies. Exact grouped readback matched; all three probe sessions read back closed. No messages were sent through Aaron's live sessions and no provider/model/authentication settings were changed. This proves native text dispatch, not concurrent coding or Workstream/preview acceptance.

Correction evidence: `/home/user/.hermes/runs/aiw-setup-defects-20260913/`. The failed 45323 operator lane/state is preserved and still serves the earlier build; corrected native operator retest remains pending. No commit/push/merge or Hermes upstream work occurred.

### September 13 — Escape/Add Agent and entrance hitch corrected; fresh retest requested

Aaron (`1548752975164481546`) reported Escape → Add Agent → Escape stranded a visible Cancel whose clicks reached setup beneath it, plus a roughly half-second World texture-animation pause before multi-agent materialization. Both are current-candidate FAIL observations; prior green setup/selection Cancel passes remain scoped passes. Old45325 state is retained.

The Add Agent auto-setup flow made World inert without isolating its z80 dialog beneath z70 setup. Isolating the World stacking context aligns paint and pointer authority; Escape in add-to-World setup now closes that nested surface and restores Add Agent focus. The browser RED retained setup after Escape; GREEN exercises automatic setup, real Cancel hit testing/click, Close, Escape, and reopening. All four affected browser journeys passed.

Native Edge sampling/CPU profiling attributed the entrance hitch to late GPU texture upload (plus first-use material preparation), not an intentional frozen-world pause. Actor/rain textures and original/arrival shaders now prepare while the loading cover remains up; only then is the environment revealed, followed by the existing one-second delay and streaming-rain materialization. The native two-agent causal RED had291.7ms maximum waiting/materializing RAF gap and228.5ms measured visible uploads; GREEN repetitions had58.3ms then33.3ms maximum and zero measured visible uploads, with401/404 distinct sky samples. The preparation long frame was verified under the cover; the async readiness callback can precede the next phase-labelled RAF. These are fixture-driven native live-model proofs (legacy user plus two imported robot agents), not all-model benchmarks or Aaron's acceptance. Extra all-imported and one-agent fixture variants stopped at entry and did not produce usable timing evidence; earlier TS-serialized microphone instrumentation errors were corrected before the clean causal RED/GREEN. No live native agent conversations were exercised in this pass.

39 tests in five affected files, production build, web types, affected lint/format and four Add Agent browser journeys passed. Evidence is `/home/user/.hermes/runs/aiw-overlay-arrival-20260913/`; screenshot pixels inspected. Fresh operator retest authorized, no commit/push/merge.

## September 14 — saved gateway additions and Escape hint corrected locally

Aaron (`1549037331326046228`) reports improved arrival, replies from loaded agents, fixed Escape click-through and successful Add Agent navigation. Beans/OpenClaw and Mr Fluff/Hermes then failed before avatar selection despite green setup; the Escape hint overlapped the music controls.

Causal proof and correction:

- OpenClaw creation succeeded with a unique probe name but failed with the actual saved `Beans` name. The native gateway returned `INVALID_REQUEST: label already in use: Beans`. Distinct session keys do not remove native-label uniqueness. New native labels now include their new UUID; World names and existing native conversations remain unchanged.
- Hermes returned HTTP201 with `{object: "hermes.session", session: {...}}`. The create path read only the top-level ID and wrongly rejected it; GET/attach already handled the envelope. Creation now accepts wrapped/flat supported shapes while retaining exact requested-ID equality. New native titles are UUID-suffixed to avoid Hermes's own global title collision. Existing explicitly selected conversations are not renamed or recreated.
- `Escape for Menu` is now top-left with the existing safe-area handling. Desktop/portrait geometry proof and production screenshots show separation from audio controls; music placement is unchanged.

Verification: native source-backed create/attach HTTP201 for both actual saved connections/names, exact World closed-status readbacks, persisted Hermes ended binding and empty OpenClaw binding store. No chat/model/tool dispatch. The three empty Hermes rows created by the diagnostic probes (including pre-fix failures) were individually identified, verified empty, deleted and re-read as404; operator-created rows were not touched. 85 focused tests across six files, relevant web/server typechecks, changed-file lint/format, isolated server compile and normal frontend production build passed. Two production-browser journeys passed (Escape automatic setup return and single-to-two Add Agent/cancellation/refresh); these are fixture-based UI/continuity proof, not live Beans/Hermes browser or human acceptance. The production hint and resulting World pixels were inspected. Existing large renderer-chunk advisory remains; no budget raised.

Evidence: `/home/user/.hermes/runs/aiw-add-gateway-20260914/`, including `tests.json`, `browser/results.json`, `layout/`, successful native `probe-bc77d95f-e923-4e2e-991f-5f580788fcf9/results.json`, and `probe-cleanup.json`. The first probe's redundant OpenClaw cleanup reported already-ended ownership; its initial end succeeded. Subsequent probe uses single-owner cleanup.

Changes remain uncommitted/unpushed. Operator45329 remains HTTP200 on its old build; no rebuild into shared `dist`, restart/reset, navigation or active-session dispatch. QA45331/43931 stopped after browser proof. A corrected operator retest has not been launched; manual addition, refresh and active-work/targeting acceptance remain pending. Hermes upstream session-lock work remains deferred until World lands.

## Remaining acceptance / next checkpoint

1. Prepare a separate matching candidate for Aaron's manual check when authorized, rather than replacing his current lane.
2. Check the saved Windows and WSL connections through the normal UI, successful green state, Recheck recovery, audible pending connection loop and Cancel.
3. Check Add Agent alongside existing active work/chat/previews: confirm existing work is unaffected and targeted/broadcast recipients include the newly accepted agent. Automated mounted-room and roster proof does not establish native concurrent active-work acceptance.
4. Run fresh-clone/start/native connection on the actual Omarchy PC later. Native Linux fixtures/metadata support are not hardware acceptance.
5. Perform the separately authorized commit/push/exact-SHA CI/manual/merge gates. No broad unrelated browser matrix was rerun during this bounded correction pass.
6. Only after the World work is landed, check upstream Hermes releases/commits for the clarification-timeout/session-owner race. Aaron explicitly deferred that investigation.

Private raw evidence and gate logs: `/home/user/.hermes/runs/aiw-setup-followup/`. Scope: `.hermes/plans/2026-09-13_102052-agent-setup-discovery-and-session-additions.md`.
