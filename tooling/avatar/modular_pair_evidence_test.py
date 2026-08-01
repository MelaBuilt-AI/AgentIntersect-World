"""Focused contract tests for bounded own-skeleton modular-pair evidence."""

from __future__ import annotations

import json
import hashlib
import os
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RUNNER = ROOT / "tooling/avatar/build_modular_pair_evidence.py"
EVIDENCE = (
    ROOT
    / "artifacts/avatar-replacement-evidence/modular-dog-01-dog-02-v1"
    / "modular-pair-evidence.json"
)
REGIONS = {
    "head",
    "torso",
    "left-arm",
    "right-arm",
    "left-leg",
    "right-leg",
    "auxiliary",
}


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


class ModularPairEvidencePlanTest(unittest.TestCase):
    def test_dry_run_freezes_one_conservative_pair_and_bounded_contract(self) -> None:
        result = subprocess.run(
            [sys.executable, str(RUNNER), "--dry-run"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        plan = json.loads(result.stdout)
        self.assertEqual(plan["schema"], "aiw.modular-pair-evidence-plan/1")
        self.assertEqual(plan["baseModelId"], "dog-agent-01")
        self.assertEqual(plan["donorModelId"], "dog-agent-02")
        self.assertEqual(set(plan["regions"]), REGIONS)
        self.assertEqual(plan["samplesPerRegion"], 3)
        self.assertEqual(plan["sourceLocalClipIndex"], 0)
        self.assertEqual(plan["uniqueDonorLimit"], 1)
        self.assertTrue(plan["failClosed"])
        self.assertGreaterEqual(plan["bounds"]["frameTimeoutSeconds"], 1)
        self.assertGreaterEqual(plan["bounds"]["pairTimeoutSeconds"], 1)


class ModularPairEvidenceCancellationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="aiw-modular-pair-")
        self.root = Path(self.temporary.name)
        self.output = self.root / "output"
        self.pids = self.root / "pids"
        self.pids.mkdir()
        self.fake_blender = self.root / "fake-blender.py"
        self.fake_blender.write_text(
            f"""#!{sys.executable}
import os, signal, subprocess, sys
from pathlib import Path
mode = os.environ["FAKE_BLENDER_MODE"]
if mode == "fail":
    raise SystemExit(23)
pids = Path(os.environ["FAKE_PID_DIRECTORY"])
child = subprocess.Popen([
    sys.executable, "-c",
    "import os,signal,time,pathlib;signal.signal(signal.SIGTERM,signal.SIG_IGN);pathlib.Path(os.environ['FAKE_DESCENDANT_PID']).write_text(str(os.getpid()));time.sleep(300)",
], env={{**os.environ, "FAKE_DESCENDANT_PID": str(pids / "descendant.pid")}})
(pids / "leader.pid").write_text(str(os.getpid()))
signal.signal(signal.SIGTERM, signal.SIG_DFL)
child.wait()
""",
            encoding="utf-8",
        )
        self.fake_blender.chmod(0o755)

    def tearDown(self) -> None:
        leader = self.pids / "leader.pid"
        if leader.is_file():
            try:
                os.killpg(int(leader.read_text(encoding="utf-8")), signal.SIGKILL)
            except ProcessLookupError:
                pass
        self.temporary.cleanup()

    def command(self) -> list[str]:
        return [
            sys.executable,
            str(RUNNER),
            "--output",
            str(self.output),
            "--blender",
            str(self.fake_blender),
            "--frame-timeout-seconds",
            "30",
            "--pair-timeout-seconds",
            "30",
        ]

    def environment(self, mode: str) -> dict[str, str]:
        return {
            **os.environ,
            "FAKE_BLENDER_MODE": mode,
            "FAKE_PID_DIRECTORY": str(self.pids),
        }

    def test_failed_rerun_invalidates_stale_pair_completion(self) -> None:
        self.output.mkdir()
        for name in ("modular-pair-evidence.json", "evidence-index.html"):
            (self.output / name).write_text("stale", encoding="utf-8")
        result = subprocess.run(
            self.command(),
            cwd=ROOT,
            env=self.environment("fail"),
            capture_output=True,
            text=True,
            check=False,
            timeout=15,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.output / "modular-pair-evidence.json").exists())
        self.assertFalse((self.output / "evidence-index.html").exists())
        progress = json.loads(
            (self.output / "pair-progress.json").read_text(encoding="utf-8")
        )
        self.assertEqual(progress["state"], "interrupted")
        self.assertEqual(progress["reason"], "renderer-exit-23")

    def test_sigterm_kills_fake_blender_descendant_and_finalizes_progress(self) -> None:
        process = subprocess.Popen(
            self.command(),
            cwd=ROOT,
            env=self.environment("wait"),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            wait_for_path(self.pids / "leader.pid")
            wait_for_path(self.pids / "descendant.pid")
            leader = int((self.pids / "leader.pid").read_text(encoding="utf-8"))
            descendant = int(
                (self.pids / "descendant.pid").read_text(encoding="utf-8")
            )
            process.send_signal(signal.SIGTERM)
            self.assertNotEqual(process.wait(timeout=15), 0)
            self.assertFalse(process_exists(leader))
            self.assertFalse(process_exists(descendant))
            progress = json.loads(
                (self.output / "pair-progress.json").read_text(encoding="utf-8")
            )
            self.assertEqual(progress["state"], "interrupted")
            self.assertEqual(progress["reason"], "signal-cancelled-SIGTERM")
            self.assertFalse((self.output / "modular-pair-evidence.json").exists())
        finally:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=5)


class RetainedModularPairEvidenceTest(unittest.TestCase):
    def test_retained_completion_is_explicit_and_own_skeleton_gated(self) -> None:
        self.assertTrue(EVIDENCE.is_file(), f"missing retained evidence: {EVIDENCE}")
        evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
        self.assertEqual(evidence["schema"], "aiw.modular-pair-evidence/1")
        self.assertEqual(evidence["state"], "complete")
        self.assertEqual(evidence["baseModelId"], "dog-agent-01")
        self.assertEqual(evidence["donorModelId"], "dog-agent-02")
        self.assertEqual(
            {region["region"] for region in evidence["regions"]}, REGIONS
        )
        self.assertEqual(len(evidence["regions"]), 7)
        self.assertNotEqual(
            evidence["sources"]["base"]["restPoseSha256"],
            evidence["sources"]["donor"]["restPoseSha256"],
        )
        self.assertNotEqual(
            evidence["sources"]["base"]["inverseBindSha256"],
            evidence["sources"]["donor"]["inverseBindSha256"],
        )
        for region in evidence["regions"]:
            self.assertIn(region["verdict"], {"PASS", "REFUSED"})
            self.assertEqual(len(region["frames"]), 3)
            self.assertTrue(region["completeAssembledFrameRendered"])
            retained = [region["restAssemblyFrame"], *region["frames"]]
            for frame in retained:
                path = EVIDENCE.parent / frame["file"]
                self.assertTrue(path.is_file())
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), frame["sha256"])
            self.assertEqual(region["ownSkeletonAnimation"]["siblingRootCount"], 2)
            self.assertEqual(region["ownSkeletonAnimation"]["armatureCount"], 2)
            self.assertTrue(region["ownSkeletonAnimation"]["sourceLocalClips"])
        if evidence["overallVerdict"] == "REFUSED":
            self.assertEqual(evidence["passingRegions"], [])
            self.assertTrue(evidence["runtimeRemainsDisabled"])


if __name__ == "__main__":
    unittest.main()
