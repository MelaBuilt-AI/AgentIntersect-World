# AgentIntersect World — Phase 5 Frozen Scope

Date frozen: 2026-07-19
Status: FROZEN FOR IMPLEMENTATION
Baseline: `82ff9af0ceec4734e9b8be54e44b49697acaccc0`
Risk tier: Standard, consequential multi-package UI feature
Delivery mode: functionality-first bounded phase

## 1. Objective

Deliver one complete local Phase 5 journey:

```text
identify_
  → choose and preview an inherited 2D avatar appearance
  → enter the inherited World dashboard shell
  → choose durable default/current harness intent
  → open or index a repository
  → view one repository island
  → synchronize canvas and semantic-DOM selection
  → search, focus, and inspect an object
```

The accepted AgentIntersect identity/dashboard visual language must remain recognizable, while all implementation, state, information architecture, and authority remain AgentIntersect World-owned.

## 2. Supported environment and trust boundary

- Runtime: Node `v24.18.0`
- Package manager: pnpm `11.15.0`
- Browser target: installed Playwright Chromium and current Chromium-class desktop browsers
- Network: loopback by default; trusted-LAN display remains supported by the existing server configuration
- Operator: one trusted human using their own local/LAN browser views and owned harnesses
- Inputs treated as untrusted: local-storage values, API responses, repository metadata strings, search text, and WebGL availability
- No public-internet, unrelated-user, hosted multi-tenant, or adversarial-peer claim is made

## 3. Frozen workspace ownership

Primary implementation surfaces:

- `apps/web`: opening flow, dashboard composition, panel routing, World API client, local state integration, semantic repository browser, tests, stories, and visual fixtures
- `packages/avatar-system`: bounded 2D avatar appearance/profile schema, defaults, validation, serialization, and asset-layer catalog
- `packages/renderer-r3f`: demand-rendered repository-island scene, instanced geometry, picking/focus bridge, minimap projection helpers, WebGL capability/fallback contract, and 10k measurement harness
- `packages/ui`: reusable shell/status/terminal-style controls where genuinely shared

Supporting changes are permitted only where required for versions, architecture rules, tests, fixtures, documentation, and package wiring. Phase 4 server/schema/index/projection behavior is consumed, not redesigned.

## 4. Frozen dependencies

Existing authoritative versions remain unchanged unless installation resolution requires lockfile-only peer metadata:

- React / React DOM `19.2.7`
- Vite `8.1.5`
- TypeScript `6.0.3`
- Vitest `4.1.10`
- Playwright `1.61.1`

Phase 5 additions are pinned exactly:

- `@react-three/fiber` `9.6.1`
- `three` `0.185.1`
- `@tanstack/react-query` `5.101.2`
- `zustand` `5.0.14`
- `@axe-core/playwright` `4.12.1`
- `storybook` `10.5.2`
- `@storybook/react-vite` `10.5.2`
- `@storybook/addon-a11y` `10.5.2`

No additional production dependency may be added unless the implementation cannot meet a frozen acceptance criterion without it; any such addition must be minimal and reported.

## 5. One-time AgentIntersect extraction boundary

Authorized source repository:

- `/home/mela_ai/AgentIntersect`
- exact source commit `14c620271cd02e455d3244241de951e00ef77a4d`

Authorized read surface after this document is frozen:

- `src/dashboard-ui.mjs`
- `src/dashboard-assets/`
- directly relevant dashboard visual-asset tests only

Before copying any asset, create `docs/PHASE_5_ASSET_PROVENANCE.md` containing the exact minimal selected manifest. Every copied row must record source commit, source path, destination path, byte size, source SHA-256, destination SHA-256, and byte-equality result. Only assets actually rendered by the accepted slice may be copied. The source repository must not be modified. After extraction, destination copies are World-owned and no recurring sync gate remains.

Port interaction behavior into typed destination components. Do not copy the original control-plane menu bodies, routes, server authority, mutation behavior, harness execution logic, or obsolete product terminology.

## 6. Required functional surface

### 6.1 Identify and avatar

- First open presents the inherited `identify_` opening and transition.
- The operator can select from the inherited 2D avatar appearance layers/options, see a live preview, save a valid profile locally, and enter the dashboard.
- A saved valid profile restores on reload without forcing the builder.
- Settings can reopen the appearance builder and save an updated profile.
- Invalid/corrupt persisted state falls back safely to defaults.
- No private profile, memory, personality, or biometric trait is inferred.

### 6.2 Dashboard shell and harness intent

- Preserve the accepted header, hero, terminal/typewriter/cursor navigation, first-click-open/second-click-close overlay behavior, persistent output/status/results area, and stable hero geometry.
- Categories are exactly World, Repositories, Agents, Activity, Evidence, and Settings.
- Existing Phase 2 authority/demo and Phase 3 repository-index flows remain reachable in appropriate World/Repositories panels.
- OpenClaw, Hermes, Claude Code, and Codex are local selection intents only.
- Default/current harness intent persists locally and restores on reload.
- Selection never claims readiness, connection, or execution; those belong to Phases 6 and 7.
- Enabled actions are consistently blue; disabled actions are grey.

### 6.3 Repository island

- Load the current Phase 4 World snapshot and bounded tile data through typed browser clients.
- Render one selected repository with demand-rendered R3F instanced package/directory/file geometry.
- Canvas selection and semantic DOM selection share one selected object reference.
- Provide semantic hierarchy/object list, text search, keyboard navigation, focus, inspector, and minimap/overview.
- Search results and inspector expose only shareable Phase 4 DTO fields and never the selected absolute root.
- Unsupported-language repositories remain fully useful at file/directory/package level.
- A WebGL-disabled, creation-failure, or context-loss path retains the complete semantic search/select/focus/inspect workflow.

### 6.4 Accessibility and motion

- Every required action works without canvas and without color alone.
- Keyboard-only flow covers opening navigation, searching, selecting, focusing, inspecting, closing overlays, and reopening Settings/avatar.
- Screen-reader labels and status announcements are present.
- High-contrast mode remains legible.
- `prefers-reduced-motion` disables or reduces nonessential transitions and canvas motion without removing information.
- Automated axe evidence has no serious or critical violations in the tested first-open and repository-island states.

### 6.5 Deterministic fixture and performance

- Add a deterministic Phase 5 visual fixture suitable for stories and Playwright screenshot comparison.
- Add Storybook states for first-open/avatar, dashboard shell, repository island, and fallback/empty/error states.
- Add a reproducible 10,000-instance renderer proof using deterministic generated instance data.
- Provisional reference-hardware threshold: preparation of 10,000 instance transforms must complete within 250 ms and remain bounded; after warm-up, an available WebGL Chromium render must produce an interactive frame and selection response without materializing 10,000 semantic DOM rows.
- Report measured preparation/render/interaction results rather than claiming an unsupported universal FPS guarantee.

## 7. Acceptance evidence

Required parent-verifiable evidence:

1. Source/destination asset SHA-256 and byte equality for every selected copied asset.
2. Focused RED→GREEN tests for avatar persistence/validation, harness intent, World API clients, shared selection/search/focus, fallback behavior, and 10k preparation.
3. Existing Phase 2/3/4 behavior remains green.
4. `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, architecture checks, full Vitest, production build, smoke, and Playwright pass.
5. First-open → avatar → dashboard → harness → repository → island → select/search/focus/inspect works in a real browser.
6. Reload restores avatar and harness intent; Settings reopens the builder.
7. Menu double-toggle, stable hero rectangle, inline cursor rectangle, no horizontal overflow, and persistent output/status are verified.
8. Desktop and mobile screenshots plus a deterministic comparison fixture are recorded.
9. Keyboard-only, axe, reduced-motion, high-contrast, and WebGL-disabled/failure fallback evidence passes.
10. Real measured 10k proof and listener/process cleanup are recorded.
11. Final fresh-copy verification passes from the frozen completed tree.

## 8. Explicit non-goals

- Blender files, models, rigs, 3D avatar animation, or broad environment art
- Separate quadruped or species-specific primary locomotion systems
- Real harness readiness, connection, authentication, or command execution
- Worker/job creation or lifecycle control
- Symbols, call/dependency bridges, diffs, construction effects, or autonomous avatar locomotion
- Multi-view/LAN synchronization, persistence expansion, physics, XR, public ingress, or unrelated users
- Copying original AgentIntersect control-plane menus/backend behavior
- Modifying original AgentIntersect
- Tag, release, deployment, package publication, public visibility, or repository transfer

## 9. Review and authority budget

- One Codex `gpt-5.6-sol` / `high` implementation worker and one implementation report
- Parent inspection plus focused, aggregate, live-browser, visual, accessibility, fallback, performance, cleanup, and fresh-copy proof
- One fresh bounded read-only UX/code audit against this scope
- At most one targeted correction pass for confirmed blockers
- A targeted re-review only of corrected blockers when warranted; no second broad audit
- Normal private commit/push is authorized after all completion gates pass
- Release, tag, deployment, publication, visibility changes, and original-AgentIntersect modification remain prohibited

A finding blocks only when it has a concrete supported path to broken normal operation, contract failure, data loss/corruption, secret/path exposure, unsafe destructive action, or a material Phase 6 impediment. Speculative hardening and later-phase features are non-blocking backlog.
