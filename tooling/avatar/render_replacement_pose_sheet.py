"""Render deterministic pose evidence for anonymous replacement-avatar clips.

Run with Blender:
  blender --background --factory-startup \
    --python tooling/avatar/render_replacement_pose_sheet.py -- \
    --input <model.glb> --output <directory>
"""

from __future__ import annotations

import argparse
import json
import math
import signal
import sys
import time
from pathlib import Path

import bpy
from mathutils import Vector


def parse_arguments() -> argparse.Namespace:
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--samples", type=int, default=7)
    parser.add_argument("--resolution", type=int, default=240)
    parser.add_argument("--clip-index", action="append", type=int, default=[])
    parser.add_argument("--frame-timeout-seconds", type=float, default=90)
    return parser.parse_args(arguments)


def action_index(name: str) -> int:
    if name == "NlaTrack":
        return 0
    if name.startswith("NlaTrack."):
        try:
            return int(name.removeprefix("NlaTrack."))
        except ValueError:
            pass
    return 10_000


def add_area_light(
    name: str, location: tuple[float, float, float], energy: float
) -> None:
    data = bpy.data.lights.new(name=name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = 5
    light = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    light.rotation_euler = (math.radians(50), 0, math.radians(25))


def evaluated_bounds() -> tuple[Vector, Vector]:
    graph = bpy.context.evaluated_depsgraph_get()
    points: list[Vector] = []
    for source in bpy.context.scene.objects:
        if source.type != "MESH":
            continue
        current = source.evaluated_get(graph)
        mesh = current.to_mesh()
        try:
            points.extend(current.matrix_world @ vertex.co for vertex in mesh.vertices)
        finally:
            current.to_mesh_clear()
    if not points:
        raise RuntimeError("Imported scene has no renderable mesh bounds")
    return (
        Vector(tuple(min(point[axis] for point in points) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in points) for axis in range(3))),
    )


def aim_camera(
    camera: bpy.types.Object,
    minimum: Vector,
    maximum: Vector,
    ortho_scale: float,
) -> None:
    center = (minimum + maximum) * 0.5
    size = maximum - minimum
    depth = max(size.y, 0.01)
    distance = max(depth * 2 + 2, 5)
    camera.location = (center.x, center.y - distance, center.z)
    camera.rotation_euler = ((center - camera.location).to_track_quat("-Z", "Y")).to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale


def union_bounds(
    bounds: list[tuple[Vector, Vector]],
) -> tuple[Vector, Vector]:
    return (
        Vector(tuple(min(pair[0][axis] for pair in bounds) for axis in range(3))),
        Vector(tuple(max(pair[1][axis] for pair in bounds) for axis in range(3))),
    )


def maximum_centered_extent(
    bounds: list[tuple[Vector, Vector]],
) -> float:
    return max(
        max(float(maximum.x - minimum.x), float(maximum.z - minimum.z))
        for minimum, maximum in bounds
    )


def write_json_atomic(path: Path, payload: dict[str, object]) -> None:
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def render_with_timeout(scene: bpy.types.Scene, timeout_seconds: float) -> None:
    if not math.isfinite(timeout_seconds) or timeout_seconds < 1:
        raise RuntimeError("--frame-timeout-seconds must be at least 1")

    def timeout_handler(_signum: int, _frame: object) -> None:
        raise TimeoutError(
            f"frame render exceeded {timeout_seconds:.3f} seconds"
        )

    previous = signal.signal(signal.SIGALRM, timeout_handler)
    signal.setitimer(signal.ITIMER_REAL, timeout_seconds)
    try:
        bpy.ops.render.render(write_still=True)
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)


def evidence_index_html(evidence: dict[str, object]) -> str:
    encoded = json.dumps(evidence, sort_keys=True).replace("<", "\\u003c")
    return (
        """<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Replacement avatar dense pose evidence</title>
<style>
body{margin:0;padding:1rem;background:#020617;color:#e2e8f0;font:14px Consolas,monospace}
h1,h2{color:#93c5fd}.boundary{border:1px solid #60a5fa;padding:.75rem}
.clip{margin:1rem 0;border:1px solid #334155;padding:.75rem}
.strip{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(9rem,1fr);gap:.5rem;overflow-x:auto}
figure{margin:0}img{display:block;width:100%;background:#0f172a}figcaption{padding:.35rem;overflow-wrap:anywhere}
</style>
<body>
<h1 id="title"></h1>
<p class="boundary" id="boundary"></p>
<main id="clips"></main>
<script type="application/json" id="evidence-data">__EVIDENCE__</script>
<script>
const evidence=JSON.parse(document.getElementById("evidence-data").textContent);
document.getElementById("title").textContent=`${evidence.modelId} · ${evidence.samplesPerClip} samples per clip`;
document.getElementById("boundary").textContent=`${evidence.classificationStatus}. Motion authority: ${evidence.motionEvidenceAuthority}`;
const clips=document.getElementById("clips");
for(const clip of evidence.clips){
  const section=document.createElement("section"); section.className="clip";
  const heading=document.createElement("h2"); heading.textContent=`Clip ${String(clip.clipIndex).padStart(2,"0")} · ${clip.sourceActionName}`;
  const strip=document.createElement("div"); strip.className="strip";
  clip.renderedFiles.forEach((file,index)=>{
    const figure=document.createElement("figure");
    const image=document.createElement("img"); image.src=file; image.alt=`${heading.textContent} · ${clip.sampleLabels[index]}`;
    const caption=document.createElement("figcaption"); caption.textContent=`${clip.sampleLabels[index]} · frame ${clip.sampleFrames[index]}`;
    figure.append(image,caption); strip.append(figure);
  });
  section.append(heading,strip); clips.append(section);
}
</script>
</body>
</html>
"""
        .replace("__EVIDENCE__", encoded)
    )


def main() -> None:
    arguments = parse_arguments()
    input_path = arguments.input.resolve()
    output_directory = arguments.output.resolve()
    output_directory.mkdir(parents=True, exist_ok=True)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(input_path))

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_shadows = False
    scene.display.shading.show_cavity = False
    scene.display.shading.cavity_type = "WORLD"
    if arguments.resolution < 96 or arguments.resolution > 480:
        raise RuntimeError("resolution must be between 96 and 480")
    scene.render.resolution_x = arguments.resolution
    scene.render.resolution_y = arguments.resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.018, 0.024, 0.035)
    scene.view_settings.look = "AgX - Medium High Contrast"

    camera_data = bpy.data.cameras.new("EvidenceCamera")
    camera = bpy.data.objects.new("EvidenceCamera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera

    add_area_light("EvidenceKey", (-4, -5, 7), 1_200)
    add_area_light("EvidenceFill", (4, -2, 4), 850)
    add_area_light("EvidenceRim", (0, 4, 6), 1_000)

    armatures = sorted(
        (item for item in scene.objects if item.type == "ARMATURE"),
        key=lambda item: item.name,
    )
    if not armatures:
        raise RuntimeError("Imported scene has no armature")
    actions = sorted(
        (action for action in bpy.data.actions if action.name.startswith("NlaTrack")),
        key=lambda action: (action_index(action.name), action.name),
    )
    if not actions:
        raise RuntimeError("Imported scene has no NlaTrack actions")
    requested_clips = set(arguments.clip_index)
    unknown_clips = sorted(
        clip for clip in requested_clips if clip < 0 or clip >= len(actions)
    )
    if unknown_clips:
        raise RuntimeError(f"unknown clip indices: {unknown_clips}")
    selected_actions = [
        (clip_index, action)
        for clip_index, action in enumerate(actions)
        if not requested_clips or clip_index in requested_clips
    ]
    expected_frames = len(selected_actions) * arguments.samples
    progress_path = output_directory / "render-progress.json"
    progress: dict[str, object] = {
        "schema": "aiw.replacement-avatar-render-progress/1",
        "modelId": input_path.stem,
        "state": "partial",
        "completeModel": not requested_clips,
        "completedFrames": 0,
        "expectedFrames": expected_frames,
        "completedClipIndices": [],
        "activeClipIndex": None,
        "activeSampleIndex": None,
        "updatedAtUnixSeconds": round(time.time(), 3),
    }
    write_json_atomic(progress_path, progress)

    records: list[dict[str, object]] = []
    try:
        for clip_index, action in selected_actions:
            progress["activeClipIndex"] = clip_index
            progress["activeSampleIndex"] = None
            progress["updatedAtUnixSeconds"] = round(time.time(), 3)
            write_json_atomic(progress_path, progress)
            for armature in armatures:
                animation_data = armature.animation_data_create()
                animation_data.action = action
            start, end = action.frame_range
            sample_fractions = [
                (sample + 1) / (arguments.samples + 1)
                for sample in range(arguments.samples)
            ]
            samples = [
                start + (end - start) * fraction
                for fraction in sample_fractions
            ]
            sampled_bounds: list[tuple[Vector, Vector]] = []
            for frame in samples:
                scene.frame_set(round(frame))
                bpy.context.view_layer.update()
                sampled_bounds.append(evaluated_bounds())
            minimum, maximum = union_bounds(sampled_bounds)
            clip_ortho_scale = max(maximum_centered_extent(sampled_bounds), 0.01) * 1.24
            rendered: list[str] = []
            for sample_index, (frame, frame_bounds) in enumerate(
                zip(samples, sampled_bounds, strict=True)
            ):
                progress["activeSampleIndex"] = sample_index + 1
                progress["updatedAtUnixSeconds"] = round(time.time(), 3)
                write_json_atomic(progress_path, progress)
                scene.frame_set(round(frame))
                bpy.context.view_layer.update()
                frame_minimum, frame_maximum = frame_bounds
                aim_camera(
                    camera,
                    frame_minimum,
                    frame_maximum,
                    clip_ortho_scale,
                )
                filename = f"clip-{clip_index:02d}-sample-{sample_index + 1}.png"
                scene.render.filepath = str(output_directory / filename)
                render_with_timeout(scene, arguments.frame_timeout_seconds)
                rendered.append(filename)
                progress["completedFrames"] = int(progress["completedFrames"]) + 1
                progress["updatedAtUnixSeconds"] = round(time.time(), 3)
                write_json_atomic(progress_path, progress)
            records.append(
                {
                    "clipIndex": clip_index,
                    "sourceActionName": action.name,
                    "frameRange": [round(float(start), 6), round(float(end), 6)],
                    "sampleFrames": [round(float(frame), 6) for frame in samples],
                    "sampleLabels": [
                        f"sample-{index + 1:02d} · {fraction * 100:.1f}%"
                        for index, fraction in enumerate(sample_fractions)
                    ],
                    "renderedFiles": rendered,
                    "sampledUnionBounds": {
                        "minimum": [round(float(value), 6) for value in minimum],
                        "maximum": [round(float(value), 6) for value in maximum],
                    },
                    "sampledMaximumCenteredExtent": round(
                        clip_ortho_scale / 1.24,
                        6,
                    ),
                    "cameraOrthoScale": round(clip_ortho_scale, 6),
                }
            )
            completed_clips = list(progress["completedClipIndices"])
            completed_clips.append(clip_index)
            progress["completedClipIndices"] = completed_clips
    except BaseException as error:
        progress["state"] = "interrupted"
        progress["error"] = f"{type(error).__name__}: {error}"
        progress["updatedAtUnixSeconds"] = round(time.time(), 3)
        write_json_atomic(progress_path, progress)
        raise

    evidence = {
        "schema": "aiw.replacement-avatar-pose-evidence/2",
        "modelId": input_path.stem,
        "samplesPerClip": arguments.samples,
        "sourceClipNamesPreserved": True,
        "motionEvidenceAuthority": (
            "apps/web/public/assets/imported-avatars/manifest.json"
            f"#assets/{input_path.stem}/clips"
        ),
        "classificationStatus": (
            "runtime-refused-until-visual-and-motion-verification"
        ),
        "completeModel": not requested_clips,
        "renderedClipIndices": [clip_index for clip_index, _ in selected_actions],
        "clips": records,
    }
    evidence_filename = (
        "pose-evidence.json" if not requested_clips else "pose-evidence.partial.json"
    )
    index_filename = (
        "evidence-index.html" if not requested_clips else "evidence-index.partial.html"
    )
    write_json_atomic(output_directory / evidence_filename, evidence)
    (output_directory / index_filename).write_text(
        evidence_index_html(evidence),
        encoding="utf-8",
    )
    progress["state"] = "complete" if not requested_clips else "partial-complete"
    progress["activeClipIndex"] = None
    progress["activeSampleIndex"] = None
    progress["updatedAtUnixSeconds"] = round(time.time(), 3)
    write_json_atomic(progress_path, progress)


if __name__ == "__main__":
    main()
    bpy.ops.wm.quit_blender()
