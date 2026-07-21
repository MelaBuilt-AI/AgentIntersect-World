"""AgentIntersect World Hermes lifecycle and same-session arbiter plugin.

The plugin never answers approvals, injects prompts, or emits raw messages, tool
arguments/results, persona text, memory, transcripts, paths, or credentials.
"""

from __future__ import annotations

import hashlib
import json
import os
import fcntl
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_SCHEMA = "aiw.hermes-plugin-event/0.12"
_MAX_EVENTS = 512
_SAFE_TOOL = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-")
_STATE_WRITE_LOCK = threading.Lock()
_TURN_LOCKS: dict[str, Any] = {}


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


def _write_capabilities() -> None:
    capability = {
        "schema": "aiw.hermes-plugin-capabilities/0.12",
        "plugin": "agentintersect-world",
        "version": "0.12.0",
        "sameSessionArbiter": "fcntl-turn-lock-v1",
    }
    target = _state_dir() / "capabilities.json"
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(capability, sort_keys=True, indent=2) + "\n", "utf-8")
    temporary.chmod(0o600)
    os.replace(temporary, target)
    target.chmod(0o600)


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
        _release_turn(session_id)


def register(ctx):
    """Register bounded callbacks; no tool or approval authority is added."""
    _write_capabilities()
    ctx.register_hook("pre_llm_call", _pre_llm_call)
    ctx.register_hook("post_llm_call", _post_llm_call)
    ctx.register_hook("pre_tool_call", _pre_tool_call)
    ctx.register_hook("post_tool_call", _post_tool_call)
    ctx.register_hook("pre_approval_request", _pre_approval_request)
    ctx.register_hook("post_approval_response", _post_approval_response)
    ctx.register_hook("on_session_start", _on_session_start)
    ctx.register_hook("on_session_end", _on_session_end)
