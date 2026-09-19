# Phase 13 — Frozen Scope

**Status:** COMPLETE UNDER USER WAIVER / LIVE DISCORD → WORLD CONTINUITY DEFERRED
**Frozen:** 2026-07-21
**Baseline:** `172afa5b9563f9d3dcecdf25018a94ddcd6ade39`
**Runtime baseline:** Node `v24.18.0`, pnpm `11.15.0`
**Authority:** The user explicitly selected all twelve decisions, froze this scope, and instructed Mr Fluff to complete Phase 13 through Codex orchestration. This authorizes the bounded repository implementation, required dependencies and generated fixtures, one Codex implementation worker, independent parent verification, reversible post-turn live Hermes acceptance, private commit/push, and exact-SHA CI required by this scope. It does not authorize a release, tag, publication, deployment, public ingress, visibility change, original-AgentIntersect modification, or Phase 14+ work.
**Performance amendment:** On 2026-07-21, after three identical standard-Chromium samples split between 16.7/16.8 ms at the 60 Hz scheduler boundary and an uncapped-browser spike produced invalid negative frame intervals, the user explicitly approved the hybrid desktop contract below. This is a frozen evidence-definition correction, not permission to hide raw cadence or relax application render-work.
**Delivery mode:** Functionality-first bounded phase. Use focused RED→GREEN slices, one integrated/full parent gate, first-hand operator testing, and corrections only for observed defects. No routine broad audit.
**Closeout waiver:** The final exact-root live retry failed after successful root-to-effective compression resolution but before any assistant final or World Action tour. On 2026-07-22 the user instructed Mr Fluff not to retry or make another product correction, to pin the feature for a later milestone, and to complete Phase 13 after the remaining non-live gates passed. This waiver supersedes only the live continuity/tour acceptance item; it does not convert that gate to green or weaken the repository, browser, performance, cleanup, private-push, or exact-SHA CI requirements.

## Objective

Make the codebase inhabitable and let connected agents show spatial intent through deterministic semantic actions rather than decorative wandering.

## Frozen user-visible outcome

The operator enters a comfort-first third-person repository World, may explicitly opt into first-person pointer-lock traversal, and retains accessible click/search/minimap, keyboard-only, touch, reduced-motion, and no-WebGL alternatives. Persistent Phase 12 chat remains available.

The connected Hermes agent proposes strict presentation-only World Actions. The first accepted tour begins in `packages/spatial-code-graph` and travels to `packages/renderer-r3f`, showing how projected World objects become the visible repository island. The agent may navigate, focus, inspect, highlight, trace, compare, point at, follow, annotate temporarily, present evidence, clear presentation state, and cancel bounded work. Every target, relationship, movement state, and outcome remains tied to stable World identity, exact revisions, and truthful graph evidence.

Live session continuity is one-way for this phase: the operator starts the exact logical conversation in Discord, supplies that active Discord root for World attachment, and World follows only the compression continuation proven at runtime by `GET /api/sessions/{root}/messages`. Ordered World chat, the strict action tour, and a final World chat turn are required. Returning to the same pre-existing Discord route, sending a post-tour Discord turn, and proving continuity through a gateway restart are explicitly not required. For later Discord re-entry, the supported closeout is `prep end session` while still in World, then Discord `/new` and `find handoff`; the durable handoff carries project continuity.

## Accepted dependencies and inherited boundaries

- Completed Phase 12 persistent Hermes session binding, chat, capability truth, bounded projections, and recovery.
- Completed Phase 4 stable opaque World object identity and bounded deterministic layout.
- Completed Phase 10 symbols, dependencies, confidence/truncation labels, 10k/100k LOD behavior, and performance contracts.
- Completed Phase 11 shared skeleton/actions, semantic avatar truth, reduced-motion behavior, and performance contracts.
- Existing accessible semantic shell, current-versus-previous labels, local/private authority, and one-human trusted local/LAN scope.
- Hermes remains authoritative for transcripts, approvals, tools, skills, memory, and project context.
- World Actions are presentation-only. They cannot edit files, dispatch arbitrary tools or commands, launch processes, approve work, mutate repository state, advance phases, or become authority merely because action-like prose exists.
- The original `/home/user/AgentIntersect` repository remains untouched.

## Frozen decisions

### 1. Minimum vertical slice and tour

The first-hand journey is **From model to visible island**:

1. Attach the exact active Discord-rooted Phase 12 Hermes conversation in World and keep its runtime-proven effective continuation/chat visible and usable.
2. Accept one validated bounded World Action tour.
3. Begin at a real object in `packages/spatial-code-graph`.
4. Present the exact evidence connecting the projected model to `packages/renderer-r3f`.
5. Traverse to the visible repository-island implementation.
6. Distinguish requested target, semantic attention, path planning, movement, arrival, and evidence presentation.
7. Return control immediately when the operator moves, presses `Escape`, cancels, or exits Follow.

The tour does not read, edit, test, build, preview, or otherwise mutate repository content.

### 2. User control and escape contract

- Third-person is the default traversal view.
- First-person pointer lock is an explicit immersive desktop mode entered only through a visible operator action.
- First-person uses configurable WASD and mouse look.
- `Escape` exits pointer lock and agent-led camera/avatar motion immediately and returns focus to the unchanged shell.
- Click-to-move, search-to-focus, and minimap travel remain available even when pointer lock is supported.
- Keyboard-only navigation provides focusable destinations, directional movement, activation, cancel, and shell return without requiring pointer lock.
- Mobile/touch provides tap-to-move, drag-to-look, visible movement controls, focus/search, cancel, and shell return.
- No mode may trap the operator or hide the current status/result controls.

This reconciles the selected immersive control set with the later selected comfort-first camera default: immersive controls remain complete, but first-person is opt-in rather than the default entry camera.

### 3. World Action transport and capability degradation

- Extend the reversible, profile-scoped Phase 12 `agentintersect-world` Hermes plugin with one strict presentation-only `propose_world_action` tool/helper.
- Reuse the exact-session loopback HTTP/SSE adapter and preserve existing Phase 12 chat ordering, session binding, transcript ownership, and approval behavior.
- Advertise the capability explicitly as `worldActions: true` with protocol/version and bounds.
- The model supplies only allowlisted semantic action intent and stable target references. Model prose, JSON-looking chat text, hidden reasoning, animation, and per-frame output are never parsed as action authority.
- When the selected adapter/plugin cannot advertise or execute the structured proposal helper, persistent chat and manual navigation remain available while agent-led World Actions are disabled with an explicit reason.
- No shadow transcript, raw PTY scraping, Hermes core edit, or unsupported approval/interrupt simulation is allowed.

### 4. `aiw.world-action/0.13` schema, identity, ordering, and bounds

- Use a strict discriminated protocol with batches of 1–8 ordered actions.
- One batch binds exactly one World session, selected repository, World/layout generation, graph generation where applicable, and capability snapshot.
- The adapter/World assigns request ID, batch ID, action IDs, exact session/repository/revision metadata, monotonic sequence, creation time, and expiry. The model cannot mint or override authority-bearing metadata.
- Reject unknown fields, unknown action kinds, malformed IDs, mixed revisions, expired batches, duplicates, replay outside the dedupe window, sequence gaps, oversized payloads, and unadvertised capabilities.
- Default TTL: 30 seconds; maximum TTL: 120 seconds.
- Maximum serialized envelope: 16 KiB.
- Rate: 4 accepted actions per second with burst 8.
- Queue maximum: 32 actions across accepted batches for one exact World session.
- Deduplication window: the most recent 1,024 IDs or 10 minutes, whichever removes an entry first.
- Cancellation names the exact active or queued action/batch ID and is idempotent.
- The allowlisted action kinds are `navigate`, `focus`, `inspect`, `highlight`, `trace`, `compare`, `point-at`, `follow`, `annotate-temporary`, `present-evidence`, `clear`, and `cancel`.

### 5. Target resolution and batch failure

- Prevalidate every action in a batch against the same exact repository/World/graph revisions before enqueueing; any preflight failure rejects the whole batch with no movement.
- Current exact refs execute.
- A stable-ID rename may rebind to its current object only when continuity is authoritative; the UI shows requested-versus-current identity/path truth.
- An explicit tombstone may be focused only as a tombstone and never represented as a live object.
- Deleted-without-tombstone, ambiguous, unresolved, unsupported, and cross-repository targets reject the batch.
- An unloaded or truncated target receives one bounded authoritative lookup. The resolver never guesses from a name, path fragment, prose, or visual proximity.
- If a previously valid target becomes invalid while a batch executes, the current action ends truthfully and all remaining batch actions become cancelled/skipped. No later action silently continues against a different revision.

### 6. Deterministic navigation mesh and blocked behavior

- Generate a versioned deterministic navigation mesh from authoritative stable object bounds, navigation bounds, interaction points, and declared static obstacles.
- Use deterministic polygon construction, canonical ordering, fixed numeric quantization, deterministic polygon-path search, and quantized path corners.
- Bind every navmesh and path to the exact World/layout generation and navigation-contract version.
- Collision uses the frozen avatar radius/clearance and static authoritative geometry; no general physics engine or dynamic repository-derived code execution is introduced.
- Visual interpolation may smooth movement without changing the canonical path or fixed-step/equivalent replay state.
- A path that cannot reach the target interaction zone ends as `blocked` and never claims arrival.
- Camera-only Focus and operator-invoked Teleport may be offered as separately labeled fallbacks. Neither is automatic, and only physical entry into the interaction zone may produce `arrived`.

### 7. Attention, movement, arrival, interruption, and recovery truth

Expose these states independently: `requested target`, `semantic attention`, `path planned`, `moving`, `arrived`, `blocked`, `interrupted`, and `superseded`.

- Semantic attention may highlight immediately after acceptance.
- Physical arrival becomes true only inside the authoritative target interaction zone.
- Any direct operator movement or `Escape` interrupts agent-led camera/avatar motion immediately.
- A newer accepted batch supersedes queued work and cleanly cancels active work for the same controlled actor.
- Follow is opt-in and exits immediately on operator movement, `Escape`, cancel, capability loss, or invalid target state.
- Restart never silently resumes motion. Recovered active/queued state is labeled previous/recovered and requires explicit revalidation/replay.
- Current and previous/recovered state remain visually and semantically distinct.

### 8. Camera modes and comfort

- Third-person is the default traversal camera.
- First-person pointer lock is an explicit opt-in mode.
- Tour and Follow use wide, stable framing and never force camera roll.
- Photo mode is camera-only, bounded to the selected World/repository, and carries no movement or authority implication.
- Camera sensitivity, field of view, inversion, easing, and cosmetic motion are configurable within tested bounds.
- Reduced motion removes bob, sway, forced sweeping travel, and long eased camera transitions; it uses short fades or semantic step changes while preserving complete action/state truth.
- No-WebGL retains the same search, focus, action timeline, evidence, cancel, and replay semantics through the accessible DOM and labels semantic focus rather than pretending physical arrival.
- Mobile defaults to stable third-person/touch presentation rather than pointer lock.

### 9. Trace/compare evidence and limits

- A trace or compare action may present at most 256 objects and 512 edges.
- A confirmed path may contain at most 24 hops.
- Progressive LOD expansion is allowed only within those totals and the inherited Phase 10 limits.
- Current `exact_file` and `exact_workspace_package` relationships may be shown as confirmed when their refs and graph generation validate.
- Ambiguous, external, unresolved, unsupported, unavailable, stale, and truncated relationships remain separately labeled candidate/unavailable and never masquerade as confirmed route evidence.
- Every displayed relationship retains source/target refs, graph generation, confidence, and an accessible evidence/status link.
- Truncation reports shown-versus-total counts and the reason. Further expansion requires a new explicit bounded action.
- The renderer may reduce visual cosmetics or aggregate detail to meet performance budgets but may not remove confidence, truncation, evidence, or semantic-DOM truth.

### 10. Replay, persistence, retention, and Yjs boundary

- Hover, camera frames, interpolation samples, movement samples, and in-progress paths are ephemeral.
- Persist at most 200 validated high-level action envelopes/outcomes or seven days, whichever bound is reached first.
- Allow at most 32 operator-pinned actions until unpinned or the World project is deleted.
- Restart converts active/queued work to `interrupted/recovered`; nothing resumes automatically.
- Explicit replay revalidates capability, session, repository, target, World/layout revision, graph evidence, and current bounds before creating a new action/batch identity.
- Clear removes clearable local timeline entries and their presentation projections without deleting Hermes transcripts or repository evidence.
- Yjs may carry only bounded presentation projections such as focus, highlight, pin, annotation, presenter/follow, and stable object refs.
- Chat/transcripts, adapter-native IDs, raw action envelopes, canonical paths, movement samples, secrets, tool arguments/output, and repository/tool authority never enter Yjs.

### 11. Performance, LOD, planning, and memory budgets

All existing Phase 10 and Phase 11 contracts remain enforced independently. Phase 13 adds:

- desktop steady-state 120-frame main-thread render-work p95: at most 16.7 ms;
- desktop steady-state 120-frame raw `requestAnimationFrame` cadence p95: at most 16.8 ms;
- retain all 120 raw render-work samples and all 120 raw cadence samples in machine-readable evidence; neither series may be replaced by a selected passing run, synthetic value, clamp, or hidden normalization;
- mobile and two-CPU steady-state 120-frame p95: at most 33.3 ms;
- desktop longest main-thread task: at most 50 ms;
- mobile and two-CPU longest main-thread task: at most 100 ms;
- ready-navmesh path query at 10k full-detail scale: at most 50 ms;
- ready-navmesh path query at 100k aggregate LOD: at most 150 ms;
- incremental browser heap at 10k: at most 96 MiB;
- incremental browser heap at 100k aggregate LOD: at most 128 MiB;
- mobile uses the 96 MiB incremental heap ceiling;
- graph semantic DOM remains at or below the inherited 200-row ceiling;
- semantic avatar roster remains at or below 64 rows;
- visible action timeline renders at most 50 rows while the bounded persisted history may retain 200 entries;
- 100k mode materializes aggregate World/graph presentation plus at most one focused-detail area, never whole-repository symbol detail.

Two-CPU/mobile modes may reduce avatar count, shadows, animation, graph-edge cosmetics, antialiasing, and other nonsemantic effects. They may not remove actions, status/result controls, confidence/truncation labels, selected refs, cancellation, replay, accessibility, or semantic alternatives.

### 12. Acceptance evidence, private shipping, and cleanup

Phase 13 completion requires, except for the explicitly waived/deferred live item:

- focused RED→GREEN tests for each vertical behavior;
- strict protocol, batch, target, expiry, dedupe, sequence, rate, cancellation, and unknown-field tests;
- deterministic navmesh generation/path/replay fixtures, including blocked and revision-change behavior;
- Storybook states for every action state, capability degradation, camera mode, LOD state, and semantic fallback;
- Playwright desktop, mobile/touch, keyboard-only, pointer-lock entry/escape, reduced-motion, forced-colors, screen-reader, and no-WebGL journeys;
- inherited Phase 10/11 measurements plus Phase 13 desktop/mobile/two-CPU, 10k/100k, path-planning, Long Task, and heap evidence;
- retained screenshots and one short tour video with machine-readable metrics;
- one real connected-Hermes tour from `packages/spatial-code-graph` to `packages/renderer-r3f`, with Phase 12 chat still usable and personal operator approval of comfort and usefulness (**deferred under the final-attempt waiver**);
- one-way continuity evidence covering exact Discord-root attachment, runtime-proven root-to-effective compression continuation, ordered World chat, and a final World chat turn, without requiring same-route Discord return, a post-tour Discord turn, or gateway-restart continuity (**root/continuation resolution proved; ordered finals/tour deferred under the final-attempt waiver**);
- proof that World Actions do not mutate repository files/state, dispatch arbitrary tools/commands, approve work, launch processes, or cross into Phase 14 behavior;
- one integrated `pnpm check`, Storybook build, production audit, fresh-copy verification, and complete staged-diff inspection;
- private commit/push and successful exact-SHA CI only after the working local slice, all non-live acceptance, and the explicit live-gate waiver are recorded truthfully;
- verified reversible Hermes profile preview/backup/install/restore, followed by restoration of the original profile and removal of Phase 13 plugin/runtime state;
- cleanup of every World/API/Vite/Playwright/Storybook listener, tracked process, temporary fixture, and profile-change artifact not explicitly retained as evidence.

No routine broad audit or targeted re-audit is required. Audit only if first-hand testing exposes a concrete issue or the user explicitly requests one.

## In scope for the authorized implementation

- Strict `aiw.world-action/0.13` protocol, validation, bounded persistence, and capability-declared Hermes helper.
- Deterministic versioned navmesh, target resolver, path planner, interaction points, collision, blocked state, and explicit Focus/Teleport fallbacks.
- Third-person traversal, opt-in first-person pointer lock, click/search/minimap/touch/keyboard alternatives, Follow/Tour/Photo modes, and camera-comfort preferences.
- Agent locomotion/action controller and explicit attention/movement/arrival state machine.
- Trace/highlight/compare layer with the frozen rich-graph limits and evidence truth.
- Semantic action timeline, replay, pin, cancel, clear, and bounded restart recovery.
- Storybook, Playwright, performance, accessibility, first-hand tour, private exact-SHA CI, and cleanup evidence.

## Out of scope

- Any repository/file mutation from World Actions.
- Treating model prose, hidden reasoning, animation, or per-frame model output as action authority.
- Arbitrary tool dispatch, command execution, approval response, process launch, phase advancement, or Preview Manager behavior.
- Full physics, combat/game mechanics, procedural world generation, arbitrary durable layout mutation, or broad environment-art production.
- Phase 14 structured tool/edit/test/build/preview execution or Autonomous mutation envelope.
- Phase 15 voice/audio or hot-microphone work.
- Phase 16 simultaneous multi-agent editing, worktree coordination, or conflict resolution.
- Public hosting, internet ingress, unrelated-user multiplayer, cloud relay, deployment, release, tag, package publication, or repository visibility changes.
- Hermes core edits or original-AgentIntersect repository changes.

## Expected code and artifacts

- `world-action-protocol` leaf package and architecture-boundary tests.
- Navigation/navmesh package with deterministic fixtures and no app/adapter authority leakage.
- Browser user-control and camera systems with accessibility preferences.
- Agent locomotion/action controller and stable-object target resolver.
- Trace/highlight/compare layer and semantic action timeline.
- Capability-declared Hermes World Action helper contract.
- Storybook states and Playwright desktop/mobile/keyboard/reduced-motion/no-WebGL journeys.
- Bounded performance/accessibility measurements, screenshots, tour video, and a Phase 13 report.

These are expected future artifacts, not files authorized or created by this scope-freeze edit.

## Acceptance criteria

- The operator can traverse, escape, interrupt, recover, and use semantic alternatives without becoming trapped or disoriented.
- A connected agent can truthfully navigate to and present existing World objects through validated high-level action batches.
- Stable object/revision identity and graph confidence remain visible; stale, blocked, unavailable, candidate, and truncated outcomes remain explicit.
- Attention, requested target, path, movement, arrival, interruption, supersession, focus, and teleport never collapse into misleading success.
- Model prose, chat text, avatar motion, and per-frame output never become repository/tool authority.
- Movement and presentation meet the frozen desktop/mobile/two-CPU/10k/100k budgets with complete reduced-motion/no-WebGL/semantic equivalents.
- Repository content and execution state remain unchanged by navigation and presentation.
- The operator accepts the local navigation/control evidence; personal approval of a real two-area connected-agent tour remains deferred with the live continuation feature.
- The final parent live retry truthfully records FAIL after exact-root continuation resolution and before an assistant final, structured action, arrival, or final World chat. The feature remains deferred; the user's waiver permits Phase 13 closeout without representing this criterion as passed.

## Stop conditions

Stop and preserve evidence instead of improvising if:

- the selected adapter cannot propose structured actions without weakening Phase 12 session, transcript, approval, or tool ownership;
- targets cannot be bound to stable World identity and exact revision truth;
- deterministic navmesh/path behavior cannot be reproduced across supported environments;
- navigation requires repository mutation, arbitrary tool/command dispatch, shell/process authority, or Phase 14 behavior;
- accessibility or camera comfort would require removing the core journey instead of providing an equivalent;
- the selected rich trace/compare limits cannot meet the frozen performance budgets without removing semantic truth;
- prior Phase 10/11 contracts would need to be weakened;
- public ingress, release/publication, Hermes core changes, original-AgentIntersect modification, voice, preview execution, or multi-agent editing becomes necessary.

## Exit gate

Phase 13 is complete under the 2026-07-22 user waiver after the bounded local navigation/World Action slice works, complete local/fresh/browser/performance/accessibility gates are green, the intended diff is privately committed/pushed, exact-SHA CI succeeds, and all temporary profile/runtime/process state is cleaned up. The failed exact-root Discord → World continuation/tour remains explicitly deferred rather than green. Stop at the Phase 13 gate; Phase 14 remains a separate explicit authorization.

## Next action

1. Preserve this frozen scope as the authoritative implementation contract.
2. Launch one bounded Codex implementation worker under Node 24.18.0 and pnpm 11.15.0; preserve the parent-owned scope/status/design edits and prohibit commit/push, live-profile changes, releases, and Phase 14.
3. Independently inspect and verify the real artifacts, tests, browser behavior, performance, clean-environment behavior, and cleanup.
4. Perform live default-profile acceptance only through the post-turn reversible activation boundary, then restore the profile.
5. Privately commit/push and require exact-SHA CI only after every frozen Phase 13 gate is green.
