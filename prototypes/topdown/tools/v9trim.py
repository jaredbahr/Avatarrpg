"""Trim the pale paving apron the edit added under each enlarged house: outside the wall's own span, the bottom rows go transparent,
and pale paving rows below the plinth go too (the plinth and doorstep stay)."""
import sys
from PIL import Image
def trim(src, dst):
    im = Image.open(src).convert('RGBA'); W, H = im.size; p = im.load()
    for y in range(H):
        for x in range(W):
            if 0 < p[x, y][3] < 128: p[x, y] = (0, 0, 0, 0)
            elif p[x, y][3]: r, g, b, a = p[x, y]; p[x, y] = (r, g, b, 255)
    span = lambda y: [x for x in range(W) if p[x, y][3]]
    ref = span(int(H * 0.62)); L, R = min(ref), max(ref)
    for y in range(int(H * 0.72), H):
        for x in range(W):
            if (x < L - 2 or x > R + 2) and p[x, y][3]: p[x, y] = (0, 0, 0, 0)
    pale = lambda c: c[3] and max(c[:3]) - min(c[:3]) < 34 and sum(c[:3]) / 3 > 120
    # rows at the very bottom that are mostly pale paving (wider than a doorstep) are the apron
    for y in range(H - 1, int(H * 0.8), -1):
        xs = span(y)
        if not xs: continue
        pf = sum(1 for x in xs if pale(p[x, y])) / len(xs)
        if pf > 0.6 and len(xs) > (R - L) * 0.45:
            for x in xs: p[x, y] = (0, 0, 0, 0)
        else: break
    im = im.crop(im.getbbox()); im.save(dst); return im.size
for k in sys.argv[1:]: print(k, trim(f'v9/edits/{k}_big.png', f'v9/edits/{k}_trim.png'))
