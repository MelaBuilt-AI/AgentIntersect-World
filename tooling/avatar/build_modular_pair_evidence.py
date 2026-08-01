"""Build bounded evidence for one frozen own-skeleton modular donor pair."""

from __future__ import annotations

import argparse
import json
import signal
import subprocess
import time
from pathlib import Path

from render_replacement_pose_catalog import (
    CatalogCancellation,
    terminate_process_tree,
    write_json_atomic,
)


ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "apps/web/public/assets/imported-avatars"
MANIFEST = ASSET_DIR / "manifest.json"
RENDERER = ROOT / "tooling/avatar/render_modular_pair_evidence.py"
DEFAULT_OUTPUT = (
    ROOT
    / "artifacts/avatar-replacement-evidence/modular-dog-01-dog-02-v1"
)
BASE_MODEL_ID = "dog-agent-01"
DONOR_MODEL_ID = "dog-agent-02"
REGIONS = (
    "head",
    "torso",
    "left-arm",
    "right-arm",
    "left-leg",
    "right-leg",
    "auxiliary",
)
COMPLETION_FILENAMES = ("modular-pair-evidence.json", "evidence-index.html")


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--blender", default="/usr/local/bin/blender")
    parser.add_argument("--frame-timeout-seconds", type=float, default=90)
    parser.add_argument("--pair-timeout-seconds", type=float, default=900)
    return parser.parse_args()


def load_pair() -> tuple[dict[str, object], dict[str, object]]:
    assets = json.loads(MANIFEST.read_text(encoding="utf-8"))["assets"]
    indexed = {asset["id"]: asset for asset in assets}
    return indexed[BASE_MODEL_ID], indexed[DONOR_MODEL_ID]


def plan(arguments: argparse.Namespace) -> dict[str, object]:
    return {
        "schema": "aiw.modular-pair-evidence-plan/1",
        "baseModelId": BASE_MODEL_ID,
        "donorModelId": DONOR_MODEL_ID,
        "regions": list(REGIONS),
        "samplesPerRegion": 3,
        "sourceLocalClipIndex": 0,
        "uniqueDonorLimit": 1,
        "failClosed": True,
        "bounds": {
            "frameTimeoutSeconds": arguments.frame_timeout_seconds,
            "pairTimeoutSeconds": arguments.pair_timeout_seconds,
        },
        "reason": (
            "Same dog-agent family, equal 41-joint hierarchy class and near-identical "
            "wrapper normalization minimize uncontrolled morphology; distinct rest and "
            "inverse-bind hashes require two preserved sibling roots."
        ),
    }


def invalidate_completion(output: Path) -> None:
    for filename in COMPLETION_FILENAMES:
        (output / filename).unlink(missing_ok=True)


def main() -> None:
    arguments = parse_arguments()
    if arguments.frame_timeout_seconds < 1:
        raise SystemExit("--frame-timeout-seconds must be at least 1")
    if arguments.pair_timeout_seconds < 1:
        raise SystemExit("--pair-timeout-seconds must be at least 1")
    current_plan = plan(arguments)
    if arguments.dry_run:
        print(json.dumps(current_plan, sort_keys=True))
        return

    base, donor = load_pair()
    output = arguments.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    invalidate_completion(output)
    progress_path = output / "pair-progress.json"
    progress: dict[str, object] = {
        "schema": "aiw.modular-pair-evidence-progress/1",
        "state": "partial",
        "baseModelId": BASE_MODEL_ID,
        "donorModelId": DONOR_MODEL_ID,
        "activeRegion": None,
        "completedRegions": [],
        "updatedAtUnixSeconds": round(time.time(), 3),
    }
    write_json_atomic(progress_path, progress)
    process: subprocess.Popen[bytes] | None = None

    def cancel_on_sigterm(signum: int, _frame: object) -> None:
        raise CatalogCancellation(signum)

    previous_sigterm = signal.signal(signal.SIGTERM, cancel_on_sigterm)
    try:
        process = subprocess.Popen(
            [
                arguments.blender,
                "--background",
                "--factory-startup",
                "--python",
                str(RENDERER),
                "--",
                "--base",
                str(ASSET_DIR / str(base["shippedFilename"])),
                "--donor",
                str(ASSET_DIR / str(donor["shippedFilename"])),
                "--manifest",
                str(MANIFEST),
                "--output",
                str(output),
                "--progress",
                str(progress_path),
                "--frame-timeout-seconds",
                str(arguments.frame_timeout_seconds),
            ],
            cwd=ROOT,
            start_new_session=True,
        )
        try:
            return_code = process.wait(timeout=arguments.pair_timeout_seconds)
        except (KeyboardInterrupt, subprocess.TimeoutExpired) as error:
            terminate_process_tree(process)
            invalidate_completion(output)
            progress.update(
                state="interrupted",
                reason=(
                    "cancelled"
                    if isinstance(error, KeyboardInterrupt)
                    else "pair-timeout"
                ),
                updatedAtUnixSeconds=round(time.time(), 3),
            )
            write_json_atomic(progress_path, progress)
            if isinstance(error, KeyboardInterrupt):
                raise SystemExit(130) from error
            raise SystemExit("modular pair evidence exceeded pair timeout") from error
        process = None
        if return_code != 0:
            invalidate_completion(output)
            progress.update(
                state="interrupted",
                reason=f"renderer-exit-{return_code}",
                updatedAtUnixSeconds=round(time.time(), 3),
            )
            write_json_atomic(progress_path, progress)
            raise SystemExit(f"modular pair renderer failed: exit {return_code}")
        if not all((output / name).is_file() for name in COMPLETION_FILENAMES):
            invalidate_completion(output)
            progress.update(
                state="interrupted",
                reason="missing-completion-artifact",
                updatedAtUnixSeconds=round(time.time(), 3),
            )
            write_json_atomic(progress_path, progress)
            raise SystemExit("renderer returned without complete evidence")
    except CatalogCancellation as error:
        try:
            if process is not None:
                terminate_process_tree(process)
        finally:
            invalidate_completion(output)
            progress.update(
                state="interrupted",
                reason=f"signal-cancelled-{signal.Signals(error.signum).name}",
                updatedAtUnixSeconds=round(time.time(), 3),
            )
            write_json_atomic(progress_path, progress)
        raise SystemExit(128 + error.signum) from error
    finally:
        signal.signal(signal.SIGTERM, previous_sigterm)


if __name__ == "__main__":
    main()
