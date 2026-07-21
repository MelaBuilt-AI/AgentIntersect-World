"""Deterministically build the project-owned Phase 11 modular avatar kit."""
from __future__ import annotations

import bmesh
import bpy
import hashlib
import json
import math
import struct
import warnings
from pathlib import Path

from mathutils import Matrix, Vector

warnings.filterwarnings("ignore", category=DeprecationWarning)

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/avatar/aiw-avatar-kit.blend"
GLB = ROOT / "apps/web/public/assets/avatar/aiw-avatar-kit.glb"
SHEET = ROOT / "apps/web/public/assets/avatar/aiw-avatar-contact-sheet.png"
MOTION_SHEET = ROOT / "apps/web/public/assets/avatar/aiw-avatar-motion-sheet.png"
MANIFEST = ROOT / "assets/avatar/aiw-avatar-kit.manifest.json"

CORE = ["CORE_MIDSECTION", "CORE_CHEST", "CORE_ARM_L", "CORE_ARM_R", "CORE_LEG_L", "CORE_LEG_R"]
HEADS = {
    "human": ["round", "angular", "soft", "square"],
    "dog": ["labrador", "shepherd", "husky", "beagle"],
    "cat": ["shorthair", "siamese", "maine-coon", "bengal"],
}
ATTACHMENTS = ["ATTACH_HEAD", "ATTACH_HAND_L", "ATTACH_HAND_R", "ATTACH_FOOT_L", "ATTACH_FOOT_R", "ATTACH_TAIL", "ATTACH_SHIRT", "ATTACH_NAMEPLATE"]
ACTIONS = ["Idle", "Walk", "Run", "Work", "Celebrate", "Error", "Offline"]
ACTION_EVIDENCE_FRAMES = {"Idle": 16, "Walk": 1, "Run": 1, "Work": 12, "Celebrate": 10, "Error": 16, "Offline": 1}
COLORS = {
    "porcelain": "F2D6CB", "warm-light": "D9A07B", "golden": "B97845", "bronze": "8C5639",
    "umber": "5B3528", "deep": "321E1A", "fur-cream": "E8DCC4", "fur-gold": "C78B3B",
    "fur-brown": "70452F", "fur-charcoal": "30343B", "fantasy-blue": "3977A8", "fantasy-violet": "7257A8",
}
SHIRTS = {"Codex": "2563EB", "Claude": "EA580C", "Hermes": "FACC15", "OpenClaw": "DC2626"}


def rgb(code: str):
    return tuple(int(code[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)


def material(name: str, code: str, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgb(code)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgb(code)
    bsdf.inputs["Roughness"].default_value = 0.72
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def move_to_collection(obj, collection):
    collection.objects.link(obj)
    bpy.context.collection.objects.unlink(obj)
    return obj


def cube(name, scale, location, mat, collection, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=2, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("AIW_ROUNDED_EDGES", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.name = f"MESH_{name}"
    obj.data.materials.append(mat)
    return move_to_collection(obj, collection)


def sphere(name, scale, location, mat, collection, segments=12, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.name = f"MESH_{name}"
    obj.data.materials.append(mat)
    return move_to_collection(obj, collection)


def cone(name, radius, depth, location, mat, collection, vertices=6, rotation=None, radius2=0.018):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius2, depth=depth, location=location, rotation=rotation or (0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"MESH_{name}"
    obj.data.materials.append(mat)
    return move_to_collection(obj, collection)


def join_parts(name, parts):
    if len(parts) == 1:
        parts[0].name = name
        parts[0].data.name = f"MESH_{name}"
        return parts[0]
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    parts[0].name = name
    parts[0].data.name = f"MESH_{name}"
    return parts[0]


def tag_part(obj, group_name):
    group = obj.vertex_groups.new(name=group_name)
    group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    return obj


def curved_tube(name, points, radius, mat, collection):
    curve = bpy.data.curves.new(f"CURVE_{name}", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 1
    curve.bevel_depth = radius
    curve.bevel_resolution = 1
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1)
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.name = name
    obj.data.name = f"MESH_{name}"
    return obj


def bind(obj, rig, bone="root"):
    obj.parent = rig
    modifier = obj.modifiers.new("AIW_SHARED_ARMATURE", "ARMATURE")
    modifier.object = rig
    group = obj.vertex_groups.new(name=bone)
    group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")


def bind_socks(obj, rig):
    obj.parent = rig
    modifier = obj.modifiers.new("AIW_SHARED_ARMATURE", "ARMATURE")
    modifier.object = rig
    left = obj.vertex_groups.new(name="upper_leg.L")
    right = obj.vertex_groups.new(name="upper_leg.R")
    left_indices = [vertex.index for vertex in obj.data.vertices if vertex.co.x >= 0]
    right_indices = [vertex.index for vertex in obj.data.vertices if vertex.co.x < 0]
    left.add(left_indices, 1.0, "REPLACE")
    right.add(right_indices, 1.0, "REPLACE")


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for blocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.armatures, bpy.data.actions, bpy.data.collections):
        for block in list(blocks):
            if block.users == 0:
                blocks.remove(block)


def make_collection(name):
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    return collection


def build_rig(collection):
    data = bpy.data.armatures.new("AIW_Biped_Rig_DATA")
    rig = bpy.data.objects.new("AIW_Biped_Rig", data)
    collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = [
        ("root", (0, 0, -0.78), (0, 0, -0.48), None),
        ("pelvis", (0, 0, -0.48), (0, 0, 0.72), "root"),
        ("spine", (0, 0, 0.72), (0, 0, 1.12), "pelvis"),
        ("chest", (0, 0, 1.12), (0, 0, 1.48), "spine"),
        ("neck", (0, 0, 1.48), (0, 0, 1.60), "chest"),
        ("head", (0, 0, 1.60), (0, 0, 1.98), "neck"),
        ("upper_arm.L", (0.37, 0, 1.40), (0.50, 0, 1.03), "chest"),
        ("lower_arm.L", (0.50, 0, 1.03), (0.55, 0, 0.66), "upper_arm.L"),
        ("hand.L", (0.55, 0, 0.66), (0.56, -0.02, 0.44), "lower_arm.L"),
        ("upper_arm.R", (-0.37, 0, 1.40), (-0.50, 0, 1.03), "chest"),
        ("lower_arm.R", (-0.50, 0, 1.03), (-0.55, 0, 0.66), "upper_arm.R"),
        ("hand.R", (-0.55, 0, 0.66), (-0.56, -0.02, 0.44), "lower_arm.R"),
        ("upper_leg.L", (0.20, 0, 0.60), (0.20, 0, -0.08), "pelvis"),
        ("lower_leg.L", (0.20, 0, -0.08), (0.20, 0, -0.68), "upper_leg.L"),
        ("foot.L", (0.20, 0, -0.68), (0.20, -0.25, -0.78), "lower_leg.L"),
        ("upper_leg.R", (-0.20, 0, 0.60), (-0.20, 0, -0.08), "pelvis"),
        ("lower_leg.R", (-0.20, 0, -0.08), (-0.20, 0, -0.68), "upper_leg.R"),
        ("foot.R", (-0.20, 0, -0.68), (-0.20, -0.25, -0.78), "lower_leg.R"),
        ("tail.01", (0, 0.18, 0.55), (0, 0.55, 0.38), "pelvis"),
        ("ear.L", (0.16, 0, 1.92), (0.20, 0, 2.20), "head"),
        ("ear.R", (-0.16, 0, 1.92), (-0.20, 0, 2.20), "head"),
    ]
    made = {}
    for name, head, tail, parent in bones:
        bone = data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        if parent:
            bone.parent = made[parent]
        made[name] = bone
    bpy.ops.object.mode_set(mode="OBJECT")
    rig["aiw_schema"] = "aiw.avatar/0.11"
    rig["primary_actions"] = ",".join(ACTIONS)
    return rig


def add_anchor(name, location, bone, rig, collection):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.12
    obj.location = location
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    collection.objects.link(obj)


def reset_pose(rig):
    for bone in rig.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0, 0, 0)
        bone.location = (0, 0, 0)


def key_pose(rig, frame, rotations, locations=None):
    for bone_name, rotation in rotations.items():
        bone = rig.pose.bones[bone_name]
        bone.rotation_euler = rotation
        bone.keyframe_insert("rotation_euler", frame=frame, group=bone_name)
    for bone_name, location in (locations or {}).items():
        bone = rig.pose.bones[bone_name]
        bone.location = location
        bone.keyframe_insert("location", frame=frame, group=bone_name)


def make_actions(rig):
    rig.animation_data_create()
    definitions = {
        "Idle": [
            (1, {"chest": (0, 0, -0.025), "upper_arm.L": (0, 0.02, 0), "upper_arm.R": (0, -0.02, 0)}),
            (16, {"chest": (0.025, 0, 0.025), "upper_arm.L": (0, -0.02, 0), "upper_arm.R": (0, 0.02, 0)}),
            (32, {"chest": (0, 0, -0.025), "upper_arm.L": (0, 0.02, 0), "upper_arm.R": (0, -0.02, 0)}),
        ],
        "Walk": [
            (1, {"upper_arm.L": (0.48, 0, 0), "upper_arm.R": (-0.48, 0, 0), "upper_leg.L": (-0.42, 0, 0), "upper_leg.R": (0.42, 0, 0), "chest": (0, 0, -0.05)}),
            (13, {"upper_arm.L": (-0.48, 0, 0), "upper_arm.R": (0.48, 0, 0), "upper_leg.L": (0.42, 0, 0), "upper_leg.R": (-0.42, 0, 0), "chest": (0, 0, 0.05)}),
            (25, {"upper_arm.L": (0.48, 0, 0), "upper_arm.R": (-0.48, 0, 0), "upper_leg.L": (-0.42, 0, 0), "upper_leg.R": (0.42, 0, 0), "chest": (0, 0, -0.05)}),
        ],
        "Run": [
            (1, {"upper_arm.L": (0.92, 0, 0), "upper_arm.R": (-0.92, 0, 0), "lower_arm.L": (-0.55, 0, 0), "lower_arm.R": (-0.55, 0, 0), "upper_leg.L": (-0.78, 0, 0), "upper_leg.R": (0.78, 0, 0), "chest": (0.18, 0, -0.08)}),
            (8, {"upper_arm.L": (-0.92, 0, 0), "upper_arm.R": (0.92, 0, 0), "lower_arm.L": (-0.55, 0, 0), "lower_arm.R": (-0.55, 0, 0), "upper_leg.L": (0.78, 0, 0), "upper_leg.R": (-0.78, 0, 0), "chest": (0.18, 0, 0.08)}),
            (15, {"upper_arm.L": (0.92, 0, 0), "upper_arm.R": (-0.92, 0, 0), "lower_arm.L": (-0.55, 0, 0), "lower_arm.R": (-0.55, 0, 0), "upper_leg.L": (-0.78, 0, 0), "upper_leg.R": (0.78, 0, 0), "chest": (0.18, 0, -0.08)}),
        ],
        "Work": [
            (1, {"upper_arm.L": (-0.78, -0.18, 0.18), "upper_arm.R": (-0.78, 0.18, -0.18), "lower_arm.L": (-1.0, 0, 0), "lower_arm.R": (-1.0, 0, 0), "head": (0.12, 0, 0)}),
            (12, {"upper_arm.L": (-0.72, -0.12, 0.12), "upper_arm.R": (-0.84, 0.24, -0.12), "lower_arm.L": (-0.88, 0, 0), "lower_arm.R": (-1.08, 0, 0), "head": (0.14, 0, 0)}),
            (24, {"upper_arm.L": (-0.78, -0.18, 0.18), "upper_arm.R": (-0.78, 0.18, -0.18), "lower_arm.L": (-1.0, 0, 0), "lower_arm.R": (-1.0, 0, 0), "head": (0.12, 0, 0)}),
        ],
        "Celebrate": [
            (1, {"upper_arm.L": (0, -0.2, -2.25), "upper_arm.R": (0, 0.2, 2.25), "lower_arm.L": (0, 0, -0.25), "lower_arm.R": (0, 0, 0.25), "chest": (-0.12, 0, 0)}),
            (10, {"upper_arm.L": (0, -0.28, -2.55), "upper_arm.R": (0, 0.28, 2.55), "lower_arm.L": (0, 0, 0.15), "lower_arm.R": (0, 0, -0.15), "chest": (-0.2, 0, 0)}),
            (20, {"upper_arm.L": (0, -0.2, -2.25), "upper_arm.R": (0, 0.2, 2.25), "lower_arm.L": (0, 0, -0.25), "lower_arm.R": (0, 0, 0.25), "chest": (-0.12, 0, 0)}),
        ],
        "Error": [
            (1, {"chest": (0.38, 0, 0), "head": (0.34, 0, 0.12), "upper_arm.L": (0.22, 0, 0.12), "upper_arm.R": (0.22, 0, -0.12)}),
            (16, {"chest": (0.48, 0, 0), "head": (0.48, 0, -0.12), "upper_arm.L": (0.30, 0, 0.18), "upper_arm.R": (0.30, 0, -0.18)}),
            (32, {"chest": (0.38, 0, 0), "head": (0.34, 0, 0.12), "upper_arm.L": (0.22, 0, 0.12), "upper_arm.R": (0.22, 0, -0.12)}),
        ],
        "Offline": [
            (1, {"chest": (0.52, 0, 0), "head": (0.58, 0, 0), "upper_arm.L": (0.38, 0, 0.10), "upper_arm.R": (0.38, 0, -0.10), "upper_leg.L": (-0.08, 0, 0), "upper_leg.R": (-0.08, 0, 0)}),
            (32, {"chest": (0.52, 0, 0), "head": (0.58, 0, 0), "upper_arm.L": (0.38, 0, 0.10), "upper_arm.R": (0.38, 0, -0.10), "upper_leg.L": (-0.08, 0, 0), "upper_leg.R": (-0.08, 0, 0)}),
        ],
    }
    for name, poses in definitions.items():
        reset_pose(rig)
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        action["aiw_shared_primary"] = True
        action["aiw_bones"] = ",".join(sorted({bone for _, rotations in poses for bone in rotations}))
        action["aiw_evidence_label"] = name
        action["aiw_evidence_frame"] = ACTION_EVIDENCE_FRAMES[name]
        rig.animation_data.action = action
        for frame, rotations in poses:
            key_pose(rig, frame, rotations)
        action.frame_start = poses[0][0]
        action.frame_end = poses[-1][0]
    rig.animation_data.action = None
    reset_pose(rig)


def joined_head(name, species, variant_index, location, mat, face_mats, collection):
    """Build one skinned head mesh with deterministic silhouette and face groups."""
    x, y, z = location
    silhouettes = {
        "human": [(0.30, 0.28, 0.31), (0.29, 0.27, 0.35), (0.34, 0.29, 0.29), (0.33, 0.29, 0.32)],
        "dog": [(0.33, 0.29, 0.30), (0.29, 0.27, 0.34), (0.35, 0.29, 0.31), (0.30, 0.28, 0.29)],
        "cat": [(0.31, 0.27, 0.30), (0.27, 0.25, 0.34), (0.36, 0.30, 0.34), (0.33, 0.29, 0.30)],
    }
    sx, sy, sz = silhouettes[species][variant_index]
    base = sphere(name, (sx, sy, sz), location, mat, collection, 12 + variant_index * 2, 8)
    parts = [base]

    if species == "human":
        if variant_index == 1:
            parts.append(cube(f"TMP_{name}_ANGULAR_JAW", (0.22, 0.22, 0.14), (x, y, z - 0.22), mat, collection, 0.025))
        elif variant_index == 2:
            parts.extend([
                sphere(f"TMP_{name}_SOFT_CHEEK_L", (0.12, 0.08, 0.12), (x + 0.22, y - 0.10, z - 0.10), mat, collection, 8, 5),
                sphere(f"TMP_{name}_SOFT_CHEEK_R", (0.12, 0.08, 0.12), (x - 0.22, y - 0.10, z - 0.10), mat, collection, 8, 5),
            ])
        elif variant_index == 3:
            parts.append(cube(f"TMP_{name}_SQUARE_JAW", (0.28, 0.24, 0.15), (x, y, z - 0.20), mat, collection, 0.018))
        eye_y = y - sy - 0.018
        eye_z = z + 0.075
        nose_y = y - sy - 0.045
        mouth_y = y - sy - 0.052
        eye_scale = (0.052, 0.026, 0.041)
        nose = cone(f"TMP_{name}_NOSE", 0.038, 0.10, (x, nose_y, z - 0.015), face_mats["nose"], collection, 5, (math.pi / 2, 0, 0), 0.012)
        mouth = cube(f"TMP_{name}_MOUTH", (0.085, 0.012, 0.014), (x, mouth_y, z - 0.125), face_mats["mouth"], collection, 0.008)
    elif species == "dog":
        muzzle_specs = [(0.22, 0.18, 0.14, -0.24), (0.17, 0.22, 0.12, -0.27), (0.20, 0.18, 0.13, -0.24), (0.23, 0.22, 0.13, -0.27)]
        mx, my, mz, muzzle_y = muzzle_specs[variant_index]
        parts.append(sphere(f"TMP_{name}_MUZZLE", (mx, my, mz), (x, y + muzzle_y, z - 0.08), mat, collection, 10, 6))
        if variant_index in (1, 2):
            ear_radius = 0.14 if variant_index == 1 else 0.15
            ear_depth = 0.44 if variant_index == 1 else 0.38
            parts.extend([
                cone(f"TMP_{name}_EAR_L", ear_radius, ear_depth, (x + 0.20, y, z + 0.34), mat, collection),
                cone(f"TMP_{name}_EAR_R", ear_radius, ear_depth, (x - 0.20, y, z + 0.34), mat, collection),
            ])
            if variant_index == 2:
                parts.extend([
                    cone(f"TMP_{name}_CHEEK_L", 0.10, 0.22, (x + 0.32, y, z - 0.05), mat, collection, 5, (0, 0, -0.35)),
                    cone(f"TMP_{name}_CHEEK_R", 0.10, 0.22, (x - 0.32, y, z - 0.05), mat, collection, 5, (0, 0, 0.35)),
                ])
        else:
            ear_z = z - 0.01 if variant_index == 3 else z + 0.03
            ear_height = 0.29 if variant_index == 3 else 0.24
            parts.extend([
                sphere(f"TMP_{name}_EAR_L", (0.105, 0.085, ear_height), (x + 0.29, y, ear_z), mat, collection, 8, 5),
                sphere(f"TMP_{name}_EAR_R", (0.105, 0.085, ear_height), (x - 0.29, y, ear_z), mat, collection, 8, 5),
            ])
        eye_y = y - sy - 0.016
        eye_z = z + 0.075
        nose_y = y + muzzle_y - my - 0.025
        mouth_y = nose_y - 0.01
        eye_scale = (0.052, 0.026, 0.044)
        nose = sphere(f"TMP_{name}_NOSE", (0.072, 0.036, 0.050), (x, nose_y, z - 0.055), face_mats["nose"], collection, 8, 5)
        mouth = cube(f"TMP_{name}_MOUTH", (0.075, 0.012, 0.012), (x, mouth_y, z - 0.145), face_mats["mouth"], collection, 0.006)
    else:
        ear_specs = [(0.14, 0.34), (0.15, 0.43), (0.17, 0.44), (0.13, 0.30)]
        ear_radius, ear_depth = ear_specs[variant_index]
        parts.extend([
            cone(f"TMP_{name}_EAR_L", ear_radius, ear_depth, (x + 0.19, y, z + 0.32), mat, collection),
            cone(f"TMP_{name}_EAR_R", ear_radius, ear_depth, (x - 0.19, y, z + 0.32), mat, collection),
            sphere(f"TMP_{name}_MUZZLE", (0.16, 0.14, 0.09), (x, y - 0.25, z - 0.09), mat, collection, 10, 6),
        ])
        if variant_index == 2:
            parts.extend([
                cone(f"TMP_{name}_RUFF_L", 0.12, 0.27, (x + 0.34, y, z - 0.07), mat, collection, 5, (0, 0, -0.45)),
                cone(f"TMP_{name}_RUFF_R", 0.12, 0.27, (x - 0.34, y, z - 0.07), mat, collection, 5, (0, 0, 0.45)),
            ])
        elif variant_index == 3:
            parts.extend([
                sphere(f"TMP_{name}_CHEEK_L", (0.13, 0.08, 0.11), (x + 0.24, y - 0.10, z - 0.08), mat, collection, 8, 5),
                sphere(f"TMP_{name}_CHEEK_R", (0.13, 0.08, 0.11), (x - 0.24, y - 0.10, z - 0.08), mat, collection, 8, 5),
            ])
        eye_y = y - sy - 0.018
        eye_z = z + 0.065
        nose_y = y - 0.405
        mouth_y = y - 0.410
        eye_scale = (0.058, 0.024, 0.040)
        nose = cone(f"TMP_{name}_NOSE", 0.047, 0.075, (x, nose_y, z - 0.065), face_mats["nose"], collection, 4, (math.pi / 2, 0, 0), 0.010)
        mouth = cube(f"TMP_{name}_MOUTH", (0.070, 0.010, 0.011), (x, mouth_y, z - 0.145), face_mats["mouth"], collection, 0.005)

    eyes = [
        tag_part(sphere(f"TMP_{name}_EYE_L", eye_scale, (x + 0.115, eye_y, eye_z), face_mats["eye"], collection, 8, 5), "FACE_EYE_L"),
        tag_part(sphere(f"TMP_{name}_EYE_R", eye_scale, (x - 0.115, eye_y, eye_z), face_mats["eye"], collection, 8, 5), "FACE_EYE_R"),
    ]
    tag_part(nose, "FACE_NOSE")
    tag_part(mouth, "FACE_MOUTH")
    parts.extend(eyes + [nose, mouth])
    head = join_parts(name, parts)
    head["aiw_face_features"] = "FACE_EYE_L,FACE_EYE_R,FACE_NOSE,FACE_MOUTH"
    head["aiw_silhouette_variant"] = HEADS[species][variant_index]
    return head


def make_hand(name, kind, side, x, neutral, claw, collection):
    parts = []
    if kind == "hands":
        parts.append(cube(name, (0.135, 0.10, 0.15), (x, -0.005, 0.45), neutral, collection, 0.045))
        direction = 1 if side == "L" else -1
        for index in range(3):
            parts.append(cube(f"TMP_{name}_FINGER_{index}", (0.035, 0.075, 0.10), (x + direction * (index - 1) * 0.055, -0.08, 0.38), neutral, collection, 0.018))
    else:
        parts.append(sphere(name, (0.17, 0.15, 0.14), (x, -0.02, 0.44), neutral, collection, 12, 7))
        direction = 1 if side == "L" else -1
        for index in range(3):
            toe_x = x + direction * (index - 1) * 0.075
            parts.append(sphere(f"TMP_{name}_TOE_{index}", (0.065, 0.10, 0.065), (toe_x, -0.13, 0.39), neutral, collection, 8, 5))
            if kind == "clawed-paws":
                parts.append(cone(f"TMP_{name}_CLAW_{index}", 0.025, 0.13, (toe_x, -0.225, 0.39), claw, collection, 5, (math.pi / 2, 0, 0), 0.004))
    return join_parts(name, parts)


def make_foot(name, kind, x, neutral, claw, collection):
    parts = []
    if kind == "feet":
        parts.append(cube(name, (0.16, 0.25, 0.115), (x, -0.15, -0.73), neutral, collection, 0.045))
        parts.append(cube(f"TMP_{name}_SOLE", (0.17, 0.27, 0.035), (x, -0.17, -0.82), neutral, collection, 0.018))
    else:
        parts.append(sphere(name, (0.19, 0.27, 0.13), (x, -0.15, -0.72), neutral, collection, 12, 7))
        for index in range(3):
            toe_x = x + (index - 1) * 0.075
            parts.append(sphere(f"TMP_{name}_TOE_{index}", (0.07, 0.13, 0.065), (toe_x, -0.35, -0.75), neutral, collection, 8, 5))
            if kind == "clawed-paws":
                parts.append(cone(f"TMP_{name}_CLAW_{index}", 0.027, 0.16, (toe_x, -0.47, -0.75), claw, collection, 5, (math.pi / 2, 0, 0), 0.004))
    return join_parts(name, parts)


def make_fur(name, mode, neutral, collection):
    if mode == "none":
        return cube(name, (0.018, 0.018, 0.018), (0, 0.08, 0.88), neutral, collection)
    parts = []
    length = 0.13 if mode == "short" else 0.25
    radius = 0.07 if mode == "short" else 0.105
    positions = [
        ((-0.49, 0, 1.28), (0, -math.pi / 2, 0)),
        ((0.49, 0, 1.28), (0, math.pi / 2, 0)),
        ((-0.40, 0, 1.02), (0, -math.pi / 2, 0)),
        ((0.40, 0, 1.02), (0, math.pi / 2, 0)),
        ((0, -0.24, 1.43), (0, 0, math.pi)),
    ]
    if mode == "long":
        positions += [
            ((-0.35, 0, 0.76), (0, -math.pi / 2, 0)),
            ((0.35, 0, 0.76), (0, math.pi / 2, 0)),
            ((0, -0.23, 0.78), (0, 0, math.pi)),
        ]
    for index, (position, rotation) in enumerate(positions):
        parts.append(cone(name if index == 0 else f"TMP_{name}_{index}", radius, length,
                          position, neutral, collection, 6, rotation, 0.012))
    return join_parts(name, parts)


def make_tail(name, mode, neutral, collection):
    if mode == "none":
        return cube(name, (0.018, 0.018, 0.018), (0, 0.18, 0.48), neutral, collection)
    if mode == "cat-straight":
        points = [(0, 0.18, 0.52), (0, 0.46, 0.54), (0, 0.78, 0.65), (0, 1.08, 0.83)]
        radius = 0.055
    elif mode == "dog-straight":
        points = [(0, 0.18, 0.52), (0, 0.43, 0.60), (0, 0.69, 0.72), (0, 0.88, 0.83)]
        radius = 0.075
    elif mode == "cat-curled":
        points = [(0, 0.18, 0.52), (0.10, 0.48, 0.62), (0.28, 0.70, 0.86), (0.43, 0.64, 1.12), (0.35, 0.42, 1.30), (0.17, 0.33, 1.18)]
        radius = 0.055
    else:
        points = [(0, 0.18, 0.52), (-0.12, 0.43, 0.68), (-0.32, 0.52, 0.92), (-0.40, 0.34, 1.10), (-0.25, 0.20, 1.02)]
        radius = 0.078
    return curved_tube(name, points, radius, neutral, collection)


def make_marking(name, mode, neutral, dark, collection):
    if mode == "solid":
        return cube(name, (0.016, 0.016, 0.016), (0, 0.10, 1.0), dark, collection)
    if mode == "muzzle":
        return sphere(name, (0.19, 0.035, 0.12), (0, -0.285, 1.73), dark, collection, 10, 6)
    if mode == "mask":
        left = sphere(name, (0.16, 0.028, 0.11), (0.14, -0.292, 1.87), dark, collection, 10, 6)
        right = sphere(f"TMP_{name}_R", (0.16, 0.028, 0.11), (-0.14, -0.292, 1.87), dark, collection, 10, 6)
        bridge = cube(f"TMP_{name}_BRIDGE", (0.12, 0.025, 0.04), (0, -0.292, 1.88), dark, collection, 0.015)
        return join_parts(name, [left, right, bridge])
    left = cube(name, (0.168, 0.185, 0.18), (0.20, -0.005, -0.55), dark, collection, 0.035)
    right = cube(f"TMP_{name}_R", (0.168, 0.185, 0.18), (-0.20, -0.005, -0.55), dark, collection, 0.035)
    return join_parts(name, [left, right])


def make_shirt(name, shirt_mat, label_mat, collection, rig):
    torso = cube(f"SHIRT_{name}", (0.43, 0.245, 0.32), (0, -0.006, 1.17), shirt_mat, collection, 0.035)
    left = cube(f"TMP_SHIRT_{name}_SLEEVE_L", (0.16, 0.25, 0.16), (0.48, -0.006, 1.30), shirt_mat, collection, 0.035)
    right = cube(f"TMP_SHIRT_{name}_SLEEVE_R", (0.16, 0.25, 0.16), (-0.48, -0.006, 1.30), shirt_mat, collection, 0.035)
    shirt = join_parts(f"SHIRT_{name}", [torso, left, right])
    shirt["aiw_attachment"] = "ATTACH_SHIRT"
    bind(shirt, rig, "chest")

    bpy.ops.object.text_add(location=(0, -0.268, 1.16), rotation=(math.pi / 2, 0, 0))
    label = bpy.context.object
    label.name = f"SHIRT_LABEL_{name}"
    label.data.body = name
    label.data.align_x = "CENTER"
    label.data.align_y = "CENTER"
    label.data.size = 0.20
    label.data.resolution_u = 1
    label.data.fill_mode = "FRONT"
    label.data.extrude = 0
    label.data.bevel_depth = 0
    label.data.materials.append(label_mat)
    bpy.ops.object.convert(target="MESH")
    move_to_collection(label, collection)
    max_width = 0.68
    if label.dimensions.x > max_width:
        ratio = max_width / label.dimensions.x
        label.scale *= ratio
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    label["aiw_label"] = name
    label["aiw_max_width"] = max_width
    bind(label, rig, "chest")


def triangulate_runtime_meshes(scene):
    """Triangulate and canonically order triangles without modifier warnings."""
    for obj in sorted((item for item in scene.objects if item.type == "MESH"), key=lambda item: item.name):
        mesh = obj.data
        group_weights = {
            group.name: [
                (vertex.index, assignment.weight)
                for vertex in mesh.vertices
                for assignment in vertex.groups
                if assignment.group == group.index
            ]
            for group in obj.vertex_groups
        }
        editable = bmesh.new()
        editable.from_mesh(mesh)
        bmesh.ops.triangulate(editable, faces=list(editable.faces), quad_method="FIXED", ngon_method="EAR_CLIP")
        editable.to_mesh(mesh)
        editable.free()
        mesh.update()
        vertices = [tuple(vertex.co) for vertex in mesh.vertices]
        faces = []
        for polygon in mesh.polygons:
            indices = list(polygon.vertices)
            rotations = [tuple(indices[index:] + indices[:index]) for index in range(len(indices))]
            faces.append((polygon.material_index, polygon.use_smooth, min(rotations)))
        faces.sort(key=lambda item: (item[0], item[2]))
        mesh_name = mesh.name
        canonical = bpy.data.meshes.new(mesh_name)
        canonical.from_pydata(vertices, [], [face[2] for face in faces])
        for mat in mesh.materials:
            canonical.materials.append(mat)
        for polygon, (material_index, use_smooth, _) in zip(canonical.polygons, faces):
            polygon.material_index = material_index
            polygon.use_smooth = use_smooth
        old_mesh = obj.data
        obj.data = canonical
        for group in list(obj.vertex_groups):
            obj.vertex_groups.remove(group)
        for group_name, weights in group_weights.items():
            group = obj.vertex_groups.new(name=group_name)
            for vertex_index, weight in weights:
                group.add([vertex_index], weight, "REPLACE")
        bpy.data.meshes.remove(old_mesh)
        canonical.name = mesh_name
        canonical.update()


def canonicalize_glb_indices(path):
    payload = bytearray(path.read_bytes())
    json_length, _ = struct.unpack_from("<II", payload, 12)
    document = json.loads(payload[20:20 + json_length])
    binary_offset = 20 + json_length + 8
    index_accessors = sorted({
        primitive["indices"]
        for mesh in document["meshes"]
        for primitive in mesh["primitives"]
        if "indices" in primitive
    })
    formats = {5121: "B", 5123: "H", 5125: "I"}
    for accessor_index in index_accessors:
        accessor = document["accessors"][accessor_index]
        view = document["bufferViews"][accessor["bufferView"]]
        count = accessor["count"]
        if count % 3:
            continue
        fmt = f"<{count}{formats[accessor['componentType']]}"
        offset = binary_offset + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        values = struct.unpack_from(fmt, payload, offset)
        triangles = []
        for index in range(0, count, 3):
            triangle = values[index:index + 3]
            triangles.append(min((triangle, triangle[1:] + triangle[:1], triangle[2:] + triangle[:2])))
        canonical = [value for triangle in sorted(triangles) for value in triangle]
        struct.pack_into(fmt, payload, offset, *canonical)
    path.write_bytes(payload)


def canonicalize_png_metadata(path):
    payload = path.read_bytes()
    output = bytearray(payload[:8])
    offset = 8
    while offset < len(payload):
        length = struct.unpack_from(">I", payload, offset)[0]
        chunk_end = offset + 12 + length
        kind = payload[offset + 4:offset + 8]
        data = payload[offset + 8:offset + 8 + length]
        if not (kind == b"tEXt" and data.split(b"\0", 1)[0] in {b"Date", b"File", b"RenderTime"}):
            output.extend(payload[offset:chunk_end])
        offset = chunk_end
    path.write_bytes(output)


def duplicate_evidence(source, evidence, name, offset, scale=1.0, material_override=None, rotation_z=0.0):
    copy = source.copy()
    copy.data = source.data.copy()
    copy.name = name
    copy.parent = None
    copy.animation_data_clear()
    for modifier in list(copy.modifiers):
        copy.modifiers.remove(modifier)
    evidence.objects.link(copy)
    copy.matrix_world = (
        Matrix.Translation(Vector(offset))
        @ Matrix.Rotation(rotation_z, 4, "Z")
        @ Matrix.Scale(scale, 4)
        @ source.matrix_world
    )
    if material_override and copy.type == "MESH":
        for index, existing in enumerate(copy.data.materials):
            if existing and existing.name != "MAT_CLAW" and not existing.name.startswith("MAT_FACE_"):
                copy.data.materials[index] = material_override
    copy.hide_render = False
    return copy


def evidence_text(collection, name, body, location, mat, size=0.22):
    bpy.ops.object.text_add(location=location, rotation=(math.pi / 2, 0, 0))
    label = bpy.context.object
    label.name = name
    label.data.body = body
    label.data.align_x = "CENTER"
    label.data.align_y = "CENTER"
    label.data.size = size
    label.data.resolution_u = 1
    label.data.fill_mode = "FRONT"
    label.data.extrude = 0
    label.data.bevel_depth = 0
    label.data.materials.append(mat)
    bpy.ops.object.convert(target="MESH")
    return move_to_collection(label, collection)


def evidence_center(obj):
    return sum((obj.matrix_world @ Vector(corner) for corner in obj.bound_box), Vector()) / 8


def center_evidence(obj, target):
    obj.location += Vector(target) - evidence_center(obj)
    return obj


def stage_avatar(evidence, prefix, spec, offset, scale, body_mat, rotation_z=0.0):
    species, head, shirt, hands, feet, fur, tail, marking = spec
    selected = CORE + [
        f"HEAD_{species}_{head}", f"HAND_{hands}_L", f"HAND_{hands}_R",
        f"FOOT_{feet}_L", f"FOOT_{feet}_R", f"FUR_{fur}", f"TAIL_{tail}",
        f"MARKING_{marking}", f"SHIRT_{shirt}", f"SHIRT_LABEL_{shirt}",
    ]
    for source_name in selected:
        source = bpy.data.objects[source_name]
        override = None if source_name.startswith("SHIRT") or source_name.startswith("MARKING") else body_mat
        duplicate_evidence(
            source, evidence, f"{prefix}_{source_name}", offset, scale, override, rotation_z,
        )


def begin_evidence_stage(scene, name):
    evidence = make_collection(name)
    hidden = []
    for obj in scene.objects:
        if obj.type in {"MESH", "ARMATURE", "EMPTY"}:
            hidden.append((obj, obj.hide_render))
            obj.hide_render = True
    return evidence, hidden


def finish_evidence_stage(evidence, hidden, extras):
    for obj in extras:
        bpy.data.objects.remove(obj, do_unlink=True)
    for obj in list(evidence.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(evidence)
    for obj, value in hidden:
        obj.hide_render = value


def configure_evidence_render(scene, output, resolution, ortho_scale, target_z=0.0):
    scene.render.resolution_x, scene.render.resolution_y = resolution
    bpy.ops.object.camera_add(location=(0, -22, target_z))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((0, 0, target_z)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale
    scene.camera = camera
    lights = []
    for location, energy, size in (((-5, -8, 8), 1600, 9), ((6, -6, 3), 1050, 8)):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.rotation_euler = (Vector((0, 0, target_z)) - light.location).to_track_quat("-Z", "Y").to_euler()
        lights.append(light)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    return [camera, *lights]


def render_contact_sheet(scene, body_mats, text_mats):
    evidence, hidden = begin_evidence_stage(scene, "AIW_CONTACT_SHEET_STAGE")
    white, accent = text_mats

    evidence_text(evidence, "EVIDENCE_TITLE", "AIW AVATAR KIT — APPEARANCE", (0, -0.75, 6.20), white, 0.34)
    evidence_text(evidence, "EVIDENCE_ASSEMBLED_HEADING", "FOUR COMPLETE ASSEMBLIES + FITTED BRANDED TEES", (0, -0.75, 5.72), accent, 0.19)

    avatar_specs = [
        (("human", "round", "Codex", "hands", "feet", "none", "none", "solid"), body_mats["warm-light"]),
        (("dog", "shepherd", "Claude", "paws", "paws", "short", "dog-curled", "muzzle"), body_mats["fur-gold"]),
        (("cat", "maine-coon", "Hermes", "clawed-paws", "clawed-paws", "long", "cat-curled", "mask"), body_mats["fur-charcoal"]),
        (("human", "square", "OpenClaw", "hands", "feet", "none", "none", "socks"), body_mats["fantasy-blue"]),
    ]
    avatar_x = (-5.10, -1.72, 1.72, 5.10)
    for column, (spec, body_mat) in enumerate(avatar_specs):
        stage_avatar(evidence, f"EVIDENCE_AVATAR_{column}", spec, (avatar_x[column], 0, 3.02), 0.92, body_mat)
        evidence_text(evidence, f"EVIDENCE_AVATAR_LABEL_{column}", f"{spec[0].upper()} • {spec[2]}", (avatar_x[column], -0.75, 1.96), white, 0.19)

    evidence_text(evidence, "EVIDENCE_HEADS_HEADING", "12 FACIAL + SILHOUETTE VARIANTS", (0, -0.75, 1.53), accent, 0.19)

    for row, (species, heads) in enumerate(HEADS.items()):
        for column, head in enumerate(heads):
            source = bpy.data.objects[f"HEAD_{species}_{head}"]
            center_z = 1.04 - row * 0.93
            copy = duplicate_evidence(
                source, evidence, f"EVIDENCE_HEAD_{species}_{head}", (0, 0, 0), 0.72,
                body_mats[list(body_mats)[row * 4 + column]],
            )
            center_evidence(copy, (-5.10 + column * 3.40, 0, center_z))
            evidence_text(
                evidence, f"EVIDENCE_HEAD_LABEL_{species}_{head}",
                f"{species.upper()} • {head.upper()}",
                (-5.10 + column * 3.40, -0.75, center_z - 0.39), white, 0.145,
            )

    evidence_text(evidence, "EVIDENCE_MODULES_HEADING", "MODULAR SILHOUETTES + TRUTHFUL LOCATIONS", (0, -0.75, -1.92), accent, 0.19)
    module_names = [
        ("HAND_hands_L", "HUMAN HAND"), ("HAND_paws_L", "ROUNDED PAW"),
        ("HAND_clawed-paws_L", "CLAWED PAW"), ("FOOT_feet_L", "HUMAN FOOT"),
        ("FOOT_paws_L", "PAW FOOT"), ("FOOT_clawed-paws_L", "CLAWED FOOT"),
    ]
    module_x = (-5.35, -3.20, -1.05, 1.05, 3.20, 5.35)
    for index, (source_name, label) in enumerate(module_names):
        source = bpy.data.objects[source_name]
        copy = duplicate_evidence(source, evidence, f"EVIDENCE_MODULE_{source_name}", (0, 0, 0), 1.15,
                                  rotation_z=-0.55)
        center_evidence(copy, (module_x[index], 0, -2.52))
        evidence_text(evidence, f"EVIDENCE_MODULE_LABEL_{index}", label, (module_x[index], -0.75, -2.94), white, 0.14)

    # Fur is shown on the same shared chest so silhouette length can be judged.
    for index, mode in enumerate(("none", "short", "long")):
        x = -5.15 + index * 1.90
        for source_name in ("CORE_MIDSECTION", "CORE_CHEST", f"FUR_{mode}"):
            duplicate_evidence(source=bpy.data.objects[source_name], evidence=evidence,
                               name=f"EVIDENCE_FUR_{mode}_{source_name}", offset=(x, 0, -5.00),
                               scale=0.70, material_override=body_mats["fur-gold"], rotation_z=0.42)
        evidence_text(evidence, f"EVIDENCE_FUR_LABEL_{mode}", f"FUR • {mode.upper()}", (x, -0.75, -3.58), white, 0.14)

    for index, mode in enumerate(("cat-straight", "cat-curled", "dog-straight", "dog-curled")):
        x = 0.25 + index * 1.78
        source = bpy.data.objects[f"TAIL_{mode}"]
        copy = duplicate_evidence(source, evidence, f"EVIDENCE_TAIL_{mode}", (0, 0, 0), 0.88,
                                  body_mats["fur-charcoal"], math.pi / 2)
        center_evidence(copy, (x, 0, -4.18))
        evidence_text(evidence, f"EVIDENCE_TAIL_LABEL_{mode}", mode.upper().replace("-", " • "),
                      (x, -0.75, -3.62), white, 0.125)

    # Markings are paired with their truthful anatomical hosts.
    marking_sources = {
        "solid": ["HEAD_cat_shorthair", "MARKING_solid"],
        "muzzle": ["HEAD_dog_labrador", "MARKING_muzzle"],
        "mask": ["HEAD_cat_bengal", "MARKING_mask"],
        "socks": ["CORE_LEG_L", "CORE_LEG_R", "FOOT_paws_L", "FOOT_paws_R", "MARKING_socks"],
    }
    for index, (mode, source_names) in enumerate(marking_sources.items()):
        x = -4.75 + index * 3.16
        copies = []
        for source_name in source_names:
            override = None if source_name.startswith("MARKING") else body_mats["fur-cream"]
            copies.append(duplicate_evidence(bpy.data.objects[source_name], evidence,
                                             f"EVIDENCE_MARKING_{mode}_{source_name}", (0, 0, 0), 0.72, override))
        group_center = sum((evidence_center(item) for item in copies), Vector()) / len(copies)
        for item in copies:
            item.location += Vector((x, 0, -5.48)) - group_center
        evidence_text(evidence, f"EVIDENCE_MARKING_LABEL_{mode}", f"MARKING • {mode.upper()}",
                      (x, -0.75, -6.02), white, 0.15)

    extras = configure_evidence_render(scene, SHEET, (1800, 1800), 13.2)
    finish_evidence_stage(evidence, hidden, extras)


def baked_pose_copy(source, evidence, name, offset, scale, rotation_z, material_override=None):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = source.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
    copy = bpy.data.objects.new(name, mesh)
    evidence.objects.link(copy)
    copy.matrix_world = (
        Matrix.Translation(Vector(offset)) @ Matrix.Rotation(rotation_z, 4, "Z")
        @ Matrix.Scale(scale, 4) @ source.matrix_world
    )
    if material_override:
        for index, existing in enumerate(copy.data.materials):
            if existing and existing.name != "MAT_CLAW" and not existing.name.startswith("MAT_FACE_"):
                copy.data.materials[index] = material_override
    return copy


def render_motion_sheet(scene, rig, body_mats, text_mats):
    evidence, hidden = begin_evidence_stage(scene, "AIW_MOTION_SHEET_STAGE")
    white, accent = text_mats
    evidence_text(evidence, "EVIDENCE_MOTION_TITLE", "ONE SHARED RIG — SEVEN READABLE ACTION POSES", (0, -0.75, 3.45), white, 0.32)
    evidence_text(evidence, "EVIDENCE_MOTION_SUBTITLE", "AIW_Biped_Rig • same core body • deterministic representative frames", (0, -0.75, 3.02), accent, 0.17)
    selected = CORE + ["HEAD_human_round", "HAND_hands_L", "HAND_hands_R", "FOOT_feet_L", "FOOT_feet_R", "FUR_none", "TAIL_none", "MARKING_solid", "SHIRT_Codex", "SHIRT_LABEL_Codex"]
    positions = [(-5.40, 1.35), (-1.80, 1.35), (1.80, 1.35), (5.40, 1.35), (-3.60, -1.80), (0, -1.80), (3.60, -1.80)]
    for index, action_name in enumerate(ACTIONS):
        action = bpy.data.actions[action_name]
        rig.animation_data.action = None
        reset_pose(rig)
        rig.animation_data.action = action
        scene.frame_set(ACTION_EVIDENCE_FRAMES[action_name])
        bpy.context.view_layer.update()
        x, z = positions[index]
        for source_name in selected:
            source = bpy.data.objects[source_name]
            override = None if source_name.startswith("SHIRT") or source_name.startswith("MARKING") else body_mats["warm-light"]
            baked_pose_copy(source, evidence, f"EVIDENCE_POSE_{action_name}_{source_name}",
                            (x, 0, z), 0.65, -0.42, override)
        evidence_text(evidence, f"EVIDENCE_POSE_LABEL_{action_name}",
                      f"{action_name.upper()} • FRAME {ACTION_EVIDENCE_FRAMES[action_name]}",
                      (x, -0.75, z - 0.98), white, 0.17)
    rig.animation_data.action = None
    reset_pose(rig)
    scene.frame_set(1)
    extras = configure_evidence_render(scene, MOTION_SHEET, (1800, 1000), 14.4)
    finish_evidence_stage(evidence, hidden, extras)


def build():
    clear()
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.film_transparent = False
    scene.world.color = (0.008, 0.014, 0.035)

    core_collection = make_collection("AIW_CORE_SHARED")
    rig_collection = make_collection("AIW_RIG_AND_ANCHORS")
    module_collection = make_collection("AIW_MODULAR_PARTS")
    shirt_collection = make_collection("AIW_SHIRTS")
    palette_collection = make_collection("AIW_PALETTE_FIXTURES")
    body_mats = {name: material(f"MAT_BODY_{name}", color) for name, color in COLORS.items()}
    neutral = body_mats["warm-light"]
    dark = material("MAT_MARKING_DARK", "202733")
    white = material("MAT_LABEL_WHITE", "FFFFFF")
    ink = material("MAT_LABEL_INK", "171717")
    claw = material("MAT_CLAW", "C98243")
    face_mats = {
        "eye": material("MAT_FACE_EYE", "111827"),
        "nose": material("MAT_FACE_NOSE", "171717"),
        "mouth": material("MAT_FACE_MOUTH", "7A263A"),
    }
    rig = build_rig(rig_collection)

    core_specs = {
        "CORE_MIDSECTION": ((0.35, 0.22, 0.37), (0, 0, 0.77), "pelvis"),
        "CORE_CHEST": ((0.44, 0.23, 0.37), (0, 0, 1.18), "chest"),
        "CORE_ARM_L": ((0.125, 0.145, 0.49), (0.48, 0, 1.01), "upper_arm.L"),
        "CORE_ARM_R": ((0.125, 0.145, 0.49), (-0.48, 0, 1.01), "upper_arm.R"),
        "CORE_LEG_L": ((0.17, 0.185, 0.64), (0.20, 0, -0.05), "upper_leg.L"),
        "CORE_LEG_R": ((0.17, 0.185, 0.64), (-0.20, 0, -0.05), "upper_leg.R"),
    }
    for name, (scale, location, bone) in core_specs.items():
        bind(cube(name, scale, location, neutral, core_collection, 0.045), rig, bone)

    anchor_specs = {
        "ATTACH_HEAD": ((0, 0, 0.18), "head"),
        "ATTACH_HAND_L": ((0, 0, 0), "hand.L"), "ATTACH_HAND_R": ((0, 0, 0), "hand.R"),
        "ATTACH_FOOT_L": ((0, 0, 0), "foot.L"), "ATTACH_FOOT_R": ((0, 0, 0), "foot.R"),
        "ATTACH_TAIL": ((0, 0, 0), "tail.01"), "ATTACH_SHIRT": ((0, -0.24, 0), "chest"),
        "ATTACH_NAMEPLATE": ((0, 0, 0.76), "head"),
    }
    for name, (location, bone) in anchor_specs.items():
        add_anchor(name, location, bone, rig, rig_collection)

    for species, heads in HEADS.items():
        for index, head in enumerate(heads):
            obj = joined_head(
                f"HEAD_{species}_{head}", species, index, (0, 0, 1.80), neutral,
                face_mats, module_collection,
            )
            obj["aiw_species"] = species
            obj["aiw_attachment"] = "ATTACH_HEAD"
            bind(obj, rig, "head")

    for kind in ("hands", "paws", "clawed-paws"):
        for side, bone, x in (("L", "hand.L", 0.56), ("R", "hand.R", -0.56)):
            hand = make_hand(f"HAND_{kind}_{side}", kind, side, x, neutral, claw, module_collection)
            hand["aiw_attachment"] = f"ATTACH_HAND_{side}"
            bind(hand, rig, bone)

    for kind in ("feet", "paws", "clawed-paws"):
        for side, bone, x in (("L", "foot.L", 0.20), ("R", "foot.R", -0.20)):
            foot = make_foot(f"FOOT_{kind}_{side}", kind, x, neutral, claw, module_collection)
            foot["aiw_attachment"] = f"ATTACH_FOOT_{side}"
            bind(foot, rig, bone)

    for mode in ("none", "short", "long"):
        fur = make_fur(f"FUR_{mode}", mode, neutral, module_collection)
        fur["aiw_surface_mode"] = mode
        bind(fur, rig, "spine")

    for mode in ("none", "cat-straight", "cat-curled", "dog-straight", "dog-curled"):
        tail = make_tail(f"TAIL_{mode}", mode, neutral, module_collection)
        tail["aiw_attachment"] = "ATTACH_TAIL"
        bind(tail, rig, "tail.01")

    for mode in ("solid", "muzzle", "mask", "socks"):
        marking = make_marking(f"MARKING_{mode}", mode, neutral, dark, module_collection)
        marking["aiw_marking_mode"] = mode
        if mode == "socks":
            bind_socks(marking, rig)
        else:
            bind(marking, rig, "head" if mode in {"muzzle", "mask"} else "spine")

    for name, code in SHIRTS.items():
        make_shirt(name, material(f"MAT_SHIRT_{name}", code), ink if name == "Hermes" else white, shirt_collection, rig)

    for index, (name, mat) in enumerate(body_mats.items()):
        swatch = sphere(f"COLOR_SWATCH_{name}", (0.04, 0.04, 0.04), (0, 0, -2), mat, palette_collection, 8 + index, 5)
        swatch["aiw_color_label"] = name

    make_actions(rig)
    triangulate_runtime_meshes(scene)
    scene["aiw_schema"] = "aiw.avatar/0.11"
    scene["aiw_license"] = "Project-owned / self-authored"
    scene["aiw_core_objects"] = ",".join(CORE)
    scene["aiw_appearance_evidence"] = SHEET.name
    scene["aiw_motion_evidence"] = MOTION_SHEET.name
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    GLB.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
    bpy.ops.export_scene.gltf(
        filepath=str(GLB), export_format="GLB", export_animations=True,
        export_force_sampling=False, export_texcoords=False, export_apply=True,
        export_cameras=False, export_lights=False,
    )
    canonicalize_glb_indices(GLB)
    render_contact_sheet(scene, body_mats, (white, material("MAT_EVIDENCE_ACCENT", "7DD3FC")))
    canonicalize_png_metadata(SHEET)
    render_motion_sheet(scene, rig, body_mats, (white, bpy.data.materials["MAT_EVIDENCE_ACCENT"]))
    canonicalize_png_metadata(MOTION_SHEET)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
    write_manifest()


def sha(path):
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def write_manifest():
    manifest = {
        "schema": "aiw.avatar-assets/0.11", "generator": "tooling/avatar/build_avatar_kit.py", "blender": "5.2.0 LTS",
        "license": "Project-owned / self-authored", "coreObjects": CORE, "armatures": ["AIW_Biped_Rig"], "attachments": ATTACHMENTS,
        "actions": ACTIONS, "heads": HEADS, "hands": ["hands", "paws", "clawed-paws"], "feet": ["feet", "paws", "clawed-paws"],
        "fur": ["none", "short", "long"], "tails": ["none", "cat-straight", "cat-curled", "dog-straight", "dog-curled"],
        "markings": ["solid", "muzzle", "mask", "socks"], "bodyColors": list(COLORS),
        "shirts": [{"name": name, "color": "#" + code, "label": name} for name, code in SHIRTS.items()],
        "evidenceBoards": [
            str(SHEET.relative_to(ROOT)), str(MOTION_SHEET.relative_to(ROOT)),
        ],
        "files": {
            str(path.relative_to(ROOT)): {"bytes": path.stat().st_size, "sha256": sha(path)}
            for path in (SOURCE, GLB, SHEET, MOTION_SHEET)
        },
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    build()
