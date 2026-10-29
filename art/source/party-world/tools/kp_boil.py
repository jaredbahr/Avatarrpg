"""Kaya polish: boil, measured. For each consecutive pair of cels in a clip (a walk wraps round), the region is the head and
torso of the first cel (kp_body.py's parts, from its requested skeleton): the body outside the moving limbs. The second cel
is shifted (within 3 px, the bob and sway) to where the most of that region's pixels match exactly, and boil is the share
of the region's pixels that still differ (another colour or no pixel). 0 is a body that only moves; #317 measured 11-44%
for its walk's upper body.

usage: imported by kp_report.py (boil(cels, skeletons, W) -> per-pair fractions)."""
import numpy as np
from kp_body import NAMES, joints, labels

REGION = [NAMES.index('head'), NAMES.index('torso')]


def pair(a, b, kps, W, search=3):
    al = a[..., 3] >= 128; P, Z = joints(kps, W); lab = labels(al, P, Z)
    ys, xs = np.nonzero(np.isin(lab, REGION))
    if not len(ys): return None
    best = None
    for dy in range(-search, search + 1):
        for dx in range(-search, search + 1):
            y2, x2 = ys + dy, xs + dx; ok = (y2 >= 0) & (y2 < W) & (x2 >= 0) & (x2 < W)
            same = np.zeros(len(ys), bool)
            same[ok] = (b[y2[ok], x2[ok], 3] >= 128) & np.all(b[y2[ok], x2[ok], :3] == a[ys[ok], xs[ok], :3], -1)
            v = same.mean()
            if best is None or v > best: best = v
    return 1 - best


def boil(cels, skels, W, wrap=False):
    n = len(cels); out = []
    for i in range(n if wrap else n - 1):
        j = (i + 1) % n; v = pair(cels[i], cels[j], skels[i], W)
        if v is not None: out.append(round(float(v), 3))
    return out
