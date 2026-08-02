from __future__ import annotations

import json
import os
import struct
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import avatar_metadata_investigation as investigation


def write_glb(path: Path, document: dict) -> None:
    payload = json.dumps(document, separators=(",", ":")).encode("utf-8")
    payload += b" " * ((4 - len(payload) % 4) % 4)
    raw = struct.pack("<4sII", b"glTF", 2, 20 + len(payload))
    raw += struct.pack("<II", len(payload), 0x4E4F534A) + payload
    path.write_bytes(raw)


class AvatarMetadataInvestigationTest(unittest.TestCase):
    def test_cli_runs_root_default_follows_the_current_home_directory(self) -> None:
        with mock.patch.object(Path, "home", return_value=Path("/portable-home")):
            parser = investigation.build_argument_parser()

        arguments = parser.parse_args(
            [
                "--source-tree",
                "/source-fixture",
                "--source-inventory",
                "/inventory-fixture.json",
            ]
        )

        self.assertEqual(arguments.runs_root, Path("/portable-home/.hermes/runs"))

    def test_glb_metadata_records_every_requested_channel_without_semantic_claims(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixture.glb"
            write_glb(
                path,
                {
                    "asset": {
                        "version": "2.0",
                        "generator": "fixture-exporter",
                        "copyright": "fixture-owner",
                        "extras": {"pipeline": "transport-only"},
                    },
                    "extensionsUsed": ["EXT_fixture"],
                    "extensions": {"EXT_fixture": {"enabled": True}},
                    "scenes": [{"name": "Scene", "nodes": [0], "extras": {"x": 1}}],
                    "nodes": [{"name": "Hip", "extras": {"node": True}}],
                    "skins": [{"name": "Rig", "joints": [0]}],
                    "meshes": [{"name": "Body", "primitives": []}],
                    "animations": [
                        {
                            "name": "NlaTrack.001",
                            "extras": {"export": "anonymous"},
                            "channels": [],
                            "samplers": [],
                        }
                    ],
                    "accessors": [{"name": "Timeline", "extras": {"unit": "seconds"}}],
                    "bufferViews": [{"name": "AnimationData", "extras": {"packed": True}}],
                },
            )

            result = investigation.inspect_glb_metadata(path)

            self.assertEqual(result["asset"]["generator"], "fixture-exporter")
            self.assertEqual(result["topLevel"]["extensionsUsed"], ["EXT_fixture"])
            for channel in (
                "scenes",
                "nodes",
                "skins",
                "meshes",
                "animations",
                "accessors",
                "bufferViews",
            ):
                self.assertIn(channel, result["collections"])
                self.assertIn("recordsSha256", result["collections"][channel])
            self.assertEqual(
                result["collections"]["animations"]["records"][0]["name"],
                "NlaTrack.001",
            )
            self.assertEqual(result["semanticAuthority"]["authoritativeLabels"], [])
            self.assertEqual(
                result["semanticAuthority"]["classification"],
                "transport-and-structure-only",
            )

    def test_sanitized_ads_summary_never_retains_locator_fields(self) -> None:
        summary = investigation.normalize_ads_summary(
            {
                "streamPresent": True,
                "byteCount": 1146,
                "sha256": "a" * 64,
                "zoneId": 3,
                "providerHostname": "studio.tripo3d.ai",
                "downloadHostname": "tripo-data.rg1.data.tripo3d.com",
                "pathClass": "ready-source-glb",
            }
        )
        encoded = json.dumps(summary, sort_keys=True)
        self.assertNotIn("Url", encoded)
        self.assertNotIn("?", encoded)
        self.assertEqual(summary["providerHostname"], "studio.tripo3d.ai")
        self.assertEqual(summary["streamPresent"], True)

    def test_ads_root_is_transported_only_through_a_dedicated_environment_variable(self) -> None:
        windows_root = "X:\\private fixture\\avatars"
        producer_output = json.dumps(
            {
                "relativePath": "Ready\\model.glb",
                "streamPresent": True,
                "byteCount": 12,
                "sha256": "a" * 64,
                "zoneId": 3,
                "providerHostname": "provider.example",
                "downloadHostname": "download.example",
            }
        )
        completed = [
            subprocess.CompletedProcess([], 0, stdout=windows_root + "\n", stderr=""),
            subprocess.CompletedProcess([], 0, stdout=producer_output, stderr=""),
        ]
        with (
            mock.patch.object(investigation.shutil, "which", return_value="powershell.exe"),
            mock.patch.object(investigation.subprocess, "run", side_effect=completed) as run,
        ):
            result = investigation.collect_ads_summaries(
                Path("/source-fixture"), {"Ready/model.glb": "source/model-01/glb"}
            )

        powershell_call = run.call_args_list[1]
        command = powershell_call.args[0]
        self.assertNotIn(windows_root, command)
        self.assertIn("$env:AIW_AVATAR_ADS_ROOT", "\n".join(command))
        self.assertEqual(
            powershell_call.kwargs["env"]["AIW_AVATAR_ADS_ROOT"], windows_root
        )
        self.assertEqual(
            powershell_call.kwargs["env"]["WSLENV"].split(":")[-1],
            "AIW_AVATAR_ADS_ROOT",
        )
        self.assertEqual(
            {
                key: value
                for key, value in powershell_call.kwargs["env"].items()
                if key not in {"AIW_AVATAR_ADS_ROOT", "WSLENV"}
            },
            {key: value for key, value in os.environ.items() if key != "WSLENV"},
        )
        self.assertEqual(result["streamCount"], 1)
        self.assertEqual(result["records"][0]["alias"], "source/model-01/glb")

    def test_sanitized_tree_inventory_uses_aliases_not_absolute_paths(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "Ready" / "Cat Agent").mkdir(parents=True)
            (root / "Ready" / "Cat Agent" / "model.glb").write_bytes(b"model")
            (root / ".hidden-note").write_text("note", encoding="utf-8")

            records = investigation.inventory_tree(
                root,
                known_aliases={"Ready/Cat Agent/model.glb": "source/cat-agent-01/glb"},
            )

            self.assertEqual(len(records), 4)
            self.assertEqual(records[-1]["alias"], "source/cat-agent-01/glb")
            self.assertTrue(any(record["hidden"] for record in records))
            self.assertNotIn(str(root), json.dumps(records, sort_keys=True))

    def test_evidence_discovery_excludes_generated_output_and_mutable_tool_sources(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            repository = root / "repository"
            runs = root / "runs"
            output = repository / "generated-output"
            mutable_source = repository / "mutable-tool.py"
            repository.mkdir()
            runs.mkdir()
            output.mkdir()
            (repository / "stable-evidence.md").write_text(
                "The source catalog contains anonymous NlaTrack names.",
                encoding="utf-8",
            )
            mutable_source.write_text("NlaTrack first version", encoding="utf-8")
            (output / "metadata-investigation.json").write_text(
                '{"marker":"NlaTrack first output"}', encoding="utf-8"
            )

            first = investigation.scan_text_evidence(
                [("repository", repository), ("runs", runs)],
                excluded_paths=(output, mutable_source),
            )
            mutable_source.write_text("NlaTrack changed version", encoding="utf-8")
            (output / "metadata-investigation.json").write_text(
                '{"marker":"NlaTrack regenerated output"}', encoding="utf-8"
            )
            second = investigation.scan_text_evidence(
                [("repository", repository), ("runs", runs)],
                excluded_paths=(output, mutable_source),
            )

            self.assertEqual(first, second)
            self.assertEqual(first["scannedTextFileCount"], 1)
            self.assertEqual(
                [record["alias"] for record in first["records"]],
                ["repository/stable-evidence.md"],
            )


if __name__ == "__main__":
    unittest.main()
