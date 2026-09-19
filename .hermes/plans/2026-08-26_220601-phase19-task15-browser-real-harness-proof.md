# Phase 19 Task 15 Browser Acceptance and Real-Harness Proof Plan

> **For Mr Fluff:** Aaron authorized direct end-to-end Task 15 implementation and concrete corrections on 2026-08-26, selected every recommended choice (`1A` through `15A`), prohibited Codex orchestration/delegated coding unless he explicitly changes that instruction, and set an absolute 2.5-hour work window. If the cutoff or a new decision/human-owned gate is reached, safety-pause and run `prep end session` rather than asking Aaron mid-run.

**Goal:** Prove the complete Phase 19 Multi Agent experience through one deterministic production-browser acceptance lane and one receipt-owned real-harness lane using Hermes, OpenClaw, Codex, and Claude Code, without changing protected profiles/providers/services or claiming unapproved Dig semantics.

**Architecture:** Keep product authority in the existing Agent Session Gateway, constellation service, grouped-message service, repository-work-focus projection, World entry machine, and VoiceService. Add one consolidated deterministic Playwright journey around the existing fixture contracts, then run a separately isolated production-bundle/local-server candidate against real local harnesses. Hermes attaches non-destructively to its exact operator-persistent identity; OpenClaw, Codex, and Claude Code receive fresh World-owned identities inside one receipt-owned World and must be ended through the product before owner-checked candidate cleanup.

**Tech Stack:** Node `v24.18.0`, pnpm `11.15.0`, TypeScript 6, Fastify 5, React 19, Vite 8, Playwright 1.61, Vitest 4, the existing `aiw.constellation/0.19` and Agent Session contracts, local Whisper from accepted Task 14, Windows Edge for Aaron’s first-hand lane, and external sanitized JSON/Markdown receipts under `~/.hermes/runs/`.

---

## 1. Implementation authority and hard stop

Aaron authorized **Task 15 implementation end to end, including direct concrete corrections**, on 2026-08-26. All fifteen recommended defaults in this plan are selected as `1A 2A 3A 4A 5A 6A 7A 8A 9A 10A 11A 12A 13A 14A 15A`. Work began at `2026-08-26T22:26:46-04:00`; the absolute cutoff is `2026-08-27T00:56:46-04:00`.

This implementation authorization permits:

- direct test and production implementation required by Task 15;
- receipt-owned deterministic browser proof;
- harmless real native-session attachment/creation, two-turn continuity, refresh/recovery, and exact World-owned teardown under the selected identity/isolation contract;
- same-SHA loopback candidate launch and non-human readiness checks;
- one causal RED and the smallest direct correction for each concrete Task 15 defect;
- owner-checked cleanup and truthful project-status updates.

It still does **not** authorize:

- automation of Aaron's first-hand Edge interactions or verdict;
- Hermes/OpenClaw/Codex/Claude profile, provider, model, account, credential, configuration, or service mutation;
- package installation or dependency changes;
- staging, commit, push, PR, merge, tag, release, deployment, publication, package publication, public ingress, or repository visibility change;
- Task 16+, Phase 20, original-AgentIntersect work, or a Dig animation mapping.

At the cutoff or the first genuinely new decision/manual-acceptance gate, stop safely, clean owned resources, preserve evidence, and run the complete `prep end session` workflow without asking Aaron another question.

### 2026-08-26 direct implementation outcome — SAFE PAUSED

Deterministic Task 15 composition is green, including the consolidated four-agent production-browser journey, Task 12 desktop/mobile/no-WebGL companions, Task 14 voice companion, `109/109` impacted tests, and `41/41` Phase 16 conformance. Fresh Codex `0.149.1` and Claude Code `2.1.228` two-turn/reattach/teardown/later-World lifecycles passed. Two concrete compatibility defects were corrected through direct RED→GREEN: Codex's stale `0.147.0` version pin and OpenClaw `sessions.create` omitting an explicit unique World-owned key.

Task 15 is **not complete or user-accepted**. The corrected real OpenClaw path now creates and attaches, but its first harmless turn reaches the live protected gateway and emits provider-fallback exhaustion plus `chat:error`; changing provider/model/configuration is outside all selected A defaults. The exact current Hermes two-turn proof requires a post-turn boundary because this implementation turn is running inside that same operator-persistent session. Combined four-agent real proof, explicit complete teardown rotation, and Aaron's Edge verdict remain pending. Parent report: `/home/user/.hermes/runs/aiw-phase19-task15-20260826T222646-0400/task15-parent-report.md`.

## 2. Re-attested baseline

Planning preflight at `2026-08-26T22:06:01-04:00` established:

- repository: private `MelaBuilt-AI/AgentIntersect-World`;
- worktree: `/home/user/.hermes/runs/aiw-repository-city-next-feature/worktree`;
- branch: `feature/phase19-multi-agent-constellation`;
- local HEAD: `78c150f2d56f9de187f34fd89e0638fe9731c101`;
- upstream: exact same SHA;
- raw remote branch: exact same SHA;
- GitHub API branch ref: exact same SHA;
- pre-plan worktree/staging/untracked state: clean;
- repository visibility: private;
- final Task 14 workflow `32974243577`: `completed/success` on the exact SHA;
- current check-runs: 7/7 `completed/success` (`core`, `measurements`, `e2e-unflagged`, and flagged shards 1–4);
- Git LFS `fsck`: green;
- Git LFS push dry-run: empty;
- no Playwright, Xvfb, Vite, Whisper, FFmpeg, Task 14, or Phase 19 Task 14 process remained;
- candidate ports `43770`, `45173`, `45271`, and `45282`: clear;
- protected Hermes remained PID `615` on loopback `8642`;
- protected OpenClaw remained PID `617` on loopback/IPv6 `18789`.

The plan file intentionally becomes the sole untracked project path after that clean preflight.

## 3. Current implementation anchors

Task 15 should compose accepted behavior rather than redesign it.

### Canonical Phase 19 authority

- `.hermes/plans/2026-08-11_211034-phase19-multi-agent-constellation.md:717-755` defines Task 15’s deterministic and real-harness journeys.
- `AGENTS.md:99-110` defines the four-adapter, lifecycle, privacy, normal-World, and Phase 16 boundaries.
- `PROJECT_STATUS.md:5-50` records Tasks 13–14 as user-accepted and Task 15+ as closed before this planning authorization.
- `AgentIntersect_WorldDD.md:2996+` and `docs/WORLD_ENTRY_EXPERIENCE.md:287+` preserve the product and acceptance contracts.

### Existing browser and unit proof to reuse

- `apps/web/e2e/phase19-world-push-to-talk.spec.ts` owns deterministic Task 14 voice behavior.
- `apps/web/e2e/phase19-task12-two-agent-coding.spec.ts` owns structured repository focus, independent movement, retargeting, receipt generation, mobile/reduced-motion, and no-WebGL proof.
- `apps/web/test/phase19-task13-recovery.test.ts` owns accepted active-World restoration and retained-stale behavior.
- `apps/web/test/world-entry-multi-agent-machine.test.ts` owns the Multi Agent reducer/entry state contract.
- `apps/web/test/phase19-multi-agent-chat.test.tsx` owns grouped-message browser projection.
- `apps/local-server/test/phase19-constellation-*.test.ts` owns bounded roster and grouped lifecycle truth.
- `apps/local-server/test/phase19-*-session-adapter.test.ts` and `phase19-adapter-conformance.test.ts` own the four adapter contracts.
- `tooling/scripts/playwright-global-teardown.ts` is Phase 17-specific and must not be broadened into a generic destructive cleanup hook.

### Existing production authority to leave structurally unchanged unless a real defect is proven

- `apps/local-server/src/agent-sessions.ts`
- `apps/local-server/src/agent-session-routes.ts`
- `apps/local-server/src/constellation-service.ts`
- `apps/local-server/src/constellation-routes.ts`
- `apps/local-server/src/constellation-message-service.ts`
- `apps/local-server/src/openclaw-session-adapter.ts`
- `apps/local-server/src/codex-session-adapter.ts`
- `apps/local-server/src/claude-code-session-adapter.ts`
- `apps/local-server/src/repository-work-focus.ts`
- `apps/web/src/world-entry/WorldEntryExperience.tsx`
- `apps/web/src/world-entry/world-entry-machine.ts`
- `apps/web/src/world-entry/agent-work-focus-model.ts`
- `apps/web/src/voice/WorldPushToTalk.tsx`

## 4. Frozen recommended Task 15 scope

The following defaults make the plan implementation-ready. Aaron may override them before implementation authorization by referencing the review question number and choice.

### 4.1 Exact real-harness identities and state isolation

1. **Hermes/Mr Fluff:** attach only to the exact currently selected operator-persistent Hermes root/session resolved immediately before candidate creation. Never create, clone, end, restart, or rewrite the Hermes identity.
2. **OpenClaw, Codex, Claude Code:** create fresh World-owned native identities for one new receipt-owned World. Record sanitized hashes plus opaque World/session IDs in restricted receipts; do not expose native paths, tokens, prompts, executable arguments, or credentials in browser output or retained evidence.
3. Use one external run root:

   ```text
   /home/user/.hermes/runs/aiw-phase19-task15-<YYYYMMDDTHHMMSS-0400>/
   ```

4. Put disposable AgentIntersect World state, Codex runtime home, Claude runtime home, candidate logs, browser profile, screenshots, videos, and receipts under that run root or a separately owner-tagged child root recorded in `candidate-owner.json`.
5. Reference existing credentials/configuration read-only through the already supported environment contract. Never copy secret values into the run root or receipt.
6. Hash and record protected configuration files and protected process identities before the candidate, then compare them after cleanup. Do not edit or signal them.

### 4.2 Frontend/backend pairing

1. Build the production web bundle and local server from the exact same re-attested commit.
2. Start one loopback-only local-server candidate and one same-origin production-web server with strict ports selected from a fresh, recorded range.
3. Record source SHA, build hashes, command arguments with secrets redacted, environment-key names (not values), PIDs/start times, listeners, state roots, and browser-profile ownership in `candidate-owner.json`.
4. Require direct backend health, frontend health, proxied health, safe config, four adapter readiness rows, and candidate-to-protected-service reachability before opening Edge.
5. Never pair a Vite development frontend with a production backend for the authoritative real-harness verdict.

### 4.3 Operator-owned and automated browser split

1. Use Playwright with deterministic route fixtures for the complete reproducible browser matrix.
2. Use a fresh Windows Edge InPrivate/disposable-profile lane for Aaron’s first-hand real-harness verdict.
3. Keep browser automation out of Aaron’s manual interaction after setup. Automation may prepare, inspect, and close the receipt-owned candidate, but Aaron owns the criterion-level user verdict.
4. Require exactly one intended Edge app target, no blocking native sync modal, an enabled native main window, zero product console/page errors, and no unexpected failed requests before handoff.

### 4.4 Real-harness sequence

Run one harness at a time before the combined World:

1. Hermes attach → first text turn → refresh/reconnect → second text turn; confirm exact native continuity and no World-owned teardown authority.
2. OpenClaw create → first text turn → refresh/reconnect → second text turn → explicit World end → later-World fresh native identity.
3. Codex create → first text turn → refresh/reconnect → second text turn → explicit World end → later-World fresh native identity.
4. Claude Code create → first text turn → refresh/reconnect → second text turn → explicit World end → later-World fresh native identity.
5. Build a final four-agent World using the exact Hermes identity and three fresh World-owned identities.
6. Prove broadcast, avatar target, exact `@name`, repository work focus for Codex and Claude, refresh/recovery, bounded push-to-talk, stale/unavailable truth, explicit World end, and later-World fresh World-owned identities.

A fixture-only pass cannot complete Task 15.

### 4.5 Operator-owned manual steps

Aaron’s first-hand lane should require only these interactions:

1. confirm the normal entry screen and select Multi Agent;
2. attach/connect each named agent and accept its explicit avatar;
3. enter World with all four agents;
4. send one typed broadcast and one selected-agent message;
5. issue two harmless bounded coding requests, one to Codex and one to Claude, against different files in the disposable repository;
6. refresh at the specified same-World checkpoint and confirm continuity;
7. perform one real-microphone broadcast and one real-microphone selected-agent send through local Whisper, editing at least one final caption;
8. verify the accepted Work/static presentation and exact repository-object movement without any Dig claim;
9. explicitly end the World;
10. confirm the next World receives new OpenClaw/Codex/Claude native identities while Hermes remains available.

Detailed Task 14 device-loss/cancel acceptance is not repeated; Task 15 reuses its accepted receipt and performs only the minimum combined real-microphone proof.

### 4.6 Refresh, recovery, and teardown criteria

1. **Browser refresh:** after all four agents are current and before teardown, a direct refresh must restore the same World, exact four-member roster, accepted avatars, exact native bindings, and prior grouped transcript without setup loops or duplication.
2. **Candidate backend restart:** after a completed grouped turn, restart only the receipt-owned AgentIntersect World candidate against the same checksummed state root and exact build. The same active World and session identities must recover through current/previous truth.
3. **Stale recovery:** a deterministic fixture lane must show one retained stale member blocking entry until exact reconnect or explicit non-destructive removal. The real lane must not intentionally corrupt or kill a live external service to manufacture staleness.
4. **Unavailable truth:** a separate disposable candidate may deliberately omit only one adapter prerequisite before startup; that adapter must remain visibly unavailable while healthy peers remain truthful. Do not alter protected configuration or credentials.
5. **World end:** explicit product-owned World end must terminate only OpenClaw/Codex/Claude World-owned sessions. Hermes remains available outside World.
6. **Later World:** a newly created World must receive three new World-owned native IDs and must not silently reuse ended identities.
7. **Cleanup:** owner-check every candidate PID, process start time, listener, browser profile, state root, and volatile audio/runtime directory before removing or signalling it. Never broad-kill by process name.

### 4.7 Work/static versus Dig boundary

Task 12’s accepted behavior remains authoritative:

- use only real structured repository/tool/work evidence;
- resolve the most specific current Repository City object;
- prove safe generation-bound movement and truthful arrival;
- show accepted `Work` or static coding presentation;
- do **not** claim, infer, map, loop, or visually accept a Dig animation in Task 15;
- keep a separate explicit model/clip review gate if Aaron later wants a real Dig semantic.

The older canonical Task 15 prose that says “Dig” is therefore interpreted as the accepted truthful coding-presentation boundary: exact object focus/movement plus Work/static fallback unless a separate Dig review is approved.

### 4.8 Cleanup receipts and evidence privacy

Retain these external artifacts:

```text
<run-root>/preflight.json
<run-root>/protected-state-before.json
<run-root>/candidate-owner.json
<run-root>/deterministic-browser-receipt.json
<run-root>/real-harness-hermes.json
<run-root>/real-harness-openclaw.json
<run-root>/real-harness-codex.json
<run-root>/real-harness-claude-code.json
<run-root>/combined-world-receipt.json
<run-root>/manual-acceptance-checklist.md
<run-root>/manual-acceptance-verdict.json
<run-root>/cleanup-receipt.json
<run-root>/protected-state-after.json
<run-root>/task15-parent-report.md
<run-root>/screenshots/
<run-root>/videos/
```

Receipts may retain:

- opaque World, roster, and World-session IDs;
- hashes of native IDs instead of raw native IDs when the raw value is not needed for exact comparison;
- adapter IDs, lifecycle states, revision/correlation IDs, timestamps, test outcomes, route/status summaries, screenshot/video paths, PID/start-time/listener ownership, file hashes, and cleanup results.

Receipts must not retain:

- credentials, tokens, API keys, recovery codes, provider secrets, cookies, authorization headers, raw protected configuration, absolute native session paths, executable arguments containing private data, raw prompts beyond the harmless acceptance phrases, private reasoning, unrestricted tool payloads, raw microphone audio, or full native transcripts.

Volatile audio and disposable runtime homes are removed after their required hash/emptiness checks. Sanitized acceptance receipts, screenshots/video, and immutable failure evidence remain.

## 5. Files planned for Task 15 implementation

### Required test artifact

- Create: `apps/web/e2e/world-entry-multi-agent.spec.ts`

Keep Task 15-specific deterministic fixtures in this file unless implementation proves a second consumer. Do not create a generic test framework preemptively.

### Existing tests to invoke, not duplicate

- `apps/web/e2e/phase19-task12-two-agent-coding.spec.ts`
- `apps/web/e2e/phase19-world-push-to-talk.spec.ts`
- `apps/web/test/phase19-task13-recovery.test.ts`
- `apps/web/test/world-entry-multi-agent-machine.test.ts`
- `apps/web/test/phase19-multi-agent-chat.test.tsx`
- `apps/local-server/test/phase19-constellation-service.test.ts`
- `apps/local-server/test/phase19-constellation-api.test.ts`
- `apps/local-server/test/phase19-constellation-message-service.test.ts`
- `apps/local-server/test/phase19-constellation-message-api.test.ts`
- `apps/local-server/test/phase19-adapter-conformance.test.ts`
- `apps/local-server/test/phase19-openclaw-session-adapter.test.ts`
- `apps/local-server/test/phase19-codex-session-adapter.test.ts`
- `apps/local-server/test/phase19-claude-code-session-adapter.test.ts`

### Status artifacts after a successful first-hand verdict only

- Modify: `.hermes/plans/2026-08-11_211034-phase19-multi-agent-constellation.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `AGENTS.md`
- Modify: `AgentIntersect_WorldDD.md`
- Modify: `docs/WORLD_ENTRY_EXPERIENCE.md`

Do not update those files merely because automated proof is green. The user’s criterion-level verdict is the acceptance gate.

### Production files

No production file is pre-authorized by this plan. If deterministic or real proof exposes a concrete product defect:

1. freeze the failing receipt and exact candidate state;
2. stop and owner-clean the failed candidate;
3. identify the smallest affected production/test paths;
4. require explicit Task 15 implementation/correction authority if it was not already granted;
5. add one causal RED, make the smallest direct correction, rerun the affected proof, and return to the fresh acceptance lane;
6. do not launch a broad review or hardening pass.

## 6. Step-by-step implementation plan

### Task 15.1 — Re-attest implementation authority and exact baseline

**Objective:** Begin implementation only from the approved exact private branch and an explicitly authorized Task 15 scope.

**Files:** No project file changes.

**Steps:**

1. Re-read this plan, `AGENTS.md`, canonical Phase 19 Task 15, and the latest handoff.
2. Verify branch, HEAD, upstream, raw remote, GitHub ref, privacy, Git status, LFS, current exact-SHA CI, Node/pnpm versions, protected process identities, and candidate ports.
3. Require this planning artifact to be the only inherited untracked path unless Aaron explicitly authorizes a different boundary.
4. Create the receipt-owned external run root and `preflight.json`; do not create sessions or start services yet.
5. Stop if the branch, SHA, privacy, protected identities, or worktree boundary differs unexpectedly.

### Task 15.2 — Write the consolidated deterministic Playwright RED

**Objective:** Make the canonical complete Multi Agent journey fail as one missing Task 15 composition proof before adding fixture behavior.

**Files:**

- Create: `apps/web/e2e/world-entry-multi-agent.spec.ts`

**RED cases:**

1. first complete agent does not enable entry;
2. second complete agent enables entry;
3. third/fourth may be added; fifth and exact duplicate binding are refused;
4. all four accepted avatars render without persistent admin chrome;
5. broadcast completes out of order but rows remain roster ordered;
6. avatar and exact `@name` each target one recipient and reset to broadcast;
7. Codex and Claude receive independent structured work focus for different exact repository objects;
8. retarget clears prior Work/static state, moves safely, and resumes only after new arrival;
9. Task 14 voice fixture performs one broadcast and one selected-agent send through the same grouped route with no speech playback;
10. direct refresh restores the same active World and exact bindings;
11. one retained stale agent blocks entry until reconnect/remove;
12. explicit World end preserves Hermes and rotates all three World-owned identities in the next World;
13. keyboard, reduced motion, forced colors, no-WebGL, desktop, and mobile remain contained;
14. internal Workbench/dashboard remains absent without its explicit developer gate;
15. browser issues, unexpected fixture routes, duplicate requests, and secret/private-path canaries remain zero.

**RED command:**

```bash
TURBO_CONCURRENCY=1 corepack pnpm@11.15.0 exec playwright test \
  apps/web/e2e/world-entry-multi-agent.spec.ts \
  --config playwright.config.ts \
  --workers=1
```

Expected before fixture completion: the new file fails on the first missing Task 15 fixture/composition assertion, not on syntax, browser startup, or an unrelated existing test.

### Task 15.3 — Complete the deterministic fixture with direct existing contracts

**Objective:** Turn the consolidated journey green without creating a second product implementation or generic fixture framework.

**File:**

- Modify: `apps/web/e2e/world-entry-multi-agent.spec.ts`

**Fixture rules:**

1. Use strict route matching and fail every unexpected route.
2. Model exactly four canonical adapters and distinct native-root hashes.
3. Keep Hermes `operator-persistent`; keep three peers `world-owned`.
4. Persist current/previous constellation state across page reload.
5. Complete grouped rows deliberately out of order while retaining stable roster order.
6. Reuse the accepted repository object, work-focus, movement, voice, and receipt shapes from existing Task 12/14 tests; do not import production-private data.
7. Use Work/static, not Dig.
8. Record every transition and acceptance check in `AIW_PHASE19_TASK15_EVIDENCE_DIR`.
9. Capture screenshots for setup, four-agent World, grouped rows, exact target, two work focuses, retarget, voice caption, stale block, desktop/mobile, and no-WebGL.
10. Assert zero console errors, page errors, request failures, unexpected fixture routes, duplicate group dispatches, speech playback, raw-audio fields, and privacy canaries.

**GREEN command:** repeat the single-file command. Expected: all new Task 15 tests pass and a structured deterministic receipt is written.

### Task 15.4 — Run the impacted deterministic matrix

**Objective:** Prove the new consolidated test agrees with accepted Task 12–14 and adapter contracts.

**Commands:**

```bash
TURBO_CONCURRENCY=1 corepack pnpm@11.15.0 build:packages

AIW_PHASE19_TASK12_EVIDENCE_DIR="$RUN_ROOT/task12" \
TURBO_CONCURRENCY=1 \
xvfb-run -a corepack pnpm@11.15.0 exec playwright test \
  apps/web/e2e/world-entry-multi-agent.spec.ts \
  apps/web/e2e/phase19-task12-two-agent-coding.spec.ts \
  apps/web/e2e/phase19-world-push-to-talk.spec.ts \
  --config playwright.config.ts \
  --workers=1

TURBO_CONCURRENCY=1 corepack pnpm@11.15.0 exec vitest run \
  apps/web/test/world-entry-multi-agent-machine.test.ts \
  apps/web/test/phase19-task13-recovery.test.ts \
  apps/web/test/phase19-multi-agent-chat.test.tsx \
  apps/web/test/phase19-task12-repository-work-focus.test.ts \
  apps/web/test/phase19-world-voice-input.test.tsx \
  apps/local-server/test/phase19-constellation-service.test.ts \
  apps/local-server/test/phase19-constellation-api.test.ts \
  apps/local-server/test/phase19-constellation-message-service.test.ts \
  apps/local-server/test/phase19-constellation-message-api.test.ts \
  apps/local-server/test/phase19-adapter-conformance.test.ts \
  apps/local-server/test/phase19-openclaw-session-adapter.test.ts \
  apps/local-server/test/phase19-codex-session-adapter.test.ts \
  apps/local-server/test/phase19-claude-code-session-adapter.test.ts \
  --maxWorkers=1 \
  --no-file-parallelism

TURBO_CONCURRENCY=1 corepack pnpm@11.15.0 --filter @agentintersect-world/web typecheck
TURBO_CONCURRENCY=1 corepack pnpm@11.15.0 --filter @agentintersect-world/local-server typecheck
corepack pnpm@11.15.0 exec prettier --check apps/web/e2e/world-entry-multi-agent.spec.ts
git diff --check
```

Task 15 does not automatically run Task 16’s complete `check:core`, all flagged/unflagged shards, fresh-copy, private delivery, or exact-SHA CI matrix.

### Task 15.5 — Prepare the receipt-owned production candidate

**Objective:** Launch one exact-build same-origin loopback candidate without mutating protected harness state.

**Files:** External run-root receipts only.

**Steps:**

1. Record `protected-state-before.json` with hashes/metadata only.
2. Build packages, local server, and the flagged production web bundle from the exact candidate SHA.
3. Resolve the exact Hermes session immediately before startup without creating or changing it.
4. Allocate unused loopback backend/frontend ports and record them before launch.
5. Start the local server with:
   - fresh `AIW_AGENT_SESSION_DATA_DIR` under the run root;
   - existing loopback Hermes endpoint and exact resolved session reference;
   - existing loopback OpenClaw endpoint through a credential reference only;
   - existing Codex executable plus fresh native-session/runtime root under the run root;
   - existing Claude executable plus fresh native-session/runtime root under the run root;
   - strict same-origin host/origin values;
   - no provider/profile/config write.
6. Start the exact production web bundle on the paired same-origin frontend.
7. Verify health/readiness/config/capabilities, exact PID/listener ownership, one app target, enabled native window, and zero browser issues.
8. Exercise an owner-checking no-op closeout against a separate proof generation before handing the candidate to Aaron.

### Task 15.6 — Prove each real harness independently

**Objective:** Satisfy the real local lifecycle contract one harness at a time.

For each harness receipt, record criterion-level booleans rather than raw transcript bodies:

- exact identity created/attached as intended;
- first harmless text turn completed;
- same active World survived refresh/reconnect with the same native identity hash;
- second harmless text turn completed on that identity;
- status/history/event projections remained bounded and sanitized;
- unavailable behavior was truthful where deliberately tested;
- OpenClaw/Codex/Claude explicit end completed and a later World used a new identity hash;
- Hermes remained available and was never ended;
- no profile/provider/account/configuration mutation occurred;
- no unexpected child process/listener/state residue remained.

Use harmless prompts only, for example:

- first turn: `Reply exactly: TASK15 <adapter> TURN1`
- second turn: `Reply exactly: TASK15 <adapter> TURN2 SAME SESSION`

Do not ask the harness to inspect credentials, profiles, protected repositories, or unrelated user data.

### Task 15.7 — Run the combined four-agent first-hand journey

**Objective:** Obtain Aaron’s criterion-level verdict for the complete production-boundary composition.

**Combined checklist:**

1. all four exact agents connect with explicit avatars;
2. one agent alone cannot enter; two complete agents can; all retained agents must be current/avatar-complete;
3. all four avatars render without overlap or admin chrome;
4. one typed broadcast returns stable roster-ordered independent results;
5. avatar click and exact `@name` each reach one intended agent and reset to broadcast;
6. Codex and Claude perform harmless bounded edits/checks in different sections of the disposable repository;
7. both move to exact structured-evidence Repository City objects and show truthful Work/static state only after arrival;
8. one retarget clears old state, moves safely, and resumes Work/static only at the new object;
9. one real microphone broadcast and one selected-agent microphone send use local Whisper and editable final captions;
10. typed chat remains available and no agent reply is spoken;
11. direct refresh restores the same World, roster, avatars, transcript, and native bindings;
12. desktop and 390×844 containment, keyboard, reduced motion, forced colors, and no-WebGL truth remain accessible through the deterministic companion lane;
13. internal Workbench/dashboard remains absent;
14. explicit World end terminates only the three World-owned identities;
15. a later World has three new World-owned identity hashes while Hermes remains available.

Aaron’s response should be captured verbatim in `manual-acceptance-verdict.json`, then normalized into the 15 criterion booleans without inventing unreported passes.

### Task 15.8 — Owner-checked closeout

**Objective:** Remove only disposable Task 15 state and prove protected services/configuration are unchanged.

**Steps:**

1. Freeze success/failure evidence before cleanup.
2. Verify the candidate receipt, PID, start time, executable, working directory, listener, state root, browser profile, and runtime homes match the owner record.
3. End the active World through product authority if not already ended.
4. Stop only exact candidate frontend/backend/browser/helper processes.
5. Wait for candidate ports to close.
6. Confirm no Codex/Claude/Whisper/FFmpeg/Playwright/Xvfb child remains for this run root.
7. Verify volatile audio is empty and remove disposable runtime homes/state/profile only after evidence capture.
8. Re-hash/re-attest protected files, Hermes/OpenClaw PIDs/start times/listeners, and absence of configuration/provider/profile mutations.
9. Write `cleanup-receipt.json`, `protected-state-after.json`, and `task15-parent-report.md`.
10. Retain sanitized receipts and visual evidence; retain failed immutable state only when needed for diagnosis, with an owner record and no active process.

### Task 15.9 — Record acceptance and stop

**Objective:** Update project continuity only after Aaron’s complete first-hand verdict.

**Files:**

- Modify: `.hermes/plans/2026-08-11_211034-phase19-multi-agent-constellation.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `AGENTS.md`
- Modify: `AgentIntersect_WorldDD.md`
- Modify: `docs/WORLD_ENTRY_EXPERIENCE.md`

**Steps:**

1. If any required criterion fails or is untested, record Task 15 as failed/incomplete with the exact boundary; do not claim acceptance.
2. If all required criteria pass, record Task 15 as user-accepted and Task 16+ as closed.
3. Preserve the Work/static decision and separate Dig review gate.
4. Run focused Prettier and `git diff --check`.
5. Stop. Do not start Task 16, commit, push, PR, merge, CI delivery, release, publication, deployment, tag, public ingress, or visibility work without separate authorization.

## 7. Decision-review questions and choices

These questions are listed for Aaron’s review and do not pause this planning turn. The recommended choice is the default frozen into Sections 4–6 unless Aaron overrides it before implementation.

### Question 1 — Which native identities should the real lane use?

- **A — Recommended/default:** exact existing operator-persistent Hermes identity plus fresh World-owned OpenClaw/Codex/Claude identities.
- **B:** fresh identities for all four, requiring a separate disposable Hermes profile/session lane.
- **C:** reuse existing native identities for all four.
- **D:** fixture identities only, which cannot complete Task 15.

### Question 2 — How should candidate state be isolated?

- **A — Recommended/default:** fresh receipt-owned World state, Codex/Claude runtime homes, browser profile, and volatile audio roots; read-only references to existing credentials/configuration.
- **B:** temporary edits to active profiles/configuration followed by restoration.
- **C:** use ambient default state roots directly.
- **D:** provision four separate virtual machines/containers.

### Question 3 — What frontend/backend pairing is authoritative?

- **A — Recommended/default:** exact same-SHA production web bundle plus production local server, same-origin and loopback-only.
- **B:** Vite development frontend plus production backend.
- **C:** static fixture frontend plus production backend.
- **D:** a deployed or LAN/public candidate.

### Question 4 — Who owns browser interaction?

- **A — Recommended/default:** Playwright owns deterministic coverage; Aaron owns the fresh Edge real-harness verdict.
- **B:** Aaron performs every deterministic and real criterion manually.
- **C:** automate all interaction and infer acceptance without a user verdict.
- **D:** use headed Chromium only and omit Windows Edge.

### Question 5 — In what order should real harnesses be exercised?

- **A — Recommended/default:** one harness at a time through two-turn continuity/lifecycle, then one combined four-agent World.
- **B:** combined four-agent World first, then isolate failures.
- **C:** launch all four independent lanes concurrently.
- **D:** reuse prior receipts without fresh Task 15 real turns.

### Question 6 — What real prompts/tasks are permitted?

- **A — Recommended/default:** two harmless exact-reply lifecycle prompts per harness, then bounded disposable-repository tasks for Codex and Claude.
- **B:** allow productive changes in the AgentIntersect World worktree.
- **C:** text-only prompts with no real repository/tool activity.
- **D:** unrestricted agent-directed tasks.

### Question 7 — Which repository should back coding embodiment?

- **A — Recommended/default:** a fresh disposable repository under the Task 15 run root with two distinct, non-sensitive files/sections and no remote.
- **B:** the active AgentIntersect World feature worktree.
- **C:** a separate existing private user repository.
- **D:** a browser fixture only, with no real tool/work evidence.

### Question 8 — What animation truth should Task 15 claim for coding?

- **A — Recommended/default:** preserve Task 12’s accepted Work/static fallback; prove exact structured focus, movement, arrival, retarget, and terminal clearing without claiming Dig.
- **B:** perform a separate operator review and approve one real Dig clip before Task 15 implementation.
- **C:** map the most plausible anonymous clip automatically.
- **D:** omit coding embodiment from Task 15.

### Question 9 — How much refresh/recovery proof is required?

- **A — Recommended/default:** direct browser refresh plus restart of only the receipt-owned local-server candidate against the same checksummed state root.
- **B:** direct browser refresh only.
- **C:** candidate backend restart only.
- **D:** no refresh/restart proof; rely on Task 13 receipts.

### Question 10 — How should stale/unavailable behavior be tested?

- **A — Recommended/default:** deterministic stale-member browser lane plus a separate disposable startup with one prerequisite omitted; never stop or corrupt a protected service.
- **B:** stop a real protected harness service to manufacture unavailability.
- **C:** provide deliberately wrong real credentials.
- **D:** omit stale/unavailable proof.

### Question 11 — What teardown authority is acceptable?

- **A — Recommended/default:** explicit product World end for OpenClaw/Codex/Claude, technical proof that Hermes remains, then owner-checked candidate cleanup.
- **B:** skip product teardown and rely only on the cleanup script.
- **C:** kill all matching harness processes by name.
- **D:** retain all native sessions and candidate services after the verdict.

### Question 12 — How much real microphone behavior should Task 15 repeat?

- **A — Recommended/default:** one combined real broadcast and one selected-agent real send; reuse Task 14’s accepted cancel/device-loss/privacy receipt for the detailed voice matrix.
- **B:** repeat the complete Task 14 1–9 manual checklist inside Task 15.
- **C:** use synthetic microphone input only.
- **D:** typed chat only; omit combined voice proof.

### Question 13 — What evidence may be retained?

- **A — Recommended/default:** sanitized structured receipts, screenshots/video, identity hashes, bounded status/events, owner/cleanup metadata, and no raw audio/secrets/private reasoning.
- **B:** retain full raw native logs and transcripts.
- **C:** retain screenshots only.
- **D:** retain no evidence after cleanup.

### Question 14 — What happens if real proof exposes a product defect?

- **A — Recommended/default:** freeze evidence, owner-clean the candidate, add one causal RED and smallest direct fix within separately authorized Task 15 implementation, rerun only affected proof, then present a fresh candidate.
- **B:** stop permanently and create only a defect report.
- **C:** launch a broad audit/refactor before reproducing the failure.
- **D:** treat the failure as test flakiness and continue acceptance.

### Question 15 — Where does Task 15 stop?

- **A — Recommended/default:** stop after deterministic proof, real-harness receipts, Aaron’s criterion-level verdict, cleanup, and truthful status update; Task 16 and delivery remain separate gates.
- **B:** automatically continue into Task 16’s complete verification matrix.
- **C:** automatically commit/push and run exact-SHA CI after a pass.
- **D:** continue through Phase 20 acceptance/hardening.

## 8. Risks and direct mitigations

| Risk                                              | Direct mitigation                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Real lane mutates protected Hermes/OpenClaw state | Hash/identity preflight and postflight; no config/profile writes; candidate-owned state roots; exact-owner cleanup. |
| World end closes Hermes                           | Hermes stays `operator-persistent`; explicit technical assertion before and after teardown.                         |
| Ended World-owned identity is reused              | Hash exact native identities; require new IDs in a later World.                                                     |
| Fixture success masks real adapter behavior       | Fresh one-harness-at-a-time two-turn lifecycle receipts plus combined real World.                                   |
| Combined lane is too hard to diagnose             | Complete isolated harness receipts first and keep one serial candidate timeline.                                    |
| Browser uses mismatched code                      | Same exact SHA for local server and production web bundle; record build hashes.                                     |
| Native Edge modal blocks interaction invisibly    | Enumerate CDP/native windows; require one enabled app target before handoff.                                        |
| Evidence leaks secrets or raw audio               | Structured allowlist receipts, redaction checks, no raw request/tool/audio retention.                               |
| Coding animation overclaims Dig                   | Preserve Work/static fallback and separate Dig review gate.                                                         |
| Stale test harms a real service                   | Use deterministic stale fixture and omitted-prerequisite disposable startup only.                                   |
| Cleanup kills unrelated processes                 | Owner receipt with PID/start-time/executable/cwd/listener/root checks; never broad-kill.                            |
| Task 15 expands into implementation/delivery      | Planning-only now; separate implementation gate; stop before Task 16 and Git delivery.                              |

## 9. Task 15 definition of done

Task 15 is complete only when all of the following are true:

- the deterministic consolidated production-browser journey passes;
- accepted Task 12–14 companion tests remain green;
- Hermes, OpenClaw, Codex, and Claude Code each complete fresh real two-turn continuity proof;
- exact Hermes operator-persistent identity is not created, ended, or rewritten;
- OpenClaw/Codex/Claude World-owned identities survive same-World refresh/recovery, end explicitly, and are not reused in a later World;
- one combined four-agent broadcast and exact target path pass;
- two real structured repository tasks resolve to different exact current objects with independent movement/arrival/retarget and Work/static truth;
- one combined real-microphone broadcast and selected-agent send use local Whisper and the typed/grouped route;
- direct browser refresh and receipt-owned backend restart preserve exact same-World state;
- stale/unavailable truth is proven without mutating a protected service;
- desktop/mobile/keyboard/reduced-motion/forced-colors/no-WebGL and internal-surface absence are proven through the deterministic companion lane;
- no raw audio, secret, credential, private reasoning, unrestricted tool payload, or native path leaks into browser/evidence;
- owner-checked cleanup closes all candidate listeners/processes and preserves protected identities/configuration;
- Aaron returns a criterion-level first-hand verdict covering every required manual item;
- project status is updated truthfully only after that verdict;
- Task 16+, Phase 20, Git delivery, release/publication, deployment, public ingress, and visibility changes remain closed.

## 10. Execution handoff

Plan complete. Do not execute it from planning authorization alone.

The next required gate is an explicit instruction equivalent to:

> Authorize Task 15 implementation using the recommended defaults in the Task 15 plan, with any numbered choice overrides stated explicitly.

After Task 15 implementation and acceptance, stop for a separate Task 16 and/or private-delivery decision.
