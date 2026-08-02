# Human gesture temporal annotation package

This package contains 23 models, 207 unresolved semantic decisions, and 417 raw non-locomotion clips. The 69 accepted Idle/Walk/Run decisions are locked and excluded from annotation.

Serve the repository root locally (the viewer does not use the network):

```bash
python3 -m http.server 8765 --directory .
```

Navigate on that local server to `artifacts/avatar-replacement-evidence/world-animation-metadata-investigation-v1/annotation-package/viewer.html`. Review raw `(modelId, clipIndex)` units with play/pause, looping, speed, and scrubbing. A source name such as `NlaTrack` is transport metadata, never a semantic label.

## Bounded resumable batches

`annotation-batches.json` partitions the work into 23 deterministic batches, one model per batch in viewer order. Together they cover all 23 models, 207 unresolved decisions, and 417 raw clips exactly once. The plan contains only raw identities, counts, and hashes; it contains no suggestion, assignment, reviewer identity, or fabricated progress.

For each batch, import the latest **full annotation document** (or start with `annotation-template.json` for batch 001), select the batch model, and review that model only. At the batch boundary, export the full document, save it as a checkpoint named with the batch ID, and run partial validation before continuing. Resume later by importing the latest full-document checkpoint; never splice per-model fragments. `modelBindingCanonicalSha256` and the top-level template/authority hashes make stale batch catalogs fail exact generation checks.

Export the JSON from the viewer, then validate partial progress:

```bash
python3 tooling/avatar/avatar_gesture_annotation.py validate path/to/annotations.json --allow-partial
```

Strict validation and deterministic proposal generation require all 207 semantic decisions, reviewer identity/time, evidence references, and notes:

```bash
python3 tooling/avatar/avatar_gesture_annotation.py validate path/to/annotations.json
python3 tooling/avatar/avatar_gesture_annotation.py propose path/to/annotations.json --output path/to/proposal.json
```

The proposal command never edits `semantic-review.json`, the manifest, registry, or GLBs. Incomplete, malformed, conflicting, duplicate, stale-hash, or unsupported-vocabulary input is rejected. `uncertain` entries remain fail closed. A proposal is non-authoritative until a separate reviewed generator change incorporates it and the existing deterministic gates pass.
