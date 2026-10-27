"""2:1 oblique construction blockouts for the Ba Dan market objects, drawn at an exact game size.

Why: the image generator will not shrink or re-project an object on request (2026-10-13 trials), but
PixelLab's Pro Flash edit keeps the shapes it is given and redraws their surface in the hand Kaya's G
sheet came from. So the size, the 2:1 axis, the construction and the arrangement are decided here, by
measurement, and the generator only renders.

Units: every length below is in **screen px at the game camera**, against an adult H = 89 (Kaya's idle
stands 158 PixelLab px, drawn at 0.5625 screen px per PixelLab px). Each object has a grain `f`: the
screen px one of its PixelLab px becomes. f = 0.5625 is the characters' own grain; the 2x1 tables use
f = 0.62 because Pro Flash edits at most 256 px wide and a table of brief length does not fit at 0.5625
(the 10% coarser source pixel is below one screen pixel either way).

Ground axes: +a runs down-right at 26.57 deg (2:1), +b runs down-left; a length along either axis is a
screen length. z is straight up the screen, unforeshortened, as the oblique camera draws uprights.
Light: one warm key from the upper left, so tops are lightest, +b faces (lower left) are mid, +a faces
(lower right) are darkest. Contour #1b1410, 1 source px.

    python3 -I art/source/ba-dan-market-g/tools/blockout.py   # writes blockouts/*.png
"""
import math, pathlib, random
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "blockouts"
H_ADULT = 89
LINE = (27, 20, 16, 255)
AX = (2 / math.sqrt(5), 1 / math.sqrt(5))
AY = (-2 / math.sqrt(5), 1 / math.sqrt(5))


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


# three tones each: lit top, +b face, +a face (or lit, mid, shade)
WOOD = [rgb("#97764f"), rgb("#7a5c3d"), rgb("#5a432e")]
WOOD_OLD = [rgb("#8a7a62"), rgb("#6e604c"), rgb("#4f4537")]
WOOD_DARK = [rgb("#7b5e40"), rgb("#634a33"), rgb("#4a3726")]
WICKER = [rgb("#b08d5c"), rgb("#8c6c44"), rgb("#644b30")]
WICKER_IN = rgb("#4e3a26")
CLAY = [rgb("#b47a56"), rgb("#93603f"), rgb("#6c432c")]
CLAY_PALE = [rgb("#c4a47e"), rgb("#a2845f"), rgb("#7a6146")]
GLAZE = [rgb("#5f7468"), rgb("#4a5c52"), rgb("#36443d")]
SACK = [rgb("#b9a27c"), rgb("#9a845f"), rgb("#736146")]
CLOTH = [rgb("#8f5b46"), rgb("#744736"), rgb("#563428")]
CLOTH_BLUE = [rgb("#5d6b7a"), rgb("#4a5663"), rgb("#36404b")]
LEATHER = [rgb("#8a6440"), rgb("#6e4e31"), rgb("#4f3823")]
ROPE = rgb("#9c8462")
RED = [rgb("#a8443a"), rgb("#7a2e28")]
YGREEN = [rgb("#9a9a4c"), rgb("#6e7034")]
ORANGE = [rgb("#c07a3a"), rgb("#8c5426")]
PURPLE = [rgb("#6e4a5e"), rgb("#4c3242")]
PEPPER = [rgb("#b24030"), rgb("#7c2a20")]
GRAIN = [rgb("#c8b07a"), rgb("#a58e5c")]
BEANS = [rgb("#7a5a3c"), rgb("#56402a")]
LEAF = [rgb("#6f8a4a"), rgb("#4f6634")]


class Canvas:
    def __init__(self, w, h, f, anchor):
        """w, h in source px; anchor: the screen point (source px) where ground (0, 0, 0) is drawn."""
        self.im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)
        self.f = f
        self.ox, self.oy = anchor

    def s(self, v):
        return v / self.f

    def p(self, a, b, z=0.0):
        k = 1 / self.f
        return (self.ox + (a * AX[0] + b * AY[0]) * k, self.oy + (a * AX[1] + b * AY[1] - z) * k)

    def poly(self, pts, fill, line=True):
        self.d.polygon(pts, fill=fill, outline=LINE if line else None)

    def box(self, a0, a1, b0, b1, z0, z1, tones, line=True):
        top, left, right = tones
        p = self.p
        self.poly([p(a0, b1, z0), p(a1, b1, z0), p(a1, b1, z1), p(a0, b1, z1)], left, line)
        self.poly([p(a1, b0, z0), p(a1, b1, z0), p(a1, b1, z1), p(a1, b0, z1)], right, line)
        self.poly([p(a0, b0, z1), p(a1, b0, z1), p(a1, b1, z1), p(a0, b1, z1)], top, line)

    def seam(self, a0, b0, a1, b1, z, color):
        self.d.line([self.p(a0, b0, z), self.p(a1, b1, z)], fill=color)

    def ell(self, a, b, z, w, fill, line=True, squash=0.5):
        x, y = self.p(a, b, z)
        r = self.s(w) / 2
        self.d.ellipse([x - r, y - r * squash, x + r, y + r * squash], fill=fill, outline=LINE if line else None)

    def fruit(self, x, y, w, tones):
        """One fruit centred on source point (x, y), w screen px across: shade disc, lit disc up-left. No glint."""
        r = self.s(w) / 2
        self.d.ellipse([x - r, y - r, x + r, y + r], fill=tones[1], outline=LINE)
        self.d.ellipse([x - r + 1, y - r + 1, x + r * 0.35, y + r * 0.35], fill=tones[0])

    def cylinder(self, a, b, z, w, h, tones, top=None):
        """A round thing standing upright: front half of the wall, then the top ellipse."""
        x, y = self.p(a, b, z)
        r, hh = self.s(w) / 2, self.s(h)
        self.d.rectangle([x - r, y - hh, x + r, y], fill=tones[1])
        self.d.chord([x - r, y - r / 2, x + r, y + r / 2], 0, 180, fill=tones[1], outline=LINE)
        # the shaded right third of the wall follows the curve of the base
        shade = [(x + r * 0.35, y - hh), (x + r, y - hh), (x + r, y)]
        shade += [(x + r * math.cos(t), y + r / 2 * math.sin(t)) for t in [i * 0.15 for i in range(0, 9)]]
        self.d.polygon(shade, fill=tones[2])
        self.d.arc([x - r, y - r / 2, x + r, y + r / 2], 0, 180, fill=LINE)
        self.d.line([(x - r, y - hh), (x - r, y)], fill=LINE)
        self.d.line([(x + r, y - hh), (x + r, y)], fill=LINE)
        self.ell(a, b, z + h, w, top or tones[0])

    def basket(self, a, b, z, w, h, fruit, n, fw, seed=1, heap=1.0, handle=False):
        """A round woven basket w across and h deep with n fruit fw across heaped above the rim."""
        self.cylinder(a, b, z, w, h, WICKER, top=WICKER[0])
        self.ell(a, b, z + h, w - 3, WICKER_IN, line=False)
        x0, y0 = self.p(a, b, z + h)
        rnd = random.Random(seed)
        R = self.s(w) / 2 - self.s(fw) / 2 - 1
        spots = []
        for _ in range(n):
            ang, rad = rnd.random() * 2 * math.pi, R * math.sqrt(rnd.random())
            dx, dy = rad * math.cos(ang), rad * math.sin(ang) / 2
            lift = (1 - rad / max(R, 1)) * self.s(fw) * 0.9 * heap
            spots.append((dy, dx, lift))
        for dy, dx, lift in sorted(spots):
            self.fruit(x0 + dx, y0 + dy - lift, fw, fruit)
        if handle:
            r = self.s(w) / 2
            self.d.arc([x0 - r * 0.8, y0 - r * 1.1, x0 + r * 0.8, y0 + r * 0.5], 180, 360, fill=LINE, width=2)
            self.d.arc([x0 - r * 0.8 + 1, y0 - r * 1.1 + 1, x0 + r * 0.8 - 1, y0 + r * 0.5], 190, 350, fill=WICKER[0], width=1)

    def sack(self, a, b, z, w, h, tones, open_with=None):
        """A filled cloth sack: rounded body, gathered neck (tied) or a rolled-down open mouth showing its contents."""
        x, y = self.p(a, b, z)
        r, hh = self.s(w) / 2, self.s(h)
        body = [(x - r * 0.8, y - hh), (x + r * 0.8, y - hh), (x + r * 1.05, y - hh * 0.35), (x + r, y + r * 0.2),
                (x, y + r * 0.35), (x - r, y + r * 0.2), (x - r * 1.05, y - hh * 0.35)]
        self.d.polygon(body, fill=tones[1], outline=LINE)
        self.d.polygon([(x - r * 0.75, y - hh + 1), (x - r * 0.1, y - hh + 1), (x - r * 0.2, y), (x - r * 0.9, y - hh * 0.3)], fill=tones[0])
        self.d.polygon([(x + r * 0.45, y - hh + 1), (x + r * 0.78, y - hh + 1), (x + r * 0.98, y - hh * 0.35), (x + r * 0.9, y + r * 0.15), (x + r * 0.5, y + r * 0.25)], fill=tones[2])
        self.d.line([(x - r * 0.3, y - hh * 0.6), (x + r * 0.1, y - hh * 0.1)], fill=tones[2])
        if open_with:
            self.d.ellipse([x - r * 0.85, y - hh - r * 0.35, x + r * 0.85, y - hh + r * 0.35], fill=tones[2], outline=LINE)
            self.d.ellipse([x - r * 0.7, y - hh - r * 0.3, x + r * 0.7, y - hh + r * 0.2], fill=open_with[0])
        else:
            self.d.polygon([(x - r * 0.35, y - hh), (x + r * 0.35, y - hh), (x + r * 0.2, y - hh - r * 0.6),
                            (x - r * 0.2, y - hh - r * 0.6)], fill=tones[1], outline=LINE)
            self.d.line([(x - r * 0.3, y - hh - r * 0.1), (x + r * 0.3, y - hh - r * 0.1)], fill=ROPE)

    def jar(self, a, b, z, w, h, tones, neck=0.42, lip=True, handle=False):
        """An unglazed storage jar or jug: belly, shoulder, short neck and lip. One lit side, no rim glints."""
        x, y = self.p(a, b, z)
        r, hh = self.s(w) / 2, self.s(h)
        self.d.ellipse([x - r, y - hh * 0.92, x + r, y], fill=tones[1], outline=LINE)
        self.d.ellipse([x - r + 1, y - hh * 0.85, x + r * 0.1, y - hh * 0.3], fill=tones[0])
        self.d.ellipse([x + r * 0.3, y - hh * 0.75, x + r - 1, y - 2], fill=tones[2])
        nr = r * neck
        self.d.rectangle([x - nr, y - hh, x + nr, y - hh * 0.8], fill=tones[1], outline=LINE)
        if lip:
            self.d.ellipse([x - nr * 1.25, y - hh - nr * 0.45, x + nr * 1.25, y - hh + nr * 0.45], fill=tones[2], outline=LINE)
        if handle:
            self.d.arc([x + r * 0.5, y - hh * 0.95, x + r * 1.3, y - hh * 0.45], 270, 90, fill=LINE, width=2)

    def crate(self, a0, a1, b0, b1, z, h, tones=None, slats=3, open_top=None, lid_ajar=False):
        tones = tones or WOOD_OLD
        self.box(a0, a1, b0, b1, z, z + h, tones)
        for i in range(1, slats):
            zz = z + h * i / slats
            self.d.line([self.p(a0, b1, zz), self.p(a1, b1, zz)], fill=LINE)
            self.d.line([self.p(a1, b0, zz), self.p(a1, b1, zz)], fill=LINE)
        if open_top:
            self.poly([self.p(a0 + 1.5, b0 + 1.5, z + h), self.p(a1 - 1.5, b0 + 1.5, z + h),
                       self.p(a1 - 1.5, b1 - 1.5, z + h), self.p(a0 + 1.5, b1 - 1.5, z + h)], open_top[1])
        if lid_ajar:
            la = (a1 - a0)
            self.box(a0 + la * 0.15, a1 + la * 0.1, b0 - 1, b1 - 2, z + h, z + h + 1.5, tones)

    def cloth(self, pts, z, tones, folds=2):
        """A flat cloth lying on a surface, pts as (a, b) corners."""
        P = [self.p(a, b, z + 0.5) for a, b in pts]
        self.poly(P, tones[0])
        for i in range(1, folds + 1):
            t = i / (folds + 1)
            p0 = (P[0][0] + (P[1][0] - P[0][0]) * t, P[0][1] + (P[1][1] - P[0][1]) * t)
            p1 = (P[3][0] + (P[2][0] - P[3][0]) * t, P[3][1] + (P[2][1] - P[3][1]) * t)
            self.d.line([p0, p1], fill=tones[1])
        self.d.line([P[3], P[2]], fill=tones[2])


def table(c, L, D, Ht, leg=3.5, top_t=3.5, inset=4.5, wood=WOOD, legwood=WOOD_DARK, stretcher=True, under=None):
    """A plain plank market table: top L x D at Ht, four square legs inset from the corners, a low stretcher.
    `under(c)` draws whatever stands on the ground between the legs, behind the front legs."""
    back = [(inset, inset), (L - inset - leg, inset)]
    front = [(inset, D - inset - leg), (L - inset - leg, D - inset - leg)]
    for a, b in back:
        c.box(a, a + leg, b, b + leg, 0, Ht - top_t, legwood)
    if stretcher:
        for a in (inset, L - inset - leg):
            c.box(a + 0.5, a + leg - 0.5, inset + leg, D - inset - leg, 7, 9.5, legwood)
        c.box(inset + leg, L - inset - leg, D / 2 - 1, D / 2 + 1, 7.5, 9.5, legwood)
    if under:
        under(c)
    for a, b in front:
        c.box(a, a + leg, b, b + leg, 0, Ht - top_t, legwood)
    # aprons under the top, set in from the edge
    c.box(inset, L - inset, D - inset - 1, D - inset, Ht - top_t - 3, Ht - top_t, legwood)
    c.box(0, L, 0, D, Ht - top_t, Ht, wood)
    for i in range(1, 3):
        b = D * i / 3
        c.seam(1.5, b, L - 1.5, b, Ht, wood[1])


def canvas_for(w, h, f, L, D, margin_bottom=6):
    """A canvas whose ground (0, 0) is placed so an L x D footprint is centred left-right and sits near the bottom."""
    global LAST
    k = 1 / f
    width_px = (L * AX[0] - D * AY[0]) * k
    ox = (w - width_px) / 2 + D * -AY[0] * k
    oy = h - margin_bottom - (L * AX[1] + D * AY[1]) * k
    LAST = Canvas(w, h, f, (ox, oy))
    LAST.L, LAST.D = L, D
    return LAST


# ---------------------------------------------------------------- objects

def gao_fruit_table(seed=1):
    """Gao's fruit table by the canal: stock in use, not a display. Length 1.57H, top 0.52H."""
    L, D, Ht, f = 140, 34, 46, 0.62
    c = canvas_for(256, 224, f, L, D)

    def under(c):
        # a stock crate of fruit under the right end, half behind the stretcher
        c.crate(L * 0.58, L * 0.58 + 20, 19, 31, 0, 9, open_top=ORANGE)
        x, y = c.p(L * 0.58 + 10, 25, 9)
        for i in range(7):
            c.fruit(x - c.s(7) + (i % 4) * c.s(4), y - c.s(1.5) + (i // 4) * c.s(2), 4, ORANGE)

    table(c, L, D, Ht, under=under)
    # on the top, back to front: a cloth under the middle, two baskets touching, a low tray, loose fruit, a knife-less cut cue avoided
    c.cloth([(L * 0.40, 4), (L * 0.66, 4), (L * 0.66, D - 4), (L * 0.40, D - 4)], Ht, CLOTH_BLUE, folds=1)
    c.basket(L * 0.17, D * 0.42, Ht, 26, 6, RED, 15, 4.5, seed=seed, heap=1.0)
    c.basket(L * 0.33, D * 0.66, Ht, 21, 5, YGREEN, 10, 4.5, seed=seed + 1)
    c.basket(L * 0.55, D * 0.45, Ht, 23, 4, ORANGE, 13, 4.5, seed=seed + 2, heap=0.6)
    for a, b in [(L * 0.47, D * 0.82), (L * 0.50, D * 0.86), (L * 0.70, D * 0.70)]:
        x, y = c.p(a, b, Ht)
        c.fruit(x, y - c.s(2), 4.5, ORANGE if a > L * 0.6 else RED)
    # a stack of two empty shallow baskets at the far right end, used for weighing out
    c.cylinder(L * 0.84, D * 0.48, Ht, 20, 2.5, WICKER)
    c.cylinder(L * 0.84, D * 0.48, Ht + 2.5, 19, 2.5, WICKER)
    c.ell(L * 0.84, D * 0.48, Ht + 5, 16, WICKER_IN, line=False)
    # a big stock basket on the ground in front of the left legs
    c.basket(L * 0.30, D + 11, 0, 30, 13, RED, 16, 4.5, seed=seed + 3, heap=0.7)
    return c.im


def south_grain_table(seed=1):
    """The south display: dry goods sold by measure. Sacks open on their rolled mouths, a balance, a scoop jar."""
    L, D, Ht, f = 138, 34, 46, 0.62
    c = canvas_for(256, 252, f, L, D)

    def under(c):
        c.sack(L * 0.62, 22, 0, 16, 14, SACK)            # spare tied sack between the legs
    table(c, L, D, Ht, wood=WOOD_OLD, legwood=WOOD_DARK, under=under)
    # a standing balance at the left end: square foot, post, beam, two shallow pans on cords
    a0, b0 = L * 0.12, D * 0.45
    c.box(a0 - 4, a0 + 4, b0 - 3, b0 + 3, Ht, Ht + 2, WOOD_DARK)
    c.box(a0 - 1, a0 + 1, b0 - 1, b0 + 1, Ht + 2, Ht + 30, WOOD_DARK)
    xl, yl = c.p(a0 - 11, b0, Ht + 29)
    xr, yr = c.p(a0 + 11, b0, Ht + 29)
    c.d.line([(xl, yl), (xr, yr)], fill=LINE, width=2)
    for (x, y) in ((xl, yl), (xr, yr)):
        c.d.line([(x - c.s(3), y + c.s(12)), (x, y), (x + c.s(3), y + c.s(12))], fill=ROPE)
        r = c.s(5)
        c.d.chord([x - r, y + c.s(12) - r / 2, x + r, y + c.s(12) + r / 2], 0, 180, fill=rgb("#7c6a52"), outline=LINE)
    # sacks, open, rolled down to show grain, beans and red pepper flakes; touching, unequal
    c.sack(L * 0.36, D * 0.40, Ht, 20, 15, SACK, open_with=GRAIN)
    c.sack(L * 0.50, D * 0.62, Ht, 18, 12, SACK, open_with=BEANS)
    c.sack(L * 0.66, D * 0.38, Ht, 19, 14, SACK, open_with=PEPPER)
    # a small clay jar with a wooden scoop, and a folded cloth at the right end
    c.jar(L * 0.82, D * 0.40, Ht, 10, 12, CLAY)
    c.box(L * 0.82 - 1, L * 0.82 + 1, D * 0.40 - 4, D * 0.40 - 2, Ht + 11, Ht + 17, WOOD)
    c.cloth([(L * 0.76, D * 0.62), (L * 0.95, D * 0.62), (L * 0.95, D - 3), (L * 0.76, D - 3)], Ht, CLOTH, folds=1)
    # a sack slumped against the front-right leg on the ground
    c.sack(L * 0.92, D + 8, 0, 18, 15, SACK, open_with=GRAIN)
    return c.im


def north_pottery_table(seed=1):
    """The north display: a potter's stock. Mostly unglazed jars and jugs, one glazed jar, a bowl stack, stock below."""
    L, D, Ht, f = 138, 36, 44, 0.62
    c = canvas_for(256, 236, f, L, D)

    def under(c):
        c.jar(L * 0.30, 24, 0, 16, 20, CLAY_PALE)
        c.jar(L * 0.45, 26, 0, 14, 17, CLAY)
    table(c, L, D, Ht, under=under)
    # back row taller, front row smaller, close together, one jug turned
    c.jar(L * 0.12, D * 0.40, Ht, 14, 19, CLAY)
    c.jar(L * 0.24, D * 0.32, Ht, 16, 22, CLAY_PALE)
    c.jar(L * 0.22, D * 0.70, Ht, 11, 13, CLAY, handle=True)
    c.jar(L * 0.38, D * 0.42, Ht, 15, 18, GLAZE)
    # a stack of shallow bowls
    for i in range(4):
        c.cylinder(L * 0.55, D * 0.55, Ht + i * 2.2, 15 - i * 0.6, 2.2, CLAY_PALE)
    c.ell(L * 0.55, D * 0.55, Ht + 8.8, 11, CLAY_PALE[2], line=False)
    c.jar(L * 0.70, D * 0.38, Ht, 12, 15, CLAY, handle=True)
    c.jar(L * 0.80, D * 0.62, Ht, 9, 10, CLAY_PALE, neck=0.5)
    c.jar(L * 0.88, D * 0.40, Ht, 9, 11, CLAY)
    # a big storage jar on the ground at the right end, in front
    c.jar(L * 0.95, D + 10, 0, 22, 28, CLAY_PALE, neck=0.5)
    return c.im


def bench(seed=1):
    """The canal bench: one thick seat plank on two splayed slab legs, a little worn. Seat 0.26H, length 1.25H."""
    L, D, Hs, f = 110, 14, 23, 0.5625
    c = canvas_for(216, 140, f, L, D, margin_bottom=4)
    for a in (10, L - 16):
        c.box(a, a + 6, 2, D - 2, 0, Hs - 3.5, WOOD_DARK)
        c.box(a - 1, a + 7, D - 3, D - 2, 0, 2, WOOD_DARK)      # a foot strip, worn
    c.box(16, L - 16, D / 2 - 1, D / 2 + 1, 5, 7.5, WOOD_DARK)   # stretcher between the slabs
    c.box(0, L, 0, D, Hs - 3.5, Hs, WOOD)
    c.seam(2, D / 2, L - 2, D / 2, Hs, WOOD[1])
    return c.im


def fence_segment(seed=1):
    """One tile of post-and-rail fence along +a: two posts and two split rails; tiles twice for the 2x1 piece."""
    T = 107.3                 # screen length of one tile edge
    L, f = T, 0.5625
    c = canvas_for(176, 168, f, L + 6, 6, margin_bottom=4)
    for a in (0.0, L):
        c.box(a, a + 5, 0, 5, 0, 40, WOOD_OLD)
    for z in (14, 30):
        c.box(4, L + 1, 1.5, 3.5, z, z + 4, WOOD_OLD)
    for a in (0.0, L):                                        # posts in front of the rail ends
        c.box(a, a + 5, 3.5, 5, 0, 40, WOOD_OLD)
    return c.im


def shop_stack(seed=1):
    """Gao's shopfront stock (1x1): two crates stacked off-square, a waterskin rack with a string of dried peppers."""
    f = 0.5625
    c = canvas_for(220, 232, f, 70, 46, margin_bottom=4)
    # rack behind: two posts and a crossbar, 0.62H, along +a
    for a in (4, 52):
        c.box(a, a + 3, 4, 7, 0, 55, WOOD_DARK)
    c.box(4, 55, 4.5, 6.5, 50, 53, WOOD_DARK)
    # waterskins hanging from the bar by cords, and a pepper string
    for i, a in enumerate((14, 25, 40)):
        x, y = c.p(a, 5.5, 50)
        c.d.line([(x, y), (x, y + c.s(6))], fill=ROPE)
        w, h = (9, 14) if i != 1 else (8, 12)
        c.d.ellipse([x - c.s(w / 2), y + c.s(6), x + c.s(w / 2), y + c.s(6 + h)], fill=LEATHER[1], outline=LINE)
        c.d.ellipse([x - c.s(w / 2) + 1, y + c.s(7), x, y + c.s(4 + h * 0.7)], fill=LEATHER[0])
        c.d.rectangle([x - c.s(1.5), y + c.s(4), x + c.s(1.5), y + c.s(7)], fill=LEATHER[2], outline=LINE)
    x, y = c.p(48, 5.5, 50)
    c.d.line([(x, y), (x, y + c.s(4))], fill=ROPE)
    for k in range(8):
        c.fruit(x + (k % 2) * c.s(2) - c.s(1), y + c.s(4 + k * 3), 3.5, PEPPER)
    # crates: one on the ground, one on top turned slightly off its edge, a lid leaning
    c.crate(6, 34, 16, 40, 0, 18, slats=3)
    c.crate(9, 33, 19, 39, 18, 15, slats=2, open_top=YGREEN)
    x, y = c.p(21, 29, 33)
    for k in range(9):
        c.fruit(x - c.s(8) + (k % 5) * c.s(4), y - c.s(1) + (k // 5) * c.s(2.5), 4, YGREEN)
    c.crate(40, 60, 22, 42, 0, 12, slats=2, open_top=PEPPER)
    x, y = c.p(50, 32, 12)
    for k in range(10):
        c.fruit(x - c.s(7) + (k % 5) * c.s(3.5), y - c.s(1.5) + (k // 5) * c.s(2), 3, PEPPER)
    c.jar(64, 44, 0, 11, 15, CLAY)
    return c.im


def baskets_south(seed=1):
    """Stock baskets by the south display (1x1): a large lidded stock basket, a carry basket of greens, one tipped."""
    f = 0.5625
    c = canvas_for(200, 152, f, 60, 40, margin_bottom=4)
    c.cylinder(16, 12, 0, 32, 20, WICKER)                       # large stock basket (0.36H), lid on
    c.cylinder(16, 12, 20, 33, 2.5, WICKER)
    c.basket(42, 18, 0, 25, 11, LEAF, 9, 6, seed=seed, heap=1.2, handle=True)   # carry basket, 0.28H
    c.basket(26, 34, 0, 22, 9, RED, 11, 4.5, seed=seed + 1)
    return c.im


def baskets_north(seed=1):
    """Stock baskets by the north display (1x1): roots and onions, two empty baskets nested."""
    f = 0.5625
    c = canvas_for(200, 152, f, 60, 40, margin_bottom=4)
    c.cylinder(18, 14, 0, 26, 9, WICKER)
    c.cylinder(18, 14, 9, 25, 7, WICKER)
    c.ell(18, 14, 16, 21, WICKER_IN, line=False)
    c.basket(42, 18, 0, 27, 12, BEANS, 14, 5, seed=seed + 2, heap=0.9)
    c.basket(30, 34, 0, 22, 10, ORANGE, 12, 4.5, seed=seed + 3)
    return c.im


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    import json
    TILE_EDGE = 107.33   # screen length of one tile edge at scale 1.5
    meta = {}
    for name, fn, fp in [("gao-fruit-table", gao_fruit_table, (2, 1)), ("south-grain-table", south_grain_table, (2, 1)),
                         ("north-pottery-table", north_pottery_table, (2, 1)), ("bench", bench, (2, 1)),
                         ("fence-segment", fence_segment, (1, 1)), ("shop-stack", shop_stack, (1, 1)),
                         ("baskets-south", baskets_south, (1, 1)), ("baskets-north", baskets_north, (1, 1))]:
        fn().save(OUT / f"{name}.png")
        c = LAST
        meta[name] = {
            "canvas": list(c.im.size), "grain_f": c.f,
            "ground_anchor_src_px": [round(c.ox, 2), round(c.oy, 2)],
            "extent_screen_px": {"along_a": c.L, "along_b": c.D},
            "footprint_tiles": list(fp),
            # where the object's (0, 0) sits inside its footprint so the object is centred on it
            "offset_in_footprint_screen_px": [round((fp[0] * TILE_EDGE - c.L) / 2, 2), round((fp[1] * TILE_EDGE - c.D) / 2, 2)],
        }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1) + "\n")
    for p in sorted(OUT.glob("*.png")):
        im = Image.open(p)
        print(p.name, im.size, im.getbbox())
