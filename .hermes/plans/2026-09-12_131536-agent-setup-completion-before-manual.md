# Agent Setup Completion Before Manual Acceptance — Implementation Plan

**Goal:** Finish the remaining PR #12 implementation in a new session, verify it, and only then prepare human manual acceptance.

**Execution:** Mr Fluff implements directly, honoring Aaron's standing preference; no automatic delegation, review campaign, or coding during this planning/handoff turn.

**Architecture:** Extend the existing discovery → readiness → attachment → saved registration → World-session routing. Keep metadata discovery separate from native execution and separately approved prerequisite changes. Reuse current native-session ownership, Workstream authority, and preview recovery rather than introducing a parallel session system.

**Tech stack:** TypeScript, Node 24+, pnpm 11.15.0, Fastify, React/Vite, Zod, Vitest; existing CI browser journeys and native harness adapters.

## Authority and order

Aaron's September 12 message `1548381463198826506`: tackle the unfinished items **before** manual acceptance, in a **new session**. This supersedes the earlier invitation to test port 45320 now. This file plans continuation; it does not start any remaining implementation or approve external configuration/service changes.

Continue private draft PR #12 on `feat/agent-setup-menu`. No merge, release, public visibility change, unrelated cleanup, or protected Hermes/OpenClaw restart. Keep user-managed harness versions and native identity/provider/personality/memory/skills intact. Use targeted commits within this existing feature PR unless Aaron changes the delivery scope.

## Verified starting point

- Implementation checkpoint `87ebe7451621ab2bba24ce92d90186597a4c3dcb`, PR https://github.com/MelaBuilt-AI/AgentIntersect-World/pull/12.
- Setup gate, same-environment attachment, persisted registrations, saved selection and Escape integration exist. Four-harness native binding persistence has fixture coverage; that is not four live native proofs.
- Real Codex production Workstream/preview restart/Continue passed on Node 24: exact native conversation, Workstream/task/worktree, Git/files and message history retained; approved preview relaunched without coding redispatch. Explicitly stopped previews are not automatically restarted.
- Canonical scope: `docs/AGENT_SETUP_MENU.md`. Latest CI/remote/process state belongs in the external handoff; do not assume an older green run covers future commits.
- Existing six residual paths are protected. Do not clean/stash/reset them or include them in commits.

## Task 0 — Re-establish the exact starting state

1. Read `AGENTS.md`, `PROJECT_STATUS.md`, this plan and `docs/AGENT_SETUP_MENU.md`.
2. Run `git status --short --branch`, `git log -4 --oneline`, `git ls-remote origin refs/heads/feat/agent-setup-menu`, `node --version`, and `gh pr view 12 --json headRefOid,isDraft,url`.
3. Query both push and PR workflows for the actual branch HEAD. Preserve failures, fetch exact failed-job evidence, and correct a demonstrated blocker before broadening implementation. No blind retry loop.
4. Load the direct implementation, TDD, harness-dogfood, frontend and Hermes configuration skills as relevant. Use on-demand indexing without enabling the resource-heavy watch daemon.
5. Do not relaunch the manual candidate yet. Preserve its saved state and native-proof checkpoint. The older operator lanes remain protected.

## Task 1 — Define the environment-bound execution contract

**Files:** `apps/local-server/src/agent-discovery.ts`, `agent-discovery-scripts.ts`, `agent-setup-runtime.ts`; `packages/world-schema/src/agent-setup.ts`; `apps/local-server/test/agent-discovery.test.ts`, `agent-setup-runtime.test.ts`.

1. Read the actual installation/environment/identity schemas and adapter launch signatures before editing.
2. Add failing tests that distinguish backend-local, Windows, and named WSL installations, including spaces in Windows paths, inaccessible/stopped environments, and a native profile from the wrong environment.
3. Define a server-owned launch description from a discovered installation and identity. Do not accept arbitrary browser-supplied executable strings or shell commands.
4. Define and test workspace mapping separately from executable mapping. A path string conversion alone is not verified filesystem/worktree access.
5. Keep discovery read-only; starting a stopped distro or a native service requires an explicit previewed action, not hidden discovery behavior.

**Exit:** Tests establish which environment owns the launcher, native configuration/credential references, workspace and native resume reference; unsupported combinations remain found-but-not-ready.

## Task 2 — Implement and prove Windows↔WSL execution/workspace routing

**Files:** `apps/local-server/src/agent-setup-runtime.ts`, `agent-sessions.ts`, `codex-session-adapter.ts`, `claude-code-session-adapter.ts`, `openclaw-session-adapter.ts`, and `index.ts`; corresponding `agent-setup-runtime.test.ts` and `phase19-*-session-adapter.test.ts`. Add a small environment-launch helper only if the existing launch sites need one.

1. Write RED cases for exact argv forwarding, native profile selection, correct working directory, cancellation and restart/resume across the chosen boundary.
2. Implement one end-to-end boundary first using fixed native launch adapters. Retain argv arrays and proper quoting for the specific Windows/WSL launcher; no generic shell concatenation.
3. Probe both command execution and repository/worktree access before saving readiness. Keep credentials in their native environment rather than copying authentication material into World/browser state.
4. Confirm adapter ownership and cancellation remain exact; never kill a harness-wide process by name.
5. Repeat the supported path for the remaining adapter transports, leaving genuine missing prerequisites visible.
6. Exercise a disposable real cross-environment native task and preserved-work restart only after its environment is ready and any separately required service change is approved. Report fixture-only or unavailable directions honestly.

**Exit:** Discovered remote-environment installations can actually attach, execute in the intended workspace, and resume their exact native session; discovery success alone is insufficient.

## Task 3 — Add previewed, separately approved prerequisite actions

**Files:** `apps/local-server/src/agent-setup-service.ts`, `agent-setup-runtime.ts`, `agent-setup-routes.ts`; `packages/world-schema/src/agent-setup.ts`; `apps/web/src/world-entry/AgentSetupMenu.tsx`, `AgentSetupBoundary.tsx`, `agent-setup-client.ts`; `agent-setup-service.test.ts`, `agent-setup-api.test.ts`, `apps/web/test/agent-setup-menu.test.tsx`, `agent-setup-client.test.ts`.

1. Write RED tests for a missing prerequisite producing a plan but no external mutation.
2. Represent the concrete target, proposed change/start/restart, reason and expected effect. Bind approval to that specific target and current plan; changed plans need renewed approval.
3. Add separate Preview → Confirm → Apply → Recheck controls. Cancellation must perform no mutation; double-click/retry must not duplicate a service restart or configuration write.
4. Inspect current authoritative Hermes/OpenClaw/native documentation before implementing each supported action. Native login stays in the harness's own flow.
5. Preserve unrelated native configuration and native credentials. Use backups/recovery appropriate to the concrete edit, not a broad infrastructure framework.
6. Retain exact manual guidance and Recheck when automated action is unsupported or declined. Do not label manual instructions an implemented automatic installer.
7. Exercise real changes only after Aaron explicitly approves their displayed scope. The setup feature request is not blanket permission to restart his live assistant services.

**Exit:** The UI can explain, separately authorize, execute and verify supported prerequisite changes; failed/cancelled/stale approvals cannot create a ready registration.

## Task 4 — Finish the explicit Hermes conversation choice

**Files:** `apps/local-server/src/agent-sessions.ts`, `agent-setup-runtime.ts`, `agent-setup-service.ts`, `agent-setup-routes.ts`, `native-session-store.ts`; `packages/world-schema/src/agent-setup.ts`; `apps/web/src/world-entry/AgentSetupMenu.tsx`, `agent-setup-client.ts`, `WorldEntryExperience.tsx`; `apps/local-server/test/agent-setup-hermes.test.ts`, `phase12-agent-sessions.test.ts`, and setup API/client/menu tests.

1. Verify actual native Hermes list/attach/profile contracts; do not infer identity from the user-entered display name or silently choose a conversation by matching a title.
2. Write RED tests for the default new-conversation path versus an explicit existing native conversation belonging to the selected profile.
3. List only the selected native identity's available conversation metadata. Keep native conversation IDs, profile IDs, World registration IDs and display labels distinct.
4. Implement explicit selection, clear new-versus-existing semantics, and appropriate refusal for inaccessible/stale/busy sessions. Preserve the default: new Worlds use separate conversations; saved work resumes its exact owned conversation.
5. Regress refresh/backend restart, multiple registrations, identity mismatch, no unsolicited coding, and no deletion/copying of unrelated native history.

**Exit:** The choice is available through setup and persists correctly; legacy title-matched existing-session routing is not substituted for this feature.

## Task 5 — Integrate and verify before requesting manual acceptance

Run RED then GREEN for each changed slice. Representative focused command:

```bash
node node_modules/vitest/vitest.mjs run apps/local-server/test/agent-discovery.test.ts apps/local-server/test/agent-setup-runtime.test.ts apps/local-server/test/agent-setup-service.test.ts apps/local-server/test/agent-setup-api.test.ts apps/local-server/test/agent-setup-hermes.test.ts apps/web/test/agent-setup-menu.test.tsx apps/web/test/agent-setup-client.test.ts apps/web/test/agent-setup-entry.test.tsx apps/web/test/agent-setup-selection.test.ts apps/web/test/world-escape-menu-model.test.ts --maxWorkers=1 --no-file-parallelism
corepack pnpm@11.15.0 --filter @agentintersect-world/local-server typecheck
corepack pnpm@11.15.0 --filter @agentintersect-world/web typecheck
```

1. Add regressions for every newly supported behavior; retain no-write discovery, secret-free DTOs, native configuration preservation and explicit approvals.
2. Run the impacted lint/build and architecture gates, then the full regression and existing exact-SHA CI. Preserve first-run/returning flow, avatar onboarding and saved-roster behavior.
3. Browser catch-all native-work fixtures must pass the real setup-state GET through. Update only intentionally changed contracts; no production gate bypass or generic timeout increase.
4. Reuse or rerun the native Workstream checkpoint when changed runtime semantics warrant it. Runner `/home/user/.hermes/runs/aiw-pr12-workstream-restart.py`; preserved root `/home/user/.hermes/runs/aiw-pr12-workstream-_b6vbhjw`. Inspect runner before use; pin Node 24/PATH explicitly when entering systemd/tmux. Never substitute a new generated task for a failing continuation of the preserved work.
5. Update `README.md`, `docs/AGENT_SETUP_MENU.md` and `PROJECT_STATUS.md` so supported paths and remaining limitations match the tested implementation.
6. Push bounded corrections within draft PR #12. Verify exact SHA and every CI conclusion; do not merge.

## Task 6 — Human acceptance, last

Only after Tasks 1–5 are complete (or Aaron explicitly re-scopes a remaining item): prepare a current candidate and ask Aaron for manual acceptance of logo → setup → discovery → identity/display-name attachment → saved selection → World, Escape in each state, prerequisites/approval UX, cross-environment behavior, explicit Hermes conversation choice and normal-UI saved-work Continue. No automatic clicks, native coding, approval, or reset stand in for his verdict.

Do not label this plan, the existing native API proof, or an old candidate as completed human acceptance.

## Deferred unrelated work

Do not pull in hosted Workbench/full Slice 6, unrelated multi-agent reconciliation, Phase 20, releases, old-lane cleanup, repository hygiene or speculative hardening. Historical native report latency, queued-discussion durability and Google APT-source evidence caveats remain in the handoff, not blockers invented for this PR.
