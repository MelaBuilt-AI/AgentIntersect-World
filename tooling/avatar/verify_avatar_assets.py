"""Independently parse the GLB and enforce Phase 11 structure, geometry, and budgets."""
from __future__ import annotations

import hashlib
import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "assets/avatar/aiw-avatar-kit.manifest.json"
GLB = ROOT / "apps/web/public/assets/avatar/aiw-avatar-kit.glb"
BLEND = ROOT / "assets/avatar/aiw-avatar-kit.blend"
SHEET = ROOT / "apps/web/public/assets/avatar/aiw-avatar-contact-sheet.png"
MOTION_SHEET = ROOT / "apps/web/public/assets/avatar/aiw-avatar-motion-sheet.png"
INSPECTION = ROOT / "assets/avatar/aiw-avatar-blend-inspection.json"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


raw = GLB.read_bytes()
magic, version, length = struct.unpack_from("<4sII", raw, 0)
if magic != b"glTF" or version != 2 or length != len(raw):
    raise SystemExit("invalid GLB header")
chunk_len, chunk_type = struct.unpack_from("<II", raw, 12)
if chunk_type != 0x4E4F534A:
    raise SystemExit("missing GLB JSON chunk")
gltf = json.loads(raw[20:20 + chunk_len].decode("utf-8"))
binary_offset = 20 + chunk_len + 8
nodes = gltf.get("nodes", [])
node_by_name = {node.get("name"): node for node in nodes}
node_names = set(node_by_name)
animation_names = {animation.get("name") for animation in gltf.get("animations", [])}
required_actions = {"Idle", "Walk", "Run", "Work", "Celebrate", "Error", "Offline"}
required_core = {"CORE_MIDSECTION", "CORE_CHEST", "CORE_ARM_L", "CORE_ARM_R", "CORE_LEG_L", "CORE_LEG_R"}
required_anchors = {"ATTACH_HEAD", "ATTACH_HAND_L", "ATTACH_HAND_R", "ATTACH_FOOT_L", "ATTACH_FOOT_R", "ATTACH_TAIL", "ATTACH_SHIRT", "ATTACH_NAMEPLATE"}


def accessor_bytes(index):
    accessor = gltf["accessors"][index]
    view = gltf["bufferViews"][accessor["bufferView"]]
    component_sizes = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
    element_widths = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
    width = component_sizes[accessor["componentType"]] * element_widths[accessor["type"]]
    start = binary_offset + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    stride = view.get("byteStride", width)
    if stride == width:
        return raw[start:start + accessor["count"] * width]
    return b"".join(raw[start + item * stride:start + item * stride + width] for item in range(accessor["count"]))


def mesh_signature(node_name):
    mesh = gltf["meshes"][node_by_name[node_name]["mesh"]]
    digest = hashlib.sha256()
    for primitive in mesh["primitives"]:
        digest.update(accessor_bytes(primitive["attributes"]["POSITION"]))
        if "indices" in primitive:
            digest.update(accessor_bytes(primitive["indices"]))
    return digest.hexdigest()


def animation_signature(animation):
    digest = hashlib.sha256()
    for channel in sorted(animation["channels"], key=lambda item: (nodes[item["target"]["node"]].get("name", ""), item["target"]["path"])):
        sampler = animation["samplers"][channel["sampler"]]
        digest.update(nodes[channel["target"]["node"]].get("name", "").encode())
        digest.update(channel["target"]["path"].encode())
        digest.update(accessor_bytes(sampler["input"]))
        digest.update(accessor_bytes(sampler["output"]))
    return digest.hexdigest()


module_groups = {
    "hands": [f"HAND_{kind}_L" for kind in ("hands", "paws", "clawed-paws")],
    "feet": [f"FOOT_{kind}_L" for kind in ("feet", "paws", "clawed-paws")],
    "fur": [f"FUR_{kind}" for kind in ("none", "short", "long")],
    "tails": [f"TAIL_{kind}" for kind in ("none", "cat-straight", "cat-curled", "dog-straight", "dog-curled")],
    "markings": [f"MARKING_{kind}" for kind in ("solid", "muzzle", "mask", "socks")],
}
module_signatures = {group: {name: mesh_signature(name) for name in names} for group, names in module_groups.items()}
distinct_runtime_modules = all(len(set(signatures.values())) == len(signatures) for signatures in module_signatures.values())

animation_signatures = {animation["name"]: animation_signature(animation) for animation in gltf.get("animations", [])}
animation_target_counts = {
    animation["name"]: len({nodes[channel["target"]["node"]].get("name") for channel in animation["channels"]})
    for animation in gltf.get("animations", [])
}
head_nodes = [node for node in nodes if isinstance(node.get("name"), str) and node["name"].startswith("HEAD_")]
manifest = json.loads(MANIFEST.read_text())
inspection = json.loads(INSPECTION.read_text())
checks = {
    "blendInspection": inspection.get("passed") is True,
    "structuralGeometryEvidence": all(inspection.get("checks", {}).get(name) is True for name in ("skeletonBoundMeshes", "distinctModuleGeometry", "curvedTailGeometry", "shirtLabelsInsideFront", "connectedStandingBiped", "multiBoneActions", "distinctActionSignatures", "facialFeatureInventory", "poseEvidenceMetadata", "evidenceBoardMetadata")),
    "glbCore": required_core <= node_names,
    "glbRig": "AIW_Biped_Rig" in node_names and len(gltf.get("skins", [])) == 1,
    "glbAttachments": required_anchors <= node_names,
    "glbActions": required_actions == animation_names,
    "glbDistinctActions": len(set(animation_signatures.values())) == len(required_actions),
    "glbMultiBoneActions": all(count >= 3 for count in animation_target_counts.values()),
    "glbHeads": len(head_nodes) == 12 and all("mesh" in node and "skin" in node for node in head_nodes),
    "glbFaceMaterials": {"MAT_FACE_EYE", "MAT_FACE_NOSE", "MAT_FACE_MOUTH"} <= {material.get("name") for material in gltf.get("materials", [])},
    "glbDistinctModules": distinct_runtime_modules,
    "glbShirts": all(f"SHIRT_{name}" in node_names and f"SHIRT_LABEL_{name}" in node_names for name in ("Codex", "Claude", "Hermes", "OpenClaw")),
    "glbBudget": GLB.stat().st_size <= 3 * 1024 * 1024,
    "blendBudget": BLEND.stat().st_size <= 15 * 1024 * 1024,
    "evidenceBoards": manifest.get("evidenceBoards") == [
        "apps/web/public/assets/avatar/aiw-avatar-contact-sheet.png",
        "apps/web/public/assets/avatar/aiw-avatar-motion-sheet.png",
    ],
    "sheetBudget": SHEET.stat().st_size + MOTION_SHEET.stat().st_size <= 4 * 1024 * 1024,
    "hashes": all(manifest["files"][str(path.relative_to(ROOT))]["sha256"] == sha(path) for path in (BLEND, GLB, SHEET, MOTION_SHEET)),
}
result = {
    "schema": "aiw.avatar-runtime-inspection/0.11", "passed": all(checks.values()), "checks": checks,
    "counts": {"nodes": len(nodes), "meshes": len(gltf.get("meshes", [])), "materials": len(gltf.get("materials", [])), "skins": len(gltf.get("skins", [])), "animations": len(gltf.get("animations", []))},
    "sizes": {"blend": BLEND.stat().st_size, "glb": GLB.stat().st_size, "contactSheet": SHEET.stat().st_size, "motionSheet": MOTION_SHEET.stat().st_size},
    "hashes": {"blend": sha(BLEND), "glb": sha(GLB), "contactSheet": sha(SHEET), "motionSheet": sha(MOTION_SHEET)},
    "moduleSignatures": module_signatures, "animationSignatures": animation_signatures, "animationTargetCounts": animation_target_counts,
}
print(json.dumps(result, indent=2, sort_keys=True))
(ROOT / "assets/avatar/aiw-avatar-runtime-inspection.json").write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
sys.exit(0 if result["passed"] else 2)
