"""Variant B: the shipped G cels reduced 2x onto the world's grid (1 art px = 1 world px) and cleaned by rule. No smoothing.

usage (repo root, after extract.py): python3 -I art/source/party-g1/tools/reduce.py [char ...]
Reads ../ref/<char>/<kind>/<dir>/NN.png (128x192 sheet cels), writes ../b/<char>/<kind>/<dir>/NN.png (64x96 world-px cels,
foot baseline unchanged at 85%) and ../b/<char>/palette.png.

Deterministic: same input cels, same output bytes. Steps, per character:
1. Palette. One palette per character, shared by every heading and frame, so colour cannot flicker between cels: a median
   cut of every opaque pixel of every cel (PIL MEDIANCUT, no dither) to B_COLOURS (48) colours, plus #1b1410.
2. Alpha. A 2x2 block is opaque when at least 2 of its 4 pixels are (alpha > 127): thin hands and hair tips survive.
3. Colour (B_MODE=mean, the default). The block's mean colour over its opaque pixels, snapped to the nearest palette colour.
   B_MODE=vote is the first trial, kept for the record: the most frequent palette colour, ties to the darker, and a near-black
   pixel (luma < DARK) wins where it is darker than the block's neighbours. It smeared hair over Sura's eye and spotted faces.
4. Contour. Every opaque pixel with a transparent 4-neighbour becomes #1b1410: one crisp 1-px outline, the objects' rule.
5. Clean. A lone interior pixel whose colour no 8-neighbour shares and that is not dark is set to its neighbours' most
   frequent colour (salt removal). Nothing is drawn by hand.
"""
import sys
from collections import Counter
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent.parent
REF = HERE / 'ref'
CONTOUR = (0x1b, 0x14, 0x10)
import os
N_COLOURS = int(os.environ.get('B_COLOURS', 48))
DARK = 70
MODE = os.environ.get('B_MODE', 'mean')   # 'mean': block mean snapped to the palette; 'vote': most frequent palette colour
OUT = HERE / os.environ.get('B_OUT', 'b')


def luma(c): return 0.299 * c[..., 0] + 0.587 * c[..., 1] + 0.114 * c[..., 2]


def palette_for(paths):
    px = []
    for p in paths:
        a = np.asarray(Image.open(p).convert('RGBA'))
        px.append(a[a[..., 3] > 127][:, :3])
    px = np.concatenate(px)
    side = int(np.ceil(np.sqrt(len(px))))
    buf = np.zeros((side * side, 3), np.uint8); buf[:len(px)] = px; buf[len(px):] = px[0]
    q = Image.fromarray(buf.reshape(side, side, 3), 'RGB').quantize(N_COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = np.array(q.getpalette()[:N_COLOURS * 3], np.int32).reshape(-1, 3)
    pal = np.vstack([pal, np.array(CONTOUR)])
    return pal[np.argsort(luma(pal.astype(np.float64)))]          # darkest first: index order is luma order


def nearest(rgb, pal):
    d = ((rgb[..., None, :].astype(np.int32) - pal[None, None]) ** 2).sum(-1)
    return d.argmin(-1)


def reduce_cel(src, pal):
    a = np.asarray(src.convert('RGBA'))
    H, W = a.shape[0] // 2, a.shape[1] // 2
    idx = nearest(a[..., :3], pal)
    op = a[..., 3] > 127
    L = luma(pal.astype(np.float64))
    out = np.full((H, W), -1, np.int32)
    dark_pick = np.zeros((H, W), bool)
    if MODE == 'mean':
        blk = a.reshape(H, 2, W, 2, 4).transpose(0, 2, 1, 3, 4).reshape(H, W, 4, 4).astype(np.float64)
        w = (blk[..., 3] > 127)
        n = w.sum(-1)
        mean = (blk[..., :3] * w[..., None]).sum(-2) / np.maximum(n, 1)[..., None]
        q = nearest(mean, pal)
        out = np.where(n >= 2, q, -1)
        return finish(out, pal, L, H, W)
    for y in range(H):
        for x in range(W):
            m = op[2 * y:2 * y + 2, 2 * x:2 * x + 2]
            if m.sum() < 2: continue
            ids = idx[2 * y:2 * y + 2, 2 * x:2 * x + 2][m]
            cnt = Counter(ids.tolist()); top = max(cnt.values())
            out[y, x] = min(k for k, v in cnt.items() if v == top)   # tie -> darker (lower index)
            dk = ids.min()
            if L[dk] < DARK and dk != out[y, x]: dark_pick[y, x] = True; out[y, x] = -2 - dk
    # step 3b: a dark candidate stays dark only where it is darker than its opaque 4-neighbours' block colours
    res = out.copy()
    for y, x in zip(*np.nonzero(dark_pick)):
        dk = -2 - out[y, x]
        nb = [out[yy, xx] for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)) if 0 <= yy < H and 0 <= xx < W and out[yy, xx] >= 0]
        mode_here = Counter(idx[2 * y:2 * y + 2, 2 * x:2 * x + 2][op[2 * y:2 * y + 2, 2 * x:2 * x + 2]].tolist()).most_common(1)[0][0]
        res[y, x] = dk if nb and L[dk] < min(L[n] for n in nb) - 25 else mode_here
    out = res
    return finish(out, pal, L, H, W)


def finish(out, pal, L, H, W):
    opaque = out >= 0
    # step 4: contour
    cidx = int(np.nonzero((pal == CONTOUR).all(1))[0][0])
    pad = np.pad(opaque, 1)
    edge = opaque & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    out[edge] = cidx
    # step 5: salt removal on the interior fill
    clean = out.copy()
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            v = out[y, x]
            if v < 0 or edge[y, x] or L[v] < DARK: continue
            nb = out[y - 1:y + 2, x - 1:x + 2].ravel().tolist(); nb.pop(4)
            if v not in nb:
                c = Counter(n for n in nb if n >= 0 and n != cidx)
                if c: clean[y, x] = c.most_common(1)[0][0]
    out = clean
    rgba = np.zeros((H, W, 4), np.uint8)
    rgba[out >= 0, :3] = pal[out[out >= 0]]; rgba[out >= 0, 3] = 255
    return Image.fromarray(rgba, 'RGBA')


def run(char):
    paths = sorted((REF / char).glob('*/*/*.png'))
    pal = palette_for(paths)
    for p in paths:
        o = OUT / p.relative_to(REF); o.parent.mkdir(parents=True, exist_ok=True)
        reduce_cel(Image.open(p), pal).save(o)
    sw = np.repeat(np.repeat(pal.astype(np.uint8)[None], 8, 0), 8, 1)
    Image.fromarray(sw, 'RGB').save(OUT / char / 'palette.png')
    print(char, len(paths), 'cels,', len(pal), 'colours')


if __name__ == '__main__':
    for c in sys.argv[1:] or ['kaya', 'sura', 'bo']: run(c)
