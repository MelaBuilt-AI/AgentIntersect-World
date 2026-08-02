"""Build bounded 23 x 12 complete-avatar animation review evidence."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "apps/web/public/assets/imported-avatars/manifest.json"
OUTPUT = (
    ROOT
    / "artifacts/avatar-replacement-evidence/world-animation-completion-v1"
)
TEMPORAL_REVIEW = OUTPUT / "temporal-review"
BROWSER_REVIEW = OUTPUT / "browser"
SEMANTIC_REVIEW = (
    ROOT
    / "artifacts/avatar-replacement-evidence"
    / "world-animation-semantic-review-v2"
    / "semantic-review.json"
)
BROWSER_TRACE = "world-motion-user-male-02-robot-agent-05-trace.json"
BROWSER_CAPTURES = (
    "builder-agent-desktop-selected-robot-agent-05-with-glb-preview-and-original-controls.png",
    "world-motion-user-male-02-and-robot-agent-05-idle-grounded-framing.png",
    "world-motion-user-male-02-walk-robot-agent-05-idle.png",
    "world-motion-user-male-02-run-robot-agent-05-idle.png",
    "world-animated-user-male-02-and-cat-agent-01-grounded-framing.png",
    "world-animated-user-male-02-and-dog-agent-01-grounded-framing.png",
    "world-one-shot-user-dance-agent-idle.png",
    "world-one-shot-user-jump-agent-idle.png",
    "world-one-shot-user-idle-agent-wave.png",
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
SAMPLES_PER_MAPPING = 3
SAMPLE_SIZE = 120
SHEET_COLUMNS = 4
SHEET_ROWS = 3
SHEET_LABEL_HEIGHT = 28
SHEET_SIZE = (
    SHEET_COLUMNS * SAMPLES_PER_MAPPING * SAMPLE_SIZE,
    40 + SHEET_ROWS * (SAMPLE_SIZE + SHEET_LABEL_HEIGHT),
)


def read_manifest() -> dict[str, Any]:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def browser_artifact(filename: str) -> dict[str, str]:
    path = BROWSER_REVIEW / filename
    if not path.is_file():
        raise ValueError(f"missing retained browser proof: {filename}")
    return {
        "path": f"browser/{filename}",
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }


def browser_temporal_proof() -> dict[str, Any]:
    return {
        "status": "verified",
        "verification": (
            "representative-human-cat-dog-robot-production-mixer-bone-progression"
        ),
        "trace": browser_artifact(BROWSER_TRACE),
        "captures": [browser_artifact(filename) for filename in BROWSER_CAPTURES],
    }


def fitted_review_frame(source: Image.Image) -> Image.Image:
    frame = source.convert("RGB")
    background_color = frame.getpixel((0, 0))
    background = Image.new("RGB", frame.size, background_color)
    difference = ImageChops.difference(frame, background)
    content_bounds = difference.getbbox()
    cropped = frame.crop(content_bounds) if content_bounds else frame
    fitted = ImageOps.contain(
        cropped,
        (SAMPLE_SIZE - 12, SAMPLE_SIZE - 12),
        method=Image.Resampling.LANCZOS,
    )
    output = Image.new("RGB", (SAMPLE_SIZE, SAMPLE_SIZE), background_color)
    output.paste(
        fitted,
        ((SAMPLE_SIZE - fitted.width) // 2, (SAMPLE_SIZE - fitted.height) // 2),
    )
    return output


def review_sheet(model_id: str, intermediate: Path, mapping: dict[str, int]) -> None:
    semantic_tile_width = SAMPLES_PER_MAPPING * SAMPLE_SIZE
    sheet = Image.new("RGB", SHEET_SIZE, "#030914")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=16)
    draw.text(
        (10, 10),
        f"{model_id} · mapped 25% / 50% / 75% keyframes",
        fill="#e5f3ff",
        font=font,
    )
    for index, semantic in enumerate(SEMANTICS):
        clip_index = mapping[semantic]
        column = index % SHEET_COLUMNS
        row = index // SHEET_COLUMNS
        x = column * semantic_tile_width
        y = 40 + row * (SAMPLE_SIZE + SHEET_LABEL_HEIGHT)
        for sample in range(1, SAMPLES_PER_MAPPING + 1):
            frame_path = intermediate / (
                f"clip-{clip_index:02d}-sample-{sample}.png"
            )
            with Image.open(frame_path) as source:
                frame = fitted_review_frame(source)
            sheet.paste(frame, (x + (sample - 1) * SAMPLE_SIZE, y))
        draw.rectangle(
            (
                x,
                y + SAMPLE_SIZE,
                x + semantic_tile_width,
                y + SAMPLE_SIZE + SHEET_LABEL_HEIGHT,
            ),
            fill="#07162a",
        )
        draw.text(
            (x + 6, y + SAMPLE_SIZE + 5),
            f"{semantic} · clip {clip_index:02d}",
            fill="#7dd3fc",
            font=font,
        )
    sheet.save(TEMPORAL_REVIEW / f"{model_id}.png", optimize=True)


def render_model(asset: dict[str, Any]) -> None:
    model_id = asset["id"]
    mapping = asset["semanticClips"]
    review_path = TEMPORAL_REVIEW / f"{model_id}.png"
    if review_path.is_file():
        with Image.open(review_path) as existing:
            if existing.size == SHEET_SIZE:
                print(f"retained existing three-position review sheet for {model_id}")
                return
    intermediate = TEMPORAL_REVIEW / f".{model_id}-frames"
    if intermediate.exists():
        shutil.rmtree(intermediate)
    intermediate.mkdir(parents=True)
    command = [
        "/usr/local/bin/blender",
        "-noaudio",
        "--background",
        "--factory-startup",
        "--python",
        str(ROOT / "tooling/avatar/render_replacement_pose_sheet.py"),
        "--",
        "--input",
        str(ROOT / "apps/web/public" / asset["registry"]["assetUrl"].removeprefix("/")),
        "--output",
        str(intermediate),
        "--samples",
        str(SAMPLES_PER_MAPPING),
        "--resolution",
        str(SAMPLE_SIZE),
        "--frame-timeout-seconds",
        "60",
    ]
    for semantic in SEMANTICS:
        command.extend(("--clip-index", str(mapping[semantic])))
    process = subprocess.Popen(
        command,
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    expected_frames = {
        intermediate / f"clip-{clip_index:02d}-sample-{sample}.png"
        for clip_index in mapping.values()
        for sample in range(1, SAMPLES_PER_MAPPING + 1)
    }
    deadline = time.monotonic() + 600
    while process.poll() is None and not all(path.is_file() for path in expected_frames):
        if time.monotonic() >= deadline:
            process.terminate()
            process.wait(timeout=10)
            raise TimeoutError(f"bounded evidence render timed out for {model_id}")
        time.sleep(0.25)
    if not all(path.is_file() for path in expected_frames):
        raise subprocess.CalledProcessError(process.returncode or 1, command)
    try:
        process.wait(timeout=3)
    except subprocess.TimeoutExpired:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
    review_sheet(model_id, intermediate, mapping)
    shutil.rmtree(intermediate)


def build_summary(manifest: dict[str, Any]) -> dict[str, Any]:
    review = json.loads(SEMANTIC_REVIEW.read_text(encoding="utf-8"))
    decisions = {
        (decision["modelId"], decision["semantic"]): decision
        for decision in review["decisions"]
    }
    mappings: list[dict[str, Any]] = []
    for asset in manifest["assets"]:
        for semantic in SEMANTICS:
            evidence = asset["semanticEvidence"][semantic]
            decision = decisions[(asset["id"], semantic)]
            mappings.append(
                {
                    "modelId": asset["id"],
                    "semantic": semantic,
                    "clipIndex": evidence["clipIndex"],
                    "clipName": evidence["clipName"],
                    "durationSeconds": evidence["durationSeconds"],
                    "channelCount": evidence["channelCount"],
                    "targetCount": evidence["targetCount"],
                    "pathCounts": evidence["pathCounts"],
                    "rootHipPelvisTranslationEvidence": evidence[
                        "rootHipPelvisTranslationEvidence"
                    ],
                    "motionChannelSha256": evidence["motionChannelSha256"],
                    "inputTimingSha256": evidence["inputTimingSha256"],
                    "outputPoseSha256": evidence["outputPoseSha256"],
                    "temporalProof": (
                        "deterministic-duration-channel-motion-plus-"
                        "three-position-visual-evidence"
                    ),
                    "visualProof": (
                        f"temporal-review/{asset['id']}.png#{semantic}"
                    ),
                    "structuralVerification": evidence["verification"],
                    "semanticReview": {
                        key: decision[key]
                        for key in (
                            "verdict",
                            "reviewedClipIndex",
                            "expectedClipIndex",
                            "rationale",
                            "evidenceRefs",
                        )
                    },
                }
            )
    return {
        "schema": "aiw.world-avatar-animation-evidence/2",
        "modelCount": len(manifest["assets"]),
        "semanticCount": len(SEMANTICS),
        "mappingCount": len(mappings),
        "samplesPerMapping": SAMPLES_PER_MAPPING,
        "samplePositions": [0.25, 0.5, 0.75],
        "browserTemporalProof": browser_temporal_proof(),
        "visualReviewOverview": "temporal-review/overview.png",
        "sourceClipMutation": "prohibited-and-hash-checked",
        "semanticReview": {
            "schema": review["schema"],
            "path": (
                "../world-animation-semantic-review-v2/semantic-review.json"
            ),
            "totals": review["totals"],
            "runtimePolicy": review["runtimePolicy"],
        },
        "reviewBoundary": (
            "three-position-direct-keyframes-plus-parent-visual-and-"
            "production-browser-verified"
        ),
        "mappings": mappings,
    }


def validate(summary: dict[str, Any]) -> None:
    if summary.get("modelCount") != 23 or summary.get("mappingCount") != 276:
        raise ValueError("complete 23 x 12 mapping coverage is required")
    if summary.get("samplesPerMapping") != SAMPLES_PER_MAPPING:
        raise ValueError("three temporal samples per mapping are required")
    if summary.get("samplePositions") != [0.25, 0.5, 0.75]:
        raise ValueError("unexpected temporal sample positions")
    review = summary.get("semanticReview")
    if (
        not isinstance(review, dict)
        or review.get("schema") != "aiw.world-animation-semantic-review/2"
        or sum(review.get("totals", {}).values()) != 276
        or review.get("runtimePolicy")
        != "pass-only-all-other-verdicts-refused"
    ):
        raise ValueError("complete semantic review authority is required")
    for mapping in summary["mappings"]:
        decision = mapping.get("semanticReview")
        if not isinstance(decision, dict):
            raise ValueError("mapping lacks semantic review")
        if decision.get("reviewedClipIndex") != mapping.get("clipIndex"):
            raise ValueError("semantic review diverges from reviewed clip")
        if decision.get("verdict") == "pass":
            if decision.get("expectedClipIndex") != mapping.get("clipIndex"):
                raise ValueError("pass decision lacks expected clip index")
        elif decision.get("expectedClipIndex") is not None:
            raise ValueError("non-pass decision must fail closed")
    expected_models = {mapping["modelId"] for mapping in summary["mappings"]}
    missing_sheets = sorted(
        model_id
        for model_id in expected_models
        if not (TEMPORAL_REVIEW / f"{model_id}.png").is_file()
    )
    if missing_sheets:
        raise ValueError(f"missing temporal review sheets: {missing_sheets}")
    for model_id in expected_models:
        with Image.open(TEMPORAL_REVIEW / f"{model_id}.png") as sheet:
            if sheet.size != SHEET_SIZE:
                raise ValueError(f"stale one-position review sheet: {model_id}")
    if not (TEMPORAL_REVIEW / "overview.png").is_file():
        raise ValueError("missing bounded 23-model visual review overview")
    browser_proof = summary.get("browserTemporalProof")
    if (
        not isinstance(browser_proof, dict)
        or browser_proof.get("status") != "verified"
    ):
        raise ValueError("verified production browser temporal proof is required")
    browser_records = [browser_proof.get("trace"), *browser_proof.get("captures", [])]
    if len(browser_records) != 10:
        raise ValueError("one trace and nine retained browser captures are required")
    for record in browser_records:
        if not isinstance(record, dict) or not str(record.get("path", "")).startswith(
            "browser/"
        ):
            raise ValueError("invalid browser proof record")
        path = OUTPUT / record["path"]
        if not path.is_file():
            raise ValueError(f"missing browser proof artifact: {record['path']}")
        if hashlib.sha256(path.read_bytes()).hexdigest() != record.get("sha256"):
            raise ValueError(f"stale browser proof hash: {record['path']}")
    trace = json.loads((OUTPUT / browser_proof["trace"]["path"]).read_text())
    if trace.get("schema") != "aiw.browser-model-local-motion-trace/1":
        raise ValueError("unexpected browser motion trace schema")
    samples = trace.get("samples", [])
    if [sample.get("state") for sample in samples] != [
        "idle-1",
        "idle-2",
        "walk",
        "run",
        "returned-idle",
    ]:
        raise ValueError("browser motion trace is incomplete")
    if (
        samples[2]["user"]["actionTime"] <= 0.2
        or samples[3]["user"]["actionTime"] <= 0.2
    ):
        raise ValueError("locomotion action time did not progress")
    if any(sample["user"]["boneName"] != "L_Thigh" for sample in samples):
        raise ValueError("browser proof does not sample a moving rig bone")
    if samples[0]["user"]["mixerRoot"] == samples[0]["agent"]["mixerRoot"]:
        raise ValueError("user and agent browser mixers are not independent")


def build_overview(manifest: dict[str, Any]) -> None:
    tile_width = 480
    tile_height = round(tile_width * SHEET_SIZE[1] / SHEET_SIZE[0])
    columns = 3
    rows = (len(manifest["assets"]) + columns - 1) // columns
    overview = Image.new(
        "RGB",
        (columns * tile_width, rows * tile_height),
        "#030914",
    )
    for index, asset in enumerate(manifest["assets"]):
        with Image.open(TEMPORAL_REVIEW / f"{asset['id']}.png") as source:
            tile = source.convert("RGB").resize((tile_width, tile_height))
        overview.paste(
            tile,
            ((index % columns) * tile_width, (index // columns) * tile_height),
        )
    overview.save(TEMPORAL_REVIEW / "overview.png", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    manifest = read_manifest()
    TEMPORAL_REVIEW.mkdir(parents=True, exist_ok=True)
    if arguments.render:
        with ThreadPoolExecutor(max_workers=2) as workers:
            list(workers.map(render_model, manifest["assets"]))
    summary = build_summary(manifest)
    summary_path = OUTPUT / "evidence-summary.json"
    if arguments.check:
        current = json.loads(summary_path.read_text(encoding="utf-8"))
        if current != summary:
            raise ValueError("world animation evidence summary is stale")
        validate(current)
        print("verified 23 models, 12 semantics, 276 explicit semantic decisions")
        return
    build_overview(manifest)
    validate(summary)
    summary_path.write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print("built bounded World animation evidence for 23 x 12 mappings")


if __name__ == "__main__":
    main()
