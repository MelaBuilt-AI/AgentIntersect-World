# Phase 18.5 — Avatar and World Visual Production

Date: 2026-07-26
Branch: `phase/18.5-visual-production`
Base: `998068811cbb6a8770bd50c04bb6cc8268db167c`

## Outcome

The authorized Phase 18.5 implementation is parent-verified and remains
uncommitted only until the authorized private delivery step. The frozen
Luminous Codecraft direction, deterministic modular avatar family, shared
rig/action/facial/PBR/LOD contracts, semantic repository kit, runtime
integration, tests, production builds, inspections, and visual evidence are
implemented.

The first parent review rejected the generated montage because its
concept/style/repository boards were abstract, its hand and face changes were
not reviewable, and its 5,153-triangle LOD0 corroborated visibly primitive
avatars. The parent visual correction is now implemented in the authoritative
generator: actual forms replace abstract evidence, topology and surface
language are materially richer, and enforced quality floors accompany the
original ceilings.

The second parent review ran the actual built World in Chromium and exposed
implicit-white GLB material factors, an oversized activity billboard, weak
camera/repository framing, unconsumed animation layers, and an invalid
self-perturbing cadence lane. Its material and animation corrections were
confirmed in a third parent browser run.

The final parent hardware run used production Edge 150 on an NVIDIA GeForce RTX
5070 Ti at 1600×1000. It reported zero browser/page errors, both avatars at
LOD2, the continuous loop, 120 cadence samples after 45 warmup frames, 10.2 ms
cadence p95, 0.2 ms render-work p95 over 24 samples, and zero Long Tasks. Every
unchanged threshold passed. Parent visual QA passed full silhouettes, PBR
identity, semantic repository geometry, and non-overlapping billboard/HUD
composition. The production visual/runtime result is accepted.

The retained WSL software-WebGL lane remains explicitly non-authoritative for
cadence: raw median 33.3 ms, p95 50.0 ms, render-work p95 0.3 ms, zero Long
Tasks, both LOD2, and no browser errors. Its JSON records
`cadenceAuthoritative:false`, `cadencePassed:false`, and
`hardwareEvidencePassed:true`; overall evidence passes only because the
canonical hardware record and every production fingerprint validate. The
independent verifier reports 28/28.

After that acceptance, the parent canonical `pnpm check` comparison against the
base SHA exposed seven regressions in inherited dashboard journeys: authority
cancellation reachability, Phase 10 10k/100k preparation and cadence, the
12-avatar Phase 11 roster cadence, Phase 5 background deselection, and Phase
13/14 cadence. The bounded correction passed the complete canonical check and a
596-file disposable `verify:fresh` run without changing any of the five
hardware-fingerprinted inputs. The closeout restored unrelated generated churn
under historical Phase 13–18 evidence directories. A production audit then
found the patched `find-my-way` advisory through Fastify; the workspace now
pins `find-my-way` 9.7.0, the audit reports no known vulnerabilities, 206/206
local-server tests and smoke pass, and the final fresh-copy gate is green.

## Frozen scope and decisions

- `docs/PHASE_18_5_SCOPE.md` was the first edit.
- `assets/phase18-5/phase18-5-asset-contract.json` is the enforced,
  machine-readable contract.
- Luminous Codecraft was selected from three original project-authored
  directions with the delegated approval recorded as final.
- Production used only repository-owned Blender 5.2 LTS, Python, SVG/HTML/CSS,
  Three.js/R3F, and existing dependencies. No cloud generation, ComfyUI/model
  download, third-party visual asset, or new dependency was used.
- The human-plus-cat hero gate was implemented and retained separately before
  the same contract was expanded to dog and the complete modular family.
- Existing `aiw.avatar/0.11` profiles and the legacy storage key migrate
  losslessly to `aiw.avatar/0.18.5`.
- Phase 18 live Hermes/voice/coding gates, Phase 19/20, the original
  AgentIntersect repository, providers, releases, publication, and deployment
  remained out of scope.

## Implemented production system

### Avatars

- Preserved all 12 heads, 12 colors, four shirts, hand/paw/claw families,
  foot/paw/claw families, fur, tails, and markings.
- Generated one 60-bone superset biped rig with fingers, jaw, eyes, brows,
  multi-segment ears, and a six-segment tail.
- Generated 19 reusable primary actions: Idle, Walk, Run, TurnLeft, TurnRight,
  StartWalk, StopWalk, Talk, Listen, Wave, Point, Explain, Think, Nod, Shrug,
  Work, Celebrate, Error, and Offline.
- Exposed 11 consistent morph targets on all 12 heads: blink, brow up/down, eye
  wide/squint, smile/frown, jaw open, and O/E/MBP speech shapes.
- Added consumed 0.22-second base/upper-body crossfades, morph-target facial
  composition, gaze/head/eye offsets, and semantic ear/tail poses. Reduced
  motion retains the semantic pose while freezing secondary motion.
- Wired user movement through StartWalk → Walk → StopWalk → Idle and agent
  activity through Think, Explain, Work, Celebrate, Error, and bounded terminal
  return to Idle. Current action, face, gaze, anatomical state, render loop, and
  LOD are observable on the World canvas.
- Authored four shared deterministic PBR atlases: base color, ORM, normal, and
  emissive. The generated GLB now explicitly multiplies those atlases by
  distinct skin/fur, graphite, midnight, harness, cyan, and violet factors.
- Runtime body-color assignment clones selected materials per avatar rather
  than mutating shared source materials.
- Rebuilt the smooth modules at production-review density, with five separate
  two-part fingers, four-toe paw/claw modules, larger species muzzle/cheek/ruff
  forms, graphite articulation panels and joint collars, warm skin/fur,
  harness-specific shells, and cyan/violet emissive seams.
- Added a rigged, species-specific far-distance body and harness shell; LOD2 is
  real runtime geometry rather than renamed metadata. Every LOD records its
  exact mesh set and an independently checked geometry signature.
- Builder/inspection forces LOD0, roster uses LOD1, and World automatically
  selects LOD0 through 6 units, LOD1 above 6 through 9 units, and LOD2 beyond
  9 units or for non-finite distances.
- World configuration physically removes hidden and unselected render meshes
  from each cloned scene after material selection. LOD2 retains the armature,
  selected species body, and selected harness instead of traversing the whole
  hidden modular kit.
- Configured scenes are memoized from the stable selection-value key plus LOD,
  layer targets and morph meshes are cached once, and one AnimationMixer updates
  once per avatar. LOD2 uses one full semantic clip while retaining observable
  face/gaze/anatomical state; LOD0/LOD1 retain masked base/upper-body layering.

### Repository visual grammar

- Replaced the shared-box presentation with distinct shared geometries for
  package/workspace hubs, directory/archive gates, source/code slabs, test
  beacons, documentation books, config/control terminals, data/storage vaults,
  binary/artifact crates, and symbol/function nodes.
- Added dependency bridges and evidence/change markers.
- Classification uses only projected truthful snapshot metadata. Deterministic
  transforms, stable selection, caps, minimap/camera behavior, instancing, and
  semantic DOM equivalents are preserved.

### Runtime and fallback

- Preserved lazy avatar loading and the constrained/forced-text rule: no avatar
  GLB request occurs in the inherited two-CPU fallback.
- Preserved reduced motion, forced colors, keyboard semantics, semantic DOM,
  context-loss handling, and current selection labels.
- Reframed both World avatars at equal depth: user `[0, 0, 0]`, agent
  `[2.6, 0, 0]`, both scale `0.82`. The camera initializes near
  `[0, 5, 9.5]` toward `[1, 0.7, 0]`; the repository is centered behind them at
  `[1.1, 0, -2.4]` with maximum scale `0.24`; and the activity billboard is
  `1.65×0.5` at `[2.6, 3.25, 0]`.
- World DPR is fixed at 1.0. The equal-depth camera distance and 9-unit
  far-tier boundary keep both World assemblies in the real 4,040-triangle
  species-specific LOD2 tier throughout the bounded initial movement journey.
- The DOM movement loop now exists only during StartWalk/Walk rather than
  scheduling a second perpetual idle rAF callback beside R3F. The transcript
  and composer retain opaque readable panels without costly live
  `backdrop-filter` passes over the WebGL surface.
- `data-user-avatar-lod`, `data-agent-avatar-lod`, and `data-render-loop` are
  written directly to `gl.domElement.dataset`; declarative Canvas props remain
  secondary metadata.
- Corrected the measurement journey: normal motion uses the continuous World
  loop; 45 frames warm up before a 120-frame independent rAF cadence/Long Task
  window; 24 explicit render-work samples run afterward in a sparse phase.
  Reduced-motion demand rendering is asserted separately.
- The measurement records the unmasked WebGL renderer and classifies cadence
  authority as hardware or software emulation. Software cadence remains raw and
  failed; current fingerprinted hardware evidence is mandatory for its overall
  pass. Hardware runs must pass live cadence directly.

## Deterministic assets and budgets

Two independent clean Blender processes produced byte-identical GLB, nine
rendered evidence PNGs, four texture atlases, manifest, and semantic inspection
JSON: 16/16 intended stable outputs. Blender's compressed `.blend` container
metadata is documented as the only process-volatile output; its source
semantics are independently inspected.

| Budget                      |          Result |          Limit |
| --------------------------- | --------------: | -------------: |
| Runtime GLB                 | 6,188,344 bytes |     16,777,216 |
| Blender source              | 1,901,342 bytes |     50,331,648 |
| Avatar textures             |     9,044 bytes |     12,582,912 |
| LOD0 triangles / draw proxy |     33,329 / 18 |   25k–65k / 18 |
| LOD1 triangles / draw proxy |     30,408 / 12 |   12k–32k / 12 |
| LOD2 triangles / draw proxy |       4,040 / 8 |     4k–12k / 8 |
| Rig / clips / heads         |    60 / 19 / 12 | contract exact |

The rerun 10,000-object repository preparation journey passed: median 1.442 ms,
maximum 2.197 ms, stable selection index 9,999 in 1.259 ms, against the inherited
250 ms threshold.

## TDD and verification

The original implementation retained its RED→GREEN schema, action/layer, and
semantic-family history. For the parent visual correction, RED was observed
again: the old manifest failed the new LOD0 quality floor at 5,153 triangles and
had no included-mesh or geometry-signature evidence. The parent browser
correction then established eight focused RED failures plus a missing GLB
factor error. A final layer-application regression also failed before the
renderer stopped accumulating untracked gaze/ear/tail offsets on every frame.
The third parent correction added 14 observable RED failures for physical
pruning, stable memo inputs, cached targets, one-mixer/LOD2 composition, direct
canvas datasets, safe projection descriptors, and diagnostic measurement
fields, including the redundant idle movement loop. The fourth targeted
correction then produced 2 RED failures for the exact 9-unit boundary and the
post-260 ms journey agent distance. Final evidence-authority TDD added one
missing-module RED suite and three missing-verifier-function RED errors for
classification, fingerprint drift, threshold breach, and failed/error
evidence. The final full-gate correction then observed RED as a missing policy
module plus two absent renderer helpers, with 18 existing tests still green.
GREEN is 5 regression-focused Vitest files / 41 tests plus 7/7 focused Python
tests. The correction:

- clears R3F pointer misses through a nullable selection callback;
- avoids enriching/preparing 10k/100k graph snapshots that no canvas can
  consume by bounding WebGL projection to 2,000 and semantic fallback to 160;
- uses a deterministic aggregate renderer descriptor at 1,000+ instances
  (DPR 1, antialiasing off, shared basic family materials) while retaining the
  detailed PBR semantic geometry below that threshold;
- keeps all 12 roster LOD1 avatars visible in a bounded 56rem × 24rem surface;
- defers optional compact 3D preview loading for 1,400 ms, beyond the unchanged
  1,200 ms authority-operation window; and
- preserves already-current formatted GLB inspection JSON so verifier-first
  gate ordering remains reproducible.

| Command or lane                       | Result                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Prettier / ESLint / TypeScript        | PASS; no warnings or errors; 38/38 typecheck tasks                                                           |
| Architecture / Vitest                 | PASS; 11/11 architecture, 116/116 files and 642/642 tests                                                    |
| Production build / smoke / Storybook  | PASS; 20/20 production builds                                                                                |
| Parent browser aggregate              | PASS; 55/55 flagged Playwright plus 1/1 unflagged fail-closed                                                |
| Fresh-copy verification               | PASS; locked install and every required lane for 596 project source files                                    |
| Blender source inspection             | PASS; 60 bones, 19 actions, 85 meshes, 114,936 full-kit triangles; assembled LODs independently counted      |
| Independent GLB/contract verifier     | PASS; 28/28, including software functional evidence, hardware evidence, screenshot, and current fingerprints |
| Deterministic regeneration            | PASS; 16/16 intended files identical across two clean processes                                              |
| Parent Edge hardware measurement      | PASS; cadence p95 10.2 ms, render-work p95 0.2 ms, Long Tasks 0, both LOD2, continuous, errors []            |
| WSL software-emulation evidence       | Functional PASS; raw cadence p95 50.0 ms remains FAIL/non-authoritative; current hardware evidence PASS      |
| Production dependency audit           | PASS; no known vulnerabilities after pinning `find-my-way` 9.7.0                                             |
| Historical generated-artifact cleanup | PASS; unrelated Phase 13–18 test-owned churn restored and two transient videos removed                       |

Blender itself completed every file write and printed the saved-source/version
result, then could not exit because PulseAudio mainloop wake-up is prohibited.
Each generation/inspection process was interrupted only after all writes
completed, yielding exit 130 with byte-identical, hash-verified outputs.

Historical worker-sandbox context, now superseded by the parent verification
above: earlier local startup was exhausted across installed engines:

- Chromium: crashpad `setsockopt: Operation not permitted`, exit 133.
- Chromium headless shell: sandbox-host shutdown `Operation not permitted`,
  exit 133.
- WebKit: IPC `GSocket` adoption `Operation not permitted`, exit 1.
- Firefox: launch did not complete before timeout.

The worker sandbox's exact measurement attempt completed both production builds
and then failed before Playwright because the configured local server could not
listen. A direct server start failed identically. No browser result was
fabricated; parent hardware and WSL measurements remain the browser evidence.

## Evidence

- Concepts and style: `concept-comparison.*`, `style-bible.*`
- Hero and family: `hero-human-cat.*`, `family-contact-sheet.*`
- Production views: `avatar-multiview.png`, `facial-speech-sheet.png`,
  `hand-gesture-sheet.png`, `motion-sheet.png`,
  `wireframe-lod-uv-pbr.png`
- Repository kit: `repository-kit.*`,
  `repository-10k-measurement.json`
- Machine proof: `determinism.json`, `browser-inspection.json`,
  `phase18-5-measurement.json`, `phase18-5-hardware-measurement.json`, plus the
  Blender and GLB inspections under `assets/avatar/`
- Accepted hardware visual proof: `browser-world-edge-hardware.png`

## Exact reproduction

In a listener/browser-capable environment, run:

`pnpm_config_verify_deps_before_run=false corepack pnpm@11.15.0 measure:phase18.5`

Hardware renderers must pass live cadence. Software-emulated renderers retain a
failed/non-authoritative cadence result and pass overall only when the canonical
hardware evidence, screenshot, thresholds, and current production fingerprints
validate. Any source or GLB drift fails closed.

For the complete inherited regression proof, run:

`corepack pnpm@11.15.0 check`

The focused seven-test lane covers the numbered authority flow, Phase 5
repository selection/context loss, Phase 10 10k and 100k aggregate ceilings,
the Phase 11 12-avatar roster, Phase 13 deterministic browser metrics, and the
Phase 14 real-process journey. No threshold or assertion was changed.

The production visual/runtime result is parent accepted. The inherited browser
regressions, full aggregate, exact local Playwright commands, clean production
audit, historical-artifact reconciliation, and final fresh-copy verification
all pass. Private commit/push and exact-SHA CI remain pending at this report
revision; Phase 18's physical-mouse and real in-World single-agent gates remain
open, and Phase 19/20 remain unauthorized.

No commit, push, tag, release, publication, deployment, provider activation, or
other public/external action occurred.
