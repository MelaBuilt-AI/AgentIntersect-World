# Beans Workstream correction and World anti-aliasing

> **Delivery update — September 20:** Aaron1551395372600008805 accepts this cumulative PR slice and authorizes commit/push, then merge PR20 only after exact-head CI and readiness pass. Earlier LOCAL/UNCOMMITTED, pending-verdict, no-delivery and runtime statements below describe historical stages, not current authorization. Final commit/CI/merge receipts are recorded on PR20 and in the session handoff. TEST45399 is retained; PR19, releases, signing and public visibility remain separate.

## Scope / owner verdict

Aaron1551224137672949771 accepts historical chat attribution on TEST45389. A new OpenClaw/Beans task in an empty `beans test` project failed: avatar remained at its starting position/Idle instead of moving to its work slab and Dig; Workstream was blocked with `OpenClaw session turn was cancelled`; no World View opened. User explicitly requests investigation/fix plus default-on Graphics anti-aliasing with an on/off switch.

Keep accepted avatar/menu/switch/history scopes. Preserve TEST45389, its browser, source-served artifacts and failed project/worktree/state. No resending to that session, cleanup, preview replacement, provider/config/model changes, Git delivery, CI retry, merge, release or publication. Work directly in the existing dirty menu checkout; old inherited changes are protected.

## Evidence and causes

- Read-only failed-store hashes: `~/.hermes/runs/aiw-beans-aa-20260920/failed-state-hashes.json`. Exact Workstream observed blocked, no changed files/validation/verified preview. Native turn ran from13:24:28 to13:26:29 UTC.
- Gateway already supplies server-owned systemMessage/workingDirectory/evidenceDirectory. OpenClaw adapter dropped the first two, sending only raw user text. Native exact-session evidence shows Beans selecting its default workspace rather than the allocated worktree and starting its configured external coding worker there. No global configuration was changed in this investigation.
- Installed OpenClaw `sessions.send` schema has message/timeout fields, no per-turn cwd/system field. Forward server-owned Workstream context in its message, including directory and actual report instructions; preserve exact native conversation. This is prompt-context propagation, not a claim of a hard native cwd/sandbox boundary.
- Adapter's120s default cut the coding turn off. A native `aborted` event can beat the abort response, masking timeout as cancellation. Focused REDs reproduced dropped context and wrong timeout reason.
- WorldRoom retained the original primary movement controller actorId after Change Agent; requests for the replacement actor were refused. Production browser RED reproduces active replacement Workstream with avatar still Idle. Correct only actor-owned movement/arrival/animation state, preserving position, World, camera and canvas.

## Implemented locally

- OpenClaw transmits bounded server-owned context; Workstream-bound turns default to600s, ordinary chat remains120s, explicit configured timeout still wins. Original timeout reason survives native abort-event ordering. Existing abort/quarantine rules remain.
- Primary movement state follows active actor identity without remounting World/canvas or carrying stale arrivals/handled requests.
- Graphics `Anti-aliasing` defaults on and migrates old preferences independently. Existing render owner now handles optional bloom and optional multisampled offscreen target, up to4 samples capped by device capability. Native canvas context AA is off so the user switch is meaningful; toggles replace only owned postprocess resources, not World/avatars/camera. All-off returns to the direct renderer. CSS3D alpha-preserving bloom blend stays intact.

## Latest owner verdict — AA and movement/Dig PASS; World View retry pending

Aaron1551250038838005801 confirms anti-aliasing and switched-Beans travel/Dig/completion in45391. World View failed. Read-only receipt identifies missing recipe CLI `../dist/static-site-preview.js` caused by the alternative backend build layout in the manual launcher; earlier direct-import static-server proof did not exercise that registered CLI path. Reproduced MODULE_NOT_FOUND, installed only the identical compiled helper and ESM manifest in the expected kit path, proved exact CLI HTTP200/matching native-proof bytes and cleanup. Active test/browser/worktree/native conversation unchanged, no restart or automatic retry. Owner should click existing Retry World View once. This is a launch-kit repair, not a new product-source fix or a claimed manual preview PASS.

## Current manual retest — LIVE45391, pending Aaron

Aaron1551239504592113676 authorized old-test closure and a fresh test. Old45389 browser/services are closed, all saved data retained. Fresh native Edge is open at http://127.0.0.1:45391/ with corrected compiled backend43991 and copied normal frontend; empty state/profile and untouched Agent Setup verified. Operational kit: `~/.hermes/runs/aiw-beans-review-20260920/README.md`. No user actions automated. Later launch status supersedes retained45389/pending-launch text in the chronology below.

## Final technical verdict — GREEN; owner retest pending

Final affected suite: **209/209 tests across30 files PASS** (`affected-final-corrected.log`). Renderer/web and isolated corrected backend builds, web/server typechecks, focused lint/format, and git diff --check PASS. The older209-test run with five missing-mock compile failures is superseded by the corrected fixture; it now explicitly checks originals versus arrival-clone compiler ownership and delayed clone disposal.

Final browser evidence: four-harness chat/switch/back/refresh plus replacement OpenClaw Workstream travel→Dig state→terminal Idle **PASS115.995s**, strict page errors empty (`browser-green-3/results.json`). This is real UI/movement with simulated native authority and constrained rendering—not a new native-GPU skeletal-motion claim. Anti-aliasing real WebGL multisample allocation, independent bloom/AA off, same canvas, persistence/default restore and unobstructed on/off captures **PASS24.079s** (`aa-final/results.json`; whole run26.0s). Graphics desktop/portrait defaults/layout PASS in the prior unaffected layout case; inspected eight controls fit portrait. Final unobstructed on/off World captures inspected: intact scene, no obvious corruption; constrained0.25DPR remains soft, so no native-quality/FPS claim. The earlier checkbox-covered images are not AA pixel proof; the intermediate double-Escape test failure was a harness mistake, now corrected.

The real native Beans artifact, receipt and HTTP200 proof remain PASS; final file hash/text verified and exact disposable native-session row independently confirmed absent. Proof43770/45173/45411 listeners absent. TEST45389 ownership remains live and unchanged, serving the OLD manual build. No new manual lane launched; new build acceptance and preview replacement need user direction. Corrected backend artifact is `/home/mela_ai/.hermes/runs/aiw-beans-aa-20260920/backend/index.js` with its own module manifest/dependency link; do not accidentally reuse the old checkout backend dist when preparing the retest. Frontend is the final normal `apps/web/dist`.

## Verification chronology (historical attempts)

- OpenClaw context RED→GREEN and abort-race RED→GREEN;22 adapter tests PASS.
- Primary movement production-browser RED retained (`movement-red/`); GREEN running.
- AA defaults and resource wiring RED→GREEN; actual multisample allocation, visible output change, no canvas replacement, persistence and Graphics layout browser proof running.
- Renderer build, web/server noEmit typechecks and affected lint PASS. Impacted run208/209 initially: old seven-switch count failed after adding eighth; corrected to eight. Focused rerun13 tests PASS. No backend dist rebuild beneath the retained lane; frontend/renderer output is isolated from the user's copied UI.
- Real OpenClaw adapter→native→artifact→static-server proof PASS: isolated Beans wrote index.html containing exactly the requested text, real validation exit0 and aiw.workstream-report/1 receipt; static preview HTTP200 bytes matched. Exact owned native session closed, preview listener absent; gateway config and default-workspace index unchanged. Actual result/report/file under native-proof/. This does not substitute for manual World View/visual acceptance.
- First post-fix browser run passed movement→Dig→Idle assertions but found Three compileAsync isReady errors and a short reload wait. Second run: AA allocation/off/persistence and Graphics layout PASS; movement assertions still passed but strict shader errors remained. Diagnosis: constrained impostor source material can be disposed on semantic change while async compilation polls it. Only arrival-owned clones now use asynchronous polling and defer disposal to completion; externally owned originals use synchronous precompile submission. Final affected browser rerun pending.
- Corrected backend compiled separately under the evidence root/backend and imports successfully. Retained TEST45389 backend dist and copied frontend were not rebuilt/replaced.

Evidence root: `/home/mela_ai/.hermes/runs/aiw-beans-aa-20260920/`.
Manual verdict on these new corrections/AA remains pending; no delivery authority inferred.
