# คมแฝก (Kom Faek) — web prototype

2D side-scrolling brawler. Open `index.html` through a local server:

    cd web && python3 -m http.server 8000   # then http://localhost:8000

Controls: ← → walk, ↑/Space jump, J/X attack (press again during a swing to chain up to 5 hits), R restart.
Touch devices get on-screen buttons.

Fighters live in `web/characters/<id>/` (one `character.js` + sprites). To add one, see
[`web/characters/README.md`](characters/README.md) or run:

    python3 tools/new_character.py <id> "<ชื่อไทย>" "<HUD NAME>" --placeholder-sprites

Open `index.html#<id>` to play a specific fighter. Stage, monster and shared effects are in
`web/assets/manifest.js` (rebuild with `python3 tools/build_manifest.py`).
