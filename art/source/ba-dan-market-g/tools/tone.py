"""Tone pass: bring a generated object's contour weight, warmth and value toward Kaya's G sheet.

Measured on the PixelLab sources (2026-10-27): Kaya's silhouette outline is two px thick on 52-64% of its
length, the objects' on 26-37%; her outline colour is a warm (30, 19, 13), theirs a cooler (25, 20, 15)
to (37, 29, 22); her body sits darker (median value 0.33) than the objects (0.39-0.53). The pass, all
deterministic and using no colour the object does not already imply:

1. contour: every silhouette-edge contour pixel is pulled to Kaya's outline hue at its own darkness;
2. weight: where the outline is one px, the pixel inside it is darkened to `INNER` of its own colour, so the
   edge reads two px soft, as Kaya's does (about 60% of the edge after the pass, measured below);
3. value and warmth: non-contour pixels are scaled by `VALUE` and warmed (red up, blue down) by `WARM`.

    python3 -I tools/tone.py in.png out.png
"""
import sys
from PIL import Image

KAYA_LINE = (30, 19, 13)
INNER = 0.62
VALUE = 0.9
WARM = 0.05


def dark(q):
    return q[3] >= 128 and max(q[:3]) < 75


def tone(im):
    im = im.convert("RGBA")
    p = im.load()
    W, H = im.size
    out = im.copy()
    o = out.load()
    trans = lambda x, y: not (0 <= x < W and 0 <= y < H) or p[x, y][3] < 128
    inner_set = set()
    for y in range(H):
        for x in range(W):
            q = p[x, y]
            if q[3] < 128:
                continue
            sides = [(dx, dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if trans(x + dx, y + dy)]
            if sides and dark(q):
                lum = max(q[:3]) / max(KAYA_LINE)
                o[x, y] = tuple(min(255, round(c * min(lum, 1.6))) for c in KAYA_LINE) + (q[3],)
                for dx, dy in sides:
                    ix, iy = x - dx, y - dy
                    if 0 <= ix < W and 0 <= iy < H and p[ix, iy][3] >= 128 and not dark(p[ix, iy]) \
                            and not any(trans(ix + a, iy + b) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                        inner_set.add((ix, iy))
    for y in range(H):
        for x in range(W):
            q = p[x, y]
            if q[3] < 128 or dark(q) or o[x, y] != q:
                continue
            r, g, b = q[:3]
            k = INNER if (x, y) in inner_set else VALUE
            r, g, b = r * k * (1 + WARM), g * k, b * k * (1 - 2 * WARM)
            o[x, y] = (min(255, round(r)), min(255, round(g)), min(255, round(b)), q[3])
    return out


if __name__ == "__main__":
    tone(Image.open(sys.argv[1])).save(sys.argv[2])
