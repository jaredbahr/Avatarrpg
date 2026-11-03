"""Kaya polish: one rendering across every clip. A generated cel (walk, hit, knockout, bend) comes back in PixelLab's
flatter hand; this puts the heading's restyled root back on it, part by part, deterministically:

1. both drawings are split into body parts by their skeletons (kp_body.py): the cel's as requested, the root's as estimated;
2. each part of the cel is mapped onto the same part of the root by its bone (translation alone for the head and torso
   unless they turn more than 10 degrees, a similarity for the limbs), the map nudged by up to 3 px to the offset where
   the part's silhouette best overlaps the root's;
3. a cel pixel takes the root's colour at its mapped point when that point is the same part of the root and the two
   colours are close (OKLab lightness within 0.10, chroma within 0.07): the same material in the same light;
   anything else (a new fold, a swinging limb's far side, a sleeve over the coat) keeps the cel's own colour. With
   `rigid` (the walk, the hits: the trunk only bobs and sways) the head and torso take the root's colour wherever the
   mapped point is the same part, whatever the cel drew there: the trunk is the root's own drawing, moved.

With `face` (the root's face mask from kp_face.py, #351) the head takes the root's colour at every mapped point inside
the mask, close or not, while the head turns less than 30 degrees from the root's (a falling head keeps its own): the inpainted eyes and brows ride on every cel's head instead of being dropped as a new colour.

The head and torso of a walk barely change, so they come back as the root's own pixels in every cel: no boil there by
construction. Then every cel goes through the one Kaya palette (kp_palette.py)."""
import numpy as np
from colour import to_oklab
from kp_body import NAMES, PARTS, joints, labels, similarity

TOL_L, TOL_AB, SEARCH = 0.10, 0.07, 3


def transfer(cel, cel_kps, root, root_kps, W, rigid=True, face=None, trunk_dy=None):
    """cel, root: HxWx4 uint8 on the same W canvas. Returns (rgba, fraction of the cel's pixels that took the root's colour).
    trunk_dy (rigid only, #408): the rows the root's trunk is moved down in this cel, set by the caller instead of searched."""
    ac = cel[..., 3] >= 128; ar = root[..., 3] >= 128
    Pc, Zc = joints(cel_kps, W); Pr, Zr = joints(root_kps, W)
    lc = labels(ac, Pc, Zc); lr = labels(ar, Pr, Zr)
    out = cel.copy(); out[..., 3] = np.where(ac, 255, 0); took = 0
    labc = to_oklab(cel[..., :3].reshape(-1, 3)).reshape(W, W, 3); labr = to_oklab(root[..., :3].reshape(-1, 3)).reshape(W, W, 3)
    for i, (a, b) in enumerate(PARTS.values()):
        ys, xs = np.nonzero(lc == i)
        if not len(ys): continue
        M, s = similarity(Pc[a], Pc[b], Pr[a], Pr[b])
        ang = abs(np.degrees(np.arctan2(M[1, 0], M[0, 0])))
        if NAMES[i] in ('head', 'torso') and ang < 10:
            M = np.array([[1, 0, 0], [0, 1, 0]], float); M[:, 2] = (Pr[a] + Pr[b]) / 2 - (Pc[a] + Pc[b]) / 2
        elif not 0.75 <= s <= 1.33:
            continue
        p = np.stack([xs + 0.5, ys + 0.5, np.ones(len(xs))], 1); q = p @ M.T
        best = None
        for dy in range(-SEARCH, SEARCH + 1):
            for dx in range(-SEARCH, SEARCH + 1):
                qx = np.floor(q[:, 0] + dx).astype(int); qy = np.floor(q[:, 1] + dy).astype(int)
                ok = (qx >= 0) & (qx < W) & (qy >= 0) & (qy < W)
                sc = np.zeros(len(qx)); sc[ok] = lr[qy[ok], qx[ok]] == i
                v = sc.mean() - 0.01 * (abs(dx) + abs(dy))
                if best is None or v > best[0]: best = (v, qx, qy, ok)
        _, qx, qy, ok = best
        same = np.zeros(len(qx), bool); same[ok] = lr[qy[ok], qx[ok]] == i
        if not same.any(): continue
        cy, cx, ry, rx = ys[same], xs[same], qy[same], qx[same]
        A, B = labc[cy, cx], labr[ry, rx]
        close = (np.abs(A[:, 0] - B[:, 0]) < TOL_L) & (np.hypot(*(A[:, 1:] - B[:, 1:]).T) < TOL_AB)
        if face is not None and NAMES[i] == 'head' and ang < 30: close |= face[ry, rx]   # not on a falling, turned head
        out[cy[close], cx[close], :3] = root[ry[close], rx[close], :3]; took += int(close.sum())
    if rigid: out = trunk(out, lc, Pc, Zc, root, lr, Pr, W, trunk_dy)
    return out, took / max(int(ac.sum()), 1)


def trunk(cel, lc, Pc, Zc, root, lr, Pr, W, dy_fixed=None):
    """The walk's trunk is the root's own: the root's head and torso pixels, moved by one offset (the cel's neck-to-hip
    midpoint onto the root's, nudged within 3 px to the best silhouette overlap), replace the cel's. A limb the cel draws in
    front of the torso (a higher z rank than the torso's) stays in front; the cel's own head pixels the root's head does
    not cover are dropped, so the hair keeps the root's outline.

    With dy_fixed (#408) the trunk's row is the caller's (moved down dy_fixed rows from the root's) and only its column
    is nudged: the overlap search moved the trunk up to 3 px a cel, and that was a hop."""
    T = [NAMES.index('head'), NAMES.index('torso')]; head = NAMES.index('head')
    off = ((Pr['NECK'] + Pr['MIDHIP']) / 2 - (Pc['NECK'] + Pc['MIDHIP']) / 2)
    ry, rx = np.nonzero(np.isin(lr, T)); cy, cx = np.nonzero(np.isin(lc, T))
    rset = set(zip(ry.tolist(), rx.tolist())); best = None
    for dy in ([None] if dy_fixed is not None else range(-SEARCH, SEARCH + 1)):
        for dx in range(-SEARCH, SEARCH + 1):
            oy, ox = (-int(dy_fixed) if dy is None else int(round(off[1])) + dy), int(round(off[0])) + dx
            v = sum((y + oy, x + ox) in rset for y, x in zip(cy.tolist(), cx.tolist())) - 0.5 * (abs(dx) + abs(dy or 0))
            if best is None or v > best[0]: best = (v, oy, ox)
    _, oy, ox = best
    zt = (Zc['NECK'] + Zc['MIDHIP']) / 2
    zl = {n: (Zc[a] + Zc[b]) / 2 for n, (a, b) in PARTS.items()}
    out = cel.copy()
    ys, xs = cy[lc[cy, cx] == head], cx[lc[cy, cx] == head]
    for y, x in zip(ys, xs):
        if (y + oy, x + ox) not in rset: out[y, x] = 0
    ty, tx = ry - oy, rx - ox; ok = (ty >= 0) & (ty < W) & (tx >= 0) & (tx < W)
    for y, x, y0, x0 in zip(ty[ok], tx[ok], ry[ok], rx[ok]):
        l = lc[y, x]
        if l >= 0 and l not in T and zl[NAMES[l]] > zt: continue
        out[y, x, :3] = root[y0, x0, :3]; out[y, x, 3] = 255
    return out
