"""Edge pass for the true Ba Dan pieces: python scripts/art/ba-dan-guides/edge.py [name ...]

Reads the painted piece (art/source/ba-dan-true/yards/<name>.png for the four houses, else painted/<name>.png: binary alpha, 1 px outline
inside the mask), re-derives the silhouette's exact coverage from the guide geometry (8x supersampled, the same
polygons and strokes as guidelib.render), and writes art/source/ba-dan-true/<name>.png with
  - an antialiased alpha edge (alpha = geometric coverage; the game filters the art bilinearly at 2/3 x zoom,
    where a binary edge and a 1 px line dash),
  - a dark-brown outline 2 source px wide round the whole silhouette (the painted 1 px line is overpainted),
  - the outline colour bled 4 px under the transparent fringe, so no filter or encoder can pull in another colour.
The silhouette is geometry only: nothing is added outside it and nothing inside it moves."""
import os, sys
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import guidelib as GL  # noqa
import pieces as PC  # noqa
import dressing as DR  # noqa

OUT = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'art', 'source', 'ba-dan-true'))
SS = 8
DRESSING = {p.name for p in DR.all_dressing()}
HOUSE_OUTLINE = (75, 43, 29)

def builders():
    return {p.name: p for p in PC.all_pieces() + DR.all_dressing() if p.name not in DR.WALL_MODULES}

def coverage(p):
    """Fractional silhouette coverage at 8x, same ops as Piece.render's silhouette."""
    p.render()
    W, H = p.size
    ox, oy = p.anchor
    F = p._F
    def to_c(q):
        z = GL.proj(q)
        return ((z[0] - F[0] + ox) * SS, (z[1] - F[1] + oy) * SS)
    sil = Image.new('L', (W * SS, H * SS), 0)
    sd = ImageDraw.Draw(sil)
    def strokes(c2, lw):
        w = max(1, int(round(lw * SS)))
        sd.line(c2, fill=255, width=w, joint='curve')
        r = w / 2.0
        for (x, y) in (c2[0], c2[-1]):
            sd.ellipse([x - r, y - r, x + r, y + r], fill=255)
    for op in p.ops:
        if op[0] == 'poly':
            _, p3, fill, lw, tag = op
            c2 = [to_c(q) for q in p3]
            sd.polygon(c2, fill=255)
            if lw:
                strokes(c2 + [c2[0]], lw)
        else:
            _, p3, lw, col = op
            strokes([to_c(q) for q in p3], lw)
    a = np.asarray(sil).astype(np.float64).reshape(H, SS, W, SS).mean(axis=(1, 3)) / 255.0
    return a

def chamfer_inside(inside):
    """Distance from each inside pixel centre to the nearest outside pixel centre (3-4 chamfer, px)."""
    H, W = inside.shape
    INF = 1e9
    d = np.where(inside, INF, 0.0)
    a, b = 1.0, 1.4142
    for y in range(H):
        row = d[y]
        up = d[y - 1] if y else None
        for x in range(W):
            v = row[x]
            if v == 0: continue
            if x: v = min(v, row[x - 1] + a)
            if up is not None:
                v = min(v, up[x] + a)
                if x: v = min(v, up[x - 1] + b)
                if x + 1 < W: v = min(v, up[x + 1] + b)
            row[x] = v
    for y in range(H - 1, -1, -1):
        row = d[y]
        dn = d[y + 1] if y + 1 < H else None
        for x in range(W - 1, -1, -1):
            v = row[x]
            if v == 0: continue
            if x + 1 < W: v = min(v, row[x + 1] + a)
            if dn is not None:
                v = min(v, dn[x] + a)
                if x + 1 < W: v = min(v, dn[x + 1] + b)
                if x: v = min(v, dn[x - 1] + b)
            row[x] = v
    return d

def dist_to_inside(inside):
    return chamfer_inside(~inside)

def process(name, p):
    src = os.path.join(OUT, 'yards', name + '.png')
    if not os.path.exists(src):
        src = os.path.join(OUT, 'painted', name + '.png')
    img = np.asarray(Image.open(src).convert('RGBA')).astype(np.float64)
    H, W = img.shape[:2]
    cov = coverage(p)
    assert cov.shape == (H, W), (cov.shape, img.shape)
    old = img[..., 3] > 0
    new_bin = cov >= 0.5
    mism = int((old != new_bin).sum())
    inside = new_bin
    depth = chamfer_inside(inside) - 0.5      # 0.5-depth at the boundary pixel centres... (distance to outside centre minus half)
    # outline colour: median of the painted 1 px outline (old boundary pixels)
    ring = old & (chamfer_inside(old) <= 1.0)
    outline = np.median(img[..., :3][ring], axis=0)
    if name in DRESSING:      # painted without an outline: the houses' brown, so every piece reads as one set
        outline = np.array(HOUSE_OUTLINE, np.float64)
    # painted colour everywhere inside: keep; boundary pixels newly inside have no paint -> outline
    rgb = img[..., :3].copy()
    rgb[~old] = outline
    w = np.clip(2.5 - np.where(inside, depth + 0.5, 0.5), 0, 1)     # 2 px at full weight, soft third
    w = np.where(inside, w, 1.0)
    rgb = rgb * (1 - w[..., None]) + outline * w[..., None]
    # fringe: every pixel outside the shape gets the outline colour (bleed), alpha from coverage
    alpha = cov.copy()
    alpha[cov < 1 / (2 * SS * SS)] = 0
    out = np.zeros((H, W, 4), np.uint8)
    out[..., :3] = np.round(rgb).clip(0, 255)
    near = dist_to_inside(inside) <= 4.5
    out[~inside & ~near, :3] = 0
    out[~inside & near, :3] = np.round(outline)
    out[..., 3] = np.round(alpha * 255)
    Image.fromarray(out, 'RGBA').save(os.path.join(OUT, name + '.png'))
    return dict(name=name, mask_mismatch_px=mism, outline=tuple(int(v) for v in outline),
                partial=int(((out[..., 3] > 0) & (out[..., 3] < 255)).sum()))

if __name__ == '__main__':
    B = builders()
    names = sys.argv[1:] or list(B)
    for n in names:
        print(process(n, B[n]))
