"""Step 2a: one palette per name, cut from its own curated roots (curate.json picks, before any lock).

usage (repo root): python3 -I art/source/residents-g1/tools/roots_palette.py [name ...]
Writes palettes/<name>.png (one 8x8 swatch per colour, darkest first), which palette_lock.py snaps every root and every
generated cel to. A median cut (PIL MEDIANCUT, no dither) of every opaque pixel of the picks to N_COLOURS, plus #1b1410.

Why not the shipped palette (the party's rule, b/<char>/palette.png)? The residents' and bandits' shipped cels are soft
painted art; their 48-colour cut is muddy, and the redraw's flat tones fell between two of its entries, so a flat coat
alternated between them (the watch) and the thug's red bandana snapped to brown. The roots already carry the identity;
cutting the palette from them keeps their colours and still puts every heading and frame on one palette.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
HERE = Path(__file__).resolve().parent.parent
N_COLOURS = 40
CONTOUR = (0x1b, 0x14, 0x10)


def luma(c): return 0.299 * c[..., 0] + 0.587 * c[..., 1] + 0.114 * c[..., 2]


def build(name, picks):
    px = []
    for key, src in sorted(picks.items()):
        if not key.startswith(name + '/'): continue
        a = np.asarray(Image.open(HERE / 'raw' / src).convert('RGBA')); px.append(a[a[..., 3] > 127][:, :3])
    px = np.concatenate(px); side = int(np.ceil(np.sqrt(len(px))))
    buf = np.zeros((side * side, 3), np.uint8); buf[:len(px)] = px; buf[len(px):] = px[0]
    q = Image.fromarray(buf.reshape(side, side, 3), 'RGB').quantize(N_COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = np.array(q.getpalette()[:N_COLOURS * 3], np.int32).reshape(-1, 3)
    pal = np.unique(np.vstack([pal, np.array(CONTOUR)]), axis=0)
    pal = pal[np.argsort(luma(pal.astype(np.float64)), kind='stable')]
    sw = np.repeat(np.repeat(pal.astype(np.uint8)[None], 8, 0), 8, 1)
    out = HERE / f'palettes/{name}.png'; out.parent.mkdir(exist_ok=True); Image.fromarray(sw, 'RGB').save(out)
    print(name, len(pal), 'colours')


if __name__ == '__main__':
    picks = json.load(open(HERE / 'curate.json'))['pick']
    for n in sys.argv[1:] or json.load(open(HERE / 'tools/chars.json')): build(n, picks)
