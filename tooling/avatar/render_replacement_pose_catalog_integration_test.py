from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
CATALOG = REPOSITORY_ROOT / "tooling/avatar/render_replacement_pose_catalog.py"
MODEL_ID = "cat-agent-01"


def process_exists(process_id: int) -> bool:
    try:
        os.kill(process_id, 0)
    except ProcessLookupError:
        return False
    return True


def wait_for_path(path: Path, timeout_seconds: float = 10) -> None:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if path.is_file():
            return
        time.sleep(0.05)
    raise AssertionError(f"timed out waiting for {path}")


class PoseCatalogCancellationIntegrationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory(
            prefix="aiw-pose-catalog-integration-"
        )
        self.root = Path(self.temporary_directory.name)
        self.output = self.root / "output"
        self.pid_directory = self.root / "pids"
        self.pid_directory.mkdir()
        self.fake_blender = self.root / "fake-blender.py"
        self.fake_blender.write_text(
            f"""#!{sys.executable}
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

mode = os.environ["FAKE_BLENDER_MODE"]
pid_directory = Path(os.environ["FAKE_PID_DIRECTORY"])
if mode == "fail":
    raise SystemExit(23)
if mode in {{"success", "partial"}}:
    arguments = sys.argv[1:]
    output = Path(arguments[arguments.index("--output") + 1])
    output.mkdir(parents=True, exist_ok=True)
    suffix = "" if mode == "success" else ".partial"
    (output / f"pose-evidence{{suffix}}.json").write_text(
        '{{"fake":"fresh"}}\\n'
    )
    (output / f"evidence-index{{suffix}}.html").write_text(
        "<p>fresh fake evidence</p>\\n"
    )
    raise SystemExit(0)

child = subprocess.Popen(
    [
        sys.executable,
        "-c",
        (
            "import os,signal,time,pathlib;"
            "signal.signal(signal.SIGTERM, signal.SIG_IGN);"
            "pathlib.Path(os.environ['FAKE_DESCENDANT_PID']).write_text(str(os.getpid()));"
            "time.sleep(300)"
        ),
    ],
    env={{
        **os.environ,
        "FAKE_DESCENDANT_PID": str(pid_directory / "descendant.pid"),
    }},
)
(pid_directory / "leader.pid").write_text(str(os.getpid()))
signal.signal(signal.SIGTERM, signal.SIG_DFL)
child.wait()
""",
            encoding="utf-8",
        )
        self.fake_blender.chmod(0o755)

    def tearDown(self) -> None:
        leader_path = self.pid_directory / "leader.pid"
        if leader_path.is_file():
            leader_id = int(leader_path.read_text(encoding="utf-8"))
            try:
                os.killpg(leader_id, signal.SIGKILL)
            except ProcessLookupError:
                pass
        self.temporary_directory.cleanup()

    def catalog_command(self) -> list[str]:
        return [
            sys.executable,
            str(CATALOG),
            "--model-id",
            MODEL_ID,
            "--samples",
            "7",
            "--output",
            str(self.output),
            "--blender",
            str(self.fake_blender),
            "--frame-timeout-seconds",
            "30",
            "--model-timeout-seconds",
            "30",
            "--catalog-timeout-seconds",
            "30",
        ]

    def environment(self, mode: str) -> dict[str, str]:
        return {
            **os.environ,
            "FAKE_BLENDER_MODE": mode,
            "FAKE_PID_DIRECTORY": str(self.pid_directory),
        }

    def test_failed_reused_model_invalidates_stale_completion_truth(self) -> None:
        model_output = self.output / MODEL_ID
        model_output.mkdir(parents=True)
        completion_manifest = model_output / "pose-evidence.json"
        completion_index = model_output / "evidence-index.html"
        completion_manifest.write_text('{"stale":true}\n', encoding="utf-8")
        completion_index.write_text("<p>stale complete index</p>\n", encoding="utf-8")

        result = subprocess.run(
            self.catalog_command(),
            cwd=REPOSITORY_ROOT,
            env=self.environment("fail"),
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(completion_manifest.exists())
        self.assertFalse(completion_index.exists())
        progress = json.loads(
            (self.output / "catalog-progress.json").read_text(encoding="utf-8")
        )
        self.assertEqual(progress["state"], "interrupted")
        self.assertEqual(progress["reason"], "renderer-exit-23")
        self.assertEqual(progress["activeModelId"], MODEL_ID)

    def test_direct_sigterm_cancels_entire_model_process_group(self) -> None:
        process = subprocess.Popen(
            self.catalog_command(),
            cwd=REPOSITORY_ROOT,
            env=self.environment("wait"),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        leader_path = self.pid_directory / "leader.pid"
        descendant_path = self.pid_directory / "descendant.pid"
        try:
            wait_for_path(leader_path)
            wait_for_path(descendant_path)
            leader_id = int(leader_path.read_text(encoding="utf-8"))
            descendant_id = int(descendant_path.read_text(encoding="utf-8"))

            process.send_signal(signal.SIGTERM)
            return_code = process.wait(timeout=15)

            self.assertNotEqual(return_code, 0)
            self.assertFalse(process_exists(leader_id))
            self.assertFalse(process_exists(descendant_id))
            progress = json.loads(
                (self.output / "catalog-progress.json").read_text(encoding="utf-8")
            )
            self.assertEqual(progress["state"], "interrupted")
            self.assertEqual(progress["reason"], "signal-cancelled-SIGTERM")
            self.assertEqual(progress["activeModelId"], MODEL_ID)
            self.assertFalse(
                (self.output / MODEL_ID / "pose-evidence.json").exists()
            )
        finally:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=5)

    def test_fresh_complete_run_still_completes(self) -> None:
        result = subprocess.run(
            self.catalog_command(),
            cwd=REPOSITORY_ROOT,
            env=self.environment("success"),
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )

        self.assertEqual(result.returncode, 0)
        model_output = self.output / MODEL_ID
        self.assertTrue((model_output / "pose-evidence.json").is_file())
        self.assertTrue((model_output / "evidence-index.html").is_file())
        progress = json.loads(
            (self.output / "catalog-progress.json").read_text(encoding="utf-8")
        )
        self.assertEqual(progress["state"], "complete")
        self.assertEqual(progress["completedModelIds"], [MODEL_ID])
        self.assertIsNone(progress["activeModelId"])

    def test_partial_evidence_survives_without_completion_truth(self) -> None:
        result = subprocess.run(
            self.catalog_command(),
            cwd=REPOSITORY_ROOT,
            env=self.environment("partial"),
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )

        self.assertNotEqual(result.returncode, 0)
        model_output = self.output / MODEL_ID
        self.assertTrue((model_output / "pose-evidence.partial.json").is_file())
        self.assertTrue((model_output / "evidence-index.partial.html").is_file())
        self.assertFalse((model_output / "pose-evidence.json").exists())
        self.assertFalse((model_output / "evidence-index.html").exists())
        progress = json.loads(
            (self.output / "catalog-progress.json").read_text(encoding="utf-8")
        )
        self.assertEqual(progress["state"], "interrupted")
        self.assertEqual(progress["reason"], "missing-completion-manifest")
        self.assertEqual(progress["activeModelId"], MODEL_ID)
