# Workstream conversation and screen corrections

> **September 9 delivery update:** Aaron authorized the cumulative PR, push and conditional merge after CI/readiness are green (`1547254171474993302`). The current delivery/acceptance cutline is `PROJECT_STATUS.md`; dated no-delivery and pending-test statements below are historical records, not current authorization. Retained runtimes, public/release actions and later-phase scopes remain protected.

Aaron1547069701996281916, 2026-09-08. Scope: opaque back faces occlude chat clouds; ordinary discussion in the same Workstream-bound native agent session; explicit `/work <task>` resumes work; queue discussion while coding; fix angle-dependent code-screen bleed-through. Preserve accepted 60% white cloud, opaque text/bezel, all older manual lanes and native sessions. No commit/push/release authorized.

## 2026-09-09 operator acceptance and final bezel correction

**Fresh bezel manual test LIVE: http://127.0.0.1:45295/** (backend43895, tmux `aiw-bezel-20260909`, native Edge/CDP49295). Authorized by Aaron1547246581064015892. Serves the verified full-shell correction from `aiw-cloud-bezel-20260909/web`; entry/JS/CSS/renderer byte parity, frontend/backend/proxy health, native Codex capability, exact process ownership and one enabled/unowned native window verified. Fresh Create Avatar boundary, empty storage, no automated setup/consent/coding. Copied three-file website `aiw-bezel-manual-20260909/veggie-bezel-test`, checkpoint97a396d, existing test1/1; old Workstream/native history not imported. Retest only bezel/sides front/back/oblique and reverse depth. Prior chat/everything-else PASS retained.45293 and all older lanes untouched. README/check-runtime.py under `/home/user/.hermes/runs/aiw-bezel-manual-20260909/`. Leave running; user verdict pending, cleanup/delivery remain gated.

Aaron1547240818216145046 tested45293: chat/discussion worked exactly as intended, front AND back broad-face cloud occlusion now works, and **everything else is a PASS**. The sole remaining observed defect is cloud overlay on the narrow spatial-screen side/bezel in either orientation. Supplied image `/home/user/.hermes/cache/images/img_e5c12589d441.png` inspected. This verdict supersedes the pending45293 language in the historical launch record below, without establishing unrelated saved-session/Hermes/later-phase gates.

Bounded correction: match the full opaque screen shell, including bezel extent and physical thickness, from front/back/oblique views. Preserve accepted cloud styling, discussion/work/report behavior, screen placement and input; no backend/session/provider changes. Keep45293 and every older lane untouched. Local source/tests/build only; no commit/push, activation, reset/restart or cleanup of operator lanes.

Root cause: `activityScreenMask` projected only the content rectangle at depth0, while `ProjectedScreen` renders a larger box behind it. Shared shell padding/depth/offset constants now bind mesh and mask. The mask unions the content plane and six shell faces clipped between cloud depth and camera near plane, with the same bottom-anchored reveal transform. No bounding-box inflation, raycasts, DOM layout reads or React state additions.

Five angle regressions observed RED, then GREEN; nine focused tests and103 renderer tests pass. Renderer build, root TypeScript check, affected lint, formatting and production web build pass under Node24.18.0. Isolated headed production browser journey **1/1 PASS**, zero failures/skips/retries, runner exit0; oblique front/back bezel close-ups and farther-screen cloud pixels inspected. Evidence `/home/user/.hermes/runs/aiw-cloud-bezel-20260909/attempt1/`. Its temporary frontend45173/backend43770 listeners are gone. Build is ready but not activated over45293; manual acceptance of this final bezel correction is pending.

## Implementation — September8 pass

- Back faces are physical opaque screen surfaces, not absent just because DOM content is hidden.
- Distinct camera-depth ranks replace rounded reciprocal distance, which tied two different screen depths and let DOM order win.
- Explicit discussion/work intent follows single/grouped browser transport into the gateway. Discussion retains owned directory and native session but does not start/end Workstream lifecycle or overwrite reports. Its server-owned context asks for normal discussion/read-only inspection, not implementation. This is conversational intent, not a new sandbox security guarantee.
- Initial Workstream menu dispatch remains work. In an open bound Workstream, plain chat discusses; `/work task` or `/work continue task` iterates. Existing natural start outside an owned Workstream and inspect/cancel controls remain.
- UI holds queued discussion until authoritative work status is terminal. Gateway also waits for an active same-session turn without interrupting it; cancellation removes its waiter.

## Proof status

Technical GREEN. Back-face mask and distinct-depth tests were observed RED before fixes. Final renderer/web/local-server suite: **880 passed,0 failed/skipped**. TypeScript build, targeted lint, formatting and diff checks passed. **3/3 final production browser journeys PASS** under headed Chromium/Xvfb: normal Workstream discussion/queue/reports/explicit continuation; full code inspection/focus/fullscreen/scroll/pointer-lock; actual overlapping code and rear screen at multiple positions. Final cloud/backface, discussion and code-overlap pixels inspected. Evidence: `/home/user/.hermes/runs/aiw-conversation-screens-20260908/final-verification.json` and `final-browser/`.

Earlier attempts retained: cloud/main journey passed, but the broadened config incorrectly forced the pointer-lock journey headless; it failed identically against the prior production build. Real capture showed acquisition followed by zero-button mousemove. Correcting the launcher to headed/Xvfb passed the unchanged camera/input journey. No camera production workaround was added. Browser response fixtures prove routing/presentation only, not native agent semantics. The UI discussion intent requests read-only explanation but is not a new tool-permission sandbox.

## Fresh manual lane — live, acceptance pending

World **http://127.0.0.1:45293/**; backend43893; tmux `aiw-conversation-20260908`; dedicated native Edge/CDP49293 at untouched Create Avatar. Matching proof build served; backend/proxy health, actual Codex capability, process ancestry, enabled/unowned native window and entry pixels verified. README/runtime/checker: `/home/user/.hermes/runs/aiw-conversation-manual-20260908`. Seed `veggie-conversation-test`, initial checkpoint `cba2086`, existing website test1/1; no prior Workstream/native history imported. All older lanes retained and respond200. Leave them and this new lane running; no automatic native task or setup actions.

## Next operator gate

Use New Workstream task field for the first heading change. Normal chat during coding queues and then answers in the same agent session; subsequent chat discusses without replacing the task/report. Use `/work Change only the existing homepage heading to 'Good Food, Good Mood'. Keep everything else unchanged and rerun the existing homepage test.` for deliberate continuation. Retest front/back cloud occlusion and native video angles around code/rear panels. Await criterion-specific user result; no publication authorized.
