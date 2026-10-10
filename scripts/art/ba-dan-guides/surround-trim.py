"""Trim the straight cuts out of the Ba Dan surround master: python scripts/art/ba-dan-guides/surround-trim.py

`art/source/ba-dan-surround/village-surround-master.png` was assembled from rectangular slices of generator output, so
its foliage clumps end on ruled vertical lines (a canopy cut flat for eighty rows), and four of them carry the end of a
house roof behind the trees that stops on the same line: a half roof with a chimney and a sliced ridge, which the game
shows beyond the north wall as a building with a part cut away.  Two things are done, both to the master in place and
neither adding a pixel of paint:

  1. the four sliced roofs (`ROOFS`, boxes in atlas pixels) lose their roof, chimney, timber and plaster pixels (anything in
     the box that is not foliage), so the canopy stands alone;
  2. every vertical edge of `MIN_RUN` rows or more, wherever it now falls, is eaten into over `DEPTH` px by a blobby noise
     mask, so it ends as a canopy ends: scalloped, a few pixels in and out, with the new rim darkened like the old one.

Alpha stays binary.  Running it again changes nothing (no ruled edge is left to find).  `ba-dan-surround.ts` (retired) then
encodes the shipped atlas from the result."""
import os
import sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MASTER = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'art', 'source', 'ba-dan-surround', 'village-surround-master.png'))
ROOFS = [(200, 38, 258, 130), (432, 280, 540, 367), (1330, 258, 1388, 350), (1562, 60, 1670, 147)]   # x0, y0, x1, y1
MIN_RUN = 20      # rows of a straight vertical edge worth trimming
DEPTH = 15        # px in from the edge that can be eaten
RIM = 0.62        # the new rim is this much of the colour it had
SPECK = 80        # px: a piece of canopy smaller than this is a leftover


def hash2(x, y, salt):
    h = (x.astype(np.int64) * 374761393 + y.astype(np.int64) * 668265263 + salt * 2246822519) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFFFF) / 4294967296.0


def value_noise(x, y, scale, salt):
    fx, fy = x / scale, y / scale
    x0, y0 = np.floor(fx).astype(np.int64), np.floor(fy).astype(np.int64)
    tx, ty = fx - x0, fy - y0
    sx, sy = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    def corner(ix, iy):
        return hash2(ix, iy, salt)
    top = corner(x0, y0) * (1 - sx) + corner(x0 + 1, y0) * sx
    bottom = corner(x0, y0 + 1) * (1 - sx) + corner(x0 + 1, y0 + 1) * sx
    return top * (1 - sy) + bottom * sy


def straight_edges(alpha):
    """[(x, y0, y1, side)] for every ruled vertical edge: x is the first opaque column of a 'left' edge (open to its left)
    and the last opaque column of a 'right' edge."""
    out = []
    for side, m, shift in (('left', alpha[:, 1:] & ~alpha[:, :-1], 1), ('right', alpha[:, :-1] & ~alpha[:, 1:], 0)):
        for col in np.nonzero(m.sum(0) >= MIN_RUN)[0]:
            rows = np.nonzero(m[:, col])[0]
            run_start = prev = rows[0]
            runs = []
            for y in rows[1:]:
                if y != prev + 1:
                    runs.append((run_start, prev))
                    run_start = y
                prev = y
            runs.append((run_start, prev))
            for a, b in runs:
                if b - a + 1 >= MIN_RUN:
                    out.append((int(col + shift), int(a), int(b), side))
    return out


def components(alpha):
    """The 8-connected pieces of a mask, each a list of (y, x)."""
    H, W = alpha.shape
    seen = np.zeros_like(alpha)
    out = []
    for y0, x0 in zip(*np.nonzero(alpha)):
        if seen[y0, x0]:
            continue
        seen[y0, x0] = True
        stack = [(y0, x0)]
        comp = []
        while stack:
            y, x = stack.pop()
            comp.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and alpha[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True
                        stack.append((yy, xx))
        out.append(comp)
    return out


def trim(img):
    img = img.copy()
    H, W = img.shape[:2]
    alpha = img[..., 3] > 0
    rgb = img[..., :3].astype(np.int64)
    # 1. the sliced roofs: whatever in the box is not clearly foliage (yellow-green: green at least as strong as red and
    #    well clear of blue).  Roof tiles, ridge, chimney, timber, plaster and their pale highlights and outlines all go.
    foliage = (rgb[..., 1] >= rgb[..., 0] - 4) & (rgb[..., 1] - rgb[..., 2] >= 28) & (rgb[..., 0] - rgb[..., 2] >= 14)
    gone = 0
    for x0, y0, x1, y1 in ROOFS:
        box = np.zeros_like(alpha)
        box[y0:y1, x0:x1] = True
        roof = box & alpha & ~foliage
        gone += int(roof.sum())
        img[roof] = 0
    alpha = img[..., 3] > 0
    # what the roof left behind: specks too small to be a canopy
    for comp in components(alpha):
        if len(comp) < SPECK:
            for y, x in comp:
                img[y, x] = 0
    alpha = img[..., 3] > 0
    # 2. the ruled edges
    ys, xs = np.mgrid[0:H, 0:W]
    n = 0
    rim = np.zeros_like(alpha)
    for x, y0, y1, side in straight_edges(alpha):
        sign = 1 if side == 'left' else -1       # which way is 'in'
        for k in range(DEPTH):
            col = x + sign * k
            if not 0 <= col < W:
                continue
            rows = np.arange(max(0, y0 - 6), min(H, y1 + 7))
            v = 0.7 * value_noise(np.full(rows.shape, col), rows, 7.0, 31) + 0.3 * hash2(np.full(rows.shape, col), rows, 37)
            taper = np.clip(np.minimum(rows - (y0 - 6), (y1 + 6) - rows) / 8.0, 0, 1)    # no step where the ruled run ends
            eat = 0.9 * (1 - k / DEPTH) ** 1.3 * taper
            drop = (v < eat) & alpha[rows, col]
            img[rows[drop], col] = 0
            n += int(drop.sum())
    alpha2 = img[..., 3] > 0
    # the new rim: opaque pixels that now touch the open
    edge = alpha2.copy()
    inner = alpha2.copy()
    inner[1:] &= alpha2[:-1]; inner[:-1] &= alpha2[1:]; inner[:, 1:] &= alpha2[:, :-1]; inner[:, :-1] &= alpha2[:, 1:]
    edge &= ~inner
    newrim = edge & alpha & (np.zeros_like(alpha) | True)
    # only where the old picture had a deeper pixel there, i.e. the rim is new
    old_edge = alpha.copy()
    old_inner = alpha.copy()
    old_inner[1:] &= alpha[:-1]; old_inner[:-1] &= alpha[1:]; old_inner[:, 1:] &= alpha[:, :-1]; old_inner[:, :-1] &= alpha[:, 1:]
    old_edge &= ~old_inner
    newrim = edge & ~old_edge
    img[newrim, :3] = np.round(img[newrim, :3] * RIM).astype(np.uint8)
    return img, gone, n, int(newrim.sum())


if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else MASTER
    src = np.array(Image.open(path).convert('RGBA'))
    out, gone, eaten, rim = trim(src)
    Image.fromarray(out, 'RGBA').save(path)
    print({'roof_px_removed': gone, 'edge_px_eaten': eaten, 'rim_px_darkened': rim,
           'ruled_edges_left': len(straight_edges(out[..., 3] > 0))})
