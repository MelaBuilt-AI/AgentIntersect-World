# Imported-Model Avatar Builder — Frozen Slice Contract

Status: historical; superseded by `AVATAR_REPLACEMENT_MODULAR_ANIMATION_SCOPE.md`

Frozen: 2026-07-28

The active product direction now uses complete imported avatars for users and
agents. Cross-model modular composition is deferred as a possible later feature
and is not exposed in the normal builder.

This document freezes the bounded imported-model avatar-builder slice. It does
not authorize Phase 18.5, Phase 19, Phase 20, external delivery, or changes to
the original AgentIntersect repository.

## Registry authority and role availability

- One imported-model registry/manifest is authoritative for normal new-avatar
  selection, preview/runtime routing, segmentation inventory, compatibility,
  and deterministic intake validation.
- Role availability is explicit metadata and is never inferred from a model
  name or UI caller.
- `user-male` is the sole selectable `user` model.
- `cat-agent` and `futuristic-robot` are the only initial selectable `agent`
  models.
- A new user draft defaults to `user-male`. A new agent draft defaults
  deterministically to `cat-agent`.
- Semantic clip maps remain model-local even when clip indices coincide.

## Legacy lifecycle and migration

- The generated/custom catalog has lifecycle `legacy` and is absent from normal
  new-profile selection.
- Its loader, assets, saved-profile hydration, session transport, and World
  renderer fallback remain intact. This slice does not delete legacy code or
  rewrite stored profiles in bulk.
- A legacy saved profile entering the builder is previewed unchanged and
  clearly labeled as a preserved legacy profile.
- The builder offers role-valid imported migration choices but does not expose
  generated/custom controls as normal new-avatar choices.
- A legacy profile changes only after the operator explicitly selects an
  imported model and saves. Opening, previewing, or hydrating the builder never
  silently rewrites it.

## Required registry metadata

Every imported model records:

- a stable model ID;
- explicit allowed roles;
- lifecycle and builder visibility;
- preview and runtime asset URLs;
- a model-local semantic clip map;
- preview and World transforms, including grounding;
- stable segment IDs and an inventory pointer;
- skeleton hierarchy, rest-pose, and inverse-bind fingerprint data;
- an explicit compatibility class;
- thumbnail URL;
- source/provenance classification;
- supplied license status without invention;
- explicit fallback and migration policy.

Persisted/browser input may contain only allowlisted model IDs and stable part
IDs. Arbitrary GLB URLs and arbitrary scene node names are never trusted as
profile state.

## Intake, segmentation, and compatibility

- Deterministic intake/checking rejects missing or duplicate IDs, empty roles,
  lifecycle/visibility conflicts, invalid clip indices, missing transforms,
  missing fingerprint or compatibility data, duplicate/ambiguous stable part
  IDs, and other ambiguous metadata with clear errors.
- The check/regeneration path validates repository-owned GLBs, thumbnails,
  inventory, and intake-manifest hashes. It does not require or claim a fresh
  comparison to original Pictures source files.
- Same-model segmentation/isolation remains available for segmented assets.
- Cross-model skinned-part swapping remains unavailable unless skeleton, bind,
  scale, socket, and skin-weight compatibility is proven.
- The three initial models are not advertised as cross-model compatible.

## Persistence and animation invariants

- At least one preserved legacy profile and one new imported profile must
  survive hydration, save/reload, session transport, and normal World rendering.
- Creator-preview clip selection remains separate from World semantic action
  selection.
- Existing `Idle`/`Walk`/`Run`, Shift-to-Run, 0.22-second crossfades,
  runtime-only cloned Hip travel normalization, source-clip immutability, and
  safe Idle fallback remain required.

## Non-goals

- No destructive legacy removal or bulk profile rewriting.
- No new GLBs, Blender or mesh edits, retargeting/rebinding pipeline, or
  cross-model part interchange.
- No voice, live coding, Phase 18.5, Phase 19, or Phase 20 work.
- No dependency upgrades, credential/provider changes, service restarts, public
  ingress, commits, pushes, merges, tags, releases, deployment, publication, or
  visibility changes.
- The frozen Phase 18.5 fingerprint/evidence validator is not changed, weakened,
  or rebound. Its expected renderer-fingerprint failure is separate from this
  slice's functional acceptance.
