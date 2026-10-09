"""Pick 3 frames from a 4-frame PixelLab strip and pack them as a skill clip.

usage: python3 tools/pack_skill.py <src_strip.png> <out.png> <i0> <i1> <i2> [--keep-largest=<frame#>,...]

--keep-largest drops every pixel island except the biggest one on the given output
frames (used to remove a thrown stick that the generator left floating in the air).
"""
import sys
from collections import deque

from PIL import Image

F = 224


def keep_largest(img):
    w, h = img.size
    px = img.load()
    seen = [[False] * w for _ in range(h)]
    comps = []
    for y in range(h):
        for x in range(w):
            if seen[y][x] or px[x, y][3] == 0:
                continue
            q, comp = deque([(x, y)]), []
            seen[y][x] = True
            while q:
                cx, cy = q.popleft()
                comp.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1),
                               (cx + 1, cy + 1), (cx - 1, cy - 1), (cx + 1, cy - 1), (cx - 1, cy + 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and px[nx, ny][3] > 0:
                        seen[ny][nx] = True
                        q.append((nx, ny))
            comps.append(comp)
    comps.sort(key=len, reverse=True)
    for comp in comps[1:]:
        for x, y in comp:
            px[x, y] = (0, 0, 0, 0)
    return img


def main():
    src, out = sys.argv[1], sys.argv[2]
    idx = [int(v) for v in sys.argv[3:6]]
    clean = set()
    for a in sys.argv[6:]:
        if a.startswith("--keep-largest="):
            clean = {int(v) for v in a.split("=", 1)[1].split(",")}
    strip = Image.open(src).convert("RGBA")
    res = Image.new("RGBA", (F * 3, F))
    for o, i in enumerate(idx):
        fr = strip.crop((i * F, 0, (i + 1) * F, F))
        if o in clean:
            fr = keep_largest(fr)
        res.paste(fr, (o * F, 0))
    res.save(out)
    print(out, idx)


if __name__ == "__main__":
    main()
