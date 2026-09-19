# Phase 19 Task 7 Four-Adapter Registry and Conformance Plan

> **Task 7 parent-accepted (2026-08-13):** Aaron selected exactly `1A 2A 3A 4A 5A`, later approved the narrow strict safe-config correction and retry, and parent verification plus harmless production attestation are green. Task 8 and later remain not started and separately gated. Do not start UI/broadcast/embodiment/voice/delivery work from this closeout alone.

**Goal:** Make production startup and the Agent Session API truthfully represent Hermes, OpenClaw, Codex, and Claude Code through one deterministic conformance matrix while preserving their distinct ownership and lifecycle contracts.

**Architecture:** Keep the four concrete adapters independent. Use `AdapterRegistry` and `AgentSessionGateway` as the shared contract boundary, expose stable safe readiness separately from full manifests, and add only the minimum low-level World-owned create/attach/end API needed to prove Task 7. Deterministic fixtures exercise the common contract; accepted adapter-specific tests and bounded real evidence remain authoritative for native transport details.

**Tech Stack:** Node 24, TypeScript 6, Fastify 5, Zod 4 protocol schemas, Vitest, existing checksum/current-previous Agent Session store, and the four existing production adapters.

---

## 1. Planning boundary and re-attested baseline

### 2026-08-12 parent verification outcome — `SAFE_PAUSED`

- Tasks 7.1–7.5 are implemented. The fixed four-slot registry, independently sanitized capability/readiness truth, World-owned gateway lifecycle, strict low-level routes, truthful transcript authority, production wiring, and table-driven conformance fixture are present.
- Independent Node 24 parent proof passed the focused Task 7 slice `7/7`, shared gateway `26/26`, concrete adapter matrix `57/57`, protocol/config `36/36`, local-server typecheck/build, and `git diff --check`.
- The complete Agent Session API file is `1 passed / 5 failed`; every failure occurs before route registration at `apps/local-server/src/server.ts:177` because strict `SafeConfigSchema` rejects the inherited `agentAdapters` property emitted by `toSafeConfig()`.
- The missing schema declaration is in `packages/world-schema/src/index.ts`, outside Task 7's frozen implementation paths. Parent therefore did not silently widen scope, start Task 8, or fabricate production evidence.
- Task 7.6 production startup and Task 7.7 harmless production registration/readiness/capability attestation remain blocked pending an explicit narrow schema-scope decision. No live session was created, sent a turn, or ended; no protected service/configuration was signalled or mutated.

### 2026-08-13 final parent outcome — `PARENT_ACCEPTED`

- Aaron explicitly approved retrying the narrow correction. `SafeConfigSchema` now accepts the already emitted sanitized four-row `agentAdapters` projection while remaining strict against unknown keys.
- Independent Node 24 proof passed package builds, world-schema/local-server typecheck and build, focused Task 7/API `12/12`, shared gateway `26/26`, concrete adapter matrix `57/57`, protocol/config/world-schema `50/50`, focused ESLint/Prettier, and `git diff --check`.
- A disposable loopback production entrypoint returned HTTP 200 for health/config/readiness/capabilities. All four canonical adapters were configured and runtime-attested. No session lifecycle action occurred, protected files/process identities were unchanged, and candidate cleanup passed.
- The first evidence-verdict script had a harness-only assertion against `body.agentSessionsEnabled` rather than the standard `body.data` envelope. Corrected offline verification of the already captured product evidence passed without repeating live contact.
- Final receipt: `/home/user/.hermes/runs/aiw-phase19-task7-parent-retry-20260813/task7-parent-acceptance.md`. Task 8 remains not started.

### 2026-08-12 implementation authority

- Decisions are frozen as exactly `1A 2A 3A 4A 5A`.
- Tasks 1–6 are parent-accepted; Task 7 is active; Task 8 and later remain closed.
- The worker timebox is absolute: stop starting new slices at `2026-08-13T00:13:00-04:00`, soft-stop at `00:18:00`, and hard-stop at `00:28:00`.
- If a decision, authorization, protected-state, evidence, secret/safety, or unsupported external gate blocks progress, do not ask Aaron or guess. Preserve the last coherent boundary, report `SAFE_PAUSED`, and exit.
- Task 7.7 production attestation and independent final proof are parent-owned. The worker must not create, send, or end live sessions, write protected configuration, or signal services.

Planning inspection on 2026-08-12 established:

- Repository: private `MelaBuilt-AI/AgentIntersect-World`.
- Worktree: `/home/user/.hermes/runs/aiw-repository-city-next-feature/worktree`.
- Branch: `feature/phase19-multi-agent-constellation`.
- HEAD: `f4b23b31a131580e1ddd9fb10274919be434bf68`.
- Upstream: none configured.
- Before this planning artifact: exactly 19 unstaged paths, comprising 11 modified tracked paths and 8 untracked paths; zero staged paths.
- Tasks 1–6 are parent-accepted. Task 7 implementation has not started.
- This file is the only repository artifact authorized to be created by the current planning-only session.

No commit, push, PR, merge, tag, release, deployment, publication, package publication, public ingress, or visibility change is authorized.

## 2. Current implementation truth

### Production startup

`apps/local-server/src/index.ts` already imports and conditionally constructs all four concrete adapters in canonical order:

1. `hermes`
2. `openclaw`
3. `codex`
4. `claude-code`

Only configured adapters enter the registry. An unconfigured adapter therefore disappears rather than remaining visible as grey/unavailable truth.

### Registry and capability truth

`AdapterRegistry.capabilities()` uses all-or-nothing `Promise.all`; one configured-but-offline adapter can fail the complete capability request. `AdapterRegistry.readiness()` already produces sanitized enabled/disabled rows, but it sees only registered adapters and is not exposed by `agent-session-routes.ts`.

### Shared gateway

`AgentAdapter` already supports optional `createWorldSession()` and `endWorldSession()`. OpenClaw, Codex, and Claude Code implement those World-owned methods. `AgentSessionGateway` currently exposes attach/status/send/history/events but does not expose World-owned create or end operations.

`GatewayAttachRequest` already accepts an optional `worldInstanceId`, but `/agent-sessions/attach` rejects that property because its Fastify body schema does not declare it. Production API callers therefore cannot complete the World-owned create → attach lifecycle even though the adapters support it.

### API projection

`GET /agent-sessions/capabilities` returns only manifests and currently fails as a group. `GET /agent-sessions/:sessionId/history` hard-codes `transcriptAuthority: "hermes"` even for OpenClaw, Codex, and Claude Code. Normal response tests already verify native session references do not leak.

### Existing evidence

- Hermes has mature gateway/API tests and accepted persistent-session live evidence.
- OpenClaw has adapter fixture and accepted real lifecycle evidence.
- Codex has adapter fixture and accepted real lifecycle evidence.
- Claude Code has adapter fixture and accepted real lifecycle evidence.
- Each concrete adapter owns its native parser/process/gateway tests. Task 7 should not duplicate those implementations or force a shared CLI base class.

## 3. Proposed minimum implementation after decisions

The five canonical Task 7 source/test paths remain:

- Modify `apps/local-server/src/index.ts`.
- Modify `apps/local-server/src/agent-sessions.ts`.
- Modify `apps/local-server/src/agent-session-routes.ts`.
- Create `apps/local-server/test/phase19-adapter-conformance.test.ts`.
- Modify `apps/local-server/test/phase12-agent-session-api.test.ts`.

The implementation should remain flat and direct:

1. Give `AdapterRegistry` a stable four-ID production view while retaining concrete adapter instances only where configured.
2. Preserve manifest parsing and adapter-ID equality checks.
3. Expose sanitized readiness independently so one absent/offline adapter cannot hide healthy peers.
4. Add gateway methods for atomic World-owned create-and-attach and idempotent exact-owner end, rejecting those operations for Hermes.
5. Add bounded low-level routes for those gateway methods without introducing the Task 8 constellation service or roster lifecycle.
6. Make history transcript authority truthful per adapter: Hermes remains native/persistent authority; the three World-owned adapters expose only the bounded World projection.
7. Add one table-driven four-adapter contract suite plus focused registry/API regressions.
8. Retain adapter-specific parser/transport details in their existing Task 4–6 tests.

Suggested low-level route shape, subject to the five decisions below:

- `GET /agent-sessions/readiness`
- `POST /agent-sessions/world` — create a native World-owned identity and atomically persist the attached World session
- `POST /agent-sessions/:sessionId/world-end` — idempotently close only the exact World-owned native binding and mark its World projection terminal/stale

Do not add Task 8 `/constellation/*` routes, roster storage, readiness derivation, browser UI, grouped broadcast, Repository City movement, Dig, or voice.

## 4. Decisions for Aaron — answer in a fresh session

Reply with one letter for each item, for example: `1A 2B 3A 4A 5A`. The recommendation is identified but not selected on Aaron's behalf.

### 1. How should production registration represent an adapter that is not configured?

**A — Recommended: fixed four-slot registry.** Keep all four IDs in canonical order; each slot holds either its concrete adapter or a sanitized unavailable descriptor. Missing configuration remains visible and grey.

**B — Configured-only registry plus route merge.** Keep current concrete registration and separately merge safe configuration status into API output. This spreads truth across startup and route code.

**C — Lazy adapter factories.** Register four factories and construct/attest adapters on demand. This adds lifecycle complexity without a current need.

**D — Keep configured-only behavior.** Unconfigured adapters disappear. This is simplest but does not meet the frozen four-adapter grey/unavailable requirement.

### 2. What should the capability/readiness API expose?

**A — Recommended: preserve manifests and add readiness.** Keep `/agent-sessions/capabilities` shape-compatible for successfully attested manifests; add `/agent-sessions/readiness` with exactly four stable sanitized rows. One unavailable adapter must not suppress healthy peers.

**B — Replace capabilities with discriminated rows.** Return `{adapterId, enabled, manifest?, reason}` for all four from the existing endpoint. Cleaner as one call, but it breaks the current manifest-array response contract.

**C — Return only the four readiness rows.** Remove full manifest exposure from the normal API. This loses capability detail used by existing session/world-action paths.

**D — Keep the current all-or-nothing endpoint.** Any adapter attestation failure fails the full request. This does not provide truthful partial availability.

### 3. What deterministic fixture strategy should Task 7 use?

**A — Recommended: one shared contract fixture with four profiles.** Use a small table-driven fake adapter implementing the common contract, parameterized for Hermes operator-persistent ownership and three World-owned adapters. Keep real parser/transport behavior in existing adapter-specific tests.

**B — Reuse/export each existing adapter fixture.** Import OpenClaw gateway and Codex/Claude fake-executable harnesses into the conformance test. This increases coupling and requires fixture refactors outside the five-file scope.

**C — Duplicate four realistic native fixtures in the new file.** Self-contained but large, repetitive, and likely to drift.

**D — Use installed real runtimes in Vitest.** Highest realism but nondeterministic, slow, credential-dependent, and unsuitable for ordinary CI.

### 4. How broad should the deterministic conformance matrix be?

**A — Recommended: complete common matrix plus ownership-specific assertions.** For every adapter prove valid attestation, identity resolution/creation, attach/status, same-native-session text turn, bounded deltas/final, same-World reconnect, unavailable truth, safe projection, and no native-path/secret leakage. Add Hermes persistence and three-adapter World-end/later-World-fresh-identity assertions separately.

**B — Four independent adapter blocks.** Prove the same behaviors without a table. Easier to customize but repetitive and less effective at detecting contract drift.

**C — Registry/API smoke only.** Check four IDs, manifests, and one message per adapter while relying on existing tests for lifecycle. Faster but leaves Task 7's integrated lifecycle matrix incomplete.

**D — Attestation only.** Verify registration and capability schemas but not identity, turns, continuity, or teardown. This does not satisfy Task 7 acceptance.

### 5. What fresh real-adapter evidence should Task 7 collect?

**A — Recommended: accepted lifecycle receipts plus fresh harmless production attestation.** Reuse the parent-accepted real text/lifecycle receipts from Tasks 4–6 and the accepted Hermes persistent-session evidence; freshly exercise only production registration/readiness/capability attestation without creating sessions, sending turns, ending sessions, writing protected configuration, or signalling services unless deterministic proof exposes a concrete mismatch.

**B — Fresh full lifecycle for all four.** Re-run create/resolve → attach → two turns → reconnect → teardown/new-World checks for every adapter. Strong but repeats accepted evidence and touches protected live integrations more broadly.

**C — Fresh full lifecycle only for adapters changed by Task 7.** Run harmless attestation for untouched adapters and a full lifecycle only where gateway/route behavior changed. More adaptive, but the evidence set varies with the final diff.

**D — No live contact.** Use only deterministic fixtures and prior receipts. Lowest impact, but production registration/readiness would not be freshly exercised.

## 5. Implementation sequence after Aaron answers

### Task 7.1 — Record the five choices and refresh authority prose

- Record exact selections in this plan or a successor Task 7 scope section.
- Update stale Task 6-next prose in `AGENTS.md`, `PROJECT_STATUS.md`, `AgentIntersect_WorldDD.md`, and `docs/WORLD_ENTRY_EXPERIENCE.md` to Tasks 1–6 accepted / Task 7 active.
- Treat those four documents as a status-only scope exception to the five production/test paths; do not mix later-task claims into them.
- Run focused Prettier and `git diff --check`.

### Task 7.2 — Write the RED conformance matrix

**Files:**

- Create `apps/local-server/test/phase19-adapter-conformance.test.ts`.
- Modify `apps/local-server/test/phase12-agent-session-api.test.ts` for exact route-level RED cases.

**RED cases:**

- exactly four adapter identities in stable order;
- one absent/offline adapter cannot suppress healthy peers;
- invalid/mismatched manifest remains safely unavailable without leaking the thrown message;
- operator-persistent Hermes rejects World-owned creation/end;
- each World-owned adapter creates one exact native identity and attaches atomically to one World;
- same active World reconnect preserves exact root/effective identity;
- wrong/later World cannot attach an ended identity;
- explicit end is idempotent and cannot affect another World or adapter;
- one real-shaped text turn reaches the same persisted native root, with bounded ordered deltas and final text;
- history/readiness/capability responses contain no secret canaries, absolute native roots, executable arguments, credentials, or raw prompts;
- transcript authority is truthful for Hermes versus World-owned projections.

Run the single new file and focused API test; preserve the expected failures.

### Task 7.3 — Implement stable registry and readiness truth

**Files:**

- Modify `apps/local-server/src/agent-sessions.ts`.
- Modify `apps/local-server/src/index.ts`.

Implement the selected Decision 1 and Decision 2 options with the shortest direct structure. Preserve duplicate adapter rejection, canonical order, manifest schema validation, adapter-ID equality, and sanitized failure reasons.

Run the focused registry/conformance slice.

### Task 7.4 — Implement World-owned gateway lifecycle

**File:** `apps/local-server/src/agent-sessions.ts`.

- Add one create-and-attach method that requires adapter ID, World instance ID, bounded display identity, and existing World session binding fields.
- Require `createWorldSession` and manifest `shutdownOwner: "world"`.
- Atomically persist only after native creation and exact attach succeed; if persistence/attach fails after creation, perform only the exact owned cleanup supported by the adapter and return sanitized failure truth.
- Add exact-owner idempotent end through `endWorldSession`.
- Never expose these methods for Hermes.
- Preserve per-session serialization and existing capability snapshot checks.

Run the single lifecycle matrix.

### Task 7.5 — Implement route and projection truth

**File:** `apps/local-server/src/agent-session-routes.ts`.

- Add the selected readiness surface.
- Add strict bounded World-owned create and end route schemas.
- Declare `worldInstanceId` wherever the World-owned attach contract accepts it.
- Keep native root/effective IDs out of normal response projections except the minimum opaque binding returned to the trusted local caller where required by the existing session contract.
- Replace hard-coded Hermes transcript authority with a truthful adapter-derived projection.
- Preserve structured bounded error mapping and SSE limits.

Run the focused API tests.

### Task 7.6 — Wire production startup

**File:** `apps/local-server/src/index.ts`.

- Build the selected stable production registration in canonical order.
- Do not install/log in, mutate provider/model/profile/configuration, create a native session at startup, or signal Hermes/OpenClaw.
- Keep adapters optional by prerequisite while making absence visible.

Run local-server typecheck and build.

### Task 7.7 — Parent verification

Under Node `v24.18.0`, pnpm `11.15.0`, and `TURBO_CONCURRENCY=1`:

1. Inspect the actual five production/test path diff plus the status-only prose update.
2. Run the new conformance test.
3. Run `phase12-agent-session-api.test.ts`.
4. Run the existing shared gateway tests.
5. Run the four adapter-specific test files.
6. Run protocol and config regressions because Task 7 consumes both contracts.
7. Run local-server/package builds and local-server typecheck.
8. Run focused ESLint/Prettier and `git diff --check`.
9. Execute the real evidence boundary selected in Decision 5.
10. Re-attest protected-service/configuration state and process cleanup.

Stop after parent proof. Do not begin Task 8, browser UI, grouped broadcast, embodiment, Dig, voice, commit/push, or external delivery.

## 6. Expected verification commands

Exact commands should be confirmed against current root scripts before implementation. Expected focused forms:

```bash
TURBO_CONCURRENCY=1 corepack pnpm@11.15.0 exec vitest run \
  apps/local-server/test/phase19-adapter-conformance.test.ts \
  apps/local-server/test/phase12-agent-session-api.test.ts

TURBO_CONCURRENCY=1 corepack pnpm@11.15.0 exec vitest run \
  apps/local-server/test/phase12-agent-sessions.test.ts \
  apps/local-server/test/phase19-openclaw-session-adapter.test.ts \
  apps/local-server/test/phase19-codex-session-adapter.test.ts \
  apps/local-server/test/phase19-claude-code-session-adapter.test.ts \
  packages/agent-session-protocol/test/phase19-constellation.test.ts \
  packages/config/test/config.test.ts

TURBO_CONCURRENCY=1 corepack pnpm@11.15.0 --filter @agentintersect-world/local-server typecheck
TURBO_CONCURRENCY=1 corepack pnpm@11.15.0 --filter @agentintersect-world/local-server build
corepack pnpm@11.15.0 exec prettier --check \
  apps/local-server/src/index.ts \
  apps/local-server/src/agent-sessions.ts \
  apps/local-server/src/agent-session-routes.ts \
  apps/local-server/test/phase19-adapter-conformance.test.ts \
  apps/local-server/test/phase12-agent-session-api.test.ts
git diff --check
```

## 7. Risks and stopping rules

- Do not turn the registry into a generic plugin/factory framework.
- Do not unify the Codex and Claude process runners merely for conformance aesthetics.
- Do not move Task 8 roster/constellation ownership into Task 7.
- Do not make startup create native sessions or contact adapters beyond bounded attestation.
- Do not preserve the current hard-coded Hermes transcript label for non-Hermes sessions.
- Do not accept a capability endpoint where one unavailable adapter hides healthy peers.
- Do not rerun broad live lifecycles unless Aaron selects that evidence option or a concrete mismatch requires it.
- Do not edit protected profiles, external configuration, provider/model settings, credentials, or service processes.
- Do not commit, push, release, publish, deploy, tag, or change visibility without a separate gate.
