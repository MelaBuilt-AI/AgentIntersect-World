"""Build private RC distributions from built output and a locked production deploy.
Usage: python3 tooling/release/build.py --out /absolute/new/output [--allow-dirty]
Normal development remains pnpm11.15.0. Distribution pruning pins pnpm12.4.2
because it can derive a dedicated lockfile without injected workspace links.
"""

import argparse
import hashlib
import json
import pathlib
import shutil
import subprocess
import tarfile
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
PINS = {
    "linux-x64": (
        "node-v24.18.0-linux-x64.tar.xz",
        "55aa7153f9d88f28d765fcdad5ae6945b5c0f98a36881703817e4c450fa76742",
    ),
    "windows-x64": (
        "node-v24.18.0-win-x64.zip",
        "0ae68406b42d7725661da979b1403ec9926da205c6770827f33aac9d8f26e821",
    ),
}


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)


def digest(p):
    h = hashlib.sha256()
    with p.open("rb") as f:
        for b in iter(lambda: f.read(1024 * 1024), b""):
            h.update(b)
    return h.hexdigest()


def runtime(platform, dest, cache):
    filename, expected = PINS[platform]
    archive = cache / filename
    if not archive.exists():
        with (
            urllib.request.urlopen(
                "https://nodejs.org/dist/v24.18.0/" + filename, timeout=120
            ) as r,
            archive.open("xb") as f,
        ):
            shutil.copyfileobj(r, f)
    if digest(archive) != expected:
        raise RuntimeError("Node runtime checksum mismatch")
    prefix = filename.removesuffix(".tar.xz").removesuffix(".zip")
    if platform == "linux-x64":
        with tarfile.open(archive) as z:
            for member, out in [
                (prefix + "/bin/node", "node"),
                (prefix + "/LICENSE", "LICENSE"),
            ]:
                m = z.getmember(member)
                if not m.isfile():
                    raise RuntimeError("Unexpected Node archive member type")
                stream = z.extractfile(m)
                if stream is None:
                    raise RuntimeError("Node archive entry has no data")
                (dest / out).write_bytes(stream.read())
        (dest / "node").chmod(0o755)
    else:
        with zipfile.ZipFile(archive) as z:
            for member, out in [
                (prefix + "/node.exe", "node.exe"),
                (prefix + "/LICENSE", "LICENSE"),
            ]:
                m = z.getinfo(member)
                if m.is_dir() or m.file_size > 150_000_000:
                    raise RuntimeError("Unexpected Node member")
                (dest / out).write_bytes(z.read(m))
    return {
        "version": "24.18.0",
        "url": "https://nodejs.org/dist/v24.18.0/" + filename,
        "archiveSha256": expected,
    }


def sanitize_deployment(root):
    # Upstream's published test fixtures include a dummy private TLS key; not runtime.
    shutil.rmtree(root / "node_modules/@fastify/reply-from/test", ignore_errors=True)
    for filename in [
        "pnpm-lock.yaml",
        "node_modules/.modules.yaml",
        "node_modules/.pnpm-workspace-state-v1.json",
        "node_modules/.pnpm/lock.yaml",
    ]:
        (root / filename).unlink(missing_ok=True)
    for p in [
        root / "package.json",
        *sorted((root / "node_modules/@agentintersect-world").glob("*/package.json")),
    ]:
        data = json.loads(p.read_text())
        for section in ["dependencies", "optionalDependencies"]:
            for name, value in data.get(section, {}).items():
                if name.startswith("@agentintersect-world/") and (
                    "file:" in value or value.startswith("workspace:")
                ):
                    data[section][name] = json.loads(
                        (root / "node_modules" / name / "package.json").read_text()
                    )["version"]
        if not p.resolve().is_relative_to(root.resolve()):
            raise RuntimeError("Deployment manifest resolves outside its owned root")
        # pnpm may hard-link this inode to the source workspace. Replace, never truncate.
        temporary = p.with_name(p.name + ".sanitized")
        with temporary.open("x") as output:
            output.write(json.dumps(data, indent=2) + "\n")
        temporary.replace(p)


PTY_PACKAGES = {
    "linux-x64": "node_modules/@lydell/node-pty-linux-x64",
    "windows-x64": "node_modules/@lydell/node-pty-win32-x64",
}


def check_native_files(root):
    """Only the pinned node-pty prebuilds may ship native code."""
    allowed = [root / d for d in PTY_PACKAGES.values()]
    for platform, directory in PTY_PACKAGES.items():
        if not (root / directory / "package.json").is_file():
            raise RuntimeError(f"Missing {platform} terminal prebuild: {directory}")
    for p in root.rglob("*.node"):
        if not any(p.is_relative_to(d) for d in allowed):
            raise RuntimeError(f"Unexpected native dependency: {p.relative_to(root)}")


def keep_platform_natives(backend, platform):
    """Drop other platforms' node-pty prebuilds and debug symbols."""
    for other, directory in PTY_PACKAGES.items():
        if other != platform:
            shutil.rmtree(backend / directory)
    for p in backend.rglob("*.pdb"):
        p.unlink()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=pathlib.Path, required=True)
    parser.add_argument("--allow-dirty", action="store_true")
    a = parser.parse_args()
    out = a.out.resolve()
    if out == ROOT or ROOT in out.parents:
        raise RuntimeError("Use a new output directory outside the repository")
    if out.exists():
        raise RuntimeError("Refusing to overwrite an existing attempt")
    dirty = bool(
        subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT).strip()
    )
    if dirty and not a.allow_dirty:
        raise RuntimeError("Release build requires a committed clean source tree")
    version = json.loads((ROOT / "package.json").read_text())["version"]
    sha = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
    ).strip()
    out.mkdir(parents=True)
    cache = out / ".runtime-cache"
    cache.mkdir()
    deployed = out / ".backend"
    manifests = [
        ROOT / "package.json",
        ROOT / "pnpm-lock.yaml",
        *ROOT.glob("packages/*/package.json"),
        *ROOT.glob("apps/*/package.json"),
    ]
    source_before = {p: p.read_bytes() for p in manifests}
    run(
        "corepack",
        "pnpm@12.4.2",
        "--pm-on-fail=warn",
        "--filter",
        "@agentintersect-world/local-server",
        "deploy",
        "--prod",
        "--config.node-linker=hoisted",
        str(deployed),
    )
    # A portable flat production install; omit CLI shims, which are symlinks on POSIX.
    shutil.rmtree(deployed / "node_modules/.bin", ignore_errors=True)
    sanitize_deployment(deployed)
    if any(p.read_bytes() != original for p, original in source_before.items()):
        raise RuntimeError(
            "Deployment changed source manifests or lockfile; refusing artifacts"
        )
    check_native_files(deployed)
    dependencies = []
    for p in sorted((deployed / "node_modules").glob("*/package.json")) + sorted(
        (deployed / "node_modules").glob("@*/*/package.json")
    ):
        d = json.loads(p.read_text())
        dependencies.append(
            {
                "name": d["name"],
                "version": d["version"],
                "license": d.get("license", "SEE PACKAGE LICENSE"),
            }
        )
    artifacts = []
    for platform in PINS:
        name = f"AgentIntersect-World-{version}-{platform}"
        stage = out / name
        backend = stage / "apps/local-server"
        backend.parent.mkdir(parents=True)
        shutil.copytree(deployed, backend, symlinks=False)
        keep_platform_natives(backend, platform)
        shutil.copytree(ROOT / "apps/web/dist", stage / "apps/web/dist")
        shutil.copytree(
            ROOT / "examples/phase14-magic-slice",
            stage / "examples/phase14-magic-slice",
        )
        for file in ["LICENSE", "THIRD_PARTY_NOTICES.md"]:
            shutil.copy2(ROOT / file, stage / file)
        shutil.copy2(ROOT / "tooling/release/README.md", stage / "README.md")
        for icon in ["agentintersect.ico", "agentintersect-appicon-512.png"]:
            shutil.copy2(ROOT / "assets/brand" / icon, stage / icon)
        if platform.startswith("win"):
            shutil.copy2(
                ROOT / "tooling/release/Install-AgentCLI.ps1",
                stage / "Install-AgentCLI.ps1",
            )
        (stage / "runtime").mkdir()
        provenance = runtime(platform, stage / "runtime", cache)
        (stage / "DEPENDENCIES.json").write_text(
            json.dumps(dependencies, indent=2) + "\n"
        )
        (stage / "BUILD.json").write_text(
            json.dumps(
                {
                    "product": "AgentIntersect World",
                    "version": version,
                    "sourceCommit": sha,
                    "sourceDirty": dirty,
                    "platform": platform,
                    "runtime": provenance,
                    "deploymentTool": "pnpm12.4.2",
                    "signed": False,
                },
                indent=2,
            )
            + "\n"
        )
        if platform == "linux-x64":
            launcher = stage / "agentintersect-world"
            launcher.write_text(
                '#!/bin/sh\nset -eu\nROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec "$ROOT/runtime/node" "$ROOT/apps/local-server/launch.mjs" "$@"\n'
            )
            launcher.chmod(0o755)
        else:
            (stage / "AgentIntersect-World.cmd").write_bytes(
                b'@echo off\r\n"%~dp0runtime\\node.exe" "%~dp0apps\\local-server\\launch.mjs" %*\r\nif errorlevel 1 pause\r\n'
            )
        for p in stage.rglob("*"):
            if p.is_symlink():
                raise RuntimeError("Unexpected distribution symlink")
            if p.is_file() and (
                p.name in [".env", "credentials.env"] or p.suffix in [".key", ".pem"]
            ):
                raise RuntimeError("Unexpected credential-like file")
        if platform == "linux-x64":
            package = out / (name + ".tar.gz")
            with tarfile.open(package, "w:gz", compresslevel=6) as z:
                z.add(stage, arcname=name)
            artifacts.append(
                {
                    "file": package.name,
                    "bytes": package.stat().st_size,
                    "sha256": digest(package),
                    "sourceCommit": sha,
                    "sourceDirty": dirty,
                }
            )
            deb_root = out / ".deb-root"
            app = deb_root / "opt/agentintersect-world"
            shutil.copytree(stage, app)
            control = deb_root / "DEBIAN"
            control.mkdir()
            (control / "control").write_text(
                "Package: agentintersect-world\n"
                "Version: 0.15.0~rc2\n"
                "Section: devel\nPriority: optional\nArchitecture: amd64\n"
                "Depends: git, libc6 (>= 2.28)\n"
                "Maintainer: MelaBuilt AI <282087817+MelaBuilt-AI@users.noreply.github.com>\n"
                "Description: Local-first 3D workspace for your coding agents\n"
                " Bundles Node.js; agent harnesses are installed separately.\n"
            )
            bin_dir = deb_root / "usr/bin"
            bin_dir.mkdir(parents=True)
            command = bin_dir / "agentintersect-world"
            command.write_text(
                '#!/bin/sh\nexec /opt/agentintersect-world/agentintersect-world "$@"\n'
            )
            command.chmod(0o755)
            desktop = deb_root / "usr/share/applications/agentintersect-world.desktop"
            desktop.parent.mkdir(parents=True)
            desktop.write_text(
                "[Desktop Entry]\nType=Application\nName=AgentIntersect World\n"
                "Comment=Your code becomes a place\nExec=agentintersect-world\n"
                "Icon=agentintersect-world\nTerminal=true\nCategories=Development;\n"
            )
            icon = deb_root / "usr/share/icons/hicolor/512x512/apps/agentintersect-world.png"
            icon.parent.mkdir(parents=True)
            shutil.copy2(ROOT / "assets/brand/agentintersect-appicon-512.png", icon)
            deb = out / f"AgentIntersect-World-{version}-linux-x64.deb"
            subprocess.run(
                ["dpkg-deb", "--build", "--root-owner-group", str(deb_root), str(deb)],
                check=True,
            )
            artifacts.append(
                {
                    "file": deb.name,
                    "bytes": deb.stat().st_size,
                    "sha256": digest(deb),
                    "sourceCommit": sha,
                    "sourceDirty": dirty,
                }
            )
            shutil.rmtree(deb_root)
        else:
            package = out / (name + ".zip")
            with zipfile.ZipFile(
                package, "w", zipfile.ZIP_DEFLATED, compresslevel=6
            ) as z:
                for p in sorted(stage.rglob("*")):
                    if p.is_file():
                        z.write(p, str(pathlib.Path(name) / p.relative_to(stage)))
            artifacts.append(
                {
                    "file": package.name,
                    "bytes": package.stat().st_size,
                    "sha256": digest(package),
                    "sourceCommit": sha,
                    "sourceDirty": dirty,
                }
            )
    (out / "artifacts.json").write_text(json.dumps(artifacts, indent=2) + "\n")
    (out / "SHA256SUMS").write_text(
        "".join(x["sha256"] + "  " + x["file"] + "\n" for x in artifacts)
    )
    print(json.dumps(artifacts, indent=2))


if __name__ == "__main__":
    main()
