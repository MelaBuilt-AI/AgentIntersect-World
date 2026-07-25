# Revised Phase 18 Plan — World Entry Experience — Single-Agent Hermes Magic Slice

Status: Bounded implementation plan only

Created: 2026-07-25

Implementation status: Historical pre-implementation plan; this plan did not authorize implementation

Controlling UX: `docs/WORLD_ENTRY_EXPERIENCE.md`

Historical foundation: Accepted Phases 0–17

## 1. Objective

Implement exactly one future product slice after separate user authorization:

> existing user avatar → personalized animated logo/name → `AgentIntersect_` → `Single Agent` → `hermes_` → enter `Mr Fluff` → truthfully connect the exact existing local Hermes identity → explicitly create Mr Fluff’s avatar → return to the constellation → `Enter World` → third-person arrival in a blank floor room → bottom-center chat plus adjacent push-to-talk → request one repository → transform the entire current floor into the repository landscape

This plan composes existing accepted capabilities into the new normal experience. It does not reopen Phases 0–17, replace their authority boundaries, or authorize implementation by itself.

## 2. Observable success

The slice is successful only when a returning user can complete the entire journey without seeing or following a link to the inherited dashboard:

1. World restores an existing valid user avatar.
2. The full-screen existing animated logo shows the user’s name centered on the X.
3. `AgentIntersect_` types below the logo and `Single Agent` materializes.
4. The user selects `hermes_`, receives the terminal `agent name?` prompt, and enters `Mr Fluff`.
5. World resolves and attaches the exact existing local Hermes identity with truthful connecting/connected state.
6. A missing identity types `agent not found_` and immediately permits retry without technical detail.
7. Mr Fluff must pass through explicit avatar creation; no default is silently accepted.
8. `Enter World` is absent until both exact-session readiness and avatar completion are true.
9. The user enters one blank floor room with a third-person camera behind the user avatar.
10. Only bottom-center chat and adjacent push-to-talk persist.
11. The user asks Mr Fluff to load one approved repository.
12. Existing repository index/World projection truth drives an in-place transformation of the entire current floor into the repository landscape.

## 3. Frozen implementation boundaries

### In scope

- Returning-user flow with an already saved valid user avatar.
- Existing `/assets/dashboard/agentintersect_animated.svg`; no asset alteration.
- Consolas typography, progressive typed labels, and blinking underscore cursor.
- `Single Agent` and the four frozen endpoint labels, with only `hermes_` enabled for this slice.
- Terminal name prompt and exact Mr Fluff local Hermes resolution.
- Truthful current/previous/recovered/unavailable connection state.
- Explicit Mr Fluff avatar creator backed by accepted avatar and session-consent boundaries.
- Readiness-derived `Enter World`.
- One small blank floor scene, user and Mr Fluff avatars, bounded free movement, and third-person-behind-user camera.
- Minimal chat and visible push-to-talk control; canonical text remains sufficient while the provider is staged/unactivated.
- One bounded repository-load request and in-place floor transformation.
- Explicit local developer flag plus internal dashboard route, with no normal-experience link.
- Keyboard, captions/live regions, reduced motion, forced colors, no-WebGL equivalent, responsive containment, and enabled-blue/unavailable-grey truth.

### Out of scope

- Multi-agent flow.
- OpenClaw, Codex, or Claude connection breadth.
- LAN/different-PC setup UI.
- Custom Mr Fluff voice.
- Provider promotion or activation.
- First-person camera.
- New repository indexing, symbol, dependency, evidence, coordination, or recovery capability.
- Phase 13 Discord → World continuity retry.
- Broad admin/developer dashboard redesign.
- Hermes/OpenClaw core or profile modification.
- Original AgentIntersect inspection or modification.
- Public rooms, unrelated users, cloud relay, release, publication, tags, deployment, public ingress, or visibility changes.
- Package installation or dependency changes unless a later frozen implementation scope explicitly authorizes them.

## 4. Current reusable foundations

The plan is based on repository paths inspected at the accepted baseline.

| Capability                              | Existing path                                                                                                                                      | Planned use                                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| App entry and saved user-avatar restore | `apps/web/src/App.tsx`                                                                                                                             | Replace the normal returning-user branch with the World-entry composition; preserve first-launch behavior |
| First-launch identity                   | `apps/web/src/avatar/IdentifyExperience.tsx`                                                                                                       | Regression boundary only; revised Phase 18 begins with an existing avatar                                 |
| Explicit avatar editor                  | `apps/web/src/avatar/AvatarBuilder.tsx`                                                                                                            | Reuse through an agent-specific wrapper for Mr Fluff                                                      |
| User/agent avatar rendering             | `apps/web/src/avatar/AvatarPreview.tsx`, `apps/web/src/avatar/AvatarScene.tsx`, `apps/web/src/avatar/AvatarRosterScene.tsx`                        | Render approved user and Mr Fluff profiles                                                                |
| Avatar contracts/persistence            | `packages/avatar-system/src/index.ts`                                                                                                              | Reuse profile validation; extend only if exact agent-keyed persistence cannot stay in session consent     |
| Existing dashboard                      | `apps/web/src/shell/DashboardShell.tsx`                                                                                                            | Retain unchanged in purpose behind the internal route                                                     |
| Typewriter/reduced motion               | `apps/web/src/shell/ProgressiveTypeLine.tsx`, `apps/web/src/motion/use-reduced-motion.ts`                                                          | Generalize or reuse for final-label live-region-safe typing                                               |
| Hermes browser client                   | `apps/web/src/sessions/session-client.ts`                                                                                                          | Capability, native-session list, attach, status/history, avatar proposal/consent, and text stream         |
| Current Hermes UI logic                 | `apps/web/src/sessions/AgentSessionPanel.tsx`                                                                                                      | Extract/reuse connection and streaming behavior without carrying the ten-step panel UI into normal UX     |
| Hermes API routes                       | `apps/local-server/src/agent-session-routes.ts`                                                                                                    | Reuse existing capability/native/attach/status/history/avatar/message routes                              |
| Hermes gateway/store                    | `apps/local-server/src/agent-sessions.ts`                                                                                                          | Reuse exact binding, continuity, serialization, and avatar consent                                        |
| Repository request/index                | `apps/web/src/repository-index-client.ts`, `apps/local-server/src/repository-indexes.ts`                                                           | Start or select the one approved repository through existing bounded APIs                                 |
| World snapshot/tile client              | `apps/web/src/world-client.ts`                                                                                                                     | Load current World projection after successful repository indexing                                        |
| Repository UI/model                     | `apps/web/src/repository/RepositoryWorldPanel.tsx`, `apps/web/src/repository/repository-browser-model.ts`                                          | Separate data/model/semantic truth from the old dashboard panel composition                               |
| Repository R3F renderer                 | `packages/renderer-r3f/src/repository-island-canvas.tsx`, `packages/renderer-r3f/src/index.ts`                                                     | Reuse instance preparation and camera math in the same room scene                                         |
| Third-person/action state               | `apps/web/src/world-actions/WorldActionPanel.tsx`, `apps/web/src/world-actions/operator-navigation.ts`                                             | Reuse navigation reducers/guards without showing the panel                                                |
| Voice capability                        | `apps/web/src/voice/VoiceJourneyPanel.tsx`, `apps/web/src/voice/browser-voice.ts`                                                                  | Supply only the adjacent push-to-talk control state; no custom voice/provider activation                  |
| Existing focused UI tests               | `apps/web/test/phase11-avatar-ui.test.tsx`, `apps/web/test/phase12-agent-session-ui.test.tsx`, `apps/web/test/phase13-world-action-ui.test.tsx`    | Preserve existing component contracts and add new normal-entry coverage                                   |
| Existing journey tests                  | `apps/web/e2e/phase11-avatar-journey.spec.ts`, `apps/web/e2e/phase12-session-journey.spec.ts`, `apps/web/e2e/phase13-world-action-journey.spec.ts` | Reuse fixture patterns and accessibility/performance helpers                                              |

## 5. Planned product modules

Freeze these exact likely additions during the later implementation authorization:

- `apps/web/src/world-entry/world-entry-machine.ts`
  - Pure discriminated-union state and reducer.
  - Guards for exact-session connection, avatar completion, World entry, and repository activation.
- `apps/web/src/world-entry/WorldEntryExperience.tsx`
  - Full-screen identity/session/harness composition.
  - Owns no connector authority; dispatches events from client results.
- `apps/web/src/world-entry/WorldEntryLogo.tsx`
  - Existing animated mark, personalized X overlay, endpoint layout, typed labels, and semantic equivalents.
- `apps/web/src/world-entry/WorldEntryAgentAvatar.tsx`
  - Explicit Mr Fluff avatar creation using accepted avatar inputs and exact session consent.
- `apps/web/src/world-entry/WorldRoom.tsx`
  - One scene identity containing blank floor, avatars, third-person camera, and later repository floor.
- `apps/web/src/world-entry/WorldHud.tsx`
  - Bottom-center chat, exact recipient (`Mr Fluff`), adjacent push-to-talk, captions, and transient truth.
- `apps/web/src/world-entry/world-entry-client.ts`
  - Thin composition over existing session, repository-index, and World clients; no raw Hermes access.
- `packages/renderer-r3f/src/world-room-canvas.tsx`
  - One Canvas/scene host that transitions its floor contents from blank to repository instances.

Freeze these exact likely tests:

- `apps/web/test/world-entry-machine.test.ts`
- `apps/web/test/world-entry-ui.test.tsx`
- `apps/web/test/world-entry-client.test.ts`
- `apps/local-server/test/world-entry-hermes-api.test.ts` only if safe-name resolution requires a server contract change
- `packages/renderer-r3f/test/world-room-canvas.test.tsx`
- `apps/web/e2e/world-entry-single-agent.spec.ts`

## 6. State and authority design

### 6.1 State model

Use a reducer with at least these states:

`returning_identity` → `session_select` → `constellation_single` → `agent_prompt` → `agent_resolving` → (`agent_not_found` | `agent_connected`) → `agent_avatar` → `enter_ready` → `world_entering` → `world_blank` → `repository_loading` → (`world_blank` | `world_repository`)

Store facts separately from visual timing:

- saved user profile identity;
- selected harness;
- entered safe display name;
- exact native Hermes session ID;
- World session ID and continuity;
- Mr Fluff avatar consent/profile identity;
- current repository operation/generation/snapshot identity;
- last truthful error/retry state.

Animations may dispatch only visual-completion events. They must not fabricate connection, avatar, repository, or authority readiness.

### 6.2 Mr Fluff resolution

Prefer a pure bounded resolver over the existing safe native-session list:

1. Normalize the entered display name only for comparison (trim and Unicode case-fold).
2. Match a single safe identity label supplied by the accepted World adapter contract.
3. Require exactly one match.
4. Keep the opaque native session ID internal.
5. On zero or multiple matches, present `agent not found_` and retry.
6. Never reveal filesystem paths, profile locations, transport IDs, stack messages, or connector diagnostics.

If the existing `NativeSession` DTO lacks a stable safe identity label, extend the World-owned agent-session protocol and adapter fixture with one bounded display field through RED-to-GREEN contract tests. Do not inspect or modify Hermes itself.

### 6.3 Agent avatar authority

- Reuse the current bounded avatar proposal only as initial editable input.
- Require a deliberate save/accept action from the explicit creator.
- Persist consent against the exact World session through the existing avatar-consent route/store.
- Keep the `Enter World` guard false when consent is absent, declined, revoked, stale for another session, or invalid.
- Do not substitute the user avatar, a harness shirt default, or a hidden generated profile.

### 6.4 Internal dashboard boundary

Use a build-time local developer flag such as `VITE_AIW_LOCAL_DEVELOPER_UI=1` and the exact path `/internal/dashboard`.

- `App.tsx` may render `DashboardShell` only when both flag and path match.
- Without the flag, direct internal-route access fails closed to the normal entry surface or a concise local-only unavailable page.
- Normal entry and World components contain no dashboard link or shortcut.
- Existing dashboard tests continue to mount `DashboardShell` directly or opt into the explicit test flag.
- The flag is not remote authorization and must not expose a new listener or network scope.

## 7. TDD implementation sequence

Every implementation step begins with a focused failing test and ends with the smallest green change.

### Step 1 — Lock the pure state machine

RED:

- Add `apps/web/test/world-entry-machine.test.ts`.
- Prove restored-user entry starts at `returning_identity`.
- Prove `Enter World` is impossible before exact Hermes connection and explicit Mr Fluff avatar completion.
- Prove animation completion cannot advance authority state.
- Prove `agent_not_found` retries without discarding restored user state.
- Prove repository activation requires a successful current or disclosed recovered World projection.

GREEN:

- Add `apps/web/src/world-entry/world-entry-machine.ts`.
- Implement pure events, derived guards, and invariant assertions only.

Command:

```bash
corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-machine.test.ts --maxWorkers=1 --no-file-parallelism
```

### Step 2 — Compose returning identity and terminal constellation

RED:

- Add `apps/web/test/world-entry-ui.test.tsx`.
- Assert animated logo source, centered user name, Consolas class contract, `AgentIntersect_`, Single/Multi placement, all four endpoint labels/colors, and only `hermes_` enabled.
- Assert terminal newline → `agent name?` → name input sequence.
- Assert accessible final text is announced once and reduced motion does not emit character-by-character announcements.
- Assert unavailable actions are grey and enabled actions blue without color-only semantics.

GREEN:

- Add `WorldEntryLogo.tsx` and `WorldEntryExperience.tsx`.
- Reuse the existing animated asset and reduced-motion hook.
- Add scoped styles in `apps/web/src/styles.css`.

Command:

```bash
corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-machine.test.ts apps/web/test/world-entry-ui.test.tsx --maxWorkers=1 --no-file-parallelism
```

### Step 3 — Resolve and attach exact Mr Fluff session

RED:

- Add `apps/web/test/world-entry-client.test.ts`.
- Prove exact safe-name match maps to one existing opaque Hermes session.
- Prove zero/ambiguous matches return the same nontechnical miss.
- Prove capability unavailable, attach failure, stale status, and previous/recovered continuity remain distinct.
- If a protocol field is required, add focused RED tests in `packages/agent-session-protocol/test/phase12-protocol.test.ts` and `apps/local-server/test/world-entry-hermes-api.test.ts`.

GREEN:

- Add `world-entry-client.ts` over `session-client.ts`.
- Extract reusable connection logic from `AgentSessionPanel.tsx` without changing gateway authority.
- Extend only World-owned DTO/fixture code if the safe identity field is absent.

Commands:

```bash
corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-client.test.ts apps/web/test/phase12-session-client.test.ts apps/web/test/phase12-agent-session-ui.test.tsx --maxWorkers=1 --no-file-parallelism
```

If the server/protocol changes:

```bash
corepack pnpm@11.15.0 exec vitest run packages/agent-session-protocol/test/phase12-protocol.test.ts apps/local-server/test/world-entry-hermes-api.test.ts apps/local-server/test/phase12-agent-session-api.test.ts apps/local-server/test/phase12-agent-sessions.test.ts --maxWorkers=1 --no-file-parallelism
```

### Step 4 — Require explicit Mr Fluff avatar creation

RED:

- Extend `world-entry-ui.test.tsx`.
- Prove a first-time connected Mr Fluff always opens the explicit creator.
- Prove save/accept returns to the constellation and unlocks entry.
- Prove decline, revoke, invalid input, mismatched session, and save failure keep entry locked.
- Preserve existing user-avatar and agent-avatar consent tests.

GREEN:

- Add `WorldEntryAgentAvatar.tsx`.
- Reuse `AvatarBuilder.tsx` fields/rendering and the existing avatar proposal/consent routes.
- Keep user and agent persistence identities separate.

Command:

```bash
corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-ui.test.tsx apps/web/test/phase11-avatar-ui.test.tsx apps/web/test/phase12-agent-session-ui.test.tsx packages/avatar-system/test/avatar-system.test.ts --maxWorkers=1 --no-file-parallelism
```

### Step 5 — Gate the internal dashboard

RED:

- Extend `world-entry-ui.test.tsx` or add a focused `app-routing` block.
- Prove normal `/` renders World entry and contains no dashboard link.
- Prove `/internal/dashboard` renders internal machinery only when the explicit local flag is enabled.
- Prove the same route fails closed without the flag.
- Preserve first-launch `IdentifyExperience` behavior when no valid user avatar exists.

GREEN:

- Update `apps/web/src/App.tsx`.
- Retain `DashboardShell.tsx` behind the exact internal flag/route.
- Adjust test helpers/fixtures only where they explicitly opt into the internal route.

Command:

```bash
corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-ui.test.tsx apps/web/test/phase5-stories.test.tsx apps/web/test/phase6-integration-panel.test.tsx --maxWorkers=1 --no-file-parallelism
```

### Step 6 — Build one blank World room with third-person arrival

RED:

- Add `packages/renderer-r3f/test/world-room-canvas.test.tsx`.
- Extend UI tests for default third-person state, camera behind the user, bounded navigation, user/Mr Fluff avatar presence, blank floor identity, no portal, and no persistent panels.
- Preserve Phase 13 camera/navigation regressions.

GREEN:

- Add `packages/renderer-r3f/src/world-room-canvas.tsx` and its export.
- Add `WorldRoom.tsx`.
- Reuse camera math from `packages/renderer-r3f/src/index.ts` and navigation reducers from `apps/web/src/world-actions/`.
- Do not mount `WorldActionPanel`; use its accepted pure state behavior.

Commands:

```bash
corepack pnpm@11.15.0 exec vitest run packages/renderer-r3f/test/world-room-canvas.test.tsx packages/renderer-r3f/test/renderer-r3f.test.ts apps/web/test/phase13-manual-camera.test.ts apps/web/test/phase13-world-action-ui.test.tsx --maxWorkers=1 --no-file-parallelism
```

### Step 7 — Add the minimal World HUD and exact-session text

RED:

- Prove `WorldHud` is the only persistent overlay.
- Prove chat sends to the exact attached Mr Fluff session and streams/finalizes through existing reducer logic.
- Prove push-to-talk remains adjacent and grey with a concise reason when unavailable.
- Prove captions/live state, interrupt/retry, and canonical text recovery.

GREEN:

- Add `WorldHud.tsx`.
- Reuse `agent-stream-state.ts`, `session-client.ts`, and capability-detected voice code.
- Do not mount `AgentSessionPanel` or `VoiceJourneyPanel`.

Command:

```bash
corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-ui.test.tsx apps/web/test/phase12-session-client.test.ts apps/web/test/phase12-agent-session-ui.test.tsx apps/web/test/phase15-browser-voice.test.ts apps/web/test/phase15-voice-ui.test.tsx --maxWorkers=1 --no-file-parallelism
```

### Step 8 — Transform the current floor into one repository

RED:

- Prove a bounded repository request enters `repository_loading`.
- Prove failed/cancelled indexing preserves the blank floor and exposes retry.
- Prove a successful current generation swaps floor content in the same `WorldRoom`/Canvas identity.
- Prove user/Mr Fluff/camera state survives the floor transformation.
- Prove no portal, second Canvas, dashboard repository picker, or separate room appears.
- Preserve repository semantic/no-WebGL truth.

GREEN:

- Compose existing repository-index and World clients in `world-entry-client.ts`.
- Refactor reusable repository scene data from `RepositoryWorldPanel.tsx` without removing its internal use.
- Render repository instances inside `world-room-canvas.tsx`.
- Keep the semantic DOM equivalent associated with the same World state.

Commands:

```bash
corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-client.test.ts apps/web/test/world-entry-ui.test.tsx apps/web/test/repository-browser-model.test.ts apps/web/test/repository-index-client.test.ts apps/web/test/world-client.test.ts packages/renderer-r3f/test/world-room-canvas.test.tsx --maxWorkers=1 --no-file-parallelism
```

### Step 9 — Prove the complete browser journey

RED:

- Add `apps/web/e2e/world-entry-single-agent.spec.ts` against production app boundaries and bounded World-owned fixtures.
- Cover exact success path, name miss/retry, early-entry refusal, avatar requirement, blank-room arrival, chat request, same-floor repository transformation, reload/current-previous truth, and internal-route isolation.
- Add desktop/mobile, keyboard-only, reduced-motion, forced-colors, captions, no-WebGL, axe, console-error, and overflow assertions.

GREEN:

- Make only focused product changes required by failing acceptance assertions.
- Retain enabled-blue/unavailable-grey and typewriter/cursor truth.

Command:

```bash
corepack pnpm@11.15.0 exec playwright test apps/web/e2e/world-entry-single-agent.spec.ts --workers=1
```

## 8. Focused and integrated verification

Run after the slice is green and only under later implementation authorization.

### Formatting

```bash
corepack pnpm@11.15.0 exec prettier --check apps/web/src/App.tsx apps/web/src/world-entry apps/web/src/styles.css apps/web/test/world-entry-machine.test.ts apps/web/test/world-entry-ui.test.tsx apps/web/test/world-entry-client.test.ts apps/web/e2e/world-entry-single-agent.spec.ts packages/renderer-r3f/src packages/renderer-r3f/test
```

Add server/protocol paths to the command only if they changed.

### Focused unit/integration suite

```bash
corepack pnpm@11.15.0 exec vitest run apps/web/test/world-entry-machine.test.ts apps/web/test/world-entry-ui.test.tsx apps/web/test/world-entry-client.test.ts apps/web/test/phase11-avatar-ui.test.tsx apps/web/test/phase12-session-client.test.ts apps/web/test/phase12-agent-session-ui.test.tsx apps/web/test/phase13-manual-camera.test.ts apps/web/test/phase13-world-action-ui.test.tsx apps/web/test/phase15-browser-voice.test.ts apps/web/test/phase15-voice-ui.test.tsx apps/web/test/repository-browser-model.test.ts apps/web/test/repository-index-client.test.ts apps/web/test/world-client.test.ts packages/avatar-system/test/avatar-system.test.ts packages/renderer-r3f/test/world-room-canvas.test.tsx packages/renderer-r3f/test/renderer-r3f.test.ts --maxWorkers=1 --no-file-parallelism
```

### Type and architecture boundaries

```bash
corepack pnpm@11.15.0 typecheck
corepack pnpm@11.15.0 check:architecture
```

Required architecture assertions:

- normal World-entry modules do not import diagnostics, evidence, coordination, command-intent, or dashboard panel modules;
- browser code uses World session clients, never raw Hermes internals or PTY;
- internal dashboard route is flag-gated and unlinked;
- one scene host owns blank and repository floor states.

### Production build and focused browser proof

```bash
corepack pnpm@11.15.0 build
corepack pnpm@11.15.0 exec playwright test apps/web/e2e/world-entry-single-agent.spec.ts --workers=1
```

### Full repository proof

Run only after focused proof is green:

```bash
corepack pnpm@11.15.0 check
```

No provider exercise command, Phase 13 Discord continuity command, external harness mutation, or original-project verification belongs in this phase.

## 9. Evidence expected from a later authorized implementation

- State-machine transition matrix with all readiness guards green.
- Desktop and mobile captures of personalized identity, Hermes prompt, explicit Mr Fluff avatar, blank room, and repository floor.
- A browser trace showing the same World scene/canvas identity before and after repository activation.
- Accessibility results: keyboard path, axe, live regions, captions, reduced motion, forced colors, no-WebGL, and overflow.
- Exact session/current-previous/retry assertions without technical identity leakage.
- Confirmation that the normal UX has no internal dashboard link and the internal route fails closed without its local flag.
- Focused and full command transcripts with real exit status.
- Cleanup confirmation for any disposable repository/process fixture owned by the authorized test.

Generated evidence paths must be separately frozen before implementation. This plan does not authorize evidence creation now.

## 10. Acceptance gate

Revised Phase 18 may be proposed complete only after:

1. a separately authorized implementation follows this exact bounded slice;
2. focused and affected integrated tests pass;
3. the complete production-boundary browser journey passes;
4. Mr Fluff independently inspects the real diff/artifact and performs functional parent proof;
5. the user performs first-hand testing and explicitly accepts the experience.

Phase 18 completion does not authorize revised Phase 19 or 20.

## 11. Later gated actions

The following are deliberately listed as later gates, not actions authorized by this plan:

- commit the accepted implementation;
- push a private branch or `main`;
- run exact-SHA remote CI;
- open or merge a pull request;
- activate/promote a voice provider;
- modify Hermes/OpenClaw configuration or profiles;
- publish, release, tag, deploy, expose public ingress, or change repository visibility.

Each requires explicit user authorization that names the action and scope.
