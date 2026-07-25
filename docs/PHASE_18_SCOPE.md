# Revised Phase 18 — Frozen Implementation Scope

Status: PARENT VERIFIED / EXACT-SHA CI GREEN / FIRST-HAND USER RETEST PENDING

Frozen: 2026-07-25

Baseline: `47f1a20ae157a0fcb480f76f1deee5ec990b3c34` on `main`, equal to `origin/main` at worker dispatch

## 1. Authorization and completion boundary

The user explicitly authorized complete revised Phase 18 on 2026-07-25 and requested one bounded Codex implementation worker followed by independent Mr Fluff parent verification. This scope authorizes implementation and local proof inside the AgentIntersect World repository root; it does not authorize acceptance, sealing, commit, push, merge, tag, release, publication, deployment, visibility change, provider activation, external profile/configuration mutation, Phase 13 retry, or Phase 19/20 work.

The pre-existing dirty documentation state is intentional and must be preserved:

- `AGENTS.md`
- `AgentIntersect_WorldDD.md`
- `PROJECT_STATUS.md`
- `.hermes/plans/2026-07-25_000842-world-entry-single-agent-magic-slice.md`
- `docs/WORLD_ENTRY_EXPERIENCE.md`

The worker may report only `READY_FOR_PARENT_VERIFICATION` after all required local proof is green. Independent parent proof and first-hand user acceptance remain parent/user-only completion gates.

## 2. Observable single-agent Hermes journey

The complete bounded production journey is:

> valid saved user avatar → personalized byte-unchanged animated logo with the user name centered on the X → typed `AgentIntersect_` → enabled `Single Agent` → enabled `hermes_` → terminal newline and typed `agent name?` → enter `Mr Fluff` → exactly one safe existing local Hermes display-label match → truthful `connecting agent` then `agent connected`, or nontechnical `agent not found_` with retry → explicit first-time Mr Fluff avatar editing and deliberate save/acceptance → exact-session readiness-gated `Enter World` → third-person arrival in one blank floor room containing the user and Mr Fluff → bottom-center exact-session chat and adjacent unavailable push-to-talk → one bounded conversational repository request → loading truth → in-place transformation of that same room/floor/canvas into the repository landscape.

The production-boundary browser proof must also exercise a zero-match retry before the successful exact Mr Fluff match and prove early World entry is unavailable.

## 3. Frozen visual, terminal, state, and authority decisions

- First launch remains full-screen `/assets/dashboard/agentintersect_animated.svg` only, then typed `identify_`, then `Create Avatar`, then focused explicit user-avatar creation.
- Returning launch restores a valid saved user avatar/name and never forces user-avatar creation again.
- The existing animated SVG remains byte-unchanged.
- All normal World text uses Consolas with a monospace fallback.
- Typewriter labels progress character by character and finish with a blinking underscore cursor. Reduced motion may complete immediately but retains final semantic text and cursor. Screen readers receive one stable final announcement, not per-character spam.
- The user name is centered on the logo X. `AgentIntersect_` is below it. `Single Agent` is below-left and `Multi Agent` below-right.
- Harness endpoints are `openclaw_` upper-left/red, `hermes_` upper-right/yellow, `claude_` lower-left/orange, and `codex_` lower-right/blue-cyan.
- Phase 18 enables only `Single Agent` and `hermes_`. Other choices remain visibly grey, semantically unavailable, and labelled with a reason. Enabled shared actions use blue. State never relies on color alone.
- Hermes selection advances like a terminal newline, types `agent name?`, advances again, and focuses one safe single-line display-name input with Enter and explicit-submit support.
- Matching trims and Unicode-case-normalizes only for comparison, considers one bounded safe display label per accepted native session, and requires exactly one match. Zero and ambiguous results both show only `agent not found_`, preserve restored user truth, and refocus retry.
- Opaque native Hermes session IDs remain inside the World-owned client/gateway boundary. Browser code does not access raw Hermes, PTY, profile paths, transports, or technical errors.
- Connection presentation distinguishes connecting, connected/current, previous/recovered, stale/unavailable, miss, and retry truth. Animation never advances authority.
- A newly connected Mr Fluff always receives an explicit editable avatar creator. A proposed avatar is only editable input; no hidden default, user-avatar substitution, or generated acceptance can unlock entry.
- `Enter World` is derived only from a current exact-session attachment plus deliberate valid avatar consent bound to that exact World session.
- Normal `/` has no dashboard/control-plane panel or link. `DashboardShell` is permitted only at `/internal/dashboard` when `VITE_AIW_LOCAL_DEVELOPER_UI=1`; the route fails closed without both conditions. The flag adds no listener or remote authority.
- One scene/canvas identity owns both blank and repository floor states. There is no portal, second room, second canvas, hidden repository picker, or `WorldActionPanel`.
- The default camera is third-person behind the user. Accepted bounded navigation math/state is reused. The user and Mr Fluff remain visible and retain identity across the floor change.
- The only persistent normal-World overlay is bottom-center chat plus adjacent push-to-talk. Chat targets the exact attached Mr Fluff session and uses canonical stream/recovery logic.
- Push-to-talk remains grey/unavailable with a concise reason while the staged provider is unavailable. No provider is exercised, promoted, or activated.
- Repository indexing failure/cancellation preserves the blank floor and offers retry. A successful current projection or explicitly disclosed recovered projection transforms the same floor in place while preserving scene, camera, user, and agent state.
- Semantic DOM/no-WebGL output is driven by the same World state. Keyboard operation, visible focus, final-label live regions, captions, reduced motion, forced colors, desktop/mobile containment, and no horizontal overflow are mandatory.

## 4. Exact in-scope paths and capabilities

Production paths allowed to change:

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/world-entry/world-entry-machine.ts`
- `apps/web/src/world-entry/world-entry-client.ts`
- `apps/web/src/world-entry/WorldEntryExperience.tsx`
- `apps/web/src/world-entry/WorldEntryLogo.tsx`
- `apps/web/src/world-entry/WorldEntryAgentAvatar.tsx`
- `apps/web/src/world-entry/WorldRoom.tsx`
- `apps/web/src/world-entry/WorldHud.tsx`
- `packages/renderer-r3f/src/world-room-canvas.tsx`
- `packages/renderer-r3f/src/index.ts`
- the smallest necessary existing World-owned session, avatar, repository, navigation, renderer, architecture-check, or test-fixture file only if a RED test proves the listed composition cannot be implemented without it

Test and closeout paths allowed to change or add:

- `apps/web/test/world-entry-machine.test.ts`
- `apps/web/test/world-entry-client.test.ts`
- `apps/web/test/world-entry-ui.test.tsx`
- `packages/renderer-r3f/test/world-room-canvas.test.tsx`
- `apps/web/e2e/world-entry-single-agent.spec.ts`
- focused existing protocol/local-server tests only if a safe display-label contract change is proven necessary
- `docs/PHASE_18_SCOPE.md`
- `PHASE_18_REPORT.md`
- `PROJECT_STATUS.md`
- the revised Phase 18 status/closeout text in `AgentIntersect_WorldDD.md`
- Phase 18 implementation-status rules in `AGENTS.md`
- the exact generated evidence paths in section 8

In-scope capabilities are only returning/first-launch identity continuity, the Single Agent Hermes/Mr Fluff connection and retry slice, exact-session avatar consent, readiness-gated entry, one blank/repository World scene, exact-session text chat, truthfully unavailable push-to-talk, one bounded repository request, internal-route isolation, and their accessibility/responsive/current-versus-recovered proof.

## 5. Exact out-of-scope paths and capabilities

- No reads or writes in the separate original AgentIntersect checkout.
- No Hermes/OpenClaw core, profile, persona, session, provider, or configuration changes.
- No dependency or lockfile changes and no package installation.
- No broad rewrite of existing session, repository, avatar, renderer, navigation, voice, dashboard, diagnostic, evidence, recovery, readiness, connector, lifecycle, coordination, command-intent, or Guided Build foundations.
- No Multi Agent flow, OpenClaw/Codex/Claude connection breadth, LAN/different-PC setup UI, custom Mr Fluff voice, provider activation/promotion/exercise, first-person camera, new graph/index semantics, Phase 13 retry, Phase 19/20 work, public rooms, unrelated users, cloud relay, external account/identity systems, public ingress, or multi-tenancy.
- No commit, push, merge, tag, release, publication, deployment, visibility change, remote creation, or Obsidian mirror change.
- No dashboard/control-plane imports or links in normal World-entry modules, no browser-side raw Hermes/PTTY access, and no second scene/canvas for repository state.

## 6. Runtime, environment, and trust model

- Repository: the current AgentIntersect World repository root
- Runtime: the active NVM-managed Node `v24.18.0` binary directory first in `PATH`
- Node: `v24.18.0`
- Package manager: Corepack with pnpm `11.15.0`
- Browser proof: production build first, then Playwright under `xvfb-run`, one worker
- Network/trust: one human/operator, their owned agents, same machine or trusted LAN; development defaults to loopback
- No public-internet ingress, external tenancy, new listener authority, or provider activation is introduced
- Commands may create bounded `/tmp` logs/caches only; owned processes/listeners and disposable fixtures must be cleaned before report

## 7. Persistence and truth rules

- Saved user identity/avatar is restored through the existing World-owned persistence contract. Corrupt or absent user state returns to the explicit first-launch creator; it never invents a replacement.
- Native Hermes resolution requires exactly one safe display-label match. The opaque native ID remains internal and becomes bound through existing World session attach APIs.
- Current, previous/recovered, stale, unavailable, miss, and retry states are distinct in both state and accessible copy. Previous/recovered state is disclosed and never relabelled current.
- Retry preserves restored user identity and any truthful accepted state; a miss or unavailable connection does not fabricate attachment.
- Mr Fluff avatar acceptance persists/validates against the exact current World session. Missing, declined, revoked, invalid, mismatched, stale, or failed consent keeps entry locked.
- Repository indexing/projection uses existing World-owned clients. Loading does not replace scene identity. Failed or cancelled work leaves the blank floor intact. Only a successful current or disclosed recovered projection activates the repository floor.
- Browser reload may restore only state that the underlying session/avatar/repository authority reports. Visual timing and local optimistic flags never establish readiness.
- Internal dashboard controls exist only for the exact flagged internal route and are absent/unlinked from the normal surface.

## 8. Frozen generated evidence paths

The browser test may create only these retained Phase 18 evidence files:

- `artifacts/phase18/first-launch-opening.png`
- `artifacts/phase18/first-launch-avatar-creator.png`
- `artifacts/phase18/returning-identity-desktop.png`
- `artifacts/phase18/mr-fluff-avatar-desktop.png`
- `artifacts/phase18/blank-room-desktop.png`
- `artifacts/phase18/repository-floor-desktop.png`
- `artifacts/phase18/repository-floor-large-desktop.png`
- `artifacts/phase18/repository-floor-pointer-lock.png`
- `artifacts/phase18/returning-identity-mobile.png`
- `artifacts/phase18/repository-floor-mobile.png`
- `artifacts/phase18/no-webgl-semantic.png`
- `artifacts/phase18/world-entry-trace.zip`
- `artifacts/phase18/accessibility-summary.json`

Evidence must contain no secrets, raw chat transcripts, absolute private paths, browser profiles, opaque native Hermes IDs, or technical connector errors. Temporary Playwright output and bounded `/tmp` logs may be deleted after results are recorded.

## 15. Superseding user-acceptance correction — 2026-07-25

First-hand user testing reopened the previously parent-verified worktree after observing that ordinary World movement/mouse play did not work and a sent `hi` produced no durable visible reply. This section supersedes earlier parent-verified/awaiting-user-acceptance status. The correction is implemented but is not parent verified, user accepted, sealed, committed, pushed, released, published, deployed, or CI-verified.

The bounded correction adds:

- window-owned continuous WASD/arrow movement with editable-target exclusion, Shift sprint, floor bounds, camera-yaw-relative vectors, visible instructions, and pointer-lock lifecycle truth;
- explicit-gesture pointer lock, real mouse yaw/pitch, immediate Escape release, truthful denial/unavailable fallback, and one following third-person camera in the existing canvas;
- a bounded keyboard-focusable lower-left transcript/activity rail retaining ordered user, assistant streaming/final, tool start/completion/failure, and chat-error entries while preserving the centered composer/PTT;
- one in-renderer overhead Mr Fluff bubble plus equivalent semantic truth for idle, thinking/typing, generic tool, coding/terminal, complete, and failed lifecycle states, derived only from canonical `WorldAgentEvent` and send completion/failure;
- a clean-storage browser lane for the animated opening, `identify_`, visible `Create Avatar`, and the user-avatar creator, while retaining configured returning identity;
- `100dvh`/full-width World sizing, full canvas fill, large-desktop proof, and mobile containment without horizontal overflow.

Real correction RED records:

- Movement/look model: `corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-ui.test.tsx --maxWorkers=1 --no-file-parallelism`; exit `1`; 1 file, 10 tests, 1 failed/9 passed; `moveWorldPosition` was `undefined` instead of a function.
- Renderer camera pose: `corepack pnpm@11.15.0 exec vitest run packages/renderer-r3f/test/world-room-canvas.test.tsx --maxWorkers=1 --no-file-parallelism`; exit `1`; 1 file, 3 tests, 1 failed/2 passed; `calculateWorldCameraPose` was `undefined`.
- Chat/activity reducer: the focused World-entry command above; exit `1`; 1 file, 11 tests, 1 failed/10 passed; `createWorldChatState` was `undefined`.
- Transcript rail: the strengthened focused World-entry command; exit `1`; 1 file, 11 tests, 2 failed/9 passed; the activity reducer omitted its active assistant entry and the HUD omitted `aria-label="Conversation and activity"`.
- Renderer activity bubble: the focused renderer command above; exit `1`; 1 file, 4 tests, 1 failed/3 passed; `prepareWorldActivityBubble` was `undefined`.
- Responsive layout: the focused World-entry command; exit `1`; 1 file, 12 tests, 1 failed/11 passed; `.world-transcript` had no bounded `overflow-y: auto` rule.
- Clean-opening label: the focused World-entry command; exit `1`; 1 file, 12 tests, 1 failed/11 passed; rendered output contained `Begin identification`, not frozen `Create Avatar`.
- Integrated browser correction: production build exit `0` (20/20 tasks), then `xvfb-run -a ... playwright test apps/web/e2e/world-entry-single-agent.spec.ts --config playwright.config.ts --workers=1`; exit `1`; 7 selected, 4 failed/3 passed because the live canvas did not yet expose the canonical completed activity state. After that fix, the next 7-test run produced 1 failed/6 passed and identified one real mobile overflow from the clipped semantic activity label. The focused diagnostic mobile run reproduced 1/1 failed with the offending `SPAN` right edge at `535.53125` in a 390 px viewport.

Final correction GREEN records:

- Focused World-entry/renderer: `corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-ui.test.tsx packages/renderer-r3f/test/world-room-canvas.test.tsx --maxWorkers=1 --no-file-parallelism`; exit `0`; 2 files, 16/16 tests.
- Impacted World-entry, Phase 13 navigation/camera/lifecycle, Phase 12 session stream/UI, renderer, avatar, and startup boundaries: exit `0`; 14 files, 85/85 tests.
- Renderer and web typechecks/builds: exit `0`.
- Touched-file Prettier write/check: exit `0`; repository lint: exit `0`; root typecheck: 38/38 tasks; architecture: 1 file, 11/11 tests.
- Root production build: exit `0`; 20/20 package tasks.
- Final production browser file under Xvfb with one worker and a headed pointer-lock project: exit `0`; 7/7, including clean/returning launch, continuous movement, editable exclusion, real pointer lock/mouse yaw/Escape, retained `hi` reply/tool activity, same-canvas repository load, 1280×900, 1728×1080, mobile, no-WebGL, zero serious/critical axe findings, and sanitized evidence.
- `git diff --check`: exit `0`.

The optional aggregate `corepack pnpm@11.15.0 check` was not rerun in this bounded correction pass. Its correction-relevant constituent gates above are green, including the full requested impacted suite and production World-entry browser file; the parent should run the pinned aggregate during independent verification.

Independent parent verification remains the next required gate.

## 9. Strict vertical TDD order

For each slice, add or extend a focused test, run it under Node 24, record a real expected assertion failure caused by missing behavior, implement the minimum behavior, then rerun focused GREEN and impacted regressions:

1. Pure state guards, retry preservation, and repository activation truth.
2. Returning identity, terminal constellation, typewriter semantics, visual/action states.
3. Exact/zero/ambiguous safe-name resolution and unavailable/stale/recovered distinctions.
4. Explicit agent-avatar acceptance bound to the exact session.
5. Normal/internal route fail-closed behavior and first-launch preservation.
6. One blank room/scene/canvas, third-person camera, avatars, and bounded navigation.
7. Exact-session chat, canonical streaming/recovery, and unavailable adjacent push-to-talk.
8. Same-scene blank-to-repository floor transition with failure/cancellation retry and semantic no-WebGL state.
9. Full production-boundary desktop/mobile/keyboard/reduced-motion/forced-colors/no-WebGL/internal-isolation browser journey.

Representative RED command and assertion output summaries must be appended to this document or recorded verbatim enough for audit in `PHASE_18_REPORT.md`; no RED result may be inferred or fabricated.

## 10. Authoritative commands

All commands inherit the active NVM-managed Node `v24.18.0` binary directory first in `PATH`.

```bash
corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-machine.test.ts --maxWorkers=1 --no-file-parallelism
corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-machine.test.ts apps/web/test/world-entry-ui.test.tsx --maxWorkers=1 --no-file-parallelism
corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-client.test.ts apps/web/test/phase12-session-client.test.ts apps/web/test/phase12-agent-session-ui.test.tsx --maxWorkers=1 --no-file-parallelism
corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-ui.test.tsx apps/web/test/phase11-avatar-ui.test.tsx apps/web/test/phase12-agent-session-ui.test.tsx packages/avatar-system/test/avatar-system.test.ts --maxWorkers=1 --no-file-parallelism
corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-ui.test.tsx apps/web/test/phase5-stories.test.tsx apps/web/test/phase6-integration-panel.test.tsx --maxWorkers=1 --no-file-parallelism
corepack pnpm@11.15.0 exec vitest run packages/renderer-r3f/test/world-room-canvas.test.tsx packages/renderer-r3f/test/renderer-r3f.test.ts apps/web/test/phase13-manual-camera.test.ts apps/web/test/phase13-world-action-ui.test.tsx --maxWorkers=1 --no-file-parallelism
corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-ui.test.tsx apps/web/test/phase12-session-client.test.ts apps/web/test/phase12-agent-session-ui.test.tsx apps/web/test/phase15-browser-voice.test.ts apps/web/test/phase15-voice-ui.test.tsx --maxWorkers=1 --no-file-parallelism
corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-client.test.ts apps/web/test/world-entry-ui.test.tsx apps/web/test/repository-browser-model.test.ts apps/web/test/repository-index-client.test.ts apps/web/test/world-client.test.ts packages/renderer-r3f/test/world-room-canvas.test.tsx --maxWorkers=1 --no-file-parallelism
corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-machine.test.ts apps/web/test/world-entry-ui.test.tsx apps/web/test/world-entry-client.test.ts apps/web/test/phase11-avatar-ui.test.tsx apps/web/test/phase12-session-client.test.ts apps/web/test/phase12-agent-session-ui.test.tsx apps/web/test/phase13-manual-camera.test.ts apps/web/test/phase13-world-action-ui.test.tsx apps/web/test/phase15-browser-voice.test.ts apps/web/test/phase15-voice-ui.test.tsx apps/web/test/repository-browser-model.test.ts apps/web/test/repository-index-client.test.ts apps/web/test/world-client.test.ts packages/avatar-system/test/avatar-system.test.ts packages/renderer-r3f/test/world-room-canvas.test.tsx packages/renderer-r3f/test/renderer-r3f.test.ts --maxWorkers=1 --no-file-parallelism
corepack pnpm@11.15.0 exec prettier --check apps/web/src/App.tsx apps/web/src/world-entry apps/web/src/styles.css apps/web/test/world-entry-machine.test.ts apps/web/test/world-entry-ui.test.tsx apps/web/test/world-entry-client.test.ts apps/web/e2e/world-entry-single-agent.spec.ts packages/renderer-r3f/src packages/renderer-r3f/test docs/PHASE_18_SCOPE.md PHASE_18_REPORT.md
corepack pnpm@11.15.0 typecheck
corepack pnpm@11.15.0 check:architecture
corepack pnpm@11.15.0 build
xvfb-run -a corepack pnpm@11.15.0 exec playwright test apps/web/e2e/world-entry-single-agent.spec.ts --workers=1
corepack pnpm@11.15.0 check
git diff --check
```

The full `check` runs once at the final worker milestone if time/resources permit. Focused test runs must report nonzero test/file counts. Existing thresholds may not be weakened and tests may not be skipped to obtain green.

## 11. Prohibited side effects and parent-only gates

The worker must not alter dependencies/lockfiles, start persistent services, activate or exercise a real voice provider, mutate Hermes/OpenClaw profiles or sessions outside existing bounded test fixtures, contact the original AgentIntersect project, or perform any external publication/source-control action. Test-owned processes/listeners/temporary fixtures must be terminated or removed before handoff.

Worker closeout updates may say only **implementation complete / awaiting independent parent verification and user-facing acceptance**. Only Mr Fluff may perform the required independent real-diff/artifact functional parent proof. Only the user may accept/seal Phase 18 or authorize commit/push, provider work, Phase 19/20, or any external action.

## 12. Representative observed RED evidence

All entries below are real local command results, not inferred output:

- State-machine module RED:
  - Command: `corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-machine.test.ts --maxWorkers=1 --no-file-parallelism`
  - Exit `1`; 1 file selected, 1 test failed.
  - Assertion: `the World entry state machine must exist: expected null not to be null`.
  - After the module boundary existed, the expanded guard test produced exit `1`; 5 tests selected, 1 failed/4 passed; assertion: `expected 'undefined' to be 'function'` for `createReturningWorldEntryState`.
- World-owned client RED:
  - Command: `corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-client.test.ts --maxWorkers=1 --no-file-parallelism`
  - Exit `1`; 1 file selected, 1 test failed.
  - Assertion: `the World entry client must exist: expected null not to be null`.
  - The expanded exact-name/attachment/avatar/chat/repository contract then produced exit `1`; 5 tests selected, 1 failed/4 passed; assertion: `expected 'undefined' to be 'function'` for `resolveHermesDisplayName`.
- Shared room renderer RED:
  - Command: `corepack pnpm@11.15.0 exec vitest run packages/renderer-r3f/test/world-room-canvas.test.tsx --maxWorkers=1 --no-file-parallelism`
  - Exit `1`; 1 file selected, 1 test failed.
  - Assertion: `the shared World room renderer must exist: expected null not to be null`.
  - The expanded one-scene transition contract then produced exit `1`; 2 tests selected, 1 failed/1 passed; assertion: `expected 'undefined' to be 'function'` for `prepareWorldRoomScene`.
- Normal UI/internal-route RED:
  - Command: `corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-machine.test.ts apps/web/test/world-entry-ui.test.tsx --maxWorkers=1 --no-file-parallelism`
  - Exit `1`; 2 files selected, 3 tests failed/8 passed.
  - Assertions identified the missing `WorldEntryLogo`, missing `resolveAppSurface`, and missing planned World-entry component files.
- Production-browser accessibility RED:
  - Command: `xvfb-run -a corepack pnpm@11.15.0 exec playwright test apps/web/e2e/world-entry-single-agent.spec.ts --workers=1`
  - Exit `1`; 4 tests selected, 1 failed/3 passed.
  - Axe assertion found one serious `scrollable-region-focusable` violation on the semantic repository object list. Adding a labelled keyboard-focusable scroll region produced the subsequent 4/4 GREEN run.
- Preserved startup-boundary RED:
  - Command: `corepack pnpm@11.15.0 exec vitest run apps/web/test/startup-chunk-boundaries.test.ts apps/web/test/phase13-renderer-boundary.test.ts --maxWorkers=1 --no-file-parallelism`
  - Exit `1`; 2 files selected, 1 failed/1 passed.
  - The assertion exposed the new internal-dashboard boundary and eager World renderer in the startup graph. The renderer became a lazy independent `world-room-canvas` chunk, the internal dashboard remained a lazy chunk, and the updated boundary proof returned 2/2 GREEN with the entry chunk below its existing 400 KiB cap.

## 13. Parent-required visual embodiment correction RED evidence

The independent parent visual inspection rejected the placeholder ASCII agent creator, hard-coded rectangular avatar meshes, one-object repository evidence, and missing flagged-route browser proof. Before any correction production edit, the strengthened tests produced these real failures:

- Accepted avatar builder, strict mapping, in-scene avatars, and meaningful repository evidence RED:
  - Command: `corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-ui.test.tsx packages/renderer-r3f/test/world-room-canvas.test.tsx --maxWorkers=1 --no-file-parallelism`
  - Exit `1`; 2 files selected, 11 tests selected, 6 failed/5 passed.
  - The creator assertion received the legacy `<section class="world-agent-avatar">` and failed because `class="avatar-builder"` was absent.
  - `avatarDraftFromProposal`, `avatarProposalFromDraft`, and `AvatarKitWorldModel` were all `undefined` instead of functions.
  - The semantic World room omitted the expected `human · Codex` and `cat · Hermes` selection truth.
  - The bounded E2E snapshot contained only 1 matching package/directory/file object instead of at least 8.
  - The room scene still returned avatar positions at box-mesh height without actual selection data.
- Explicit flagged internal-dashboard browser proof RED:
  - Command: `xvfb-run -a corepack pnpm@11.15.0 exec playwright test apps/web/e2e/world-entry-internal-dashboard.spec.ts --workers=1`
  - Exit `1`; 1 test selected, 1 failed.
  - Under the existing default build, the expected internal heading `One local operator. One living repository island.` was absent. The correction must produce a separately flagged build and browser run while retaining the existing default-build fail-closed proof.

## 14. Historical Playwright internal-surface migration

Parent visual inspection accepted the Phase 18 embodiment correction and authorized a test/config-only migration of historical Phase 5–17 dashboard journeys from normal `/` to exact `/internal/dashboard`. The accepted migration RED remains the aggregate result recorded in `PHASE_18_REPORT.md`: 5 passed, 43 failed, and 1 skipped because the legacy journeys still sought dashboard controls on normal `/`.

The bounded migration preserves these frozen lanes:

- The flagged main config selects 49 tests in 19 files. All historical fixture/navigation URLs now use `/internal/dashboard` while preserving their query strings. The four Phase 18 World-entry tests remain explicit normal-root `/` journeys. The positive exact-path internal-dashboard test is selected and is no longer conditionally skipped. The existing serial worker limit, zero retries, headed pointer-lock project, and global teardown remain unchanged.
- A separate unflagged config selects exactly one direct-access fail-closed test. It builds without `VITE_AIW_LOCAL_DEVELOPER_UI`, seeds only the bounded local avatar prerequisite, and proves `/internal/dashboard` exposes neither the dashboard heading nor controls.
- `test:e2e` installs Chromium once, runs a full flagged build/suite, then rebuilds the web bundle without the flag and runs the narrow fail-closed lane. Direct Vite builds after the workspace build prevent Turbo cache reuse from confusing the build-time flag.

Observed migration commands/results:

- `VITE_AIW_LOCAL_DEVELOPER_UI=1 corepack pnpm@11.15.0 exec playwright test --config playwright.config.ts --list`
  - Exit `0`; 49 tests in 19 files.
- `corepack pnpm@11.15.0 exec playwright test --config playwright.unflagged.config.ts --list`
  - Exit `0`; 1 test in 1 file.
- `corepack pnpm@11.15.0 build && VITE_AIW_LOCAL_DEVELOPER_UI=1 corepack pnpm@11.15.0 exec vite build apps/web --config apps/web/vite.config.ts`
  - Exit `0`; workspace build 20/20 and explicit flagged web build succeeded.
- `VITE_AIW_LOCAL_DEVELOPER_UI=1 xvfb-run -a corepack pnpm@11.15.0 exec playwright test apps/web/e2e/foundation.spec.ts apps/web/e2e/operator-flow.spec.ts apps/web/e2e/phase5-flow.spec.ts --config playwright.config.ts --workers=1`
  - Exit `1`; 9 selected, 8 passed and 1 failed.
  - The route migration made all nine journeys reach the real dashboard. The unchanged Phase 5 reduced-motion assertion then observed `1.4` seconds instead of `<= 0.001`.
  - Root cause: the Phase 18 stylesheet’s reduced-motion rule uses unscoped `.terminal-cursor { animation: world-cursor-blink 1.4s ... !important; }`, which overrides the older global reduced-motion dashboard rule at the internal route. The minimum correction is to scope that selector to `.world-experience .terminal-cursor`.
  - This is a production stylesheet cross-route contradiction, not a test navigation/setup defect. The migration brief explicitly prohibits a production-code correction and requires the worker to stop/report when such a contradiction is discovered. The assertion was not weakened or changed.
- Initial isolated unflagged lane run selected 1/1 and failed because the extracted spec omitted the original saved-avatar prerequisite. Restoring `seedConfiguredAvatar` was a setup-only correction.
- `corepack pnpm@11.15.0 test:e2e:unflagged`
  - Exit `0`; workspace/default web builds succeeded and 1/1 fail-closed browser test passed.

The full flagged suite, combined `test:e2e`, and pinned aggregate `check` were not run after the focused blocker because the required order says to fix focused failures before advancing, while the same brief forbids the one-line production CSS scoping correction. No retry/assertion/timeout/product behavior was weakened.

## 15. Superseding fresh parent verification status — 2026-07-25

The user-authorized first-hand correction now has fresh independent parent proof green. Parent review challenged the actual diff and retained evidence, corrected forced-colors WebGL semantic overlap, made the activity indicator compact while preserving full accessible event truth, moved pointer-lock evidence into the real locked state, and strengthened the headed-project contract. Final local proof is **16/16** focused World/renderer tests, **7/7** production World-entry browser journeys, and authoritative aggregate exit `0` with **114/114 test files / 606/606 Vitest**, **20/20 builds**, smoke PASS, **52/52 flagged Playwright**, and **1/1 unflagged fail-closed Playwright**.

The user authorized private `main` commit/push, exact-SHA CI, and then a new full-browser first-hand retest from the true opening experience. Phase 18 remains not user accepted or sealed; revised Phase 19/20 remain closed.
