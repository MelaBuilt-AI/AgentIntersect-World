"""Deterministically build the project-owned Phase 18.5 Luminous Codecraft kit."""
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
HERO_SHEET = ROOT / "apps/web/public/assets/avatar/aiw-avatar-hero-human-cat.png"
MULTIVIEW_SHEET = ROOT / "apps/web/public/assets/avatar/aiw-avatar-multiview.png"
FACIAL_SHEET = ROOT / "apps/web/public/assets/avatar/aiw-avatar-facial-speech.png"
GESTURE_SHEET = ROOT / "apps/web/public/assets/avatar/aiw-avatar-hand-gestures.png"
CONCEPT_SHEET = ROOT / "apps/web/public/assets/avatar/aiw-avatar-concept-comparison.png"
STYLE_SHEET = ROOT / "apps/web/public/assets/avatar/aiw-avatar-style-bible.png"
REPOSITORY_SHEET = ROOT / "apps/web/public/assets/avatar/aiw-repository-kit.png"
MANIFEST = ROOT / "assets/avatar/aiw-avatar-kit.manifest.json"
TEXTURE_DIR = ROOT / "apps/web/public/assets/avatar/textures"

CORE = ["CORE_MIDSECTION", "CORE_CHEST", "CORE_ARM_L", "CORE_ARM_R", "CORE_LEG_L", "CORE_LEG_R"]
SURFACE_DETAILS = [
    "PANEL_CHEST", "PANEL_HIPS", "PANEL_SHOULDER_L", "PANEL_SHOULDER_R",
    "PANEL_KNEE_L", "PANEL_KNEE_R", "CIRCUIT_SEAM_CHEST",
    "CIRCUIT_SEAM_ARM_L", "CIRCUIT_SEAM_ARM_R",
    "JOINT_COLLAR_NECK", "JOINT_COLLAR_WRIST_L", "JOINT_COLLAR_WRIST_R",
    "JOINT_COLLAR_HIP_L", "JOINT_COLLAR_HIP_R",
    "JOINT_COLLAR_ANKLE_L", "JOINT_COLLAR_ANKLE_R",
]
HEADS = {
    "human": ["round", "angular", "soft", "square"],
    "dog": ["labrador", "shepherd", "husky", "beagle"],
    "cat": ["shorthair", "siamese", "maine-coon", "bengal"],
}
ATTACHMENTS = ["ATTACH_HEAD", "ATTACH_HAND_L", "ATTACH_HAND_R", "ATTACH_FOOT_L", "ATTACH_FOOT_R", "ATTACH_TAIL", "ATTACH_SHIRT", "ATTACH_NAMEPLATE"]
ACTIONS = [
    "Idle", "Walk", "Run", "TurnLeft", "TurnRight", "StartWalk", "StopWalk",
    "Talk", "Listen", "Wave", "Point", "Explain", "Think", "Nod", "Shrug",
    "Work", "Celebrate", "Error", "Offline",
]
ACTION_EVIDENCE_FRAMES = {name: 10 for name in ACTIONS} | {
    "Idle": 16, "Walk": 1, "Run": 1, "StartWalk": 12, "StopWalk": 12,
    "Work": 12, "Celebrate": 10, "Error": 16, "Offline": 1,
}
EXPRESSIONS = [
    "Blink", "BrowUp", "BrowDown", "EyeWide", "EyeSquint", "Smile", "Frown",
    "JawOpen", "SpeechO", "SpeechE", "SpeechMBP",
]
ANATOMICAL_STATES = ["Neutral", "Listen", "Talk", "Celebrate", "Error"]
LODS = {
    "LOD0": {"distance": 8, "triangleBudget": 65000, "drawCallProxy": 18},
    "LOD1": {"distance": 18, "triangleBudget": 32000, "drawCallProxy": 12},
    "LOD2": {"distance": 10000, "triangleBudget": 12000, "drawCallProxy": 8},
}
COLORS = {
    "porcelain": "F2D6CB", "warm-light": "D9A07B", "golden": "B97845", "bronze": "8C5639",
    "umber": "5B3528", "deep": "321E1A", "fur-cream": "E8DCC4", "fur-gold": "C78B3B",
    "fur-brown": "70452F", "fur-charcoal": "30343B", "fantasy-blue": "3977A8", "fantasy-violet": "7257A8",
}
SHIRTS = {"Codex": "2563EB", "Claude": "EA580C", "Hermes": "FACC15", "OpenClaw": "DC2626"}
SHARED_TEXTURES = {}


def rgb(code: str):
    return tuple(int(code[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)


def material(name: str, code: str, metallic=0.0, textures=None, emissive=False):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgb(code)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgb(code)
    bsdf.inputs["Roughness"].default_value = 0.72
    bsdf.inputs["Metallic"].default_value = metallic
    textures = textures or SHARED_TEXTURES
    if textures:
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        base = nodes.new("ShaderNodeTexImage")
        base.name = "AIW_BASE_COLOR_ATLAS"
        base.image = textures["baseColor"]
        base.interpolation = "Linear"
        mix = nodes.new("ShaderNodeMixRGB")
        mix.blend_type = "MULTIPLY"
        mix.inputs[0].default_value = 1.0
        mix.inputs[2].default_value = rgb(code)
        links.new(base.outputs["Color"], mix.inputs[1])
        links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])
        orm = nodes.new("ShaderNodeTexImage")
        orm.name = "AIW_ORM_ATLAS"
        orm.image = textures["orm"]
        orm.image.colorspace_settings.name = "Non-Color"
        separate = nodes.new("ShaderNodeSeparateColor")
        links.new(orm.outputs["Color"], separate.inputs["Color"])
        links.new(separate.outputs["Red"], bsdf.inputs["Roughness"])
        links.new(separate.outputs["Green"], bsdf.inputs["Metallic"])
        normal = nodes.new("ShaderNodeTexImage")
        normal.name = "AIW_NORMAL_ATLAS"
        normal.image = textures["normal"]
        normal.image.colorspace_settings.name = "Non-Color"
        normal_map = nodes.new("ShaderNodeNormalMap")
        normal_map.inputs["Strength"].default_value = 0.18
        links.new(normal.outputs["Color"], normal_map.inputs["Color"])
        links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
        if emissive:
            emission = nodes.new("ShaderNodeTexImage")
            emission.name = "AIW_EMISSIVE_ATLAS"
            emission.image = textures["emissive"]
            links.new(emission.outputs["Color"], bsdf.inputs["Emission Color"])
            bsdf.inputs["Emission Strength"].default_value = 0.22
    return mat


def build_texture_atlases():
    """Create four small shared project-authored PBR maps without external inputs."""
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    specifications = {
        "baseColor": lambda x, y: (
            0.72 + 0.10 * ((x // 32 + y // 32) % 2),
            0.75 + 0.08 * ((x // 32 + y // 32) % 2),
            0.82 + 0.06 * ((x // 32 + y // 32) % 2),
            1.0,
        ),
        "orm": lambda x, y: (0.62 + 0.18 * (y / 255), 0.12, 1.0, 1.0),
        "normal": lambda x, y: (
            0.5 + 0.018 * math.sin(x * math.pi / 16),
            0.5 + 0.018 * math.sin(y * math.pi / 16),
            1.0,
            1.0,
        ),
        "emissive": lambda x, y: (
            0.04 if (x + y) % 64 else 0.12,
            0.32 if (x + y) % 64 else 0.72,
            0.55 if (x + y) % 64 else 1.0,
            1.0,
        ),
    }
    images = {}
    for role, pixel in specifications.items():
        image = bpy.data.images.new(f"AIW_{role}_atlas", width=256, height=256, alpha=True)
        image.generated_color = pixel(0, 0)
        image.pixels = [
            component
            for y in range(256)
            for x in range(256)
            for component in pixel(x, y)
        ]
        path = TEXTURE_DIR / f"aiw-avatar-{role}.png"
        image.filepath_raw = str(path)
        image.file_format = "PNG"
        image.save()
        canonicalize_png_metadata(path)
        image.pack()
        images[role] = image
    return images


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


def sphere(name, scale, location, mat, collection, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.name = f"MESH_{name}"
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return move_to_collection(obj, collection)


def cone(name, radius, depth, location, mat, collection, vertices=6, rotation=None, radius2=0.018):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius2, depth=depth, location=location, rotation=rotation or (0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"MESH_{name}"
    obj.data.materials.append(mat)
    return move_to_collection(obj, collection)


def cylinder(name, radius, depth, location, mat, collection, vertices=24, rotation=None):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=location,
        rotation=rotation or (0, 0, 0),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"MESH_{name}"
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return move_to_collection(obj, collection)


def torus(name, major_radius, minor_radius, location, mat, collection, rotation=None):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius, minor_radius=minor_radius,
        major_segments=32, minor_segments=12, location=location,
        rotation=rotation or (0, 0, 0),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"MESH_{name}"
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return move_to_collection(obj, collection)


def ico(name, radius, location, mat, collection, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=subdivisions, radius=radius, location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"MESH_{name}"
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
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
    curve.resolution_u = 3
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    curve.resolution_u = 3
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


def bind_grouped(obj, rig):
    obj.parent = rig
    modifier = obj.modifiers.new("AIW_SHARED_ARMATURE", "ARMATURE")
    modifier.object = rig


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
        ("spine", (0, 0, 0.72), (0, 0, 0.96), "pelvis"),
        ("spine.02", (0, 0, 0.96), (0, 0, 1.18), "spine"),
        ("chest", (0, 0, 1.18), (0, 0, 1.48), "spine.02"),
        ("neck", (0, 0, 1.48), (0, 0, 1.60), "chest"),
        ("head", (0, 0, 1.60), (0, 0, 1.98), "neck"),
        ("jaw", (0, -0.04, 1.76), (0, -0.16, 1.66), "head"),
        ("eye.L", (0.11, -0.12, 1.87), (0.11, -0.22, 1.87), "head"),
        ("eye.R", (-0.11, -0.12, 1.87), (-0.11, -0.22, 1.87), "head"),
        ("brow.L", (0.11, -0.12, 1.96), (0.11, -0.20, 1.98), "head"),
        ("brow.R", (-0.11, -0.12, 1.96), (-0.11, -0.20, 1.98), "head"),
        ("clavicle.L", (0.04, 0, 1.42), (0.37, 0, 1.40), "chest"),
        ("upper_arm.L", (0.37, 0, 1.40), (0.50, 0, 1.03), "clavicle.L"),
        ("lower_arm.L", (0.50, 0, 1.03), (0.55, 0, 0.66), "upper_arm.L"),
        ("hand.L", (0.55, 0, 0.66), (0.56, -0.02, 0.44), "lower_arm.L"),
        ("clavicle.R", (-0.04, 0, 1.42), (-0.37, 0, 1.40), "chest"),
        ("upper_arm.R", (-0.37, 0, 1.40), (-0.50, 0, 1.03), "clavicle.R"),
        ("lower_arm.R", (-0.50, 0, 1.03), (-0.55, 0, 0.66), "upper_arm.R"),
        ("hand.R", (-0.55, 0, 0.66), (-0.56, -0.02, 0.44), "lower_arm.R"),
        ("upper_leg.L", (0.20, 0, 0.60), (0.20, 0, -0.08), "pelvis"),
        ("lower_leg.L", (0.20, 0, -0.08), (0.20, 0, -0.68), "upper_leg.L"),
        ("foot.L", (0.20, 0, -0.68), (0.20, -0.25, -0.78), "lower_leg.L"),
        ("toe.L", (0.20, -0.25, -0.78), (0.20, -0.44, -0.78), "foot.L"),
        ("upper_leg.R", (-0.20, 0, 0.60), (-0.20, 0, -0.08), "pelvis"),
        ("lower_leg.R", (-0.20, 0, -0.08), (-0.20, 0, -0.68), "upper_leg.R"),
        ("foot.R", (-0.20, 0, -0.68), (-0.20, -0.25, -0.78), "lower_leg.R"),
        ("toe.R", (-0.20, -0.25, -0.78), (-0.20, -0.44, -0.78), "foot.R"),
        ("tail.01", (0, 0.18, 0.55), (0, 0.55, 0.38), "pelvis"),
    ]
    for side, sign in (("L", 1), ("R", -1)):
        hand_x = 0.56 * sign
        for finger_index, finger in enumerate(("thumb", "index", "middle", "ring", "pinky")):
            x = hand_x + sign * (finger_index - 2) * 0.025
            parent = f"hand.{side}"
            bones.append((f"finger_{finger}.01.{side}", (x, -0.02, 0.50), (x, -0.09, 0.44), parent))
            bones.append((f"finger_{finger}.02.{side}", (x, -0.09, 0.44), (x, -0.16, 0.40), f"finger_{finger}.01.{side}"))
    for index in range(2, 7):
        bones.append((
            f"tail.{index:02d}",
            (0, 0.18 + (index - 1) * 0.17, 0.55 - (index - 1) * 0.025),
            (0, 0.18 + index * 0.17, 0.55 - index * 0.025),
            f"tail.{index - 1:02d}",
        ))
    for side, sign in (("L", 1), ("R", -1)):
        parent = "head"
        for index in range(1, 4):
            name = f"ear.{side}.{index:02d}"
            bones.append((
                name,
                (0.16 * sign, 0, 1.90 + (index - 1) * 0.10),
                (0.18 * sign, 0, 2.00 + (index - 1) * 0.10),
                parent,
            ))
            parent = name
    made = {}
    for name, head, tail, parent in bones:
        bone = data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        if parent:
            bone.parent = made[parent]
        made[name] = bone
    bpy.ops.object.mode_set(mode="OBJECT")
    rig["aiw_schema"] = "aiw.avatar/0.18.5"
    rig["aiw_rig_contract"] = "shared-superset-biped/1"
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
    definitions.update({
        "TurnLeft": [
            (1, {"pelvis": (0, 0, 0), "chest": (0, 0, 0), "head": (0, 0, 0)}),
            (10, {"pelvis": (0, 0, 0.34), "chest": (0, 0, -0.18), "head": (0, 0, 0.22)}),
            (20, {"pelvis": (0, 0, 0.62), "chest": (0, 0, -0.24), "head": (0, 0, 0.30)}),
        ],
        "TurnRight": [
            (1, {"pelvis": (0, 0, 0), "chest": (0, 0, 0), "head": (0, 0, 0)}),
            (10, {"pelvis": (0, 0, -0.34), "chest": (0, 0, 0.18), "head": (0, 0, -0.22)}),
            (20, {"pelvis": (0, 0, -0.62), "chest": (0, 0, 0.24), "head": (0, 0, -0.30)}),
        ],
        "StartWalk": [
            (1, {"pelvis": (0.10, 0, 0), "upper_leg.L": (0, 0, 0), "upper_arm.R": (0, 0, 0)}),
            (12, {"pelvis": (-0.08, 0, 0.04), "upper_leg.L": (-0.34, 0, 0), "upper_arm.R": (0.38, 0, 0)}),
            (24, {"pelvis": (0, 0, 0), "upper_leg.L": (-0.42, 0, 0), "upper_arm.R": (0.48, 0, 0)}),
        ],
        "StopWalk": [
            (1, {"pelvis": (0, 0, 0), "upper_leg.R": (-0.42, 0, 0), "upper_arm.L": (0.48, 0, 0)}),
            (12, {"pelvis": (0.08, 0, -0.04), "upper_leg.R": (-0.20, 0, 0), "upper_arm.L": (0.22, 0, 0)}),
            (24, {"pelvis": (0, 0, 0), "upper_leg.R": (0, 0, 0), "upper_arm.L": (0, 0, 0)}),
        ],
        "Talk": [
            (1, {"jaw": (0.02, 0, 0), "brow.L": (0, 0, -0.03), "brow.R": (0, 0, 0.03), "chest": (0, 0, -0.02), "tail.03": (0, 0.06, 0)}),
            (10, {"jaw": (0.34, 0, 0), "brow.L": (0, 0, 0.08), "brow.R": (0, 0, -0.08), "chest": (-0.04, 0, 0.03), "tail.03": (0, -0.08, 0)}),
            (20, {"jaw": (0.05, 0, 0), "brow.L": (0, 0, -0.02), "brow.R": (0, 0, 0.02), "chest": (0, 0, -0.02), "tail.03": (0, 0.06, 0)}),
        ],
        "Listen": [
            (1, {"head": (0, 0, 0), "ear.L.02": (0, 0, 0), "ear.R.02": (0, 0, 0), "chest": (0, 0, 0)}),
            (10, {"head": (-0.08, 0, 0.12), "ear.L.02": (0.12, 0, 0.14), "ear.R.02": (-0.12, 0, -0.14), "chest": (-0.03, 0, 0.02)}),
            (20, {"head": (-0.08, 0, 0.12), "ear.L.02": (0.12, 0, 0.14), "ear.R.02": (-0.12, 0, -0.14), "chest": (-0.03, 0, 0.02)}),
        ],
        "Wave": [
            (1, {"upper_arm.L": (0, 0, -1.8), "lower_arm.L": (0, 0, -1.0), "hand.L": (0, 0, -0.2)}),
            (10, {"upper_arm.L": (0, 0, -2.1), "lower_arm.L": (0, 0, -1.1), "hand.L": (0, 0, 0.45)}),
            (20, {"upper_arm.L": (0, 0, -1.8), "lower_arm.L": (0, 0, -1.0), "hand.L": (0, 0, -0.45)}),
        ],
        "Point": [
            (1, {"upper_arm.L": (-0.2, 0, -1.2), "lower_arm.L": (0, 0, -0.28), "head": (0, 0, 0.14)}),
            (10, {"upper_arm.L": (-0.35, 0, -1.48), "lower_arm.L": (0, 0, -0.12), "head": (0, 0, 0.20)}),
            (20, {"upper_arm.L": (-0.35, 0, -1.48), "lower_arm.L": (0, 0, -0.12), "head": (0, 0, 0.20)}),
        ],
        "Explain": [
            (1, {"upper_arm.L": (-0.4, 0, -0.8), "upper_arm.R": (-0.4, 0, 0.8), "head": (0, 0, -0.12)}),
            (10, {"upper_arm.L": (-0.55, 0, -1.1), "upper_arm.R": (-0.25, 0, 0.6), "head": (0, 0, 0.12)}),
            (20, {"upper_arm.L": (-0.25, 0, -0.6), "upper_arm.R": (-0.55, 0, 1.1), "head": (0, 0, -0.12)}),
        ],
        "Think": [
            (1, {"upper_arm.R": (-0.9, 0, 0.5), "lower_arm.R": (-1.2, 0, 0), "head": (0.1, 0, -0.12)}),
            (10, {"upper_arm.R": (-1.0, 0, 0.55), "lower_arm.R": (-1.35, 0, 0), "head": (0.16, 0, -0.18)}),
            (20, {"upper_arm.R": (-0.9, 0, 0.5), "lower_arm.R": (-1.2, 0, 0), "head": (0.1, 0, -0.12)}),
        ],
        "Nod": [
            (1, {"head": (-0.12, 0, 0), "neck": (0.04, 0, 0), "chest": (0, 0, 0)}),
            (10, {"head": (0.28, 0, 0), "neck": (0.08, 0, 0), "chest": (0.02, 0, 0)}),
            (20, {"head": (-0.12, 0, 0), "neck": (0.04, 0, 0), "chest": (0, 0, 0)}),
        ],
        "Shrug": [
            (1, {"clavicle.L": (0, 0, 0), "clavicle.R": (0, 0, 0), "upper_arm.L": (0, 0, -0.2), "upper_arm.R": (0, 0, 0.2)}),
            (10, {"clavicle.L": (0, 0, -0.28), "clavicle.R": (0, 0, 0.28), "upper_arm.L": (0, 0, -0.65), "upper_arm.R": (0, 0, 0.65)}),
            (20, {"clavicle.L": (0, 0, 0), "clavicle.R": (0, 0, 0), "upper_arm.L": (0, 0, -0.2), "upper_arm.R": (0, 0, 0.2)}),
        ],
    })
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
    base = sphere(name, (sx, sy, sz), location, mat, collection, 32 + variant_index * 2, 20)
    parts = [base]

    if species == "human":
        if variant_index == 1:
            parts.append(cube(f"TMP_{name}_ANGULAR_JAW", (0.22, 0.22, 0.14), (x, y, z - 0.22), mat, collection, 0.025))
        elif variant_index == 2:
            parts.extend([
                sphere(f"TMP_{name}_SOFT_CHEEK_L", (0.12, 0.08, 0.12), (x + 0.22, y - 0.10, z - 0.10), mat, collection, 18, 12),
                sphere(f"TMP_{name}_SOFT_CHEEK_R", (0.12, 0.08, 0.12), (x - 0.22, y - 0.10, z - 0.10), mat, collection, 18, 12),
            ])
        elif variant_index == 3:
            parts.append(cube(f"TMP_{name}_SQUARE_JAW", (0.28, 0.24, 0.15), (x, y, z - 0.20), mat, collection, 0.018))
        eye_y = y - sy - 0.018
        eye_z = z + 0.075
        nose_y = y - sy - 0.045
        mouth_y = y - sy - 0.052
        eye_scale = (0.052, 0.026, 0.041)
        nose = cone(f"TMP_{name}_NOSE", 0.038, 0.10, (x, nose_y, z - 0.015), face_mats["nose"], collection, 5, (math.pi / 2, 0, 0), 0.012)
        mouth = sphere(f"TMP_{name}_MOUTH", (0.090, 0.016, 0.024), (x, mouth_y, z - 0.125), face_mats["mouth"], collection, 18, 10)
    elif species == "dog":
        muzzle_specs = [(0.22, 0.18, 0.14, -0.24), (0.17, 0.22, 0.12, -0.27), (0.20, 0.18, 0.13, -0.24), (0.23, 0.22, 0.13, -0.27)]
        mx, my, mz, muzzle_y = muzzle_specs[variant_index]
        parts.append(sphere(f"TMP_{name}_MUZZLE", (mx, my, mz), (x, y + muzzle_y, z - 0.08), mat, collection, 24, 16))
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
                sphere(f"TMP_{name}_EAR_L", (0.105, 0.085, ear_height), (x + 0.29, y, ear_z), mat, collection, 18, 12),
                sphere(f"TMP_{name}_EAR_R", (0.105, 0.085, ear_height), (x - 0.29, y, ear_z), mat, collection, 18, 12),
            ])
        eye_y = y - sy - 0.016
        eye_z = z + 0.075
        nose_y = y + muzzle_y - my - 0.025
        mouth_y = nose_y - 0.01
        eye_scale = (0.052, 0.026, 0.044)
        nose = sphere(f"TMP_{name}_NOSE", (0.072, 0.036, 0.050), (x, nose_y, z - 0.055), face_mats["nose"], collection, 18, 12)
        mouth = sphere(f"TMP_{name}_MOUTH", (0.090, 0.016, 0.024), (x, mouth_y, z - 0.145), face_mats["mouth"], collection, 18, 10)
    else:
        ear_specs = [(0.14, 0.34), (0.15, 0.43), (0.17, 0.44), (0.13, 0.30)]
        ear_radius, ear_depth = ear_specs[variant_index]
        parts.extend([
            cone(f"TMP_{name}_EAR_L", ear_radius, ear_depth, (x + 0.19, y, z + 0.32), mat, collection),
            cone(f"TMP_{name}_EAR_R", ear_radius, ear_depth, (x - 0.19, y, z + 0.32), mat, collection),
            sphere(f"TMP_{name}_MUZZLE", (0.16, 0.14, 0.09), (x, y - 0.25, z - 0.09), mat, collection, 24, 16),
        ])
        if variant_index == 2:
            parts.extend([
                cone(f"TMP_{name}_RUFF_L", 0.12, 0.27, (x + 0.34, y, z - 0.07), mat, collection, 5, (0, 0, -0.45)),
                cone(f"TMP_{name}_RUFF_R", 0.12, 0.27, (x - 0.34, y, z - 0.07), mat, collection, 5, (0, 0, 0.45)),
            ])
        elif variant_index == 3:
            parts.extend([
                sphere(f"TMP_{name}_CHEEK_L", (0.13, 0.08, 0.11), (x + 0.24, y - 0.10, z - 0.08), mat, collection, 18, 12),
                sphere(f"TMP_{name}_CHEEK_R", (0.13, 0.08, 0.11), (x - 0.24, y - 0.10, z - 0.08), mat, collection, 18, 12),
            ])
        eye_y = y - sy - 0.018
        eye_z = z + 0.065
        nose_y = y - 0.405
        mouth_y = y - 0.410
        eye_scale = (0.058, 0.024, 0.040)
        nose = cone(f"TMP_{name}_NOSE", 0.047, 0.075, (x, nose_y, z - 0.065), face_mats["nose"], collection, 4, (math.pi / 2, 0, 0), 0.010)
        mouth = sphere(f"TMP_{name}_MOUTH", (0.082, 0.014, 0.022), (x, mouth_y, z - 0.145), face_mats["mouth"], collection, 18, 10)

    eyes = [
        tag_part(sphere(f"TMP_{name}_EYE_L", eye_scale, (x + 0.115, eye_y, eye_z), face_mats["eye"], collection, 20, 12), "FACE_EYE_L"),
        tag_part(sphere(f"TMP_{name}_EYE_R", eye_scale, (x - 0.115, eye_y, eye_z), face_mats["eye"], collection, 20, 12), "FACE_EYE_R"),
    ]
    brows = [
        tag_part(sphere(f"TMP_{name}_BROW_L", (0.095, 0.018, 0.018), (x + 0.115, eye_y - 0.006, eye_z + 0.105), face_mats["brow"], collection, 16, 8), "FACE_BROW_L"),
        tag_part(sphere(f"TMP_{name}_BROW_R", (0.095, 0.018, 0.018), (x - 0.115, eye_y - 0.006, eye_z + 0.105), face_mats["brow"], collection, 16, 8), "FACE_BROW_R"),
    ]
    tag_part(nose, "FACE_NOSE")
    tag_part(mouth, "FACE_MOUTH")
    parts.extend(eyes + brows + [nose, mouth])
    head = join_parts(name, parts)
    head["aiw_face_features"] = "FACE_EYE_L,FACE_EYE_R,FACE_NOSE,FACE_MOUTH"
    head["aiw_silhouette_variant"] = HEADS[species][variant_index]
    add_expression_shapes(head)
    return head


def add_expression_shapes(head):
    """Attach one consistent practical facial/speech morph contract to a head."""
    basis = head.shape_key_add(name="Basis", from_mix=False)
    groups = {
        group.name: {
            vertex.index
            for vertex in head.data.vertices
            if any(item.group == group.index and item.weight > 0 for item in vertex.groups)
        }
        for group in head.vertex_groups
    }
    eye_vertices = groups.get("FACE_EYE_L", set()) | groups.get("FACE_EYE_R", set())
    mouth_vertices = groups.get("FACE_MOUTH", set())
    brow_vertices = groups.get("FACE_BROW_L", set()) | groups.get("FACE_BROW_R", set())
    eye_center_z = sum(basis.data[index].co.z for index in eye_vertices) / max(1, len(eye_vertices))
    mouth_center_x = sum(basis.data[index].co.x for index in mouth_vertices) / max(1, len(mouth_vertices))
    mouth_center_z = sum(basis.data[index].co.z for index in mouth_vertices) / max(1, len(mouth_vertices))
    for expression in EXPRESSIONS:
        key = head.shape_key_add(name=expression, from_mix=False)
        key.value = 0.0
        for index, vertex in enumerate(key.data):
            source = basis.data[index].co
            if expression == "Blink" and index in eye_vertices:
                vertex.co.z = eye_center_z + (source.z - eye_center_z) * 0.10
            elif expression == "EyeWide" and index in eye_vertices:
                vertex.co.z = eye_center_z + (source.z - eye_center_z) * 1.55
            elif expression == "EyeSquint" and index in eye_vertices:
                vertex.co.z = eye_center_z + (source.z - eye_center_z) * 0.38
            elif expression in {"BrowUp", "BrowDown"} and index in brow_vertices:
                vertex.co.z += 0.060 if expression == "BrowUp" else -0.050
            elif expression in {"Smile", "Frown"} and index in mouth_vertices:
                distance = abs(source.x - mouth_center_x)
                vertex.co.z += (0.055 if expression == "Smile" else -0.055) * min(1.0, distance / 0.06)
            elif expression in {"JawOpen", "SpeechO", "SpeechE", "SpeechMBP"} and index in mouth_vertices:
                if expression == "JawOpen":
                    vertex.co.z = mouth_center_z + (source.z - mouth_center_z) * 2.25 - 0.045
                elif expression == "SpeechO":
                    vertex.co.x = mouth_center_x + (source.x - mouth_center_x) * 0.55
                    vertex.co.z = mouth_center_z + (source.z - mouth_center_z) * 1.85 - 0.008
                elif expression == "SpeechE":
                    vertex.co.x = mouth_center_x + (source.x - mouth_center_x) * 1.42
                    vertex.co.z = mouth_center_z + (source.z - mouth_center_z) * 0.58
                else:
                    vertex.co.z = mouth_center_z + (source.z - mouth_center_z) * 0.16
    head["aiw_expression_contract"] = ",".join(EXPRESSIONS)


def make_hand(name, kind, side, x, neutral, claw, collection):
    parts = []
    if kind == "hands":
        parts.append(sphere(name, (0.135, 0.085, 0.115), (x, -0.005, 0.46), neutral, collection, 24, 16))
        direction = 1 if side == "L" else -1
        finger_names = ("thumb", "index", "middle", "ring", "pinky")
        for index, finger_name in enumerate(finger_names):
            lateral = direction * (index - 2) * 0.050
            length = (0.085, 0.115, 0.125, 0.112, 0.092)[index]
            first = sphere(
                f"TMP_{name}_FINGER_{finger_name}_A",
                (0.030, 0.038, length * 0.58),
                (x + lateral, -0.075, 0.355),
                neutral, collection, 14, 9,
            )
            second = sphere(
                f"TMP_{name}_FINGER_{finger_name}_B",
                (0.028, 0.034, length * 0.48),
                (x + lateral, -0.105, 0.265 - index * 0.004),
                neutral, collection, 14, 9,
            )
            tag_part(first, f"FINGER_{finger_name}")
            tag_part(second, f"FINGER_{finger_name}")
            parts.extend((first, second))
    else:
        parts.append(sphere(name, (0.19, 0.17, 0.15), (x, -0.02, 0.44), neutral, collection, 24, 16))
        direction = 1 if side == "L" else -1
        for index in range(4):
            toe_x = x + direction * (index - 1.5) * 0.060
            parts.append(sphere(f"TMP_{name}_TOE_{index}", (0.052, 0.105, 0.058), (toe_x, -0.14, 0.39), neutral, collection, 16, 10))
            if kind == "clawed-paws":
                parts.append(cone(f"TMP_{name}_CLAW_{index}", 0.025, 0.13, (toe_x, -0.225, 0.39), claw, collection, 5, (math.pi / 2, 0, 0), 0.004))
    return join_parts(name, parts)


def make_foot(name, kind, x, neutral, claw, collection):
    parts = []
    if kind == "feet":
        parts.append(sphere(name, (0.17, 0.27, 0.125), (x, -0.15, -0.73), neutral, collection, 26, 16))
        parts.append(sphere(f"TMP_{name}_SOLE", (0.18, 0.29, 0.040), (x, -0.17, -0.82), neutral, collection, 22, 12))
        for index in range(5):
            parts.append(sphere(
                f"TMP_{name}_TOE_{index}", (0.025, 0.055, 0.026),
                (x + (index - 2) * 0.048, -0.40, -0.73),
                neutral, collection, 12, 8,
            ))
    else:
        parts.append(sphere(name, (0.20, 0.29, 0.14), (x, -0.15, -0.72), neutral, collection, 26, 16))
        for index in range(4):
            toe_x = x + (index - 1.5) * 0.064
            parts.append(sphere(f"TMP_{name}_TOE_{index}", (0.058, 0.14, 0.068), (toe_x, -0.35, -0.75), neutral, collection, 16, 10))
            if kind == "clawed-paws":
                parts.append(cone(f"TMP_{name}_CLAW_{index}", 0.027, 0.16, (toe_x, -0.47, -0.75), claw, collection, 5, (math.pi / 2, 0, 0), 0.004))
    return join_parts(name, parts)


def make_lod2_body(species, neutral, graphite, collection, rig):
    """Author a genuinely lower-detail, still-rigged far-distance species mesh."""
    parts = []
    low_parts = [
        ("TORSO", (0.39, 0.23, 0.57), (0, 0, 1.01), "chest"),
        ("ARM_L", (0.13, 0.14, 0.49), (0.48, 0, 1.01), "upper_arm.L"),
        ("ARM_R", (0.13, 0.14, 0.49), (-0.48, 0, 1.01), "upper_arm.R"),
        ("LEG_L", (0.17, 0.18, 0.65), (0.20, 0, -0.05), "upper_leg.L"),
        ("LEG_R", (0.17, 0.18, 0.65), (-0.20, 0, -0.05), "upper_leg.R"),
        ("HAND_L", (0.13, 0.10, 0.15), (0.56, -0.01, 0.43), "hand.L"),
        ("HAND_R", (0.13, 0.10, 0.15), (-0.56, -0.01, 0.43), "hand.R"),
        ("FOOT_L", (0.17, 0.25, 0.11), (0.20, -0.15, -0.74), "foot.L"),
        ("FOOT_R", (0.17, 0.25, 0.11), (-0.20, -0.15, -0.74), "foot.R"),
    ]
    for suffix, scale, location, bone in low_parts:
        part = sphere(
            f"TMP_LOD2_{species}_{suffix}", scale, location, neutral,
            collection, 20 if suffix == "TORSO" else 16,
            12 if suffix == "TORSO" else 10,
        )
        tag_part(part, bone)
        parts.append(part)
    head_scale = {"human": (.31,.28,.32), "dog": (.34,.30,.31), "cat": (.32,.28,.31)}[species]
    head = sphere(f"TMP_LOD2_{species}_HEAD", head_scale, (0,0,1.80), neutral, collection, 18, 11)
    tag_part(head, "head")
    parts.append(head)
    if species == "human":
        nose = cone(f"TMP_LOD2_{species}_NOSE", .04, .10, (0,-.31,1.79), graphite, collection, 8, (math.pi/2,0,0), .01)
        tag_part(nose, "head")
        parts.append(nose)
    elif species == "dog":
        muzzle = sphere(f"TMP_LOD2_{species}_MUZZLE", (.20,.17,.12), (0,-.25,1.70), neutral, collection, 14, 9)
        tag_part(muzzle, "head")
        parts.append(muzzle)
        for side, sign in (("L",1),("R",-1)):
            ear = sphere(f"TMP_LOD2_{species}_EAR_{side}", (.10,.08,.23), (.28*sign,0,1.88), neutral, collection, 12, 8)
            tag_part(ear, "head")
            parts.append(ear)
    else:
        muzzle = sphere(f"TMP_LOD2_{species}_MUZZLE", (.16,.13,.09), (0,-.25,1.70), neutral, collection, 14, 9)
        tag_part(muzzle, "head")
        parts.append(muzzle)
        for side, sign in (("L",1),("R",-1)):
            ear = cone(f"TMP_LOD2_{species}_EAR_{side}", .13, .34, (.19*sign,0,2.11), neutral, collection, 12)
            tag_part(ear, "head")
            parts.append(ear)
    body = join_parts(f"LOD2_BODY_{species}", parts)
    body["aiw_lod"] = "LOD2"
    body["aiw_species"] = species
    bind_grouped(body, rig)
    return body


def make_lod2_shirt(name, shirt_mat, collection, rig):
    shirt = sphere(
        f"LOD2_SHIRT_{name}", (.42,.245,.31), (0,-.01,1.18),
        shirt_mat, collection, 24, 14,
    )
    shirt["aiw_lod"] = "LOD2"
    bind(shirt, rig, "chest")
    return shirt


def make_fur(name, mode, neutral, collection):
    if mode == "none":
        return cube(name, (0.018, 0.018, 0.018), (0, 0.08, 0.88), neutral, collection)
    parts = []
    parts.append(sphere(name, (0.455 if mode == "short" else 0.49, 0.25, 0.39),
                        (0, 0.018, 1.10), neutral, collection, 24, 16))
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
        for side, sign in (("L", 1), ("R", -1)):
            parts.append(sphere(
                f"TMP_{name}_RUFF_{side}", (.16,.13,.22),
                (.49*sign, .015, 1.34), neutral, collection, 18, 12,
            ))
            parts.append(sphere(
                f"TMP_{name}_ANKLE_RUFF_{side}", (.19,.16,.13),
                (.20*sign, .005, -.58), neutral, collection, 18, 12,
            ))
    for index, (position, rotation) in enumerate(positions):
        parts.append(cone(f"TMP_{name}_{index}", radius, length,
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
    torso = sphere(f"SHIRT_{name}", (0.435, 0.255, 0.33), (0, -0.006, 1.17), shirt_mat, collection, 30, 18)
    left = sphere(f"TMP_SHIRT_{name}_SLEEVE_L", (0.17, 0.255, 0.17), (0.48, -0.006, 1.30), shirt_mat, collection, 22, 14)
    right = sphere(f"TMP_SHIRT_{name}_SLEEVE_R", (0.17, 0.255, 0.17), (-0.48, -0.006, 1.30), shirt_mat, collection, 22, 14)
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
    """Triangulate and canonically order meshes while retaining rig, UV, and morph data."""
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
        shape_keys = []
        if mesh.shape_keys:
            for key in mesh.shape_keys.key_blocks:
                shape_keys.append({
                    "name": key.name,
                    "coords": [tuple(point.co) for point in key.data],
                    "value": key.value,
                    "slider_min": key.slider_min,
                    "slider_max": key.slider_max,
                    "relative": key.relative_key.name if key.relative_key else None,
                })
        uv_layer = mesh.uv_layers.active
        faces = []
        for polygon in mesh.polygons:
            indices = list(polygon.vertices)
            uvs = [
                tuple(round(float(value), 5) for value in uv_layer.data[loop_index].uv)
                if uv_layer
                else None
                for loop_index in polygon.loop_indices
            ]
            rotations = [
                (
                    tuple(indices[index:] + indices[:index]),
                    tuple(uvs[index:] + uvs[:index]),
                )
                for index in range(len(indices))
            ]
            canonical_indices, canonical_uvs = min(rotations, key=lambda item: item[0])
            faces.append(
                (
                    polygon.material_index,
                    polygon.use_smooth,
                    canonical_indices,
                    canonical_uvs,
                )
            )
        faces.sort(key=lambda item: (item[0], item[2]))
        mesh_name = mesh.name
        canonical = bpy.data.meshes.new(mesh_name)
        canonical.from_pydata(vertices, [], [face[2] for face in faces])
        for mat in mesh.materials:
            canonical.materials.append(mat)
        if uv_layer:
            canonical_uv = canonical.uv_layers.new(name=uv_layer.name)
            for polygon, face in zip(canonical.polygons, faces):
                for loop_index, uv in zip(polygon.loop_indices, face[3]):
                    canonical_uv.data[loop_index].uv = uv
        for polygon, (material_index, use_smooth, _, _) in zip(canonical.polygons, faces):
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
        restored = {}
        for key_data in shape_keys:
            key = obj.shape_key_add(name=key_data["name"], from_mix=False)
            for point, coords in zip(key.data, key_data["coords"]):
                point.co = coords
            key.value = key_data["value"]
            key.slider_min = key_data["slider_min"]
            key.slider_max = key_data["slider_max"]
            restored[key.name] = key
        for key_data in shape_keys:
            relative_name = key_data["relative"]
            if relative_name and key_data["name"] in restored and relative_name in restored:
                restored[key_data["name"]].relative_key = restored[relative_name]
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
    uv_accessors = sorted({
        primitive["attributes"]["TEXCOORD_0"]
        for mesh in document["meshes"]
        for primitive in mesh["primitives"]
        if "TEXCOORD_0" in primitive.get("attributes", {})
    })
    for accessor_index in uv_accessors:
        accessor = document["accessors"][accessor_index]
        view = document["bufferViews"][accessor["bufferView"]]
        count = accessor["count"] * 2
        offset = binary_offset + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        values = struct.unpack_from(f"<{count}f", payload, offset)
        struct.pack_into(f"<{count}f", payload, offset, *(round(value, 4) for value in values))
    path.write_bytes(payload)


def preserve_glb_material_identity(path):
    """Write deterministic glTF factors that multiply the shared texture roles.

    Blender's generic multiply-node graph preserves the shared atlas but its
    exporter otherwise drops the authored per-material tint and emits implicit
    white. The GLB is authoritative, so make that identity explicit in its
    standards-defined PBR factors before canonical geometry processing.
    """
    payload = path.read_bytes()
    _, version, _ = struct.unpack_from("<4sII", payload, 0)
    json_length, json_type = struct.unpack_from("<II", payload, 12)
    document = json.loads(payload[20:20 + json_length])
    chunks = []
    offset = 20 + json_length
    while offset < len(payload):
        chunk_length, chunk_type = struct.unpack_from("<II", payload, offset)
        start = offset + 8
        chunks.append((chunk_type, payload[start:start + chunk_length]))
        offset = start + chunk_length

    fixed_codes = {
        "MAT_MARKING_DARK": "202733",
        "MAT_LABEL_WHITE": "FFFFFF",
        "MAT_LABEL_INK": "171717",
        "MAT_CLAW": "C98243",
        "MAT_FACE_EYE": "111827",
        "MAT_FACE_NOSE": "171717",
        "MAT_FACE_MOUTH": "7A263A",
        "MAT_FACE_BROW": "4B2F29",
        "MAT_GRAPHITE_PANEL": "111827",
        "MAT_MIDNIGHT_PANEL": "07101F",
        "MAT_CIRCUIT_EMISSIVE": "38BDF8",
        "MAT_CIRCUIT_VIOLET": "8B5CF6",
    }
    material_codes = {
        **{f"MAT_BODY_{name}": code for name, code in COLORS.items()},
        **{f"MAT_SHIRT_{name}": code for name, code in SHIRTS.items()},
        **fixed_codes,
    }
    for item in document.get("materials", []):
        code = material_codes.get(item.get("name"))
        if not code:
            continue
        factor = [round(value, 6) for value in rgb(code)]
        item.setdefault("pbrMetallicRoughness", {})["baseColorFactor"] = factor
        item.setdefault("extras", {})["aiwColorIdentity"] = f"#{code}"
        if item["name"].startswith("MAT_CIRCUIT_"):
            item["emissiveFactor"] = factor[:3]

    encoded = json.dumps(
        document, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    encoded += b" " * ((4 - len(encoded) % 4) % 4)
    output_chunks = [(json_type, encoded), *chunks]
    total = 12 + sum(8 + len(data) for _, data in output_chunks)
    output = bytearray(struct.pack("<4sII", b"glTF", version, total))
    for chunk_type, data in output_chunks:
        output.extend(struct.pack("<II", len(data), chunk_type))
        output.extend(data)
    path.write_bytes(output)


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


def reshape_evidence_group(evidence, prefix, center, scale):
    transform = (
        Matrix.Translation(Vector(center))
        @ Matrix.Diagonal((*scale, 1.0))
        @ Matrix.Translation(-Vector(center))
    )
    for obj in evidence.objects:
        if obj.name.startswith(prefix):
            obj.matrix_world = transform @ obj.matrix_world


def stage_avatar(evidence, prefix, spec, offset, scale, body_mat, rotation_z=0.0):
    species, head, shirt, hands, feet, fur, tail, marking = spec
    selected = CORE + SURFACE_DETAILS + [
        f"HEAD_{species}_{head}", f"HAND_{hands}_L", f"HAND_{hands}_R",
        f"FOOT_{feet}_L", f"FOOT_{feet}_R", f"FUR_{fur}", f"TAIL_{tail}",
        f"MARKING_{marking}", f"SHIRT_{shirt}", f"SHIRT_LABEL_{shirt}",
    ]
    for source_name in selected:
        source = bpy.data.objects[source_name]
        override = (
            None
            if source_name.startswith(("SHIRT", "MARKING", "PANEL_", "CIRCUIT_"))
            else body_mat
        )
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


def make_repository_evidence_object(kind, name, location, scale, mats, collection):
    """Build the same authored silhouette vocabulary used by the R3F kit."""
    x, y, z = location
    primary, secondary, emissive = mats
    parts = []
    if kind == "package":
        parts = [
            cylinder(name, 0.46 * scale, 0.32 * scale, (x, y, z), primary, collection, 32),
            torus(f"TMP_{name}_RING", 0.48 * scale, 0.055 * scale, (x, y, z + 0.18 * scale), emissive, collection),
            cylinder(f"TMP_{name}_CORE", 0.18 * scale, 0.52 * scale, (x, y, z + 0.15 * scale), secondary, collection, 24),
        ]
    elif kind == "directory":
        parts = [
            torus(name, 0.40 * scale, 0.085 * scale, (x, y, z + 0.18 * scale), primary, collection, (math.pi / 2, 0, 0)),
            cube(f"TMP_{name}_L", (0.07*scale, 0.10*scale, 0.32*scale), (x - 0.40 * scale, y, z - 0.10 * scale), secondary, collection, 0.05 * scale),
            cube(f"TMP_{name}_R", (0.07*scale, 0.10*scale, 0.32*scale), (x + 0.40 * scale, y, z - 0.10 * scale), secondary, collection, 0.05 * scale),
        ]
    elif kind == "source":
        parts = [
            cube(name, (0.52 * scale, 0.20 * scale, 0.12 * scale), (x, y, z), primary, collection, 0.07 * scale),
            curved_tube(f"TMP_{name}_CODE1", [(x - .30*scale, y-.22*scale, z+.05*scale), (x+.15*scale, y-.22*scale, z+.05*scale)], .022*scale, emissive, collection),
            curved_tube(f"TMP_{name}_CODE2", [(x - .20*scale, y-.22*scale, z-.04*scale), (x+.31*scale, y-.22*scale, z-.04*scale)], .018*scale, emissive, collection),
        ]
    elif kind == "test":
        parts = [
            cone(name, 0.38 * scale, 0.70 * scale, (x, y, z), primary, collection, 24, None, 0.10 * scale),
            sphere(f"TMP_{name}_LIGHT", (0.15*scale, 0.15*scale, 0.15*scale), (x, y, z + 0.44 * scale), emissive, collection, 20, 12),
            torus(f"TMP_{name}_BASE", 0.35 * scale, 0.045 * scale, (x, y, z - 0.35 * scale), secondary, collection),
        ]
    elif kind == "document":
        parts = [
            cube(name, (0.42 * scale, 0.16 * scale, 0.42 * scale), (x, y, z), primary, collection, 0.05 * scale),
            cube(f"TMP_{name}_PAGES", (0.32 * scale, 0.18 * scale, 0.34 * scale), (x + .05*scale, y-.02*scale, z), secondary, collection, 0.03 * scale),
            curved_tube(f"TMP_{name}_SPINE", [(x-.40*scale,y-.19*scale,z-.30*scale),(x-.40*scale,y-.19*scale,z+.30*scale)], .035*scale, emissive, collection),
        ]
    elif kind == "config":
        parts = [
            cube(name, (0.50 * scale, 0.16 * scale, 0.33 * scale), (x, y, z), primary, collection, 0.08 * scale),
            cube(f"TMP_{name}_SCREEN", (0.39 * scale, 0.025 * scale, 0.22 * scale), (x, y-.18*scale, z+.02*scale), secondary, collection, 0.025 * scale),
            curved_tube(f"TMP_{name}_PROMPT", [(x-.24*scale,y-.21*scale,z+.03*scale),(x+.18*scale,y-.21*scale,z+.03*scale)], .022*scale, emissive, collection),
        ]
    elif kind == "data":
        parts = [
            cylinder(name, 0.40 * scale, 0.64 * scale, (x, y, z), primary, collection, 32),
            torus(f"TMP_{name}_TOP", 0.39 * scale, 0.045 * scale, (x, y, z + .32*scale), emissive, collection),
            torus(f"TMP_{name}_MID", 0.39 * scale, 0.035 * scale, (x, y, z), secondary, collection),
        ]
    elif kind == "binary":
        parts = [
            cube(name, (0.42 * scale, 0.38 * scale, 0.42 * scale), (x, y, z), primary, collection, 0.06 * scale),
            curved_tube(f"TMP_{name}_BRACE1", [(x-.34*scale,y-.42*scale,z-.34*scale),(x+.34*scale,y-.42*scale,z+.34*scale)], .035*scale, secondary, collection),
            curved_tube(f"TMP_{name}_BRACE2", [(x+.34*scale,y-.42*scale,z-.34*scale),(x-.34*scale,y-.42*scale,z+.34*scale)], .035*scale, emissive, collection),
        ]
    elif kind == "symbol":
        parts = [
            ico(name, 0.43 * scale, (x, y, z), primary, collection, 3),
            torus(f"TMP_{name}_ORBIT", 0.56 * scale, 0.025 * scale, (x, y, z), emissive, collection, (math.pi / 2, 0, 0)),
        ]
    elif kind == "bridge":
        parts = [
            curved_tube(name, [(x-.58*scale,y,z),(x,y-.10*scale,z+.24*scale),(x+.58*scale,y,z)], .055*scale, emissive, collection),
            ico(f"TMP_{name}_A", .10*scale, (x-.60*scale,y,z), secondary, collection, 2),
            ico(f"TMP_{name}_B", .10*scale, (x+.60*scale,y,z), secondary, collection, 2),
        ]
    else:
        parts = [
            ico(name, .38*scale, (x, y, z), primary, collection, 2),
            torus(f"TMP_{name}_HALO", .47*scale, .035*scale, (x,y,z), emissive, collection, (math.pi/2,0,0)),
        ]
    result = join_parts(name, parts)
    result.rotation_euler.x = 0.18
    result.rotation_euler.z = -0.42
    return result


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
    evidence_text(evidence, "EVIDENCE_MOTION_TITLE", "ONE SHARED 60-BONE RIG — 19 SEMANTIC ACTIONS", (0, -0.75, 5.80), white, 0.32)
    evidence_text(evidence, "EVIDENCE_MOTION_SUBTITLE", "LUMINOUS CODECRAFT • reusable primary set • deterministic representative frames", (0, -0.75, 5.38), accent, 0.17)
    selected = CORE + ["HEAD_human_round", "HAND_hands_L", "HAND_hands_R", "FOOT_feet_L", "FOOT_feet_R", "FUR_none", "TAIL_none", "MARKING_solid", "SHIRT_Codex", "SHIRT_LABEL_Codex"]
    positions = [
        (-6.0 + column * 3.0, 4.20 - row * 2.65)
        for row in range(4)
        for column in range(5)
    ]
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
                            (x, 0, z), 0.48, -0.42, override)
        evidence_text(evidence, f"EVIDENCE_POSE_LABEL_{action_name}",
                      f"{action_name.upper()} • FRAME {ACTION_EVIDENCE_FRAMES[action_name]}",
                      (x, -0.75, z - 0.76), white, 0.125)
    rig.animation_data.action = None
    reset_pose(rig)
    scene.frame_set(1)
    extras = configure_evidence_render(scene, MOTION_SHEET, (2200, 1600), 15.8, target_z=0.5)
    finish_evidence_stage(evidence, hidden, extras)


def render_hero_sheet(scene, body_mats, text_mats):
    evidence, hidden = begin_evidence_stage(scene, "AIW_HERO_SHEET_STAGE")
    white, accent = text_mats
    evidence_text(evidence, "EVIDENCE_HERO_TITLE", "HUMAN + CAT HERO GATE", (0, -0.75, 3.65), white, 0.34)
    evidence_text(
        evidence,
        "EVIDENCE_HERO_SUBTITLE",
        "ONE SMOOTH MODULAR CONTRACT • COMPLETE ASSEMBLIES • LUMINOUS CODECRAFT",
        (0, -0.75, 3.20),
        accent,
        0.17,
    )
    heroes = [
        (
            "HUMAN",
            ("human", "round", "Codex", "hands", "feet", "none", "none", "solid"),
            (-1.80, 0, 0.35),
            body_mats["warm-light"],
        ),
        (
            "CAT",
            ("cat", "maine-coon", "Hermes", "clawed-paws", "clawed-paws", "long", "cat-curled", "mask"),
            (1.80, 0, 0.35),
            body_mats["fur-charcoal"],
        ),
    ]
    for label, spec, offset, body_mat in heroes:
        stage_avatar(evidence, f"EVIDENCE_HERO_{label}", spec, offset, 1.18, body_mat)
        evidence_text(
            evidence,
            f"EVIDENCE_HERO_LABEL_{label}",
            f"{label} • COMPLETE MODULAR ASSEMBLY",
            (offset[0], -0.75, -1.04),
            white,
            0.17,
        )
    extras = configure_evidence_render(scene, HERO_SHEET, (1400, 1000), 7.7, target_z=1.15)
    finish_evidence_stage(evidence, hidden, extras)


def render_multiview_sheet(scene, body_mats, text_mats):
    evidence, hidden = begin_evidence_stage(scene, "AIW_MULTIVIEW_SHEET_STAGE")
    white, accent = text_mats
    evidence_text(evidence, "EVIDENCE_MULTIVIEW_TITLE", "AVATAR TURNAROUND", (0, -0.75, 3.72), white, 0.34)
    evidence_text(
        evidence,
        "EVIDENCE_MULTIVIEW_SUBTITLE",
        "FRONT • THREE-QUARTER • SIDE • BACK",
        (0, -0.75, 3.28),
        accent,
        0.19,
    )
    spec = ("human", "round", "Codex", "hands", "feet", "none", "none", "solid")
    for index, (label, rotation) in enumerate(
        (("FRONT", 0.0), ("THREE-QUARTER", -math.pi / 4), ("SIDE", -math.pi / 2), ("BACK", math.pi))
    ):
        x = -5.40 + index * 3.60
        stage_avatar(
            evidence,
            f"EVIDENCE_MULTIVIEW_{label}",
            spec,
            (x, 0, 0.30),
            0.92,
            body_mats["warm-light"],
            rotation,
        )
        evidence_text(
            evidence,
            f"EVIDENCE_MULTIVIEW_LABEL_{index}",
            label,
            (x, -0.75, -0.82),
            white,
            0.18,
        )
    extras = configure_evidence_render(scene, MULTIVIEW_SHEET, (1800, 1000), 13.2, target_z=1.20)
    finish_evidence_stage(evidence, hidden, extras)


def render_facial_sheet(scene, body_mats, text_mats):
    evidence, hidden = begin_evidence_stage(scene, "AIW_FACIAL_SHEET_STAGE")
    white, accent = text_mats
    evidence_text(evidence, "EVIDENCE_FACIAL_TITLE", "FACIAL + SPEECH CONTRACT", (0, -0.75, 4.00), white, 0.32)
    evidence_text(
        evidence,
        "EVIDENCE_FACIAL_SUBTITLE",
        "11 CONSISTENT MORPH TARGETS • VERIFIED ON ALL 12 HEADS",
        (0, -0.75, 3.58),
        accent,
        0.17,
    )
    positions = [
        (-4.65 + column * 3.10, 2.50 - row * 2.25)
        for row in range(3)
        for column in range(4)
    ]
    for index, expression in enumerate(EXPRESSIONS):
        source = bpy.data.objects["HEAD_human_round"]
        copy = duplicate_evidence(
            source,
            evidence,
            f"EVIDENCE_EXPRESSION_{expression}",
            (0, 0, 0),
            2.10,
            body_mats["warm-light"],
        )
        key = copy.data.shape_keys.key_blocks.get(expression) if copy.data.shape_keys else None
        if key:
            key.value = 1.0
        x, z = positions[index]
        center_evidence(copy, (x, 0, z))
        evidence_text(
            evidence,
            f"EVIDENCE_EXPRESSION_LABEL_{expression}",
            expression.upper(),
            (x, -0.75, z - 0.78),
            white,
            0.17,
        )
    evidence_text(
        evidence, "EVIDENCE_FACIAL_GUIDE",
        "IDENTICAL CAMERA + MATERIAL + LIGHTING • DEFORMATION ONLY",
        (0, -0.75, -2.52), accent, 0.15,
    )
    extras = configure_evidence_render(scene, FACIAL_SHEET, (2200, 1500), 12.5, target_z=0.65)
    finish_evidence_stage(evidence, hidden, extras)


def pose_hand_copy(source, evidence, name, center, scale, pose, mat):
    copy = duplicate_evidence(source, evidence, name, (0, 0, 0), scale, mat)
    groups = {
        group.name: group.index
        for group in copy.vertex_groups
        if group.name.startswith("FINGER_")
    }
    order = {"thumb": -2, "index": -1, "middle": 0, "ring": 1, "pinky": 2}
    finger_vertices = {}
    for group_name, group_index in groups.items():
        finger = group_name.removeprefix("FINGER_")
        finger_vertices[finger] = [
            vertex
            for vertex in copy.data.vertices
            if any(member.group == group_index and member.weight > 0 for member in vertex.groups)
        ]
    finger_indices = {vertex.index for vertices in finger_vertices.values() for vertex in vertices}
    palm_vertices = [vertex for vertex in copy.data.vertices if vertex.index not in finger_indices]
    palm_center = sum((vertex.co for vertex in palm_vertices), Vector()) / len(palm_vertices)
    for finger, vertices in finger_vertices.items():
        source_center = sum((vertex.co for vertex in vertices), Vector()) / len(vertices)
        target = source_center.copy()
        compress = 1.0
        if pose == "fist" or (pose == "point" and finger != "index"):
            target = palm_center + Vector((
                (order[finger] * .044), -0.115,
                -0.005 - abs(order[finger]) * 0.008,
            ))
            compress = 0.62
        elif pose == "pinch-typing":
            if finger == "thumb":
                target = palm_center + Vector((-0.040, -0.125, -0.080))
            elif finger == "index":
                target = palm_center + Vector((0.040, -0.125, -0.080))
            else:
                target = palm_center + Vector((order[finger] * .042, -0.110, -0.015))
                compress = 0.70
        elif pose == "expressive-spread":
            target.x += order[finger] * 0.050
            target.z -= abs(order[finger]) * 0.025
        for vertex in vertices:
            local = vertex.co - source_center
            local.z *= compress
            vertex.co = target + local
    center_evidence(copy, center)
    return copy


def render_gesture_sheet(scene, rig, body_mats, text_mats):
    evidence, hidden = begin_evidence_stage(scene, "AIW_GESTURE_SHEET_STAGE")
    white, accent = text_mats
    evidence_text(evidence, "EVIDENCE_GESTURE_TITLE", "ARTICULATED HANDS + GESTURES", (0, -0.75, 5.10), white, 0.32)
    evidence_text(
        evidence,
        "EVIDENCE_GESTURE_SUBTITLE",
        "WAVE • POINT • EXPLAIN • WORK • CELEBRATE",
        (0, -0.75, 4.66),
        accent,
        0.18,
    )
    for index, pose in enumerate(("open", "fist", "point", "pinch-typing", "expressive-spread")):
        x = -5.10 + index * 2.55
        pose_hand_copy(
            bpy.data.objects["HAND_hands_L"], evidence,
            f"EVIDENCE_HAND_CLOSEUP_{pose}", (x, 0, 3.30), 3.0,
            pose, body_mats["warm-light"],
        )
        evidence_text(
            evidence, f"EVIDENCE_HAND_CLOSEUP_LABEL_{pose}",
            pose.upper().replace("-", " / "), (x, -0.75, 2.33),
            accent, 0.16,
        )
    evidence_text(
        evidence, "EVIDENCE_GESTURE_ROW_LABEL",
        "FULL-BODY SEMANTIC GESTURES", (0, -0.75, 1.74), white, 0.19,
    )
    selected = CORE + SURFACE_DETAILS + [
        "HEAD_human_round", "HAND_hands_L", "HAND_hands_R", "FOOT_feet_L",
        "FOOT_feet_R", "FUR_none", "TAIL_none", "MARKING_solid",
        "SHIRT_Codex", "SHIRT_LABEL_Codex",
    ]
    for index, action_name in enumerate(("Wave", "Point", "Explain", "Work", "Celebrate")):
        rig.animation_data.action = None
        reset_pose(rig)
        rig.animation_data.action = bpy.data.actions[action_name]
        scene.frame_set(ACTION_EVIDENCE_FRAMES[action_name])
        bpy.context.view_layer.update()
        x = -5.0 + index * 2.5
        for source_name in selected:
            source = bpy.data.objects[source_name]
            override = None if source_name.startswith(("SHIRT", "MARKING")) else body_mats["warm-light"]
            baked_pose_copy(
                source,
                evidence,
                f"EVIDENCE_GESTURE_{action_name}_{source_name}",
                (x, 0, -0.25),
                0.60,
                -0.25,
                override,
            )
        evidence_text(
            evidence,
            f"EVIDENCE_GESTURE_LABEL_{action_name}",
            action_name.upper(),
            (x, -0.75, -1.18),
            white,
            0.16,
        )
    rig.animation_data.action = None
    reset_pose(rig)
    scene.frame_set(1)
    extras = configure_evidence_render(scene, GESTURE_SHEET, (2200, 1500), 13.5, target_z=1.55)
    finish_evidence_stage(evidence, hidden, extras)


def render_concept_sheet(scene, body_mats, text_mats):
    evidence, hidden = begin_evidence_stage(scene, "AIW_CONCEPT_SHEET_STAGE")
    white, accent = text_mats
    evidence_text(evidence, "EVIDENCE_CONCEPT_TITLE", "THREE ORIGINAL VISUAL DIRECTIONS", (0, -0.75, 5.00), white, 0.34)
    evidence_text(
        evidence, "EVIDENCE_CONCEPT_SUBTITLE",
        "ACTUAL SELF-AUTHORED FORMS • CHARACTER + FACE + COSTUME + REPOSITORY MOTIF",
        (0, -0.75, 4.55), accent, 0.16,
    )
    graphite = bpy.data.materials["MAT_GRAPHITE_PANEL"]
    circuit = bpy.data.materials["MAT_CIRCUIT_EMISSIVE"]
    concepts = [
        (
            "SIGNAL ATELIER", "82 / 100 • CERAMIC / AMBER / ARCHITECTURAL",
            body_mats["porcelain"], body_mats["golden"],
            ("human", "soft", "Claude", "hands", "feet", "none", "none", "solid"),
            ("cat", "siamese", "Claude", "paws", "paws", "short", "cat-straight", "muzzle"),
            "document",
        ),
        (
            "LUMINOUS CODECRAFT — SELECTED", "94 / 100 • GRAPHITE / WARM / CYAN + VIOLET",
            body_mats["warm-light"], body_mats["fur-charcoal"],
            ("human", "round", "Codex", "hands", "feet", "none", "none", "solid"),
            ("cat", "maine-coon", "Hermes", "clawed-paws", "clawed-paws", "long", "cat-curled", "mask"),
            "package",
        ),
        (
            "SOFT CIRCUIT FOUNDRY", "85 / 100 • POLYMER / BOLD / FABRICATION",
            body_mats["fantasy-blue"], body_mats["fantasy-violet"],
            ("human", "square", "OpenClaw", "hands", "feet", "none", "none", "socks"),
            ("cat", "bengal", "OpenClaw", "paws", "paws", "short", "cat-curled", "mask"),
            "config",
        ),
    ]
    for index, (title, score, human_mat, cat_mat, human, cat, motif) in enumerate(concepts):
        x = -4.75 + index * 4.75
        stage_avatar(evidence, f"EVIDENCE_CONCEPT_{index}_HUMAN", human, (x-.82, 0, 1.65), .82, human_mat)
        stage_avatar(evidence, f"EVIDENCE_CONCEPT_{index}_CAT", cat, (x+.82, 0, 1.65), .82, cat_mat)
        concept_scale = ((.84, .88, 1.12), (1.0, 1.0, 1.0), (1.13, 1.05, .88))[index]
        reshape_evidence_group(
            evidence, f"EVIDENCE_CONCEPT_{index}_HUMAN",
            (x-.82, 0, 1.65), concept_scale,
        )
        reshape_evidence_group(
            evidence, f"EVIDENCE_CONCEPT_{index}_CAT",
            (x+.82, 0, 1.65), concept_scale,
        )
        make_repository_evidence_object(
            motif, f"EVIDENCE_CONCEPT_{index}_MOTIF", (x, 0, -.65), .95,
            (human_mat, graphite, circuit), evidence,
        )
        evidence_text(evidence, f"EVIDENCE_CONCEPT_NAME_{index}", title, (x, -.75, 3.70), white, .17)
        evidence_text(evidence, f"EVIDENCE_CONCEPT_SCORE_{index}", score, (x, -.75, -1.45), accent, .135)
        evidence_text(
            evidence, f"EVIDENCE_CONCEPT_FACE_{index}",
            "EXPRESSIVE EYES • READABLE EARS / HANDS", (x, -.75, -1.83), white, .115,
        )
    extras = configure_evidence_render(scene, CONCEPT_SHEET, (2400, 1400), 15.2, target_z=1.40)
    finish_evidence_stage(evidence, hidden, extras)


def render_style_sheet(scene, body_mats, text_mats):
    evidence, hidden = begin_evidence_stage(scene, "AIW_STYLE_SHEET_STAGE")
    white, accent = text_mats
    evidence_text(evidence, "EVIDENCE_STYLE_TITLE", "LUMINOUS CODECRAFT — STYLE BIBLE", (0, -.75, 5.15), white, .34)
    evidence_text(
        evidence, "EVIDENCE_STYLE_SUBTITLE",
        "APPROACHABLE • CLEVER • TACTILE • SMOOTH REAL-TIME FORMS",
        (0, -.75, 4.70), accent, .17,
    )
    human = ("human", "round", "Codex", "hands", "feet", "none", "none", "solid")
    cat = ("cat", "maine-coon", "Hermes", "clawed-paws", "clawed-paws", "long", "cat-curled", "mask")
    stage_avatar(evidence, "EVIDENCE_STYLE_HUMAN", human, (-5.05, 0, 1.45), .88, body_mats["warm-light"])
    stage_avatar(evidence, "EVIDENCE_STYLE_CAT", cat, (-3.25, 0, 1.45), .88, body_mats["fur-charcoal"])
    evidence_text(evidence, "EVIDENCE_STYLE_PROPORTION", "PROPORTION + SPECIES SILHOUETTE", (-4.15, -.75, 3.62), white, .15)

    for index, (head_name, expression, label, mat) in enumerate((
        ("HEAD_human_round", "Smile", "HUMAN / SMILE", body_mats["warm-light"]),
        ("HEAD_cat_maine-coon", "EyeWide", "CAT / LISTEN", body_mats["fur-charcoal"]),
    )):
        copy = duplicate_evidence(bpy.data.objects[head_name], evidence, f"EVIDENCE_STYLE_FACE_{index}", (0,0,0), 1.65, mat)
        key = copy.data.shape_keys.key_blocks.get(expression) if copy.data.shape_keys else None
        if key:
            key.value = 1
        center_evidence(copy, ((-.75 + index * 1.75), 0, 2.70))
        evidence_text(evidence, f"EVIDENCE_STYLE_FACE_LABEL_{index}", label, (-.75 + index*1.75, -.75, 2.00), white, .12)
    evidence_text(evidence, "EVIDENCE_STYLE_FACE_TITLE", "FACE VOCABULARY", (.12, -.75, 3.62), white, .15)

    modules = [
        ("HAND_hands_L", "FINGERS"), ("HAND_paws_L", "PAW"),
        ("HAND_clawed-paws_L", "CLAW"),
    ]
    for index, (source_name, label) in enumerate(modules):
        copy = duplicate_evidence(bpy.data.objects[source_name], evidence, f"EVIDENCE_STYLE_MODULE_{index}", (0,0,0), 2.25, body_mats["warm-light"])
        center_evidence(copy, (3.15 + index*1.20, 0, 2.62))
        evidence_text(evidence, f"EVIDENCE_STYLE_MODULE_LABEL_{index}", label, (3.15+index*1.20,-.75,1.90), white, .12)
    evidence_text(evidence, "EVIDENCE_STYLE_MODULE_TITLE", "HANDS + PAWS", (4.35,-.75,3.62), white, .15)

    surface_mats = [
        (bpy.data.materials["MAT_GRAPHITE_PANEL"], "GRAPHITE MATTE"),
        (body_mats["warm-light"], "WARM SKIN"),
        (body_mats["fur-gold"], "WARM FUR"),
        (bpy.data.materials["MAT_CIRCUIT_EMISSIVE"], "CYAN CIRCUIT"),
        (bpy.data.materials["MAT_CIRCUIT_VIOLET"], "VIOLET CIRCUIT"),
    ]
    for index, (mat, label) in enumerate(surface_mats):
        x = -5.25 + index * 1.65
        sphere(f"EVIDENCE_STYLE_SURFACE_{index}", (.34,.34,.34), (x,0,-.45), mat, evidence, 28, 18)
        evidence_text(evidence, f"EVIDENCE_STYLE_SURFACE_LABEL_{index}", label, (x,-.75,-1.02), white, .10)
    evidence_text(evidence, "EVIDENCE_STYLE_SURFACE_TITLE", "PBR SURFACES + RESTRAINED EMISSIVE", (-1.95,-.75,.25), accent, .14)

    for index, (kind, label) in enumerate((("package","HUB"),("source","CODE SLAB"),("config","TERMINAL"))):
        x = 2.30 + index*1.75
        make_repository_evidence_object(
            kind, f"EVIDENCE_STYLE_REPO_{index}", (x,0,-.45), .72,
            (body_mats["fantasy-violet"], bpy.data.materials["MAT_GRAPHITE_PANEL"], bpy.data.materials["MAT_CIRCUIT_EMISSIVE"]), evidence,
        )
        evidence_text(evidence, f"EVIDENCE_STYLE_REPO_LABEL_{index}", label, (x,-.75,-1.02), white, .11)
    evidence_text(evidence, "EVIDENCE_STYLE_REPO_TITLE", "SEMANTIC MACHINE-WORLD MOTIFS", (4.05,-.75,.25), accent, .14)
    evidence_text(
        evidence, "EVIDENCE_STYLE_ACCENTS",
        "CLOTHING = TRUTHFUL HARNESS COLOR • TERMINAL LABELS = CONSOLAS",
        (0,-.75,-1.88), white, .14,
    )
    extras = configure_evidence_render(scene, STYLE_SHEET, (2400, 1500), 14.4, target_z=1.50)
    finish_evidence_stage(evidence, hidden, extras)


def render_repository_sheet(scene, body_mats, text_mats):
    evidence, hidden = begin_evidence_stage(scene, "AIW_REPOSITORY_SHEET_STAGE")
    white, accent = text_mats
    evidence_text(evidence, "EVIDENCE_REPO_TITLE", "SEMANTIC REPOSITORY KIT — ACTUAL GEOMETRY", (0,-.75,5.15), white, .34)
    evidence_text(
        evidence, "EVIDENCE_REPO_SUBTITLE",
        "DISTINCT SILHOUETTES • SHARED MATERIALS • TRUTHFUL SNAPSHOT METADATA ONLY",
        (0,-.75,4.70), accent, .16,
    )
    families = [
        ("package","PACKAGE / WORKSPACE HUB"), ("directory","DIRECTORY / ARCHIVE GATE"),
        ("source","SOURCE / CODE SLAB"), ("test","TEST / BEACON"),
        ("document","DOCUMENT / BOOK"), ("config","CONFIG / TERMINAL"),
        ("data","DATA / STORAGE VAULT"), ("binary","BINARY / ARTIFACT CRATE"),
        ("symbol","SYMBOL / FUNCTION NODE"), ("bridge","DEPENDENCY BRIDGE"),
        ("marker","EVIDENCE / CHANGE MARKER"),
    ]
    palette = [
        body_mats["fantasy-violet"], body_mats["fantasy-blue"],
        bpy.data.materials["MAT_GRAPHITE_PANEL"],
    ]
    for index, (kind, label) in enumerate(families):
        row, column = divmod(index, 4)
        x = -5.25 + column * 3.50
        z = 3.30 - row * 2.25
        make_repository_evidence_object(
            kind, f"EVIDENCE_REPOSITORY_{kind}", (x,0,z), .92,
            (palette[index % len(palette)], bpy.data.materials["MAT_MIDNIGHT_PANEL"], bpy.data.materials["MAT_CIRCUIT_EMISSIVE"]),
            evidence,
        )
        evidence_text(evidence, f"EVIDENCE_REPOSITORY_LABEL_{kind}", label, (x,-.75,z-.86), white, .125)
    extras = configure_evidence_render(scene, REPOSITORY_SHEET, (2400, 1500), 15.2, target_z=1.45)
    finish_evidence_stage(evidence, hidden, extras)


def build():
    global SHARED_TEXTURES
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
    SHARED_TEXTURES = build_texture_atlases()

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
        "brow": material("MAT_FACE_BROW", "4B2F29"),
    }
    graphite = material("MAT_GRAPHITE_PANEL", "111827", 0.26)
    midnight = material("MAT_MIDNIGHT_PANEL", "07101F", 0.18)
    circuit = material("MAT_CIRCUIT_EMISSIVE", "38BDF8", 0.18, emissive=True)
    violet_circuit = material("MAT_CIRCUIT_VIOLET", "8B5CF6", 0.16, emissive=True)
    shirt_mats = {
        name: material(f"MAT_SHIRT_{name}", code)
        for name, code in SHIRTS.items()
    }
    rig = build_rig(rig_collection)

    core_specs = {
        "CORE_MIDSECTION": ((0.37, 0.235, 0.40), (0, 0, 0.80), "pelvis"),
        "CORE_CHEST": ((0.46, 0.25, 0.39), (0, 0, 1.20), "chest"),
        "CORE_ARM_L": ((0.145, 0.155, 0.50), (0.47, 0, 1.02), "upper_arm.L"),
        "CORE_ARM_R": ((0.145, 0.155, 0.50), (-0.47, 0, 1.02), "upper_arm.R"),
        "CORE_LEG_L": ((0.185, 0.195, 0.66), (0.20, 0, -0.04), "upper_leg.L"),
        "CORE_LEG_R": ((0.185, 0.195, 0.66), (-0.20, 0, -0.04), "upper_leg.R"),
    }
    for name, (scale, location, bone) in core_specs.items():
        bind(sphere(name, scale, location, neutral, core_collection, 32, 20), rig, bone)
    panel_specs = {
        "PANEL_CHEST": ((0.34, 0.030, 0.20), (0, -0.252, 1.25), graphite, "chest"),
        "PANEL_HIPS": ((0.29, 0.028, 0.13), (0, -0.238, 0.76), midnight, "pelvis"),
        "PANEL_SHOULDER_L": ((0.145, 0.030, 0.13), (0.47, -0.155, 1.34), graphite, "upper_arm.L"),
        "PANEL_SHOULDER_R": ((0.145, 0.030, 0.13), (-0.47, -0.155, 1.34), graphite, "upper_arm.R"),
        "PANEL_KNEE_L": ((0.135, 0.030, 0.13), (0.20, -0.195, -0.08), midnight, "lower_leg.L"),
        "PANEL_KNEE_R": ((0.135, 0.030, 0.13), (-0.20, -0.195, -0.08), midnight, "lower_leg.R"),
    }
    for name, (scale, location, mat, bone) in panel_specs.items():
        bind(sphere(name, scale, location, mat, core_collection, 24, 14), rig, bone)
    collar_specs = {
        "JOINT_COLLAR_NECK": ((0,0,1.55), .15, .032, "neck"),
        "JOINT_COLLAR_WRIST_L": ((.55,0,.58), .12, .025, "lower_arm.L"),
        "JOINT_COLLAR_WRIST_R": ((-.55,0,.58), .12, .025, "lower_arm.R"),
        "JOINT_COLLAR_HIP_L": ((.20,0,.56), .17, .030, "upper_leg.L"),
        "JOINT_COLLAR_HIP_R": ((-.20,0,.56), .17, .030, "upper_leg.R"),
        "JOINT_COLLAR_ANKLE_L": ((.20,0,-.66), .15, .025, "lower_leg.L"),
        "JOINT_COLLAR_ANKLE_R": ((-.20,0,-.66), .15, .025, "lower_leg.R"),
    }
    for name, (location, major, minor, bone) in collar_specs.items():
        bind(torus(name, major, minor, location, graphite, core_collection), rig, bone)
    seam = curved_tube(
        "CIRCUIT_SEAM_CHEST",
        [(-0.28, -0.235, 1.12), (0, -0.25, 1.34), (0.28, -0.235, 1.12)],
        0.018,
        circuit,
        core_collection,
    )
    seam["aiw_surface_role"] = "restrained-emissive-circuit"
    bind(seam, rig, "chest")
    for side, sign, bone in (("L", 1, "upper_arm.L"), ("R", -1, "upper_arm.R")):
        arm_seam = curved_tube(
            f"CIRCUIT_SEAM_ARM_{side}",
            [(0.47 * sign, -0.157, 1.28), (0.50 * sign, -0.158, 1.02), (0.54 * sign, -0.145, 0.78)],
            0.012,
            violet_circuit,
            core_collection,
        )
        arm_seam["aiw_surface_role"] = "restrained-emissive-circuit"
        bind(arm_seam, rig, bone)

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

    for name in SHIRTS:
        make_shirt(name, shirt_mats[name], ink if name == "Hermes" else white, shirt_collection, rig)
        make_lod2_shirt(name, shirt_mats[name], shirt_collection, rig)
    for species in HEADS:
        make_lod2_body(species, neutral, graphite, module_collection, rig)

    for index, (name, mat) in enumerate(body_mats.items()):
        swatch = sphere(f"COLOR_SWATCH_{name}", (0.04, 0.04, 0.04), (0, 0, -2), mat, palette_collection, 8 + index, 5)
        swatch["aiw_color_label"] = name

    make_actions(rig)
    triangulate_runtime_meshes(scene)
    scene["aiw_schema"] = "aiw.avatar/0.18.5"
    scene["aiw_art_direction"] = "Luminous Codecraft"
    scene["aiw_license"] = "Project-owned / self-authored"
    scene["aiw_core_objects"] = ",".join(CORE)
    scene["aiw_appearance_evidence"] = SHEET.name
    scene["aiw_motion_evidence"] = MOTION_SHEET.name
    scene["aiw_parent_visual_correction"] = "generated-geometry-evidence/1"
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    GLB.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
    bpy.ops.export_scene.gltf(
        filepath=str(GLB), export_format="GLB", export_animations=True,
        export_force_sampling=False, export_texcoords=True, export_morph=True,
        export_morph_normal=True, export_apply=True,
        export_shared_accessors=False,
        export_cameras=False, export_lights=False,
    )
    preserve_glb_material_identity(GLB)
    canonicalize_glb_indices(GLB)
    render_contact_sheet(scene, body_mats, (white, material("MAT_EVIDENCE_ACCENT", "7DD3FC")))
    canonicalize_png_metadata(SHEET)
    render_motion_sheet(scene, rig, body_mats, (white, bpy.data.materials["MAT_EVIDENCE_ACCENT"]))
    canonicalize_png_metadata(MOTION_SHEET)
    render_hero_sheet(scene, body_mats, (white, bpy.data.materials["MAT_EVIDENCE_ACCENT"]))
    canonicalize_png_metadata(HERO_SHEET)
    render_multiview_sheet(scene, body_mats, (white, bpy.data.materials["MAT_EVIDENCE_ACCENT"]))
    canonicalize_png_metadata(MULTIVIEW_SHEET)
    render_facial_sheet(scene, body_mats, (white, bpy.data.materials["MAT_EVIDENCE_ACCENT"]))
    canonicalize_png_metadata(FACIAL_SHEET)
    render_gesture_sheet(scene, rig, body_mats, (white, bpy.data.materials["MAT_EVIDENCE_ACCENT"]))
    canonicalize_png_metadata(GESTURE_SHEET)
    render_concept_sheet(scene, body_mats, (white, bpy.data.materials["MAT_EVIDENCE_ACCENT"]))
    canonicalize_png_metadata(CONCEPT_SHEET)
    render_style_sheet(scene, body_mats, (white, bpy.data.materials["MAT_EVIDENCE_ACCENT"]))
    canonicalize_png_metadata(STYLE_SHEET)
    render_repository_sheet(scene, body_mats, (white, bpy.data.materials["MAT_EVIDENCE_ACCENT"]))
    canonicalize_png_metadata(REPOSITORY_SHEET)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
    write_manifest()


def sha(path):
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def write_manifest():
    texture_paths = sorted(TEXTURE_DIR.glob("aiw-avatar-*.png"))
    mesh_triangles = {
        obj.name: len(obj.data.polygons)
        for obj in bpy.data.objects
        if obj.type == "MESH" and not obj.name.startswith(("EVIDENCE_", "COLOR_SWATCH_"))
    }
    assembled = CORE + SURFACE_DETAILS + [
        "HEAD_cat_maine-coon", "HAND_clawed-paws_L",
        "HAND_clawed-paws_R", "FOOT_clawed-paws_L", "FOOT_clawed-paws_R",
        "FUR_long", "TAIL_cat-curled", "MARKING_mask", "SHIRT_Hermes",
        "SHIRT_LABEL_Hermes",
    ]
    lod_meshes = {
        "LOD0": assembled,
        "LOD1": [
            name for name in assembled
            if not name.startswith(("FUR_", "MARKING_", "SHIRT_LABEL_", "CIRCUIT_SEAM_ARM_"))
        ],
        "LOD2": [
            "LOD2_BODY_cat",
            "LOD2_SHIRT_Hermes",
        ],
    }
    lod_triangles = {
        name: sum(mesh_triangles.get(mesh_name, 0) for mesh_name in mesh_names)
        for name, mesh_names in lod_meshes.items()
    }
    lod_signatures = {
        name: hashlib.sha256(json.dumps(
            [(mesh_name, mesh_triangles.get(mesh_name, 0)) for mesh_name in mesh_names],
            separators=(",", ":"),
        ).encode()).hexdigest()
        for name, mesh_names in lod_meshes.items()
    }
    manifest = {
        "schema": "aiw.avatar-assets/0.18.5", "generator": "tooling/avatar/build_avatar_kit.py", "blender": "5.2.0 LTS",
        "artDirection": "Luminous Codecraft",
        "license": "Project-owned / self-authored", "coreObjects": CORE, "armatures": ["AIW_Biped_Rig"], "attachments": ATTACHMENTS,
        "actions": ACTIONS, "heads": HEADS, "hands": ["hands", "paws", "clawed-paws"], "feet": ["feet", "paws", "clawed-paws"],
        "fur": ["none", "short", "long"], "tails": ["none", "cat-straight", "cat-curled", "dog-straight", "dog-curled"],
        "markings": ["solid", "muzzle", "mask", "socks"], "bodyColors": list(COLORS),
        "expressions": EXPRESSIONS, "anatomicalStates": ANATOMICAL_STATES,
        "lods": {
            name: {
                **details,
                "triangles": lod_triangles[name],
                "includedMeshes": lod_meshes[name],
                "geometrySignature": lod_signatures[name],
            }
            for name, details in LODS.items()
        },
        "pbr": {
            "workflow": "metallic-roughness",
            "sharedAtlases": {
                path.stem.removeprefix("aiw-avatar-"): str(path.relative_to(ROOT))
                for path in texture_paths
            },
            "uvRequired": True,
        },
        "shirts": [{"name": name, "color": "#" + code, "label": name} for name, code in SHIRTS.items()],
        "evidenceBoards": [
            str(SHEET.relative_to(ROOT)),
            str(MOTION_SHEET.relative_to(ROOT)),
            str(HERO_SHEET.relative_to(ROOT)),
            str(MULTIVIEW_SHEET.relative_to(ROOT)),
            str(FACIAL_SHEET.relative_to(ROOT)),
            str(GESTURE_SHEET.relative_to(ROOT)),
            str(CONCEPT_SHEET.relative_to(ROOT)),
            str(STYLE_SHEET.relative_to(ROOT)),
            str(REPOSITORY_SHEET.relative_to(ROOT)),
        ],
        "volatileContainer": {
            "path": str(SOURCE.relative_to(ROOT)),
            "reason": "Blender container metadata is process-volatile; source semantics are independently inspected.",
            "budgetBytes": 48 * 1024 * 1024,
        },
        "files": {
            str(path.relative_to(ROOT)): {"bytes": path.stat().st_size, "sha256": sha(path)}
            for path in (
                GLB, SHEET, MOTION_SHEET, HERO_SHEET, MULTIVIEW_SHEET,
                FACIAL_SHEET, GESTURE_SHEET, CONCEPT_SHEET, STYLE_SHEET,
                REPOSITORY_SHEET, *texture_paths,
            )
        },
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    build()
