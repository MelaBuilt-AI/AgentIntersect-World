import importlib.util
import json
import os
import pathlib
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location(
    "release_build", pathlib.Path(__file__).with_name("build.py")
)
assert SPEC is not None and SPEC.loader is not None
BUILD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILD)


class DeploymentPrivacyTest(unittest.TestCase):
    def test_manager_paths_are_removed_and_workspace_dependencies_are_versioned(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            dep = root / "node_modules/@agentintersect-world/config"
            dep.mkdir(parents=True)
            (dep / "package.json").write_text(
                json.dumps({"name": "@agentintersect-world/config", "version": "1.2.3"})
            )
            (root / "package.json").write_text(
                json.dumps(
                    {
                        "name": "app",
                        "dependencies": {
                            "@agentintersect-world/config": "@agentintersect-world/config@file:///private/developer/project/config"
                        },
                    }
                )
            )
            (root / "pnpm-lock.yaml").write_text("private developer paths")
            (root / "node_modules/.modules.yaml").write_text("private store paths")
            source = root / "source-manifest.json"
            os.link(root / "package.json", source)
            source_before = source.read_bytes()
            BUILD.sanitize_deployment(root)
            self.assertEqual(
                source.read_bytes(),
                source_before,
                "A hard-linked source manifest must stay byte-identical",
            )
            self.assertFalse((root / "pnpm-lock.yaml").exists())
            self.assertFalse((root / "node_modules/.modules.yaml").exists())
            self.assertEqual(
                json.loads((root / "package.json").read_text())["dependencies"][
                    "@agentintersect-world/config"
                ],
                "1.2.3",
            )




class NativeFilesTest(unittest.TestCase):
    def make(self, root, *files):
        for directory in BUILD.PTY_PACKAGES.values():
            (root / directory).mkdir(parents=True, exist_ok=True)
            (root / directory / "package.json").write_text("{}")
        for f in files:
            (root / f).parent.mkdir(parents=True, exist_ok=True)
            (root / f).write_bytes(b"x")

    def test_only_pinned_pty_prebuilds_may_ship_and_each_platform_keeps_its_own(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            linux = BUILD.PTY_PACKAGES["linux-x64"]
            windows = BUILD.PTY_PACKAGES["windows-x64"]
            self.make(root, f"{linux}/prebuilds/pty.node", f"{windows}/prebuilds/conpty.node", f"{windows}/prebuilds/conpty.pdb")
            BUILD.check_native_files(root)
            BUILD.keep_platform_natives(root, "windows-x64")
            self.assertFalse((root / linux).exists())
            self.assertTrue((root / windows / "prebuilds/conpty.node").exists())
            self.assertFalse((root / windows / "prebuilds/conpty.pdb").exists())

    def test_unexpected_native_dependency_is_refused(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            self.make(root, "node_modules/other/build/other.node")
            with self.assertRaisesRegex(RuntimeError, "Unexpected native"):
                BUILD.check_native_files(root)

if __name__ == "__main__":
    unittest.main()
