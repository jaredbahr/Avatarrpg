"""Blockouts for the rest of Ba Dan's object families (2026-10-27, Route A at G1), same method as blockout.py.

Each object is drawn at its game size in screen px against H = 89 (59 world px), on the 2:1 axis, with the
one warm upper-left key light (tops lightest, +b faces mid, +a faces darkest) and a #1b1410 contour. The
designs follow the pieces in the current Ba Dan painting (`docs/art/ba-dan-scene.md`), rebuilt at the brief's
proportions. The 3x2 garden plot is wider than the 256 px edit limit at any usable grain, so it is a kit of
small pieces (frame edges, a corner post and crop rows) laid on the painted soil by the compositor.

    python3 -I art/source/ba-dan-market-g/tools/blockout2.py    # writes blockouts/*.png and adds to meta.json
"""
import json, math, random
from PIL import Image
from blockout import (Canvas, table, OUT, LINE, AX, AY, rgb, WOOD, WOOD_OLD, WOOD_DARK, WICKER, WICKER_IN,
                      CLAY, CLAY_PALE, GLAZE, SACK, CLOTH, CLOTH_BLUE, LEATHER, ROPE, RED, YGREEN, ORANGE, LEAF, GRAIN)
import blockout

STONE = [rgb("#a39a86"), rgb("#857c69"), rgb("#635b4c")]
STONE_PALE = [rgb("#b3a990"), rgb("#958b74"), rgb("#6f6755")]
ROOF = [rgb("#a85a3c"), rgb("#8a4630"), rgb("#683424")]
SOIL = [rgb("#6e5236"), rgb("#5a4229"), rgb("#43301e")]
BANNER = [rgb("#3f6a66"), rgb("#33564f"), rgb("#26413c")]
OCHRE = [rgb("#b38a3e"), rgb("#93702f"), rgb("#6e5323")]
AMBER = [rgb("#d08a3a"), rgb("#b06e2a"), rgb("#7c4a1e")]
HAY = [rgb("#c2a456"), rgb("#a08443"), rgb("#7a6332")]
WATER = [rgb("#3e5a58"), rgb("#2f4746"), rgb("#233534")]
CABBAGE = [rgb("#7f9a52"), rgb("#5e7a3c")]
SHRUB = [rgb("#6a8746"), rgb("#4d6833"), rgb("#384d26")]
FLOWER = [rgb("#c9a14a"), rgb("#9c6a3a")]
IRON = [rgb("#5a5048"), rgb("#463e37"), rgb("#332d28")]
BRICK = [rgb("#a8684a"), rgb("#8a5239"), rgb("#673c2a")]
CLOTHS = [[rgb("#9a4a3a"), rgb("#7c3a2e"), rgb("#5c2a22")], [rgb("#c2ad86"), rgb("#a3906c"), rgb("#7c6c50")],
          [rgb("#b38a3e"), rgb("#93702f"), rgb("#6e5323")], [rgb("#5e7656"), rgb("#4c6046"), rgb("#384634")],
          [rgb("#5d6b7a"), rgb("#4a5663"), rgb("#36404b")]]


def canvas_for(w, h, f, L, D, margin_bottom=4):
    """A roomy canvas; `fit` crops it to the drawing afterwards (w and h are ignored)."""
    c = Canvas(560, 560, f, (300, 380))
    c.L, c.D = L, D
    return c


def fit(c, pad=4):
    """Crop to the drawing plus `pad`, round both sides up to a multiple of 4 (the edit tool's grid)."""
    x0, y0, x1, y1 = c.im.getbbox()
    x0, y0, x1, y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
    w, h = x1 - x0, y1 - y0
    w, h = w + (-w) % 4, h + (-h) % 4
    if w < 32: x0 -= (32 - w) // 2; w = 32
    if h < 32: y0 -= (32 - h); h = 32
    assert w <= 256 and h <= 256, (w, h)
    c.im = c.im.crop((x0, y0, x0 + w, y0 + h))
    c.ox, c.oy = c.ox - x0, c.oy - y0
    return c


# ------------------------------------------------------------------ primitives

def post(c, a, b, z0, z1, w=3.5, tones=WOOD_DARK, base=None):
    """A square post standing at (a, b), optionally on a stone footing."""
    if base:
        bw, bh = base
        c.box(a - bw / 2, a + bw / 2, b - bw / 2, b + bw / 2, z0, z0 + bh, STONE)
        z0 += bh
    c.box(a - w / 2, a + w / 2, b - w / 2, b + w / 2, z0, z1, tones)


def gable(c, a0, a1, b0, b1, ze, zr, tones=ROOF, courses=4):
    """A gable roof whose ridge runs along +a at height zr over the middle of b0..b1, eaves at ze."""
    bm = (b0 + b1) / 2
    p = c.p
    c.poly([p(a0, b0, ze), p(a1, b0, ze), p(a1, bm, zr), p(a0, bm, zr)], tones[2])           # back slope (behind)
    c.poly([p(a1, b0, ze), p(a1, b1, ze), p(a1, bm, zr)], tones[2])                         # gable end, +a
    c.poly([p(a0, b1, ze), p(a1, b1, ze), p(a1, bm, zr), p(a0, bm, zr)], tones[0])           # front slope, lit
    for i in range(1, courses):
        t = i / courses
        z, b = zr + (ze - zr) * t, bm + (b1 - bm) * t
        c.d.line([p(a0, b, z), p(a1, b, z)], fill=tones[1])
    for k in range(1, int((a1 - a0) / 5)):
        a = a0 + k * 5
        c.d.line([p(a, bm, zr), p(a, b1, ze)], fill=tones[1])
    c.d.line([p(a0, bm, zr), p(a1, bm, zr)], fill=LINE, width=2)


def wheel(c, a, b, zc, r, tones=WOOD_DARK, spokes=6):
    """A wheel in the a-z plane (axle along b): rim, hub and spokes."""
    pts = [c.p(a + r * math.cos(t), b, zc + r * math.sin(t)) for t in [i * math.pi / 18 for i in range(36)]]
    inner = [c.p(a + (r - 2.2) * math.cos(t), b, zc + (r - 2.2) * math.sin(t)) for t in [i * math.pi / 18 for i in range(36)]]
    c.d.polygon(pts, fill=tones[1], outline=LINE)
    c.d.polygon(inner, fill=(0, 0, 0, 0), outline=LINE)
    for i in range(spokes):
        t = i * 2 * math.pi / spokes
        c.d.line([c.p(a, b, zc), c.p(a + (r - 2) * math.cos(t), b, zc + (r - 2) * math.sin(t))], fill=tones[0], width=2)
    x, y = c.p(a, b, zc)
    h = c.s(2.5)
    c.d.ellipse([x - h, y - h, x + h, y + h], fill=tones[2], outline=LINE)


def hang_cloth(c, a, b, z, w, h, tones, sway=1.0):
    """A cloth hanging from a line along +a: a quad in the a-z plane with a little swing at the hem."""
    p = c.p
    q = [p(a, b, z), p(a + w, b, z), p(a + w + sway, b + 0.5, z - h), p(a + sway * 0.5, b + 0.5, z - h * 0.92)]
    c.poly(q, tones[0])
    c.d.line([p(a + w * 0.66, b, z), p(a + w * 0.66 + sway, b + 0.5, z - h)], fill=tones[1])
    c.d.line([q[2], q[3]], fill=tones[2])


def barrel(c, a, b, z, w, h, tones=WOOD, lid=True):
    c.cylinder(a, b, z, w, h, tones)
    x, y = c.p(a, b, z)
    r = c.s(w) / 2
    for t in (0.22, 0.78):
        yy = y - c.s(h) * t
        c.d.arc([x - r, yy - r / 2, x + r, yy + r / 2], 0, 180, fill=IRON[2], width=2)
    if lid:
        c.ell(a, b, z + h, w - 2, tones[1])
        c.seam(a - w * 0.3, b, a + w * 0.3, b, z + h, tones[2])


def stone_box(c, a0, a1, b0, b1, z0, z1, tones=STONE, course=6.0, block=12.0):
    """A dry-stone box: the box, then staggered block joints on the two visible faces."""
    c.box(a0, a1, b0, b1, z0, z1, tones)
    rows = max(1, round((z1 - z0) / course))
    for r in range(1, rows):
        z = z0 + (z1 - z0) * r / rows
        c.d.line([c.p(a0, b1, z), c.p(a1, b1, z)], fill=tones[2])
        c.d.line([c.p(a1, b0, z), c.p(a1, b1, z)], fill=LINE)
    for r in range(rows):
        za, zb = z0 + (z1 - z0) * r / rows, z0 + (z1 - z0) * (r + 1) / rows
        off = block / 2 if r % 2 else 0
        a = a0 + block - off
        while a < a1 - 2:
            c.d.line([c.p(a, b1, za), c.p(a, b1, zb)], fill=tones[2])
            a += block
        b = b0 + block - off
        while b < b1 - 2:
            c.d.line([c.p(a1, b, za), c.p(a1, b, zb)], fill=LINE)
            b += block


def shrubs(c, a0, a1, b0, b1, z, n, seed, size=(8, 13), tones=SHRUB, flowers=0):
    rnd = random.Random(seed)
    pts = sorted(((rnd.uniform(a0, a1), rnd.uniform(b0, b1)) for _ in range(n)), key=lambda t: t[0] + t[1])
    for a, b in pts:
        w = rnd.uniform(*size)
        x, y = c.p(a, b, z)
        r = c.s(w) / 2
        c.d.ellipse([x - r, y - r * 1.25, x + r, y + r * 0.35], fill=tones[1], outline=LINE)
        c.d.ellipse([x - r + 1, y - r * 1.2, x + r * 0.3, y - r * 0.2], fill=tones[0])
    for _ in range(flowers):
        a, b = rnd.uniform(a0, a1), rnd.uniform(b0, b1)
        x, y = c.p(a, b, z + rnd.uniform(4, 9))
        c.d.rectangle([x - 1, y - 1, x + 1, y + 1], fill=FLOWER[0])


def logs_face(c, a0, a1, b, z0, z1, d, tones=WOOD, seed=3):
    """Log ends showing on the +b face of a woodpile, rows of d-wide rounds."""
    rnd = random.Random(seed)
    rows = int((z1 - z0) // (d * 0.9))
    for r in range(rows):
        zc = z0 + d / 2 + r * d * 0.9
        a = a0 + d / 2 + (d / 2 if r % 2 else 0)
        while a <= a1 - d / 2 + 0.1:
            x, y = c.p(a, b, zc)
            rr = c.s(d) / 2 * rnd.uniform(0.85, 1.0)
            c.d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=rgb("#b08a5a"), outline=LINE)
            c.d.ellipse([x - rr * 0.4, y - rr * 0.4, x + rr * 0.4, y + rr * 0.4], fill=rgb("#8e6c44"))
            a += d


def lantern(c, a, b, z_top, w=6, h=9):
    """A small wooden-frame lantern hanging from z_top: dark cap, amber panels (matte, no white), dark base."""
    c.box(a - w / 2, a + w / 2, b - w / 2, b + w / 2, z_top - h, z_top - 1.5, AMBER)
    c.box(a - w / 2 - 0.8, a + w / 2 + 0.8, b - w / 2 - 0.8, b + w / 2 + 0.8, z_top - 1.5, z_top, WOOD_DARK)
    c.box(a - w / 2 - 0.5, a + w / 2 + 0.5, b - w / 2 - 0.5, b + w / 2 + 0.5, z_top - h - 1.2, z_top - h, WOOD_DARK)
    x0, y0 = c.p(a, b + w / 2, z_top - 1.5)
    x1, y1 = c.p(a, b + w / 2, z_top - h)
    c.d.line([(x0, y0), (x1, y1)], fill=WOOD_DARK[2])


# ------------------------------------------------------------------ objects (name, footprint, fn)

def village_well(seed=1):
    f = 0.5625
    c = canvas_for(176, 216, f, 60, 60, margin_bottom=4)
    A, B = 30, 30
    # stone ring: a cylinder of dry stone
    c.cylinder(A, B, 0, 46, 26, STONE)
    x, y = c.p(A, B, 0)
    r = c.s(46) / 2
    for t in (0.33, 0.66):
        yy = y - c.s(26) * t
        c.d.arc([x - r, yy - r / 2, x + r, yy + r / 2], 0, 180, fill=STONE[2])
    for k in range(-2, 3):
        xx = x + k * r * 0.4
        c.d.line([(xx, y - c.s(26) * 0.33 + abs(k) * 2), (xx, y - c.s(26) * 0.66 + abs(k) * 2)], fill=STONE[2])
    c.ell(A, B, 26, 38, WATER[2], line=True)
    c.ell(A, B, 26, 30, WATER[1], line=False)
    # posts either side along a, windlass beam, bucket on a rope, roof
    post(c, A - 24, B, 18, 80, w=4)
    c.box(A - 24, A + 24, B - 1.2, B + 1.2, 62, 64.5, WOOD)                     # windlass axle
    xr0, yr0 = c.p(A + 4, B, 62)
    xr1, yr1 = c.p(A + 4, B, 42)
    c.d.line([(xr0, yr0), (xr1, yr1)], fill=ROPE)
    barrel(c, A + 4, B, 34, 9, 8, WOOD_DARK, lid=False)
    c.ell(A + 4, B, 42, 7, WATER[1], line=False)
    post(c, A + 24, B, 18, 80, w=4)
    c.box(A + 26, A + 33, B - 0.8, B + 0.8, 63, 64, WOOD_DARK)                  # crank handle
    gable(c, A - 29, A + 29, B - 19, B + 19, 78, 94, courses=4)
    return c


def banner_pole(seed=1):
    f = 0.5625
    c = canvas_for(104, 212, f, 30, 30, margin_bottom=4)
    A, B = 12, 15
    post(c, A, B, 0, 102, w=4, base=(13, 6))
    c.box(A - 1, A + 24, B - 1.2, B + 1.2, 92, 95, WOOD_DARK)                    # arm along +a
    c.box(A + 23, A + 25, B - 1, B + 1, 88, 95, WOOD_DARK)
    p = c.p
    bw, bl = 17, 38
    q = [p(A + 4, B + 1, 91), p(A + 4 + bw, B + 1, 91), p(A + 4 + bw, B + 1.5, 91 - bl), p(A + 4 + bw / 2, B + 1.5, 91 - bl - 5),
         p(A + 4, B + 1.5, 91 - bl)]
    c.poly(q, BANNER[0])
    c.d.line([p(A + 4 + bw - 3, B + 1, 90), p(A + 4 + bw - 3, B + 1.5, 91 - bl)], fill=BANNER[2])
    # a plain ochre diamond, the village's mark (no lettering)
    cx, cz = A + 4 + bw / 2, 91 - bl / 2
    c.poly([p(cx, B + 1.2, cz + 8), p(cx + 4, B + 1.2, cz), p(cx, B + 1.2, cz - 8), p(cx - 4, B + 1.2, cz)], OCHRE[1])
    c.d.line([p(A + 3, B + 1, 91.5), p(A + 5 + bw, B + 1, 91.5)], fill=WOOD_DARK[0], width=2)
    return c


def lantern_post(seed=1):
    f = 0.5625
    c = canvas_for(96, 188, f, 28, 28, margin_bottom=4)
    A, B = 10, 14
    post(c, A, B, 0, 88, w=4, base=(12, 5))
    c.box(A - 1, A + 15, B - 1, B + 1, 82, 84.5, WOOD_DARK)
    c.box(A + 1, A + 9, B - 0.6, B + 0.6, 76, 77.5, WOOD_DARK)                   # brace
    x0, y0 = c.p(A + 13, B, 82)
    x1, y1 = c.p(A + 13, B, 78)
    c.d.line([(x0, y0), (x1, y1)], fill=IRON[1])
    lantern(c, A + 13, B, 78, w=7, h=11)
    return c


def laundry_line(seed=1):
    f = 0.62
    L, D = 150, 20
    c = canvas_for(236, 244, f, L, D, margin_bottom=4)
    B = 10
    post(c, 4, B, 0, 72, w=4)
    p = c.p
    pts = [p(4 + (L - 8) * t, B, 69 - 7 * math.sin(math.pi * t)) for t in [i / 20 for i in range(21)]]
    c.d.line(pts, fill=ROPE, width=1)
    rnd = random.Random(seed)
    a = 14
    for i, (w, h) in enumerate([(14, 22), (16, 16), (12, 19), (15, 24), (13, 15)]):
        t = (a + w / 2 - 4) / (L - 8)
        z = 69 - 7 * math.sin(math.pi * t)
        hang_cloth(c, a, B, z, w, h, CLOTHS[i % len(CLOTHS)], sway=rnd.uniform(0.5, 2))
        a += w + rnd.uniform(4, 8)
    post(c, L - 4, B, 0, 72, w=4)
    # a laundry basket at the foot of the right post
    c.cylinder(L - 26, B + 16, 0, 22, 9, WICKER)
    c.ell(L - 26, B + 16, 9, 19, WICKER_IN, line=False)
    for i, (da, db, t) in enumerate([(-4, -1, 0), (2, 1, 3), (-1, 3, 4), (4, -2, 2)]):   # folded cloths heaped in it
        x, y = c.p(L - 26 + da, B + 16 + db, 10 + i * 1.2)
        w, h = c.s(9), c.s(4)
        c.d.rounded_rectangle([x - w / 2, y - h / 2, x + w / 2, y + h / 2], radius=2, fill=CLOTHS[t][0], outline=LINE)
        c.d.line([(x - w / 2 + 1, y + h / 2 - 1), (x + w / 2 - 1, y + h / 2 - 1)], fill=CLOTHS[t][2])
    return c


def notice_board(seed=1):
    f = 0.5625
    c = canvas_for(124, 172, f, 46, 22, margin_bottom=4)
    B = 11
    post(c, 6, B, 0, 74, w=4)
    post(c, 40, B, 0, 74, w=4)
    c.box(4, 42, B - 1.5, B + 1.5, 36, 64, WOOD_OLD)                             # the board
    p = c.p
    # pinned sheets: plain, a few ruled strokes, nothing legible
    for (a, z, w, h) in [(8, 60, 10, 12), (20, 58, 9, 14), (31, 61, 8, 10), (11, 45, 12, 9), (26, 46, 11, 10)]:
        c.poly([p(a, B + 1.6, z), p(a + w, B + 1.6, z), p(a + w, B + 1.6, z - h), p(a, B + 1.6, z - h)], SACK[0])
        for k in range(1, 3):
            zz = z - h * k / 3
            c.d.line([p(a + 2, B + 1.6, zz), p(a + w - 3, B + 1.6, zz)], fill=SACK[2])
        x, y = p(a + w / 2, B + 1.6, z - 1)
        c.d.point((x, y), fill=LINE)
    gable(c, 1, 45, B - 7, B + 7, 70, 80, courses=2)
    return c


def handcart(seed=1):
    f = 0.5625
    L, D = 112, 34
    c = canvas_for(240, 160, f, L, D, margin_bottom=4)
    # shafts out along -a, resting on the ground at their tips; the bed over the axle; wheels on both b sides
    bA0, bA1, bB0, bB1, zb = 40, 92, 6, 28, 16
    wheel(c, 66, bB0 - 2, 12, 12)                                                 # far wheel
    for b in (bB0 + 2, bB1 - 2):
        c.box(6, bA0 + 4, b - 1, b + 1, 0, 0, WOOD_DARK)
        c.poly([c.p(4, b - 1, 1), c.p(bA0 + 2, b - 1, zb), c.p(bA0 + 2, b + 1, zb), c.p(4, b + 1, 1)], WOOD_DARK[0])
    c.box(bA0, bA1, bB0, bB1, zb, zb + 3, WOOD)
    c.box(bA0, bA1, bB0, bB0 + 1.5, zb + 3, zb + 9, WOOD_OLD)                   # side boards
    c.box(bA1 - 1.5, bA1, bB0, bB1, zb + 3, zb + 9, WOOD_OLD)
    c.sack(bA0 + 14, bB0 + 9, zb + 3, 15, 12, SACK)
    c.jar(bA0 + 30, bB0 + 12, zb + 3, 11, 14, CLAY)
    c.sack(bA0 + 24, bB0 + 18, zb + 3, 14, 10, SACK)
    c.box(bA0, bA1, bB1 - 1.5, bB1, zb + 3, zb + 9, WOOD_OLD)
    c.box(bA0, bA0 + 1.5, bB0, bB1, zb + 3, zb + 9, WOOD_OLD)
    wheel(c, 66, bB1 + 2, 12, 12)                                                 # near wheel
    return c


def garden_edge_a(seed=1):
    """Garden kit: one tile of low plank frame along +a (the bed's back or front edge)."""
    f = 0.5625
    T = 107.33
    c = canvas_for(176, 100, f, T, 5, margin_bottom=4)
    c.box(0, T, 0, 3, 0, 9, WOOD_OLD)
    c.seam(1, 1.5, T - 1, 1.5, 9, WOOD_OLD[1])
    return c


def garden_edge_b(seed=1):
    """Garden kit: one tile of low plank frame along +b (the bed's side edge)."""
    f = 0.5625
    T = 107.33
    c = canvas_for(176, 100, f, 5, T, margin_bottom=4)
    c.box(0, 3, 0, T, 0, 9, WOOD_OLD)
    return c


def garden_post(seed=1):
    """Garden kit: a corner post of the frame."""
    f = 0.5625
    c = canvas_for(32, 48, f, 6, 6, margin_bottom=4)
    c.box(0, 5, 0, 5, 0, 14, WOOD_DARK)
    return c


def garden_cabbages(seed=1):
    """Garden kit: one tile-long row of cabbages on a soil ridge (lies on the painted soil, along +a)."""
    f = 0.5625
    T = 100
    c = canvas_for(176, 104, f, T, 14, margin_bottom=4)
    c.box(0, T, 2, 12, 0, 2.5, SOIL)
    rnd = random.Random(seed)
    for i in range(6):
        a = 8 + i * (T - 16) / 5 + rnd.uniform(-2, 2)
        x, y = c.p(a, 7, 2)
        r = c.s(rnd.uniform(11, 13)) / 2
        c.d.ellipse([x - r, y - r * 0.9, x + r, y + r * 0.45], fill=CABBAGE[1], outline=LINE)
        c.d.ellipse([x - r * 0.55, y - r * 0.75, x + r * 0.25, y - r * 0.05], fill=CABBAGE[0])
        c.d.arc([x - r * 0.9, y - r * 0.9, x + r * 0.9, y + r * 0.4], 200, 340, fill=CABBAGE[0])
    return c


def garden_beans(seed=1):
    """Garden kit: a tile-long row of beans climbing tied stakes, with a few ochre flowers."""
    f = 0.5625
    T = 100
    c = canvas_for(176, 140, f, T, 12, margin_bottom=4)
    c.box(0, T, 2, 10, 0, 2.5, SOIL)
    for i in range(5):
        a = 10 + i * (T - 20) / 4
        p0, p1 = c.p(a - 3, 6, 2), c.p(a + 1, 6, 40)
        p2 = c.p(a + 5, 6, 2)
        c.d.line([p0, p1], fill=WOOD_DARK[1], width=2)
        c.d.line([p2, p1], fill=WOOD_DARK[1], width=2)
        shrubs(c, a - 4, a + 4, 4, 8, 6, 5, seed + i, size=(6, 9), flowers=2)
        shrubs(c, a - 3, a + 3, 5, 7, 22, 3, seed + 10 + i, size=(5, 7), flowers=1)
    return c


def garden_greens(seed=1):
    """Garden kit: a tile-long row of low leafy greens."""
    f = 0.5625
    T = 100
    c = canvas_for(176, 100, f, T, 12, margin_bottom=4)
    c.box(0, T, 2, 10, 0, 2.5, SOIL)
    shrubs(c, 4, T - 4, 4, 8, 2.5, 16, seed, size=(7, 10), tones=[rgb("#7a9a4e"), rgb("#5a7a38"), rgb("#405a28")])
    return c


def stone_lantern(seed=1):
    f = 0.5625
    c = canvas_for(84, 136, f, 22, 22, margin_bottom=4)
    A, B = 11, 11
    stone_box(c, A - 9, A + 9, B - 9, B + 9, 0, 6, STONE_PALE, course=6, block=9)  # plinth
    c.box(A - 3.5, A + 3.5, B - 3.5, B + 3.5, 6, 30, STONE_PALE)                   # shaft
    c.box(A - 7, A + 7, B - 7, B + 7, 30, 33, STONE_PALE)                          # platform
    c.box(A - 5, A + 5, B - 5, B + 5, 33, 44, STONE_PALE)                          # firebox
    p = c.p
    c.poly([p(A - 2.5, B + 5, 35), p(A + 2.5, B + 5, 35), p(A + 2.5, B + 5, 42), p(A - 2.5, B + 5, 42)], AMBER[1])  # window
    c.poly([p(A + 5, B - 2, 35), p(A + 5, B + 2, 35), p(A + 5, B + 2, 42), p(A + 5, B - 2, 42)], AMBER[2])
    # a low pyramid cap with a knob
    top = p(A, B, 54)
    c.poly([p(A - 9, B + 9, 44), p(A + 9, B + 9, 44), top], STONE_PALE[1])
    c.poly([p(A + 9, B - 9, 44), p(A + 9, B + 9, 44), top], STONE_PALE[2])
    c.poly([p(A - 9, B - 9, 44), p(A - 9, B + 9, 44), top], STONE_PALE[0])
    c.ell(A, B, 55, 4, STONE_PALE[0])
    return c


def trough_hay(seed=1):
    f = 0.62
    L, D = 150, 40
    c = canvas_for(256, 196, f, L, D, margin_bottom=4)
    # a slatted hay rack on legs at the left, a stone water trough at the right
    for a in (6, 50):
        for b in (6, 20):
            c.box(a, a + 3, b, b + 3, 0, 40, WOOD_DARK)
    c.box(6, 53, 6, 23, 22, 24, WOOD_DARK)
    rnd = random.Random(seed)
    p = c.p
    hay = [p(4, 14, 30)] + [p(6 + i * 47 / 8, 8 + rnd.uniform(-2, 2), 44 + rnd.uniform(0, 6)) for i in range(9)] + \
          [p(56, 14, 30), p(53, 24, 24), p(6, 24, 24)]
    c.poly(hay, HAY[0])
    for i in range(10):
        a = 8 + i * 4.6
        c.d.line([p(a, 23, 25), p(a + rnd.uniform(-1, 1), 21, 38)], fill=HAY[1])
    for a in (6, 50):
        c.box(a, a + 3, 20, 23, 0, 40, WOOD_DARK)
    for a in [10 + i * 6 for i in range(7)]:
        c.box(a, a + 1.5, 22.5, 23.5, 24, 40, WOOD_DARK)                       # front slats
    c.box(6, 53, 21, 24, 38, 40, WOOD_DARK)
    stone_box(c, 82, 140, 10, 32, 0, 14, STONE, course=7, block=12)
    c.poly([p(85, 13, 14), p(137, 13, 14), p(137, 29, 14), p(85, 29, 14)], WATER[1])
    c.seam(88, 18, 120, 18, 14, WATER[0])
    # a wooden bucket by the trough
    barrel(c, 74, 34, 0, 10, 9, WOOD_DARK, lid=False)
    c.ell(74, 34, 9, 8, WATER[1], line=False)
    return c


def low_planter(seed=1):
    f = 0.7
    L, D = 140, 44
    c = canvas_for(256, 136, f, L, D, margin_bottom=4)
    stone_box(c, 0, L, 0, D, 0, 16, STONE_PALE, course=8, block=14)
    c.poly([c.p(3, 3, 16), c.p(L - 3, 3, 16), c.p(L - 3, D - 3, 16), c.p(3, D - 3, 16)], SOIL[1])
    shrubs(c, 8, L - 8, 8, D - 8, 16, 26, seed, size=(12, 18), flowers=6)
    return c


def low_planter_1x2(seed=1):
    f = 0.7
    L, D = 44, 140
    c = canvas_for(256, 136, f, L, D, margin_bottom=4)
    stone_box(c, 0, L, 0, D, 0, 16, STONE_PALE, course=8, block=14)
    c.poly([c.p(3, 3, 16), c.p(L - 3, 3, 16), c.p(L - 3, D - 3, 16), c.p(3, D - 3, 16)], SOIL[1])
    shrubs(c, 8, L - 8, 8, D - 8, 16, 26, seed + 5, size=(12, 18), flowers=6)
    return c


def barrels(seed=1):
    f = 0.5625
    c = canvas_for(120, 120, f, 44, 40, margin_bottom=4)
    barrel(c, 14, 14, 0, 20, 26)
    barrel(c, 32, 20, 0, 18, 24, WOOD_OLD)
    barrel(c, 18, 32, 0, 16, 14, WOOD, lid=False)                  # a short open tub of water
    c.ell(18, 32, 14, 13, WATER[1], line=False)
    return c


def crates(seed=1):
    f = 0.5625
    c = canvas_for(120, 132, f, 46, 40, margin_bottom=4)
    c.crate(4, 30, 4, 28, 0, 20, slats=3)
    c.crate(30, 46, 14, 36, 0, 14, slats=2)
    c.crate(7, 28, 7, 26, 20, 16, slats=2, lid_ajar=True)
    return c


def water_jars(seed=1):
    f = 0.5625
    c = canvas_for(112, 120, f, 40, 36, margin_bottom=4)
    c.jar(12, 12, 0, 20, 30, CLAY, neck=0.5)
    c.jar(28, 16, 0, 17, 25, CLAY_PALE, neck=0.5)
    c.box(26, 30, 15, 17, 25, 26, WOOD)                             # a wooden lid
    c.jar(18, 28, 0, 9, 10, CLAY, handle=True)                      # a dipper jug
    return c


def firewood(seed=1):
    f = 0.5625
    L, D = 64, 16
    c = canvas_for(132, 104, f, L, D, margin_bottom=4)
    # split logs stacked between two end posts: uneven rounds of three sizes, the top course uneven
    for a in (0, L - 3):
        c.box(a, a + 3, 0, D, 0, 30, WOOD_DARK)
    c.box(3, L - 3, 0, D, 0, 22, WOOD_OLD)
    rnd = random.Random(seed)
    tops = []
    a = 6
    while a < L - 8:
        d = rnd.choice((5, 6.5, 8))
        tops.append((a + d / 2, 22 + d * 0.45, d))
        a += d * 0.95
    for ac, zc, d in tops:                                             # top course: log backs, lit
        c.box(ac - d / 2, ac + d / 2, 1, D - 1, 20, zc + d * 0.3, [WOOD[0], WOOD[1], WOOD[2]])
    for r in range(4):                                                 # visible ends on the +b face
        zc = 3 + r * 5.6
        a = 5 + (2.5 if r % 2 else 0)
        while a < L - 6:
            d = rnd.choice((4.6, 5.6, 6.6))
            x, y = c.p(a, D, zc)
            rr = c.s(d) / 2
            c.d.ellipse([x - rr, y - rr * 0.95, x + rr, y + rr * 0.95], fill=rgb("#a98456"), outline=LINE)
            c.d.ellipse([x - rr * 0.35, y - rr * 0.35, x + rr * 0.35, y + rr * 0.35], fill=rgb("#8a6842"))
            a += d * rnd.uniform(0.95, 1.1)
    for ac, zc, d in tops:
        x, y = c.p(ac, D, zc)
        rr = c.s(d) / 2
        c.d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=rgb("#a98456"), outline=LINE)
    # a chopping block and an axe-less split log in front
    c.cylinder(L - 6, D + 10, 0, 12, 8, WOOD_DARK)
    c.box(8, 22, D + 6, D + 9, 0, 3, WOOD)
    return c


def kiln(seed=1):
    f = 0.5625
    c = canvas_for(160, 168, f, 64, 50, margin_bottom=4)
    A, B = 26, 24
    # brick base drum, clay dome, stack, arched fire mouth with embers; pots drying on a board
    c.cylinder(A, B, 0, 44, 14, BRICK)
    x, y = c.p(A, B, 14)
    r = c.s(44) / 2
    c.d.chord([x - r, y - r * 1.25, x + r, y + r * 0.5], 180, 360, fill=CLAY[1], outline=LINE)
    c.d.chord([x - r * 0.9, y - r * 1.15, x + r * 0.1, y + r * 0.2], 180, 270, fill=CLAY[0])
    c.d.rectangle([x - r, y - 1, x + r, y + 1], fill=CLAY[1])
    c.cylinder(A + 8, B - 6, 24, 9, 22, BRICK)
    xm, ym = c.p(A - 4, B + 22, 0)
    c.d.chord([xm - c.s(7), ym - c.s(16), xm + c.s(7), ym + c.s(2)], 180, 360, fill=LINE)
    c.d.rectangle([xm - c.s(7), ym - c.s(7), xm + c.s(7), ym], fill=LINE)
    c.d.ellipse([xm - c.s(4), ym - c.s(5), xm + c.s(4), ym], fill=AMBER[2])
    c.box(46, 62, 34, 46, 0, 2.5, WOOD_OLD)
    c.jar(50, 40, 2.5, 7, 9, CLAY_PALE)
    c.jar(57, 41, 2.5, 6, 7, CLAY_PALE, neck=0.5)
    return c


OBJECTS = [
    ("village-well", village_well, (1, 1)), ("banner-pole", banner_pole, (1, 1)), ("lantern-post", lantern_post, (1, 1)),
    ("laundry-line", laundry_line, (2, 1)), ("notice-board", notice_board, (1, 1)), ("handcart", handcart, (3, 1)),
    ("garden-edge-a", garden_edge_a, (1, 1)), ("garden-edge-b", garden_edge_b, (1, 1)), ("garden-post", garden_post, (1, 1)),
    ("garden-cabbages", garden_cabbages, (1, 1)), ("garden-beans", garden_beans, (1, 1)), ("garden-greens", garden_greens, (1, 1)),
    ("stone-lantern", stone_lantern, (1, 1)), ("trough-hay", trough_hay, (2, 1)), ("low-planter", low_planter, (2, 1)),
    ("low-planter-1x2", low_planter_1x2, (1, 2)), ("barrels", barrels, (1, 1)), ("crates", crates, (1, 1)),
    ("water-jars", water_jars, (1, 1)), ("firewood", firewood, (1, 1)), ("kiln", kiln, (1, 1)),
]

if __name__ == "__main__":
    TILE_EDGE = 107.33
    meta_path = OUT / "meta.json"
    meta = json.loads(meta_path.read_text())
    for name, fn, fp in OBJECTS:
        c = fit(fn())
        c.im.save(OUT / f"{name}.png")
        bb = c.im.getbbox()
        assert all(v % 4 == 0 for v in c.im.size), name
        assert bb and bb[0] > 0 and bb[1] > 0 and bb[2] < c.im.width and bb[3] < c.im.height, (name, bb, c.im.size)
        meta[name] = {
            "canvas": list(c.im.size), "grain_f": c.f,
            "ground_anchor_src_px": [round(c.ox, 2), round(c.oy, 2)],
            "extent_screen_px": {"along_a": c.L, "along_b": c.D},
            "footprint_tiles": list(fp),
            "offset_in_footprint_screen_px": [round((fp[0] * TILE_EDGE - c.L) / 2, 2), round((fp[1] * TILE_EDGE - c.D) / 2, 2)],
        }
        print(name, c.im.size, bb)
    meta_path.write_text(json.dumps(meta, indent=1) + "\n")
