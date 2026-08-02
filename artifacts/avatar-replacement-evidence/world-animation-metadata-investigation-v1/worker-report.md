# AgentIntersect World metadata investigation and gesture annotation worker report

## Outcome

`PARTIAL_SAFE_PAUSE` only because the resumed filesystem policy denies writes to the required external Hermes run directory. Phase A and Phase B repository work are complete, tested, and fail closed. Identical full report bodies are retained in this evidence directory for parent copying.

No authoritative gesture labels were recovered. The existing authority remains byte-identical to preflight: 69 locomotion passes and 207 ambiguous gesture decisions. Runtime continues to refuse every ambiguous gesture to model-local Idle.

## Phase A — metadata channels and exact findings

The new deterministic scanner inventories the permitted source tree read-only, validates the frozen inventory, proves source/repository copy identity, parses every source GLB/glTF JSON metadata channel, searches sanitized repository/run evidence, and emits stable aliases only.

Channels checked and findings:

- Frozen source inventory: 69/69 files correspond by hash. Inventory file SHA-256 is `954ed74425b1bf6b4e2a36968ecae5c85156439e63ad74bcd4c0f3e73154d3c2`.
- Permitted source tree: 99 entries—92 files and 7 directories. Hidden entries 0; archives 0; ordinary sidecars 0; symlinks 0. The 69 frozen ready-source files and 23 sibling files are represented by stable aliases. Tree-record aggregate SHA-256 is `f948f9dc14471abdc0da97c77a9c78be9577401874606fd927ba3d0c36f8158e`.
- NTFS ADS: 92 sanitized `Zone.Identifier` streams, all `ZoneId=3`, 32,706 total bytes, aggregate SHA-256 `da5308ca0a7fdabff4bd9c7c88d1ca1a5d0196dc0b9bec90b37167ba39ea41dc`. Sanitized hostnames prove browser-download provenance from Tripo Studio and its provider data host only. They are not semantic authority. Raw locators, query strings, signatures, tokens, and provider identifiers are excluded.
- GLB container and glTF JSON: all 23 declare glTF 2.0 and generator `Tripo`; all asset copyright/extras/extensions and top-level extras/extensions fields are absent. Every scene/node/skin/mesh/animation/accessor/bufferView name/extras/extensions record was captured and hashed. None has extras/extensions. Every scene is source-named `Scene`.
- Animations: 20 models have 21 clips; 3 models have 22. The only source names are anonymous `NlaTrack*`; zero names match the supported vocabulary.
- Existing evidence: 1,055 repository/Hermes-run text files scanned and 94 sanitized file-level matches retained without excerpts/locators. No authoritative provider response, export label manifest, or sidecar maps raw clip indices to semantics.

Evidence classification:

- Authoritative semantic labels: none recovered.
- Transport/tool metadata only: exporter identity, anonymous source names, stable aliases/hashes, and sanitized download provenance.
- Forbidden as semantic authority: index/order, anonymous names, duration/timing, channel/target/accessor structure, pose/motion hashes, and cross-model similarity.
- Absent evidence: authoritative label manifest/API response/sidecar and proof of which model Aaron observed.

Aaron's Jump/Angry, Dance/Turn, and Laugh/Dance observation remains contradiction evidence only. No model was guessed or special-cased. `semantic-review.json`, the manifest, and generated registry were not regenerated or edited.

## Phase B — offline human temporal annotation workflow

The ready package covers all 23 models and all 207 unresolved semantic decisions. It exposes 417 raw non-locomotion `(modelId, clipIndex)` units because correct clips may exist outside the earlier structural candidate set. The 69 accepted `Idle`/`Walk`/`Run` decisions are locked and excluded from annotation.

The local viewer provides actual model-local animation playback, orbit, play/pause, looping, 0.25×–2× speed, and time scrubbing. Clip identity displays only model ID, raw clip index, and explicitly transport-only source name. It makes no suggestion from semantic candidates, order, duration, shape, motion metrics, or cross-model similarity.

The annotation document records schema version, manifest/review canonical hashes, model and raw clip identity, source GLB SHA-256, reviewer/time, decision, evidence reference, notes, locked locomotion evidence, and derived progress. Allowed clip decisions are exactly the nine supported gesture semantics plus `unsupported` and `uncertain`; `Turn` is rejected.

Validation rejects malformed/stale catalogs and hashes, unsupported vocabulary, duplicate semantic assignments, assigned/unsupported conflicts, changed locomotion locks, and conclusive entries without evidence/notes. Partial documents validate diagnostically but remain fail closed. Strict validation and proposal generation reject incomplete input. Model-level `unsupported` requires evidence after complete raw-catalog review.

The explicit `propose` command produces a deterministic, non-authoritative proposal only after all 207 decisions are complete. It marks current-candidate agreement `pass`, disagreement `wrong_clip` with the human-selected expected index, and proven absence `unsupported`. It never mutates semantic review, manifest, registry, or GLBs; current ambiguity therefore remains fail closed until a separately reviewed generator change incorporates a complete proposal.

Current manual burden: 207 semantic decisions across 417 raw non-locomotion clips. Template progress is intentionally 0/207 resolved, 207 remaining, and 417 raw clips `uncertain`.

Precise repository-local workflow commands:

```bash
python3 tooling/avatar/avatar_gesture_annotation.py generate --check
python3 tooling/avatar/avatar_gesture_annotation.py validate path/to/annotations.json --allow-partial
python3 tooling/avatar/avatar_gesture_annotation.py validate path/to/annotations.json
python3 tooling/avatar/avatar_gesture_annotation.py propose path/to/annotations.json --output path/to/proposal.json
```

Serve the repository root with the standard Python static server, then navigate to the annotation package's `viewer.html`. No visible browser was launched by this worker.

## Files added or modified by this worker only

Modified:

- `.prettierignore` — excludes the deterministic generated evidence directory from broad Prettier rewriting.

Added:

- `tooling/avatar/avatar_metadata_investigation.py`
- `tooling/avatar/test_avatar_metadata_investigation.py`
- `tooling/avatar/avatar_gesture_annotation.py`
- `tooling/avatar/test_avatar_gesture_annotation.py`
- `tooling/avatar/avatar_gesture_annotation_viewer.test.mjs`
- `artifacts/avatar-replacement-evidence/world-animation-metadata-investigation-v1/metadata-investigation.json`
- `artifacts/avatar-replacement-evidence/world-animation-metadata-investigation-v1/metadata-investigation-report.md`
- `artifacts/avatar-replacement-evidence/world-animation-metadata-investigation-v1/operational-findings.md`
- `artifacts/avatar-replacement-evidence/world-animation-metadata-investigation-v1/sanitized-ads-observation.json`
- `artifacts/avatar-replacement-evidence/world-animation-metadata-investigation-v1/annotation-package/annotation-template.json`
- `artifacts/avatar-replacement-evidence/world-animation-metadata-investigation-v1/annotation-package/viewer.html`
- `artifacts/avatar-replacement-evidence/world-animation-metadata-investigation-v1/annotation-package/README.md`
- `artifacts/avatar-replacement-evidence/world-animation-metadata-investigation-v1/worker-report.md`

The 278 inherited dirty paths were rehashed after implementation: missing 0, content-changed 0.

## Tests and commands

- RED focused Python tests: exit 1, two expected import errors before implementation.
- Focused metadata/annotation Python tests: exit 0, 9/9 passed. Coverage includes every required malformed/stale/vocabulary/duplicate/conflict/partial/deterministic/evidence/proposal case.
- Python compilation: exit 0 for both tools and both Python test modules.
- Metadata scanner generation and exact `--check`: exit 0; 23/23 GLBs identical; authoritative gesture labels recovered 0; ambiguous gestures 207.
- Annotation package generation and exact `--check`: exit 0; 23 models, 207 unresolved decisions, 417 raw clips.
- Partial template validation: exit 0 with valid=true, complete=false, resolved 0, remaining 207, fail-closed true.
- Strict template validation: expected exit 1, `207 decisions remain`.
- Incomplete proposal: expected exit 1; proposal file not written.
- Headless viewer test: Chromium launch attempted with `headless: true`; the restricted worker sandbox denied launch at its sandbox boundary. Direct test result was exit 0 with 1 explicit environment skip and no visible browser. The same test executes playback/identity/progress/duplicate-prevention assertions when Chromium is permitted.
- Required Vitest set—`imported_avatar_intake`, `world_animation_evidence`, `avatar-replacement-v2`, and `world-avatar-animation`: exit 0, 4 files / 30 tests.
- `python3 tooling/avatar/inspect_imported_avatars.py --check`: exit 0, 23 deterministic repository-owned avatars.
- Targeted Prettier check for the new executable JavaScript: exit 0. Full repository format check: exit 1 for 25 inherited preflight files; none is worker-created or worker-modified. No inherited file was reformatted.
- Full ESLint: exit 0.
- Typecheck: exit 0, 38/38 tasks.
- Architecture wrapper: exit 1 because restricted sandbox denied the `tsx` IPC socket. IPC-free direct checker: exit 0; focused architecture Vitest: exit 0, 11/11.
- Build: exit 0, 20/20 tasks.
- Broad functional Vitest excluding the separately paused Phase 18.5 validator: environment-blocked. Partial output showed 17 failures in six existing process/listener/fresh-child families before the restricted sandbox run hung; the owned run was terminated after more than two minutes and no process remained. This is not reported as green and did not affect the required focused 30/30 tests.
- `git lfs fsck`: exit 0.
- `git diff --check`: exit 0.
- Sensitive-locator/private-path scan of all new repository text artifacts: exit 0 with zero matches.
- `git diff --cached --name-only`: exit 0 with empty output.

Runtime was Node `v24.18.0` from the required Node 24 location, pnpm `11.15.0`, `NODE_OPTIONS=--max-old-space-size=2048`, and `TURBO_CONCURRENCY=1`.

## GLB and authority immutability proof

- Source/repository byte identity: 23/23; 328,671,832 bytes on each side.
- Source inventory, source-tree aggregate, and every per-model source/repository SHA-256 are retained in the machine report.
- `semantic-review.json` SHA-256 matches preflight: `badf3cff42fd8d1c362d56a8ca6863eff0ee388ac2b0ec5728703928b0ca17be`.
- Manifest SHA-256 matches preflight: `335d862006a811c44818dbda8607342b2ab27318e9a713ddf2fa83cd3a41adaa`.
- Generated registry SHA-256 matches preflight: `a76b7285aaa38b11f6fa4753f212bfa3a3aaf5c1c20081c2f8eff2ae27fdb93e`.
- All 278 preflight dirty entries remain present and byte-unchanged.

## Worktree, blockers, and external actions

Current worktree: branch and HEAD remain the requested accepted checkpoint; 292 dirty paths total, comprising 35 tracked modifications and 257 untracked files. The worker added/modified 14 paths over the inherited 278-path baseline. Staged paths remain 0.

The only delivery blocker is filesystem authority: the resumed sandbox grants writes only inside the repository and `/tmp`. `apply_patch` rejected both required external Hermes run-directory report paths as outside the project. The full metadata operational report and this worker report are therefore preserved here for parent copying. This does not weaken runtime behavior or evidence validation.

No file was staged, committed, pushed, published, released, or deployed. No source/shipped GLB, thumbnail, external source file, protected service, provider account, original AgentIntersect repository, later phase, or user-visible acceptance candidate was modified or launched.
