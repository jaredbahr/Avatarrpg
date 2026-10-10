"""Review sheets for the houses (`houses.py`): each guide on its own, with the tile grid, with the game's 86 px figure at the
door, the one-tile-wider footprint alternative, and the painter's sheets (A the two 4x3 houses, B the two 4x4).  Nothing
here is read by the pipeline; `build.py` writes the guides, masks, footprints and `pieces.json`.

    python scripts/art/ba-dan-guides/houses_review.py [--review DIR] [--sheets DIR]

PIL + numpy only."""
import dataclasses, json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import guidelib as GL  # noqa: E402
import houses as H  # noqa: E402
from build import make_sheet, BG  # noqa: E402  (build.py runs nothing on import)
from houses_meta import (PLACE, FIG_SCALE, FIG_FEET, FIG_H, village_rows, notches, to_canvas,  # noqa: E402
                         yard_visible_fraction)

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SC = GL.SC


def figure_sprite():
    return Image.open(os.path.join(ROOT, 'public', 'art', 'units', 'bo-g.webp')).convert('RGBA').crop((0, 0, 128, 192))


def silhouette(scale):
    im = figure_sprite()
    a = np.asarray(im)[..., 3] > 40
    out = np.zeros(a.shape + (4,), np.uint8)
    out[a] = (38, 52, 92, 235)
    s = Image.fromarray(out, 'RGBA')
    return s.resize((int(round(128 * scale)), int(round(192 * scale))), Image.NEAREST)


def paste_bg(img, size, bg=BG):
    c = Image.new('RGBA', size, bg)
    c.alpha_composite(img, (0, 0))
    return c


def font(n=14):
    try:
        return ImageFont.truetype('arial.ttf', n)
    except Exception:
        return ImageFont.load_default()


def grid_image(p, notch, proposed=()):
    """The guide on a padded canvas with the ground grid: every tile line of the footprint and one tile around it, the
    footprint outline, the walkable (unblocked) cells tinted, the door tile and the yard gate's tile marked."""
    pad = 150
    W, Hh = p.size
    base = Image.new('RGBA', (W + 2 * pad, Hh + 2 * pad), BG)
    ov = Image.new('RGBA', base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)

    def pt(x, y, z=0.0):
        a = to_canvas(p, (x, y, z))
        return (a[0] + pad, a[1] + pad)

    w, dd = p.w, p.d
    walk = {tuple(n['local']) for n in notch}
    for i in range(-1, w + 1):
        for j in range(-1, dd + 1):
            inside = 0 <= i < w and 0 <= j < dd
            quad = [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)]
            if inside and (i, j) in proposed:
                d.polygon(quad, fill=(255, 150, 40, 110))
            elif inside and (i, j) in walk:
                d.polygon(quad, fill=(60, 200, 255, 90))
            elif not inside:
                d.polygon(quad, fill=(255, 255, 255, 18))
    door_tile = p.door['steps_tile']
    quad = [pt(door_tile[0], door_tile[1]), pt(door_tile[0] + 1, door_tile[1]), pt(door_tile[0] + 1, door_tile[1] + 1), pt(door_tile[0], door_tile[1] + 1)]
    d.polygon(quad, outline=(255, 90, 60, 255))
    for i in range(-1, w + 2):
        d.line([pt(i, -1), pt(i, dd + 1)], fill=(255, 255, 255, 140 if 0 <= i <= w else 60), width=1)
    for j in range(-1, dd + 2):
        d.line([pt(-1, j), pt(w + 1, j)], fill=(255, 255, 255, 140 if 0 <= j <= dd else 60), width=1)
    d.line([pt(0, 0), pt(w, 0), pt(w, dd), pt(0, dd), pt(0, 0)], fill=(255, 40, 40, 255), width=2)
    # the yard rectangle and the plinth's west line
    y = p.yard
    d.line([pt(y['x'][1], 0), pt(y['x'][1], dd)], fill=(255, 210, 40, 255), width=2)
    f = font(13)
    for i in range(w):
        for j in range(dd):
            c = pt(i + 0.5, j + 0.5)
            d.text((c[0] - 9, c[1] - 6), f'{i},{j}', fill=(255, 255, 255, 230), font=f)
    # the grid is the ground: draw it under the guide where the guide is opaque? no, overlay on top so it reads through the house
    comp = base.copy()
    comp.alpha_composite(p.guide, (pad, pad))
    comp.alpha_composite(ov)
    return comp


def scale_image(p):
    """The guide with the game's figure (86 px tall) standing on the landing at the door and another on the ground at the
    foot of the stair; a tape line shows 86 px at guide scale beside the door and the plinth's 18 px."""
    pad = 40
    W, Hh = p.size
    base = Image.new('RGBA', (W + 2 * pad, Hh + 2 * pad), BG)
    base.alpha_composite(p.guide, (pad, pad))
    s = silhouette(FIG_SCALE * SC)
    g = p.geo
    dm = (p.door['door_y'][0] + p.door['door_y'][1]) / 2
    spots = [(g['wx1'] + 0.12, dm, H.PLINTH), (p.w + 0.55, dm - 0.55, 0.0)]
    for (x, y, z) in spots:
        cx, cy = to_canvas(p, (x, y, z))
        px = int(round(cx + pad - s.width / 2))
        py = int(round(cy + pad - s.height * FIG_FEET))
        base.alpha_composite(s, (px, py))
    dr = ImageDraw.Draw(base)
    f = font(14)
    # a vertical tape beside the guide: 86 world px figure height and the plinth
    tx = pad + 14
    ty0 = pad + p.size[1] - 20
    dr.line([(tx, ty0), (tx, ty0 - FIG_H * SC)], fill=(255, 255, 255, 255), width=2)
    dr.line([(tx - 6, ty0), (tx + 6, ty0)], fill=(255, 255, 255, 255), width=2)
    dr.line([(tx - 6, ty0 - FIG_H * SC), (tx + 6, ty0 - FIG_H * SC)], fill=(255, 255, 255, 255), width=2)
    dr.line([(tx + 10, ty0), (tx + 10, ty0 - H.PLINTH * SC)], fill=(255, 210, 40, 255), width=3)
    dr.text((tx + 18, ty0 - FIG_H * SC), f'figure {FIG_H:.0f}px', fill=(255, 255, 255, 255), font=f)
    dr.text((tx + 18, ty0 - H.PLINTH * SC - 4), f'plinth {H.PLINTH:.0f}px = {H.PLINTH / FIG_H:.2f} figure', fill=(255, 220, 80, 255), font=f)
    return base


def main():
    review = sys.argv[sys.argv.index('--review') + 1] if '--review' in sys.argv else os.path.join(ROOT, '.review', 'houses')
    sheets = sys.argv[sys.argv.index('--sheets') + 1] if '--sheets' in sys.argv else os.path.join(review, 'sheets')
    for d_ in (review, sheets):
        os.makedirs(d_, exist_ok=True)
    rows = village_rows()
    pieces = H.all_houses()
    for p in pieces:
        p.render()
        sid, mx, my = PLACE[p.name]
        notch = notches(rows, mx, my, p.w, p.d)
        paste_bg(p.guide, p.size).convert('RGB').save(os.path.join(review, f'{p.name}-guide.png'))
        grid_image(p, notch).convert('RGB').save(os.path.join(review, f'{p.name}-grid.png'))
        scale_image(p).convert('RGB').save(os.path.join(review, f'{p.name}-scale.png'))
    # the one-tile-wider alternative (a fifth column west of the footprint): what the footprint change would buy in yard
    # visibility; it is not part of the painter sheets
    wide = {}
    for sp in H.SPECS:
        ws = dataclasses.replace(sp, name=sp.name + '-w5', w=sp.w + 1)
        q = H.house(ws)
        q.render()
        sid, mx, my = PLACE[sp.name]
        nt = [dict(n, local=[n['local'][0] + 1, n['local'][1]]) for n in notches(rows, mx, my, sp.w, sp.d)]
        paste_bg(q.guide, q.size).convert('RGB').save(os.path.join(review, f'{ws.name}-guide.png'))
        grid_image(q, nt, proposed={(0, j) for j in range(sp.d)}).convert('RGB').save(os.path.join(review, f'{ws.name}-grid.png'))
        wide[ws.name] = {'canvas': list(q.size), 'yard_visible_fraction': round(yard_visible_fraction(q), 3)}
    make_sheet([pieces[0], pieces[1]], 'sheet-a.png', 'sheet-a.json', sheets)
    make_sheet([pieces[2], pieces[3]], 'sheet-b.png', 'sheet-b.json', sheets)
    print(json.dumps(wide))


if __name__ == '__main__':
    main()
