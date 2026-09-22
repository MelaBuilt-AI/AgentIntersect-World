"""Independently parse and enforce the frozen Phase 18.5 avatar asset contract."""
from __future__ import annotations

import hashlib
import json
import re
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = ROOT / "assets/phase18-5/phase18-5-asset-contract.json"
MANIFEST = ROOT / "assets/avatar/aiw-avatar-kit.manifest.json"
GLB = ROOT / "apps/web/public/assets/avatar/aiw-avatar-kit.glb"
BLEND = ROOT / "assets/avatar/aiw-avatar-kit.blend"
BLEND_INSPECTION = ROOT / "assets/avatar/aiw-avatar-kit.blend-inspection.json"
GLB_INSPECTION = ROOT / "assets/avatar/aiw-avatar-kit.glb-inspection.json"
HARDWARE_EVIDENCE = (
    ROOT / "docs/internal/artifacts/phase18-5/phase18-5-hardware-measurement.json"
)
PRODUCTION_INPUTS = (
    "packages/renderer-r3f/src/avatar-kit-canvas.tsx",
    "packages/renderer-r3f/src/world-room-canvas.tsx",
    "packages/renderer-r3f/src/index.ts",
    "packages/avatar-system/src/index.ts",
    "apps/web/public/assets/avatar/aiw-avatar-kit.glb",
)
SOFTWARE_RENDERER_PATTERNS = (
    "swiftshader",
    "llvmpipe",
    "lavapipe",
    "softpipe",
    "software raster",
    "microsoft basic render driver",
    "software emulation",
)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json_if_changed(path: Path, payload: object) -> bool:
    try:
        if json.loads(path.read_text(encoding="utf-8")) == payload:
            return False
    except (OSError, json.JSONDecodeError):
        pass
    path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return True


def classify_renderer(renderer: object) -> str:
    if not isinstance(renderer, str) or not renderer.strip():
        return "software-emulation"
    normalized = renderer.lower()
    if any(pattern in normalized for pattern in SOFTWARE_RENDERER_PATTERNS):
        return "software-emulation"
    return "hardware"


def _validate_evidence_integrity(evidence: dict) -> list[str]:
    errors: list[str] = []
    browser = evidence.get("browser", {})
    observability = evidence.get("observability", {})
    thresholds = evidence.get("thresholds", {})
    metrics = evidence.get("metrics", {})
    cadence = metrics.get("cadence", {})
    render_work = metrics.get("renderWork", {})
    long_tasks = metrics.get("longTasks", {})
    sampling = evidence.get("sampling", {})
    if evidence.get("schema") != "aiw.phase18-5.hardware-measurement/1":
        errors.append("hardware evidence schema is invalid")
    if evidence.get("authority") != "hardware":
        errors.append("hardware evidence authority is not hardware")
    if evidence.get("passed") is not True:
        errors.append("hardware evidence is not marked passed")
    if browser.get("name") != "Microsoft Edge":
        errors.append("hardware evidence browser is not Microsoft Edge")
    if not re.fullmatch(r"\d+\.\d+\.\d+\.\d+", str(browser.get("version", ""))):
        errors.append("hardware evidence browser version is invalid")
    if classify_renderer(browser.get("renderer")) != "hardware":
        errors.append("hardware evidence renderer is software-emulated")
    if not re.search(
        r"nvidia geforce rtx 5070 ti.*(?:direct3d11|d3d11)",
        str(browser.get("renderer", "")),
        re.IGNORECASE,
    ):
        errors.append(
            "hardware evidence renderer is not the approved NVIDIA RTX 5070 Ti D3D11 path"
        )
    if browser.get("errors") != []:
        errors.append("hardware browser errors are not empty")
    if (
        observability.get("userLod") != "LOD0"
        or observability.get("agentLod") != "LOD0"
    ):
        errors.append("hardware evidence does not prove both avatars at LOD0")
    if observability.get("renderLoop") != "continuous":
        errors.append("hardware evidence does not prove the continuous render loop")
    if observability.get("renderLoopMode") != "continuous-native":
        errors.append("hardware evidence does not prove continuous-native mode")
    if observability.get("cosmeticQuality") != "full":
        errors.append("hardware evidence does not prove full cosmetic quality")
    if observability.get("renderDpr") != "1":
        errors.append("hardware evidence does not prove DPR 1")
    if observability.get("antialias") is not True:
        errors.append("hardware evidence does not prove antialiasing")
    if thresholds != {
        "renderWorkP95Ms": 16.7,
        "cadenceP95Ms": 16.8,
        "longestTaskMs": 100,
    }:
        errors.append("hardware evidence thresholds differ from the frozen contract")
    if (
        not isinstance(render_work.get("p95Ms"), (int, float))
        or render_work["p95Ms"] > 16.7
    ):
        errors.append("hardware render-work p95 exceeds 16.7 ms")
    if (
        not isinstance(cadence.get("p95Ms"), (int, float))
        or cadence["p95Ms"] > 16.8
    ):
        errors.append("hardware cadence p95 exceeds 16.8 ms")
    if (
        not isinstance(long_tasks.get("maxMs"), (int, float))
        or long_tasks["maxMs"] > 100
    ):
        errors.append("hardware Long Task maximum exceeds 100 ms")
    if sampling.get("warmupFrames") != 45:
        errors.append("hardware evidence warmup is not 45 frames")
    if sampling.get("cadenceSamples") != 120:
        errors.append("hardware evidence cadence sample count is not 120")
    if sampling.get("renderSamples") != 24:
        errors.append("hardware evidence render sample count is not 24")
    if cadence.get("samplesOverThreshold") != 0:
        errors.append("hardware evidence has cadence samples above 16.8 ms")
    if evidence.get("visualQa", {}).get("passed") is not True:
        errors.append("hardware visual QA is not marked passed")

    fingerprints = evidence.get("productionInputs", {})
    fingerprint_keys = set(fingerprints) if isinstance(fingerprints, dict) else set()
    if fingerprint_keys != set(PRODUCTION_INPUTS):
        errors.append(
            "historical production input fingerprint keys differ from the frozen contract"
        )
    if isinstance(fingerprints, dict):
        for relative_path, entry in fingerprints.items():
            recorded = entry.get("sha256") if isinstance(entry, dict) else None
            if not isinstance(recorded, str) or not re.fullmatch(r"[a-f0-9]{64}", recorded):
                errors.append(
                    f"historical production input fingerprint is invalid: {relative_path}"
                )
    screenshot = evidence.get("screenshot", {})
    screenshot_path = screenshot.get("path")
    resolved_screenshot = (
        ROOT / "docs/internal" / screenshot_path if isinstance(screenshot_path, str) else None
    )
    if (
        resolved_screenshot is None
        or not resolved_screenshot.is_file()
        or screenshot.get("sha256") != sha(resolved_screenshot)
    ):
        errors.append("hardware screenshot fingerprint mismatch")
    return errors


def validate_historical_evidence(evidence: dict) -> list[str]:
    return _validate_evidence_integrity(evidence)


def validate_hardware_evidence(evidence: dict) -> list[str]:
    """Validate retained milestone evidence without binding later source bytes."""
    return _validate_evidence_integrity(evidence)


def parse_glb(path: Path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", raw, 0)
    if magic != b"glTF" or version != 2 or length != len(raw):
        raise ValueError("invalid GLB header")
    chunk_len, chunk_type = struct.unpack_from("<II", raw, 12)
    if chunk_type != 0x4E4F534A:
        raise ValueError("missing GLB JSON chunk")
    document = json.loads(raw[20:20 + chunk_len].decode("utf-8"))
    return raw, document, 20 + chunk_len + 8


def main(compatibility_only: bool = False) -> int:
    contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    blend_inspection = json.loads(BLEND_INSPECTION.read_text(encoding="utf-8"))
    raw, gltf, binary_offset = parse_glb(GLB)
    nodes = gltf.get("nodes", [])
    node_names = {node.get("name") for node in nodes}
    animations = gltf.get("animations", [])
    animation_names = {animation.get("name") for animation in animations}

    def accessor_bytes(index: int) -> bytes:
        accessor = gltf["accessors"][index]
        view = gltf["bufferViews"][accessor["bufferView"]]
        component_sizes = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
        element_widths = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
        width = component_sizes[accessor["componentType"]] * element_widths[accessor["type"]]
        start = binary_offset + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        stride = view.get("byteStride", width)
        if stride == width:
            return raw[start:start + accessor["count"] * width]
        return b"".join(
            raw[start + item * stride:start + item * stride + width]
            for item in range(accessor["count"])
        )

    def mesh_signature(node_name: str) -> str:
        mesh = gltf["meshes"][next(node["mesh"] for node in nodes if node.get("name") == node_name)]
        digest = hashlib.sha256()
        for primitive in mesh["primitives"]:
            digest.update(accessor_bytes(primitive["attributes"]["POSITION"]))
            if "indices" in primitive:
                digest.update(accessor_bytes(primitive["indices"]))
        return digest.hexdigest()

    def mesh_triangles(node_name: str) -> int:
        mesh = gltf["meshes"][next(node["mesh"] for node in nodes if node.get("name") == node_name)]
        return sum(
            gltf["accessors"][primitive["indices"]]["count"] // 3
            for primitive in mesh["primitives"]
            if "indices" in primitive
        )

    required_actions = set(contract["rig"]["requiredActions"])
    required_expressions = set(contract["expressions"]["requiredForEveryHeadFamily"])
    head_nodes = [
        node for node in nodes
        if isinstance(node.get("name"), str) and node["name"].startswith("HEAD_")
    ]
    head_morphs = {}
    for node in head_nodes:
        mesh = gltf["meshes"][node["mesh"]]
        head_morphs[node["name"]] = sorted(
            mesh.get("extras", {}).get("targetNames", [])
        )
    skins = gltf.get("skins", [])
    joint_names = {
        nodes[index].get("name")
        for skin in skins
        for index in skin.get("joints", [])
    }
    animation_targets = {
        animation["name"]: {
            nodes[channel["target"]["node"]].get("name")
            for channel in animation.get("channels", [])
        }
        for animation in animations
    }
    animation_signatures = {}
    for animation in animations:
        digest = hashlib.sha256()
        for channel in sorted(
            animation["channels"],
            key=lambda item: (
                nodes[item["target"]["node"]].get("name", ""),
                item["target"]["path"],
            ),
        ):
            sampler = animation["samplers"][channel["sampler"]]
            digest.update(nodes[channel["target"]["node"]].get("name", "").encode())
            digest.update(channel["target"]["path"].encode())
            digest.update(accessor_bytes(sampler["input"]))
            digest.update(accessor_bytes(sampler["output"]))
        animation_signatures[animation["name"]] = digest.hexdigest()

    module_groups = {
        "hands": [f"HAND_{kind}_L" for kind in ("hands", "paws", "clawed-paws")],
        "feet": [f"FOOT_{kind}_L" for kind in ("feet", "paws", "clawed-paws")],
        "fur": [f"FUR_{kind}" for kind in ("none", "short", "long")],
        "tails": [
            f"TAIL_{kind}"
            for kind in ("none", "cat-straight", "cat-curled", "dog-straight", "dog-curled")
        ],
        "markings": [f"MARKING_{kind}" for kind in ("solid", "muzzle", "mask", "socks")],
    }
    module_signatures = {
        group: {name: mesh_signature(name) for name in names}
        for group, names in module_groups.items()
    }
    texture_roles = set()
    for material in gltf.get("materials", []):
        pbr = material.get("pbrMetallicRoughness", {})
        if "baseColorTexture" in pbr:
            texture_roles.add("baseColor")
        if "metallicRoughnessTexture" in pbr:
            texture_roles.add("orm")
        if "normalTexture" in material:
            texture_roles.add("normal")
        if "emissiveTexture" in material:
            texture_roles.add("emissive")
    glb_materials = {
        material.get("name"): material for material in gltf.get("materials", [])
    }
    representative_materials = [
        "MAT_BODY_warm-light",
        "MAT_BODY_fur-charcoal",
        "MAT_GRAPHITE_PANEL",
        "MAT_MIDNIGHT_PANEL",
        "MAT_SHIRT_Codex",
        "MAT_SHIRT_Hermes",
    ]
    material_identities = {
        name: glb_materials.get(name, {})
        .get("pbrMetallicRoughness", {})
        .get("baseColorFactor")
        for name in representative_materials
    }
    emissive_identities = {
        name: glb_materials.get(name, {}).get("emissiveFactor")
        for name in ("MAT_CIRCUIT_EMISSIVE", "MAT_CIRCUIT_VIOLET")
    }
    material_identity_pass = (
        all(
            isinstance(factor, list)
            and len(factor) == 4
            and factor != [1.0, 1.0, 1.0, 1.0]
            and "baseColorTexture"
            in glb_materials.get(name, {}).get("pbrMetallicRoughness", {})
            for name, factor in material_identities.items()
        )
        and len({tuple(factor) for factor in material_identities.values()}) ==
        len(material_identities)
        and all(
            isinstance(factor, list)
            and len(factor) == 3
            and max(factor) > 0.2
            and "emissiveTexture" in glb_materials.get(name, {})
            for name, factor in emissive_identities.items()
        )
    )
    primitives = [
        primitive
        for mesh in gltf.get("meshes", [])
        for primitive in mesh.get("primitives", [])
    ]
    all_have_uvs = all("TEXCOORD_0" in primitive.get("attributes", {}) for primitive in primitives)
    lods = manifest.get("lods", {})
    independent_lod_triangles = {
        name: sum(mesh_triangles(mesh_name) for mesh_name in details.get("includedMeshes", []))
        for name, details in lods.items()
    }
    texture_paths = [
        ROOT / path
        for path in manifest.get("pbr", {}).get("sharedAtlases", {}).values()
    ]
    required_paths = [ROOT / path for path in contract["requiredGeneratedAssets"]]
    evidence_paths = [ROOT / "docs/internal" / path for path in contract["requiredEvidence"]]
    manifest_hashes = all(
        (ROOT / relative).is_file()
        and entry["bytes"] == (ROOT / relative).stat().st_size
        and entry["sha256"] == sha(ROOT / relative)
        for relative, entry in manifest.get("files", {}).items()
    )
    measurement_path = ROOT / "docs/internal/artifacts/phase18-5/phase18-5-measurement.json"
    browser_inspection_path = ROOT / "docs/internal/artifacts/phase18-5/browser-inspection.json"
    hardware_evidence = (
        json.loads(HARDWARE_EVIDENCE.read_text(encoding="utf-8"))
        if HARDWARE_EVIDENCE.is_file()
        else {}
    )
    hardware_evidence_errors = validate_hardware_evidence(hardware_evidence)
    historical_evidence_errors = validate_historical_evidence(hardware_evidence)
    measurement = (
        json.loads(measurement_path.read_text(encoding="utf-8"))
        if measurement_path.is_file()
        else {}
    )
    browser_inspection = (
        json.loads(browser_inspection_path.read_text(encoding="utf-8"))
        if browser_inspection_path.is_file()
        else {}
    )
    inspection = browser_inspection.get("inspection", {})
    cadence_authority = measurement.get("cadenceAuthority")
    measurement_authority_valid = (
        cadence_authority
        == classify_renderer(measurement.get("renderer"))
        and measurement.get("cadenceAuthoritative")
        is (cadence_authority == "hardware")
        and (
            (
                cadence_authority == "hardware"
                and measurement.get("cadencePassed") is True
                and measurement.get("cadenceP95Ms", float("inf")) <= 16.8
            )
            or (
                cadence_authority == "software-emulation"
                and measurement.get("cadencePassed") is False
                and measurement.get("hardwareEvidencePassed") is True
            )
        )
    )
    performance_evidence_usable = (
        measurement.get("schema") == "aiw.phase18-5.measurement/2"
        and measurement.get("passed") is True
        and measurement.get("functionalPassed") is True
        and measurement.get("renderWorkPassed") is True
        and measurement.get("longTaskPassed") is True
        and measurement.get("renderWorkP95Ms", float("inf")) <= 16.7
        and measurement.get("longestTaskMs", float("inf")) <= 100
        and measurement.get("thresholds")
        == {
            "renderWorkP95Ms": 16.7,
            "cadenceP95Ms": 16.8,
            "longestTaskMs": 100,
        }
        and measurement_authority_valid
        and browser_inspection.get("passed") is True
        and browser_inspection.get("errors") == []
        and inspection.get("renderer") == "webgl"
        and inspection.get("userLod") == "LOD2"
        and inspection.get("agentLod") == "LOD2"
        and inspection.get("renderLoop") == "continuous"
        and inspection.get("semanticRows", 0) > 0
        and not hardware_evidence_errors
    )
    checks = {
        "contractSchema": contract.get("schema") == "aiw.phase18-5.asset-contract/1",
        "manifestSchema": manifest.get("schema") == "aiw.avatar-assets/0.18.5",
        "blendInspection": blend_inspection.get("passed") is True,
        "generatedAssets": all(path.is_file() for path in required_paths),
        "evidenceInventory": all(path.is_file() for path in evidence_paths),
        "oneSharedSkin": len(skins) == contract["rig"]["armatures"],
        "supersetBoneBudget": (
            contract["rig"]["minimumBoneCount"]
            <= len(joint_names)
            <= contract["rig"]["maximumBoneCount"]
        ),
        "articulatedRig": {
            "jaw", "eye.L", "eye.R", "brow.L", "brow.R", "tail.06",
            "ear.L.03", "ear.R.03", "finger_thumb.02.L", "finger_pinky.02.R",
        } <= joint_names,
        "actions": animation_names == required_actions,
        "distinctActions": len(set(animation_signatures.values())) == len(required_actions),
        "multiBoneActions": all(len(targets) >= 3 for targets in animation_targets.values()),
        "heads": len(head_nodes) == contract["inventory"]["headCount"],
        "expressionSpeechContract": all(
            set(targets) == required_expressions for targets in head_morphs.values()
        ),
        "pbrTextureRoles": set(contract["materials"]["requiredTextureRoles"]) <= texture_roles,
        "materialIdentity": material_identity_pass,
        "uvs": all_have_uvs,
        "images": len(gltf.get("images", [])) >= len(contract["materials"]["requiredTextureRoles"]),
        "distinctModules": all(
            len(set(signatures.values())) == len(signatures)
            for signatures in module_signatures.values()
        ),
        "lodTriangles": all(
            limits["minimum"] <= lods[name]["triangles"] <= limits["maximum"]
            for name, limits in contract["budgets"]["triangles"].items()
        ),
        "lodGeometrySets": (
            len({lods[name].get("geometrySignature") for name in lods}) == 3
            and len({
                tuple(lods[name].get("includedMeshes", []))
                for name in lods
            }) == 3
            and all(lods[name].get("includedMeshes") for name in lods)
        ),
        "lodGlbGeometryCounts": all(
            lods[name]["triangles"] == independent_lod_triangles[name]
            for name in lods
        ),
        "lodDrawCallProxy": all(
            lods[name]["drawCallProxy"] <= limit
            for name, limit in contract["budgets"]["drawCallsOrProxy"].items()
        ),
        "runtimeGlbBudget": GLB.stat().st_size <= contract["budgets"]["runtimeGlbBytes"],
        "blendBudget": BLEND.stat().st_size <= contract["budgets"]["blenderSourceBytes"],
        "textureBudget": sum(path.stat().st_size for path in texture_paths)
        <= contract["budgets"]["avatarTexturePayloadBytes"],
        "manifestHashes": manifest_hashes,
        "historicalEvidenceIntegrity": not historical_evidence_errors,
        "performanceEvidenceUsable": performance_evidence_usable,
        "inventory": (
            sum(len(heads) for heads in manifest["heads"].values())
            == contract["inventory"]["headCount"]
            and len(manifest["bodyColors"]) == contract["inventory"]["colorCount"]
            and len(manifest["shirts"]) == contract["inventory"]["shirtCount"]
        ),
    }
    result = {
        "schema": "aiw.avatar-runtime-inspection/0.18.5",
        "mode": "compatibility-only" if compatibility_only else "current-native",
        "passed": all(
            value
            for name, value in checks.items()
            if not compatibility_only or name != "performanceEvidenceUsable"
        ),
        "checks": checks,
        "counts": {
            "nodes": len(nodes),
            "meshes": len(gltf.get("meshes", [])),
            "materials": len(gltf.get("materials", [])),
            "images": len(gltf.get("images", [])),
            "skins": len(skins),
            "bones": len(joint_names),
            "animations": len(animations),
            "heads": len(head_nodes),
        },
        "sizes": {
            "blend": BLEND.stat().st_size,
            "glb": GLB.stat().st_size,
            "textures": sum(path.stat().st_size for path in texture_paths),
        },
        "lods": lods,
        "independentLodTriangles": independent_lod_triangles,
        "jointNames": sorted(name for name in joint_names if name),
        "headMorphTargets": head_morphs,
        "textureRoles": sorted(texture_roles),
        "materialIdentities": material_identities,
        "emissiveIdentities": emissive_identities,
        "moduleSignatures": module_signatures,
        "animationSignatures": animation_signatures,
        "animationTargetCounts": {
            name: len(targets) for name, targets in animation_targets.items()
        },
        "hashes": {"blend": sha(BLEND), "glb": sha(GLB)},
        "performanceEvidence": {
            "performanceEvidenceUsable": performance_evidence_usable,
            "cadenceAuthority": cadence_authority,
            "cadenceAuthoritative": measurement.get("cadenceAuthoritative"),
            "softwareCadencePassed": measurement.get("cadencePassed"),
            "hardwareEvidencePassed": not hardware_evidence_errors,
            "hardwareEvidenceErrors": hardware_evidence_errors,
            "historicalEvidenceIntegrityPassed": not historical_evidence_errors,
            "historicalEvidenceIntegrityErrors": historical_evidence_errors,
            "nativeEvidenceStatus": "historical-non-gating",
        },
        "missingEvidence": [
            str(path.relative_to(ROOT)) for path in evidence_paths if not path.is_file()
        ],
    }
    if not compatibility_only:
        write_json_if_changed(GLB_INSPECTION, result)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["passed"] else 2


if __name__ == "__main__":
    try:
        arguments = sys.argv[1:]
        if arguments not in ([], ["--compatibility-only"]):
            raise ValueError("usage: verify_avatar_assets.py [--compatibility-only]")
        raise SystemExit(main(compatibility_only=arguments == ["--compatibility-only"]))
    except (KeyError, ValueError, OSError, json.JSONDecodeError) as error:
        print(f"avatar verification failed: {error}", file=sys.stderr)
        raise SystemExit(2)
