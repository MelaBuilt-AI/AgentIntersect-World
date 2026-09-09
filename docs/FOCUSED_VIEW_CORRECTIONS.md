# Focused view and continuation corrections

> **September 9 delivery update:** Aaron authorized the cumulative PR, push and conditional merge after CI/readiness are green (`1547254171474993302`). The current delivery/acceptance cutline is `PROJECT_STATUS.md`; dated no-delivery and pending-test statements below are historical records, not current authorization. Retained runtimes, public/release actions and later-phase scopes remain protected.

Authorized by Aaron in Discord1546724788335149067 after mixed report1546718925046288414. Implemented locally September7–8, 2026. **Technical GREEN; fresh manual test running; operator acceptance pending.**

## Scope and preservation

Fix focused-code occlusion, recurring focused-sky stutter, readable current-iteration reports, World View menu/Alt+3 parity, and follow-up stream cancellation after file mutation. Preserve initial preview and wheel-behind-maximized-HUD passes. No commit/push/publication, provider changes, original AgentIntersect edits or failed-lane interactions. Failed45283 state/worktrees retained; older45281,45279 and original site46381 remain reachable.

## Corrections and causal proof

1. **Cancelled follow-up:** persisted second-turn events28/29 include `repositoryPath`/`activityId`. Browser tool-event parser accepted only `toolName`, rejected valid producer metadata, and closed the stream. Response-close correctly cancelled Codex after the edit. Accept/validate the two supported optional fields; preserve cancellation on genuine disconnect. Exact-stream client regression failed before the change and passed afterward; the browser follow-up now includes these fields and consumes completion.
2. **Focused code occlusion:** depth-derived DOM index could tie scene canvas layer3, leaving bubbles/scene on top. Focused code uses layer10, below wheel12 and real HUD/fullscreen controls. Same DOM/scroll identity and normal unfocused depth sorting remain.
3. **Sky stutter:** focus camera callback previously ran after sky sampled an ordinary pose restored by status effects. Focus now runs at R3F priority-1 before sky/scene sampling, without taking over automatic rendering. Repeated camera-reset regression failed before correction and passes now. Four headed-browser held-sky samples over polling boundaries have zero changed pixels in the fixed sky crop.
4. **Reports:** emit actual Markdown headings and Task/Branch/Outcome paragraphs for the existing safe renderer. Track current working/iteration event scope rather than repeating the original title. Real rendered fixture screenshot has distinct readable Starting and Completion reports for the current request.
5. **Menu pointer path:** enabled state and keyboard activation passed, but actual pointer RED hit a transparent HUD DIV. Read-only original-native inspection corroborated `.world-hud`/captions intercepting enabled controls. Make layout shell/decorative captions pointer-transparent, actual transcript/composer/voice surfaces interactive. Menu click now switches HUD→spatial; wheel remains behind visible HUD/fullscreen. Do not raise the whole wheel or disable legitimate controls.

## Verification and evidence eras

Evidence root: `/home/mela_ai/.hermes/runs/aiw-focus-corrections-20260907/`.

- `gates.json`: Node24.18.0, producer-package builds, web/server typechecks, full **1179 tests in189 files**, isolated production build all exit0. This full run preceded the final HUD pointer-only CSS correction; subsequent browser proof covers that correction.
- After formatting: affected lint/web types and6 focused tests in4 files passed. Final affected lint and `git diff --check` passed after the browser changes. No project commit or exact-dirty-tree CI claim.
- Browser attempt1: HUD/keyboard-menu journey passed; code journey failed mouse-look in incorrectly headless pointer-lock configuration.
- Attempt2: real pointer menu RED (enabled but hit DIV); same invalid headless mouse-look test configuration.
- Attempt3: HUD/menu/follow-up metadata/report/preview/fullscreen journey passed after CSS fix; code journey still failed in invalid headless configuration.
- Attempt4 restores the repository's required headed pointer-lock split under Xvfb: **4/4 PASS,1.8m**, exit0. Covers menu pointer→spatial and back, chat input/report rendering, follow-up file metadata stream and preview refresh, wheel/fullscreen hit testing, focused source scrolling and same-DOM Alt+4 round-trip, camera look, and lower-HUD camera vs chat-context-menu ownership.
- `sky-temporal-final.json`: four headed screenshots spaced at least1050ms, fixed1440×100 sky crop, all three comparisons0 changed pixels under Reduced Motion. This proves held-sky stability across polling; live animated comfort belongs to Aaron.
- Focused-code, report, menu and fullscreen fixture screenshots inspected. Automated fixtures are not a live native Codex turn or operator acceptance.
- Failed attempts retained. No mutation to original user's browser, worktrees or services; original browser observations were read-only.

## Manual test running

- **http://127.0.0.1:45285/** / backend43885; tmux `aiw-focus-20260907`.
- Root `/home/mela_ai/.hermes/runs/aiw-focus-manual-20260907/` contains README, launcher, runtime identity, health, read-only checker, browser/native entry observations and seed provenance.
- Fresh Codex-only Edge profile/CDP49285; left on Create Avatar with empty storage and no automated setup/consent/messages. Native main window visible/enabled/unowned by a modal; matching frontend/proxy/backend healthy, Codex capability available; served entry HTML/JS/CSS matched final build.
- Existing repository to load: `/home/mela_ai/.hermes/runs/aiw-focus-manual-20260907/veggie-focus-test`.
- Three actual website files copied into separate no-remote repository; initial checkpoint already satisfied, homepage seed test1/1 PASS; source hashes unchanged. **Old Workstream/native history NOT imported.** Full two-prompt checklist and generation-specific owner-validated cleanup are in its README. Leave running as explicitly requested.

## Next gate

Wait for Aaron's criterion-specific test. Preserve any failure state; do not automatically reset/retry/rebuild during testing. Saved-session restoration, hosted GitHub, full Slice6, live Hermes, older multi-agent/browser-marker CI and Phase20 remain separate scopes. Cumulative main4304a66 changes remain local/uncommitted; no blanket staging or publication.
