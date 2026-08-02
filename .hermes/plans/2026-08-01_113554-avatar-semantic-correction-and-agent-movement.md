# Avatar Semantic Correction and Agent Movement Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Correct every complete-avatar semantic mismatch, make movement/latest one-shot preempt older animation, and add bounded authoritative agent movement that supports user direction, AI-selected destinations, and future repository-object targets.

**Architecture:** Keep model-local clips and per-participant mixers, but replace structural-evidence-only semantic authority with explicit reviewed semantic decisions. Introduce actor-local animation arbitration so locomotion and newer one-shots supersede stale one-shots without stale completion callbacks reverting current state. Add agent movement through validated World movement intents and authoritative World-owned position state; user-directed movement outranks autonomous movement, while future repository objects resolve through stable object IDs rather than renderer coordinates.

**Tech Stack:** TypeScript, React, Three.js/R3F, Vitest, Playwright, Python/Blender evidence tooling, existing World action/event protocols.

---

## Authoritative Manual Findings

Aaron manually tested the 2026-08-01 candidate and reported:

- **PASS:** user avatar animation is active; Walk works correctly; Run works correctly.
- **FAIL:** Jump appears to use Angry rather than Jump.
- **FAIL:** `/dance` appears to use Turn rather than Dance.
- **FAIL:** `/laugh` appears to use Dance rather than Laugh.
- **TRUST BOUNDARY:** other semantic mappings may also be wrong. The prior 276/276 structural/evidence count is not semantic acceptance and every mapping must be reviewed.
- **REQUIRED PREEMPTION:** when an actor starts moving, that actor's prior slash/cue one-shot must stop immediately and locomotion must take over.
- **REQUIRED LATEST-WINS:** a second slash command must stop the first one-shot and immediately start the latest one.
- **NEW CAPABILITY:** agents must be able to move freely, follow user directions about where to go, choose their own movement through agent AI, and later move to specific repository objects once those objects exist.

The animation candidate is manual **FAIL** for semantic correctness and precedence. Do not start later phases or claim acceptance until the corrected candidate passes first-hand review.

## Frozen Precedence Rules

For each actor independently:

1. Safety/bounds/collision refusal outranks every movement request.
2. A new explicit user-directed agent destination cancels autonomous agent movement.
3. Actor locomotion cancels that actor's active one-shot immediately.
4. A new user slash command replaces the user's active one-shot immediately (latest valid command wins).
5. A new agent cue replaces that agent's active one-shot unless the agent is already moving; movement remains authoritative.
6. Stale animation-completion callbacks may not clear or alter a newer one-shot or locomotion state.
7. When locomotion stops, the actor returns to model-local Idle; a cancelled one-shot does not resume.
8. Unknown slash text remains ordinary chat; recognized local slash commands remain excluded from Hermes transport.

## Agent Movement Authority

- World owns authoritative actor position, heading, velocity, and movement state.
- Agent AI expresses a validated movement intent/action; it never mutates renderer transforms directly.
- Initial target forms:
  - bounded world coordinate;
  - bounded relative direction/distance;
  - follow/approach the user within a safe stopping radius.
- Future target form:
  - stable repository object ID resolved by World layout authority to a reachable approach point.
- Explicit user direction outranks autonomous movement.
- Autonomous movement is allowed only when no explicit movement command is active and must stay inside configured World bounds.
- Movement must drive model-local Walk/Run and cancel active gestures/cues for that same agent.
- Unreachable, stale, missing, or unsafe targets fail visibly and leave the prior authoritative position unchanged.

---

### Task 1: Freeze the manual REDs in tests and status

**Objective:** Make Aaron's observed Jump/Dance/Laugh mismatches and precedence failures executable regressions before changing mappings or runtime behavior.

**Files:**

- Modify: `apps/web/test/world-avatar-animation.test.ts`
- Modify: `packages/avatar-system/test/avatar-replacement-v2.test.ts`
- Modify: `packages/renderer-r3f/test/imported-avatar-renderer.test.tsx`
- Modify: `apps/web/e2e/imported-avatar-experiment.spec.ts`

**Steps:**

1. Recover the exact manually tested user model ID from persisted/browser evidence; do not assume it when unavailable.
2. Add failing semantic-resolution assertions for that model's Jump, Dance, and Laugh expected clip decisions.
3. Add a failing runtime test showing movement cancels an active user one-shot.
4. Add a failing runtime test showing a second recognized slash command replaces the first.
5. Add a failing stale-completion test: completion from the cancelled first action must not clear the replacement action.
6. Run only the focused tests and retain the expected RED output.

### Task 2: Replace structural-only semantic acceptance with reviewed authority

**Objective:** Audit and correct all 23 × 12 model-local mappings using explicit visual/temporal semantic decisions.

**Files:**

- Modify: `apps/web/public/assets/imported-avatars/manifest.json`
- Modify: `packages/avatar-system/src/imported-avatar-registry.generated.ts`
- Modify: `packages/avatar-system/src/imported-avatar.ts`
- Modify: `tooling/avatar/inspect_imported_avatars.py`
- Modify: `tooling/avatar/build_world_animation_evidence.py`
- Modify: `tooling/avatar/world_animation_evidence.test.ts`
- Create: `artifacts/avatar-replacement-evidence/world-animation-semantic-review-v2/semantic-review.json`

**Steps:**

1. Extend the evidence schema with per-model/per-semantic reviewer verdict: `pass`, `wrong_clip`, `ambiguous`, or `unsupported`.
2. Require reviewed expected clip index plus rationale/evidence refs for `pass`.
3. Refuse `wrong_clip`, `ambiguous`, and `unsupported` mappings at runtime until corrected.
4. Review every model's Idle/Walk/Run/Jump and eight gestures at multiple temporal positions; do not infer semantics from index, duration, hierarchy, or shared catalog order.
5. Correct Jump/Dance/Laugh first for the manually tested model, then review all remaining mappings.
6. Regenerate manifest and runtime registry deterministically.
7. Make `--check` fail when any mapping lacks semantic review or when generated/runtime decisions diverge.
8. Rerun focused tests until Jump, Dance, Laugh, and the full semantic-review contract are GREEN.

### Task 3: Implement actor-local animation arbitration

**Objective:** Make locomotion and latest commands cancel stale one-shots deterministically.

**Files:**

- Modify: `apps/web/src/world-entry/WorldRoom.tsx`
- Modify: `apps/web/src/world-entry/world-chat-model.ts`
- Modify: `apps/web/src/world-entry/world-navigation-model.ts`
- Modify: `packages/renderer-r3f/src/imported-avatar-canvas.tsx`
- Modify: `packages/renderer-r3f/src/world-room-imported-canvas.tsx`
- Test: `apps/web/test/world-avatar-animation.test.ts`
- Test: `apps/web/test/world-entry-ui.test.tsx`
- Test: `packages/renderer-r3f/test/imported-avatar-renderer.test.tsx`

**Steps:**

1. Represent each active one-shot with a monotonically increasing actor-local token/generation.
2. On user locomotion start, clear the active user one-shot before selecting Walk/Run.
3. On agent locomotion start, clear the active agent one-shot before selecting Walk/Run.
4. On a new valid slash command, replace the user one-shot and increment its token; do not reject re-entry merely because another one-shot is active.
5. On a new valid agent cue while stationary, replace the agent one-shot and increment its token.
6. Pass the token through completion callbacks; ignore completion from any superseded token.
7. Preserve reduced-motion truthful completion and explicit mapping/loading failure states.
8. Prove with tests: move-cancels-one-shot, latest-slash-wins, latest-agent-cue-wins-while-stationary, stale-completion-no-op, stop-movement-to-Idle, and cancelled action does not resume.

### Task 4: Define and test agent movement intent contracts

**Objective:** Create a browser-safe validated protocol for directed and autonomous agent movement before renderer integration.

**Files:**

- Modify: `packages/world-action-protocol/src/index.ts` or the existing action schema module that owns World movement actions
- Modify: `packages/world-event-protocol/src/index.ts` or the existing event schema module that owns actor movement events
- Modify: relevant protocol tests under `packages/world-action-protocol/test/` and `packages/world-event-protocol/test/`
- Modify: `apps/web/src/world-entry/world-chat-model.ts`
- Test: `apps/web/test/world-chat-model.test.ts`

**Steps:**

1. Add versioned movement intents for coordinate, relative direction/distance, follow/approach user, and future stable object reference.
2. Validate finite coordinates, bounded distances/speeds, actor identity, request source, and optional stopping radius.
3. Add explicit states/events: requested, accepted, moving, arrived, cancelled, refused, and target-stale.
4. Keep repository-object resolution optional and fail closed until stable object IDs/layout anchors exist.
5. Define precedence metadata: `user-directed` outranks `agent-autonomous`; a newer same-or-higher-priority request cancels the older one.
6. Add parser/projection tests for user directions without allowing free-form text to mutate position directly.

### Task 5: Implement authoritative agent movement state

**Objective:** Move agents through World-owned state while driving their model-local locomotion.

**Files:**

- Modify: `apps/web/src/world-entry/WorldRoom.tsx`
- Create or modify: an actor movement model under `apps/web/src/world-entry/`
- Modify: `packages/renderer-r3f/src/world-room-imported-canvas.tsx`
- Modify: `packages/renderer-r3f/src/imported-avatar-canvas.tsx`
- Test: `apps/web/test/world-avatar-animation.test.ts`
- Test: `packages/renderer-r3f/test/imported-avatar-renderer.test.tsx`

**Steps:**

1. Add authoritative per-agent destination, heading, speed, and movement-source state.
2. Integrate position using bounded elapsed time; clamp to World bounds and safe stopping radius.
3. Select agent Walk or Run from actual authoritative velocity; select Idle on arrival/cancellation.
4. Cancel the agent's active cue/gesture when movement begins.
5. Emit arrived/refused/cancelled truth without pretending arrival from renderer-only interpolation.
6. Add directed-follow and coordinate movement tests, including cancellation and latest-request precedence.

### Task 6: Connect agent AI autonomy safely

**Objective:** Allow agent AI to choose movement without bypassing World action validation or user priority.

**Files:**

- Modify: existing World action projection/execution code under `apps/local-server/src/` and `apps/web/src/world-entry/`
- Modify: relevant local-server action tests
- Modify: `apps/web/test/phase13-world-action-lifecycle.test.ts`

**Steps:**

1. Expose movement as a bounded World action available to the selected agent session.
2. Validate and project movement through existing action authority; never parse arbitrary assistant prose as coordinates without a validated action envelope.
3. Suspend/cancel autonomous movement when the user issues an explicit destination.
4. Permit a new autonomous request only after explicit movement completes/cancels or policy releases priority.
5. Record movement source and target in observability without private transcript or filesystem data.
6. Prove user-directed priority, safe refusal, cancellation, arrival, and autonomous resume behavior.

### Task 7: Add future repository-object targeting seam

**Objective:** Prepare movement-to-repository-object behavior without inventing object IDs before repository landscapes exist.

**Files:**

- Modify: `packages/spatial-code-graph/` schema or adapter only where stable rendered object IDs are already authoritative
- Modify: World movement target resolver under `apps/web/src/world-entry/`
- Add focused resolver tests

**Steps:**

1. Define target input as stable repository object ID, never display text or renderer index.
2. Resolve the object through current authoritative layout generation to a bounded approach point.
3. Refuse missing, stale-generation, hidden, or unreachable objects.
4. Do not implement placeholder object movement if stable IDs/approach points are not yet present; retain a tested `target-stale`/unsupported boundary.

### Task 8: Full visual and manual acceptance

**Objective:** Prove semantic correctness, preemption, and agent movement in a matching production candidate.

**Files:**

- Modify: `apps/web/e2e/imported-avatar-experiment.spec.ts`
- Modify: `tooling/avatar/world_animation_evidence.test.ts`
- Update: `PROJECT_STATUS.md`
- Update: `docs/AVATAR_REPLACEMENT_MODULAR_ANIMATION_SCOPE.md`

**Steps:**

1. Run deterministic intake/evidence checks and focused semantic/arbitration/movement tests.
2. Run full Node 24 typecheck, architecture, lint, functional suite excluding only the separately paused Phase 18.5 validator, production build, and production-static Playwright.
3. Review every semantic mapping from the semantic-review artifact; preserve explicit unsupported/refused decisions.
4. Launch a fresh owner-checked isolated candidate on disposable ports.
5. First-hand test the corrected Jump, Dance, Laugh, all remaining slash gestures, movement cancellation, latest-slash replacement, directed agent movement, autonomous agent movement, arrival/Idle, and agent cue cancellation on movement.
6. Record Aaron's exact PASS/FAIL and clean candidate resources safely.
7. Stop before commit, push, PR, merge, release, publication, Phase 18.5, or Phases 19–20 unless separately authorized.

## Likely Files to Change

- `apps/web/src/world-entry/WorldRoom.tsx`
- `apps/web/src/world-entry/world-chat-model.ts`
- `apps/web/src/world-entry/world-navigation-model.ts`
- `apps/web/src/world-entry/world-imported-avatar.ts`
- `apps/web/test/world-avatar-animation.test.ts`
- `apps/web/test/world-chat-model.test.ts`
- `apps/web/e2e/imported-avatar-experiment.spec.ts`
- `packages/avatar-system/src/imported-avatar.ts`
- `packages/avatar-system/src/imported-avatar-registry.generated.ts`
- `packages/avatar-system/test/avatar-replacement-v2.test.ts`
- `packages/renderer-r3f/src/imported-avatar-canvas.tsx`
- `packages/renderer-r3f/src/world-room-imported-canvas.tsx`
- `packages/renderer-r3f/test/imported-avatar-renderer.test.tsx`
- `packages/world-action-protocol/`
- `packages/world-event-protocol/`
- `tooling/avatar/build_world_animation_evidence.py`
- `tooling/avatar/world_animation_evidence.test.ts`
- `apps/web/public/assets/imported-avatars/manifest.json`

## Verification Commands

Use Node 24 and current pinned pnpm:

```bash
. "$HOME/.nvm/nvm.sh"
nvm use 24
corepack pnpm@11.15.0 exec vitest run <focused-files> --maxWorkers=1 --no-file-parallelism
python3 tooling/avatar/inspect_imported_avatars.py --check --skip-source-check
python3 tooling/avatar/build_world_animation_evidence.py --check
corepack pnpm@11.15.0 typecheck
corepack pnpm@11.15.0 check:architecture
corepack pnpm@11.15.0 lint
corepack pnpm@11.15.0 exec vitest run --exclude tooling/scripts/phase18-5-performance-evidence.test.ts --maxWorkers=1 --no-file-parallelism
corepack pnpm@11.15.0 build
xvfb-run -a corepack pnpm@11.15.0 exec playwright test apps/web/e2e/imported-avatar-experiment.spec.ts --config=playwright.production-static.config.ts --workers=1
git diff --check
git lfs fsck
```

## Risks and Open Decisions

- The manually tested avatar's exact model ID must be recovered at session start; do not patch `user-male-02` solely by assumption.
- Some GLBs may not contain a truthful clip for every requested semantic. Honest `EVIDENCE_REFUSED` is preferable to a mislabeled substitute.
- Full 276-mapping review is large but necessary because temporal motion alone did not prove semantic meaning.
- Agent autonomous movement should begin with bounded validated destinations, not unconstrained renderer wandering.
- Explicit user direction must always outrank autonomous movement.
- Repository-object targeting must wait for stable object IDs and authoritative approach points; do not bind to transient mesh indices.
- At plan freeze, implementation was unstaged/uncommitted and manual FAIL; the
  dated outcomes below supersede that delivery state while preserving the manual
  semantic failure as the reason ambiguous gestures remain fail closed.

## Worker implementation outcome — 2026-08-01

- Tasks 1–2 reached the safest evidence boundary: the tested model ID was not
  recoverable, the review artifact covers all 276 decisions, 69 locomotion
  mappings pass, and 207 gesture mappings are ambiguous and runtime-refused.
- Tasks 3–7 are implemented with focused GREEN coverage: actor-local animation
  generations, validated World-owned directed/autonomous movement, explicit
  priority and cancellation, bounded integration, truthful lifecycle events,
  and a stable-ID repository resolver seam that fails closed when stale.
- Task 8 technical automation is green, including deterministic checks, focused
  and full Vitest, typecheck, architecture, lint, build, production-static
  Playwright, diff, and LFS gates. Browser outputs were redirected to the
  external worker run directory. Parent/manual candidate work remains undone.
- Final worker verdict: `PARTIAL_SAFE_PAUSE`. The exact blocker is the absence of
  authoritative visual evidence that distinguishes the remaining 207 anonymous
  gesture clips. Aaron has not accepted the result, and no delivery or later
  phase action is authorized.

## Parent correction outcome — 2026-08-01

- Added the missing normal-product command projection for exact local `/agent
move <x> <z>`, `/agent move <direction> <distance>`, `/agent follow [radius]`,
  and `/agent stop` input. Valid movement uses the existing validated proposal
  route with the selected session actor and `user-directed` source; stop uses
  the existing bounded interrupt route. Recognized invalid input is a visible
  local refusal, and unknown slash/ordinary input remains chat.
- RED: `world-avatar-animation.test.ts` ran 10 tests with 2 expected parser
  failures (`undefined` versus `function`); `world-agent-direction.test.ts`
  failed before collection because the direction module did not exist.
  GREEN: the correction-focused set passes 6 files / 57 tests.
- The production-static spec now contains a mounted movement journey that
  exercises route-delivered autonomy, HUD user direction, proposal body and
  chat exclusion, rAF position change, cue/locomotion state, arrival lifecycle,
  unsafe-coordinate refusal, interrupt, and Idle. The rebuilt suite lists all
  4 journeys but could not execute in this restricted worker sandbox because
  Chromium launch failed with `sandbox_host_linux.cc:41` / `Operation not
permitted`.
- Deterministic checks (23 models / 276 decisions), lint, typecheck 38/38,
  architecture checker + 11/11 tests, focused tests, and build 20/20 are green.
  The mandated architecture wrapper and full suite also encountered sandbox
  `EPERM` for IPC, loopback listeners, and child processes; the full suite
  recorded 116 passing files / 705 passing tests and 33 environment-denied
  failures in 9 files.
- Correction verdict: movement `PARTIAL_SAFE_PAUSE` pending parent execution of
  the full and mounted-browser gates in the supported environment. Gesture
  semantics remain separately `PARTIAL_SAFE_PAUSE` with 69 reviewed locomotion
  passes and 207 ambiguous gestures fail closed. Aaron has not accepted this
  work.

## Parent closeout and private-delivery outcome — 2026-08-01

- Parent execution in the supported environment passed Python 15/15, the real
  loopback Chromium annotation viewer 1/1, required Vitest 4 files / 30 tests,
  functional Vitest 125 files / 738 tests excluding only the separately paused
  Phase 18.5 fingerprint validator, TypeScript 38/38, architecture 11/11, build
  20/20, ESLint, targeted Prettier, deterministic 23/23 GLB checks, Git LFS
  `fsck`, diff hygiene, and durable-text safety.
- Semantic authority remains intentionally fail closed: 69 locomotion decisions
  pass and 207 gesture decisions remain ambiguous. A deterministic 23-batch,
  417-raw-clip human-review plan was generated without reviewer answers or
  authority mutation; the template remains 0/207.
- Aaron separately authorized a private commit and push. That authorization does
  not constitute first-hand acceptance, Phase 18.5 resumption, evidence rebinding,
  merge, tag, release, publication, deployment, public visibility, or Phases
  19–20 work.
- The checkpoint is expected to retain the known strict Phase 18.5 CI RED until
  that phase is separately resumed and remeasured or a separately approved CI
  policy change moves the unchanged strict validator to an explicit manual lane.
  Exact-SHA CI outcomes are recorded externally after push.
