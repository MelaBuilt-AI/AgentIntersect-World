# Repository workspace lifecycle — authorized build

> **September 9 delivery update:** Aaron authorized the cumulative PR, push and conditional merge after CI/readiness are green (`1547254171474993302`). The current delivery/acceptance cutline is `PROJECT_STATUS.md`; dated no-delivery and pending-test statements below are historical records, not current authorization. Retained runtimes, public/release actions and later-phase scopes remain protected.

## Scope

Aaron requested end-to-end repo menus after reloading a recent test repository produced an empty Workbench (Discord 1546634608521781360). This scope supersedes older menu-only restrictions for these controls, not Phase 20 or release gates. Mr Fluff implements directly under the functionality-first pragmatic rules.

## Acceptance contract

1. Load Repo offers **Discover path**, reads the server user's actual home (never `/home/me`), fills an editable local/new-project parent, reports whether `projects` exists, and explicitly offers to create it. New project name creates a child directory and Git repository without overwriting existing content. Discovery alone performs no filesystem write.
2. Workbench is a distinct repository-scoped panel, including a truthful empty state. It lists saved Workstreams regardless of the newly connected agent. History survives repository switching and service restart. The latest saved work is not silently replaced or deleted.
3. Explicit continuation restores/re-attests the selected owned worktree with the currently selected agent; it preserves files, branch and task history, records the new session binding, does not send a coding request, and refuses active work or missing/wrong-branch state. Native session identity is not fabricated or silently reused. Same-session continuity and new-session continuation are labeled distinctly.
4. Workbench exposes selected source/owned-worktree Git status, changed-file selection, recent commits, explicit commit, fetch, fast-forward-only pull, non-force push, and GitHub PR status/create. No shell command textbox, automatic remote creation, login, visibility change, merge, force-push, reset, or release. Each consequential action has a visible explicit confirmation and readback. Failed or unavailable Git/GitHub operations remain visible.
5. New Workstream is an independent dialog: task, branch/base-commit choice, local-only versus draft-PR intent. It allocates an isolated branch/worktree, not a PR on GitHub until the operator explicitly publishes from Workbench. Starting at a commit means a new branch/worktree, never destructive checkout/reset of existing files. Unborn repositories get an explicit initial checkpoint path.
6. Existing previews recover through exact resumed Workstream authority. Prior healthy displays are not killed by browsing history. Preserve accepted iframe shield, audio, embodiment, camera and spatial-screen behavior.
7. Normal production routing, local server APIs and actual Git operations are tested on disposable repositories. UI/backend error and refresh paths receive focused evidence. Existing operator runtime45279/site46381 and protected worktrees remain untouched; activation of a backend-changing candidate is separate from preservation of that runtime.

## Implementation shape

Extend existing intake, Workstream store/authority and normal World components. Use a small direct Git workspace service with explicit argv operations, known project/worktree resolution, bounded subprocesses and current-head checks. Local Git remains provider-neutral; GitHub-specific PR operations use installed `gh` and existing operator auth. Future self-hosted hosting is not implemented by this slice and requires no speculative plugin framework now.

## Verification / delivery

Focused RED→GREEN per vertical behavior, impacted tests, type/lint/build, one affected end-to-end production-shaped journey. No broad audit loops, frozen copies, or historical-evidence regeneration. Existing dirty implementation is preserved. Commit/push/PR/merge of AgentIntersect-World itself, native model dispatch, profile changes, public hosting and publication are not authorized by implementing these controls.

## Status

Implementation and focused/local production-shaped proof are complete in this cumulative candidate; see the continuation and presentation corrections plus PROJECT_STATUS.md. Saved-session restoration and hosted GitHub controls have not gained new first-hand acceptance merely from the later fresh-seed tests. These remain explicit follow-ups, not proof of full Slice 6.
