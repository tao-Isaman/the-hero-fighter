# คมแฝก (Kom Faek) — web prototype

2D side-scrolling brawler. Open `index.html` through a local server:

    cd web && python3 -m http.server 8000   # then http://localhost:8000

Controls: ← → walk, ↑/Space jump, J/X attack (press again during a swing to chain up to 5 hits), R restart.
Touch devices get on-screen buttons.

Sprites were generated with PixelLab. To refresh an animation strip:

    python3 tools/fetch_anim.py <job_id> web/assets/kan_<name>.png [--skip-first]
    python3 tools/build_manifest.py   # rewrites web/assets/manifest.js
