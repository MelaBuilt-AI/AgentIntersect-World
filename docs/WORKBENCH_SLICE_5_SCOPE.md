# Workbench Product Loop Slice 5 — Continuous Iteration Scope

Status: FROZEN / IMPLEMENTED / PARENT-GREEN / PRIVATE DELIVERY AUTHORIZED

Frozen: 2026-09-04
Baseline: `9bf97677983d2381f2e2f6e4d9e74db928a5d562`
Branch: `feat/workbench-continuous-iteration`
Risk tier: Standard

## Objective

Connect normal-World visual feedback to the exact current Workstream, preserve its durable technical lineage, rerun the Workstream-bound agent and relevant validation, keep the last verified World View visible while the iteration is in progress, and switch World View only after the replacement preview is healthy.

## Acceptance criteria

1. A bounded follow-up such as `change it to use the blue active state` records one new iteration on the exact current Workstream and sends exactly one turn to that Workstream's bound agent/session. It creates no second Workstream and performs no duplicate dispatch.
2. The iteration request is revision-, repository-, agent-, root-session-, and attested-worktree-bound. Stale, terminal, busy, missing, removed, or wrong-branch authority refuses mutation visibly.
3. Workstream iteration identity and status are durable across reads: the existing Workstream ID and owned worktree remain, the Workstream revision/event lineage advances, and current changed-file/diff/validation/evidence projection remains authoritative.
4. While the agent turn or validation is active, the existing verified World View stays mounted and is labeled as the displayed verified revision while a separate `updating` status is shown. World/Preview input ownership and iframe state remain intact.
5. When the turn finishes, World refreshes authoritative Workstream projection. A replacement preview starts automatically only when exactly one approved recipe exists and all reported validation entries pass.
6. The replacement preview uses only the existing Preview Manager recipe and exact latest Workstream authority. It sends no raw executable, argv, cwd, environment, branch, head, or path override.
7. World View switches to the new preview revision only after Preview Manager reports it ready. Failed validation or failed preview health keeps the older verified display visible with explicit failed/previous-verified truth and a manual retry path.
8. A second feedback iteration can repeat the same cycle in the same Workstream. Cancellation or authority removal stops the cycle and removes stale World View truth under the existing Slice 4 rules.
9. The flow remains regular DOM, keyboard accessible, reduced-motion compatible, responsive, and no-WebGL equivalent. Enabled actions remain blue; unavailable actions remain grey with a textual reason.

## Supported environment and trust boundary

- Node.js 24, Chromium-class browsers, and the existing private single-operator loopback/trusted-LAN topology.
- Existing Agent Session, Workstream, Worktree Authority, Preview Manager, Repository City, and World View contracts remain authoritative.
- User feedback is bounded normal chat input. Preview output remains untrusted iframe content without World API authority.
- Protect concrete invariants only: no duplicate turn/preview start, no stale authority mutation, no worktree replacement, no raw execution override, no loss of the previous verified preview, and no accidental external exposure.

## Implementation shape

- Add one direct revision-bound Workstream iteration mutation and route/client method; reuse the already-bound exact agent-session chat path for the single turn.
- Extend normal-World composition with one small iteration state machine driven by real chat completion, authoritative Workstream projection, validation truth, and Preview Manager readiness.
- Reuse the mounted `WorldView`, `PreviewManagerClient`, `WorkstreamClient`, and existing polling. Do not create a second orchestration layer.
- Use focused vertical RED→GREEN tests, then the relevant Node 24 core gates and one production-shaped browser/pixel proof.

## Non-goals

- No Slice 6 real-project first-hand acceptance.
- No Workstream schema/status redesign, multiple active Workstreams, automatic recipe inference or approval editor, generic command/terminal/executor, package installation, dependency inference, or arbitrary validation runner.
- No native capture/window embedding, public tunnel, deployment, public ingress, provider/profile mutation, protected-service change, internal dashboard navigation, Phase 20 work, release, publication, tag, or visibility change.
- No broad audit, speculative hardening, original-AgentIntersect inspection, or unrelated UI redesign.

## Delivery boundary

Aaron authorized end-to-end implementation, local verification, one private feature-branch commit/push/PR, and merge after terminal exact-SHA CI success. A failed required local or hosted gate stops delivery at a documented blocker. Slice 6, Phase 20, native capture, public/release actions, provider/profile changes, protected services, and visibility remain separately gated.
