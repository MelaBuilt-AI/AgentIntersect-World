from __future__ import annotations

import copy
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

import avatar_gesture_annotation as annotation


SEMANTICS = ("Idle", "Walk", "Run", *annotation.GESTURE_SEMANTICS)


def fixtures() -> tuple[dict, dict]:
    semantic_clips = {semantic: index for index, semantic in enumerate(SEMANTICS)}
    manifest = {
        "schema": "fixture-manifest/1",
        "assets": [
            {
                "id": "fixture-model-01",
                "sha256": "1" * 64,
                "clips": [
                    {
                        "index": index,
                        "name": f"NlaTrack.{index:03d}",
                        "durationSeconds": float(index + 1),
                    }
                    for index in range(len(SEMANTICS) + 1)
                ],
                "semanticClips": semantic_clips,
            }
        ],
    }
    review = {
        "schema": "aiw.world-animation-semantic-review/2",
        "decisions": [
            {
                "modelId": "fixture-model-01",
                "semantic": semantic,
                "verdict": "pass" if semantic in {"Idle", "Walk", "Run"} else "ambiguous",
                "reviewedClipIndex": index,
                "expectedClipIndex": index if semantic in {"Idle", "Walk", "Run"} else None,
                "rationale": "fixture evidence",
                "evidenceRefs": ["fixture:evidence"],
            }
            for index, semantic in enumerate(SEMANTICS)
        ],
    }
    return manifest, review


def complete_document() -> tuple[dict, dict, dict]:
    manifest, review = fixtures()
    document = annotation.build_template(manifest, review)
    document["reviewer"] = {
        "name": "Fixture Reviewer",
        "reviewedAt": "2026-08-01T00:00:00Z",
    }
    model = document["models"][0]
    for semantic, clip in zip(annotation.GESTURE_SEMANTICS, model["clips"]):
        clip["annotation"] = {
            "decision": semantic,
            "evidenceReference": f"human-temporal-review:fixture/{clip['clipIndex']}",
            "notes": f"Observed the complete temporal motion for {semantic}.",
        }
    document["progress"] = {
        "resolvedDecisionCount": len(annotation.GESTURE_SEMANTICS),
        "remainingDecisionCount": 0,
    }
    return manifest, review, document


class AvatarGestureAnnotationTest(unittest.TestCase):
    def test_template_and_output_are_deterministic_and_partial_is_fail_closed(self) -> None:
        manifest, review = fixtures()
        first = annotation.build_template(manifest, review)
        second = annotation.build_template(copy.deepcopy(manifest), copy.deepcopy(review))
        self.assertEqual(annotation.canonical_json(first), annotation.canonical_json(second))

        diagnostics = annotation.validate_document(first, manifest, review, require_complete=False)
        self.assertEqual(diagnostics["resolvedDecisionCount"], 0)
        self.assertEqual(diagnostics["remainingDecisionCount"], 9)
        self.assertFalse(diagnostics["complete"])
        with self.assertRaisesRegex(annotation.AnnotationError, "incomplete"):
            annotation.validate_document(first, manifest, review, require_complete=True)

        package = annotation.package_outputs(manifest, review)
        self.assertEqual(package, annotation.package_outputs(manifest, review))
        viewer = package["viewer.html"].decode("utf-8")
        self.assertIn('id="scrub"', viewer)
        self.assertIn('id="loop"', viewer)
        self.assertIn('id="exportButton"', viewer)
        self.assertIn("The tool never suggests a semantic", viewer)
        self.assertIn("annotation-batches.json", package)

        module_match = re.search(
            r'<script type="module">(?P<source>.*?)</script>', viewer, re.DOTALL
        )
        self.assertIsNotNone(module_match)
        node = shutil.which("node")
        self.assertIsNotNone(node, "Node 24 is required for the viewer syntax gate")
        with tempfile.TemporaryDirectory() as directory:
            module_path = Path(directory) / "viewer.mjs"
            module_path.write_text(module_match.group("source"), encoding="utf-8")
            syntax = subprocess.run(
                [node, "--check", str(module_path)],
                check=False,
                capture_output=True,
                text=True,
            )
        self.assertEqual(syntax.returncode, 0, syntax.stderr)

    def test_batch_plan_is_deterministic_complete_bound_and_non_authoritative(self) -> None:
        manifest, review = fixtures()
        template = annotation.build_template(manifest, review)
        first = annotation.build_batch_plan(template)
        second = annotation.build_batch_plan(copy.deepcopy(template))
        self.assertEqual(annotation.canonical_json(first), annotation.canonical_json(second))
        annotation.validate_batch_plan(first, template)

        self.assertEqual(first["strategy"], "one-model-per-batch")
        self.assertEqual(first["batchCount"], template["modelCount"])
        self.assertEqual(first["modelCount"], template["modelCount"])
        self.assertEqual(
            first["unresolvedDecisionCount"], template["unresolvedDecisionCount"]
        )
        self.assertEqual(
            first["rawNonLocomotionClipCount"],
            template["rawNonLocomotionClipCount"],
        )
        batch_models = [batch["modelId"] for batch in first["batches"]]
        self.assertEqual(len(batch_models), len(set(batch_models)))
        batch_clips = {
            (batch["modelId"], clip_index)
            for batch in first["batches"]
            for clip_index in batch["rawClipIndices"]
        }
        template_clips = {
            (model["modelId"], clip["clipIndex"])
            for model in template["models"]
            for clip in model["clips"]
        }
        self.assertEqual(batch_clips, template_clips)
        encoded = annotation.canonical_json(first).decode("utf-8")
        for forbidden_field in (
            '"annotation"',
            '"decision"',
            '"evidenceReference"',
            '"notes"',
            '"reviewer"',
        ):
            self.assertNotIn(forbidden_field, encoded)
        self.assertFalse(first["authorityMutation"])

        stale = copy.deepcopy(first)
        stale["batches"][0]["sourceGlbSha256"] = "0" * 64
        with self.assertRaisesRegex(annotation.AnnotationError, "stale or malformed"):
            annotation.validate_batch_plan(stale, template)

    def test_malformed_and_stale_documents_are_rejected(self) -> None:
        manifest, review = fixtures()
        document = annotation.build_template(manifest, review)
        malformed = copy.deepcopy(document)
        malformed.pop("schema")
        with self.assertRaisesRegex(annotation.AnnotationError, "schema"):
            annotation.validate_document(malformed, manifest, review, require_complete=False)

        stale = copy.deepcopy(document)
        stale["models"][0]["sourceGlbSha256"] = "2" * 64
        with self.assertRaisesRegex(annotation.AnnotationError, "stale source GLB hash"):
            annotation.validate_document(stale, manifest, review, require_complete=False)

    def test_unsupported_vocabulary_and_duplicate_assignments_are_rejected(self) -> None:
        manifest, review = fixtures()
        document = annotation.build_template(manifest, review)
        clips = document["models"][0]["clips"]
        clips[0]["annotation"] = {
            "decision": "Turn",
            "evidenceReference": "human-temporal-review:fixture/0",
            "notes": "Observed a turn.",
        }
        with self.assertRaisesRegex(annotation.AnnotationError, "unsupported decision"):
            annotation.validate_document(document, manifest, review, require_complete=False)

        duplicate = annotation.build_template(manifest, review)
        for clip in duplicate["models"][0]["clips"][:2]:
            clip["annotation"] = {
                "decision": "Jump",
                "evidenceReference": "human-temporal-review:fixture/duplicate",
                "notes": "Conclusive duplicate fixture.",
            }
        with self.assertRaisesRegex(annotation.AnnotationError, "duplicate semantic assignment"):
            annotation.validate_document(duplicate, manifest, review, require_complete=False)

    def test_conclusive_entries_require_notes_and_evidence(self) -> None:
        manifest, review = fixtures()
        document = annotation.build_template(manifest, review)
        document["models"][0]["clips"][0]["annotation"] = {
            "decision": "Jump",
            "evidenceReference": "",
            "notes": "",
        }
        with self.assertRaisesRegex(annotation.AnnotationError, "evidence"):
            annotation.validate_document(document, manifest, review, require_complete=False)

    def test_uncertain_annotations_require_string_fields_and_progress_is_exact(self) -> None:
        manifest, review = fixtures()
        document = annotation.build_template(manifest, review)
        annotation_record = document["models"][0]["clips"][0]["annotation"]
        annotation_record.pop("notes")
        with self.assertRaisesRegex(annotation.AnnotationError, "annotation fields"):
            annotation.validate_document(document, manifest, review, require_complete=False)

        wrong_type = annotation.build_template(manifest, review)
        wrong_type["models"][0]["clips"][0]["annotation"]["evidenceReference"] = []
        with self.assertRaisesRegex(annotation.AnnotationError, "must be strings"):
            annotation.validate_document(wrong_type, manifest, review, require_complete=False)

        stale_progress = annotation.build_template(manifest, review)
        stale_progress["progress"] = {
            "resolvedDecisionCount": 1,
            "remainingDecisionCount": 8,
        }
        with self.assertRaisesRegex(annotation.AnnotationError, "progress"):
            annotation.validate_document(
                stale_progress, manifest, review, require_complete=False
            )

    def test_complete_reviewed_at_requires_timezone_aware_iso_8601(self) -> None:
        manifest, review, document = complete_document()
        for malformed in (
            "yesterday",
            "2026-08-01T00:00:00",
            "2026-08-01",
        ):
            candidate = copy.deepcopy(document)
            candidate["reviewer"]["reviewedAt"] = malformed
            with self.subTest(malformed=malformed):
                with self.assertRaisesRegex(annotation.AnnotationError, "timezone-aware"):
                    annotation.validate_document(
                        candidate, manifest, review, require_complete=True
                    )

    def test_durable_proposal_text_rejects_sensitive_locators_and_private_paths(self) -> None:
        manifest, review, document = complete_document()
        unsafe_values = (
            "https://example.invalid/download",
            "token=redacted-fixture",
            "signature: redacted-fixture",
            "C:\\private\\avatar.glb",
            "/mnt/private/avatar.glb",
            "/home/private/avatar.glb",
            "HostUrl=redacted-fixture",
            "ReferrerUrl=redacted-fixture",
        )
        for unsafe in unsafe_values:
            candidate = copy.deepcopy(document)
            candidate["models"][0]["clips"][0]["annotation"][
                "evidenceReference"
            ] = unsafe
            with self.subTest(kind=unsafe.split(":", 1)[0]):
                with self.assertRaisesRegex(annotation.AnnotationError, "unsafe locator") as raised:
                    annotation.build_proposal(candidate, manifest, review)
                self.assertNotIn(unsafe, str(raised.exception))

        safe = copy.deepcopy(document)
        safe["models"][0]["clips"][0]["annotation"] = {
            "decision": "Jump",
            "evidenceReference": "human-temporal-review:session/model/clip",
            "notes": "artifacts/avatar-replacement-evidence/review/session.md",
        }
        annotation.build_proposal(safe, manifest, review)

    def test_complete_proposal_reports_wrong_clip_without_mutating_authority(self) -> None:
        manifest, review, document = complete_document()
        clips = document["models"][0]["clips"]
        clips[0]["annotation"]["decision"] = "Dance"
        clips[1]["annotation"]["decision"] = "Jump"

        diagnostics = annotation.validate_document(document, manifest, review, require_complete=True)
        proposal = annotation.build_proposal(document, manifest, review)

        self.assertTrue(diagnostics["complete"])
        self.assertEqual(diagnostics["resolvedDecisionCount"], 9)
        jump = next(item for item in proposal["decisions"] if item["semantic"] == "Jump")
        self.assertEqual(jump["verdict"], "wrong_clip")
        self.assertEqual(jump["reviewedClipIndex"], 3)
        self.assertEqual(jump["expectedClipIndex"], 4)
        self.assertEqual(review["decisions"][3]["verdict"], "ambiguous")

    def test_model_level_unsupported_is_valid_and_conflicts_are_rejected(self) -> None:
        manifest, review, document = complete_document()
        model = document["models"][0]
        laugh_clip = next(
            clip for clip in model["clips"] if clip["annotation"]["decision"] == "Laugh"
        )
        laugh_clip["annotation"] = {
            "decision": "unsupported",
            "evidenceReference": "human-temporal-review:fixture/no-laugh-clip",
            "notes": "This raw clip does not match the supported vocabulary.",
        }
        model["unsupportedSemantics"] = [
            {
                "semantic": "Laugh",
                "evidenceReference": "human-temporal-review:fixture/all-clips",
                "notes": "All raw non-locomotion clips were reviewed; none is Laugh.",
            }
        ]
        diagnostics = annotation.validate_document(document, manifest, review, require_complete=True)
        self.assertTrue(diagnostics["complete"])

        conflict = copy.deepcopy(document)
        conflict["models"][0]["clips"][0]["annotation"]["decision"] = "Laugh"
        with self.assertRaisesRegex(annotation.AnnotationError, "both assigned and unsupported"):
            annotation.validate_document(conflict, manifest, review, require_complete=False)


if __name__ == "__main__":
    unittest.main()
