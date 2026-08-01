"""Render and measure one modular pair while preserving two source skeletons.

This file runs inside Blender. The caller supplies repository-owned GLBs only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import signal
import sys
import time
from pathlib import Path
from typing import Any

import bpy
from mathutils import Vector


REGIONS = (
    "head",
    "torso",
    "left-arm",
    "right-arm",
    "left-leg",
    "right-leg",
    "auxiliary",
)
SAMPLES = (0.25, 0.5, 0.75)
THRESHOLDS = {
    "maximumBroadPhaseCollisionPairs": 0,
    "maximumAttachmentGapMeters": 0.025,
    "maximumSeamVariationMeters": 0.015,
    "maximumGroundErrorMeters": 0.03,
    "minimumAssembledHeightMeters": 1.4,
    "maximumAssembledHeightMeters": 2.1,
}


def parse_arguments() -> argparse.Namespace:
    values = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True, type=Path)
    parser.add_argument("--donor", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--progress", required=True, type=Path)
    parser.add_argument("--frame-timeout-seconds", required=True, type=float)
    return parser.parse_args(values)


def write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    temporary.replace(path)


def write_text_atomic(path: Path, value: str) -> None:
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(value, encoding="utf-8")
    temporary.replace(path)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def source_asset(manifest: dict[str, Any], model_id: str) -> dict[str, Any]:
    return next(asset for asset in manifest["assets"] if asset["id"] == model_id)


def action_sort_key(action: bpy.types.Action) -> tuple[int, str]:
    name = action.name
    if name == "NlaTrack":
        return (0, name)
    suffix = name.removeprefix("NlaTrack.")
    return (int(suffix) if suffix.isdigit() else 10_000, name)


def import_source(
    path: Path, asset: dict[str, Any], prefix: str, color: tuple[float, ...]
) -> dict[str, Any]:
    old_objects = set(bpy.data.objects)
    old_actions = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
    objects = [obj for obj in bpy.data.objects if obj not in old_objects]
    actions = [action for action in bpy.data.actions if action not in old_actions]
    original_names = {obj: obj.name for obj in objects}
    expected_names = {part["nodeName"] for part in asset["parts"]}
    mesh_by_name = {
        original_names[obj]: obj
        for obj in objects
        if obj.type == "MESH" and original_names[obj] in expected_names
    }
    if set(mesh_by_name) != expected_names:
        raise RuntimeError(
            f"{asset['id']} imported mesh membership differs from manifest: "
            f"missing {sorted(expected_names - set(mesh_by_name))}"
        )
    root = bpy.data.objects.new(f"{prefix}-normalized-root", None)
    bpy.context.scene.collection.objects.link(root)
    imported_set = set(objects)
    for obj in objects:
        if obj.parent not in imported_set:
            obj.parent = root
        obj.name = f"{prefix}:{original_names[obj]}"
        if obj.type == "MESH":
            obj.color = color
    normalization = asset["normalization"]
    scale = float(normalization["scale"])
    root.scale = (scale, scale, scale)
    root.location = (0, 0, float(normalization["groundOffsetY"]))
    armatures = [obj for obj in objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"{asset['id']} expected one armature, got {len(armatures)}")
    if not actions:
        raise RuntimeError(f"{asset['id']} imported no actions")
    action = sorted(actions, key=action_sort_key)[0]
    armature = armatures[0]
    animation = armature.animation_data_create()
    animation.action = None
    while animation.nla_tracks:
        animation.nla_tracks.remove(animation.nla_tracks[0])
    track = animation.nla_tracks.new()
    track.name = f"{prefix}-source-local-clip-00"
    strip = track.strips.new(track.name, 1, action)
    strip.action_frame_start = float(action.frame_range[0])
    strip.action_frame_end = float(action.frame_range[1])
    strip.frame_end = 101
    part_objects = {
        part["partId"]: mesh_by_name[part["nodeName"]] for part in asset["parts"]
    }
    return {
        "asset": asset,
        "root": root,
        "armature": armature,
        "action": action,
        "partObjects": part_objects,
        "meshObjects": list(part_objects.values()),
    }


def object_bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    graph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(graph)
    mesh = evaluated.to_mesh()
    try:
        points = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
    finally:
        evaluated.to_mesh_clear()
    if not points:
        raise RuntimeError(f"mesh {obj.name} has no evaluated vertices")
    return (
        Vector(tuple(min(point[axis] for point in points) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in points) for axis in range(3))),
    )


def union_bounds(bounds: list[tuple[Vector, Vector]]) -> tuple[Vector, Vector]:
    return (
        Vector(tuple(min(pair[0][axis] for pair in bounds) for axis in range(3))),
        Vector(tuple(max(pair[1][axis] for pair in bounds) for axis in range(3))),
    )


def box_gap(a: tuple[Vector, Vector], b: tuple[Vector, Vector]) -> float:
    distances = [
        max(float(a[0][axis] - b[1][axis]), float(b[0][axis] - a[1][axis]), 0)
        for axis in range(3)
    ]
    return math.sqrt(sum(value * value for value in distances))


def box_overlap_volume(a: tuple[Vector, Vector], b: tuple[Vector, Vector]) -> float:
    extents = [
        max(0.0, min(float(a[1][axis]), float(b[1][axis])) - max(float(a[0][axis]), float(b[0][axis])))
        for axis in range(3)
    ]
    return extents[0] * extents[1] * extents[2]


def rounded_vector(vector: Vector) -> list[float]:
    return [round(float(value), 6) for value in vector]


def pose_hash(armature: bpy.types.Object) -> str:
    values: list[float] = []
    for bone in sorted(armature.pose.bones, key=lambda item: item.name):
        values.extend(round(float(value), 6) for row in bone.matrix for value in row)
    return hashlib.sha256(json.dumps(values, separators=(",", ":")).encode()).hexdigest()


def set_visibility(
    base: dict[str, Any], donor: dict[str, Any], region: str
) -> tuple[list[bpy.types.Object], list[bpy.types.Object]]:
    base_region = set(base["asset"]["regions"][region]["partIds"])
    donor_region = set(donor["asset"]["regions"][region]["partIds"])
    base_visible = [
        obj for part_id, obj in base["partObjects"].items() if part_id not in base_region
    ]
    donor_visible = [
        obj for part_id, obj in donor["partObjects"].items() if part_id in donor_region
    ]
    for obj in base["meshObjects"]:
        obj.hide_render = obj not in base_visible
        obj.hide_viewport = obj not in base_visible
    for obj in donor["meshObjects"]:
        obj.hide_render = obj not in donor_visible
        obj.hide_viewport = obj not in donor_visible
    return base_visible, donor_visible


def aim_camera(camera: bpy.types.Object, bounds: tuple[Vector, Vector]) -> None:
    minimum, maximum = bounds
    center = (minimum + maximum) * 0.5
    extent = maximum - minimum
    camera.location = center + Vector((4.5, -7.0, 2.6))
    camera.rotation_euler = ((center - camera.location).to_track_quat("-Z", "Y")).to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max(float(extent.length) * 1.18, 0.5)


def render_with_timeout(scene: bpy.types.Scene, timeout: float) -> None:
    def fail(_signum: int, _frame: object) -> None:
        raise TimeoutError(f"frame render exceeded {timeout:.3f} seconds")

    previous = signal.signal(signal.SIGALRM, fail)
    signal.setitimer(signal.ITIMER_REAL, timeout)
    try:
        bpy.ops.render.render(write_still=True)
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)


def evidence_html(evidence: dict[str, Any]) -> str:
    encoded = json.dumps(evidence, sort_keys=True).replace("<", "\\u003c")
    return """<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Own-skeleton modular pair evidence</title><style>
body{margin:0;padding:20px;background:#020617;color:#e2e8f0;font:15px Consolas,monospace}h1,h2{color:#93c5fd}
.boundary{border:1px solid #60a5fa;padding:12px}.region{margin:18px 0;border:1px solid #334155;padding:12px}
.REFUSED h2{color:#fca5a5}.PASS h2{color:#86efac}.strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
figure{margin:0}img{display:block;width:100%;background:#0f172a}figcaption{padding:6px;overflow-wrap:anywhere}@media(max-width:760px){.strip{grid-template-columns:1fr}}
</style><body><h1 id="title"></h1><p class="boundary" id="boundary"></p><main id="regions"></main>
<script type="application/json" id="data">__DATA__</script><script>
const e=JSON.parse(document.getElementById('data').textContent);document.getElementById('title').textContent=`${e.baseModelId} base + ${e.donorModelId} donor`;
document.getElementById('boundary').textContent=`Overall ${e.overallVerdict}. Blue = complementary base meshes; orange = selected donor region. Each source retains its own root, skeleton, inverse binds, and clip 00.`;
for(const r of e.regions){const s=document.createElement('section');s.className=`region ${r.verdict}`;s.innerHTML=`<h2>${r.region} · ${r.verdict}</h2><p>${r.reasons.join(' ')}</p>`;
const strip=document.createElement('div');strip.className='strip';const all=[r.restAssemblyFrame,...r.frames];for(const f of all){const fig=document.createElement('figure');const label=f.poseMode==='REST'?'rest assembly':`animated sample ${f.sample}`;fig.innerHTML=`<img src="${f.file}" alt="${r.region} ${label}"><figcaption>${label} · collisions ${f.broadPhaseCollisionPairs} · gap ${f.attachmentGapMeters}m</figcaption>`;strip.append(fig)}s.append(strip);document.getElementById('regions').append(s)}
</script></body></html>""".replace("__DATA__", encoded)


def main() -> None:
    arguments = parse_arguments()
    output = arguments.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(arguments.manifest.read_text(encoding="utf-8"))
    base_asset = source_asset(manifest, arguments.base.stem)
    donor_asset = source_asset(manifest, arguments.donor.stem)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for orphaned_object in list(bpy.data.objects):
        bpy.data.objects.remove(orphaned_object, do_unlink=True)
    base = import_source(arguments.base, base_asset, "base", (0.12, 0.42, 1.0, 1.0))
    donor = import_source(arguments.donor, donor_asset, "donor", (1.0, 0.31, 0.08, 1.0))
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "OBJECT"
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.render.resolution_x = 420
    scene.render.resolution_y = 420
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.world.color = (0.018, 0.024, 0.035)
    scene.view_settings.look = "AgX - Medium High Contrast"
    camera_data = bpy.data.cameras.new("EvidenceCamera")
    camera = bpy.data.objects.new("EvidenceCamera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera

    progress = json.loads(arguments.progress.read_text(encoding="utf-8"))
    records: list[dict[str, Any]] = []
    try:
        for region in REGIONS:
            progress.update(activeRegion=region, updatedAtUnixSeconds=round(time.time(), 3))
            write_json_atomic(arguments.progress, progress)
            base_visible, donor_visible = set_visibility(base, donor, region)
            frames: list[dict[str, Any]] = []
            base_pose_hashes: list[str] = []
            donor_pose_hashes: list[str] = []
            for source in (base, donor):
                source["armature"].data.pose_position = "REST"
            scene.frame_set(1)
            bpy.context.view_layer.update()
            rest_base_bounds = [(obj, object_bounds(obj)) for obj in base_visible]
            rest_donor_bounds = [(obj, object_bounds(obj)) for obj in donor_visible]
            rest_assembled = union_bounds(
                [value for _, value in rest_base_bounds + rest_donor_bounds]
            )
            rest_collision_pairs = [
                [left.name, right.name]
                for left, left_bounds in rest_base_bounds
                for right, right_bounds in rest_donor_bounds
                if box_overlap_volume(left_bounds, right_bounds) > 1e-9
            ]
            rest_gap = (
                min(
                    box_gap(left_bounds, right_bounds)
                    for _, left_bounds in rest_base_bounds
                    for _, right_bounds in rest_donor_bounds
                )
                if rest_donor_bounds
                else None
            )
            rest_filename = f"{region}-complete-rest-assembly.png"
            aim_camera(camera, rest_assembled)
            scene.render.filepath = str(output / rest_filename)
            render_with_timeout(scene, arguments.frame_timeout_seconds)
            rest_frame = {
                "poseMode": "REST",
                "file": rest_filename,
                "sha256": file_sha256(output / rest_filename),
                "broadPhaseCollisionPairs": len(rest_collision_pairs),
                "collisionPairObjects": rest_collision_pairs,
                "attachmentGapMeters": None if rest_gap is None else round(rest_gap, 6),
                "assembledBounds": {
                    "minimum": rounded_vector(rest_assembled[0]),
                    "maximum": rounded_vector(rest_assembled[1]),
                },
                "assembledHeightMeters": round(float(rest_assembled[1].z - rest_assembled[0].z), 6),
                "groundErrorMeters": round(abs(float(rest_assembled[0].z)), 6),
            }
            for source in (base, donor):
                source["armature"].data.pose_position = "POSE"
            gaps: list[float] = [rest_gap] if rest_gap is not None else []
            for sample_number, fraction in enumerate(SAMPLES, 1):
                scene.frame_set(round(1 + fraction * 100))
                bpy.context.view_layer.update()
                base_bounds = [(obj, object_bounds(obj)) for obj in base_visible]
                donor_bounds = [(obj, object_bounds(obj)) for obj in donor_visible]
                visible_bounds = [value for _, value in base_bounds + donor_bounds]
                assembled = union_bounds(visible_bounds)
                collision_pairs = [
                    [left.name, right.name]
                    for left, left_bounds in base_bounds
                    for right, right_bounds in donor_bounds
                    if box_overlap_volume(left_bounds, right_bounds) > 1e-9
                ]
                gap = (
                    min(
                        box_gap(left_bounds, right_bounds)
                        for _, left_bounds in base_bounds
                        for _, right_bounds in donor_bounds
                    )
                    if donor_bounds
                    else None
                )
                if gap is not None:
                    gaps.append(gap)
                base_hash = pose_hash(base["armature"])
                donor_hash = pose_hash(donor["armature"])
                base_pose_hashes.append(base_hash)
                donor_pose_hashes.append(donor_hash)
                aim_camera(camera, assembled)
                filename = f"{region}-assembled-sample-{sample_number}.png"
                scene.render.filepath = str(output / filename)
                render_with_timeout(scene, arguments.frame_timeout_seconds)
                frames.append(
                    {
                        "sample": sample_number,
                        "normalizedClipFraction": fraction,
                        "file": filename,
                        "sha256": file_sha256(output / filename),
                        "broadPhaseCollisionPairs": len(collision_pairs),
                        "collisionPairObjects": collision_pairs,
                        "attachmentGapMeters": None if gap is None else round(gap, 6),
                        "assembledBounds": {
                            "minimum": rounded_vector(assembled[0]),
                            "maximum": rounded_vector(assembled[1]),
                        },
                        "assembledHeightMeters": round(float(assembled[1].z - assembled[0].z), 6),
                        "groundErrorMeters": round(abs(float(assembled[0].z)), 6),
                        "basePoseTraceSha256": base_hash,
                        "donorPoseTraceSha256": donor_hash,
                    }
                )
                partial = {
                    "schema": "aiw.modular-pair-evidence-partial/1",
                    "state": "partial",
                    "activeRegion": region,
                    "completedRegions": [item["region"] for item in records],
                    "activeRegionFrames": frames,
                }
                write_json_atomic(output / "modular-pair-evidence.partial.json", partial)
            source_isolated = bool(donor_asset["regions"][region]["supported"])
            collision_max = max(
                [rest_frame["broadPhaseCollisionPairs"]]
                + [frame["broadPhaseCollisionPairs"] for frame in frames]
            )
            seam_variation = max(gaps) - min(gaps) if gaps else None
            heights_valid = all(
                THRESHOLDS["minimumAssembledHeightMeters"]
                <= frame["assembledHeightMeters"]
                <= THRESHOLDS["maximumAssembledHeightMeters"]
                for frame in [rest_frame, *frames]
            )
            ground_valid = all(
                frame["groundErrorMeters"] <= THRESHOLDS["maximumGroundErrorMeters"]
                for frame in [rest_frame, *frames]
            )
            animation_valid = len(set(base_pose_hashes)) > 1 and len(set(donor_pose_hashes)) > 1
            gap_valid = bool(gaps) and max(gaps) <= THRESHOLDS["maximumAttachmentGapMeters"]
            seam_valid = seam_variation is not None and seam_variation <= THRESHOLDS["maximumSeamVariationMeters"]
            gates = {
                "sourceRegionIsolation": source_isolated,
                "noBroadPhaseCollision": collision_max <= THRESHOLDS["maximumBroadPhaseCollisionPairs"],
                "attachmentGap": gap_valid,
                "seamStability": seam_valid,
                "completeAssembledSilhouette": bool(base_visible and donor_visible)
                and rest_gap is not None
                and rest_gap <= THRESHOLDS["maximumAttachmentGapMeters"]
                and heights_valid
                and ground_valid,
                "ownSkeletonAnimatedBehavior": animation_valid,
                "uniformWrapperNormalization": all(
                    len({round(float(axis), 9) for axis in source["root"].scale}) == 1
                    for source in (base, donor)
                ),
            }
            reasons: list[str] = []
            if not source_isolated:
                reasons.append(donor_asset["regions"][region]["reason"])
            if collision_max:
                reasons.append(f"Refused: {collision_max} conservative world-AABB collision pair(s) were measured.")
            if not gap_valid:
                reasons.append("Refused: no measurable attachment boundary or the gap exceeded 0.025 m.")
            if not seam_valid:
                reasons.append("Refused: seam variation is absent or exceeded 0.015 m.")
            if not animation_valid:
                reasons.append("Refused: both source-local pose traces did not vary across all retained samples.")
            if not gates["completeAssembledSilhouette"]:
                reasons.append("Refused: the assembled silhouette/ground/height gate failed.")
            verdict = "PASS" if all(gates.values()) else "REFUSED"
            if verdict == "PASS":
                reasons.append("Passed every frozen isolation, seam, silhouette, normalization, and own-skeleton animation gate.")
            records.append(
                {
                    "region": region,
                    "verdict": verdict,
                    "gates": gates,
                    "reasons": reasons,
                    "sourceMembership": {
                        "baseHiddenPartIds": base_asset["regions"][region]["partIds"],
                        "donorVisiblePartIds": donor_asset["regions"][region]["partIds"],
                        "baseVisiblePartCount": len(base_visible),
                        "donorVisiblePartCount": len(donor_visible),
                    },
                    "collisionMethod": "conservative-world-aabb-broad-phase",
                    "seamVariationMeters": None if seam_variation is None else round(seam_variation, 6),
                    "completeAssembledFrameRendered": True,
                    "completeAssembledSilhouette": gates["completeAssembledSilhouette"],
                    "ownSkeletonAnimation": {
                        "siblingRootCount": 2,
                        "armatureCount": 2,
                        "sourceLocalClips": True,
                        "baseSourceClipIndex": 0,
                        "baseSourceClipName": base_asset["clips"][0]["name"],
                        "donorSourceClipIndex": 0,
                        "donorSourceClipName": donor_asset["clips"][0]["name"],
                        "baseTraceVaries": len(set(base_pose_hashes)) > 1,
                        "donorTraceVaries": len(set(donor_pose_hashes)) > 1,
                    },
                    "restAssemblyFrame": rest_frame,
                    "frames": frames,
                }
            )
            completed = list(progress["completedRegions"])
            completed.append(region)
            progress.update(completedRegions=completed, updatedAtUnixSeconds=round(time.time(), 3))
            write_json_atomic(arguments.progress, progress)
    except BaseException as error:
        progress.update(
            state="interrupted",
            reason=f"{type(error).__name__}: {error}",
            updatedAtUnixSeconds=round(time.time(), 3),
        )
        write_json_atomic(arguments.progress, progress)
        raise

    passing = [record["region"] for record in records if record["verdict"] == "PASS"]
    evidence = {
        "schema": "aiw.modular-pair-evidence/1",
        "state": "complete",
        "baseModelId": base_asset["id"],
        "donorModelId": donor_asset["id"],
        "pairReason": (
            "Same dog-agent family, the shared 41-joint hierarchy class, equal target height, "
            "and near-identical wrapper scales minimize uncontrolled variation. Distinct rest "
            "and inverse-bind hashes are preserved as sibling own-skeleton roots."
        ),
        "thresholds": THRESHOLDS,
        "sources": {
            "base": {
                "modelId": base_asset["id"],
                "glbSha256": base_asset["sha256"],
                "jointCount": base_asset["skeleton"]["jointCount"],
                "hierarchySha256": base_asset["skeleton"]["hierarchySha256"],
                "restPoseSha256": base_asset["skeleton"]["restPoseSha256"],
                "inverseBindSha256": base_asset["skeleton"]["inverseBindSha256"],
                "normalization": base_asset["normalization"],
            },
            "donor": {
                "modelId": donor_asset["id"],
                "glbSha256": donor_asset["sha256"],
                "jointCount": donor_asset["skeleton"]["jointCount"],
                "hierarchySha256": donor_asset["skeleton"]["hierarchySha256"],
                "restPoseSha256": donor_asset["skeleton"]["restPoseSha256"],
                "inverseBindSha256": donor_asset["skeleton"]["inverseBindSha256"],
                "normalization": donor_asset["normalization"],
            },
        },
        "samplesPerRegion": len(SAMPLES),
        "regions": records,
        "passingRegions": passing,
        "overallVerdict": "PASS" if passing else "REFUSED",
        "runtimeRemainsDisabled": not passing,
        "sourceGlbsMutated": False,
        "foreignSkeletonDriven": False,
        "wholeDonorFallbackUsed": False,
    }
    write_json_atomic(output / "modular-pair-evidence.json", evidence)
    write_text_atomic(output / "evidence-index.html", evidence_html(evidence))
    progress.update(
        state="complete",
        activeRegion=None,
        overallVerdict=evidence["overallVerdict"],
        updatedAtUnixSeconds=round(time.time(), 3),
    )
    write_json_atomic(arguments.progress, progress)


if __name__ == "__main__":
    main()
