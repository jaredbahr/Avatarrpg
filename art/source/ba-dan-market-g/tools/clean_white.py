"""Recolour the near-white pixels of one candidate from its own neighbours (deterministic; requested 2026-10-27).

A pixel is near-white when it is opaque, its brightest channel is above 215 and its channels are within 50
of each other. Each becomes the most common non-near-white colour among its eight neighbours (the grain's
own pale tone, in the south table's sacks), so no colour is added that the generator did not draw.

    python3 -I tools/clean_white.py in.png out.png
"""
import sys
from collections import Counter
from PIL import Image


def near_white(p):
    return p[3] >= 128 and max(p[:3]) > 215 and max(p[:3]) - min(p[:3]) < 50


def clean(src, dst):
    im = Image.open(src).convert("RGBA")
    px = im.load()
    out = im.copy()
    o = out.load()
    changed = 0
    for y in range(im.height):
        for x in range(im.width):
            if not near_white(px[x, y]):
                continue
            nb = [px[x + dx, y + dy] for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                  if (dx or dy) and 0 <= x + dx < im.width and 0 <= y + dy < im.height]
            nb = [p for p in nb if p[3] >= 128 and not near_white(p)]
            if nb:
                o[x, y] = Counter(nb).most_common(1)[0][0]
                changed += 1
    out.save(dst)
    print(dst, "recoloured", changed)


if __name__ == "__main__":
    clean(sys.argv[1], sys.argv[2])
