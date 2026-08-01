"""Plan or render dense visual evidence for the replacement-avatar catalog.

The default dry run is inexpensive and prints a deterministic public plan.
Rendering invokes the repository-owned Blender pose renderer once per selected
repository GLB. It never reads or writes the five private source directories.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import time
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
MANIFEST = (
    REPOSITORY_ROOT
    / "apps/web/public/assets/imported-avatars/manifest.json"
)
POSE_RENDERER = (
    REPOSITORY_ROOT / "tooling/avatar/render_replacement_pose_sheet.py"
)
DEFAULT_OUTPUT = (
    REPOSITORY_ROOT
    / "artifacts/avatar-replacement-evidence/dense-pose-strips"
)
CLASSIFICATION_STATUS = (
    "runtime-refused-until-visual-and-motion-verification"
)
COMPLETION_FILENAMES = ("pose-evidence.json", "evidence-index.html")


class CatalogCancellation(Exception):
    def __init__(self, signum: int) -> None:
        self.signum = signum
        super().__init__(signal.Signals(signum).name)


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--model-id", action="append", default=[])
    parser.add_argument("--samples", type=int, default=7)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--blender", default="/usr/local/bin/blender")
    parser.add_argument("--frame-timeout-seconds", type=float, default=90)
    parser.add_argument("--model-timeout-seconds", type=float, default=3_600)
    parser.add_argument("--catalog-timeout-seconds", type=float, default=14_400)
    return parser.parse_args()


def load_assets() -> list[dict[str, object]]:
    payload = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assets = payload.get("assets")
    if not isinstance(assets, list) or len(assets) != 23:
        raise SystemExit("replacement manifest must contain exactly 23 assets")
    return assets


def build_plan(
    assets: list[dict[str, object]], samples: int
) -> dict[str, object]:
    if samples < 5 or samples > 15 or samples % 2 == 0:
        raise SystemExit("--samples must be an odd integer from 5 through 15")
    model_ids = [str(asset["id"]) for asset in assets]
    variants = [
        str(asset["id"])
        for asset in assets
        if int(dict(asset["counts"])["animations"]) == 22
    ]
    return {
        "schema": "aiw.replacement-avatar-pose-catalog-plan/1",
        "samplesPerClip": samples,
        "modelIds": model_ids,
        "variantsWith22Clips": variants,
        "classificationStatus": CLASSIFICATION_STATUS,
    }


def write_json_atomic(path: Path, payload: dict[str, object]) -> None:
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def invalidate_completion_truth(model_output: Path) -> None:
    for filename in COMPLETION_FILENAMES:
        (model_output / filename).unlink(missing_ok=True)


def process_group_exists(process_group_id: int) -> bool:
    try:
        os.killpg(process_group_id, 0)
    except ProcessLookupError:
        return False
    return True


def terminate_process_tree(process: subprocess.Popen[bytes]) -> None:
    process_group_id = process.pid
    try:
        os.killpg(process_group_id, signal.SIGTERM)
    except ProcessLookupError:
        return

    grace_deadline = time.monotonic() + 5
    while time.monotonic() < grace_deadline:
        if process.poll() is None:
            try:
                process.wait(timeout=0.1)
            except subprocess.TimeoutExpired:
                pass
        if not process_group_exists(process_group_id):
            return
        time.sleep(0.05)

    try:
        os.killpg(process_group_id, signal.SIGKILL)
    except ProcessLookupError:
        return
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass
    kill_deadline = time.monotonic() + 5
    while process_group_exists(process_group_id):
        if time.monotonic() >= kill_deadline:
            raise RuntimeError(
                f"process group {process_group_id} survived SIGKILL"
            )
        time.sleep(0.05)


def main() -> None:
    arguments = parse_arguments()
    assets = load_assets()
    requested = set(arguments.model_id)
    known = {str(asset["id"]) for asset in assets}
    unknown = sorted(requested - known)
    if unknown:
        raise SystemExit(f"unknown replacement model IDs: {unknown}")
    selected = [
        asset for asset in assets if not requested or str(asset["id"]) in requested
    ]
    plan = build_plan(selected if requested else assets, arguments.samples)
    if arguments.dry_run:
        print(json.dumps(plan, sort_keys=True))
        return

    output_root = arguments.output.resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    for label, value in (
        ("--frame-timeout-seconds", arguments.frame_timeout_seconds),
        ("--model-timeout-seconds", arguments.model_timeout_seconds),
        ("--catalog-timeout-seconds", arguments.catalog_timeout_seconds),
    ):
        if value < 1:
            raise SystemExit(f"{label} must be at least 1")
    catalog_started = time.monotonic()
    progress_path = output_root / "catalog-progress.json"
    progress: dict[str, object] = {
        "schema": "aiw.replacement-avatar-pose-catalog-progress/1",
        "state": "partial",
        "selectedModelIds": [str(asset["id"]) for asset in selected],
        "completedModelIds": [],
        "activeModelId": None,
        "updatedAtUnixSeconds": round(time.time(), 3),
    }
    write_json_atomic(progress_path, progress)
    active_process: subprocess.Popen[bytes] | None = None

    def cancel_on_sigterm(signum: int, _frame: object) -> None:
        raise CatalogCancellation(signum)

    previous_sigterm_handler = signal.signal(
        signal.SIGTERM,
        cancel_on_sigterm,
    )
    try:
        for asset in selected:
            model_id = str(asset["id"])
            shipped_filename = str(asset["shippedFilename"])
            input_path = (
                REPOSITORY_ROOT
                / "apps/web/public/assets/imported-avatars"
                / shipped_filename
            )
            if not input_path.is_file():
                raise SystemExit(f"repository GLB missing for {model_id}")
            elapsed = time.monotonic() - catalog_started
            catalog_remaining = arguments.catalog_timeout_seconds - elapsed
            if catalog_remaining <= 0:
                progress["state"] = "interrupted"
                progress["reason"] = "catalog-timeout"
                progress["updatedAtUnixSeconds"] = round(time.time(), 3)
                write_json_atomic(progress_path, progress)
                raise SystemExit("catalog render exceeded whole-catalog timeout")
            model_output = output_root / model_id
            invalidate_completion_truth(model_output)
            progress["activeModelId"] = model_id
            progress["updatedAtUnixSeconds"] = round(time.time(), 3)
            write_json_atomic(progress_path, progress)
            process = subprocess.Popen(
                [
                    arguments.blender,
                    "--background",
                    "--factory-startup",
                    "--python",
                    str(POSE_RENDERER),
                    "--",
                    "--input",
                    str(input_path),
                    "--output",
                    str(model_output),
                    "--samples",
                    str(arguments.samples),
                    "--frame-timeout-seconds",
                    str(arguments.frame_timeout_seconds),
                ],
                cwd=REPOSITORY_ROOT,
                start_new_session=True,
            )
            active_process = process
            timeout_seconds = min(
                arguments.model_timeout_seconds,
                catalog_remaining,
            )
            try:
                return_code = process.wait(timeout=timeout_seconds)
            except (KeyboardInterrupt, subprocess.TimeoutExpired) as error:
                try:
                    terminate_process_tree(process)
                finally:
                    invalidate_completion_truth(model_output)
                    progress["state"] = "interrupted"
                    progress["reason"] = (
                        "cancelled"
                        if isinstance(error, KeyboardInterrupt)
                        else "model-or-catalog-timeout"
                    )
                    progress["updatedAtUnixSeconds"] = round(time.time(), 3)
                    write_json_atomic(progress_path, progress)
                if isinstance(error, KeyboardInterrupt):
                    raise SystemExit(130) from error
                raise SystemExit(
                    f"render for {model_id} exceeded "
                    f"{timeout_seconds:.3f} seconds"
                ) from error
            active_process = None
            if return_code != 0:
                invalidate_completion_truth(model_output)
                progress["state"] = "interrupted"
                progress["reason"] = f"renderer-exit-{return_code}"
                progress["updatedAtUnixSeconds"] = round(time.time(), 3)
                write_json_atomic(progress_path, progress)
                raise SystemExit(
                    f"renderer failed for {model_id}: exit {return_code}"
                )
            completion_manifest = model_output / "pose-evidence.json"
            if not completion_manifest.is_file():
                progress["state"] = "interrupted"
                progress["reason"] = "missing-completion-manifest"
                progress["updatedAtUnixSeconds"] = round(time.time(), 3)
                write_json_atomic(progress_path, progress)
                raise SystemExit(
                    f"renderer returned without completion manifest for {model_id}"
                )
            completed = list(progress["completedModelIds"])
            completed.append(model_id)
            progress["completedModelIds"] = completed
            progress["activeModelId"] = None
            progress["updatedAtUnixSeconds"] = round(time.time(), 3)
            write_json_atomic(progress_path, progress)
    except CatalogCancellation as error:
        try:
            if active_process is not None:
                terminate_process_tree(active_process)
        finally:
            active_model_id = progress["activeModelId"]
            if isinstance(active_model_id, str):
                invalidate_completion_truth(output_root / active_model_id)
            progress["state"] = "interrupted"
            progress["reason"] = (
                f"signal-cancelled-{signal.Signals(error.signum).name}"
            )
            progress["updatedAtUnixSeconds"] = round(time.time(), 3)
            write_json_atomic(progress_path, progress)
        raise SystemExit(128 + error.signum) from error
    finally:
        signal.signal(signal.SIGTERM, previous_sigterm_handler)

    progress["state"] = "complete"
    progress["updatedAtUnixSeconds"] = round(time.time(), 3)
    write_json_atomic(progress_path, progress)


if __name__ == "__main__":
    main()
