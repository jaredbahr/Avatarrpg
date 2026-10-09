"""Small solid-geometry helpers on top of guidelib.Piece: oriented beams, cylinders, roofs, wheels.

Everything is drawn through Piece.poly / Piece.line, so it is the same projection and guide style as v3.
Horizontal units are tiles, z is world px.  S is the world-px per tile used to turn a px radius into tiles
for vertical circles (2:1 dimetric: a ground unit is 64*sqrt(2)=90.5 screen px wide, the camera pitch makes a
vertical px worth tan(30)*... -> 78.4 z-px per tile).  Visibility uses the view vector (1, 1, 64/S) in iso space.
"""
import math
from guidelib import mul, K_TOP, K_LEFT, K_RIGHT

S = 78.4
VIEW = (1.0, 1.0, 64.0 / S)


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _norm(a):
    l = math.sqrt(_dot(a, a))
    return (a[0] / l, a[1] / l, a[2] / l) if l > 1e-12 else (0.0, 0.0, 1.0)


def iso(p):
    return (p[0], p[1], p[2] / S)


def uniso(q):
    return (q[0], q[1], q[2] * S)


def face_k(n):
    px, py, pz = max(n[0], 0), max(n[1], 0), max(n[2], 0)
    back = max(-n[0], 0) + max(-n[1], 0) + max(-n[2], 0)
    tot = px + py + pz + back
    if tot < 1e-9:
        return 1.0
    return (K_RIGHT * px + K_LEFT * py + K_TOP * pz + 0.6 * back) / tot


def solid(p, V, F, col, lw=1.3, tag=None, edge=True):
    """Convex solid: vertices V (world coords), faces F (index lists).  Only faces turned to the viewer are drawn."""
    iv = [iso(v) for v in V]
    c = tuple(sum(q[i] for q in iv) / len(iv) for i in range(3))
    for f in F:
        pts = [iv[i] for i in f]
        n = _norm(_cross(_sub(pts[1], pts[0]), _sub(pts[2], pts[0])))
        fc = tuple(sum(q[i] for q in pts) / len(pts) for i in range(3))
        if _dot(n, _sub(fc, c)) < 0:
            n = (-n[0], -n[1], -n[2])
        if _dot(n, VIEW) <= 1e-9:
            continue
        p.poly([V[i] for i in f], mul(col, face_k(n)), lw, edge=edge, tag=tag)


def beam(p, a, b, w, col, lw=1.2, h=None, tag=None):
    """Square-section beam from a to b (world coords); w, h in tiles (iso)."""
    ia, ib = iso(a), iso(b)
    ax = _norm(_sub(ib, ia))
    up = (0.0, 0.0, 1.0) if abs(ax[2]) < 0.95 else (1.0, 0.0, 0.0)
    u = _norm(_cross(ax, up))
    v = _norm(_cross(ax, u))
    hw, hh = w / 2.0, (h or w) / 2.0
    offs = [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]
    V = []
    for base in (ia, ib):
        for (s, t) in offs:
            V.append(uniso(tuple(base[i] + u[i] * s + v[i] * t for i in range(3))))
    F = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]
    solid(p, V, F, col, lw, tag)


def cyl(p, a, b, r, col, n=10, lw=1.0, tag=None, side_lw=0.4):
    """Round bar from a to b (radius r in tiles)."""
    ia, ib = iso(a), iso(b)
    ax = _norm(_sub(ib, ia))
    up = (0.0, 0.0, 1.0) if abs(ax[2]) < 0.95 else (1.0, 0.0, 0.0)
    u = _norm(_cross(ax, up))
    v = _norm(_cross(ax, u))
    V = []
    for base in (ia, ib):
        for i in range(n):
            t = 2 * math.pi * i / n
            V.append(uniso(tuple(base[k] + r * (math.cos(t) * u[k] + math.sin(t) * v[k]) for k in range(3))))
    iv = [iso(x) for x in V]
    c = tuple((ia[k] + ib[k]) / 2 for k in range(3))
    faces = [([i, (i + 1) % n, n + (i + 1) % n, n + i], side_lw) for i in range(n)]
    faces += [(list(range(n)), lw), (list(range(n, 2 * n)), lw)]
    for f, flw in faces:
        pts = [iv[i] for i in f]
        nn = _norm(_cross(_sub(pts[1], pts[0]), _sub(pts[2], pts[0])))
        fc = tuple(sum(q[i] for q in pts) / len(pts) for i in range(3))
        if _dot(nn, _sub(fc, c)) < 0:
            nn = (-nn[0], -nn[1], -nn[2])
        if _dot(nn, VIEW) <= 1e-9:
            continue
        p.poly([V[i] for i in f], mul(col, face_k(nn)), flw, tag=tag)


def pyramid(p, x0, x1, y0, y1, zb, zt, col, lw=1.2, apex=None):
    xm, ym = (x0 + x1) / 2, (y0 + y1) / 2
    ap = apex or (xm, ym, zt)
    p.poly([(x0, y1, zb), (x1, y1, zb), ap], mul(col, K_LEFT), lw)
    p.poly([(x1, y1, zb), (x1, y0, zb), ap], mul(col, K_RIGHT), lw)


def gable_roof(p, x0, x1, y0, y1, ze, zr, col, th=3.0, courses=5, cap=None):
    """Ridge along y at x = mid.  Far slope, near slope, +y gable triangle, fascia, course lines along the slope."""
    xm = (x0 + x1) / 2
    p.poly([(x0, y1, ze), (x1, y1, ze), (xm, y1, zr)], mul(col, 0.9), 1.3)  # gable end (+y), drawn first
    p.poly([(x0, y0, ze), (x0, y1, ze), (xm, y1, zr), (xm, y0, zr)], mul(col, K_ROOF_FAR_), 1.3)
    p.poly([(xm, y0, zr), (xm, y1, zr), (x1, y1, ze), (x1, y0, ze)], mul(col, K_ROOF_NEAR_), 1.4)
    p.poly([(x1, y0, ze), (x1, y1, ze), (x1, y1, ze - th), (x1, y0, ze - th)], mul(col, 0.7), 1.2)  # eave fascia (+x)
    p.poly([(x0, y1, ze), (x1, y1, ze), (x1, y1, ze - th), (x0, y1, ze - th)], mul(col, 0.8), 1.2)  # gable fascia (+y)
    for k in range(1, courses):
        f = k / courses
        p.line([(xm + (x1 - xm) * f, y0, zr + (ze - zr) * f), (xm + (x1 - xm) * f, y1, zr + (ze - zr) * f)], 0.9)
    p.line([(xm, y0, zr), (xm, y1, zr)], 1.8)  # ridge
    if cap:
        for k in range(1, 7):
            y = y0 + (y1 - y0) * k / 7
            p.line([(xm, y, zr), (x1, y, ze)], 0.8)


K_ROOF_NEAR_, K_ROOF_FAR_ = 1.1, 0.78


def ring3(cx, cy, cz, r_px, plane='y', n=24, a0=0.0, a1=2 * math.pi):
    """Vertical circle (plane 'y': in the x-z plane at y=cy; plane 'x': y-z plane at x=cx), radius in z-px."""
    rt = r_px / S
    out = []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        if plane == 'y':
            out.append((cx + rt * math.cos(a), cy, cz + r_px * math.sin(a)))
        else:
            out.append((cx, cy + rt * math.cos(a), cz + r_px * math.sin(a)))
    return out


def wheel(p, cx, cy, cz, R, col, thick=0.05, spokes=7, rim=5.0):
    """Cart wheel in the plane y = cy (+ thick towards the viewer): tread, felloe ring, hub and spoke strokes.  Real gaps between spokes."""
    n = 28
    # tread (outer cylinder), visible facets only
    for i in range(n):
        a, b = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        m = (a + b) / 2
        nn = _norm((math.cos(m), 0.0, math.sin(m)))
        if _dot(nn, VIEW) <= 1e-9:
            continue
        pa, pb = ring3(cx, cy, cz, R, 'y', 1, a, b)
        p.poly([(pa[0], cy, pa[2]), (pb[0], cy, pb[2]), (pb[0], cy + thick, pb[2]), (pa[0], cy + thick, pa[2])],
               mul(col, face_k(nn)), 0.3)
    # felloe ring (front face), made of quads between outer and inner arcs: hollow in the middle
    ro, ri = ring3(cx, cy + thick, cz, R, 'y', n), ring3(cx, cy + thick, cz, R - rim, 'y', n)
    for i in range(n):
        p.poly([ro[i], ro[i + 1], ri[i + 1], ri[i]], mul(col, 1.0), 0, edge=False)
    p.line(ro, 1.3)
    p.line(ri, 1.1)
    # spokes as thin strokes across the opening, hub as a short cylinder along y
    for k in range(spokes):
        a = 2 * math.pi * k / spokes + 0.2
        pi_ = ring3(cx, cy + thick * 0.6, cz, R - rim, 'y', 1, a, a)[0]
        p.line([(cx, cy + thick * 0.6, cz), pi_], 2.2, mul(col, 0.85) if False else (66, 40, 26))
    cyl(p, (cx, cy - 0.005, cz), (cx, cy + thick + 0.025, cz), 0.034, mul(col, 0.9), n=10, lw=1.1)
