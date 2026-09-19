import copy
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from ci_scope import changed_paths, mode_for, verify_gate


class ScopeTests(unittest.TestCase):
    def test_event_matrix(self):
        repo = {"default_branch": "main"}
        for name, event, files, expected in [
            ("push", {"repository": repo, "ref": "refs/heads/feature"}, ["apps/web/src/a.ts"], "core"),
            ("push", {"repository": repo, "ref": "refs/heads/main"}, ["apps/web/src/a.ts"], "full"),
            ("push", {"repository": repo, "ref": "refs/tags/test"}, ["a.ts"], "full"),
            ("pull_request", {"pull_request": {"draft": False}}, ["a.ts"], "full"),
            ("pull_request", {"pull_request": {"draft": True}}, ["a.ts"], "core"),
            ("pull_request", {"pull_request": {"draft": False}}, ["README.md", "docs/guide.md"], "docs"),
            ("pull_request", {"pull_request": {"draft": False}}, ["README.md", "a.ts"], "full"),
            ("pull_request", {"pull_request": {"draft": False}}, [".github/workflows/ci.yml"], "full"),
            ("pull_request", {"pull_request": {"draft": False}}, ["tooling/fixtures/input.md"], "full"),
            ("pull_request", {"pull_request": {"draft": False}}, [], "full"),
            ("workflow_dispatch", {}, ["README.md"], "full"),
        ]:
            with self.subTest(name=name, files=files, expected=expected):
                self.assertEqual(mode_for(name, event, files), expected)

    def test_actual_git_diff_and_new_branch(self):
        with tempfile.TemporaryDirectory() as directory:
            previous = os.getcwd()
            os.chdir(directory)
            try:
                def git(*args):
                    return subprocess.check_output(["git", *args], stderr=subprocess.DEVNULL).decode().strip()
                def commit():
                    git("add", ".")
                    git("-c", "user.name=CI fixture", "-c", "user.email=ci@example.invalid", "commit", "-qm", "fixture")
                    return git("rev-parse", "HEAD")
                git("init", "-q", "-b", "main")
                Path("code.ts").write_text("export const value = 1;\n")
                base = commit()
                git("update-ref", "refs/remotes/origin/main", base)
                Path("README.md").write_text("# Documentation\n")
                head = commit()
                event = {"before": base, "after": head, "repository": {"default_branch": "main"}}
                self.assertEqual(changed_paths("push", event), ["README.md"])
                event["before"] = "0" * 40
                self.assertEqual(changed_paths("push", event), ["README.md"])
                Path("docs").mkdir()
                Path("code.ts").rename("docs/code.md")
                renamed = commit()
                files = changed_paths("pull_request", {"pull_request": {"base": {"sha": head}, "head": {"sha": renamed}}})
                self.assertEqual(set(files), {"code.ts", "docs/code.md"})
                self.assertEqual(mode_for("pull_request", {"pull_request": {"draft": False}}, files), "full")
            finally:
                os.chdir(previous)
        print("CI scope fixtures exercised")

    def test_gate_rejects_failed_cancelled_or_skipped_required_lanes(self):
        needs = {"scope": {"result": "success", "outputs": {"mode": "full"}},
                 **{k: {"result": "success"} for k in ["core", "measurements", "e2e-flagged", "e2e-unflagged"]}}
        self.assertEqual(verify_gate(needs), "full")
        for name in ["scope", "core", "measurements", "e2e-flagged", "e2e-unflagged"]:
            for result in ["failure", "cancelled", "skipped"]:
                bad = copy.deepcopy(needs)
                bad[name]["result"] = result
                with self.assertRaises(ValueError):
                    verify_gate(bad)
        self.assertEqual(verify_gate({"scope": {"result": "success", "outputs": {"mode": "docs"}}, "docs": {"result": "success"}}), "docs")
        core_only = {"scope": {"result": "success", "outputs": {"mode": "core"}}, "core": {"result": "success"}}
        self.assertEqual(verify_gate(core_only), "core")
        with self.assertRaises(ValueError):
            verify_gate(core_only, merge_gate=True)
