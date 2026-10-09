"""Download a PixelLab animation job and pack its frames into a horizontal strip.

usage: python3 tools/fetch_anim.py <job_id> <out_png> [--skip-first]
"""
import io
import sys
import urllib.request

from PIL import Image

BASE = "https://api.pixellab.ai/mcp/images"


def fetch(job, i):
    url = f"{BASE}/{job}/download?index={i}"
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            return Image.open(io.BytesIO(r.read())).convert("RGBA")
    except Exception:
        return None


def main():
    job, out = sys.argv[1], sys.argv[2]
    skip_first = "--skip-first" in sys.argv
    frames, i = [], 0
    while True:
        im = fetch(job, i)
        if im is None:
            break
        frames.append(im)
        i += 1
    if skip_first:
        frames = frames[1:]
    w, h = frames[0].size
    strip = Image.new("RGBA", (w * len(frames), h))
    for n, f in enumerate(frames):
        strip.paste(f, (n * w, 0))
    strip.save(out)
    print(f"{out}: {len(frames)} frames of {w}x{h}")


if __name__ == "__main__":
    main()
