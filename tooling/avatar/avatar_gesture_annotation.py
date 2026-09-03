#!/usr/bin/env python3
"""Generate, validate, and propose fail-closed human gesture annotations."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = ROOT / "apps/web/public/assets/imported-avatars/manifest.json"
DEFAULT_REVIEW = (
    ROOT
    / "artifacts/avatar-replacement-evidence"
    / "world-animation-semantic-review-v2"
    / "semantic-review.json"
)
DEFAULT_PACKAGE = (
    ROOT
    / "artifacts/avatar-replacement-evidence"
    / "world-animation-metadata-investigation-v1"
    / "annotation-package"
)
SCHEMA = "aiw.avatar-gesture-annotation/1"
PROPOSAL_SCHEMA = "aiw.avatar-gesture-semantic-proposal/1"
BATCH_SCHEMA = "aiw.avatar-gesture-annotation-batches/1"
LOCOMOTION_SEMANTICS = ("Idle", "Walk", "Run")
GESTURE_SEMANTICS = (
    "Jump",
    "Dance",
    "Clap",
    "Cheer",
    "Wave",
    "Bow",
    "Agree",
    "Angry",
    "Laugh",
    "Dig",
)
SEMANTICS_WITHOUT_PRIOR_REVIEW = frozenset({"Dig"})
ANNOTATION_DECISIONS = (*GESTURE_SEMANTICS, "unsupported", "uncertain")
SENSITIVE_DURABLE_TEXT_PATTERNS = (
    re.compile(r"https?://", re.IGNORECASE),
    re.compile(
        r"(?:^|[\s?&;,])(?:(?:x-amz-|cloudfront-)?signature|sig|token|access[_-]?token|auth[_-]?token|policy|key-pair-id|query)\s*[:=]",
        re.IGNORECASE,
    ),
    re.compile(r"\?[^\s#]*="),
    re.compile(r"\b(?:hosturl|referrerurl)\s*[:=]", re.IGNORECASE),
    re.compile(r"(?<![a-z0-9])[a-z]:[\\/]", re.IGNORECASE),
    re.compile(r"(?<![a-z0-9])/(?:mnt|home)(?:/|$)", re.IGNORECASE),
)


class AnnotationError(ValueError):
    """Raised when an annotation document is invalid or stale."""


def canonical_json(value: Any) -> bytes:
    return (
        json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        + "\n"
    ).encode("utf-8")


def canonical_sha256(value: Any) -> str:
    return hashlib.sha256(canonical_json(value)).hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise AnnotationError(f"unable to read JSON document: {error}") from error
    if not isinstance(value, dict):
        raise AnnotationError("JSON document must be an object")
    return value


def _review_index(review: dict[str, Any]) -> dict[tuple[str, str], dict[str, Any]]:
    if review.get("schema") != "aiw.world-animation-semantic-review/2":
        raise AnnotationError("semantic-review schema is unsupported")
    decisions = review.get("decisions")
    if not isinstance(decisions, list):
        raise AnnotationError("semantic-review decisions are unavailable")
    indexed: dict[tuple[str, str], dict[str, Any]] = {}
    for decision in decisions:
        if not isinstance(decision, dict):
            raise AnnotationError("semantic-review decision is malformed")
        key = (decision.get("modelId"), decision.get("semantic"))
        if not all(isinstance(value, str) for value in key) or key in indexed:
            raise AnnotationError("semantic-review decision identity is invalid")
        indexed[key] = decision
    return indexed


def _manifest_assets(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    assets = manifest.get("assets")
    if not isinstance(assets, list) or not assets:
        raise AnnotationError("manifest assets are unavailable")
    if any(not isinstance(asset, dict) for asset in assets):
        raise AnnotationError("manifest asset is malformed")
    return sorted(assets, key=lambda asset: str(asset.get("id", "")))


def build_template(manifest: dict[str, Any], review: dict[str, Any]) -> dict[str, Any]:
    review_by_key = _review_index(review)
    models: list[dict[str, Any]] = []
    locked_count = 0
    unresolved_count = 0
    raw_clip_count = 0
    for asset in _manifest_assets(manifest):
        model_id = asset.get("id")
        source_hash = asset.get("sha256")
        if not isinstance(model_id, str) or not isinstance(source_hash, str):
            raise AnnotationError("manifest model identity or GLB hash is invalid")
        clips = asset.get("clips")
        if not isinstance(clips, list):
            raise AnnotationError(f"{model_id}: clip catalog is unavailable")
        clip_by_index = {
            clip.get("index"): clip for clip in clips if isinstance(clip, dict)
        }
        locked: list[dict[str, Any]] = []
        locked_indices: set[int] = set()
        for semantic in LOCOMOTION_SEMANTICS:
            decision = review_by_key.get((model_id, semantic))
            if (
                decision is None
                or decision.get("verdict") != "pass"
                or not isinstance(decision.get("expectedClipIndex"), int)
            ):
                raise AnnotationError(f"{model_id}: locked {semantic} evidence is unavailable")
            clip_index = decision["expectedClipIndex"]
            if clip_index not in clip_by_index or clip_index in locked_indices:
                raise AnnotationError(f"{model_id}: locked {semantic} clip is invalid")
            locked_indices.add(clip_index)
            locked.append(
                {
                    "semantic": semantic,
                    "clipIndex": clip_index,
                    "evidenceReferences": list(decision.get("evidenceRefs", [])),
                }
            )
        raw_clips = []
        for clip_index, clip in sorted(clip_by_index.items()):
            if not isinstance(clip_index, int):
                raise AnnotationError(f"{model_id}: clip index is invalid")
            if clip_index in locked_indices:
                continue
            name = clip.get("name")
            duration = clip.get("durationSeconds")
            if not isinstance(name, str) or not isinstance(duration, (int, float)):
                raise AnnotationError(f"{model_id}: clip metadata is invalid")
            raw_clips.append(
                {
                    "clipIndex": clip_index,
                    "sourceName": name,
                    "durationSeconds": float(duration),
                    "annotation": {
                        "decision": "uncertain",
                        "evidenceReference": "",
                        "notes": "",
                    },
                }
            )
        for semantic in GESTURE_SEMANTICS:
            decision = review_by_key.get((model_id, semantic))
            if decision is None and semantic not in SEMANTICS_WITHOUT_PRIOR_REVIEW:
                raise AnnotationError(f"{model_id}: unresolved {semantic} authority is invalid")
            unresolved_count += 1
        locked_count += len(locked)
        raw_clip_count += len(raw_clips)
        shipped = asset.get("shippedFilename")
        if not isinstance(shipped, str):
            shipped = f"{model_id}.glb"
        models.append(
            {
                "modelId": model_id,
                "sourceGlbSha256": source_hash,
                "assetPath": f"apps/web/public/assets/imported-avatars/{shipped}",
                "lockedLocomotion": locked,
                "clips": raw_clips,
                "uncertainSemantics": [],
                "unsupportedSemantics": [],
            }
        )
    return {
        "schema": SCHEMA,
        "manifestCanonicalSha256": canonical_sha256(manifest),
        "semanticReviewCanonicalSha256": canonical_sha256(review),
        "semanticReviewSchema": review["schema"],
        "reviewer": {"name": "", "reviewedAt": ""},
        "vocabulary": list(GESTURE_SEMANTICS),
        "states": ["unsupported", "uncertain"],
        "modelCount": len(models),
        "lockedLocomotionCount": locked_count,
        "unresolvedDecisionCount": unresolved_count,
        "rawNonLocomotionClipCount": raw_clip_count,
        "progress": {
            "resolvedDecisionCount": 0,
            "remainingDecisionCount": unresolved_count,
        },
        "models": models,
    }


def build_batch_plan(template: dict[str, Any]) -> dict[str, Any]:
    if template.get("schema") != SCHEMA:
        raise AnnotationError("annotation template schema is unsupported")
    if template.get("progress") != {
        "resolvedDecisionCount": 0,
        "remainingDecisionCount": template.get("unresolvedDecisionCount"),
    }:
        raise AnnotationError("batch plan requires a pristine unresolved template")
    models = template.get("models")
    if not isinstance(models, list) or len(models) != template.get("modelCount"):
        raise AnnotationError("batch plan model catalog is invalid")
    batches = []
    seen_models: set[str] = set()
    seen_clips: set[tuple[str, int]] = set()
    for order, model in enumerate(models, start=1):
        if not isinstance(model, dict):
            raise AnnotationError("batch plan model record is malformed")
        model_id = model.get("modelId")
        source_hash = model.get("sourceGlbSha256")
        clips = model.get("clips")
        if (
            not isinstance(model_id, str)
            or model_id in seen_models
            or not isinstance(source_hash, str)
            or not isinstance(clips, list)
        ):
            raise AnnotationError("batch plan model identity is invalid")
        raw_clip_indices = []
        for clip in clips:
            clip_index = clip.get("clipIndex") if isinstance(clip, dict) else None
            identity = (model_id, clip_index)
            if not isinstance(clip_index, int) or identity in seen_clips:
                raise AnnotationError("batch plan raw clip identity is invalid")
            seen_clips.add(identity)
            raw_clip_indices.append(clip_index)
        seen_models.add(model_id)
        binding = {
            "modelId": model_id,
            "sourceGlbSha256": source_hash,
            "rawClipIndices": raw_clip_indices,
        }
        batches.append(
            {
                "batchId": f"batch-{order:03d}",
                "order": order,
                **binding,
                "rawClipCount": len(raw_clip_indices),
                "unresolvedDecisionCount": len(GESTURE_SEMANTICS),
                "modelBindingCanonicalSha256": canonical_sha256(binding),
            }
        )
    if len(seen_clips) != template.get("rawNonLocomotionClipCount"):
        raise AnnotationError("batch plan raw clip coverage is incomplete")
    unresolved_count = len(batches) * len(GESTURE_SEMANTICS)
    if unresolved_count != template.get("unresolvedDecisionCount"):
        raise AnnotationError("batch plan unresolved coverage is incomplete")
    return {
        "schema": BATCH_SCHEMA,
        "sourceAnnotationSchema": SCHEMA,
        "annotationTemplateCanonicalSha256": canonical_sha256(template),
        "manifestCanonicalSha256": template["manifestCanonicalSha256"],
        "semanticReviewCanonicalSha256": template["semanticReviewCanonicalSha256"],
        "strategy": "one-model-per-batch",
        "checkpointFormat": "full-annotation-document",
        "checkpointProtocol": {
            "start": "import-latest-full-document-or-pristine-template",
            "finish": "export-full-document-and-run-partial-validation",
            "resume": "import-latest-full-document-before-next-batch",
        },
        "authorityMutation": False,
        "batchCount": len(batches),
        "modelCount": len(seen_models),
        "unresolvedDecisionCount": unresolved_count,
        "rawNonLocomotionClipCount": len(seen_clips),
        "batches": batches,
    }


def validate_batch_plan(plan: dict[str, Any], template: dict[str, Any]) -> None:
    expected = build_batch_plan(template)
    if canonical_json(plan) != canonical_json(expected):
        raise AnnotationError("annotation batch plan is stale or malformed")


def _require_text(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise AnnotationError(f"{label} requires evidence and non-empty text")
    return value.strip()


def _require_safe_durable_text(
    value: Any, label: str, *, allow_empty: bool = False
) -> str:
    if not isinstance(value, str):
        raise AnnotationError(f"{label} must be strings")
    normalized = value.strip()
    if not normalized and not allow_empty:
        raise AnnotationError(f"{label} requires evidence and non-empty text")
    if any(pattern.search(value) for pattern in SENSITIVE_DURABLE_TEXT_PATTERNS):
        raise AnnotationError(f"{label} contains an unsafe locator or private path")
    return normalized


def _require_exact_fields(value: dict[str, Any], fields: set[str], label: str) -> None:
    if set(value) != fields:
        raise AnnotationError(f"{label} has invalid annotation fields")


def _validate_reviewed_at(value: Any) -> str:
    reviewed_at = _require_text(value, "reviewedAt")
    try:
        parsed = datetime.fromisoformat(reviewed_at.replace("Z", "+00:00"))
    except ValueError as error:
        raise AnnotationError("reviewedAt must be a timezone-aware ISO-8601 timestamp") from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise AnnotationError("reviewedAt must be a timezone-aware ISO-8601 timestamp")
    return reviewed_at


def validate_document(
    document: dict[str, Any],
    manifest: dict[str, Any],
    review: dict[str, Any],
    *,
    require_complete: bool,
) -> dict[str, Any]:
    if document.get("schema") != SCHEMA:
        raise AnnotationError("annotation schema is unsupported or missing")
    expected = build_template(manifest, review)
    if set(document) != set(expected):
        raise AnnotationError("annotation document shape is invalid")
    for key in (
        "manifestCanonicalSha256",
        "semanticReviewCanonicalSha256",
        "semanticReviewSchema",
        "vocabulary",
        "states",
        "modelCount",
        "lockedLocomotionCount",
        "unresolvedDecisionCount",
        "rawNonLocomotionClipCount",
    ):
        if canonical_json(document.get(key)) != canonical_json(expected[key]):
            raise AnnotationError(f"annotation document has stale or invalid {key}")
    models = document.get("models")
    if not isinstance(models, list) or len(models) != len(expected["models"]):
        raise AnnotationError("annotation model catalog is incomplete")
    resolved_count = 0
    uncertain_clip_count = 0
    uncertain_semantic_count = 0
    unsupported_clip_count = 0
    for model, expected_model in zip(models, expected["models"], strict=True):
        if not isinstance(model, dict):
            raise AnnotationError("annotation model is malformed")
        if set(model) != set(expected_model):
            raise AnnotationError("annotation model shape is invalid")
        model_id = expected_model["modelId"]
        if model.get("modelId") != model_id:
            raise AnnotationError("annotation model order or identity is invalid")
        if model.get("sourceGlbSha256") != expected_model["sourceGlbSha256"]:
            raise AnnotationError(f"{model_id}: stale source GLB hash")
        if model.get("assetPath") != expected_model["assetPath"]:
            raise AnnotationError(f"{model_id}: stale asset path")
        if model.get("lockedLocomotion") != expected_model["lockedLocomotion"]:
            raise AnnotationError(f"{model_id}: locked locomotion evidence was changed")
        clips = model.get("clips")
        if not isinstance(clips, list) or len(clips) != len(expected_model["clips"]):
            raise AnnotationError(f"{model_id}: raw clip catalog is incomplete")
        assigned: dict[str, int] = {}
        for clip, expected_clip in zip(clips, expected_model["clips"], strict=True):
            if not isinstance(clip, dict):
                raise AnnotationError(f"{model_id}: raw clip record is malformed")
            if set(clip) != set(expected_clip):
                raise AnnotationError(f"{model_id}: raw clip record shape is invalid")
            for key in ("clipIndex", "sourceName", "durationSeconds"):
                if canonical_json(clip.get(key)) != canonical_json(expected_clip[key]):
                    raise AnnotationError(f"{model_id}: stale raw clip {key}")
            value = clip.get("annotation")
            if not isinstance(value, dict):
                raise AnnotationError(f"{model_id}: clip annotation is malformed")
            _require_exact_fields(
                value,
                {"decision", "evidenceReference", "notes"},
                f"{model_id}: clip annotation",
            )
            decision = value.get("decision")
            if decision not in ANNOTATION_DECISIONS:
                raise AnnotationError(f"{model_id}: unsupported decision {decision!r}")
            evidence = _require_safe_durable_text(
                value.get("evidenceReference"),
                f"{model_id} clip evidence",
                allow_empty=decision == "uncertain",
            )
            notes = _require_safe_durable_text(
                value.get("notes"),
                f"{model_id} clip notes",
                allow_empty=decision == "uncertain",
            )
            if decision == "uncertain":
                uncertain_clip_count += 1
                continue
            if not evidence or not notes:
                raise AnnotationError(
                    f"{model_id} clip evidence and notes require non-empty text"
                )
            if decision == "unsupported":
                unsupported_clip_count += 1
                continue
            if decision in assigned:
                raise AnnotationError(
                    f"{model_id}: duplicate semantic assignment for {decision}"
                )
            assigned[decision] = clip["clipIndex"]
        unsupported_records = model.get("unsupportedSemantics")
        if not isinstance(unsupported_records, list):
            raise AnnotationError(f"{model_id}: unsupportedSemantics must be a list")
        unsupported_semantics: set[str] = set()
        for record in unsupported_records:
            if not isinstance(record, dict) or record.get("semantic") not in GESTURE_SEMANTICS:
                raise AnnotationError(f"{model_id}: invalid unsupported semantic")
            _require_exact_fields(
                record,
                {"semantic", "evidenceReference", "notes"},
                f"{model_id}: unsupported semantic",
            )
            semantic = record["semantic"]
            if semantic in unsupported_semantics:
                raise AnnotationError(f"{model_id}: duplicate unsupported semantic {semantic}")
            if semantic in assigned:
                raise AnnotationError(
                    f"{model_id}: {semantic} is both assigned and unsupported"
                )
            _require_safe_durable_text(
                record.get("evidenceReference"), f"{model_id} {semantic} evidence"
            )
            _require_safe_durable_text(record.get("notes"), f"{model_id} {semantic} notes")
            unsupported_semantics.add(semantic)
        uncertain_records = model.get("uncertainSemantics")
        if not isinstance(uncertain_records, list):
            raise AnnotationError(f"{model_id}: uncertainSemantics must be a list")
        uncertain_semantics: set[str] = set()
        for record in uncertain_records:
            if not isinstance(record, dict) or record.get("semantic") not in GESTURE_SEMANTICS:
                raise AnnotationError(f"{model_id}: invalid uncertain semantic")
            _require_exact_fields(
                record,
                {"semantic", "evidenceReference", "notes"},
                f"{model_id}: uncertain semantic",
            )
            semantic = record["semantic"]
            if semantic in uncertain_semantics:
                raise AnnotationError(f"{model_id}: duplicate uncertain semantic {semantic}")
            if semantic in assigned:
                raise AnnotationError(
                    f"{model_id}: {semantic} is both assigned and uncertain"
                )
            _require_safe_durable_text(
                record.get("evidenceReference"), f"{model_id} {semantic} evidence"
            )
            _require_safe_durable_text(record.get("notes"), f"{model_id} {semantic} notes")
            uncertain_semantics.add(semantic)
        overlap = unsupported_semantics & uncertain_semantics
        if overlap:
            raise AnnotationError(
                f"{model_id}: {sorted(overlap)[0]} is both uncertain and unsupported"
            )
        uncertain_semantic_count += len(uncertain_semantics)
        resolved_count += (
            len(assigned) + len(unsupported_semantics) + len(uncertain_semantics)
        )
    remaining = expected["unresolvedDecisionCount"] - resolved_count
    if remaining < 0:
        raise AnnotationError("annotation progress exceeds unresolved authority")
    reviewer = document.get("reviewer")
    if not isinstance(reviewer, dict):
        raise AnnotationError("reviewer record is malformed")
    if set(reviewer) != {"name", "reviewedAt"} or not all(
        isinstance(reviewer.get(key), str) for key in ("name", "reviewedAt")
    ):
        raise AnnotationError("reviewer record is malformed")
    expected_progress = {
        "resolvedDecisionCount": resolved_count,
        "remainingDecisionCount": remaining,
    }
    if canonical_json(document.get("progress")) != canonical_json(expected_progress):
        raise AnnotationError("annotation progress is malformed or stale")
    complete = remaining == 0
    if require_complete and not complete:
        raise AnnotationError(
            f"annotation document is incomplete: {remaining} decisions remain"
        )
    if require_complete:
        _require_text(reviewer.get("name"), "reviewer name")
        _validate_reviewed_at(reviewer.get("reviewedAt"))
    elif reviewer.get("reviewedAt"):
        _validate_reviewed_at(reviewer.get("reviewedAt"))
    return {
        "schema": "aiw.avatar-gesture-annotation-diagnostics/1",
        "valid": True,
        "complete": complete,
        "modelCount": expected["modelCount"],
        "lockedLocomotionCount": expected["lockedLocomotionCount"],
        "unresolvedDecisionCount": expected["unresolvedDecisionCount"],
        "resolvedDecisionCount": resolved_count,
        "remainingDecisionCount": remaining,
        "uncertainRawClipCount": uncertain_clip_count,
        "uncertainSemanticCount": uncertain_semantic_count,
        "unsupportedRawClipCount": unsupported_clip_count,
        "authorityMutation": False,
        "runtimeFailClosed": True,
    }


def build_proposal(
    document: dict[str, Any], manifest: dict[str, Any], review: dict[str, Any]
) -> dict[str, Any]:
    diagnostics = validate_document(
        document, manifest, review, require_complete=True
    )
    review_by_key = _review_index(review)
    decisions: list[dict[str, Any]] = []
    for model in document["models"]:
        model_id = model["modelId"]
        assignments = {
            clip["annotation"]["decision"]: clip
            for clip in model["clips"]
            if clip["annotation"]["decision"] in GESTURE_SEMANTICS
        }
        unsupported = {
            record["semantic"]: record for record in model["unsupportedSemantics"]
        }
        uncertain = {
            record["semantic"]: record for record in model["uncertainSemantics"]
        }
        for semantic in GESTURE_SEMANTICS:
            current = review_by_key.get((model_id, semantic))
            reviewed_clip_index = (
                current.get("reviewedClipIndex") if current is not None else None
            )
            if semantic in unsupported:
                record = unsupported[semantic]
                decisions.append(
                    {
                        "modelId": model_id,
                        "semantic": semantic,
                        "verdict": "unsupported",
                        "reviewedClipIndex": reviewed_clip_index,
                        "expectedClipIndex": None,
                        "rationale": record["notes"].strip(),
                        "evidenceRefs": [record["evidenceReference"].strip()],
                    }
                )
                continue
            if semantic in uncertain:
                record = uncertain[semantic]
                decisions.append(
                    {
                        "modelId": model_id,
                        "semantic": semantic,
                        "verdict": "uncertain",
                        "reviewedClipIndex": reviewed_clip_index,
                        "expectedClipIndex": None,
                        "rationale": record["notes"].strip(),
                        "evidenceRefs": [record["evidenceReference"].strip()],
                    }
                )
                continue
            clip = assignments[semantic]
            expected_clip_index = clip["clipIndex"]
            decisions.append(
                {
                    "modelId": model_id,
                    "semantic": semantic,
                    "verdict": (
                        "pass"
                        if expected_clip_index == reviewed_clip_index
                        else "wrong_clip"
                    ),
                    "reviewedClipIndex": reviewed_clip_index,
                    "expectedClipIndex": expected_clip_index,
                    "rationale": clip["annotation"]["notes"].strip(),
                    "evidenceRefs": [
                        clip["annotation"]["evidenceReference"].strip()
                    ],
                }
            )
    totals = {
        verdict: sum(item["verdict"] == verdict for item in decisions)
        for verdict in ("pass", "wrong_clip", "uncertain", "unsupported")
    }
    return {
        "schema": PROPOSAL_SCHEMA,
        "sourceAnnotationCanonicalSha256": canonical_sha256(document),
        "sourceManifestCanonicalSha256": canonical_sha256(manifest),
        "sourceSemanticReviewCanonicalSha256": canonical_sha256(review),
        "reviewer": copy.deepcopy(document["reviewer"]),
        "authorityMutation": False,
        "runtimePolicy": "proposal-only-current-authority-remains-fail-closed",
        "diagnostics": diagnostics,
        "totals": totals,
        "decisions": decisions,
    }


def _viewer_source() -> str:
    return VIEWER_HTML


def _readme_source(template: dict[str, Any], batch_plan: dict[str, Any]) -> str:
    return f"""# Human gesture temporal annotation package

This package contains {template['modelCount']} models, {template['unresolvedDecisionCount']} unresolved semantic decisions, and {template['rawNonLocomotionClipCount']} raw non-locomotion clips. The {template['lockedLocomotionCount']} accepted Idle/Walk/Run decisions are locked and excluded from annotation.

Serve the repository root locally (the viewer does not use the network):

```bash
python3 -m http.server 8765 --directory .
```

Navigate on that local server to `artifacts/avatar-replacement-evidence/world-animation-metadata-investigation-v1/annotation-package/viewer.html`. Review raw `(modelId, clipIndex)` units with play/pause, looping, speed, and scrubbing. A source name such as `NlaTrack` is transport metadata, never a semantic label.

## Bounded resumable batches

`annotation-batches.json` partitions the work into {batch_plan['batchCount']} deterministic batches, one model per batch in viewer order. Together they cover all {batch_plan['modelCount']} models, {batch_plan['unresolvedDecisionCount']} unresolved decisions, and {batch_plan['rawNonLocomotionClipCount']} raw clips exactly once. The plan contains only raw identities, counts, and hashes; it contains no suggestion, assignment, reviewer identity, or fabricated progress.

For each batch, import the latest **full annotation document** (or start with `annotation-template.json` for batch 001), select the batch model, and review that model only. At the batch boundary, export the full document, save it as a checkpoint named with the batch ID, and run partial validation before continuing. Resume later by importing the latest full-document checkpoint; never splice per-model fragments. `modelBindingCanonicalSha256` and the top-level template/authority hashes make stale batch catalogs fail exact generation checks.

Export the JSON from the viewer, then validate partial progress:

```bash
python3 tooling/avatar/avatar_gesture_annotation.py validate path/to/annotations.json --allow-partial
```

Strict validation and deterministic proposal generation require all {template['unresolvedDecisionCount']} semantic decisions, reviewer identity/time, evidence references, and notes:

```bash
python3 tooling/avatar/avatar_gesture_annotation.py validate path/to/annotations.json
python3 tooling/avatar/avatar_gesture_annotation.py propose path/to/annotations.json --output path/to/proposal.json
```

The proposal command never edits `semantic-review.json`, the manifest, registry, or GLBs. Incomplete, malformed, conflicting, duplicate, stale-hash, or unsupported-vocabulary input is rejected. `uncertain` entries remain fail closed. A proposal is non-authoritative until a separate reviewed generator change incorporates it and the existing deterministic gates pass.
"""


def package_outputs(manifest: dict[str, Any], review: dict[str, Any]) -> dict[str, bytes]:
    template = build_template(manifest, review)
    batch_plan = build_batch_plan(template)
    validate_batch_plan(batch_plan, template)
    return {
        "annotation-template.json": json.dumps(
            template, indent=2, sort_keys=True, ensure_ascii=False
        ).encode("utf-8")
        + b"\n",
        "annotation-batches.json": json.dumps(
            batch_plan, indent=2, sort_keys=True, ensure_ascii=False
        ).encode("utf-8")
        + b"\n",
        "viewer.html": _viewer_source().encode("utf-8"),
        "README.md": _readme_source(template, batch_plan).encode("utf-8"),
    }


def write_or_check_package(
    manifest: dict[str, Any],
    review: dict[str, Any],
    output_dir: Path,
    *,
    check: bool,
) -> None:
    outputs = package_outputs(manifest, review)
    if check:
        for name, expected in outputs.items():
            try:
                actual = (output_dir / name).read_bytes()
            except OSError as error:
                raise AnnotationError(f"annotation package is unavailable: {error}") from error
            if actual != expected:
                raise AnnotationError(f"annotation package is stale: {name}")
        return
    output_dir.mkdir(parents=True, exist_ok=True)
    for name, payload in outputs.items():
        (output_dir / name).write_bytes(payload)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--semantic-review", type=Path, default=DEFAULT_REVIEW)
    subparsers = parser.add_subparsers(dest="command", required=True)
    generate = subparsers.add_parser("generate")
    generate.add_argument("--output-dir", type=Path, default=DEFAULT_PACKAGE)
    generate.add_argument("--check", action="store_true")
    validate = subparsers.add_parser("validate")
    validate.add_argument("document", type=Path)
    validate.add_argument("--allow-partial", action="store_true")
    propose = subparsers.add_parser("propose")
    propose.add_argument("document", type=Path)
    propose.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    try:
        manifest = read_json(arguments.manifest)
        review = read_json(arguments.semantic_review)
        if arguments.command == "generate":
            write_or_check_package(
                manifest, review, arguments.output_dir, check=arguments.check
            )
            template = build_template(manifest, review)
            print(
                "annotation package ready: "
                f"{template['modelCount']} models, "
                f"{template['unresolvedDecisionCount']} unresolved decisions, "
                f"{template['rawNonLocomotionClipCount']} raw clips"
            )
            return
        document = read_json(arguments.document)
        if arguments.command == "validate":
            diagnostics = validate_document(
                document,
                manifest,
                review,
                require_complete=not arguments.allow_partial,
            )
            print(json.dumps(diagnostics, sort_keys=True))
            return
        proposal = build_proposal(document, manifest, review)
        arguments.output.parent.mkdir(parents=True, exist_ok=True)
        arguments.output.write_bytes(
            json.dumps(proposal, indent=2, sort_keys=True).encode("utf-8") + b"\n"
        )
        print(
            "proposal written without authority mutation: "
            f"{len(proposal['decisions'])} gesture decisions"
        )
    except AnnotationError as error:
        raise SystemExit(str(error)) from error


VIEWER_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>AgentIntersect World raw gesture annotation</title>
  <style>
    :root { color-scheme: dark; font-family: Consolas, monospace; background: #07111d; color: #e8f4ff; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    button, select, input, textarea { font: inherit; color: inherit; background: #102238; border: 1px solid #4d7196; border-radius: .3rem; }
    button, select, input { min-height: 2.2rem; padding: .35rem .55rem; }
    button { cursor: pointer; }
    button:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible { outline: 3px solid #2db9ff; outline-offset: 2px; }
    header { padding: 1rem 1.25rem; border-bottom: 1px solid #27435d; }
    h1, h2 { margin: 0 0 .5rem; }
    .warning { color: #ffd277; max-width: 90ch; }
    .layout { display: grid; grid-template-columns: minmax(32rem, 1.5fr) minmax(24rem, 1fr); min-height: calc(100vh - 9rem); }
    .viewer, .annotation { padding: 1rem; }
    .annotation { border-left: 1px solid #27435d; overflow: auto; max-height: calc(100vh - 9rem); }
    .row { display: flex; flex-wrap: wrap; gap: .65rem; align-items: center; margin: .65rem 0; }
    label { display: grid; gap: .25rem; }
    label.grow { flex: 1 1 16rem; }
    select, input { width: 100%; }
    canvas { width: 100%; aspect-ratio: 16/10; display: block; background: #0b1c2d; border: 1px solid #27435d; border-radius: .4rem; }
    input[type=range] { min-width: 18rem; accent-color: #2db9ff; }
    input[type=checkbox] { width: auto; min-height: auto; }
    textarea { min-height: 5rem; padding: .5rem; resize: vertical; width: 100%; }
    .status { min-height: 1.4rem; color: #8ed7ff; }
    .error { color: #ff8a8a; }
    .progress { font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: .4rem; border-bottom: 1px solid #27435d; text-align: left; vertical-align: top; }
    td input { min-width: 6rem; }
    td select { min-width: 13rem; }
    .sr-only { position: absolute; width: 1px; height: 1px; clip: rect(0,0,0,0); overflow: hidden; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .annotation { border-left: 0; border-top: 1px solid #27435d; max-height: none; } }
  </style>
  <script type="importmap">
    {"imports":{"three":"../../../../packages/renderer-r3f/node_modules/three/build/three.module.js"}}
  </script>
</head>
<body>
  <header>
    <h1>Raw gesture temporal annotation</h1>
    <div id="progress" class="progress">Loading package…</div>
    <p class="warning">Clip identity is only <code>(modelId, clipIndex)</code>. Source names are anonymous transport metadata. The tool never suggests a semantic and never uses duration, pose shape, motion metrics, ordering, or cross-model similarity to assign one.</p>
    <div class="row">
      <label>Reviewer name<input id="reviewer" autocomplete="name"></label>
      <label>Reviewed at (ISO 8601)<input id="reviewedAt" placeholder="2026-08-01T00:00:00Z"></label>
      <button id="importButton" type="button">Import JSON</button>
      <input id="importFile" class="sr-only" type="file" accept="application/json">
      <button id="exportButton" type="button">Export JSON</button>
    </div>
  </header>
  <main class="layout">
    <section class="viewer" aria-labelledby="viewerHeading">
      <h2 id="viewerHeading">Temporal evidence</h2>
      <div class="row">
        <label class="grow">Model<select id="model"></select></label>
        <label class="grow">Raw clip<select id="clip"></select></label>
      </div>
      <canvas id="canvas" aria-label="Three-dimensional raw animation playback"></canvas>
      <div class="row">
        <button id="play" type="button">Pause</button>
        <label>Loop <input id="loop" type="checkbox" checked></label>
        <label>Speed<select id="speed"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>
        <label class="grow">Time <input id="scrub" type="range" min="0" max="1" step="0.001" value="0"></label>
        <output id="time">0.000 / 0.000 s</output>
      </div>
      <p id="playbackStatus" class="status" role="status"></p>
      <p id="locked"></p>
    </section>
    <section class="annotation" aria-labelledby="annotationHeading">
      <h2 id="annotationHeading">Human decision for current raw clip</h2>
      <p id="rawIdentity"></p>
      <label>Decision<select id="decision"></select></label>
      <label>Evidence reference<input id="evidence" placeholder="human-temporal-review:session/model/clip"></label>
      <label>Evidence-backed notes<textarea id="notes"></textarea></label>
      <p id="validation" class="status" role="status"></p>
      <h2>Fail-closed semantic decisions</h2>
      <p>Exact clip assignments appear here automatically. After reviewing the complete raw clip catalog, choose uncertain when the evidence is inconclusive or unsupported when no matching clip exists. Evidence and notes are mandatory.</p>
      <table>
        <thead><tr><th>Semantic</th><th>Decision state</th><th>Evidence reference</th><th>Notes</th></tr></thead>
        <tbody id="unsupported"></tbody>
      </table>
    </section>
  </main>
  <script type="module">
    import * as THREE from "three";
    import { GLTFLoader } from "../../../../packages/renderer-r3f/node_modules/three/examples/jsm/loaders/GLTFLoader.js";
    import { OrbitControls } from "../../../../packages/renderer-r3f/node_modules/three/examples/jsm/controls/OrbitControls.js";

    const gestures = ["Jump","Dance","Clap","Cheer","Wave","Bow","Agree","Angry","Laugh","Dig"];
    const states = ["uncertain", ...gestures, "unsupported"];
    const byId = (id) => document.getElementById(id);
    let documentState = await fetch("annotation-template.json", {cache: "no-store"}).then((response) => {
      if (!response.ok) throw new Error("annotation template unavailable");
      return response.json();
    });
    const immutableTemplate = structuredClone(documentState);
    let modelIndex = 0;
    let clipIndex = 0;
    let loadedRoot = null;
    let mixer = null;
    let action = null;
    let duration = 0;
    let playing = true;
    let loadGeneration = 0;

    const renderer = new THREE.WebGLRenderer({canvas: byId("canvas"), antialias: true});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(960, 600, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1c2d);
    const camera = new THREE.PerspectiveCamera(38, 1.6, 0.01, 100);
    camera.position.set(2.5, 1.6, 4.2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.9, 0);
    controls.update();
    scene.add(new THREE.HemisphereLight(0xcceeff, 0x334455, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 5, 4);
    scene.add(key);
    const grid = new THREE.GridHelper(6, 12, 0x365b78, 0x183249);
    scene.add(grid);
    const clock = new THREE.Clock();
    const loader = new GLTFLoader();

    function currentModel() { return documentState.models[modelIndex]; }
    function currentClip() { return currentModel().clips[clipIndex]; }
    function status(message, error = false) {
      byId("validation").textContent = message;
      byId("validation").classList.toggle("error", error);
    }
    function sameKeys(value, expected) {
      return value && typeof value === "object" && !Array.isArray(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
    }
    function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
    function validateImportedDocument(imported) {
      if (!sameKeys(imported, Object.keys(immutableTemplate))) throw new Error("malformed annotation document");
      for (const key of ["schema","manifestCanonicalSha256","semanticReviewCanonicalSha256","semanticReviewSchema","vocabulary","states","modelCount","lockedLocomotionCount","unresolvedDecisionCount","rawNonLocomotionClipCount"]) {
        if (!sameJson(imported[key], immutableTemplate[key])) throw new Error(`stale or incompatible ${key}`);
      }
      if (!sameKeys(imported.reviewer, ["name","reviewedAt"]) || typeof imported.reviewer.name !== "string" || typeof imported.reviewer.reviewedAt !== "string") throw new Error("malformed reviewer record");
      if (imported.reviewer.reviewedAt && (!/(?:Z|[+-]\\d{2}:\\d{2})$/.test(imported.reviewer.reviewedAt) || Number.isNaN(Date.parse(imported.reviewer.reviewedAt)))) throw new Error("malformed reviewedAt timestamp");
      if (!Array.isArray(imported.models) || imported.models.length !== immutableTemplate.models.length) throw new Error("stale model catalog");
      let resolved = 0;
      imported.models.forEach((model, modelPosition) => {
        const baseline = immutableTemplate.models[modelPosition];
        if (!sameKeys(model, Object.keys(baseline))) throw new Error("malformed model record");
        for (const key of ["modelId","sourceGlbSha256","assetPath","lockedLocomotion"]) {
          if (!sameJson(model[key], baseline[key])) throw new Error("stale model identity or locomotion catalog");
        }
        if (!Array.isArray(model.clips) || model.clips.length !== baseline.clips.length) throw new Error("stale raw clip catalog");
        const assigned = new Set();
        model.clips.forEach((clip, clipPosition) => {
          const baselineClip = baseline.clips[clipPosition];
          if (!sameKeys(clip, Object.keys(baselineClip))) throw new Error("malformed raw clip record");
          for (const key of ["clipIndex","sourceName","durationSeconds"]) {
            if (!sameJson(clip[key], baselineClip[key])) throw new Error("stale raw clip identity");
          }
          const record = clip.annotation;
          if (!sameKeys(record, ["decision","evidenceReference","notes"]) || typeof record.decision !== "string" || typeof record.evidenceReference !== "string" || typeof record.notes !== "string") throw new Error("malformed annotation fields");
          if (!states.includes(record.decision)) throw new Error("unsupported annotation decision");
          if (record.decision !== "uncertain" && (!record.evidenceReference.trim() || !record.notes.trim())) throw new Error("conclusive annotation requires evidence and notes");
          if (gestures.includes(record.decision)) {
            if (assigned.has(record.decision)) throw new Error("duplicate semantic assignment");
            assigned.add(record.decision);
          }
        });
        const refused = new Set();
        for (const [field, state] of [["uncertainSemantics", "uncertain"], ["unsupportedSemantics", "unsupported"]]) {
          if (!Array.isArray(model[field])) throw new Error(`malformed ${state} semantic catalog`);
          for (const record of model[field]) {
            if (!sameKeys(record, ["semantic","evidenceReference","notes"]) || !gestures.includes(record.semantic) || typeof record.evidenceReference !== "string" || typeof record.notes !== "string" || !record.evidenceReference.trim() || !record.notes.trim()) throw new Error(`malformed ${state} semantic record`);
            if (refused.has(record.semantic)) throw new Error("duplicate or conflicting semantic refusal");
            if (assigned.has(record.semantic)) throw new Error(`semantic is both assigned and ${state}`);
            refused.add(record.semantic);
          }
        }
        resolved += assigned.size + refused.size;
      });
      const progress = {resolvedDecisionCount: resolved, remainingDecisionCount: imported.unresolvedDecisionCount - resolved};
      if (!sameKeys(imported.progress, Object.keys(progress)) || !sameJson(imported.progress, progress)) throw new Error("malformed or stale progress");
    }
    function resolvedFor(model) {
      const assigned = new Set(model.clips.map((clip) => clip.annotation.decision).filter((value) => gestures.includes(value)));
      const uncertain = new Set(model.uncertainSemantics.map((entry) => entry.semantic));
      const unsupported = new Set(model.unsupportedSemantics.map((entry) => entry.semantic));
      return new Set([...assigned, ...uncertain, ...unsupported]).size;
    }
    function updateProgress() {
      const resolved = documentState.models.reduce((sum, model) => sum + resolvedFor(model), 0);
      documentState.progress = {resolvedDecisionCount: resolved, remainingDecisionCount: documentState.unresolvedDecisionCount - resolved};
      byId("progress").textContent = `${resolved} / ${documentState.unresolvedDecisionCount} gesture decisions resolved · ${documentState.lockedLocomotionCount} locomotion decisions locked`;
    }
    function commitCurrent() {
      const clip = currentClip();
      const next = byId("decision").value;
      if (gestures.includes(next)) {
        const duplicate = currentModel().clips.find((other) => other !== clip && other.annotation.decision === next);
        if (duplicate) {
          byId("decision").value = clip.annotation.decision;
          status(`${next} already has a decision for this model. Remove the conflicting decision first.`, true);
          return false;
        }
        currentModel().uncertainSemantics = currentModel().uncertainSemantics.filter((item) => item.semantic !== next);
        currentModel().unsupportedSemantics = currentModel().unsupportedSemantics.filter((item) => item.semantic !== next);
      }
      clip.annotation = {decision: next, evidenceReference: byId("evidence").value, notes: byId("notes").value};
      updateProgress();
      renderUnsupported();
      status(next === "uncertain" ? "Uncertain remains fail closed." : "Decision stored locally; CLI validation remains authoritative.");
      return true;
    }
    function renderAnnotation() {
      const clip = currentClip();
      byId("rawIdentity").textContent = `${currentModel().modelId} · clip ${String(clip.clipIndex).padStart(2,"0")} · source name ${clip.sourceName} (transport metadata only)`;
      byId("decision").value = clip.annotation.decision;
      byId("evidence").value = clip.annotation.evidenceReference;
      byId("notes").value = clip.annotation.notes;
      renderUnsupported();
    }
    function renderUnsupported() {
      const body = byId("unsupported");
      body.replaceChildren();
      for (const semantic of gestures) {
        const assignedClip = currentModel().clips.find((clip) => clip.annotation.decision === semantic);
        const uncertainRecord = currentModel().uncertainSemantics.find((item) => item.semantic === semantic);
        const unsupportedRecord = currentModel().unsupportedSemantics.find((item) => item.semantic === semantic);
        const record = assignedClip?.annotation ?? uncertainRecord ?? unsupportedRecord;
        const decisionState = assignedClip ? "selected" : uncertainRecord ? "uncertain" : unsupportedRecord ? "unsupported" : "";
        const row = document.createElement("tr");
        const name = document.createElement("td"); name.textContent = semantic;
        const decisionCell = document.createElement("td");
        const decision = document.createElement("select"); decision.setAttribute("aria-label", `${semantic} decision`);
        const options = [["", "Unresolved"], ...(assignedClip ? [["selected", `Selected · clip ${String(assignedClip.clipIndex).padStart(2,"0")}`]] : []), ["uncertain", "Uncertain"], ["unsupported", "Unsupported"]];
        for (const [value, label] of options) { const option = document.createElement("option"); option.value = value; option.textContent = label; decision.append(option); }
        decision.value = decisionState; decisionCell.append(decision);
        const evidenceCell = document.createElement("td"); const evidence = document.createElement("input"); evidence.value = record?.evidenceReference ?? ""; evidence.disabled = !decisionState || decisionState === "selected"; evidence.setAttribute("aria-label", `${semantic} decision evidence`); evidenceCell.append(evidence);
        const notesCell = document.createElement("td"); const notes = document.createElement("input"); notes.value = record?.notes ?? ""; notes.disabled = !decisionState || decisionState === "selected"; notes.setAttribute("aria-label", `${semantic} decision notes`); notesCell.append(notes);
        function save() {
          const model = currentModel();
          model.uncertainSemantics = model.uncertainSemantics.filter((item) => item.semantic !== semantic);
          model.unsupportedSemantics = model.unsupportedSemantics.filter((item) => item.semantic !== semantic);
          if (decision.value !== "selected" && assignedClip) assignedClip.annotation = {decision: "uncertain", evidenceReference: "", notes: ""};
          if (decision.value === "uncertain") model.uncertainSemantics.push({semantic, evidenceReference: evidence.value, notes: notes.value});
          if (decision.value === "unsupported") model.unsupportedSemantics.push({semantic, evidenceReference: evidence.value, notes: notes.value});
          model.uncertainSemantics.sort((a,b) => gestures.indexOf(a.semantic) - gestures.indexOf(b.semantic));
          model.unsupportedSemantics.sort((a,b) => gestures.indexOf(a.semantic) - gestures.indexOf(b.semantic));
          updateProgress();
        }
        decision.addEventListener("change", () => {
          evidence.disabled = !decision.value || decision.value === "selected"; notes.disabled = !decision.value || decision.value === "selected"; save(); renderUnsupported();
        });
        evidence.addEventListener("input", save); notes.addEventListener("input", save);
        row.append(name, decisionCell, evidenceCell, notesCell); body.append(row);
      }
    }
    function populateModels() {
      const select = byId("model"); select.replaceChildren();
      documentState.models.forEach((model, index) => { const option = document.createElement("option"); option.value = String(index); option.textContent = model.modelId; select.append(option); });
      select.value = String(modelIndex);
    }
    function populateClips() {
      const select = byId("clip"); select.replaceChildren();
      currentModel().clips.forEach((clip, index) => { const option = document.createElement("option"); option.value = String(index); option.textContent = `clip ${String(clip.clipIndex).padStart(2,"0")} · source ${clip.sourceName}`; select.append(option); });
      select.value = String(clipIndex);
      byId("locked").textContent = `Locked locomotion: ${currentModel().lockedLocomotion.map((entry) => `${entry.semantic}=clip ${String(entry.clipIndex).padStart(2,"0")}`).join(" · ")}`;
    }
    function disposeLoadedRoot(root) {
      root.traverse((object) => {
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
        for (const material of materials) {
          for (const value of Object.values(material)) value?.isTexture && value.dispose();
          material.dispose?.();
        }
      });
    }
    async function loadModel() {
      const requestGeneration = ++loadGeneration;
      const requestedModel = currentModel();
      const requestedModelId = requestedModel.modelId;
      byId("playbackStatus").textContent = "Loading source-identical repository GLB…";
      byId("playbackStatus").classList.remove("error");
      byId("canvas").dataset.selectedModelId = requestedModelId;
      delete byId("canvas").dataset.loadedModelId;
      if (loadedRoot) { scene.remove(loadedRoot); disposeLoadedRoot(loadedRoot); }
      mixer = null; action = null; loadedRoot = null;
      const path = `../../../../${requestedModel.assetPath}`;
      try {
        const gltf = await loader.loadAsync(path);
        if (requestGeneration !== loadGeneration || currentModel().modelId !== requestedModelId) {
          disposeLoadedRoot(gltf.scene);
          return;
        }
        loadedRoot = gltf.scene;
        const box = new THREE.Box3().setFromObject(loadedRoot);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = size.y > 0 ? 1.75 / size.y : 1;
        loadedRoot.scale.setScalar(scale);
        loadedRoot.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
        scene.add(loadedRoot);
        mixer = new THREE.AnimationMixer(loadedRoot);
        loadedRoot.userData.rawAnimations = gltf.animations;
        selectAnimation();
        byId("canvas").dataset.loadedModelId = requestedModelId;
        byId("playbackStatus").textContent = "Raw clip ready. Orbit, play, pause, loop, change speed, or scrub.";
      } catch (error) {
        if (requestGeneration !== loadGeneration || currentModel().modelId !== requestedModelId) return;
        byId("playbackStatus").textContent = `Playback unavailable: ${error instanceof Error ? error.message : "load error"}`;
        byId("playbackStatus").classList.add("error");
      }
    }
    function selectAnimation() {
      if (!mixer || !loadedRoot) return;
      mixer.stopAllAction();
      const clip = loadedRoot.userData.rawAnimations[currentClip().clipIndex];
      if (!clip) { byId("playbackStatus").textContent = "Raw clip missing; CLI stale-hash validation required."; return; }
      duration = clip.duration;
      action = mixer.clipAction(clip); action.reset(); action.setLoop(byId("loop").checked ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); action.clampWhenFinished = true; action.play(); action.paused = !playing;
      byId("scrub").max = String(duration); byId("scrub").value = "0"; updateTime(0);
    }
    function updateTime(value) { byId("time").textContent = `${value.toFixed(3)} / ${duration.toFixed(3)} s`; }
    function animate() {
      requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05) * Number(byId("speed").value);
      if (mixer && playing) mixer.update(delta);
      if (action) { byId("scrub").value = String(action.time); updateTime(action.time); }
      controls.update(); renderer.render(scene, camera);
    }

    for (const value of states) { const option = document.createElement("option"); option.value = value; option.textContent = value; byId("decision").append(option); }
    byId("model").addEventListener("change", async () => { commitCurrent(); modelIndex = Number(byId("model").value); clipIndex = 0; populateClips(); renderAnnotation(); await loadModel(); });
    byId("clip").addEventListener("change", () => { commitCurrent(); clipIndex = Number(byId("clip").value); renderAnnotation(); selectAnimation(); });
    byId("decision").addEventListener("change", commitCurrent); byId("evidence").addEventListener("input", commitCurrent); byId("notes").addEventListener("input", commitCurrent);
    byId("reviewer").addEventListener("input", () => { documentState.reviewer.name = byId("reviewer").value; });
    byId("reviewedAt").addEventListener("input", () => { documentState.reviewer.reviewedAt = byId("reviewedAt").value; });
    byId("play").addEventListener("click", () => { playing = !playing; byId("play").textContent = playing ? "Pause" : "Play"; if (action) action.paused = !playing; });
    byId("loop").addEventListener("change", () => { if (action) action.setLoop(byId("loop").checked ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); });
    byId("scrub").addEventListener("input", () => { if (!mixer || !action) return; const value = Number(byId("scrub").value); action.paused = true; playing = false; byId("play").textContent = "Play"; mixer.setTime(value); updateTime(value); });
    byId("importButton").addEventListener("click", () => byId("importFile").click());
    byId("importFile").addEventListener("change", async () => { const file = byId("importFile").files?.[0]; if (!file) return; try { const imported = JSON.parse(await file.text()); validateImportedDocument(imported); documentState = imported; modelIndex = 0; clipIndex = 0; populateModels(); populateClips(); renderAnnotation(); updateProgress(); byId("reviewer").value = documentState.reviewer.name; byId("reviewedAt").value = documentState.reviewer.reviewedAt; await loadModel(); status("Imported locally. Run the CLI validator before proposal."); } catch (error) { status(error instanceof Error ? error.message : "import failed", true); } finally { byId("importFile").value = ""; } });
    byId("exportButton").addEventListener("click", () => { commitCurrent(); const blob = new Blob([JSON.stringify(documentState, null, 2) + "\\n"], {type:"application/json"}); const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(blob); anchor.download = "avatar-gesture-annotations.json"; anchor.click(); URL.revokeObjectURL(anchor.href); });

    populateModels(); populateClips(); renderAnnotation(); updateProgress(); byId("reviewer").value = documentState.reviewer.name; byId("reviewedAt").value = documentState.reviewer.reviewedAt; await loadModel(); animate();
  </script>
</body>
</html>
"""


if __name__ == "__main__":
    main()
