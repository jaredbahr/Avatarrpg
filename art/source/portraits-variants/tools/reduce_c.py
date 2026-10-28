"""Route C reference, no generation: a shipped 512 portrait reduced to a 128 px pixel bust.
Box-filter 4x down, a 40-colour median cut with no dither, the darkest colour forced to the world contour #1b1410,
and single-pixel salt removed. This only shows the size and register of a pixel portrait; a shipped route C would be
redrawn (PixelLab pro-flash at 128) and hand-cleaned, not reduced. Writes out/<char>.c128.png."""
import json, sys
from pathlib import Path
from PIL import Image
import numpy as np
HERE = Path(__file__).resolve().parent.parent; ROOT = HERE.parents[2]
cast = json.load(open(HERE / 'tools' / 'cast.json'))
for char in [k for k in cast if not k.startswith('_')]:
    im = Image.open(ROOT / 'public/art/portraits' / cast[char]['file']).convert('RGB').resize((128, 128), Image.BOX)
    q = im.quantize(40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = np.array(q.getpalette()[:120]).reshape(-1, 3); idx = np.array(q)
    pal[int(np.argmin(pal.sum(1)))] = (0x1b, 0x14, 0x10)
    # salt: a pixel whose 8 neighbours all share one other index takes it
    out = idx.copy()
    for y in range(1, 127):
        for x in range(1, 127):
            n = idx[y-1:y+2, x-1:x+2].flatten(); n = np.delete(n, 4)
            if (n == n[0]).all() and n[0] != idx[y, x]: out[y, x] = n[0]
    Image.fromarray(pal[out].astype('uint8')).save(HERE / 'out' / f'{char}.c128.png'); print(char, len(np.unique(out)), 'colours')
