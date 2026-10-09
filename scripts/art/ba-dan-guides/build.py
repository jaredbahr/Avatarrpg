"""Build every Ba Dan true-piece guide: the guide, the silhouette mask, the full footprint quad, and pieces.json.

    python scripts/art/ba-dan-guides/build.py [--sheets DIR]

PIL + numpy only. Writes under art/source/ba-dan-true/guides/. `--sheets DIR` also lays the guides out on the three
1536x1024 painter sheets (sheet-a/b/c.png + .json) in DIR; those are the painter's input and are not tracked.
Guides are rendered at WORLD_SCALE = 1.5 output px per world px (the game draws these captures at 1.5 screen px per world px);
the scene draws each at 1/1.5 = 0.6667 of its pixel size to land at world scale."""
import json, math, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'art', 'source', 'ba-dan-true', 'guides'))
sys.path.insert(0, HERE)
import guidelib as GL  # noqa: E402
import pieces as PC  # noqa: E402
import dressing as DR  # noqa: E402
from meas import measure  # noqa: E402

SC = GL.SC
SHEET = (1536, 1024)
BG = (118, 134, 118, 255)

PIECES = PC.all_pieces()
DRESS = DR.all_dressing()   # set dressing, wall modules, terrace planter: guides and masks only, no painter sheets here


def zmax(p):
    return max(q[2] for op in p.ops for q in op[1])


def fit_slope(xs, ys):
    return float(np.polyfit(xs, ys, 1)[0])


def foot_raster_slopes(p):
    fm = p.foot_mask
    back, right, front, left = p.foot_px
    out = {}

    def edge(name, xa, xb, upper):
        xs, ys = [], []
        for c in range(int(math.ceil(min(xa, xb))) + 3, int(math.floor(max(xa, xb))) - 3):
            rows = np.nonzero(fm[:, c])[0]
            if len(rows):
                xs.append(c + 0.5)
                ys.append((rows.min() if upper else rows.max() + 1))
        out[name] = fit_slope(xs, ys) if len(xs) > 10 else None

    edge('front-left', left[0], front[0], False)
    edge('front-right', front[0], right[0], False)
    edge('back-left', back[0], left[0], True)
    edge('back-right', back[0], right[0], True)
    return out


def dilate(m, r=12, step=4):
    md = m.copy()
    for s in range(step, r + 1, step):
        md[s:, :] |= m[:-s, :]
        md[:-s, :] |= m[s:, :]
    m2 = md.copy()
    for s in range(step, r + 1, step):
        m2[:, s:] |= md[:, :-s]
        m2[:, :-s] |= md[:, s:]
    return m2


def make_sheet(group, fname, jname, sheet_dir):
    """Place pieces without overlapping opaque pixels (>= ~12 px apart): first free spot scanning top-left to bottom-right, then centre."""
    W, H = SHEET
    occ = np.zeros((H, W), bool)
    rects = {}
    for p in group:
        pw, ph = p.size
        m = np.asarray(p.guide.getchannel('A')) > 0
        m2 = dilate(m)
        found = None
        for y in range(10, H - ph - 9, 8):
            for x in range(10, W - pw - 9, 8):
                if not (occ[y:y + ph, x:x + pw] & m2).any():
                    found = (x, y)
                    break
            if found:
                break
        if not found:
            raise SystemExit('sheet layout failed for ' + p.name)
        x, y = found
        occ[y:y + ph, x:x + pw] |= m
        rects[p.name] = (x, y, pw, ph)
    xs0 = min(r[0] for r in rects.values()); xs1 = max(r[0] + r[2] for r in rects.values())
    ys0 = min(r[1] for r in rects.values()); ys1 = max(r[1] + r[3] for r in rects.values())
    dx, dy = (W - (xs1 - xs0)) // 2 - xs0, (H - (ys1 - ys0)) // 2 - ys0
    img = Image.new('RGBA', SHEET, BG)
    meta = {'sheet': fname, 'size': list(SHEET), 'world_scale': SC,
            'scale': f'1 world px = {SC} sheet px (draw each piece at {1 / SC:.4f} of its pixel size in the scene)', 'pieces': []}
    for p in group:
        x, y, w, h = rects[p.name]
        x, y = x + dx, y + dy
        img.alpha_composite(p.guide, (x, y))
        meta['pieces'].append({'name': p.name, 'file': f'{p.name}-guide.png', 'rect': [x, y, w, h],
                               'anchor_front_corner': [x + p.anchor[0], y + p.anchor[1]],
                               'foot_polygon': [[round(x + a, 2), round(y + b, 2)] for a, b in p.foot_px]})
    img.convert('RGB').save(os.path.join(sheet_dir, fname))
    json.dump(meta, open(os.path.join(sheet_dir, jname), 'w'), indent=1)
    return meta


def main():
    os.makedirs(OUT, exist_ok=True)
    sheets = sys.argv[sys.argv.index('--sheets') + 1] if '--sheets' in sys.argv else None
    meta = {}
    for p in PIECES + DRESS:
        p.render()
        p.guide.save(os.path.join(OUT, f'{p.name}-guide.png'))
        p.mask.save(os.path.join(OUT, f'{p.name}-mask.png'))
        fp = np.zeros(p.foot_mask.shape + (4,), np.uint8)
        fp[p.foot_mask] = (255, 0, 0, 255)
        Image.fromarray(fp, 'RGBA').save(os.path.join(OUT, f'{p.name}-footprint.png'))

    audit = {}
    for p in PIECES + DRESS:
        edges = p.axis_edges()
        horiz = [s for k, s in edges if k in 'xy']
        vert = [s for k, s in edges if k == 'v']
        probes = p.probe_slopes(min_len=60)
        audit[p.name] = {
            'analytic_edges': len(horiz), 'analytic_max_dev_from_0.5': max([abs(abs(s) - 0.5) for s in horiz] or [0.0]),
            'verticals': len(vert), 'verticals_max_dX': max([abs(v) for v in vert] or [0.0]),
            'raster_probe_edges': len(probes),
            'raster_probe_max_dev_from_0.5': max([abs(abs(s) - 0.5) for _, s in probes] or [0.0]),
            'raster_probe_slopes_abs_range': [min([abs(s) for _, s in probes] or [0.0]), max([abs(s) for _, s in probes] or [0.0])],
            'foot_raster_slopes': foot_raster_slopes(p), 'foot_outside_silhouette_px': p.foot_outside}

    d43, m43, d44, m44, t1, t2, t3, pl, pl2, br = PIECES
    if sheets:
        os.makedirs(sheets, exist_ok=True)
        d43, m43, d44, m44, t1, t2, t3, pl, pl2, br = PIECES
        make_sheet([d43, m43], 'sheet-a.png', 'sheet-a.json', sheets)
        make_sheet([d44, m44], 'sheet-b.png', 'sheet-b.json', sheets)
        make_sheet([t1, t2, t3, pl, pl2, br], 'sheet-c.png', 'sheet-c.json', sheets)

    for p in PIECES + DRESS:
        m = {'footprint_tiles': [p.w, p.d], 'canvas': list(p.size), 'world_scale': SC, 'scene_draw_scale': round(1 / SC, 6),
             'anchor_front_corner_px': list(p.anchor),
             'anchor_front_corner_at_scene_scale_px': [round(p.anchor[0] / SC, 2), round(p.anchor[1] / SC, 2)],
             'canvas_at_scene_scale': [round(p.size[0] / SC, 1), round(p.size[1] / SC, 1)],
             'foot_polygon_px': [list(v) for v in p.foot_px], 'audit': audit[p.name], 'notes': p.notes,
             'door': getattr(p, 'door', None)}
        if p in DRESS:
            m['height_world_px'] = round(zmax(p), 1)   # tallest point, for the baked shadow
        if hasattr(p, 'household'):
            m['household'] = p.household
            m['dressing_spots'] = p.spots
            m['proportions'] = {k: (float(v) if isinstance(v, (np.floating, float)) else int(v)) for k, v in measure(p).items()}
        meta[p.name] = m
    json.dump(meta, open(os.path.join(OUT, 'pieces.json'), 'w', newline='
'), indent=1, default=str)
    print(json.dumps({k: {'canvas': v['canvas'], 'anchor': v['anchor_front_corner_px'], 'dev': round(v['audit']['raster_probe_max_dev_from_0.5'], 4),
                          'foot_out': v['audit']['foot_outside_silhouette_px'], 'prop': v.get('proportions')} for k, v in meta.items()}, indent=0, default=str))


if __name__ == '__main__':
    main()
