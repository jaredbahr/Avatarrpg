"""Round 4 geometry of the four Ba Dan houses: whole buildings, a plinth all round, and a yard of their own.

The village's houses; round 3's, which stood on a terrace with a thin roof sheet, are gone.  Same projection as everything else (screen
Y = (x + y) * 32 - z, x down-right, y down-left, z in world px, horizontals in tiles) and the same Piece renderer.

What changed against round 3, and why (numbers are asserted by `audit_house`, printed by `houses_review.py`):

* Far roof slope.  The ridge and the far eave both run along y, so on screen they are parallel lines of slope -0.5 and
  the far slope's band above the ridge is the difference of their intercepts: 64 px per tile of run (half span plus
  overhang) minus the rise (see `band_px`).  Round 3 had half span 0.85 and rise 46: 64 * 1.0 - 46 - 8 = 10 px, a
  sliver the ridge beam covered, so each house read as a facade under a tilted sheet.  Here the half span is 1.0 to 1.1
  and the rise 26 to 30 (pitch 26 to 27 px per tile, about 20 degrees on the ground plan's own scale), which leaves a
  band of 41 to 46 world px (62 to 69 guide px) above the ridge line, measured from the render in `houses_meta.py`.
* Plinth: 18 px all round on every side, one height, with a two-riser stair at the door (9 + 9).  A figure in the
  game is 86 px tall (128 x 192 frame drawn at 1.45 tiles per 128 px: 118 * 0.725, feet at 85%), so the threshold is
  0.21 of a person, shin to knee.  Door 88 px clear (1.02 of a person: a stooped fit, like the game's other doors), windows sill 32 above the floor.
* Yard: a separate, fully bounded area on the west tiles of the footprint (x from 0 to the plinth), its own kerb or
  fence on every open side, one gate, the house's plinth complete where they meet.  Nothing of it runs under a roof.
* Axis rule: every edge is along x, along y, vertical, or in a plane x = c or y = c.  No hips and no dormers (their
  valleys and hip lines run diagonal on the ground).  A second lower roof is a wing with its own ridge along y.
"""
import math
from dataclasses import dataclass, field
from guidelib import Piece, mul, proj, area2, K_LEFT, K_RIGHT, K_TOP, K_ROOF_NEAR, K_ROOF_FAR, K_BAND
from pieces import (PLASTER, TIMBER, STONE, TERRACOTTA, GREEN_TILE, DARK, AWNING, WOOD, SOIL, SHUTTER, CLAY, STRAW,
                    LANTERN, CLOTH, prism, ring, window, ledge_jar, crate, firewood, barrel, bench, lantern, name_board,
                    PlaneE, PlaneS, disc_e)
from dressing import barrel_big, sackp, basket, post as dpost, HAY, WATER, LEAF
from geo import wheel, beam, cyl

# ---------------------------------------------------------------- shared proportions
PLINTH = 18.0          # one height, all round (round 3: 26 and a 3 px threshold stone)
STEP = PLINTH / 2.0    # two risers of 9
LEDGE = 0.20           # plinth ledge beyond the walls on the west, north and south
DOOR_H = 88.0
LINTEL = 8.0
FIGURE_H = 86.0        # px, the game's figure (see module docstring)
OVH_E, OVH_W, OVH_S = 0.15, 0.15, 0.20   # roof overhang east, west, gable ends
KICK, KICK_LEN = 4.0, 0.5
RAFTER = 5.0
EARTH = (176, 140, 98)
HEDGE = (84, 124, 74)
WATTLE = (176, 136, 84)
LOG = (150, 104, 62)
WALL_DENSITY = {'stone': 1.0, 'wattle': 0.7, 'rail': 0.3}   # an open rail fence lets most of the light through
ROOF_BAND = 32.0       # the projection's: screen Y changes by 32 per tile of x or y


@dataclass
class Spec:
    name: str
    kind: str                 # 'dwelling' | 'merchant'
    w: int
    d: int
    household: str            # 'jars' | 'barrel' | 'wood' | 'crates'
    depth: float              # body depth in x (the roof's span)
    rise: float               # eave line -> ridge, world px
    wall_h: float             # plinth top -> eave line, main block
    porch: float = 0.5        # plinth east ledge: landing + one tread
    nwindows: int = 2
    chimney: str = ''         # '' | 'ridge' | 'vent' | 'wing'
    porch_roof: bool = False  # timber-and-tile lean-to on two posts over the door
    wing: float = 0.0         # y length of a lower south wing (0: none)
    wing_drop: float = 0.0    # wing eave below the main eave
    wing_rise: float = 0.0
    yard_style: str = 'wattle'
    gate: str = 'south'       # which yard wall carries the gate
    gate_x: float = 0.55      # gate centre along that wall (tiles)
    bay: float = 0.0          # merchant shop bay width (0: none)
    bay_y: float = 0.0        # bay centre in y (0: next to the door)
    notes: list = field(default_factory=list)


SPECS = [
    Spec('dwelling-4x3', 'dwelling', 4, 3, 'jars', depth=2.0, rise=28.0, wall_h=108.0, nwindows=2,
         chimney='ridge', yard_style='wattle', gate='south', gate_x=0.5),
    Spec('merchant-house-4x3', 'merchant', 4, 3, 'barrel', depth=2.2, rise=30.0, wall_h=112.0,
         chimney='vent', yard_style='stone', gate='south', gate_x=0.6, bay=1.0),
    Spec('dwelling-4x4', 'dwelling', 4, 4, 'wood', depth=2.0, rise=26.0, wall_h=102.0, nwindows=3,
         chimney='ridge', porch_roof=True, yard_style='rail', gate='south', gate_x=0.5),
    Spec('merchant-house-4x4', 'merchant', 4, 4, 'crates', depth=2.2, rise=30.0, wall_h=116.0,
         chimney='wing', wing=1.55, wing_drop=14.0, wing_rise=22.0, yard_style='stone', gate='north', gate_x=0.5,
         bay=1.25),
]


def band_px(depth, rise, ovh=OVH_W):
    """Vertical thickness, at a fixed screen X, of the far slope's band above the ridge line, in world px (>0: it shows).
    Both the ridge and the far eave line run along y, so on screen they are parallel lines of slope -0.5 and the band is
    the difference of their intercepts: 64 per tile of run (half span plus overhang) minus the ridge's height above the
    eave tip."""
    h = depth / 2.0
    pitch = rise / h
    return 64.0 * (h + ovh) - rise - pitch * ovh


# ---------------------------------------------------------------- small building blocks
def kerb(p, x0, x1, y0, y1, h, col=STONE, cap=3.0, tag='yard', courses=1, faces='SE'):
    p.box(x0, x1, y0, y1, 0, h - cap, col, 1.3, tag=tag)
    p.stone_courses(x0, x1, y0, y1, 0, h - cap, courses, joint=0.4, faces=faces)
    p.box(x0 - 0.01, x1 + 0.01, y0 - 0.01, y1 + 0.01, h - cap, h, mul(col, 1.07), 1.3, tag=tag)


def wattle_run(p, x0, x1, y0, y1, h=17.0, tag='yard'):
    """A woven fence run: posts, a plank base, and a plain panel with weave strokes."""
    along_x = (x1 - x0) > (y1 - y0)
    p.box(x0, x1, y0, y1, 0, h, WATTLE, 1.2, tag=tag)
    n = int(((x1 - x0) if along_x else (y1 - y0)) / 0.16)
    for k in range(1, n):
        f = k / n
        if along_x:
            p.line([(x0 + (x1 - x0) * f, y1, 1), (x0 + (x1 - x0) * f, y1, h - 1)], 0.8)
        else:
            p.line([(x1, y0 + (y1 - y0) * f, 1), (x1, y0 + (y1 - y0) * f, h - 1)], 0.8)
    for zz in (h * 0.33, h * 0.66):
        p.line([(x0, y1, zz), (x1, y1, zz)] if along_x else [(x1, y0, zz), (x1, y1, zz)], 0.8)


def rail_run(p, x0, x1, y0, y1, tag='yard'):
    """A post-and-two-rail fence (open between the rails), 24 px to the top rail."""
    along_x = (x1 - x0) > (y1 - y0)
    L = (x1 - x0) if along_x else (y1 - y0)
    n = max(1, int(round(L / 0.5)))
    t = 0.05
    for k in range(n + 1):
        u = (x0 if along_x else y0) + L * k / n
        if along_x:
            p.box(u - t, u + t, y0, y1, 0, 26, mul(WOOD, 0.9), 1.1, tag=tag)
        else:
            p.box(x0, x1, u - t, u + t, 0, 26, mul(WOOD, 0.9), 1.1, tag=tag)
    for z0, z1 in ((8, 12), (19, 23)):
        if along_x:
            p.box(x0, x1, y0 + 0.01, y1 - 0.01, z0, z1, WOOD, 1.0, tag=tag)
        else:
            p.box(x0 + 0.01, x1 - 0.01, y0, y1, z0, z1, WOOD, 1.0, tag=tag)


def yard_wall(p, style, x0, x1, y0, y1):
    if style == 'stone':
        kerb(p, x0, x1, y0, y1, 15.0)
    elif style == 'rail':
        rail_run(p, x0, x1, y0, y1)
    else:
        wattle_run(p, x0, x1, y0, y1)


# ---------------------------------------------------------------- the house
def house(spec):
    w, d = spec.w, spec.d
    p = Piece(spec.name, w, d)
    p.household = spec.household
    p.spec = spec
    roofcol = TERRACOTTA if spec.kind == 'dwelling' else GREEN_TILE
    tim_s, tim_e = mul(TIMBER, K_LEFT), mul(TIMBER, K_RIGHT)
    D = spec.depth
    wx1 = w - spec.porch
    wx0 = wx1 - D
    px0 = wx0 - LEDGE
    xm = (wx0 + wx1) / 2.0
    wy0, wy1 = LEDGE, d - LEDGE
    zW = PLINTH + spec.wall_h
    zR = zW + spec.rise
    vols = []
    p.vols = vols

    def vbox(id_, kind, x0, x1, y0, y1, z0, z1, density=None):
        v = dict(id=id_, kind=kind, rect=[round(x0, 4), round(x1, 4), round(y0, 4), round(y1, 4)], z=[round(z0, 2), round(z1, 2)])
        if density is not None:
            v['density'] = density
        vols.append(v)

    # ----- door geometry (east wall, south end: the same place as round 3, so the steps' tile and Gao/Mira/Pella's door tiles hold)
    ds1 = d - 0.5
    ds0 = ds1 - 0.8
    fr = 0.06
    st_y0, st_y1 = ds0 - fr - 0.04, ds1 + fr + 0.04
    land = wx1 + 0.22
    dz1 = PLINTH + DOOR_H

    # wing bookkeeping (merchant 4x4): main block north, lower wing south, same x extent
    wing = spec.wing
    wm = wy1 - wing if wing else wy1       # y where the main block's south gable stands
    zWw = zW - spec.wing_drop if wing else zW
    zRw = zWw + spec.wing_rise if wing else zR

    # =========================================================== yard (west tiles, painter's order: back first)
    yw = px0                                    # the yard spans x 0..px0 and y 0..d
    yt = 0.12                                   # wall thickness
    ya0, ya1 = yt, yw                            # interior x
    yb0, yb1 = yt, d - yt                        # interior y
    p.yard = dict(x=[0.0, round(yw, 3)], y=[0.0, float(d)], interior=[[ya0, round(ya1, 3)], [yb0, yb1]], gate=spec.gate,
                  gate_at=spec.gate_x, style=spec.yard_style)
    p.box(0.0, yw, 0.0, float(d), 0, 3.0, EARTH, 1.2, tag='yard')      # the whole yard rectangle is earth, walls stand on it
    vbox('yard-floor', 'prop', 0.0, yw, 0.0, float(d), 0, 3.0, density=0.0)
    gw = 0.46
    g0, g1 = spec.gate_x - gw / 2, spec.gate_x + gw / 2

    def wall_x(y0_, y1_, gap=None):
        """A wall running along x at y0_..y1_ from x = 0 to the plinth; `gap` is an (a, b) opening."""
        segs = [(0.0, yw)] if not gap else [(0.0, gap[0]), (gap[1], yw)]
        for a, b in segs:
            if b - a > 0.02:
                yard_wall(p, spec.yard_style, a, b, y0_, y1_)
                vbox('yard-wall', 'wall', a, b, y0_, y1_, 0, 15.0, density=WALL_DENSITY[spec.yard_style])

    # west wall (behind everything), then the north wall
    yard_wall(p, spec.yard_style, 0.0, yt, 0.0, float(d))
    vbox('yard-wall-w', 'wall', 0.0, yt, 0.0, float(d), 0, 15.0, density=WALL_DENSITY[spec.yard_style])
    wall_x(0.0, yt, (g0, g1) if spec.gate == 'north' else None)

    # household contents; none stands within 0.06 of the plinth
    contents(p, spec, ya0, ya1, yb0, yb1, vbox)

    # south wall last (nearest), with its gate
    wall_x(d - yt, float(d), (g0, g1) if spec.gate == 'south' else None)
    # gate posts: two heavier posts framing the gap, and a stone threshold
    gy0, gy1 = (d - yt - 0.01, d + 0.0) if spec.gate == 'south' else (0.0, yt + 0.01)
    for gx in (g0 - 0.045, g1 + 0.045):
        p.box(gx - 0.05, gx + 0.05, gy0 - (0.01 if spec.gate == 'south' else 0.0), gy1 + (0.0 if spec.gate == 'south' else 0.01),
              0, 30, mul(TIMBER, 1.0), 1.3, tag='yard')
        p.box(gx - 0.06, gx + 0.06, gy0 - 0.01, gy1 + 0.01, 30, 34, mul(roofcol, 1.0), 1.3, tag='yard')
    p.box(g0, g1, gy0, gy1, 0, 2.0, mul(STONE, 1.1), 1.0, tag='yard')
    p.yard['gate_tiles_local'] = [[int(math.floor(g0)), (d if spec.gate == 'south' else -1)], [int(math.floor(g1)), (d if spec.gate == 'south' else -1)]]

    p.yard_ops_end = len(p.ops)
    # =========================================================== plinth all round (one height), stair cut at the door
    x1p = float(w)
    p.box(px0, x1p, 0.0, st_y0, 0, PLINTH, STONE, 1.5, tag='plinth')
    p.stone_courses(px0, x1p, 0.0, st_y0, 0, PLINTH, 2)
    p.box(px0, land, st_y0, st_y1, 0, PLINTH, STONE, 1.5, tag='plinth')
    p.stone_courses(px0, land, st_y0, st_y1, 0, PLINTH, 2)
    p.box(land, x1p, st_y0, st_y1, 0, STEP, STONE, 1.5, tag='plinth')            # the one tread: riser 9 to it, riser 9 from it up to the landing
    p.stone_courses(land, x1p, st_y0, st_y1, 0, STEP, 1)
    p.box(px0, x1p, st_y1, float(d), 0, PLINTH, STONE, 1.5, tag='plinth')
    p.stone_courses(px0, x1p, st_y1, float(d), 0, PLINTH, 2)
    vbox('plinth', 'house', px0, x1p, 0.0, float(d), 0, PLINTH)

    # =========================================================== blocks: main (north) and optional wing (south)
    blocks = [dict(name='main', y0=wy0, y1=wm, zW=zW, zR=zR)]
    if wing:
        blocks.append(dict(name='wing', y0=wm, y1=wy1, zW=zWw, zR=zRw))

    def gable_wall(y, zWb, zRb, window_spec=None, tag='wall'):
        S = PlaneS(p, y)
        pw = 0.11
        p.poly([(wx0, y, PLINTH), (wx1, y, PLINTH), (wx1, y, zWb), (xm, y, zRb), (wx0, y, zWb)], mul(PLASTER, K_LEFT), 1.5, tag=tag)
        p.poly([(wx0, y, zWb), (xm, y, zRb), (wx1, y, zWb), (wx1, y, zWb - 9), (xm, y, zRb - 9), (wx0, y, zWb - 9)],
               mul(PLASTER, K_LEFT * K_BAND), 0.8)
        S.quad(wx0, wx0 + pw, PLINTH, zWb, tim_s, 1.2)
        S.quad(wx1 - pw, wx1, PLINTH, zWb, tim_s, 1.2)
        S.quad(wx0, wx1, PLINTH, PLINTH + 6, tim_s, 1.2)
        S.quad(wx0, wx1, zWb - 8, zWb, tim_s, 1.2)
        p.poly([(xm - pw / 2, y, PLINTH + 6), (xm + pw / 2, y, PLINTH + 6), (xm + pw / 2, y, zRb - 5), (xm - pw / 2, y, zRb - 5)], tim_s, 1.2)
        for sgn in (-1, 1):
            ua, ub = xm + sgn * (D * 0.4), xm + sgn * 0.08
            p.poly([(ua - 0.03, y, zWb), (ua + 0.03, y, zWb), (ub + 0.03, y, zWb + spec.rise * 0.75), (ub - 0.03, y, zWb + spec.rise * 0.75)],
                   tim_s, 1.0)
        return S

    def east_wall(ya, yb, zWb, tag='wall'):
        pw = 0.11
        E = PlaneE(p, wx1)
        p.poly([(wx1, ya, PLINTH), (wx1, yb, PLINTH), (wx1, yb, zWb), (wx1, ya, zWb)], mul(PLASTER, K_RIGHT), 1.5, tag=tag)
        E.quad(ya, yb, zWb - 9, zWb, mul(PLASTER, K_RIGHT * K_BAND), 0.8)
        E.quad(yb - pw, yb, PLINTH, zWb, tim_e, 1.2)
        E.quad(ya, ya + pw, PLINTH, zWb, tim_e, 1.2)
        E.quad(ya, yb, PLINTH, PLINTH + 6, tim_e, 1.2)
        E.quad(ya, yb, zWb - 6, zWb, tim_e, 1.2)
        return E

    # ---------------- main block walls (the gable that faces the viewer is the block's +y wall; with a wing it is
    # the wall's upper part above the wing's roof, drawn complete and symmetric all the same)
    S_main = gable_wall(wm, zW, zR)
    E_main = east_wall(wy0, wm, zW)
    vbox('wall-main', 'house', wx0, wx1, wy0, wm, PLINTH, zW)
    spots = []
    if wing:
        S_main  # the wing sits in front of the main gable
        # wing walls
        S_wing = gable_wall(wy1, zWw, zRw)
        E_wing = east_wall(wm, wy1, zWw)
        vbox('wall-wing', 'house', wx0, wx1, wm, wy1, PLINTH, zWw)
    else:
        S_wing, E_wing = S_main, E_main

    # ---------------- door (always on the south end of the east wall)
    Ed = E_wing
    Ed.quad(ds0 - fr, ds1 + fr, PLINTH, dz1 + LINTEL, tim_e, 1.2)
    Ed.quad(ds0, ds1, PLINTH, dz1, DARK, 1.0)
    dm = (ds0 + ds1) / 2
    for a, b in ((ds0 + 0.03, dm - 0.015), (dm + 0.015, ds1 - 0.03)):
        Ed.quad(a, b, PLINTH + 2, dz1 - 2, mul(WOOD, K_RIGHT), 0.9)
        for f in (1 / 3.0, 2 / 3.0):
            Ed.line(a + (b - a) * f, PLINTH + 2, a + (b - a) * f, dz1 - 2, 0.8)
        Ed.line(a, PLINTH + DOOR_H * 0.5, b, PLINTH + DOOR_H * 0.5, 0.8)
    Ed.quad(ds0 - fr - 0.02, ds1 + fr + 0.02, dz1 + LINTEL, dz1 + LINTEL + 3, tim_e, 1.0)
    free_y0, free_y1 = (wm if wing else wy0) + 0.11, ds0 - fr      # stretch of east wall north of the door
    wzW = zWw if wing else zW

    # ---------------- windows on the east wall, gable windows
    def east_windows(ya, yb, n, wwid, sill=32.0, top=70.0):
        if n <= 0:
            return
        gap = ((yb - ya) - n * (wwid + 0.26)) / max(n, 1)
        for k in range(n):
            u0 = ya + 0.13 + 0.06 + k * (wwid + 0.26 + max(gap, 0.0)) + max(gap, 0.0) / 2
            window(Ed if not wing else E_wing, u0, u0 + wwid, PLINTH + sill, PLINTH + top, tim_e)

    bay_a = bay_b = None
    if spec.kind == 'dwelling':
        usable = free_y1 - free_y0
        wwid = 0.36 if usable < 1.6 else 0.46
        east_windows(free_y0, free_y1, spec.nwindows, wwid)
    else:
        bw = spec.bay
        # the shop bay sits north of the door (round 3's arrangement) with a 0.2 margin from the door frame
        if wing:
            by0, by1 = wy0 + 0.30, wm - 0.15            # on the main block
            bay_a, bay_b = by0, by1
            Eb = E_main
        else:
            bay_b = free_y1 - 0.12
            bay_a = bay_b - bw
            Eb = E_main
        bay_h = 66.0 if not wing else 66.0
        Eb.quad(bay_a - 0.05, bay_b + 0.05, PLINTH, PLINTH + 70, tim_e, 1.2)
        Eb.quad(bay_a, bay_b, PLINTH, PLINTH + bay_h, DARK, 1.0)
        for sv in (28, 48):
            Eb.quad(bay_a + 0.03, bay_b - 0.03, PLINTH + sv, PLINTH + sv + 4, mul(WOOD, K_RIGHT), 0.9)
            nj = int((bay_b - bay_a) // 0.22)
            for j in range(nj):
                uc = bay_a + 0.14 + j * ((bay_b - bay_a - 0.28) / max(nj - 1, 1))
                Eb.quad(uc - 0.04, uc + 0.04, PLINTH + sv + 4, PLINTH + sv + 13 - (j % 2) * 3, mul(CLAY, K_RIGHT), 0.9)
        Eb.quad(bay_a - 0.05, bay_a, PLINTH, PLINTH + 76, tim_e, 1.0)
        Eb.quad(bay_b, bay_b + 0.05, PLINTH, PLINTH + 76, tim_e, 1.0)
        # counter, in front of the bay on the plinth ledge (plinth top 18)
        p.box(wx1 + 0.02, wx1 + 0.25, bay_a + 0.04, bay_b - 0.04, PLINTH, PLINTH + 24, WOOD, 1.3)
        p.line([(wx1 + 0.25, bay_a + 0.04, PLINTH + 15), (wx1 + 0.25, bay_b - 0.04, PLINTH + 15)], 1.0)
        # awning, clearly sloped; its drop clears a 86 px figure on the ledge
        ax = wx1 + 0.38
        top_z = zW - 14
        lip_z = top_z - 26
        p.poly([(wx1, bay_a - 0.1, top_z), (wx1, bay_b + 0.1, top_z), (ax, bay_b + 0.1, lip_z), (ax, bay_a - 0.1, lip_z)],
               mul(AWNING, K_ROOF_NEAR), 1.5)
        nb = 6
        for k in range(1, nb):
            yy = (bay_a - 0.1) + (bay_b - bay_a + 0.2) * k / nb
            p.line([(wx1, yy, top_z), (ax, yy, lip_z)], 1.0)
        p.poly([(ax, bay_b + 0.1, lip_z - 8), (ax, bay_a - 0.1, lip_z - 8), (ax, bay_a - 0.1, lip_z), (ax, bay_b + 0.1, lip_z)],
               mul(AWNING, K_RIGHT), 1.3)
        p.poly([(wx1, bay_b + 0.1, top_z), (ax, bay_b + 0.1, lip_z), (ax, bay_b + 0.1, lip_z - 8), (wx1, bay_b + 0.1, top_z - 8)],
               mul(AWNING, K_LEFT * 0.9), 1.2)
        for yy in (bay_a - 0.07, bay_b + 0.05):
            p.box(ax - 0.035, ax + 0.025, yy, yy + 0.06, PLINTH, lip_z - 8, TIMBER, 1.2)
        vbox('awning', 'roof', wx1, ax, bay_a - 0.1, bay_b + 0.1, lip_z - 8, top_z, density=0.45)
        p.bay = (bay_a, bay_b)
        # a window beside the door on the stretch between the bay and the door when the wall allows
        if not wing:
            room = free_y1 - bay_b - 0.05
            if room > 0.5:
                pass
        else:
            # the wing's east wall has the door; a window north of it
            room_a, room_b = wm + 0.11, ds0 - fr
            if room_b - room_a > 0.7:
                u0 = (room_a + room_b) / 2 - 0.2
                window(E_wing, u0, u0 + 0.4, PLINTH + 32, PLINTH + 70, tim_e)

    # gable windows (+y faces)
    window(S_wing, xm - 0.28, xm + 0.28, PLINTH + 34, PLINTH + 70, tim_s)
    if wing:
        # the main block's gable shows above the wing roof: a small high window
        window(S_main, xm - 0.18, xm + 0.18, zWw + spec.wing_rise + 10, zWw + spec.wing_rise + 38, tim_s, shutters=False)

    # ---------------- household dressing on the plinth ledges (small, never above the door's lintel)
    zL = PLINTH
    xl0, xl1 = wx1 + 0.07, w - 0.05
    ySB = wy1 + 0.1
    if spec.household == 'jars':
        ledge_jar(p, xl0 + 0.12, free_y0 + 0.14, zL, 1.1)
        ledge_jar(p, xl0 + 0.14, free_y0 + 0.46, zL, 0.8)
        ledge_jar(p, xm - 0.55, ySB, zL, 0.8)
        lantern(p, wx1, ds1 + fr + 0.06, dz1 + LINTEL)
        spots = ['east ledge, north end: two jars', 'south ledge: lidded jar', 'door side: lantern on a bracket']
    elif spec.household == 'barrel':
        barrel(p, w - 0.18, d - 0.12, zL)
        bench(p, wx0 + 0.25, wx0 + 1.1, wy1 + 0.04, wy1 + 0.17, zL)
        lantern(p, wx1, ds1 + fr + 0.06, dz1 + LINTEL)
        spots = ['SE corner: rain barrel', 'south ledge: bench', 'door side: lantern on a bracket']
    elif spec.household == 'wood':
        firewood(p, xl0, free_y0 + 0.05, 0.26, 0.55, zL, rows=3, cols=5)
        nb_u = ds0 - fr - 0.2
        Ed.quad(nb_u - 0.17, nb_u + 0.17, PLINTH + 60, PLINTH + 82, mul(WOOD, K_RIGHT * 1.15), 1.4)
        Ed.quad(nb_u - 0.14, nb_u + 0.14, PLINTH + 64, PLINTH + 78, mul(PLASTER, K_RIGHT), 1.0)
        spots = ['east ledge, north end: firewood stack', 'name board beside the door', 'porch roof over the door']
    else:
        crate(p, xl0, bay_a - 0.35 if bay_a else free_y0, 0.24, 0.26, zL, 16)
        crate(p, xl0 + 0.02, (bay_a - 0.35 if bay_a else free_y0) - 0.0, 0.2, 0.22, zL + 16, 13)
        crate(p, wx0 + 0.3, wy1 + 0.03, 0.30, 0.18, zL, 16)
        spots = ['east ledge, north end: stacked crates', 'south ledge: crate', 'shop bay with awning']
    p.spots = spots

    # porch roof (woodcutter): a timber-and-tile lean-to over the door on two posts
    if spec.porch_roof:
        pa0, pa1 = ds0 - fr - 0.12, ds1 + fr + 0.12
        ax = wx1 + 0.42
        top_z = wzW - 12
        lip_z = top_z - 24
        p.poly([(wx1, pa0, top_z), (wx1, pa1, top_z), (ax, pa1, lip_z), (ax, pa0, lip_z)], mul(roofcol, K_ROOF_NEAR), 1.5)
        for k in range(1, 6):
            yy = pa0 + (pa1 - pa0) * k / 6
            p.line([(wx1, yy, top_z), (ax, yy, lip_z)], 1.0)
        p.poly([(ax, pa1, lip_z - 5), (ax, pa0, lip_z - 5), (ax, pa0, lip_z), (ax, pa1, lip_z)], mul(TIMBER, K_RIGHT), 1.3)
        p.poly([(wx1, pa1, top_z), (ax, pa1, lip_z), (ax, pa1, lip_z - 5), (wx1, pa1, top_z - 5)], mul(TIMBER, K_LEFT), 1.2)
        for yy in (pa0 + 0.0, pa1 - 0.06):
            p.box(ax - 0.035, ax + 0.025, yy, yy + 0.06, PLINTH if yy else PLINTH, lip_z - 5, TIMBER, 1.2)
        vbox('porch-roof', 'roof', wx1, ax, pa0, pa1, lip_z - 5, top_z)

    # =========================================================== roofs
    def roof(b, south_overhang=True, north_overhang=True):
        y0b, y1b, zWb, zRb = b['y0'], b['y1'], b['zW'], b['zR']
        ry0 = y0b - (OVH_S if north_overhang else 0.0)
        ry1 = y1b + (OVH_S if south_overhang else 0.0)
        rx0, rx1 = wx0 - OVH_W, wx1 + OVH_E
        h = D / 2.0
        pitch = (zRb - zWb) / h
        zT = zWb - pitch * OVH_E
        zTw = zWb - pitch * OVH_W

        def kick(y):
            e = min(y - ry0, ry1 - y)
            return KICK * max(0.0, 1.0 - e / KICK_LEN) ** 2

        nseg = max(2, int(round((ry1 - ry0) / 0.1)))
        ys = [ry0 + (ry1 - ry0) * i / nseg for i in range(nseg + 1)]
        # far (west) slope, drawn first: the ridge to the eave tip, with the same corner kick
        fcol = mul(roofcol, K_ROOF_FAR)
        for a, bq in zip(ys[:-1], ys[1:]):
            p.poly([(xm, a, zRb), (xm, bq, zRb), (rx0, bq, zTw + kick(bq)), (rx0, a, zTw + kick(a))], fcol, 0, edge=False, tag='roofw')
        p.line([(xm, ry0, zRb), (rx0, ry0, zTw + kick(ry0))], 1.2)
        p.line([(xm, ry1, zRb), (rx0, ry1, zTw + kick(ry1))], 1.2)
        p.line([(rx0, y, zTw + kick(y)) for y in ys], 1.4)
        n_rib = int(round((ry1 - ry0) / 0.2))
        for j in range(1, n_rib):
            y = ry0 + j * (ry1 - ry0) / n_rib
            p.line([(xm, y, zRb), (rx0, y, zTw + kick(y))], 0.9)
        for f in (0.33, 0.66):
            x = xm + (rx0 - xm) * f
            p.line([(x, ry0 + 0.0, zRb + (zTw - zRb) * f), (x, ry1, zRb + (zTw - zRb) * f)], 0.9)
        # near (east) slope
        rcol = mul(roofcol, K_ROOF_NEAR)
        for a, bq in zip(ys[:-1], ys[1:]):
            p.poly([(xm, a, zRb), (xm, bq, zRb), (rx1, bq, zT + kick(bq)), (rx1, a, zT + kick(a))], rcol, 0, edge=False, tag='roof')
        p.line([(xm, ry0, zRb), (rx1, ry0, zT + kick(ry0))], 1.2)
        p.line([(xm, ry1, zRb), (rx1, ry1, zT + kick(ry1))], 1.2)
        p.line([(rx1, y, zT + kick(y)) for y in ys], 1.5)
        for j in range(1, n_rib):
            y = ry0 + j * (ry1 - ry0) / n_rib
            p.line([(xm, y, zRb), (rx1, y, zT + kick(y))], 0.9)
        for f in (0.2, 0.4, 0.6, 0.8):
            x = xm + (rx1 - xm) * f
            p.line([(x, ry0, zRb + (zT - zRb) * f), (x, ry1, zRb + (zT - zRb) * f)], 0.9)
        # fascia + rafter ends under the east eave
        fcl = mul(mul(roofcol, K_BAND), K_RIGHT / K_LEFT * 1.1)
        for a, bq in zip(ys[:-1], ys[1:]):
            p.poly([(rx1, a, zT + kick(a) - RAFTER), (rx1, bq, zT + kick(bq) - RAFTER), (rx1, bq, zT + kick(bq)), (rx1, a, zT + kick(a))],
                   fcl, 0, edge=False, tag='roof')
        p.line([(rx1, y, zT + kick(y) - RAFTER) for y in ys], 1.3)
        n_raf = int((ry1 - ry0 - 0.2) / 0.125)
        for j in range(n_raf + 1):
            y = ry0 + 0.1 + j * 0.125
            disc_e(p, rx1, y, zT + kick(y) - RAFTER - 3.4, 2.6, mul(WOOD, 1.2), 1.0)
        # verge (barge) board at the south end, following the roof line, symmetric about the ridge
        path = [(rx0, zTw + kick(ry1)), (wx0, zWb), (xm, zRb), (wx1, zWb), (rx1, zT + kick(ry1))]
        vb = RAFTER + 2
        if south_overhang:
            p.poly([(x, ry1, z) for x, z in path] + [(x, ry1, z - vb) for x, z in reversed(path)], mul(TIMBER, K_LEFT), 1.5)
        else:
            p.poly([(x, ry1, z) for x, z in path] + [(x, ry1, z - 3) for x, z in reversed(path)], mul(TIMBER, K_LEFT), 1.2)
        # ridge cap: a beam, a row of ridge tiles standing on it, and a stepped ornament at the south end
        p.box(xm - 0.075, xm + 0.075, ry0 - 0.02, ry1 + 0.02, zRb, zRb + 7, mul(roofcol, 0.85), 1.5)
        nt = int((ry1 - ry0 - 0.5) / 0.2)
        for j in range(nt):
            ya = ry0 + 0.25 + j * ((ry1 - ry0 - 0.5) / nt)
            p.box(xm - 0.09, xm + 0.09, ya, ya + 0.16, zRb + 7, zRb + 14, mul(roofcol, 1.0), 1.2)
        for ya, yb in (((ry1 - 0.14, ry1 + 0.04),) if south_overhang else ()):
            p.box(xm - 0.1, xm + 0.1, ya, yb, zRb, zRb + 14, mul(TIMBER, 1.15), 1.4)
            p.box(xm - 0.07, xm + 0.07, ya + 0.015, yb - 0.015, zRb + 14, zRb + 24, mul(TIMBER, 1.25), 1.3)
            p.box(xm - 0.105, xm + 0.105, ya - 0.005, yb + 0.005, zRb + 24, zRb + 29, mul(roofcol, 1.0), 1.3)
        vols.append(dict(id=f'roof-{b["name"]}', kind='roof', eave=[round(rx0, 3), round(rx1, 3), round(ry0, 3), round(ry1, 3)],
                         xm=round(xm, 3), zW=round(zWb, 2), zR=round(zRb, 2), zT=round(zT, 2), beam=14))
        return dict(rx0=rx0, rx1=rx1, ry0=ry0, ry1=ry1, zT=zT, zTw=zTw, pitch=pitch)

    if wing:
        rm = roof(blocks[0], south_overhang=False, north_overhang=True)
        rw = roof(blocks[1], south_overhang=True, north_overhang=False)
        p.rg = dict(main=rm, wing=rw)
    else:
        rm = roof(blocks[0])
        p.rg = dict(main=rm)

    # ---------------- chimney / vent (after the roof: it stands on it)
    def zroof(xx, zWb, zRb):
        return zRb - (zRb - zWb) * abs(xx - xm) / (D / 2.0)

    if spec.chimney == 'ridge':
        cy0, cy1 = wy0 + 0.35, wy0 + 0.65
        cx0, cx1 = xm - 0.13, xm + 0.13
        zb_e, zb_w = zroof(cx1, zW, zR), zroof(cx0, zW, zR)
        # the south and east faces rise from the roof; the south face's foot follows the two slopes
        p.poly([(cx0, cy1, zb_w), (xm, cy1, zR), (cx1, cy1, zb_e), (cx1, cy1, zR + 46), (cx0, cy1, zR + 46)], mul(STONE, K_LEFT * 1.05), 1.4)
        p.poly([(cx1, cy0, zb_e), (cx1, cy1, zb_e), (cx1, cy1, zR + 46), (cx1, cy0, zR + 46)], mul(STONE, K_RIGHT * 1.05), 1.4)
        p.box(cx0 - 0.03, cx1 + 0.03, cy0 - 0.03, cy1 + 0.03, zR + 46, zR + 52, mul(STONE, 1.1), 1.4)
        p.box(cx0 + 0.04, cx1 - 0.04, cy0 + 0.04, cy1 - 0.04, zR + 52, zR + 54, DARK, 1.0)
        vbox('chimney', 'prop', cx0, cx1, cy0, cy1, zR, zR + 54)
    elif spec.chimney == 'vent':
        # a small roof lantern on the ridge: a box with its own flat cap, for a shop that ventilates its stock
        vy0, vy1 = wy0 + 0.75, wy0 + 1.25
        vx0, vx1 = xm - 0.15, xm + 0.15
        p.box(vx0, vx1, vy0, vy1, zR + 6, zR + 26, mul(PLASTER, 1.0), 1.4)
        S_ = PlaneS(p, vy1)
        S_.quad(vx0 + 0.05, vx1 - 0.05, zR + 10, zR + 22, DARK, 1.0)
        for k in range(1, 4):
            S_.line(vx0 + 0.05, zR + 10 + 3 * k, vx1 - 0.05, zR + 10 + 3 * k, 0.8)
        p.box(vx0 - 0.06, vx1 + 0.06, vy0 - 0.06, vy1 + 0.06, zR + 26, zR + 33, mul(roofcol, 1.0), 1.4)
        vbox('roof-vent', 'prop', vx0, vx1, vy0, vy1, zR + 6, zR + 33)
    elif spec.chimney == 'wing':
        # a stack against the main block's south gable, standing on the wing's roof
        cx0, cx1 = xm - 0.14 + 0.35, xm + 0.14 + 0.35
        cy0, cy1 = wm + 0.02, wm + 0.30
        zb = zroof(cx1, zWw, zRw)
        p.poly([(cx0, cy1, zroof(cx0, zWw, zRw)), (cx1, cy1, zb), (cx1, cy1, zW + 30), (cx0, cy1, zW + 30)], mul(STONE, K_LEFT * 1.05), 1.4)
        p.poly([(cx1, cy0, zb), (cx1, cy1, zb), (cx1, cy1, zW + 30), (cx1, cy0, zW + 30)], mul(STONE, K_RIGHT * 1.05), 1.4)
        p.box(cx0 - 0.03, cx1 + 0.03, cy0 - 0.03, cy1 + 0.03, zW + 30, zW + 36, mul(STONE, 1.1), 1.4)
        p.box(cx0 + 0.04, cx1 - 0.04, cy0 + 0.04, cy1 - 0.04, zW + 36, zW + 38, DARK, 1.0)
        vbox('chimney', 'prop', cx0, cx1, cy0, cy1, zroof(cx0, zWw, zRw), zW + 38)


    # ---------------- everything stays inside the footprint (a cap or post a hair over the edge is clamped to it)
    def cl(q):
        return (min(max(q[0], 0.0), float(w)), min(max(q[1], 0.0), float(d)), q[2])

    p.ops = [(op[0], [cl(q) for q in op[1]]) + tuple(op[2:]) for op in p.ops]

    # ---------------- bookkeeping
    p.door = dict(face='east (+x)', door_y=(round(ds0, 3), round(ds1, 3)), steps_x=(round(land, 3), x1p), steps_y=(round(st_y0, 3), round(st_y1, 3)),
                  faces_tile=(w, int(d - 1)), steps_tile=(w - 1, int(d - 1)))
    p.geo = dict(wx0=wx0, wx1=wx1, wy0=wy0, wy1=wy1, xm=xm, zW=zW, zR=zR, px0=px0, wm=wm, zWw=zWw, zRw=zRw,
                 ry0=rm['ry0'], ry1=(p.rg['wing']['ry1'] if wing else rm['ry1']), rx0=rm['rx0'], rx1=rm['rx1'], zT=rm['zT'])
    p.notes.append(f'depth {D} rise {spec.rise} pitch {spec.rise / (D / 2):.1f} px/tile; far-slope band {band_px(D, spec.rise):.1f} world px')
    return p


# ---------------------------------------------------------------- yards
def contents(p, spec, ya0, ya1, yb0, yb1, vbox):
    """The household's things, inside the yard's interior x ya0..ya1, y yb0..yb1, standing on the earth at z = 3."""
    z = 3.0
    hh = spec.household
    w = ya1 - ya0
    if hh == 'jars':
        # basin (back), drying bench along the west wall with pots, kiln near the plinth, a few pots on the ground
        p.box(ya0 + 0.08, ya0 + 0.58, yb0 + 0.10, yb0 + 0.50, z, z + 12, mul(STONE, 1.0), 1.3, tag='yard')
        p.poly([(ya0 + 0.12, yb0 + 0.14, z + 10), (ya0 + 0.54, yb0 + 0.14, z + 10), (ya0 + 0.54, yb0 + 0.46, z + 10), (ya0 + 0.12, yb0 + 0.46, z + 10)],
               WATER, 1.0, tag='yard')
        vbox('basin', 'prop', ya0 + 0.08, ya0 + 0.58, yb0 + 0.10, yb0 + 0.50, z, z + 12)
        bench(p, ya0 + 0.08, ya0 + 0.34, yb0 + 0.75, yb0 + 1.75, z)
        for k in range(4):
            ledge_jar(p, ya0 + 0.21, yb0 + 0.86 + 0.24 * k, z + 15, 0.55)
        vbox('drying-bench', 'prop', ya0 + 0.08, ya0 + 0.34, yb0 + 0.75, yb0 + 1.75, z, z + 42)
        kx, ky, kr = min(ya1 - 0.40, ya0 + 0.95), yb1 - 0.62, 0.28
        prism(p, kx, ky, kr, kr * 0.9, z, z + 26, mul(CLAY, 1.05), 14, hoops=(0.5,), topcol=mul(CLAY, 1.1))
        prism(p, kx, ky, kr * 0.9, kr * 0.45, z + 26, z + 42, mul(CLAY, 0.95), 14, topcol=mul(DARK, 1.4))
        # firing mouth on the south face: a dark arch and a lintel stone
        a0, a1 = kx - 0.09, kx + 0.09
        yy = ky + kr * 0.9 * 0.72
        p.poly([(a0, yy, z), (a1, yy, z), (a1, yy, z + 11), ((a0 + a1) / 2, yy, z + 15), (a0, yy, z + 11)], DARK, 1.0, tag='yard')
        prism(p, kx, ky, 0.07, 0.07, z + 42, z + 62, mul(CLAY, 0.9), 10)
        vbox('kiln', 'prop', kx - kr, kx + kr, ky - kr * 0.8, ky + kr * 0.8, z, z + 42)
        vbox('kiln-flue', 'prop', kx - 0.07, kx + 0.07, ky - 0.07, ky + 0.07, z + 42, z + 62)
        for (px, py, s) in ((ya0 + 0.62, yb1 - 0.28, 1.0), (ya0 + 0.78, yb1 - 0.20, 0.8)):
            ledge_jar(p, px, py, z, s)
    elif hh == 'wood':
        # log stack along the west wall, sawhorse in the middle, chopping block with an axe near the gate
        firewood(p, ya0 + 0.04, yb0 + 0.5, 0.30, 1.35, z, rows=4, cols=8)
        vbox('log-stack', 'prop', ya0 + 0.04, ya0 + 0.34, yb0 + 0.5, yb0 + 1.85, z, z + 29)
        # sawhorse along x: two A-frame ends joined by a beam, a log on it
        sy0, sy1 = yb0 + 2.05, yb0 + 2.4
        sx0, sx1 = ya0 + 0.46, ya0 + 1.02
        for sx in (sx0 + 0.03, sx1 - 0.03):
            beam(p, (sx, sy0 + 0.02, z), (sx, sy0 + 0.17, z + 24), 0.04, mul(WOOD, 0.9), 1.1)
            beam(p, (sx, sy1 - 0.02, z), (sx, sy1 - 0.17, z + 24), 0.04, mul(WOOD, 0.9), 1.1)
        p.box(sx0, sx1, sy0 + 0.13, sy1 - 0.13, z + 22, z + 27, WOOD, 1.2)
        p.box(sx0 - 0.05, sx1 + 0.05, sy0 + 0.12, sy0 + 0.22, z + 27, z + 33, mul(LOG, 1.05), 1.2)
        vbox('sawhorse', 'prop', sx0, sx1, sy0, sy1, z, z + 33)
        # chopping block, an axe in its top
        bx, by = ya0 + 0.78, yb1 - 0.40
        prism(p, bx, by, 0.15, 0.14, z, z + 20, mul(LOG, 1.0), 12, topcol=mul(LOG, 1.25))
        p.line([(bx - 0.02, by, z + 20), (bx - 0.06, by, z + 46)], 2.0)
        p.box(bx - 0.10, bx - 0.02, by - 0.015, by + 0.015, z + 40, z + 46, mul((150, 150, 150), 1.0), 1.0)
        vbox('chopping-block', 'prop', bx - 0.15, bx + 0.15, by - 0.12, by + 0.12, z, z + 20)
        # a heap of split logs on the ground
        for k in range(3):
            p.box(ya0 + 0.42 + 0.12 * k, ya0 + 0.52 + 0.12 * k, yb0 + 0.6 + 0.05 * k, yb0 + 0.9 + 0.03 * k, z, z + 6, mul(LOG, 1.1), 1.0)
    elif hh == 'barrel':
        # cart (Gao's handcart), barrels, a stack of stock sacks: a market garden's cart yard
        cx0, cx1 = ya0 + 0.06, ya0 + 0.78
        cy0, cy1 = yb1 - 1.0, yb1 - 0.52
        R = 18
        wheel(p, cx0 + 0.45, cy0 - 0.02, z + R, R, mul(WOOD, 1.0), thick=0.045)
        p.box(cx0, cx1, cy0, cy1, z + 20, z + 24, mul(WOOD, 1.0), 1.4)
        p.box(cx0, cx1, cy0, cy0 + 0.03, z + 24, z + 36, mul(WOOD, 0.95), 1.3)
        p.box(cx0, cx0 + 0.03, cy0, cy1, z + 24, z + 36, mul(WOOD, 0.9), 1.3)
        sackp(p, cx0 + 0.25, (cy0 + cy1) / 2, z + 24, 0.9)
        sackp(p, cx0 + 0.5, (cy0 + cy1) / 2 + 0.03, z + 24, 0.8)
        p.box(cx0, cx1, cy1 - 0.03, cy1, z + 24, z + 36, mul(WOOD, 1.0), 1.3)
        wheel(p, cx0 + 0.45, cy1, z + R, R, mul(WOOD, 1.05), thick=0.045)
        beam(p, (cx1, (cy0 + cy1) / 2 - 0.1, z + 26), (cx1 + 0.22, (cy0 + cy1) / 2 - 0.1, z + 4), 0.035, mul(WOOD, 0.95), 1.1)
        vbox('cart', 'prop', cx0, cx1 + 0.2, cy0, cy1, z, z + 36)
        for (bx, by) in ((ya0 + 0.20, yb0 + 0.22), (ya0 + 0.50, yb0 + 0.28), (ya0 + 0.80, yb0 + 0.24)):
            barrel_big(p, bx, by, z, 0.1, 30)
            vbox('barrel', 'prop', bx - 0.1, bx + 0.1, by - 0.08, by + 0.08, z, z + 30)
        crate(p, ya0 + 0.08, yb0 + 0.62, 0.30, 0.30, z, 16)
        crate(p, ya0 + 0.12, yb0 + 0.66, 0.22, 0.24, z + 16, 13)
        vbox('stock', 'prop', ya0 + 0.08, ya0 + 0.38, yb0 + 0.62, yb0 + 0.92, z, z + 29)
    else:  # crates: a hay-cart and stacked stock
        cx0, cx1 = ya0 + 0.06, ya0 + 0.70
        cy0, cy1 = yb1 - 0.95, yb1 - 0.5
        R = 18
        wheel(p, cx0 + 0.42, cy0 - 0.02, z + R, R, mul(WOOD, 1.0), thick=0.045)
        p.box(cx0, cx1, cy0, cy1, z + 20, z + 24, mul(WOOD, 1.0), 1.4)
        p.box(cx0, cx1, cy0, cy0 + 0.03, z + 24, z + 34, mul(WOOD, 0.95), 1.3)
        p.box(cx0, cx0 + 0.03, cy0, cy1, z + 24, z + 34, mul(WOOD, 0.9), 1.3)
        p.box(cx0 + 0.04, cx1 - 0.03, cy0 + 0.03, cy1 - 0.03, z + 24, z + 38, mul(HAY, 1.0), 1.3)
        p.box(cx0, cx1, cy1 - 0.03, cy1, z + 24, z + 34, mul(WOOD, 1.0), 1.3)
        wheel(p, cx0 + 0.42, cy1, z + R, R, mul(WOOD, 1.05), thick=0.045)
        vbox('cart', 'prop', cx0, cx1, cy0, cy1, z, z + 38)
        for k, (bx, by) in enumerate(((ya0 + 0.12, yb0 + 0.2), (ya0 + 0.46, yb0 + 0.2))):
            crate(p, bx, by, 0.28, 0.28, z, 17)
            crate(p, bx + 0.02, by + 0.01, 0.24, 0.25, z + 17, 14) if k == 0 else None
            vbox('crate', 'prop', bx, bx + 0.28, by, by + 0.28, z, z + (31 if k == 0 else 17))
        barrel_big(p, ya0 + 0.2, yb0 + 0.85, z, 0.1, 30)
        vbox('barrel', 'prop', ya0 + 0.1, ya0 + 0.3, yb0 + 0.77, yb0 + 0.93, z, z + 30)
        sackp(p, ya0 + 0.55, yb0 + 0.85, z, 0.9)
        sackp(p, ya0 + 0.62, yb0 + 1.05, z, 0.8)


def all_houses():
    return [house(s) for s in SPECS]
