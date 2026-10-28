"""Grounding pass (ADR 0093): re-shade every object the G1 rounds set into the world, so it stands on its own base.

`objects.py` and `props_set.py` cast an object's shadow by measuring every pixel's height from the object's single lowest
row. On an oblique piece that is wrong: a table's top and back legs, a box's side base edges, are cast as if they stood
on its front foot, so the shadow lands as a flat band below the front feet and the piece floats. `reshade` then shortened
the bench's and fence's casts to a stub. This pass:

1. lifts the shadows those rounds multiplied into the world, exactly (the masks are deterministic; dividing restores
   the ground, as `props_set.lift` does): `objects.py`'s for the pieces it set, `reshade`'s for the bench and fence, and
   `props_set.set_in`'s for the redrawn posts, banners, notice board, handcart and trough;
2. casts each object from its own ground: every column of its silhouette from the lower convex hull of the silhouette's
   bottom edge under it (the runtime props' `groundedCast` in `src/render/lighting.ts`), along the painted objects' key
   (0.35, 0.16) at `objects.py`'s tone, closed so a rounded base leaves no holes;
3. lays a 1 px contact line under every edge that stands on that ground, at `objects.py`'s contact tone.

Casts and contact lines are unioned before they are applied, so overlapping shadows never darken twice, and nothing is
drawn over any object's own pixels. Run from the repository root (offline: the redraws are cached in `polish/`):

    python art/source/ba-dan-route-a/tools/shadows.py      # world-g1-polish.png -> world/world-g1-grounded.png
    WORLD_G1=art/source/ba-dan-route-a/world/world-g1-grounded.png python art/source/ba-dan-route-a/tools/regions_back.py
    sh scripts/art/ba-dan-regions/regen.sh
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('ROUTE_A_WORK', 'art/source/ba-dan-route-a/polish')
import numpy as np
from PIL import Image

import objects as O
import props_set as P
from polishlib import corner
from props import PROPS, image

SRC = 'art/source/ba-dan-route-a/world/world-g1-polish.png'
OUT = 'art/source/ba-dan-route-a/world/world-g1-grounded.png'
KEY = (O.SHADOW_KX, O.SHADOW_KY)
# Redone by their own polish steps (`garden.py` repainted the plot): their pixels carry no `objects.py` shadow to lift.
SKIP = {'garden-kit'}
# Painted pieces no round set in. One painted inside a house sprite has no silhouette of its own, so one whose outline is
# plain is authored here, in world px of the master: Gao's door barrel is a 17 x 36 px upright drum on the plinth, its
# bottom ink row at y = 523. It darkens no pixel that is already ink dark, so nothing the painting shaded is shaded twice.
# Not here: the court trees. Their frozen silhouettes run on below the painted roots over a strip of grass and path, so
# neither the silhouette's bottom nor the bark's colour says where a tree meets the ground (ADR 0093, known faults).
EXTRA_RECTS = {'gao-door-barrel': (1596, 488, 1612, 523)}
INK_DARK = 62
SCENE = json.load(open(f'{O.GEO}/scene.json'))['pieces']


def footprint_rows(piece, xy, w):
    """Per column of an object's art, the screen rows its footprint's ground diamond spans (top, bottom), or None.

    Ground corners are `polishlib.corner` (world px with the pan box corner at 0, 0, the master's own frame).
    """
    cells = next(p['footprint'] for p in SCENE if p['id'] == piece)
    rows = [None] * w
    for c in cells:
        pts = [corner(c['x'], c['y']), corner(c['x'] + 1, c['y']), corner(c['x'] + 1, c['y'] + 1), corner(c['x'], c['y'] + 1)]
        for x in range(w):
            X = xy[0] + x + 0.5
            ys = []
            for (ax, ay), (bx, by) in zip(pts, pts[1:] + pts[:1]):
                if min(ax, bx) <= X <= max(ax, bx) and ax != bx:
                    ys.append(ay + (by - ay) * (X - ax) / (bx - ax))
            if ys:
                top, bot = min(ys) - xy[1], max(ys) - xy[1]
                old = rows[x]
                rows[x] = (top, bot) if old is None else (min(old[0], top), max(old[1], bot))
    return rows


def hull_ground(al, rows=None, tol=3):
    """Per column of a silhouette, the lower convex hull of its bottom edge (-1 where nothing is known).

    With `rows` (the footprint's ground span per column), only columns whose bottom reaches that span stand on the
    ground: a lantern hanging from an arm or a roof's eave is not a foot. Columns between and beyond the feet take the
    hull's line, extended past its ends, so what hangs is cast from the ground under it.
    """
    H, W = al.shape
    pts = []
    for x in range(W):
        ys = np.nonzero(al[:, x])[0]
        if not len(ys):
            continue
        b = int(ys.max())
        if rows is not None and (rows[x] is None or b < rows[x][0] - tol):
            continue
        pts.append((x, b))
    base = np.full(W, -1)
    if not pts:
        return base
    hull = []
    for p in pts:
        while len(hull) >= 2:
            a, b = hull[-2], hull[-1]
            # keep b only if it lies below (larger y than) the segment a -> p
            if (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) < 0:
                break
            hull.pop()
        hull.append(p)
    for x in range(W):
        if not al[:, x].any():
            continue
        if len(hull) == 1:
            base[x] = hull[0][1]
            continue
        # the hull segment over x; past either end, level with the end foot (what hangs there stands over that ground)
        seg = next(((a, b) for a, b in zip(hull, hull[1:]) if a[0] <= x <= b[0]), None)
        if seg is None:
            base[x] = hull[0][1] if x < hull[0][0] else hull[-1][1]
        else:
            (ax, ay), (bx, by) = seg
            base[x] = round(ay + (by - ay) * (x - ax) / max(1, bx - ax))
        base[x] = max(base[x], int(np.nonzero(al[:, x])[0].max()))
    return base


def close3(m):
    """3 x 3 closing that keeps every set pixel."""
    return (P.erode(P.dilate(m, 1), 1)) | m


def grounded(al, xy, shape, piece=None):
    """World masks of an object's silhouette, its grounded cast and its contact line."""
    H, W = shape
    h, w = al.shape
    x0, y0 = xy
    base = hull_ground(al, footprint_rows(piece, xy, w) if piece else None)
    pad = int(np.ceil(max(KEY) * h)) + 2
    cast = np.zeros((h + pad, w + pad), bool)
    contact = np.zeros((h + 2, w), bool)
    for x in range(w):
        g = base[x]
        if g < 0:
            continue
        nxt = base[x + 1] if x + 1 < w and base[x + 1] >= 0 else g
        ys = np.nonzero(al[: g + 1, x])[0]
        for sub in (0, 0.5):
            gg = g + (nxt - g) * sub
            for step in (0, 0.5):
                rise = np.maximum(0, gg - ys + step)
                cx = np.round(x + sub + KEY[0] * rise).astype(int)
                cy = np.round(gg + KEY[1] * rise).astype(int)
                cast[cy, cx] = True
        # The contact line: the pixel under each bottom-facing edge that stands on the ground (at or below the hull).
        for y in np.nonzero(al[:, x] & ~np.append(al[1:, x], False))[0]:
            if y + 1 >= g:
                contact[y + 1, x] = True
    cast = close3(cast)

    def place(m):
        z = np.zeros(shape, bool)
        ys, xs = np.nonzero(m)
        ys, xs = ys + y0, xs + x0
        ok = (ys >= 0) & (ys < H) & (xs >= 0) & (xs < W)
        z[ys[ok], xs[ok]] = True
        return z

    return place(al), place(cast), place(contact)


def redraws():
    """The redrawn props `props_set.apply` set in: (name, piece, image, xy), with the old objects they replaced."""
    fam = json.load(open(f'{O.M}/families/families.json'))['objects']
    out = []
    for o in P.placed():
        if o['name'] not in PROPS:
            continue
        im, (ox, oy) = image(o['name'])
        s = PROPS[o['name']][0]
        ax, ay = fam[o['name']]['g1_anchor_px']
        fx, fy = o['xy'][0] + ax, o['xy'][1] + ay
        out.append({'name': o['name'], 'piece': o['piece'], 'image': im,
                    'xy': (round(fx - (ax * s + ox)), round(fy - (ay * s + oy)))})
    return out


def reshade_masks(o, shape):
    """Exactly the cast and pool `props_set.reshade` multiplied in for the bench and the fence."""
    H, W = shape
    al = np.asarray(o['image'])[..., 3] > 127
    x, y = o['xy']
    ys_, xs_ = np.nonzero(al)
    base = ys_.max()
    hgt = base - ys_
    obj = np.zeros(shape, bool)
    obj[ys_ + y, xs_ + x] = True
    cast = np.zeros(shape, bool)
    sx = xs_ + x + np.round(hgt * O.SHADOW_KX * 0.25).astype(int)
    sy = y + base + np.round(hgt * O.SHADOW_KY * 0.25).astype(int)
    ok = (sx >= 0) & (sx < W) & (sy >= 0) & (sy < H)
    cast[sy[ok], sx[ok]] = True
    cast = P.dilate(cast, 1) & ~obj
    low = np.zeros(shape, bool)
    yy, xx = np.nonzero(al & (np.arange(al.shape[0])[:, None] >= base - 3))
    low[yy + y + 1, xx + x] = True
    low[yy + y + 2, xx + x + 1] = True
    return cast, low & ~obj


def setin_masks(o, shape):
    """Exactly the cast and pool `props_set.set_in` multiplied in for a redrawn prop."""
    H, W = shape
    al = np.asarray(o['image'])[..., 3] > 127
    x, y = o['xy']

    def region(m, dx=0, dy=0):
        z = np.zeros(shape, bool)
        ys, xs = np.nonzero(m)
        ys, xs = ys + y + dy, xs + x + dx
        ok = (ys >= 0) & (ys < H) & (xs >= 0) & (xs < W)
        z[ys[ok], xs[ok]] = True
        return z

    obj = region(al)
    ys_, xs_ = np.nonzero(al)
    base = ys_.max()
    hgt = base - ys_
    cast = np.zeros(shape, bool)
    sx = xs_ + x + np.round(hgt * O.SHADOW_KX).astype(int)
    sy = y + base + np.round(hgt * O.SHADOW_KY).astype(int)
    ok = (sx >= 0) & (sx < W) & (sy >= 0) & (sy < H)
    cast[sy[ok], sx[ok]] = True
    cast = P.dilate(cast, 1)
    low = al & (np.arange(al.shape[0])[:, None] >= base - 3)
    pool = (region(low, 0, 1) | region(low, 1, 2) | region(low, -1, 1) | region(low, 2, 1)) & ~obj
    return obj, cast & ~obj, pool


def clamp_to_ground(a, before, lifted, r=6, gain=1.06):
    """Caps each lifted pixel at `gain` times the mean of the unlifted ground within `r` px, never below where it was."""
    ok = (~lifted).astype(np.float64)

    def box(x):
        # the sum over a (2r+1)^2 window, from a summed-area table
        p = np.pad(x.astype(np.float64), ((r + 1, r), (r + 1, r)), mode='constant')
        c = p.cumsum(0).cumsum(1)
        k = 2 * r + 1
        return c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]

    weight = box(ok)
    ref = np.stack([box(a[..., c] * ok) for c in range(3)], axis=2) / np.maximum(weight, 1e-3)[..., None]
    capped = np.maximum(np.minimum(a, ref * gain), before)
    out = a.copy()
    out[lifted] = capped[lifted]
    return out


def main():
    world = Image.open(SRC).convert('RGB')
    shape = (world.height, world.width)
    first = [o for o in P.placed() if o['name'] not in SKIP]
    kept = [o for o in first if o['name'] not in PROPS and o['name'] not in P.RESHADE]
    bench_fence = [o for o in first if o['name'] in P.RESHADE]
    redrawn = redraws()
    standing = kept + bench_fence + redrawn

    # Every object's own pixels: never shaded, never lifted.
    objs = np.zeros(shape, bool)
    for o in standing:
        al = np.asarray(o['image'])[..., 3] > 127
        ys, xs = np.nonzero(al)
        ys, xs = ys + o['xy'][1], xs + o['xy'][0]
        ok = (ys >= 0) & (ys < shape[0]) & (xs >= 0) & (xs < shape[1])
        objs[ys[ok], xs[ok]] = True

    # 1. Lift. The polish's own set-in multiplied last, then reshade, under them objects.py's.
    a = np.asarray(world).astype(np.float32)
    for o in redrawn:
        _, cast, pool = setin_masks(o, shape)
        for m, v in ((pool, P.POOL), (cast, P.CAST)):
            m = m & ~objs
            a[m] = a[m] / (v * P.COOL)
    for o in bench_fence:
        cast, pool = reshade_masks(o, shape)
        for m, v in ((pool, P.POOL), (cast, P.CAST)):
            m = m & ~objs
            a[m] = a[m] / (v * P.COOL)
    world = Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8))
    world, _ = P.lift(world, {o['name'] for o in kept})
    a = np.asarray(world).astype(np.float32)
    # Later polish steps (the garden plot, the paving calm, the clone fills) repainted some shaded pixels: dividing those
    # again would leave a pale ghost. No lifted pixel ends brighter than the unshaded ground around it.
    before = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
    lifted = (np.abs(a - before).max(axis=2) > 0.5) & ~objs
    a = clamp_to_ground(a, before, lifted)

    # 2 and 3. Cast from each object's own ground, then the contact line; unioned, so nothing darkens twice.
    cast = np.zeros(shape, bool)
    contact = np.zeros(shape, bool)
    for o in standing:
        al = np.asarray(o['image'])[..., 3] > 127
        _, c, t = grounded(al, o['xy'], shape, o['piece'])
        cast |= c
        contact |= t
    # The authored pieces inside the house sprites.
    lum = a.mean(axis=2)
    for name, (x0, y0, x1, y1) in EXTRA_RECTS.items():
        al = np.ones((y1 - y0 + 1, x1 - x0 + 1), bool)
        obj, c, t = grounded(al, (x0, y0), shape)
        objs |= obj
        cast |= c & (lum >= INK_DARK)
        contact |= t & (lum >= INK_DARK)
    contact &= ~objs
    cast &= ~objs & ~contact
    a[cast] *= O.SHADOW * O.COOL
    a[contact] *= O.CONTACT * O.COOL
    Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8)).save(OUT, optimize=True)
    print(f'{OUT}: {len(standing)} objects re-shaded ({len(kept)} set by objects.py, {len(bench_fence)} reshaded, '
          f'{len(redrawn)} redrawn), and {len(EXTRA_RECTS)} painted piece grounded')


if __name__ == '__main__':
    main()
