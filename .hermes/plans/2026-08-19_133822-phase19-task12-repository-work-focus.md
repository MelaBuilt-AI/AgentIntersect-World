# Phase 19 Task 12 Repository Work Focus Implementation Plan

> **For Hermes:** Load `test-driven-development`, `pragmatic-secure-delivery`, `verification-integrity`, `embodied-agent-world-interactions`, `frontend-delivery-verification`, and the imported-avatar review guidance before implementation. Implement task-by-task only after Aaron explicitly authorizes Task 12 implementation. Do not commit, push, open a PR, merge, publish, release, or deploy without separate delivery authorization.

**Goal:** Move each coding agent to the most specific live repository object supported by authoritative structured evidence, start Dig only after exact arrival plus active coding evidence, and stop or retarget truthfully without cross-agent state leakage.

**Architecture:** Extend the existing adapter event seam with an ephemeral, allowlisted repository locator; resolve that locator server-side against the selected repository snapshot; project one bounded `AgentRepositoryWorkFocus` per exact World session/roster agent; and submit one existing generation-bound `repository-object` movement request through `WorldActionService`. The browser continues to execute movement and report arrival, but lifts movement and animation state from one primary agent to maps keyed by `rosterId`. Coding animation is a derived conjunction—active coding evidence **and** exact object/generation arrival—not a new authority.

**Tech Stack:** TypeScript, Zod, Fastify, React, React Three Fiber/Three.js, Vitest, Playwright, Python avatar registry generator, existing World Action and repository snapshot contracts.

**Status (2026-08-20): IMPLEMENTED AND PARENT-ACCEPTED.** Exact structured adapter evidence now resolves one current live repository object, drives each roster agent independently through the existing generation-bound movement contract, and exposes coding only after matching arrival. No operator Dig mapping was approved, so imported agents truthfully retain the accepted Work/static coding fallback. Fresh Node `v24.18.0` focused, impacted, broad-classified, build, typecheck, lint, formatting, architecture, and headed production-browser verification passed. Task 13+, Phase 20, and all Git/delivery/publication actions remain closed.

---

## 0. Authorization and scope boundary

Task 12 implementation and independent parent acceptance are complete. This plan now records the accepted contract and retained evidence; it does not authorize Task 13+, Phase 20, or delivery.

### Authorized only after a new explicit Task 12 implementation approval

- Add RED tests and the minimal production code described below.
- Run focused local tests and the bounded headed acceptance fixture.
- Prepare an inherited-worktree reconciliation receipt.

### Still requires separate explicit approval even after implementation approval

- Any operator Dig semantic verdict or generated semantic-registry mutation.
- Any commit, push, PR, merge, tag, release, deployment, publication, public ingress, or visibility change.
- Package installation, provider/profile changes, protected service restarts, or changes outside the existing dependency graph.

### Explicit exclusions

- No inference from assistant prose such as “I am editing X.”
- No parsing shell command strings, assistant text, tool previews, or untyped result text for paths.
- No same-name object substitution.
- No teleporting to object centers or placement inside repository-city geometry.
- No new movement engine, animation authority, repository index, workstream authority, or WebSocket transport.
- No Task 13+, Phase 20, delivery, publication, or release work.
- No hand-editing `packages/avatar-system/src/imported-avatar-registry.generated.ts`.

## 1. Planning attestation

Verified before this plan was written:

- Worktree: `/home/mela_ai/.hermes/runs/aiw-repository-city-next-feature/worktree`
- Branch: `feature/phase19-multi-agent-constellation`
- HEAD: `f4b23b31a131580e1ddd9fb10274919be434bf68`
- Upstream: none
- Staging: empty
- Inherited unstaged boundary: exactly 52 paths
  - 31 modified tracked paths
  - 21 untracked paths
- `final-reconciliation.json`: zero unauthorized mismatches, zero missing baseline paths, zero unexpected extra paths.
- Canonical document hashes match `task12-planning-mirror-parity.json` exactly.
- Task 12 candidate path hashes were captured before this plan; no implementation path was changed while planning.
- Three proposed handoff paths do not exist and should **not** be created as duplicate abstractions:
  - `apps/web/src/agent-sessions-client.ts`
  - `apps/web/src/world-agent-movement-client.ts`
  - `apps/web/src/WorldSessionPage.tsx`
- Reuse the actual accepted seams instead:
  - `apps/web/src/sessions/session-client.ts`
  - `apps/web/src/world-entry/world-agent-movement-client.ts`
  - `apps/web/src/world-entry/WorldEntryExperience.tsx`

The only expected planning drift is this markdown file. Before implementation, re-attest that the original 52 paths are byte-identical to the planning capture and that this plan is the only additional path.

## 2. Frozen acceptance contract

1. Structured read/edit/tool evidence resolves to the most specific **live** repository object: symbol evidence if a live symbol object exists, otherwise file, directory, then package.
2. Assistant prose never creates a work-focus event.
3. A new current focus emits exactly one existing generation-bound `repository-object` movement request with exact `objectRef` and `layoutGeneration`.
4. Stale, missing, hidden, unreachable, outside-root, or ambiguous targets fail closed; no same-name substitution and no placement inside geometry.
5. Every roster agent owns independent focus, movement, arrival, and animation state.
6. Coding motion starts only after the same focus has both active `coding` evidence and exact-object arrival.
7. Coding motion stops on completed, failed, cancelled, stale, retargeted, moved-away, disconnect, authority failure, or restart.
8. Retargeting stops coding motion before moving and resumes only after truthful arrival at the new exact target.
9. Reduced motion keeps the avatar at the exact safe approach point and exposes a static semantic `coding` indication.
10. Missing or unapproved Dig mappings fall back to generic Work; mappings are never guessed by clip name, anonymous index, duration, or structural ordering.

## 3. Contract decisions

### 3.1 Authoritative adapter locator

Add an **ephemeral** adapter-only locator. It must never be copied into display text, persisted event payloads, logs, API errors, or receipts.

```ts
export type AdapterRepositoryLocator = {
  readonly operation: "read" | "edit" | "tool";
  readonly paths: readonly string[]; // 1..32, each <= 4096 UTF-8 bytes
  readonly symbol?: {
    readonly name?: string;
    readonly line?: number;
    readonly column?: number;
  };
};

export type AdapterTurnEvent = {
  readonly type:
    | "assistant.delta"
    | "tool.started"
    | "tool.completed"
    | "tool.failed"
    | "turn.completed";
  readonly text?: string;
  readonly toolName?: string;
  readonly activityId?: string;
  readonly repositoryLocator?: AdapterRepositoryLocator;
  readonly redaction?: RedactionMetadata;
};
```

Rules:

- `activityId` is stable for one tool lifecycle.
- Codex uses the provider item ID.
- Claude Code uses the `tool_use.id`/matching result ID.
- Hermes and OpenClaw use a provider call ID when present; otherwise the adapter allocates a bounded per-turn ID at `tool.started` and pairs terminal events by the exact serial tool lifecycle. If pairing is ambiguous, emit no locator/focus terminal correlation and fail closed.
- Keep only allowlisted path fields. Discard all other arguments immediately.
- Unknown tool names or unknown argument shapes produce ordinary tool activity with no repository locator.

Harness field policy:

| Harness     | Accepted structured source                                                                                                                                                                | Refused source                                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Codex       | `file_change.changes[].path`; allowlisted MCP tool argument path fields                                                                                                                   | `command_execution.command`, model prose, output text                                                                                     |
| Claude Code | `tool_use.input.file_path`, `.path`, or `.notebook_path` for allowlisted read/edit/write tools **when an independently authorized production configuration actually enables those tools** | generic input recursion, shell command strings, tool result text; Task 12 must not remove the current production `--tools ""` restriction |
| Hermes      | typed `data.args` path fields for allowlisted tools                                                                                                                                       | `preview`, assistant text, arbitrary nested strings                                                                                       |
| OpenClaw    | typed tool-stream `data.args` path fields for allowlisted tools                                                                                                                           | generic payload text, result content, assistant prose                                                                                     |

The allowlist is explicit and tested. Do not recursively scan arbitrary JSON for strings that look like paths.

Adapters report provider-native activity only; they never self-assert repository, worktree, repository-generation, or code-graph identity. The gateway enriches a validated ephemeral locator from the exact persisted session/workstream binding and current repository selection. Production Claude Code currently disables tools with `--tools ""`; therefore it has no live tool-backed focus source unless that capability is separately reviewed and authorized. In the current scope it may receive a structured workstream recovery target, but it must not enter Dig without active tool evidence.

### 3.2 Repository path resolution

Create one pure server resolver that consumes the ephemeral locator plus the exact selected repository generation.

Resolution algorithm:

1. Confirm the session `repositoryRef` matches the current selected snapshot.
2. Normalize separators to POSIX form.
3. Resolve absolute paths only when they are under `RepositoryGeneration.rootPath`; resolve relative paths against that root.
4. Reject traversal, NUL/control characters, outside-root paths, empty paths, and more than 32 paths.
5. Match current snapshot objects by canonical path and current state only.
6. For one path, prefer a live symbol object only if it is present in the authoritative current target set and uniquely matches the supplied line/name; otherwise use the exact live file.
7. If the file is new or absent from the snapshot, walk to the nearest live parent directory, then package.
8. For multiple paths, select the deepest common live directory/package; never choose an arbitrary file.
9. Tombstones, stale generations, hidden objects, unreachable objects, and ambiguous symbol matches return a refusal—not a substitute.
10. Return only `{ objectRef, objectKind, repositoryPath, layoutGeneration }`; do not retain the raw locator.

Current server truth uses `layout-${selection.snapshot.generationFingerprint}`. The browser currently stores only `snapshot.generationFingerprint`; Task 12 must align the browser to the same canonical layout-generation string before repository-object movement is allowed.

Symbols are not automatically valid movement targets. Current snapshot city objects are package/directory/file objects; code-graph symbols use `aiw://symbol/...` and are not in the current World Action target set. Therefore symbol evidence normally resolves to its containing live file. A symbol may be targeted only if a future/current snapshot actually exposes it as a live target with a safe approach point; Task 12 must not fabricate one.

### 3.3 Work-focus ownership and retention

`AgentSessionGateway` owns one in-memory current focus per exact World session. `rosterId` is carried explicitly even where it currently equals the World session ID.

- Maximum: one current focus per live session; therefore bounded by the existing session limit.
- Keep terminal focus long enough for one client observation (5 seconds), then clear it.
- Do not persist raw locators.
- Process restart clears active focus. The web client treats unavailable/empty focus as interruption and immediately stops coding motion.
- Existing durable workstream projection is a **recovery target hint only**: for an exact active session/workstream binding, structured `projection.changedFiles[].path` may reconstruct a `source: "workstream-binding"` target. That list is authoritative for the changed-file set, not for the single actively edited file; one path may target its live file, while multiple paths resolve to their deepest common live directory/package. It may move the agent, but it cannot start Dig without a new active coding tool event.
- Never use `projection.currentActivity` or workstream task prose as repository evidence.

State transitions:

| Event                                     | Next focus state             | Animation consequence                                              |
| ----------------------------------------- | ---------------------------- | ------------------------------------------------------------------ |
| structured `tool.started` resolves target | `targeted`                   | stop Work/Dig; submit one movement                                 |
| movement accepted                         | `navigating`                 | Walk/Run only                                                      |
| exact matching arrival while tool active  | `coding`                     | Dig if approved, else Work                                         |
| `tool.completed`                          | `completed`                  | stop coding, return Idle                                           |
| `tool.failed`                             | `failed`                     | stop coding, return Idle/Error projection only if already accepted |
| abort/cancel/disconnect/restart           | `cancelled` or clear         | stop coding immediately                                            |
| newer focus                               | old `stale`, new `targeted`  | stop, retarget, then resume after new arrival                      |
| generation/object mismatch                | `stale`                      | no movement and no coding                                          |
| actor moves away                          | `navigating`/cleared arrival | stop coding                                                        |

### 3.4 Existing movement authority reuse

Do not create a second movement engine.

- Server submits one `move-agent` proposal through `WorldActionService.propose`.
- Source: `agent-autonomous`.
- Target: `{ kind: "repository-object", objectId, layoutGeneration }`.
- Actor ID: exact World session ID bound to that roster agent.
- A stable focus `activityId` becomes the source request/correlation ID, so replay produces no duplicate movement.
- Existing supersession cancels an older active autonomous movement when a newer focus arrives.
- Existing user-directed movement remains higher priority (`user-directed-active` refusal).
- Existing target validation, generation binding, lease expiry, and safe approach-point machinery remain authoritative.

### 3.5 Exact arrival gate

Coding is true only when all fields match:

```ts
activeTool.activityId === focus.activityId &&
  arrival.requestId === focus.movementRequestId &&
  arrival.actorId === focus.worldSessionId &&
  arrival.objectRef === focus.objectRef &&
  arrival.layoutGeneration === focus.layoutGeneration &&
  currentLayoutGeneration === focus.layoutGeneration &&
  actorIsAtSafeApproachPoint === true;
```

Any missing field means no coding. `arrived` from an older request, another roster agent, another object, or another generation must not unlock animation.

### 3.6 Independent roster-agent composition

Lift these single-agent values to maps keyed by `rosterId`:

- current focus
- movement request/control
- movement state and position
- handled request/control cursors
- exact arrival receipt
- animation state/action
- coding semantic (`Dig` or `Work`)

`WorldEntryExperience` polls focus and movement authority for every connected roster agent, not only the primary session. `WorldRoom` owns the local motion integration per roster entry. The renderer receives each agent’s own position and action.

Safe approach selection must include:

- repository object footprint
- user position
- all other agent positions
- avatar radius and clearance
- deterministic candidate ordering

If every candidate overlaps or is unreachable, refuse. Never fall back to the object center.

### 3.7 Dig mapping gate and Work fallback

- Add `Dig` as a requested coding semantic only after an operator verdict for that exact imported model and clip.
- Extend the existing local developer animation review manifest/receipt workflow; do not infer from names or indices.
- `tooling/avatar/inspect_imported_avatars.py` remains the only generator for `imported-avatar-registry.generated.ts`.
- The generator accepts an explicit sanitized Dig receipt, verifies model ID, clip index, verdict, and evidence reference, and emits a pass mapping only for reviewed models.
- Models without a pass retain generic Work.
- If Aaron does not approve any Dig mapping, Task 12 remains valid with Work for every model.
- Custom avatars use the already accepted `AvatarAction = "Work"` motion.
- Imported avatars without approved Dig keep their truthful model-local static/Idle pose and receive the shared visible `coding` badge/halo; they must not relabel an Idle clip as Work or Dig.
- This is the generic Work semantic fallback: coding state is visible and accessible, but unapproved clip semantics are never claimed.

**Mandatory operator pause:** implementation must stop after producing the review UI/receipt candidate and ask Aaron to review. Registry generation may proceed only after explicit approval of the exact model/clip verdicts.

### 3.8 Reduced-motion indication

When reduced motion is enabled:

- movement resolves immediately to the exact safe approach point using the existing reduced-motion movement path;
- animation mixers remain paused/static;
- the agent name badge adds a visible `· coding` suffix and a stable cyan coding halo/marker;
- the semantic DOM/canvas boundary exposes `data-agent-work-state="coding"`, `data-agent-object-ref`, and `aria-label="<name> coding at <repository path>"` on the appropriate projected wrapper/status element;
- clearing/retargeting removes the coding indication before any new target is accepted.

The badge/halo is also present during generic Work fallback in normal motion, so imported avatars without Dig remain truthful.

## 4. Files likely to change

### Protocol and server

- Modify `packages/agent-session-protocol/src/index.ts`
  - tighten/export work-focus and focus-state contracts;
  - add typed API projection if needed;
  - keep raw adapter locators out of the public/persistent schema.
- Add `packages/agent-session-protocol/test/phase19-task12-work-focus.test.ts`.
- Modify `apps/local-server/src/agent-sessions.ts`
  - add ephemeral adapter locator/activity fields;
  - own bounded per-session focus lifecycle;
  - correlate tool start/terminal events;
  - expose current focus.
- Modify `apps/local-server/src/codex-session-adapter.ts`.
- Modify `apps/local-server/src/claude-code-session-adapter.ts`.
- Modify `apps/local-server/src/openclaw-session-adapter.ts`.
- Add `apps/local-server/src/repository-work-focus.ts`
  - one pure path/object resolver and focus transition reducer.
- Modify `apps/local-server/src/agent-session-routes.ts`
  - add bounded `GET /agent-sessions/:sessionId/work-focus`.
- Modify `apps/local-server/src/index.ts`
  - inject current repository/workstream resolver and submit movement through existing `WorldActionService`.
- Modify `apps/local-server/test/phase19-adapter-conformance.test.ts`.
- Modify harness-specific Phase 19 adapter tests.
- Add `apps/local-server/test/phase19-repository-work-focus.test.ts`.
- Add `apps/local-server/test/phase19-repository-work-focus-api.test.ts`.

### Web movement and composition

- Modify `apps/web/src/sessions/session-client.ts`
  - fetch/parse current focus; no duplicate top-level client.
- Modify `apps/web/src/world-entry/world-agent-movement-client.ts`
  - preserve exact actor/object/generation fields in movement/arrival projection.
- Modify `apps/web/src/world-entry/WorldEntryExperience.tsx`
  - canonicalize layout generation;
  - poll focus/movement per roster session;
  - hold keyed focus/movement controls;
  - clear all keyed state on leave/restart/authority failure.
- Modify `apps/web/src/world-entry/world-agent-movement-model.ts`
  - expose exact arrival object/generation;
  - include occupied actors in safe target selection;
  - stop coding when moved away or stale.
- Modify `apps/web/src/world-entry/WorldRoom.tsx`
  - lift movement and animation to per-roster maps;
  - derive coding only from exact arrival plus active focus;
  - emit per-agent movement events;
  - project reduced-motion/static coding semantics.
- Modify `apps/web/test/phase19-multi-agent-chat.test.tsx` only where accepted Task 11 fixtures require the richer roster props.
- Add `apps/web/test/phase19-task12-repository-work-focus.test.tsx`.
- Add `apps/web/e2e/phase19-task12-two-agent-coding.spec.ts`.

### Avatar and renderer

- Modify `packages/avatar-system/src/imported-avatar.ts`
  - represent approved Dig and generic Work fallback without guessing.
- Do **not** hand-edit `packages/avatar-system/src/imported-avatar-registry.generated.ts`.
- Modify `tooling/avatar/inspect_imported_avatars.py` only after the operator-review contract is approved.
- Modify `tooling/avatar/operator_semantic_receipts.test.ts`.
- Modify `packages/avatar-system/test/avatar-replacement-v2.test.ts`.
- Modify `packages/renderer-r3f/src/imported-avatar-animation.ts` only if the approved Dig clip needs an explicit looping policy; otherwise leave it unchanged.
- Modify `packages/renderer-r3f/src/world-room-canvas.tsx`
  - accept per-roster procedural-avatar position, heading, action, and observability attributes;
  - stop applying active movement/action only to avatar index 0.
- Modify `packages/renderer-r3f/src/world-room-imported-canvas.tsx`
  - accept per-agent action/position;
  - render coding badge/halo and semantic attributes;
  - keep mixers static under reduced motion.
- Modify `packages/renderer-r3f/test/imported-avatar-renderer.test.tsx`.

### Canonical docs after acceptance only

- Update `.hermes/plans/2026-08-11_211034-phase19-multi-agent-constellation.md` with Task 12 acceptance receipt only after parent acceptance.
- Update `PROJECT_STATUS.md` and `docs/WORLD_ENTRY_EXPERIENCE.md` only after implementation and headed acceptance are complete.

## 5. RED-first implementation sequence

### Task 1: Re-attest and freeze the inherited boundary

**Objective:** Prove implementation begins from the accepted Task 11 state plus this plan only.

**Steps:**

1. Capture branch, HEAD, upstream, staged paths, and NUL-safe status inventory.
2. Compare all original 52 paths and candidate hashes with the planning capture.
3. Assert this plan is the only new path.
4. Refuse implementation if any unrelated drift exists.

**Expected:** unchanged HEAD, no upstream, empty staging, original 52-path baseline intact, one planning-only addition.

### Task 2: RED—protocol and pure focus lifecycle

**Files:** protocol test plus new server resolver test.

Write failing cases for:

- strict work-focus parsing;
- one current focus per session/roster;
- targeted → navigating → coding → completed;
- failed/cancelled/stale/retargeted/restart clearing;
- terminal focus expiry;
- exact activity/object/generation correlation;
- no raw path/args in serialized public focus.

Run:

```bash
PATH=/home/mela_ai/.nvm/versions/node/v24.18.0/bin:$PATH \
  corepack pnpm@11.15.0 exec vitest run \
  packages/agent-session-protocol/test/phase19-task12-work-focus.test.ts \
  apps/local-server/test/phase19-repository-work-focus.test.ts \
  --maxWorkers=1 --no-file-parallelism
```

Expected: RED for missing resolver/lifecycle behavior, not fixture/bootstrap failure.

### Task 3: RED—structured adapter evidence

Write one table-driven conformance matrix and harness-specific cases:

- accepted exact path fields for read/edit/write/file-change events;
- stable activity correlation;
- multiple paths;
- unknown tools;
- path-looking assistant prose;
- shell command text;
- arbitrary nested strings;
- secrets in args/previews;
- ambiguous terminal pairing.

Expected contract: accepted events expose only bounded locator fields to the in-process gateway; persisted/display events contain neither path args nor secrets.

Run the four Phase 19 adapter test files plus adapter conformance. Expected: RED only for the new locator contract.

### Task 4: GREEN—minimal adapter extraction

Implement explicit allowlists per harness. Do not create a generic recursive argument scanner.

Verification:

- focused adapter suite passes;
- existing redaction assertions still pass;
- path/source secrets are absent from event-history JSON and error text.

### Task 5: RED—live object resolution and generation binding

Add fixtures for:

- exact file;
- symbol evidence falling back to containing live file when no live symbol target exists;
- nearest live directory for a new file;
- package fallback;
- deepest common ancestor for multiple paths;
- absolute path inside selected root;
- outside-root/traversal/control-character refusal;
- tombstone/stale/hidden/unreachable refusal;
- duplicate same-name objects;
- repository mismatch;
- canonical `layout-<fingerprint>` output.

Expected: no same-name or stale substitution.

### Task 6: GREEN—focus coordinator and existing World Action submission

Implement the pure resolver, then wire it into `AgentSessionGateway`/`index.ts`.

For each new resolved `tool.started` focus:

1. terminate/supersede prior focus;
2. create `AgentRepositoryWorkFocus`;
3. submit exactly one existing repository-object `move-agent` proposal;
4. record the returned movement request/action correlation;
5. expose the bounded current-focus projection.

On terminal tool event, cancel/supersede active movement where necessary and clear coding state.

Run focused server tests plus existing Phase 13 World Action service/API tests. Expected: all pass with no duplicate movement and user-directed priority preserved.

### Task 7: RED/GREEN—workstream recovery hint

Add tests proving only an exact active binding’s `projection.changedFiles[].path` can produce `source: "workstream-binding"`.

Refuse:

- task/currentActivity prose;
- wrong repository, agent, worktree, or task ref;
- cancelled/failed workstream;
- empty changed-files evidence.

A recovery hint may target/move but never sets coding without an active tool.

### Task 8: RED—per-roster web client and exact arrival gate

Add web tests for two roster agents:

- distinct focus endpoints/session IDs;
- distinct movement requests and positions;
- stale arrival for A cannot unlock B;
- old-generation arrival cannot unlock either;
- retarget A does not interrupt B;
- terminal A does not stop B;
- authority failure/restart clears coding;
- browser uses `layout-<fingerprint>`.

Expected: RED against current primary-session-only state.

### Task 9: GREEN—lift World state by roster ID

In `WorldEntryExperience` and `WorldRoom`:

1. build stable roster entries in accepted `addedOrder`;
2. poll exact focus and movement authority for each connected World session;
3. keep request/control/focus maps keyed by `rosterId`;
4. run each movement model independently;
5. include all other actor positions in approach-point selection;
6. emit events with exact roster/session identity;
7. derive action per rendered agent, not only index 0;
8. clear maps on removal, disconnect, leave, restart, or repository generation change.

Run focused web tests. Expected: both agents remain independent and collision-safe.

### Task 10: RED/GREEN—coding animation and reduced motion

Add renderer/web tests proving:

- navigating uses Walk/Run, never Dig;
- exact arrival + active tool uses approved Dig or Work;
- moved-away, terminal, stale, retarget, disconnect, and generation change stop coding;
- imported avatar without approved Dig never receives a guessed clip;
- reduced motion has no mixer advancement but retains exact position and visible/accessible coding indication;
- two agents can display different actions simultaneously.

Implement the minimal per-agent action/position props and coding badge/halo in **both** procedural and imported renderer paths. Add parity assertions for two and four agents, stable roster identity after removal/reconnect/reordering, and per-agent observability attributes keyed by roster ID.

### Task 11: Operator Dig review gate

1. Extend review manifest/receipt tests for optional `Dig` decisions.
2. Run the local developer review UI against real imported assets.
3. Produce a sanitized candidate receipt containing model ID, selected clip index, verdict, rationale, and evidence reference.
4. **Stop and ask Aaron to review.**
5. Only after explicit verdict approval, update the generator’s operator mapping and regenerate the registry.
6. Verify generated output is deterministic and no unapproved model receives Dig.

If no Dig mapping is approved, leave every model on Work/static coding fallback and continue acceptance; this is a valid Task 12 result.

### Task 12: Two-agent headed/video acceptance

Create a deterministic production-build fixture with two roster agents and two exact repository objects.

Required journey:

1. Agent A receives structured edit evidence for object A.
2. Agent B receives structured read/edit evidence for object B.
3. Both move along distinct safe paths without overlap or teleportation.
4. A arrives first and starts coding while B remains navigating.
5. B arrives and starts its own coding semantic.
6. Retarget A to object C; A stops coding, moves, and resumes only after C arrival.
7. Complete B; B stops while A remains independent.
8. Repeat under 390×844 viewport.
9. Repeat reduced-motion state and prove static coding semantics.
10. Capture retained screenshots and a video with timestamps/labels sufficient to distinguish roster, object, generation, arrival, and action.

Use an explicit headed Phase 19 Playwright project/spec rather than relying on the current pointer-lock-only headed project. Exercise both procedural and imported renderer paths, and retain semantic/no-WebGL plus accessibility assertions in addition to pixels.

Visual rejection conditions:

- avatar/object overlap or agent-agent overlap;
- teleportation;
- clipping inside city geometry;
- same-name/stale object substitution;
- Dig before arrival;
- animation leakage between agents;
- clipped badge/halo/HUD at desktop or mobile;
- reduced-motion mixer advancement.

### Task 13: Focused and broad verification

Use pinned Node:

```bash
export PATH=/home/mela_ai/.nvm/versions/node/v24.18.0/bin:$PATH
node --version                         # v24.18.0
corepack pnpm@11.15.0 --version       # 11.15.0
```

Run, in order:

1. Task 12 protocol/server/web/avatar/renderer focused tests.
2. Phase 19 adapter, constellation, grouped-message, and multi-agent web suites.
3. Phase 13 movement/navigation/world-action suites.
4. Imported-avatar review, avatar-system, and renderer suites.
5. Package builds and typechecks for affected workspaces.
6. Root lint and formatting checks.
7. Existing broad local-server and web suites.
8. Production Vite build and headed Playwright Task 12 fixture.

Do not hide known pre-existing safe-config fixture failures. Report the unfiltered result first, then—only if the same two accepted stale fixtures remain the sole failures—report the explicitly filtered remainder exactly as Task 11 did.

### Task 14: Inherited-worktree reconciliation and approval stop

Produce a machine-readable reconciliation containing:

- accepted 52-path baseline hashes;
- planning file;
- exact Task 12 implementation/test/evidence paths;
- zero unauthorized paths;
- branch/HEAD/upstream/staging state;
- focused and broad command receipts;
- operator Dig decisions or explicit “none approved” fallback;
- screenshot/video paths and dimensions;
- protected listeners/services unchanged.

Then update canonical status docs only if local and headed acceptance are complete, present the receipt to Aaron, and stop.

No commit, push, PR, merge, tag, release, deployment, publication, or visibility change without separate explicit approval.

## 6. Focused test matrix

| Area              | Must prove                                                            |
| ----------------- | --------------------------------------------------------------------- |
| Adapter authority | only explicit structured allowlisted fields create locators           |
| Privacy           | raw args, absolute paths, previews, and secrets never persist/display |
| Resolver          | exact live snapshot object, correct fallback order, fail closed       |
| Generation        | exact repository/layout generation on focus, movement, and arrival    |
| Replay            | one activity produces one movement; duplicate events are idempotent   |
| Priority          | user-directed active movement blocks autonomous work-focus movement   |
| Lifecycle         | complete/fail/cancel/stale/retarget/restart stop coding               |
| Workstream        | structured changed files only; no prose; never starts coding alone    |
| Multi-agent       | independent maps keyed by roster; no state leakage                    |
| Collision         | safe approach point excludes user and all other agents                |
| Animation         | Dig only after exact arrival and approved mapping                     |
| Fallback          | unapproved imported models show truthful Work/static coding state     |
| Reduced motion    | exact static placement, no mixer progress, visible coding semantics   |
| Visual            | desktop + 390×844, no clipping/overlap/teleportation                  |

## 7. Risks and mitigations

- **Layout-generation mismatch already exists:** server uses `layout-<fingerprint>`, browser currently uses `<fingerprint>`. Align before enabling focus movement; add a regression test.
- **Provider event shapes vary:** use explicit harness fixtures and fail closed on unknown fields; never generic-scan payloads.
- **Production Claude Code has tools disabled:** Task 12 must preserve `--tools ""`. Enabling Claude tools is a separate capability/security decision; until then Claude may move only from exact structured workstream recovery evidence and cannot truthfully enter Dig.
- **Hermes/OpenClaw may lack stable call IDs:** allocate only within a serial turn; if lifecycle pairing is ambiguous, omit correlation rather than guessing.
- **Current symbol graph is not a city target set:** treat symbol evidence as a refinement for locating the containing live file; do not create synthetic symbol movement targets.
- **WorldRoom currently owns one movement state:** lift the existing model by roster ID instead of adding another engine.
- **Current approach resolver ignores other agents:** feed all occupied positions and refuse when no candidate is safe.
- **Imported models lack universal approved Work/Dig clips:** preserve truthful static coding semantics and require operator evidence for Dig.
- **Dirty inherited worktree:** verify exact baseline hashes before and after every bounded implementation slice; never use `git add -A`, reset, clean, stash, or broad formatting.
- **Stale jCodeMunch offsets on a dirty tree:** use live file reads/diffs as edit authority and re-register/reindex edited files before final code navigation claims.

## 8. Final approval boundary

A locally green Task 12 is not a delivery authorization. After implementation and acceptance evidence, stop with:

1. exact changed-path inventory;
2. verification receipts;
3. headed/video evidence;
4. Dig operator verdicts or explicit Work-only fallback;
5. inherited-worktree reconciliation;
6. a request for Aaron’s parent acceptance and, separately, any desired delivery action.
