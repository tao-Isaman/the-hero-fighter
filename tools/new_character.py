"""Scaffold a new fighter from web/characters/_template.

usage: python3 tools/new_character.py <id> "<ชื่อไทย>" "<HUD NAME>" [--placeholder-sprites]

  <id>                   short lowercase id, e.g. saen (used in the folder name and #saen in the URL)
  --placeholder-sprites  copy Kan's sprites in so the fighter is playable right away;
                         replace them one by one as the real art comes in

Creates web/characters/<id>/character.js and sprites/, and adds the script tag to web/index.html.
Open web/index.html#<id> to play the new fighter.
"""
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHARS = ROOT / "web" / "characters"

# template clip -> Kan clip used as a placeholder
PLACEHOLDERS = {
    "idle": "idle", "walk": "walk", "jump": "jump", "portrait": "portrait",
    "attack1": "attack1", "attack2": "attack2", "attack3": "attack3", "attack4": "attack4", "attack5": "attack5",
    "air1": "air1", "air2": "air2", "air3": "air3",
    "sk_strike": "sk_tiger", "sk_burst": "sk_quake", "sk_spin": "sk_storm",
}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 3:
        sys.exit(__doc__)
    cid, name, hud = args
    if not re.fullmatch(r"[a-z][a-z0-9_]*", cid):
        sys.exit("id must be lowercase letters, digits or _ and start with a letter")
    dest = CHARS / cid
    if dest.exists():
        sys.exit(f"{dest} already exists")

    (dest / "sprites").mkdir(parents=True)
    src = (CHARS / "_template" / "character.js").read_text(encoding="utf-8")
    src = src.replace("__ID__", cid).replace("__NAME__", name).replace("__HUD__", hud.upper())
    (dest / "character.js").write_text(src, encoding="utf-8")

    if "--placeholder-sprites" in sys.argv:
        for new, kan in PLACEHOLDERS.items():
            shutil.copy(CHARS / "kan" / "sprites" / f"{kan}.png", dest / "sprites" / f"{new}.png")

    index = ROOT / "web" / "index.html"
    html = index.read_text(encoding="utf-8")
    tag = f'<script src="characters/{cid}/character.js"></script>\n'
    if tag not in html:
        html = html.replace("<!-- new-character-scripts -->", tag + "<!-- new-character-scripts -->")
        index.write_text(html, encoding="utf-8")

    print(f"created web/characters/{cid}/ — play it at web/index.html#{cid}")
    print("next: put sprites in web/characters/%s/sprites/ (see web/characters/README.md)" % cid)


if __name__ == "__main__":
    main()
