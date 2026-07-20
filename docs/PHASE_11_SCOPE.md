# AgentIntersect World — Phase 11 Draft Scope

Prepared: 2026-07-20
Status: **NEXT SESSION / NOT STARTED**
Dependency: completed Phase 10 at private exact-SHA closeout `7e889f3d5b95075884af3e762f77fb31dd639c37`; Actions run `29781089526` succeeded
Runtime baseline: Node `v24.18.0`, pnpm `11.15.0`
Delivery mode: fresh-session functionality-first bounded phase. This file is a restart artifact, not an implementation authorization or frozen production contract.

## Objective

Introduce privacy-safe modular agent/user avatars driven by authoritative status so embodiment improves local multi-agent legibility without leaking profile data or overstating agent state.

## Canonical scope carried forward

### In scope

- One shared biped core rig and one reusable primary animation set for every embodied avatar.
- Modular human, cat, dog, and future-species parts and surfaces: fur, tails, ears, muzzles, paw-shaped hands/feet, claws, markings, palettes, clothing, and terminal accents.
- Optional secondary tail/ear motion that does not fork the primary locomotion animation set.
- A strict avatar schema, bundled parts/forms and neutral defaults.
- Explicit opt-in AgentIntersect onboarding/profile-derived traits through a safe mapper and source disclosure.
- Roster integration and deterministic animation driven only by authoritative status.
- Locally stored user preferences.
- Text-only, reduced-motion, no-color-only, and non-humanoid-equivalent representations.
- Asset provenance/license records, rendering budgets, LOD/instancing, accessibility announcements, and visual/accessibility evidence.

### Out of scope

- Separate quadruped or per-species primary locomotion rigs/animation sets.
- Raw-memory ingestion, arbitrary profile-field ingestion, prompts/transcripts/source bodies, or private-memory replication.
- Multi-user/public multiplayer identity, public rooms, internet discovery, cloud avatar services, or accounts.
- Generative meshes, biometric inference, inferred personality, autonomous social behavior, or anthropomorphic capability claims.
- Command authority, worker lifecycle control, repository mutation, or status inferred from animation.
- Release, tag, deployment, package publication, public ingress, visibility change, or modification of original AgentIntersect.
- Blender/3D modeling, rigging, animation, or asset production during this closeout. The implementation medium remains a fresh-session decision and existing project guidance keeps Blender/3D deferred unless the user explicitly authorizes it.

## Existing dependencies and invariants

- Phase 5 owns the inherited 2D avatar builder and dashboard shell.
- Phase 6 owns authoritative normalized status/roster projection.
- Phase 9 owns local presentation awareness and may carry opaque avatar/presence references only within its bounded authority.
- Phase 10 owns bounded repository/R3F startup and performance behavior; Phase 11 must not regress its exact limits or re-eager-load the World chunk.
- The supported trust model remains one human coordinating owned agents and browser views on the same machine or trusted private/link-local LAN.
- Original AgentIntersect remains an unchanged compatibility source, not a Phase 11 implementation surface.

## Fresh-session decisions to freeze before production edits

The Phase 11 session must resolve and record each decision below in this file before launching an implementation worker:

1. **Smallest observable slice:** exact avatar forms/species and one end-to-end operator journey required for Phase 11 completion, with later forms explicitly deferred.
2. **Schema and identity:** version, opaque avatar/profile IDs, ownership, defaults, validation bounds, migration behavior, and relationship to authoritative World/roster IDs.
3. **Consent and profile mapping:** opt-in/off flow, allowed source fields, safe allowlist mapper, source disclosure, revocation/delete behavior, and canaries proving raw private fields never enter persistence, APIs, awareness, logs, or rendering.
4. **Embodiment medium:** reuse/extend layered 2D, adopt a bounded 2.5D/runtime rig, or separately authorize true 3D. Freeze asset formats and prohibit Blender/generative-mesh work unless explicitly approved.
5. **Shared rig contract:** core bones/attachment points, one reusable primary animation set, modular species surfaces, optional tail/ear secondary motion, and proof that species do not fork primary locomotion.
6. **Authoritative status mapping:** exact Phase 6 lifecycle inputs, deterministic visual/text states, stale/offline/unknown handling, transition rules, and a hard rule that animation never outruns authoritative evidence.
7. **Persistence and presentation:** local preference schema, current/previous or recovery truth, export/delete needs, and the exact bounded avatar fields—if any—allowed into Phase 9 durable/awareness state.
8. **Operator UI:** avatar editor/roster flow, source/consent disclosure, current-versus-previous labels, reachable persistent status/results, active-blue versus disabled-grey controls, and mobile behavior.
9. **Accessibility:** reduced-motion behavior, text-only equivalent, forced colors, keyboard/focus order, non-color distinctions, announcements, and no-animation success proof.
10. **Asset provenance and budgets:** source/license/hash manifest, per-avatar/download/runtime memory limits, visible avatar/instance caps, LOD policy, frame/main-thread ceilings, and CI-supported measurement environment.
11. **Fixtures and acceptance transcript:** consent off/on, hostile/raw-memory canaries, all authoritative lifecycle states, reconnect/stale/offline behavior, human/animal/text-only forms, visual snapshots, accessibility, performance, and cleanup.
12. **Versioning and artifacts:** package/schema version, required report/scope/provenance files, Storybook states, and exact closeout evidence.

## Required implementation artifacts after freeze

- Versioned avatar/profile/preferences schemas and safe mapping boundary.
- Shared biped rig/attachment/primary-animation contract in `avatar-system` or a deliberately documented alternative appropriate to the chosen medium.
- Modular bundled forms/parts with exact asset manifest, license, provenance, and hashes.
- Avatar editor and roster integration in the inherited dashboard shell.
- Authoritative status state machine plus semantic text and motion projections.
- Local persistence, consent/revocation, and bounded presentation integration if approved.
- Storybook fixtures and focused/full browser journeys for consent, lifecycle truth, forms, accessibility, and performance.
- `PHASE_11_REPORT.md`, final frozen `docs/PHASE_11_SCOPE.md`, any required asset provenance/performance records, canonical design/status updates, and private exact-SHA CI evidence.

## Acceptance criteria carried from the canonical design

- Avatars expose no raw private profile data.
- Status and animation never outrun authoritative run state.
- Every form and lifecycle state remains distinguishable without color.
- Text-only and reduced-motion modes retain equivalent authoritative meaning and actions.
- Asset, renderer, main-thread, and frame budgets frozen at session start all pass on the supported parent/CI environment.
- Consent-off mode creates no profile-derived persistence, API, presentation, or rendering data.
- One shared biped core and reusable primary animation set serves all implemented human/animal forms; optional secondary appendage motion does not fork it.
- The repository remains private/local-first and original AgentIntersect remains unchanged.

## Exit gate

Phase 11 may be called complete only after the frozen smallest observable slice functions in the supported local environment; focused, integrated/full, browser, accessibility, visual, performance, provenance, and fresh-copy evidence is independently green; observed defects are corrected and retested; the private repository is committed/pushed; exact-SHA CI succeeds; and repository/vault continuity is aligned.

The canonical exit review is privacy/accessibility-focused and bounded to the frozen local/LAN threat model. Do not reintroduce public-multiplayer, enterprise, cloud, or speculative hardening scope.

## Closeout boundary

This marker authorizes Phase 11 as the **next session topic only**. No Phase 11 production code, dependency installation, asset generation/copying, Blender work, parser/render changes, worker launch, or implementation has begun. A fresh session must read `AGENTS.md`, `PROJECT_STATUS.md`, the canonical Phase 11 design section, and this draft; refresh jCodeMunch; freeze the decisions above; and only then request implementation authorization.
