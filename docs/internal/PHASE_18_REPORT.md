# Revised Phase 18 Worker Report

**VERDICT: EXACT_SHA_CI_GREEN_USER_RETEST_CORRECTIONS_REQUIRED**

Status: first-hand native fixture-assisted retest completed / corrections required before acceptance

Date: 2026-07-25

Baseline: `47f1a20ae157a0fcb480f76f1deee5ec990b3c34` on `main`, equal to `origin/main` at dispatch

## Scope and outcome

The bounded revised Phase 18 Single-Agent Hermes magic slice is implemented under `docs/PHASE_18_SCOPE.md`:

> restored user avatar → personalized existing animated logo/name → typed `AgentIntersect_` → `Single Agent` → `hermes_` → terminal `agent name?` → exact safe-label Mr Fluff resolution/miss/retry → truthful connection → explicit Mr Fluff avatar edit and accept → derived `Enter World` → one third-person blank room with both avatars → bottom-center exact-session chat plus unavailable adjacent push-to-talk → one bounded repository request → same floor/canvas transforms in place.

Normal `/` no longer renders or links dashboard/control-plane chrome. `DashboardShell` is lazy and reachable only when both `/internal/dashboard` and `VITE_AIW_LOCAL_DEVELOPER_UI=1` resolve true; the default production build fails direct internal access closed. The World room renderer is separately lazy, and the production entry chunk remains below the existing 400 KiB startup cap.

This report claims independent parent verification only through the superseding final section. It does not claim user acceptance, sealing, commit, push, CI, release, provider activation, or live-Hermes proof.

## Authorities and files inspected

Required authorities read in full or at the required bounded section:

- `AGENTS.md`
- `docs/WORLD_ENTRY_EXPERIENCE.md`
- `.hermes/plans/2026-07-25_000842-world-entry-single-agent-magic-slice.md`
- revised Phase 18 in `AgentIntersect_WorldDD.md`
- root/web/renderer manifests and TypeScript/Vitest/Playwright/Vite configuration

Reusable implementations inspected:

- `apps/web/src/App.tsx`
- avatar identify/builder/system contracts
- session client, session fixture, `AgentSessionPanel` attach/recovery behavior, and local-server Hermes safe native-session projection
- repository-index and current-World clients plus snapshot/render-object mapping
- accepted navigation key/movement boundary
- repository renderer preparation/camera and lazy-renderer patterns
- Phase 5/6/11/12/13/15 and repository/renderer unit/browser fixtures

The original AgentIntersect checkout was not read or modified.

## Changed and added paths

Product:

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/world-entry/app-surface.ts`
- `apps/web/src/world-entry/world-entry-machine.ts`
- `apps/web/src/world-entry/world-entry-client.ts`
- `apps/web/src/world-entry/WorldEntryExperience.tsx`
- `apps/web/src/world-entry/WorldEntryLogo.tsx`
- `apps/web/src/world-entry/WorldEntryAgentAvatar.tsx`
- `apps/web/src/world-entry/WorldRoom.tsx`
- `apps/web/src/world-entry/WorldHud.tsx`
- `packages/renderer-r3f/src/world-room-canvas.tsx`
- `packages/renderer-r3f/package.json` (one `./world-room` export; no dependency change)

Tests:

- `apps/web/test/world-entry-machine.test.ts`
- `apps/web/test/world-entry-client.test.ts`
- `apps/web/test/world-entry-ui.test.tsx`
- `apps/web/test/startup-chunk-boundaries.test.ts`
- `packages/renderer-r3f/test/world-room-canvas.test.tsx`
- `apps/web/e2e/world-entry-single-agent.spec.ts`

Scope/status/report:

- `docs/PHASE_18_SCOPE.md`
- `PHASE_18_REPORT.md`
- `PROJECT_STATUS.md`
- revised Phase 18 status/results in `AgentIntersect_WorldDD.md`
- Phase 18 implementation status in `AGENTS.md`

Retained evidence:

- `artifacts/phase18/returning-identity-desktop.png`
- `artifacts/phase18/mr-fluff-avatar-desktop.png`
- `artifacts/phase18/blank-room-desktop.png`
- `artifacts/phase18/repository-floor-desktop.png`
- `artifacts/phase18/returning-identity-mobile.png`
- `artifacts/phase18/repository-floor-mobile.png`
- `artifacts/phase18/no-webgl-semantic.png`
- `artifacts/phase18/world-entry-trace.zip`
- `artifacts/phase18/accessibility-summary.json`

No dependency or lockfile changed.

## RED → GREEN evidence

Representative exact RED evidence is also recorded in `docs/PHASE_18_SCOPE.md`.

| Slice                 | RED observed                                                                                                     | Final GREEN                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Pure machine          | Exit 1; 1/1 failed: missing state-machine assertion; expanded API then 1 failed/4 passed on missing constructor  | 1 file / 5 tests                                                            |
| World client          | Exit 1; 1/1 failed: missing client assertion; expanded API then 1 failed/4 passed on missing safe resolver       | Included in focused 3-file client/session run: 3 files / 12 tests           |
| Shared room           | Exit 1; 1/1 failed: missing renderer assertion; expanded API then 1 failed/1 passed on missing scene preparation | Included in renderer run: 2 files / 10 tests                                |
| Normal UI/routing     | Exit 1; 2 files selected, 3 failed/8 passed for missing logo, route resolver, and component files                | World-entry UI: 1 file / 7 tests                                            |
| Browser accessibility | Exit 1; 4 Playwright tests selected, 1 failed/3 passed on serious `scrollable-region-focusable` axe violation    | Focused browser: 4/4                                                        |
| Startup boundary      | Exit 1; 2 files selected, 1 failed/1 passed when the new routing graph changed and the renderer was eager        | 2 files / 2 tests; lazy dashboard and `world-room-canvas`, entry 352.34 KiB |

The browser test also exposed fixture/assertion defects during development (ambiguous scene locator, invalid repository fixture fields, and an assertion that required the intentionally hidden semantic mirror to be visually displayed). These were corrected as test defects and are not represented as product RED evidence. A late movement change initially produced a package typecheck failure because this repository's Three.js declaration requires `new Vector3().set(...)`; the exact constructor use was corrected and the final package/workspace typecheck is green.

## Final commands and real results

All commands used Node `v24.18.0`, Corepack, and pnpm `11.15.0`.

| Command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Exit/result                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-machine.test.ts apps/web/test/world-entry-ui.test.tsx apps/web/test/world-entry-client.test.ts apps/web/test/phase11-avatar-ui.test.tsx apps/web/test/phase12-session-client.test.ts apps/web/test/phase12-agent-session-ui.test.tsx apps/web/test/phase13-manual-camera.test.ts apps/web/test/phase13-world-action-ui.test.tsx apps/web/test/phase15-browser-voice.test.ts apps/web/test/phase15-voice-ui.test.tsx apps/web/test/repository-browser-model.test.ts apps/web/test/repository-index-client.test.ts apps/web/test/world-client.test.ts packages/avatar-system/test/avatar-system.test.ts packages/renderer-r3f/test/world-room-canvas.test.tsx packages/renderer-r3f/test/renderer-r3f.test.ts --maxWorkers=1 --no-file-parallelism` | Exit 0; 16 files / 101 tests                                                      |
| `corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-ui.test.tsx apps/web/test/phase5-stories.test.tsx apps/web/test/phase6-integration-panel.test.tsx --maxWorkers=1 --no-file-parallelism`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Exit 0; 3 files / 13 tests                                                        |
| `corepack pnpm@11.15.0 exec vitest run apps/web/test/startup-chunk-boundaries.test.ts apps/web/test/phase13-renderer-boundary.test.ts --maxWorkers=1 --no-file-parallelism`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Exit 0; 2 files / 2 tests                                                         |
| `corepack pnpm@11.15.0 test`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Exit 0; 114 files / 599 tests                                                     |
| `corepack pnpm@11.15.0 typecheck`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Exit 0; package build 18/18 and workspace typecheck 38/38 tasks                   |
| `corepack pnpm@11.15.0 check:architecture`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Exit 0; architecture script PASS and 1 file / 11 tests                            |
| `corepack pnpm@11.15.0 lint`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Exit 0                                                                            |
| `corepack pnpm@11.15.0 build`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Exit 0; 20/20 package tasks; production entry 352.34 KiB; World renderer separate |
| `xvfb-run -a corepack pnpm@11.15.0 exec playwright test apps/web/e2e/world-entry-single-agent.spec.ts --workers=1`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Exit 0; 4/4                                                                       |
| `corepack pnpm@11.15.0 smoke`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Exit 0; build 20/20 and smoke PASS on disposable ports `46137`/`46231`            |

Closeout checks:

- Prettier write/check on every Phase 18 changed text file: exit 0.
- `git diff --check`: exit 0.
- Byte comparison for `agentintersect_animated.svg`: working-tree and baseline SHA-256 both `780645cf6b8796d810da4a586154a478ba77898db2b6a7ae0625bd41e0133e52`.
- Evidence archive integrity: `unzip -t artifacts/phase18/world-entry-trace.zip` reported no errors.
- Full evidence privacy scan: no private workspace path, native/session identifier, raw chat transcript, credential marker, or browser profile.
- jCodeMunch registered/reindexed 24 text paths and registered 8 generated binary paths. Watch status reports `index_stale=false`, `reindex_in_progress=false`, and the repository covered by the existing watcher.

The optional aggregate `corepack pnpm@11.15.0 check` was not run. Its substantive non-browser parts were run directly and green (`format`, lint, typecheck, architecture, all Vitest, build, smoke). The aggregate full Playwright lane still contains historical dashboard-first journeys that now require an explicit internal-flag build and internal route; migrating that entire historical browser suite was outside the frozen normal-entry slice. The required focused production-boundary Phase 18 browser file passed 4/4 after a default build.

## Browser artifacts and visible proof

- Returning identity captures show the byte-unchanged animated logo, user name centered on the X, typed title/cursor, active-blue Single Agent, and unavailable-grey Multi Agent.
- The explicit agent-avatar capture shows editable name/species/markings/palette, live preview, and deliberate accept/save control with no `Enter World`.
- Blank and repository desktop captures share the same World/HUD identity; the blank capture visibly shows both avatars after the keyboard-driven user/camera move, and the repository capture shows both avatar meshes and repository geometry after the in-place floor switch.
- The mobile forced-colors captures show containment, semantic repository truth, both avatar labels, no horizontal overflow, and reachable chat/PTT controls.
- The no-WebGL capture shows the same scene state, user/Mr Fluff avatar truth, repository object, movement semantics, chat, and unavailable PTT without a canvas dependency.
- The privacy-sanitized `world-entry-trace.zip` records the returning personalized identity and enabled single-agent production boundary. The full blank-to-repository transition is retained in the paired captures and asserted by the 4/4 browser suite.
- `accessibility-summary.json` records zero serious/critical axe violations and the tested keyboard/reduced-motion/captions/overflow lanes.

The retained artifacts contain bounded synthetic fixture copy only. They contain no secret, raw private chat, opaque native session ID, absolute private path, technical connector error, or browser profile.

## Cleanup and prohibited-action confirmation

- Playwright/local-server/preview processes exited with the commands.
- Smoke-owned listeners on disposable ports `46137` and `46231` were closed by the successful smoke command.
- No persistent service was started.
- No disposable repository/worktree was retained by Phase 18.
- Test results outside the frozen `artifacts/phase18/` evidence are not claimed as evidence.
- No provider was exercised, promoted, or activated.
- No Hermes/OpenClaw profile, persona, provider, or configuration was changed.
- No Phase 13 retry occurred.
- No Phase 19/20 action occurred.
- No commit, push, merge, tag, release, publication, deployment, visibility change, public ingress, or original-AgentIntersect operation occurred.

## Remaining concrete risks and parent gates

1. Independent parent verification must reproduce the real diff, focused commands, default production browser journey, artifact contents, cleanup, and current/previous/unavailable truth before any acceptance claim.
2. The focused browser proof uses bounded World-owned API fixtures. Parent/user proof must verify that the existing local Hermes native-session safe title resolves exactly one real `Mr Fluff` identity and that the approved local repository root resolves through the existing server configuration without exposing technical detail.
3. The positive internal-dashboard branch is unit/type/build proven but the retained default-build browser proof intentionally covers fail-closed access. Parent may separately build with `VITE_AIW_LOCAL_DEVELOPER_UI=1` and verify `/internal/dashboard` locally; this must not be treated as remote authorization.
4. The broad historical dashboard-first Playwright suite was not migrated or run under an internal-flag build in this bounded worker pass. Full Vitest, focused affected suites, startup boundaries, production build, smoke, and focused Phase 18 Playwright are green.
5. Push-to-talk is intentionally unavailable/grey because the staged provider remains unactivated. Custom Mr Fluff voice remains deferred.

## Verdict

`READY_FOR_PARENT_VERIFICATION`

The worker-local implementation and required focused/full-unit/type/architecture/build/smoke/browser proof are green. Acceptance, sealing, commit/push, CI, live-Hermes proof, and first-hand user acceptance remain open.

## Visual embodiment correction — 2026-07-25

This section supersedes the initial worker verdict above. Independent parent inspection rejected the placeholder avatar editor, box-mesh avatars, one-object repository capture, and missing flagged-dashboard browser proof. The correction stayed inside the explicitly allowed Phase 18 paths and did not change dependencies, lockfiles, external configuration, or Git history.

### Correction paths

Production and renderer:

- `apps/web/src/avatar/AvatarBuilder.tsx`
- `apps/web/src/world-entry/world-entry-avatar.ts`
- `apps/web/src/world-entry/WorldEntryAgentAvatar.tsx`
- `apps/web/src/world-entry/WorldEntryExperience.tsx`
- `apps/web/src/world-entry/WorldRoom.tsx`
- `apps/web/src/styles.css`
- `packages/renderer-r3f/src/avatar-kit-canvas.tsx`
- `packages/renderer-r3f/src/world-room-canvas.tsx`

Tests and browser proof:

- `apps/web/test/world-entry-ui.test.tsx`
- `packages/renderer-r3f/test/world-room-canvas.test.tsx`
- `apps/web/e2e/world-entry-single-agent.spec.ts`
- `apps/web/e2e/world-entry-internal-dashboard.spec.ts`

Scope, report, and regenerated retained evidence:

- `docs/PHASE_18_SCOPE.md`
- `PHASE_18_REPORT.md`
- `artifacts/phase18/accessibility-summary.json`
- `artifacts/phase18/blank-room-desktop.png`
- `artifacts/phase18/mr-fluff-avatar-desktop.png`
- `artifacts/phase18/no-webgl-semantic.png`
- `artifacts/phase18/repository-floor-desktop.png`
- `artifacts/phase18/repository-floor-mobile.png`
- `artifacts/phase18/returning-identity-desktop.png`
- `artifacts/phase18/returning-identity-mobile.png`
- `artifacts/phase18/world-entry-trace.zip`

### Correction RED → GREEN evidence

The exact pre-production-edit RED results are frozen in section 13 of `docs/PHASE_18_SCOPE.md`.

| Slice                                                                                                           | RED                                                                                                                                                                                                                                                                      | Correction GREEN                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accepted avatar builder, strict proposal mapping, actual canvas avatars, and representative repository snapshot | Focused Vitest exit 1; 2 files / 11 tests, 6 failed and 5 passed. Missing behavior included `AvatarBuilder` composition, `avatarDraftFromProposal`, `avatarProposalFromDraft`, `AvatarKitWorldModel`, actual renderer selections, and at least eight repository objects. | Focused correction run exit 0; 4 files / 30 tests. Final impacted run exit 0; 16 files / 103 tests.                                                             |
| Flagged internal route                                                                                          | Default-build Playwright exit 1; 1/1 failed because the internal dashboard correctly remained unavailable without the flag.                                                                                                                                              | Flagged Vite build exit 0, followed by flagged Playwright exit 0; 1/1. The subsequent default build and normal Phase 18 run retained fail-closed direct access. |
| Production boundary and evidence                                                                                | Parent visual inspection rejected the retained ASCII/box/one-object captures.                                                                                                                                                                                            | Default-build Playwright exit 0; 4/4, regenerating the retained real-GLB, one-canvas, multi-object desktop/mobile/no-WebGL evidence.                            |

The strict UI-boundary adapter preserves already-valid avatar selections and maps representative legacy/free-form proposal values to strict Phase 17 draft values before `AvatarBuilder` validation. Acceptance maps the validated draft back into the exact attached-session proposal payload and still requires deliberate `Accept and save avatar`; no silent consent path was added.

The renderer now exports a narrow `AvatarKitWorldModel` that reuses the existing GLB configuration and animation code without creating a `Canvas`. `WorldRoomCanvas` mounts both the saved user profile and exact-session accepted Mr Fluff draft inside its existing single canvas. Keyboard movement changes the real user model position and third-person camera target. Stable canvas/semantic attributes prove the selections reached the renderer but do not substitute for the visibly rendered models.

The bounded browser repository snapshot now contains 2 packages, 2 directories, and 5 files. Production still uses the existing bounded snapshot preparation and instanced renderer, transforms the same floor in place, and preserves both avatars, the camera, scene identity, chat, and unavailable push-to-talk.

### Correction commands and actual results

All commands used Node `v24.18.0`, Corepack, and pnpm `11.15.0`.

| Command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Exit/result                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-ui.test.tsx packages/renderer-r3f/test/world-room-canvas.test.tsx --maxWorkers=1 --no-file-parallelism` (RED)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Exit 1; 2 files / 11 tests, 6 failed and 5 passed                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `xvfb-run -a corepack pnpm@11.15.0 exec playwright test apps/web/e2e/world-entry-internal-dashboard.spec.ts --workers=1` against the default build (RED)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Exit 1; 1/1 failed on the intentionally absent internal dashboard                                                                                                                                                                                                                                                                                                                                                                                                      |
| `corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-ui.test.tsx packages/renderer-r3f/test/world-room-canvas.test.tsx apps/web/test/phase11-avatar-ui.test.tsx packages/avatar-system/test/avatar-system.test.ts --maxWorkers=1 --no-file-parallelism`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Exit 0; 4 files / 30 tests                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-machine.test.ts apps/web/test/world-entry-ui.test.tsx apps/web/test/world-entry-client.test.ts apps/web/test/phase11-avatar-ui.test.tsx apps/web/test/phase12-session-client.test.ts apps/web/test/phase12-agent-session-ui.test.tsx apps/web/test/phase13-manual-camera.test.ts apps/web/test/phase13-world-action-ui.test.tsx apps/web/test/phase15-browser-voice.test.ts apps/web/test/phase15-voice-ui.test.tsx apps/web/test/repository-browser-model.test.ts apps/web/test/repository-index-client.test.ts apps/web/test/world-client.test.ts packages/avatar-system/test/avatar-system.test.ts packages/renderer-r3f/test/world-room-canvas.test.tsx packages/renderer-r3f/test/renderer-r3f.test.ts --maxWorkers=1 --no-file-parallelism` | Exit 0; 16 files / 103 tests                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `corepack pnpm@11.15.0 exec vitest run apps/web/test/startup-chunk-boundaries.test.ts apps/web/test/phase13-renderer-boundary.test.ts --maxWorkers=1 --no-file-parallelism`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Exit 0; 2 files / 2 tests                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `corepack pnpm@11.15.0 typecheck`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Exit 0; package build 18/18 and workspace typecheck 38/38 tasks                                                                                                                                                                                                                                                                                                                                                                                                        |
| `corepack pnpm@11.15.0 build`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Exit 0; 20/20 tasks; production entry 352.95 KiB and World renderer in a separate chunk                                                                                                                                                                                                                                                                                                                                                                                |
| `xvfb-run -a corepack pnpm@11.15.0 exec playwright test apps/web/e2e/world-entry-single-agent.spec.ts --workers=1` after the default build                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Exit 0; 4/4                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `VITE_AIW_LOCAL_DEVELOPER_UI=1 corepack pnpm@11.15.0 exec vite build apps/web --config apps/web/vite.config.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Exit 0; explicit flagged production build                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `VITE_AIW_LOCAL_DEVELOPER_UI=1 xvfb-run -a corepack pnpm@11.15.0 exec playwright test apps/web/e2e/world-entry-internal-dashboard.spec.ts --workers=1`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Exit 0; 1/1                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `corepack pnpm@11.15.0 check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Exit 1. Before the final browser lane: format PASS, lint PASS, typecheck 38/38, architecture 1 file / 11 tests, full Vitest 114 files / 601 tests, build 20/20, and smoke PASS. The default-root historical Playwright lane then finished 5 passed, 43 failed, 1 skipped in 22.0 minutes. All 43 failures seek legacy dashboard controls on normal `/`, which Phase 18 intentionally hides; the revised Phase 18 production-boundary tests were among the five passes. |

The aggregate command is decisive and red. Migrating 43 historical Phase 5–17 dashboard-first browser tests to a separately flagged `/internal/dashboard` build is outside this correction’s allowed paths and would weaken neither the required normal-route fail-closed behavior nor the one-report truthfulness rule. No waiver was authorized.

### Corrected retained visual proof

- `mr-fluff-avatar-desktop.png` visibly shows the accepted six-step `AvatarBuilder`, real GLB preview, strict cat/shorthair/paws/short/cat-straight/socks/fur-charcoal selections, Hermes-yellow shirt, and explicit accept/save control.
- `blank-room-desktop.png` visibly shows Mela’s saved human/Codex avatar and Mr Fluff’s accepted cat/Hermes avatar in the same primary World canvas.
- `repository-floor-desktop.png` visibly preserves both avatars and the scene while adding varied instanced package/directory/file geometry and a `2 packages · 2 directories · 5 files` status.
- `repository-floor-mobile.png` and `no-webgl-semantic.png` preserve current repository counts, both avatar selections, chat/PTT truth, and reachable semantic content under forced colors/mobile/no-WebGL conditions.
- `returning-identity-desktop.png` and `returning-identity-mobile.png` retain the personalized normal-entry constellation.
- `accessibility-summary.json` records zero serious or critical axe violations.
- `world-entry-trace.zip` has valid archive integrity. Its only regenerated absolute workspace path was replaced with `<workspace>`; scans found no private workspace path, native session identifier, raw chat transcript, authorization token, or secret marker.

### Correction cleanup and final verdict

- Test-owned Vite/local-server/Playwright processes exited; no persistent service or provider listener was started.
- No provider was activated or exercised, and no Hermes/OpenClaw profile or external configuration was changed.
- No package dependency, lockfile, Phase 19/20 path, external repository, original AgentIntersect checkout, commit, push, merge, tag, release, publication, deployment, or visibility setting was changed.
- Parent verification and visual/user acceptance remain authoritative. Phase 18 is not accepted or sealed.

`BLOCKED`

The requested visual embodiment correction and its focused/default/flagged production proof are green, but the required pinned aggregate `check` is red because 43 historical browser tests still require dashboard controls at normal `/`. Under the explicit one-report contract, that decisive red command prevents `READY_FOR_PARENT_VERIFICATION`.

## Historical Playwright internal-surface migration — 2026-07-25

Parent visual inspection accepted the visual embodiment correction. The follow-up migration mechanically moved every historical Phase 5–17 dashboard fixture/navigation URL to exact `/internal/dashboard`, retained Phase 18 normal-root `/` journeys, split a one-test default-build fail-closed lane, and changed `test:e2e` to run a flagged full build/suite followed by an unflagged narrow build/lane.

Changed migration paths:

- `package.json`
- `playwright.config.ts`
- `playwright.unflagged.config.ts`
- `apps/web/e2e/helpers.ts`
- `apps/web/e2e/phase5-flow.spec.ts`
- `apps/web/e2e/phase6-integration.spec.ts`
- `apps/web/e2e/phase7-command-journey.spec.ts`
- `apps/web/e2e/phase8-evidence-journey.spec.ts`
- `apps/web/e2e/phase9-presentation-journey.spec.ts`
- `apps/web/e2e/phase10-code-graph-journey.spec.ts`
- `apps/web/e2e/phase11-avatar-journey.spec.ts`
- `apps/web/e2e/phase11-avatar-visual-correction.spec.ts`
- `apps/web/e2e/phase12-session-journey.spec.ts`
- `apps/web/e2e/phase13-world-action-journey.spec.ts`
- `apps/web/e2e/phase14-tool-journey.spec.ts`
- `apps/web/e2e/phase15-voice-journey.spec.ts`
- `apps/web/e2e/phase16-coordination-journey.spec.ts`
- `apps/web/e2e/phase17-diagnostics-recovery.spec.ts`
- `apps/web/e2e/world-entry-single-agent.spec.ts`
- `apps/web/e2e/world-entry-internal-dashboard.spec.ts`
- `apps/web/e2e/world-entry-internal-fail-closed.spec.ts`
- `docs/PHASE_18_SCOPE.md`
- `PHASE_18_REPORT.md`

No production source, assertion, retry, timeout, dependency, or lockfile was changed by this migration.

Actual proof:

| Command                                                          | Result                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Flagged main config `--list`                                     | Exit 0; 49 tests / 19 files, including the headed pointer-lock project and positive internal test |
| Unflagged config `--list`                                        | Exit 0; 1 test / 1 file                                                                           |
| Workspace build plus explicit flagged Vite build                 | Exit 0; 20/20 workspace tasks and flagged web bundle                                              |
| Focused flagged `foundation`, `operator-flow`, and `phase5-flow` | Exit 1; 9 selected, 8 passed and 1 failed                                                         |
| First isolated unflagged lane                                    | Exit 1; 1/1 failed because the extracted spec omitted the saved-avatar setup prerequisite         |
| Corrected `corepack pnpm@11.15.0 test:e2e:unflagged`             | Exit 0; default workspace/web builds and 1/1 fail-closed browser proof                            |

The remaining focused failure is an actual cross-route stylesheet contradiction. In reduced motion, Phase 18’s unscoped `.terminal-cursor` rule with `!important` overrides the historical dashboard’s later global reduced-motion rule. The unchanged Phase 5 test therefore observes `animationDuration === 1.4` rather than `<= 0.001` after correctly reaching `/internal/dashboard`. The minimum resolution is:

```css
.world-experience .terminal-cursor {
  animation: world-cursor-blink 1.4s steps(1, end) infinite !important;
}
```

That preserves the frozen blinking normal-World cursor while restoring the accepted no-animation internal-dashboard reduced-motion behavior. However, the migration brief prohibits production-code changes and explicitly requires stopping/reporting when a route contradiction is discovered. The worker did not apply the CSS change, inject a test-only style, weaken the assertion, skip/quarantine a test, increase retries, or run the known-red full gate out of order.

The complete flagged suite, combined two-lane `test:e2e`, and pinned aggregate `check` remain unrun in this migration pass. The required next bounded authorization is the one-selector production CSS scoping correction, followed by the focused Phase 5 rerun, full two-lane `test:e2e`, and full `check`.

`BLOCKED`

Phase 18 remains unsealed and awaits parent direction on the exact one-line CSS scope exception.

## Independent parent completion proof — 2026-07-25

This section supersedes the migration worker's `BLOCKED` verdict above. The user's existing authorization to complete revised Phase 18 covered the minimum observed cross-route correction. Mr Fluff independently scoped only the reduced-motion World cursor rule to `.world-experience .terminal-cursor`, preserving the normal blinking cursor while restoring the accepted internal dashboard's no-animation behavior.

Parent verification then found one stale acceptance-command unit test that still hard-coded the old monolithic E2E script. The test was strengthened to require the new pinned sequence: Chromium install → flagged build/full suite → unflagged build/fail-closed suite, with build-before-Playwright and exact flag/config assertions. No production behavior or historical assertion was weakened.

### Independent real results

| Proof                                       | Result                                                                                                                                                                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migration audit                             | 36 changed navigations use exact `/internal/dashboard`; no added skip, fixme, retry, sleep, timeout, or assertion weakening                                                                                                                                                          |
| Focused migrated browser lane               | Exit 0; foundation/operator/Phase 5 **9/9**                                                                                                                                                                                                                                          |
| Strengthened acceptance-command contract    | Exit 0; **3/3**                                                                                                                                                                                                                                                                      |
| Authoritative `corepack pnpm@11.15.0 check` | Exit 0; format, lint, typecheck, architecture, **114/114 test files / 601/601 Vitest**, **20/20 package builds**, smoke PASS, **49/49 flagged Playwright**, **1/1 unflagged fail-closed Playwright**                                                                                 |
| Accessibility                               | `aiw.phase18-accessibility/1`; zero serious/critical axe violations across keyboard, reduced motion, captions, and overflow proof                                                                                                                                                    |
| Final visual inspection                     | PASS for personalized desktop/mobile entry, real user/Mr Fluff avatars, one-canvas multi-object floor, forced-colors/mobile containment, and no-WebGL semantic fallback                                                                                                              |
| Internal/default routing                    | Explicit flag plus exact `/internal/dashboard` passes; default direct internal access fails closed; normal `/` exposes no dashboard link or admin chrome                                                                                                                             |
| Durable evidence privacy                    | Final full rerun exposed an absolute workspace path in `trace.stacks`; the Playwright generator now rewrites all textual trace members and fails if workspace/home prefixes survive. Regenerated ZIP integrity passes with zero private-path, credential, or native-session matches. |

The final production build keeps `world-room-canvas` separately lazy. The existing 400 KiB startup-entry cap remains green. Vite reports a non-blocking warning for the separately loaded React Three Fiber chunk; it does not violate the pinned startup test.

### Live boundary and cleanup truth

- The product-facing Hermes Sessions API expected at loopback `127.0.0.1:8642` was not active. The only live loopback gateway observed at `127.0.0.1:18789` was OpenClaw and was not misrepresented as Hermes.
- No provider, Hermes/OpenClaw profile, core configuration, or external service was activated or changed. Phase 13 Discord → World continuity remains failed/deferred under its existing waiver and was not retried, exactly as frozen for revised Phase 18.
- Browser and smoke-owned processes/listeners exited. No persistent World service was left running.
- Historical Phase 13–15 artifacts regenerated by the aggregate browser suite were restored byte-for-byte from `HEAD`; only Phase 18 evidence remains changed/added.
- No commit, push, merge, tag, release, publication, deployment, public ingress, visibility change, Phase 19/20 work, original-AgentIntersect operation, dependency change, or lockfile change occurred.

### Parent verdict

`PARENT_VERIFIED_AWAITING_USER_ACCEPTANCE`

The revised Phase 18 implementation, historical browser migration, internal/default routing, durable private retained visual/accessibility evidence, and authoritative local gate are independently green. The complete pinned gate was rerun at exit `0` after the sanitizer correction. Phase 18 is not yet user accepted or sealed. Explicit first-hand user acceptance remains the only Phase 18 completion gate; commit/push and exact-SHA CI remain separately closed.

## Superseding user-acceptance correction worker report — 2026-07-25

This section supersedes every earlier `PARENT_VERIFIED_AWAITING_USER_ACCEPTANCE` verdict. First-hand testing reopened Phase 18 because normal World keyboard/mouse play was not functional and a sent `hi` had no durable visible reply. The correction is implemented and locally green; independent parent verification must be repeated against the real diff and regenerated artifacts.

### Corrected behavior

- One existing World canvas now receives continuous window-level WASD/arrow input outside editable targets, Shift sprint, camera-yaw-relative movement, floor clamping, explicit-gesture pointer lock, real mouse yaw/pitch, immediate Escape release, and truthful lock/denial/unavailable HUD state.
- The same renderer camera follows the saved user avatar. No `WorldActionPanel`, second scene, second canvas, or backend authority was added.
- A bounded lower-left focusable transcript rail retains ordered user messages, assistant delta/final output, generic/coding tool starts/completions/failures, and chat errors. It remains separate from the centered composer/PTT.
- Mr Fluff has an in-renderer overhead lifecycle billboard and equivalent semantic status for idle, thinking/typing `…`, generic tool `◇`, coding/terminal `</>`, complete `✓`, and failed `!`. Only canonical stream/send lifecycle changes it; no tool arguments are exposed.
- Clean storage proves the animated identity opening, `identify_`, visible `Create Avatar`, and the user-avatar creator. Configured returning identity remains a separate green path.
- `.world-experience`, `.world-room`, and the canvas fill 1280×900 and 1728×1080 browser viewports; mobile transcript/composer remain reachable without horizontal overflow.

### Real RED → GREEN results

| Slice                     | Real RED                                                                                                                                                                                                                                                                          | Final GREEN                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Movement/look             | Focused World-entry Vitest exit 1; 1 file, 10 tests, 1 failed/9 passed; `moveWorldPosition` was undefined                                                                                                                                                                         | Focused combined World-entry/renderer Vitest exit 0; 2 files, 16/16                                                                    |
| Following renderer camera | Focused renderer Vitest exit 1; 1 file, 3 tests, 1 failed/2 passed; `calculateWorldCameraPose` was undefined                                                                                                                                                                      | Included in 16/16                                                                                                                      |
| Durable chat/activity     | Focused World-entry Vitest exit 1; 1 file, 11 tests, 1 failed/10 passed; `createWorldChatState` was undefined                                                                                                                                                                     | Strengthened follow-up exposed the missing active assistant and transcript rail at 2 failed/9 passed; both are included in 16/16 GREEN |
| Renderer activity bubble  | Focused renderer Vitest exit 1; 1 file, 4 tests, 1 failed/3 passed; `prepareWorldActivityBubble` was undefined                                                                                                                                                                    | Included in 16/16                                                                                                                      |
| Responsive HUD            | Focused World-entry Vitest exit 1; 1 file, 12 tests, 1 failed/11 passed; no bounded transcript overflow rule                                                                                                                                                                      | Included in 16/16 plus browser containment                                                                                             |
| Clean first launch        | Focused World-entry Vitest exit 1; 1 file, 12 tests, 1 failed/11 passed; opening still rendered `Begin identification`                                                                                                                                                            | Included in 16/16 and clean-storage browser proof                                                                                      |
| Integrated browser        | Root build exit 0, then 7 selected: exit 1, 4 failed/3 passed because canvas activity truth was not reflected; next run 1 failed/6 passed on a real mobile overflow; focused diagnostic 1/1 failed identified the clipped activity `SPAN` at right 535.53125 in a 390 px viewport | Final Xvfb production run exit 0; 7/7, including the real headed pointer-lock project                                                  |

Exact focused commands used the required Node 24 PATH, Corepack pnpm 11.15.0, `TURBO_CONCURRENCY=1`, `--maxWorkers=1 --no-file-parallelism`, and Playwright `--workers=1`.

Additional final proof:

- impacted World-entry, Phase 13 camera/navigation/lifecycle, Phase 12 session stream/UI, renderer, avatar, and startup-boundary Vitest: exit 0; 14 files, 85/85 tests;
- touched-file Prettier write/check: exit 0; repository lint: exit 0;
- root typecheck: exit 0; 38/38 tasks;
- architecture: exit 0; 1 file, 11/11 tests;
- renderer/web typecheck and builds: exit 0;
- root production build: exit 0; 20/20 tasks;
- production Playwright World-entry file under Xvfb: exit 0; 7/7;
- axe summary: zero serious/critical violations;
- `git diff --check`: exit 0.

Regenerated evidence includes `first-launch-opening.png`, `first-launch-avatar-creator.png`, corrected blank/repository desktop captures with retained reply/activity/control HUD, a 1728×1080 repository capture, mobile containment, semantic no-WebGL output, headed pointer-lock repository capture, sanitized trace, and accessibility summary under `artifacts/phase18/`.

No commit/push, dependency/lockfile change, provider/profile/core/external mutation, persistent service, real provider activation, Phase 13 retry, Phase 19/20 work, public-room work, or original-AgentIntersect access occurred.

The optional aggregate `corepack pnpm@11.15.0 check` was not rerun during this bounded correction. The correction-relevant constituent gates above are green; the parent should run the pinned aggregate as part of independent verification.

`READY_FOR_PARENT_VERIFICATION`

## Fresh independent parent correction verification — 2026-07-25

This section supersedes the correction worker's `READY_FOR_PARENT_VERIFICATION` verdict above. Mr Fluff independently inspected the real source diff, canonical event flow, retained screenshots, responsive layouts, process/listener cleanup, and production browser journey rather than accepting the worker report as evidence.

### Parent-found acceptance defects and bounded correction

Visual inspection rejected three concrete evidence/UX defects that the worker's assertions had missed:

1. the forced-colors mobile capture visibly expanded the WebGL semantic mirror over the 3D scene and HUD;
2. `repository-floor-pointer-lock.png` was captured before lock and visibly claimed `Mouse look unlocked`;
3. the canonical activity label produced an oversized in-world banner rather than a compact overhead status indicator.

Before production correction, focused parent assertions produced exit `1`: 2 files, 16 tests, **2 failed / 14 passed**. The failures proved that the activity descriptor lacked a bounded visual label/scale and that the WebGL semantic mirror lacked robust legacy clipping. The correction preserves the complete canonical activity label in accessible semantic output while rendering only compact `thinking`, `tool`, `coding`, `done`, or `attention` text with the required icon; idle activity is hidden in-world. The WebGL semantic mirror now uses both legacy `clip` and modern `clip-path`, while no-WebGL semantic mode remains visible.

The first corrected production browser rerun produced **6/7 passed** and exposed a later forced-colors media rule that still expanded the semantic mirror to a computed `358px` width. Removing only that WebGL override closed the real cascade defect. The next production run passed **7/7**, and regenerated visual inspection confirmed the duplicate mobile semantic layer was gone, desktop/large-desktop layout filled the browser, the lower-left transcript and bottom composer remained reachable, the compact overhead status was visible, and the pointer-lock capture truthfully displayed `Mouse look locked` with a changed camera view.

### Final independent proof

| Proof                                             | Real result                                                                                                                                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parent focused World/renderer regression          | Exit 0; 2 files, **16/16**                                                                                                                                                                           |
| Production World-entry browser file               | Exit 0; **7/7**, including clean first launch, returning user, mobile/forced-colors, 1728×1080, no-WebGL, normal-route isolation, and headed pointer lock                                            |
| First aggregate attempt                           | Exit 1; **605/606** Vitest because the acceptance-command contract still expected only the Phase 13 headed pointer-lock spec                                                                         |
| Strengthened headed-project contract              | Exit 0; **3/3**; requires exact Phase 13 and World-entry pointer-lock specs plus their exact tag counts                                                                                              |
| Authoritative `corepack pnpm@11.15.0 check` rerun | Exit 0; formatting, lint, typecheck, architecture, **114/114 test files / 606/606 Vitest**, **20/20 builds**, smoke PASS, **52/52 flagged Playwright**, and **1/1 unflagged fail-closed Playwright** |
| Evidence and cleanup                              | Phase 18 screenshots/trace/accessibility retained; historical Phase 13–15 aggregate drift restored; no owned listeners, Vite, Playwright, Chromium, Codex, or persistent service remained            |

No dependency or lockfile changed. No provider/profile/core/external mutation, Phase 13 Discord continuity retry, Phase 19/20 work, public-room work, original-AgentIntersect access, release, publication, deployment, public ingress, tag, or visibility change occurred.

### Fresh parent verdict

`PARENT_VERIFIED_AUTHORIZED_FOR_PRIVATE_COMMIT_AND_EXACT_SHA_CI`

The corrected revised Phase 18 implementation is independently green and the user has authorized private `main` commit/push followed by exact-SHA CI. Phase 18 is **not user accepted or sealed**. After exact-SHA CI succeeds, the next required gate is a fresh full-browser first-hand journey from the true opening experience for Aaron and Mr Fluff to test together.

## Exact-SHA CI command-graph correction — 2026-07-25

Private `main` commit `2a78ae335651756f1df3c97fe799db51490d5ab4` matched the remote ref exactly, but exact-SHA GitHub Actions run `30162706333`, job `89690508831`, failed before the aggregate at `pnpm measure:phase11`.

The failure was deterministic rather than a Phase 11 performance regression. Both Phase 11 browser tests navigate to the intentionally flag-gated `/internal/dashboard` route, while the legacy root measurement script built the default unflagged web application. The application correctly failed closed: `world-hero` and the `Agents` control were absent. Checkout, dependency installation, Phase 10 measurement, and avatar verification had already passed; `pnpm check` was skipped after the Phase 11 command failed.

A focused command-graph regression was added before changing the manifest. It failed **1/3** for the expected missing flagged-build command. The minimal correction now requires an explicit `VITE_AIW_LOCAL_DEVELOPER_UI=1` web rebuild before the Phase 11 browser file and runs that browser file under the same explicit flag. No product code, test threshold, timeout, retry, dependency, lockfile, provider, profile, or external boundary changed.

Local correction proof is green:

- acceptance command graph: **3/3**;
- exact `corepack pnpm@11.15.0 measure:phase11`: **2/2** browser tests;
- measured performance: `120` frames, `frameP95Ms: 16.7`, `longestTaskMs: 0`, `12` visible avatars, and `64` semantic rows.
- authoritative `corepack pnpm@11.15.0 check`: formatting, lint, typecheck, architecture, **114/114 test files / 606/606 Vitest**, **20/20 builds**, smoke PASS, **52/52 flagged Playwright**, and **1/1 unflagged fail-closed Playwright**.

The parent-verified product verdict remains unchanged. Aggregate-generated Phase 13–15 and Phase 18 evidence churn was restored to the committed parent-verified bytes, and no owned listener remained. Delivery remains open until a follow-up private commit passes exact-SHA CI. First-hand user retesting still follows that green remote gate.

## Exact-SHA CI success — 2026-07-25

The aggregate-green command correction was committed as `b7e4a6706ec783eebfa96188b75ce2d54af11e50`, pushed to private `main`, and matched the remote ref exactly. GitHub Actions run `30163161342`, job `89691659661`, completed with `success` for that exact `headSha`.

The remote job passed checkout, pinned Node/pnpm setup, frozen-lockfile installation, pinned Chromium installation, Phase 10 measurement, avatar verification, the corrected Phase 11 measurement, and the complete `pnpm check` aggregate. The worktree and remote `main` were clean and equal after the run.

`EXACT_SHA_CI_GREEN_FIRST_HAND_RETEST_PENDING`

Phase 18 remains **not user accepted or sealed**. The next gate is the fresh native full-browser journey from the true opening experience for Aaron and Mr Fluff to test together.

## First-hand native retest outcome — 2026-07-25

Aaron completed the clean normal `/` journey from empty browser storage without `seedConfiguredAvatar`. First launch, user and Mr Fluff avatar creation, chat/composer use, persistent transcript, compact activity presentation, and approved repository-floor transformation worked. The API boundary was explicitly fixture-backed; “Hello Mela” was canned test output and not live Hermes continuity.

The retest found seven correction families: both avatar species sink into the floor; the controlled avatar does not continuously share camera heading; camera look must be hold-right-mouse and release-to-exit instead of left-click/persistent pointer lock; both mouse axes are reversed; transcript and composer bottom edges need one responsive shared anchor; all four constellation buttons need wider outward responsive placement; and agent addressing must derive from the avatar's selected user name rather than hard-coded `Mela`.

The complete acceptance criteria and four authoritative screenshots are recorded in `docs/PHASE_18_ACCEPTANCE_BACKLOG.md` and `artifacts/phase18/user-retest/`. Phase 18 remains open. Revised Phases 19–20 remain not started and unauthorized.
