"""Round 3 geometry of every Ba Dan upright piece.  Footprint origin is tile (0,0); x runs down-right on
screen, y down-left.  Horizontal units are tiles, z is world px; guidelib.SC (1.5) turns world px into guide px."""
import math
from guidelib import Piece, mul, proj, area2, K_TOP, K_LEFT, K_RIGHT, K_ROOF_NEAR, K_ROOF_FAR, K_BAND

PLASTER = (240, 220, 175)
TIMBER = (150, 80, 40)
STONE = (184, 156, 120)
TERRACOTTA = (178, 86, 48)
GREEN_TILE = (72, 100, 86)
DARK = (52, 36, 28)
AWNING = (222, 196, 160)
WOOD = (170, 118, 70)
SOIL = (84, 62, 40)
SHUTTER = (96, 120, 100)
CLAY = (196, 128, 84)
STRAW = (214, 184, 110)
LANTERN = (222, 160, 64)
CLOTH = [(168, 60, 56), (60, 96, 150), (214, 170, 70), (96, 130, 84)]

# shared proportions (world px; horizontal values in tiles)
PLINTH_H = 26.0
WALL_TOP = 140.0       # eave line at wall top, from the ground (plinth 26 + 114 of wall)
RIDGE_RISE = 46.0      # eave line -> ridge, low pitch
WALL_D = 1.7           # body depth in x (a deeper body makes the roof plane taller on screen: 64 px per tile of run)
TERRACE_H = 8.0        # low stone terrace over the footprint west of the house plinth
OVERHANG_E = 0.15      # +x (door side) overhang
OVERHANG_Y = 0.20      # gable-side overhang (north / south)
OVERHANG_W = 0.15
KICK = 8.0             # upturn of each roof corner
KICK_LEN = 0.6         # tiles over which the corner kick fades
LEDGE_W = 0.25         # plinth ledge west of the west wall
LEDGE_Y = 0.25         # plinth ledge north and south of the gable walls
PORCH = 0.45           # +x plinth ledge: landing 0.09 + three steps of 0.12
DOOR_H = 62.0
LINTEL = 8.0
RAFTER = 5.0           # fascia thickness


class PlaneE:
    """East (+x) wall plane at x = xe; u runs along y."""

    def __init__(self, p, xe):
        self.p, self.xe = p, xe

    def pt(self, u, v):
        return (self.xe, u, v)

    def quad(self, u0, u1, v0, v1, col, lw=1.0, tag=None):
        self.p.poly([self.pt(u0, v0), self.pt(u1, v0), self.pt(u1, v1), self.pt(u0, v1)], col, lw, tag=tag)

    def line(self, u0, v0, u1, v1, lw=1.0):
        self.p.line([self.pt(u0, v0), self.pt(u1, v1)], lw)


class PlaneS:
    """South (+y) wall plane at y = ys; u runs along x."""

    def __init__(self, p, ys):
        self.p, self.ys = p, ys

    def pt(self, u, v):
        return (u, self.ys, v)

    def quad(self, u0, u1, v0, v1, col, lw=1.0, tag=None):
        self.p.poly([self.pt(u0, v0), self.pt(u1, v0), self.pt(u1, v1), self.pt(u0, v1)], col, lw, tag=tag)

    def line(self, u0, v0, u1, v1, lw=1.0):
        self.p.line([self.pt(u0, v0), self.pt(u1, v1)], lw)


# ---------------------------------------------------------------- small solids
def prism(p, cx, cy, r0, r1, z0, z1, col, n=14, hoops=(), lw=1.2, topcol=None):
    """Round (n-gon) frustum on the ground plane: radius r0 at z0, r1 at z1.  Only the faces turned to the viewer are drawn."""
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        m = (a0 + a1) / 2
        if math.cos(m) + math.sin(m) <= 1e-9:
            continue
        k = max(0.6, min(1.05, 0.88 + 0.12 * math.sin(m) - 0.13 * math.cos(m)))
        p.poly([(cx + r0 * math.cos(a0), cy + r0 * math.sin(a0), z0), (cx + r0 * math.cos(a1), cy + r0 * math.sin(a1), z0),
                (cx + r1 * math.cos(a1), cy + r1 * math.sin(a1), z1), (cx + r1 * math.cos(a0), cy + r1 * math.sin(a0), z1)],
               mul(col, k), 0, edge=False)
    ang = lambda t: -math.pi / 4 + t * math.pi
    rr = lambda f: r0 + (r1 - r0) * f
    for t in (0.0, 1.0):  # the two silhouette verticals
        a = ang(t)
        p.line([(cx + r0 * math.cos(a), cy + r0 * math.sin(a), z0), (cx + r1 * math.cos(a), cy + r1 * math.sin(a), z1)], lw)
    p.line([(cx + r0 * math.cos(ang(t / 12)), cy + r0 * math.sin(ang(t / 12)), z0) for t in range(13)], lw)
    for f in hoops:
        r, z = rr(f), z0 + (z1 - z0) * f
        p.line([(cx + r * math.cos(ang(t / 12)), cy + r * math.sin(ang(t / 12)), z) for t in range(13)], 1.0)
    p.poly([(cx + r1 * math.cos(2 * math.pi * i / n), cy + r1 * math.sin(2 * math.pi * i / n), z1) for i in range(n)],
           topcol or mul(col, 1.12), lw)


def ring(cx, cy, rx, ry, z, n=18):
    return [(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n), z) for i in range(n)]


def disc_e(p, x, y, z, rz, col, lw=1.0):
    """Round end seen on a +x facing plane (log ends, rafter ends)."""
    ry = rz / 64.0
    p.poly([(x, y + ry * math.cos(2 * math.pi * i / 10), z + rz * math.sin(2 * math.pi * i / 10)) for i in range(10)], col, lw)


def window(pl, u0, u1, v0, v1, frame=None, shutters=True):
    """Flat window: timber frame, dark opening, lattice, sill, and a pair of open shutters flat on the wall."""
    frame = frame or TIMBER
    f = 0.04
    sw = 0.085
    if shutters:
        for a, b in ((u0 - f - sw, u0 - f), (u1 + f, u1 + f + sw)):
            pl.quad(a, b, v0 - 4, v1 + 4, _shade(frame, SHUTTER), 1.1)
            for k in range(1, 7):
                v = v0 - 4 + (v1 - v0 + 8) * k / 7
                pl.line(a + 0.012, v, b - 0.012, v, 0.7)
    pl.quad(u0 - f, u1 + f, v0 - 4, v1 + 4, frame, 1.2)
    pl.quad(u0, u1, v0, v1, DARK, 1.0)
    nv = max(2, int(round((u1 - u0) / 0.07)))
    for k in range(1, nv):
        u = u0 + (u1 - u0) * k / nv
        pl.line(u, v0, u, v1, 0.9)
    for k in (1, 2):
        v = v0 + (v1 - v0) * k / 3
        pl.line(u0, v, u1, v, 0.8)
    pl.quad(u0 - f - 0.02, u1 + f + 0.02, v0 - 8, v0 - 4, mul(STONE, 0.9), 1.0)  # sill stone


def _shade(frame, col):
    # shutters take the shade of the wall they sit on (frame is already shaded by the caller)
    k = frame[0] / TIMBER[0]
    return mul(col, k)


def ledge_jar(p, cx, cy, z, s=1.0):
    prism(p, cx, cy, 0.062 * s, 0.098 * s, z, z + 15 * s, CLAY, 10, hoops=(0.5,))
    prism(p, cx, cy, 0.062 * s, 0.045 * s, z + 15 * s, z + 21 * s, CLAY, 10, topcol=mul(DARK, 1.4))
    prism(p, cx, cy, 0.056 * s, 0.056 * s, z + 21 * s, z + 24 * s, mul(CLAY, 0.85), 10)


def crate(p, x0, y0, sx, sy, z, h=17):
    p.box(x0, x0 + sx, y0, y0 + sy, z, z + h, WOOD, 1.3)
    for f in (0.33, 0.66):
        p.line([(x0, y0 + sy, z + h * f), (x0 + sx, y0 + sy, z + h * f)], 1.0)
        p.line([(x0 + sx, y0, z + h * f), (x0 + sx, y0 + sy, z + h * f)], 1.0)
    p.line([(x0 + sx, y0 + sy, z), (x0 + sx, y0 + sy, z + h)], 1.2)
    p.line([(x0 + sx, y0, z + h * 0.1), (x0 + sx, y0 + sy, z + h * 0.9)], 1.0)  # cross brace on the east face


def firewood(p, x0, y0, sx, sy, z, rows=3, cols=5):
    h = rows * 7.2
    p.box(x0, x0 + sx, y0, y0 + sy, z, z + h, mul(WOOD, 0.9), 1.3)
    xe = x0 + sx
    for r in range(rows):
        for c in range(cols):
            off = 0.5 * (r % 2)
            disc_e(p, xe, y0 + (c + 0.5 + off * 0.5) * sy / (cols + 0.5), z + 3.6 + 7.2 * r, 3.3, mul(WOOD, 1.25), 0.9)


def broom(p, xb, yb, z):
    p.poly([(xb, yb - 0.05, z), (xb, yb + 0.05, z), (xb - 0.02, yb + 0.032, z + 14), (xb - 0.02, yb - 0.032, z + 14)], STRAW, 1.2)
    p.line([(xb - 0.02, yb, z + 14), (xb - 0.075, yb, z + 52)], 1.8)
    p.line([(xb - 0.02, yb - 0.03, z + 8), (xb - 0.02, yb + 0.03, z + 8)], 1.0)


def barrel(p, cx, cy, z):
    prism(p, cx, cy, 0.092, 0.092, z, z + 28, mul(WOOD, 1.0), 12, hoops=(0.2, 0.8), topcol=(70, 100, 110))
    p.line([(cx + 0.075 * math.cos(2 * math.pi * i / 12), cy + 0.075 * math.sin(2 * math.pi * i / 12), z + 28) for i in range(13)], 1.0)


def bench(p, x0, x1, y0, y1, z):
    for xx in (x0 + 0.05, x1 - 0.1):
        p.box(xx, xx + 0.05, y0, y1, z, z + 10, mul(WOOD, 0.85), 1.2)
    p.box(x0, x1, y0 - 0.01, y1 + 0.01, z + 10, z + 15, WOOD, 1.3)


def lantern(p, wx, y, vtop):
    """Bracket arm from the wall plane x = wx and a small hanging lantern."""
    p.line([(wx, y, vtop), (wx + 0.13, y, vtop), (wx + 0.13, y, vtop - 5)], 1.6)
    p.box(wx + 0.095, wx + 0.165, y - 0.035, y + 0.035, vtop - 28, vtop - 8, LANTERN, 1.2)
    p.box(wx + 0.085, wx + 0.175, y - 0.045, y + 0.045, vtop - 8, vtop - 4, mul(TIMBER, 1.1), 1.2)
    p.box(wx + 0.085, wx + 0.175, y - 0.045, y + 0.045, vtop - 32, vtop - 28, mul(TIMBER, 1.1), 1.2)


def name_board(p, wx, uc, vtop, w=0.3, h=22.0, hang=True):
    """A plank board hanging from a short bracket arm, plane facing +x."""
    xb = wx + 0.14
    p.line([(wx, uc, vtop + 6), (xb, uc, vtop + 6)], 1.6)
    u0, u1 = uc - w / 2, uc + w / 2
    p.line([(xb, uc, vtop + 6), (xb, u0 + 0.03, vtop)], 1.0)
    p.line([(xb, uc, vtop + 6), (xb, u1 - 0.03, vtop)], 1.0)
    p.poly([(xb, u0, vtop - h), (xb, u1, vtop - h), (xb, u1, vtop), (xb, u0, vtop)], mul(WOOD, K_RIGHT * 1.15), 1.4)
    p.poly([(xb, u0 + 0.025, vtop - h + 3.5), (xb, u1 - 0.025, vtop - h + 3.5), (xb, u1 - 0.025, vtop - 3.5), (xb, u0 + 0.025, vtop - 3.5)],
           mul(PLASTER, K_RIGHT), 1.0)  # blank panel for the painter's lettering


def house(kind, w, d, household):
    """kind 'dwelling' or 'merchant'.  household: 'jars' | 'wood' (dwellings), 'barrel' | 'crates' (merchants).
    Footprint w x d tiles, ridge along y, long eave wall (door, windows, shop bay) faces +x, timber gable faces +y."""
    name = f"{'merchant-house' if kind == 'merchant' else kind}-{w}x{d}"
    p = Piece(name, w, d)
    p.household = household
    roofcol = TERRACOTTA if kind == 'dwelling' else GREEN_TILE
    x0, y0, x1, y1 = 0.0, 0.0, float(w), float(d)
    wx1 = x1 - PORCH
    wx0 = wx1 - WALL_D
    px0 = wx0 - LEDGE_W                                # west edge of the 26 px plinth
    wy0, wy1 = y0 + LEDGE_Y, y1 - LEDGE_Y
    rx0, rx1 = wx0 - OVERHANG_W, wx1 + OVERHANG_E
    ry0, ry1 = wy0 - OVERHANG_Y, wy1 + OVERHANG_Y
    xm = (wx0 + wx1) / 2.0
    zW = WALL_TOP
    zR = zW + RIDGE_RISE
    pitch = RIDGE_RISE / (xm - wx0)                   # world px per tile of run
    zT = zW - pitch * OVERHANG_E                       # tip on the +x side
    zTw = zW - pitch * OVERHANG_W
    pw = 0.11
    tim_s, tim_e = mul(TIMBER, K_LEFT), mul(TIMBER, K_RIGHT)

    def kick(y):
        e = min(y - ry0, ry1 - y)
        return KICK * max(0.0, 1.0 - e / KICK_LEN) ** 2

    def zE(y):
        return zT + kick(y)

    def zroof(x):
        return zW + (zR - zW) * (1.0 - abs(x - xm) / (xm - wx0))

    ds0, ds1 = y1 - 1.25, y1 - 0.45
    fr = 0.06
    # ---------------- plinth with a full-bay veranda stair cut into the east ledge ----------------
    st_y0, st_y1 = ds0 - fr - 0.04, ds1 + fr + 0.04       # the stair spans the door bay, frame to frame, plus a margin
    land = wx1 + 0.09
    p.box(x0, px0, y0, y1, 0, TERRACE_H, mul(STONE, 1.04), tag='plinth')      # low terrace, the rest of the footprint
    p.stone_courses(x0, px0, y0, y1, 0, TERRACE_H, 1)
    p.box(px0, x1, y0, st_y0, 0, PLINTH_H, STONE, tag='plinth')
    p.stone_courses(px0, x1, y0, st_y0, 0, PLINTH_H, 2)
    p.box(px0, land, st_y0, st_y1, 0, PLINTH_H, STONE, tag='plinth')
    p.stone_courses(px0, land, st_y0, st_y1, 0, PLINTH_H, 2)
    for k in range(3):
        p.box(land + 0.12 * k, land + 0.12 * (k + 1) if k < 2 else x1, st_y0, st_y1, 0, PLINTH_H - 6.5 * (k + 1), STONE, tag='plinth')
    p.box(px0, x1, st_y1, y1, 0, PLINTH_H, STONE, tag='plinth')
    p.stone_courses(px0, x1, st_y1, y1, 0, PLINTH_H, 2)
    # threshold stone at the foot of the door, proud of the landing
    p.box(wx1 - 0.0, wx1 + 0.085, ds0 - fr, ds1 + fr, PLINTH_H, PLINTH_H + 3, mul(STONE, 1.1), 1.3)

    # ---------------- gable wall (+y face, plane y = wy1) -----------------------------
    S = PlaneS(p, wy1)
    gable = [(wx0, wy1, PLINTH_H), (wx1, wy1, PLINTH_H), (wx1, wy1, zW), (xm, wy1, zR), (wx0, wy1, zW)]
    p.poly(gable, mul(PLASTER, K_LEFT), 1.5, tag='wall')
    p.poly([(wx0, wy1, zW), (xm, wy1, zR), (wx1, wy1, zW), (wx1, wy1, zW - 9), (xm, wy1, zR - 9), (wx0, wy1, zW - 9)],
           mul(PLASTER, K_LEFT * K_BAND), 0.8)
    S.quad(wx0, wx0 + pw, PLINTH_H, zW, tim_s, 1.2)
    S.quad(wx1 - pw, wx1, PLINTH_H, zW, tim_s, 1.2)
    S.quad(wx0, wx1, PLINTH_H, PLINTH_H + 6, tim_s, 1.2)
    S.quad(wx0, wx1, zW - 8, zW, tim_s, 1.2)
    p.poly([(xm - pw / 2, wy1, PLINTH_H + 6), (xm + pw / 2, wy1, PLINTH_H + 6), (xm + pw / 2, wy1, zR - 5), (xm - pw / 2, wy1, zR - 5)], tim_s, 1.2)
    for sgn in (-1, 1):
        ua, ub = xm + sgn * 0.85, xm + sgn * 0.08
        p.poly([(ua - 0.03, wy1, zW), (ua + 0.03, wy1, zW), (ub + 0.03, wy1, zW + 24), (ub - 0.03, wy1, zW + 24)], tim_s, 1.0)
    gw0 = xm - 0.31
    window(S, gw0, gw0 + 0.62, PLINTH_H + 34, PLINTH_H + 70, tim_s)
    # ---- ledge dressing on the south (+y) ledge, in front of the gable ----
    south_items = []

    # ---------------- east eave wall (+x face, plane x = wx1) -------------------------------
    E = PlaneE(p, wx1)
    p.poly([(wx1, wy0, PLINTH_H), (wx1, wy1, PLINTH_H), (wx1, wy1, zW), (wx1, wy0, zW)], mul(PLASTER, K_RIGHT), 1.5, tag='wall')
    E.quad(wy0, wy1, zW - 9, zW, mul(PLASTER, K_RIGHT * K_BAND), 0.8)
    E.quad(wy1 - pw, wy1, PLINTH_H, zW, tim_e, 1.2)
    E.quad(wy0, wy0 + pw, PLINTH_H, zW, tim_e, 1.2)
    E.quad(wy0, wy1, PLINTH_H, PLINTH_H + 6, tim_e, 1.2)
    E.quad(wy0, wy1, zW - 6, zW, tim_e, 1.2)
    dz1 = PLINTH_H + DOOR_H
    E.quad(ds0 - fr, ds1 + fr, PLINTH_H, dz1 + LINTEL, tim_e, 1.2)
    E.quad(ds0, ds1, PLINTH_H, dz1, DARK, 1.0)
    dm = (ds0 + ds1) / 2
    for a, b in ((ds0 + 0.03, dm - 0.015), (dm + 0.015, ds1 - 0.03)):
        E.quad(a, b, PLINTH_H + 2, dz1 - 2, mul(WOOD, K_RIGHT), 0.9)
        for f in (1 / 3.0, 2 / 3.0):
            E.line(a + (b - a) * f, PLINTH_H + 2, a + (b - a) * f, dz1 - 2, 0.8)
        E.line(a, PLINTH_H + DOOR_H * 0.5, b, PLINTH_H + DOOR_H * 0.5, 0.8)
    E.quad(ds0 - fr - 0.02, ds1 + fr + 0.02, dz1 + LINTEL, dz1 + LINTEL + 3, tim_e, 1.0)   # lintel cap
    free0, free1 = wy0 + pw, ds0 - fr
    north_x = wx1 + 0.06     # east-ledge items stand from here to x1 - 0.04
    if kind == 'dwelling':
        n = 2
        usable = free1 - free0 - 0.12
        wwid = 0.36 if (free1 - free0) < 1.6 else 0.52
        gap = (usable - n * (wwid + 0.26)) / (n - 1) if n > 1 else 0
        for k in range(n):
            u0 = free0 + 0.06 + 0.13 + k * (wwid + 0.26 + max(gap, 0.0))
            window(E, u0, u0 + wwid, PLINTH_H + 30, PLINTH_H + 66, tim_e)
    else:
        bw = 1.0 if (free1 - free0) < 1.6 else 1.5
        a1 = free1 - 0.1
        a0 = a1 - bw
        E.quad(a0 - 0.05, a1 + 0.05, PLINTH_H, PLINTH_H + 70, tim_e, 1.2)
        E.quad(a0, a1, PLINTH_H, PLINTH_H + 66, DARK, 1.0)
        for sv in (30, 50):       # two shelves across the bay with a few jars standing on them
            E.quad(a0 + 0.03, a1 - 0.03, PLINTH_H + sv, PLINTH_H + sv + 4, mul(WOOD, K_RIGHT), 0.9)
            nj = int((a1 - a0) // 0.22)
            for j in range(nj):
                uc = a0 + 0.14 + j * ((a1 - a0 - 0.28) / max(nj - 1, 1))
                E.quad(uc - 0.04, uc + 0.04, PLINTH_H + sv + 4, PLINTH_H + sv + 13 - (j % 2) * 3, mul(CLAY, K_RIGHT), 0.9)
        E.quad(a0 - 0.05, a0, PLINTH_H, PLINTH_H + 76, tim_e, 1.0)     # bay jambs
        E.quad(a1, a1 + 0.05, PLINTH_H, PLINTH_H + 76, tim_e, 1.0)
        # counter
        p.box(wx1 + 0.02, wx1 + 0.27, a0 + 0.04, a1 - 0.04, PLINTH_H, PLINTH_H + 26, WOOD, 1.3)
        p.line([(wx1 + 0.27, a0 + 0.04, PLINTH_H + 17), (wx1 + 0.27, a1 - 0.04, PLINTH_H + 17)], 1.0)
        p.line([(wx1 + 0.27, a0 + 0.04, PLINTH_H + 8), (wx1 + 0.27, a1 - 0.04, PLINTH_H + 8)], 1.0)
        # awning on two posts, clearly sloped: 34 px drop over 0.40 tile
        ax = wx1 + 0.40
        top_z, lip_z = WALL_TOP - 20, WALL_TOP - 20 - 34
        p.poly([(wx1, a0 - 0.1, top_z), (wx1, a1 + 0.1, top_z), (ax, a1 + 0.1, lip_z), (ax, a0 - 0.1, lip_z)], mul(AWNING, K_ROOF_NEAR), 1.5)
        nb = 6
        for k in range(1, nb):
            yy = (a0 - 0.1) + (a1 - a0 + 0.2) * k / nb
            p.line([(wx1, yy, top_z), (ax, yy, lip_z)], 1.0)
        p.poly([(ax, a1 + 0.1, lip_z - 8), (ax, a0 - 0.1, lip_z - 8), (ax, a0 - 0.1, lip_z), (ax, a1 + 0.1, lip_z)], mul(AWNING, K_RIGHT), 1.3)
        p.poly([(wx1, a1 + 0.1, top_z), (ax, a1 + 0.1, lip_z), (ax, a1 + 0.1, lip_z - 8), (wx1, a1 + 0.1, top_z - 8)], mul(AWNING, K_LEFT * 0.9), 1.2)
        for yy in (a0 - 0.07, a1 + 0.05):   # posts stand on the ledge and reach the valance
            p.box(ax - 0.035, ax + 0.025, yy, yy + 0.06, PLINTH_H, lip_z - 8, TIMBER, 1.2)
        p.bay = (a0, a1)
        north_gap = (free0, a0 - 0.05)
    # lantern bracket beside the door (south of it), board plaque on the north side
    # ---------------- household set dressing (simple shapes on the plinth ledges) -------------------
    zL = PLINTH_H
    xl0, xl1 = wx1 + 0.07, x1 - 0.05
    xc = (xl0 + xl1) / 2
    ySB = wy1 + 0.125                                   # centre line of the south ledge
    spots = []
    if household == 'jars':
        ledge_jar(p, xc - 0.05, free0 + 0.16, zL, 1.15)
        ledge_jar(p, xc + 0.02, free0 + 0.50, zL, 0.85)
        ledge_jar(p, xc - 0.04, free0 + 0.78, zL, 1.0)
        spots = ['east ledge, north end: three jars of different sizes', 'south ledge: lidded jar', 'door side: lantern on a bracket']
        ledge_jar(p, xm - 0.55, ySB, zL, 0.8)
        lantern(p, wx1, ds1 + fr + 0.06, dz1 + LINTEL)
    elif household == 'wood':
        firewood(p, xl0, free0 + 0.05, 0.28, 0.62, zL, rows=3, cols=5)
        broom(p, xl0 + 0.1, free0 + 0.82, zL)
        name_x = (free0 + 0.82 + free1) / 2 + 0.05
        spots = ['east ledge, north end: firewood stack (3 rows)', 'east ledge: broom leaning on the wall', 'name board beside the door']
        nb_u = free1 - 0.2
        E.quad(nb_u - 0.17, nb_u + 0.17, PLINTH_H + 62, PLINTH_H + 84, mul(WOOD, K_RIGHT * 1.15), 1.4)
        E.quad(nb_u - 0.14, nb_u + 0.14, PLINTH_H + 66, PLINTH_H + 80, mul(PLASTER, K_RIGHT), 1.0)
    elif household == 'barrel':
        barrel(p, xc, y1 - 0.14, zL)
        bench(p, wx0 + 0.25, wx0 + 1.25, wy1 + 0.045, wy1 + 0.2, zL)
        spots = ['SE corner: rain barrel', 'south ledge: bench', 'door side: lantern on a bracket']
        lantern(p, wx1, ds1 + fr + 0.06, dz1 + LINTEL)
        # a window above the bench on the gable is already drawn
    elif household == 'crates':
        a0_, a1_ = p.bay
        crate(p, xl0, free0 + 0.0 if (a0_ - free0) > 0.5 else free0, 0.26, 0.26, zL, 17)
        crate(p, xl0 + 0.02, free0 + 0.28, 0.24, 0.26, zL, 15) if (a0_ - free0) > 0.6 else None
        crate(p, xl0 + 0.05, free0 + 0.02, 0.22, 0.22, zL + 17, 15)
        crate(p, wx0 + 0.3, wy1 + 0.03, 0.30, 0.18, zL, 16)
        crate(p, wx0 + 0.75, wy1 + 0.03, 0.30, 0.18, zL, 16)
        spots = ['east ledge, north end: stacked crates', 'south ledge: two crates', 'name board hanging beside the shop bay']
        name_board(p, wx1, (free0 + a0_ - 0.05) / 2 + 0.02, dz1 + LINTEL, 0.5 * (a0_ - free0) if (a0_ - free0) > 0.45 else 0.3, 22)
    p.spots = spots
    if kind == 'merchant' and household == 'barrel':
        p.spots[2] = 'door side: lantern on a bracket'

    # ---------------- roof: ridge along y; the east slope faces the viewer ----------------
    west = [(rx0, ry1, zTw), (rx0, ry0, zTw), (xm, ry0, zR), (xm, ry1, zR)]
    west_visible = area2([proj(q) for q in west]) > 0
    p.notes.append(f'west roof slope visible on screen: {west_visible} (thin sliver)')
    if west_visible:
        p.poly(west, mul(roofcol, K_ROOF_FAR), 1.5, tag='roofw')
    rcol = mul(roofcol, K_ROOF_NEAR)
    p.poly([(wx1, ry1, zW), (wx1, ry0, zW), (xm, ry0, zR), (xm, ry1, zR)], rcol, 1.5, tag='roof')
    nseg = int(round((ry1 - ry0) / 0.1))
    ys = [ry0 + (ry1 - ry0) * i / nseg for i in range(nseg + 1)]
    for a, b in zip(ys[:-1], ys[1:]):   # overhang strip with kicked corners
        p.poly([(wx1, a, zW), (rx1, a, zE(a)), (rx1, b, zE(b)), (wx1, b, zW)], rcol, 0, edge=False, tag='roof')
    p.line([(wx1, ry1, zW), (rx1, ry1, zE(ry1))], 1.2)
    p.line([(wx1, ry0, zW), (rx1, ry0, zE(ry0))], 1.2)
    p.line([(rx1, y, zE(y)) for y in ys], 1.5)                     # eave line with its upturned ends
    p.line([(wx1, ry0, zW), (wx1, ry1, zW)], 1.0)
    p.line([(xm, ry0, zR), (xm, ry1, zR)], 1.0)
    n_rib = int(round((ry1 - ry0) / 0.2))
    for j in range(1, n_rib):
        y = ry0 + j * (ry1 - ry0) / n_rib
        p.line([(xm, y, zR), (wx1, y, zW), (rx1, y, zE(y))], 1.0)
    for f in (0.2, 0.4, 0.6, 0.8):
        x = xm + (wx1 - xm) * f
        p.line([(x, ry0, zroof(x)), (x, ry1, zroof(x))], 1.0)
    # fascia following the kicked eave, then round rafter ends under it
    fcol = mul(mul(roofcol, K_BAND), K_RIGHT / K_LEFT * 1.1)
    for a, b in zip(ys[:-1], ys[1:]):
        p.poly([(rx1, a, zE(a) - RAFTER), (rx1, b, zE(b) - RAFTER), (rx1, b, zE(b)), (rx1, a, zE(a))], fcol, 0, edge=False, tag='roof')
    p.line([(rx1, y, zE(y) - RAFTER) for y in ys], 1.3)
    p.line([(rx1, ry1, zE(ry1) - RAFTER), (rx1, ry1, zE(ry1))], 1.2)
    p.line([(rx1, ry0, zE(ry0) - RAFTER), (rx1, ry0, zE(ry0))], 1.2)
    n_raf = int((ry1 - ry0 - 0.2) / 0.125)
    for j in range(n_raf + 1):
        y = ry0 + 0.1 + j * 0.125
        disc_e(p, rx1, y, zE(y) - RAFTER - 3.4, 2.6, mul(WOOD, 1.2), 1.0)
    # verge (barge) boards on the gable edge, following the roof line with the corner kick on the +x end
    path = [(rx0, zTw), (wx0, zW), (xm, zR), (wx1, zW), (rx1, zE(ry1))]
    vb = RAFTER + 2
    p.poly([(x, ry1, z) for x, z in path] + [(x, ry1, z - vb) for x, z in reversed(path)], mul(TIMBER, K_LEFT), 1.5)
    # ridge beam, a row of ridge tiles, and a stepped ornament at each end
    p.box(xm - 0.07, xm + 0.07, ry0 - 0.02, ry1 + 0.02, zR, zR + 8, mul(roofcol, 0.85), 1.5)
    nt = int((ry1 - ry0 - 0.5) / 0.2)
    for j in range(nt):
        ya = ry0 + 0.25 + j * ((ry1 - ry0 - 0.5) / nt)
        p.box(xm - 0.085, xm + 0.085, ya, ya + 0.16, zR + 8, zR + 15, mul(roofcol, 1.0), 1.2)
    for ya, yb in ((ry0 - 0.05, ry0 + 0.14), (ry1 - 0.14, ry1 + 0.05)):
        p.box(xm - 0.11, xm + 0.11, ya, yb, zR, zR + 18, mul(TIMBER, 1.15), 1.4)
        p.box(xm - 0.08, xm + 0.08, ya + 0.015, yb - 0.015, zR + 18, zR + 31, mul(TIMBER, 1.25), 1.3)
        p.box(xm - 0.115, xm + 0.115, ya - 0.005, yb + 0.005, zR + 31, zR + 36, mul(roofcol, 1.0), 1.3)
    p.notes.append(f'wall top z={zW} tip z={zT:.1f} ridge z={zR}; rise eave->ridge {RIDGE_RISE}; overhang +x {OVERHANG_E} tile; corner kick {KICK}')
    p.door = dict(face='east (+x)', door_y=(ds0, ds1), steps_x=(land, x1), steps_y=(st_y0, st_y1),
                  faces_tile=(w, int(d - 1)), steps_tile=(w - 1, int(d - 1)))
    p.geo = dict(wx0=wx0, wx1=wx1, wy0=wy0, wy1=wy1, rx1=rx1, xm=xm, zW=zW, zR=zR, zT=zT, ry0=ry0, ry1=ry1, free0=free0, free1=free1)
    return p


# ======================================================================== table
def table(variant='baskets'):
    """Market table 2x1.  variant: 'baskets' (three baskets), 'cloth' (cloth bolts and jars), 'sacks' (sacks and a hanging scale)."""
    nm = {'baskets': 'merchant-display', 'cloth': 'merchant-display-b', 'sacks': 'merchant-display-c'}[variant]
    p = Piece(nm, 2, 1)
    x0, x1, y0, y1 = 0.0, 2.0, 0.0, 1.0
    ix0, ix1, iy0, iy1 = x0 + 0.06, x1 - 0.06, y0 + 0.08, y1 - 0.08
    TOP_Z, TOP_T = 36.0, 6.0
    leg = 0.09
    ox0, ox1, oy0, oy1 = ix0 + 0.05, ix1 - 0.05, iy0 + 0.05, iy1 - 0.05

    def legbox(x, y):
        p.box(x, x + leg, y, y + leg, 0, TOP_Z - TOP_T, mul(WOOD, 0.9), 1.2)

    legbox(ox0, oy0)
    p.box(ox0 + 0.12, ox1 - 0.12, oy0 + 0.05, oy1 - 0.05, 8, 20, mul(WOOD, 0.85), 1.3)
    p.line([(ox0 + 0.12, oy1 - 0.05, 14), (ox1 - 0.12, oy1 - 0.05, 14)], 1.0)
    legbox(ox1 - leg, oy0)
    legbox(ox0, oy1 - leg)
    legbox(ox1 - leg, oy1 - leg)
    p.box(ix0, ix1, iy0, iy1, TOP_Z - TOP_T, TOP_Z, WOOD, 1.5)
    for k in range(1, 4):
        y = iy0 + (iy1 - iy0) * k / 4
        p.line([(ix0, y, TOP_Z), (ix1, y, TOP_Z)], 1.0)
    cy = 0.5
    if variant == 'baskets':
        BASK = (150, 100, 50)
        for k, (cx, prod) in enumerate(((0.5, (176, 52, 48)), (1.0, (80, 130, 60)), (1.5, (214, 160, 60)))):
            prism(p, cx, cy, 0.15, 0.2, TOP_Z, TOP_Z + 14, BASK, 14, hoops=(0.33, 0.66), topcol=mul(BASK, 0.8))
            p.line(ring(cx, cy, 0.19, 0.19, TOP_Z + 14, 18) + [ring(cx, cy, 0.19, 0.19, TOP_Z + 14, 18)[0]], 1.2, mul(BASK, 0.6))
            # produce: a low mound outline over the rim, peak 9 above it
            p.line([(cx + 0.18 * math.cos(a), cy, TOP_Z + 14 + 9 * math.sin(a)) for a in [i * math.pi / 12 for i in range(13)]], 1.3, prod)
            p.line([(cx, cy + 0.18 * math.cos(a), TOP_Z + 14 + 9 * math.sin(a)) for a in [i * math.pi / 12 for i in range(13)]], 1.3, prod)
    elif variant == 'cloth':
        for k in range(3):   # a stack of folded cloth at the back
            p.box(0.14 + 0.01 * (k % 2), 0.54 + 0.01 * (k % 2), 0.14, 0.38, TOP_Z + 6 * k, TOP_Z + 6 * (k + 1), CLOTH[(k + 2) % 4], 1.2)
            p.line([(0.54, 0.14, TOP_Z + 6 * k + 3), (0.54, 0.38, TOP_Z + 6 * k + 3)], 0.8)
        for k, (ox, oy, h) in enumerate(((0.36, 0.6, 26), (0.62, 0.74, 22))):   # two upright bolts in front
            prism(p, ox, oy, 0.085, 0.085, TOP_Z, TOP_Z + h, CLOTH[k], 12, hoops=(0.5,))
        for (jx, jy, s) in ((1.1, 0.7, 1.0), (1.4, 0.34, 1.2), (1.75, 0.62, 0.9)):
            prism(p, jx, jy, 0.07 * s, 0.115 * s, TOP_Z, TOP_Z + 17 * s, CLAY, 12, hoops=(0.5,))
            prism(p, jx, jy, 0.07 * s, 0.05 * s, TOP_Z + 17 * s, TOP_Z + 24 * s, CLAY, 12, topcol=mul(DARK, 1.4))
            prism(p, jx, jy, 0.058 * s, 0.058 * s, TOP_Z + 24 * s, TOP_Z + 27 * s, mul(CLAY, 0.85), 12)
    else:
        SACK = (206, 182, 130)
        for k, (sx, sy, s) in enumerate(((0.3, 0.38, 1.0), (0.68, 0.62, 0.9), (0.96, 0.34, 1.1))):
            prism(p, sx, sy, 0.13 * s, 0.16 * s, TOP_Z, TOP_Z + 13 * s, SACK, 12, hoops=(0.5,))
            prism(p, sx, sy, 0.16 * s, 0.07 * s, TOP_Z + 13 * s, TOP_Z + 24 * s, SACK, 12, topcol=mul(SACK, 0.7))
            p.line([(sx - 0.075 * s, sy, TOP_Z + 24 * s - 1), (sx + 0.075 * s, sy, TOP_Z + 24 * s - 1)], 1.6, (110, 84, 50))
        # hanging scale on a post at the east end
        px, py = 1.78, 0.62
        p.box(px - 0.035, px + 0.035, py - 0.035, py + 0.035, TOP_Z, TOP_Z + 78, mul(WOOD, 0.9), 1.3)
        zt = TOP_Z + 76
        p.line([(px - 0.3, py, zt), (px, py, zt), (px + 0.2, py, zt)], 2.0)
        p.box(px - 0.05, px + 0.05, py - 0.05, py + 0.05, zt - 2, zt + 8, mul(TIMBER, 1.1), 1.2)
        for bx in (px - 0.3, px + 0.2):
            zp = zt - 22
            p.line([(bx, py, zt), (bx - 0.07, py, zp)], 1.0)
            p.line([(bx, py, zt), (bx + 0.07, py, zp)], 1.0)
            p.poly(ring(bx, py, 0.08, 0.08, zp, 14), (190, 170, 120), 1.2)
    return p


# ======================================================================= planter
def planter(w, d):
    """Low planter, w x d tiles (2x1, 1x2): stone rim with capstones around a soil bed and a mound outline."""
    p = Piece(f'low-planter-{w}x{d}' if (w, d) != (2, 1) else 'low-planter', w, d)
    xa, xb, ya, yb = 0.03, w - 0.03, 0.03, d - 0.03
    t = 0.2
    H, CAP = 26.0, 6.0
    soil = H - 8.0

    def slab(x0, x1, y0, y1):
        p.box(x0, x1, y0, y1, 0, H - CAP, STONE, 1.5, tag='plinth')
        p.stone_courses(x0, x1, y0, y1, 0, H - CAP, 2, joint=0.5)
        p.box(x0 - 0.015, x1 + 0.015, y0 - 0.015, y1 + 0.015, H - CAP, H, mul(STONE, 1.06), 1.5)

    slab(xa, xb, ya, ya + t)
    slab(xa, xa + t, ya + t, yb)
    p.poly([(xa + t, ya + t, soil), (xb - t, ya + t, soil), (xb - t, yb - t, soil), (xa + t, yb - t, soil)], SOIL, 1.2)
    slab(xb - t, xb, ya + t, yb - t)
    slab(xa, xb, yb - t, yb)
    for a in (xa + 0.5 * k for k in range(1, 2 * w)):
        if a < xb - 0.01:
            p.line([(a, yb - t, H), (a, yb, H)], 1.0)
            p.line([(a, ya, H), (a, ya + t, H)], 1.0)
    for b in (ya + 0.5 * k for k in range(1, 2 * d)):
        if b < yb - 0.01:
            p.line([(xb - t, b, H), (xb, b, H)], 1.0)
            p.line([(xa, b, H), (xa + t, b, H)], 1.0)
    cx, cy = w / 2.0, d / 2.0
    rx, ry = (w - 2 * t) / 2.0 - 0.05, (d - 2 * t) / 2.0 - 0.05
    MOUND = 16.0
    GREEN = (60, 110, 60)
    p.line([(cx + rx * math.cos(a), cy + ry * math.sin(a), H) for a in [i * math.pi / 18 for i in range(37)]], 1.3, GREEN)
    p.line([(cx + rx * math.cos(a), cy, H + MOUND * math.sin(a)) for a in [i * math.pi / 18 for i in range(19)]], 1.3, GREEN)
    p.line([(cx, cy + ry * math.cos(a), H + MOUND * math.sin(a)) for a in [i * math.pi / 18 for i in range(19)]], 1.3, GREEN)
    p.notes.append(f'planting mound outline: base on rim plane z={H}, peak z={H + MOUND}')
    return p


# ========================================================================= bridge
def bridge():
    """Canal bridge on tile column x 0..1: the deck spans the canal tile (y 1..2) with 0.08 tile bearing on each bank,
    low side beams, four short posts, and two stone abutment blocks per bank, all inside the 1-tile path width."""
    p = Piece('canal-bridge', 1, 3)
    DECK_B, DECK_T = 8.0, 15.0
    dy0, dy1 = 0.92, 2.08
    bw = 0.10
    ex0, ex1 = 0.04, 0.96            # outer edge of the side beams (inside the path tile)
    # abutment stones: two separate blocks per bank, each 0.40 wide, 0.42 deep, 9 px tall; the path tile is 1.0 wide
    for (ya, yb) in ((0.52, 0.94), (2.06, 2.48)):
        for (xa, xb) in ((0.08, 0.48), (0.52, 0.92)):
            p.box(xa, xb, ya, yb, 0, 9, STONE, 1.5, tag='plinth')
            p.stone_courses(xa, xb, ya, yb, 0, 9, 1, joint=0.2)
    p.box(ex0, ex0 + bw, dy0, dy1, DECK_B - 1, 21, mul(WOOD, 0.85), 1.4)     # west side beam, low (behind the deck)
    # deck: planks across x, seams every 0.1 tile
    p.box(ex0 + bw, ex1 - bw, dy0, dy1, DECK_B, DECK_T, WOOD, 1.5)
    for k in range(1, 12):
        y = dy0 + k * (dy1 - dy0) / 12
        p.line([(ex0 + bw, y, DECK_T), (ex1 - bw, y, DECK_T)], 1.0)
    p.box(ex1 - bw, ex1, dy0, dy1, DECK_B - 1, 21, mul(WOOD, 0.85), 1.4)     # east side beam
    pz = 21 + 14
    for xx in (ex0, ex1 - bw):                                              # four short posts at the deck corners
        for yy in (dy0, dy1 - bw):
            p.box(xx, xx + bw, yy, yy + bw, DECK_B - 1, pz, mul(WOOD, 0.9), 1.3)
            p.box(xx - 0.015, xx + bw + 0.015, yy - 0.015, yy + bw + 0.015, pz, pz + 4, WOOD, 1.3)
    return p

def all_pieces():
    """The ten true pieces, in the order the packer and the painter sheets use."""
    return [house('dwelling', 4, 3, 'jars'), house('merchant', 4, 3, 'barrel'),
            house('dwelling', 4, 4, 'wood'), house('merchant', 4, 4, 'crates'),
            table('baskets'), table('cloth'), table('sacks'),
            planter(2, 1), planter(1, 2), bridge()]
