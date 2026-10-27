"""Grain ladder for #284 Route A: current | G1 (1 art px = 1 world px) | G2 (1 art px = 2 world px).

Every panel is shown at 2 screen px per world px (an integer zoom, so G1 is x2 and G2 x4 nearest-neighbour, one pixel grid
each, no smooth scaling). The current panel is the shipped painting at the same zoom with the shipped G cels at 1:1.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image, ImageDraw
from compose import PIECES, IDS, piece_alpha, piece, REG, RA, GEN, G
from geo import world
from figures import frame
from tiles import plan, stitch
L = os.environ.get('LADDER_GEN', f'{GEN}/ladder')
OX, OY = G[0] / 1.5 - 200, G[1] / 1.5 - 100  # world coords of the composition box corner (430, -100)
FIGS = [('bo', 'idleSouthEast', 0, (6, 4)), ('kaya', 'walkSouthWest', 3, (8, 4)), ('sura', 'idleNorthWest', 0, (10, 7))]
ZOOM = 2

def own_stitch(w, h, parts):
    """Hard joins: each pixel from the tile whose nearest interior edge is farthest, so seams sit mid-overlap with no
    blended pixels. Each tile is first gain-matched (per channel) to the tiles already laid over their shared overlap."""
    out = np.zeros((h, w, 4), np.float32); laid = np.zeros((h, w), bool); best = np.full((h, w), -1.0)
    for (x, y, tw, th), im in parts:
        a = np.asarray(im.convert('RGBA'))[:th, :tw].astype(np.float32)
        sl = (slice(y, y + th), slice(x, x + tw)); ov = laid[sl]
        if ov.any():
            gain = (out[sl][ov][:, :3].mean(0) + 1) / (a[ov][:, :3].mean(0) + 1)
            a[..., :3] = np.clip(a[..., :3] * gain, 0, 255)
        yy, xx = np.mgrid[0:th, 0:tw]
        big = 1e9
        d = np.minimum(np.minimum(xx if x > 0 else big, tw - 1 - xx if x + tw < w else big),
                       np.minimum(yy if y > 0 else big, th - 1 - yy if y + th < h else big))
        m = d > best[sl]
        out[sl][m] = a[m]; best[sl][m] = d[m]; laid[sl] = True
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), 'RGBA')

def mask_at(p, k, hard=True):
    """Piece alpha on the composition box at k canvas px per world px (box filter, thresholded on a pixel grid)."""
    m = piece_alpha(p)[G[1]:G[3], G[0]:G[2]]
    im = Image.fromarray((m * 255).astype(np.uint8)).resize((round((G[2] - G[0]) * k / 1.5), round((G[3] - G[1]) * k / 1.5)), Image.BOX)
    a = np.asarray(im).astype(np.float32) / 255
    return (a >= 0.5).astype(np.float32) if hard else a

def paste(canvas, art, p, painting_xy, k):
    x = round((painting_xy[0] - G[0]) * k / 1.5); y = round((painting_xy[1] - G[1]) * k / 1.5)
    full = Image.new('RGBA', canvas.size); full.paste(art.convert('RGBA'), (x, y))
    m = mask_at(p, k)[..., None] * (np.asarray(full)[..., 3:] / 255 > 0.5)
    c = np.asarray(canvas).astype(np.float32); f = np.asarray(full).astype(np.float32)
    c[..., :3] = c[..., :3] * (1 - m) + f[..., :3] * m
    canvas.paste(Image.fromarray(c.astype(np.uint8), 'RGBA'))

def foot(tx, ty, k):
    wx, wy = world(tx + 0.5, ty + 0.5); return (wx - OX) * k, (wy - OY) * k

def with_figs(base, uprights, figs, k, hard):
    out = base.copy()
    ups = [p for p in PIECES if p['sprite']['x'] < G[2] and p['sprite']['x'] + p['sprite']['width'] > G[0]
           and p['sprite']['y'] < G[3] and p['sprite']['y'] + p['sprite']['height'] > G[1]]
    masks = {p['index']: mask_at(p, k, hard) for p in ups}
    ua = np.asarray(uprights.convert('RGBA'))
    for (name, clip, i, (tx, ty)), art in sorted(zip(FIGS, figs), key=lambda f: f[0][3][0] + f[0][3][1]):
        fx, fy = foot(tx, ty, k)
        if not hard:  # soft contact shadow only where the panel is not a pixel grid
            pass
        sh = shadow(art.width, k)
        out.alpha_composite(sh, (round(fx - sh.width / 2 + 2 * k), round(fy - sh.height / 2 + k)))
        out.alpha_composite(art, (round(fx - 0.5 * art.width), round(fy - 0.85 * art.height)))
        for p in sorted(ups, key=lambda p: p['depthKey']):
            if p['depthKey'] > tx + ty + 1:
                lay = Image.fromarray(ua.copy()); lay.putalpha(Image.fromarray((masks[p['index']] * 255).astype(np.uint8)))
                out.alpha_composite(lay)
    return out

def shadow(fw, k):
    """A flat 2-tone contact ellipse on the panel's own pixel grid."""
    w = max(6, round(fw * 0.45)); h = max(3, round(w * 0.4))
    im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im)
    d.ellipse((0, 0, w - 1, h - 1), fill=(27, 20, 16, 90))
    return im

def g1_figure(name, clip, i):
    """G1: the shipped 192 px cel box-downsampled 2:1 to 64x96 art px (128 sheet px per 64 world px), alpha thresholded."""
    im = frame(name, clip, i).resize((64, 96), Image.BOX)
    a = np.asarray(im).copy(); a[..., 3] = np.where(a[..., 3] >= 128, 255, 0); return Image.fromarray(a, 'RGBA')

def g2_figure(name):
    im = Image.open(f'{L}/g2-fig-{name}.png').convert('RGBA')
    a = np.asarray(im).copy(); a[..., 3] = np.where(a[..., 3] >= 128, 255, 0); return Image.fromarray(a, 'RGBA')

def build():
    os.makedirs(RA, exist_ok=True)
    W, H = G[2] - G[0], G[3] - G[1]
    # current, at 2 screen px per world px: painting x4/3, cels 1:1 (128 sheet px per 128 px tile)
    k = ZOOM
    cg = Image.open(f'{REG}/quiet.png').convert('RGBA').crop(G).resize((round(W * k / 1.5), round(H * k / 1.5)), Image.LANCZOS)
    cu = Image.open(f'{REG}/faded.png').convert('RGBA').crop(G).resize(cg.size, Image.LANCZOS)
    cur = with_figs(cg, cu, [frame(n, c, i) for n, c, i, _ in FIGS], k, hard=False)
    # G1 at world px
    parts = [(b, Image.open(f'{GEN}/ground-tile-{i}.png')) for i, b in enumerate(plan(1440, 880, 512, 48))]
    g1 = stitch(1440, 880, parts, r=64)  # G1 tiles register, so the round-1 feather
    paste(g1, Image.open(f'{GEN}/gao-house.png'), piece('gao-house'), (2013, 329), 1)
    paste(g1, Image.open(f'{GEN}/canopy-tree.png'), piece('tree-5-5'), (1578, 228), 1)
    g1f = with_figs(g1, g1, [g1_figure(n, c, i) for n, c, i, _ in FIGS], 1, hard=True)
    # G2 at half world px
    parts = [(b, Image.open(f'{L}/g2-ground-tile-{i}.png')) for i, b in enumerate(plan(720, 440, 256, 32))]
    g2 = own_stitch(720, 440, parts)  # hard joins: G2 tiles do not register, a feather ghosts them
    paste(g2, Image.open(f'{L}/g2-gao-house.png'), piece('gao-house'), (2013, 329), 0.5)
    paste(g2, Image.open(f'{L}/g2-canopy-tree.png'), piece('tree-5-5'), (1578, 228), 0.5)
    g2f = with_figs(g2, g2, [g2_figure(n) for n, _, _, _ in FIGS], 0.5, hard=True)
    g1f.save(f'{RA}/ladder-g1-native.png'); g2f.save(f'{RA}/ladder-g2-native.png')
    # the framing: 1368 x 714 screen px at zoom 2, centred where the round-1 iPad frame was
    wx, wy = world(7.5, 5); cx, cy = (wx - OX), (wy - OY)
    fw, fh = 1368 / k, 714 / k
    box = lambda s: tuple(round(v * s) for v in (cx - fw / 2, cy - fh / 2, cx + fw / 2, cy + fh / 2))
    pc = cur.crop(box(k)); p1 = g1f.crop(box(1)).resize((1368, 714), Image.NEAREST); p2 = g2f.crop(box(0.5)).resize((1368, 714), Image.NEAREST)
    for n, im in [('current', pc), ('g1', p1), ('g2', p2)]: im.save(f'{RA}/ladder-{n}-1x.png')
    sheet = Image.new('RGBA', (1368, 3 * 714 + 3 * 22), (24, 24, 24, 255)); d = ImageDraw.Draw(sheet)
    for j, (lab, im) in enumerate([('current game: shipped painting, G cels 1:1 (Kaya 118 sheet px = 59 world px tall); shown at 2 screen px per world px', pc), ('G1 hi-bit: 1 art px = 1 world px, tile 128x64 art px, Kaya 59 art px tall; shown x2 nearest', p1), ('G2 chunky: 1 art px = 2 world px, tile 64x32 art px, Kaya 30 art px tall; shown x4 nearest', p2)]):
        d.text((6, j * 736 + 5), lab, fill='white'); sheet.paste(im, (0, j * 736 + 22))
    sheet.save(f'{RA}/ladder-sheet-1x.png')
    # 4x crops of the 1x panels (nearest)
    # label, tile, lift (world px above that ground point)
    crops = [('Kaya beside the house', (8, 4), 30), ('fruit baskets and Bo', (6.4, 4.4), 38), ('canal bank and bridge post', (7.6, 5.9), 0),
             ('roof eave and awning', (9.2, 3.4), 75), ('bridge, canal bank, Sura', (10, 7), 28)]
    rows = []
    for lab, (tx, ty), lift in crops:
        fx, fy = foot(tx, ty, k); fy -= lift * k; x0 = fx - box(k)[0] - 80; y0 = fy - box(k)[1] - 70
        row = Image.new('RGBA', (3 * 640 + 20, 560 + 22), (24, 24, 24, 255)); dd = ImageDraw.Draw(row)
        dd.text((4, 4), f'current | G1 | G2 - {lab} (4x nearest of the 1x panel)', fill='white')
        for j, im in enumerate([pc, p1, p2]):
            row.paste(im.crop((round(x0), round(y0), round(x0) + 160, round(y0) + 140)).resize((640, 560), Image.NEAREST), (j * 650, 22))
        rows.append(row)
    s4 = Image.new('RGBA', (rows[0].width, sum(r.height for r in rows))); y = 0
    for r in rows: s4.paste(r, (0, y)); y += r.height
    s4.save(f'{RA}/ladder-sheet-4x.png')
    party_strip()

def party_strip():
    """The party at each grain on a lawn swatch: at the sheet's 1x (2 screen px per world px), and head and shoulders at 3x of that."""
    cels = [frame(n, c, i) for n, c, i, _ in FIGS]
    rows = [('current: G cels 1:1 (192 px frames)', [c for c in cels], 1),
            ('G1: box 2:1, 64x96 frames, about 59 art px tall, shown x2', [g1_figure(n, c, i) for n, c, i, _ in FIGS], 2),
            ('G2: box 4:1 then PixelLab clean-up, 32x48 frames, about 30 art px tall, shown x4', [g2_figure(n) for n, _, _, _ in FIGS], 4)]
    lawn = (128, 142, 82, 255)
    out = Image.new('RGBA', (3 * 140 + 3 * 3 * 140 + 40, 3 * (220 + 22)), (24, 24, 24, 255)); d = ImageDraw.Draw(out)
    for r, (lab, figs, z) in enumerate(rows):
        y = r * 242; d.text((6, y + 4), lab + '   |   head and shoulders at 3x of the left', fill='white')
        for j, f in enumerate(figs):
            f1 = f.resize((f.width * z, f.height * z), Image.NEAREST)
            cell = Image.new('RGBA', (140, 200), lawn); cell.alpha_composite(f1.crop(f1.getbbox()), (70 - (f1.crop(f1.getbbox()).width) // 2, 10))
            out.paste(cell, (j * 140, y + 22))
            bb = f1.getbbox(); head = f1.crop((bb[0], bb[1], bb[2], bb[1] + min(60, bb[3] - bb[1])))
            big = Image.new('RGBA', (head.width * 3, head.height * 3), lawn); big.alpha_composite(head.resize((head.width * 3, head.height * 3), Image.NEAREST))
            big = big.crop((0, 0, min(big.width, 3 * 140 - 10), min(big.height, 200)))
            out.paste(big, (3 * 140 + 20 + j * 3 * 140, y + 22))
    out.save(f'{RA}/ladder-party-legibility.png')

if __name__ == '__main__':
    build()
