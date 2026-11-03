"""Compose the Route A review mock and the matching current-game composite (same framing, poses, occlusion)."""
import json, sys
import numpy as np
from PIL import Image, ImageDraw
from figures import frame, place
from geo import paint
import os
GEN = 'art/source/ba-dan-route-a/generated'
S = os.environ.get('ROUTE_A_WORK', '.review/route-a')
REG = os.environ.get('BA_DAN_WORK', '.review/regions')
RA = S; V = f'{REG}/village'
G = (945, 0, 3105, 1320)  # painting px box of the composition
PIECES = json.load(open(f'{V}/pieces.json'))['pieces']
IDS = np.asarray(Image.open(f'{V}/ids.png'))

def epx(im):
    """Scale2x (EPX): doubles without blur, keeps 1-px diagonals clean."""
    a = np.asarray(im.convert('RGBA')).astype(np.int32)
    p = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode='edge')
    C = p[1:-1, 1:-1]; A = p[:-2, 1:-1]; B = p[1:-1, 2:]; D = p[2:, 1:-1]; Cl = p[1:-1, :-2]
    eq = lambda x, y: (np.abs(x - y).sum(-1) < 24)
    o = np.zeros((a.shape[0] * 2, a.shape[1] * 2, 4), np.int32)
    o[0::2, 0::2] = np.where((eq(Cl, A) & ~eq(A, B) & ~eq(Cl, D))[..., None], A, C)
    o[0::2, 1::2] = np.where((eq(A, B) & ~eq(A, Cl) & ~eq(B, D))[..., None], B, C)
    o[1::2, 0::2] = np.where((eq(D, Cl) & ~eq(D, B) & ~eq(Cl, A))[..., None], Cl, C)
    o[1::2, 1::2] = np.where((eq(B, D) & ~eq(B, A) & ~eq(D, Cl))[..., None], D, C)
    return Image.fromarray(o.astype(np.uint8), 'RGBA')

def up15(im, size):
    """World px -> painting px (x1.5): EPX x2 then a 0.75 Lanczos, the same downsample the G sheets get on screen."""
    return epx(im).resize(size, Image.LANCZOS)

def piece(pid):
    return next(p for p in PIECES if p['id'] == pid)

def piece_alpha(p):
    """Full-canvas alpha of piece p, only where it is the front-most owner (ids.png)."""
    s = p['sprite']; m = np.zeros(IDS.shape[:2], np.float32)
    a = np.asarray(Image.open(f"{V}/{s['file']}").getchannel('A')).astype(np.float32) / 255
    x, y = s['x'], s['y']; h, w = a.shape
    x0, y0 = max(0, x), max(0, y); x1, y1 = min(IDS.shape[1], x + w), min(IDS.shape[0], y + h)
    m[y0:y1, x0:x1] = a[y0 - y:y1 - y, x0 - x:x1 - x]
    return m

def paste_piece(canvas, art, p, art_xy):
    """Put generated art (painting px, placed at painting coords art_xy) into canvas (G box) under p's silhouette."""
    full = np.zeros(IDS.shape[:2] + (4,), np.float32)
    a = np.asarray(art.convert('RGBA')).astype(np.float32)
    x, y = art_xy; h, w = a.shape[:2]
    full[y:y + h, x:x + w] = a
    m = piece_alpha(p)[..., None] * (full[..., 3:] / 255)
    c = np.asarray(canvas).astype(np.float32)
    sub = lambda z: z[G[1]:G[3], G[0]:G[2]]
    out = c[..., :3] * (1 - sub(m)) + sub(full)[..., :3] * sub(m)
    canvas.paste(Image.fromarray(np.clip(out + .5, 0, 255).astype(np.uint8)).convert('RGBA'))

FIGS = [  # name, clip, frame, tile
    ('bo', 'idleSouthEast', 0, (6, 4)),
    ('kaya', 'walkSouthWest', 3, (8, 4)),
    ('sura', 'idleNorthWest', 0, (10, 7)),
]

def with_figures(base, uprights):
    """Figures depth-sorted against every upright piece of the frozen geometry (upright colours from `uprights`)."""
    out = base.copy()
    ups = [p for p in PIECES if p['sprite']['x'] < G[2] and p['sprite']['x'] + p['sprite']['width'] > G[0]
           and p['sprite']['y'] < G[3] and p['sprite']['y'] + p['sprite']['height'] > G[1]]
    layers = {}
    for p in ups:
        own = piece_alpha(p) * (IDS[..., 0] if IDS.ndim == 3 else IDS)[...,] * 0 + piece_alpha(p)
        layers[p['index']] = own[G[1]:G[3], G[0]:G[2]]
    ua = np.asarray(uprights.convert('RGBA'))
    for name, clip, i, (tx, ty) in sorted(FIGS, key=lambda f: f[3][0] + f[3][1]):
        place(out, frame(name, clip, i), tx, ty, G[0], G[1])
        d = tx + ty + 1
        for p in sorted(ups, key=lambda p: p['depthKey']):
            if p['depthKey'] > d:
                m = (layers[p['index']] * 255).astype(np.uint8)
                lay = Image.fromarray(ua.copy()); lay.putalpha(Image.fromarray(m))
                out.alpha_composite(lay)
    return out

def outline(im):
    d = ImageDraw.Draw(im)
    pts = [paint(0, 0), paint(14, 0), paint(14, 10), paint(0, 10), paint(0, 0)]
    d.line([(x - G[0], y - G[1]) for x, y in pts], fill=(255, 255, 255, 200), width=1)
    return im
