"""Build one icon per skill: the fighter's skill pose in front of the skill's effect.

usage: python3 tools/make_icons.py            (then python3 tools/build_manifest.py)

Writes web/assets/icons/<character>_<skill>.png. The game picks these up as
ic_<character>_<skill> and uses them in place of the skill's `icon` effect.
Skills whose `icon` is already a hand-made icon (HANDMADE) are copied as they are.
"""
import json
import math
import os
import subprocess

from PIL import Image, ImageFilter

A = "web/assets"
OUT = f"{A}/icons"
N = 128
HANDMADE = {"bigride", "soulicon", "bloodicon"}

DUMP = """
global.window = {};
const fs = require('fs');
for (const d of fs.readdirSync('web/characters')) {
  if (d.startsWith('_') || !fs.existsSync(`web/characters/${d}/character.js`)) continue;
  require(`./web/characters/${d}/character.js`);
}
const out = {};
for (const [cid, c] of Object.entries(window.CHARACTERS)) {
  out[cid] = {};
  for (const [sid, s] of Object.entries(c.skills))
    out[cid][sid] = { icon: s.icon, image: (c.anims['sk_' + sid] || {}).image };
}
console.log(JSON.stringify(out));
"""


def glow_color(fx):
    # the effect's brightest colours, averaged
    px = [p for p in fx.getdata() if p[3] > 128]
    px.sort(key=lambda p: -(p[0] + p[1] + p[2]))
    top = px[: max(1, len(px) // 3)]
    return tuple(sum(p[i] for p in top) // len(top) for i in range(3))


def fit(img, w, h):
    k = min(w / img.width, h / img.height)
    return img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)


def harden(img):
    # keep pixel-art edges after scaling: no half-transparent fringe
    a = img.split()[3].point(lambda v: 255 if v > 110 else 0)
    img.putalpha(a)
    return img


def compose(pose, fx):
    c = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    r, g, b = glow_color(fx)
    px = c.load()
    for y in range(N):
        for x in range(N):
            d = math.hypot(x - 64, y - 60) / 66
            if d < 1:
                px[x, y] = (r, g, b, int(200 * min(1, (1 - d) * 1.4)))
    e = harden(fit(fx, 104, 104))
    c.alpha_composite(e, (min(N - e.width, 64 - e.width // 2 + 18), (N - e.width) // 2 if e.height == e.width else (N - e.height) // 2))
    p = harden(fit(pose.crop(pose.getbbox()), 104, 118))
    ol = Image.new("RGBA", p.size, (14, 10, 22, 255))
    ol.putalpha(p.split()[3].filter(ImageFilter.MaxFilter(3)))
    x0, y0 = max(0, 54 - p.width // 2), N - p.height - 2
    c.alpha_composite(ol, (x0, y0))
    c.alpha_composite(p, (x0, y0))
    return c


def main():
    data = json.loads(subprocess.check_output(["node", "-e", DUMP]))
    os.makedirs(OUT, exist_ok=True)
    for cid, skills in data.items():
        for sid, s in skills.items():
            out = f"{OUT}/{cid}_{sid}.png"
            if s["icon"] in HANDMADE:
                Image.open(f"{A}/vfx_{s['icon']}.png").convert("RGBA").save(out)
                continue
            if not s["image"]:
                print("skip (no sprite)", cid, sid)
                continue
            strip = Image.open(f"web/characters/{cid}/{s['image']}").convert("RGBA")
            n = strip.width // 224
            pose = strip.crop(((n - 1) * 224, 0, n * 224, 224))   # the last frame is the strike
            fx = Image.open(f"{A}/vfx_{s['icon']}.png").convert("RGBA")
            compose(pose, fx).save(out)
            print(out)


if __name__ == "__main__":
    main()
