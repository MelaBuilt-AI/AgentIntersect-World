"""Derive browser assets from owner-supplied masters; never modify the inputs."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument("textures", type=Path)
parser.add_argument("audio", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
texture_out = root / "apps/web/public/assets/environments"
audio_out = root / "apps/web/public/audio/environments"
texture_out.mkdir(parents=True, exist_ok=True)
audio_out.mkdir(parents=True, exist_ok=True)
records = []
for source in sorted(args.textures.glob("*.png")):
    target = texture_out / (source.stem + ".webp")
    with Image.open(source) as image:
        native = list(image.size)
        image.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
        image.save(target, quality=90, method=6)
        dimensions = list(image.size)
    records.append({"source": source.name, "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(), "path": str(target.relative_to(root / "apps/web/public")), "nativeDimensions": native, "dimensions": dimensions, "processing": "Lanczos max 2048; WebP quality 90, original alpha retained"})
for source in sorted(args.audio.rglob("*.wav")):
    target = audio_out / (source.stem + ".ogg")
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source), "-map_metadata", "-1", "-c:a", "libvorbis", "-q:a", "5", str(target)], check=True)
    records.append({"source": str(source.relative_to(args.audio)), "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(), "path": str(target.relative_to(root / "apps/web/public")), "processing": "Vorbis quality 5; no trim, loop edit or normalization"})
for record in records:
    file = root / "apps/web/public" / record["path"]
    record["sha256"] = hashlib.sha256(file.read_bytes()).hexdigest()
    record["bytes"] = file.stat().st_size
manifest = {"schema": "aiw.environment-assets/1", "provenance": "Owner-supplied environment textures and atmosphere/SFX masters; supplied for World integration. Originals retained outside repository. No new blanket asset sublicense asserted.", "assets": records}
target = texture_out / "manifest.json"
target.write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps({"count": len(records), "bytes": sum(r["bytes"] for r in records), "manifest": str(target)}))
