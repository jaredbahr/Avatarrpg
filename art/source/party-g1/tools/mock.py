"""The Route A slice mock (draft #287) three ways: current party | variant A | variant B. No PixelLab calls.

usage (repo root):
  ROUTE_A_TREE=<checkout of claude/ba-dan-route-a with its .review/regions built, see that README> \
  python3 art/source/party-g1/tools/mock.py
Writes art/source/party-g1/review/mock-{current,a,b}-ipad.webp and mock-3way-ipad.webp.

The ground, the house and the tree are #287's, built exactly as its build_mock.py does (world-px ground, EPX x2 + 0.75
Lanczos to painting px, pieces under their frozen silhouettes). Figures stand on #287's tiles and are depth-sorted against
the same uprights by its own code path. Only the figure source changes:
- current: the shipped atlas cel at 0.75 Lanczos into painting px (what the game draws today, as #287 placed it);
- A and B: the 64x96 world-px cel through the same up15 (EPX x2 + 0.75 Lanczos) as the ground, so world and figures get
  one resample. Same anchor (0.5, 0.85) and the same contact shadow for all three.
Headings are #287's where the variant has them (Bo idle SE, Sura idle NW); Kaya walks SE (#287 used SW, which variant A does
not have) at walk cel 3 in every panel.
"""
import os, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

PG1 = Path(__file__).resolve().parent.parent
TREE = Path(os.environ['ROUTE_A_TREE']).resolve()
os.chdir(TREE); sys.path.insert(0, str(TREE / 'art/source/ba-dan-route-a/tools'))
from compose import G, PIECES, piece, piece_alpha, paste_piece, up15, RA, REG   # noqa: E402
from tiles import plan, stitch   # noqa: E402
from geo import paint   # noqa: E402
GEN = 'art/source/ba-dan-route-a/generated'

# heading, atlas cel / variant cel, tile  (variant A walk cel 3 = raw job frame 3 of the 12-cel take)
FIGS = [('bo', 'idle', 'south-east', 0, (6, 4)), ('kaya', 'walk', 'south-east', 3, (8, 4)), ('sura', 'idle', 'north-west', 0, (10, 7))]


def world_ground():
    parts = [(box, Image.open(f'{GEN}/ground-tile-{i}.png')) for i, box in enumerate(plan(1440, 880, 512, 48))]
    new = up15(stitch(1440, 880, parts), (G[2] - G[0], G[3] - G[1]))
    paste_piece(new, up15(Image.open(f'{GEN}/gao-house.png'), (702, 508)), piece('gao-house'), (2013, 329))
    paste_piece(new, up15(Image.open(f'{GEN}/canopy-tree.png'), (480, 468)), piece('tree-5-5'), (1578, 228))
    return new


def cel(variant, char, kind, d, i):
    """The figure in painting px, 96x144, foot at (48, 122.4)."""
    if variant == 'current':
        return Image.open(PG1 / f'ref/{char}/{kind}/{d}/{i:02d}.png').convert('RGBA').resize((96, 144), Image.LANCZOS)
    return up15(variant_cel(variant, char, kind, d, i), (96, 144))


def variant_cel(variant, char, kind, d, i):
    """A 64x96 world-px cel of variant 'a' or 'b'."""
    if variant == 'b': return Image.open(PG1 / f'b/{char}/{kind}/{d}/{i:02d}.png').convert('RGBA')
    sel = PG1 / f'a/{char}/{kind}/{d}/{i:02d}.png'
    if not sel.exists(): sel = PG1 / f'a/{char}/rotations/{d}.png'   # a static heading: the native rotation
    return Image.open(sel).convert('RGBA').crop((16, 0, 80, 96))       # the 96x96 canvas is the 64x96 one padded 16 px each side


def shadow(canvas, px, py):
    sh = Image.new('L', (60, 24), 0); ImageDraw.Draw(sh).ellipse((6, 4, 54, 20), fill=110); sh = sh.filter(ImageFilter.GaussianBlur(3))
    dark = Image.new('RGBA', sh.size, (27, 20, 16, 255)); dark.putalpha(sh)
    canvas.alpha_composite(dark, (round(px - 30 + 4), round(py - 12 + 2)))


def with_figures(base, variant):
    out = base.copy(); ua = np.asarray(base.convert('RGBA'))
    ups = [p for p in PIECES if p['sprite']['x'] < G[2] and p['sprite']['x'] + p['sprite']['width'] > G[0]
           and p['sprite']['y'] < G[3] and p['sprite']['y'] + p['sprite']['height'] > G[1]]
    layers = {p['index']: piece_alpha(p)[G[1]:G[3], G[0]:G[2]] for p in ups}
    for char, kind, d, i, (tx, ty) in sorted(FIGS, key=lambda f: f[4][0] + f[4][1]):
        px, py = paint(tx + 0.5, ty + 0.5); px -= G[0]; py -= G[1]
        shadow(out, px, py); im = cel(variant, char, kind, d, i)
        out.alpha_composite(im, (round(px - 0.5 * im.width), round(py - 0.85 * im.height)))
        for p in sorted(ups, key=lambda p: p['depthKey']):
            if p['depthKey'] > tx + ty + 1:
                lay = Image.fromarray(ua.copy()); lay.putalpha(Image.fromarray((layers[p['index']] * 255).astype(np.uint8)))
                out.alpha_composite(lay)
    return out


def frame_box():
    cx, cy = paint(7.5, 5); f = (round(cx - G[0] - 684), round(cy - G[1] - 357))
    return (f[0], f[1], f[0] + 1368, f[1] + 714)


if __name__ == '__main__':
    out = PG1 / 'review'; out.mkdir(exist_ok=True)
    ground = world_ground(); fb = frame_box(); panels = []
    for v in ['current', 'a', 'b']:
        m = with_figures(ground, v).crop(fb); m.save(out / f'mock-{v}-ipad.webp', lossless=True); panels.append(m)
    W, Hh = panels[0].size; sheet = Image.new('RGB', (W, 3 * Hh + 2 * 8), (20, 20, 20))
    for k, m in enumerate(panels): sheet.paste(m.convert('RGB'), (0, k * (Hh + 8)))
    sheet.save(out / 'mock-3way-ipad.webp', lossless=True)
    print('frame', fb, 'figure feet (painting px in frame):', [(f[0], [round(c - o) for c, o in zip(paint(f[4][0] + .5, f[4][1] + .5), (G[0] + fb[0], G[1] + fb[1]))]) for f in FIGS])
