# Phase 13 — Draft Scope

**Status:** NEXT SESSION / NOT STARTED / DECISIONS TO FREEZE
**Selected:** 2026-07-21
**Baseline:** `d48fc12d72dfa437d0d8a1e9db9442ae1f1ac640`
**Runtime baseline:** Node `v24.18.0`, pnpm `11.15.0`
**Authority:** The user selected Phase 13 as the next-session topic. This draft authorizes orientation, discussion, and scope freeze only. It does not authorize production edits, dependency installation, asset generation, worker launch, commit/push, release, or any Phase 14+ work.

## Objective

Make the codebase inhabitable and let connected agents show spatial intent through deterministic semantic actions rather than decorative wandering.

## User-visible outcome

The operator can navigate the selected repository with accessible mouse/keyboard controls or equivalent click/search/semantic controls while persistent Phase 12 chat remains available. The connected agent can propose validated high-level actions to walk to existing files/symbols/tests, point at objects, focus the camera, trace or compare relationships, and lead/follow one bounded code tour. Every movement and highlight remains tied to stable World objects and truthful graph evidence rather than inferred thought or model-generated per-frame control.

## Accepted dependencies and inherited boundaries

- Completed Phase 12 persistent Hermes session binding, chat, capability truth, bounded projections, and recovery.
- Completed Phase 4 stable opaque World object identity and bounded layout.
- Completed Phase 10 symbols, dependencies, confidence/truncation labels, and 10k/100k LOD behavior.
- Completed Phase 11 shared skeleton/actions and semantic/reduced-motion avatar truth.
- Existing accessible semantic shell, current-versus-previous state, local/private authority, and one-human trusted local/LAN scope.
- Hermes remains authoritative for transcripts, approvals, tools, memory, skills, and project context.
- World Actions are presentation-only. They cannot edit files, dispatch tools, launch processes, approve work, mutate repository state, or become authority merely because action-like prose exists.

## Fresh-session decisions to freeze before coding

1. **Minimum vertical slice:** choose the smallest first-hand journey and exact two connected code areas used for the agent-led tour.
2. **User control contract:** freeze pointer-lock entry/exit, configurable WASD, click-to-move, search-to-focus, minimap travel, immediate shell escape, mobile/touch alternative, and keyboard-only equivalent.
3. **World Action transport:** choose the supported Phase 12 adapter/plugin/API proposal seam, capability advertisement, and degradation behavior when an adapter cannot emit structured actions.
4. **Action schema:** freeze version, action kinds, target/object identity, world/repository revision, request/action IDs, ordering, expiry, deduplication, cancellation, rate/queue bounds, and strict unknown-field handling for `aiw.world-action/0.13`.
5. **Target resolution:** freeze exact behavior for current, stale, renamed, tombstoned, deleted, ambiguous, unloaded, truncated, and cross-repository targets.
6. **Movement model:** freeze navigation bounds, interaction points, collision/obstacle policy, deterministic path representation, fixed-step or equivalent replay contract, blocked-path truth, and teleport/focus fallback.
7. **Attention versus arrival:** define semantic focus, requested destination, active path, physical arrival, interruption, supersession, follow state, and current-versus-previous recovery without implying hidden reasoning.
8. **Camera comfort:** freeze first-person default, optional third-person/photo/tour/follow modes, sensitivity/FOV limits, camera easing, motion-sickness controls, reduced-motion behavior, and no-WebGL/semantic alternatives.
9. **Trace/compare presentation:** freeze graph confidence/truncation limits, maximum objects/edges/path length, candidate-versus-confirmed labels, evidence links, and behavior when detail is unavailable.
10. **Replay and persistence:** decide which presentation-only actions are ephemeral, locally replayable, pinnable, cancellable, clearable, or restart-recoverable; define the Yjs/presentation boundary and retention cap.
11. **Performance/LOD budgets:** freeze desktop/mobile/two-CPU frame, Long Task, DOM-row, path-planning, action-rate, memory, and 10k/100k ceilings without weakening prior Phase 10/11 contracts.
12. **Acceptance evidence and cleanup:** freeze Storybook/Playwright fixtures, screenshot/video/metrics artifacts, first-hand comfort review, server/listener cleanup, private commit/push gate, and exact-SHA CI requirements.

## Proposed in scope

- Strict `aiw.world-action/0.13` schema and validation service after the decisions above are frozen.
- `navigate`, `focus`, `inspect`, `highlight`, `trace`, `compare`, `point-at`, `follow`, temporary annotation, present-evidence, clear, and bounded cancellation actions.
- Pointer-lock mouse look, configurable WASD, click-to-move, minimap travel, search-to-focus, follow-agent, and immediate shell escape with complete semantic alternatives.
- Deterministic target resolution, path planning, locomotion, interaction points, collision/blocked handling, and focus/teleport fallback using stable World object IDs.
- First-person and optional third-person/photo/tour views with explicit camera-comfort and reduced-motion controls.
- Truthful separation between semantic attention, requested target, active movement, arrival, interruption, stale target, and fallback.
- Bounded chat bubbles and authoritative status indicators anchored to existing avatars.
- Code-graph trace/compare presentation with evidence, confidence, truncation, and unavailable truth.
- Presentation-only action replay, cancel, clear, and bounded restart recovery.
- One first-hand agent-led tour connecting two real code areas without repository mutation.

## Out of scope

- Any repository/file mutation from World Actions.
- Treating model prose, hidden reasoning, animation, or per-frame model output as action authority.
- Tool dispatch, command execution, approval response, process launch, phase advancement, or Preview Manager behavior.
- Full physics, combat/game mechanics, procedural world generation, arbitrary durable layout mutation, or broad environment-art production.
- Phase 14 structured tool/edit/test/preview execution or Autonomous mutation envelope.
- Phase 15 voice/audio, hot microphone, or voice-provider work.
- Phase 16 simultaneous multi-agent editing, worktree coordination, or conflict resolution.
- Public hosting, internet ingress, unrelated-user multiplayer, cloud relay, deployment, release, tag, package publication, or repository visibility changes.
- Hermes core edits or original-AgentIntersect repository changes.

## Expected code and artifacts after authorization

- `world-action-protocol` leaf package and architecture-boundary tests.
- Navigation/path-planning package with deterministic fixtures and no app/adapter authority leakage.
- Browser user-control and camera systems with accessibility preferences.
- Agent locomotion/action controller and stable-object target resolver.
- Trace/highlight/compare layer and semantic action timeline.
- Capability-declared World Action adapter/helper contract.
- Storybook states and Playwright desktop/mobile/keyboard/reduced-motion/no-WebGL journeys.
- Bounded performance/accessibility measurements and a Phase 13 report.

These are expected future artifacts, not files authorized or created by this transition.

## Required tests and evidence

- Strict action schema/object-scope/revision/order/expiry/dedupe/rate validation and hostile unknown-field cases.
- Current/stale/renamed/tombstoned/deleted/ambiguous/unavailable target behavior.
- Deterministic path output, blocked route, cancellation, supersession, follow/interrupt, restart recovery, and focus/teleport fallback.
- Pointer-lock entry/escape, configurable controls, mobile/touch, keyboard-only, screen reader, reduced motion, forced colors, and no-WebGL equivalence.
- Trace/compare confidence, truncation, evidence links, and no candidate-as-confirmed behavior.
- Proof that no World Action mutates files, dispatches tools, approves work, launches processes, or alters AgentIntersect authority.
- 10k/100k and constrained/two-CPU LOD/performance proof under frozen budgets.
- First-hand operator comfort review and one connected-agent tour across two real code areas while Phase 12 chat remains usable.
- Focused tests during implementation, one integrated/full local gate, Storybook, production audit, fresh-copy verification, staged-diff inspection, private commit/push, and exact-SHA CI.

## Acceptance criteria

- The operator can traverse, escape, recover, and use semantic alternatives without becoming trapped or disoriented.
- A connected agent can truthfully navigate to and present existing World objects through validated high-level actions.
- Stable object/revision identity and graph confidence remain visible; stale, blocked, unavailable, and truncated results remain explicit.
- Action prose, chat text, avatar motion, and model output never become repository/tool authority.
- Movement and presentation meet the frozen desktop/mobile/constrained budgets and have complete reduced-motion/no-WebGL/semantic equivalents.
- Repository content and execution state remain unchanged by navigation and presentation.
- First-hand operator approval of navigation comfort and one agent-led code tour is recorded.

## Stop conditions

Stop and preserve evidence instead of improvising if:

- the selected adapter cannot propose structured actions without weakening Phase 12 session or approval ownership;
- targets cannot be bound to stable World identity and revision truth;
- navigation requires repository mutation, tool dispatch, arbitrary shell/process authority, or Phase 14 behavior;
- accessibility or camera comfort requires removing the core user-visible journey rather than providing an equivalent;
- prior Phase 10/11 performance boundaries would need to be silently weakened;
- public ingress, release/publication, Hermes core changes, original-AgentIntersect modification, voice, preview execution, or multi-agent editing becomes necessary.

## Exit gate

Phase 13 is complete only after the decisions above are frozen, the bounded navigation/World Action slice works, first-hand operator comfort and agent-led tour acceptance pass, complete local/fresh/browser/performance/accessibility gates are green, the intended diff is privately committed/pushed, and exact-SHA CI succeeds. Stop at the Phase 13 gate; Phase 14 remains a separate explicit authorization.

## Next-session entry

1. Read `AGENTS.md`, `PROJECT_STATUS.md`, this draft, the Phase 12 scope/report, and the Phase 13 canonical design section.
2. Inspect the live repository/index/runtime state without changing production code.
3. Review each fresh-session decision with the user, recommending defaults and alternatives where useful.
4. Rewrite this file from draft into `FROZEN / AUTHORIZED FOR IMPLEMENTATION` only after those decisions are explicitly accepted.
5. Begin no production implementation, dependency installation, agent worker, asset generation, or release action before that freeze.
