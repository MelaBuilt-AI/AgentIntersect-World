# Phase 18.5 Frozen Scope — Avatar and World Visual Production

Status: **FROZEN / AUTHORIZED FOR IMPLEMENTATION**

> **Current disposition (2026-08-01 local / 2026-08-02 UTC):** Aaron selected
> [Option 2](./PHASE_18_5_OPTION_2_SCOPE.md). This document and its generated
> modular-avatar/native results remain historical authority for their exact
> inputs. Durable repository visual production, fallback/accessibility truth,
> measurement methodology, and unchanged thresholds remain Phase 18.5. Current
> imported-avatar acceptance is a separate versioned track; do not treat the
> historical five-input or July 26 native record as current-product proof.

Frozen: 2026-07-26
Branch: `phase/18.5-visual-production`
Base commit: `998068811cbb6a8770bd50c04bb6cc8268db167c`

## Authority

Aaron authorized Phase 18.5 as the next implementation milestone and delegated
the visual and production choices in the 2026-07-26 worker mission to Mr
Fluff's recommended decisions. That mission, `AGENTS.md`,
`AgentIntersect_WorldDD.md`, and `docs/WORLD_ENTRY_EXPERIENCE.md` are the
controlling authority, in that order for this bounded implementation. The
choices below are approved, not pending.

Phase 18 remains open. This scope neither accepts nor waives its physical-mouse
camera, live Hermes chat/voice, or bounded coding gates. Phase 19 and Phase 20
remain unauthorized.

## Observable delivery

Phase 18.5 replaces the prototype avatar and repository geometry with one
deterministically generated, game-ready visual system:

1. an original, smooth, modular human/dog/cat avatar family;
2. one shared biped superset rig and reusable semantic action contract;
3. PBR atlases, explicit LODs, expression/speech/ear/tail composition, and
   constrained/reduced-motion fallbacks;
4. truthful semantic repository object families driven only by existing World
   snapshot metadata; and
5. integrated browser proof, deterministic machine inspection, measurements,
   evidence boards, and reproducible source assets.

The hero gate is a distinct human-plus-cat proof within the same generator and
runtime contract. It is recorded before full-family expansion, but Aaron's
delegated approval authorizes the worker to continue through the dog and full
modular family without pausing for another style decision.

## Approved art direction

The selected direction is **Luminous Codecraft**: premium, original,
stylized-real-time forms with rounded silhouettes; graphite and midnight-navy
matte PBR surfaces; warm readable skin and fur; restrained harness accents;
subtle cyan/violet emissive circuit seams; expressive eyes; clean facial
planes; readable ears, tails, hands, paws, and claws; and semantic
machine/architecture motifs for repository objects. The tone is approachable,
clever, tactile, and game-ready. It is neither photorealistic nor derived from
an existing franchise.

At least three coherent self-authored direction boards and a scored comparison
must be retained. The final style bible selects Luminous Codecraft and records
the rationale.

## Provenance and production boundary

All Phase 18.5 production is project-owned and self-authored. Permitted tools
are the repository's existing Blender 5.2 LTS/Python, SVG/HTML/CSS, Three.js/R3F,
and workspace tooling. Evidence imagery is generated deterministically from
project-authored source or captured from the real local product.

The implementation must not:

- call cloud image or model services;
- install ComfyUI, models, npm packages, pip packages, or other dependencies;
- download or incorporate third-party models, textures, assets, or concept art;
- inspect or modify the original `/home/user/AgentIntersect` repository;
- work on Phase 18 live harness/voice acceptance, Phase 19, Phase 20, LAN setup
  UI, custom Mr Fluff voice, provider activation, publication, release, tags,
  deployment, public ingress, visibility, commit, or push.

## Avatar contract

- Preserve every existing avatar profile choice and the lossless migration path
  from saved `aiw.avatar/0.11` profiles.
- Preserve 12 heads (four human, four dog, four cat), 12 colors, four shirts,
  hand/paw/claw and foot/paw/claw families, fur, tail, and marking choices and
  current selection labels.
- Use one shared superset biped armature and one reusable primary action set for
  every species. Target approximately 60 purposeful bones; a small generator-
  documented variance is allowed.
- Articulate fingers, jaw, eyes, brows/face, multi-segment ears, and
  multi-segment tail controls.
- Supply these primary semantic actions:
  `Idle`, `Walk`, `Run`, `TurnLeft`, `TurnRight`, `StartWalk`, `StopWalk`,
  `Talk`, `Listen`, `Wave`, `Point`, `Explain`, `Think`, `Nod`, `Shrug`,
  `Work`, `Celebrate`, `Error`, and `Offline`.
- Locomotion must show foot contact, opposing arm swing, hip/chest
  counter-rotation, readable starts/stops, and readable turns.
- Runtime transitions use smooth crossfades plus practical upper-body,
  face/speech, gaze, and anatomical secondary-state composition. Reduced motion
  freezes or simplifies secondary movement without hiding semantic state.
- Every head family exposes blink, brow up/down, eye wide/squint, smile/frown,
  jaw open, and `O`, `E`, `MBP` speech shapes (or stable exact equivalents).
  Ears and tails expose neutral/listening/talking/celebrate/error states where
  anatomically applicable.
- Materials are PBR-capable and use deterministic shared atlases/maps:
  base-color, ORM (or explicit roughness/metallic equivalents), normal/detail,
  and emissive where used. UVs and image references must survive GLB export and
  independent inspection.
- Use explicit LOD0/LOD1/LOD2 assemblies with stable module signatures. Avoid
  per-avatar texture duplication.
- Runtime distance-based avatar LOD selection is temporarily disabled following
  direct operator visual acceptance on 2026-07-26: all avatar contexts render
  LOD0 until the lower-detail assemblies preserve authored identity, clothing,
  face, hands/feet, fur, and panel/circuit details at normal camera ranges. The
  existing LOD1/LOD2 assets remain available for a later quality correction.

## Repository visual grammar

Replace the shared box presentation with deterministic, shared/instanced
semantic geometry. The typed renderer projection may be extended only from
truthful metadata already present in the World snapshot/code graph. It must not
read hidden content or fabricate semantics.

The minimum families are:

1. package/workspace hub;
2. directory/archive gate;
3. source file/code slab;
4. test file/beacon;
5. documentation/book;
6. config/control terminal;
7. data/storage vault;
8. binary/artifact crate;
9. symbol/function node;
10. dependency bridge; and
11. evidence/change marker.

Transforms, colors, details, caps, selection, minimap, camera, and semantic DOM
equivalents remain deterministic and stable. Existing large-repository
instancing and bounds remain enforced.

## Measurable budgets

| Metric                                 |    Frozen limit |
| -------------------------------------- | --------------: |
| Assembled hero LOD0 triangles          | `25,000–65,000` |
| Assembled hero LOD1 triangles          | `12,000–32,000` |
| Assembled hero LOD2 triangles          |  `4,000–12,000` |
| Avatar runtime GLB                     |     `<= 16 MiB` |
| Authoritative Blender source           |     `<= 48 MiB` |
| Phase 18.5 avatar texture payload      |     `<= 12 MiB` |
| LOD0 draw calls/proxy                  |         `<= 18` |
| LOD1 draw calls/proxy                  |         `<= 12` |
| LOD2 draw calls/proxy                  |          `<= 8` |
| Full-world main-thread render-work p95 |    `<= 16.7 ms` |
| Full-world raw frame cadence p95       |    `<= 16.8 ms` |
| Long Task maximum                      |     `<= 100 ms` |

The draw-call verifier may use a transparent, documented material/primitive
proxy if headless GLB inspection cannot measure live renderer calls directly;
the metric may not be omitted.

The inherited two-CPU/constrained-cosmetics contract is unchanged: constrained
or forced text fallback must not request the avatar GLB. Lazy loading, semantic
fallback, current selection labels, WebGL context-loss recovery, reduced
motion, forced colors, keyboard access, and repository caps may not regress.

## Tests and acceptance

Implementation follows RED→GREEN TDD for software and verifier behavior.
Completion requires:

- schema migration/load/save/action-projection compatibility tests;
- generator and asset-contract verifier tests;
- two independent clean Blender generation processes;
- byte-identical GLB, PNG, manifest, and inspection JSON output where intended,
  with any volatile `.blend` container metadata isolated and documented;
- independent `.blend` and GLB inspection of bones, clips/tracks, expression
  targets, meshes, materials, textures, modules/LODs, bounds, hashes, budgets,
  and evidence inventory;
- distinct hero-gate proof followed by full-family proof;
- repository-family projection, deterministic geometry, selection, DOM,
  instancing/caps, and fallback tests;
- actual Chromium/Playwright journeys with console/page-error capture and
  integrated screenshots;
- Phase 18.5 performance measurement at the inherited thresholds;
- focused checks, canonical `pnpm check`, avatar verification, relevant
  Storybook production build, production dependency audit, and `verify:fresh`;
  and
- deterministic evidence comprising concept comparison, style bible, hero
  board, family contact sheet, multi-view sheet, face/speech sheet,
  hand/gesture sheet, motion sheet, wireframe/LOD/UV/PBR sheet, semantic
  repository kit sheet, browser screenshots, and paired machine JSON.

No pass may be claimed from a placeholder, fabricated observation, or weakened
threshold. Any unavailable environmental proof is reported with its exact
command and output.

## Rollback and recovery

All production sources and outputs live in World-owned Phase 18.5 paths and
remain uncommitted for parent review. The deterministic generator is the
authority for `.blend`, GLB, texture, manifest, inspection, and generated
evidence outputs. Regeneration into a clean temporary directory must not depend
on local caches, network access, or manual Blender edits.

Rollback is file-scoped: remove the Phase 18.5 generated outputs and revert the
bounded runtime/projection/schema call sites to the base commit. Existing
`aiw.avatar/0.11` data remains readable throughout. The previous semantic DOM
and text-only paths remain available if WebGL, assets, or context recovery fail.
Durable gate progress is recorded in
`artifacts/phase18-5/codex-progress.md`.

## Change policy

This document is frozen before implementation edits. Work remains inside the
boundaries above. A change is permitted only for an observed functional blocker
to the authorized slice, must be the narrowest correction possible, and must be
documented here before or alongside that correction with the observation,
affected acceptance criterion, and rollback. Convenience, speculative
hardening, and later-phase work are not scope-change reasons.

### Scope corrections

#### 2026-07-26 — parent visual correction

The parent review of the generated 3×3 montage established that the machine
contract alone did not prove the authorized visual-production quality. The
avatars remained visibly primitive, several evidence boards showed abstract
swatches instead of the generated forms, facial/hand detail was not reviewable,
and the 5,153-triangle assembled LOD0 corroborated the low-detail result.

This correction keeps the original ceilings and adds the approved quality
floors above: assembled hero LOD0 `>= 25,000`, LOD1 `>= 12,000`, and LOD2
`>= 4,000`. Each LOD must record its exact included mesh set and a distinct
geometry signature, so distance quality is verified from real geometry rather
than renamed or proxy-only metadata. The generator must also author the
concept, style-bible, facial, hand, contact, and repository-kit boards from
actual project-owned generated geometry. Rollback is limited to this generator,
contract/verifier, generated outputs, and correction evidence; no profile,
runtime authority, Phase 18, Phase 19/20, provider, dependency, or public-action
boundary changes.

#### 2026-07-26 — parent browser correction

The first real parent-run integrated World journey is authoritative correction
evidence. It revealed that Blender's shared-atlas multiply graph exported
implicit-white GLB base-color factors, the activity billboard obscured the
agent silhouette, framing underused the viewport, semantic animation layers
were not consumed by the World renderer, and the reduced-motion measurement
lane perturbed its own browser-global cadence samples. The narrowly authorized
correction therefore:

- requires distinct, non-white effective GLB identity for representative
  skin/fur, graphite/midnight, harness, and cyan/violet emissive materials;
- wires activity and movement into base, upper-body, face, gaze, and ear/tail
  layer application with the frozen 0.22-second crossfade;
- makes builder/roster/World LOD policy explicit and observable, with World
  using real LOD2 beyond 10 world units while preserving all triangle bands;
- bounds the billboard and repository composition for a 1600×1000 World view;
  and
- measures normal-motion consecutive rAF cadence only after warm-up, observes
  Long Tasks only in that window, and moves explicit `gl.finish()` render-work
  samples to a separate sparse phase. Reduced-motion demand rendering remains
  a separate semantic-pose assertion.

The parent's failing measurement and screenshots remain evidence until a later
real parent rerun replaces them. No threshold, quality floor, inventory,
provenance, compatibility, or fallback contract is weakened.

#### 2026-07-26 — third parent browser correction

The next real browser rerun confirmed material and semantic-action integration
but established a further narrow functional blocker. The normal command timed
out at 30 seconds; the diagnostic rerun measured 1.2 ms render-work p95,
100.1 ms cadence p95, and a 110 ms Long Task against a blank-Chromium 16.7 ms
p95 calibration. It also established null LOD/render-loop datasets on the
actual canvas, unequal avatar depth, HUD clipping, and an off-screen repository
kit. The retained failed screenshots and measurement remain authoritative.

Inside the existing performance/fallback, runtime integration, and evidence
scope, this correction:

- writes LOD and render-loop truth directly to `gl.domElement.dataset`;
- places both World avatars at equal depth and scale, moves the repository
  behind/between them, retargets the camera, and reanchors the billboard;
- fixes World DPR at 1.0 and keeps both initial assemblies in the real
  species-specific 4,040-triangle LOD2 tier;
- stops the separate DOM movement rAF while idle and removes live HUD backdrop
  blurs over the WebGL surface;
- physically removes hidden/unselected meshes after material selection,
  memoizes configured clones by selection values plus LOD, caches runtime layer
  targets, and updates one mixer per avatar;
- uses one full semantic clip at LOD2 while retaining the existing observable
  face/gaze/anatomical state and the full LOD0/LOD1 masked composition; and
- adds cadence distribution and bounded Long Task diagnostics without changing
  sample separation, the normal 30-second test timeout, or any threshold.

No Blender regeneration is authorized or required because the browser-confirmed
material factors and deterministic asset payload are unchanged. This correction
does not authorize threshold changes, quality-floor changes, Phase 18
acceptance, Phase 19/20 work, or any external/public action.

#### 2026-07-26 — fourth parent targeted correction

The next exact parent measurement confirmed zero browser errors, direct canvas
observability, passing visual composition, 0.6 ms render-work p95, and a passing
92 ms maximum Long Task. It also isolated the remaining cadence failure to the
agent crossing inside the 10-unit World cutoff after the journey's bounded
260 ms user movement: the actual canvas reported user `LOD2`, agent `LOD1`, and
the continuous render loop. Cadence was 50.1 ms median, 66.7 ms p90, 83.3 ms
p95, and 100 ms maximum, with 120/120 samples over 16.8 ms and 118 Long Tasks
totaling 6,952 ms.

The narrowly authorized correction changes only the World automatic boundary
to LOD0 at or below 6 units, LOD1 above 6 through 9 units, and LOD2 above
9 units or for non-finite distances. Builder remains forced LOD0 and roster
remains forced LOD1. The passing camera, avatar, billboard, repository, HUD,
material, animation, pruning, mixer, cached-target, DPR, measurement-timeout,
threshold, and generated-asset contracts remain unchanged. Focused proof must
cover the exact 9-unit boundary, a value just above 9, non-finite inputs, and
both avatar distances after the bounded forward journey.

#### 2026-07-26 — final hardware-evidence authority correction

The parent accepted the production visual/runtime candidate after a real
Windows Edge 150 hardware run on an NVIDIA GeForce RTX 5070 Ti. That
authoritative run proved both avatars at LOD2, the continuous loop, zero
browser/page errors, 10.2 ms cadence p95, 0.2 ms render-work p95, and no Long
Tasks at 1600×1000. Parent visual QA also passed the complete silhouettes, PBR
identity, semantic geometry, billboard, and HUD composition.

The WSL Chromium software-WebGL compositor remains a functional-emulation lane,
not cadence authority. This correction preserves its raw cadence as failed,
records the unmasked renderer on future runs, classifies common SwiftShader,
llvmpipe, lavapipe, softpipe, Basic Render Driver, and software-rasterizer
patterns, and fails closed unless current canonical hardware evidence validates
the unchanged thresholds and exact production-input fingerprints. It does not
relax a threshold, skip WebGL/material/LOD/action/loop/error/render-work/Long
Task assertions, change production assets, or broaden product scope.
