"""Independent Blender-side structural and geometry inspection for Phase 11."""
from __future__ import annotations

import bpy
import hashlib
import json
import re
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/avatar/aiw-avatar-blend-inspection.json"
CORE = ["CORE_MIDSECTION", "CORE_CHEST", "CORE_ARM_L", "CORE_ARM_R", "CORE_LEG_L", "CORE_LEG_R"]
ANCHORS = ["ATTACH_HEAD", "ATTACH_HAND_L", "ATTACH_HAND_R", "ATTACH_FOOT_L", "ATTACH_FOOT_R", "ATTACH_TAIL", "ATTACH_SHIRT", "ATTACH_NAMEPLATE"]
ACTIONS = ["Idle", "Walk", "Run", "Work", "Celebrate", "Error", "Offline"]
FACE_GROUPS = {"FACE_EYE_L", "FACE_EYE_R", "FACE_NOSE", "FACE_MOUTH"}
PRIMARY_BONES = ["root", "pelvis", "spine", "chest", "neck", "head", "upper_arm.L", "lower_arm.L", "hand.L", "upper_arm.R", "lower_arm.R", "hand.R", "upper_leg.L", "lower_leg.L", "foot.L", "upper_leg.R", "lower_leg.R", "foot.R"]


def world_bounds(obj):
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return {
        "min": [round(min(point[index] for point in points), 5) for index in range(3)],
        "max": [round(max(point[index] for point in points), 5) for index in range(3)],
    }


def geometry_hash(obj):
    vertices = sorted(tuple(round(component, 5) for component in vertex.co) for vertex in obj.data.vertices)
    polygons = sorted(tuple(sorted(polygon.vertices)) for polygon in obj.data.polygons)
    payload = json.dumps({"vertices": vertices, "polygons": polygons}, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


def aabb_gap(first, second):
    a = world_bounds(first)
    b = world_bounds(second)
    gaps = [max(0, a["min"][axis] - b["max"][axis], b["min"][axis] - a["max"][axis]) for axis in range(3)]
    return round(sum(component * component for component in gaps) ** 0.5, 5)


def action_evidence(action):
    fcurves = []
    for layer in action.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                fcurves.extend(channelbag.fcurves)
    bones = sorted({match.group(1) for curve in fcurves if (match := re.search(r'pose\.bones\["([^"]+)"\]', curve.data_path))})
    signature_payload = []
    for curve in sorted(fcurves, key=lambda item: (item.data_path, item.array_index)):
        signature_payload.append((curve.data_path, curve.array_index, [(round(point.co.x, 4), round(point.co.y, 4)) for point in curve.keyframe_points]))
    signature = hashlib.sha256(json.dumps(signature_payload, separators=(",", ":")).encode()).hexdigest()
    return {"bones": bones, "trackCount": len(fcurves), "signature": signature, "frameRange": [action.frame_start, action.frame_end]}


armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
names = {obj.name for obj in bpy.data.objects}
mesh_names = {obj.name for obj in bpy.data.objects if obj.type == "MESH"}
rig = armatures[0] if len(armatures) == 1 else None

module_groups = {
    "hands": [f"HAND_{kind}_L" for kind in ("hands", "paws", "clawed-paws")],
    "feet": [f"FOOT_{kind}_L" for kind in ("feet", "paws", "clawed-paws")],
    "fur": [f"FUR_{kind}" for kind in ("none", "short", "long")],
    "tails": [f"TAIL_{kind}" for kind in ("none", "cat-straight", "cat-curled", "dog-straight", "dog-curled")],
    "markings": [f"MARKING_{kind}" for kind in ("solid", "muzzle", "mask", "socks")],
}
geometry = {
    group: {
        name: {"hash": geometry_hash(bpy.data.objects[name]), "bounds": world_bounds(bpy.data.objects[name]), "vertices": len(bpy.data.objects[name].data.vertices)}
        for name in group_names
    }
    for group, group_names in module_groups.items()
}
distinct_modules = {group: len({entry["hash"] for entry in entries.values()}) == len(entries) for group, entries in geometry.items()}

curved_tail_spans = {}
for name in ("TAIL_cat-curled", "TAIL_dog-curled"):
    bounds = world_bounds(bpy.data.objects[name])
    curved_tail_spans[name] = [round(bounds["max"][axis] - bounds["min"][axis], 5) for axis in range(3)]

shirt_label_bounds = {}
shirt_labels_fit = True
for shirt_name in ("Codex", "Claude", "Hermes", "OpenClaw"):
    label = bpy.data.objects[f"SHIRT_LABEL_{shirt_name}"]
    bounds = world_bounds(label)
    shirt_label_bounds[shirt_name] = bounds
    shirt_labels_fit &= bounds["min"][0] >= -0.35 and bounds["max"][0] <= 0.35 and bounds["min"][2] >= 0.90 and bounds["max"][2] <= 1.42

connections = {
    "midsectionChest": aabb_gap(bpy.data.objects["CORE_MIDSECTION"], bpy.data.objects["CORE_CHEST"]),
    "chestArmL": aabb_gap(bpy.data.objects["CORE_CHEST"], bpy.data.objects["CORE_ARM_L"]),
    "chestArmR": aabb_gap(bpy.data.objects["CORE_CHEST"], bpy.data.objects["CORE_ARM_R"]),
    "midsectionLegL": aabb_gap(bpy.data.objects["CORE_MIDSECTION"], bpy.data.objects["CORE_LEG_L"]),
    "midsectionLegR": aabb_gap(bpy.data.objects["CORE_MIDSECTION"], bpy.data.objects["CORE_LEG_R"]),
    "armHandL": aabb_gap(bpy.data.objects["CORE_ARM_L"], bpy.data.objects["HAND_hands_L"]),
    "armHandR": aabb_gap(bpy.data.objects["CORE_ARM_R"], bpy.data.objects["HAND_hands_R"]),
    "legFootL": aabb_gap(bpy.data.objects["CORE_LEG_L"], bpy.data.objects["FOOT_feet_L"]),
    "legFootR": aabb_gap(bpy.data.objects["CORE_LEG_R"], bpy.data.objects["FOOT_feet_R"]),
    "chestHead": aabb_gap(bpy.data.objects["CORE_CHEST"], bpy.data.objects["HEAD_human_round"]),
}

action_details = {action.name: action_evidence(action) for action in bpy.data.actions}
action_signatures = {details["signature"] for details in action_details.values()}
head_face_inventory = {}
for head_name in sorted(name for name in mesh_names if name.startswith("HEAD_")):
    head = bpy.data.objects[head_name]
    groups = {
        group.name: sum(1 for vertex in head.data.vertices if any(member.group == group.index and member.weight > 0 for member in vertex.groups))
        for group in head.vertex_groups
        if group.name.startswith("FACE_")
    }
    head_face_inventory[head_name] = {
        "groups": groups,
        "faceMaterials": sorted(material.name for material in head.data.materials if material and material.name.startswith("MAT_FACE_")),
    }
pose_evidence = {
    action.name: {
        "label": action.get("aiw_evidence_label"),
        "frame": action.get("aiw_evidence_frame"),
    }
    for action in bpy.data.actions
}
skinned_names = [name for name in mesh_names if name.startswith(("CORE_", "HEAD_", "HAND_", "FOOT_", "FUR_", "TAIL_", "MARKING_", "SHIRT_"))]
skeleton_bound = all(
    any(modifier.type == "ARMATURE" and modifier.object == rig for modifier in bpy.data.objects[name].modifiers)
    and len(bpy.data.objects[name].vertex_groups) > 0
    for name in skinned_names
)

checks = {
    "oneArmature": len(armatures) == 1 and armatures[0].name == "AIW_Biped_Rig",
    "sixSharedCoreObjects": all(name in mesh_names for name in CORE) and len([name for name in mesh_names if name.startswith("CORE_")]) == 6,
    "primaryBones": rig is not None and all(name in rig.data.bones for name in PRIMARY_BONES),
    "attachments": all(name in names for name in ANCHORS),
    "actions": sorted(action.name for action in bpy.data.actions) == sorted(ACTIONS),
    "heads": len([name for name in mesh_names if name.startswith("HEAD_")]) == 12,
    "hands": len([name for name in mesh_names if name.startswith("HAND_")]) == 6,
    "feet": len([name for name in mesh_names if name.startswith("FOOT_")]) == 6,
    "fur": len([name for name in mesh_names if name.startswith("FUR_")]) == 3,
    "tails": len([name for name in mesh_names if name.startswith("TAIL_")]) == 5,
    "markings": len([name for name in mesh_names if name.startswith("MARKING_")]) == 4,
    "shirts": len([name for name in mesh_names if name.startswith("SHIRT_") and not name.startswith("SHIRT_LABEL_")]) == 4,
    "shirtLabels": all(f"SHIRT_LABEL_{name}" in mesh_names for name in ("Codex", "Claude", "Hermes", "OpenClaw")),
    "bodyColors": len([mat for mat in bpy.data.materials if mat.name.startswith("MAT_BODY_")]) == 12,
    "skeletonBoundMeshes": skeleton_bound,
    "distinctModuleGeometry": all(distinct_modules.values()),
    "curvedTailGeometry": all(span[0] >= 0.30 and span[1] >= 0.25 and span[2] >= 0.45 for span in curved_tail_spans.values()),
    "shirtLabelsInsideFront": shirt_labels_fit,
    "connectedStandingBiped": max(connections.values()) <= 0.035,
    "multiBoneActions": all(details["trackCount"] >= 9 and len(details["bones"]) >= 3 for details in action_details.values()),
    "distinctActionSignatures": len(action_signatures) == len(ACTIONS),
    "facialFeatureInventory": all(
        FACE_GROUPS <= set(entry["groups"])
        and all(entry["groups"][group] >= 4 for group in FACE_GROUPS)
        and len(entry["faceMaterials"]) >= 2
        for entry in head_face_inventory.values()
    ) and len(head_face_inventory) == 12,
    "poseEvidenceMetadata": set(pose_evidence) == set(ACTIONS) and all(
        entry["label"] == name and isinstance(entry["frame"], int)
        for name, entry in pose_evidence.items()
    ),
    "evidenceBoardMetadata": bpy.context.scene.get("aiw_appearance_evidence") == "aiw-avatar-contact-sheet.png"
    and bpy.context.scene.get("aiw_motion_evidence") == "aiw-avatar-motion-sheet.png",
}

result = {
    "schema": "aiw.avatar-blend-inspection/0.11", "checks": checks, "passed": all(checks.values()),
    "counts": {"objects": len(bpy.data.objects), "meshes": len(bpy.data.meshes), "materials": len(bpy.data.materials), "armatures": len(armatures), "bones": len(rig.data.bones) if rig else 0, "actions": len(bpy.data.actions)},
    "coreObjects": CORE, "attachments": ANCHORS, "actions": sorted(action.name for action in bpy.data.actions),
    "geometry": geometry, "curvedTailSpans": curved_tail_spans, "shirtLabelBounds": shirt_label_bounds,
    "connectionGaps": connections, "actionDetails": action_details,
    "headFaceInventory": head_face_inventory, "poseEvidence": pose_evidence,
}
OUT.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
print(json.dumps(result, sort_keys=True))
if not result["passed"]:
    raise SystemExit(2)
