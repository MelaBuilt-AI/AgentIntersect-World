"""Build and verify the deterministic replacement-avatar asset authority."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import struct
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "apps/web/public/assets/imported-avatars"
MANIFEST = ASSET_DIR / "manifest.json"
GENERATED_REGISTRY = (
    ROOT / "packages/avatar-system/src/imported-avatar-registry.generated.ts"
)
SEMANTIC_REVIEW = (
    ROOT
    / "artifacts/avatar-replacement-evidence"
    / "world-animation-semantic-review-v2"
    / "semantic-review.json"
)

SEMANTICS = (
    "Idle",
    "Walk",
    "Run",
    "Jump",
    "Dance",
    "Clap",
    "Cheer",
    "Wave",
    "Bow",
    "Agree",
    "Angry",
    "Laugh",
)
REVIEWED_LOCOMOTION = frozenset(("Idle", "Walk", "Run"))


def semantic_review_decision(
    model_id: str, semantic: str, clip_index: int
) -> dict[str, Any]:
    evidence_ref = (
        "artifacts/avatar-replacement-evidence/"
        "world-animation-completion-v1/temporal-review/"
        f"{model_id}.png#{semantic}"
    )
    if semantic == "Idle":
        rationale = (
            "Direct review of the retained 25%, 50%, and 75% temporal samples "
            "shows a grounded, non-traveling stance suitable for model-local Idle."
        )
    elif semantic == "Walk":
        rationale = (
            "Direct review of the retained temporal samples shows alternating "
            "grounded leg phases and bounded cyclic travel suitable for model-local Walk."
        )
    elif semantic == "Run":
        rationale = (
            "Direct review of the retained temporal samples shows the larger-stride, "
            "faster locomotion cycle suitable for model-local Run."
        )
    else:
        rationale = (
            f"The retained three-position visual record for {semantic} does not "
            "independently distinguish this anonymous clip from other gestures. "
            "Aaron's Jump/Dance/Laugh contradiction invalidates structural ordering "
            "as semantic authority, so this mapping remains ambiguous."
        )
    passed = semantic in REVIEWED_LOCOMOTION
    return {
        "verdict": "pass" if passed else "ambiguous",
        "reviewedClipIndex": clip_index,
        "expectedClipIndex": clip_index if passed else None,
        "rationale": rationale,
        "evidenceRefs": [evidence_ref],
    }


def build_semantic_review(payload: dict[str, Any]) -> dict[str, Any]:
    decisions = [
        {
            "modelId": asset["id"],
            "semantic": semantic,
            **asset["semanticReview"][semantic],
        }
        for asset in payload["assets"]
        for semantic in SEMANTICS
    ]
    totals = {
        verdict: sum(decision["verdict"] == verdict for decision in decisions)
        for verdict in ("pass", "wrong_clip", "ambiguous", "unsupported")
    }
    return {
        "schema": "aiw.world-animation-semantic-review/2",
        "modelCount": len(payload["assets"]),
        "semanticCount": len(SEMANTICS),
        "decisionCount": len(decisions),
        "reviewAuthority": "direct-bounded-temporal-visual-review",
        "manualModelRecovery": "not-recovered-do-not-guess",
        "runtimePolicy": "pass-only-all-other-verdicts-refused",
        "totals": totals,
        "decisions": decisions,
    }

SUPPLIED_LICENSE_STATUS = (
    "tripo3d-subscription-user-confirmed-unrestricted-use"
)

FAMILIES = (
    {
        "family": "cat-agent",
        "label": "Cat Agent",
        "count": 7,
        "role": "agent",
        "sourceGlbPrefix": "Cat+Agent",
        "sourceImagePrefix": "Cat Agent",
    },
    {
        "family": "dog-agent",
        "label": "Dog Agent",
        "count": 5,
        "role": "agent",
        "sourceGlbPrefix": "Dog+Agent",
        "sourceImagePrefix": "Dog Agent",
    },
    {
        "family": "robot-agent",
        "label": "Robot Agent",
        "count": 5,
        "role": "agent",
        "sourceGlbPrefix": "Robot+Agent",
        "sourceImagePrefix": "Robot Agent",
    },
    {
        "family": "user-male",
        "label": "User Male",
        "count": 3,
        "role": "user",
        "sourceGlbPrefix": "User+Male",
        "sourceImagePrefix": "User Male",
    },
    {
        "family": "user-female",
        "label": "User Female",
        "count": 3,
        "role": "user",
        "sourceGlbPrefix": "User+Female",
        "sourceImagePrefix": "User Female",
    },
)

# These model-local labels are bound to deterministic motion/channel evidence and
# the bounded temporal review recorded by the World animation-completion artifact.
# Anonymous names, indices, and durations remain insufficient without that record.
SEMANTIC_CLIPS: dict[str, dict[str, int]] = {
    "cat-agent-01": {
        "Idle": 1,
        "Walk": 19,
        "Run": 4,
        "Jump": 20,
        "Dance": 6,
        "Clap": 18,
        "Cheer": 7,
        "Wave": 17,
        "Bow": 3,
        "Agree": 10,
        "Angry": 14,
        "Laugh": 11,
    },
    "cat-agent-02": {
        "Idle": 0,
        "Walk": 8,
        "Run": 17,
        "Jump": 20,
        "Dance": 6,
        "Clap": 13,
        "Cheer": 3,
        "Wave": 15,
        "Bow": 19,
        "Agree": 9,
        "Angry": 1,
        "Laugh": 7,
    },
    "cat-agent-03": {
        "Idle": 18,
        "Walk": 3,
        "Run": 0,
        "Jump": 9,
        "Dance": 14,
        "Clap": 1,
        "Cheer": 2,
        "Wave": 17,
        "Bow": 19,
        "Agree": 4,
        "Angry": 16,
        "Laugh": 20,
    },
    "cat-agent-04": {
        "Idle": 18,
        "Walk": 15,
        "Run": 13,
        "Jump": 12,
        "Dance": 0,
        "Clap": 8,
        "Cheer": 10,
        "Wave": 17,
        "Bow": 7,
        "Agree": 4,
        "Angry": 9,
        "Laugh": 16,
    },
    "cat-agent-05": {
        "Idle": 6,
        "Walk": 13,
        "Run": 20,
        "Jump": 7,
        "Dance": 15,
        "Clap": 4,
        "Cheer": 0,
        "Wave": 1,
        "Bow": 14,
        "Agree": 12,
        "Angry": 5,
        "Laugh": 17,
    },
    "cat-agent-06": {
        "Idle": 20,
        "Walk": 18,
        "Run": 14,
        "Jump": 11,
        "Dance": 15,
        "Clap": 17,
        "Cheer": 7,
        "Wave": 3,
        "Bow": 16,
        "Agree": 10,
        "Angry": 2,
        "Laugh": 0,
    },
    "cat-agent-07": {
        "Idle": 8,
        "Walk": 18,
        "Run": 3,
        "Jump": 19,
        "Dance": 6,
        "Clap": 5,
        "Cheer": 16,
        "Wave": 0,
        "Bow": 15,
        "Agree": 12,
        "Angry": 4,
        "Laugh": 7,
    },
    "dog-agent-01": {
        "Idle": 9,
        "Walk": 1,
        "Run": 20,
        "Jump": 4,
        "Dance": 5,
        "Clap": 0,
        "Cheer": 18,
        "Wave": 2,
        "Bow": 12,
        "Agree": 19,
        "Angry": 6,
        "Laugh": 17,
    },
    "dog-agent-02": {
        "Idle": 14,
        "Walk": 8,
        "Run": 20,
        "Jump": 7,
        "Dance": 18,
        "Clap": 5,
        "Cheer": 2,
        "Wave": 15,
        "Bow": 19,
        "Agree": 3,
        "Angry": 9,
        "Laugh": 11,
    },
    "dog-agent-03": {
        "Idle": 1,
        "Walk": 16,
        "Run": 5,
        "Jump": 17,
        "Dance": 3,
        "Clap": 11,
        "Cheer": 9,
        "Wave": 6,
        "Bow": 7,
        "Agree": 0,
        "Angry": 18,
        "Laugh": 20,
    },
    "dog-agent-04": {
        "Idle": 14,
        "Walk": 0,
        "Run": 1,
        "Jump": 16,
        "Dance": 15,
        "Clap": 12,
        "Cheer": 4,
        "Wave": 19,
        "Bow": 20,
        "Agree": 13,
        "Angry": 18,
        "Laugh": 5,
    },
    "dog-agent-05": {
        "Idle": 19,
        "Walk": 15,
        "Run": 9,
        "Jump": 1,
        "Dance": 0,
        "Clap": 5,
        "Cheer": 13,
        "Wave": 12,
        "Bow": 6,
        "Agree": 2,
        "Angry": 3,
        "Laugh": 11,
    },
    "robot-agent-01": {
        "Idle": 2,
        "Walk": 13,
        "Run": 4,
        "Jump": 1,
        "Dance": 15,
        "Clap": 7,
        "Cheer": 3,
        "Wave": 19,
        "Bow": 14,
        "Agree": 12,
        "Angry": 11,
        "Laugh": 8,
    },
    "robot-agent-02": {
        "Idle": 5,
        "Walk": 15,
        "Run": 17,
        "Jump": 13,
        "Dance": 10,
        "Clap": 21,
        "Cheer": 4,
        "Wave": 2,
        "Bow": 20,
        "Agree": 6,
        "Angry": 11,
        "Laugh": 19,
    },
    "robot-agent-03": {
        "Idle": 6,
        "Walk": 11,
        "Run": 4,
        "Jump": 10,
        "Dance": 1,
        "Clap": 5,
        "Cheer": 0,
        "Wave": 13,
        "Bow": 3,
        "Agree": 14,
        "Angry": 2,
        "Laugh": 20,
    },
    "robot-agent-04": {
        "Idle": 14,
        "Walk": 11,
        "Run": 1,
        "Jump": 4,
        "Dance": 16,
        "Clap": 8,
        "Cheer": 10,
        "Wave": 2,
        "Bow": 3,
        "Agree": 20,
        "Angry": 18,
        "Laugh": 17,
    },
    "robot-agent-05": {
        "Idle": 18,
        "Walk": 20,
        "Run": 9,
        "Jump": 0,
        "Dance": 15,
        "Clap": 6,
        "Cheer": 19,
        "Wave": 1,
        "Bow": 14,
        "Agree": 3,
        "Angry": 4,
        "Laugh": 5,
    },
    "user-male-01": {
        "Idle": 15,
        "Walk": 2,
        "Run": 18,
        "Jump": 19,
        "Dance": 1,
        "Clap": 13,
        "Cheer": 17,
        "Wave": 11,
        "Bow": 4,
        "Agree": 14,
        "Angry": 9,
        "Laugh": 12,
    },
    "user-male-02": {
        "Idle": 5,
        "Walk": 3,
        "Run": 20,
        "Jump": 15,
        "Dance": 0,
        "Clap": 19,
        "Cheer": 9,
        "Wave": 16,
        "Bow": 10,
        "Agree": 11,
        "Angry": 17,
        "Laugh": 7,
    },
    "user-male-03": {
        "Idle": 2,
        "Walk": 5,
        "Run": 0,
        "Jump": 17,
        "Dance": 16,
        "Clap": 18,
        "Cheer": 12,
        "Wave": 8,
        "Bow": 13,
        "Agree": 3,
        "Angry": 1,
        "Laugh": 10,
    },
    "user-female-01": {
        "Idle": 9,
        "Walk": 7,
        "Run": 17,
        "Jump": 13,
        "Dance": 12,
        "Clap": 6,
        "Cheer": 18,
        "Wave": 3,
        "Bow": 14,
        "Agree": 1,
        "Angry": 2,
        "Laugh": 19,
    },
    "user-female-02": {
        "Idle": 12,
        "Walk": 11,
        "Run": 2,
        "Jump": 3,
        "Dance": 5,
        "Clap": 19,
        "Cheer": 18,
        "Wave": 14,
        "Bow": 20,
        "Agree": 1,
        "Angry": 6,
        "Laugh": 10,
    },
    "user-female-03": {
        "Idle": 8,
        "Walk": 11,
        "Run": 12,
        "Jump": 4,
        "Dance": 18,
        "Clap": 14,
        "Cheer": 7,
        "Wave": 3,
        "Bow": 15,
        "Agree": 2,
        "Angry": 1,
        "Laugh": 5,
    },
}

COMPONENT_FORMATS = {
    5120: ("b", 1),
    5121: ("B", 1),
    5122: ("h", 2),
    5123: ("H", 2),
    5125: ("I", 4),
    5126: ("f", 4),
}
ELEMENT_WIDTHS = {
    "SCALAR": 1,
    "VEC2": 2,
    "VEC3": 3,
    "VEC4": 4,
    "MAT4": 16,
}
REGION_TO_SLOT = {
    "head-weighted": "head",
    "torso-weighted": "torso",
    "left-arm-weighted": "left-arm",
    "right-arm-weighted": "right-arm",
    "left-leg-weighted": "left-leg",
    "right-leg-weighted": "right-leg",
    "mixed-or-auxiliary": "auxiliary",
}
CORE_REGIONS = tuple(region for region in REGION_TO_SLOT if region != "mixed-or-auxiliary")


def asset_configs() -> tuple[dict[str, Any], ...]:
    configs: list[dict[str, Any]] = []
    for family in FAMILIES:
        for number in range(1, int(family["count"]) + 1):
            asset_id = f"{family['family']}-{number:02d}"
            thumbnail_extension = (
                ".jpg"
                if family["family"] == "robot-agent" and number == 1
                else ".png"
            )
            configs.append(
                {
                    "id": asset_id,
                    "family": family["family"],
                    "familyLabel": family["label"],
                    "label": f"{family['label']} {number}",
                    "number": number,
                    "originalRole": family["role"],
                    "filename": f"{asset_id}.glb",
                    "thumbnail": f"{asset_id}{thumbnail_extension}",
                    "sourceGlb": f"{family['sourceGlbPrefix']}+{number}.glb",
                    "sourceStance": (
                        f"{family['sourceImagePrefix']} {number} "
                        f"Stance{thumbnail_extension}"
                    ),
                    "sourceTPose": (
                        f"{family['sourceImagePrefix']} {number} T Pose.png"
                    ),
                    "semanticClips": SEMANTIC_CLIPS[asset_id],
                    "compatibilityClass": (
                        "aiw-cat-agent-01-42-joint-layered-only"
                        if asset_id == "cat-agent-01"
                        else "aiw-41-joint-structure-layered-only"
                    ),
                }
            )
    return tuple(configs)


ASSETS = asset_configs()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode(
        "utf-8"
    )


def parse_glb(path: Path) -> tuple[bytes, dict[str, Any], int]:
    raw = path.read_bytes()
    if len(raw) < 20:
        raise ValueError(f"{path.name}: truncated GLB")
    magic, version, length = struct.unpack_from("<4sII", raw, 0)
    if magic != b"glTF" or version != 2 or length != len(raw):
        raise ValueError(f"{path.name}: invalid GLB header")
    json_length, json_type = struct.unpack_from("<II", raw, 12)
    if json_type != 0x4E4F534A:
        raise ValueError(f"{path.name}: missing JSON chunk")
    document = json.loads(raw[20 : 20 + json_length].decode("utf-8"))
    if document.get("asset", {}).get("version") != "2.0":
        raise ValueError(f"{path.name}: GLB does not declare glTF 2.0")
    return raw, document, 20 + json_length + 8


def accessor_values(
    raw: bytes,
    document: dict[str, Any],
    binary_offset: int,
    accessor_index: int,
) -> list[tuple[float | int, ...]]:
    accessor = document["accessors"][accessor_index]
    if "bufferView" not in accessor or accessor.get("sparse"):
        raise ValueError("sparse or implicit accessors are unsupported")
    view = document["bufferViews"][accessor["bufferView"]]
    component_format, component_size = COMPONENT_FORMATS[
        accessor["componentType"]
    ]
    element_width = ELEMENT_WIDTHS[accessor["type"]]
    packed_width = component_size * element_width
    start = (
        binary_offset
        + view.get("byteOffset", 0)
        + accessor.get("byteOffset", 0)
    )
    stride = view.get("byteStride", packed_width)
    return [
        struct.unpack_from(
            "<" + component_format * element_width,
            raw,
            start + item * stride,
        )
        for item in range(accessor["count"])
    ]


def accessor_bytes(
    raw: bytes,
    document: dict[str, Any],
    binary_offset: int,
    accessor_index: int,
) -> bytes:
    accessor = document["accessors"][accessor_index]
    view = document["bufferViews"][accessor["bufferView"]]
    _, component_size = COMPONENT_FORMATS[accessor["componentType"]]
    packed_width = component_size * ELEMENT_WIDTHS[accessor["type"]]
    start = (
        binary_offset
        + view.get("byteOffset", 0)
        + accessor.get("byteOffset", 0)
    )
    stride = view.get("byteStride", packed_width)
    return b"".join(
        raw[
            start + item * stride : start + item * stride + packed_width
        ]
        for item in range(accessor["count"])
    )


def joint_region(name: str) -> str:
    if name == "Head" or name.startswith("Neck"):
        return "head-weighted"
    if name.startswith(
        ("Spine", "Waist", "Hip", "Pelvis", "L_Clavicle", "R_Clavicle")
    ):
        return "torso-weighted"
    if name.startswith(("L_Upperarm", "L_Forearm", "L_Hand")):
        return "left-arm-weighted"
    if name.startswith(("R_Upperarm", "R_Forearm", "R_Hand")):
        return "right-arm-weighted"
    if name.startswith(("L_Thigh", "L_Calf", "L_Foot", "L_Toe")):
        return "left-leg-weighted"
    if name.startswith(("R_Thigh", "R_Calf", "R_Foot", "R_Toe")):
        return "right-leg-weighted"
    return "mixed-or-auxiliary"


def rounded_vector(values: list[float] | tuple[float, ...]) -> list[float]:
    return [round(float(value), 6) for value in values]


def part_inventory(
    asset_id: str,
    raw: bytes,
    document: dict[str, Any],
    binary_offset: int,
) -> list[dict[str, Any]]:
    nodes = document.get("nodes", [])
    skins = document.get("skins", [])
    inventory: list[dict[str, Any]] = []
    for node_index, node in enumerate(nodes):
        if "mesh" not in node or "skin" not in node:
            continue
        skin = skins[node["skin"]]
        joint_names = [
            nodes[index].get("name", "") for index in skin.get("joints", [])
        ]
        mesh = document["meshes"][node["mesh"]]
        minimums: list[list[float]] = []
        maximums: list[list[float]] = []
        influence: dict[str, float] = {}
        region_influence = {region: 0.0 for region in REGION_TO_SLOT}
        vertex_count = 0
        primitive_count = 0
        for primitive in mesh.get("primitives", []):
            primitive_count += 1
            attributes = primitive.get("attributes", {})
            position_index = attributes.get("POSITION")
            if position_index is not None:
                position = document["accessors"][position_index]
                vertex_count += position["count"]
                if "min" in position:
                    minimums.append(position["min"])
                if "max" in position:
                    maximums.append(position["max"])
            if "JOINTS_0" not in attributes or "WEIGHTS_0" not in attributes:
                continue
            joints = accessor_values(
                raw, document, binary_offset, attributes["JOINTS_0"]
            )
            weights = accessor_values(
                raw, document, binary_offset, attributes["WEIGHTS_0"]
            )
            for joint_values, weight_values in zip(joints, weights):
                for joint_index, weight in zip(joint_values, weight_values):
                    joint_name = joint_names[int(joint_index)]
                    numeric_weight = float(weight)
                    influence[joint_name] = (
                        influence.get(joint_name, 0.0) + numeric_weight
                    )
                    region_influence[joint_region(joint_name)] += numeric_weight
        if not minimums or not maximums:
            raise ValueError(f"{asset_id} mesh node {node_index} has no bounds")
        total_influence = sum(region_influence.values()) or 1.0
        region_weights = {
            region: round(weight / total_influence, 6)
            for region, weight in region_influence.items()
        }
        ranked_regions = sorted(
            region_weights.items(), key=lambda item: (-item[1], item[0])
        )
        region, purity = ranked_regions[0]
        ranked_joints = sorted(
            influence.items(), key=lambda item: (-item[1], item[0])
        )
        dominant_joint, dominant_weight = (
            ranked_joints[0] if ranked_joints else ("unweighted", 0.0)
        )
        minimum = [
            round(min(values[axis] for values in minimums), 6)
            for axis in range(3)
        ]
        maximum = [
            round(max(values[axis] for values in maximums), 6)
            for axis in range(3)
        ]
        part_number = len(inventory)
        inventory.append(
            {
                "partId": f"{asset_id}:part:{part_number:02d}",
                "nodeName": node.get("name", ""),
                "nodeIndex": node_index,
                "meshIndex": node["mesh"],
                "skinIndex": node["skin"],
                "primitiveCount": primitive_count,
                "vertexCount": vertex_count,
                "bounds": {"min": minimum, "max": maximum},
                "classification": {
                    "method": "aggregated-skin-weight-region-isolation",
                    "region": region,
                    "purity": round(purity, 6),
                    "regionWeights": region_weights,
                    "dominantJoint": dominant_joint,
                    "dominantWeight": round(
                        dominant_weight
                        / (sum(influence.values()) or 1.0),
                        6,
                    ),
                    "topInfluences": [
                        {
                            "joint": name,
                            "weight": round(
                                weight / (sum(influence.values()) or 1.0),
                                6,
                            ),
                        }
                        for name, weight in ranked_joints[:5]
                        if weight > 0
                    ],
                },
            }
        )
    return inventory


def region_inventory(parts: list[dict[str, Any]]) -> dict[str, Any]:
    regions: dict[str, Any] = {}
    for region, slot in REGION_TO_SLOT.items():
        selected = [
            part
            for part in parts
            if part["classification"]["region"] == region
            and part["classification"]["purity"] >= 0.65
        ]
        denominator = (
            sum(
                float(part["classification"]["regionWeights"][region])
                for part in parts
            )
            or 1.0
        )
        coverage = sum(
            float(part["classification"]["regionWeights"][region])
            for part in selected
        ) / denominator
        contamination = (
            sum(
                1.0
                - float(part["classification"]["regionWeights"][region])
                for part in selected
            )
            / len(selected)
            if selected
            else 1.0
        )
        supported = bool(selected) and coverage >= 0.60 and contamination <= 0.35
        if supported:
            reason = (
                "Supported: isolated mesh parts meet >=0.65 purity, "
                ">=0.60 region coverage, and <=0.35 contamination."
            )
        elif not selected:
            reason = (
                "Refused: no mesh part reaches the 0.65 region-purity "
                "threshold without overlapping core geometry."
            )
        elif coverage < 0.60:
            reason = (
                f"Refused: isolated coverage {coverage:.3f} is below 0.600; "
                "showing it would omit or overlap core geometry."
            )
        else:
            reason = (
                f"Refused: contamination {contamination:.3f} exceeds 0.350; "
                "showing it would overlap another anatomical slot."
            )
        regions[slot] = {
            "regionId": region,
            "supported": supported,
            "partIds": (
                [part["partId"] for part in selected] if supported else []
            ),
            "partCount": len(selected) if supported else 0,
            "evidence": {
                "method": "aggregated-skin-weight-region-isolation",
                "minimumPartPurity": 0.65,
                "minimumCoverage": 0.60,
                "maximumContamination": 0.35,
                "measuredCoverage": round(coverage, 6),
                "measuredContamination": round(contamination, 6),
            },
            "reason": reason,
        }
    return regions


def animation_inventory(
    raw: bytes,
    document: dict[str, Any],
    binary_offset: int,
) -> list[dict[str, Any]]:
    nodes = document.get("nodes", [])
    clips: list[dict[str, Any]] = []
    for index, animation in enumerate(document.get("animations", [])):
        duration = 0.0
        target_names: set[str] = set()
        path_counts: Counter[str] = Counter()
        timing_hashes: list[str] = []
        pose_hashes: list[str] = []
        channel_records: list[dict[str, Any]] = []
        root_translation_ranges: list[dict[str, Any]] = []
        for channel in animation.get("channels", []):
            sampler = animation["samplers"][channel["sampler"]]
            input_accessor = document["accessors"][sampler["input"]]
            if input_accessor.get("max"):
                duration = max(duration, float(input_accessor["max"][0]))
            target = channel.get("target", {})
            target_name = nodes[target["node"]].get("name", "")
            target_path = str(target.get("path", ""))
            target_names.add(target_name)
            path_counts[target_path] += 1
            input_hash = sha256(
                accessor_bytes(
                    raw, document, binary_offset, sampler["input"]
                )
            )
            output_hash = sha256(
                accessor_bytes(
                    raw, document, binary_offset, sampler["output"]
                )
            )
            timing_hashes.append(input_hash)
            pose_hashes.append(output_hash)
            channel_records.append(
                {
                    "target": target_name,
                    "path": target_path,
                    "inputSha256": input_hash,
                    "outputSha256": output_hash,
                    "interpolation": sampler.get("interpolation", "LINEAR"),
                }
            )
            if target_path == "translation" and target_name in {
                "Root",
                "Hip",
                "Pelvis",
            }:
                values = accessor_values(
                    raw, document, binary_offset, sampler["output"]
                )
                minimum = [
                    min(float(value[axis]) for value in values)
                    for axis in range(3)
                ]
                maximum = [
                    max(float(value[axis]) for value in values)
                    for axis in range(3)
                ]
                root_translation_ranges.append(
                    {
                        "target": target_name,
                        "min": rounded_vector(minimum),
                        "max": rounded_vector(maximum),
                        "span": rounded_vector(
                            [
                                maximum[axis] - minimum[axis]
                                for axis in range(3)
                            ]
                        ),
                        "travelMagnitude": round(
                            math.sqrt(
                                sum(
                                    (
                                        maximum[axis] - minimum[axis]
                                    )
                                    ** 2
                                    for axis in range(3)
                                )
                            ),
                            6,
                        ),
                    }
                )
        clips.append(
            {
                "index": index,
                "name": animation.get("name", f"animation-{index}"),
                "durationSeconds": round(duration, 6),
                "channelCount": len(animation.get("channels", [])),
                "targetCount": len(target_names),
                "pathCounts": dict(sorted(path_counts.items())),
                "inputTimingSha256": sha256(
                    canonical_json(sorted(timing_hashes))
                ),
                "outputPoseSha256": sha256(
                    canonical_json(sorted(pose_hashes))
                ),
                "motionChannelSha256": sha256(
                    canonical_json(
                        sorted(
                            channel_records,
                            key=lambda item: (
                                item["target"],
                                item["path"],
                                item["inputSha256"],
                                item["outputSha256"],
                            ),
                        )
                    )
                ),
                "rootHipPelvisTranslationEvidence": root_translation_ranges,
            }
        )
    return clips


def scene_bounds(
    document: dict[str, Any],
) -> tuple[list[float], list[float]]:
    minimum = [math.inf, math.inf, math.inf]
    maximum = [-math.inf, -math.inf, -math.inf]
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            position_index = primitive.get("attributes", {}).get("POSITION")
            if position_index is None:
                continue
            accessor = document["accessors"][position_index]
            if "min" not in accessor or "max" not in accessor:
                raise ValueError("position accessor is missing deterministic bounds")
            for axis in range(3):
                minimum[axis] = min(minimum[axis], accessor["min"][axis])
                maximum[axis] = max(maximum[axis], accessor["max"][axis])
    if any(not math.isfinite(value) for value in [*minimum, *maximum]):
        raise ValueError("asset has no finite mesh bounds")
    return rounded_vector(minimum), rounded_vector(maximum)


def inspect_asset(config: dict[str, Any]) -> dict[str, Any]:
    path = ASSET_DIR / config["filename"]
    thumbnail_path = ASSET_DIR / config["thumbnail"]
    raw, document, binary_offset = parse_glb(path)
    thumbnail = thumbnail_path.read_bytes()
    nodes = document.get("nodes", [])
    skins = document.get("skins", [])
    animations = animation_inventory(raw, document, binary_offset)
    parts = part_inventory(config["id"], raw, document, binary_offset)
    regions = region_inventory(parts)
    inverse_bind_hashes = [
        sha256(
            accessor_bytes(
                raw,
                document,
                binary_offset,
                skin["inverseBindMatrices"],
            )
        )
        for skin in skins
        if "inverseBindMatrices" in skin
    ]
    joint_indices = [
        index for skin in skins for index in skin.get("joints", [])
    ]
    joint_set = set(joint_indices)
    parents = {
        child: parent
        for parent, node in enumerate(nodes)
        for child in node.get("children", [])
    }
    hierarchy = [
        {
            "name": nodes[index].get("name", ""),
            "parent": (
                nodes[parents[index]].get("name", "")
                if parents.get(index) in joint_set
                else None
            ),
        }
        for index in joint_indices
    ]
    rest_pose = [
        {
            "name": nodes[index].get("name", ""),
            "matrix": nodes[index].get("matrix"),
            "translation": nodes[index].get("translation", [0, 0, 0]),
            "rotation": nodes[index].get("rotation", [0, 0, 0, 1]),
            "scale": nodes[index].get("scale", [1, 1, 1]),
        }
        for index in joint_indices
    ]
    minimum, maximum = scene_bounds(document)
    height = maximum[1] - minimum[1]
    if not math.isfinite(height) or height <= 0:
        raise ValueError(f"{config['id']}: invalid normalization height")
    scale = 1.75 / height
    ground_offset = -minimum[1] * scale
    preview_position = [
        -((minimum[0] + maximum[0]) / 2) * scale,
        -((minimum[1] + maximum[1]) / 2) * scale,
        -((minimum[2] + maximum[2]) / 2) * scale,
    ]
    semantic_map = config["semanticClips"]
    if set(semantic_map) != set(SEMANTICS):
        raise ValueError(f"{config['id']}: semantic map is incomplete")
    if len(set(semantic_map.values())) != len(SEMANTICS):
        raise ValueError(f"{config['id']}: semantic mappings are ambiguous")
    for semantic, clip_index in semantic_map.items():
        if clip_index < 0 or clip_index >= len(animations):
            raise ValueError(
                f"{config['id']}: {semantic} clip index is outside inventory"
            )
    asset_url = f"/assets/imported-avatars/{config['filename']}"
    thumbnail_url = f"/assets/imported-avatars/{config['thumbnail']}"
    stable_part_ids = [part["partId"] for part in parts]
    normalization = {
        "units": "world-meter",
        "upAxis": "+Y",
        "forwardAxis": "+Z",
        "targetHeight": 1.75,
        "sourceBounds": {"min": minimum, "max": maximum},
        "scale": round(scale, 9),
        "yawRadians": 0,
        "offsetX": round(preview_position[0], 9),
        "offsetZ": round(preview_position[2], 9),
        "groundOffsetY": round(ground_offset, 9),
        "method": "wrapper-only-bounds-normalization",
    }
    semantic_evidence = {
        semantic: {
            "clipIndex": clip_index,
            "clipName": animations[clip_index]["name"],
            "motionChannelSha256": animations[clip_index][
                "motionChannelSha256"
            ],
            "inputTimingSha256": animations[clip_index][
                "inputTimingSha256"
            ],
            "outputPoseSha256": animations[clip_index]["outputPoseSha256"],
            "durationSeconds": animations[clip_index]["durationSeconds"],
            "channelCount": animations[clip_index]["channelCount"],
            "targetCount": animations[clip_index]["targetCount"],
            "pathCounts": animations[clip_index]["pathCounts"],
            "rootHipPelvisTranslationEvidence": animations[clip_index][
                "rootHipPelvisTranslationEvidence"
            ],
            "method": "deterministic-structure-plus-bounded-temporal-review-v1",
            "poseEvidence": (
                "artifacts/avatar-replacement-evidence/"
                "world-animation-completion-v1/temporal-review/"
                f"{config['id']}.png"
            ),
            "verification": "structural-temporal-evidence",
        }
        for semantic, clip_index in semantic_map.items()
    }
    semantic_review = {
        semantic: semantic_review_decision(config["id"], semantic, clip_index)
        for semantic, clip_index in semantic_map.items()
    }
    registry = {
        "id": config["id"],
        "label": config["label"],
        "family": config["family"],
        "number": config["number"],
        "originalRole": config["originalRole"],
        "allowedRoles": [config["originalRole"]],
        "lifecycle": "active",
        "builderVisibility": "normal",
        "assetUrl": asset_url,
        "previewAssetUrl": asset_url,
        "runtimeAssetUrl": asset_url,
        "thumbnailUrl": thumbnail_url,
        "clips": [clip["name"] for clip in animations],
        "clipCount": len(animations),
        "semanticClips": semantic_map,
        "semanticEvidence": semantic_evidence,
        "semanticReview": semantic_review,
        "segmentationAvailable": len(stable_part_ids) > 1,
        "segments": {
            "inventoryPointer": (
                "/assets/imported-avatars/manifest.json"
                f"#asset={config['id']}&inventory=parts"
            ),
            "stablePartIds": stable_part_ids,
            "partCount": len(stable_part_ids),
            "regions": regions,
        },
        "partCount": len(stable_part_ids),
        "supportedSlots": [
            slot for slot, region in regions.items() if region["supported"]
        ],
        "skeleton": {
            "jointCount": len(joint_indices),
            "hierarchySha256": sha256(canonical_json(hierarchy)),
            "restPoseSha256": sha256(canonical_json(rest_pose)),
            "inverseBindSha256": (
                inverse_bind_hashes[0] if inverse_bind_hashes else ""
            ),
        },
        "compatibilityClass": config["compatibilityClass"],
        "composition": {
            "mode": "layered-skeleton-roots-only",
            "clone": "SkeletonUtils.clone",
            "foreignSkeletonRebind": "prohibited",
        },
        "provenance": {
            "classification": "user-provided-local",
            "generationSource": "aaron-tripo3d-subscription",
            "operatorGrant": "agentintersect-world-unrestricted-private-public-redistribution",
            "suppliedLicenseStatus": SUPPLIED_LICENSE_STATUS,
        },
        "fallbackPolicy": {
            "unsupportedWorldSemantic": "Idle",
            "missingAsset": "static-thumbnail",
            "migration": "explicit-avatar-reselection-required",
            "crossModelParts": "layered-skeleton-only-or-refuse",
        },
        "normalization": normalization,
        "preview": {
            "position": rounded_vector(preview_position),
            "rotation": [0, 0, 0],
            "scale": round(scale, 9),
        },
        "world": {
            "rotation": [0, 0, 0],
            "scale": round(scale, 9),
            "groundOffset": round(ground_offset, 9),
        },
    }
    return {
        "id": config["id"],
        "family": config["family"],
        "number": config["number"],
        "label": config["label"],
        "originalRole": config["originalRole"],
        "sourceClassification": "user-provided-local",
        "generationSource": "aaron-tripo3d-subscription",
        "operatorGrant": "agentintersect-world-unrestricted-private-public-redistribution",
        "suppliedLicenseStatus": SUPPLIED_LICENSE_STATUS,
        "shippedFilename": config["filename"],
        "thumbnailFilename": config["thumbnail"],
        "byteSize": len(raw),
        "sha256": sha256(raw),
        "sourceSha256": sha256(raw),
        "thumbnailByteSize": len(thumbnail),
        "thumbnailSha256": sha256(thumbnail),
        "sourceThumbnailSha256": sha256(thumbnail),
        "glb": {
            "valid": True,
            "assetVersion": document.get("asset", {}).get("version"),
            "generator": document.get("asset", {}).get("generator"),
        },
        "counts": {
            "scenes": len(document.get("scenes", [])),
            "nodes": len(nodes),
            "meshes": len(document.get("meshes", [])),
            "skinnedMeshes": len(parts),
            "skins": len(skins),
            "joints": len(joint_indices),
            "animations": len(animations),
            "materials": len(document.get("materials", [])),
            "textures": len(document.get("textures", [])),
            "images": len(document.get("images", [])),
            "embeddedImages": sum(
                1
                for image in document.get("images", [])
                if "bufferView" in image and "uri" not in image
            ),
        },
        "sceneRootTransforms": [
            {
                "nodeIndex": node_index,
                "name": nodes[node_index].get("name", ""),
                "matrix": nodes[node_index].get("matrix"),
                "translation": nodes[node_index].get(
                    "translation", [0, 0, 0]
                ),
                "rotation": nodes[node_index].get(
                    "rotation", [0, 0, 0, 1]
                ),
                "scale": nodes[node_index].get("scale", [1, 1, 1]),
            }
            for scene in document.get("scenes", [])
            for node_index in scene.get("nodes", [])
        ],
        "jointNames": [nodes[index].get("name", "") for index in joint_indices],
        "skeleton": registry["skeleton"],
        "inverseBindMatricesSha256": inverse_bind_hashes,
        "clips": animations,
        "semanticClips": semantic_map,
        "semanticEvidence": semantic_evidence,
        "semanticReview": semantic_review,
        "normalization": normalization,
        "parts": parts,
        "regions": regions,
        "registry": registry,
    }


def build_payload() -> dict[str, Any]:
    assets = [inspect_asset(config) for config in ASSETS]
    hierarchy_counts = Counter(
        asset["skeleton"]["hierarchySha256"] for asset in assets
    )
    return {
        "schema": "aiw.replacement-avatar-assets/3",
        "authority": "repository-owned-replacement-avatar-registry",
        "provenance": "user-provided-local",
        "generationSource": "aaron-tripo3d-subscription",
        "operatorGrant": "agentintersect-world-unrestricted-private-public-redistribution",
        "suppliedLicenseStatus": SUPPLIED_LICENSE_STATUS,
        "sourcePathsIncluded": False,
        "sourceClipMutation": "prohibited",
        "composition": {
            "mode": "layered-skeleton-roots-only",
            "foreignSkeletonRebind": "prohibited",
            "catAgent01CompatibilityException": True,
        },
        "summary": {
            "assetCount": len(assets),
            "glbByteSize": sum(asset["byteSize"] for asset in assets),
            "stanceThumbnailCount": len(assets),
            "jointHierarchyClasses": dict(sorted(hierarchy_counts.items())),
            "uniqueRestPoseCount": len(
                {asset["skeleton"]["restPoseSha256"] for asset in assets}
            ),
            "uniqueInverseBindCount": len(
                {
                    asset["skeleton"]["inverseBindSha256"]
                    for asset in assets
                }
            ),
        },
        "notes": [
            "Runtime URLs are repository-relative and contain no private source paths.",
            "Copied GLB and stance-image bytes are bound to source SHA-256 values.",
            "T-pose images remain source/evidence references and are not runtime payload.",
            "Anonymous clip names remain immutable; runtime semantics require the model-local structural and bounded temporal evidence records.",
            "Aaron generated the models under his Tripo3D subscription and confirms unrestricted AgentIntersect World private/public use and redistribution; this records the operator grant, not a third-party legal opinion.",
            "Every visible modular donor region keeps its source root, skeleton, bind matrices, and source-local clip.",
            "Unsupported or overlapping regions are explicitly refused.",
        ],
        "assets": assets,
    }


def generated_registry_source(payload: dict[str, Any]) -> str:
    registry = []
    for asset in payload["assets"]:
        source = asset["registry"]
        runtime = {
            key: source[key]
            for key in (
                "id",
                "label",
                "family",
                "number",
                "originalRole",
                "allowedRoles",
                "assetUrl",
                "thumbnailUrl",
                "clipCount",
                "semanticClips",
                "partCount",
                "supportedSlots",
                "preview",
                "world",
            )
        }
        runtime["semanticDurations"] = [
            source["semanticEvidence"][semantic]["durationSeconds"]
            for semantic in SEMANTICS
        ]
        runtime["semanticReviewVerdicts"] = [
            {
                "pass": "p",
                "wrong_clip": "w",
                "ambiguous": "a",
                "unsupported": "u",
            }[source["semanticReview"][semantic]["verdict"]]
            for semantic in SEMANTICS
        ]
        runtime["semanticReviewExpectedClipIndices"] = [
            source["semanticReview"][semantic]["expectedClipIndex"]
            for semantic in SEMANTICS
        ]
        registry.append(runtime)
    return (
        "// Generated by tooling/avatar/inspect_imported_avatars.py. "
        "Do not hand-edit.\n"
        "// prettier-ignore\n"
        "export const GENERATED_IMPORTED_AVATAR_REGISTRY = "
        + json.dumps(registry, separators=(",", ":"), sort_keys=True)
        + " as const;\n"
    )


def load_source_inventory(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"source inventory is unavailable or invalid: {error}")
    if (
        value.get("schema") != "aiw.avatar-replacement-source-intake/1"
        or value.get("assetCount") != 69
        or value.get("classification") != "user-provided-local"
        or value.get("sourceImmutable") is not True
        or not isinstance(value.get("suppliedLicenseStatus"), str)
        or not isinstance(value.get("sourceRoots"), dict)
        or not isinstance(value.get("assets"), list)
    ):
        raise ValueError("source inventory contract is invalid")
    return value


def validate_source_inventory(
    path: Path, *, compare_copies: bool
) -> dict[tuple[str, str], dict[str, Any]]:
    value = load_source_inventory(path)
    records: dict[tuple[str, str], dict[str, Any]] = {}
    counters = {"glb": 0, "stance": 0, "tpose": 0}
    glb_bytes = 0
    for record in value["assets"]:
        family = record.get("family")
        filename = record.get("sourceFilename")
        if not isinstance(family, str) or not isinstance(filename, str):
            raise ValueError("source inventory contains an invalid asset record")
        key = (family, filename)
        if key in records:
            raise ValueError("source inventory contains a duplicate asset")
        source_root = value["sourceRoots"].get(family)
        if not isinstance(source_root, str):
            raise ValueError("source inventory family root is unavailable")
        source_path = Path(source_root) / filename
        raw = source_path.read_bytes()
        if len(raw) != record.get("byteSize") or sha256(raw) != record.get(
            "sha256"
        ):
            raise ValueError("source immutability check failed")
        records[key] = {**record, "bytes": raw}
        if filename.endswith(".glb"):
            counters["glb"] += 1
            glb_bytes += len(raw)
        elif " Stance." in filename:
            counters["stance"] += 1
        elif " T Pose." in filename:
            counters["tpose"] += 1
    if counters != {"glb": 23, "stance": 23, "tpose": 23}:
        raise ValueError("source inventory does not contain 23 complete trios")
    if glb_bytes != 328_671_832:
        raise ValueError("source GLB byte total differs from frozen intake")
    if compare_copies:
        for config in ASSETS:
            source_glb = records[(config["family"], config["sourceGlb"])]
            source_stance = records[
                (config["family"], config["sourceStance"])
            ]
            copied_glb = (ASSET_DIR / config["filename"]).read_bytes()
            copied_stance = (ASSET_DIR / config["thumbnail"]).read_bytes()
            if copied_glb != source_glb["bytes"]:
                raise ValueError(f"{config['id']} GLB copy differs from source")
            if copied_stance != source_stance["bytes"]:
                raise ValueError(
                    f"{config['id']} stance copy differs from source"
                )
    print(
        "verified source immutability: "
        "69 files, 23 GLBs, 23 stance images, 23 T-pose references, "
        "328671832 GLB bytes; copy mismatches=0"
    )
    return records


def copy_from_source_inventory(path: Path) -> None:
    records = validate_source_inventory(path, compare_copies=False)
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    for config in ASSETS:
        source_glb = records[(config["family"], config["sourceGlb"])]
        source_stance = records[(config["family"], config["sourceStance"])]
        (ASSET_DIR / config["filename"]).write_bytes(source_glb["bytes"])
        (ASSET_DIR / config["thumbnail"]).write_bytes(
            source_stance["bytes"]
        )
    print("copied 23 GLBs and 23 stance thumbnails byte-for-byte")


def expected_runtime_filenames() -> set[str]:
    return {
        "manifest.json",
        *(config["filename"] for config in ASSETS),
        *(config["thumbnail"] for config in ASSETS),
    }


def validate_runtime_catalog() -> None:
    actual = {path.name for path in ASSET_DIR.iterdir() if path.is_file()}
    expected = expected_runtime_filenames()
    if actual != expected:
        missing = sorted(expected - actual)
        unexpected = sorted(actual - expected)
        raise ValueError(
            f"runtime catalog mismatch; missing={missing}; unexpected={unexpected}"
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="check repository manifest, registry, assets, and optional sources",
    )
    parser.add_argument(
        "--copy-sources",
        action="store_true",
        help="copy GLBs and stance thumbnails from a validated source inventory",
    )
    parser.add_argument(
        "--source-inventory",
        type=Path,
        help="explicit external source-inventory JSON for copying or checking",
    )
    parser.add_argument(
        "--skip-source-check",
        action="store_true",
        help="skip checking an explicitly supplied external source inventory",
    )
    arguments = parser.parse_args()
    source_inventory = arguments.source_inventory
    if arguments.copy_sources:
        if source_inventory is None:
            raise SystemExit("--copy-sources requires a source inventory")
        copy_from_source_inventory(source_inventory)
    try:
        validate_runtime_catalog()
        payload = build_payload()
        registry_source = generated_registry_source(payload)
        semantic_review = build_semantic_review(payload)
        if (
            source_inventory is not None
            and not arguments.skip_source_check
            and not arguments.copy_sources
        ):
            validate_source_inventory(source_inventory, compare_copies=True)
        if arguments.check:
            try:
                current_manifest = json.loads(
                    MANIFEST.read_text(encoding="utf-8")
                )
                current_registry = GENERATED_REGISTRY.read_text(
                    encoding="utf-8"
                )
                current_semantic_review = json.loads(
                    SEMANTIC_REVIEW.read_text(encoding="utf-8")
                )
            except (OSError, json.JSONDecodeError) as error:
                raise ValueError(
                    f"generated repository authority is unavailable: {error}"
                )
            if current_manifest != payload:
                raise ValueError(
                    "replacement avatar manifest is stale; regenerate it"
                )
            if current_registry != registry_source:
                raise ValueError(
                    "replacement avatar runtime registry is stale; regenerate it"
                )
            if current_semantic_review != semantic_review:
                raise ValueError(
                    "World animation semantic review is stale or divergent"
                )
            print(
                "verified 23 repository-owned replacement avatars; "
                "manifest and runtime registry are deterministic"
            )
            return
        MANIFEST.write_text(
            json.dumps(payload, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        GENERATED_REGISTRY.write_text(registry_source, encoding="utf-8")
        SEMANTIC_REVIEW.parent.mkdir(parents=True, exist_ok=True)
        SEMANTIC_REVIEW.write_text(
            json.dumps(semantic_review, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        print(
            "generated deterministic manifest and runtime registry "
            "for 23 replacement avatars"
        )
    except (OSError, KeyError, TypeError, ValueError, struct.error) as error:
        raise SystemExit(str(error)) from error


if __name__ == "__main__":
    main()
