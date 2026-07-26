"""Focused RED/GREEN tests for the Phase 18.5 parent visual correction."""
from __future__ import annotations

import json
import struct
import tempfile
import unittest
from pathlib import Path

from tooling.avatar import verify_avatar_assets


ROOT = Path(__file__).resolve().parents[2]


class Phase185VisualContractTest(unittest.TestCase):
    def test_verifier_preserves_semantically_current_formatted_inspection(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "inspection.json"
            formatted = '{\n  "value": 1\n}\n'
            target.write_text(formatted)
            self.assertFalse(
                verify_avatar_assets.write_json_if_changed(
                    target,
                    {"value": 1},
                )
            )
            self.assertEqual(target.read_text(), formatted)
            self.assertTrue(
                verify_avatar_assets.write_json_if_changed(
                    target,
                    {"value": 2},
                )
            )
            self.assertEqual(json.loads(target.read_text()), {"value": 2})

    def test_manifest_meets_quality_floors_and_records_real_lod_sets(self):
        contract = json.loads(
            (ROOT / "assets/phase18-5/phase18-5-asset-contract.json").read_text()
        )
        manifest = json.loads(
            (ROOT / "assets/avatar/aiw-avatar-kit.manifest.json").read_text()
        )
        signatures = set()
        mesh_sets = set()
        for name, limits in contract["budgets"]["triangles"].items():
            lod = manifest["lods"][name]
            self.assertGreaterEqual(lod["triangles"], limits["minimum"])
            self.assertLessEqual(lod["triangles"], limits["maximum"])
            self.assertTrue(lod["includedMeshes"])
            signatures.add(lod["geometrySignature"])
            mesh_sets.add(tuple(lod["includedMeshes"]))
        self.assertEqual(len(signatures), 3)
        self.assertEqual(len(mesh_sets), 3)

    def test_contract_requires_generated_geometry_review_evidence(self):
        contract = json.loads(
            (ROOT / "assets/phase18-5/phase18-5-asset-contract.json").read_text()
        )
        quality = contract["visualQuality"]
        self.assertTrue(quality["evidenceUsesGeneratedGeometry"])
        self.assertEqual(quality["conceptDirectionCount"], 3)
        self.assertEqual(len(quality["requiredHandCloseups"]), 5)
        self.assertEqual(quality["requiredRepositoryEvidenceFamilies"], 11)
        self.assertTrue(contract["materials"]["distinctRuntimeIdentityRequired"])
        self.assertEqual(
            len(contract["materials"]["representativeMaterialFamilies"]), 4
        )

    def test_glb_preserves_distinct_non_white_material_identity(self):
        raw = (
            ROOT / "apps/web/public/assets/avatar/aiw-avatar-kit.glb"
        ).read_bytes()
        json_length, _ = struct.unpack_from("<II", raw, 12)
        gltf = json.loads(raw[20 : 20 + json_length])
        materials = {item["name"]: item for item in gltf["materials"]}
        names = [
            "MAT_BODY_warm-light",
            "MAT_BODY_fur-charcoal",
            "MAT_GRAPHITE_PANEL",
            "MAT_MIDNIGHT_PANEL",
            "MAT_SHIRT_Codex",
            "MAT_SHIRT_Hermes",
        ]
        factors = [
            tuple(materials[name]["pbrMetallicRoughness"]["baseColorFactor"])
            for name in names
        ]
        self.assertEqual(len(set(factors)), len(factors))
        self.assertNotIn((1.0, 1.0, 1.0, 1.0), factors)
        for name in names:
            self.assertIn(
                "baseColorTexture",
                materials[name]["pbrMetallicRoughness"],
            )
        for name in ["MAT_CIRCUIT_EMISSIVE", "MAT_CIRCUIT_VIOLET"]:
            self.assertIn("emissiveTexture", materials[name])
            self.assertGreater(max(materials[name]["emissiveFactor"]), 0.2)

    def test_hardware_renderer_classification_covers_software_patterns(self):
        self.assertEqual(
            verify_avatar_assets.classify_renderer(
                "ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Ti, Direct3D11)"
            ),
            "hardware",
        )
        for renderer in [
            "Google SwiftShader",
            "llvmpipe",
            "Mesa lavapipe",
            "softpipe",
            "Microsoft Basic Render Driver",
            None,
        ]:
            self.assertEqual(
                verify_avatar_assets.classify_renderer(renderer),
                "software-emulation",
            )

    def test_hardware_evidence_and_production_fingerprints_are_current(self):
        evidence = json.loads(
            (
                ROOT
                / "artifacts/phase18-5/phase18-5-hardware-measurement.json"
            ).read_text()
        )
        self.assertEqual(
            verify_avatar_assets.validate_hardware_evidence(evidence),
            [],
        )

    def test_hardware_evidence_validation_fails_on_drift_and_threshold(self):
        evidence = json.loads(
            (
                ROOT
                / "artifacts/phase18-5/phase18-5-hardware-measurement.json"
            ).read_text()
        )
        evidence["productionInputs"][
            "packages/renderer-r3f/src/avatar-kit-canvas.tsx"
        ]["sha256"] = "0" * 64
        evidence["metrics"]["cadence"]["p95Ms"] = 16.9
        errors = verify_avatar_assets.validate_hardware_evidence(evidence)
        self.assertIn(
            "production input fingerprint mismatch: "
            "packages/renderer-r3f/src/avatar-kit-canvas.tsx",
            errors,
        )
        self.assertIn("hardware cadence p95 exceeds 16.8 ms", errors)

    def test_hardware_evidence_validation_rejects_non_authored_runtime_lod(self):
        evidence = json.loads(
            (
                ROOT
                / "artifacts/phase18-5/phase18-5-hardware-measurement.json"
            ).read_text()
        )
        evidence["observability"]["agentLod"] = "LOD1"
        errors = verify_avatar_assets.validate_hardware_evidence(evidence)
        self.assertIn(
            "hardware evidence does not prove both avatars at LOD0",
            errors,
        )


if __name__ == "__main__":
    unittest.main()
