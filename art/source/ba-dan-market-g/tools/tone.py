"""Tone pass: bring a generated object's contour weight, warmth and value toward Kaya's G sheet.

Measured on the PixelLab sources (2026-10-27): Kaya's silhouette outline is two px thick on 52-64% of its
length, the objects' on 26-37%; her outline colour is a warm (30, 19, 13), theirs a cooler (25, 20, 15)
to (37, 29, 22); her body sits darker (median value 0.33) than the objects (0.39-0.53). The pass, all
deterministic and using no colour the object does not already imply:

1. contour: every silhouette-edge contour pixel is pulled to Kaya's outline hue at its own darkness;
2. weight: where the outline is one px, the pixel inside it is darkened to `INNER` of its own colour, so the
   edge reads two px soft, as Kaya's does (about 60% of the edge after the pass, measured below);
3. value and warmth: non-contour pixels are scaled by `VALUE` and warmed (red up, blue down) by `WARM`.

Two outline modes (`OUTLINE`, or `--outline` on the command line):
  soft2   (default) the two-px soft edge above, applied on the source before the G1 reduction;
  crisp1  for a party redrawn with a crisp 1 px outline on the native G1 grid (art/source/party-g1/): the source gets
          only the value and warmth step, and `crisp_outline` then draws one px of #1b1410 on every silhouette edge
          of the G1 image, after the reduction, so the line lands on the G1 grid.

    python3 -I tools/tone.py in.png out.png [--outline soft2|none]
"""
import sys
from PIL import Image

KAYA_LINE = (30, 19, 13)
INNER = 0.62
VALUE = 0.9
WARM = 0.05


def dark(q):
    return q[3] >= 128 and max(q[:3]) < 75


OUTLINE = "soft2"
CRISP_LINE = (27, 20, 16)   # #1b1410


def crisp_outline(g1):
    """One px of #1b1410 on every silhouette-edge pixel of a G1 image (alpha unchanged)."""
    g1 = g1.convert("RGBA")
    p = g1.load()
    W, H = g1.size
    out = g1.copy()
    o = out.load()
    for y in range(H):
        for x in range(W):
            if p[x, y][3] < 128:
                continue
            if any(not (0 <= x + dx < W and 0 <= y + dy < H) or p[x + dx, y + dy][3] < 128
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                o[x, y] = CRISP_LINE + (p[x, y][3],)
    return out


def tone(im, outline=None):
    """outline: 'soft2' (contour hue + two-px soft edge) or 'none' (value and warmth only, for crisp1)."""
    outline = outline or ("none" if OUTLINE == "crisp1" else OUTLINE)
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
            if sides and dark(q) and outline == "soft2":
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
    mode = sys.argv[sys.argv.index("--outline") + 1] if "--outline" in sys.argv else None
    tone(Image.open(sys.argv[1]), mode).save(sys.argv[2])
