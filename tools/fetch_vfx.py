"""Download a PixelLab effect animation, trim all frames to their shared bounds, and pack a strip.

usage: python3 tools/fetch_vfx.py <job_id> <key>
writes web/assets/vfx_<key>_anim.png and web/assets/vfx_<key>_anim.json ({frameW, frameH, frames})
"""
import io
import json
import sys
import urllib.request

from PIL import Image

BASE = "https://api.pixellab.ai/mcp/images"


def main():
    job, key = sys.argv[1], sys.argv[2]
    frames, i = [], 0
    while True:
        try:
            with urllib.request.urlopen(f"{BASE}/{job}/download?index={i}", timeout=60) as r:
                frames.append(Image.open(io.BytesIO(r.read())).convert("RGBA"))
        except Exception:
            break
        i += 1
    boxes = [f.getbbox() for f in frames if f.getbbox()]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    frames = [f.crop(box) for f in frames]
    w, h = frames[0].size
    strip = Image.new("RGBA", (w * len(frames), h))
    for n, f in enumerate(frames):
        strip.paste(f, (n * w, 0))
    strip.save(f"web/assets/vfx_{key}_anim.png")
    with open(f"web/assets/vfx_{key}_anim.json", "w") as fh:
        json.dump({"frameW": w, "frameH": h, "frames": len(frames)}, fh)
    print(key, len(frames), "frames of", w, "x", h)


if __name__ == "__main__":
    main()
