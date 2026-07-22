import importlib.util
import json
import os
import stat
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

sys.dont_write_bytecode = True


class Context:
    def __init__(self):
        self.hooks = {}
        self.tools = {}

    def register_hook(self, name, callback):
        self.hooks[name] = callback

    def register_tool(self, *, name, handler, **metadata):
        self.tools[name] = (handler, metadata)


def load_plugin(plugin_dir: Path):
    spec = importlib.util.spec_from_file_location(
        "agentintersect_world_plugin",
        plugin_dir / "__init__.py",
        submodule_search_locations=[str(plugin_dir)],
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class PluginConformanceTest(unittest.TestCase):
    def test_world_action_source_sequence_survives_reload_and_is_atomic(self):
        with tempfile.TemporaryDirectory(prefix="aiw-hermes-action-source-") as temporary:
            home = Path(temporary)
            plugin_dir = Path(__file__).parent / "agentintersect-world"
            action = {
                "kind": "focus",
                "target": {
                    "repositoryRef": "aiw://object/repository-a",
                    "objectRef": "aiw://object/package-a",
                },
            }
            with patch.dict(os.environ, {"HERMES_HOME": str(home)}):
                first = load_plugin(plugin_dir)
                first._CURRENT_SESSION.set("effective-stream-a")
                first._propose_world_action(actions=[action])
                first._propose_world_action(actions=[action])

                reloaded = load_plugin(plugin_dir)
                reloaded._CURRENT_SESSION.set("effective-stream-a")
                reloaded._propose_world_action(actions=[action])
                reloaded._CURRENT_SESSION.set("effective-stream-b")
                reloaded._propose_world_action(actions=[action])

                errors = []

                def publish():
                    try:
                        reloaded._CURRENT_SESSION.set("effective-stream-c")
                        reloaded._propose_world_action(actions=[action])
                    except Exception as error:
                        errors.append(error)

                workers = [threading.Thread(target=publish) for _ in range(8)]
                for worker in workers:
                    worker.start()
                for worker in workers:
                    worker.join(timeout=2)

            self.assertEqual(errors, [])
            proposals = [
                json.loads(candidate.read_text("utf-8"))
                for candidate in (
                    home / "agentintersect-world" / "world-action-proposals"
                ).glob("*.json")
            ]
            by_stream = {}
            for proposal in proposals:
                by_stream.setdefault(proposal["nativeSessionHash"], []).append(
                    proposal["sequence"]
                )
            self.assertEqual(sorted(by_stream[first._hash("effective-stream-a")]), [1, 2, 3])
            self.assertEqual(by_stream[first._hash("effective-stream-b")], [1])
            self.assertEqual(sorted(by_stream[first._hash("effective-stream-c")]), list(range(1, 9)))

    def test_observer_outputs_are_bounded_redacted_and_approvals_unchanged(self):
        with tempfile.TemporaryDirectory(prefix="aiw-hermes-plugin-") as temporary:
            home = Path(temporary)
            canary = "RAW_PERSONA_CANARY sk-secretcanary /home/private transcript memory"
            (home / "SOUL.md").write_text(
                f"# {canary}\nA charcoal tuxedo cat.\n", "utf-8"
            )
            with patch.dict(os.environ, {"HERMES_HOME": str(home)}):
                plugin = load_plugin(Path(__file__).parent / "agentintersect-world")
                context = Context()
                plugin.register(context)
                self.assertEqual(
                    set(context.hooks),
                    {
                        "pre_llm_call",
                        "post_llm_call",
                        "pre_tool_call",
                        "post_tool_call",
                        "pre_approval_request",
                        "post_approval_response",
                        "on_session_start",
                        "on_session_end",
                    },
                )
                capability = json.loads(
                    (home / "agentintersect-world" / "capabilities.json").read_text(
                        "utf-8"
                    )
                )
                self.assertEqual(
                    capability["sameSessionArbiter"], "fcntl-turn-lock-v1"
                )
                self.assertEqual(capability["schema"], "aiw.hermes-plugin-capabilities/0.13")
                self.assertEqual(capability["worldActions"]["protocol"], "aiw.world-action/0.13")
                self.assertTrue(capability["worldActions"]["enabled"])
                self.assertEqual(set(context.tools), {"propose_world_action"})
                helper, metadata = context.tools["propose_world_action"]
                self.assertEqual(metadata["toolset"], "agentintersect_world_presentation")
                self.assertFalse(
                    metadata["schema"]["parameters"]["additionalProperties"]
                )
                context.hooks["pre_llm_call"](session_id="same-session")
                receipt_json = helper(
                    {"actions": [
                        {
                            "kind": "navigate",
                            "target": {
                                "repositoryRef": "aiw://object/repository-a",
                                "objectRef": "aiw://object/package-spatial-code-graph",
                            },
                        }
                    ]},
                )
                self.assertIsInstance(receipt_json, str)
                receipt = json.loads(receipt_json)
                self.assertEqual(receipt["status"], "proposed")
                proposal = json.loads(
                    (home / "agentintersect-world" / "world-action-proposals" / f"{receipt['proposalId']}.json").read_text("utf-8")
                )
                self.assertEqual(proposal["schema"], "aiw.hermes-world-action-proposal/0.13")
                self.assertRegex(
                    proposal["createdAt"],
                    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$",
                )
                self.assertEqual(proposal["actions"][0]["kind"], "navigate")
                self.assertNotIn("session_id", proposal)
                self.assertNotIn("batchId", proposal)
                context.hooks["post_llm_call"](session_id="same-session")
                with self.assertRaises(ValueError):
                    helper(
                        {"session_id": "model-chosen-session", "actions": [
                            {
                                "kind": "focus",
                                "target": {
                                    "repositoryRef": "aiw://object/repository-a",
                                    "objectRef": "aiw://object/package-spatial-code-graph",
                                },
                            }
                        ]},
                    )
                context.hooks["pre_llm_call"](session_id="same-session")
                with self.assertRaises(ValueError):
                    helper(
                        {"actions": [
                            {
                                "kind": "navigate",
                                "target": {
                                    "repositoryRef": "aiw://object/repository-a",
                                    "objectRef": "aiw://object/package-spatial-code-graph",
                                },
                                "actionId": "model-owned-id",
                            }
                        ]},
                    )
                context.hooks["post_llm_call"](session_id="same-session")

                first_acquired = threading.Event()
                release_first = threading.Event()
                second_acquired = threading.Event()

                def first_turn():
                    context.hooks["pre_llm_call"](session_id="same-session")
                    first_acquired.set()
                    release_first.wait(timeout=2)
                    context.hooks["post_llm_call"](session_id="same-session")

                def second_turn():
                    first_acquired.wait(timeout=2)
                    context.hooks["pre_llm_call"](session_id="same-session")
                    second_acquired.set()
                    context.hooks["post_llm_call"](session_id="same-session")

                first = threading.Thread(target=first_turn)
                second = threading.Thread(target=second_turn)
                first.start()
                second.start()
                first_acquired.wait(timeout=2)
                time.sleep(0.05)
                self.assertFalse(second_acquired.is_set())
                release_first.set()
                first.join(timeout=2)
                second.join(timeout=2)
                self.assertTrue(second_acquired.is_set())
                for interrupted in (True, False):
                    context.hooks["pre_llm_call"](session_id="failed-session")
                    self.assertIn(plugin._hash("failed-session"), plugin._TURN_LOCKS)
                    context.hooks["on_session_end"](
                        session_id="failed-session",
                        completed=False,
                        interrupted=interrupted,
                    )
                    self.assertNotIn(plugin._hash("failed-session"), plugin._TURN_LOCKS)
                    reacquired = threading.Event()

                    def after_failed_turn():
                        context.hooks["pre_llm_call"](session_id="failed-session")
                        reacquired.set()
                        context.hooks["post_llm_call"](session_id="failed-session")

                    replacement = threading.Thread(target=after_failed_turn)
                    replacement.start()
                    replacement.join(timeout=2)
                    self.assertTrue(reacquired.is_set())
                self.assertIsNone(
                    context.hooks["pre_llm_call"](
                        session_id="20260721_011618_330489c8",
                        user_message=canary,
                        conversation_history=[{"content": canary}],
                    )
                )
                context.hooks["on_session_end"](
                    session_id="20260721_011618_330489c8",
                    completed=False,
                    interrupted=True,
                )
                context.hooks["pre_tool_call"](
                    tool_name="terminal",
                    args={"secret": canary},
                    task_id="20260721_011618_330489c8",
                )
                self.assertIsNone(
                    context.hooks["pre_approval_request"](
                        session_key="discord-secret-lane",
                        command=canary,
                        surface="gateway",
                    )
                )
                self.assertIsNone(
                    context.hooks["post_approval_response"](
                        session_key="discord-secret-lane",
                        command=canary,
                        surface="gateway",
                        choice="deny",
                    )
                )
            state = home / "agentintersect-world"
            emitted = (state / "events.jsonl").read_text("utf-8") + (
                state / "avatar-proposal.json"
            ).read_text("utf-8")
            self.assertNotIn(canary, emitted)
            self.assertNotIn("secretcanary", emitted)
            self.assertNotIn("/home/private", emitted)
            proposal = json.loads(
                (state / "avatar-proposal.json").read_text("utf-8")
            )
            self.assertEqual(proposal["species"], "cat")
            self.assertEqual(proposal["markings"], "tuxedo")
            self.assertTrue(proposal["createdAt"].endswith("Z"))
            self.assertNotIn("+00:00", proposal["createdAt"])
            for output in [
                state,
                state / "events.jsonl",
                state / "avatar-proposal.json",
                state / "capabilities.json",
                state / "world-action-source.lock",
                state / "world-action-source-state.json",
            ]:
                mode = stat.S_IMODE(output.stat().st_mode)
                self.assertEqual(mode, 0o700 if output.is_dir() else 0o600)


if __name__ == "__main__":
    unittest.main()
