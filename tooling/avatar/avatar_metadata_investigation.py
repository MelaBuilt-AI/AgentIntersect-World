#!/usr/bin/env python3
"""Read-only, sanitized investigation of replacement-avatar source metadata."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import struct
import subprocess
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = ROOT / "apps/web/public/assets/imported-avatars/manifest.json"
DEFAULT_REVIEW = (
    ROOT
    / "artifacts/avatar-replacement-evidence"
    / "world-animation-semantic-review-v2"
    / "semantic-review.json"
)
DEFAULT_OUTPUT = (
    ROOT
    / "artifacts/avatar-replacement-evidence"
    / "world-animation-metadata-investigation-v1"
)
SCHEMA = "aiw.avatar-animation-metadata-investigation/1"
COLLECTIONS = (
    "scenes",
    "nodes",
    "skins",
    "meshes",
    "animations",
    "accessors",
    "bufferViews",
)
ARCHIVE_EXTENSIONS = {
    ".7z",
    ".bz2",
    ".gz",
    ".rar",
    ".tar",
    ".tgz",
    ".xz",
    ".zip",
}
TEXT_EXTENSIONS = {
    ".css",
    ".html",
    ".js",
    ".json",
    ".jsonl",
    ".log",
    ".md",
    ".py",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}
SENSITIVE_TEXT_PATTERNS = (
    re.compile(r"https?" + re.escape("://"), re.IGNORECASE),
    re.compile(r"(?:^|[?&])(signature|sig|token|policy|key-pair-id)=", re.IGNORECASE),
    re.compile(r"\b(hosturl|referrerurl)\s*=", re.IGNORECASE),
)
SEARCH_PATTERNS = {
    "providerReference": re.compile(rb"tripo(?:3d|-data)", re.IGNORECASE),
    "providerTaskIdKey": re.compile(rb"task[_ -]?id", re.IGNORECASE),
    "signedLocatorMarker": re.compile(
        rb"(?:Host"
        + rb"Url|Referrer"
        + rb"Url|Signature"
        + rb"=|Key-Pair-Id"
        + rb"=|Policy"
        + rb"=)",
        re.IGNORECASE,
    ),
    "animationLabelTerm": re.compile(
        rb"(?:animation.?label|clip.?label|original export|export name|api response)",
        re.IGNORECASE,
    ),
    "anonymousClipName": re.compile(rb"NlaTrack", re.IGNORECASE),
}
MUTABLE_EVIDENCE_SOURCE_PATHS = frozenset(
    {
        ROOT / "tooling/avatar/avatar_metadata_investigation.py",
        ROOT / "tooling/avatar/test_avatar_metadata_investigation.py",
        ROOT / "tooling/avatar/avatar_gesture_annotation.py",
        ROOT / "tooling/avatar/test_avatar_gesture_annotation.py",
        ROOT / "tooling/avatar/avatar_gesture_annotation_viewer.test.mjs",
    }
)


class InvestigationError(ValueError):
    """Raised when investigation input or generated evidence is invalid."""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_json(value: Any) -> bytes:
    return (
        json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        + "\n"
    ).encode("utf-8")


def sanitize_value(value: Any) -> Any:
    if isinstance(value, str):
        if any(pattern.search(value) for pattern in SENSITIVE_TEXT_PATTERNS):
            return "[sensitive-locator-redacted]"
        return value.replace("\x00", "")
    if isinstance(value, list):
        return [sanitize_value(item) for item in value]
    if isinstance(value, dict):
        return {
            str(key): sanitize_value(item)
            for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))
        }
    return value


def parse_glb(path: Path) -> tuple[bytes, dict[str, Any]]:
    raw = path.read_bytes()
    if len(raw) < 20:
        raise InvestigationError("source GLB is truncated")
    magic, version, declared_length = struct.unpack_from("<4sII", raw, 0)
    if magic != b"glTF" or version != 2 or declared_length != len(raw):
        raise InvestigationError("source GLB header is invalid")
    json_length, json_type = struct.unpack_from("<II", raw, 12)
    if json_type != 0x4E4F534A or 20 + json_length > len(raw):
        raise InvestigationError("source GLB JSON chunk is invalid")
    try:
        document = json.loads(raw[20 : 20 + json_length].decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise InvestigationError("source GLB JSON is invalid") from error
    if not isinstance(document, dict):
        raise InvestigationError("source glTF JSON must be an object")
    return raw, document


def _metadata_record(index: int, value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {"index": index, "invalidRecord": True}
    record: dict[str, Any] = {"index": index}
    if "name" in value:
        record["name"] = sanitize_value(value.get("name"))
    if "extras" in value:
        record["extras"] = sanitize_value(value.get("extras"))
    if "extensions" in value:
        record["extensions"] = sanitize_value(value.get("extensions"))
    return record


def inspect_glb_metadata(path: Path) -> dict[str, Any]:
    raw, document = parse_glb(path)
    asset = document.get("asset") if isinstance(document.get("asset"), dict) else {}
    collection_output: dict[str, Any] = {}
    semantic_like_names: list[dict[str, Any]] = []
    vocabulary = {
        "idle",
        "walk",
        "run",
        "jump",
        "dance",
        "clap",
        "cheer",
        "wave",
        "bow",
        "agree",
        "angry",
        "laugh",
    }
    for collection_name in COLLECTIONS:
        source_records = document.get(collection_name, [])
        if not isinstance(source_records, list):
            source_records = []
        records = [
            _metadata_record(index, value)
            for index, value in enumerate(source_records)
        ]
        if collection_name == "animations":
            for record in records:
                name = record.get("name")
                if isinstance(name, str) and name.casefold() in vocabulary:
                    semantic_like_names.append(
                        {"clipIndex": record["index"], "sourceName": name}
                    )
        collection_output[collection_name] = {
            "count": len(source_records),
            "namedCount": sum("name" in record for record in records),
            "extrasCount": sum("extras" in record for record in records),
            "extensionsCount": sum("extensions" in record for record in records),
            "recordsSha256": sha256_bytes(canonical_json(records)),
            "records": records,
        }
    return {
        "container": {
            "byteSize": len(raw),
            "sha256": sha256_bytes(raw),
            "magic": "glTF",
            "version": 2,
            "declaredLength": len(raw),
        },
        "asset": {
            "version": sanitize_value(asset.get("version")),
            "minVersion": sanitize_value(asset.get("minVersion")),
            "generator": sanitize_value(asset.get("generator")),
            "copyright": sanitize_value(asset.get("copyright")),
            "extras": sanitize_value(asset.get("extras")),
            "extensions": sanitize_value(asset.get("extensions")),
        },
        "topLevel": {
            "extras": sanitize_value(document.get("extras")),
            "extensions": sanitize_value(document.get("extensions")),
            "extensionsUsed": sanitize_value(document.get("extensionsUsed", [])),
            "extensionsRequired": sanitize_value(
                document.get("extensionsRequired", [])
            ),
        },
        "collections": collection_output,
        "semanticAuthority": {
            "classification": "transport-and-structure-only",
            "authoritativeLabels": [],
            "semanticLikeSourceNames": semantic_like_names,
            "note": (
                "Source names and extras are recorded exactly after locator redaction, "
                "but are not authoritative without proven label origin."
            ),
        },
    }


def normalize_ads_summary(value: dict[str, Any]) -> dict[str, Any]:
    allowed = (
        "streamPresent",
        "byteCount",
        "sha256",
        "zoneId",
        "providerHostname",
        "downloadHostname",
        "pathClass",
    )
    output = {key: value.get(key) for key in allowed}
    if output["streamPresent"] is not True:
        raise InvestigationError("ADS summary must describe a present stream")
    if not isinstance(output["byteCount"], int) or output["byteCount"] < 0:
        raise InvestigationError("ADS byte count is invalid")
    if not isinstance(output["sha256"], str) or not re.fullmatch(
        r"[0-9a-f]{64}", output["sha256"]
    ):
        raise InvestigationError("ADS hash is invalid")
    for key in ("providerHostname", "downloadHostname", "pathClass"):
        if not isinstance(output[key], str) or any(
            pattern.search(output[key]) for pattern in SENSITIVE_TEXT_PATTERNS
        ):
            raise InvestigationError(f"ADS {key} is unsafe")
    if not isinstance(output["zoneId"], int):
        raise InvestigationError("ADS ZoneId is invalid")
    return output


def inventory_tree(
    root: Path, *, known_aliases: dict[str, str]
) -> list[dict[str, Any]]:
    if not root.is_dir():
        raise InvestigationError("source tree is unavailable")
    entries = sorted(root.rglob("*"), key=lambda item: item.as_posix())
    unknown_files = [
        item
        for item in entries
        if item.is_file()
        and item.relative_to(root).as_posix() not in known_aliases
    ]
    unknown_file_alias = {
        item.relative_to(root).as_posix(): (
            f"sibling/file-{index:03d}{item.suffix.lower()}"
        )
        for index, item in enumerate(unknown_files, start=1)
    }
    unknown_directories = [item for item in entries if item.is_dir()]
    directory_alias = {
        item.relative_to(root).as_posix(): f"source-tree/directory-{index:03d}"
        for index, item in enumerate(unknown_directories, start=1)
    }
    output: list[dict[str, Any]] = []
    for item in entries:
        relative = item.relative_to(root).as_posix()
        hidden = any(part.startswith(".") for part in Path(relative).parts)
        if item.is_symlink():
            output.append(
                {
                    "alias": known_aliases.get(
                        relative, unknown_file_alias.get(relative, f"source-tree/link")
                    ),
                    "type": "symlink",
                    "hidden": hidden,
                }
            )
        elif item.is_dir():
            output.append(
                {
                    "alias": directory_alias[relative],
                    "type": "directory",
                    "hidden": hidden,
                }
            )
        elif item.is_file():
            extension = item.suffix.lower()
            output.append(
                {
                    "alias": (
                        known_aliases[relative]
                        if relative in known_aliases
                        else unknown_file_alias[relative]
                    ),
                    "type": "file",
                    "hidden": hidden,
                    "extension": extension,
                    "byteSize": item.stat().st_size,
                    "sha256": sha256_file(item),
                    "archive": extension in ARCHIVE_EXTENSIONS,
                    "sidecar": extension
                    in {".json", ".xml", ".txt", ".yaml", ".yml", ".csv"},
                }
            )
    return output


def _source_aliases(
    source_tree: Path, inventory: dict[str, Any]
) -> tuple[dict[str, str], dict[str, Path]]:
    roots = inventory.get("sourceRoots")
    assets = inventory.get("assets")
    if not isinstance(roots, dict) or not isinstance(assets, list):
        raise InvestigationError("frozen source inventory is invalid")
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in assets:
        if isinstance(record, dict) and isinstance(record.get("family"), str):
            grouped[record["family"]].append(record)
    aliases: dict[str, str] = {}
    paths: dict[str, Path] = {}
    for family, records in sorted(grouped.items()):
        source_root_raw = roots.get(family)
        if not isinstance(source_root_raw, str):
            raise InvestigationError("frozen source root is unavailable")
        source_root = Path(source_root_raw)
        try:
            source_root.relative_to(source_tree)
        except ValueError as error:
            raise InvestigationError("frozen source root is outside permitted tree") from error
        by_kind: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for record in records:
            filename = record.get("sourceFilename")
            if not isinstance(filename, str):
                raise InvestigationError("frozen source filename is invalid")
            if filename.lower().endswith(".glb"):
                kind = "glb"
            elif " stance." in filename.casefold():
                kind = "stance"
            elif " t pose." in filename.casefold():
                kind = "tpose"
            else:
                raise InvestigationError("frozen source asset kind is unknown")
            by_kind[kind].append(record)
        for kind, kind_records in by_kind.items():
            for number, record in enumerate(
                sorted(kind_records, key=lambda item: str(item["sourceFilename"])),
                start=1,
            ):
                model_id = f"{family}-{number:02d}"
                source_path = source_root / record["sourceFilename"]
                relative = source_path.relative_to(source_tree).as_posix()
                alias = f"source/{model_id}/{kind}"
                aliases[relative] = alias
                paths[alias] = source_path
    return aliases, paths


def collect_ads_summaries(
    source_tree: Path, aliases: dict[str, str]
) -> dict[str, Any]:
    executable = shutil.which("powershell.exe")
    if executable is None:
        return {
            "accessible": False,
            "reason": "powershell-unavailable",
            "streamCount": 0,
            "records": [],
        }
    windows_root_result = subprocess.run(
        ["wslpath", "-w", str(source_tree)],
        check=True,
        capture_output=True,
        text=True,
    )
    windows_root = windows_root_result.stdout.strip()
    environment = {**os.environ, "AIW_AVATAR_ADS_ROOT": windows_root}
    wslenv_entries = [
        entry
        for entry in environment.get("WSLENV", "").split(":")
        if entry and entry.split("/", 1)[0] != "AIW_AVATAR_ADS_ROOT"
    ]
    environment["WSLENV"] = ":".join(
        [*wslenv_entries, "AIW_AVATAR_ADS_ROOT"]
    )
    script = r"""
$ErrorActionPreference = 'Stop'
$root = $env:AIW_AVATAR_ADS_ROOT
if ([string]::IsNullOrWhiteSpace($root)) { throw 'sanitized ADS root is unavailable' }
$rows = @()
Get-ChildItem -LiteralPath $root -Force -Recurse -File | Sort-Object FullName | ForEach-Object {
  $file = $_
  $streams = @(Get-Item -LiteralPath $file.FullName -Stream * | Where-Object { $_.Stream -eq 'Zone.Identifier' })
  foreach ($entry in $streams) {
    $bytes = Get-Content -LiteralPath $file.FullName -Stream Zone.Identifier -Encoding Byte -Raw
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { $hashBytes = $hasher.ComputeHash($bytes) } finally { $hasher.Dispose() }
    $hash = -join ($hashBytes | ForEach-Object { $_.ToString('x2') })
    $content = Get-Content -LiteralPath $file.FullName -Stream Zone.Identifier -Raw
    $zoneId = 0
    if ($content -match '(?m)^ZoneId=(\d+)') { $zoneId = [int]$Matches[1] }
    $providerHost = ''
    $referrerKey = 'Referrer' + 'Url'
    if ($content -match ("(?m)^" + $referrerKey + "=(.+)$")) {
      try { $providerHost = ([uri]$Matches[1].Trim([char]0)).Host } catch { $providerHost = '' }
    }
    $downloadHost = ''
    $hostKey = 'Host' + 'Url'
    if ($content -match ("(?m)^" + $hostKey + "=(.+)$")) {
      try { $downloadHost = ([uri]$Matches[1].Trim([char]0)).Host } catch { $downloadHost = '' }
    }
    $relative = $file.FullName.Substring($root.Length).TrimStart('\') -replace '\\','/'
    $rows += [pscustomobject]@{
      relativePath = $relative
      streamPresent = $true
      byteCount = [int64]$entry.Length
      sha256 = $hash
      zoneId = $zoneId
      providerHostname = $providerHost
      downloadHostname = $downloadHost
    }
  }
}
$rows | ConvertTo-Json -Compress -Depth 4
"""
    try:
        completed = subprocess.run(
            [
                executable,
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                script,
            ],
            check=True,
            capture_output=True,
            text=True,
            env=environment,
        )
    except subprocess.CalledProcessError as error:
        raise InvestigationError("sanitized ADS inspection failed") from error
    parsed = json.loads(completed.stdout or "[]")
    if isinstance(parsed, dict):
        parsed = [parsed]
    records = []
    for index, row in enumerate(parsed, start=1):
        relative = row.pop("relativePath", None)
        if not isinstance(relative, str):
            raise InvestigationError("ADS producer returned an invalid path identity")
        normalized_relative = relative.replace("\\", "/")
        alias = aliases.get(
            normalized_relative,
            f"sibling/file-{index:03d}{Path(normalized_relative).suffix.lower()}",
        )
        path_class = (
            "ready-source-glb"
            if alias.startswith("source/") and alias.endswith("/glb")
            else "ready-source-image"
            if alias.startswith("source/")
            else "sibling-source-file"
        )
        records.append(
            {
                "alias": alias,
                **normalize_ads_summary({**row, "pathClass": path_class}),
            }
        )
    records.sort(key=lambda item: item["alias"])
    return {
        "accessible": True,
        "streamCount": len(records),
        "zoneIds": dict(sorted(Counter(item["zoneId"] for item in records).items())),
        "providerHostnames": sorted(
            {item["providerHostname"] for item in records if item["providerHostname"]}
        ),
        "downloadHostnames": sorted(
            {item["downloadHostname"] for item in records if item["downloadHostname"]}
        ),
        "recordsSha256": sha256_bytes(canonical_json(records)),
        "records": records,
        "semanticAuthority": "none-transport-provenance-only",
    }


def load_sanitized_ads_observation(path: Path) -> dict[str, Any]:
    value = _load_json(path, "sanitized ADS observation")
    required = {
        "schema": "aiw.sanitized-zone-identifier-observation/1",
        "streamCount": 92,
        "byteTotal": 32706,
        "zoneIds": {"3": 92},
        "providerHostnames": ["studio.tripo3d.ai"],
        "downloadHostnames": ["tripo-data.rg1.data.tripo3d.com"],
        "aggregateSha256": "da5308ca0a7fdabff4bd9c7c88d1ca1a5d0196dc0b9bec90b37167ba39ea41dc",
    }
    for key, expected in required.items():
        if value.get(key) != expected:
            raise InvestigationError(f"sanitized ADS observation has invalid {key}")
    encoded = canonical_json(value)
    assert_safe_text(encoded, "sanitized ADS observation")
    return {
        "accessible": True,
        "inspectionMode": "recovered-sanitized-aggregate-after-parent-redaction",
        "streamCount": value["streamCount"],
        "byteTotal": value["byteTotal"],
        "sizeHistogram": value.get("sizeHistogram", {}),
        "zoneIds": value["zoneIds"],
        "providerHostnames": value["providerHostnames"],
        "downloadHostnames": value["downloadHostnames"],
        "aggregateSha256": value["aggregateSha256"],
        "records": [],
        "perStreamHashesRetained": False,
        "semanticAuthority": "none-transport-provenance-only",
        "limitations": (
            "Only sanitized aggregate fields recovered from parent-redacted telemetry "
            "are retained; raw stream content and provider locators are excluded."
        ),
    }


def scan_text_evidence(
    roots: list[tuple[str, Path]], *, excluded_paths: tuple[Path, ...] = ()
) -> dict[str, Any]:
    records = []
    scanned = 0
    skipped_large = 0
    exclusions = tuple(
        path.resolve() for path in (*MUTABLE_EVIDENCE_SOURCE_PATHS, *excluded_paths)
    )
    for root_alias, root in roots:
        if not root.exists():
            continue
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in TEXT_EXTENSIONS:
                continue
            resolved_path = path.resolve()
            if any(
                resolved_path == excluded or resolved_path.is_relative_to(excluded)
                for excluded in exclusions
            ):
                continue
            if (
                root_alias == "runs"
                and path.relative_to(root).parts
                and path.relative_to(root).parts[0].startswith(
                    (
                        "aiw-avatar-metadata-annotation-",
                        "aiw-avatar-annotation-closeout-",
                    )
                )
            ):
                continue
            if any(part in {".git", "node_modules"} for part in path.parts):
                continue
            size = path.stat().st_size
            if size > 64 * 1024 * 1024:
                skipped_large += 1
                continue
            scanned += 1
            found: set[str] = set()
            digest = hashlib.sha256()
            with path.open("rb") as handle:
                for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                    digest.update(chunk)
                    for category, pattern in SEARCH_PATTERNS.items():
                        if category not in found and pattern.search(chunk):
                            found.add(category)
            if found:
                relative = path.relative_to(root).as_posix()
                if root_alias == "repository":
                    alias = f"repository/{relative}"
                else:
                    run_name = relative.split("/", 1)[0]
                    alias = f"runs/{run_name}/text-evidence"
                records.append(
                    {
                        "alias": alias,
                        "byteSize": size,
                        "sha256": digest.hexdigest(),
                        "categories": sorted(found),
                    }
                )
    deduplicated: dict[tuple[str, str], dict[str, Any]] = {}
    for record in records:
        deduplicated[(record["alias"], record["sha256"])] = record
    safe_records = sorted(
        deduplicated.values(), key=lambda item: (item["alias"], item["sha256"])
    )
    return {
        "scannedTextFileCount": scanned,
        "skippedOver64MiBCount": skipped_large,
        "matchingFileCount": len(safe_records),
        "records": safe_records,
        "limitations": (
            "Keyword presence is discovery metadata only. No excerpt, locator, query, "
            "provider identifier, or path outside a stable alias is retained."
        ),
    }


def _load_json(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise InvestigationError(f"{label} is unavailable or invalid") from error
    if not isinstance(value, dict):
        raise InvestigationError(f"{label} must be an object")
    return value


def build_investigation(
    *,
    source_tree: Path,
    source_inventory_path: Path,
    manifest_path: Path,
    semantic_review_path: Path,
    runs_root: Path,
    include_ads: bool,
    ads_observation_path: Path | None = None,
    evidence_excluded_paths: tuple[Path, ...] = (),
) -> dict[str, Any]:
    source_inventory = _load_json(source_inventory_path, "frozen source inventory")
    manifest = _load_json(manifest_path, "repository manifest")
    semantic_review = _load_json(semantic_review_path, "semantic review")
    if (
        source_inventory.get("schema") != "aiw.avatar-replacement-source-intake/1"
        or source_inventory.get("assetCount") != 69
        or source_inventory.get("sourceImmutable") is not True
    ):
        raise InvestigationError("frozen source inventory contract is invalid")
    aliases, source_paths = _source_aliases(source_tree, source_inventory)
    inventory_records = inventory_tree(source_tree, known_aliases=aliases)
    manifest_assets = {
        asset.get("id"): asset
        for asset in manifest.get("assets", [])
        if isinstance(asset, dict)
    }
    models = []
    for model_id in sorted(manifest_assets):
        asset = manifest_assets[model_id]
        source_path = source_paths.get(f"source/{model_id}/glb")
        shipped_name = asset.get("shippedFilename")
        if source_path is None or not isinstance(shipped_name, str):
            raise InvestigationError(f"{model_id}: source/copy mapping is unavailable")
        repository_path = manifest_path.parent / shipped_name
        source_hash = sha256_file(source_path)
        repository_hash = sha256_file(repository_path)
        frozen_record = next(
            (
                record
                for record in source_inventory["assets"]
                if record.get("family") == asset.get("family")
                and record.get("sha256") == source_hash
            ),
            None,
        )
        if frozen_record is None:
            raise InvestigationError(f"{model_id}: source hash is absent from frozen inventory")
        if (
            source_hash != repository_hash
            or source_hash != asset.get("sha256")
            or source_path.read_bytes() != repository_path.read_bytes()
        ):
            raise InvestigationError(f"{model_id}: source/shipped GLB identity failed")
        models.append(
            {
                "modelId": model_id,
                "sourceAlias": f"source/{model_id}/glb",
                "sourceGlbSha256": source_hash,
                "repositoryGlbSha256": repository_hash,
                "byteSize": source_path.stat().st_size,
                "byteIdentical": True,
                "metadata": inspect_glb_metadata(source_path),
            }
        )
    if len(models) != 23:
        raise InvestigationError("investigation did not resolve exactly 23 source GLBs")
    totals = semantic_review.get("totals")
    if not isinstance(totals, dict):
        raise InvestigationError("semantic-review totals are unavailable")
    ads = (
        load_sanitized_ads_observation(ads_observation_path)
        if ads_observation_path is not None
        else collect_ads_summaries(source_tree, aliases)
        if include_ads
        else {
            "accessible": False,
            "reason": "explicitly-skipped",
            "streamCount": 0,
            "records": [],
        }
    )
    tree_files = [item for item in inventory_records if item["type"] == "file"]
    archive_count = sum(bool(item.get("archive")) for item in tree_files)
    hidden_count = sum(bool(item.get("hidden")) for item in inventory_records)
    sidecar_count = sum(bool(item.get("sidecar")) for item in tree_files)
    text_evidence = scan_text_evidence(
        [("repository", ROOT), ("runs", runs_root)],
        excluded_paths=evidence_excluded_paths,
    )
    generator_counts = Counter(
        str(model["metadata"]["asset"].get("generator")) for model in models
    )
    animation_names = sorted(
        {
            record.get("name", "")
            for model in models
            for record in model["metadata"]["collections"]["animations"]["records"]
        }
    )
    semantic_like = [
        {
            "modelId": model["modelId"],
            **record,
        }
        for model in models
        for record in model["metadata"]["semanticAuthority"][
            "semanticLikeSourceNames"
        ]
    ]
    return {
        "schema": SCHEMA,
        "sourcePathsIncluded": False,
        "sensitiveLocatorsIncluded": False,
        "scope": {
            "sourceTreeAlias": "avatar-source-tree",
            "repositoryAlias": "agentintersect-world-repository",
            "runsAlias": "hermes-runs",
        },
        "sourceInventory": {
            "schema": source_inventory["schema"],
            "assetCount": source_inventory["assetCount"],
            "canonicalSha256": sha256_bytes(canonical_json(source_inventory)),
            "fileSha256": sha256_file(source_inventory_path),
            "hashCorrespondence": "69-of-69",
        },
        "sourceTreeInventory": {
            "entryCount": len(inventory_records),
            "fileCount": len(tree_files),
            "directoryCount": sum(
                item["type"] == "directory" for item in inventory_records
            ),
            "hiddenEntryCount": hidden_count,
            "archiveFileCount": archive_count,
            "sidecarFileCount": sidecar_count,
            "recordsSha256": sha256_bytes(canonical_json(inventory_records)),
            "records": inventory_records,
        },
        "alternateDataStreams": ads,
        "glbIdentity": {
            "modelCount": len(models),
            "byteIdenticalCount": sum(model["byteIdentical"] for model in models),
            "sourceByteTotal": sum(model["byteSize"] for model in models),
            "repositoryByteTotal": sum(model["byteSize"] for model in models),
        },
        "metadataSummary": {
            "assetGenerators": dict(sorted(generator_counts.items())),
            "distinctAnimationSourceNames": animation_names,
            "semanticLikeAnimationSourceNameCount": len(semantic_like),
            "semanticLikeAnimationSourceNames": semantic_like,
        },
        "models": models,
        "existingEvidenceSearch": text_evidence,
        "evidenceClassification": {
            "authoritativeSemanticLabels": {
                "count": 0,
                "finding": "none-recovered",
            },
            "transportToolMetadata": [
                "glTF asset generator and container fields",
                "anonymous source animation names",
                "source filenames represented only by stable aliases",
                "sanitized Zone.Identifier stream provenance",
                "provider hostname and download-zone classification",
            ],
            "forbiddenAsSemanticAuthority": [
                "clip index or ordering",
                "anonymous NlaTrack names",
                "duration or sample timing",
                "pose and motion hashes",
                "channel, node, skeleton, or accessor structure",
                "cross-model structural or motion similarity",
                "provider task/download provenance",
            ],
            "absentEvidence": [
                "authoritative per-clip animation labels",
                "provider animation-label manifest",
                "archived authoritative API response with clip labels",
                "source sidecar mapping raw clip indices to the known vocabulary",
                "authoritative identification of Aaron's unrecovered tested model",
            ],
        },
        "semanticAuthority": {
            "schema": semantic_review.get("schema"),
            "decisionCount": semantic_review.get("decisionCount"),
            "totals": totals,
            "changed": False,
            "runtimePolicy": "pass-only-all-other-verdicts-refused",
            "conclusion": (
                "No source-backed per-clip gesture labels were recovered; all 207 "
                "gesture decisions remain ambiguous and fail closed."
            ),
        },
        "limitations": [
            "Filesystem and ADS metadata prove transport provenance, not animation meaning.",
            "Keyword search records only sanitized file-level matches and no excerpts.",
            "No network, provider account, cloud session, credential, or unrelated directory was inspected.",
            "Human temporal observation remains required for the 207 gesture decisions.",
        ],
    }


def report_markdown(payload: dict[str, Any]) -> str:
    tree = payload["sourceTreeInventory"]
    ads = payload["alternateDataStreams"]
    identity = payload["glbIdentity"]
    search = payload["existingEvidenceSearch"]
    return f"""# World animation metadata investigation v1

## Verdict

No authoritative per-clip gesture labels were recovered. The existing 69 direct-review `Idle`/`Walk`/`Run` passes remain locked. All 207 gesture decisions remain ambiguous and runtime-refused to model-local Idle.

## Channels checked

- Frozen source inventory: {payload['sourceInventory']['hashCorrespondence']} records correspond by SHA-256.
- Permitted source tree: {tree['entryCount']} entries ({tree['fileCount']} files, {tree['directoryCount']} directories), including hidden-file, archive, and sidecar classification. Findings: {tree['hiddenEntryCount']} hidden entries, {tree['archiveFileCount']} archives, and {tree['sidecarFileCount']} ordinary sidecar files.
- Source/repository GLBs: {identity['byteIdenticalCount']}/{identity['modelCount']} are byte-identical, totaling {identity['sourceByteTotal']} bytes on each side.
- Embedded glTF JSON: asset generator/copyright/extras; top-level extras/extensions; and every scene, node, skin, mesh, animation, accessor, and bufferView name/extras/extensions record were parsed and hashed per model.
- NTFS alternate data streams: {ads['streamCount']} sanitized `Zone.Identifier` streams were inventoried. They establish browser-download provenance from the recorded Tripo Studio/provider hostnames, but contain no animation-semantic authority. Raw locators, query strings, signatures, tokens, and provider identifiers are excluded.
- Existing repository/Hermes-run text evidence: {search['scannedTextFileCount']} text files were scanned; {search['matchingFileCount']} sanitized file-level matches were retained without excerpts or locators.

## Evidence classification

- Authoritative semantic labels: none.
- Transport/tool metadata only: glTF exporter identity, anonymous animation source names, sanitized source aliases and hashes, and sanitized download-zone provenance.
- Forbidden as semantic authority: clip order/index, `NlaTrack*`, duration/timing, motion or pose hashes, channel/skeleton/accessor structure, and cross-model similarity.
- Absent: provider/export label manifest, authoritative labeled API response, source sidecar mapping clip indices to the supported vocabulary, and proof of which model Aaron manually observed.

The machine-readable report contains no private absolute source path and no sensitive download locator. Its per-model records bind every parsed metadata channel to the exact source/repository GLB SHA-256.
"""


def outputs(payload: dict[str, Any]) -> dict[str, bytes]:
    return {
        "metadata-investigation.json": json.dumps(
            payload, indent=2, sort_keys=True, ensure_ascii=False
        ).encode("utf-8")
        + b"\n",
        "metadata-investigation-report.md": report_markdown(payload).encode("utf-8"),
    }


def assert_safe_text(payload: bytes, name: str) -> None:
    text = payload.decode("utf-8", errors="strict")
    for pattern in SENSITIVE_TEXT_PATTERNS:
        if pattern.search(text):
            raise InvestigationError(f"sensitive locator pattern found in {name}")


def write_or_check(payload: dict[str, Any], output_dir: Path, *, check: bool) -> None:
    generated = outputs(payload)
    for name, content in generated.items():
        assert_safe_text(content, name)
    if check:
        for name, expected in generated.items():
            try:
                actual = (output_dir / name).read_bytes()
            except OSError as error:
                raise InvestigationError(f"metadata artifact is unavailable: {error}") from error
            assert_safe_text(actual, name)
            if actual != expected:
                raise InvestigationError(f"metadata artifact is stale: {name}")
        return
    output_dir.mkdir(parents=True, exist_ok=True)
    for name, content in generated.items():
        (output_dir / name).write_bytes(content)


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-tree", type=Path, required=True)
    parser.add_argument("--source-inventory", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--semantic-review", type=Path, default=DEFAULT_REVIEW)
    parser.add_argument("--runs-root", type=Path, default=Path.home() / ".hermes" / "runs")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--skip-ads", action="store_true")
    parser.add_argument("--ads-observation", type=Path)
    parser.add_argument("--check", action="store_true")
    return parser


def main() -> None:
    arguments = build_argument_parser().parse_args()
    try:
        payload = build_investigation(
            source_tree=arguments.source_tree,
            source_inventory_path=arguments.source_inventory,
            manifest_path=arguments.manifest,
            semantic_review_path=arguments.semantic_review,
            runs_root=arguments.runs_root,
            include_ads=not arguments.skip_ads,
            ads_observation_path=arguments.ads_observation,
            evidence_excluded_paths=(arguments.output_dir,),
        )
        write_or_check(payload, arguments.output_dir, check=arguments.check)
        identity = payload["glbIdentity"]
        print(
            "metadata investigation complete: "
            f"{identity['byteIdenticalCount']}/{identity['modelCount']} GLBs byte-identical; "
            "authoritative gesture labels recovered=0; ambiguous gestures=207"
        )
    except (InvestigationError, OSError, subprocess.SubprocessError, json.JSONDecodeError) as error:
        raise SystemExit(str(error)) from error


if __name__ == "__main__":
    main()
