# Workbench Product Loop Slice 4 — World View

Status: FROZEN / IMPLEMENTATION AUTHORIZED (2026-09-03)
Baseline: exact-green `main` at `9b7cdfe31c286aaa3488f0c39f008a7827388b78` (CI run `33822834347`, 7/7 jobs green)

## Objective

Project one health-checked Preview Manager browser result into the current World as an embedded and expandable World View while preserving Preview Manager process authority, explicit input ownership, truthful current-versus-previous display state, and the mounted World session.

## Acceptance criteria

1. A thin browser client reads approved Preview Manager recipes and the exact current Workstream preview projection. It starts a preview only from one uniquely approved repository recipe and the current Workstream's exact revision, repository, agent, root-session, and worktree authority. It never accepts or sends raw executable, argv, cwd, path, or environment overrides at preview start.
2. The compact normal-World Workstream surface exposes an enabled-blue `Start World View` action only when exactly one approved recipe and current owned Workstream authority exist. It exposes a truthful disabled-grey reason for zero recipes, ambiguous recipes, missing authority, removed worktree, pending action, or unavailable Preview Manager state. An already ready display attaches without launching a duplicate preview.
3. A ready Preview Manager display creates one in-World World View projection. The screen identifies repository, Workstream, branch/worktree, preview truth/state, displayed preview revision, and last successful readiness time. `previous-verified` is visibly labeled and is never called current.
4. Embedded World View is view-only. Expanding it preserves the mounted World, agents, repository, Workstream, preview iframe, user position, and camera state. Closing restores the prior World state and returns focus to the opener.
5. Input ownership is explicit: World mode owns avatar/camera/chat input; Preview mode enables iframe interaction and disables/clears World movement and mouse-look state. Escape returns from Preview mode while the World document owns the key event; an always-visible parent-owned `Return to World` control guarantees escape from a cross-origin preview after iframe focus. A second Escape or explicit close collapses the expanded view.
6. The same regular-DOM World View metadata, controls, truth labels, and browser result remain available when WebGL is unavailable. No acceptance fact exists only in canvas pixels or animation.
7. A stopped/cancelled Workstream projection removes the display rather than leaving a stale unlabeled screen. A failed refresh may keep the older display only when Preview Manager reports `previous-verified`.
8. Focused client/component/input-ownership tests, the normal World integration test, one production-built Chromium journey, typecheck, architecture, build, lint/format, and complete Vitest pass under Node 24.

## Representation decisions

- Preview Manager remains the sole process/readiness/current-versus-previous authority. World View is presentation and explicit user input routing only.
- Browser presentation uses the exact loopback URL from the Preview Manager display record in one sandboxed iframe. No public tunnel, deployment, or proxy authority is introduced.
- World View automatically attaches to an existing display. Starting is a deliberate button action and only auto-selects a recipe when exactly one repository-bound approval exists.
- The iframe remains mounted across embedded/expanded transitions so application state is not reset merely by expanding.
- `current` and `previous-verified` use the Preview Manager projection verbatim. World View does not infer freshness from animation, iframe load, or HTTP appearance.
- The expanded surface is a regular-DOM dialog with visible mode and return controls. Cross-origin browser isolation is preserved rather than weakened to intercept every iframe keystroke.
- Risk tier: Standard. Inputs are the existing strict local API envelopes and untrusted preview content; concrete invariants are exact authority, no duplicate launch, no World input leakage, no stale unlabeled display, and no loss of return state.

## Supported environment and trust boundary

- Node.js 24, Chromium-class browsers, and the existing local single-operator loopback/trusted-LAN product topology.
- Preview processes remain loopback-only under Slice 3 authority.
- Preview content is untrusted application output. It receives no World API authority from World View.
- Regular DOM and no-WebGL are supported. Native desktop capture is not.

## Non-goals

- No continuous edit/rebuild/restart/refresh loop or chat-feedback correlation (Slice 5).
- No full-loop real-project acceptance (Slice 6).
- No native window capture, desktop embedding, public tunnel, deployment, package installation, recipe inference, recipe approval editor, multi-recipe chooser, arbitrary terminal, or generic executor.
- No Preview Manager persistence/process/service redesign and no Workstream schema/status redesign.
- No internal dashboard navigation, admin chrome, provider/profile change, protected-service mutation, public ingress, release, publication, tag, visibility change, or Phase 20 work.

## Delivery boundary

Implementation is authorized on `feat/workbench-world-view`, created from the exact-green baseline above. Private commit/push/PR preparation may proceed under Aaron's instruction to continue without another approval interruption. Merge remains conditional on terminal exact-SHA CI success; release/publication and every public/protected-service action remain closed.
