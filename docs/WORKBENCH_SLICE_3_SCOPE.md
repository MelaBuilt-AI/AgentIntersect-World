# Workbench Product Loop Slice 3 — General Preview Manager

Status: IMPLEMENTED / PARENT GREEN / PRIVATE DELIVERY AUTHORIZED (2026-09-03)

## Objective

Provide one direct World-owned service that launches a user-approved browser preview recipe in the exact active Workstream worktree, reports truthful process/readiness state, preserves the previous verified preview when a replacement fails, and stops only the preview process it owns.

## Acceptance criteria

1. A trusted local operator can approve and persist a bounded browser-preview recipe for one repository. The recipe has a stable ID and revision, a display label, one executable plus argv, a loopback host/port substitution contract, a readiness path, and a browser path.
2. Starting a preview accepts only a previously approved recipe ID/revision. It does not accept launch argv, cwd, repository paths, or environment overrides at the start boundary.
3. Preview start resolves the exact current Workstream, expected Workstream revision, repository reference, agent/root-session reference, owned worktree, and current worktree state before spawning.
4. The manager launches without a shell in the exact owned worktree, substitutes only `{host}` and `{port}`, forces `HOST=127.0.0.1` and the allocated loopback `PORT`, bounds logs and startup time, and reports `starting`, `ready`, or `failed` truth.
5. A ready record exposes a loopback URL, health/readiness observation, exact Workstream/worktree/revision binding, recipe approval revision, process identity, and timestamps without exposing the private worktree path or unrelated environment.
6. Refresh starts a candidate while the current ready preview remains available. A healthy candidate atomically becomes current and the old owned process is stopped. A failed candidate remains failed while the prior healthy preview is explicitly projected as `previous-verified`.
7. Explicit stop terminates only the exact in-memory owned process tree and reports `stopped` plus port-closed truth. A graceful local-server close also stops owned preview processes.
8. On restart, persisted `starting`/`ready` process records become recovered/interrupted truth without signaling a stale PID. Persisted approved recipes and previous/current metadata remain readable.
9. Direct API routes support recipe approval/listing and exact Workstream preview start/read/stop with correlated validation/conflict/not-found/unavailable responses.
10. Focused service/API tests, impacted type/build/lint/format checks, and one production-shaped browser preview proof pass under Node 24.

## Representation decisions

- Schema family: `aiw.preview-recipe/1`, `aiw.preview-record/1`, and `aiw.preview-manager/1`.
- Explicit approval lives in the persisted recipe record. Re-approving the same recipe ID with changed content increments its revision; preview start must name the expected recipe revision.
- Recipe approval is repository-bound. Preview execution is additionally bound to the exact Workstream revision, Workstream-owned worktree receipt, repository generation, and agent/root-session authority.
- The approved recipe is the only place launch argv may enter. Start/refresh never accepts raw commands.
- Readiness is a successful loopback HTTP response at the approved readiness path. Browser presentation uses the separately approved browser path.
- Current and previous-verified truth are separate fields; a failure never relabels an older preview as current.

## Supported environment and trust boundary

- Node.js 24 on the existing local single-operator loopback/trusted-LAN product topology.
- Preview processes bind to loopback only in this slice.
- Recipe approval is an explicit trusted-operator action. Repository content and preview output remain untrusted process/browser data.
- Risk tier: Standard, with concrete process-ownership and worktree-integrity invariants.

## Non-goals

- No World View screen, embedded iframe, expanded preview input mode, or normal-World visual projection (Slice 4).
- No continuous edit/rebuild/refresh orchestration or chat feedback loop (Slice 5).
- No arbitrary command field on start/stop routes, generic terminal, package installation, dependency inference, or automatic recipe invention.
- No native desktop capture, public tunnel, deployment, publication, release, tag, visibility, provider/profile, protected-service, or public-ingress change.
- No Workstream schema/status redesign, multiple active Workstreams, wrapper framework, plugin system, broad audit, or speculative hardening.
- No Phase 20 work.

## Delivery boundary

Implementation is complete on fresh branch `feat/workbench-preview-manager`. Aaron authorized one private feature-branch commit/push/PR and conditional merge after terminal exact-SHA CI success. Release, publication, deployment, tags, visibility changes, Slice 4, Phase 20, and other external actions remain separate gates.
