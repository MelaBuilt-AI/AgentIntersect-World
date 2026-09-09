"""Disable unused Chrome .list entries on disposable CI runners only.

Playwright supplies its own Chromium. Keep all other APT sources and verification
unchanged; an explicit directory argument allows testing without system writes.
"""

import re
import sys
from pathlib import Path

source_directory = Path(sys.argv[1])
chrome_entry = re.compile(
    r"^\s*deb(?:-src)?\s+(?:\[[^\]]*\]\s+)?"
    r"https?://dl\.google\.com/linux/chrome(?:-stable)?/deb/?\s"
)
for source in sorted(source_directory.glob("*.list")):
    original = source.read_bytes()
    lines = original.decode().splitlines(keepends=True)
    updated = "".join(
        "# CI: unused Chrome source disabled: " + line
        if chrome_entry.match(line) else line
        for line in lines
    ).encode()
    if updated != original:
        source.write_bytes(updated)
        print(f"Disabled unused Google Chrome APT entries in {source.name}")
