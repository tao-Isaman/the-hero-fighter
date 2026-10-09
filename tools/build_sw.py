"""Regenerate web/sw.js: the offline cache list and its version.

usage: python3 tools/build_sw.py     (run after adding or changing any file in web/)

The cache name is a hash of every cached file, so each deploy with changed files
installs a fresh cache and drops the old one.
"""
import hashlib
import json
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent / "web"
SKIP_DIRS = {"_template"}
SKIP_FILES = {"sw.js", "README.md"}

files, h = [], hashlib.sha1()
for p in sorted(WEB.rglob("*")):
    rel = p.relative_to(WEB)
    if p.is_dir() or rel.name in SKIP_FILES or SKIP_DIRS & set(rel.parts) or rel.name.startswith("."):
        continue
    files.append(rel.as_posix())
    h.update(rel.as_posix().encode())
    h.update(p.read_bytes())

template = (Path(__file__).resolve().parent / "sw_template.js").read_text(encoding="utf-8")
out = template.replace("__VERSION__", h.hexdigest()[:10]).replace("__FILES__", json.dumps(["./"] + files, indent=2))
(WEB / "sw.js").write_text(out, encoding="utf-8")
print(f"web/sw.js: {len(files)} files, version {h.hexdigest()[:10]}")
