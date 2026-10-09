"""Round 3 dressing pieces for Ba Dan (`pieces.py` is the houses, tables, planters and bridge): street furniture, props, boundary-wall modules.  Footprint origin is tile (0,0);
x runs down-right on screen, y down-left, z is world px.  Painter order is call order: back (small x+y) first."""
import math
from guidelib import Piece, mul, K_TOP, K_LEFT, K_RIGHT
from pieces import (prism, ring, STONE, WOOD, TIMBER, SOIL, CLAY, STRAW, LANTERN, DARK, PLASTER, CLOTH, GREEN_TILE,
                    TERRACOTTA, crate, planter as v3_planter)
from geo import solid, beam, cyl, pyramid, gable_roof, wheel, ring3, S

BANNER = (66, 104, 84)
BANNER_TRIM = (222, 196, 140)
GREY = (150, 146, 136)
HAY = (222, 192, 104)
WATER = (62, 108, 128)
LEAF = (84, 132, 70)
ROPE = (170, 140, 90)


def post(p, cx, cy, w, z0, z1, col=None, lw=1.2, tag=None):
    h = w / 2.0
    p.box(cx - h, cx + h, cy - h, cy + h, z0, z1, col or mul(WOOD, 0.9), lw, tag=tag)


def sackp(p, cx, cy, z, s=1.0, col=(206, 182, 130)):
    prism(p, cx, cy, 0.11 * s, 0.14 * s, z, z + 11 * s, col, 12, hoops=(0.5,))
    prism(p, cx, cy, 0.14 * s, 0.06 * s, z + 11 * s, z + 21 * s, col, 12, topcol=mul(col, 0.7))
    p.line([(cx - 0.07 * s, cy, z + 20 * s), (cx + 0.07 * s, cy, z + 20 * s)], 1.5, (110, 84, 50))


def basket(p, cx, cy, z, r=0.14, h=14, prod=None):
    BASK = (150, 100, 50)
    prism(p, cx, cy, r * 0.8, r, z, z + h, BASK, 14, hoops=(0.33, 0.66), topcol=mul(BASK, 0.8))
    p.line(ring(cx, cy, r * 0.95, r * 0.95, z + h, 18) + [ring(cx, cy, r * 0.95, r * 0.95, z + h, 18)[0]], 1.2, mul(BASK, 0.6))
    if prod:
        a = [i * math.pi / 12 for i in range(13)]
        p.line([(cx + r * 0.9 * math.cos(t), cy, z + h + 9 * math.sin(t)) for t in a], 1.3, prod)
        p.line([(cx, cy + r * 0.9 * math.cos(t), z + h + 9 * math.sin(t)) for t in a], 1.3, prod)


def barrel_big(p, cx, cy, z, r=0.12, h=32):
    prism(p, cx, cy, r, r, z, z + h, WOOD, 12, hoops=(0.18, 0.82), topcol=(70, 100, 110))
    p.line([(cx + r * 0.82 * math.cos(2 * math.pi * i / 12), cy + r * 0.82 * math.sin(2 * math.pi * i / 12), z + h) for i in range(13)], 1.0)


# ================================================================================ well
def well():
    p = Piece('village-well', 1, 1)
    cx = cy = 0.5
    prism(p, cx, cy, 0.38, 0.36, 0, 22, STONE, 12, hoops=(0.5,))
    for k in range(12):  # staggered stone joints on the visible half of the curb
        a = -math.pi / 4 + (k + 0.5) * math.pi / 12
        r0 = 0.37
        p.line([(cx + r0 * math.cos(a), cy + r0 * math.sin(a), 0 if k % 2 else 11), (cx + r0 * math.cos(a), cy + r0 * math.sin(a), 11 if k % 2 else 22)], 0.9)
    p.poly(ring(cx, cy, 0.27, 0.27, 22, 18), DARK, 1.2)  # open mouth, nothing under it
    p.poly(ring(cx, cy, 0.20, 0.20, 22, 18), mul(WATER, 0.5), 0.8)
    # back post, diagonal brace, then the roller, rope, bucket, front post
    post(p, 0.5, 0.17, 0.07, 22, 90)
    p.line([(0.5, 0.17, 38), (0.5, 0.30, 70)], 1.6)
    cyl(p, (0.5, 0.17, 66), (0.5, 0.83, 66), 0.055, mul(WOOD, 1.0), n=10, lw=1.1)
    for k in range(1, 8):
        y = 0.2 + 0.6 * k / 8
        p.line([(0.5 - 0.055, y, 66), (0.5, y, 66 + 4.4), (0.5 + 0.055, y, 66)], 0.8, ROPE)
    p.line([(0.5, 0.5, 66), (0.5, 0.5, 46)], 1.1, ROPE)
    p.line([(0.5, 0.5, 66), (0.56, 0.5, 46)], 1.0, ROPE)
    prism(p, 0.54, 0.5, 0.07, 0.085, 30, 46, WOOD, 10, hoops=(0.5,), topcol=mul(DARK, 1.2))
    p.line([(0.5, 0.83 + 0.0, 66), (0.5, 0.97, 66), (0.5, 0.97, 44)], 2.0)  # crank arm, then handle down
    cyl(p, (0.5, 0.95, 44), (0.5, 0.99, 44), 0.022, mul(WOOD, 1.1), n=8, lw=0.9)
    post(p, 0.5, 0.83, 0.07, 22, 90)
    p.line([(0.5, 0.83, 38), (0.5, 0.70, 70)], 1.6)
    # roofed: gable ridge along y, a little overhang, slats gaps between roof and posts stay open
    gable_roof(p, 0.12, 0.88, 0.04, 0.96, 94, 112, TERRACOTTA, th=4.0, courses=6)
    p.line([(0.5, 0.96, 112), (0.5, 0.96, 120)], 1.4)
    return p


# ============================================================================== banner pole
def banner_pole():
    p = Piece('banner-pole', 1, 1)
    p.box(0.36, 0.64, 0.36, 0.64, 0, 8, STONE, 1.3, tag='plinth')
    p.stone_courses(0.36, 0.64, 0.36, 0.64, 0, 8, 1, joint=0.14)
    post(p, 0.5, 0.5, 0.06, 8, 126, mul(TIMBER, 1.0))
    p.box(0.455, 0.545, 0.15, 0.85, 118, 124, mul(WOOD, 1.0), 1.3)  # cross arm along y
    for yy in (0.15, 0.85):
        p.box(0.445, 0.555, yy - 0.03, yy + 0.03, 116, 128, mul(TIMBER, 1.1), 1.1)
    p.box(0.455, 0.545, 0.455, 0.545, 126, 134, mul(TIMBER, 1.1), 1.2)  # finial
    # banner on the +x side of the pole
    X = 0.58
    pts = [(X, 0.26, 117), (X, 0.74, 117), (X, 0.74, 44), (X, 0.50, 58), (X, 0.26, 44)]
    p.poly(pts, BANNER, 1.4)
    p.poly([(X, 0.26, 117), (X, 0.74, 117), (X, 0.74, 108), (X, 0.26, 108)], mul(BANNER_TRIM, 1.0), 1.0)
    d = [(X, 0.50, 100), (X, 0.62, 84), (X, 0.50, 68), (X, 0.38, 84)]
    p.line(d + [d[0]], 1.3, BANNER_TRIM)
    for yy in (0.30, 0.50, 0.70):  # ties to the arm
        p.line([(X, yy, 117), (0.5, yy, 118)], 1.0)
    return p


# =============================================================================== lantern post
def lantern_post():
    p = Piece('lantern-post', 1, 1)
    p.box(0.40, 0.60, 0.40, 0.60, 0, 10, STONE, 1.3, tag='plinth')
    p.stone_courses(0.40, 0.60, 0.40, 0.60, 0, 10, 1, joint=0.1)
    post(p, 0.5, 0.5, 0.06, 10, 108, mul(TIMBER, 1.0))
    p.box(0.46, 0.54, 0.46, 0.54, 108, 112, mul(TIMBER, 1.1), 1.1)
    p.box(0.50, 0.78, 0.485, 0.515, 101, 106, mul(WOOD, 1.0), 1.2)  # arm toward +x
    p.line([(0.5, 0.5, 84), (0.66, 0.5, 102)], 1.8)  # brace
    p.line([(0.74, 0.5, 101), (0.74, 0.5, 94)], 1.0)  # chain
    p.box(0.68, 0.80, 0.44, 0.56, 90, 94, mul(TIMBER, 1.1), 1.1)
    pyramid(p, 0.675, 0.805, 0.435, 0.565, 94, 102, mul(TIMBER, 1.2), 1.2)
    p.box(0.70, 0.78, 0.46, 0.54, 66, 90, LANTERN, 1.2)
    p.line([(0.78, 0.46, 66), (0.78, 0.54, 90)], 0.8)
    p.line([(0.70, 0.54, 78), (0.78, 0.54, 78)], 0.8)
    p.line([(0.78, 0.46, 78), (0.78, 0.54, 78)], 0.8)
    p.box(0.68, 0.80, 0.44, 0.56, 62, 66, mul(TIMBER, 1.1), 1.1)
    return p


# ============================================================================== shop stack
def shop_stack():
    """Crates, a barrel and a basket stacked against a shop wall (1x1)."""
    p = Piece('shop-stack', 1, 1)
    crate(p, 0.08, 0.10, 0.46, 0.38, 0, 17)
    crate(p, 0.12, 0.13, 0.36, 0.30, 17, 15)
    crate(p, 0.54, 0.08, 0.36, 0.32, 0, 15)
    basket(p, 0.24, 0.74, 0, 0.13, 12, (176, 52, 48))
    barrel_big(p, 0.66, 0.66, 0, 0.14, 34)
    sackp(p, 0.42, 0.52, 0, 0.8)
    return p


# ================================================================================== baskets
def baskets():
    p = Piece('baskets', 1, 1)
    p.box(0.06, 0.94, 0.08, 0.92, 0, 4, mul(WOOD, 0.9), 1.3, tag='plinth')
    for k in range(1, 6):
        y = 0.08 + 0.84 * k / 6
        p.line([(0.06, y, 4), (0.94, y, 4)], 0.9)
    basket(p, 0.30, 0.30, 4, 0.15, 15, (176, 52, 48))
    basket(p, 0.70, 0.28, 4, 0.14, 14, (80, 130, 60))
    basket(p, 0.46, 0.68, 4, 0.17, 17, (214, 160, 60))
    sackp(p, 0.80, 0.74, 4, 0.7)
    return p


# ============================================================================ laundry line
def laundry_line():
    p = Piece('laundry-line', 2, 1)
    xa, xb, y = 0.20, 1.80, 0.5
    post(p, xa, y, 0.07, 0, 100)
    post(p, xb, y, 0.07, 0, 100)
    for xx in (xa, xb):
        p.box(xx - 0.045, xx + 0.045, y - 0.10, y + 0.10, 94, 99, mul(WOOD, 1.0), 1.1)  # cross-piece the line ties to
        p.line([(xx, y, 20), (xx + (0.1 if xx < 1 else -0.1), y + 0.04, 0)], 1.4)  # footing brace
    sag = 9.0
    zr = lambda x: 94 - sag * (1 - ((x - 1.0) / 0.8) ** 2)
    line = [(xa + (xb - xa) * k / 24, y, zr(xa + (xb - xa) * k / 24)) for k in range(25)]
    p.line(line, 1.3, ROPE)
    cloths = [(0.38, 0.30, 36, CLOTH[0], 'sheet'), (0.80, 0.26, 30, CLOTH[2], 'sheet'), (1.15, 0.30, 26, PLASTER, 'tunic'),
              (1.52, 0.20, 34, CLOTH[1], 'sheet')]
    for cx, w, h, col, kind in cloths:
        x0, x1 = cx - w / 2, cx + w / 2
        z0, z1 = zr(x0), zr(x1)
        if kind == 'tunic':
            p.poly([(x0, y, z0), (x1, y, z1), (x1, y, z1 - h), (x0, y, z0 - h)], col, 1.2)
            sl = 0.09
            p.poly([(x0 - sl, y, z0 - 1), (x0, y, z0), (x0, y, z0 - 14), (x0 - sl, y, z0 - 18)], mul(col, 0.95), 1.1)
            p.poly([(x1, y, z1), (x1 + sl, y, z1 - 1), (x1 + sl, y, z1 - 18), (x1, y, z1 - 14)], mul(col, 0.95), 1.1)
        else:
            mid = (x0 + x1) / 2
            zm = zr(mid) - h - 2
            p.poly([(x0, y, z0), (mid, y, zr(mid)), (x1, y, z1), (x1, y, z1 - h), (mid, y, zm), (x0, y, z0 - h)], col, 1.2)
            p.line([(x0 + 0.02, y, z0 - 6), (x1 - 0.02, y, z1 - 6)], 0.8)
        for xx, zz in ((x0, z0), (x1, z1)):
            p.box(xx - 0.012, xx + 0.012, y - 0.012, y + 0.012, zz - 2, zz + 3, mul(DARK, 1.3), 0.8)
    prism(p, 1.45, 0.80, 0.14, 0.16, 0, 16, WOOD, 12, hoops=(0.5,), topcol=WATER)  # wash tub
    return p


# =================================================================================== notice board
def notice_board():
    p = Piece('notice-board', 1, 1)
    for yy in (0.15, 0.85):
        p.box(0.44, 0.56, yy - 0.05, yy + 0.05, 0, 5, STONE, 1.1, tag='plinth')
        post(p, 0.5, yy, 0.07, 5, 104)
    p.box(0.50, 0.56, 0.12, 0.88, 40, 94, mul(TIMBER, 1.0), 1.4)  # frame
    X = 0.565
    p.poly([(X, 0.17, 45), (X, 0.83, 45), (X, 0.83, 89), (X, 0.17, 89)], mul(WOOD, 1.05), 1.1)
    papers = [(0.20, 0.38, 62, 87, PLASTER), (0.42, 0.58, 66, 88, (232, 214, 170)), (0.62, 0.80, 60, 86, PLASTER),
              (0.22, 0.42, 47, 60, (232, 214, 170)), (0.50, 0.78, 47, 58, PLASTER)]
    for a, b, z0, z1, col in papers:
        p.poly([(X + 0.003, a, z0), (X + 0.003, b, z0), (X + 0.003, b, z1), (X + 0.003, a, z1)], col, 0.9)
        for k in range(1, 4):
            z = z0 + (z1 - z0) * k / 4
            p.line([(X + 0.003, a + 0.02, z), (X + 0.003, b - 0.02, z)], 0.6)
    # shed roof falling toward +x
    V = [(0.38, 0.02, 100), (0.38, 0.98, 100), (0.66, 0.98, 94), (0.66, 0.02, 94),
         (0.38, 0.02, 104), (0.38, 0.98, 104), (0.66, 0.98, 98), (0.66, 0.02, 98)]
    solid(p, V, [[0, 1, 2, 3], [4, 5, 6, 7], [3, 2, 6, 7], [1, 2, 6, 5], [0, 1, 5, 4], [0, 3, 7, 4]], TERRACOTTA, 1.3)
    for k in range(1, 6):
        yy = 0.02 + 0.96 * k / 6
        p.line([(0.38, yy, 104), (0.66, yy, 98)], 0.8)
    return p


# ===================================================================================== handcart
def handcart():
    p = Piece('handcart', 3, 1)
    ax_x, wy0, wy1, R = 1.85, 0.10, 0.86, 26
    cz = R
    # far wheel, axle, shafts under the floor
    wheel(p, ax_x, wy0, cz, R, mul(WOOD, 1.0), thick=0.05)
    cyl(p, (ax_x, wy0 + 0.05, cz), (ax_x, wy1, cz), 0.022, mul(TIMBER, 1.0), n=8, lw=0.9)
    for yy in (0.36, 0.64):
        beam(p, (2.30, yy, 31), (0.30, yy, 3), 0.045, mul(WOOD, 0.95), 1.2, h=0.04)
    beam(p, (0.30, 0.31, 5), (0.30, 0.69, 5), 0.04, mul(WOOD, 1.0), 1.2)  # handle bar across the shaft tips
    # bed
    p.box(1.30, 2.50, 0.26, 0.74, 31, 35, mul(WOOD, 1.0), 1.4)
    for k in range(1, 5):
        p.line([(1.30 + 1.2 * k / 5, 0.74, 35), (1.30 + 1.2 * k / 5, 0.26, 35)], 0.8)
    p.box(1.30, 2.50, 0.26, 0.30, 35, 49, mul(WOOD, 0.95), 1.3)  # far side board
    p.box(1.30, 1.34, 0.30, 0.70, 35, 52, mul(WOOD, 0.9), 1.3)  # front board
    p.box(2.46, 2.50, 0.30, 0.70, 35, 43, mul(WOOD, 0.9), 1.2)  # tail board
    sackp(p, 1.65, 0.50, 35, 1.0)
    crate(p, 1.95, 0.36, 0.30, 0.28, 35, 14)
    p.box(1.30, 2.50, 0.70, 0.74, 35, 49, mul(WOOD, 1.0), 1.4)  # near side board
    for k in range(1, 4):
        p.line([(1.30 + 1.2 * k / 4, 0.74, 35), (1.30 + 1.2 * k / 4, 0.74, 49)], 0.9)
    wheel(p, ax_x, wy1, cz, R, mul(WOOD, 1.05), thick=0.05)
    return p


# ======================================================================================= bench
def bench(w, d):
    """2x1 faces +y (backrest at the -y side) or 1x2 faces +x (backrest at the -x side).  Slat gaps and the space under the seat are open."""
    name = 'bench-2x1' if (w, d) == (2, 1) else 'bench-1x2'
    p = Piece(name, w, d)
    L = 2.0

    def B(u0, u1, v0, v1, z0, z1, col, lw=1.2):
        if w == 2:
            p.box(u0, u1, v0, v1, z0, z1, col, lw)
        else:
            p.box(v0, v1, u0, u1, z0, z1, col, lw)

    def Ln(u, v, z, u2, v2, z2, lw=0.9):
        if w == 2:
            p.line([(u, v, z), (u2, v2, z2)], lw)
        else:
            p.line([(v, u, z), (v2, u2, z2)], lw)

    for uc in (0.18, 1.82):  # backrest posts (behind everything else)
        B(uc - 0.04, uc + 0.04, 0.30, 0.35, 22, 60, mul(WOOD, 0.85))
    for z0 in (30, 39, 48):
        B(0.12, 1.88, 0.31, 0.345, z0, z0 + 6, WOOD)
    for uc in (0.20, 1.80):  # slab legs, the space between them is open
        B(uc - 0.05, uc + 0.05, 0.36, 0.66, 0, 21, mul(STONE if False else WOOD, 0.85))
    B(0.06, 1.94, 0.36, 0.68, 21, 26, WOOD, 1.4)
    for v in (0.47, 0.57):
        Ln(0.06, v, 26, 1.94, v, 26)
    return p


# =================================================================================== garden plot
def garden_plot():
    """3x2 kitchen-garden plot: three crop rows, bean poles, and a low fence along the south and east edges."""
    p = Piece('garden-plot-3x2', 3, 2)
    p.poly([(0.05, 0.05, 0), (2.95, 0.05, 0), (2.95, 1.95, 0), (0.05, 1.95, 0)], mul(SOIL, 1.0), 1.2, tag='plinth')
    rows = [1.40, 0.86, 0.32]  # beans at the south (front) row, cabbages at the back
    for r, y in enumerate(rows):
        p.box(0.14, 2.76, y - 0.12, y + 0.12, 0, 5, mul(SOIL, 0.8), 1.2)
    # row 0: bean poles (see-through teepees), row 1: cabbages, row 2: low leaf tufts
    for cx in (0.55, 1.45, 2.35):
        top = (cx, rows[0], 62)
        for (dx, dy) in ((-0.10, -0.08), (0.10, -0.08), (0.0, 0.11)):
            p.line([(cx + dx, rows[0] + dy, 5), top], 1.5, mul(WOOD, 0.9))
        p.line([(cx - 0.07, rows[0] + 0.0, 28), (cx + 0.07, rows[0] + 0.0, 28)], 0.9, LEAF)
    for k in range(6):
        cx = 0.30 + k * 0.44
        prism(p, cx, rows[1], 0.07, 0.12, 5, 14, LEAF, 10, hoops=(0.5,), topcol=mul(LEAF, 1.15))
    for k in range(9):
        cx = 0.25 + k * 0.29
        for dx in (-0.04, 0.0, 0.04):
            p.line([(cx + dx, rows[2], 5), (cx + dx * 1.8, rows[2] + 0.01, 17)], 1.4, LEAF)
    # fence: east edge (x=2.97) then south edge (y=1.97), posts every 0.75
    def fence_x(y_a, y_b, x):  # along y at fixed x
        n = max(1, int(round((y_b - y_a) / 0.75)))
        ys = [y_a + (y_b - y_a) * i / n for i in range(n + 1)]
        for z0, z1 in ((9, 13), (20, 24)):
            for ya, yb in zip(ys, ys[1:]):
                p.box(x - 0.015, x + 0.015, ya, yb, z0, z1, mul(WOOD, 1.0), 1.0)
        for y in ys:
            post(p, x, y, 0.065, 0, 30, mul(WOOD, 0.9))

    def fence_y(x_a, x_b, y):
        n = max(1, int(round((x_b - x_a) / 0.75)))
        xs = [x_a + (x_b - x_a) * i / n for i in range(n + 1)]
        for z0, z1 in ((9, 13), (20, 24)):
            for xa, xb in zip(xs, xs[1:]):
                p.box(xa, xb, y - 0.015, y + 0.015, z0, z1, mul(WOOD, 1.0), 1.0)
        for x in xs:
            post(p, x, y, 0.065, 0, 30, mul(WOOD, 0.9))

    fence_x(0.05, 1.95, 2.96)
    fence_y(0.05, 2.96, 1.96)
    return p


# ================================================================================ stone lantern
def stone_lantern():
    p = Piece('stone-lantern', 1, 1)
    p.box(0.30, 0.70, 0.30, 0.70, 0, 6, STONE, 1.3, tag='plinth')
    p.stone_courses(0.30, 0.70, 0.30, 0.70, 0, 6, 1, joint=0.2)
    p.box(0.42, 0.58, 0.42, 0.58, 6, 30, mul(STONE, 1.0), 1.3)
    p.box(0.34, 0.66, 0.34, 0.66, 30, 35, mul(STONE, 1.05), 1.3)
    p.box(0.38, 0.62, 0.38, 0.62, 35, 57, mul(STONE, 1.0), 1.3)
    for (a, b) in ((0.44, 0.56),):
        p.poly([(0.62, a, 42), (0.62, b, 42), (0.62, b, 52), (0.62, a, 52)], mul(LANTERN, 1.0), 1.1)
        p.poly([(a, 0.62, 42), (b, 0.62, 42), (b, 0.62, 52), (a, 0.62, 52)], mul(LANTERN, 1.1), 1.1)
    p.box(0.30, 0.70, 0.30, 0.70, 57, 61, mul(STONE, 1.08), 1.3)
    pyramid(p, 0.26, 0.74, 0.26, 0.74, 61, 74, mul(STONE, 1.0), 1.3)
    prism(p, 0.5, 0.5, 0.045, 0.045, 74, 82, mul(STONE, 1.1), 8)
    return p


# ============================================================================ firewood shelter
def firewood_shelter():
    """2x1 lean-to: open front, two log stacks (logs run along y, ends toward the viewer on the +y side), chopping block with an axe."""
    p = Piece('firewood-shelter', 2, 1)
    # back posts and the back rail
    for x in (0.10, 1.00, 1.90):
        post(p, x, 0.18, 0.07, 0, 76)
    # log stacks (rows of round ends on the +y face)
    for (xa, xb) in ((0.14, 0.94), (1.06, 1.86)):
        p.box(xa, xb, 0.22, 0.78, 0, 36, mul(WOOD, 0.9), 1.3)
        cols, rows = 5, 4
        for r in range(rows):
            for c in range(cols):
                off = 0.5 * (r % 2)
                cx = xa + (c + 0.5 + off * 0.5) * (xb - xa) / (cols + 0.5)
                z = 4.5 + 8.5 * r
                rt = 3.9 / S
                p.poly([(cx + rt * math.cos(2 * math.pi * i / 10), 0.78, z + 3.9 * math.sin(2 * math.pi * i / 10)) for i in range(10)],
                       mul(WOOD, 1.25 - 0.06 * r), 0.9)
    # front posts
    for x in (0.10, 1.00, 1.90):
        post(p, x, 0.84, 0.07, 0, 58)
    # shed roof falling toward +y: high at the back (z 78), low at the front (z 60)
    V = [(-0.05, 0.08, 78), (2.05, 0.08, 78), (2.05, 0.96, 60), (-0.05, 0.96, 60),
         (-0.05, 0.08, 82), (2.05, 0.08, 82), (2.05, 0.96, 64), (-0.05, 0.96, 64)]
    solid(p, V, [[0, 1, 2, 3], [4, 5, 6, 7], [3, 2, 6, 7], [1, 2, 6, 5], [0, 1, 5, 4], [0, 3, 7, 4]], STRAW, 1.3)
    for k in range(1, 8):
        x = -0.05 + 2.1 * k / 8
        p.line([(x, 0.08, 82), (x, 0.96, 64)], 0.8)
    # chopping block and axe in front of the right stack
    cyl(p, (1.55, 0.93, 0), (1.55, 0.93, 17), 0.10, mul(WOOD, 1.1), n=10, lw=1.1)
    p.line([(1.55, 0.93, 17), (1.55, 0.93, 38)], 1.6)  # axe handle in the block
    p.poly([(1.55, 0.90, 36), (1.55, 0.96, 36), (1.55, 0.96, 30), (1.55, 0.92, 28)], GREY, 1.0)
    return p


# ===================================================================================== trough and hay rack
def trough_hay():
    p = Piece('trough-hay', 2, 1)
    # hay rack at the back-left: two posts, slanted slats, hay behind
    for yy in (0.20, 0.50):
        post(p, 0.14, yy, 0.06, 0, 56)
        post(p, 0.84, yy, 0.06, 0, 56)
    p.box(0.14, 0.84, 0.24, 0.36, 20, 36, HAY, 1.2)  # hay bundle behind the slats
    for k in range(5):
        xk = 0.2 + 0.15 * k
        p.line([(xk, 0.22, 36 + (k % 2) * 2), (xk + 0.02, 0.2, 40)], 1.3, HAY)
    for k in range(6):  # slats leaning out: gaps between them
        x = 0.14 + 0.70 * k / 5
        p.line([(x, 0.52, 22), (x, 0.40, 52)], 1.8, mul(WOOD, 0.9))
    p.box(0.10, 0.88, 0.50, 0.55, 18, 22, mul(WOOD, 1.0), 1.2)
    p.box(0.10, 0.88, 0.17, 0.22, 52, 56, mul(WOOD, 1.0), 1.2)
    # stone trough
    p.box(1.00, 1.90, 0.28, 0.72, 0, 18, STONE, 1.4, tag='plinth')
    p.stone_courses(1.00, 1.90, 0.28, 0.72, 0, 18, 1, joint=0.3)
    p.poly([(1.07, 0.35, 18), (1.83, 0.35, 18), (1.83, 0.65, 18), (1.07, 0.65, 18)], mul(WATER, 0.9), 1.1)
    p.line([(1.07, 0.65, 18), (1.83, 0.65, 18)], 1.0)
    p.box(1.00, 1.90, 0.28, 0.72, 18, 20, mul(STONE, 1.08), 1.2)
    p.poly([(1.09, 0.37, 20), (1.81, 0.37, 20), (1.81, 0.63, 20), (1.09, 0.63, 20)], WATER, 1.0)
    return p


# ========================================================================================== fence
def fence(w, d):
    """Straight low fence module, 2x1 along x or 1x2 along y, centred in its tile row; posts at both ends and the middle, two rails, open gaps."""
    name = 'fence-2x1' if (w, d) == (2, 1) else 'fence-1x2'
    p = Piece(name, w, d)
    L = 2.0
    ts = [0.0, 1.0, 2.0]
    ts_post = [0.06, 1.0, 1.94]

    def pt(u, v, z):
        return (u, v, z) if w == 2 else (v, u, z)

    def B(u0, u1, v0, v1, z0, z1, col, lw=1.1):
        if w == 2:
            p.box(u0, u1, v0, v1, z0, z1, col, lw)
        else:
            p.box(v0, v1, u0, u1, z0, z1, col, lw)

    for z0, z1 in ((8, 12), (20, 24)):
        B(0.02, 1.98, 0.485, 0.515, z0, z1, mul(WOOD, 1.0), 1.0)
    for u in ts_post:
        B(u - 0.035, u + 0.035, 0.465, 0.535, 0, 30, mul(WOOD, 0.9), 1.2)
        B(u - 0.045, u + 0.045, 0.455, 0.545, 30, 32, mul(WOOD, 1.1), 1.0)
    return p


# ======================================================================================== wall
# Boundary wall: a tile row (north wall, runs along x) or tile column (west wall, runs along y).  Wall slab sits in the
# outer part of its tile so a planter row on the next tile has a thin gap in front of it.  Inside faces +y (north wall)
# and +x (west wall) face the village.  H = 66 to the wall top, 6 of coping, buttress to 76 + cap.
WALL_H, COPING = 66.0, 6.0
WB0, WB1 = 0.50, 0.96   # base thickness range (local, across the wall)
WT0, WT1 = 0.56, 0.90   # top thickness range (slight batter on both faces)


class _Orient:
    """Maps wall-local (u along the wall, v across, z) onto x/y of a north (along x) or west (along y) wall."""

    def __init__(self, p, along):
        self.p, self.along = p, along

    def P(self, u, v, z):
        return (u, v, z) if self.along == 'x' else (v, u, z)

    def poly(self, pts, fill, lw=1.3, edge=True):
        self.p.poly([self.P(*q) for q in pts], fill, lw, edge=edge)

    def line(self, pts, lw=1.0):
        self.p.line([self.P(*q) for q in pts], lw)


def _wall_run(p, o, u0, u1, col=STONE, cap_joint=0.5, face=True, end0=False, end1=False):
    """One straight wall segment from u0 to u1 (tile units along the wall)."""
    k_face = K_LEFT if o.along == 'x' else K_RIGHT
    fv = WB1 + 0.0
    ftop = WT1
    # outer-face batter quad: base at v=WB1, top at v=WT1
    o.poly([(u0, WB1, 0), (u1, WB1, 0), (u1, WT1, WALL_H), (u0, WT1, WALL_H)], mul(col, k_face), 1.5)
    # courses and staggered joints on the batter face
    rows = 4
    for r in range(1, rows):
        z = WALL_H * r / rows
        v = WB1 + (WT1 - WB1) * z / WALL_H
        o.line([(u0, v, z), (u1, v, z)], 0.9)
    for r in range(rows):
        za, zb = WALL_H * r / rows, WALL_H * (r + 1) / rows
        off = 0.0 if r % 2 == 0 else cap_joint / 2
        u = u0 + off + (cap_joint if off == 0 else 0)
        while u < u1 - 1e-6:
            va = WB1 + (WT1 - WB1) * za / WALL_H
            vb = WB1 + (WT1 - WB1) * zb / WALL_H
            o.line([(u, va, za), (u, vb, zb)], 0.9)
            u += cap_joint
    # coping slab (capstones) over the top
    cz0, cz1 = WALL_H, WALL_H + COPING
    cv0, cv1 = WT0 - 0.03, WT1 + 0.03
    o.poly([(u0, cv1, cz0), (u1, cv1, cz0), (u1, cv1, cz1), (u0, cv1, cz1)], mul(col, 1.04 * k_face), 1.4)
    o.poly([(u0, cv0, cz1), (u1, cv0, cz1), (u1, cv1, cz1), (u0, cv1, cz1)], mul(col, 1.14), 1.4)
    uj = u0 + cap_joint
    while uj < u1 - 1e-6:
        o.line([(uj, cv0, cz1), (uj, cv1, cz1), (uj, cv1, cz0)], 1.0)
        uj += cap_joint


def wall_module(along, length, buttress=False):
    w, d = (length, 1) if along == 'x' else (1, length)
    nm = f"wall-{along}-{length}{'-buttress' if buttress else ''}"
    p = Piece(nm, w, d)
    o = _Orient(p, along)
    _wall_run(p, o, 0.0, float(length))
    if buttress:
        c = length / 2.0
        a, b = c - 0.22, c + 0.22
        top = WALL_H + 10.0
        # buttress: projects 0.16 beyond the batter face, runs up past the coping, stepped cap
        o.poly([(a, WB1 + 0.16, 0), (b, WB1 + 0.16, 0), (b, WB1 + 0.10, top), (a, WB1 + 0.10, top)], mul(STONE, K_LEFT if along == 'x' else K_RIGHT), 1.5)
        side = [(b, WB1, 0), (b, WB1 + 0.16, 0), (b, WB1 + 0.10, top), (b, WT1 + 0.03, top)]
        o.poly(side, mul(STONE, K_RIGHT if along == 'x' else K_LEFT), 1.4)
        for r in (1, 2, 3):
            z = top * r / 4
            o.line([(a, WB1 + 0.16 - 0.06 * z / top, z), (b, WB1 + 0.16 - 0.06 * z / top, z)], 0.9)
        o.poly([(a - 0.03, WB1 + 0.12, top), (b + 0.03, WB1 + 0.12, top), (b + 0.03, WB1 + 0.12, top + 5), (a - 0.03, WB1 + 0.12, top + 5)],
               mul(STONE, 1.05), 1.4)
        o.poly([(a - 0.03, WT1 - 0.05, top + 5), (b + 0.03, WT1 - 0.05, top + 5), (b + 0.03, WB1 + 0.12, top + 5), (a - 0.03, WB1 + 0.12, top + 5)],
               mul(STONE, 1.14), 1.4)
        p.notes.append('buttress centred on the module, 0.44 tile wide, 0.16 proud, top z %d + cap' % (top + 5))
    return p


def _pier(p, o, ua, ub, top, cap_h=6.0, col=STONE, finial=False):
    """Square pier (ua..ub along the wall, full wall thickness plus a little) with a capstone that overhangs."""
    va, vb = WB0 - 0.04, WB1 + 0.07
    p.box(*( (ua, ub, va, vb) if o.along == 'x' else (va, vb, ua, ub) ), 0, top, col, 1.5, tag=None)
    # courses on the visible faces
    rows = 5
    for r in range(1, rows):
        z = top * r / rows
        if o.along == 'x':
            p.line([(ua, vb, z), (ub, vb, z)], 0.9)
            p.line([(ub, va, z), (ub, vb, z)], 0.9)
        else:
            p.line([(vb, ua, z), (vb, ub, z)], 0.9)
            p.line([(va, ub, z), (vb, ub, z)], 0.9)
    ov = 0.045
    if o.along == 'x':
        p.box(ua - ov, ub + ov, va - ov, vb + ov, top, top + cap_h, mul(col, 1.06), 1.5)
    else:
        p.box(va - ov, vb + ov, ua - ov, ub + ov, top, top + cap_h, mul(col, 1.06), 1.5)
    if finial:
        cu, cv = (ua + ub) / 2, (va + vb) / 2
        cx, cy = (cu, cv) if o.along == 'x' else (cv, cu)
        prism(p, cx, cy, 0.075, 0.075, top + cap_h, top + cap_h + 8, mul(col, 1.0), 10)
        prism(p, cx, cy, 0.05, 0.05, top + cap_h + 8, top + cap_h + 13, mul(col, 1.1), 10)


def wall_corner_inside():
    """North wall (along x) and west wall (along y) meet: tile (0,0).  One stout corner pier fills the whole wall-thickness square
    (0.44..1.02), so the north run starts at x=1 and the west run at y=1 in the neighbouring tiles."""
    p = Piece('wall-corner-inside', 1, 1)
    va, vb = WB0 - 0.06, 1.02
    top = WALL_H + 12
    p.box(va, vb, va, vb, 0, top, STONE, 1.6)
    for r in range(1, 6):
        z = top * r / 6
        p.line([(va, vb, z), (vb, vb, z)], 0.9)
        p.line([(vb, va, z), (vb, vb, z)], 0.9)
    for u in (0.72,):
        p.line([(u, vb, 0), (u, vb, top)], 0.0)
    ov = 0.05
    p.box(va - ov, vb + ov, va - ov, vb + ov, top, top + 7, mul(STONE, 1.06), 1.5)
    p.box(va + 0.06, vb - 0.06, va + 0.06, vb - 0.06, top + 7, top + 12, mul(STONE, 1.12), 1.4)
    p.notes.append('inside corner: one pier 0.58 x 0.58 tile, wall top z 66+6, pier top z 85; north run continues from x=1, west run from y=1')
    return p


def wall_end_pier(along, kind='end'):
    """Terminal pier.  along 'x' (north wall's east end: wall arrives from -x), or 'y' with kind 'end' (wall arrives from -y,
    south end) / 'gate-n' (wall arrives from -y, opening beyond: taller, finial) / 'gate-s' (wall leaves toward +y)."""
    nm = {('x', 'end'): 'wall-end-pier-x', ('y', 'end'): 'wall-end-pier-y', ('y', 'gate-n'): 'gate-pier-n',
          ('y', 'gate-s'): 'gate-pier-s', ('x', 'gate-w'): 'gate-pier-x'}[(along, kind)]
    p = Piece(nm, 1, 1)
    o = _Orient(p, along)
    gate = kind.startswith('gate')
    if kind in ('end', 'gate-n', 'gate-w'):
        _wall_run(p, o, 0.0, 0.62)       # wall arrives from the -u side
        ua, ub = 0.50, 0.96
    else:
        _wall_run(p, o, 0.38, 1.0)       # wall leaves toward +u
        ua, ub = 0.04, 0.50
    top = WALL_H + (16 if gate else 10)
    _pier(p, o, ua, ub, top, 6.0, STONE, finial=gate)
    return p


def terrace_planter(w, d):
    p = v3_planter(w, d)
    p.name = 'terrace-planter-2x1' if (w, d) == (2, 1) else 'terrace-planter-1x2'
    return p


def planter_corner():
    """L-shaped terrace planter, 2x2 footprint: arm along x on the back row, arm along y on the left column (inside corner of the wall run)."""
    p = Piece('terrace-planter-corner', 2, 2)
    H, CAP, t = 26.0, 6.0, 0.2
    soil = H - 8
    GREEN = (60, 110, 60)

    def slab(x0, x1, y0, y1):
        p.box(x0, x1, y0, y1, 0, H - CAP, STONE, 1.5, tag='plinth')
        p.stone_courses(x0, x1, y0, y1, 0, H - CAP, 2, joint=0.5)
        p.box(x0 - 0.015, x1 + 0.015, y0 - 0.015, y1 + 0.015, H - CAP, H, mul(STONE, 1.06), 1.5)

    # L: back arm x 0.03..1.97, y 0.03..0.5; left arm x 0.03..0.5, y 0.5..1.97.  Draw back-to-front.
    slab(0.03, 1.97, 0.03, 0.23)                       # back rim of the x-arm
    slab(0.03, 0.23, 0.23, 1.97 - 0.0)                 # outer rim of the y-arm
    p.poly([(0.23, 0.23, soil), (1.97 - 0.2, 0.23, soil), (1.97 - 0.2, 0.50 - 0.0, soil), (0.50, 0.50, soil), (0.50, 1.97 - 0.2, soil), (0.23, 1.97 - 0.2, soil)], SOIL, 1.2)
    slab(1.77, 1.97, 0.23, 0.50)                       # end of the x-arm
    slab(0.23, 1.77, 0.50, 0.70)                       # inner (front) rim of the x-arm, runs to the corner
    slab(0.50, 0.70, 0.70, 1.77)                       # inner (right) rim of the y-arm
    slab(0.03, 0.70, 1.77, 1.97)                       # end of the y-arm
    for a in (0.5, 1.0, 1.5):
        p.line([(a, 0.50, H), (a, 0.70, H)], 1.0)
        p.line([(0.50, a + 0.2, H), (0.70, a + 0.2, H)], 1.0)
    return p


# ============================================================================ the placed set
PLACED_DRESSING = ['village-well', 'banner-pole', 'lantern-post', 'shop-stack', 'baskets', 'laundry-line', 'notice-board', 'handcart',
                   'bench-2x1', 'garden-plot-3x2', 'stone-lantern', 'trough-hay', 'fence-2x1']
WALL_MODULES = ['wall-x-2', 'wall-x-2-buttress', 'wall-y-2', 'wall-y-2-buttress', 'wall-y-1', 'wall-corner-inside', 'wall-end-pier-x',
                'wall-end-pier-y', 'gate-pier-n', 'gate-pier-s']


def all_dressing():
    """The dressing, wall-module and terrace-planter guides the scene uses, in packing order.  `firewood-shelter`, the 1x2
    bench and fence, `wall-x-1` and the 1x2 and corner terrace planters are built (`firewood_shelter`, `bench`, ...) but not placed."""
    out = [well(), banner_pole(), lantern_post(), shop_stack(), baskets(), laundry_line(), notice_board(), handcart(), bench(2, 1),
           garden_plot(), stone_lantern(), trough_hay(), fence(2, 1)]
    out += [wall_module('x', 2), wall_module('x', 2, True), wall_module('y', 2), wall_module('y', 2, True), wall_module('y', 1),
            wall_corner_inside(), wall_end_pier('x', 'end'), wall_end_pier('y', 'end'), wall_end_pier('y', 'gate-n'),
            wall_end_pier('y', 'gate-s'), terrace_planter(2, 1)]
    return out
