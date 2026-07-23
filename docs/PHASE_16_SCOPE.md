# AgentIntersect World — Phase 16 Frozen Scope

Status: **DECISIONS APPROVED AND FROZEN / USER ACCEPTED / SEALED / COMPLETE**

Date: 2026-07-23

Authority: the user approved Decisions 1–10 below and instructed Mr Fluff to preserve them for a new-session Phase 16 start. This authorization permits only the bounded Phase 16 implementation described here. It does not authorize work in the current session, Phase 17+, public services, an autonomous swarm, publication, deployment, release, provider activation, repository-visibility changes, or automatic integration.

Phase 15 remains an exact-SHA-verified implementation candidate with its real physical-microphone journey and explicit user acceptance carried as a pending TODO. That pending acceptance is not mislabeled as complete and does not reopen Phase 15 implementation.

Acceptance closeout: after technical completion and exact-SHA `phase-1-checks` run `29995642552` / job `89168556242` succeeded for status-record SHA `3cf9e53b2c9e05f232d68d61a7ee029f2ff946f0`, the user authorized acceptance in the new session. Phase 16 is accepted, sealed, and complete. Phase 15 remains unsealed solely for the physical-microphone journey with the local STT provider staged/unactivated; Phase 13 Discord → World continuity remains failed/deferred under waiver; and Phase 17 remains separately unauthorized and not started.

## Frozen decisions

### Decision 1 — First agent and accountable orchestrator

Mr Fluff running through Hermes Agent is Agent 1 and the accountable orchestrator. Mr Fluff owns scope enforcement, independent verification, evidence reconciliation, cleanup, and presentation of the manual integration candidate. Worker or harness narratives are leads, not proof.

### Decision 2 — Second agent and harness

Agent 2 is named **beans** and runs through **OpenClaw** in the same physical-machine/local environment. OpenClaw/beans must have a distinct attributable identity, persistent session, assigned task, worktree, branch, tool stream, and evidence stream. A next-session read-only preflight must verify the actual OpenClaw endpoint, version, readiness, and beans identity before any edit authority is granted.

### Decision 3 — Models

Use configured model defaults for both agents where supported. The approved default is `gpt-5.6-sol`. Any required fallback or harness-specific model substitution must be disclosed before work begins and recorded in evidence; it must not silently expand authority or scope.

### Decision 4 — Exactly two agents

The initial slice contains exactly two agents: Mr Fluff/Hermes and OpenClaw/beans. No coordinator process may become a third autonomous editing agent. Deterministic fixtures may represent state in tests but may not be described as a third live agent.

### Decision 5 — One private repository

Use exactly one private repository for the initial slice. The default implementation and demonstration target is the existing private `MelaBuilt-AI/AgentIntersect-World` repository; no additional repository is required.

The user nominated AgentClutch if a separate repository becomes necessary. Live preflight on 2026-07-23 showed canonical `MelaBuilt-AI/agentclutch` is public, so it cannot satisfy this frozen private-repository decision as-is. Do not change its visibility or use it as the live Phase 16 target without separate user approval. A separately approved private AgentClutch mirror/fixture remains an allowed future resolution if the primary repository proves unsuitable.

### Decision 6 — Separate worktrees and ownership

Each editing agent receives a separate validated Git worktree and branch. Session, task, worktree, repository, tools, previews, tests, and evidence must remain unambiguously bound. Shared unisolated writes and silent cross-worktree mutation are forbidden. Wrong-session, wrong-repository, or wrong-worktree writes must fail closed.

### Decision 7 — Visible coordination and handoffs

Task assignment, dependency state, ownership, object/file interest, contention, agent-to-agent messages, and handoffs must be visible and attributable to the operator. No invisible agent-to-agent system prompt or hidden authority transfer is permitted.

### Decision 8 — Manual integration approval

Integration remains manual. World may present an evidence-backed merge candidate with exact source/target branches, diff, tests, conflicts, uncertainty, and cleanup state, but neither agent nor a coordinator may merge automatically. The user remains the sole authority for final integration approval.

### Decision 9 — Local/private and bounded operation

No public service, public ingress, hosted coordination plane, cloud agent marketplace, or autonomous swarm is permitted. Bind local services to loopback unless an existing separately approved trusted-LAN contract is required. Bound CPU, memory, process count, previews, background work, event/message retention, and cancellation/cleanup.

### Decision 10 — Canonical Phase 16 defaults and exit gate

All unspecified details use the canonical Phase 16 defaults in `AgentIntersect_WorldDD.md`: attributable sessions, strict worktree isolation, visible contention, explicit handoffs, reviewable merge/conflict projection, bounded resources, restart recovery, and one-operator authority. The phase exits only when the user approves a bounded two-agent collaboration and integration demonstration. The user supplied that approval in the new-session acceptance closeout after technical completion and exact-SHA CI proof. Phase 17 remains separately unauthorized and not started.

## Objective

Let one operator collaborate with two persistent agents without invisible file collisions, ambiguous ownership, silent cross-worktree mutation, hidden instructions, or untraceable integration decisions.

## Initial vertical slice

1. Verify Hermes/Mr Fluff and OpenClaw/beans readiness without granting edit authority.
2. Create two isolated worktrees and bind each agent to one session, task, branch, and worktree.
3. Assign independent tasks in the one private repository and show both agents' attributable activity.
4. Produce visible overlapping file/object interest and same-file contention without allowing silent mutation.
5. Require one explicit beans → Mr Fluff handoff with evidence.
6. Present one manual integration candidate containing exact diffs, tests, conflict/uncertainty truth, and cleanup state.
7. Exercise wrong-session/worktree refusal, stale/deleted-worktree recovery, restart recovery, resource limits, cancellation, and owned-process cleanup.
8. Obtain the user's explicit integration-demonstration acceptance; do not auto-merge.

## In scope

- Two adapter sessions and attributable identities.
- One worktree per editing agent.
- Task, dependency, ownership, and handoff schemas.
- Worktree creation, validation, lifecycle, and cleanup under bounded authority.
- Tool, preview, test, and evidence binding to worktree/session/task.
- Visible object/file interest, contention, branch, merge-candidate, and conflict state.
- Agent roster/follow and attributable agent-to-agent messages.
- Bounded local concurrency and deterministic restart/reconciliation.
- Same-operator World/Yjs projection.

## Out of scope

- More than two live agents.
- Public services, public ingress, cloud coordination, or an autonomous swarm.
- Unrelated users or agents.
- Shared unisolated editing.
- Invisible agent-to-agent prompts or hidden authority.
- Automatic conflict resolution or automatic merge.
- Organizational RBAC or a cloud agent marketplace.
- Phase 17+ work.
- Provider activation, Phase 15 mic-acceptance substitution, release, publication, deployment, or repository-visibility changes.

## Required evidence

- Two simultaneous real agents with distinct identities, sessions, tasks, branches, worktrees, tools, evidence, and avatars.
- Exact proof that edits stay within the assigned worktree and wrong-boundary writes are refused.
- Same-file contention and conflicting-edit visualization before integration.
- An explicit, attributable agent handoff.
- A manual merge candidate with exact diff/test/conflict evidence.
- Stale/deleted-worktree, restart, cancellation, and resource-limit recovery.
- Agent-message prompt-injection attribution and no hidden authority.
- Independent parent verification of both harness outputs.
- Complete local, browser, visual, fresh-copy, cleanup, and private exact-SHA CI proof appropriate to the implementation.
- First-hand operator proof following both agents and explicit user acceptance.

## Fresh-session start order

1. Read `AGENTS.md`, this frozen scope, the Phase 16 canonical section in `AgentIntersect_WorldDD.md`, `PROJECT_STATUS.md`, and the latest Obsidian handoff.
2. Reverify private repository state and clean exact-SHA baseline.
3. Perform read-only Hermes and OpenClaw/beans readiness/identity preflight; do not modify OpenClaw configuration or grant edits until the contract is verified.
4. Freeze implementation-specific schemas, route names, resource ceilings, worktree lifecycle, fixtures, and acceptance transcript only within Decisions 1–10.
5. Implement through RED→GREEN tests with one editing agent per isolated worktree, parent verification, one bounded independent review, full gates, private push, exact-SHA CI, and refreshed continuity.

No Phase 16 implementation, branch, worktree, agent launch, dependency installation, test fixture, or service was started while this decision sheet was created.
