# In-World Workstream Authority Composition Implementation Plan

> **For Hermes:** Implement this plan in a fresh session with one bounded coding worker at a time, followed by independent parent verification. Do not begin implementation in the session that created this plan.

**Goal:** Turn the locally green read-only Workbench into one bounded, recoverable real-workstream lifecycle by reusing Phase 16 worktree authority and Phase 14 evidence semantics without creating a parallel executor.

**Architecture:** Preserve Phase 16’s accepted exactly-two-agent coordination protocol unchanged. Extract its repository/worktree validation and Git ownership mechanics into one narrow internal authority that Phase 16 continues to use and a new single-workstream facade may also call. Keep Phase 14’s fixed disposable journey unchanged; reuse its tool/edit/test evidence contracts through an adapter rather than pretending the fixture service can execute arbitrary repository work. The Workbench remains a projection/UI layer.

**Tech Stack:** TypeScript, Fastify, Zod, React, Vitest, Playwright, Git worktrees, existing AgentIntersect World persistence and protocol patterns.

---

## Accepted Product Decision

The forward route is:

> **Phase 16 owns where and by whom work happens; Phase 14 owns what happened and the evidence that proves it; Workbench owns how that truth is presented.**

Practical interpretation for the current repository:

- Preserve `CoordinationService` and its exactly-two-agent behavior.
- Reuse its approved-repository, allowed-worktree-parent, containment, Git, persistence, cancellation, and recovery boundaries.
- Do not call Phase 14’s fixed `src/greeting.mjs` fixture journey for arbitrary repository work.
- Reuse Phase 14 tool-event, edit, validation, approval, and evidence semantics through a thin adapter.
- Add no second process runner, arbitrary shell endpoint, generic orchestration framework, or normal-product navigation.

## Production Binding Decision Freeze — 2026-08-06

Aaron explicitly selected all five recommended production bindings before startup composition work:

1. **Agent/session owner:** bind the exact active single-agent World session rendered by `WorldEntryExperience`: `agentId = session.sessionId`, `nativeSessionId = session.adapterSessionRef`, and `revision = String(session.permissionRevision)`.
2. **Repository owner:** bind the active server repository generation: `repositoryId = currentRepositorySelection().snapshot.repositoryRef` and `revision = currentRepositorySelection().generation.id`.
3. **Worktree boundary:** reuse the canonical Phase 16 `AIW_PHASE16_REPOSITORY_ROOT` and `AIW_PHASE16_WORKTREE_PARENT` production configuration through a separate `WorktreeAuthority` instance. Do not add Workstream-specific root/parent environment variables.
4. **Durable state:** store Workstream state beneath the existing local data root at `path.join(config.presentationSync.dataDir, "..", "workbench", "workstreams")`. Do not add a state-directory environment variable.
5. **Phase 14 evidence ownership:** a Workstream starts with no evidence and may resolve only explicit `evidenceOperationRefs` it owns. Each referenced Phase 14 journey must additionally match repository, effective native session, and correlation through the non-mutating adapter. Never auto-link the current Phase 14 fixture journey.

The production startup may instantiate and register Workstream support only when a non-null Phase 16 Git boundary and Agent Session gateway exist. The routes may be registered before a repository is loaded, but `create` must fail closed until `currentRepositorySelection()` supplies the exact active generation and `AgentSessionGateway.status(agentId)` supplies the exact client-bound World/native session revision. Query gates, manual acceptance, delivery, hosted CI, publication, and normal-product exposure remain closed.

## Current Starting Point

- Worktree: `/home/user/.hermes/runs/aiw-repository-city-next-feature/worktree`
- Branch: `work/in-world-agent-workbench`
- Immutable stacked base / current HEAD: `4741e1906bc38fc2d814566bf63fa4b347fd1604`
- Existing implementation before this plan: eight modified tracked paths and three untracked source/test paths; zero staged; no upstream.
- Green evidence before this plan: impacted Vitest 73/73, complete Vitest 815/815 across 138 files, web TypeScript/build, monorepo build 20/20, lint/format/diff hygiene, and built-product demo/live Playwright 1/1 each.
- Current internal modes: `?workstreamTracer=demo` and `?workstreamTracer=live`.
- Manual visual/operator acceptance has not occurred.

## Non-Negotiable Boundaries

1. Do not modify or advance `work/repository-city-assets-20260805` while its exact-SHA hosted gate is unresolved.
2. Do not change Phase 16’s exactly-two-agent public protocol merely to make single-agent Workbench creation convenient.
3. Do not generalize Phase 14’s fixed disposable fixture by replacing its target/path literals with unchecked arbitrary inputs.
4. Do not create a second agent/process executor. A Workstream records and coordinates references to existing authorities.
5. No force-removal of a dirty worktree. Cancellation may delete only an owned, attested, clean worktree; otherwise retain it and report `cleanup-required` truthfully.
6. Keep all Workbench entry points query-gated until technical proof and Aaron’s manual visual acceptance are complete.
7. No commit, push, PR, merge, release, deployment, publication, visibility change, or Actions rerun without explicit approval.

---

## Stage A — Authority Spine

### Task 1: Re-attest the verified starting state

**Objective:** Prove the fresh session is operating on the intended branch, unchanged 11-path implementation, Node 24 runtime, and clean frozen base.

**Files:**

- Read: `AGENTS.md`
- Read: `.hermes/plans/2026-08-06_193237-workstream-authority-composition.md`
- Read: `apps/local-server/src/coordination-service.ts`
- Read: `apps/local-server/src/coordination-routes.ts`
- Read: `apps/local-server/src/phase14-service.ts`
- Read: `apps/local-server/src/phase14-routes.ts`
- Read: `apps/web/src/world-entry/workstream-tracer.ts`

**Steps:**

1. Confirm branch, HEAD, upstream, staged paths, all modified/untracked paths, and Node/pnpm versions.
2. Confirm the frozen repository-city worktree is clean and exact at `4741e190...`.
3. Re-run the 73-test impacted aggregate and `git diff --check` before changing code.
4. Stop if the 11-path implementation or immutable base has drifted; diagnose rather than normalizing it.

**Expected proof:** unchanged baseline and 73/73 focused tests green.

### Task 2: Write the failing reusable-worktree-authority contract

**Objective:** Define the smallest reusable Phase 16-derived worktree boundary before extracting implementation.

**Files:**

- Create: `apps/local-server/test/worktree-authority.test.ts`
- Later create: `apps/local-server/src/worktree-authority.ts`

**RED cases:**

1. An approved repository plus allowed parent creates one isolated worktree on a generated bounded branch.
2. A repository outside the approved root is refused before Git mutation.
3. A worktree outside the allowed parent is refused before Git mutation.
4. Symlink/path-containment escape is refused.
5. Replaying the same owner/request returns the same owned result without creating another worktree.
6. A different owner cannot attach, cancel, or remove the worktree.
7. Clean owned cancellation removes the worktree and proves it absent.
8. Dirty owned cancellation does not force-delete; it returns `cleanup-required` and preserves the worktree.
9. Disposal leaves zero owned child processes.

**Run:**

```bash
corepack pnpm@11.15.0 exec vitest run apps/local-server/test/worktree-authority.test.ts --maxWorkers=1 --no-file-parallelism
```

**Expected RED:** module/authority does not yet exist.

### Task 3: Extract the minimal internal worktree authority

**Objective:** Make Phase 16’s existing Git/worktree boundary reusable without changing its public coordination contract.

**Files:**

- Create: `apps/local-server/src/worktree-authority.ts`
- Modify: `apps/local-server/src/coordination-service.ts`
- Test: `apps/local-server/test/worktree-authority.test.ts`
- Regression: `apps/local-server/test/phase16-coordination-service.test.ts`
- Regression: `apps/local-server/test/phase16-coordination-git.test.ts`
- Regression: `apps/local-server/test/phase16-coordination-corrections.test.ts`

**Implementation shape:**

- Move only repository canonicalization, approved-root checks, allowed-parent containment, bounded Git invocation, create/attach measurement, ownership receipt, and clean-only removal into `WorktreeAuthority`.
- Keep Phase 16 snapshot/action semantics, exact agents, revisions, handoff, conflict, and candidate preparation in `CoordinationService`.
- `CoordinationService` delegates to `WorktreeAuthority`; it must not reach into new Workstream state.
- The authority returns bounded identifiers/receipts and normalized relative facts; it does not expose a generic shell command.

**GREEN commands:**

```bash
corepack pnpm@11.15.0 exec vitest run \
  apps/local-server/test/worktree-authority.test.ts \
  apps/local-server/test/phase16-coordination-service.test.ts \
  apps/local-server/test/phase16-coordination-git.test.ts \
  apps/local-server/test/phase16-coordination-corrections.test.ts \
  --maxWorkers=1 --no-file-parallelism
corepack pnpm@11.15.0 --filter @agentintersect-world/local-server typecheck
```

**Expected GREEN:** new authority contract passes and existing Phase 16 behavior is byte/semantics compatible at its public boundary.

---

## Stage B — One Real Workstream Lifecycle

### Task 4: Write the failing Workstream lifecycle service tests

**Objective:** Specify one repository + one selected agent + one owned worktree lifecycle with deterministic replay and safe cancellation.

**Files:**

- Create: `apps/local-server/test/workstream-service.test.ts`
- Later create: `apps/local-server/src/workstream-service.ts`

**Canonical first-slice states:**

```text
planning -> working -> completed
                   -> blocked
                   -> cancelled
                   -> cleanup-required
```

**RED cases:**

1. Create requires an approved current repository identity and one exact connected-agent/session binding.
2. Create allocates one worktree through `WorktreeAuthority`; it never invokes Phase 14 fixture creation.
3. Duplicate request/correlation IDs replay the same Workstream.
4. Conflicting reuse of an ID fails before mutation.
5. Snapshot persists only user-facing lifecycle plus references to authority/evidence records, not copied Phase 16 or Phase 14 state.
6. Restart recovery restores the same current Workstream and classifies missing/dirty worktrees truthfully.
7. Cancel stops only owned activity and removes only an attested clean worktree.
8. Dirty cancellation becomes `cleanup-required`; no force deletion occurs.
9. A stale/mismatched agent, repository, worktree owner, or revision is refused before mutation.
10. Only one active Workstream is allowed in the initial vertical slice.

**Expected RED:** `WorkstreamService` does not exist.

### Task 5: Implement the thin Workstream service

**Objective:** Add orchestration references and durable lifecycle state without duplicating execution authority.

**Files:**

- Create: `apps/local-server/src/workstream-service.ts`
- Modify: `apps/local-server/src/app.ts`
- Test: `apps/local-server/test/workstream-service.test.ts`

**Rules:**

- Store a checksummed current/previous generation using existing persistence conventions.
- Keep records bounded: workstream ID, title, repository identity, selected agent/session reference, authority receipt/worktree reference, Phase 14 evidence operation references, status, timestamps, and append-only lifecycle events.
- Do not store raw source, full diffs, credentials, command lines, absolute private paths in browser DTOs, or duplicated Phase 16 snapshots.
- Do not execute arbitrary commands.
- Dependency-inject `WorktreeAuthority` and an evidence reader; keep functions flat and explicit.

**Expected GREEN:** `workstream-service.test.ts` passes with no Phase 14 fixture mutation and existing Phase 16 tests remain green.

### Task 6: Add the narrow loopback API

**Objective:** Expose only create/read/cancel for the initial Workstream lifecycle.

**Files:**

- Create: `apps/local-server/src/workstream-routes.ts`
- Create: `apps/local-server/test/workstream-api.test.ts`
- Modify: `apps/local-server/src/app.ts`

**Routes:**

```text
POST /workstreams
GET  /workstreams/current
GET  /workstreams/:workstreamId
POST /workstreams/:workstreamId/cancel
```

**Boundaries:**

- Strict JSON schemas; reject unknown fields.
- Reuse local-server envelope/error conventions.
- Create accepts bounded intent and existing repository/agent references—not arbitrary filesystem paths or shell commands.
- Cancel is idempotent and ownership-bound.
- No apply/edit/test/preview/approve route in this stage.

**RED/GREEN command:**

```bash
corepack pnpm@11.15.0 exec vitest run \
  apps/local-server/test/workstream-service.test.ts \
  apps/local-server/test/workstream-api.test.ts \
  --maxWorkers=1 --no-file-parallelism
```

---

## Stage C — Phase 14 Evidence Composition

### Task 7: Move Phase 14 projection semantics behind a server-side adapter

**Objective:** Attach authoritative Phase 14 evidence to a Workstream without making the fixed fixture service the executor.

**Files:**

- Create: `apps/local-server/src/workstream-phase14-adapter.ts`
- Create: `apps/local-server/test/workstream-phase14-adapter.test.ts`
- Modify: `apps/local-server/src/workstream-service.ts`
- Reference only: `apps/local-server/src/phase14-service.ts`
- Modify later: `apps/web/src/world-entry/workstream-tracer.ts`

**Adapter behavior:**

- Accept a `Phase14Journey`/tool-event snapshot plus the owning Workstream reference.
- Project operation IDs, lifecycle, edit digest/evidence, test state/evidence, preview state/evidence, and timestamps.
- Reject mismatched Workstream/repository/session/correlation references.
- Preserve absent facts as absent; never synthesize a change, validation pass, or completion.
- The adapter cannot call `createJourney`, `approve`, `apply`, `runTest`, or `startPreview`.

**First-stage limitation:** A newly created generic Workstream may have no Phase 14 evidence until an accepted agent/tool integration emits correlated evidence. That is truthful and preferable to running the disposable fixture.

### Task 8: Add the web client and authoritative Workbench mode

**Objective:** Replace the current Phase 14-only live fetch with a real current-Workstream read while keeping demo and Phase 14 diagnostic modes truthful.

**Files:**

- Create: `apps/web/src/world-entry/workstream-client.ts`
- Modify: `apps/web/src/world-entry/workstream-tracer.ts`
- Modify: `apps/web/src/world-entry/WorldRoom.tsx`
- Modify: `apps/web/src/world-entry/WorkInspector.tsx`
- Modify: `apps/web/src/world-entry/RepositoryAssetPalette.tsx`
- Test: `apps/web/test/workstream-tracer.test.ts`
- Test: `apps/web/test/repository-asset-palette.test.tsx`

**Mode contract:**

```text
?workstreamTracer=demo      -> deterministic fixture, visibly labeled
?workstreamTracer=live      -> current real Workstream API
?workstreamTracer=phase14   -> optional internal Phase 14 diagnostic projection, if retained
```

**UI behavior:**

- Loading, absent, error, active, blocked, cleanup-required, cancelled, and completed states remain explicit.
- Inspector actions in the first mutating slice are only create and cancel where authority is available.
- Changed-file and validation facts appear only from correlated evidence.
- Repository-city selection continues using stable repository asset IDs/paths.
- Keep all controls accessible and keyboard-operable.

### Task 9: Prove the built-product lifecycle

**Objective:** Establish one real create -> worktree ready -> inspect -> cancel -> clean removal journey without normal-product exposure.

**Files:**

- Modify: `apps/web/e2e/world-entry-single-agent.spec.ts`
- Add local-server API coverage as needed under `apps/local-server/test/`

**Built-product acceptance:**

1. Select/load one approved repository.
2. Activate internal Workbench mode.
3. Create one Workstream bound to the current selected agent/session.
4. Observe truthful `planning` then `working`/worktree-ready state.
5. Inspect its repository/worktree facts.
6. Cancel it.
7. Prove the owned clean worktree is removed, current state is `cancelled`, and no process/listener remains.
8. Repeat cancel and prove idempotent replay.
9. Exercise dirty cleanup refusal and prove the worktree is retained as `cleanup-required`.

**Do not claim:** real file editing, approval, testing, preview, or completed coding until correlated evidence proves those later slices.

---

## Verification Matrix

Run under Node `v24.18.0`, pnpm `11.15.0`, bounded heap, and `TURBO_CONCURRENCY=1`.

### Focused while developing

```bash
corepack pnpm@11.15.0 exec vitest run \
  apps/local-server/test/worktree-authority.test.ts \
  apps/local-server/test/workstream-service.test.ts \
  apps/local-server/test/workstream-api.test.ts \
  apps/local-server/test/workstream-phase14-adapter.test.ts \
  apps/web/test/workstream-tracer.test.ts \
  apps/web/test/repository-asset-palette.test.tsx \
  --maxWorkers=1 --no-file-parallelism
```

### Required regressions

- Existing Phase 16 service/API/Git/correction tests.
- Existing Phase 14 service/API/process-recovery/UI tests.
- Current Workbench demo and Phase 14 read-only tests.
- World-entry movement, repository-city, and imported-avatar slices affected by `WorldRoom`.

### Final parent proof

```bash
corepack pnpm@11.15.0 exec vitest run --maxWorkers=1 --no-file-parallelism
corepack pnpm@11.15.0 build
corepack pnpm@11.15.0 exec eslint <all-changed-ts-tsx-files>
corepack pnpm@11.15.0 exec prettier --check <all-changed-files>
git diff --check
```

Then run the exact built-product Workbench Playwright journey plus existing demo/live regressions. Perform Aaron-owned manual visual acceptance before exposing normal-product navigation or calling the mutating slice accepted.

## Likely File Set

**New:**

- `apps/local-server/src/worktree-authority.ts`
- `apps/local-server/src/workstream-service.ts`
- `apps/local-server/src/workstream-routes.ts`
- `apps/local-server/src/workstream-phase14-adapter.ts`
- `apps/local-server/test/worktree-authority.test.ts`
- `apps/local-server/test/workstream-service.test.ts`
- `apps/local-server/test/workstream-api.test.ts`
- `apps/local-server/test/workstream-phase14-adapter.test.ts`
- `apps/web/src/world-entry/workstream-client.ts`

**Modified:**

- `apps/local-server/src/coordination-service.ts`
- `apps/local-server/src/app.ts`
- current Workbench source/tests under `apps/web/src/world-entry/` and `apps/web/test/`
- `apps/web/e2e/world-entry-single-agent.spec.ts`

Avoid creating a new package or general plugin framework unless implementation evidence proves the app-local boundary insufficient.

## Risks and Stop Conditions

- **Phase 16 regression:** stop if extracting authority changes its exact-two-agent projection, revisions, candidate preparation, or recovery behavior.
- **Dirty cleanup:** never force-delete; retain and surface `cleanup-required`.
- **Phase 14 overreach:** stop if the implementation starts parameterizing the fixed fixture into a generic executor without a separate approved design.
- **Competing truth:** stop if Workstream begins copying full Phase 16/14 state instead of retaining references and projections.
- **Agent authority ambiguity:** stop before mutation if the selected World agent cannot be bound to one exact native session.
- **Base instability:** keep repository-city hosted CI remediation separate; do not amend the frozen base from the feature branch.
- **Product decision:** ask Aaron before normal-product exposure, arbitrary real edits, or broader multi-agent Workbench behavior.

## Exit Gate for the Next Session

The next session may call its first mutating slice technically green only when:

- Phase 16 public behavior remains unchanged;
- one real Workstream creates exactly one owned isolated worktree;
- restart/replay is deterministic;
- cancellation removes only an owned clean worktree;
- dirty cancellation retains evidence and reports `cleanup-required`;
- Phase 14 evidence is correlated through an adapter and never fabricated;
- full Node-24 tests/build and exact built-product journey pass;
- no worker, child, listener, or test worktree remains;
- the feature stays internal/query-gated pending Aaron’s manual visual acceptance;
- no commit or delivery action occurs without explicit approval.
