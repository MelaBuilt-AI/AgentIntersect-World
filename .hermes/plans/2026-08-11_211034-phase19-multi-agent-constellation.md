# Phase 19 Multi-Agent Constellation and Harness Breadth Implementation Plan

> **For Hermes:** Aaron authorized Phase 19 on 2026-08-11. Tasks 1–12 are parent-accepted under Node 24, and Task 13 — recovery, migration, lifecycle teardown, and Phase 16 non-regression — is **USER-ACCEPTED 2026-08-24** after a focused retained-avatar hydration correction, direct parent verification, fresh production-browser proof, and an 8/8 receipt-owned Edge pass. Phase 19 remains **AUTHORIZED / IN PROGRESS — TASK 14 AND LATER CLOSED**. Task 12's exact independent repository-object work focus passed fresh production headed and non-headed parent acceptance; no Dig mapping was operator-approved, so truthful Work/static coding fallback remains accepted. The three corrective source/test files and five canonical status/governance files form the exact private acceptance-milestone commit candidate authorized by Aaron on 2026-08-24; its final SHA and CI receipt remain external, non-recursive delivery evidence. This commit/push authorization does not imply a PR or merge, protected-service mutation, provider/profile/configuration changes, Task 14+, release, publication, deployment, tags, public ingress, or visibility changes. Final immutable commit/run evidence belongs in an external handoff after separately authorized delivery.

**Goal:** Extend the accepted Phase 18 single-agent World entry into a bounded four-agent constellation with production-bound Hermes, OpenClaw, Codex, and Claude Code sessions; explicit per-agent avatars; truthful lifecycle/readiness; concurrent broadcast chat; repository-object coding movement with a verified Dig animation; completed in-World push-to-talk input; and no normal-product Workbench exposure.

**Architecture:** Keep the existing Agent Session Gateway as the native-session authority, but distinguish Mr Fluff’s persistent Hermes continuity from World-owned OpenClaw/Codex/Claude sessions that are created by AgentIntersect for one active World and ended with it. Add a durable bounded constellation projection, route grouped broadcast/targeted turns through a restart-safe server service, project structured repository work focus into existing repository-object movement plus a visually verified Dig loop, and integrate the accepted Phase 15 local STT path into the normal World HUD after all four text adapters pass. Preserve Phase 16’s exactly-two-agent coding/worktree protocol unchanged; constellation membership and chat routing do not broaden execution authority.

**Tech stack:** Node 24, TypeScript 6, Fastify, React 19, Vite, R3F, Zod 4, Vitest, Playwright, existing checksum/current-previous stores, and existing local Agent Session Gateway protocols.

---

## 1. Authorization and baseline

### Current authorization

Aaron authorized **Phase 19 implementation** on 2026-08-11. Tasks 1–12 passed independent parent verification under Node `v24.18.0`, and Task 13 is user-accepted after direct parent verification, the focused retained-avatar hydration correction, fresh production-browser proof, and Aaron's 8/8 Edge pass on 2026-08-24. The stable four-slot registry, independently sanitized readiness/capability truth, deterministic four-adapter conformance matrix, direct World-owned gateway/API lifecycle, production wiring, narrow strict safe-config alignment, harmless production attestation, durable constellation service/routes, bounded ordered-entry reducer/client, visible four-agent constellation/rendering, durable grouped broadcast/exact-targeting, exact repository-object work focus, and recovery/migration/lifecycle slices are complete at the current accepted checkpoint. **Task 14 and later remain closed. Aaron authorized the exact eight-path private Task 13 acceptance-milestone commit/push on 2026-08-24; the final SHA and CI receipt remain external. PR/merge, release, publication, deployment, tag, public ingress, and visibility changes remain separately closed.** Task 8 changed only:

- `.hermes/plans/2026-08-11_211034-phase19-multi-agent-constellation.md` as this first-edit scope record;
- `apps/local-server/src/constellation-service.ts`;
- `apps/local-server/src/constellation-routes.ts`;
- `apps/local-server/test/phase19-constellation-service.test.ts`;
- `apps/local-server/test/phase19-constellation-api.test.ts`;
- `apps/local-server/src/server.ts`;
- `apps/local-server/src/index.ts`.

Task 8 does not authorize:

- Hermes, OpenClaw, or Codex adapter redesign;
- browser/UI/rendering, message routing, broadcast, voice-provider, animation, Repository City, or asset implementation;
- package installation or dependency changes;
- Hermes/OpenClaw/provider/profile/account/external configuration changes;
- starting/stopping protected services or creating/sending/ending real protected harness sessions;
- commit, push, PR, merge, tag, release, deployment, publication, or visibility change;
- destructive cleanup of retained Phase 18 evidence/worktrees;
- Phase 20 work;
- normal-product Workbench/dashboard exposure;
- a generic arbitrary-command executor.

### Verified inherited baseline

- Repository: private `MelaBuilt-AI/AgentIntersect-World`.
- Worktree: `/home/mela_ai/.hermes/runs/aiw-repository-city-next-feature/worktree`.
- Branch: `feature/phase19-multi-agent-constellation`.
- HEAD/upstream: `f4b23b31a131580e1ddd9fb10274919be434bf68`.
- Worktree was clean and `git diff --check` passed during planning.
- Phase 18 exact-SHA hosted CI workflow `31533828456` is 7/7 green.
- Installed local prerequisites observed at implementation start: Hermes Agent `0.20.0`, OpenClaw `2026.7.1`, Codex CLI `0.147.0`, Claude Code `2.1.228`. Presence/version is not authentication or Phase 19 adapter acceptance.
- jCodeMunch resolves this worktree as `local/worktree-dfec65e4`; native file reads are authoritative because its recorded index timestamp predates the final Phase 18 commit.

## 2. Frozen Phase 19 decisions

### Decision 1 — bounded constellation

- Maximum connected roster size: **four agents**.
- Harness endpoints are reusable selectors, not one-use slots.
- Multiple agents may use the same harness when each resolves to a distinct native session.
- Reject only an exact duplicate `{adapterId, nativeRootSessionRef}` binding.
- Preserve stable connection order as the roster order used by keyboard navigation, avatar spawn order, grouped broadcast rows, and recovery presentation.

### Decision 2 — all four harnesses are real Phase 19 scope

- Hermes, OpenClaw, Codex, and Claude Code must each be production-bound and first-hand locally tested for real attach/create, text turn, bounded streaming/final result, status, and lifecycle-correct recovery/teardown behavior.
- This deliberately supersedes the older Phase 19 cutline that allowed Codex/Claude to remain unavailable when no existing adapter was present.
- Adapter implementation may expand as needed, but Phase 19 must not silently install a runtime, log into an account, alter provider settings, edit protected profiles, write external configuration, or retain secrets.
- A missing or unauthenticated prerequisite blocks that harness’s acceptance. It must remain grey with a concise reason until the operator separately supplies the prerequisite.
- OpenClaw, Codex, and Claude Code use the AgentIntersect harness connection path directly; they do not receive or require Hermes’s Discord-to-World continuity.
- Entered names for OpenClaw/Codex/Claude are World display identities; they never substitute for a real native session binding.

### Decision 3 — concurrent grouped broadcast

- An unaddressed Multi Agent message targets the roster snapshot captured at submit time.
- Dispatch turns concurrently across distinct native sessions.
- Preserve strict serialization inside each individual native session.
- Persist one broadcast group with stable roster-ordered recipient rows.
- Each row independently moves through `queued`, `streaming`, and one terminal state: `completed`, `unavailable`, `failed`, `cancelled`, or `interrupted`.
- A failed recipient does not cancel or erase successful peers.
- The group is terminal only when every intended recipient is terminal.
- Reload/restart never blindly re-dispatches an ambiguous in-flight recipient.
- Avatar selection or an exact `@name` targets one agent.

### Decision 4 — stale recovery blocks entry

- A stale/unavailable restored agent remains visibly present in the constellation.
- `Enter World` remains blocked until that entry is explicitly reconnected or removed.
- Explicit removal detaches only the World roster/avatar association. It does not delete the native harness identity, native transcript/history, account, profile, or external files.
- No agent is silently dropped during restore.

### Decision 5 — harness sessions have two explicit lifecycles

- Mr Fluff’s Hermes binding may attach to the existing persistent native identity/session and Discord-to-World path that also serves Hermes outside World.
- OpenClaw, Codex, and Claude Code sessions are `world-owned`: AgentIntersect creates them through each harness adapter for the active World instance, and an explicit World end closes them.
- A browser refresh or reconnect to the same still-active World may recover a World-owned session; leaving/ending that World is the terminal lifecycle boundary.
- A later World never silently reuses an ended OpenClaw/Codex/Claude native session. It creates a new World-owned native session.
- World teardown does not shut down the installed harness/runtime itself and never changes its account, provider, model, or external configuration.
- Local acceptance uses the reported environment as-is: Claude Code in WSL is powered by the user’s local Ollama model, while Codex in WSL uses GPT-5.6.

### Decision 6 — truthful repository coding embodiment

- When structured adapter/tool evidence proves that an agent is actively coding a specific repository section, World resolves that section to the most specific current repository-city object (symbol, then file, directory, or package fallback).
- The agent moves through the existing `repository-object` movement path to a safe visible approach point for that exact object and layout generation.
- Only after truthful arrival and active coding evidence coincide does the avatar enter a looping `Dig` semantic, visually representing “coding here.”
- Dig stops when coding completes/fails/cancels, the work focus changes, the target becomes stale, or the agent leaves the approach area.
- Unresolved, stale, or blocked targets remain visible and recoverable; completion, failure, cancellation, and retargeting clear Dig deterministically, and different agents retain independent movement/animation state.
- Movement and animation are presentation driven by execution evidence; neither grants tool or repository authority.
- Dig must be mapped and first-hand visually approved for every supported imported agent model. An unverified/missing Dig mapping falls back truthfully to the existing generic `Work` presentation rather than guessing a clip.

### Decision 7 — complete push-to-talk input after the four text adapters

- Voice work starts only after Hermes, OpenClaw, Codex, and Claude Code pass real text/session acceptance.
- Phase 19 integrates the accepted Phase 15 local microphone → bounded WAV → local Whisper transcription → editable final caption path into the normal World HUD.
- Accepted voice text uses exactly the same immutable broadcast or single-agent targeting path as typed text.
- One utterance is transcribed once; broadcast fans out the accepted text, never duplicate audio.
- Phase 19 does **not** synthesize or play agent speech in the normal World. Agent TTS/speech is deferred.
- No hot microphone, background listening, automatic send, or ambiguous in-flight replay is added.
- Typed chat remains available throughout voice availability, capture, transcription, cancellation, and failure states.

## 3. Preserved product and authority invariants

1. Entry remains connect one agent → immediately create/restore that exact agent’s avatar → return to constellation → repeat.
2. One complete agent never unlocks Multi Agent entry; at least two agents must be connected/current-or-recovered and every retained roster entry must be avatar-complete.
3. The user may add a third or fourth agent before entry.
4. The normal World retains only the bottom-center chat field and adjacent push-to-talk control as persistent HUD.
5. Unaddressed chat broadcasts; avatar click or exact `@name` targets one agent for the next message, then targeting returns to broadcast unless explicitly selected again.
6. Unknown or ambiguous `@name` sends nothing and asks for a corrected target.
7. Recipient presentation and the actual immutable delivery set must match.
8. Phase 16’s `aiw.coordination/0.16` model remains exactly two agents/two worktrees. Do not generalize `mr-fluff`/`beans`, `COORDINATION_LIMITS.agents`, merge/conflict authority, or worktree orchestration in Phase 19.
9. A constellation agent can chat and be embodied without receiving coding/worktree authority.
10. The Workbench/dashboard remains developer-query/flag-gated, unlinked, and absent from normal navigation.
11. No public/LAN account system, unrelated user, cloud room, public ingress, generic shell, or arbitrary command surface is added.
12. Hermes persistence is not copied onto the other three harnesses: OpenClaw/Codex/Claude sessions belong to one active World and end explicitly with it.
13. Repository navigation and Dig presentation follow exact structured work evidence and current repository object generations; prose alone cannot move an avatar or claim coding.
14. Voice input reuses text routing after final transcript acceptance; raw audio is never sent to an agent adapter or duplicated per broadcast recipient.
15. Agent speech/TTS is out of Phase 19 normal-World scope even though historical Phase 15 browser playback code remains available internally.

## 4. Current implementation seams

### Reuse

- `apps/local-server/src/agent-sessions.ts`
  - `AgentAdapter`, `AdapterRegistry`, `AgentSessionStore`, `AgentSessionGateway`.
  - Existing strict current/previous checksum storage and per-session event/history projection.
  - Existing `HermesSessionAdapter` is the reference deep adapter.
- `packages/agent-session-protocol/src/index.ts`
  - Capability, session, event, binding, and avatar proposal contracts.
- `apps/web/src/sessions/session-client.ts`
  - Capability/session/status/attach/history/avatar/SSE client.
- `apps/web/src/world-entry/world-entry-machine.ts`
  - Explicit Phase 18 entry state machine and truthful readiness guards.
- `apps/web/src/world-entry/world-entry-client.ts`
  - Hermes resolution, session attach/recovery, avatar consent, and repository loading.
- `apps/web/src/world-entry/WorldEntryExperience.tsx`, `WorldEntryLogo.tsx`, `WorldHud.tsx`, and `world-chat-model.ts`
  - Accepted normal-product composition, transcript, chat queue, and internal-surface boundary.
- `packages/renderer-r3f` and `apps/web/src/world-entry/WorldRoom.tsx`
  - Accepted user/agent avatar rendering, movement, repository city, and click/pointer seams.
- `apps/web/src/world-entry/world-agent-movement-model.ts` and `packages/world-action-protocol`
  - Accepted generation-bound `repository-object` movement, safe approach-point resolution, and presentation-only World actions.
- `packages/avatar-system/src/index.ts`, imported-avatar manifests/review receipts, and `packages/renderer-r3f/src/imported-avatar-animation.ts`
  - Existing `coding` activity, generic `Work` projection, semantic clip evidence, in-place clip normalization, and crossfades. `Dig` is not yet an accepted runtime semantic.
- `packages/voice`, `apps/local-server/src/voice-service.ts`, `apps/local-server/src/voice-routes.ts`, and `apps/web/src/voice`
  - Accepted Phase 15 local Whisper STT, bounded browser capture, final transcript review/cancel/send, consent/recovery, and historical browser TTS. The normal World does not yet consume these controls.
- Phase 16 services/tests
  - Reuse as a separate optional two-agent coding authority; do not make it the roster store.

### Hard-coded Phase 18 constraints to remove carefully

- `WORLD_ENTRY_MACHINE_VERSION = "phase18"` and a single `selectedHarness: "hermes"`, `connection`, `agentAvatar`, and `agentName`.
- `WorldEntrySessionPort` and `WorldEntryClient` expose `connectHermes`/`restoreHermes` and reject chat unless `session.adapterId === "hermes"`.
- Production startup creates only `HermesSessionAdapter` and registers only that adapter.
- Config contains only Hermes session settings.
- `SessionHistory.transcriptAuthority` is typed as literal `"hermes"` in the web client.
- `WorldEntryExperience` stores one session, proposal, avatar, movement request, chat stream, and session pointer.
- `WorldHud` labels every assistant response `Mr Fluff`.
- Renderer entry accepts one agent avatar and uses one agent spawn/movement/animation channel.
- `WorldHud` renders a push-to-talk button, but `WorldEntryExperience` hard-codes `pushToTalkAvailable={false}` and provides no voice handlers.
- Phase 15 voice is exposed through the internal dashboard’s ten-step journey rather than the normal minimal World HUD.
- Agent `coding` currently projects to generic `Work`; imported avatar semantic review receipts do not include an approved looping `Dig` semantic.

## 5. Proposed Phase 19 contracts

### 5.1 Shared IDs

Use exact adapter IDs:

```ts
export const PHASE19_ADAPTER_IDS = [
  "hermes",
  "openclaw",
  "codex",
  "claude-code",
] as const;
export type Phase19AdapterId = (typeof PHASE19_ADAPTER_IDS)[number];
```

A roster binding key is derived from `{adapterId, nativeRootSessionRef}`. Display names are presentation fields and cannot establish identity.

### 5.2 Constellation projection

Add Zod-backed contracts in `packages/agent-session-protocol/src/index.ts` (or a focused adjacent file exported by that package):

```ts
type ConstellationAgent = {
  rosterId: string;
  adapterId: Phase19AdapterId;
  sessionOwnership: "operator-persistent" | "world-owned";
  worldSessionId: string;
  worldInstanceId: string;
  nativeRootSessionRef: string;
  displayName: string;
  continuity: "current" | "previous-recovered" | "stale" | "unavailable";
  connection: "connecting" | "connected" | "stale" | "unavailable";
  avatar: {
    status: "missing" | "editing" | "accepted";
    profileId: string | null;
    sessionId: string | null;
  };
  addedOrder: number;
};

type ConstellationProjection = {
  schema: "aiw.constellation/0.19";
  mode: "multi-agent";
  worldInstanceId: string;
  lifecycle: "assembling" | "active" | "ending" | "ended";
  revision: number;
  agents: readonly ConstellationAgent[]; // min 0, max 4
  entryReady: boolean; // derived, never accepted from clients
  truth: "current" | "previous-recovered";
};
```

The server derives `entryReady`; it rejects duplicate adapter/native bindings and fifth-agent additions. `operator-persistent` is valid only for the explicit Hermes continuity path. OpenClaw, Codex, and Claude Code bindings must be `world-owned`, bound to the exact active `worldInstanceId`, and closed idempotently when that World ends.

### 5.3 Message group

```ts
type ConstellationMessageGroup = {
  schema: "aiw.constellation-message/0.19";
  groupId: string;
  requestId: string;
  correlationId: string;
  text: string;
  target: { kind: "broadcast" } | { kind: "agent"; rosterId: string };
  recipientRosterIds: readonly string[];
  recipients: readonly {
    rosterId: string;
    worldSessionId: string;
    state:
      | "queued"
      | "streaming"
      | "completed"
      | "unavailable"
      | "failed"
      | "cancelled"
      | "interrupted";
    finalText: string | null;
    errorLabel: string | null;
  }[];
  createdAt: string;
  updatedAt: string;
};
```

Persist the group before dispatch. Idempotent replay returns the existing group; a request/correlation mismatch fails closed. On restart, unresolved rows become `interrupted` unless the adapter can prove the exact turn result without resend.

### 5.4 Repository work-focus projection

```ts
type AgentRepositoryWorkFocus = {
  schema: "aiw.agent-work-focus/0.19";
  activityId: string;
  rosterId: string;
  worldSessionId: string;
  repositoryRef: string;
  objectRef: string;
  layoutGeneration: string;
  source: "structured-tool-event" | "workstream-binding";
  state:
    | "targeted"
    | "navigating"
    | "coding"
    | "completed"
    | "failed"
    | "cancelled"
    | "stale";
};
```

Resolve the most specific current object from structured adapter/tool paths or an accepted workstream binding: symbol first, then file, directory, and package fallback. The renderer is never the authority. `coding` presentation requires both active execution evidence and truthful arrival at the current safe approach point. Object/layout mismatch becomes `stale`; it never moves to a similarly named object.

### 5.5 Voice-input routing

Phase 19 keeps `aiw.voice-binding/0.15` and the accepted local Whisper provider contract, but binds the final accepted transcript to a `ConstellationMessageGroup` request. Capture/transcription has one exact World instance and operator; dispatch uses the immutable target snapshot selected when the final caption is sent. Raw WAV remains volatile, local, and single-copy. No Phase 19 normal-World contract requests or records agent speech playback.

## 6. Task-by-task implementation plan

### Task 1 — Canonical scope record before production code

**Objective:** Record the seven frozen decisions as current canonical authority and truthfully mark Phase 19 **AUTHORIZED / IN PROGRESS — TASK 1 SCOPE RECORD** before production changes begin.

**Only files authorized for Task 1:**

- `AgentIntersect_WorldDD.md`
- `docs/WORLD_ENTRY_EXPERIENCE.md`
- `PROJECT_STATUS.md`
- `AGENTS.md`
- This plan remains the detailed task contract.

**Steps:**

1. Add a Phase 19 decision record containing all seven frozen decisions and the current authorized/in-progress Task 1 status.
2. Reconcile the older “new harness runtimes out of scope / unsupported harnesses may stay grey” language with the new all-four production-binding requirement.
3. Preserve the no-install/no-login/no-protected-config rule and Phase 20/public-action gates.
4. Preserve completed Phase 18 history and exact-SHA receipts.
5. Run `corepack pnpm@11.15.0 exec prettier --check AgentIntersect_WorldDD.md docs/WORLD_ENTRY_EXPERIENCE.md PROJECT_STATUS.md AGENTS.md .hermes/plans/2026-08-11_211034-phase19-multi-agent-constellation.md`.
6. Run `git diff --check` and inspect that only authorized documentation changed.

**Expected evidence:** Phase 19 is consistently `AUTHORIZED / IN PROGRESS — TASK 1 SCOPE RECORD`; all seven decisions appear consistently across the governing docs; no production or external state changed.

### Task 2 — RED protocol tests for roster, readiness, and message groups

**Objective:** Freeze the cross-process contract before changing server or UI behavior.

**Files:**

- Modify: `packages/agent-session-protocol/src/index.ts`
- Modify: `packages/agent-session-protocol/test/phase12-protocol.test.ts`
- Create: `packages/agent-session-protocol/test/phase19-constellation.test.ts`

**RED cases:**

- reject a fifth roster member;
- reject duplicate `{adapterId, nativeRootSessionRef}`;
- permit duplicate harness IDs with distinct native roots;
- derive entry false for one complete agent;
- derive entry true for two complete agents;
- derive entry false when any retained agent is stale, unavailable, or avatar-incomplete;
- validate stable roster ordering;
- validate broadcast and single-target recipient sets;
- reject unknown/duplicate recipient IDs;
- require terminal state for every recipient before group completion;
- reject unbounded text/results and malformed adapter IDs.
- reject `operator-persistent` ownership for OpenClaw, Codex, or Claude Code;
- require exact `worldInstanceId` ownership and idempotent World teardown;
- reject stale repository object/layout generations in work-focus records;
- require accepted voice text to enter the same message-group target schema used by typed text.

**Verification:**

```bash
corepack pnpm@11.15.0 build:packages
corepack pnpm@11.15.0 exec vitest run packages/agent-session-protocol/test/phase19-constellation.test.ts --maxWorkers=1 --no-file-parallelism
```

First run must fail for missing contracts; after minimal contract code it must pass.

### Task 3 — Generalize adapter capability/config truth

**Objective:** Represent four independently configured adapters without exposing secrets or claiming availability from command presence alone.

**Files:**

- Modify: `packages/config/src/index.ts`
- Modify: `packages/config/src/node.ts`
- Modify: `packages/config/test/config.test.ts`
- Modify: `apps/local-server/src/agent-sessions.ts` only for shared adapter/gateway contract changes
- Modify: `apps/local-server/test/phase12-agent-sessions.test.ts`

**Design:**

- Keep one `agentSessions.dataDir`.
- Add per-adapter optional config blocks.
- Preserve Hermes’s current fields.
- Add OpenClaw loopback endpoint/credential references without reading or rewriting OpenClaw config.
- Add explicit Codex and Claude executable paths plus bounded session roots; never shell-interpolate names/prompts.
- Safe config exposes booleans/reasons only, never URLs carrying secrets, tokens, profile paths, command arguments, or native session IDs.
- Capability is enabled only after adapter attestation proves real create/attach plus `sendText`; `--version` alone is insufficient.

**RED cases:** partial configuration, duplicate command/session roots, non-absolute executable paths where required, secret leakage, unsupported public/non-loopback defaults, and enabled adapter without a complete prerequisite set.

### Task 4 — Production-bind OpenClaw

**Objective:** Add a real OpenClaw `AgentAdapter` that creates and owns one native session for the active World without any Discord bridge.

**Files:**

- Create: `apps/local-server/src/openclaw-session-adapter.ts`
- Create: `apps/local-server/test/phase19-openclaw-session-adapter.test.ts`
- Modify: `apps/local-server/src/index.ts`
- Modify: `apps/local-server/src/agent-sessions.ts` only where the generic gateway contract requires it

**Steps:**

1. Write fixture-backed RED tests for attestation, World-owned native-session creation, exact-World attach, text streaming/final result, cancellation/disconnect, explicit World teardown, stale identity, bounded output, and sanitized failures.
2. Use exact loopback gateway APIs; do not invoke configuration mutation or restart endpoints.
3. Preserve native root/effective session identity and strict per-session ordering only for the owning active World instance.
4. Convert only explicit gateway events to `AgentSessionEvent`; never parse prose as tool evidence.
5. Add a live create → turn → same-World refresh/reconnect → second turn → explicit World end acceptance script, then prove a later World receives a new native session ID and no protected configuration was touched.

**Completed evidence (2026-08-11):** Post-correction parent verification passed OpenClaw adapter `15/15`, shared gateway `26/26`, protocol regression `9/9`, protocol/config/local-server builds, local-server typecheck, Prettier, and `git diff --check`. Real acceptance passed attestation, fresh create, first turn, exact same-World reconnect, second turn, teardown, stale rejection, and distinct later-World identity. No tool events or leaked probe sessions remained; protected OpenClaw config and gateway PID/generation were unchanged; no raw native identity or credential was retained. Task 4 is complete.

### Task 5 — Production-bind Codex CLI

**Objective:** Add a real World-owned Codex adapter for a World-entered display identity, using the user’s existing WSL Codex/GPT-5.6 setup without changing it.

**Files:**

- Create: `apps/local-server/src/codex-session-adapter.ts`
- Create: `apps/local-server/test/phase19-codex-session-adapter.test.ts`
- Modify: `apps/local-server/src/index.ts`
- Modify shared gateway protocol only for an explicit adapter-created native session path.

**Steps:**

1. Freeze exact Codex CLI create/resume/event arguments from the installed CLI’s machine-readable help in a retained adapter contract fixture; do not guess flags.
2. Write RED tests using a fake executable that emits the exact accepted event envelope.
3. Spawn directly with an argument array, no shell, fixed cwd, bounded environment allowlist, timeout, stdout/stderr/event byte caps, and abort propagation.
4. Persist the exact native Codex session ID returned by the harness against the owning `worldInstanceId`; the entered World name remains display-only.
5. Resume the same native session for later turns/reconnects inside that active World; never attach it to a later World and never start a replacement silently after an ambiguous failure.
6. Keep process/tool claims limited to structured Codex events and repository evidence.
7. Add one live local create → turn → same-World reconnect → second turn → explicit World end proof against the already-authenticated Codex CLI, then prove a later World creates a different native session.

**Completed evidence (2026-08-12):** Parent verification passed Codex adapter `18/18`, shared gateway `26/26`, protocol `9/9`, config `27/27`, all relevant builds/typecheck, Prettier, and `git diff --check`. Real authenticated WSL acceptance passed attestation, two exact turns across same-World exact-identity reconnect, teardown, stale/cross-World rejection, and a distinct later-World identity with zero tool events or surviving Codex processes. Two private World-local native histories remain with OAuth symlinks removed; user Codex inventory stayed `199 → 199`; protected Codex/Hermes/OpenClaw manifests were byte-identical. Receipt: `/home/mela_ai/.hermes/runs/aiw-phase19-task5-codex/task5-parent-acceptance.md`.

### Task 6 — Production-bind Claude Code

**Objective:** Add the World-owned Claude Code equivalent against the existing WSL Claude Code/local Ollama setup without forcing a false shared abstraction with Codex.

**Files:**

- Create: `apps/local-server/src/claude-code-session-adapter.ts`
- Create: `apps/local-server/test/phase19-claude-code-session-adapter.test.ts`
- Modify: `apps/local-server/src/index.ts`

**Steps:**

1. Freeze exact Claude Code create/resume/stream arguments from machine-readable installed CLI help.
2. Write independent fake-executable RED tests for World-owned native session identity, stream/final result, same-World reconnect, explicit teardown, timeout, abort, malformed output, and unavailable local-model prerequisites.
3. Implement direct argument-array spawning and the same external-boundary limits as Codex.
4. Do not create a common CLI base class unless both concrete implementations contain proven identical process code; if needed, extract only one small bounded process runner.
5. Add one live local create → turn → same-World reconnect → second turn → explicit World end proof against Claude Code powered by the reported local Ollama model, then prove a later World creates a different native session.

### Task 7 — Four-adapter registry and conformance matrix

**Objective:** Make production startup and API capability truth match the four real adapters.

**Files:**

- Modify: `apps/local-server/src/index.ts`
- Modify: `apps/local-server/src/agent-sessions.ts`
- Modify: `apps/local-server/src/agent-session-routes.ts`
- Create: `apps/local-server/test/phase19-adapter-conformance.test.ts`
- Modify: `apps/local-server/test/phase12-agent-session-api.test.ts`

**Acceptance matrix per adapter:**

- attestation schema valid;
- native identity created or uniquely resolved according to adapter ownership;
- attach/current status valid;
- real text turn reaches the same native session;
- bounded deltas and final result;
- same-active-World refresh/reconnect continuity;
- Hermes persistent continuity remains available, while OpenClaw/Codex/Claude close at explicit World end and are not reused by a later World;
- unavailable prerequisite produces grey/unavailable truth;
- no secrets/native paths leak to normal UX;
- no external config write or protected-service signal occurs.

### Task 8 — Durable constellation service and routes

**Objective:** Own roster membership, ordering, avatar association, stale recovery, and explicit removal on the server.

**Files:**

- Create: `apps/local-server/src/constellation-service.ts`
- Create: `apps/local-server/src/constellation-routes.ts`
- Create: `apps/local-server/test/phase19-constellation-service.test.ts`
- Create: `apps/local-server/test/phase19-constellation-api.test.ts`
- Modify: `apps/local-server/src/server.ts`
- Modify: `apps/local-server/src/index.ts`

**Frozen exact routes:**

- `GET /constellation/current`
- `POST /constellation/agents`
- `POST /constellation/agents/:rosterId/reconnect`
- `DELETE /constellation/agents/:rosterId`
- `POST /constellation/agents/:rosterId/avatar`
- `POST /constellation/end`

**Invariants:**

- The server owns one durable `aiw.constellation/0.19` projection for one exact World instance: lifecycle, stable added order, roster membership, exact native binding, avatar association, continuity/connection, derived readiness, and revision.
- Every mutation requires exact `worldInstanceId`, `expectedRevision`, and a bounded idempotency identity. Byte-equivalent canonical replay returns the prior outcome without a second side effect; different input under the same identity and stale revision both conflict. GET is side-effect free.
- The roster contains at most four agents. Reject an exact duplicate `{adapterId,nativeRootSessionRef}` while allowing the same adapter with a distinct native root; preserve connection order.
- Only Hermes may be `operator-persistent`; OpenClaw, Codex, and Claude Code are `world-owned`. Creation accepts an already-created or attached exact `worldSessionId` and native-root binding from the existing gateway path and neither creates sessions nor dispatches turns.
- Avatar mutation records `missing`, `editing`, or `accepted` truth against the exact roster entry. `entryReady` is server-derived and requires at least two agents with every retained entry connected, current or previous-recovered, and avatar accepted.
- Reconnect is explicit and revalidates the exact roster, World session, native root, and World identity through an injected gateway-backed port. It cannot silently replace identity; only exact truth can restore a stale/unavailable entry to connected current/recovered state.
- Process restore makes retained non-ended entries visibly stale, or unavailable when exact validation reports unavailable, and blocks entry until explicit reconnect or removal. Browser refresh performs no service mutation and does not end the World.
- Removal detaches only the World roster/avatar association. It never calls native end/delete, removes gateway history, mutates a native profile, or grants worktree/execution authority.
- `POST /constellation/end` is idempotent and crash/retry safe. It ends only `world-owned` roster sessions via existing `endWorldSession(worldSessionId, worldInstanceId)`, never Hermes/operator-persistent. Persist bounded sanitized per-roster terminal progress so successful closes are not repeated after partial failure. An ended projection has `entryReady: false`; no runtime/service/provider/profile/external configuration is altered.
- Persist beneath an injected World-owned state directory, composed in production as a focused `constellation` child beneath `agentSessions.dataDir`. Maintain checksum-validated `constellation.current.json` and `constellation.previous.json`, file mode `0600`, owned directory mode `0700`, same-directory temporary writes, fsync where practical, atomic rename, and current-to-previous preservation before current replacement.
- If current is corrupt or missing and previous is valid, recover previous with public truth `previous-recovered`, stale retained entries, and no implicit native calls. If both generations are invalid, fail closed unavailable for mutation and expose only a bounded sanitized reason. Serialize mutations in-process.
- HTTP uses the normal API envelope/correlation behavior, bounded JSON and route-param validation, and truthful existing statuses/codes for validation, not-found, revision/idempotency conflict, resource limit, and unavailable/upstream failure without leaking native refs, paths, prompts, credentials, executable arguments, or raw upstream errors.
- The service and routes have no message-send, tool, shell, command, repository mutation, worktree, broadcast, UI, voice, animation, Phase 20, native profile, or external configuration authority.

**Task 8 parent acceptance (2026-08-13):** One bounded Codex worker delivered the seven-path candidate with vertical RED→GREEN evidence. Parent inspection found one concrete contract gap—non-Hermes adapters could request `operator-persistent` ownership—and a narrow two-file RED→GREEN correction now rejects that input with a bounded validation error. Independent pinned proof under Node `v24.18.0` and pnpm `11.15.0` passed the 18-package prerequisite build, Task 8 service/API **11/11**, impacted Agent Session/API/conformance **38/38**, local-server typecheck/build, focused ESLint/Prettier, and `git diff --check`. Exact baseline verification found 30 unstaged paths, zero staging, and only the authorized Task 8 plus canonical status mismatches against the frozen 25-path Tasks 1–7 boundary. No real protected session lifecycle, provider/profile/configuration, service signal, delivery, or later-task action occurred. Parent acceptance receipt: `/home/mela_ai/.hermes/runs/aiw-phase19-task8-parent-20260813/task8-parent-acceptance.md`.

### Task 9 — Generalize the Phase 18 entry reducer and client

**Status:** **PARENT-ACCEPTED.** The bounded reducer/client implementation passed independent parent inspection and pinned verification under Node `v24.18.0` and pnpm `11.15.0`. Task 10 is now separately parent-accepted; Task 11 and later remain closed/not started. Parent receipt: `/home/mela_ai/.hermes/runs/aiw-phase19-task9-20260813/task9-parent-acceptance.md`.

**Objective:** Represent ordered Multi Agent setup without regressing accepted Single Agent behavior.

**Files:**

- Modify: `apps/web/src/world-entry/world-entry-machine.ts`
- Modify: `apps/web/src/world-entry/world-entry-client.ts`
- Modify: `apps/web/src/sessions/session-client.ts`
- Modify: `apps/web/test/world-entry-machine.test.ts`
- Modify: `apps/web/test/world-entry-client.test.ts`
- Create: `apps/web/test/world-entry-multi-agent-machine.test.ts`

**Reducer changes:**

- add explicit `sessionMode: "single" | "multi"`;
- replace singular connection/avatar/name fields with ordered roster entries plus one pending setup entry;
- add `SELECT_MULTI_AGENT`, `SELECT_HARNESS`, `AGENT_ATTACHED`, `AGENT_AVATAR_ACCEPTED`, `RETURN_TO_CONSTELLATION`, `RECONNECT_AGENT`, and `REMOVE_AGENT` events;
- keep animation events non-authoritative;
- derive entry readiness from mode and roster truth;
- keep Single Agent exact behavior and restore semantics green.

### Task 10 — Constellation UI, avatar sequence, and four-agent rendering

**Status:** **PARENT-ACCEPTED.** The bounded implementation passed independent parent inspection, production desktop/390×844 browser and pixel proof, 116/116 focused/impacted tests, renderer/web typecheck and builds, lint/format/diff checks, and exact frozen-baseline reconciliation under Node `v24.18.0` and pnpm `11.15.0`. The final deterministic spawn positions are `[-4.2,0,0.8]`, `[4.2,0,0.8]`, `[-3.2,0,-4]`, and `[3.2,0,-4]`. Task 11 is now separately parent-accepted; Task 12 and later remain closed. Parent receipt: `/home/mela_ai/.hermes/runs/aiw-phase19-task10-20260813/task10-parent-acceptance.md`.

**Objective:** Deliver the accepted sequential setup and embodied roster without adding dashboard chrome.

**Files:**

- Modify: `apps/web/src/world-entry/WorldEntryExperience.tsx`
- Modify: `apps/web/src/world-entry/WorldEntryLogo.tsx`
- Modify: `apps/web/src/world-entry/WorldEntryAgentAvatar.tsx`
- Modify: `apps/web/src/world-entry/WorldRoom.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `packages/renderer-r3f/src/world-room-canvas.tsx`
- Modify: `packages/renderer-r3f/src/world-room-imported-canvas.tsx`
- Modify relevant renderer tests
- Create: `apps/web/test/world-entry-multi-agent-ui.test.tsx`

**Behavior:**

- harness endpoint remains selected until one agent connect attempt reaches a terminal state;
- connected agent immediately enters exact avatar setup;
- return to constellation preserves all prior agents;
- show stable roster order, current/recovered/stale/unavailable truth, and explicit reconnect/remove;
- `Enter World` absent/grey until server-derived readiness is true;
- deterministic non-overlapping spawn positions for up to four agent avatars;
- avatar click exposes a semantic button equivalent and selects only the next-message recipient;
- blue enabled, grey unavailable, keyboard and reduced-motion equivalents preserved;
- no persistent roster/admin panel appears inside World.

### Task 11 — Durable grouped broadcast and exact targeting

**Status:** **PARENT-ACCEPTED.** The bounded Task 11 implementation passed independent parent inspection and pinned Node `v24.18.0` verification plus fresh production-bundle desktop/390×844 browser and pixel proof. The server snapshots the ready roster once, dispatches concurrently across sessions while serializing each native session, persists stable roster-ordered independent outcomes, preserves partial success, resolves avatar and exact normalized `@name` targeting to the same roster ID, rejects unknown/ambiguous names without send, resets one-send targeting, suppresses replay resend, recovers ambiguous in-flight rows as interrupted, and keeps browser abort observation-only. Focused Task 11 **14/14**, impacted Phase 19 **86/86**, builds/typechecks/lint/format/diff/reconciliation, and browser acceptance are green. Two unchanged pre-Task-11 safe-config fixtures remain stale; the broad runs were **336/337** and **280/281**, while all other broad tests passed **330/330** and **278/278** when only those two files were excluded. Task 12 planning is authorized next session; Task 12 implementation and Task 13+ remain closed/not started. Parent receipt: `/home/mela_ai/.hermes/runs/aiw-phase19-task11-20260813/task11-parent-acceptance.md`.

**Objective:** Implement Decision 3 without browser-owned ambiguous fan-out.

**Files:**

- Create: `apps/local-server/src/constellation-message-service.ts`
- Create: `apps/local-server/src/constellation-message-routes.ts`
- Create: `apps/local-server/test/phase19-constellation-message-service.test.ts`
- Create: `apps/local-server/test/phase19-constellation-message-api.test.ts`
- Modify: `apps/web/src/sessions/session-client.ts`
- Modify: `apps/web/src/world-entry/world-chat-model.ts`
- Modify: `apps/web/src/world-entry/WorldHud.tsx`
- Modify: `apps/web/src/world-entry/WorldEntryExperience.tsx`
- Create: `apps/web/test/phase19-multi-agent-chat.test.tsx`

**RED cases:**

- broadcast captures exactly the current ready roster once;
- concurrent dispatch across sessions;
- same-session turns remain serialized;
- stable recipient row order despite out-of-order completion;
- partial failure retains successful replies;
- unknown/ambiguous `@name` sends nothing;
- avatar click target and `@name` target match exact roster ID;
- target clears back to broadcast after one send;
- request replay does not resend;
- restart marks ambiguous in-flight rows interrupted unless exact native completion is proven;
- leaving World aborts owned browser stream without cancelling unrelated completed native turns.

### Task 12 — Move coding agents to repository objects and loop verified Dig

**Status:** **PARENT-ACCEPTED 2026-08-20.** Structured adapter evidence now resolves the exact live repository object, each roster agent owns independent focus/movement/arrival state, stale/wrong-generation identity fails closed, and coding presentation unlocks only after matching arrival. No operator Dig mapping was approved, so the accepted imported-avatar result uses truthful Work/static coding fallback. Fresh production headed proof passed desktop reconnect/retarget/terminal, 390×844 imported reduced-motion, and no-WebGL semantic/accessibility journeys. Task 13 and later remain closed.

**Objective:** Make each actively coding agent move to the exact repository-city object representing its current work and visibly Dig only while truthful coding evidence remains active there.

**Files:**

- Modify: `packages/agent-session-protocol/src/index.ts`
- Modify: `packages/avatar-system/src/index.ts`
- Modify: `packages/avatar-system/src/imported-avatar.ts`
- Modify: `packages/avatar-system/test/avatar-system.test.ts`
- Modify: `packages/avatar-system/test/avatar-replacement-v2.test.ts`
- Modify: `apps/web/src/avatar/avatar-animation-review-contract.ts`
- Modify: `apps/web/src/world-entry/world-agent-movement-model.ts`
- Modify: `apps/web/src/world-entry/WorldEntryExperience.tsx`
- Modify: `apps/web/src/world-entry/WorldRoom.tsx`
- Modify: `apps/web/src/world-entry/world-imported-avatar.ts`
- Modify: `packages/renderer-r3f/src/imported-avatar-animation.ts`
- Modify: `packages/renderer-r3f/src/world-room-imported-canvas.tsx`
- Create: `apps/local-server/src/agent-work-focus-service.ts`
- Create: `apps/local-server/test/phase19-agent-work-focus.test.ts`
- Create: `apps/web/test/phase19-agent-coding-embodiment.test.tsx`
- Update only evidence-backed Dig verdicts under `artifacts/avatar-replacement-evidence/world-animation-operator-review-v1/`

**RED cases:**

1. A structured read/edit/tool event for a known symbol resolves that symbol object; missing symbol detail falls back deterministically to file, directory, then package.
2. Prose such as “I am editing X” without structured tool/workstream evidence creates no work-focus event.
3. A current work-focus event emits one existing `repository-object` movement request using the exact `objectRef` and `layoutGeneration`.
4. Stale/missing/hidden/unreachable objects refuse truthfully and never move the avatar to a same-named replacement or inside city geometry.
5. Each roster agent owns independent movement, arrival, work-focus, and animation state.
6. Dig cannot start before both repository-object arrival and active `coding` evidence.
7. Dig loops while coding remains active at that approach point and stops on completed, failed, cancelled, stale, retargeted, or moved-away state.
8. A new work target stops Dig, moves to the new exact object, then resumes only after the new truthful arrival.
9. Reduced motion keeps the avatar at the exact object with a static semantic `coding` indication instead of a looping Dig clip.
10. An imported model without an operator-approved Dig mapping falls back to accepted generic `Work`; it never guesses a clip by name or index.

**Implementation sequence:**

1. Extend the accepted semantic-review inventory with `Dig` and visually inspect every supported imported agent model’s real clip inventory.
2. Record model-specific Dig clip index/duration only after first-hand operator approval; keep unsupported/ambiguous models fail closed.
3. Add `AgentRepositoryWorkFocus` projection from structured adapter tool paths or accepted workstream bindings to the current repository snapshot.
4. Reuse `resolveRepositoryObject` and the existing safe approach-point movement model; do not add a second navigation system.
5. On an `arrived` event for the exact activity/object/layout generation, transition that roster agent to `coding-at-target` and select the approved Dig loop.
6. Keep coding/tool execution authoritative in the adapter/workstream plane. Avatar position and Dig are presentation only.
7. Prove with headed video that at least two agents can work on different city objects simultaneously without overlap, teleporting, stale-object substitution, or animation leakage.

### Task 13 — Recovery, migration, lifecycle teardown, and Phase 16 non-regression

**Objective:** Prove old Single Agent state remains recoverable, World-owned sessions end at the correct boundary, and the new roster does not mutate Phase 16 authority.

**Files:**

- Modify: `apps/web/src/world-entry/world-entry-restore.ts`
- Add focused migration tests beside existing restore tests
- Modify constellation/session service tests
- Do not modify `packages/multi-agent-coordination/src/index.ts` except an explicit test-only import if required.

**Cases:**

- migrate one accepted Phase 18 Hermes session into Single Agent mode without duplicate avatar creation;
- restore a four-agent current roster;
- recover from previous checksum generation;
- one stale third agent blocks entry until reconnect/remove;
- explicit removal leaves native session/history intact;
- restored display-name collision does not create ambiguous `@name` delivery;
- browser refresh/reconnect to the same active World preserves exact OpenClaw/Codex/Claude native bindings when each adapter can prove continuity;
- explicit World end closes OpenClaw/Codex/Claude bindings idempotently and a later World creates new native session IDs;
- explicit World end does not close or mutate Mr Fluff’s persistent Hermes identity/session outside World;
- all Phase 16 conformance tests remain byte-behavior compatible and green;
- no new route invokes coordination/worktree mutation merely because an agent joins the constellation.

**Completed 2026-08-20 (direct implementation; no Codex):** the browser now restores an accepted active Multi Agent constellation before the legacy Single Agent Hermes pointer path, validates exact roster/session/adapter/avatar continuity from current or previous-recovered checksum truth, and rehydrates all accepted avatars without creating or attaching another native identity. A retained stale member restores visibly and blocks entry until exact reconnect or explicit non-destructive removal; reconnect revalidates the existing binding and reloads that member's accepted avatar. Phase 18 Single Agent migration remains unchanged. Existing service/conformance coverage continues to prove non-destructive removal, ambiguous-name refusal, same-World binding continuity, idempotent World-owned teardown, later-World new native IDs, Hermes persistence, and no Phase 16 worktree-authority expansion.

Pinned Node `v24.18.0` verification passed Task 13 **13/13**, complete Phase 19 targeted **184/184**, affected web selection **58/58**, repository typecheck **38/38 tasks**, build **20/20 tasks**, lint, focused formatting, `git diff --check`, and Phase 16 conformance **41/41**. The full monorepo run reached **1030/1033**; the three failures are inherited Tasks 1–12 verification debt: the Task 12 E2E listing requires `AIW_PHASE19_TASK12_EVIDENCE_DIR` (and passes **4/4** when supplied), while two unchanged safe-config fixtures omit the accepted `agentAdapters` projection. Implementation-only reconciliation retained HEAD `f4b23b31a131580e1ddd9fb10274919be434bf68`, empty staging, 60/64 inherited paths byte-identical, four authorized inherited-dirty-path implementation/test changes, and exactly two newly dirty Task 13 paths. Canonical closeout then updated exactly five governance/status paths, leaving 55/64 inherited paths byte-identical and no missing paths.

**User-accepted 2026-08-24:** a fresh manual-acceptance preflight found one concrete stale-reconnect composition gap: already-connected accepted members were not hydrated while entry remained blocked, so reconnecting Codex could render only the reconnected member. A strict focused RED failed before production changes; the minimal correction reused exact per-member restore validation and populated available accepted avatars plus the retained primary session/history. Parent proof passed Task 13 **6/6**, selected impacted web **60/60**, package builds **18/18**, formatting, lint, typecheck, production build, and production-browser proof **22/22**. Aaron then passed all eight receipt-owned Edge criteria: retained roster/stale blocking, exact reconnect without avatar recreation, Aaron plus all four agents, refresh continuity without duplication/setup loops, and Repository City at 1 package, 1 directory, and 125 files with agent/camera/movement continuity. Receipt: `/home/mela_ai/.hermes/runs/aiw-phase19-task13-manual-20260824T114819Z/manual-acceptance-verdict.json`. The exact eight-path acceptance-milestone candidate is privately commit/push authorized; its final SHA and CI receipt remain external. Task 14 and later remain closed.

### Task 14 — Complete push-to-talk input in the normal World

**Objective:** Reuse the accepted Phase 15 local STT path in the minimal World HUD after all four text adapters pass, with no agent speech/TTS in Phase 19.

**Stage gate:** Do not begin this task until Tasks 4–11 have passed real four-harness text/session acceptance. Voice must not obscure adapter or routing failures.

**Files:**

- Modify: `apps/web/src/world-entry/WorldHud.tsx`
- Modify: `apps/web/src/world-entry/WorldEntryExperience.tsx`
- Modify: `apps/web/src/voice/voice-client.ts`
- Modify: `apps/web/src/voice/browser-voice.ts`
- Modify: `apps/web/src/voice/voice-state.ts`
- Modify: `apps/local-server/src/voice-service.ts`
- Modify: `apps/local-server/src/voice-routes.ts`
- Modify: `packages/voice/src/index.ts`
- Modify: `apps/web/test/phase15-voice-client.test.ts`
- Modify: `apps/web/test/phase15-browser-voice.test.ts`
- Create: `apps/web/test/phase19-world-voice-input.test.tsx`
- Create: `apps/web/e2e/phase19-world-push-to-talk.spec.ts`

**Behavior:**

1. Keep the existing adjacent `Push to talk` control in the bottom-center HUD; do not expose the Phase 15 ten-step dashboard panel in normal World.
2. On first use, show a small transient local-provider/microphone disclosure and require explicit microphone enable/permission.
3. Press-and-hold pointer/touch—or hold the focused control with Space—to capture; release stops capture and starts one local Whisper transcription.
4. Show the honest final-only caption in a small editable transient surface with `Send` and `Cancel`; do not label progress as partial transcript text.
5. Sending captures the current broadcast/target selection once and submits the accepted text through the exact `ConstellationMessageGroup` path used by typed chat.
6. Broadcast transcribes one WAV once and fans out only accepted text. Raw audio never reaches an agent adapter and is never copied per recipient.
7. Cancelling wipes the volatile WAV/transcript and sends nothing. Leaving World, losing device, timeout, size ceiling, or restart terminates capture without replay.
8. Typed chat stays usable whenever voice is unavailable, denied, transcribing, or cancelled.
9. Do not instantiate `BrowserSpeechPlayback` from the normal World path and do not speak agent replies. Historical Phase 15 TTS remains internal/deferred.

**RED and browser acceptance:**

- World currently passes `pushToTalkAvailable={false}`; the first focused World test must fail for that hard-coded state.
- Prove pointer, touch, and keyboard hold/release semantics; explicit permission; 30-second/4-MiB bounds; final edit; cancel; device loss; and no hot-mic behavior.
- Prove a broadcast utterance creates one transcription and one grouped text request with the exact roster snapshot.
- Prove an avatar-selected or exact `@name` target produces one recipient and then returns to broadcast after send.
- Prove no `speechSynthesis.speak` call occurs anywhere in the normal Phase 19 World journey.
- Perform first-hand real microphone → local Whisper → editable caption → four-agent broadcast and single-agent target acceptance.

### Task 15 — Browser acceptance and real-harness proof

**Objective:** Prove the full user journey at production boundaries.

**Files:**

- Create: `apps/web/e2e/world-entry-multi-agent.spec.ts`
- Add deterministic adapter fixture support under existing test tooling.
- Create a retained Phase 19 local acceptance receipt/report path when Task 15 is reached under the authorized implementation sequence.

**Deterministic browser journeys:**

1. Connect Hermes, create avatar, return; verify no entry.
2. Connect OpenClaw, create avatar, verify entry.
3. Add Codex and Claude before entry; verify max four and duplicate-binding refusal.
4. Enter World with four avatars and no persistent admin chrome.
5. Broadcast one message; complete results out of order; verify stable grouped rows.
6. Target by avatar click, then by `@name`; verify one recipient each and automatic return to broadcast.
7. Give two agents coding tasks in different repository sections; verify each moves to the exact current city object and loops its approved Dig semantic only after arrival and while coding remains active.
8. Retarget one coding agent; verify Dig stops, the avatar safely moves to the new object, and Dig resumes only after truthful new arrival.
9. Use push-to-talk once for broadcast and once for a selected agent; verify one local transcription per utterance, editable final caption, exact text routing, cancellation, and no agent speech playback.
10. Refresh the same active World, then explicitly end it; verify OpenClaw/Codex/Claude continuity before the end and new native session IDs in the next World.
11. Restore with one stale agent; verify blocked entry, reconnect, and explicit remove behavior.
12. Keyboard-only, reduced-motion, forced-colors, no-WebGL, desktop, and mobile containment.
13. Verify internal Workbench/dashboard remains absent and fail-closed without its explicit flag/query.

**Real local acceptance, one harness at a time:**

- real native identity/session;
- real first text turn;
- exact same-active-World refresh/reconnect continuity;
- real second text turn on the same session;
- explicit World teardown for OpenClaw/Codex/Claude, followed by a new World with new native session IDs;
- Hermes continuity remains available outside World and is not shut down by World teardown;
- truthful unavailable behavior when deliberately withholding only the Phase 19 adapter prerequisite;
- no provider/profile/account/config mutation;
- then one combined four-agent broadcast, exact-target, repository-object Dig, and push-to-talk input journey.

A fixture-only pass cannot complete Decision 2.

### Task 16 — Consolidated verification and user gate

**Focused verification:**

```bash
corepack pnpm@11.15.0 build:packages
corepack pnpm@11.15.0 exec vitest run \
  packages/agent-session-protocol/test/phase19-constellation.test.ts \
  apps/local-server/test/phase19-*.test.ts \
  apps/web/test/world-entry-*.test.ts \
  apps/web/test/phase19-multi-agent-chat.test.tsx \
  apps/web/test/phase19-agent-coding-embodiment.test.tsx \
  apps/web/test/phase19-world-voice-input.test.tsx \
  --maxWorkers=1 --no-file-parallelism
```

**Preserved Phase 16 boundary:**

```bash
corepack pnpm@11.15.0 conformance:phase16
```

**Complete parent matrix:**

```bash
corepack pnpm@11.15.0 check:core
corepack pnpm@11.15.0 test:e2e:unflagged
VITE_AIW_LOCAL_DEVELOPER_UI=1 corepack pnpm@11.15.0 test:e2e:flagged
corepack pnpm@11.15.0 verify:fresh
```

Also require:

- `git diff --check`;
- added-content credential/path scan;
- no unexpected generated output;
- exact current/previous checksum recovery proof;
- explicit browser console/page-error result;
- screenshots/video for constellation setup, four embodied agents, grouped broadcast, exact targeting, two simultaneous repository-object Dig states, retarget/stop behavior, push-to-talk caption/send/cancel, stale blocking, and mobile containment;
- Aaron’s criterion-level first-hand verdict.

Stop at first-hand acceptance. Commit/push/PR/merge/CI/release actions require a separate explicit decision even if every local gate is green.

## 7. Proposed implementation commit boundaries (separate gate)

If Aaron separately authorizes commits, prefer these reviewable boundaries:

1. `docs: freeze Phase 19 constellation decisions`
2. `feat(phase19): add constellation and adapter contracts`
3. `feat(phase19): production-bind four session adapters`
4. `feat(phase19): add durable constellation readiness`
5. `feat(phase19): add multi-agent entry and embodiment`
6. `feat(phase19): add grouped broadcast and exact targeting`
7. `feat(phase19): embody repository coding with verified Dig`
8. `feat(phase19): complete World push-to-talk input`
9. `test(phase19): add lifecycle recovery and acceptance journeys`

Do not create these commits merely because this plan names them.

## 8. Risks and direct mitigations

| Risk                                                       | Direct mitigation                                                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Four harnesses hide incompatible session semantics         | Independent concrete adapters plus one shared conformance matrix; no false universal CLI abstraction.                  |
| World-owned agents accidentally inherit Hermes persistence | Explicit ownership field, exact World binding, idempotent teardown, and later-World new-session proof.                 |
| Codex/Claude entered name is mistaken for native identity  | Persist and route by adapter/native root session; display name is non-authoritative.                                   |
| Broadcast duplicates work after timeout/restart            | Persist group and recipients before dispatch; request/correlation idempotency; no blind resend.                        |
| Slow agent blocks visibility of successful peers           | Concurrent dispatch and independent recipient terminal states.                                                         |
| Response completion order confuses the transcript          | Stable roster-ordered grouped rows that fill independently.                                                            |
| Stale agent is silently lost                               | Visible stale entry blocks entry until explicit reconnect/remove.                                                      |
| Four-agent World harms performance or overlaps avatars     | Hard max four, deterministic spawns, renderer/browser measurements, no unbounded roster.                               |
| Avatar appears to code without real work                   | Structured work-focus evidence plus exact object generation and arrival are all required before Dig.                   |
| Dig clip is guessed or visually wrong                      | Per-model operator semantic review; fail closed to generic Work when unsupported or ambiguous.                         |
| Agent walks into/behind a repository object                | Reuse current safe repository approach-point resolver and prove terminal position in headed acceptance.                |
| Voice input creates a parallel routing path                | Transcribe once, review final text, then submit through the exact typed `ConstellationMessageGroup` path.              |
| Voice scope silently expands to agent speech               | Normal World never instantiates speech playback; explicit no-`speechSynthesis.speak` regression; TTS remains deferred. |
| Phase 19 accidentally broadens coding authority            | Keep Phase 16 schemas/services unchanged; architecture/non-regression tests forbid roster → worktree mutation.         |
| Adapter setup mutates user tools                           | Existing authenticated runtime is prerequisite; no install/login/provider/profile/config writes.                       |
| Internal Workbench leaks into normal UX                    | Preserve unflagged E2E fail-closed tests and no normal links/routes.                                                   |

## 9. Definition of Phase 19 acceptance

Phase 19 is complete only when Aaron first-hand verifies that:

- up to four distinct native agent sessions can be assembled, including duplicate harness use with distinct native identities;
- Hermes, OpenClaw, Codex, and Claude Code each complete real attach/create, turn, and lifecycle-correct continuity proof;
- OpenClaw, Codex, and Claude Code sessions live only inside their owning World, end explicitly with it, and are not reused by a later World;
- Mr Fluff’s Hermes continuity is not closed or copied onto the other harnesses;
- every connected agent has an explicit accepted avatar;
- one agent cannot enter; two complete agents can; any retained stale/incomplete agent blocks;
- a third and fourth agent can be added before entry;
- all avatars appear and remain selectable in one World;
- unaddressed chat creates one truthful grouped broadcast with independent results;
- avatar click and exact `@name` each reach only the intended agent;
- an agent given a coding task moves to the most specific current repository-city object for its structured work focus and loops only an operator-approved Dig semantic while coding there;
- multiple coding agents can occupy different safe city approach points without movement/animation state leaking between them;
- push-to-talk performs one local transcription, permits final-caption edit/cancel, and routes accepted text through the same broadcast/target semantics as typed chat;
- no agent reply is synthesized or spoken in the normal Phase 19 World;
- stale restore, reconnect, and explicit remove are understandable and truthful;
- the accepted Phase 18 single-agent journey still passes;
- Phase 16 coordination remains exactly-two-agent and unchanged;
- the normal World does not expose the Workbench/dashboard;
- no installation, provider/profile mutation, external configuration write, public action, or Phase 20 work occurred.

## 10. Next gate

Task 1 is complete when the five canonical documents are structurally verified and parent verification is green. The next bounded implementation step is Task 2, but it must not begin inside this documentation-only slice. Commit/push/PR/merge, provider or external-configuration changes, Phase 20, and public actions retain their separate gates.
