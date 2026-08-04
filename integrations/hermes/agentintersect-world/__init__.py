"""AgentIntersect World Hermes lifecycle and same-session arbiter plugin.

The plugin never answers approvals, injects prompts, or emits raw messages, tool
arguments/results, persona text, memory, transcripts, paths, or credentials.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import fcntl
import threading
import time
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_SCHEMA = "aiw.hermes-plugin-event/0.12"
_MAX_EVENTS = 512
_SAFE_TOOL = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-")
_STATE_WRITE_LOCK = threading.Lock()
_TURN_LOCKS: dict[str, Any] = {}
_WORLD_REF = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._:-/")
_CURRENT_SESSION: ContextVar[object | None] = ContextVar(
    "agentintersect_world_current_session", default=None
)


def _home() -> Path:
    configured = os.environ.get("HERMES_HOME")
    return Path(configured) if configured else Path.home() / ".hermes"


def _state_dir() -> Path:
    target = _home() / "agentintersect-world"
    target.mkdir(parents=True, exist_ok=True, mode=0o700)
    target.chmod(0o700)
    return target


def _hash(value: object) -> str:
    return hashlib.sha256(str(value or "").encode("utf-8", "replace")).hexdigest()


def _safe_tool(value: object) -> str:
    text = "".join(character for character in str(value or "") if character in _SAFE_TOOL)
    return text[:64] or "unknown"


def _append(kind: str, session_id: object = None, **bounded: Any) -> None:
    allowed = {
        "tool": _safe_tool(bounded.get("tool")) if "tool" in bounded else None,
        "completed": bool(bounded.get("completed")) if "completed" in bounded else None,
        "interrupted": bool(bounded.get("interrupted")) if "interrupted" in bounded else None,
        "choice": str(bounded.get("choice"))[:24]
        if bounded.get("choice") in {"once", "session", "permanent", "deny"}
        else None,
        "surface": str(bounded.get("surface"))[:24]
        if bounded.get("surface") in {"cli", "gateway"}
        else None,
    }
    event = {
        "schema": _SCHEMA,
        "event_id": hashlib.sha256(
            f"{kind}:{session_id}:{datetime.now(timezone.utc).isoformat()}".encode()
        ).hexdigest()[:32],
        "kind": kind,
        "native_session_hash": _hash(session_id),
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        **{key: value for key, value in allowed.items() if value is not None},
    }
    with _STATE_WRITE_LOCK:
        target = _state_dir() / "events.jsonl"
        existing = target.read_text("utf-8").splitlines()[-(_MAX_EVENTS - 1) :] if target.exists() else []
        temporary = target.with_suffix(f".{threading.get_ident()}.tmp")
        temporary.write_text("\n".join([*existing, json.dumps(event, sort_keys=True)]) + "\n", "utf-8")
        temporary.chmod(0o600)
        os.replace(temporary, target)
        target.chmod(0o600)


def _write_capabilities(world_actions: bool) -> None:
    capability = {
        "schema": "aiw.hermes-plugin-capabilities/0.13",
        "plugin": "agentintersect-world",
        "version": "0.13.0",
        "sameSessionArbiter": "fcntl-turn-lock-v1",
        "worldActions": {
            "enabled": world_actions,
            "protocol": "aiw.world-action/0.13",
            "proposalHelper": "propose_world_action",
            "maximumBatchActions": 8,
            "maximumEnvelopeBytes": 16384,
            "defaultTtlMs": 30000,
            "maximumTtlMs": 120000,
            "rateActionsPerSecond": 4,
            "rateBurstActions": 8,
            "maximumQueuedActions": 32,
            **(
                {}
                if world_actions
                else {
                    "unavailableReason": "Hermes does not expose plugin tool registration; chat and manual navigation remain available."
                }
            ),
        },
    }
    target = _state_dir() / "capabilities.json"
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(capability, sort_keys=True, indent=2) + "\n", "utf-8")
    temporary.chmod(0o600)
    os.replace(temporary, target)
    target.chmod(0o600)


def _world_ref(value: object) -> str:
    text = str(value)
    if (
        not text.startswith("aiw://object/")
        or len(text.encode("utf-8")) > 256
        or any(character not in _WORLD_REF for character in text)
    ):
        raise ValueError("World Action target must be a stable World object ref")
    return text


def _target(value: object) -> dict[str, str]:
    if not isinstance(value, dict):
        raise ValueError("World Action target must be an object")
    if set(value) - {"repositoryRef", "objectRef", "requestedPath"}:
        raise ValueError("World Action target contains an unknown field")
    if set(value) < {"repositoryRef", "objectRef"}:
        raise ValueError("World Action target is incomplete")
    target = {
        "repositoryRef": _world_ref(value["repositoryRef"]),
        "objectRef": _world_ref(value["objectRef"]),
    }
    if "requestedPath" in value:
        requested = str(value["requestedPath"])
        if not requested or len(requested.encode("utf-8")) > 512:
            raise ValueError("World Action requested path is invalid")
        target["requestedPath"] = requested
    return target


def _validate_action(value: object) -> dict[str, Any]:
    if not isinstance(value, dict) or not isinstance(value.get("kind"), str):
        raise ValueError("World Action must be a discriminated object")
    kind = value["kind"]
    target_kinds = {"navigate", "focus", "inspect", "highlight", "point-at", "follow"}
    output: dict[str, Any] = {"kind": kind}
    if kind in target_kinds:
        allowed = {"kind", "target"}
        output["target"] = _target(value.get("target"))
    elif kind in {"trace", "compare"}:
        allowed = {"kind", "target", "destination"}
        output["target"] = _target(value.get("target"))
        output["destination"] = _target(value.get("destination"))
    elif kind == "annotate-temporary":
        allowed = {"kind", "target", "text", "ttlSeconds"}
        output["target"] = _target(value.get("target"))
        text = value.get("text")
        ttl = value.get("ttlSeconds")
        if not isinstance(text, str) or not text or len(text.encode("utf-8")) > 2048:
            raise ValueError("Temporary annotation is outside bounds")
        if not isinstance(ttl, int) or isinstance(ttl, bool) or ttl < 1 or ttl > 120:
            raise ValueError("Temporary annotation TTL is outside bounds")
        output.update({"text": text, "ttlSeconds": ttl})
    elif kind == "present-evidence":
        allowed = {"kind", "target", "relationshipRefs"}
        output["target"] = _target(value.get("target"))
        relationships = value.get("relationshipRefs")
        if not isinstance(relationships, list) or len(relationships) > 512:
            raise ValueError("Evidence relationship list is outside bounds")
        output["relationshipRefs"] = [
            str(item) for item in relationships if isinstance(item, str) and 0 < len(item) <= 256
        ]
        if len(output["relationshipRefs"]) != len(relationships):
            raise ValueError("Evidence relationship ref is invalid")
    elif kind == "clear":
        allowed = {"kind", "scope"}
        if value.get("scope") not in {"presentation", "timeline-unpinned", "all-clearable"}:
            raise ValueError("Clear scope is invalid")
        output["scope"] = value["scope"]
    elif kind == "cancel":
        allowed = {"kind", "targetType", "targetId"}
        if value.get("targetType") not in {"action", "batch"}:
            raise ValueError("Cancellation target type is invalid")
        try:
            target_id = str(uuid.UUID(str(value.get("targetId"))))
        except (ValueError, AttributeError) as error:
            raise ValueError("Cancellation target ID is invalid") from error
        output.update({"targetType": value["targetType"], "targetId": target_id})
    elif kind == "move-agent":
        allowed = {"kind", "schema", "actorId", "source", "speed", "target"}
        actor_id = value.get("actorId")
        speed = value.get("speed")
        target = value.get("target")
        if value.get("schema") != "aiw.agent-movement/1":
            raise ValueError("Agent movement schema is invalid")
        if (
            not isinstance(actor_id, str)
            or not 1 <= len(actor_id) <= 256
            or actor_id[0] not in _SAFE_TOOL
            or any(character not in _SAFE_TOOL for character in actor_id)
        ):
            raise ValueError("Agent movement actor is invalid")
        if value.get("source") != "agent-autonomous":
            raise ValueError("Plugin movement source is invalid")
        if (
            not isinstance(speed, (int, float))
            or isinstance(speed, bool)
            or not math.isfinite(speed)
            or speed <= 0
            or speed > 12
        ):
            raise ValueError("Agent movement speed is invalid")
        if not isinstance(target, dict) or not isinstance(target.get("kind"), str):
            raise ValueError("Agent movement target is invalid")
        target_kind = target["kind"]
        if target_kind == "relative":
            target_allowed = {"kind", "direction", "distance", "stoppingRadius"}
            distance = target.get("distance")
            if target.get("direction") not in {"forward", "backward", "left", "right"}:
                raise ValueError("Agent movement direction is invalid")
            if (
                not isinstance(distance, (int, float))
                or isinstance(distance, bool)
                or not math.isfinite(distance)
                or distance <= 0
                or distance > 30
            ):
                raise ValueError("Agent movement distance is invalid")
        elif target_kind == "coordinate":
            target_allowed = {"kind", "x", "z", "stoppingRadius"}
            for coordinate in (target.get("x"), target.get("z")):
                if (
                    not isinstance(coordinate, (int, float))
                    or isinstance(coordinate, bool)
                    or not math.isfinite(coordinate)
                    or coordinate < -15
                    or coordinate > 15
                ):
                    raise ValueError("Agent movement coordinate is invalid")
        elif target_kind == "follow-user":
            target_allowed = {"kind", "stoppingRadius"}
        else:
            raise ValueError("Agent movement target kind is invalid")
        if set(target) - target_allowed or "kind" not in target:
            raise ValueError("Agent movement target contains an unknown field")
        radius = target.get("stoppingRadius")
        if radius is not None and (
            not isinstance(radius, (int, float))
            or isinstance(radius, bool)
            or not math.isfinite(radius)
            or radius < 0.25
            or radius > 5
        ):
            raise ValueError("Agent movement stopping radius is invalid")
        if target_kind == "follow-user" and radius is None:
            raise ValueError("Agent follow stopping radius is required")
        output.update({
            "schema": value["schema"],
            "actorId": actor_id,
            "source": value["source"],
            "speed": speed,
            "target": target,
        })
    else:
        raise ValueError("World Action kind is not allowlisted")
    if set(value) != allowed:
        raise ValueError("World Action contains an unknown or missing field")
    return output


def _read_action_source_state(target: Path) -> dict[str, dict[str, float | int]]:
    try:
        value = json.loads(target.read_text("utf-8"))
        if (
            not isinstance(value, dict)
            or value.get("schema") != "aiw.hermes-world-action-source-state/0.13"
            or not isinstance(value.get("sources"), dict)
        ):
            return {}
        sources: dict[str, dict[str, float | int]] = {}
        for source, record in list(value["sources"].items())[:64]:
            if (
                isinstance(source, str)
                and len(source) == 64
                and isinstance(record, dict)
                and isinstance(record.get("sequence"), int)
                and record["sequence"] >= 0
                and isinstance(record.get("tokens"), (int, float))
                and isinstance(record.get("updatedAt"), (int, float))
            ):
                sources[source] = {
                    "sequence": record["sequence"],
                    "tokens": max(0.0, min(8.0, float(record["tokens"]))),
                    "updatedAt": float(record["updatedAt"]),
                }
        return sources
    except (OSError, ValueError, TypeError):
        return {}


def _write_action_source_state(
    target: Path, sources: dict[str, dict[str, float | int]]
) -> None:
    retained = dict(
        sorted(
            sources.items(),
            key=lambda item: float(item[1]["updatedAt"]),
            reverse=True,
        )[:64]
    )
    temporary = target.with_name(
        f".{target.name}.{os.getpid()}.{threading.get_ident()}.tmp"
    )
    temporary.write_text(
        json.dumps(
            {
                "schema": "aiw.hermes-world-action-source-state/0.13",
                "sources": retained,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n",
        "utf-8",
    )
    temporary.chmod(0o600)
    os.replace(temporary, target)
    target.chmod(0o600)


def _propose_world_action(actions=None, ttl_ms=30000, **kwargs):
    if kwargs:
        raise ValueError("World Action proposal contains unknown fields")
    if not isinstance(actions, list) or not 1 <= len(actions) <= 8:
        raise ValueError("World Action proposal requires 1-8 actions")
    if not isinstance(ttl_ms, int) or isinstance(ttl_ms, bool) or not 1000 <= ttl_ms <= 120000:
        raise ValueError("World Action proposal TTL is outside bounds")
    session_id = _CURRENT_SESSION.get()
    if session_id is None:
        raise ValueError("World Action proposal requires an adapter-owned active session")
    native_hash = _hash(session_id)
    validated = [_validate_action(action) for action in actions]
    state_directory = _state_dir()
    proposals = state_directory / "world-action-proposals"
    proposals.mkdir(parents=True, exist_ok=True, mode=0o700)
    proposals.chmod(0o700)
    lock_path = state_directory / "world-action-source.lock"
    with lock_path.open("a+", encoding="utf-8") as lock:
        os.chmod(lock.name, 0o600)
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        source_state_path = state_directory / "world-action-source-state.json"
        sources = _read_action_source_state(source_state_path)
        now = time.time()
        source = sources.get(
            native_hash, {"sequence": 0, "tokens": 8.0, "updatedAt": now}
        )
        tokens = min(
            8.0,
            float(source["tokens"])
            + max(0.0, now - float(source["updatedAt"])) * 4.0,
        )
        if tokens < len(actions):
            raise ValueError("World Action proposal rate limit exceeded")
        queued = 0
        spooled_sequence = 0
        for queued_file in proposals.glob("*.json"):
            try:
                queued_proposal = json.loads(queued_file.read_text("utf-8"))
                queued += len(queued_proposal.get("actions", []))
                if queued_proposal.get("nativeSessionHash") == native_hash:
                    spooled_sequence = max(
                        spooled_sequence, int(queued_proposal.get("sequence", 0))
                    )
            except (OSError, ValueError, TypeError):
                queued = 32
                break
        if queued + len(validated) > 32:
            raise ValueError("World Action proposal queue is full")
        proposal_id = str(uuid.uuid4())
        sequence = max(int(source["sequence"]), spooled_sequence) + 1
        envelope = {
            "schema": "aiw.hermes-world-action-proposal/0.13",
            "proposalId": proposal_id,
            "nativeSessionHash": native_hash,
            "sequence": sequence,
            "createdAt": datetime.now(timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
            "ttlMs": ttl_ms,
            "actions": validated,
        }
        encoded = (
            json.dumps(envelope, sort_keys=True, separators=(",", ":")) + "\n"
        ).encode("utf-8")
        if len(encoded) > 16384:
            raise ValueError("World Action proposal exceeds 16384 UTF-8 bytes")
        temporary = proposals / f".{proposal_id}.tmp"
        temporary.write_bytes(encoded)
        temporary.chmod(0o600)
        target = proposals / f"{proposal_id}.json"
        os.replace(temporary, target)
        target.chmod(0o600)
        sources[native_hash] = {
            "sequence": sequence,
            "tokens": tokens - len(validated),
            "updatedAt": now,
        }
        _write_action_source_state(source_state_path, sources)
        fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
    return {"status": "proposed", "proposalId": proposal_id, "actionCount": len(validated)}


def _world_action_tool_handler(args, **_runtime_context):
    if not isinstance(args, dict):
        raise ValueError("World Action proposal must be an object")
    return json.dumps(
        _propose_world_action(**args),
        sort_keys=True,
        separators=(",", ":"),
    )


def _acquire_turn(session_id: object) -> None:
    """Serialize the exact native session across every Hermes surface."""
    native_hash = _hash(session_id)
    locks = _state_dir() / "turn-locks"
    locks.mkdir(parents=True, exist_ok=True, mode=0o700)
    locks.chmod(0o700)
    handle = (locks / f"{native_hash}.lock").open("a+", encoding="utf-8")
    handle.truncate(0)
    os.chmod(handle.name, 0o600)
    fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
    _TURN_LOCKS[native_hash] = handle


def _release_turn(session_id: object) -> None:
    native_hash = _hash(session_id)
    handle = _TURN_LOCKS.pop(native_hash, None)
    if handle is None:
        return
    try:
        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
    finally:
        handle.close()


def _avatar_source(session_id: object) -> None:
    """Derive only allowlisted traits locally; raw SOUL text is never written."""
    soul_path = _home() / "SOUL.md"
    try:
        soul = soul_path.read_text("utf-8")[:131_072].casefold() if soul_path.is_file() else ""
    except OSError:
        soul = ""
    species = "cat" if "cat" in soul else "dog" if "dog" in soul else "human"
    proposal = {
        "schema": "aiw.hermes-avatar-source/0.12",
        "native_session_hash": _hash(session_id),
        "displayName": "Hermes",
        "species": species,
        "head": species if species in {"cat", "dog"} else "round",
        "hands": "paws" if species in {"cat", "dog"} else "hands",
        "feet": "paws" if species in {"cat", "dog"} else "feet",
        "fur": "short" if species in {"cat", "dog"} else "none",
        "tail": species if species in {"cat", "dog"} else "none",
        "markings": "tuxedo" if species == "cat" and "tuxedo" in soul else "solid",
        "bodyColor": "charcoal" if "black" in soul or "charcoal" in soul else "cool-medium",
        "shirt": "Hermes",
        "movementStyle": "shared-biped-core",
        "sourceDisclosure": "Derived locally by the Hermes plugin from allowlisted persona traits.",
        "rationale": "A bounded visual proposal awaiting operator consent.",
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    target = _state_dir() / "avatar-proposal.json"
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(proposal, sort_keys=True, indent=2) + "\n", "utf-8")
    temporary.chmod(0o600)
    os.replace(temporary, target)
    target.chmod(0o600)


def _pre_llm_call(session_id=None, **_kwargs):
    _acquire_turn(session_id)
    try:
        _CURRENT_SESSION.set(session_id)
        _append("turn.started", session_id)
        _avatar_source(session_id)
    except Exception:
        _release_turn(session_id)
        raise
    return None


def _post_llm_call(session_id=None, **_kwargs):
    try:
        _append("turn.completed", session_id)
    finally:
        _release_turn(session_id)


def _pre_tool_call(tool_name=None, task_id=None, **_kwargs):
    _append("tool.started", task_id, tool=tool_name)


def _post_tool_call(tool_name=None, task_id=None, **_kwargs):
    _append("tool.completed", task_id, tool=tool_name)


def _pre_approval_request(session_key=None, surface=None, **_kwargs):
    _append("approval.requested", session_key, surface=surface)


def _post_approval_response(session_key=None, surface=None, choice=None, **_kwargs):
    _append("approval.resolved", session_key, surface=surface, choice=choice)


def _on_session_start(session_id=None, **_kwargs):
    _append("session.started", session_id)


def _on_session_end(session_id=None, completed=False, interrupted=False, **_kwargs):
    try:
        _append(
            "session.ended",
            session_id,
            completed=completed,
            interrupted=interrupted,
        )
    finally:
        _CURRENT_SESSION.set(None)
        _release_turn(session_id)


def register(ctx):
    """Register bounded callbacks; no tool or approval authority is added."""
    register_tool = getattr(ctx, "register_tool", None)
    world_actions = False
    if callable(register_tool):
        try:
            register_tool(
                name="propose_world_action",
                toolset="agentintersect_world_presentation",
                schema={
                    "name": "propose_world_action",
                    "description": "Propose 1-8 bounded presentation-only World actions. This cannot edit, execute, approve, or mutate repository state.",
                    "parameters": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["actions"],
                        "properties": {
                            "actions": {
                                "type": "array",
                                "minItems": 1,
                                "maxItems": 8,
                                "items": {"type": "object"},
                            },
                            "ttl_ms": {
                                "type": "integer",
                                "minimum": 1000,
                                "maximum": 120000,
                                "default": 30000,
                            },
                        },
                    },
                },
                handler=_world_action_tool_handler,
                description="Presentation-only AgentIntersect World navigation helper",
            )
            world_actions = True
        except (TypeError, ValueError):
            world_actions = False
    _write_capabilities(world_actions)
    ctx.register_hook("pre_llm_call", _pre_llm_call)
    ctx.register_hook("post_llm_call", _post_llm_call)
    ctx.register_hook("pre_tool_call", _pre_tool_call)
    ctx.register_hook("post_tool_call", _post_tool_call)
    ctx.register_hook("pre_approval_request", _pre_approval_request)
    ctx.register_hook("post_approval_response", _post_approval_response)
    ctx.register_hook("on_session_start", _on_session_start)
    ctx.register_hook("on_session_end", _on_session_end)
