"""Plane maps of the four houses: python scripts/art/ba-dan-guides/planes.py

For every pixel of a house guide, which axis-aligned plane was drawn there last (painter's order, the same ops
as guidelib.render): R = 0 none / 1 horizontal (z) / 2 east face x = const / 3 south face y = const,
G,B = high and low byte of the plane's coordinate (z x 100, or x or y in tiles x 1000).
The packer (`scripts/art/ba-dan-true-pieces.ts`, retired at the continuous-painting integration) inverts the screen projection on those planes to find the 3D
point under each pixel and shades the horizontal ones (plinth tops, steps, ledges) with the shared light's shadow
on that plane, so the roof's shadow carries on across the porch the way the baked ground shadow leaves it."""
import os, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import guidelib as GL  # noqa
import pieces as PC  # noqa

OUT = os.path.join(HERE, '..', '..', '..', 'art', 'source', 'ba-dan-true', 'planes')


def plane_of(pts):
    zs = {round(p[2], 6) for p in pts}
    xs = {round(p[0], 6) for p in pts}
    ys = {round(p[1], 6) for p in pts}
    if len(zs) == 1:
        return 1, round(zs.pop() * 100)
    if len(xs) == 1:
        return 2, round(xs.pop() * 1000)
    if len(ys) == 1:
        return 3, round(ys.pop() * 1000)
    return 0, 0


def build(p):
    p.render()
    W, H = p.size
    ox, oy = p.anchor
    F = p._F

    def to_c(q):
        z = GL.proj(q)
        return (z[0] - F[0] + ox, z[1] - F[1] + oy)

    ids = Image.new('I', (W, H), 0)
    d = ImageDraw.Draw(ids)
    table = [(0, 0)]
    n = 0
    for op in p.ops:
        if op[0] != 'poly':
            # a stroke is paint on whatever plane is under it: leave the plane map as it was
            continue
        _, p3, fill, lw, tag = op
        n += 1
        table.append(plane_of(p3))
        d.polygon([to_c(q) for q in p3], fill=n)
    arr = np.asarray(ids)
    out = np.zeros((H, W, 4), np.uint8)
    t = np.array([a for a, b in table], np.uint8)
    v = np.array([b for a, b in table], np.int64)
    out[..., 0] = t[arr]
    out[..., 1] = (v[arr] >> 8) & 255
    out[..., 2] = v[arr] & 255
    out[..., 3] = 255
    return out, (ox, oy)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for p in PC.all_pieces()[:4]:
        out, anchor = build(p)
        Image.fromarray(out, 'RGBA').save(os.path.join(OUT, p.name + '.png'))
        h = int((out[..., 0] == 1).sum())
        print(p.name, out.shape[:2], 'anchor', anchor, 'horizontal px', h)
