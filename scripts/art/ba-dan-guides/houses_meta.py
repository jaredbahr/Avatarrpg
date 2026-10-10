"""What `guides/pieces.json` records about the four houses beyond the other pieces: the scene entry each stands for, its
proportions and yard, the walkable cells inside its footprint, and the light volumes `ba-dan-houses.ts` turns into the
baked shadow and contact.  Called by `build.py`; the review sheets are `houses_review.py`.  PIL + numpy only."""
import math, os, re
import numpy as np
from PIL import Image, ImageDraw

import guidelib as GL
import houses as H

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SC = GL.SC
# the scene entry each house is placed by (src/content/scenes/baDan.ts): id, footprint origin
PLACE = {'dwelling-4x3': ('north-house', 12, 1), 'merchant-house-4x3': ('gao-house', 6, 1),
         'dwelling-4x4': ('southwest-house', 6, 10), 'merchant-house-4x4': ('southeast-house', 13, 10)}
# the game's figure: a 128 x 192 frame is drawn at 1.45 tiles per 128 px, a tile being 64 px wide on the board's axis
FIG_SCALE = 1.45 * 64.0 / 128.0          # 0.725 scene px per atlas px
FIG_FEET = 0.85                           # feet at 85% of the frame height
FIG_H = 86.0                              # the figure's own height in scene px (118 atlas px)


def village_rows():
    txt = open(os.path.join(ROOT, 'src', 'content', 'maps', 'village.ts'), encoding='utf-8').read()
    m = re.search(r"rows: \[(.*?)\]\.map", txt, re.S)
    return re.findall(r"'([^']{24})'", m.group(1))


def notches(rows, x0, y0, w, d):
    """Footprint cells of a house that are not blocked in the map's rows: local (i, j) and the map cell."""
    out = []
    for j in range(d):
        for i in range(w):
            ch = rows[y0 + j][x0 + i]
            if ch not in 'B':
                out.append({'local': [i, j], 'map': [x0 + i, y0 + j], 'tile': ch})
    return out


def to_canvas(p, q):
    z = GL.proj(q)
    return (z[0] - p._F[0] + p.anchor[0], z[1] - p._F[1] + p.anchor[1])


def band_measure(p):
    """Far slope's visible band: at the screen column through the middle of the main ridge, rows of the far-slope mask above
    the topmost near-slope row.  Returns (guide px, world px)."""
    g = p.geo
    ym = (g['ry0'] + (g['wm'] if p.spec.wing else g['ry1'])) / 2.0
    c = int(round(to_canvas(p, (g['xm'], ym, g['zR']))[0]))
    far = np.nonzero(p.tagmask['roofw'][:, c])[0]
    near = np.nonzero(p.tagmask['roof'][:, c])[0]
    return int(near.min() - far.min()), (near.min() - far.min()) / SC


def yard_visible_fraction(p):
    """Share of the yard rectangle's ground that the house's own drawing does not cover on screen (the yard is on the
    west tiles, so the house hides part of it: what the player sees of it is this share)."""
    W, Hh = p.size
    yard = Image.new('L', (W * 2, Hh * 2), 0)
    house = Image.new('L', (W * 2, Hh * 2), 0)
    y = p.yard
    quad = [to_canvas(p, (x, yy, 3.0)) for x, yy in ((0, 0), (y['x'][1], 0), (y['x'][1], p.d), (0, p.d))]
    ImageDraw.Draw(yard).polygon([(a * 2, b * 2) for a, b in quad], fill=255)
    hd = ImageDraw.Draw(house)
    for op in p.ops[p.yard_ops_end:]:
        if op[0] == 'poly':
            hd.polygon([(a * 2, b * 2) for a, b in (to_canvas(p, q) for q in op[1])], fill=255)
    ya, ha = np.asarray(yard) > 0, np.asarray(house) > 0
    return float((ya & ~ha).sum() / max(1, ya.sum()))


def house_meta(p, rows, audit):
    """The `pieces.json` entry of a house; `audit` is build.py's, shared with every other piece."""
    sid, mx, my = PLACE[p.name]
    notch = notches(rows, mx, my, p.w, p.d)
    gb, gw_ = band_measure(p)
    sp = p.spec
    return {
        'scene_entry': sid, 'footprint_origin_map': [mx, my], 'footprint_tiles': [p.w, p.d],
        'canvas': list(p.size), 'world_scale': SC, 'scene_draw_scale': round(1 / SC, 6),
        'anchor_front_corner_px': list(p.anchor),
        'anchor_front_corner_at_scene_scale_px': [round(p.anchor[0] / SC, 2), round(p.anchor[1] / SC, 2)],
        'canvas_at_scene_scale': [round(p.size[0] / SC, 1), round(p.size[1] / SC, 1)],
        'foot_polygon_px': [list(v) for v in p.foot_px], 'audit': audit, 'notes': p.notes,
        'door': p.door, 'household': p.household, 'dressing_spots': p.spots,
        'proportions': {
            'body_depth': sp.depth, 'half_span': sp.depth / 2, 'rise': sp.rise, 'pitch_px_per_tile': round(sp.rise / (sp.depth / 2), 2),
            'wall_h_above_plinth': sp.wall_h, 'plinth': H.PLINTH, 'step_risers': [H.STEP, H.STEP], 'door_clear': H.DOOR_H,
            'figure_h': FIG_H, 'plinth_over_figure': round(H.PLINTH / FIG_H, 3), 'door_over_figure': round(H.DOOR_H / FIG_H, 3),
            'far_band_world_px_formula': round(H.band_px(sp.depth, sp.rise), 2), 'far_band_guide_px_measured': gb,
            'far_band_world_px_measured': round(gw_, 2),
            'wing': {'length_y': sp.wing, 'eave_drop': sp.wing_drop, 'rise': sp.wing_rise} if sp.wing else None,
        },
        'yard': dict(p.yard, walkable_cells_in_footprint=notch, visible_fraction=round(yard_visible_fraction(p), 3)),
        'volumes': p.vols,
        'geo': {k: (round(v, 4) if isinstance(v, float) else v) for k, v in p.geo.items()},
    }
